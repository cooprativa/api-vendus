import axios from 'axios';
import fs from 'fs/promises'; // Use fs/promises for promise-based operations
import { join } from 'path'; // Import 'join' from the 'path' module
import 'dotenv/config'; // This automatically loads .env file

const API_KEY = process.env.VENDUS_API_KEY;  // Replace with your actual API key or use process.env.VENDUS_API_KEY
console.log(`Using Vendus API Key: ${API_KEY}`); // Log the API key for debugging (remove in production)
const URL = "https://www.vendus.pt/ws/v1.1/products";

// Corrected Path to your search results JSON file
// This path is relative to where products.js (and thus page_reader_products.js) is executed from.
// Assuming your project root is 'api-vendus' and 'app' is inside it.
const DATA_DIR = join(process.cwd(), 'app', 'data');
const SEARCH_RESULTS_FILE = join(DATA_DIR, "search_results.json");

// Configure axios with improved settings
const apiClient = axios.create({
  auth: {
    username: API_KEY,
    password: ''
  },
  timeout: 15000,
  maxRedirects: 0,
  headers: {
    'Accept': 'application/json',
    'User-Agent': 'Node.js API Client',
    'Connection': 'keep-alive'
  }
});

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 8000,
  backoffFactor: 2
};

// Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Calculate exponential backoff delay
function getRetryDelay(attempt) {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

/**
 * Fetches a page from the Vendus API with retry logic.
 * @param {number} page - The page number to fetch.
 * @param {number} [attempt=0] - Current retry attempt.
 * @returns {Promise<object>} - Object containing page, data, success status, and attempts.
 */
async function fetchPageWithRetry(page, attempt = 0) {
  try {
    console.log(`➡️  Attempting to fetch page ${page} from Vendus API (Attempt: ${attempt + 1})`);
    const response = await apiClient.get(URL, {
      params: {
        page: page,
        per_page: 100
      }
    });
    console.log(`✅ Successfully fetched page ${page} from Vendus API.`);
    return { page, data: response.data, success: true, attempts: attempt + 1 };
  } catch (error) {
    const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
    const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ENOTFOUND';
    const shouldRetry = (isTimeout || isNetworkError) && attempt < RETRY_CONFIG.maxRetries;

    if (shouldRetry) {
      const delay = getRetryDelay(attempt);
      console.log(`⏳ Retrying page ${page} in ${delay}ms (attempt ${attempt + 2}/${RETRY_CONFIG.maxRetries + 1})`);
      await sleep(delay);
      return fetchPageWithRetry(page, attempt + 1);
    }

    console.log(`❌ Error fetching page ${page} from Vendus: ${error.message}`);
    return { page, data: null, success: false, error: error.message, attempts: attempt + 1 };
  }
}

/**
 * Checks a product object for any of the given references.
 * @param {object} produto - The product object to check.
 * @param {Set<string>} refs - A Set of references to find.
 * @returns {Array<string>} - An array of references found in the product.
 */
function checkProductForRefs(produto, refs) {
  const foundRefs = [];

  for (const ref of refs) {
    // Check main product fields
    if (produto.reference === ref ||
      produto.code === ref ||
      produto.id?.toString() === ref ||
      (!isNaN(ref) && produto.id === parseInt(ref))) {
      foundRefs.push(ref);
      continue;
    }

    // Check variants if main product didn't match
    if (produto.variants) {
      let variantMatch = false;
      for (const variant of produto.variants) {
        // Check the 'variant' object inside the main variant block
        if (variant.variant) {
          if (variant.variant.code === ref || variant.variant.title === ref || variant.variant.reference === ref ||
            (variant.variant.id?.toString() === ref || (!isNaN(ref) && variant.variant.id === parseInt(ref)))) {
            foundRefs.push(ref);
            variantMatch = true;
            break;
          }
        }
        // Check 'product_variants' if they exist
        if (variant.product_variants && Array.isArray(variant.product_variants)) {
          for (const pv of variant.product_variants) {
            if (pv.code === ref || pv.text === ref || pv.barcode === ref ||
              (pv.id?.toString() === ref || (!isNaN(ref) && pv.id === parseInt(ref)))) {
              foundRefs.push(ref);
              variantMatch = true;
              break; // Found in product_variant, no need to check other product_variants for this variant
            }
          }
        }
        if (variantMatch) break;
      }
    }
  }
  return foundRefs;
}

/**
 * Loads search results from a JSON file.
 * @param {string} filePath - The path to the JSON file.
 * @returns {Promise<object>} - The parsed JSON data or a default empty structure if an error occurs or file not found.
 */
async function loadSearchResultsFromFile(filePath) {
  try {
    // Ensure the directory exists before attempting to read
    await fs.mkdir(DATA_DIR, { recursive: true });
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`⚠️  Search results file '${filePath}' not found. Creating a new one.`);
      return { searchDate: new Date().toISOString(), totalSearched: 0, totalFound: 0, found: {}, notFound: [] };
    } else {
      console.error(`❌ Error loading search results from ${filePath}: ${error.message}. Returning empty structure.`);
      return { searchDate: new Date().toISOString(), totalSearched: 0, totalFound: 0, found: {}, notFound: [] };
    }
  }
}

