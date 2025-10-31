// app/services/productSync.server.js
import fs from 'fs';
import path from 'path';

/**
 * Service for handling product synchronization between JSON data and Shopify
 * Reads from app/data/search_results.json and syncs with Shopify store
 */

const JSON_DATA_PATH = path.join(process.cwd(), 'app/data/search_results.json');

/**
 * Reads and parses the search results JSON file
 * @returns {Object} Parsed JSON data or null if file doesn't exist
 */
function readSearchResultsData() {
  try {
    if (!fs.existsSync(JSON_DATA_PATH)) {
      console.warn('Search results JSON file not found:', JSON_DATA_PATH);
      return null;
    }

    const rawData = fs.readFileSync(JSON_DATA_PATH, 'utf8');
    const data = JSON.parse(rawData);

    console.log(`Loaded ${data.totalFound || 0} products from search results`);
    return data;
  } catch (error) {
    console.error('Error reading search results JSON:', error);
    return null;
  }
}

/**
 * Transforms JSON product data to Shopify product format
 * @param {Object} productData - Product data from JSON
 * @returns {Object} Formatted product data for Shopify
 */
function transformProductForShopify(productData) {
  const { productData: data } = productData;

  return {
    title: data.title,
    body_html: data.description || '',
    vendor: 'Default Vendor', // You might want to map this from brand_id
    product_type: 'General', // You might want to map this from category_id
    status: data.status === 'on' ? 'active' : 'draft',
    tags: `reference:${data.reference}`,
    variants: [{
      title: 'Default Title',
      price: parseFloat(data.price).toFixed(2),
      sku: data.reference,
      inventory_quantity: data.stock,
      inventory_management: 'shopify',
      inventory_policy: 'deny',
      requires_shipping: true,
      taxable: true,
      barcode: data.barcode || '',
      grams: 0,
      weight: 0,
      weight_unit: 'kg'
    }],
    options: [{
      name: 'Title',
      values: ['Default Title']
    }],
    images: [] // Add image URLs if available in your data
  };
}

/**
 * Transforms a Vendus product (with options/variants/images) to Shopify product creation input
 * @param {Object} vendusProduct - Raw Vendus product object
 * @returns {Object} Shopify product input
 */
function transformVendusProductToShopifyInput(vendusProduct) {
  // 1. Gather all option names (e.g., Color, Size) and all possible values
  const optionMap = {};
  const variants = [];
  if (Array.isArray(vendusProduct.variants)) {
    vendusProduct.variants.forEach(variantGroup => {
      const option1 = variantGroup.variant?.title?.trim() || 'Option1';
      if (!optionMap['Option1']) optionMap['Option1'] = new Set();
      optionMap['Option1'].add(option1);
      if (Array.isArray(variantGroup.product_variants)) {
        variantGroup.product_variants.forEach(pv => {
          // Try to extract a second option (e.g., size) from pv.text (e.g., "PRETO / 35")
          let option2 = null;
          const parts = pv.text.split('/').map(s => s.trim());
          if (parts.length > 1) option2 = parts[1];
          if (option2) {
            if (!optionMap['Option2']) optionMap['Option2'] = new Set();
            optionMap['Option2'].add(option2);
          }
          // Build the variant object
          variants.push({
            option1,
            option2: option2 || null,
            sku: pv.code || '',
            barcode: pv.barcode || '',
            price: vendusProduct.gross_price || '0.00',
            inventory_quantity: (pv.stock?.find(s => s.store_id === 145418018)?.qty) || 0,
          });
        });
      }
    });
  }
  // 2. Build Shopify options array
  const options = [];
  if (optionMap['Option1']) {
    options.push({ name: 'Color', values: Array.from(optionMap['Option1']) });
  }
  if (optionMap['Option2']) {
    options.push({ name: 'Size', values: Array.from(optionMap['Option2']) });
  }
  // 3. Build Shopify variants array
  const shopifyVariants = variants.map(v => {
    const variant = {
      option1: v.option1,
      price: parseFloat(v.price).toFixed(2),
      sku: v.sku,
      barcode: v.barcode,
      inventory_quantity: v.inventory_quantity,
      inventory_management: 'shopify',
      inventory_policy: 'deny',
      requires_shipping: true,
      taxable: true,
      grams: 0,
      weight: 0,
      weight_unit: 'kg',
    };
    if (v.option2) variant.option2 = v.option2;
    return variant;
  });
  // 4. Add product thumbnail (featured image)
  const images = [];
  if (vendusProduct.images && vendusProduct.images.m) {
    images.push({ src: vendusProduct.images.m });
  } else if (vendusProduct.images && vendusProduct.images.xs) {
    images.push({ src: vendusProduct.images.xs });
  }
  // 5. Build the final Shopify product input
  return {
    title: vendusProduct.title,
    body_html: vendusProduct.description || '',
    vendor: 'Default Vendor',
    product_type: 'General',
    status: vendusProduct.status === 'on' ? 'active' : 'draft',
    tags: `reference:${vendusProduct.reference}`,
    options: options.length > 0 ? options : [{ name: 'Title', values: ['Default Title'] }],
    variants: shopifyVariants.length > 0 ? shopifyVariants : [{ title: 'Default Title', price: vendusProduct.gross_price || '0.00', sku: vendusProduct.reference, inventory_quantity: vendusProduct.stock, inventory_management: 'shopify', inventory_policy: 'deny', requires_shipping: true, taxable: true, barcode: vendusProduct.barcode || '', grams: 0, weight: 0, weight_unit: 'kg' }],
    images,
  };
}

