"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getServerSyncStatus = getServerSyncStatus;
exports.startServerSyncJob = startServerSyncJob;
exports.stopServerSyncJob = stopServerSyncJob;
exports.updateSyncInterval = updateSyncInterval;
exports.performManualSync = performManualSync;
exports.getSyncStatistics = getSyncStatistics;
exports.clearSyncErrors = clearSyncErrors;
exports._syncJobState = void 0;

var _productSyncServer = require("../services/productSync.server.js");

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Server-side sync manager that handles persistent background synchronization
 * This manages a server-side cron-like job that runs at regular intervals
 */
// In-memory storage for sync job state (in production, consider using Redis or database)
var syncJobState = {
  isRunning: false,
  intervalId: null,
  lastServerSync: null,
  serverSyncCount: 0,
  syncInterval: 30000,
  // 30 seconds default
  errors: [],
  authPayload: null
};
/**
 * Gets the current status of the server-side sync job
 * @returns {Object} Current sync job status
 */

exports._syncJobState = syncJobState;

function getServerSyncStatus() {
  return {
    isRunning: syncJobState.isRunning,
    lastServerSync: syncJobState.lastServerSync,
    serverSyncCount: syncJobState.serverSyncCount,
    syncInterval: syncJobState.syncInterval,
    errors: syncJobState.errors.slice(-5) // Return last 5 errors

  };
}
/**
 * Performs a single sync operation
 * @param {Object} authPayload - Shopify authentication payload
 * @returns {Promise<Object>} Sync results
 */


function performSync(authPayload) {
  var syncResult;
  return regeneratorRuntime.async(function performSync$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          console.log('🔄 Starting server-side sync job...');
          _context.next = 4;
          return regeneratorRuntime.awrap((0, _productSyncServer.syncProductsWithShopify)(authPayload));

        case 4:
          syncResult = _context.sent;
          // Update sync statistics
          syncJobState.lastServerSync = new Date().toISOString();
          syncJobState.serverSyncCount++; // Log the results

          if (syncResult.success) {
            console.log("\u2705 Server sync completed successfully:", syncResult.message); // Clear old errors on successful sync

            if (syncJobState.errors.length > 0) {
              syncJobState.errors = [];
            }
          } else {
            console.error('❌ Server sync failed:', syncResult.error); // Add error to the error log

            syncJobState.errors.push({
              timestamp: new Date().toISOString(),
              error: syncResult.error,
              type: 'sync_failure'
            }); // Keep only last 10 errors

            if (syncJobState.errors.length > 10) {
              syncJobState.errors = syncJobState.errors.slice(-10);
            }
          }

          return _context.abrupt("return", syncResult);

        case 11:
          _context.prev = 11;
          _context.t0 = _context["catch"](0);
          console.error('💥 Fatal error in server sync:', _context.t0); // Add fatal error to the error log

          syncJobState.errors.push({
            timestamp: new Date().toISOString(),
            error: _context.t0.message,
            type: 'fatal_error'
          });
          return _context.abrupt("return", {
            success: false,
            error: "Fatal sync error: ".concat(_context.t0.message),
            createdProducts: [],
            updatedProducts: [],
            errors: []
          });

        case 16:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 11]]);
}
/**
 * Starts the server-side sync job
 * @param {Object} authPayload - Shopify authentication payload
 * @param {number} intervalMs - Sync interval in milliseconds (optional)
 * @returns {Object} Result of starting the sync job
 */


function startServerSyncJob(authPayload) {
  var intervalMs,
      initialSyncResult,
      _args3 = arguments;
  return regeneratorRuntime.async(function startServerSyncJob$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          intervalMs = _args3.length > 1 && _args3[1] !== undefined ? _args3[1] : 30000;
          _context3.prev = 1;

          // Stop any existing sync job first
          if (syncJobState.isRunning) {
            console.log('🛑 Stopping existing sync job before starting new one...');
            stopServerSyncJob();
          } // Store the auth payload for use in the interval


          syncJobState.authPayload = authPayload;
          syncJobState.syncInterval = intervalMs;
          console.log("\uD83D\uDE80 Starting server-side sync job with ".concat(intervalMs, "ms interval...")); // Perform initial sync

          _context3.next = 8;
          return regeneratorRuntime.awrap(performSync(authPayload));

        case 8:
          initialSyncResult = _context3.sent;
          // Set up the recurring sync job
          syncJobState.intervalId = setInterval(function _callee() {
            return regeneratorRuntime.async(function _callee$(_context2) {
              while (1) {
                switch (_context2.prev = _context2.next) {
                  case 0:
                    if (!(syncJobState.isRunning && syncJobState.authPayload)) {
                      _context2.next = 3;
                      break;
                    }

                    _context2.next = 3;
                    return regeneratorRuntime.awrap(performSync(syncJobState.authPayload));

                  case 3:
                  case "end":
                    return _context2.stop();
                }
              }
            });
          }, intervalMs); // Mark as running

          syncJobState.isRunning = true;
          console.log('✅ Server-side sync job started successfully');
          return _context3.abrupt("return", {
            success: true,
            message: "Server sync job started with ".concat(intervalMs, "ms interval"),
            initialSyncResult: initialSyncResult,
            status: getServerSyncStatus()
          });

        case 15:
          _context3.prev = 15;
          _context3.t0 = _context3["catch"](1);
          console.error('❌ Failed to start server sync job:', _context3.t0); // Clean up on failure

          syncJobState.isRunning = false;
          syncJobState.authPayload = null;

          if (syncJobState.intervalId) {
            clearInterval(syncJobState.intervalId);
            syncJobState.intervalId = null;
          }

          return _context3.abrupt("return", {
            success: false,
            message: "Failed to start server sync job: ".concat(_context3.t0.message),
            error: _context3.t0.message
          });

        case 22:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[1, 15]]);
}
/**
 * Stops the server-side sync job
 * @returns {Object} Result of stopping the sync job
 */


