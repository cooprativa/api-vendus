// app/utils/products.js

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import axios from 'axios'; // Mantido caso outras partes do app usem, mas não mais para chamadas diretas da Vendus neste arquivo
import { getVendusApi } from "../services/settings.server"; // Mantido pois é importado, mas não será usado para chamadas da API da Vendus neste arquivo
import shopify from '../shopify.server';


// Data directory and file paths
const DATA_DIR = join(process.cwd(), "app", "data");
const SEARCH_RESULTS_FILE = join(DATA_DIR, "search_results.json");
const SHORTCUTS_FILE = join(DATA_DIR, "shortcuts.json");


// Replace with your actual Shopify Location ID
const SHOPIFY_LOCATION_ID = "gid://shopify/Location/102699630920";

// As configurações da API da Vendus, funções de retry (VENDUS_URL, RETRY_CONFIG, sleep, getRetryDelay, fetchPageFromVendus)
// foram removidas, pois este arquivo não fará mais chamadas diretas à API da Vendus para dados de produtos.
// Presume-se que outro script é responsável por popular o search_results.json.


/**
 * Helper function to ensure data directory exists
 */
async function ensureDataDirectory() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    console.log("Data directory ensured:", DATA_DIR);
  } catch (error) {
    console.error("Failed to create data directory:", error);
    throw error;
  }
}

/**
 * Helper function to read shortcuts with better error handling
 * @returns {Promise<string[]>} An array of shortcut references.
 */
export async function readShortcuts() {
  try {
    await ensureDataDirectory();
    const shortcutsRaw = await readFile(SHORTCUTS_FILE, "utf-8");
    const shortcuts = JSON.parse(shortcutsRaw);
    console.log("Successfully read shortcuts:", shortcuts);
    return Array.isArray(shortcuts) ? shortcuts : [];
  } catch (error) {
    console.log("No shortcuts file found or error reading it, starting with empty array:", error.message);
    return [];
  }
}


/**
 * Helper function to process a list of products and sync them with Shopify.
 * This abstracts the core logic for creating/updating products and managing inventory.
 *
 * @param {Object} admin - The Shopify Admin API client.
 * @param {Object} productsToProcess - An object where keys are product references and values are product data.
 * @param {string|null} onlineStorePublicationId - The Shopify Online Store publication ID.
 * @returns {Promise<Object>} An object containing results (created, updated, errors).
 */
