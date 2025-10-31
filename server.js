// server.js
// This is your main Remix server entry point.

import { createRequestHandler } from "@remix-run/express";
import express from "express";
// IMPORT YOUR NEW PROCESSOR SCRIPT HERE:
import { startProductProcessor } from './app/tasks/processProductsSnapshot.js';

// Ensure your package.json has "type": "module" if you're getting import/export errors.

const app = express();

// ... (your existing Express/Remix middleware and setup) ...

app.all(
  "*",
  createRequestHandler({
    build: () => import("./build/index.js"),
    mode: process.env.NODE_ENV,
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Remix Express server listening on port ${port}`);
  // --- Start the product snapshot processor when the server starts ---
  startProductProcessor();
});

// Optional: Add a graceful shutdown handler to stop the processor
// import { stopProductProcessor } from './app/tasks/processProductsSnapshot.js';
// process.on('SIGTERM', () => {
//   console.log('SIGTERM signal received. Shutting down gracefully.');
//   stopProductProcessor();
//   server.close(() => {
//     console.log('HTTP server closed.');
//     process.exit(0);
//   });
// });
