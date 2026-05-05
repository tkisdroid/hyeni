// Theme accent system — propagates the selected child's color across the app
// via CSS custom properties. Default = pink (혜니 brand).
//
// Each entry maps the canonical accent to a 5-tuple:
//   accent      — primary tint (badges, focus rings, accents)
//   deep        — pressed / active state
//   soft        — subtle background tints
//   line        — soft border color (alpha-mixed look)
//   text        — readable text on soft backgrounds
//
// Usage:
//   import { applyThemeColor, THEME_PALETTE } from "./lib/theme.js";
//   applyThemeColor("#3B82F6");                  // immediate
//   applyThemeColor(child.color_hex || null);    // null = restore default
//
// CSS consumers use:  var(--theme-accent), var(--theme-accent-soft), etc.

const STORAGE_KEY = "hyeni:active_theme_color";

const THEME_PALETTE = Object.freeze({
  "#F779A8": { // 핑크 (default)
    label: "핑크",
    accent: "#F779A8", deep: "#E65C92", soft: "#FFF5FA", line: "#FFE4EF", text: "#B0477A",
  },
  "#3B82F6": { // 파랑
    label: "파랑",
    accent: "#3B82F6", deep: "#2563EB", soft: "#EFF6FF", line: "#DBEAFE", text: "#1E40AF",
  },
  "#10B981": { // 초록
    label: "초록",
    accent: "#10B981", deep: "#059669", soft: "#D1FAE5", line: "#A7F3D0", text: "#047857",
  },
  "#F59E0B": { // 노랑
    label: "노랑",
    accent: "#F59E0B", deep: "#D97706", soft: "#FEF3C7", line: "#FDE68A", text: "#92400E",
  },
  "#A78BFA": { // 보라
    label: "보라",
    accent: "#A78BFA", deep: "#7C3AED", soft: "#EDE9FE", line: "#DDD6FE", text: "#5B21B6",
  },
  "#EF4444": { // 빨강 — limited use (per design_color_rules)
    label: "빨강",
    accent: "#EF4444", deep: "#DC2626", soft: "#FEE2E2", line: "#FECACA", text: "#991B1B",
  },
});

const DEFAULT_THEME = THEME_PALETTE["#F779A8"];

function normalizeHex(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (THEME_PALETTE[v]) return v;
  return null;
}

export function getThemeColors(hex) {
  const key = normalizeHex(hex);
  return key ? THEME_PALETTE[key] : DEFAULT_THEME;
}

export function applyThemeColor(hex) {
  if (typeof document === "undefined") return;
  const colors = getThemeColors(hex);
  const root = document.documentElement;
  root.style.setProperty("--theme-accent", colors.accent);
  root.style.setProperty("--theme-accent-deep", colors.deep);
  root.style.setProperty("--theme-accent-soft", colors.soft);
  root.style.setProperty("--theme-accent-line", colors.line);
  root.style.setProperty("--theme-accent-text", colors.text);

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", colors.accent);
  }

  const key = normalizeHex(hex);
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* localStorage may be unavailable */ }
}

export function loadCachedTheme() {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function initThemeFromCache() {
  const cached = loadCachedTheme();
  applyThemeColor(cached);
}

export { THEME_PALETTE, DEFAULT_THEME };
