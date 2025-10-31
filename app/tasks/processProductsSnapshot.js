// app/tasks/processProductsSnapshot.js
// This script processes a JSON snapshot (e.g., search_results.json)
// and updates individual product files in app/data/products/.

import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url'; // For ES Modules to get current directory

// --- Configuration ---
// Derive current directory for pathing (ES Module safe)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to your data directories
// Assumes app/tasks/processProductsSnapshot.js is in 'app/tasks'
// So, we go up one level (..) to 'app/', then into 'data'.
const DATA_DIR = path.join(__dirname, '..', 'data');
const PRODUCTS_DIR = path.join(DATA_DIR, 'products');
const SOURCE_SNAPSHOT_FILE = path.join(DATA_DIR, 'search_results.json'); // The source JSON file

// How often to run this processing (e.g., 30 * 1000 ms = 30 seconds)
const PROCESS_INTERVAL = 30 * 1000;

// --- Helper Functions ---

// Ensures the product data directory exists
async function ensureProductDirectory() {
  try {
    await fs.mkdir(PRODUCTS_DIR, { recursive: true });
    console.log(`[ProductProcessor] Ensured product data directory: ${PRODUCTS_DIR}`);
  } catch (error) {
    console.error(`[ProductProcessor] Failed to create product data directory: ${PRODUCTS_DIR}`, error);
    throw error;
  }
}

// Reads the source JSON snapshot file (e.g., search_results.json)
async function readSourceSnapshot() {
  try {
    const snapshotRaw = await fs.readFile(SOURCE_SNAPSHOT_FILE, 'utf-8');
    const snapshot = JSON.parse(snapshotRaw);
    console.log(`[ProductProcessor] Read source snapshot from: ${SOURCE_SNAPSHOT_FILE}`);
    // The snapshot object should contain a 'found' property as an object or map
    // where keys are references and values contain productData.
    if (snapshot && typeof snapshot.found === 'object' && snapshot.found !== null) {
      return Object.values(snapshot.found).map(item => item.productData);
    }
    console.warn(`[ProductProcessor] Source snapshot file does not contain expected 'found' structure.`);
    return []; // Return empty array if structure is not as expected
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`[ProductProcessor] Source snapshot file not found: ${SOURCE_SNAPSHOT_FILE}. Returning empty products.`);
    } else {
      console.error(`[ProductProcessor] Error reading or parsing source snapshot file ${SOURCE_SNAPSHOT_FILE}:`, error);
    }
    return []; // Return empty array on error or file not found
  }
}

// Reads an individual product JSON file from app/data/products/
async function readIndividualProductFile(productId) {
  const filePath = path.join(PRODUCTS_DIR, `${productId}.json`);
  try {
    const productRaw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(productRaw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File not found, means it's a new product for us to create
    }
    console.error(`[ProductProcessor] Error reading existing individual product file for ID ${productId}:`, error);
    return null;
  }
}

// Writes or overwrites an individual product JSON file in app/data/products/
async function writeIndividualProductFile(productData) {
  if (!productData || !productData.id) {
    console.warn('[ProductProcessor] Cannot write product file: Invalid product data (missing ID).');
    return false;
  }
  const filename = `${productData.id}.json`;
  const filePath = path.join(PRODUCTS_DIR, filename);
  try {
    await ensureProductDirectory(); // Ensure directory exists before writing
    await fs.writeFile(filePath, JSON.stringify(productData, null, 2));
    // console.log(`[ProductProcessor] Individual product file saved: ${filePath}`); // Verbose
    return true;
  } catch (error) {
    console.error(`[ProductProcessor] Failed to write individual product file for ID ${productData.id}:`, error);
    return false;
  }
}

// Cleans product data for comparison (removes fields that shouldn't trigger an 'update')
function cleanProductForComparison(product) {
  const cleaned = { ...product };
  // Remove fields that might change without actual data being updated
  delete cleaned.created_at;
  delete cleaned.updated_at;
  // If the source snapshot adds temporary fields like 'page' or 'position', remove them too
  delete cleaned.page;
  delete cleaned.position;
  return cleaned;
}

