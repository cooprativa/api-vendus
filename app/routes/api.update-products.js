// app/routes/api.update-products.js
import { json } from "@remix-run/node";
import { getVendusApi } from "../services/settings.server";
import path from "path";
import { promises as fs } from "fs";

// Use process.cwd() to get the current working directory
const DATA_DIR = path.join(process.cwd(), "app", "data");
const SHORTCUTS_FILE = path.join(DATA_DIR, "shortcuts.json");
const PRODUCTS_DIR = path.join(DATA_DIR, "products");

// --- Helper Functions (Copied from app.additional.jsx, but self-contained) ---

async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(PRODUCTS_DIR, { recursive: true });
    console.log("[API Update] Data directory and products directory ensured:", DATA_DIR, PRODUCTS_DIR);
  } catch (error) {
    console.error("[API Update] Failed to create data directories:", error);
    throw error;
  }
}

async function readShortcuts() {
  try {
    await ensureDataDirectory();
    const shortcutsRaw = await fs.readFile(SHORTCUTS_FILE, "utf-8");
    const shortcuts = JSON.parse(shortcutsRaw);
    console.log("[API Update] Successfully read shortcuts for update:", shortcuts.length);
    return Array.isArray(shortcuts) ? shortcuts : [];
  } catch (error) {
    console.log("[API Update] No shortcuts file found or error reading it for update, starting with empty array:", error.message);
    return [];
  }
}

