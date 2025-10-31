"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
exports.getVendusApi = getVendusApi;

require("dotenv/config");

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// If you have other settings you want to manage through the UI and persist,
// you would need a database for 'settingsStore'. For the API key,
// process.env is the correct source.
// For now, we'll keep a minimal settingsStore if getSettings/updateSettings are still called by app.settings.jsx
var settingsStore = {
  lastUpdated: null // This can still be updated by the UI

};

function getSettings() {
  // Return the in-memory settings, but ensure vendusApi always comes from process.env
  return _objectSpread({}, settingsStore, {
    vendusApi: process.env.VENDUS_API_KEY || "" // This is the crucial change

  });
}

function updateSettings(newSettings) {
  // This function will update the 'settingsStore' with general settings.
  // It's CRUCIAL that it does NOT try to update the 'vendusApi' property,
  // as the API key should only be set via environment variables.
  if ('vendusApi' in newSettings) {
    console.warn("Attempted to update Vendus API key via updateSettings. It should be set via environment variable (VENDUS_API_KEY). Ignoring this update for 'vendusApi'."); // Destructure to exclude vendusApi from being saved to the in-memory store

    var vendusApi = newSettings.vendusApi,
        restOfSettings = _objectWithoutProperties(newSettings, ["vendusApi"]);

    settingsStore = _objectSpread({}, settingsStore, {}, restOfSettings);
  } else {
    // If 'vendusApi' is not in newSettings, update as normal.
    settingsStore = _objectSpread({}, settingsStore, {}, newSettings);
  }

  return settingsStore;
}

function getVendusApi() {
  // This function is dedicated to providing the Vendus API key directly from environment variables.
  var apiKey = process.env.VENDUS_API_KEY;

  if (!apiKey) {
    console.warn("⚠️ VENDUS_API_KEY environment variable is not set. Vendus API calls may fail.");
  }

  return apiKey;
}
//# sourceMappingURL=settings.server.dev.js.map
