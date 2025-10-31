"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.initializeSearchPagesFile = initializeSearchPagesFile;
exports.readSearchPages = readSearchPages;
exports.addSearchPage = addSearchPage;
exports.getSearchPageById = getSearchPageById;
exports.deleteSearchPage = deleteSearchPage;
exports.clearAllSearchPages = clearAllSearchPages;
exports.getSearchStats = getSearchStats;

var _promises = _interopRequireDefault(require("fs/promises"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// app/utils/searchPagesManager.js
var DATA_DIR = _path["default"].join(process.cwd(), "app", "data");

var SEARCH_PAGES_FILE = _path["default"].join(DATA_DIR, "search_pages.json");
/**
 * Structure of search_pages.json:
 * {
 *   "pages": [
 *     {
 *       "id": "unique-id-timestamp",
 *       "searchDate": "2025-06-30T09:33:04.313Z",
 *       "totalSearched": 1,
 *       "totalFound": 1,
 *       "found": {
 *         "10000383": {
 *           "page": 74,
 *           "position": 31,

 *       },
 *       "notFound": []
 *     }
 *   ],
 *   "totalPages": 1,
 *   "lastUpdated": "2025-06-30T09:33:04.313Z"
 * }
 */


function initializeSearchPagesFile() {
  var initialData;
  return regeneratorRuntime.async(function initializeSearchPagesFile$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return regeneratorRuntime.awrap(_promises["default"].access(SEARCH_PAGES_FILE));

        case 3:
          console.log("Search pages file already exists");
          _context.next = 19;
          break;

        case 6:
          _context.prev = 6;
          _context.t0 = _context["catch"](0);

          if (!(_context.t0.code === "ENOENT")) {
            _context.next = 18;
            break;
          }

          // File doesn't exist, create it
          console.log("Creating search pages file");
          _context.next = 12;
          return regeneratorRuntime.awrap(_promises["default"].mkdir(DATA_DIR, {
            recursive: true
          }));

        case 12:
          initialData = {
            pages: [],
            totalPages: 0,
            lastUpdated: new Date().toISOString()
          };
          _context.next = 15;
          return regeneratorRuntime.awrap(_promises["default"].writeFile(SEARCH_PAGES_FILE, JSON.stringify(initialData, null, 2)));

        case 15:
          console.log("Search pages file created successfully");
          _context.next = 19;
          break;

        case 18:
          throw _context.t0;

        case 19:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 6]]);
}

function readSearchPages() {
  var data, parsed;
  return regeneratorRuntime.async(function readSearchPages$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _context2.next = 3;
          return regeneratorRuntime.awrap(initializeSearchPagesFile());

        case 3:
          _context2.next = 5;
          return regeneratorRuntime.awrap(_promises["default"].readFile(SEARCH_PAGES_FILE, "utf8"));

        case 5:
          data = _context2.sent;
          parsed = JSON.parse(data); // Ensure the structure is correct

          if (!parsed.pages || !Array.isArray(parsed.pages)) {
            parsed.pages = [];
          }

          if (typeof parsed.totalPages !== 'number') {
            parsed.totalPages = parsed.pages.length;
          }

          return _context2.abrupt("return", parsed);

        case 12:
          _context2.prev = 12;
          _context2.t0 = _context2["catch"](0);
          console.error("Error reading search pages:", _context2.t0); // Return default structure on error

          return _context2.abrupt("return", {
            pages: [],
            totalPages: 0,
            lastUpdated: new Date().toISOString()
          });

        case 16:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 12]]);
}

function addSearchPage(searchResult) {
  var searchPages, newPage;
  return regeneratorRuntime.async(function addSearchPage$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _context3.next = 3;
          return regeneratorRuntime.awrap(readSearchPages());

        case 3:
          searchPages = _context3.sent;
          // Create new page entry with unique ID
          newPage = {
            id: "search_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9)),
            searchDate: searchResult.searchDate || new Date().toISOString(),
            totalSearched: searchResult.totalSearched || 0,
            totalFound: searchResult.totalFound || 0,
            found: searchResult.found || {},
            notFound: searchResult.notFound || []
          }; // Add to beginning of array (most recent first)

          searchPages.pages.unshift(newPage);
          searchPages.totalPages = searchPages.pages.length;
          searchPages.lastUpdated = new Date().toISOString(); // Write back to file

          _context3.next = 10;
          return regeneratorRuntime.awrap(_promises["default"].writeFile(SEARCH_PAGES_FILE, JSON.stringify(searchPages, null, 2)));

        case 10:
          console.log("Added new search page:", newPage.id);
          return _context3.abrupt("return", newPage);

        case 14:
          _context3.prev = 14;
          _context3.t0 = _context3["catch"](0);
          console.error("Error adding search page:", _context3.t0);
          throw _context3.t0;

        case 18:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 14]]);
}