async function writeProductFile(productData) {
  if (!productData || !productData.id) {
    console.warn("[API Update] Invalid product data provided for writing file.");
    return false;
  }
  try {
    await ensureDataDirectory(); // Ensures PRODUCTS_DIR exists
    const filename = `${productData.id}.json`;
    const filePath = path.join(PRODUCTS_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(productData, null, 2));
    console.log(`[API Update] Product file written: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`[API Update] Failed to write product file for ID ${productData.id}:`, error);
    return false;
  }
}

async function readProductFile(productId) {
  try {
    await ensureDataDirectory();
    const filename = `${productId}.json`;
    const filePath = path.join(PRODUCTS_DIR, filename);
    const productRaw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(productRaw);
  } catch (error) {
    // console.log(`[API Update] No product file found for ID ${productId}:`, error.message); // Too verbose for frequent checks
    return null;
  }
}

// Search script function (reused from app.additional.jsx)
async function runSearchScript(refs, apiKey) {
  console.log(`[API Update] Starting search for ${refs.length} references.`);
  const URL = "https://www.vendus.pt/ws/v1.1/products";

  const apiClient = {
    get: async (url, options) => {
      const params = new URLSearchParams(options.params);
      console.log(`[API Update] Fetching: ${url}?${params}`);
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          'Accept': 'application/json',
          'User-Agent': 'Shopify App API Client (Server Update)',
        },
        timeout: 15000,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API Update] HTTP Error ${response.status}: ${response.statusText}. Response body: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[API Update] Successfully fetched page ${options.params.page}, received ${Array.isArray(data) ? data.length : (data.data || data.products || data.items || data.results)?.length || 'unknown'} items.`);
      return { data };
    }
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function fetchPageWithRetry(page, attempt = 0) {
    const maxRetries = 3;
    try {
      console.log(`[API Update] Attempting to fetch page ${page}, attempt ${attempt + 1}/${maxRetries}`);
      const response = await apiClient.get(URL, {
        params: {
          page: page,
          per_page: 100
        }
      });
      return { page, data: response.data, success: true, attempts: attempt + 1 };
    } catch (error) {
      console.error(`[API Update] Error fetching page ${page} on attempt ${attempt + 1}: ${error.message}`);
      const shouldRetry = attempt < maxRetries;
      if (shouldRetry) {
        const delay = 1000 * Math.pow(2, attempt);
        console.log(`[API Update] Retrying page ${page} in ${delay}ms...`);
        await sleep(Math.min(delay, 8000));
        return fetchPageWithRetry(page, attempt + 1);
      }
      return { page, data: null, success: false, error: error.message, attempts: attempt + 1 };
    }
  }

  function checkProductForRefs(produto, refs) {
    const foundRefs = [];
    for (const ref of refs) {
      if (produto.reference === ref ||
        produto.code === ref ||
        produto.id?.toString() === ref ||
        (!isNaN(ref) && produto.id === parseInt(ref))) {
        foundRefs.push(ref);
        continue;
      }

      if (produto.variants) {
        let variantMatch = false;
        for (const variant of produto.variants) {
          if (variant.code?.includes(ref) || variant.title?.includes(ref)) {
            foundRefs.push(ref);
            variantMatch = true;
            break;
          }

          if (!variantMatch && variant.product_variants) {
            for (const pv of variant.product_variants) {
              if (pv.code?.includes(ref) || pv.text?.includes(ref)) {
                foundRefs.push(ref);
                variantMatch = true;
                break;
              }
            }
          }
          if (variantMatch) break;
        }
      }
    }
    return foundRefs;
  }

  const foundRefs = new Map();
  const remainingRefs = new Set(refs);
  const concurrency = 6;
  const maxPages = 1000; // Limit to prevent infinite loops on malformed APIs

  let currentPage = 1;
  let isLastPage = false;
  let productsProcessed = 0;

  while (remainingRefs.size > 0 && !isLastPage && currentPage <= maxPages) {
    const pagesToFetch = [];
    for (let i = 0; i < concurrency && currentPage + i <= maxPages; i++) {
      pagesToFetch.push(currentPage + i);
    }
    console.log(`[API Update] Fetching pages: ${pagesToFetch.join(', ')}`);

    const pagePromises = pagesToFetch.map((page, index) =>
      new Promise(resolve =>
        setTimeout(() => resolve(fetchPageWithRetry(page)), index * 100)
      )
    );

    const pageResults = await Promise.all(pagePromises);

    for (const result of pageResults) {
      if (!result.success || !result.data) {
        console.warn(`[API Update] Failed to get data for page ${result.page}: ${result.error || 'unknown error'}`);
        continue;
      }

      let produtos = Array.isArray(result.data) ? result.data :
        result.data.data || result.data.products ||
        result.data.items || result.data.results;

      if (!Array.isArray(produtos)) {
        console.warn(`[API Update] Unexpected data format for page ${result.page}. Expected array, got:`, typeof result.data);
        continue;
      }
      console.log(`[API Update] Page ${result.page} returned ${produtos.length} products.`);


      if (produtos.length < 100) { // Assuming 100 is per_page
        isLastPage = true;
        console.log(`[API Update] Page ${result.page} had less than 100 products, marking as last page.`);
      }

      for (let index = 0; index < produtos.length; index++) {
        const produto = produtos[index];
        productsProcessed++;
        if (typeof produto !== 'object' || produto === null) {
          console.warn(`[API Update] Skipping non-object product at page ${result.page}, position ${index + 1}. Type: ${typeof produto}`);
          continue;
        }

        const foundInProduct = checkProductForRefs(produto, Array.from(remainingRefs));

        if (foundInProduct.length > 0) {
          foundInProduct.forEach(ref => {
            if (foundRefs.has(ref)) {
              console.log(`[API Update] Reference ${ref} already found, skipping duplicate entry.`);
              return;
            }
            foundRefs.set(ref, {
              page: result.page,
              position: index + 1,
              productData: {
                id: produto.id,
                title: produto.title,
                reference: produto.reference,
                code: produto.code || produto.supplier_code,
                barcode: produto.barcode,
                description: produto.description,
                price: produto.gross_price || produto.price,
                price_without_tax: produto.price_without_tax,
                supply_price: produto.supply_price,
                stock: produto.stock,
                stock_alert: produto.stock_alert,
                status: produto.status,
                category_id: produto.category_id,
                brand_id: produto.brand_id,
                type_id: produto.type_id,
                unit_id: produto.unit_id,
                tax_id: produto.tax_id,
                stock_stores: produto.stock_store || [],
                compound: produto.compound,
                prices: produto.prices || [],
                thumbnail: produto.image?.thumbnail || produto.images?.[0]?.thumbnail || null, // Check for image/images for thumbnail
                // Include any other relevant fields you might want
                created_at: produto.created_at, // Include timestamps for more detailed diff, but exclude from comparison
                updated_at: produto.updated_at,
              }
            });
            remainingRefs.delete(ref);
            console.log(`[API Update] Found and added product for ref: ${ref} (ID: ${produto.id})`);
          });
        }

        if (remainingRefs.size === 0) {
          console.log("[API Update] All references found. Exiting search loop.");
          break;
        }
      }

      if (remainingRefs.size === 0) break;
    }

    currentPage += concurrency;

    if (remainingRefs.size > 0 && !isLastPage) {
      console.log(`[API Update] More refs to find, waiting before next batch. Current page: ${currentPage}, Remaining refs: ${remainingRefs.size}`);
      await sleep(200); // Small delay between batches
    }

    if (currentPage > maxPages) {
      console.warn(`[API Update] Reached maximum pages (${maxPages}). Stopping search.`);
    }

    if (remainingRefs.size === 0) break;
  }

  console.log(`[API Update] Search finished. Total products processed from API: ${productsProcessed}.`);
  const results = {
    searchDate: new Date().toISOString(),
    totalSearched: refs.length,
    totalFound: foundRefs.size,
    found: Object.fromEntries(foundRefs),
    notFound: Array.from(remainingRefs)
  };
  console.log(`[API Update] Search results summary: Found ${results.totalFound}, Not Found ${results.notFound.length}.`);
  return results;
}