async function processProductBatch(admin, productsToProcess, onlineStorePublicationId) {
  const createdProducts = [];
  const updatedProducts = [];
  const errors = [];

  for (const [reference, productInfo] of Object.entries(productsToProcess)) {
    try {
      console.log(`\n📦 Processing product: ${reference}`);
      const productData = productInfo.productData;

      // Validate essential product data before proceeding.
      if (!productData.title || !productData.price) {
        errors.push({
          reference: reference,
          error: "Missing required fields: title or price",
          action: 'validation'
        });
        continue; // Skip to the next product if essential data is missing.
      }

      // Ensure price is a string, defaulting to "0.00" if not available.
      const priceString = String(productData.price || "0.00");
      console.log(`💰 Price for ${reference}: "${priceString}"`);

      // Generate a clean handle for the product URL.
      const handle = productData.reference?.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') ||
        productData.title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

      // Search for an existing product in Shopify using a custom tag.
      console.log(`🔍 Searching for existing product with tag: ref-${productData.reference}`);
      let searchData;
      try {
        const searchResponse = await admin.graphql(`
          query searchProducts($query: String!) {
            products(first: 5, query: $query) {
              edges {
                node {
                  id
                  title
                  tags
                  handle
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        sku
                        price
                        inventoryQuantity
                        inventoryItem {
                          id
                          sku
                          tracked
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `, {
          variables: {
            query: `tag:ref-${productData.reference}`
          }
        });
        searchData = await searchResponse.json();
        if (searchData.errors) {
          console.error(`DEBUG: GraphQL errors for searchProducts (reference: ${reference}):`, JSON.stringify(searchData.errors, null, 2));
          errors.push({
            reference: reference,
            error: `GraphQL Search Error: ${searchData.errors.map(e => e.message).join(', ')}`,
            action: 'search product'
          });
          continue;
        }
      } catch (error) {
        console.error(`Error during Shopify product search for ${reference}:`, error);
        errors.push({
          reference: reference,
          error: `Shopify Search API Error: ${error.message}`,
          action: 'search product'
        });
        continue;
      }

      const existingProduct = searchData.data?.products?.edges?.[0]?.node;

      // Prepare product data for Shopify API calls.
      const shopifyProductData = {
        title: productData.title,
        descriptionHtml: productData.description ? `<p>${productData.description}</p>` : `<p>${productData.title}</p>`,
        vendor: "Imported Products", // Default vendor, can be mapped from data.
        handle: handle,
        productType: "General", // Default product type, can be mapped from data.
        status: "ACTIVE", // Set product status to active.
        tags: [
          `ref-${productData.reference}`, // Custom tag for future identification.
          "search-import",
          "auto-sync"
        ],
      };

      let currentProductId = null;
      let currentVariantId = null;
      let currentInventoryItemId = null;

      if (existingProduct) {
        console.log("✅ Found existing product:", existingProduct.id);
        currentProductId = existingProduct.id;
        currentVariantId = existingProduct.variants?.edges?.[0]?.node?.id;
        currentInventoryItemId = existingProduct.variants?.edges?.[0]?.node?.inventoryItem?.id;

        let updateData;
        try {
          const updateResponse = await admin.graphql(`
            mutation productUpdate($input: ProductInput!) {
              productUpdate(input: $input) {
                product {
                  id
                  title
                  handle
                  status
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        price
                        sku
                        inventoryQuantity
                        inventoryItem {
                          id
                          tracked
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
          `, {
            variables: {
              input: {
                id: existingProduct.id,
                title: shopifyProductData.title,
                descriptionHtml: shopifyProductData.descriptionHtml,
                vendor: shopifyProductData.vendor,
                productType: shopifyProductData.productType,
                status: shopifyProductData.status,
                tags: shopifyProductData.tags
              }
            }
          });

          updateData = await updateResponse.json();
          if (updateData.errors) {
            console.error(`DEBUG: GraphQL errors for productUpdate (reference: ${reference}):`, JSON.stringify(updateData.errors, null, 2));
            errors.push({
              reference: reference,
              error: `GraphQL Product Update Error: ${updateData.errors.map(e => e.message).join(', ')}`,
              action: 'update product'
            });
            continue;
          }

          if (updateData.data?.productUpdate?.userErrors?.length > 0) {
            errors.push({
              reference: reference,
              errors: updateData.data.productUpdate.userErrors,
              action: 'update product'
            });
            continue;
          }
        } catch (error) {
          console.error(`Error during Shopify product update for ${reference}:`, error);
          errors.push({
            reference: reference,
            error: `Shopify Product Update API Error: ${error.message}`,
            action: 'update product'
          });
          continue;
        }

        if (currentVariantId) {
          try {
            console.log(`Attempting to update variant ${currentVariantId} for product ${reference} with price ${priceString} and SKU ${productData.reference}.`);
            const variantUpdateResponse = await admin.graphql(`
              mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                  productVariants {
                    id
                    price
                    sku
                    inventoryQuantity
                    inventoryItem {
                      id
                      tracked
                    }
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `, {
              variables: {
                productId: currentProductId,
                variants: [{
                  id: currentVariantId,
                  price: priceString,
                  inventoryItem: {
                    sku: productData.reference,
                  }
                }]
              }
            });

            const variantUpdateData = await variantUpdateResponse.json();
            if (variantUpdateData.errors) {
              console.error(`DEBUG: GraphQL errors for productVariantsBulkUpdate (reference: ${reference}):`, JSON.stringify(variantUpdateData.errors, null, 2));
              errors.push({
                reference: reference,
                error: `GraphQL Variant Update Error: ${variantUpdateData.errors.map(e => e.message).join(', ')}`,
                action: 'update variant'
              });
            }

            if (variantUpdateData.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
              errors.push({
                reference: reference,
                errors: variantUpdateData.data.productVariantsBulkUpdate.userErrors,
                action: 'update variant'
              });
            }
          } catch (variantError) {
            console.error(`Variant update error for ${reference}:`, variantError);
            errors.push({
              reference: reference,
              error: `Variant update failed: ${variantError.message}`,
              action: 'update variant'
            });
          }
        }

        if (currentInventoryItemId) {
          try {
            console.log(`Attempting to set inventory tracking for item ${currentInventoryItemId} to true.`);
            const inventoryItemUpdateResponse = await admin.graphql(`
              mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
                inventoryItemUpdate(id: $id, input: $input) {
                  inventoryItem {
                    id
                    tracked
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `, {
              variables: {
                id: currentInventoryItemId,
                input: {
                  tracked: true
                }
              }
            });

            const inventoryItemUpdateData = await inventoryItemUpdateResponse.json();
            if (inventoryItemUpdateData.errors) {
              console.error(`DEBUG: GraphQL errors for inventoryItemUpdate (reference: ${reference}):`, JSON.stringify(inventoryItemUpdateData.errors, null, 2));
              errors.push({
                reference: reference,
                error: `GraphQL Inventory Item Update Error: ${inventoryItemUpdateData.errors.map(e => e.message).join(', ')}`,
                action: 'update inventory tracking'
              });
            }

            if (inventoryItemUpdateData.data?.inventoryItemUpdate?.userErrors?.length > 0) {
              errors.push({
                reference: reference,
                errors: inventoryItemUpdateData.data.inventoryItemUpdate.userErrors,
                action: 'update inventory tracking'
              });
            }
          } catch (inventoryItemError) {
            console.error(`Inventory item tracking update error for ${reference}:`, inventoryItemError);
            errors.push({
              reference: reference,
              error: `Inventory item tracking update failed: ${inventoryItemError.message}`,
              action: 'update inventory tracking'
            });
          }
        }

        if (currentInventoryItemId && productData.stock !== undefined && productData.stock !== null) {
          try {
            const currentStock = existingProduct.variants?.edges?.[0]?.node?.inventoryQuantity || 0;
            const newStock = parseInt(productData.stock) || 0;
            const delta = newStock - currentStock;

            if (delta !== 0) {
              console.log(`📦 Adjusting inventory: ${currentStock} → ${newStock} (delta: ${delta})`);

              const inventoryResponse = await admin.graphql(`
                mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                  inventoryAdjustQuantities(input: $input) {
                    inventoryAdjustmentGroup {
                      createdAt
                      reason
                      changes {
                        name
                        delta
                      }
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `, {
                variables: {
                  input: {
                    reason: "correction",
                    name: "available",
                    changes: [{
                      delta: delta,
                      inventoryItemId: currentInventoryItemId,
                      locationId: SHOPIFY_LOCATION_ID
                    }]
                  }
                }
              });

              const inventoryData = await inventoryResponse.json();
              if (inventoryData.errors) {
                console.error(`DEBUG: GraphQL errors for inventoryAdjustQuantities (reference: ${reference}):`, JSON.stringify(inventoryData.errors, null, 2));
                errors.push({
                  reference: reference,
                  error: `GraphQL Inventory Adjustment Error: ${inventoryData.errors.map(e => e.message).join(', ')}`,
                  action: 'update inventory'
                });
              }

              if (inventoryData.data?.inventoryAdjustQuantities?.userErrors?.length > 0) {
                errors.push({
                  reference: reference,
                  errors: inventoryData.data.inventoryAdjustQuantities.userErrors,
                  action: 'update inventory'
                });
              }
            }
          } catch (inventoryError) {
            console.error(`Inventory update error for ${reference}:`, inventoryError);
            errors.push({
              reference: reference,
              error: `Inventory update failed: ${inventoryError.message}`,
              action: 'update inventory'
            });
          }
        }

        updatedProducts.push({
          reference: reference,
          product: updateData.data.productUpdate.product,
          action: 'updated',
          price: priceString,
          stock: productData.stock
        });

      } else {
        console.log("➕ Creating new product");

        let createData;
        try {
          const createResponse = await admin.graphql(`
            mutation productCreate($input: ProductInput!) {
              productCreate(input: $input) {
                product {
                  id
                  title
                  handle
                  status
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        price
                        sku
                        inventoryQuantity
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
          `, {
            variables: {
              input: {
                title: shopifyProductData.title,
                descriptionHtml: shopifyProductData.descriptionHtml,
                vendor: shopifyProductData.vendor,
                productType: shopifyProductData.productType,
                status: shopifyProductData.status,
                tags: shopifyProductData.tags,
              }
            }
          });

          createData = await createResponse.json();
          if (createData.errors) {
            console.error(`DEBUG: GraphQL errors for productCreate (reference: ${reference}):`, JSON.stringify(createData.errors, null, 2));
            errors.push({
              reference: reference,
              error: `GraphQL Product Create Error: ${createData.errors.map(e => e.message).join(', ')}`,
              action: 'create product'
            });
            continue;
          }

          if (createData.data?.productCreate?.userErrors?.length > 0) {
            errors.push({
              reference: reference,
              errors: createData.data.productCreate.userErrors,
              action: 'create product'
            });
            continue;
          }
        } catch (error) {
          console.error(`Error during Shopify product creation for ${reference}:`, error);
          errors.push({
            reference: reference,
            error: `Shopify Product Create API Error: ${error.message}`,
            action: 'create product'
          });
          continue;
        }

        currentProductId = createData.data?.productCreate?.product?.id;
        currentVariantId = createData.data?.productCreate?.product?.variants?.edges?.[0]?.node?.id;
        const newInventoryItemId = createData.data?.productCreate?.product?.variants?.edges?.[0]?.node?.inventoryItem?.id;

        if (currentVariantId && newInventoryItemId) {
          try {
            console.log(`Attempting to update new product variant ${currentVariantId} for product ${reference} with price ${priceString}, SKU ${productData.reference}.`);
            const variantUpdateResponse = await admin.graphql(`
              mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                  productVariants {
                    id
                    price
                    sku
                    inventoryQuantity
                    inventoryItem {
                      id
                      tracked
                    }
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `, {
              variables: {
                productId: currentProductId,
                variants: [{
                  id: currentVariantId,
                  price: priceString,
                  inventoryItem: {
                    sku: productData.reference,
                  }
                }]
              }
            });

            const variantUpdateData = await variantUpdateResponse.json();
            if (variantUpdateData.errors) {
              console.error(`DEBUG: GraphQL errors for productVariantsBulkUpdate (new product, reference: ${reference}):`, JSON.stringify(variantUpdateData.errors, null, 2));
              errors.push({
                reference: reference,
                error: `GraphQL New Variant Update Error: ${variantUpdateData.errors.map(e => e.message).join(', ')}`,
                action: 'update new variant'
              });
            }

            if (variantUpdateData.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
              errors.push({
                reference: reference,
                errors: variantUpdateData.data.productVariantsBulkUpdate.userErrors,
                action: 'update new variant'
              });
            }
          } catch (variantError) {
            console.error(`New variant update error for ${reference}:`, variantError);
            errors.push({
              reference: reference,
              error: `New variant update failed: ${variantError.message}`,
              action: 'update new variant'
            });
          }

          try {
            console.log(`Attempting to set inventory tracking for new item ${newInventoryItemId} to true.`);
            const inventoryItemUpdateResponse = await admin.graphql(`
              mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
                inventoryItemUpdate(id: $id, input: $input) {
                  inventoryItem {
                    id
                    tracked
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `, {
              variables: {
                id: newInventoryItemId,
                input: {
                  tracked: true
                }
              }
            });

            const inventoryItemUpdateData = await inventoryItemUpdateResponse.json();
            if (inventoryItemUpdateData.errors) {
              console.error(`DEBUG: GraphQL errors for inventoryItemUpdate (new product, reference: ${reference}):`, JSON.stringify(inventoryItemUpdateData.errors, null, 2));
              errors.push({
                reference: reference,
                error: `GraphQL New Product Inventory Item Update Error: ${inventoryItemUpdateData.errors.map(e => e.message).join(', ')}`,
                action: 'set new product inventory tracking'
              });
            }

            if (inventoryItemUpdateData.data?.inventoryItemUpdate?.userErrors?.length > 0) {
              errors.push({
                reference: reference,
                errors: inventoryItemUpdateData.data.inventoryItemUpdate.userErrors,
                action: 'set new product inventory tracking'
              });
            }
          } catch (inventoryItemError) {
            console.error(`New product inventory item tracking update error for ${reference}:`, inventoryItemError);
            errors.push({
              reference: reference,
              error: `New product inventory item tracking update failed: ${inventoryItemError.message}`,
              action: 'set new product inventory tracking'
            });
          }

          if (productData.stock !== undefined && productData.stock !== null) {
            try {
              const newStock = parseInt(productData.stock) || 0;
              console.log(`📦 Setting initial inventory for new product: ${newStock}`);

              const inventoryResponse = await admin.graphql(`
                mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                  inventoryAdjustQuantities(input: $input) {
                    inventoryAdjustmentGroup {
                      createdAt
                      reason
                      changes {
                        name
                        delta
                      }
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `, {
                variables: {
                  input: {
                    reason: "correction",
                    name: "available",
                    changes: [{
                      delta: newStock,
                      inventoryItemId: newInventoryItemId,
                      locationId: SHOPIFY_LOCATION_ID
                    }]
                  }
                }
              });

              const inventoryData = await inventoryResponse.json();
              if (inventoryData.errors) {
                console.error(`DEBUG: GraphQL errors for inventoryAdjustQuantities (new product inventory, reference: ${reference}):`, JSON.stringify(inventoryData.errors, null, 2));
                errors.push({
                  reference: reference,
                  error: `GraphQL New Product Inventory Adjustment Error: ${inventoryData.errors.map(e => e.message).join(', ')}`,
                  action: 'set new product inventory'
                });
              }

              if (inventoryData.data?.inventoryAdjustQuantities?.userErrors?.length > 0) {
                errors.push({
                  reference: reference,
                  errors: inventoryData.data.inventoryAdjustQuantities.userErrors,
                  action: 'set new product inventory'
                });
              }
            } catch (inventoryError) {
              console.error(`New product inventory update error for ${reference}:`, inventoryError);
              errors.push({
                reference: reference,
                error: `New product inventory update failed: ${inventoryError.message}`,
                action: 'set new product inventory'
              });
            }
          }
        } else {
          errors.push({
            reference: reference,
            error: "Failed to retrieve default variant or inventory item ID for new product.",
            action: 'post-creation variant setup'
          });
        }

        if (currentProductId) {
          createdProducts.push({
            reference: reference,
            product: createData.data.productCreate.product,
            action: 'created',
            price: priceString,
            stock: productData.stock
          });
        }
      }

      if (currentProductId && onlineStorePublicationId) {
        try {
          const publishResponse = await admin.graphql(`
            mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
              publishablePublish(id: $id, input: $input) {
                publishable {
                  availablePublicationsCount {
                    count
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `, {
            variables: {
              id: currentProductId,
              input: [{
                publicationId: onlineStorePublicationId,
                publishDate: new Date().toISOString()
              }]
            }
          });

          const publishData = await publishResponse.json();
          if (publishData.errors) {
            console.error(`DEBUG: GraphQL errors for publishablePublish (reference: ${reference}):`, JSON.stringify(publishData.errors, null, 2));
            errors.push({
              reference: reference,
              error: `GraphQL Publish Error: ${publishData.errors.map(e => e.message).join(', ')}`,
              action: 'publish product'
            });
          }

          if (publishData.data?.publishablePublish?.userErrors?.length > 0) {
            console.warn(`⚠️ Publish warning for ${reference}:`, publishData.data.publishablePublish.userErrors);
            errors.push({
              reference: reference,
              errors: publishData.data.publishablePublish.userErrors,
              action: 'publish product (user error)'
            });
          }
        } catch (publishError) {
          console.warn(`⚠️ Publish error for ${reference}:`, publishError);
          errors.push({
            reference: reference,
            error: `Publish failed: ${publishError.message}`,
            action: 'publish product'
          });
        }
      }

    } catch (error) {
      console.error(`Error processing product ${reference}:`, error);
      errors.push({
        reference: reference,
        error: error.message,
        action: 'overall processing'
      });
    }
  }
  return { createdProducts, updatedProducts, errors };
}

