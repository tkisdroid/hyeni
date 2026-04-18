const CACHE_KEY = "hyeni-entitlement-cache-v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readStore() {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage failures
  }
}

export function readEntitlementCache(familyId) {
  if (!familyId) return null;
  const store = readStore();
  const entry = store[familyId];
  if (!entry?.savedAt || !entry?.value) return null;
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
