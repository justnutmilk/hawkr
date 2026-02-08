/**
 * Hawkr Disruptor — Lightweight pub/sub event bus with debounce.
 *
 * When Firestore snapshots fire, the disruptor batches rapid updates
 * (150 ms debounce) so chart re-draws and stat recalculations only
 * happen once per burst of changes.
 *
 * Usage:
 *   import { disruptor } from "./disruptor.js";
 *   const off = disruptor.on("vendor:charts:invalidated", (data) => { ... });
 *   disruptor.emit("vendor:charts:invalidated", payload);
 *   off();                       // unsubscribe
 *   disruptor.destroy();         // tear down everything
 */

const DEBOUNCE_MS = 150;

const listeners = {};   // event → Set<callback>
const timers = {};      // event → pending setTimeout id
const latestData = {};  // event → most-recent payload (used after debounce)

/**
 * Subscribe to a named event.
 * @param {string} event
 * @param {Function} callback
 * @returns {Function} unsubscribe handle
 */
function on(event, callback) {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(callback);
  return () => off(event, callback);
}

/**
 * Unsubscribe a specific callback from an event.
 */
function off(event, callback) {
  if (listeners[event]) listeners[event].delete(callback);
}

/**
 * Emit an event.  Delivery is debounced — if multiple emits happen within
 * DEBOUNCE_MS only the last payload is delivered (once).
 */
function emit(event, data) {
  latestData[event] = data;

  if (timers[event]) clearTimeout(timers[event]);

  timers[event] = setTimeout(() => {
    delete timers[event];
    const cbs = listeners[event];
    if (!cbs) return;
    const payload = latestData[event];
    cbs.forEach((cb) => {
      try { cb(payload); } catch (err) { console.error(`[disruptor] ${event}:`, err); }
    });
  }, DEBOUNCE_MS);
}

/**
 * Remove all listeners and cancel pending timers.
 */
function destroy() {
  Object.values(timers).forEach(clearTimeout);
  Object.keys(listeners).forEach((k) => delete listeners[k]);
  Object.keys(timers).forEach((k) => delete timers[k]);
  Object.keys(latestData).forEach((k) => delete latestData[k]);
}

export const disruptor = { on, off, emit, destroy };