// --- Action for the API route ---
export async function action() {
  console.log("[API Update] Received request to check and update products.");
  try {
    const vendusApi = getVendusApi();
    if (!vendusApi) {
      console.error("[API Update] API key not configured. Cannot proceed with product updates.");
      return json({ error: "API key not configured for product updates." }, { status: 400 });
    }

    const permanentShortcuts = await readShortcuts();
    if (permanentShortcuts.length === 0) {
      console.log("[API Update] No shortcuts to update. Skipping product update.");
      return json({ success: true, message: "No shortcuts to update. Skipping product update." });
    }

    console.log(`[API Update] Starting product update check for ${permanentShortcuts.length} shortcuts.`);
    const currentSearchResults = await runSearchScript(permanentShortcuts, vendusApi);

    let updatedCount = 0;
    let newFilesCreated = 0;
    let noChangeCount = 0;

    for (const ref in currentSearchResults.found) {
      if (currentSearchResults.found.hasOwnProperty(ref)) {
        const latestProductData = currentSearchResults.found[ref].productData;
        const existingProductData = await readProductFile(latestProductData.id);

        if (!existingProductData) {
          // New product found, create file
          await writeProductFile(latestProductData);
          newFilesCreated++;
          console.log(`[API Update] New product file created for ID: ${latestProductData.id} (ref: ${ref}).`);
        } else {
          // Compare and update if different
          // Create shallow copies and remove dynamic fields like timestamps for comparison
          const cleanedLatest = { ...latestProductData };
          delete cleanedLatest.updated_at;
          delete cleanedLatest.created_at;

          const cleanedExisting = { ...existingProductData };
          delete cleanedExisting.updated_at;
          delete cleanedExisting.created_at;

          if (JSON.stringify(cleanedLatest) !== JSON.stringify(cleanedExisting)) {
            await writeProductFile(latestProductData);
            updatedCount++;
            console.log(`[API Update] Product file updated for ID: ${latestProductData.id} (ref: ${ref}).`);
          } else {
            noChangeCount++;
            // console.log(`[API Update] Product file for ID: ${latestProductData.id} (ref: ${ref}) has no significant changes.`); // Too verbose
          }
        }
      }
    }

    console.log(`[API Update] Product update check finished. Updated: ${updatedCount}, New files: ${newFilesCreated}, No changes: ${noChangeCount}.`);
    return json({
      success: true,
      message: `Product update check complete. ${updatedCount} products updated, ${newFilesCreated} new files created, ${noChangeCount} unchanged.`,
      updatedCount,
      newFilesCreated,
      noChangeCount,
    }, { status: 200 });

  } catch (error) {
    console.error("[API Update] Error during product update check:", error);
    return json({ error: `Product update check failed: ${error.message}` }, { status: 500 });
  }
}

// A loader function is typically not needed for API routes that only handle POST requests,
// but it's good practice to include one if GET requests might be made (e.g., for testing).
export async function loader() {
  return json({ message: "This is the product update API endpoint. Send a POST request." }, { status: 200 });
}
