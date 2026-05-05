// src/lib/pairCode.js
// Normalize various pair-code inputs (raw 8-char, "KID-..." form, full URL with
// ?pairCode= or ?code=) into the canonical "KID-XXXXXXXX" string.
// Extracted from App.jsx (Phase 5 #4 / B3).

export function normalizePairCodeInput(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return "";

    const directMatch = raw.match(/KID-[A-Z0-9]{8}/i);
    if (directMatch) return directMatch[0].toUpperCase();

    try {
        const parsed = new URL(raw);
        const paramCode = parsed.searchParams.get("pairCode") || parsed.searchParams.get("code");
        if (paramCode) return normalizePairCodeInput(paramCode);
    } catch {
        // ignore URL parsing failures
    }

    const shortMatch = raw.match(/\b[A-Z0-9]{8}\b/i);
    if (shortMatch) return `KID-${shortMatch[0].toUpperCase()}`;
    return "";
}
