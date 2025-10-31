// app/utils/monitor.js

// In a real application, this state would be persisted in a database (e.g., Firestore)
// or a file to maintain state across server restarts or multiple instances.
// For this example, it's an in-memory object, meaning it will reset if the server restarts.
let monitorState = {
  isRunning: false,
  lastRun: null,
  nextRun: null,
  interval: 30 * 1000, // 30 seconds
  timeoutId: null, // To store the setTimeout ID for clearing
};

/**
 * Retrieves the current state of the monitor.
 * Excludes the non-serializable `timeoutId` property.
 * @returns {Object} The current monitor state.
 */
export function getMonitorState() {
  // Return a copy of monitorState, explicitly omitting the timeoutId
  const { timeoutId, ...serializableMonitorState } = monitorState;
  return { ...serializableMonitorState };
}

/**
 * Starts the monitor timer.
 * @param {Function} callback - The function to execute when the timer fires.
 */
export function startMonitor(callback) {
  if (monitorState.isRunning) {
    console.log("Monitor is already running.");
    return;
  }

  // Add a type check to ensure callback is a function
  if (typeof callback !== 'function') {
    console.error("Error: startMonitor received a non-function callback. Monitor cannot be started.", callback);
    return;
  }

  monitorState.isRunning = true;
  console.log(`Monitor started. Next run in ${monitorState.interval / 1000} seconds.`);

  // Make scheduleNextRun async to properly await the callback
  const scheduleNextRun = async () => {
    monitorState.lastRun = new Date().toISOString();
    monitorState.nextRun = new Date(Date.now() + monitorState.interval).toISOString();
    console.log(`Executing scheduled task. Next run at: ${monitorState.nextRun}`);
    try {
      // Ensure callback is still a function before calling (defensive check)
      if (typeof callback === 'function') {
        await callback(); // Await the async function
      } else {
        console.error("Error: Scheduled callback is no longer a function:", callback);
        // If callback somehow becomes invalid, stop scheduling further runs
        clearTimeout(monitorState.timeoutId);
        monitorState.isRunning = false;
        return;
      }
    } catch (error) {
      console.error("❌ Error executing monitor callback:", error);
    } finally {
      // Reschedule the next run, even if the current callback failed
      monitorState.timeoutId = setTimeout(scheduleNextRun, monitorState.interval);
    }
  };

  // Initial immediate run, then schedule subsequent runs
  scheduleNextRun();
}

/**
 * Stops the monitor timer.
 */
export function stopMonitor() {
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
export function toggleMonitor(callback) {
  if (monitorState.isRunning) {
    stopMonitor();
  } else {
    // Pass the callback to startMonitor
    startMonitor(callback);
  }
  return monitorState.isRunning;
}