/**
 * Saves search results to a JSON file.
 * @param {string} filePath - The path to the JSON file.
 * @param {object} data - The data to save.
 */
async function saveSearchResultsToFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Search results saved to ${filePath}`);
  } catch (error) {
    console.error(`❌ Error saving search results to ${filePath}: ${error.message}`);
  }
}

/**
 * Updates product data by fetching specific pages from Vendus API based on existing known product locations.
 * @param {object} existingFoundProducts - An object where keys are references and values are product data including 'page'.
 * @param {number} concurrency - Number of concurrent API requests.
 * @returns {Promise<object>} - An object containing updated found references (Map) and not found references (Set).
 */
async function updateProductsFromKnownPages(existingFoundProducts, concurrency = 6) {
  const startTime = Date.now();
  const updatedFoundRefsMap = new Map(); // Stores { ref: updatedProductData }
  const failedToUpdateRefsSet = new Set(); // Stores refs that could not be updated

  const refsToUpdate = Object.keys(existingFoundProducts);
  if (refsToUpdate.length === 0) {
    console.log("ℹ️ No references to update from 'search_results.json'. Skipping Vendus API calls.");
    return { found: new Map(), notFound: new Set(), totalSearched: 0 };
  }

  console.log(`🚀 UPDATING PRODUCTS FROM KNOWN PAGES - ${refsToUpdate.length} references`);
  console.log(`📦 References to update: ${refsToUpdate.join(', ')}`);
  console.log(`⚡ Concurrency: ${concurrency} page fetches at once`);
  console.log('='.repeat(60));

  // Group products by page number
  const productsByPage = new Map(); // Map<pageNumber, Set<ref>>
  refsToUpdate.forEach(ref => {
    const page = existingFoundProducts[ref]?.page;
    if (page) {
      if (!productsByPage.has(page)) {
        productsByPage.set(page, new Set());
      }
      productsByPage.get(page).add(ref);
    } else {
      console.warn(`⚠️  Product '${ref}' in local file has no 'page' information. Skipping update for this ref.`);
      failedToUpdateRefsSet.add(ref);
    }
  });

  const uniquePagesToFetch = Array.from(productsByPage.keys()).sort((a, b) => a - b);
  let totalPagesFetched = 0;
  let totalProductsUpdated = 0;
  let totalApiRequests = 0;
  let totalRetries = 0;
  let totalErrors = 0;

  // Process pages in batches
  for (let i = 0; i < uniquePagesToFetch.length; i += concurrency) {
    const batchPages = uniquePagesToFetch.slice(i, i + concurrency);
    console.log(`\n🔍 Fetching batch of pages from Vendus: ${batchPages.join(', ')}`);

    const pagePromises = batchPages.map((page, index) =>
      new Promise(resolve =>
        setTimeout(() => resolve(fetchPageWithRetry(page)), index * 100) // Stagger requests
      )
    );

    const pageResults = await Promise.all(pagePromises);

    pageResults.forEach(result => {
      totalApiRequests++;
      if (result.attempts > 1) {
        totalRetries += result.attempts - 1;
      }
      if (!result.success) {
        totalErrors++;
      }
    });

    for (const result of pageResults) {
      const pageNumber = result.page;
      const refsOnThisPage = productsByPage.get(pageNumber) || new Set();

      if (!result.success || !result.data) {
        // Mark all products originally on this failed page as failed to update
        refsOnThisPage.forEach(ref => failedToUpdateRefsSet.add(ref));
        continue;
      }

      totalPagesFetched++;

      let productsOnPage = Array.isArray(result.data) ? result.data :
        result.data.data || result.data.products ||
        result.data.items || result.data.results;

      if (!Array.isArray(productsOnPage)) {
        console.warn(`⚠️  Vendus API response for page ${pageNumber} did not contain a product array.`);
        // Mark products originally on this page as failed to update
        refsOnThisPage.forEach(ref => failedToUpdateRefsSet.add(ref));
        continue;
      }

      // Find and update specific products from this page
      refsOnThisPage.forEach(ref => {
        let productFoundOnPage = false;
        for (let index = 0; index < productsOnPage.length; index++) {
          const currentProduct = productsOnPage[index];
          // Check if this product matches the reference we are looking for
          const matchedRefs = checkProductForRefs(currentProduct, new Set([ref]));

          if (matchedRefs.includes(ref)) {
            console.log(`✨ Successfully updated data for '${ref}' from Vendus on page ${pageNumber}`);

            // --- BEGIN of Image, Color, Size extraction (copied from app.products.jsx) ---
            const images = [];
            if (currentProduct.images && typeof currentProduct.images === 'object') {
              if (currentProduct.images.m) {
                images.push(currentProduct.images.m);
              } else if (currentProduct.images.xs) {
                images.push(currentProduct.images.xs);
              }
            }

            const colors = new Set();
            const sizes = new Set();

            if (currentProduct.variants && Array.isArray(currentProduct.variants)) {
              currentProduct.variants.forEach(variant => {
                if (variant.variant && variant.variant.title) {
                  colors.add(variant.variant.title.trim());
                }
                if (variant.product_variants && Array.isArray(variant.product_variants)) {
                  variant.product_variants.forEach(pv => {
                    if (pv.text) {
                      const parts = pv.text.split('/').map(s => s.trim());
                      if (parts.length === 2) {
                        colors.add(parts[0]);
                        sizes.add(parts[1]);
                      }
                    }
                  });
                }
              });
            }
            const finalColors = Array.from(colors);
            const finalSizes = Array.from(sizes);
            // --- END of Image, Color, Size extraction ---

            // Construct the productData object to match app.products.jsx structure
            const structuredProductData = {
              id: currentProduct.id,
              title: currentProduct.title,
              reference: currentProduct.reference,
              code: currentProduct.code || currentProduct.supplier_code,
              barcode: currentProduct.barcode,
              description: currentProduct.description,
              price: currentProduct.gross_price || currentProduct.price,
              price_without_tax: currentProduct.price_without_tax,
              supply_price: currentProduct.supply_price,
              stock: currentProduct.stock,
              stock_alert: currentProduct.stock_alert,
              status: currentProduct.status,
              category_id: currentProduct.category_id,
              brand_id: currentProduct.brand_id,
              type_id: currentProduct.type_id,
              unit_id: currentProduct.unit_id,
              tax_id: currentProduct.tax_id,
              stock_stores: currentProduct.stock_store || [],
              compound: currentProduct.compound,
              prices: currentProduct.prices || [],
              images: images,
              colors: finalColors,
              sizes: finalSizes,
              variants: currentProduct.variants || [], // Keep full variant data
            };

            updatedFoundRefsMap.set(ref, {
              page: pageNumber,
              position: index + 1, // Update position in case it changed
              productData: structuredProductData // Use the newly structured data
            });
            totalProductsUpdated++;
            productFoundOnPage = true;
            break; // Found the product, move to next reference for this page
          }
        }
        if (!productFoundOnPage) {
          console.warn(`⚠️  Product '${ref}' not found on its recorded page ${pageNumber} during Vendus update.`);
          failedToUpdateRefsSet.add(ref);
        }
      });
    }
    await sleep(200); // Small delay between batches to be polite to the API
  }

  // Ensure all original refs are accounted for (either updated or failed)
  refsToUpdate.forEach(ref => {
    if (!updatedFoundRefsMap.has(ref) && !failedToUpdateRefsSet.has(ref)) {
      // This case should ideally not happen if logic is sound, but as a fallback
      failedToUpdateRefsSet.add(ref);
    }
  });

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('📊 VENDUS PRODUCT UPDATE RESULTS SUMMARY');
  console.log('='.repeat(60));

  refsToUpdate.forEach(ref => {
    if (updatedFoundRefsMap.has(ref)) {
      console.log(`✅ '${ref}' - UPDATED FROM VENDUS`);
    } else if (failedToUpdateRefsSet.has(ref)) {
      console.log(`❌ '${ref}' - FAILED TO UPDATE FROM VENDUS (or not found on recorded page)`);
    }
  });

  console.log(`\n⏱️  Total time: ${duration} seconds`);
  console.log(`🎯 Total products attempted to update from Vendus: ${refsToUpdate.length}`);
  console.log(`   Successfully updated from Vendus: ${totalProductsUpdated}`);
  console.log(`   Failed to update from Vendus: ${failedToUpdateRefsSet.size}`);
  console.log(`📄 Total unique pages fetched from Vendus: ${totalPagesFetched}`);
  console.log(`📡 Total Vendus API requests made: ${totalApiRequests}`);
  console.log(`   🔄 Total retries: ${totalRetries}`);
  console.log(`   ❌ Total errors fetching from Vendus: ${totalErrors}`);

  return { found: updatedFoundRefsMap, notFound: failedToUpdateRefsSet, totalSearched: refsToUpdate.length };
}

// Main execution function that products.js will call
async function main() {
  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });

    const existingResults = await loadSearchResultsFromFile(SEARCH_RESULTS_FILE);
    const productsToUpdate = existingResults.found || {};

    if (Object.keys(productsToUpdate).length === 0) {
      console.log("ℹ️ No product references found in 'search_results.json' to update from Vendus. No Vendus API search will be performed.");
      // If the file is empty and you want to initially populate it, you'd need another script or
      // logic here to do a full scan of Vendus products and save them.
      return;
    }

    const { found, notFound, totalSearched } = await updateProductsFromKnownPages(productsToUpdate, 8);

    // Prepare data for saving
    const updatedFound = {};
    found.forEach((data, ref) => {
      updatedFound[ref] = data;
    });

    const updatedResults = {
      searchDate: new Date().toISOString(),
      totalSearched: totalSearched,
      totalFound: found.size,
      found: updatedFound,
      notFound: Array.from(notFound)
    };

    await saveSearchResultsToFile(SEARCH_RESULTS_FILE, updatedResults);

    console.log('\n🎉 Vendus product data update completed and results saved to search_results.json!');

  } catch (error) {
    console.error('❌ Vendus update process failed:', error.message);
    process.exit(1); // Exit with an error code
  }
}
main()
// Export the main function so it can be imported and called by products.js
export default main;
