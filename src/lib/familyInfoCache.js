// First-paint hydration cache for the parent/child familyInfo blob.
//
// Goal: avoid the cold-start window where avatars and gating flags are
// derived from familyInfo=null while getMyFamily is still in-flight.
// We mirror familyInfo to localStorage on every change and read it on
// mount so the very first render already has children, photos, role,
// pair code, etc. The network fetch still runs in parallel and replaces
// the cached blob with fresh data once it arrives.

const STORAGE_KEY = "hyeni-family-info-cache-v1";
const TTL_MS = 24 * 60 * 60 * 1000;

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

export function readFamilyInfoCache() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!parsed.value || typeof parsed.value !== "object") return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeFamilyInfoCache(value) {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (value === null || value === undefined) {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // localStorage may be full or unavailable — degrade silently.
  }
}

export function clearFamilyInfoCache() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
