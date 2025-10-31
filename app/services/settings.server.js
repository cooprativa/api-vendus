// app/services/settings.server.js

// This line ensures your .env variables are loaded at application startup.
// Make sure you have a .env file in your project root with VENDUS_API_KEY=YOUR_KEY
import 'dotenv/config';

// If you have other settings you want to manage through the UI and persist,
// you would need a database for 'settingsStore'. For the API key,
// process.env is the correct source.
// For now, we'll keep a minimal settingsStore if getSettings/updateSettings are still called by app.settings.jsx
let settingsStore = {
  lastUpdated: null // This can still be updated by the UI
};

export function getSettings() {
  // Return the in-memory settings, but ensure vendusApi always comes from process.env
  return {
    ...settingsStore,
    vendusApi: process.env.VENDUS_API_KEY || "" // This is the crucial change
  };
}

export function updateSettings(newSettings) {
  // This function will update the 'settingsStore' with general settings.
  // It's CRUCIAL that it does NOT try to update the 'vendusApi' property,
  // as the API key should only be set via environment variables.
  if ('vendusApi' in newSettings) {
    console.warn("Attempted to update Vendus API key via updateSettings. It should be set via environment variable (VENDUS_API_KEY). Ignoring this update for 'vendusApi'.");
    // Destructure to exclude vendusApi from being saved to the in-memory store
    const { vendusApi, ...restOfSettings } = newSettings;
    settingsStore = { ...settingsStore, ...restOfSettings };
  } else {
    // If 'vendusApi' is not in newSettings, update as normal.
    settingsStore = { ...settingsStore, ...newSettings };
  }
  return settingsStore;
}

export function getVendusApi() {
  // This function is dedicated to providing the Vendus API key directly from environment variables.
  const apiKey = process.env.VENDUS_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ VENDUS_API_KEY environment variable is not set. Vendus API calls may fail.");
  }
  return apiKey;
}
