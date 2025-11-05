import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.json();
    const { title, variants } = formData;
    // variants = [{ color: "Red", sku: "TSHIRT-RED", stock: 10 }, ...]

    if (!title || !Array.isArray(variants) || variants.length === 0) {
      return json({ error: "Missing required fields: title and variants" }, { status: 400 });
    }

    // --- Step 1: Get location ID ---
    const locationsQuery = `
      query {
        locations(first: 1) {
          edges {
            node {
              id
              name
              isPrimary
            }
          }
        }
      }
    `;

    const locationsResponse = await admin.graphql(locationsQuery);
    const locationsData = await locationsResponse.json();

    const locationId = locationsData.data?.locations?.edges?.[0]?.node?.id;
    if (!locationId) {
      return json({ error: "No location found" }, { status: 400 });
    }

    console.log("📦 Location ID:", locationId);

    // --- Step 2: Create product with color variants ---
    const createProductMutation = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            variants(first: 100) {
              edges {
                node {
                  id
                  sku
                  title
                  selectedOptions {
                    name
                    value
                  }
                  inventoryItem {
                    id
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const productInput = {
      title,
      options: ["Color"],
      variants: variants.map(v => ({
        sku: v.sku,
        title: `${title} - ${v.color}`,
        options: [v.color],
        inventoryManagement: "SHOPIFY",
        inventoryPolicy: "DENY"
      }))
    };

    const productResponse = await admin.graphql(createProductMutation, {
      variables: { input: productInput }
    });
    const productData = await productResponse.json();

    const productCreate = productData.data?.productCreate;
    if (productCreate?.userErrors?.length) {
      console.error("❌ Product creation errors:", productCreate.userErrors);
      return json({ error: "Product creation failed", details: productCreate.userErrors }, { status: 400 });
    }

    const createdProduct = productCreate?.product;
    if (!createdProduct) {
      return json({ error: "Product creation returned no data" }, { status: 500 });
    }

    console.log(`✅ Created product: ${createdProduct.title} (${createdProduct.id})`);

    // --- Step 3: Adjust inventory for each variant ---
    const adjustInventoryMutation = `
      mutation inventoryAdjustQuantity($input: InventoryAdjustQuantityInput!) {
        inventoryAdjustQuantity(input: $input) {
          inventoryLevel {
            id
            available
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const inventoryResults = [];

    for (const [i, variantEdge] of createdProduct.variants.edges.entries()) {
      const variantNode = variantEdge.node;
      const stock = parseInt(variants[i].stock, 10);

      console.log(`🔧 Setting stock for ${variantNode.sku} → ${stock}`);

      const adjustResponse = await admin.graphql(adjustInventoryMutation, {
        variables: {
          input: {
            inventoryItemId: variantNode.inventoryItem.id,
            locationId,
            availableDelta: stock // set initial stock
          }
        }
      });

      const adjustData = await adjustResponse.json();
      if (adjustData.data?.inventoryAdjustQuantity?.userErrors?.length > 0) {
        console.error("❌ Inventory adjust error:", adjustData.data.inventoryAdjustQuantity.userErrors);
      } else {
        console.log(`✅ Stock set for ${variantNode.sku}`);
      }

      inventoryResults.push(adjustData.data?.inventoryAdjustQuantity);
    }

    // --- Success Response ---
    return json({
      success: true,
      message: "Product with color variants created and stock updated successfully",
      product: {
        id: createdProduct.id,
        title: createdProduct.title,
        variants: createdProduct.variants.edges.map(v => ({
          id: v.node.id,
          sku: v.node.sku,
          color: v.node.selectedOptions.find(o => o.name === "Color")?.value,
          inventoryItemId: v.node.inventoryItem.id
        }))
      },
      inventoryResults
    });

  } catch (error) {
    console.error("🔥 Error creating product:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