/**
 * Deletes products from Shopify that exist in Shopify but are not found in the provided JSON data.
 * It identifies products by a specific tag (`ref-`).
 *
 * @param {Object} admin - The Shopify Admin API client.
 * @param {Object} jsonFoundProducts - An object containing products found in the local JSON, keyed by reference.
 * @returns {Promise<Object>} An object containing deleted products and any errors.
 */
async function deleteShopifyProductsNotInJson(admin, jsonFoundProducts) {
  const deletedProducts = [];
  const deletionErrors = [];

  try {
    console.log("🔍 Searching Shopify for products to potentially delete...");
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
      const shopifyProductsResponse = await admin.graphql(`
        query getShopifyProducts($after: String) {
          products(first: 50, query: "tag:ref-", after: $after) {
            edges {
              node {
                id
                title
                tags
              }
              cursor
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      `, {
        variables: {
          after: cursor
        }
      });

      const shopifyProductsData = await shopifyProductsResponse.json();

      if (shopifyProductsData.errors) {
        console.error(`DEBUG: GraphQL errors during Shopify product fetch for deletion:`, JSON.stringify(shopifyProductsData.errors, null, 2));
        deletionErrors.push({
          error: `GraphQL Fetch Error: ${shopifyProductsData.errors.map(e => e.message).join(', ')}`,
          action: 'fetch products for deletion'
        });
        break;
      }

      const products = shopifyProductsData.data?.products?.edges || [];
      hasNextPage = shopifyProductsData.data?.products?.pageInfo?.hasNextPage || false;
      cursor = products.length > 0 ? products[products.length - 1].cursor : null;

      for (const edge of products) {
        const product = edge.node;
        const refTag = product.tags.find(tag => tag.startsWith('ref-'));
        const reference = refTag ? refTag.substring(4) : null;

        if (reference && !jsonFoundProducts[reference]) {
          console.log(`🗑️ Deleting Shopify product: ${product.title} (ID: ${product.id}, Reference: ${reference}) - Not found in local JSON.`);
          try {
            const deleteResponse = await admin.graphql(`
              mutation productDelete($id: ID!) {
                productDelete(input: { id: $id }) {
                  deletedProductId
                  userErrors {
                    field
                    message
                  }
                }
              }
            `, {
              variables: {
                id: product.id
              }
            });

            const deleteData = await deleteResponse.json();
            if (deleteData.errors) {
              console.error(`DEBUG: GraphQL errors during productDelete (ID: ${product.id}, Reference: ${reference}):`, JSON.stringify(deleteData.errors, null, 2));
              deletionErrors.push({
                reference: reference,
                error: `GraphQL Deletion Error: ${deleteData.errors.map(e => e.message).join(', ')}`,
                action: 'delete product'
              });
            } else if (deleteData.data?.productDelete?.userErrors?.length > 0) {
              deletionErrors.push({
                reference: reference,
                errors: deleteData.data.productDelete.userErrors,
                action: 'delete product'
              });
            } else {
              deletedProducts.push({
                id: product.id,
                title: product.title,
                reference: reference,
                action: 'deleted'
              });
            }
          } catch (deleteError) {
            console.error(`Error deleting Shopify product ${product.id} (${reference}):`, deleteError);
            deletionErrors.push({
              reference: reference,
              error: `Shopify Deletion API Error: ${deleteError.message}`,
              action: 'delete product'
            });
          }
        }
      }
    }
    console.log(`🗑️ Deleted ${deletedProducts.length} products from Shopify.`);
  } catch (error) {
    console.error("Top-level error in deleteShopifyProductsNotInJson:", error);
    deletionErrors.push({
      error: error.message || "An unknown error occurred during deletion process.",
      action: 'overall deletion process'
    });
  }

  return { deletedProducts, deletionErrors };
}


