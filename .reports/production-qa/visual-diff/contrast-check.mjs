import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:4174";

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "ko-KR", colorScheme: "light", viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

const samples = await page.evaluate(() => {
  function srgbToLin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function relLum(rgb) { const [r, g, b] = rgb.map(srgbToLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function contrast(fgHex, bgHex) {
    const l1 = relLum(fgHex);
    const l2 = relLum(bgHex);
    const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }
  function parseRgb(s) { const m = s.match(/(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/); return m ? [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])] : null; }

  function getEffectiveBg(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      const cs = getComputedStyle(cur);
      const bg = cs.backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        const m = bg.match(/rgba?\(([^)]+)\)/);
        if (m) {
          const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
          if (parts.length === 3 || (parts.length === 4 && parts[3] > 0.5)) return parts.slice(0, 3);
        }
      }
      cur = cur.parentElement;
    }
    return [255, 255, 255]; // approximate page bg fallback
  }

  const candidates = Array.from(document.querySelectorAll("h1, h2, h3, p, button, a, span, label, li")).filter((el) => el.offsetParent !== null && (el.innerText || "").trim().length > 0);
  const results = [];
  for (const el of candidates.slice(0, 40)) {
    const cs = getComputedStyle(el);
    const fg = parseRgb(cs.color);
    if (!fg) continue;
    const bg = getEffectiveBg(el);
    const ratio = contrast(fg, bg);
    const fontSize = parseFloat(cs.fontSize);
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const min = isLarge ? 3.0 : 4.5;
    results.push({
      text: (el.innerText || "").trim().slice(0, 60),
      tag: el.tagName,
      fontSize,
      fontWeight,
      isLarge,
      ratio: Number(ratio.toFixed(2)),
      passes: ratio >= min,
    });
  }
  return results;
});

const fails = samples.filter((s) => !s.passes);
console.log(JSON.stringify({ total: samples.length, fails }, null, 2));

await browser.close();
