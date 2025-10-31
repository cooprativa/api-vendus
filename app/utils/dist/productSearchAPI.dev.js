"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.productSearchAPI = void 0;

var _search_results = _interopRequireDefault(require("../data/search_results.json"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// app/utils/productSearchAPI.js
// Directly import the search results JSON file.
var productSearchAPI = function productSearchAPI() {
  return {
    /**
     * Provides the initial product search data by importing it from a JSON file.
     * @returns {Promise<Object>} The initial search results data.
     */
    search: function search() {
      return regeneratorRuntime.async(function search$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              console.log("Loading initial product search data from app/data/search_results.json.");
              return _context.abrupt("return", _search_results["default"]);

            case 2:
            case "end":
              return _context.stop();
          }
        }
      });
    }
  };
};

exports.productSearchAPI = productSearchAPI;
//# sourceMappingURL=productSearchAPI.dev.js.map
