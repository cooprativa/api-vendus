
// app/constants/monitor.js
import path from "path";

// File paths
export const DATA_DIR = path.join(process.cwd(), "app", "data");
export const SHORTCUTS_FILE = path.join(DATA_DIR, "shortcuts.json");
export const SEARCH_RESULTS_FILE = path.join(DATA_DIR, "search_results.json");
export const MONITOR_STATE_FILE = path.join(DATA_DIR, "monitor_state.json");
export const SYNC_LOG_FILE = path.join(DATA_DIR, "sync_log.json");

// Timing constants
export const SYNC_INTERVAL_MS = 30000; // 30 seconds

// Log management
export const MAX_LOG_ENTRIES = 100;
export const DISPLAY_LOG_ENTRIES = 20;
