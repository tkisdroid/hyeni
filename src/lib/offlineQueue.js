// src/lib/offlineQueue.js
//
// Lightweight online/offline detection for the offline banner.
//
// History: this module originally included an in-memory FIFO mutation
// queue (enqueueMutation + drainQueue + retry/dedup machinery) intended
// to defer writes on weak signal. No mutation path ever hooked into it,
// so the queueing surface was removed in 2026-05-15 — the banner is the
// only UI that consumed this module, and it just needs the online flag.
// If true offline-first mutation queueing is needed later, restore the
// machinery as a separate plan; persistence + UI toast wiring are the
// blockers, not the dispatch logic itself.

let _online = typeof navigator !== "undefined" ? !!navigator.onLine : true;
const _onlineListeners = new Set();
let _wired = false;

function wireWindowListenersOnce() {
  if (_wired || typeof window === "undefined") return;
  _wired = true;
  window.addEventListener("online", () => {
    _online = true;
    notify();
  });
  window.addEventListener("offline", () => {
    _online = false;
    notify();
  });
}

function notify() {
  for (const cb of _onlineListeners) {
    try { cb(_online); } catch (e) { console.warn("[offlineQueue] listener threw", e); }
  }
}

export function subscribeOnline(callback) {
  wireWindowListenersOnce();
  if (typeof callback !== "function") return () => {};
  _onlineListeners.add(callback);
  // Push current state so callers do not need a separate read.
  try { callback(_online); } catch (e) { console.warn("[offlineQueue] initial notify threw", e); }
  return () => { _onlineListeners.delete(callback); };
}