function getSearchPageById(pageId) {
  var searchPages;
  return regeneratorRuntime.async(function getSearchPageById$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.prev = 0;
          _context4.next = 3;
          return regeneratorRuntime.awrap(readSearchPages());

        case 3:
          searchPages = _context4.sent;
          return _context4.abrupt("return", searchPages.pages.find(function (page) {
            return page.id === pageId;
          }) || null);

        case 7:
          _context4.prev = 7;
          _context4.t0 = _context4["catch"](0);
          console.error("Error getting search page by ID:", _context4.t0);
          return _context4.abrupt("return", null);

        case 11:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[0, 7]]);
}

function deleteSearchPage(pageId) {
  var searchPages, initialLength;
  return regeneratorRuntime.async(function deleteSearchPage$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.prev = 0;
          _context5.next = 3;
          return regeneratorRuntime.awrap(readSearchPages());

        case 3:
          searchPages = _context5.sent;
          initialLength = searchPages.pages.length;
          searchPages.pages = searchPages.pages.filter(function (page) {
            return page.id !== pageId;
          });

          if (!(searchPages.pages.length < initialLength)) {
            _context5.next = 13;
            break;
          }

          searchPages.totalPages = searchPages.pages.length;
          searchPages.lastUpdated = new Date().toISOString();
          _context5.next = 11;
          return regeneratorRuntime.awrap(_promises["default"].writeFile(SEARCH_PAGES_FILE, JSON.stringify(searchPages, null, 2)));

        case 11:
          console.log("Deleted search page:", pageId);
          return _context5.abrupt("return", true);

        case 13:
          return _context5.abrupt("return", false);

        case 16:
          _context5.prev = 16;
          _context5.t0 = _context5["catch"](0);
          console.error("Error deleting search page:", _context5.t0);
          throw _context5.t0;

        case 20:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[0, 16]]);
}

function clearAllSearchPages() {
  var clearedData;
  return regeneratorRuntime.async(function clearAllSearchPages$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          _context6.prev = 0;
          clearedData = {
            pages: [],
            totalPages: 0,
            lastUpdated: new Date().toISOString()
          };
          _context6.next = 4;
          return regeneratorRuntime.awrap(_promises["default"].writeFile(SEARCH_PAGES_FILE, JSON.stringify(clearedData, null, 2)));

        case 4:
          console.log("Cleared all search pages");
          return _context6.abrupt("return", true);

        case 8:
          _context6.prev = 8;
          _context6.t0 = _context6["catch"](0);
          console.error("Error clearing search pages:", _context6.t0);
          throw _context6.t0;

        case 12:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[0, 8]]);
}

function getSearchStats() {
  var searchPages, stats;
  return regeneratorRuntime.async(function getSearchStats$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          _context7.prev = 0;
          _context7.next = 3;
          return regeneratorRuntime.awrap(readSearchPages());

        case 3:
          searchPages = _context7.sent;
          stats = {
            totalPages: searchPages.totalPages,
            totalSearches: searchPages.pages.reduce(function (sum, page) {
              return sum + page.totalSearched;
            }, 0),
            totalFound: searchPages.pages.reduce(function (sum, page) {
              return sum + page.totalFound;
            }, 0),
            totalNotFound: searchPages.pages.reduce(function (sum, page) {
              return sum + page.notFound.length;
            }, 0),
            lastSearchDate: searchPages.pages.length > 0 ? searchPages.pages[0].searchDate : null,
            oldestSearchDate: searchPages.pages.length > 0 ? searchPages.pages[searchPages.pages.length - 1].searchDate : null
          };
          return _context7.abrupt("return", stats);

        case 8:
          _context7.prev = 8;
          _context7.t0 = _context7["catch"](0);
          console.error("Error getting search stats:", _context7.t0);
          return _context7.abrupt("return", {
            totalPages: 0,
            totalSearches: 0,
            totalFound: 0,
            totalNotFound: 0,
            lastSearchDate: null,
            oldestSearchDate: null
          });

        case 12:
        case "end":
          return _context7.stop();
      }
    }
  }, null, null, [[0, 8]]);
}
//# sourceMappingURL=searchPagesManager.dev.js.map
