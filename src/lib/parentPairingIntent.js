// src/lib/parentPairingIntent.js
// Session-storage hint that says "the parent is mid-pairing flow" — used to
// keep the parent auth flow from blowing past pair-code prompts on cold reload.
// Extracted from App.jsx (Phase 5 #4 / B4).

const PARENT_PAIRING_INTENT_KEY = "kids-app:parent-pairing-intent";

export function rememberParentPairingIntent() {
    if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PARENT_PAIRING_INTENT_KEY, "1");
    }
}

export function clearParentPairingIntent() {
    if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PARENT_PAIRING_INTENT_KEY);
    }
}

export function hasParentPairingIntent() {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(PARENT_PAIRING_INTENT_KEY) === "1";
}