/**
 * Synchronizes all product data from a JSON file with Shopify.
 * Creates new products or updates existing ones, including their prices and inventory.
 * Also deletes products from Shopify that are no longer in the JSON file.
 *
 * @param {Object} admin - The Shopify Admin API client.
 * @returns {Promise<Object>} An object containing sync results (created, updated, errors, message, deletedProducts).
 */
export async function syncProductsWithShopify(admin) {
  try {
    console.log("🔍 Reading file from:", SEARCH_RESULTS_FILE);

    let jsonData;
    try {
      const fileContent = await readFile(SEARCH_RESULTS_FILE, 'utf8');
      jsonData = JSON.parse(fileContent);
      console.log("✅ Successfully loaded JSON data");
    } catch (fileError) {
      console.error("❌ File read error:", fileError);
      return {
        success: false,
        error: `Failed to read search results file: ${fileError.message}`,
        filePath: SEARCH_RESULTS_FILE
      };
    }

    if (!jsonData || !jsonData.found || Object.keys(jsonData.found).length === 0) {
      console.log("⚠️ No products found in JSON data to sync. Skipping product updates and deletions to preserve existing Shopify products.");
      // IMPORTANT CHANGE: Do NOT delete products if the source file is empty.
      return {
        success: true, // Consider this a success as it handled the empty file gracefully
        createdProducts: [],
        updatedProducts: [],
        deletedProducts: [], // No deletions performed in this scenario
        errors: [],
        sourceData: jsonData,
        message: "No products found in JSON data to sync. Existing Shopify products were not modified."
      };
    }

    console.log(`🚀 Starting to process ${Object.keys(jsonData.found).length} products...`);

    let onlineStorePublicationId = null;
    try {
      const publicationsResponse = await admin.graphql(`
        query getPublications {
          publications(first: 10) {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `);

      const publicationsData = await publicationsResponse.json();
      if (publicationsData.errors) {
        console.error(`DEBUG: GraphQL errors for getPublications:`, JSON.stringify(publicationsData.errors, null, 2));
      }

      const onlineStorePublication = publicationsData.data?.publications?.edges?.find(
        edge => edge.node.name === "Online Store"
      );

      if (onlineStorePublication) {
        onlineStorePublicationId = onlineStorePublication.node.id;
        console.log("✅ Found Online Store Publication ID:", onlineStorePublicationId);
      } else {
        console.warn("⚠️ Could not find Online Store publication");
      }
    } catch (pubError) {
      console.warn(`⚠️ Could not fetch publications:`, pubError);
    }

    const { createdProducts, updatedProducts, errors } = await processProductBatch(admin, jsonData.found, onlineStorePublicationId);

    const { deletedProducts, deletionErrors } = await deleteShopifyProductsNotInJson(admin, jsonData.found);

    const totalProcessed = createdProducts.length + updatedProducts.length;
    const allErrors = [...errors, ...deletionErrors];
    const hasErrors = allErrors.length > 0;

    return {
      success: totalProcessed > 0 || deletedProducts.length > 0 || allErrors.length === 0,
      createdProducts,
      updatedProducts,
      deletedProducts,
      errors: allErrors,
      sourceData: jsonData,
      message: `Successfully processed ${totalProcessed} products (${createdProducts.length} created, ${updatedProducts.length} updated). ${deletedProducts.length} products deleted from Shopify.${hasErrors ? ` Encountered ${allErrors.length} errors.` : ''}`
    };

  } catch (error) {
    console.error("Top-level error in syncProductsWithShopify:", error);
    return {
      success: false,
      error: error.message || "An unknown error occurred during processing.",
      stack: error.stack
    };
  }
}

