"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.runSearch = runSearch;

var _promises = require("fs/promises");

var _path = require("path");

var _axios = _interopRequireDefault(require("axios"));

var _settings = require("../services/settings.server");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Data directory and file paths
var DATA_DIR = (0, _path.join)(process.cwd(), "app", "data");
var SEARCH_RESULTS_FILE = (0, _path.join)(DATA_DIR, "search_results.json");
var SHORTCUTS_FILE = (0, _path.join)(DATA_DIR, "shortcuts.json"); // Replace with your actual Shopify Location ID
// This ID is crucial for managing inventory at a specific location in Shopify.
// Ensure this ID is correct for your Shopify store. You can fetch it via the Shopify GraphQL API.

var SHOPIFY_LOCATION_ID = "gid://shopify/Location/102699630920"; // EXAMPLE ID, REPLACE WITH YOURS!
// Vendus API Configuration (from your provided script)

var VENDUS_URL = "https://www.vendus.pt/ws/v1.1/products"; // Retry configuration for Vendus API calls

var RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 8000,
  backoffFactor: 2
}; // Sleep function for delays

var sleep = function sleep(ms) {
  return new Promise(function (resolve) {
    return setTimeout(resolve, ms);
  });
}; // Calculate exponential backoff delay


function getRetryDelay(attempt) {
  var delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
} // Function to safely fetch data from Vendus API with retries


function fetchVendusDataWithRetries(url, apiToken) {
  var attempt,
      response,
      delay,
      _args = arguments;
  return regeneratorRuntime.async(function fetchVendusDataWithRetries$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          attempt = _args.length > 2 && _args[2] !== undefined ? _args[2] : 1;
          _context.prev = 1;
          _context.next = 4;
          return regeneratorRuntime.awrap(_axios["default"].get(url, {
            headers: {
              'Accept': 'application/json',
              'Authorization': "Bearer ".concat(apiToken)
            },
            timeout: 10000 // 10 seconds timeout for Vendus API

          }));

        case 4:
          response = _context.sent;
          return _context.abrupt("return", response.data);

        case 8:
          _context.prev = 8;
          _context.t0 = _context["catch"](1);
          console.error("Vendus API call failed (Attempt ".concat(attempt, "):"), _context.t0.message);

          if (!(attempt < RETRY_CONFIG.maxRetries)) {
            _context.next = 19;
            break;
          }

          delay = getRetryDelay(attempt);
          console.log("Retrying in ".concat(delay, "ms..."));
          _context.next = 16;
          return regeneratorRuntime.awrap(sleep(delay));

        case 16:
          return _context.abrupt("return", fetchVendusDataWithRetries(url, apiToken, attempt + 1));

        case 19:
          throw new Error("Failed to fetch from Vendus API after ".concat(RETRY_CONFIG.maxRetries, " attempts: ").concat(_context.t0.message));

        case 20:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[1, 8]]);
} // Function to run the product search and update search_results.json


