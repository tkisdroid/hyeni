const CACHE_KEY = "hyeni-entitlement-cache-v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let memoryStore = {};

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function readStore() {
  const storage = getLocalStorage();
  if (!storage) return { ...memoryStore };
  try {
    const raw = storage.getItem(CACHE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    memoryStore = store && typeof store === "object" ? store : {};
    return memoryStore;
  } catch {
    return { ...memoryStore };
  }
}

function writeStore(store) {
  memoryStore = store && typeof store === "object" ? { ...store } : {};
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage failures
  }
}

export function readEntitlementCache(familyId) {
  if (!familyId) return null;
  const store = readStore();
  const entry = store[familyId];
  if (!entry?.value || typeof entry.savedAt !== "number") return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
    delete store[familyId];
    writeStore(store);
    return null;
  }
  return entry.value;
}

export function writeEntitlementCache(familyId, value) {
  if (!familyId || !value) return;
  const store = readStore();
  store[familyId] = { savedAt: Date.now(), value };
  writeStore(store);
}

export function clearEntitlementCache(familyId) {
  const store = readStore();
  if (familyId) delete store[familyId];
  else {
    for (const key of Object.keys(store)) delete store[key];
  }
  writeStore(store);
}

export { CACHE_TTL_MS };
