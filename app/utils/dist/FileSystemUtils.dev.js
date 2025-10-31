"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileSystemUtils = void 0;

var _fs = require("fs");

var _monitor = require("../constants/monitor");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var FileSystemUtils =
/*#__PURE__*/
function () {
  function FileSystemUtils() {
    _classCallCheck(this, FileSystemUtils);
  }

  _createClass(FileSystemUtils, null, [{
    key: "ensureDataDirectory",
    value: function ensureDataDirectory() {
      return regeneratorRuntime.async(function ensureDataDirectory$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.prev = 0;
              _context.next = 3;
              return regeneratorRuntime.awrap(_fs.promises.mkdir(_monitor.DATA_DIR, {
                recursive: true
              }));

            case 3:
              _context.next = 9;
              break;

            case 5:
              _context.prev = 5;
              _context.t0 = _context["catch"](0);
              console.error("Failed to create data directory:", _context.t0);
              throw _context.t0;

            case 9:
            case "end":
              return _context.stop();
          }
        }
      }, null, null, [[0, 5]]);
    }
  }, {
    key: "readJsonFile",
    value: function readJsonFile(filePath) {
      var defaultValue,
          data,
          _args2 = arguments;
      return regeneratorRuntime.async(function readJsonFile$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              defaultValue = _args2.length > 1 && _args2[1] !== undefined ? _args2[1] : null;
              _context2.prev = 1;
              _context2.next = 4;
              return regeneratorRuntime.awrap(this.ensureDataDirectory());

            case 4:
              _context2.next = 6;
              return regeneratorRuntime.awrap(_fs.promises.readFile(filePath, "utf-8"));

            case 6:
              data = _context2.sent;
              return _context2.abrupt("return", JSON.parse(data));

            case 10:
              _context2.prev = 10;
              _context2.t0 = _context2["catch"](1);
              console.log("No file found at ".concat(filePath, ", using default:"), defaultValue);
              return _context2.abrupt("return", defaultValue);

            case 14:
            case "end":
              return _context2.stop();
          }
        }
      }, null, this, [[1, 10]]);
    }
  }, {
    key: "writeJsonFile",
    value: function writeJsonFile(filePath, data) {
      return regeneratorRuntime.async(function writeJsonFile$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              _context3.prev = 0;
              _context3.next = 3;
              return regeneratorRuntime.awrap(this.ensureDataDirectory());

            case 3:
              _context3.next = 5;
              return regeneratorRuntime.awrap(_fs.promises.writeFile(filePath, JSON.stringify(data, null, 2)));

            case 5:
              return _context3.abrupt("return", true);

            case 8:
              _context3.prev = 8;
              _context3.t0 = _context3["catch"](0);
              console.error("Failed to write file ".concat(filePath, ":"), _context3.t0);
              throw _context3.t0;

            case 12:
            case "end":
              return _context3.stop();
          }
        }
      }, null, this, [[0, 8]]);
    }
  }]);

  return FileSystemUtils;
}();

exports.FileSystemUtils = FileSystemUtils;
//# sourceMappingURL=FileSystemUtils.dev.js.map
