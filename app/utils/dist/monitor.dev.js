"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getMonitorState = getMonitorState;
exports.startMonitor = startMonitor;
exports.stopMonitor = stopMonitor;
exports.toggleMonitor = toggleMonitor;

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

// app/utils/monitor.js
// In a real application, this state would be persisted in a database (e.g., Firestore)
// or a file to maintain state across server restarts or multiple instances.
// For this example, it's an in-memory object, meaning it will reset if the server restarts.
var monitorState = {
  isRunning: false,
  lastRun: null,
  nextRun: null,
  interval: 30 * 1000,
  // 30 seconds
  timeoutId: null // To store the setTimeout ID for clearing

};
/**
 * Retrieves the current state of the monitor.
 * Excludes the non-serializable `timeoutId` property.
 * @returns {Object} The current monitor state.
 */

function getMonitorState() {
  // Return a copy of monitorState, explicitly omitting the timeoutId
  var timeoutId = monitorState.timeoutId,
      serializableMonitorState = _objectWithoutProperties(monitorState, ["timeoutId"]);

  return _objectSpread({}, serializableMonitorState);
}
/**
 * Starts the monitor timer.
 * @param {Function} callback - The function to execute when the timer fires.
 */


function startMonitor(callback) {
  if (monitorState.isRunning) {
    console.log("Monitor is already running.");
    return;
  } // Add a type check to ensure callback is a function


  if (typeof callback !== 'function') {
    console.error("Error: startMonitor received a non-function callback. Monitor cannot be started.", callback);
    return;
  }

  monitorState.isRunning = true;
  console.log("Monitor started. Next run in ".concat(monitorState.interval / 1000, " seconds.")); // Make scheduleNextRun async to properly await the callback

  var scheduleNextRun = function scheduleNextRun() {
    return regeneratorRuntime.async(function scheduleNextRun$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            monitorState.lastRun = new Date().toISOString();
            monitorState.nextRun = new Date(Date.now() + monitorState.interval).toISOString();
            console.log("Executing scheduled task. Next run at: ".concat(monitorState.nextRun));
            _context.prev = 3;

            if (!(typeof callback === 'function')) {
              _context.next = 9;
              break;
            }

            _context.next = 7;
            return regeneratorRuntime.awrap(callback());

          case 7:
            _context.next = 13;
            break;

          case 9:
            console.error("Error: Scheduled callback is no longer a function:", callback); // If callback somehow becomes invalid, stop scheduling further runs

            clearTimeout(monitorState.timeoutId);
            monitorState.isRunning = false;
            return _context.abrupt("return");

          case 13:
            _context.next = 18;
            break;

          case 15:
            _context.prev = 15;
            _context.t0 = _context["catch"](3);
            console.error("❌ Error executing monitor callback:", _context.t0);

          case 18:
            _context.prev = 18;
            // Reschedule the next run, even if the current callback failed
            monitorState.timeoutId = setTimeout(scheduleNextRun, monitorState.interval);
            return _context.finish(18);

          case 21:
          case "end":
            return _context.stop();
        }
      }
    }, null, null, [[3, 15, 18, 21]]);
  }; // Initial immediate run, then schedule subsequent runs


  scheduleNextRun();
}
/**
 * Stops the monitor timer.
 */


function stopMonitor() {
  if (!monitorState.isRunning) {
    console.log("Monitor is not running.");
    return;
  }

  clearTimeout(monitorState.timeoutId);
  monitorState.isRunning = false;
  monitorState.nextRun = null;
  monitorState.timeoutId = null; // Clear the timeoutId when stopped

  console.log("Monitor stopped.");
}
/**
 * Toggles the monitor state (starts if stopped, stops if running).
 * @param {Function} callback - The function to execute when the timer fires (only relevant if starting).
 * @returns {boolean} The new state of isRunning.
 */


function toggleMonitor(callback) {
  if (monitorState.isRunning) {
    stopMonitor();
  } else {
    // Pass the callback to startMonitor
    startMonitor(callback);
  }

  return monitorState.isRunning;
}
//# sourceMappingURL=monitor.dev.js.map
