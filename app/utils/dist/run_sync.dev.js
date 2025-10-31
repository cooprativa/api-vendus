"use strict";

// run_sync.js
var _require = require('child_process'),
    execSync = _require.execSync;

var path = require('path');

require('dotenv').config(); // Load environment variables from .env
// IMPORTANT: Adjust these paths based on your actual project structure.
// Assuming page_reader_products.js is in the same directory as this script, or one level up.


var pageReaderPath = path.join(__dirname, 'page_reader_products.js'); // If products.js and settings.server.js are in 'app/utils/' and 'app/services/' respectively,
// relative to the project root, and run_sync.js is also at the project root:

var _require2 = require('./app/utils/products'),
    syncProductsWithShopify = _require2.syncProductsWithShopify;

var _require3 = require('./app/services/settings.server'),
    getVendusApi = _require3.getVendusApi; // Assuming this exists to get API key


function runFullSyncProcess() {
  var vendusApiKey, admin, syncResult;
  return regeneratorRuntime.async(function runFullSyncProcess$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          console.log("--- Starting Vendus Product Data Refresh ---");
          console.log("Executing: node ".concat(pageReaderPath)); // Execute the page_reader_products.js script.
          // `stdio: 'inherit'` makes its console output visible here.

          execSync("node ".concat(pageReaderPath), {
            stdio: 'inherit'
          });
          console.log("--- Vendus Product Data Refresh Completed ---");
          console.log("Proceeding with Shopify product synchronization..."); // Get the Vendus API key needed for your Shopify sync (if products.js also uses it for Vendus calls)

          vendusApiKey = getVendusApi();

          if (!vendusApiKey) {
            console.error("Vendus API Key is not available. Ensure it's set in your .env or settings.server.js.");
            process.exit(1);
          } // --- Mock Shopify Admin API Client ---
          // In a real Remix app, 'admin' would come from your loader context or similar.
          // For this standalone script, you'd need to initialize it.
          // Replace this with your actual Shopify Admin API client initialization.
          // Example (using @shopify/shopify-api package for context):
          // const { shopify } = require('./path/to/shopify-api-config');
          // const session = await shopify.api.utils.loadCurrentSession(request, response, true); // Or fetch a permanent session
          // const admin = {
          //     graphql: async (query, variables) => {
          //         const client = new shopify.api.clients.Graphql({ session });
          //         return await client.query({ data: { query, variables } });
          //     }
          // };


          admin = {
            graphql: function graphql(query, variables) {
              return regeneratorRuntime.async(function graphql$(_context) {
                while (1) {
                  switch (_context.prev = _context.next) {
                    case 0:
                      console.log("--- Simulating Shopify Admin GraphQL call ---");
                      console.log("Query (first 100 chars):", query.substring(0, 100) + "..."); // In a real scenario, you'd make a network request to Shopify's GraphQL API here.
                      // For demonstration, returning a mock success response.

                      return _context.abrupt("return", {
                        json: function json() {
                          return {
                            data: {
                              // Mock data for create/update/delete product mutations
                              productCreate: {
                                product: {
                                  id: "gid://shopify/Product/123456789"
                                },
                                userErrors: []
                              },
                              productUpdate: {
                                product: {
                                  id: "gid://shopify/Product/123456789"
                                },
                                userErrors: []
                              },
                              productDelete: {
                                deletedProductId: "gid://shopify/Product/987654321",
                                userErrors: []
                              },
                              // Mock data for queries like getPublications or searchProducts
                              publications: {
                                edges: [{
                                  node: {
                                    id: "gid://shopify/Publication/12345",
                                    name: "Online Store"
                                  }
                                }]
                              },
                              products: {
                                edges: [],
                                pageInfo: {
                                  hasNextPage: false
                                }
                              } // Mock for searchProducts query

                            },
                            errors: null
                          };
                        }
                      });

                    case 3:
                    case "end":
                      return _context.stop();
                  }
                }
              });
            }
          }; // Now, run the Shopify sync using the data updated by page_reader_products.js

          _context2.next = 11;
          return regeneratorRuntime.awrap(syncProductsWithShopify(admin));

        case 11:
          syncResult = _context2.sent;
          console.log("\n--- Shopify Synchronization Results ---");
          console.log(JSON.stringify(syncResult, null, 2));

          if (syncResult.success) {
            console.log("\n🎉 Full synchronization process completed successfully!");
          } else {
            console.error("\n❌ Full synchronization process finished with errors.");
            process.exit(1); // Exit with error code if sync failed
          }

          _context2.next = 22;
          break;

        case 17:
          _context2.prev = 17;
          _context2.t0 = _context2["catch"](0);
          console.error("\n❌ Error during full synchronization process:");
          console.error(_context2.t0);
          process.exit(1); // Exit with error code on any failure

        case 22:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 17]]);
} // Execute the main process


runFullSyncProcess();
//# sourceMappingURL=run_sync.dev.js.map
