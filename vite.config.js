// vite.config.js

import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

installGlobals({ nativeFetch: true });

// Handle process.env.HOST which might be set by development tools
// Ensure SHOPIFY_APP_URL is always a full URL with a protocol
if (process.env.HOST) {
  if (!process.env.HOST.startsWith('http://') && !process.env.HOST.startsWith('https://')) {
    // If HOST is just a hostname, prepend https://
    process.env.SHOPIFY_APP_URL = `https://${process.env.HOST}`;
  } else {
    // If HOST is already a full URL, use it directly
    process.env.SHOPIFY_APP_URL = process.env.HOST;
  }
  delete process.env.HOST; // Clean up the HOST variable
}

// Safely parse SHOPIFY_APP_URL, falling back to a valid localhost URL
let appUrl;
try {
  appUrl = new URL(process.env.SHOPIFY_APP_URL || "http://localhost");
} catch (e) {
  console.error(
    "Invalid SHOPIFY_APP_URL environment variable. Falling back to http://localhost. Error:",
    e.message
  );
  appUrl = new URL("http://localhost");
}

const host = appUrl.hostname;
let hmrConfig;

if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    // Add the Cloudflare Tunnel hostname to allowedHosts
    allowedHosts: [host,'youth-cost-advance-animated.trycloudflare.com','tourist-flickr-societies-numbers.trycloudflare.com','achieving-superior-campaigns-acoustic.trycloudflare.com','textbook-deluxe-properties-inform.trycloudflare.com' , 'vehicle-doctor-brakes-dress.trycloudflare.com' , 'acquired-store-clips-yourself.trycloudflare.com' , 'assembly-pt-barry-cindy.trycloudflare.com', 'https://b9a0-2001-818-dcec-f800-3992-38fc-f3f1-3be1.ngrok-free.app','assembly-pt-barry-cindy.trycloudflare.com', 'wool-clinic-standing-cities.trycloudflare.com', 'http://localhost:3000','teams-wait-rise-ve.trycloudflare.com' , 'damage-platforms-blessed-woods.trycloudflare.com', 'damage-platforms-blessed-woods.trycloudflare.com', 'damage-platforms-blessed-woods.trycloudflare.com', 'prescription-screenshot-calculation-evaluations.trycloudflare.com', 'complement-losing-commissions-wrap.trycloudflare.com', 'emotional-regularly-boy-mls.trycloudflare.com', 'clothes-assumptions-globe-van.trycloudflare.com', 'canal-fellowship-downloading-kai.trycloudflare.com', 'e77b-2001-818-dcec-f800-39a8-e93f-fb40-34a.ngrok-free.app'],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    remix({
      serverModuleFormat: "esm", // Keep this for ESM output
      ignoredRouteFiles: ["**/.*"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
        v3_singleFetch: false,
        v3_routeConfig: true,
      },
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react", "@shopify/polaris"],
  },
  // THIS IS THE MODIFIED SSR BLOCK
  ssr: {
    // Explicitly externalize these packages.
    // This tells Vite *NOT* to bundle or transform them.
    // It assumes Node.js itself will correctly load these CommonJS packages
    // at runtime, leveraging Node's built-in CJS-ESM interop.
    external: [
      "express",             // Original 'require' error culprit
      "@remix-run/express",  // Current 'exports' error culprit
      "@remix-run/node",     // Likely also problematic CJS internally
      "http",                // Node.js built-in module, should always be external
    ],
  },
});
