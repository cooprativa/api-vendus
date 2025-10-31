"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sessionStorage = exports.registerWebhooks = exports.login = exports.unauthenticated = exports.authenticate = exports.addDocumentResponseHeaders = exports.apiVersion = exports["default"] = void 0;

require("@shopify/shopify-app-remix/adapters/node");

var _server = require("@shopify/shopify-app-remix/server");

var _shopifyAppSessionStoragePrisma = require("@shopify/shopify-app-session-storage-prisma");

var _db = _interopRequireDefault(require("./db.server"));

var _shopifyApi = require("@shopify/shopify-api");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// --- IMPORTANT: HARDCODED ENVIRONMENT VARIABLES FOR DEBUGGING ---
// WARNING: Hardcoding sensitive information like API keys and secrets
// is NOT recommended for production environments due to security risks.
// This is done here ONLY for debugging purposes to rule out issues
// with environment variable loading. Please revert to process.env
// variables once the issue is resolved.
var SHOPIFY_API_KEY = "6b604bcb8589b5c8171814656a502d08";
var SHOPIFY_API_SECRET = "44736dfe0ee8b616e78c745bda7f8171";
var SHOPIFY_APP_URL = "https://prescription-screenshot-calculation-evaluations.trycloudflare.com";
var SCOPES = "write_products,read_products,write_inventory,read_inventory,write_orders,read_orders,write_customers,read_customers,read_locations,read_markets_home,read_publications,write_publications"; // --- END HARDCODED ENVIRONMENT VARIABLES ---
// --- NEW LOGGING FOR DEBUGGING ---

console.log("--- Shopify App Configuration Debugging ---");
console.log("LATEST_API_VERSION resolved to:", _shopifyApi.LATEST_API_VERSION);
console.log("Using SHOPIFY_API_KEY:", SHOPIFY_API_KEY);
console.log("Using SHOPIFY_API_SECRET (first 5 chars):", SHOPIFY_API_SECRET.substring(0, 5) + "..."); // Mask for security

console.log("Using SHOPIFY_APP_URL:", SHOPIFY_APP_URL);
console.log("Using SCOPES:", SCOPES);
console.log("--- End Debugging Logs ---"); // --- END NEW LOGGING ---

var shopify = (0, _server.shopifyApp)(_objectSpread({
  // Using hardcoded values for debugging as requested
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  // IMPORTANT: Use LATEST_API_VERSION for optimal compatibility with Shopify's GraphQL schema.
  // This ensures that mutations like 'productCreate' with 'variants' are correctly recognized.
  apiVersion: _shopifyApi.LATEST_API_VERSION,
  scopes: SCOPES.split(","),
  // Split the hardcoded string into an array
  appUrl: SHOPIFY_APP_URL,
  authPathPrefix: "/auth",
  sessionStorage: new _shopifyAppSessionStoragePrisma.PrismaSessionStorage(_db["default"]),
  distribution: _server.AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true
  }
}, process.env.SHOP_CUSTOM_DOMAIN ? {
  customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN]
} : {}));
var _default = shopify; // Export the API version used (LATEST_API_VERSION)

exports["default"] = _default;
var apiVersion = _shopifyApi.LATEST_API_VERSION;
exports.apiVersion = apiVersion;
var addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
exports.addDocumentResponseHeaders = addDocumentResponseHeaders;
var authenticate = shopify.authenticate;
exports.authenticate = authenticate;
var unauthenticated = shopify.unauthenticated;
exports.unauthenticated = unauthenticated;
var login = shopify.login;
exports.login = login;
var registerWebhooks = shopify.registerWebhooks;
exports.registerWebhooks = registerWebhooks;
var sessionStorage = shopify.sessionStorage;
exports.sessionStorage = sessionStorage;
//# sourceMappingURL=shopify.server.dev.js.map
