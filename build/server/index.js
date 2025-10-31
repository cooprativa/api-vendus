var _a;
import { jsx, jsxs } from "react/jsx-runtime";
import { RemixServer, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, useActionData, Form, useNavigation, Link, useRouteError, useFetcher } from "@remix-run/react";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import "@shopify/shopify-app-remix/adapters/node";
import { shopifyApp, AppDistribution, LoginErrorType, boundary } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import { LATEST_API_VERSION } from "@shopify/shopify-api";
import { json, redirect } from "@remix-run/node";
import "dotenv/config";
import path, { join } from "path";
import { promises } from "fs";
import { useState, useEffect, useCallback } from "react";
import { AppProvider, Page, Card, FormLayout, Text, TextField, Button, useBreakpoints, Layout, BlockStack, Banner, InlineStack, Box, Tag, Modal, DataTable, List, Image } from "@shopify/polaris";
import { TitleBar, NavMenu, useAppBridge } from "@shopify/app-bridge-react";
import { AppProvider as AppProvider$1 } from "@shopify/shopify-app-remix/react";
import { readFile, mkdir } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  return new Promise((resolve, reject) => {
    let didError = false;
    const stream = new PassThrough();
    const { pipe } = renderToPipeableStream(
      /* @__PURE__ */ jsx(RemixServer, { context: remixContext, url: request.url }),
      {
        onShellReady() {
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              status: didError ? 500 : responseStatusCode,
              headers: responseHeaders
            })
          );
          pipe(stream);
        },
        onShellError(err) {
          reject(err);
        },
        onError(err) {
          didError = true;
          console.error(err);
        }
      }
    );
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: "Module" }));
function App$2() {
  return /* @__PURE__ */ jsxs("html", { children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width,initial-scale=1" }),
      /* @__PURE__ */ jsx("link", { rel: "preconnect", href: "https://cdn.shopify.com/" }),
      /* @__PURE__ */ jsx(
        "link",
        {
          rel: "stylesheet",
          href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        }
      ),
      /* @__PURE__ */ jsx(Meta, {}),
      /* @__PURE__ */ jsx(Links, {})
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx(Outlet, {}),
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: App$2
}, Symbol.toStringTag, { value: "Module" }));
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}
const prisma = global.prismaGlobal ?? new PrismaClient();
console.log("LATEST_API_VERSION resolved to:", "2023-07");
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  // IMPORTANT: Use LATEST_API_VERSION for optimal compatibility with Shopify's GraphQL schema.
  // This ensures that mutations like 'productCreate' with 'variants' are correctly recognized.
  apiVersion: LATEST_API_VERSION,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true
  },
  ...process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}
});
shopify.addDocumentResponseHeaders;
const authenticate = shopify.authenticate;
shopify.unauthenticated;
const login = shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;
const action$9 = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;
  if (session) {
    await prisma.session.update({
      where: {
        id: session.id
      },
      data: {
        scope: current.toString()
      }
    });
  }
  return new Response();
};
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$9
}, Symbol.toStringTag, { value: "Module" }));
const action$8 = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }
  return new Response();
};
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$8
}, Symbol.toStringTag, { value: "Module" }));
async function action$7({ request }) {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i;
  const { admin } = await authenticate.admin(request);
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  try {
    const formData = await request.json();
    const { title, sku, stock } = formData;
    if (!title || !sku || stock === void 0) {
      return json(
        { error: "Missing required fields: title, sku, and stock" },
        { status: 400 }
      );
    }
    const locationsQuery = `
      query {
        locations(first: 1) {
          edges {
            node {
              id
              name
              isPrimary
            }
          }
        }
      }
    `;
    const locationsResponse = await admin.graphql(locationsQuery);
    const locationsData = await locationsResponse.json();
    if (!((_c = (_b = (_a2 = locationsData.data) == null ? void 0 : _a2.locations) == null ? void 0 : _b.edges) == null ? void 0 : _c.length)) {
      return json({ error: "No locations found" }, { status: 400 });
    }
    const locationId = locationsData.data.locations.edges[0].node.id;
    const createProductMutation = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            variants(first: 1) {
              edges {
                node {
                  id
                  sku
                  inventoryItem {
                    id
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    const productInput = {
      title,
      variants: [
        {
          sku,
          inventoryManagement: "SHOPIFY",
          inventoryPolicy: "DENY",
          inventoryQuantities: [
            {
              availableQuantity: parseInt(stock),
              locationId
            }
          ]
        }
      ]
    };
    const productResponse = await admin.graphql(createProductMutation, {
      variables: { input: productInput }
    });
    const productData = await productResponse.json();
    if (((_f = (_e = (_d = productData.data) == null ? void 0 : _d.productCreate) == null ? void 0 : _e.userErrors) == null ? void 0 : _f.length) > 0) {
      return json(
        {
          error: "Product creation failed",
          details: productData.data.productCreate.userErrors
        },
        { status: 400 }
      );
    }
    const createdProduct = (_h = (_g = productData.data) == null ? void 0 : _g.productCreate) == null ? void 0 : _h.product;
    if (!createdProduct) {
      return json({ error: "Failed to create product" }, { status: 500 });
    }
    return json({
      success: true,
      product: {
        id: createdProduct.id,
        title: createdProduct.title,
        handle: createdProduct.handle,
        variant: (_i = createdProduct.variants.edges[0]) == null ? void 0 : _i.node
      }
    });
  } catch (error) {
    console.error("Error creating product:", error);
    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7
}, Symbol.toStringTag, { value: "Module" }));
let settingsStore = {
  lastUpdated: null
  // This can still be updated by the UI
};
function getSettings() {
  return {
    ...settingsStore,
    vendusApi: process.env.VENDUS_API_KEY || ""
    // This is the crucial change
  };
}
function updateSettings(newSettings) {
  if ("vendusApi" in newSettings) {
    console.warn("Attempted to update Vendus API key via updateSettings. It should be set via environment variable (VENDUS_API_KEY). Ignoring this update for 'vendusApi'.");
    const { vendusApi, ...restOfSettings } = newSettings;
    settingsStore = { ...settingsStore, ...restOfSettings };
  } else {
    settingsStore = { ...settingsStore, ...newSettings };
  }
  return settingsStore;
}
function getVendusApi() {
  const apiKey = process.env.VENDUS_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ VENDUS_API_KEY environment variable is not set. Vendus API calls may fail.");
  }
  return apiKey;
}
const DATA_DIR$2 = path.join(process.cwd(), "app", "data");
const SHORTCUTS_FILE$2 = path.join(DATA_DIR$2, "shortcuts.json");
const PRODUCTS_DIR = path.join(DATA_DIR$2, "products");
async function ensureDataDirectory$2() {
  try {
    await promises.mkdir(DATA_DIR$2, { recursive: true });
    await promises.mkdir(PRODUCTS_DIR, { recursive: true });
    console.log("[API Update] Data directory and products directory ensured:", DATA_DIR$2, PRODUCTS_DIR);
  } catch (error) {
    console.error("[API Update] Failed to create data directories:", error);
    throw error;
  }
}
async function readShortcuts$2() {
  try {
    await ensureDataDirectory$2();
    const shortcutsRaw = await promises.readFile(SHORTCUTS_FILE$2, "utf-8");
    const shortcuts = JSON.parse(shortcutsRaw);
    console.log("[API Update] Successfully read shortcuts for update:", shortcuts.length);
    return Array.isArray(shortcuts) ? shortcuts : [];
  } catch (error) {
    console.log("[API Update] No shortcuts file found or error reading it for update, starting with empty array:", error.message);
    return [];
  }
}
async function writeProductFile(productData) {
  if (!productData || !productData.id) {
    console.warn("[API Update] Invalid product data provided for writing file.");
    return false;
  }
  try {
    await ensureDataDirectory$2();
    const filename = `${productData.id}.json`;
    const filePath = path.join(PRODUCTS_DIR, filename);
    await promises.writeFile(filePath, JSON.stringify(productData, null, 2));
    console.log(`[API Update] Product file written: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`[API Update] Failed to write product file for ID ${productData.id}:`, error);
    return false;
  }
}
async function readProductFile(productId) {
  try {
    await ensureDataDirectory$2();
    const filename = `${productId}.json`;
    const filePath = path.join(PRODUCTS_DIR, filename);
    const productRaw = await promises.readFile(filePath, "utf-8");
    return JSON.parse(productRaw);
  } catch (error) {
    return null;
  }
}
async function runSearchScript$2(refs, apiKey) {
  console.log(`[API Update] Starting search for ${refs.length} references.`);
  const URL2 = "https://www.vendus.pt/ws/v1.1/products";
  const apiClient = {
    get: async (url, options) => {
      var _a2;
      const params = new URLSearchParams(options.params);
      console.log(`[API Update] Fetching: ${url}?${params}`);
      const response = await fetch(`${url}?${params}`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
          "Accept": "application/json",
          "User-Agent": "Shopify App API Client (Server Update)"
        },
        timeout: 15e3
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API Update] HTTP Error ${response.status}: ${response.statusText}. Response body: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      console.log(`[API Update] Successfully fetched page ${options.params.page}, received ${Array.isArray(data) ? data.length : ((_a2 = data.data || data.products || data.items || data.results) == null ? void 0 : _a2.length) || "unknown"} items.`);
      return { data };
    }
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function fetchPageWithRetry(page, attempt = 0) {
    const maxRetries = 3;
    try {
      console.log(`[API Update] Attempting to fetch page ${page}, attempt ${attempt + 1}/${maxRetries}`);
      const response = await apiClient.get(URL2, {
        params: {
          page,
          per_page: 100
        }
      });
      return { page, data: response.data, success: true, attempts: attempt + 1 };
    } catch (error) {
      console.error(`[API Update] Error fetching page ${page} on attempt ${attempt + 1}: ${error.message}`);
      const shouldRetry = attempt < maxRetries;
      if (shouldRetry) {
        const delay = 1e3 * Math.pow(2, attempt);
        console.log(`[API Update] Retrying page ${page} in ${delay}ms...`);
        await sleep(Math.min(delay, 8e3));
        return fetchPageWithRetry(page, attempt + 1);
      }
      return { page, data: null, success: false, error: error.message, attempts: attempt + 1 };
    }
  }
  function checkProductForRefs(produto, refs2) {
    var _a2, _b, _c, _d, _e;
    const foundRefs2 = [];
    for (const ref of refs2) {
      if (produto.reference === ref || produto.code === ref || ((_a2 = produto.id) == null ? void 0 : _a2.toString()) === ref || !isNaN(ref) && produto.id === parseInt(ref)) {
        foundRefs2.push(ref);
        continue;
      }
      if (produto.variants) {
        let variantMatch = false;
        for (const variant of produto.variants) {
          if (((_b = variant.code) == null ? void 0 : _b.includes(ref)) || ((_c = variant.title) == null ? void 0 : _c.includes(ref))) {
            foundRefs2.push(ref);
            variantMatch = true;
            break;
          }
          if (!variantMatch && variant.product_variants) {
            for (const pv of variant.product_variants) {
              if (((_d = pv.code) == null ? void 0 : _d.includes(ref)) || ((_e = pv.text) == null ? void 0 : _e.includes(ref))) {
                foundRefs2.push(ref);
                variantMatch = true;
                break;
              }
            }
          }
          if (variantMatch) break;
        }
      }
    }
    return foundRefs2;
  }
  const foundRefs = /* @__PURE__ */ new Map();
  const remainingRefs = new Set(refs);
  const concurrency = 6;
  const maxPages = 1e3;
  let currentPage = 1;
  let isLastPage = false;
  let productsProcessed = 0;
  while (remainingRefs.size > 0 && !isLastPage && currentPage <= maxPages) {
    const pagesToFetch = [];
    for (let i = 0; i < concurrency && currentPage + i <= maxPages; i++) {
      pagesToFetch.push(currentPage + i);
    }
    console.log(`[API Update] Fetching pages: ${pagesToFetch.join(", ")}`);
    const pagePromises = pagesToFetch.map(
      (page, index2) => new Promise(
        (resolve) => setTimeout(() => resolve(fetchPageWithRetry(page)), index2 * 100)
      )
    );
    const pageResults = await Promise.all(pagePromises);
    for (const result of pageResults) {
      if (!result.success || !result.data) {
        console.warn(`[API Update] Failed to get data for page ${result.page}: ${result.error || "unknown error"}`);
        continue;
      }
      let produtos = Array.isArray(result.data) ? result.data : result.data.data || result.data.products || result.data.items || result.data.results;
      if (!Array.isArray(produtos)) {
        console.warn(`[API Update] Unexpected data format for page ${result.page}. Expected array, got:`, typeof result.data);
        continue;
      }
      console.log(`[API Update] Page ${result.page} returned ${produtos.length} products.`);
      if (produtos.length < 100) {
        isLastPage = true;
        console.log(`[API Update] Page ${result.page} had less than 100 products, marking as last page.`);
      }
      for (let index2 = 0; index2 < produtos.length; index2++) {
        const produto = produtos[index2];
        productsProcessed++;
        if (typeof produto !== "object" || produto === null) {
          console.warn(`[API Update] Skipping non-object product at page ${result.page}, position ${index2 + 1}. Type: ${typeof produto}`);
          continue;
        }
        const foundInProduct = checkProductForRefs(produto, Array.from(remainingRefs));
        if (foundInProduct.length > 0) {
          foundInProduct.forEach((ref) => {
            var _a2, _b, _c;
            if (foundRefs.has(ref)) {
              console.log(`[API Update] Reference ${ref} already found, skipping duplicate entry.`);
              return;
            }
            foundRefs.set(ref, {
              page: result.page,
              position: index2 + 1,
              productData: {
                id: produto.id,
                title: produto.title,
                reference: produto.reference,
                code: produto.code || produto.supplier_code,
                barcode: produto.barcode,
                description: produto.description,
                price: produto.gross_price || produto.price,
                price_without_tax: produto.price_without_tax,
                supply_price: produto.supply_price,
                stock: produto.stock,
                stock_alert: produto.stock_alert,
                status: produto.status,
                category_id: produto.category_id,
                brand_id: produto.brand_id,
                type_id: produto.type_id,
                unit_id: produto.unit_id,
                tax_id: produto.tax_id,
                stock_stores: produto.stock_store || [],
                compound: produto.compound,
                prices: produto.prices || [],
                thumbnail: ((_a2 = produto.image) == null ? void 0 : _a2.thumbnail) || ((_c = (_b = produto.images) == null ? void 0 : _b[0]) == null ? void 0 : _c.thumbnail) || null,
                // Check for image/images for thumbnail
                // Include any other relevant fields you might want
                created_at: produto.created_at,
                // Include timestamps for more detailed diff, but exclude from comparison
                updated_at: produto.updated_at
              }
            });
            remainingRefs.delete(ref);
            console.log(`[API Update] Found and added product for ref: ${ref} (ID: ${produto.id})`);
          });
        }
        if (remainingRefs.size === 0) {
          console.log("[API Update] All references found. Exiting search loop.");
          break;
        }
      }
      if (remainingRefs.size === 0) break;
    }
    currentPage += concurrency;
    if (remainingRefs.size > 0 && !isLastPage) {
      console.log(`[API Update] More refs to find, waiting before next batch. Current page: ${currentPage}, Remaining refs: ${remainingRefs.size}`);
      await sleep(200);
    }
    if (currentPage > maxPages) {
      console.warn(`[API Update] Reached maximum pages (${maxPages}). Stopping search.`);
    }
    if (remainingRefs.size === 0) break;
  }
  console.log(`[API Update] Search finished. Total products processed from API: ${productsProcessed}.`);
  const results = {
    searchDate: (/* @__PURE__ */ new Date()).toISOString(),
    totalSearched: refs.length,
    totalFound: foundRefs.size,
    found: Object.fromEntries(foundRefs),
    notFound: Array.from(remainingRefs)
  };
  console.log(`[API Update] Search results summary: Found ${results.totalFound}, Not Found ${results.notFound.length}.`);
  return results;
}
async function action$6() {
  console.log("[API Update] Received request to check and update products.");
  try {
    const vendusApi = getVendusApi();
    if (!vendusApi) {
      console.error("[API Update] API key not configured. Cannot proceed with product updates.");
      return json({ error: "API key not configured for product updates." }, { status: 400 });
    }
    const permanentShortcuts = await readShortcuts$2();
    if (permanentShortcuts.length === 0) {
      console.log("[API Update] No shortcuts to update. Skipping product update.");
      return json({ success: true, message: "No shortcuts to update. Skipping product update." });
    }
    console.log(`[API Update] Starting product update check for ${permanentShortcuts.length} shortcuts.`);
    const currentSearchResults = await runSearchScript$2(permanentShortcuts, vendusApi);
    let updatedCount = 0;
    let newFilesCreated = 0;
    let noChangeCount = 0;
    for (const ref in currentSearchResults.found) {
      if (currentSearchResults.found.hasOwnProperty(ref)) {
        const latestProductData = currentSearchResults.found[ref].productData;
        const existingProductData = await readProductFile(latestProductData.id);
        if (!existingProductData) {
          await writeProductFile(latestProductData);
          newFilesCreated++;
          console.log(`[API Update] New product file created for ID: ${latestProductData.id} (ref: ${ref}).`);
        } else {
          const cleanedLatest = { ...latestProductData };
          delete cleanedLatest.updated_at;
          delete cleanedLatest.created_at;
          const cleanedExisting = { ...existingProductData };
          delete cleanedExisting.updated_at;
          delete cleanedExisting.created_at;
          if (JSON.stringify(cleanedLatest) !== JSON.stringify(cleanedExisting)) {
            await writeProductFile(latestProductData);
            updatedCount++;
            console.log(`[API Update] Product file updated for ID: ${latestProductData.id} (ref: ${ref}).`);
          } else {
            noChangeCount++;
          }
        }
      }
    }
    console.log(`[API Update] Product update check finished. Updated: ${updatedCount}, New files: ${newFilesCreated}, No changes: ${noChangeCount}.`);
    return json({
      success: true,
      message: `Product update check complete. ${updatedCount} products updated, ${newFilesCreated} new files created, ${noChangeCount} unchanged.`,
      updatedCount,
      newFilesCreated,
      noChangeCount
    }, { status: 200 });
  } catch (error) {
    console.error("[API Update] Error during product update check:", error);
    return json({ error: `Product update check failed: ${error.message}` }, { status: 500 });
  }
}
async function loader$9() {
  return json({ message: "This is the product update API endpoint. Send a POST request." }, { status: 200 });
}
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6,
  loader: loader$9
}, Symbol.toStringTag, { value: "Module" }));
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null
}, Symbol.toStringTag, { value: "Module" }));
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null
}, Symbol.toStringTag, { value: "Module" }));
const Polaris = /* @__PURE__ */ JSON.parse('{"ActionMenu":{"Actions":{"moreActions":"More actions"},"RollupActions":{"rollupButton":"View actions"}},"ActionList":{"SearchField":{"clearButtonLabel":"Clear","search":"Search","placeholder":"Search actions"}},"Avatar":{"label":"Avatar","labelWithInitials":"Avatar with initials {initials}"},"Autocomplete":{"spinnerAccessibilityLabel":"Loading","ellipsis":"{content}…"},"Badge":{"PROGRESS_LABELS":{"incomplete":"Incomplete","partiallyComplete":"Partially complete","complete":"Complete"},"TONE_LABELS":{"info":"Info","success":"Success","warning":"Warning","critical":"Critical","attention":"Attention","new":"New","readOnly":"Read-only","enabled":"Enabled"},"progressAndTone":"{toneLabel} {progressLabel}"},"Banner":{"dismissButton":"Dismiss notification"},"Button":{"spinnerAccessibilityLabel":"Loading"},"Common":{"checkbox":"checkbox","undo":"Undo","cancel":"Cancel","clear":"Clear","close":"Close","submit":"Submit","more":"More"},"ContextualSaveBar":{"save":"Save","discard":"Discard"},"DataTable":{"sortAccessibilityLabel":"sort {direction} by","navAccessibilityLabel":"Scroll table {direction} one column","totalsRowHeading":"Totals","totalRowHeading":"Total"},"DatePicker":{"previousMonth":"Show previous month, {previousMonthName} {showPreviousYear}","nextMonth":"Show next month, {nextMonth} {nextYear}","today":"Today ","start":"Start of range","end":"End of range","months":{"january":"January","february":"February","march":"March","april":"April","may":"May","june":"June","july":"July","august":"August","september":"September","october":"October","november":"November","december":"December"},"days":{"monday":"Monday","tuesday":"Tuesday","wednesday":"Wednesday","thursday":"Thursday","friday":"Friday","saturday":"Saturday","sunday":"Sunday"},"daysAbbreviated":{"monday":"Mo","tuesday":"Tu","wednesday":"We","thursday":"Th","friday":"Fr","saturday":"Sa","sunday":"Su"}},"DiscardConfirmationModal":{"title":"Discard all unsaved changes","message":"If you discard changes, you’ll delete any edits you made since you last saved.","primaryAction":"Discard changes","secondaryAction":"Continue editing"},"DropZone":{"single":{"overlayTextFile":"Drop file to upload","overlayTextImage":"Drop image to upload","overlayTextVideo":"Drop video to upload","actionTitleFile":"Add file","actionTitleImage":"Add image","actionTitleVideo":"Add video","actionHintFile":"or drop file to upload","actionHintImage":"or drop image to upload","actionHintVideo":"or drop video to upload","labelFile":"Upload file","labelImage":"Upload image","labelVideo":"Upload video"},"allowMultiple":{"overlayTextFile":"Drop files to upload","overlayTextImage":"Drop images to upload","overlayTextVideo":"Drop videos to upload","actionTitleFile":"Add files","actionTitleImage":"Add images","actionTitleVideo":"Add videos","actionHintFile":"or drop files to upload","actionHintImage":"or drop images to upload","actionHintVideo":"or drop videos to upload","labelFile":"Upload files","labelImage":"Upload images","labelVideo":"Upload videos"},"errorOverlayTextFile":"File type is not valid","errorOverlayTextImage":"Image type is not valid","errorOverlayTextVideo":"Video type is not valid"},"EmptySearchResult":{"altText":"Empty search results"},"Frame":{"skipToContent":"Skip to content","navigationLabel":"Navigation","Navigation":{"closeMobileNavigationLabel":"Close navigation"}},"FullscreenBar":{"back":"Back","accessibilityLabel":"Exit fullscreen mode"},"Filters":{"moreFilters":"More filters","moreFiltersWithCount":"More filters ({count})","filter":"Filter {resourceName}","noFiltersApplied":"No filters applied","cancel":"Cancel","done":"Done","clearAllFilters":"Clear all filters","clear":"Clear","clearLabel":"Clear {filterName}","addFilter":"Add filter","clearFilters":"Clear all","searchInView":"in:{viewName}"},"FilterPill":{"clear":"Clear","unsavedChanges":"Unsaved changes - {label}"},"IndexFilters":{"searchFilterTooltip":"Search and filter","searchFilterTooltipWithShortcut":"Search and filter (F)","searchFilterAccessibilityLabel":"Search and filter results","sort":"Sort your results","addView":"Add a new view","newView":"Custom search","SortButton":{"ariaLabel":"Sort the results","tooltip":"Sort","title":"Sort by","sorting":{"asc":"Ascending","desc":"Descending","az":"A-Z","za":"Z-A"}},"EditColumnsButton":{"tooltip":"Edit columns","accessibilityLabel":"Customize table column order and visibility"},"UpdateButtons":{"cancel":"Cancel","update":"Update","save":"Save","saveAs":"Save as","modal":{"title":"Save view as","label":"Name","sameName":"A view with this name already exists. Please choose a different name.","save":"Save","cancel":"Cancel"}}},"IndexProvider":{"defaultItemSingular":"Item","defaultItemPlural":"Items","allItemsSelected":"All {itemsLength}+ {resourceNamePlural} are selected","selected":"{selectedItemsCount} selected","a11yCheckboxDeselectAllSingle":"Deselect {resourceNameSingular}","a11yCheckboxSelectAllSingle":"Select {resourceNameSingular}","a11yCheckboxDeselectAllMultiple":"Deselect all {itemsLength} {resourceNamePlural}","a11yCheckboxSelectAllMultiple":"Select all {itemsLength} {resourceNamePlural}"},"IndexTable":{"emptySearchTitle":"No {resourceNamePlural} found","emptySearchDescription":"Try changing the filters or search term","onboardingBadgeText":"New","resourceLoadingAccessibilityLabel":"Loading {resourceNamePlural}…","selectAllLabel":"Select all {resourceNamePlural}","selected":"{selectedItemsCount} selected","undo":"Undo","selectAllItems":"Select all {itemsLength}+ {resourceNamePlural}","selectItem":"Select {resourceName}","selectButtonText":"Select","sortAccessibilityLabel":"sort {direction} by"},"Loading":{"label":"Page loading bar"},"Modal":{"iFrameTitle":"body markup","modalWarning":"These required properties are missing from Modal: {missingProps}"},"Page":{"Header":{"rollupActionsLabel":"View actions for {title}","pageReadyAccessibilityLabel":"{title}. This page is ready"}},"Pagination":{"previous":"Previous","next":"Next","pagination":"Pagination"},"ProgressBar":{"negativeWarningMessage":"Values passed to the progress prop shouldn’t be negative. Resetting {progress} to 0.","exceedWarningMessage":"Values passed to the progress prop shouldn’t exceed 100. Setting {progress} to 100."},"ResourceList":{"sortingLabel":"Sort by","defaultItemSingular":"item","defaultItemPlural":"items","showing":"Showing {itemsCount} {resource}","showingTotalCount":"Showing {itemsCount} of {totalItemsCount} {resource}","loading":"Loading {resource}","selected":"{selectedItemsCount} selected","allItemsSelected":"All {itemsLength}+ {resourceNamePlural} in your store are selected","allFilteredItemsSelected":"All {itemsLength}+ {resourceNamePlural} in this filter are selected","selectAllItems":"Select all {itemsLength}+ {resourceNamePlural} in your store","selectAllFilteredItems":"Select all {itemsLength}+ {resourceNamePlural} in this filter","emptySearchResultTitle":"No {resourceNamePlural} found","emptySearchResultDescription":"Try changing the filters or search term","selectButtonText":"Select","a11yCheckboxDeselectAllSingle":"Deselect {resourceNameSingular}","a11yCheckboxSelectAllSingle":"Select {resourceNameSingular}","a11yCheckboxDeselectAllMultiple":"Deselect all {itemsLength} {resourceNamePlural}","a11yCheckboxSelectAllMultiple":"Select all {itemsLength} {resourceNamePlural}","Item":{"actionsDropdownLabel":"Actions for {accessibilityLabel}","actionsDropdown":"Actions dropdown","viewItem":"View details for {itemName}"},"BulkActions":{"actionsActivatorLabel":"Actions","moreActionsActivatorLabel":"More actions"}},"SkeletonPage":{"loadingLabel":"Page loading"},"Tabs":{"newViewAccessibilityLabel":"Create new view","newViewTooltip":"Create view","toggleTabsLabel":"More views","Tab":{"rename":"Rename view","duplicate":"Duplicate view","edit":"Edit view","editColumns":"Edit columns","delete":"Delete view","copy":"Copy of {name}","deleteModal":{"title":"Delete view?","description":"This can’t be undone. {viewName} view will no longer be available in your admin.","cancel":"Cancel","delete":"Delete view"}},"RenameModal":{"title":"Rename view","label":"Name","cancel":"Cancel","create":"Save","errors":{"sameName":"A view with this name already exists. Please choose a different name."}},"DuplicateModal":{"title":"Duplicate view","label":"Name","cancel":"Cancel","create":"Create view","errors":{"sameName":"A view with this name already exists. Please choose a different name."}},"CreateViewModal":{"title":"Create new view","label":"Name","cancel":"Cancel","create":"Create view","errors":{"sameName":"A view with this name already exists. Please choose a different name."}}},"Tag":{"ariaLabel":"Remove {children}"},"TextField":{"characterCount":"{count} characters","characterCountWithMaxLength":"{count} of {limit} characters used"},"TooltipOverlay":{"accessibilityLabel":"Tooltip: {label}"},"TopBar":{"toggleMenuLabel":"Toggle menu","SearchField":{"clearButtonLabel":"Clear","search":"Search"}},"MediaCard":{"dismissButton":"Dismiss","popoverButton":"Actions"},"VideoThumbnail":{"playButtonA11yLabel":{"default":"Play video","defaultWithDuration":"Play video of length {duration}","duration":{"hours":{"other":{"only":"{hourCount} hours","andMinutes":"{hourCount} hours and {minuteCount} minutes","andMinute":"{hourCount} hours and {minuteCount} minute","minutesAndSeconds":"{hourCount} hours, {minuteCount} minutes, and {secondCount} seconds","minutesAndSecond":"{hourCount} hours, {minuteCount} minutes, and {secondCount} second","minuteAndSeconds":"{hourCount} hours, {minuteCount} minute, and {secondCount} seconds","minuteAndSecond":"{hourCount} hours, {minuteCount} minute, and {secondCount} second","andSeconds":"{hourCount} hours and {secondCount} seconds","andSecond":"{hourCount} hours and {secondCount} second"},"one":{"only":"{hourCount} hour","andMinutes":"{hourCount} hour and {minuteCount} minutes","andMinute":"{hourCount} hour and {minuteCount} minute","minutesAndSeconds":"{hourCount} hour, {minuteCount} minutes, and {secondCount} seconds","minutesAndSecond":"{hourCount} hour, {minuteCount} minutes, and {secondCount} second","minuteAndSeconds":"{hourCount} hour, {minuteCount} minute, and {secondCount} seconds","minuteAndSecond":"{hourCount} hour, {minuteCount} minute, and {secondCount} second","andSeconds":"{hourCount} hour and {secondCount} seconds","andSecond":"{hourCount} hour and {secondCount} second"}},"minutes":{"other":{"only":"{minuteCount} minutes","andSeconds":"{minuteCount} minutes and {secondCount} seconds","andSecond":"{minuteCount} minutes and {secondCount} second"},"one":{"only":"{minuteCount} minute","andSeconds":"{minuteCount} minute and {secondCount} seconds","andSecond":"{minuteCount} minute and {secondCount} second"}},"seconds":{"other":"{secondCount} seconds","one":"{secondCount} second"}}}}}');
const polarisTranslations = {
  Polaris
};
const polarisStyles = "/assets/styles-BeiPL2RV.css";
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const links$2 = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$8 = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));
  return { errors, polarisTranslations };
};
const action$5 = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;
  return /* @__PURE__ */ jsx(AppProvider, { i18n: loaderData.polarisTranslations, children: /* @__PURE__ */ jsx(Page, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(Form, { method: "post", children: /* @__PURE__ */ jsxs(FormLayout, { children: [
    /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Log in" }),
    /* @__PURE__ */ jsx(
      TextField,
      {
        type: "text",
        name: "shop",
        label: "Shop domain",
        helpText: "example.myshopify.com",
        value: shop,
        onChange: setShop,
        autoComplete: "on",
        error: errors.shop
      }
    ),
    /* @__PURE__ */ jsx(Button, { submit: true, children: "Log in" })
  ] }) }) }) }) });
}
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  default: Auth,
  links: links$2,
  loader: loader$8
}, Symbol.toStringTag, { value: "Module" }));
const ENV_FILE = path.join(process.cwd(), ".env");
async function loader$7() {
  const currentApiKey = process.env.Chave_de_API_vendus || "";
  return json({
    vendusApi: currentApiKey,
    lastUpdated: null
  });
}
async function action$4({ request }) {
  const formData = await request.formData();
  const vendusApi = formData.get("vendusApi");
  try {
    if (!vendusApi || vendusApi.trim().length < 10) {
      return json({
        error: "API key must be at least 10 characters long"
      }, { status: 400 });
    }
    let envContent = "";
    try {
      envContent = await promises.readFile(ENV_FILE, "utf-8");
    } catch (error) {
      envContent = "";
    }
    const newApiKey = vendusApi.trim();
    if (envContent.includes("Chave_de_API_vendus=")) {
      envContent = envContent.replace(
        /Chave_de_API_vendus=.*/g,
        `Chave_de_API_vendus=${newApiKey}`
      );
    } else {
      if (envContent && !envContent.endsWith("\n")) {
        envContent += "\n";
      }
      envContent += `Chave_de_API_vendus=${newApiKey}
`;
    }
    await promises.writeFile(ENV_FILE, envContent);
    console.log("API key saved to .env file");
    return json({
      success: true,
      vendusApi: newApiKey,
      message: "API key saved to environment file. Please restart your server to apply changes."
    });
  } catch (error) {
    console.error("Error saving to .env file:", error);
    return json({
      error: "Failed to save API key to environment file. Please try again."
    }, { status: 500 });
  }
}
function SettingsPage$1() {
  const settings = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const { smUp } = useBreakpoints();
  const [vendusApi, setVendusApi] = useState("");
  const isSubmitting = navigation.state === "submitting";
  useEffect(() => {
    if (actionData == null ? void 0 : actionData.success) {
      setVendusApi("");
    }
  }, [actionData]);
  const lastSaved = (actionData == null ? void 0 : actionData.vendusApi) || settings.vendusApi || "Insert your Vendus API";
  return /* @__PURE__ */ jsxs(
    Page,
    {
      divider: true,
      primaryAction: { content: "View on your store", disabled: true },
      secondaryActions: [
        {
          content: "Duplicate",
          onAction: () => alert("Duplicate action")
        }
      ],
      children: [
        /* @__PURE__ */ jsx(TitleBar, { title: "Settings" }),
        /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { sectioned: true, children: /* @__PURE__ */ jsx(Form, { method: "post", children: /* @__PURE__ */ jsxs(BlockStack, { gap: { xs: "800", sm: "400" }, children: [
          /* @__PURE__ */ jsx(Text, { as: "h3", variant: "headingMd", children: "Configuration" }),
          /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", children: "Configure your Vendus API below" }),
          (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx(Banner, { status: "critical", children: /* @__PURE__ */ jsx("p", { children: actionData.error }) }),
          /* @__PURE__ */ jsx(
            TextField,
            {
              label: "Configure Vendus",
              placeholder: lastSaved,
              name: "vendusApi",
              value: vendusApi,
              onChange: setVendusApi,
              autoComplete: "off",
              type: "password",
              helpText: "Your API key will be stored securely",
              disabled: isSubmitting
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              primary: true,
              submit: true,
              loading: isSubmitting,
              disabled: !vendusApi.trim(),
              children: isSubmitting ? "Saving..." : "Save"
            }
          ),
          (actionData == null ? void 0 : actionData.success) && /* @__PURE__ */ jsx(Banner, { status: "success", children: /* @__PURE__ */ jsx("p", { children: actionData.message || "API key saved successfully!" }) }),
          settings.lastUpdated && /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", tone: "subdued", children: [
            "Last updated: ",
            new Date(settings.lastUpdated).toLocaleString()
          ] })
        ] }) }) }) }) })
      ]
    }
  );
}
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4,
  default: SettingsPage$1,
  loader: loader$7
}, Symbol.toStringTag, { value: "Module" }));
const loader$6 = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
const index = "_index_57jnb_1";
const heading = "_heading_57jnb_21";
const text = "_text_57jnb_23";
const content = "_content_57jnb_43";
const form = "_form_57jnb_53";
const label = "_label_57jnb_69";
const input = "_input_57jnb_85";
const button = "_button_57jnb_99";
const list = "_list_57jnb_107";
const styles = {
  index,
  heading,
  text,
  content,
  form,
  label,
  input,
  button,
  list
};
const loader$5 = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};
function App$1() {
  const { showForm } = useLoaderData();
  return /* @__PURE__ */ jsx("div", { className: styles.index, children: /* @__PURE__ */ jsxs("div", { className: styles.content, children: [
    /* @__PURE__ */ jsx("h1", { className: styles.heading, children: "A short heading about [your app]" }),
    /* @__PURE__ */ jsx("p", { className: styles.text, children: "A tagline about [your app] that describes your value proposition." }),
    showForm && /* @__PURE__ */ jsxs(Form, { className: styles.form, method: "post", action: "/auth/login", children: [
      /* @__PURE__ */ jsxs("label", { className: styles.label, children: [
        /* @__PURE__ */ jsx("span", { children: "Shop domain" }),
        /* @__PURE__ */ jsx("input", { className: styles.input, type: "text", name: "shop" }),
        /* @__PURE__ */ jsx("span", { children: "e.g: my-shop-domain.myshopify.com" })
      ] }),
      /* @__PURE__ */ jsx("button", { className: styles.button, type: "submit", children: "Log in" })
    ] }),
    /* @__PURE__ */ jsxs("ul", { className: styles.list, children: [
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] })
    ] })
  ] }) });
}
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: App$1,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const links$1 = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$4 = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};
function App() {
  const { apiKey } = useLoaderData();
  return /* @__PURE__ */ jsxs(AppProvider$1, { isEmbeddedApp: true, apiKey, children: [
    /* @__PURE__ */ jsxs(NavMenu, { children: [
      /* @__PURE__ */ jsx(Link, { to: "/app", rel: "home", children: "Home" }),
      /* @__PURE__ */ jsx(Link, { to: "/app/products", children: "Produtos" }),
      /* @__PURE__ */ jsx(Link, { to: "/app/search", children: "Buscar" })
    ] }),
    /* @__PURE__ */ jsx(Outlet, {})
  ] });
}
function ErrorBoundary() {
  return boundary.error(useRouteError());
}
const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: App,
  headers,
  links: links$1,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const DATA_DIR$1 = path.join(process.cwd(), "app", "data");
const SHORTCUTS_FILE$1 = path.join(DATA_DIR$1, "shortcuts.json");
const SEARCH_RESULTS_FILE$1 = path.join(DATA_DIR$1, "search_results.json");
async function ensureDataDirectory$1() {
  try {
    await promises.mkdir(DATA_DIR$1, { recursive: true });
    console.log("Data directory ensured:", DATA_DIR$1);
  } catch (error) {
    console.error("Failed to create data directory:", error);
    throw error;
  }
}
async function readShortcuts$1() {
  try {
    await ensureDataDirectory$1();
    const shortcutsRaw = await promises.readFile(SHORTCUTS_FILE$1, "utf-8");
    const shortcuts = JSON.parse(shortcutsRaw);
    console.log("Successfully read shortcuts:", shortcuts);
    return Array.isArray(shortcuts) ? shortcuts : [];
  } catch (error) {
    console.log("No shortcuts file found or error reading it, starting with empty array:", error.message);
    return [];
  }
}
async function writeShortcuts(shortcuts) {
  try {
    await ensureDataDirectory$1();
    const shortcutsArray = Array.isArray(shortcuts) ? shortcuts : [];
    await promises.writeFile(SHORTCUTS_FILE$1, JSON.stringify(shortcutsArray, null, 2));
    console.log("Successfully wrote shortcuts:", shortcutsArray);
    return true;
  } catch (error) {
    console.error("Failed to write shortcuts file:", error);
    throw error;
  }
}
async function loader$3() {
  const vendusApi = getVendusApi();
  let apiCallResult = null;
  let permanentShortcuts = [];
  let searchResults = null;
  permanentShortcuts = await readShortcuts$1();
  try {
    await ensureDataDirectory$1();
    const resultsRaw = await promises.readFile(SEARCH_RESULTS_FILE$1, "utf-8");
    searchResults = JSON.parse(resultsRaw);
  } catch (error) {
    console.log("No search results file found:", error.message);
    searchResults = null;
  }
  if (vendusApi) {
    try {
      const response = await fetch(`https://www.vendus.pt/ws/products?api_key=${vendusApi}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro na API - Status: ${response.status}, Resposta: ${errorText}`);
        let errorMessage = "Falha ao chamar a API do Vendus";
        if (response.status === 401) {
          errorMessage = "Chave da API inválida. Verifique suas credenciais.";
        } else if (response.status === 403) {
          errorMessage = "Acesso proibido. Verifique as permissões da sua API.";
        } else if (response.status === 404) {
          errorMessage = "Endpoint da API não encontrado. Verifique a URL.";
        }
        apiCallResult = {
          error: `${errorMessage} (Status: ${response.status})`
        };
      } else {
        const data = await response.json();
        const filePath = path.join(DATA_DIR$1, "vendus_products.json");
        try {
          await ensureDataDirectory$1();
          await promises.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (fileError) {
          console.warn("Não foi possível salvar o arquivo:", fileError);
        }
        apiCallResult = {
          success: true,
          data,
          totalProducts: Array.isArray(data) ? data.length : 1,
          message: "Chamada à API realizada com sucesso e dados guardados!"
        };
      }
    } catch (error) {
      console.error("Falha na chamada à API:", error);
      let userFriendlyError = "Falha ao chamar a API do Vendus. Verifique sua chave da API e conexão com a internet.";
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        userFriendlyError = "Erro de rede. Verifique sua conexão com a internet.";
      } else if (error.message.includes("JSON")) {
        userFriendlyError = "Resposta inválida da API. O serviço pode estar temporariamente indisponível.";
      }
      apiCallResult = {
        error: userFriendlyError
      };
    }
  } else {
    apiCallResult = {
      error: "Nenhuma chave da API configurada. Por favor, configure sua chave da API Vendus nas Definições primeiro."
    };
  }
  return json({
    hasApiKey: !!vendusApi,
    apiKeyLength: vendusApi ? vendusApi.length : 0,
    apiCallResult,
    permanentShortcuts,
    searchResults,
    // Add debug info
    debug: {
      dataDir: DATA_DIR$1,
      shortcutsFile: SHORTCUTS_FILE$1,
      shortcutsCount: permanentShortcuts.length
    }
  });
}
async function action$3({ request }) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  console.log("Action called with type:", actionType);
  if (actionType === "add") {
    try {
      const shortcutsToAdd = JSON.parse(formData.get("shortcuts"));
      console.log("Shortcuts to add:", shortcutsToAdd);
      const existingShortcuts = await readShortcuts$1();
      console.log("Existing shortcuts:", existingShortcuts);
      const newShortcuts = shortcutsToAdd.filter((s) => !existingShortcuts.includes(s));
      console.log("New shortcuts after filtering:", newShortcuts);
      const updatedShortcuts = [...existingShortcuts, ...newShortcuts];
      console.log("Updated shortcuts:", updatedShortcuts);
      await writeShortcuts(updatedShortcuts);
      return json({
        success: true,
        message: `Added ${newShortcuts.length} new shortcuts`,
        shortcuts: updatedShortcuts
      });
    } catch (error) {
      console.error("Error adding shortcuts:", error);
      return json({
        error: `Failed to add shortcuts: ${error.message}`,
        debug: error.stack
      });
    }
  } else if (actionType === "remove") {
    try {
      const shortcutToRemove = formData.get("shortcut");
      console.log("Shortcut to remove:", shortcutToRemove);
      const existingShortcuts = await readShortcuts$1();
      console.log("Existing shortcuts before removal:", existingShortcuts);
      const updatedShortcuts = existingShortcuts.filter((s) => s !== shortcutToRemove);
      console.log("Updated shortcuts after removal:", updatedShortcuts);
      await writeShortcuts(updatedShortcuts);
      return json({
        success: true,
        message: `Removed shortcut: ${shortcutToRemove}`,
        shortcuts: updatedShortcuts
      });
    } catch (error) {
      console.error("Error removing shortcut:", error);
      return json({
        error: `Failed to remove shortcut: ${error.message}`,
        debug: error.stack
      });
    }
  } else if (actionType === "search") {
    try {
      const vendusApi = getVendusApi();
      const permanentShortcuts = await readShortcuts$1();
      if (!vendusApi || permanentShortcuts.length === 0) {
        return json({ error: "API key not configured or no shortcuts to search" });
      }
      const searchResults = await runSearchScript$1(permanentShortcuts, vendusApi);
      await ensureDataDirectory$1();
      await promises.writeFile(SEARCH_RESULTS_FILE$1, JSON.stringify(searchResults, null, 2));
      return json({ success: true, searchResults });
    } catch (error) {
      console.error("Search failed:", error);
      return json({ error: `Search failed: ${error.message}` });
    }
  }
  return json({ error: "Unknown action type" });
}
async function runSearchScript$1(refs, apiKey) {
  const URL2 = "https://www.vendus.pt/ws/v1.1/products";
  const apiClient = {
    get: async (url, options) => {
      const params = new URLSearchParams(options.params);
      const response = await fetch(`${url}?${params}`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
          "Accept": "application/json",
          "User-Agent": "Shopify App API Client"
        }
        // It's good practice to have a timeout for external API calls
        // Note: fetch API does not directly support a 'timeout' option.
        // You would typically implement this using AbortController.
        // For simplicity, we'll omit it here, but keep in mind for production.
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return { data };
    }
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function fetchPageWithRetry(page, attempt = 0) {
    const maxRetries = 3;
    try {
      const response = await apiClient.get(URL2, {
        params: {
          page,
          per_page: 100
        }
      });
      return { page, data: response.data, success: true, attempts: attempt + 1 };
    } catch (error) {
      const shouldRetry = attempt < maxRetries;
      if (shouldRetry) {
        const delay = 1e3 * Math.pow(2, attempt);
        await sleep(Math.min(delay, 8e3));
        return fetchPageWithRetry(page, attempt + 1);
      }
      return { page, data: null, success: false, error: error.message, attempts: attempt + 1 };
    }
  }
  function checkProductForRefs(produto, refs2) {
    var _a2, _b, _c;
    const foundRefs2 = [];
    for (const ref of refs2) {
      if (produto.reference === ref || produto.code === ref || ((_a2 = produto.id) == null ? void 0 : _a2.toString()) === ref || !isNaN(ref) && produto.id === parseInt(ref)) {
        foundRefs2.push(ref);
        continue;
      }
      if (produto.variants && Array.isArray(produto.variants)) {
        for (const variant of produto.variants) {
          if (variant.variant) {
            if (variant.variant.code === ref || variant.variant.title === ref || variant.variant.reference === ref || (((_b = variant.variant.id) == null ? void 0 : _b.toString()) === ref || !isNaN(ref) && variant.variant.id === parseInt(ref))) {
              foundRefs2.push(ref);
              break;
            }
          }
          if (variant.product_variants && Array.isArray(variant.product_variants)) {
            for (const pv of variant.product_variants) {
              if (pv.code === ref || pv.text === ref || pv.barcode === ref || (((_c = pv.id) == null ? void 0 : _c.toString()) === ref || !isNaN(ref) && pv.id === parseInt(ref))) {
                foundRefs2.push(ref);
                break;
              }
            }
          }
        }
      }
    }
    return foundRefs2;
  }
  const foundRefs = /* @__PURE__ */ new Map();
  const remainingRefs = new Set(refs);
  const concurrency = 6;
  const maxPages = 1e3;
  let currentPage = 1;
  let isLastPage = false;
  while (remainingRefs.size > 0 && !isLastPage && currentPage <= maxPages) {
    const pagesToFetch = [];
    for (let i = 0; i < concurrency && currentPage + i <= maxPages; i++) {
      pagesToFetch.push(currentPage + i);
    }
    const pagePromises = pagesToFetch.map(
      (page, index2) => new Promise(
        (resolve) => setTimeout(() => resolve(fetchPageWithRetry(page)), index2 * 100)
      )
    );
    const pageResults = await Promise.all(pagePromises);
    for (const result of pageResults) {
      if (!result.success || !result.data) continue;
      let produtos = Array.isArray(result.data) ? result.data : result.data.data || result.data.products || result.data.items || result.data.results;
      if (!Array.isArray(produtos)) continue;
      if (produtos.length < 100) {
        isLastPage = true;
      }
      for (let index2 = 0; index2 < produtos.length; index2++) {
        const produto = produtos[index2];
        if (typeof produto !== "object" || produto === null) continue;
        const foundInProduct = checkProductForRefs(produto, Array.from(remainingRefs));
        if (foundInProduct.length > 0) {
          const images = [];
          if (produto.images && typeof produto.images === "object") {
            if (produto.images.m) {
              images.push(produto.images.m);
            } else if (produto.images.xs) {
              images.push(produto.images.xs);
            }
          }
          const colors = /* @__PURE__ */ new Set();
          const sizes = /* @__PURE__ */ new Set();
          if (produto.variants && Array.isArray(produto.variants)) {
            produto.variants.forEach((variant) => {
              if (variant.variant && variant.variant.title) {
                colors.add(variant.variant.title.trim());
              }
              if (variant.product_variants && Array.isArray(variant.product_variants)) {
                variant.product_variants.forEach((pv) => {
                  if (pv.text) {
                    const parts = pv.text.split("/").map((s) => s.trim());
                    if (parts.length === 2) {
                      colors.add(parts[0]);
                      sizes.add(parts[1]);
                    } else if (parts.length === 1) ;
                  }
                });
              }
            });
          }
          const finalColors = Array.from(colors);
          const finalSizes = Array.from(sizes);
          foundInProduct.forEach((ref) => {
            foundRefs.set(ref, {
              page: result.page,
              position: index2 + 1,
              productData: {
                id: produto.id,
                title: produto.title,
                reference: produto.reference,
                code: produto.code || produto.supplier_code,
                barcode: produto.barcode,
                description: produto.description,
                price: produto.gross_price || produto.price,
                price_without_tax: produto.price_without_tax,
                supply_price: produto.supply_price,
                stock: produto.stock,
                stock_alert: produto.stock_alert,
                status: produto.status,
                category_id: produto.category_id,
                brand_id: produto.brand_id,
                type_id: produto.type_id,
                unit_id: produto.unit_id,
                tax_id: produto.tax_id,
                stock_stores: produto.stock_store || [],
                compound: produto.compound,
                prices: produto.prices || [],
                // Use the new fields for images, colors, and sizes
                images,
                colors: finalColors,
                sizes: finalSizes,
                variants: produto.variants || []
                // Keep full variant data for detailed view
              }
            });
            remainingRefs.delete(ref);
          });
        }
        if (remainingRefs.size === 0) break;
      }
      if (remainingRefs.size === 0) break;
    }
    currentPage += concurrency;
    if (remainingRefs.size > 0 && !isLastPage) {
      await sleep(200);
    }
    if (remainingRefs.size === 0) break;
  }
  const results = {
    searchDate: (/* @__PURE__ */ new Date()).toISOString(),
    totalSearched: refs.length,
    totalFound: foundRefs.size,
    found: Object.fromEntries(foundRefs),
    notFound: Array.from(remainingRefs)
  };
  return results;
}
function AdditionalPage() {
  var _a2, _b, _c, _d, _e, _f, _g, _h;
  const loaderData = useLoaderData();
  const { hasApiKey, apiKeyLength, apiCallResult, permanentShortcuts, searchResults, debug } = loaderData;
  const fetcher = useFetcher();
  const [shortcuts, setShortcuts] = useState([]);
  const [newShortcut, setNewShortcut] = useState("");
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showProductDetailsModal, setShowProductDetailsModal] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const isSearching = fetcher.state === "submitting" && ((_a2 = fetcher.formData) == null ? void 0 : _a2.get("actionType")) === "search";
  const isSubmitting = fetcher.state === "submitting";
  const handleAddShortcut = useCallback(() => {
    const trimmedShortcut = newShortcut.trim();
    if (!trimmedShortcut) {
      return;
    }
    const alreadyInTemp = shortcuts.includes(trimmedShortcut);
    const alreadyInPermanent = permanentShortcuts.includes(trimmedShortcut);
    if (alreadyInTemp || alreadyInPermanent) {
      console.log("Shortcut already exists");
      return;
    }
    setShortcuts((prev) => [...prev, trimmedShortcut]);
    setNewShortcut("");
  }, [newShortcut, shortcuts, permanentShortcuts]);
  const handleAddShortcutKeyPress = useCallback((event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddShortcut();
    }
  }, [handleAddShortcut]);
  const handleSubmitShortcut = useCallback(() => {
    if (shortcuts.length === 0) return;
    const formData = new FormData();
    formData.append("actionType", "add");
    formData.append("shortcuts", JSON.stringify(shortcuts));
    fetcher.submit(formData, { method: "post" });
    setShortcuts([]);
    setNewShortcut("");
  }, [shortcuts, fetcher]);
  const handleRemovePermanent = useCallback((shortcut) => {
    const formData = new FormData();
    formData.append("actionType", "remove");
    formData.append("shortcut", shortcut);
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);
  const handleRunSearch = useCallback(() => {
    const formData = new FormData();
    formData.append("actionType", "search");
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);
  const handleRemoveFromTemp = useCallback((shortcutToRemove) => {
    setShortcuts((prev) => prev.filter((s) => s !== shortcutToRemove));
  }, []);
  const handleProductRowClick = useCallback((ref, productData) => {
    setSelectedProductDetails({ ref, ...productData });
    setShowProductDetailsModal(true);
  }, []);
  const resultsTableRows = searchResults ? Object.entries(searchResults.found).map(([ref, data]) => {
    var _a3, _b2, _c2;
    return [
      ref,
      data.productData.title || "N/A",
      data.productData.id || "N/A",
      data.productData.reference || "N/A",
      data.productData.code || "N/A",
      data.page.toString(),
      data.position.toString(),
      ((_a3 = data.productData.images) == null ? void 0 : _a3.length) > 0 ? "Sim" : "Não",
      // Has Images
      ((_b2 = data.productData.colors) == null ? void 0 : _b2.length) > 0 ? data.productData.colors.join(", ") : "N/A",
      // Colors
      ((_c2 = data.productData.sizes) == null ? void 0 : _c2.length) > 0 ? data.productData.sizes.join(", ") : "N/A"
      // Sizes
    ];
  }) : [];
  const notFoundList = (searchResults == null ? void 0 : searchResults.notFound) || [];
  return /* @__PURE__ */ jsxs(Page, { children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Integração com a API Vendus" }),
    /* @__PURE__ */ jsxs(Layout, { children: [
      /* @__PURE__ */ jsxs(Layout.Section, { children: [
        /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
          /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Status da Integração com a API" }),
          hasApiKey ? /* @__PURE__ */ jsx(Banner, { status: "success", children: /* @__PURE__ */ jsxs("p", { children: [
            "Chave da API do Vendus configurada (Tamanho: ",
            apiKeyLength,
            " caracteres)"
          ] }) }) : /* @__PURE__ */ jsx(Banner, { status: "warning", children: /* @__PURE__ */ jsx("p", { children: "Nenhuma chave da API do Vendus configurada. Por favor, configure nas Definições primeiro." }) }),
          (apiCallResult == null ? void 0 : apiCallResult.error) && /* @__PURE__ */ jsx(Banner, { status: "critical", children: /* @__PURE__ */ jsx("p", { children: apiCallResult.error }) }),
          (apiCallResult == null ? void 0 : apiCallResult.success) && /* @__PURE__ */ jsx(Banner, { status: "success", children: /* @__PURE__ */ jsx(BlockStack, { gap: "200", children: /* @__PURE__ */ jsx("p", { children: apiCallResult.message }) }) }),
          ((_b = fetcher.data) == null ? void 0 : _b.error) && /* @__PURE__ */ jsx(Banner, { status: "critical", children: /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
            /* @__PURE__ */ jsx("p", { children: fetcher.data.error }),
            fetcher.data.debug && /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", children: [
              "Debug: ",
              fetcher.data.debug
            ] })
          ] }) }),
          ((_c = fetcher.data) == null ? void 0 : _c.success) && ((_d = fetcher.data) == null ? void 0 : _d.message) && /* @__PURE__ */ jsx(Banner, { status: "success", children: /* @__PURE__ */ jsx("p", { children: fetcher.data.message }) }),
          ((_e = fetcher.data) == null ? void 0 : _e.success) && ((_f = fetcher.data) == null ? void 0 : _f.searchResults) && /* @__PURE__ */ jsx(Banner, { status: "success", children: /* @__PURE__ */ jsxs("p", { children: [
            "Pesquisa concluída! ",
            fetcher.data.searchResults.totalFound,
            " de ",
            fetcher.data.searchResults.totalSearched,
            " referências encontradas."
          ] }) })
        ] }) }),
        /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsx(Text, { as: "h3", variant: "headingMd", children: "Produtos Externos" }),
          searchResults && /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(InlineStack, { gap: "200", align: "space-between", children: [
              /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
                "Última pesquisa: ",
                new Date(searchResults.searchDate).toLocaleString("pt-PT")
              ] }),
              /* @__PURE__ */ jsx(Button, { onClick: () => setShowResultsModal(true), children: "Ver Resultados Detalhados" })
            ] }),
            /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
              "Encontrados: ",
              searchResults.totalFound,
              "/",
              searchResults.totalSearched,
              " referências"
            ] })
          ] })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs(Layout.Section, { variant: "oneThird", children: [
        /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
          /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Adicionar produtos" }),
          /* @__PURE__ */ jsxs(InlineStack, { gap: "200", align: "end", children: [
            /* @__PURE__ */ jsx(Box, { style: { flexGrow: 1 }, children: /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Adicionar novo atalho",
                value: newShortcut,
                onChange: setNewShortcut,
                onKeyPress: handleAddShortcutKeyPress,
                placeholder: "Inserir referências",
                autoComplete: "off",
                disabled: isSubmitting
              }
            ) }),
            /* @__PURE__ */ jsx(
              Button,
              {
                onClick: handleAddShortcut,
                disabled: !newShortcut.trim() || shortcuts.includes(newShortcut.trim()) || permanentShortcuts.includes(newShortcut.trim()) || isSubmitting,
                children: "Adicionar"
              }
            )
          ] }),
          shortcuts.length > 0 && /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(Text, { as: "h3", variant: "headingSm", children: [
              "IDs de Produtos Temporários (",
              shortcuts.length,
              ")"
            ] }),
            /* @__PURE__ */ jsx(InlineStack, { gap: "100", wrap: true, children: shortcuts.map((shortcut, index2) => /* @__PURE__ */ jsx(
              Tag,
              {
                onRemove: () => handleRemoveFromTemp(shortcut),
                children: shortcut
              },
              index2
            )) }),
            /* @__PURE__ */ jsx(
              Button,
              {
                primary: true,
                onClick: handleSubmitShortcut,
                disabled: shortcuts.length === 0 || isSubmitting,
                loading: isSubmitting && ((_g = fetcher.formData) == null ? void 0 : _g.get("actionType")) === "add",
                children: isSubmitting && ((_h = fetcher.formData) == null ? void 0 : _h.get("actionType")) === "add" ? "Submetendo..." : `Submeter (${shortcuts.length} atalhos)`
              }
            )
          ] })
        ] }) }),
        /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
          /* @__PURE__ */ jsxs(Text, { as: "h3", variant: "headingMd", children: [
            "Lista Permanente de Atalhos (",
            permanentShortcuts.length,
            ")"
          ] }),
          permanentShortcuts.length === 0 && /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", children: "Nenhum atalho salvo ainda." }),
          /* @__PURE__ */ jsx(InlineStack, { gap: "100", wrap: true, children: permanentShortcuts.map((shortcut, index2) => /* @__PURE__ */ jsx(
            Tag,
            {
              onRemove: () => handleRemovePermanent(shortcut),
              children: shortcut
            },
            index2
          )) }),
          /* @__PURE__ */ jsx(
            Button,
            {
              primary: permanentShortcuts.length > 0 && hasApiKey,
              onClick: handleRunSearch,
              disabled: isSearching || permanentShortcuts.length === 0 || !hasApiKey,
              loading: isSearching,
              children: isSearching ? "Pesquisando..." : permanentShortcuts.length === 0 ? "Adicione Atalhos Primeiro" : !hasApiKey ? "Configure a Chave da API" : "Executar Pesquisa"
            }
          )
        ] }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: showResultsModal,
        onClose: () => setShowResultsModal(false),
        title: "Resultados da Pesquisa",
        large: true,
        children: /* @__PURE__ */ jsx(Modal.Section, { children: searchResults ? /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsxs(Text, { as: "h3", variant: "headingMd", children: [
            "Produtos Encontrados (",
            searchResults.totalFound,
            ")"
          ] }),
          resultsTableRows.length > 0 ? /* @__PURE__ */ jsx(
            DataTable,
            {
              columnContentTypes: ["text", "text", "text", "text", "text", "numeric", "numeric", "text", "text", "text"],
              headings: ["Referência Buscada", "Título Produto", "ID", "Referência Produto", "Código", "Página", "Posição", "Imagens", "Cores", "Tamanhos"],
              rows: resultsTableRows,
              onRowClick: (row, index2) => {
                var _a3;
                const originalRef = row[0];
                const productData = (_a3 = searchResults.found[originalRef]) == null ? void 0 : _a3.productData;
                if (productData) {
                  handleProductRowClick(originalRef, productData);
                }
              }
            }
          ) : /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", children: "Nenhum produto encontrado para as referências buscadas." }),
          notFoundList.length > 0 && /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsxs(Text, { as: "h3", variant: "headingMd", children: [
              "Referências Não Encontradas (",
              notFoundList.length,
              ")"
            ] }),
            /* @__PURE__ */ jsx(InlineStack, { gap: "100", wrap: true, children: notFoundList.map((ref, index2) => /* @__PURE__ */ jsx(Tag, { children: ref }, index2)) })
          ] }),
          /* @__PURE__ */ jsxs(Box, { children: [
            /* @__PURE__ */ jsx(Text, { as: "h4", variant: "headingSm", children: "Dados JSON Completos:" }),
            /* @__PURE__ */ jsx(
              Box,
              {
                as: "pre",
                padding: "300",
                background: "bg-surface-secondary",
                borderRadius: "200",
                style: {
                  fontSize: "12px",
                  overflow: "auto",
                  maxHeight: "300px",
                  whiteSpace: "pre-wrap"
                },
                children: JSON.stringify(searchResults, null, 2)
              }
            )
          ] })
        ] }) : /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", children: "Nenhum resultado de pesquisa disponível." }) })
      }
    ),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: showProductDetailsModal,
        onClose: () => setShowProductDetailsModal(false),
        title: (selectedProductDetails == null ? void 0 : selectedProductDetails.title) || "Detalhes do Produto",
        large: true,
        children: /* @__PURE__ */ jsx(Modal.Section, { children: selectedProductDetails ? /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsx(Text, { as: "h3", variant: "headingMd", children: selectedProductDetails.title }),
          /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
            "**ID:** ",
            selectedProductDetails.id
          ] }),
          /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
            "**Referência:** ",
            selectedProductDetails.reference
          ] }),
          /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
            "**Código:** ",
            selectedProductDetails.code
          ] }),
          /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
            "**Preço:** ",
            selectedProductDetails.price,
            "€"
          ] }),
          /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
            "**Stock:** ",
            selectedProductDetails.stock
          ] }),
          /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
            "**Descrição:** ",
            selectedProductDetails.description || "N/A"
          ] }),
          selectedProductDetails.images && selectedProductDetails.images.length > 0 && /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { as: "h4", variant: "headingSm", children: "Imagens do Produto:" }),
            /* @__PURE__ */ jsx(InlineStack, { gap: "200", wrap: true, children: selectedProductDetails.images.map((imgUrl, index2) => /* @__PURE__ */ jsx(Box, { width: "150px", height: "150px", overflow: "hidden", borderRadius: "100", children: /* @__PURE__ */ jsx("img", { src: imgUrl, alt: `Product Image ${index2 + 1}`, style: { width: "100%", height: "100%", objectFit: "cover" } }) }, index2)) })
          ] }),
          selectedProductDetails.colors && selectedProductDetails.colors.length > 0 && /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { as: "h4", variant: "headingSm", children: "Cores Disponíveis:" }),
            /* @__PURE__ */ jsx(InlineStack, { gap: "100", wrap: true, children: selectedProductDetails.colors.map((color, index2) => /* @__PURE__ */ jsx(Tag, { children: color }, index2)) })
          ] }),
          selectedProductDetails.sizes && selectedProductDetails.sizes.length > 0 && /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { as: "h4", variant: "headingSm", children: "Tamanhos Disponíveis:" }),
            /* @__PURE__ */ jsx(InlineStack, { gap: "100", wrap: true, children: selectedProductDetails.sizes.map((size, index2) => /* @__PURE__ */ jsx(Tag, { children: size }, index2)) })
          ] }),
          selectedProductDetails.variants && selectedProductDetails.variants.length > 0 && /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { as: "h4", variant: "headingSm", children: "Variantes:" }),
            /* @__PURE__ */ jsx(List, { type: "bullet", children: selectedProductDetails.variants.map((variant, index2) => {
              var _a3, _b2, _c2;
              return /* @__PURE__ */ jsx(List.Item, { children: /* @__PURE__ */ jsxs(Text, { as: "span", variant: "bodyMd", children: [
                "**",
                ((_a3 = variant.variant) == null ? void 0 : _a3.title) || "N/A",
                "** (Ref: ",
                ((_b2 = variant.variant) == null ? void 0 : _b2.reference) || "N/A",
                ", Code: ",
                ((_c2 = variant.variant) == null ? void 0 : _c2.code) || "N/A",
                ")",
                variant.gross_price && ` - Price: ${variant.gross_price}€`,
                variant.stock && ` - Stock: ${variant.stock}`,
                variant.product_variants && Array.isArray(variant.product_variants) && variant.product_variants.length > 0 && /* @__PURE__ */ jsx(List, { type: "dash", children: variant.product_variants.map((pv, pvIndex) => /* @__PURE__ */ jsx(List.Item, { children: /* @__PURE__ */ jsxs(Text, { as: "span", variant: "bodySm", children: [
                  pv.text || "N/A",
                  " (Code: ",
                  pv.code || "N/A",
                  ", Barcode: ",
                  pv.barcode || "N/A",
                  ")",
                  pv.price && ` - Price: ${pv.price}€`,
                  pv.stock && Array.isArray(pv.stock) && pv.stock.length > 0 && ` - Stock: ${pv.stock.map((s) => s.qty).reduce((a, b) => a + b, 0)}`
                ] }) }, `${index2}-${pvIndex}`)) })
              ] }) }, index2);
            }) })
          ] }),
          /* @__PURE__ */ jsxs(Box, { children: [
            /* @__PURE__ */ jsx(Text, { as: "h4", variant: "headingSm", children: "Dados Brutos do Produto:" }),
            /* @__PURE__ */ jsx(
              Box,
              {
                as: "pre",
                padding: "300",
                background: "bg-surface-secondary",
                borderRadius: "200",
                style: {
                  fontSize: "12px",
                  overflow: "auto",
                  maxHeight: "200px",
                  whiteSpace: "pre-wrap"
                },
                children: JSON.stringify(selectedProductDetails, null, 2)
              }
            )
          ] })
        ] }) : /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", children: "Nenhum detalhe do produto selecionado." }) })
      }
    )
  ] });
}
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3,
  default: AdditionalPage,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