/**
 * Reads product data from search_results.json.
 * This function no longer fetches from Vendus directly. It assumes search_results.json
 * is populated by another process.
 *
 * @returns {Promise<Object>} An object containing search results data or an error.
 */
export async function runSearchScript() {
  try {
    console.log(`🔍 Attempting to read product data from ${SEARCH_RESULTS_FILE}.`);

    let jsonData = { found: {}, notFound: [], searchDate: new Date().toISOString(), totalFound: 0, totalSearched: 0 };
    try {
      const fileContent = await readFile(SEARCH_RESULTS_FILE, 'utf8');
      jsonData = JSON.parse(fileContent);
      console.log("✅ Successfully loaded local search_results.json data.");
    } catch (fileError) {
      console.log("No existing search_results.json found or error reading it, starting with empty structure (no products to sync from file):", fileError.message);
      // If file doesn't exist or is invalid, treat as empty for syncing purposes
      jsonData = { found: {}, notFound: [], searchDate: new Date().toISOString(), totalFound: 0, totalSearched: 0 };
    }

    // This script no longer fetches data from Vendus.
    // Its purpose is to provide the structure for syncProductsWithShopify.

    // Ensure 'found' is an object and contains actual data if present
    if (typeof jsonData.found !== 'object' || jsonData.found === null) {
      jsonData.found = {};
    }

    jsonData.totalFound = Object.keys(jsonData.found).length;
    jsonData.totalSearched = Object.keys(jsonData.found).length; // If only reading, total searched = total found
    jsonData.searchDate = new Date().toISOString();

    return {
      success: true,
      searchResults: jsonData,
      message: `Successfully read ${jsonData.totalFound} product references from search_results.json.`
    };

  } catch (error) {
    console.error("Top-level error in runSearchScript:", error);
    return {
      success: false,
      error: error.message || "An unknown error occurred during search_results.json read.",
      stack: error.stack
    };
  }
}