function runSearch(productReferencesToRefresh) {
  var jsonData, fileContent, allReferencesToSearch, vendusApi, vendusApiToken, allVendusProducts, foundReferences, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, ref, vendusProductData, product, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _loop, _iterator2, _step2;

  return regeneratorRuntime.async(function runSearch$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _context2.next = 3;
          return regeneratorRuntime.awrap((0, _promises.mkdir)(DATA_DIR, {
            recursive: true
          }));

        case 3:
          // 1. Load existing search_results.json or initialize if it doesn't exist
          jsonData = {
            searchDate: new Date().toISOString(),
            totalSearched: 0,
            totalFound: 0,
            found: {},
            notFound: []
          };
          _context2.prev = 4;
          _context2.next = 7;
          return regeneratorRuntime.awrap((0, _promises.readFile)(SEARCH_RESULTS_FILE, 'utf8'));

        case 7:
          fileContent = _context2.sent;
          jsonData = JSON.parse(fileContent);
          _context2.next = 19;
          break;

        case 11:
          _context2.prev = 11;
          _context2.t0 = _context2["catch"](4);

          if (!(_context2.t0.code === 'ENOENT')) {
            _context2.next = 17;
            break;
          }

          console.log("search_results.json not found, creating new one.");
          _context2.next = 19;
          break;

        case 17:
          console.error("Failed to read search_results.json:", _context2.t0);
          return _context2.abrupt("return", {
            success: false,
            error: "Failed to load search results file: ".concat(_context2.t0.message)
          });

        case 19:
          // Prepare a set of all product references to search/refresh
          allReferencesToSearch = new Set(productReferencesToRefresh);

          if (jsonData.found) {
            Object.keys(jsonData.found).forEach(function (ref) {
              return allReferencesToSearch.add(ref);
            });
          }

          jsonData.totalSearched = allReferencesToSearch.size; // Fetch Vendus API token

          _context2.next = 24;
          return regeneratorRuntime.awrap((0, _settings.getVendusApi)());

        case 24:
          vendusApi = _context2.sent;
          vendusApiToken = vendusApi.token;
          allVendusProducts = [];
          foundReferences = new Set(); // 2. Fetch product data from Vendus for each reference

          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          _context2.prev = 31;
          _iterator = allReferencesToSearch[Symbol.iterator]();

        case 33:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            _context2.next = 50;
            break;
          }

          ref = _step.value;
          _context2.prev = 35;
          console.log("\uD83D\uDD0D Searching for product with reference: ".concat(ref));
          _context2.next = 39;
          return regeneratorRuntime.awrap(fetchVendusDataWithRetries("".concat(VENDUS_URL, "?ref=").concat(encodeURIComponent(ref)), vendusApiToken));

        case 39:
          vendusProductData = _context2.sent;

          if (vendusProductData && vendusProductData.data && vendusProductData.data.length > 0) {
            // Assuming the first result is the most relevant
            product = vendusProductData.data[0];
            allVendusProducts.push(_objectSpread({
              reference: ref
            }, product));
            console.log("   \u2705 Found product: ".concat(product.title, " (").concat(product.reference, ")"));
          } else {
            console.log("   \u274C Product with reference '".concat(ref, "' not found in Vendus."));
          }

          _context2.next = 47;
          break;

        case 43:
          _context2.prev = 43;
          _context2.t1 = _context2["catch"](35);
          console.error("\u274C Error fetching product '".concat(ref, "' from Vendus:"), _context2.t1.message);
          jsonData.notFound.push(ref);

        case 47:
          _iteratorNormalCompletion = true;
          _context2.next = 33;
          break;

        case 50:
          _context2.next = 56;
          break;

        case 52:
          _context2.prev = 52;
          _context2.t2 = _context2["catch"](31);
          _didIteratorError = true;
          _iteratorError = _context2.t2;

        case 56:
          _context2.prev = 56;
          _context2.prev = 57;

          if (!_iteratorNormalCompletion && _iterator["return"] != null) {
            _iterator["return"]();
          }

        case 59:
          _context2.prev = 59;

          if (!_didIteratorError) {
            _context2.next = 62;
            break;
          }

          throw _iteratorError;

        case 62:
          return _context2.finish(59);

        case 63:
          return _context2.finish(56);

        case 64:
          // 3. Update jsonData.found based on fetched products
          jsonData.found = {}; // Clear previous found data to refresh

          _iteratorNormalCompletion2 = true;
          _didIteratorError2 = false;
          _iteratorError2 = undefined;
          _context2.prev = 68;

          _loop = function _loop() {
            var ref = _step2.value;
            var foundProduct = allVendusProducts.find(function (p) {
              return p.reference === ref;
            });

            if (foundProduct) {
              jsonData.found[ref] = {
                productData: foundProduct,
                page: foundProduct.page,
                position: allVendusProducts.indexOf(foundProduct) + 1 // Simple position

              };
              foundReferences.add(ref);
            } else {
              jsonData.notFound.push(ref);
            }
          };

          for (_iterator2 = productReferencesToRefresh[Symbol.iterator](); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            _loop();
          }

          _context2.next = 77;
          break;

        case 73:
          _context2.prev = 73;
          _context2.t3 = _context2["catch"](68);
          _didIteratorError2 = true;
          _iteratorError2 = _context2.t3;

        case 77:
          _context2.prev = 77;
          _context2.prev = 78;

          if (!_iteratorNormalCompletion2 && _iterator2["return"] != null) {
            _iterator2["return"]();
          }

        case 80:
          _context2.prev = 80;

          if (!_didIteratorError2) {
            _context2.next = 83;
            break;
          }

          throw _iteratorError2;

        case 83:
          return _context2.finish(80);

        case 84:
          return _context2.finish(77);

        case 85:
          jsonData.totalFound = foundReferences.size;
          jsonData.searchDate = new Date().toISOString(); // 4. Save the updated JSON file

          _context2.prev = 87;
          _context2.next = 90;
          return regeneratorRuntime.awrap((0, _promises.writeFile)(SEARCH_RESULTS_FILE, JSON.stringify(jsonData, null, 2), 'utf8'));

        case 90:
          console.log("✅ Updated search_results.json with refreshed Vendus data.");
          _context2.next = 97;
          break;

        case 93:
          _context2.prev = 93;
          _context2.t4 = _context2["catch"](87);
          console.error("❌ Failed to write updated search_results.json:", _context2.t4);
          return _context2.abrupt("return", {
            success: false,
            error: "Failed to save updated search results file: ".concat(_context2.t4.message),
            filePath: SEARCH_RESULTS_FILE
          });

        case 97:
          return _context2.abrupt("return", {
            success: true,
            searchResults: jsonData,
            message: "Search completed. Found ".concat(jsonData.totalFound, " of ").concat(jsonData.totalSearched, " references.")
          });

        case 100:
          _context2.prev = 100;
          _context2.t5 = _context2["catch"](0);
          console.error("Top-level error in runSearch:", _context2.t5);
          return _context2.abrupt("return", {
            success: false,
            error: "An unexpected error occurred during search: ".concat(_context2.t5.message)
          });

        case 104:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 100], [4, 11], [31, 52, 56, 64], [35, 43], [57,, 59, 63], [68, 73, 77, 85], [78,, 80, 84], [87, 93]]);
}
//# sourceMappingURL=products.dev.js.map