async function loader$2() {
  return json(getSettings());
}
async function action$2({ request }) {
  const formData = await request.formData();
  const vendusApi = formData.get("vendusApi");
  try {
    if (!vendusApi || vendusApi.trim().length < 10) {
      return json({
        error: "API key must be at least 10 characters long"
      }, { status: 400 });
    }
    const updatedSettings = updateSettings({
      vendusApi: vendusApi.trim(),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    });
    console.log("Settings updated:", updatedSettings);
    return json({ success: true, vendusApi: updatedSettings.vendusApi });
  } catch (error) {
    console.error("Error saving settings:", error);
    return json({
      error: "Failed to save settings. Please try again."
    }, { status: 500 });
  }
}
function SettingsPage() {
  const settings = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const { smUp } = useBreakpoints();
  const [vendusApi, setVendusApi] = useState("");
  const isSubmitting = navigation.state === "submitting";
  useEffect(() => {
    if (actionData == null ? void 0 : actionData.success) {
      setVendusApi("");
    }
  }, [actionData]);
  const lastSaved = (actionData == null ? void 0 : actionData.vendusApi) || settings.vendusApi || "Insert your Vendus API";
  return /* @__PURE__ */ jsxs(
    Page,
    {
      divider: true,
      primaryAction: { content: "View on your store", disabled: true },
      secondaryActions: [
        {
          content: "Duplicate",
          onAction: () => alert("Duplicate action")
        }
      ],
      children: [
        /* @__PURE__ */ jsx(TitleBar, { title: "Settings" }),
        /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { sectioned: true, children: /* @__PURE__ */ jsx(Form, { method: "post", children: /* @__PURE__ */ jsxs(BlockStack, { gap: { xs: "800", sm: "400" }, children: [
          /* @__PURE__ */ jsx(Text, { as: "h3", variant: "headingMd", children: "Configuração" }),
          /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", children: "Configure a API do Vendus abaixo" }),
          (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx(Banner, { status: "critical", children: /* @__PURE__ */ jsx("p", { children: actionData.error }) }),
          /* @__PURE__ */ jsx(
            TextField,
            {
              label: "Configure Vendus",
              placeholder: lastSaved,
              name: "vendusApi",
              value: vendusApi,
              onChange: setVendusApi,
              autoComplete: "off",
              type: "password",
              helpText: "Sua chave de API vai ser guardada com segurança.",
              disabled: isSubmitting
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              primary: true,
              submit: true,
              loading: isSubmitting,
              disabled: !vendusApi.trim(),
              children: isSubmitting ? "Salvando..." : "Configuração salva"
            }
          ),
          (actionData == null ? void 0 : actionData.success) && /* @__PURE__ */ jsx(Banner, { status: "success", children: /* @__PURE__ */ jsx("p", { children: "API key saved successfully!" }) }),
          settings.lastUpdated && /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodySm", tone: "subdued", children: [
            "Ultima atualização: ",
            new Date(settings.lastUpdated).toLocaleString()
          ] })
        ] }) }) }) }) })
      ]
    }
  );
}
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  default: SettingsPage,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const stylesUrl = {};
const links = () => [{ rel: "stylesheet", href: stylesUrl }];
const loader$1 = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};
const action$1 = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][Math.floor(Math.random() * 4)];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`
        }
      }
    }
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }]
      }
    }
  );
  const variantResponseJson = await variantResponse.json();
  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants
  };
};
function Index() {
  var _a2, _b;
  const fetcher = useFetcher();
  const shopify2 = useAppBridge();
  const productId = (_b = (_a2 = fetcher.data) == null ? void 0 : _a2.product) == null ? void 0 : _b.id.replace(
    "gid://shopify/Product/",
    ""
  );
  useEffect(() => {
    if (productId) {
      shopify2.toast.show("Product created");
    }
  }, [productId, shopify2]);
  return /* @__PURE__ */ jsxs(Page, { fullWidth: true, children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Vendus API Manager" }),
    /* @__PURE__ */ jsx(BlockStack, { gap: "700", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(Card, { sectioned: true, children: [
      /* @__PURE__ */ jsx(
        Image,
        {
          source: "../app/images/logo_cooprativa.png",
          alt: "Logo Cooperativa",
          width: 150,
          height: 150,
          style: { display: "block", margin: "0 auto", borderRadius: "100%" }
        }
      ),
      /* @__PURE__ */ jsx("p", { style: { textAlign: "center", marginTop: "20px" }, children: "Welcome to Vendus API Manager." })
    ] }) }) }) })
  ] });
}
const route14 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: Index,
  links,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const DATA_DIR = join(process.cwd(), "app", "data");
const SEARCH_RESULTS_FILE = join(DATA_DIR, "search_results.json");
const SHORTCUTS_FILE = join(DATA_DIR, "shortcuts.json");
const SHOPIFY_LOCATION_ID$1 = "gid://shopify/Location/102699630920";
async function ensureDataDirectory() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    console.log("Data directory ensured:", DATA_DIR);
  } catch (error) {
    console.error("Failed to create data directory:", error);
    throw error;
  }
}
async function readShortcuts() {
  try {
    await ensureDataDirectory();
    const shortcutsRaw = await readFile(SHORTCUTS_FILE, "utf-8");
    const shortcuts = JSON.parse(shortcutsRaw);
    console.log("Successfully read shortcuts:", shortcuts);
    return Array.isArray(shortcuts) ? shortcuts : [];
  } catch (error) {
    console.log("No shortcuts file found or error reading it, starting with empty array:", error.message);
    return [];
  }
}
async function processProductBatch(admin, productsToProcess, onlineStorePublicationId) {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa, _ba, _ca, _da, _ea, _fa, _ga, _ha, _ia;
  const createdProducts = [];
  const updatedProducts = [];
  const errors = [];
  for (const [reference, productInfo] of Object.entries(productsToProcess)) {
    try {
      console.log(`
