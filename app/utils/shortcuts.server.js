// app/utils/shortcuts.server.js

// The product references (shortcuts) are saved in an app-owned metafield on the shop.
// They used to live only in app/data/shortcuts.json, but Render's disk is wiped on every
// restart/deploy, so references added in the app kept disappearing.
// The JSON file is still written as a local copy, and read once to migrate old lists.

import path from "path";
import { promises as fs } from "fs";

const DATA_DIR = path.join(process.cwd(), "app", "data");
const SHORTCUTS_FILE = path.join(DATA_DIR, "shortcuts.json");

const METAFIELD_NAMESPACE = "$app:vendus";
const METAFIELD_KEY = "references";

async function readShortcutsFile() {
  try {
    const shortcuts = JSON.parse(await fs.readFile(SHORTCUTS_FILE, "utf-8"));
    return Array.isArray(shortcuts) ? shortcuts : [];
  } catch (error) {
    return [];
  }
}

async function writeShortcutsFile(shortcuts) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(SHORTCUTS_FILE, JSON.stringify(shortcuts, null, 2));
  } catch (error) {
    console.warn("Could not write local shortcuts copy:", error.message);
  }
}

/**
 * Reads the saved product references from the shop metafield.
 * If the metafield was never set, migrates the list from the local JSON file.
 * @param {Object} admin - The Shopify Admin API client.
 * @returns {Promise<string[]>} The saved references.
 */
export async function readShortcuts(admin) {
  const response = await admin.graphql(`
    query getShortcuts {
      shop {
        metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
          value
        }
      }
    }
  `);
  const data = await response.json();
  if (data.errors) {
    throw new Error(`Failed to read saved references: ${data.errors.map(e => e.message).join(", ")}`);
  }

  const value = data.data?.shop?.metafield?.value;
  if (value) {
    const shortcuts = JSON.parse(value);
    return Array.isArray(shortcuts) ? shortcuts : [];
  }

  // First run after this change: migrate whatever is in the local file.
  const fileShortcuts = await readShortcutsFile();
  if (fileShortcuts.length > 0) {
    console.log(`Migrating ${fileShortcuts.length} references from shortcuts.json to the shop metafield.`);
    await writeShortcuts(admin, fileShortcuts);
  }
  return fileShortcuts;
}

/**
 * Saves the product references to the shop metafield (and the local JSON copy).
 * @param {Object} admin - The Shopify Admin API client.
 * @param {string[]} shortcuts - The references to save.
 */
export async function writeShortcuts(admin, shortcuts) {
  const shortcutsArray = Array.isArray(shortcuts) ? shortcuts : [];

  const shopResponse = await admin.graphql(`query { shop { id } }`);
  const shopId = (await shopResponse.json()).data?.shop?.id;
  if (!shopId) {
    throw new Error("Could not read the shop ID to save references.");
  }

  const response = await admin.graphql(`
    mutation saveShortcuts($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      metafields: [{
        ownerId: shopId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEY,
        type: "json",
        value: JSON.stringify(shortcutsArray),
      }],
    },
  });
  const data = await response.json();
  const userErrors = data.data?.metafieldsSet?.userErrors || [];
  if (data.errors || userErrors.length > 0) {
    const messages = [...(data.errors || []), ...userErrors].map(e => e.message).join(", ");
    throw new Error(`Failed to save references: ${messages}`);
  }

  await writeShortcutsFile(shortcutsArray);
  console.log("Saved references:", shortcutsArray);
}
