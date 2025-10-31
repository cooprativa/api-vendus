"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readPages = readPages;
exports.addPage = addPage;
exports.writePages = writePages;

var _promises = _interopRequireDefault(require("fs/promises"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// app/utils/pagesManager.js
var DATA_DIR = _path["default"].join(process.cwd(), "app", "data");

var PAGES_FILE = _path["default"].join(DATA_DIR, "pages.json"); // Read all pages


function readPages() {
  var data, pages;
  return regeneratorRuntime.async(function readPages$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return regeneratorRuntime.awrap(_promises["default"].access(PAGES_FILE));

        case 3:
          _context.next = 5;
          return regeneratorRuntime.awrap(_promises["default"].readFile(PAGES_FILE, "utf8"));

        case 5:
          data = _context.sent;
          pages = JSON.parse(data);
          return _context.abrupt("return", Array.isArray(pages) ? pages : []);

        case 10:
          _context.prev = 10;
          _context.t0 = _context["catch"](0);

          if (!(_context.t0.code === "ENOENT")) {
            _context.next = 18;
            break;
          }

          _context.next = 15;
          return regeneratorRuntime.awrap(_promises["default"].mkdir(DATA_DIR, {
            recursive: true
          }));

        case 15:
          _context.next = 17;
          return regeneratorRuntime.awrap(_promises["default"].writeFile(PAGES_FILE, JSON.stringify([], null, 2)));

        case 17:
          return _context.abrupt("return", []);

        case 18:
          throw _context.t0;

        case 19:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 10]]);
} // Add a new page


function addPage(pageData) {
  var pages;
  return regeneratorRuntime.async(function addPage$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 2;
          return regeneratorRuntime.awrap(readPages());

        case 2:
          pages = _context2.sent;
          pages.push(pageData);
          _context2.next = 6;
          return regeneratorRuntime.awrap(_promises["default"].writeFile(PAGES_FILE, JSON.stringify(pages, null, 2)));

        case 6:
          return _context2.abrupt("return", pageData);

        case 7:
        case "end":
          return _context2.stop();
      }
    }
  });
} // Write all pages (replace entire collection)


function writePages(pages) {
  return regeneratorRuntime.async(function writePages$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 2;
          return regeneratorRuntime.awrap(_promises["default"].mkdir(DATA_DIR, {
            recursive: true
          }));

        case 2:
          _context3.next = 4;
          return regeneratorRuntime.awrap(_promises["default"].writeFile(PAGES_FILE, JSON.stringify(pages, null, 2)));

        case 4:
        case "end":
          return _context3.stop();
      }
    }
  });
}
//# sourceMappingURL=pagesManager.dev.js.map
