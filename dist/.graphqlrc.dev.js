"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _shopifyApi = require("@shopify/shopify-api");

var _apiCodegenPreset = require("@shopify/api-codegen-preset");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function getConfig() {
  var config = {
    projects: {
      "default": (0, _apiCodegenPreset.shopifyApiProject)({
        apiType: _apiCodegenPreset.ApiType.Admin,
        apiVersion: _shopifyApi.LATEST_API_VERSION,
        documents: ["./app/**/*.{js,ts,jsx,tsx}", "./app/.server/**/*.{js,ts,jsx,tsx}"],
        outputDir: "./app/types"
      })
    }
  };
  var extensions = [];

  try {
    extensions = _fs["default"].readdirSync("./extensions");
  } catch (_unused) {// ignore if no extensions
  }

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = extensions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var entry = _step.value;
      var extensionPath = "./extensions/".concat(entry);
      var schema = "".concat(extensionPath, "/schema.graphql");

      if (!_fs["default"].existsSync(schema)) {
        continue;
      }

      config.projects[entry] = {
        schema: schema,
        documents: ["".concat(extensionPath, "/**/*.graphql")]
      };
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator["return"] != null) {
        _iterator["return"]();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return config;
}

var config = getConfig();
var _default = config;
exports["default"] = _default;
//# sourceMappingURL=.graphqlrc.dev.js.map
