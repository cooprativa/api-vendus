"use strict";

var _express = require("@remix-run/express");

var _express2 = _interopRequireDefault(require("express"));

var _processProductsSnapshot = require("./app/tasks/processProductsSnapshot.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

// Ensure your package.json has "type": "module" if you're getting import/export errors.
var app = (0, _express2["default"])(); // ... (your existing Express/Remix middleware and setup) ...

app.all("*", (0, _express.createRequestHandler)({
  build: function build() {
    return Promise.resolve().then(function () {
      return _interopRequireWildcard(require("./build/index.js"));
    });
  },
  mode: process.env.NODE_ENV
}));
var port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("Remix Express server listening on port ".concat(port)); // --- Start the product snapshot processor when the server starts ---

  (0, _processProductsSnapshot.startProductProcessor)();
}); // Optional: Add a graceful shutdown handler to stop the processor
// import { stopProductProcessor } from './app/tasks/processProductsSnapshot.js';
// process.on('SIGTERM', () => {
//   console.log('SIGTERM signal received. Shutting down gracefully.');
//   stopProductProcessor();
//   server.close(() => {
//     console.log('HTTP server closed.');
//     process.exit(0);
//   });
// });
//# sourceMappingURL=server.dev.js.map