function stopServerSyncJob() {
  try {
    if (!syncJobState.isRunning) {
      console.log('⏸️ Server sync job is not running');
      return {
        success: true,
        message: 'Server sync job was not running',
        status: getServerSyncStatus()
      };
    }

    console.log('🛑 Stopping server-side sync job...'); // Clear the interval

    if (syncJobState.intervalId) {
      clearInterval(syncJobState.intervalId);
      syncJobState.intervalId = null;
    } // Mark as stopped


    syncJobState.isRunning = false;
    syncJobState.authPayload = null;
    console.log('✅ Server-side sync job stopped successfully');
    return {
      success: true,
      message: 'Server sync job stopped successfully',
      status: getServerSyncStatus()
    };
  } catch (error) {
    console.error('❌ Error stopping server sync job:', error); // Force cleanup

    syncJobState.isRunning = false;
    syncJobState.authPayload = null;
    syncJobState.intervalId = null;
    return {
      success: false,
      message: "Error stopping server sync job: ".concat(error.message),
      error: error.message
    };
  }
}
/**
 * Updates the sync interval for the running job
 * @param {number} intervalMs - New interval in milliseconds
 * @returns {Object} Result of updating the interval
 */


function updateSyncInterval(intervalMs) {
  try {
    if (!syncJobState.isRunning) {
      return {
        success: false,
        message: 'Cannot update interval - sync job is not running'
      };
    }

    console.log("\u23F1\uFE0F Updating sync interval to ".concat(intervalMs, "ms...")); // Clear existing interval

    if (syncJobState.intervalId) {
      clearInterval(syncJobState.intervalId);
    } // Set new interval


    syncJobState.syncInterval = intervalMs;
    syncJobState.intervalId = setInterval(function _callee2() {
      return regeneratorRuntime.async(function _callee2$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              if (!(syncJobState.isRunning && syncJobState.authPayload)) {
                _context4.next = 3;
                break;
              }

              _context4.next = 3;
              return regeneratorRuntime.awrap(performSync(syncJobState.authPayload));

            case 3:
            case "end":
              return _context4.stop();
          }
        }
      });
    }, intervalMs);
    console.log('✅ Sync interval updated successfully');
    return {
      success: true,
      message: "Sync interval updated to ".concat(intervalMs, "ms"),
      status: getServerSyncStatus()
    };
  } catch (error) {
    console.error('❌ Error updating sync interval:', error);
    return {
      success: false,
      message: "Error updating sync interval: ".concat(error.message),
      error: error.message
    };
  }
}
/**
 * Performs a manual sync without affecting the scheduled job
 * @param {Object} authPayload - Shopify authentication payload
 * @returns {Promise<Object>} Manual sync results
 */


function performManualSync(authPayload) {
  var syncResult;
  return regeneratorRuntime.async(function performManualSync$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.prev = 0;
          console.log('🔧 Performing manual sync...');
          _context5.next = 4;
          return regeneratorRuntime.awrap((0, _productSyncServer.syncProductsWithShopify)(authPayload));

        case 4:
          syncResult = _context5.sent;
          console.log('✅ Manual sync completed');
          return _context5.abrupt("return", {
            success: true,
            message: 'Manual sync completed',
            syncResult: syncResult,
            status: getServerSyncStatus()
          });

        case 9:
          _context5.prev = 9;
          _context5.t0 = _context5["catch"](0);
          console.error('❌ Manual sync failed:', _context5.t0);
          return _context5.abrupt("return", {
            success: false,
            message: "Manual sync failed: ".concat(_context5.t0.message),
            error: _context5.t0.message
          });

        case 13:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[0, 9]]);
}
/**
 * Gets detailed sync statistics and health information
 * @returns {Object} Detailed sync statistics
 */


function getSyncStatistics() {
  return _objectSpread({}, getServerSyncStatus(), {
    uptime: syncJobState.isRunning ? Date.now() - new Date(syncJobState.lastServerSync || Date.now()).getTime() : 0,
    nextSyncIn: syncJobState.isRunning ? syncJobState.syncInterval : null,
    healthStatus: syncJobState.errors.length > 0 ? 'warning' : 'healthy',
    recentErrors: syncJobState.errors.slice(-3)
  });
}
/**
 * Clears all stored errors
 * @returns {Object} Result of clearing errors
 */


function clearSyncErrors() {
  try {
    var errorCount = syncJobState.errors.length;
    syncJobState.errors = [];
    console.log("\uD83E\uDDF9 Cleared ".concat(errorCount, " sync errors"));
    return {
      success: true,
      message: "Cleared ".concat(errorCount, " sync errors"),
      status: getServerSyncStatus()
    };
  } catch (error) {
    console.error('❌ Error clearing sync errors:', error);
    return {
      success: false,
      message: "Error clearing sync errors: ".concat(error.message),
      error: error.message
    };
  }
} // Graceful shutdown handler


process.on('SIGTERM', function () {
  console.log('📴 Received SIGTERM, stopping sync job...');
  stopServerSyncJob();
});
process.on('SIGINT', function () {
  console.log('📴 Received SIGINT, stopping sync job...');
  stopServerSyncJob();
}); // Export the sync state for debugging purposes (remove in production)
//# sourceMappingURL=syncManager.server.dev.js.map