📦 Processing product: ${reference}`);
      const productData = productInfo.productData;
      if (!productData.title || !productData.price) {
        errors.push({
          reference,
          error: "Missing required fields: title or price",
          action: "validation"
        });
        continue;
      }
      const priceString = String(productData.price || "0.00");
      console.log(`💰 Price for ${reference}: "${priceString}"`);
      const handle = ((_a2 = productData.reference) == null ? void 0 : _a2.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")) || productData.title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      console.log(`🔍 Searching for existing product with tag: ref-${productData.reference}`);
      let searchData;
      try {
        const searchResponse = await admin.graphql(`
          query searchProducts($query: String!) {
            products(first: 5, query: $query) {
              edges {
                node {
                  id
                  title
                  tags
                  handle
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        sku
                        price
                        inventoryQuantity
                        inventoryItem {
                          id
                          sku
                          tracked
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `, {
          variables: {
            query: `tag:ref-${productData.reference}`
          }
        });
        searchData = await searchResponse.json();
        if (searchData.errors) {
          console.error(`DEBUG: GraphQL errors for searchProducts (reference: ${reference}):`, JSON.stringify(searchData.errors, null, 2));
          errors.push({
            reference,
            error: `GraphQL Search Error: ${searchData.errors.map((e) => e.message).join(", ")}`,
            action: "search product"
          });
          continue;
        }
      } catch (error) {
        console.error(`Error during Shopify product search for ${reference}:`, error);
        errors.push({
          reference,
          error: `Shopify Search API Error: ${error.message}`,
          action: "search product"
        });
        continue;
      }
      const existingProduct = (_e = (_d = (_c = (_b = searchData.data) == null ? void 0 : _b.products) == null ? void 0 : _c.edges) == null ? void 0 : _d[0]) == null ? void 0 : _e.node;
      const shopifyProductData = {
        title: productData.title,
        descriptionHtml: productData.description ? `<p>${productData.description}</p>` : `<p>${productData.title}</p>`,
        vendor: "Imported Products",
        // Default vendor, can be mapped from data.
        handle,
        productType: "General",
        // Default product type, can be mapped from data.
        status: "ACTIVE",
        // Set product status to active.
        tags: [
          `ref-${productData.reference}`,
          // Custom tag for future identification.
          "search-import",
          "auto-sync"
        ]
      };
      let currentProductId = null;
      let currentVariantId = null;
      let currentInventoryItemId = null;
      if (existingProduct) {
        console.log("✅ Found existing product:", existingProduct.id);
        currentProductId = existingProduct.id;
        currentVariantId = (_i = (_h = (_g = (_f = existingProduct.variants) == null ? void 0 : _f.edges) == null ? void 0 : _g[0]) == null ? void 0 : _h.node) == null ? void 0 : _i.id;
        currentInventoryItemId = (_n = (_m = (_l = (_k = (_j = existingProduct.variants) == null ? void 0 : _j.edges) == null ? void 0 : _k[0]) == null ? void 0 : _l.node) == null ? void 0 : _m.inventoryItem) == null ? void 0 : _n.id;
        let updateData;
        try {
          const updateResponse = await admin.graphql(`
            mutation productUpdate($input: ProductInput!) {
              productUpdate(input: $input) {
                product {
                  id
                  title
                  handle
                  status
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        price
                        sku
                        inventoryQuantity
                        inventoryItem {
                          id
                          tracked
                        }
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `, {
            variables: {
              input: {
                id: existingProduct.id,
                title: shopifyProductData.title,
                descriptionHtml: shopifyProductData.descriptionHtml,
                vendor: shopifyProductData.vendor,
                productType: shopifyProductData.productType,
                status: shopifyProductData.status,
                tags: shopifyProductData.tags
              }
            }
          });
          updateData = await updateResponse.json();
          if (updateData.errors) {
            console.error(`DEBUG: GraphQL errors for productUpdate (reference: ${reference}):`, JSON.stringify(updateData.errors, null, 2));
            errors.push({
              reference,
              error: `GraphQL Product Update Error: ${updateData.errors.map((e) => e.message).join(", ")}`,
              action: "update product"
            });
            continue;
          }
          if (((_q = (_p = (_o = updateData.data) == null ? void 0 : _o.productUpdate) == null ? void 0 : _p.userErrors) == null ? void 0 : _q.length) > 0) {
            errors.push({
              reference,
              errors: updateData.data.productUpdate.userErrors,
              action: "update product"
            });
            continue;
          }
        } catch (error) {
          console.error(`Error during Shopify product update for ${reference}:`, error);
          errors.push({
            reference,
            error: `Shopify Product Update API Error: ${error.message}`,
            action: "update product"
          });
          continue;
        }
        if (currentVariantId) {
          try {
            console.log(`Attempting to update variant ${currentVariantId} for product ${reference} with price ${priceString} and SKU ${productData.reference}.`);
            const variantUpdateResponse = await admin.graphql(`
              mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                  productVariants {
                    id
                    price
                    sku
                    inventoryQuantity
                    inventoryItem {
                      id
                      tracked
                    }
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `, {
              variables: {
                productId: currentProductId,
                variants: [{
                  id: currentVariantId,
                  price: priceString,
                  inventoryItem: {
                    sku: productData.reference
                  }
                }]
              }
            });
            const variantUpdateData = await variantUpdateResponse.json();
            if (variantUpdateData.errors) {
              console.error(`DEBUG: GraphQL errors for productVariantsBulkUpdate (reference: ${reference}):`, JSON.stringify(variantUpdateData.errors, null, 2));
              errors.push({
                reference,
                error: `GraphQL Variant Update Error: ${variantUpdateData.errors.map((e) => e.message).join(", ")}`,
                action: "update variant"
              });
            }
            if (((_t = (_s = (_r = variantUpdateData.data) == null ? void 0 : _r.productVariantsBulkUpdate) == null ? void 0 : _s.userErrors) == null ? void 0 : _t.length) > 0) {
              errors.push({
                reference,
                errors: variantUpdateData.data.productVariantsBulkUpdate.userErrors,
                action: "update variant"
              });
            }
          } catch (variantError) {
            console.error(`Variant update error for ${reference}:`, variantError);
            errors.push({
              reference,
              error: `Variant update failed: ${variantError.message}`,
              action: "update variant"
            });
          }
        }
        if (currentInventoryItemId) {
          try {
            console.log(`Attempting to set inventory tracking for item ${currentInventoryItemId} to true.`);
            const inventoryItemUpdateResponse = await admin.graphql(`
              mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
                inventoryItemUpdate(id: $id, input: $input) {
                  inventoryItem {
                    id
                    tracked
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `, {
              variables: {
                id: currentInventoryItemId,
                input: {
                  tracked: true
                }
              }
            });
            const inventoryItemUpdateData = await inventoryItemUpdateResponse.json();
            if (inventoryItemUpdateData.errors) {
              console.error(`DEBUG: GraphQL errors for inventoryItemUpdate (reference: ${reference}):`, JSON.stringify(inventoryItemUpdateData.errors, null, 2));
              errors.push({
                reference,
                error: `GraphQL Inventory Item Update Error: ${inventoryItemUpdateData.errors.map((e) => e.message).join(", ")}`,
                action: "update inventory tracking"
              });
            }
            if (((_w = (_v = (_u = inventoryItemUpdateData.data) == null ? void 0 : _u.inventoryItemUpdate) == null ? void 0 : _v.userErrors) == null ? void 0 : _w.length) > 0) {
              errors.push({
                reference,
                errors: inventoryItemUpdateData.data.inventoryItemUpdate.userErrors,
                action: "update inventory tracking"
              });
            }
          } catch (inventoryItemError) {
            console.error(`Inventory item tracking update error for ${reference}:`, inventoryItemError);
            errors.push({
              reference,
              error: `Inventory item tracking update failed: ${inventoryItemError.message}`,
              action: "update inventory tracking"
            });
          }
        }
        if (currentInventoryItemId && productData.stock !== void 0 && productData.stock !== null) {
          try {
            const currentStock = ((_A = (_z = (_y = (_x = existingProduct.variants) == null ? void 0 : _x.edges) == null ? void 0 : _y[0]) == null ? void 0 : _z.node) == null ? void 0 : _A.inventoryQuantity) || 0;
            const newStock = parseInt(productData.stock) || 0;
            const delta = newStock - currentStock;
            if (delta !== 0) {
              console.log(`📦 Adjusting inventory: ${currentStock} → ${newStock} (delta: ${delta})`);
              const inventoryResponse = await admin.graphql(`
                mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                  inventoryAdjustQuantities(input: $input) {
                    inventoryAdjustmentGroup {
                      createdAt
                      reason
                      changes {
                        name
                        delta
                      }
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `, {
                variables: {
                  input: {
                    reason: "correction",
                    name: "available",
                    changes: [{
                      delta,
                      inventoryItemId: currentInventoryItemId,
                      locationId: SHOPIFY_LOCATION_ID$1
                    }]
                  }
                }
              });
              const inventoryData = await inventoryResponse.json();
              if (inventoryData.errors) {
                console.error(`DEBUG: GraphQL errors for inventoryAdjustQuantities (reference: ${reference}):`, JSON.stringify(inventoryData.errors, null, 2));
                errors.push({
                  reference,
                  error: `GraphQL Inventory Adjustment Error: ${inventoryData.errors.map((e) => e.message).join(", ")}`,
                  action: "update inventory"
                });
              }
              if (((_D = (_C = (_B = inventoryData.data) == null ? void 0 : _B.inventoryAdjustQuantities) == null ? void 0 : _C.userErrors) == null ? void 0 : _D.length) > 0) {
                errors.push({
                  reference,
                  errors: inventoryData.data.inventoryAdjustQuantities.userErrors,
                  action: "update inventory"
                });
              }
            }
          } catch (inventoryError) {
            console.error(`Inventory update error for ${reference}:`, inventoryError);
            errors.push({
              reference,
              error: `Inventory update failed: ${inventoryError.message}`,
              action: "update inventory"
            });
          }
        }
        updatedProducts.push({
          reference,
          product: updateData.data.productUpdate.product,
          action: "updated",
          price: priceString,
          stock: productData.stock
        });
      } else {
        console.log("➕ Creating new product");
        let createData;
        try {
          const createResponse = await admin.graphql(`
            mutation productCreate($input: ProductInput!) {
              productCreate(input: $input) {
                product {
                  id
                  title
                  handle
                  status
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        price
                        sku
                        inventoryQuantity
                        inventoryItem {
                          id
                        }
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `, {
            variables: {
              input: {
                title: shopifyProductData.title,
                descriptionHtml: shopifyProductData.descriptionHtml,
                vendor: shopifyProductData.vendor,
                productType: shopifyProductData.productType,
                status: shopifyProductData.status,
                tags: shopifyProductData.tags
              }
            }
          });
          createData = await createResponse.json();
          if (createData.errors) {
            console.error(`DEBUG: GraphQL errors for productCreate (reference: ${reference}):`, JSON.stringify(createData.errors, null, 2));
            errors.push({
              reference,
              error: `GraphQL Product Create Error: ${createData.errors.map((e) => e.message).join(", ")}`,
              action: "create product"
            });
            continue;
          }
          if (((_G = (_F = (_E = createData.data) == null ? void 0 : _E.productCreate) == null ? void 0 : _F.userErrors) == null ? void 0 : _G.length) > 0) {
            errors.push({
              reference,
              errors: createData.data.productCreate.userErrors,
              action: "create product"
            });
            continue;
          }
        } catch (error) {
          console.error(`Error during Shopify product creation for ${reference}:`, error);
          errors.push({
            reference,
            error: `Shopify Product Create API Error: ${error.message}`,
            action: "create product"
          });
          continue;
        }
        currentProductId = (_J = (_I = (_H = createData.data) == null ? void 0 : _H.productCreate) == null ? void 0 : _I.product) == null ? void 0 : _J.id;
        currentVariantId = (_Q = (_P = (_O = (_N = (_M = (_L = (_K = createData.data) == null ? void 0 : _K.productCreate) == null ? void 0 : _L.product) == null ? void 0 : _M.variants) == null ? void 0 : _N.edges) == null ? void 0 : _O[0]) == null ? void 0 : _P.node) == null ? void 0 : _Q.id;
        const newInventoryItemId = (_Y = (_X = (_W = (_V = (_U = (_T = (_S = (_R = createData.data) == null ? void 0 : _R.productCreate) == null ? void 0 : _S.product) == null ? void 0 : _T.variants) == null ? void 0 : _U.edges) == null ? void 0 : _V[0]) == null ? void 0 : _W.node) == null ? void 0 : _X.inventoryItem) == null ? void 0 : _Y.id;
        if (currentVariantId && newInventoryItemId) {
          try {
            console.log(`Attempting to update new product variant ${currentVariantId} for product ${reference} with price ${priceString}, SKU ${productData.reference}.`);
            const variantUpdateResponse = await admin.graphql(`
              mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                  productVariants {
                    id
                    price
                    sku
                    inventoryQuantity
                    inventoryItem {
                      id
                      tracked
                    }
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `, {
              variables: {
                productId: currentProductId,
                variants: [{
                  id: currentVariantId,
                  price: priceString,
                  inventoryItem: {
                    sku: productData.reference
                  }
                }]
              }
            });
            const variantUpdateData = await variantUpdateResponse.json();
            if (variantUpdateData.errors) {
              console.error(`DEBUG: GraphQL errors for productVariantsBulkUpdate (new product, reference: ${reference}):`, JSON.stringify(variantUpdateData.errors, null, 2));
              errors.push({
                reference,
                error: `GraphQL New Variant Update Error: ${variantUpdateData.errors.map((e) => e.message).join(", ")}`,
                action: "update new variant"
              });
            }
            if (((_$ = (__ = (_Z = variantUpdateData.data) == null ? void 0 : _Z.productVariantsBulkUpdate) == null ? void 0 : __.userErrors) == null ? void 0 : _$.length) > 0) {
              errors.push({
                reference,
                errors: variantUpdateData.data.productVariantsBulkUpdate.userErrors,
                action: "update new variant"
              });
            }
          } catch (variantError) {
            console.error(`New variant update error for ${reference}:`, variantError);
            errors.push({
              reference,
              error: `New variant update failed: ${variantError.message}`,
              action: "update new variant"
            });
          }
          try {
            console.log(`Attempting to set inventory tracking for new item ${newInventoryItemId} to true.`);
            const inventoryItemUpdateResponse = await admin.graphql(`
              mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
                inventoryItemUpdate(id: $id, input: $input) {
                  inventoryItem {
                    id
                    tracked
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `, {
              variables: {
                id: newInventoryItemId,
                input: {
                  tracked: true
                }
              }
            });
            const inventoryItemUpdateData = await inventoryItemUpdateResponse.json();
            if (inventoryItemUpdateData.errors) {
              console.error(`DEBUG: GraphQL errors for inventoryItemUpdate (new product, reference: ${reference}):`, JSON.stringify(inventoryItemUpdateData.errors, null, 2));
              errors.push({
                reference,
                error: `GraphQL New Product Inventory Item Update Error: ${inventoryItemUpdateData.errors.map((e) => e.message).join(", ")}`,
                action: "set new product inventory tracking"
              });
            }
            if (((_ca = (_ba = (_aa = inventoryItemUpdateData.data) == null ? void 0 : _aa.inventoryItemUpdate) == null ? void 0 : _ba.userErrors) == null ? void 0 : _ca.length) > 0) {
              errors.push({
                reference,
                errors: inventoryItemUpdateData.data.inventoryItemUpdate.userErrors,
                action: "set new product inventory tracking"
              });
            }
          } catch (inventoryItemError) {
            console.error(`New product inventory item tracking update error for ${reference}:`, inventoryItemError);
            errors.push({
              reference,
              error: `New product inventory item tracking update failed: ${inventoryItemError.message}`,
              action: "set new product inventory tracking"
            });
          }
          if (productData.stock !== void 0 && productData.stock !== null) {
            try {
              const newStock = parseInt(productData.stock) || 0;
              console.log(`📦 Setting initial inventory for new product: ${newStock}`);
              const inventoryResponse = await admin.graphql(`
                mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                  inventoryAdjustQuantities(input: $input) {
                    inventoryAdjustmentGroup {
                      createdAt
                      reason
                      changes {
                        name
                        delta
                      }
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `, {
                variables: {
                  input: {
                    reason: "correction",
                    name: "available",
                    changes: [{
                      delta: newStock,
                      inventoryItemId: newInventoryItemId,
                      locationId: SHOPIFY_LOCATION_ID$1
                    }]
                  }
                }
              });
              const inventoryData = await inventoryResponse.json();
              if (inventoryData.errors) {
                console.error(`DEBUG: GraphQL errors for inventoryAdjustQuantities (new product inventory, reference: ${reference}):`, JSON.stringify(inventoryData.errors, null, 2));
                errors.push({
                  reference,
                  error: `GraphQL New Product Inventory Adjustment Error: ${inventoryData.errors.map((e) => e.message).join(", ")}`,
                  action: "set new product inventory"
                });
              }
              if (((_fa = (_ea = (_da = inventoryData.data) == null ? void 0 : _da.inventoryAdjustQuantities) == null ? void 0 : _ea.userErrors) == null ? void 0 : _fa.length) > 0) {
                errors.push({
                  reference,
                  errors: inventoryData.data.inventoryAdjustQuantities.userErrors,
                  action: "set new product inventory"
                });
              }
            } catch (inventoryError) {
              console.error(`New product inventory update error for ${reference}:`, inventoryError);
              errors.push({
                reference,
                error: `New product inventory update failed: ${inventoryError.message}`,
                action: "set new product inventory"
              });
            }
          }
        } else {
          errors.push({
            reference,
            error: "Failed to retrieve default variant or inventory item ID for new product.",
            action: "post-creation variant setup"
          });
        }
        if (currentProductId) {
          createdProducts.push({
            reference,
            product: createData.data.productCreate.product,
            action: "created",
            price: priceString,
            stock: productData.stock
          });
        }
      }
      if (currentProductId && onlineStorePublicationId) {
        try {
          const publishResponse = await admin.graphql(`
            mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
              publishablePublish(id: $id, input: $input) {
                publishable {
                  availablePublicationsCount {
                    count
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `, {
            variables: {
              id: currentProductId,
              input: [{
                publicationId: onlineStorePublicationId,
                publishDate: (/* @__PURE__ */ new Date()).toISOString()
              }]
            }
          });
          const publishData = await publishResponse.json();
          if (publishData.errors) {
            console.error(`DEBUG: GraphQL errors for publishablePublish (reference: ${reference}):`, JSON.stringify(publishData.errors, null, 2));
            errors.push({
              reference,
              error: `GraphQL Publish Error: ${publishData.errors.map((e) => e.message).join(", ")}`,
              action: "publish product"
            });
          }
          if (((_ia = (_ha = (_ga = publishData.data) == null ? void 0 : _ga.publishablePublish) == null ? void 0 : _ha.userErrors) == null ? void 0 : _ia.length) > 0) {
            console.warn(`⚠️ Publish warning for ${reference}:`, publishData.data.publishablePublish.userErrors);
            errors.push({
              reference,
              errors: publishData.data.publishablePublish.userErrors,
              action: "publish product (user error)"
            });
          }
        } catch (publishError) {
          console.warn(`⚠️ Publish error for ${reference}:`, publishError);
          errors.push({
            reference,
            error: `Publish failed: ${publishError.message}`,
            action: "publish product"
          });
        }
      }
    } catch (error) {
      console.error(`Error processing product ${reference}:`, error);
      errors.push({
        reference,
        error: error.message,
        action: "overall processing"
      });
    }
  }
  return { createdProducts, updatedProducts, errors };
}
async function deleteShopifyProductsNotInJson(admin, jsonFoundProducts) {
  var _a2, _b, _c, _d, _e, _f, _g, _h;
  const deletedProducts = [];
  const deletionErrors = [];
  try {
    console.log("🔍 Searching Shopify for products to potentially delete...");
    let hasNextPage = true;
    let cursor = null;
    while (hasNextPage) {
      const shopifyProductsResponse = await admin.graphql(`
        query getShopifyProducts($after: String) {
          products(first: 50, query: "tag:ref-", after: $after) {
            edges {
              node {
                id
                title
                tags
              }
              cursor
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      `, {
        variables: {
          after: cursor
        }
      });
      const shopifyProductsData = await shopifyProductsResponse.json();
      if (shopifyProductsData.errors) {
        console.error(`DEBUG: GraphQL errors during Shopify product fetch for deletion:`, JSON.stringify(shopifyProductsData.errors, null, 2));
        deletionErrors.push({
          error: `GraphQL Fetch Error: ${shopifyProductsData.errors.map((e) => e.message).join(", ")}`,
          action: "fetch products for deletion"
        });
        break;
      }
      const products = ((_b = (_a2 = shopifyProductsData.data) == null ? void 0 : _a2.products) == null ? void 0 : _b.edges) || [];
      hasNextPage = ((_e = (_d = (_c = shopifyProductsData.data) == null ? void 0 : _c.products) == null ? void 0 : _d.pageInfo) == null ? void 0 : _e.hasNextPage) || false;
      cursor = products.length > 0 ? products[products.length - 1].cursor : null;
      for (const edge of products) {
        const product = edge.node;
        const refTag = product.tags.find((tag) => tag.startsWith("ref-"));
        const reference = refTag ? refTag.substring(4) : null;
        if (reference && !jsonFoundProducts[reference]) {
          console.log(`🗑️ Deleting Shopify product: ${product.title} (ID: ${product.id}, Reference: ${reference}) - Not found in local JSON.`);
          try {
            const deleteResponse = await admin.graphql(`
              mutation productDelete($id: ID!) {
                productDelete(input: { id: $id }) {
                  deletedProductId
                  userErrors {
                    field
                    message
                  }
                }
              }
            `, {
              variables: {
                id: product.id
              }
            });
            const deleteData = await deleteResponse.json();
            if (deleteData.errors) {
              console.error(`DEBUG: GraphQL errors during productDelete (ID: ${product.id}, Reference: ${reference}):`, JSON.stringify(deleteData.errors, null, 2));
              deletionErrors.push({
                reference,
                error: `GraphQL Deletion Error: ${deleteData.errors.map((e) => e.message).join(", ")}`,
                action: "delete product"
              });
            } else if (((_h = (_g = (_f = deleteData.data) == null ? void 0 : _f.productDelete) == null ? void 0 : _g.userErrors) == null ? void 0 : _h.length) > 0) {
              deletionErrors.push({
                reference,
                errors: deleteData.data.productDelete.userErrors,
                action: "delete product"
              });
            } else {
              deletedProducts.push({
                id: product.id,
                title: product.title,
                reference,
                action: "deleted"
              });
            }
          } catch (deleteError) {
            console.error(`Error deleting Shopify product ${product.id} (${reference}):`, deleteError);
            deletionErrors.push({
              reference,
              error: `Shopify Deletion API Error: ${deleteError.message}`,
              action: "delete product"
            });
          }
        }
      }
    }
    console.log(`🗑️ Deleted ${deletedProducts.length} products from Shopify.`);
  } catch (error) {
    console.error("Top-level error in deleteShopifyProductsNotInJson:", error);
    deletionErrors.push({
      error: error.message || "An unknown error occurred during deletion process.",
      action: "overall deletion process"
    });
  }
  return { deletedProducts, deletionErrors };
}
async function syncProductsWithShopify(admin) {
  var _a2, _b, _c;
  try {
    console.log("🔍 Reading file from:", SEARCH_RESULTS_FILE);
    let jsonData;
    try {
      const fileContent = await readFile(SEARCH_RESULTS_FILE, "utf8");
      jsonData = JSON.parse(fileContent);
      console.log("✅ Successfully loaded JSON data");
    } catch (fileError) {
      console.error("❌ File read error:", fileError);
      return {
        success: false,
        error: `Failed to read search results file: ${fileError.message}`,
        filePath: SEARCH_RESULTS_FILE
      };
    }
    if (!jsonData || !jsonData.found || Object.keys(jsonData.found).length === 0) {
      console.log("⚠️ No products found in JSON data to sync. Skipping product updates and deletions to preserve existing Shopify products.");
      return {
        success: true,
        // Consider this a success as it handled the empty file gracefully
        createdProducts: [],
        updatedProducts: [],
        deletedProducts: [],
        // No deletions performed in this scenario
        errors: [],
        sourceData: jsonData,
        message: "No products found in JSON data to sync. Existing Shopify products were not modified."
      };
    }
    console.log(`🚀 Starting to process ${Object.keys(jsonData.found).length} products...`);
    let onlineStorePublicationId = null;
    try {
      const publicationsResponse = await admin.graphql(`
        query getPublications {
          publications(first: 10) {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `);
      const publicationsData = await publicationsResponse.json();
      if (publicationsData.errors) {
        console.error(`DEBUG: GraphQL errors for getPublications:`, JSON.stringify(publicationsData.errors, null, 2));
      }
      const onlineStorePublication = (_c = (_b = (_a2 = publicationsData.data) == null ? void 0 : _a2.publications) == null ? void 0 : _b.edges) == null ? void 0 : _c.find(
        (edge) => edge.node.name === "Online Store"
      );
      if (onlineStorePublication) {
        onlineStorePublicationId = onlineStorePublication.node.id;
        console.log("✅ Found Online Store Publication ID:", onlineStorePublicationId);
      } else {
        console.warn("⚠️ Could not find Online Store publication");
      }
    } catch (pubError) {
      console.warn(`⚠️ Could not fetch publications:`, pubError);
    }
    const { createdProducts, updatedProducts, errors } = await processProductBatch(admin, jsonData.found, onlineStorePublicationId);
    const { deletedProducts, deletionErrors } = await deleteShopifyProductsNotInJson(admin, jsonData.found);
    const totalProcessed = createdProducts.length + updatedProducts.length;
    const allErrors = [...errors, ...deletionErrors];
    const hasErrors = allErrors.length > 0;
    return {
      success: totalProcessed > 0 || deletedProducts.length > 0 || allErrors.length === 0,
      createdProducts,
      updatedProducts,
      deletedProducts,
      errors: allErrors,
      sourceData: jsonData,
      message: `Successfully processed ${totalProcessed} products (${createdProducts.length} created, ${updatedProducts.length} updated). ${deletedProducts.length} products deleted from Shopify.${hasErrors ? ` Encountered ${allErrors.length} errors.` : ""}`
    };
  } catch (error) {
    console.error("Top-level error in syncProductsWithShopify:", error);
    return {
      success: false,
      error: error.message || "An unknown error occurred during processing.",
      stack: error.stack
    };
  }
}
async function runSearchScript() {
  try {
    console.log(`🔍 Attempting to read product data from ${SEARCH_RESULTS_FILE}.`);
    let jsonData = { found: {}, notFound: [], searchDate: (/* @__PURE__ */ new Date()).toISOString(), totalFound: 0, totalSearched: 0 };
    try {
      const fileContent = await readFile(SEARCH_RESULTS_FILE, "utf8");
      jsonData = JSON.parse(fileContent);
      console.log("✅ Successfully loaded local search_results.json data.");
    } catch (fileError) {
      console.log("No existing search_results.json found or error reading it, starting with empty structure (no products to sync from file):", fileError.message);
      jsonData = { found: {}, notFound: [], searchDate: (/* @__PURE__ */ new Date()).toISOString(), totalFound: 0, totalSearched: 0 };
    }
    if (typeof jsonData.found !== "object" || jsonData.found === null) {
      jsonData.found = {};
    }
    jsonData.totalFound = Object.keys(jsonData.found).length;
    jsonData.totalSearched = Object.keys(jsonData.found).length;
    jsonData.searchDate = (/* @__PURE__ */ new Date()).toISOString();
    return {
      success: true,
      searchResults: jsonData,
      message: `Successfully read ${jsonData.totalFound} product references from search_results.json.`
    };
  } catch (error) {
    console.error("Top-level error in runSearchScript:", error);
    return {
      success: false,
      error: error.message || "An unknown error occurred during search_results.json read.",
      stack: error.stack
    };
  }
}
async function executeProductUpdate() {
  console.log("Starting the product update process in products.js...");
  try {
    console.log("Reading product shortcuts (for informational purposes, not for Vendus API fetching in this script)...");
    const productReferences = await readShortcuts();
    if (productReferences.length === 0) {
      console.log("No product shortcuts found. This script will rely entirely on search_results.json for product data.");
    }
    console.log("Preparing product data from search_results.json for Shopify synchronization...");
    const searchResult = await runSearchScript();
    if (!searchResult.success) {
      console.error("Failed to prepare product data from search_results.json:", searchResult.error);
      return;
    }
    console.log("Product data preparation from search_results.json completed:", searchResult.message);
    const adminClient = shopifyAdmin;
    if (!adminClient) {
      console.error("Shopify Admin client is not available. Cannot sync products.");
      return;
    }
    console.log("Calling syncProductsWithShopify to update Shopify products...");
    const syncResult = await syncProductsWithShopify(adminClient);
    if (!syncResult.success) {
      console.error("Failed to sync products with Shopify:", syncResult.error);
    } else {
      console.log("Product synchronization with Shopify completed successfully.");
      console.log("Sync Results:", {
        created: syncResult.createdProducts.length,
        updated: syncResult.updatedProducts.length,
        deleted: syncResult.deletedProducts.length,
        errors: syncResult.errors.length
      });
    }
    console.log("Product update process finished successfully.");
  } catch (error) {
    console.error("Failed to run product update from products.js:", error);
  }
}
executeProductUpdate();
let monitorState = {
  isRunning: false,
  lastRun: null,
  nextRun: null,
  interval: 30 * 1e3,
  // 30 seconds
  timeoutId: null
  // To store the setTimeout ID for clearing
};
function getMonitorState() {
  const { timeoutId, ...serializableMonitorState } = monitorState;
  return { ...serializableMonitorState };
}
function startMonitor(callback) {
  if (monitorState.isRunning) {
    console.log("Monitor is already running.");
    return;
  }
  if (typeof callback !== "function") {
    console.error("Error: startMonitor received a non-function callback. Monitor cannot be started.", callback);
    return;
  }
  monitorState.isRunning = true;
  console.log(`Monitor started. Next run in ${monitorState.interval / 1e3} seconds.`);
  const scheduleNextRun = async () => {
    monitorState.lastRun = (/* @__PURE__ */ new Date()).toISOString();
    monitorState.nextRun = new Date(Date.now() + monitorState.interval).toISOString();
    console.log(`Executing scheduled task. Next run at: ${monitorState.nextRun}`);
    try {
      if (typeof callback === "function") {
        await callback();
      } else {
        console.error("Error: Scheduled callback is no longer a function:", callback);
        clearTimeout(monitorState.timeoutId);
        monitorState.isRunning = false;
        return;
      }
    } catch (error) {
      console.error("❌ Error executing monitor callback:", error);
    } finally {
      monitorState.timeoutId = setTimeout(scheduleNextRun, monitorState.interval);
    }
  };
  scheduleNextRun();
}
function stopMonitor() {
  if (!monitorState.isRunning) {
    console.log("Monitor is not running.");
    return;
  }
  clearTimeout(monitorState.timeoutId);
  monitorState.isRunning = false;
  monitorState.nextRun = null;
  monitorState.timeoutId = null;
  console.log("Monitor stopped.");
}
function toggleMonitor(callback) {
  if (monitorState.isRunning) {
    stopMonitor();
  } else {
    startMonitor(callback);
  }
  return monitorState.isRunning;
}
const SHOPIFY_LOCATION_ID = "gid://shopify/Location/102699630920";
async function loader({ request }) {
  await authenticate.admin(request);
  const monitorStatus = await getMonitorState();
  const vendusApiKeyStatus = await getVendusApi(authenticate.admin(request)) ? "PRESENT" : "MISSING";
  return json({
    monitorStatus,
    shopifyLocationId: SHOPIFY_LOCATION_ID.split("/").pop(),
    vendusApiKeyStatus
  });
}
async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const execAsync = promisify(exec);
  async function runPageReaderScript(apiKey, productShortcuts) {
    try {
      console.log("Running page_reader_products.js via child_process...");
      const scriptPath = path.join(process.cwd(), "app", "utils", "page_reader_products.js");
      const cmd = `node "${scriptPath}" --apiKey=${apiKey} --shortcuts=${JSON.stringify(productShortcuts)}`;
      console.log(`Executing command: ${cmd}`);
      const { stdout, stderr } = await execAsync(cmd);
      if (stdout) console.log("🟢 Output from page_reader_products.js:", stdout);
      if (stderr) console.error("🔴 Error from page_reader_products.js:", stderr);
    } catch (err) {
      console.error("❌ Failed to run page_reader_products.js:", err);
    }
  }
  if (intent === "toggleMonitor") {
    const monitorCallback = async () => {
      console.log("Monitor triggered: Running product sync...");
      const vendusApiKey = await getVendusApi();
      const productReferences = await readShortcuts();
      console.log("Monitor Callback: Vendus API Key status:", vendusApiKey ? "PRESENT" : "MISSING/EMPTY");
      if (vendusApiKey && productReferences.length > 0) {
        console.log("Monitor Callback: Running page_reader_products.js to fetch fresh Vendus data...");
        await runPageReaderScript(vendusApiKey, productReferences);
        console.log("Monitor Callback: Running runSearchScript to process Vendus data...");
        await runSearchScript();
      } else {
        console.log("Monitor Callback: Vendus API Key ou atalhos de produto ausentes. Pulando atualização de dados Vendus.");
      }
      const syncResult = await syncProductsWithShopify(admin);
      console.log("Monitor sync complete:", syncResult.message);
    };
    const newMonitorState = toggleMonitor(monitorCallback);
    const updatedMonitorStatus = await getMonitorState();
    return json({ success: true, newMonitorState, monitorStatus: updatedMonitorStatus });
  } else if (intent === "runInitialSync") {
    const vendusApiKey = await getVendusApi();
    const productReferences = await readShortcuts();
    if (vendusApiKey && productReferences.length > 0) {
      await runPageReaderScript(vendusApiKey, productReferences);
    } else {
      console.warn("Action: Chave da API Vendus ou atalhos de produto ausentes. Pulando busca inicial de dados.");
    }
    let syncResult = { success: false, message: "No sync performed or Vendus API key missing.", createdProducts: [], updatedProducts: [], errors: [], sourceData: null };
    if (vendusApiKey) {
      try {
        if (productReferences.length > 0) {
          console.log("Action: Running runSearchScript to refresh Vendus data...");
          await runSearchScript(productReferences, vendusApiKey);
        } else {
          console.log("Action: No product shortcuts found. Skipping Vendus data refresh.");
        }
        syncResult = await syncProductsWithShopify(admin);
      } catch (error) {
        console.error("Error during initial sync process:", error);
        syncResult.message = `Error during initial sync process: ${error.message}`;
        syncResult.error = error.message;
      }
    } else {
      console.warn("Action: Chave da API Vendus não disponível. Não é possível atualizar dados do Vendus ou sincronizar produtos.");
      syncResult.message = "Chave da API Vendus não disponível. Não é possível atualizar dados do Vendus ou sincronizar produtos.";
      syncResult.error = "Chave da API Vendus não disponível.";
    }
    return json(syncResult);
  }
  return json({ success: false, message: "Intenção de ação inválida." }, { status: 400 });
}
function CreateFromJson() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const [isMonitorRunning, setIsMonitorRunning] = useState(loaderData.monitorStatus.isRunning);
  const [lastMonitorRun, setLastMonitorRun] = useState(loaderData.monitorStatus.lastRun);
  const [nextMonitorRun, setNextMonitorRun] = useState(loaderData.monitorStatus.nextRun);
  const [initialSyncResults, setInitialSyncResults] = useState(null);
  const [initialSyncError, setInitialSyncError] = useState(null);
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.monitorStatus) {
        setIsMonitorRunning(fetcher.data.monitorStatus.isRunning);
        setLastMonitorRun(fetcher.data.monitorStatus.lastRun);
        setNextMonitorRun(fetcher.data.monitorStatus.nextRun);
      } else {
        if (fetcher.data.success !== void 0) {
          setInitialSyncResults(fetcher.data);
          setInitialSyncError(null);
        } else if (fetcher.data.error) {
          setInitialSyncError(fetcher.data.error);
          setInitialSyncResults(null);
        }
      }
    }
  }, [fetcher.data]);
  const handleToggleMonitor = () => {
    fetcher.submit({ intent: "toggleMonitor" }, { method: "post" });
  };
  const handleRunInitialSync = () => {
    setInitialSyncResults(null);
    setInitialSyncError(null);
    fetcher.submit({ intent: "runInitialSync" }, { method: "post" });
  };
  return /* @__PURE__ */ jsxs("div", { style: { padding: "20px", fontFamily: "Inter", maxWidth: "1200px", margin: "0 auto", borderRadius: "8px" }, children: [
    /* @__PURE__ */ jsx("h1", { style: { textAlign: "center", color: "#121212ff", marginBottom: "20px" }, children: "Sincronização de Produtos Shopify" }),
    /* @__PURE__ */ jsx("p", { style: { textAlign: "center", color: "#555", marginBottom: "30px" }, children: "Esta página processa os dados de produtos do arquivo JSON de resultados de pesquisa e os sincroniza com o Shopify." }),
    /* @__PURE__ */ jsxs("div", { style: {
      marginBottom: "30px",
      padding: "20px",
      backgroundColor: "#f0f8ff",
      borderRadius: "10px",
      border: "1px solid #cce5ff",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      textAlign: "center"
    }, children: [
      /* @__PURE__ */ jsx("h3", { style: { color: "#0056b3", marginBottom: "20px" }, children: "⏱️ Monitor de Sincronização Automática" }),
      /* @__PURE__ */ jsxs("p", { style: { fontSize: "1.1em", marginBottom: "15px", color: "#333" }, children: [
        "Status: ",
        /* @__PURE__ */ jsx("span", { style: { fontWeight: "bold", color: isMonitorRunning ? "#28a745" : "#dc3545" }, children: isMonitorRunning ? "EM EXECUÇÃO" : "PARADO" })
      ] }),
      lastMonitorRun && /* @__PURE__ */ jsxs("p", { style: { fontSize: "0.9em", color: "#666", marginBottom: "10px" }, children: [
        "Última execução: ",
        new Date(lastMonitorRun).toLocaleString()
      ] }),
      nextMonitorRun && isMonitorRunning && /* @__PURE__ */ jsxs("p", { style: { fontSize: "0.9em", color: "#666", marginBottom: "20px" }, children: [
        "Próxima execução: ",
        new Date(nextMonitorRun).toLocaleString()
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleToggleMonitor,
          style: {
            padding: "12px 25px",
            backgroundColor: isMonitorRunning ? "#dc3545" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            transition: "background-color 0.3s ease, transform 0.2s ease"
          },
          onMouseOver: (e) => e.currentTarget.style.backgroundColor = isMonitorRunning ? "#c82333" : "#0056b3",
          onMouseOut: (e) => e.currentTarget.style.backgroundColor = isMonitorRunning ? "#dc3545" : "#007bff",
          onMouseDown: (e) => e.currentTarget.style.transform = "translateY(1px)",
          onMouseUp: (e) => e.currentTarget.style.transform = "translateY(0)",
          disabled: fetcher.state === "submitting",
          children: fetcher.state === "submitting" ? "Atualizando..." : isMonitorRunning ? "Parar Monitoramento" : "Iniciar Monitoramento"
        }
      )
    ] }),
    initialSyncResults && initialSyncResults.success ? /* @__PURE__ */ jsxs("div", { style: {
      padding: "20px",
      backgroundColor: "#d4edda",
      color: "#155724",
      borderRadius: "8px",
      border: "1px solid #c3e6cb",
      marginBottom: "20px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
    }, children: [
      /* @__PURE__ */ jsx("h2", { style: { textAlign: "center", color: "#155724", marginBottom: "15px" }, children: "✅ Processamento Inicial Concluído!" }),
      /* @__PURE__ */ jsx("p", { style: { marginBottom: "25px", textAlign: "center" }, children: initialSyncResults.message }),
      initialSyncResults.createdProducts.length > 0 && /* @__PURE__ */ jsxs("div", { style: { marginBottom: "30px" }, children: [
        /* @__PURE__ */ jsxs("h3", { style: { color: "#28a745", marginBottom: "20px", borderBottom: "1px solid #c3e6cb", paddingBottom: "10px" }, children: [
          "🆕 Produtos Criados (",
          initialSyncResults.createdProducts.length,
          ")"
        ] }),
        /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }, children: initialSyncResults.createdProducts.map((item, index2) => /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "2px solid #28a745",
              boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
            },
            children: [
              /* @__PURE__ */ jsx("h4", { style: { margin: "0 0 10px 0", color: "#495057", fontSize: "1.1em" }, children: item.product.title }),
              /* @__PURE__ */ jsxs("div", { style: { fontSize: "14px", lineHeight: "1.6", color: "#666" }, children: [
                /* @__PURE__ */ jsxs("p", { style: { margin: "5px 0" }, children: [
                  /* @__PURE__ */ jsx("strong", { children: "SKU:" }),
                  " ",
                  item.reference
                ] }),
                /* @__PURE__ */ jsxs("p", { style: { margin: "5px 0" }, children: [
                  /* @__PURE__ */ jsx("strong", { children: "Preço:" }),
                  " €",
                  item.price
                ] }),
                /* @__PURE__ */ jsxs("p", { style: { margin: "5px 0" }, children: [
                  /* @__PURE__ */ jsx("strong", { children: "Estoque:" }),
                  " ",
                  item.stock !== void 0 ? `${item.stock} unidades` : "N/D"
                ] }),
                /* @__PURE__ */ jsxs("p", { style: { margin: "5px 0" }, children: [
                  /* @__PURE__ */ jsx("strong", { children: "Identificador:" }),
                  " ",
                  item.product.handle
                ] }),
                /* @__PURE__ */ jsxs("p", { style: { margin: "5px 0" }, children: [
                  /* @__PURE__ */ jsx("strong", { children: "Rastreamento:" }),
                  " ",
                  /* @__PURE__ */ jsx("span", { style: { color: "#28a745", fontWeight: "bold" }, children: "✅ Ativado" })
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "span",
                {
                  style: {
                    backgroundColor: "#28a745",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "5px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    marginTop: "15px",
                    display: "inline-block"
                  },
                  children: "CRIADO"
                }
              )
            ]
          },
          index2
        )) })
      ] }),
      initialSyncResults.updatedProducts.length > 0 && /* @__PURE__ */ jsxs("div", { style: { marginBottom: "30px" }, children: [
        /* @__PURE__ */ jsxs("h3", { style: { color: "#007bff", marginBottom: "20px", borderBottom: "1px solid #cce5ff", paddingBottom: "10px" }, children: [
          "🔄 Produtos Atualizados (",
          initialSyncResults.updatedProducts.length,
          ")"
        ] }),
        /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }, children: initialSyncResults.updatedProducts.map((item, index2) => /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "2px solid #007bff",
              boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
            },
            children: [
              /* @__PURE__ */ jsx("h4", { style: { margin: "0 0 10px 0", color: "#495057", fontSize: "1.1em" }, children: item.product.title }),
              /* @__PURE__ */ jsxs("div", { style: { fontSize: "14px", lineHeight: "1.6", color: "#666" }, children: [
                /* @__PURE__ */ jsxs("p", { style: { margin: "5px 0" }, children: [
                  /* @__PURE__ */ jsx("strong", { children: "SKU:" }),
                  " ",
                  item.reference
                ] }),
                /* @__PURE__ */ jsxs("p", { style: { margin: "5px 0" }, children: [
                  /* @__PURE__ */ jsx("strong", { children: "Preço:" }),
                  " €",
                  item.price
                ] }),
                /* @__PURE__ */ jsxs("p", { style: { margin: "5px 0" }, children: [
                  /* @__PURE__ */ jsx("strong", { children: "Estoque:" }),
                  " ",
                  item.stock !== void 0 ? `${item.stock} unidades` : "N/D"
                ] }),
                /* @__PURE__ */ jsxs("p", { style: { margin: "5px 0" }, children: [
                  /* @__PURE__ */ jsx("strong", { children: "Identificador:" }),
                  " ",
                  item.product.handle
                ] }),
                /* @__PURE__ */ jsxs("p", { style: { margin: "5px 0" }, children: [
                  /* @__PURE__ */ jsx("strong", { children: "Rastreamento:" }),
                  " ",
                  /* @__PURE__ */ jsx("span", { style: { color: "#28a745", fontWeight: "bold" }, children: "✅ Ativado" })
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "span",
                {
                  style: {
                    backgroundColor: "#007bff",
                    color: "white",
                    padding: "6px 12px",
                    borderRadius: "5px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    marginTop: "15px",
                    display: "inline-block"
                  },
                  children: "ATUALIZADO"
                }
              )
            ]
          },
          index2
        )) })
      ] })
    ] }) : initialSyncError ? /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          padding: "20px",
          backgroundColor: "#f8d7da",
          color: "#721c24",
          borderRadius: "8px",
          border: "1px solid #f5c6cb",
          marginBottom: "20px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        },
        children: [
          /* @__PURE__ */ jsx("h2", { style: { textAlign: "center", color: "#721c24", marginBottom: "15px" }, children: "❌ Erro" }),
          /* @__PURE__ */ jsx("p", { style: { textAlign: "center", marginBottom: "10px" }, children: initialSyncError })
        ]
      }
    ) : null,
    initialSyncResults && initialSyncResults.errors && initialSyncResults.errors.length > 0 && /* @__PURE__ */ jsxs("div", { style: {
      padding: "20px",
      backgroundColor: "#fff3cd",
      color: "#856404",
      borderRadius: "8px",
      border: "1px solid #ffeeba",
      marginBottom: "20px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
    }, children: [
      /* @__PURE__ */ jsxs("h3", { style: { color: "#856404", marginBottom: "20px", borderBottom: "1px solid #ffeeba", paddingBottom: "10px" }, children: [
        "⚠️ Errors (",
        initialSyncResults.errors.length,
        ")"
      ] }),
      /* @__PURE__ */ jsx("div", { style: { maxHeight: "300px", overflowY: "auto", border: "1px solid #ffeeba", borderRadius: "5px", padding: "10px", backgroundColor: "#fff" }, children: initialSyncResults.errors.map((error, i) => /* @__PURE__ */ jsxs("div", { style: {
        margin: "10px 0",
        padding: "15px",
        backgroundColor: "#f8d7da",
        borderRadius: "5px",
        border: "1px solid #dc3545",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
      }, children: [
        /* @__PURE__ */ jsxs("strong", { style: { color: "#dc3545" }, children: [
          "Reference: ",
          error.reference
        ] }),
        " (",
        error.action,
        ")",
        /* @__PURE__ */ jsx("br", {}),
        /* @__PURE__ */ jsx("span", { style: { fontSize: "14px", color: "#721c24" }, children: error.error || error.errors && error.errors.map((e) => `${e.field}: ${e.message}`).join(", ") })
      ] }, i)) })
    ] }),
    initialSyncResults && initialSyncResults.sourceData && /* @__PURE__ */ jsxs("div", { style: {
      padding: "20px",
      backgroundColor: "#e7f3ff",
      borderRadius: "8px",
      border: "1px solid #b8daff",
      marginBottom: "20px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
    }, children: [
      /* @__PURE__ */ jsx("h3", { style: { color: "#0056b3", marginBottom: "20px", borderBottom: "1px solid #b8daff", paddingBottom: "10px" }, children: "📊 Resumo dos Dados de Origem" }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "15px",
            fontSize: "14px",
            color: "#555"
          },
          children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("strong", { children: "Data da Pesquisa:" }),
              /* @__PURE__ */ jsx("br", {}),
              new Date(initialSyncResults.sourceData.searchDate).toLocaleString()
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("strong", { children: "Total Encontrado:" }),
              /* @__PURE__ */ jsx("br", {}),
              initialSyncResults.sourceData.totalFound,
              " produtos"
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("strong", { children: "Total Pesquisado:" }),
              /* @__PURE__ */ jsx("br", {}),
              initialSyncResults.sourceData.totalSearched,
              " produtos"
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("strong", { children: "Status do Arquivo:" }),
              /* @__PURE__ */ jsx("br", {}),
              "✅ Carregado com sucesso"
            ] })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { style: { textAlign: "center", marginTop: "40px" }, children: /* @__PURE__ */ jsx(
      "button",
      {
        onClick: handleRunInitialSync,
        style: {
          padding: "15px 30px",
          backgroundColor: "#007cba",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "17px",
          fontWeight: "bold",
          boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
          transition: "background-color 0.3s ease, transform 0.2s ease"
        },
        onMouseOver: (e) => e.currentTarget.style.backgroundColor = "#005f8a",
        onMouseOut: (e) => e.currentTarget.style.backgroundColor = "#007cba",
        onMouseDown: (e) => e.currentTarget.style.transform = "translateY(1px)",
        onMouseUp: (e) => e.currentTarget.style.transform = "translateY(0)",
        disabled: fetcher.state === "submitting",
        children: fetcher.state === "submitting" ? "Processando..." : "🔄 Atualizar e Processar Dados"
      }
    ) })
  ] });
}
const route15 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: CreateFromJson,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-B0rf7Kan.js", "imports": ["/assets/components-D-S9gEDp.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/root-CRTPU9Wd.js", "imports": ["/assets/components-D-S9gEDp.js"], "css": [] }, "routes/webhooks.app.scopes_update": { "id": "routes/webhooks.app.scopes_update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.scopes_update-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/api.products.create": { "id": "routes/api.products.create", "parentId": "root", "path": "api/products/create", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/api.products.create-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/api.update-products": { "id": "routes/api.update-products", "parentId": "root", "path": "api/update-products", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/api.update-products-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/products.create": { "id": "routes/products.create", "parentId": "root", "path": "products/create", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/products.create-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/updateProducts": { "id": "routes/updateProducts", "parentId": "root", "path": "updateProducts", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/updateProducts-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/route-ubGS-J3m.js", "imports": ["/assets/components-D-S9gEDp.js", "/assets/styles-QqHsGSa_.js", "/assets/Page-C42oK9KW.js", "/assets/context-Cy620pk6.js", "/assets/context-DYfeObr0.js"], "css": [] }, "routes/settings": { "id": "routes/settings", "parentId": "root", "path": "settings", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/settings-B72DksfV.js", "imports": ["/assets/components-D-S9gEDp.js", "/assets/context-Cy620pk6.js", "/assets/Page-C42oK9KW.js", "/assets/TitleBar-ZDyuXEAA.js", "/assets/Banner-BujC4gWy.js"], "css": [] }, "routes/_auth.$": { "id": "routes/_auth.$", "parentId": "root", "path": "*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/_auth._-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/route-D3jMtOni.js", "imports": ["/assets/components-D-S9gEDp.js"], "css": ["/assets/route-D-OqEJJe.css"] }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": true, "module": "/assets/app-C9gh2JyA.js", "imports": ["/assets/components-D-S9gEDp.js", "/assets/styles-QqHsGSa_.js", "/assets/context-Cy620pk6.js", "/assets/context-DYfeObr0.js"], "css": [] }, "routes/app.products": { "id": "routes/app.products", "parentId": "routes/app", "path": "products", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.products-xYapFxSf.js", "imports": ["/assets/components-D-S9gEDp.js", "/assets/Page-C42oK9KW.js", "/assets/TitleBar-ZDyuXEAA.js", "/assets/Banner-BujC4gWy.js", "/assets/context-Cy620pk6.js", "/assets/context-DYfeObr0.js"], "css": [] }, "routes/app.settings": { "id": "routes/app.settings", "parentId": "routes/app", "path": "settings", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.settings-Dn7HGv0f.js", "imports": ["/assets/components-D-S9gEDp.js", "/assets/context-Cy620pk6.js", "/assets/Page-C42oK9KW.js", "/assets/TitleBar-ZDyuXEAA.js", "/assets/Banner-BujC4gWy.js"], "css": [] }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app._index-CC26yesx.js", "imports": ["/assets/components-D-S9gEDp.js", "/assets/Page-C42oK9KW.js", "/assets/TitleBar-ZDyuXEAA.js", "/assets/context-Cy620pk6.js"], "css": ["/assets/app-B85QSWS3.css"] }, "routes/app.search": { "id": "routes/app.search", "parentId": "routes/app", "path": "search", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.search-CQS7P_Q2.js", "imports": ["/assets/components-D-S9gEDp.js"], "css": [] } }, "url": "/assets/manifest-14277e69.js", "version": "14277e69" };
const mode = "production";
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "v3_fetcherPersist": true, "v3_relativeSplatPath": true, "v3_throwAbortReason": true, "v3_routeConfig": true, "v3_singleFetch": false, "v3_lazyRouteDiscovery": true, "unstable_optimizeDeps": false };
const isSpaMode = false;
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/webhooks.app.scopes_update": {
    id: "routes/webhooks.app.scopes_update",
    parentId: "root",
    path: "webhooks/app/scopes_update",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/webhooks.app.uninstalled": {
    id: "routes/webhooks.app.uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/api.products.create": {
    id: "routes/api.products.create",
    parentId: "root",
    path: "api/products/create",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/api.update-products": {
    id: "routes/api.update-products",
    parentId: "root",
    path: "api/update-products",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/products.create": {
    id: "routes/products.create",
    parentId: "root",
    path: "products/create",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/updateProducts": {
    id: "routes/updateProducts",
    parentId: "root",
    path: "updateProducts",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/settings": {
    id: "routes/settings",
    parentId: "root",
    path: "settings",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/_auth.$": {
    id: "routes/_auth.$",
    parentId: "root",
    path: "*",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route10
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/app.products": {
    id: "routes/app.products",
    parentId: "routes/app",
    path: "products",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  },
  "routes/app.settings": {
    id: "routes/app.settings",
    parentId: "routes/app",
    path: "settings",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route14
  },
  "routes/app.search": {
    id: "routes/app.search",
    parentId: "routes/app",
    path: "search",
    index: void 0,
    caseSensitive: void 0,
    module: route15
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  mode,
  publicPath,
  routes
};