export { transformVendusProductToShopifyInput };

/**
 * Checks if a product exists in Shopify by SKU
 * @param {Object} admin - Shopify admin API client
 * @param {string} sku - Product SKU to search for
 * @returns {Object|null} Existing product or null if not found
 */
async function findProductBySku(admin, sku) {
  try {
    const response = await admin.graphql(`
      query findProductBySku($sku: String!) {
        products(first: 1, query: $sku) {
          edges {
            node {
              id
              title
              handle
              status
              variants(first: 10) {
                edges {
                  node {
                    id
                    sku
                    price
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }
      }
    `, {
      variables: { sku: `sku:${sku}` }
    });

    const data = await response.json();

    if (data.data?.products?.edges?.length > 0) {
      return data.data.products.edges[0].node;
    }

    return null;
  } catch (error) {
    console.error(`Error finding product by SKU ${sku}:`, error);
    return null;
  }
}

/**
 * Creates a new product in Shopify
 * @param {Object} admin - Shopify admin API client
 * @param {Object} productData - Product data to create
 * @returns {Object} Result of the creation operation
 */
async function createShopifyProduct(admin, productData) {
  try {
    const response = await admin.graphql(`
      mutation createProduct($product: ProductInput!) {
        productCreate(input: $product) {
          product {
            id
            title
            handle
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        product: {
          title: productData.title,
          bodyHtml: productData.body_html,
          vendor: productData.vendor,
          productType: productData.product_type,
          status: productData.status.toUpperCase(),
          tags: [productData.tags],
          variants: productData.variants.map(variant => ({
            title: variant.title,
            price: variant.price,
            sku: variant.sku,
            inventoryQuantity: variant.inventory_quantity,
            inventoryManagement: variant.inventory_management.toUpperCase(),
            inventoryPolicy: variant.inventory_policy.toUpperCase(),
            requiresShipping: variant.requires_shipping,
            taxable: variant.taxable,
            barcode: variant.barcode,
            grams: variant.grams,
            weight: variant.weight,
            weightUnit: variant.weight_unit.toUpperCase()
          }))
        }
      }
    });

    const data = await response.json();

    if (data.data?.productCreate?.userErrors?.length > 0) {
      throw new Error(data.data.productCreate.userErrors.map(e => `${e.field}: ${e.message}`).join(', '));
    }

    return {
      success: true,
      product: data.data.productCreate.product
    };
  } catch (error) {
    console.error('Error creating Shopify product:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Updates an existing product in Shopify
 * @param {Object} admin - Shopify admin API client
 * @param {string} productId - Shopify product ID
 * @param {Object} productData - Updated product data
 * @returns {Object} Result of the update operation
 */
async function updateShopifyProduct(admin, productId, productData) {
  try {
    const response = await admin.graphql(`
      mutation updateProduct($id: ID!, $product: ProductInput!) {
        productUpdate(id: $id, input: $product) {
          product {
            id
            title
            handle
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        id: productId,
        product: {
          title: productData.title,
          bodyHtml: productData.body_html,
          vendor: productData.vendor,
          productType: productData.product_type,
          status: productData.status.toUpperCase(),
          tags: [productData.tags]
        }
      }
    });

    const data = await response.json();

    if (data.data?.productUpdate?.userErrors?.length > 0) {
      throw new Error(data.data.productUpdate.userErrors.map(e => `${e.field}: ${e.message}`).join(', '));
    }

    return {
      success: true,
      product: data.data.productUpdate.product
    };
  } catch (error) {
    console.error('Error updating Shopify product:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Updates product variant inventory
 * @param {Object} admin - Shopify admin API client
 * @param {string} variantId - Shopify variant ID
 * @param {number} quantity - New inventory quantity
 * @returns {Object} Result of the inventory update
 */
async function updateProductInventory(admin, variantId, quantity) {
  try {
    const response = await admin.graphql(`
      mutation updateInventory($inventoryItemId: ID!, $quantity: Int!) {
        inventorySetQuantities(input: {
          reason: "correction",
          setQuantities: [{
            inventoryItemId: $inventoryItemId,
            quantity: $quantity
          }]
        }) {
          inventoryAdjustmentGroup {
            createdAt
            reason
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        inventoryItemId: variantId,
        quantity: quantity
      }
    });

    const data = await response.json();

    if (data.data?.inventorySetQuantities?.userErrors?.length > 0) {
      throw new Error(data.data.inventorySetQuantities.userErrors.map(e => `${e.field}: ${e.message}`).join(', '));
    }

    return {
      success: true,
      adjustment: data.data.inventorySetQuantities.inventoryAdjustmentGroup
    };
  } catch (error) {
    console.error('Error updating inventory:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main synchronization function that processes all products from JSON
 * @param {Object} authPayload - Shopify authentication payload
 * @returns {Object} Synchronization results
 */
export async function syncProductsWithShopify(authPayload) {
  const startTime = Date.now();

  try {
    // Extract the admin API client from the auth payload
    const { admin } = authPayload;

    // Read the search results data
    const searchData = readSearchResultsData();

    if (!searchData || !searchData.found) {
      return {
        success: false,
        error: 'No product data found in search results JSON',
        createdProducts: [],
        updatedProducts: [],
        errors: [],
        sourceData: null,
        processingTime: Date.now() - startTime
      };
    }

    const results = {
      success: true,
      message: '',
      createdProducts: [],
      updatedProducts: [],
      errors: [],
      sourceData: {
        totalFound: searchData.totalFound,
        searchDate: searchData.searchDate
      },
      processingTime: 0
    };

    // Process each product in the JSON data
    for (const [reference, productInfo] of Object.entries(searchData.found)) {
      try {
        console.log(`Processing product: ${reference}`);

        // Transform the product data for Shopify
        const shopifyProductData = transformProductForShopify(productInfo);

        // Check if product already exists in Shopify
        const existingProduct = await findProductBySku(admin, reference);

        if (existingProduct) {
          // Update existing product
          console.log(`Updating existing product: ${reference}`);

          const updateResult = await updateShopifyProduct(
            admin,
            existingProduct.id,
            shopifyProductData
          );

          if (updateResult.success) {
            results.updatedProducts.push({
              reference,
              product: updateResult.product,
              ...productInfo.productData
            });
          } else {
            results.errors.push({
              reference,
              action: 'update',
              error: updateResult.error
            });
          }
        } else {
          // Create new product
          console.log(`Creating new product: ${reference}`);

          const createResult = await createShopifyProduct(admin, shopifyProductData);

          if (createResult.success) {
            results.createdProducts.push({
              reference,
              product: createResult.product,
              ...productInfo.productData
            });
          } else {
            results.errors.push({
              reference,
              action: 'create',
              error: createResult.error
            });
          }
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing product ${reference}:`, error);
        results.errors.push({
          reference,
          action: 'process',
          error: error.message
        });
      }
    }

    // Generate summary message
    const totalProcessed = results.createdProducts.length + results.updatedProducts.length;
    results.message = `Processed ${totalProcessed} products successfully. ` +
      `Created: ${results.createdProducts.length}, ` +
      `Updated: ${results.updatedProducts.length}, ` +
      `Errors: ${results.errors.length}`;

    results.processingTime = Date.now() - startTime;

    console.log(`Sync completed in ${results.processingTime}ms:`, results.message);

    return results;

  } catch (error) {
    console.error('Fatal error during product sync:', error);
    return {
      success: false,
      error: `Fatal sync error: ${error.message}`,
      createdProducts: [],
      updatedProducts: [],
      errors: [],
      sourceData: null,
      processingTime: Date.now() - startTime
    };
  }
}
