"use strict";

var _axios = _interopRequireDefault(require("axios"));

var _promises = _interopRequireDefault(require("fs/promises"));

var _path = require("path");

require("dotenv/config");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Use the environment variable for the API_KEY
var API_KEY = process.env.VENDUS_API_KEY;
var URL = "https://www.vendus.pt/ws/v1.1/products";
var DATA_DIR = (0, _path.join)(process.cwd(), 'app', 'data');
var SEARCH_RESULTS_FILE = (0, _path.join)(DATA_DIR, "search_results.json");

var apiClient = _axios["default"].create({
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

var RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 8000,
  backoffFactor: 2
};

var sleep = function sleep(ms) {
  return new Promise(function (resolve) {
    return setTimeout(resolve, ms);
  });
};

function loadSearchResultsFromFile(filePath) {
  var data, parsedData;
  return regeneratorRuntime.async(function loadSearchResultsFromFile$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return regeneratorRuntime.awrap(_promises["default"].readFile(filePath, 'utf8'));

        case 3:
          data = _context.sent;
          parsedData = JSON.parse(data);

          if (parsedData.found && !(parsedData.found instanceof Map)) {
            parsedData.found = new Map(Object.entries(parsedData.found));
          } else if (!parsedData.found) {
            parsedData.found = new Map();
          }

          return _context.abrupt("return", parsedData);

        case 9:
          _context.prev = 9;
          _context.t0 = _context["catch"](0);

          if (_context.t0.code === 'ENOENT') {
            console.log("File not found: ".concat(filePath, ". Returning empty results."));
          } else {
            console.error("Error reading or parsing search results file ".concat(filePath, ":"), _context.t0);
          }

          return _context.abrupt("return", {
            searchDate: new Date().toISOString(),
            totalSearched: 0,
            totalFound: 0,
            found: new Map(),
            notFound: []
          });

        case 13:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 9]]);
}

function saveSearchResultsToFile(filePath, data) {
  var dataToSave;
  return regeneratorRuntime.async(function saveSearchResultsToFile$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _context2.next = 3;
          return regeneratorRuntime.awrap(_promises["default"].mkdir((0, _path.join)(filePath, '..'), {
            recursive: true
          }));

        case 3:
          dataToSave = _objectSpread({}, data);

          if (dataToSave.found instanceof Map) {
            dataToSave.found = Object.fromEntries(dataToSave.found);
          }

          _context2.next = 7;
          return regeneratorRuntime.awrap(_promises["default"].writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf8'));

        case 7:
          console.log("Results saved to ".concat(filePath));
          _context2.next = 14;
          break;

        case 10:
          _context2.prev = 10;
          _context2.t0 = _context2["catch"](0);
          console.error("Error saving search results to file ".concat(filePath, ":"), _context2.t0);
          throw _context2.t0;

        case 14:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 10]]);
}

function fetchPageFromVendus(page) {
  var attempt,
      response,
      delay,
      _args3 = arguments;
  return regeneratorRuntime.async(function fetchPageFromVendus$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          attempt = _args3.length > 1 && _args3[1] !== undefined ? _args3[1] : 0;

          if (API_KEY) {
            _context3.next = 3;
            break;
          }

          return _context3.abrupt("return", {
            error: "Vendus API Key not available. Cannot fetch Vendus data."
          });

        case 3:
          _context3.prev = 3;
          console.log("Fetching Vendus products: Page ".concat(page, ", Attempt ").concat(attempt + 1));
          _context3.next = 7;
          return regeneratorRuntime.awrap(apiClient.get(URL, {
            params: {
              page: page
            }
          }));

        case 7:
          response = _context3.sent;
          return _context3.abrupt("return", {
            data: response.data.data
          });

        case 11:
          _context3.prev = 11;
          _context3.t0 = _context3["catch"](3);

          if (!(attempt < RETRY_CONFIG.maxRetries)) {
            _context3.next = 19;
            break;
          }

          delay = Math.min(RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt), RETRY_CONFIG.maxDelay);
          console.warn("Failed to fetch page ".concat(page, ". Retrying in ").concat(delay, "ms... (Attempt ").concat(attempt + 1, "/").concat(RETRY_CONFIG.maxRetries, ")"));
          _context3.next = 18;
          return regeneratorRuntime.awrap(sleep(delay));

        case 18:
          return _context3.abrupt("return", fetchPageFromVendus(page, attempt + 1));

        case 19:
          console.error("Error fetching Vendus products page ".concat(page, " after ").concat(RETRY_CONFIG.maxRetries, " attempts:"), _context3.t0.message);

          if (_context3.t0.response) {
            console.error('Response data:', _context3.t0.response.data);
            console.error('Response status:', _context3.t0.response.status);
            console.error('Response headers:', _context3.t0.response.headers);
          } else if (_context3.t0.request) {
            console.error('No response received:', _context3.t0.request);
          }

          return _context3.abrupt("return", {
            error: _context3.t0.message
          });

        case 22:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[3, 11]]);
}

