"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.api = void 0;

var _axios = _interopRequireDefault(require("axios"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// app/utils/api.server.js
// You might need to install axios: npm install axios
var api = _axios["default"].create({
  // You might want a base URL here if all your Gestão API calls go to one place
  // baseURL: 'https://your-gestao-api.com/api',
  timeout: 10000,
  // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json' // Add any necessary authorization headers here (e.g., Bearer Token, API Key)
    // 'Authorization': `Bearer ${process.env.GESTÃO_API_TOKEN}`,

  }
}); // If you need specific error handling or interceptors, you can add them here


exports.api = api;
api.interceptors.response.use(function (response) {
  return response.data;
}, // Automatically return data
function (error) {
  console.error("API call error:", error.message); // You can customize error handling here, e.g., rethrow, return specific error object

  return Promise.reject(error);
});
//# sourceMappingURL=api.server.dev.js.map
