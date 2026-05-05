// src/lib/htmlEscape.js
// Minimal HTML escape for inline overlay/marker innerHTML strings (Kakao CustomOverlay 등).
// Extracted from App.jsx (Phase 5 #4 / B6).

export function escHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