function updateProductsFromKnownPages(productsToUpdate, maxPages) {
  var foundProducts, notFoundProducts, totalSearched, page, _ref, data, error;

  return regeneratorRuntime.async(function updateProductsFromKnownPages$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          foundProducts = new Map();
          notFoundProducts = new Set(productsToUpdate.keys());
          totalSearched = 0;
          page = 1;

        case 4:
          if (!(page <= maxPages)) {
            _context4.next = 27;
            break;
          }

          console.log("Processing Vendus page ".concat(page, " for product updates..."));
          _context4.next = 8;
          return regeneratorRuntime.awrap(fetchPageFromVendus(page));

        case 8:
          _ref = _context4.sent;
          data = _ref.data;
          error = _ref.error;

          if (!error) {
            _context4.next = 14;
            break;
          }

          console.error("Skipping page ".concat(page, " due to error: ").concat(error));
          return _context4.abrupt("continue", 24);

        case 14:
          if (!(!data || data.length === 0)) {
            _context4.next = 17;
            break;
          }

          console.log("No more products found on page ".concat(page, ". Ending search."));
          return _context4.abrupt("break", 27);

        case 17:
          totalSearched += data.length;
          data.forEach(function (vendusProduct) {
            var reference = vendusProduct.reference;

            if (productsToUpdate.has(reference)) {
              foundProducts.set(reference, vendusProduct);
              notFoundProducts["delete"](reference);
              console.log("\u2705 Found and updated product: ".concat(reference));
            }
          });

          if (!(notFoundProducts.size === 0)) {
            _context4.next = 22;
            break;
          }

          console.log("All specified products found. Ending search early.");
          return _context4.abrupt("break", 27);

        case 22:
          _context4.next = 24;
          return regeneratorRuntime.awrap(sleep(200));

        case 24:
          page++;
          _context4.next = 4;
          break;

        case 27:
          return _context4.abrupt("return", {
            found: foundProducts,
            notFound: notFoundProducts,
            totalSearched: totalSearched
          });

        case 28:
        case "end":
          return _context4.stop();
      }
    }
  });
}

function executeProductUpdate() {
  var existingResults, productsToUpdate, _ref2, found, notFound, totalSearched, updatedFound, updatedResults;

  return regeneratorRuntime.async(function executeProductUpdate$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          console.log("Starting the product update process in page_reader_products.js...");

          if (!API_KEY) {
            console.error("❌ Vendus API Key is not set. Please ensure VENDUS_API_KEY environment variable is configured.");
            process.exit(1);
          }

          _context5.prev = 2;
          _context5.next = 5;
          return regeneratorRuntime.awrap(_promises["default"].mkdir(DATA_DIR, {
            recursive: true
          }));

        case 5:
          _context5.next = 7;
          return regeneratorRuntime.awrap(loadSearchResultsFromFile(SEARCH_RESULTS_FILE));

        case 7:
          existingResults = _context5.sent;
          productsToUpdate = existingResults.found || new Map();

          if (!(productsToUpdate.size === 0)) {
            _context5.next = 12;
            break;
          }

          console.log("ℹ️ No product references found in 'search_results.json' to update from Vendus. No Vendus API search will be performed.");
          return _context5.abrupt("return");

        case 12:
          _context5.next = 14;
          return regeneratorRuntime.awrap(updateProductsFromKnownPages(productsToUpdate, 10));

        case 14:
          _ref2 = _context5.sent;
          found = _ref2.found;
          notFound = _ref2.notFound;
          totalSearched = _ref2.totalSearched;
          updatedFound = {};
          found.forEach(function (data, ref) {
            updatedFound[ref] = data;
          });
          updatedResults = {
            searchDate: new Date().toISOString(),
            totalSearched: totalSearched,
            totalFound: found.size,
            found: updatedFound,
            notFound: Array.from(notFound)
          };
          _context5.next = 23;
          return regeneratorRuntime.awrap(saveSearchResultsToFile(SEARCH_RESULTS_FILE, updatedResults));

        case 23:
          console.log('\n🎉 Vendus product data update completed and results saved to search_results.json!');
          _context5.next = 30;
          break;

        case 26:
          _context5.prev = 26;
          _context5.t0 = _context5["catch"](2);
          console.error('❌ Vendus update process failed:', _context5.t0.message);
          process.exit(1);

        case 30:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[2, 26]]);
}

executeProductUpdate();
//# sourceMappingURL=page_reader_products.dev.js.map
