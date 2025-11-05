import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.json();
    const { title, sku, stock } = formData;

    // Validate required fields
    if (!title || !sku || stock === undefined) {
      return json(
        { error: "Missing required fields: title, sku, and stock" },
        { status: 400 }
      );
    }

    // --- STEP 1: Fetch primary location ID ---
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

    if (!locationsData.data?.locations?.edges?.length) {
      return json({ error: "No locations found" }, { status: 400 });
    }

    const locationId = locationsData.data.locations.edges[0].node.id;

    // --- STEP 2: Create the product (without inventory quantities) ---
    const createProductMutation = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            variants(first: 1) {
              edges {
                node {
                  id
                  sku
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
      variants: [
        {
          sku,
          inventoryManagement: "SHOPIFY",
          inventoryPolicy: "DENY"
        }
      ]
    };

    const productResponse = await admin.graphql(createProductMutation, {
      variables: { input: productInput }
    });

    const productData = await productResponse.json();

    if (productData.data?.productCreate?.userErrors?.length > 0) {
      return json(
        {
          error: "Product creation failed",
          details: productData.data.productCreate.userErrors
        },
        { status: 400 }
      );
    }

    const createdProduct = productData.data?.productCreate?.product;
    const variantNode = createdProduct?.variants?.edges?.[0]?.node;

    if (!createdProduct || !variantNode) {
      return json({ error: "Failed to create product variant" }, { status: 500 });
    }

    const inventoryItemId = variantNode.inventoryItem.id;

    // --- STEP 3: Set inventory quantity ---
    const setInventoryMutation = `
      mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
        inventorySetQuantities(input: $input) {
          inventoryAdjustmentGroup {
            createdAt
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const inventoryResponse = await admin.graphql(setInventoryMutation, {
      variables: {
        input: {
          name: "Initial stock set",
          reason: "correction",
          changes: [
            {
              name: "Initial stock",
              delta: parseInt(stock, 10),
              inventoryItemId,
              locationId
            }
          ]
        }
      }
    });

    const inventoryData = await inventoryResponse.json();

    if (inventoryData.data?.inventorySetQuantities?.userErrors?.length > 0) {
      return json(
        {
          error: "Failed to set inventory quantity",
          details: inventoryData.data.inventorySetQuantities.userErrors
        },
        { status: 400 }
      );
    }

    // --- SUCCESS ---
    return json({
      success: true,
      message: "Product created successfully",
      product: {
        id: createdProduct.id,
        title: createdProduct.title,
        handle: createdProduct.handle,
        variant: {
          id: variantNode.id,
          sku: variantNode.sku,
          inventoryItemId
        },
        locationId,
        stock: parseInt(stock, 10)
      }
    });

  } catch (error) {
    console.error("Error creating product:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
