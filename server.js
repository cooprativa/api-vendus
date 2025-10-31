// server.js
// Main Remix server entry point for production (Render)

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createRequestHandler } from "@remix-run/express";
import { startProductProcessor } from "./app/tasks/processProductsSnapshot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Serve static files (CSS, JS, images) from /public
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

// ✅ Remix request handler
app.all(
  "*",
  createRequestHandler({
    build: () => import("./build/server/index.js"),
    mode: process.env.NODE_ENV,
  })
);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`✅ Remix Express server listening on port ${port}`);
  // Start your background product processor
  startProductProcessor();
});
