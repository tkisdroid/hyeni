// Theme preference helpers. Reads/writes localStorage 'hyeni-theme' and
// applies the resolved theme (light|dark) to <html data-theme>.
// The flash-prevention script in index.html runs synchronously before paint
// using the same key, so first paint matches the user's preference.

import { useEffect, useState } from "react";

const KEY = "hyeni-theme";

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(pref) {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function applyTheme(pref) {
  const resolved = resolveTheme(pref);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolved);
  }
  return resolved;
}

export function setThemePref(pref) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch { /* storage unavailable */ }
  return applyTheme(pref);
}

export function useTheme() {
  const [pref, setPref] = useState(() => getThemePref());
  const [resolved, setResolved] = useState(() => resolveTheme(pref));

  useEffect(() => {
    setResolved(applyTheme(pref));
  }, [pref]);

  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(applyTheme("system"));
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, [pref]);

  return {
    pref,
    resolved,
    setPref: (next) => {
      setThemePref(next);
      setPref(next);
    },
  };
}
