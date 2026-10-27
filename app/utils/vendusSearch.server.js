// app/utils/vendusSearch.server.js

// Full search of the Vendus catalogue for a list of references.
// Moved here from app.products.jsx so the monitor (app.search.jsx) can use it too.

// Search script function (updated for robust image, color, size extraction)
export async function runSearchScript(refs, apiKey) {
  // Updated URL for detailed product information including variants and images
  const URL = "https://www.vendus.pt/ws/v1.1/products";

  const apiClient = {
    get: async (url, options) => {
      const params = new URLSearchParams(options.params);
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          'Accept': 'application/json',
          'User-Agent': 'Shopify App API Client',
        },
        // It's good practice to have a timeout for external API calls
        // Note: fetch API does not directly support a 'timeout' option.
        // You would typically implement this using AbortController.
        // For simplicity, we'll omit it here, but keep in mind for production.
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data };
    }
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function fetchPageWithRetry(page, attempt = 0) {
    const maxRetries = 3;
    try {
      const response = await apiClient.get(URL, {
        params: {
          page: page,
          per_page: 100
        }
      });
      return { page, data: response.data, success: true, attempts: attempt + 1 };
    } catch (error) {
      const shouldRetry = attempt < maxRetries;
      if (shouldRetry) {
        const delay = 1000 * Math.pow(2, attempt);
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

      // Check variants for matches
      if (produto.variants && Array.isArray(produto.variants)) {
        for (const variant of produto.variants) {
          // Check the 'variant' object inside the main variant block
          if (variant.variant) {
            if (variant.variant.code === ref || variant.variant.title === ref || variant.variant.reference === ref ||
                (variant.variant.id?.toString() === ref || (!isNaN(ref) && variant.variant.id === parseInt(ref)))) {
              foundRefs.push(ref);
              break;
            }
          }
          // Check 'product_variants' if they exist
          if (variant.product_variants && Array.isArray(variant.product_variants)) {
              for (const pv of variant.product_variants) {
                  if (pv.code === ref || pv.text === ref || pv.barcode === ref ||
                      (pv.id?.toString() === ref || (!isNaN(ref) && pv.id === parseInt(ref)))) {
                      foundRefs.push(ref);
                      break; // Found in product_variant, no need to check other product_variants for this variant
                  }
              }
          }
        }
      }
    }
    return foundRefs;
  }

  const foundRefs = new Map();
  const remainingRefs = new Set(refs);
  const concurrency = 6;
  const maxPages = 1000; // Limit to prevent excessive API calls in case of many pages

  let currentPage = 1;
  let isLastPage = false;

  while (remainingRefs.size > 0 && !isLastPage && currentPage <= maxPages) {
    const pagesToFetch = [];
    for (let i = 0; i < concurrency && currentPage + i <= maxPages; i++) {
      pagesToFetch.push(currentPage + i);
    }

    const pagePromises = pagesToFetch.map((page, index) =>
      new Promise(resolve =>
        setTimeout(() => resolve(fetchPageWithRetry(page)), index * 100)
      )
    );

    const pageResults = await Promise.all(pagePromises);

    for (const result of pageResults) {
      if (!result.success || !result.data) continue;

      let produtos = Array.isArray(result.data) ? result.data :
        result.data.data || result.data.products ||
        result.data.items || result.data.results;

      if (!Array.isArray(produtos)) continue;

      // Assuming Vendus API returns an empty array or less than per_page for the last page
      if (produtos.length < 100) { // If per_page is 100
        isLastPage = true;
      }

      for (let index = 0; index < produtos.length; index++) {
        const produto = produtos[index];
        if (typeof produto !== 'object' || produto === null) continue; // Ensure it's a valid object

        const foundInProduct = checkProductForRefs(produto, Array.from(remainingRefs));

        if (foundInProduct.length > 0) {
          // --- BEGIN of Image, Color, Size extraction ---
          const images = [];
          // Check if 'images' is an object and extract URLs
          if (produto.images && typeof produto.images === 'object') {
              // Prefer 'm' (medium) size if available, otherwise 'xs' (extra small)
              // You can add 'l' or other sizes if Vendus provides them
              if (produto.images.m) {
                  images.push(produto.images.m);
              } else if (produto.images.xs) {
                  images.push(produto.images.xs);
              }
          }

          const colors = new Set(); // Use Set to automatically handle unique values
          const sizes = new Set();   // Use Set to automatically handle unique values

          // Check if there are variants and they are an array
          if (produto.variants && Array.isArray(produto.variants)) {
            produto.variants.forEach(variant => {
              // Add the main variant title as a color (e.g., "PRETO", "LEOPARDO", "AZUL MARINHO")
              // Ensure variant.variant exists before accessing title
              if (variant.variant && variant.variant.title) {
                colors.add(variant.variant.title.trim()); // Trim to remove trailing spaces like in "LEOPARDO "
              }

              // Check product_variants for combined color/size in 'text' field
              if (variant.product_variants && Array.isArray(variant.product_variants)) {
                variant.product_variants.forEach(pv => {
                  if (pv.text) {
                    const parts = pv.text.split('/').map(s => s.trim());
                    if (parts.length === 2) {
                      // Assuming "Color / Size" format: "COLOR / SIZE"
                      colors.add(parts[0]);
                      sizes.add(parts[1]);
                    } else if (parts.length === 1) {
                      // If only one part, it might be just a color or just a size if not already captured
                      // This is a heuristic, adjust as needed if Vendus has other formats
                      // For now, it's safer to rely on variant.variant.title for primary color
                      // and the two-part split for distinct color/size.
                    }
                  }
                });
              }
            });
          }
          // Convert Sets to Arrays for storage
          const finalColors = Array.from(colors);
          const finalSizes = Array.from(sizes);
          // --- END of Image, Color, Size extraction ---


          foundInProduct.forEach(ref => {
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
                // Use the new fields for images, colors, and sizes
                images: images,
                colors: finalColors,
                sizes: finalSizes,
                variants: produto.variants || [], // Keep full variant data for detailed view
              }
            });
            remainingRefs.delete(ref);
          });
        }

        if (remainingRefs.size === 0) break;
      }

      if (remainingRefs.size === 0) break;
    }

    currentPage += concurrency;

    if (remainingRefs.size > 0 && !isLastPage) {
      await sleep(200);
    }

    if (remainingRefs.size === 0) break;
  }

  // Convert Map to object for JSON serialization
  const results = {
    searchDate: new Date().toISOString(),
    totalSearched: refs.length,
    totalFound: foundRefs.size,
    found: Object.fromEntries(foundRefs),
    notFound: Array.from(remainingRefs)
  };

  return results;
}