async function executeProductUpdate() {
  console.log("Starting the product update process in products.js...");
  try {
    // 1. Get Vendus API Key (still imported, but not used for API calls in this script)
    // const vendusApiKey = getVendusApi(); // Não é mais necessário para chamadas diretas da API neste script

    // 2. Read shortcuts (product references) - esta parte é opcional agora se search_results.json for a fonte direta
    // Mas mantendo para preservar um pouco o fluxo original, embora runSearchScript não os use para buscar.
    console.log("Reading product shortcuts (for informational purposes, not for Vendus API fetching in this script)...");
    const productReferences = await readShortcuts();
    if (productReferences.length === 0) {
      console.log("No product shortcuts found. This script will rely entirely on search_results.json for product data.");
    }

    // 3. Em vez de executar uma busca na Vendus, simplesmente 'preparar' os dados do search_results.json
    console.log("Preparing product data from search_results.json for Shopify synchronization...");
    const searchResult = await runSearchScript(); // Não passa mais productReferences, pois não busca da Vendus
    if (!searchResult.success) {
      console.error("Failed to prepare product data from search_results.json:", searchResult.error);
      return; // Parar se a leitura de search_results.json falhar
    }
    console.log("Product data preparation from search_results.json completed:", searchResult.message);


    // 4. Get Shopify Admin client
    const adminClient = shopifyAdmin;
    if (!adminClient) {
      console.error("Shopify Admin client is not available. Cannot sync products.");
      return;
    }

    // 5. Sync products with Shopify based on search_results.json
    console.log("Calling syncProductsWithShopify to update Shopify products...");
    const syncResult = await syncProductsWithShopify(adminClient);
    if (!syncResult.success) {
      console.error("Failed to sync products with Shopify:", syncResult.error);
    } else {
      console.log("Product synchronization with Shopify completed successfully.");
      console.log("Sync Results:", {
        created: syncResult.createdProducts.length,
        updated: syncResult.updatedProducts.length,
        deleted: syncResult.deletedProducts.length,
        errors: syncResult.errors.length
      });
    }

    console.log("Product update process finished successfully.");
  } catch (error) {
    console.error("Failed to run product update from products.js:", error);
  }
}

// Call the function to start the process
executeProductUpdate();
