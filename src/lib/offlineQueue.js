// src/lib/offlineQueue.js
//
// Minimal offline detection + mutation queue.
// Agent11 P1-003 — previously the app had no online/offline awareness:
// every failed mutation rolled back optimistically and asked the user to
// retry by hand. Subway / weak-signal commute scenarios were a guaranteed
// silent data-loss path.
//
// Scope (deliberately minimal — full offline-first is a product call):
//   1) Centralised online/offline state via navigator.onLine + window
//      'online' / 'offline' events. Subscribers get notified whenever the
//      state flips so the UI can show a banner.
//   2) In-memory FIFO queue of "deferred mutations". A mutation is just
//      `{ key, label, run }` where `run` is an async () => unknown thunk.
//      `key` is used for de-duplication: if a caller enqueues twice for
//      the same key while offline (e.g. user edits the same event twice
//      in a row), only the latest `run` survives.
//   3) On the next 'online' event we drain the queue serially. Failures
//      are re-queued at the tail so a transient blip does not lose data,
//      bounded by `MAX_RETRIES_PER_MUTATION` per entry to avoid infinite
//      loops when the mutation itself is broken (e.g. RLS denies it).
//
// We deliberately use an in-memory queue (not localStorage). The queued
// mutations close over Supabase client state and React setters that do
// not survive a page reload, so persisting them would just create silent
// half-applied writes. A reload throws the queue away — same outcome the
// user already gets today, plus an explicit toast.
//
// @capacitor/network is not in package.json so we stick to navigator.onLine.
// On Android WebView this is sufficient — Capacitor proxies the browser
// connectivity events to the native plugin when present.

const MAX_RETRIES_PER_MUTATION = 3;

let _online = typeof navigator !== "undefined" ? !!navigator.onLine : true;
const _queue = new Map();           // key -> { label, run, retries }
const _onlineListeners = new Set(); // (online: boolean) => void
let _draining = false;
let _wired = false;

function wireWindowListenersOnce() {
  if (_wired || typeof window === "undefined") return;
  _wired = true;
  window.addEventListener("online", () => {
    _online = true;
    notify();
    void drainQueue();
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

export function isOnline() {
  wireWindowListenersOnce();
  return _online;
}

export function subscribeOnline(callback) {
  wireWindowListenersOnce();
  if (typeof callback !== "function") return () => {};
  _onlineListeners.add(callback);
  // Push current state so callers do not need a separate read.
  try { callback(_online); } catch (e) { console.warn("[offlineQueue] initial notify threw", e); }
  return () => { _onlineListeners.delete(callback); };
}

// enqueueMutation: queue a deferred mutation that will run when we are
// online. Returns a function the caller can use to cancel (e.g. when the
// user undoes the edit).
//
//   key   — unique id for de-dup. e.g. `event:${eventId}` or `memo:${dateKey}`.
//   label — human-readable label shown in toasts.
//   run   — async () => unknown. Called when online; thrown errors trigger
//           re-queue up to MAX_RETRIES_PER_MUTATION.
export function enqueueMutation(key, label, run) {
  wireWindowListenersOnce();
  if (typeof key !== "string" || typeof run !== "function") {
    throw new Error("[offlineQueue] enqueueMutation requires (key:string, label, run:fn)");
  }
  _queue.set(key, { label: label || key, run, retries: 0 });
  // If we got back online between the caller's online check and the
  // enqueue call, drain immediately so the user does not see a stale
  // pending banner.
  if (_online) void drainQueue();
  return () => { _queue.delete(key); };
}

export function getQueueSize() {
  return _queue.size;
}

export function getQueueLabels() {
  return Array.from(_queue.values()).map((entry) => entry.label);
}

async function drainQueue() {
  if (_draining || !_online || _queue.size === 0) return;
  _draining = true;
  try {
    // Snapshot the key order so we can drain serially while letting
    // callers still enqueue new entries during the loop.
    const keys = Array.from(_queue.keys());
    for (const key of keys) {
      if (!_online) break;
      const entry = _queue.get(key);
      if (!entry) continue;
      _queue.delete(key);
      try {
        await entry.run();
      } catch (e) {
        const retries = entry.retries + 1;
        console.warn(`[offlineQueue] retry ${retries}/${MAX_RETRIES_PER_MUTATION} for ${key}`, e);
        if (retries < MAX_RETRIES_PER_MUTATION) {
          // Re-queue at the tail unless the user re-enqueued the same
          // key during the await (in which case the newer thunk wins).
          if (!_queue.has(key)) {
            _queue.set(key, { ...entry, retries });
          }
        } else {
          console.error(`[offlineQueue] dropping ${key} after ${MAX_RETRIES_PER_MUTATION} retries`, e);
        }
      }
    }
    notify(); // queue size changed
  } finally {
    _draining = false;
  }
  // If new entries arrived during the drain and we are still online,
  // run another pass so callers do not have to.
  if (_online && _queue.size > 0) void drainQueue();
}

// Test-only: reset internal state. Not exported via the package barrel.
export function __resetForTests() {
  _online = typeof navigator !== "undefined" ? !!navigator.onLine : true;
  _queue.clear();
  _onlineListeners.clear();
  _draining = false;
}
