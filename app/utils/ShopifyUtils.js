// app/utils/ShopifyUtils.js

export class ShopifyUtils {
  static validateAdmin(admin) {
    if (!admin) {
      throw new Error("Admin object is required");
    }

    if (!admin.rest) {
      throw new Error("Admin REST client is not available");
    }

    if (!admin.rest.resources) {
      throw new Error("Admin REST resources are not available");
    }

    if (!admin.session) {
      throw new Error("Admin session is not available");
    }

    return true;
  }

  static async getProduct(admin, productId) {
    try {
      this.validateAdmin(admin);

      if (!productId) {
        throw new Error("Product ID is required");
      }

      console.log(`Fetching product ${productId} from Shopify`);

      const product = await admin.rest.resources.Product.find({
        session: admin.session,
        id: productId
      });

      if (!product) {
        console.log(`Product ${productId} not found`);
        return null;
      }

      console.log(`Successfully fetched product ${productId}`);
      return product;

    } catch (error) {
      console.error(`Failed to get product ${productId}:`, error);
      throw new Error(`Failed to fetch product: ${error.message}`);
    }
  }

  static async updateProduct(admin, productId, updateData) {
    try {
      this.validateAdmin(admin);

      if (!productId) {
        throw new Error("Product ID is required");
      }

      if (!updateData || typeof updateData !== 'object') {
        throw new Error("Update data is required and must be an object");
      }

      console.log(`Updating product ${productId} in Shopify`, updateData);

      // Create a new Product instance with the update data
      const product = new admin.rest.resources.Product({
        session: admin.session,
        id: productId,
        ...updateData
      });

      // Save the product
      const savedProduct = await product.save({
        update: true
      });

      console.log(`Successfully updated product ${productId}`);
      return savedProduct;

    } catch (error) {
      console.error(`Failed to update product ${productId}:`, error);
      throw new Error(`Failed to update product: ${error.message}`);
    }
  }

  static async getProducts(admin, params = {}) {
    try {
      this.validateAdmin(admin);

      console.log("Fetching products from Shopify", params);

      const products = await admin.rest.resources.Product.all({
        session: admin.session,
        ...params
      });

      console.log(`Successfully fetched ${products.data?.length || 0} products`);
      return products.data || [];

    } catch (error) {
      console.error("Failed to get products:", error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  static async searchProducts(admin, query) {
    try {
      this.validateAdmin(admin);

      if (!query) {
        throw new Error("Search query is required");
      }

      console.log(`Searching products in Shopify: ${query}`);

      // Use the GraphQL API for better search capabilities
      const searchQuery = `
        query searchProducts($query: String!, $first: Int!) {
          products(first: $first, query: $query) {
            edges {
              node {
                id
                title
                handle
                status
                createdAt
                updatedAt
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
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
      `;

      const variables = {
        query: query,
        first: 50
      };

      const response = await admin.graphql.request(searchQuery, { variables });
      const products = response.data?.products?.edges?.map(edge => edge.node) || [];

      console.log(`Found ${products.length} products matching "${query}"`);
      return products;

    } catch (error) {
      console.error("Failed to search products:", error);
      throw new Error(`Failed to search products: ${error.message}`);
    }
  }

  static async getProductVariants(admin, productId) {
    try {
      this.validateAdmin(admin);

      if (!productId) {
        throw new Error("Product ID is required");
      }

      console.log(`Fetching variants for product ${productId}`);

      const variants = await admin.rest.resources.Variant.all({
        session: admin.session,
        product_id: productId
      });

      console.log(`Found ${variants.data?.length || 0} variants for product ${productId}`);
      return variants.data || [];

    } catch (error) {
      console.error(`Failed to get variants for product ${productId}:`, error);
      throw new Error(`Failed to fetch product variants: ${error.message}`);
    }
  }

  static async updateProductVariant(admin, variantId, updateData) {
    try {
      this.validateAdmin(admin);

      if (!variantId) {
        throw new Error("Variant ID is required");
      }

      if (!updateData || typeof updateData !== 'object') {
        throw new Error("Update data is required and must be an object");
      }

      console.log(`Updating variant ${variantId}`, updateData);

      const variant = new admin.rest.resources.Variant({
        session: admin.session,
        id: variantId,
        ...updateData
      });

      const savedVariant = await variant.save({
        update: true
      });

      console.log(`Successfully updated variant ${variantId}`);
      return savedVariant;

    } catch (error) {
      console.error(`Failed to update variant ${variantId}:`, error);
      throw new Error(`Failed to update variant: ${error.message}`);
    }
  }

  static async getInventoryLevels(admin, inventoryItemId) {
    try {
      this.validateAdmin(admin);

      if (!inventoryItemId) {
        throw new Error("Inventory item ID is required");
      }

      console.log(`Fetching inventory levels for item ${inventoryItemId}`);

      const inventoryLevels = await admin.rest.resources.InventoryLevel.all({
        session: admin.session,
        inventory_item_ids: inventoryItemId
      });

      return inventoryLevels.data || [];

    } catch (error) {
      console.error(`Failed to get inventory levels for item ${inventoryItemId}:`, error);
      throw new Error(`Failed to fetch inventory levels: ${error.message}`);
    }
  }

  static formatProductForDisplay(product) {
    if (!product) return null;

    return {
      id: product.id,
      title: product.title || 'Untitled Product',
      handle: product.handle || '',
      status: product.status || 'draft',
      createdAt: product.created_at || product.createdAt,
      updatedAt: product.updated_at || product.updatedAt,
      variants: product.variants?.map(variant => ({
        id: variant.id,
        title: variant.title || 'Default Title',
        sku: variant.sku || '',
        price: variant.price || '0.00',
        inventory: variant.inventory_quantity || 0
      })) || []
    };
  }

  static validateProductData(productData) {
    const errors = [];

    if (!productData.title || productData.title.trim() === '') {
      errors.push('Product title is required');
    }

    if (productData.variants && Array.isArray(productData.variants)) {
      productData.variants.forEach((variant, index) => {
        if (variant.price && isNaN(parseFloat(variant.price))) {
          errors.push(`Variant ${index + 1} has invalid price`);
        }

        if (variant.inventory_quantity && !Number.isInteger(variant.inventory_quantity)) {
          errors.push(`Variant ${index + 1} has invalid inventory quantity`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
