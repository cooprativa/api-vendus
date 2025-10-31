"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readProducts = readProducts;
exports.createProducts = createProducts;

var _promises = _interopRequireDefault(require("fs/promises"));

var _nodeFetch = _interopRequireDefault(require("node-fetch"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function readProducts() {
  var data;
  return regeneratorRuntime.async(function readProducts$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.next = 2;
          return regeneratorRuntime.awrap(_promises["default"].readFile('./app/data/products.json', 'utf-8'));

        case 2:
          data = _context.sent;
          return _context.abrupt("return", JSON.parse(data));

        case 4:
        case "end":
          return _context.stop();
      }
    }
  });
}

function createProducts(shop, accessToken) {
  var products, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, product, res, errText, json;

  return regeneratorRuntime.async(function createProducts$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 2;
          return regeneratorRuntime.awrap(readProducts());

        case 2:
          products = _context2.sent;
          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          _context2.prev = 6;
          _iterator = products[Symbol.iterator]();

        case 8:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            _context2.next = 26;
            break;
          }

          product = _step.value;
          _context2.next = 12;
          return regeneratorRuntime.awrap((0, _nodeFetch["default"])("https://".concat(shop, "/admin/api/2023-07/products.json"), {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': 'a1d03f7890d80a36637785aa69a0c668-1752152787',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              product: product
            })
          }));

        case 12:
          res = _context2.sent;

          if (res.ok) {
            _context2.next = 19;
            break;
          }

          _context2.next = 16;
          return regeneratorRuntime.awrap(res.text());

        case 16:
          errText = _context2.sent;
          console.error('Failed creating product:', errText);
          return _context2.abrupt("continue", 23);

        case 19:
          _context2.next = 21;
          return regeneratorRuntime.awrap(res.json());

        case 21:
          json = _context2.sent;
          console.log('Created product:', json.product.title);

        case 23:
          _iteratorNormalCompletion = true;
          _context2.next = 8;
          break;

        case 26:
          _context2.next = 32;
          break;

        case 28:
          _context2.prev = 28;
          _context2.t0 = _context2["catch"](6);
          _didIteratorError = true;
          _iteratorError = _context2.t0;

        case 32:
          _context2.prev = 32;
          _context2.prev = 33;

          if (!_iteratorNormalCompletion && _iterator["return"] != null) {
            _iterator["return"]();
          }

        case 35:
          _context2.prev = 35;

          if (!_didIteratorError) {
            _context2.next = 38;
            break;
          }

          throw _iteratorError;

        case 38:
          return _context2.finish(35);

        case 39:
          return _context2.finish(32);

        case 40:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[6, 28, 32, 40], [33,, 35, 39]]);
}
//# sourceMappingURL=shopify-products.server.dev.js.map
