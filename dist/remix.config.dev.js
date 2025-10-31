"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
//remix.config.js

/** @typ//e {import('@remix-run/dev').AppConfig} */
var _default = {
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  // IMPORTANT: Set serverModuleFormat to "esm" for Vite compatibility
  serverModuleFormat: "esm",
  // This path is for the *production* server build.
  // For development, Vite's dev server handles module loading differently.
  // Keep this consistent with `npm run start` if you use it.
  serverBuildPath: "build/server/index.js",
  // The 'dev' option for port is usually handled by Vite's server config
  // in vite.config.js, but keeping it here for completeness if Remix CLI uses it.
  // dev: { port: process.env.HMR_SERVER_PORT || 8002 }, // Uncomment if Remix CLI needs it explicitly
  future: {
    // Keep your future flags consistent with vite.config.js
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
    v3_lazyRouteDiscovery: true,
    v3_singleFetch: false,
    v3_routeConfig: true
  } // If you had any other specific configurations from your original remix.config.js,
  // ensure they are merged into this single object.

};
exports["default"] = _default;
//# sourceMappingURL=remix.config.dev.js.map