// --- Main Processing Function ---
export async function processProductSnapshot() {
  console.log(`\n--- [ProductProcessor] Starting snapshot processing cycle at ${new Date().toISOString()} ---`);
  try {
    await ensureProductDirectory();

    // 1. Read the source snapshot file
    const sourceProducts = await readSourceSnapshot();
    if (sourceProducts.length === 0) {
      console.log('[ProductProcessor] No products found in the source snapshot file. Skipping processing.');
      return;
    }
    console.log(`[ProductProcessor] Found ${sourceProducts.length} products in the source snapshot.`);

    let newProductsCount = 0;
    let updatedProductsCount = 0;
    let unchangedProductsCount = 0;
    let errorsCount = 0;

    // 2. Iterate through products from the source snapshot
    for (const sourceProduct of sourceProducts) {
      if (!sourceProduct.id) {
        console.warn('[ProductProcessor] Skipping product from source snapshot with no ID:', sourceProduct);
        errorsCount++;
        continue;
      }

      try {
        // Read the corresponding individual product file
        const existingIndividualProduct = await readIndividualProductFile(sourceProduct.id);

        const cleanedSourceProduct = cleanProductForComparison(sourceProduct);
        const cleanedExistingProduct = existingIndividualProduct ? cleanProductForComparison(existingIndividualProduct) : null;

        if (!existingIndividualProduct) {
          // Case: New Product (exists in snapshot, but not as an individual file)
          await writeIndividualProductFile(sourceProduct);
          newProductsCount++;
          console.log(`[ProductProcessor] NEW PRODUCT: Created file for ID ${sourceProduct.id} (${sourceProduct.title || sourceProduct.reference}).`);
        } else if (JSON.stringify(cleanedSourceProduct) !== JSON.stringify(cleanedExistingProduct)) {
          // Case: Updated Product (exists in both, but content differs)
          await writeIndividualProductFile(sourceProduct);
          updatedProductsCount++;
          console.log(`[ProductProcessor] UPDATED PRODUCT: Overwrote file for ID ${sourceProduct.id} (${sourceProduct.title || sourceProduct.reference}).`);
        } else {
          // Case: Unchanged Product (exists in both, content is the same)
          unchangedProductsCount++;
          // console.log(`[ProductProcessor] Product ID ${sourceProduct.id} unchanged.`); // Very verbose
        }
      } catch (innerError) {
        console.error(`[ProductProcessor] Error processing product ID ${sourceProduct.id} from snapshot:`, innerError);
        errorsCount++;
      }
    }

    console.log(`--- [ProductProcessor] Snapshot processing finished. Summary: ---`);
    console.log(`  New Products Discovered: ${newProductsCount}`);
    console.log(`  Existing Products Updated: ${updatedProductsCount}`);
    console.log(`  Products Found Unchanged: ${unchangedProductsCount}`);
    console.log(`  Errors During Processing: ${errorsCount}`);

  } catch (mainError) {
    console.error('[ProductProcessor] Fatal error during main snapshot processing:', mainError);
  }
  console.log(`--- [ProductProcessor] Next processing cycle in ${PROCESS_INTERVAL / 1000} seconds ---`);
}

// --- Scheduler functions ---
let intervalId = null;

// Starts the periodic processing
export function startProductProcessor() {
  if (intervalId) {
    console.warn('[ProductProcessor] Product processor is already running. Skipping start.');
    return;
  }
  console.log('[ProductProcessor] Initializing product processor: Running first cycle immediately.');
  processProductSnapshot(); // Run once immediately on startup
  intervalId = setInterval(processProductSnapshot, PROCESS_INTERVAL); // Then schedule
  console.log(`[ProductProcessor] Scheduled to run every ${PROCESS_INTERVAL / 1000} seconds.`);
}

// Stops the periodic processing (useful for graceful shutdowns)
export function stopProductProcessor() {
  if (intervalId) {
    console.log('[ProductProcessor] Stopping product processor scheduler.');
    clearInterval(intervalId);
    intervalId = null;
  }
}
