// app/routes/api.products.create.jsx
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

    // First, get the primary location ID
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

    // Create the product with inventory
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
      title: title,
      variants: [
        {
          sku: sku,
          inventoryManagement: "SHOPIFY",
          inventoryPolicy: "DENY",
          inventoryQuantities: [
            {
              availableQuantity: parseInt(stock),
              locationId: locationId
            }
          ]
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

    if (!createdProduct) {
      return json({ error: "Failed to create product" }, { status: 500 });
    }

    return json({
      success: true,
      product: {
        id: createdProduct.id,
        title: createdProduct.title,
        handle: createdProduct.handle,
        variant: createdProduct.variants.edges[0]?.node
      }
    });

  } catch (error) {
    console.error("Error creating product:", error);
    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
