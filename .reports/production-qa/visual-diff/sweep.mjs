/**
 * Agent 09 — Visual sweep
 * One-off script invoked by `node .reports/production-qa/visual-diff/sweep.mjs`.
 * No file in the codebase imports this. Output: screenshots/HTML/sweep-results.json
 * inside this same directory. Reads no user data; does not call Supabase.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:4174";
const OUT = path.resolve(".reports/production-qa/visual-diff");

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

const SCREENS = [
  { name: "entry-splash", path: "/" },
];

const issues = [];
const captured = [];
const viewportResults = {};

async function captureScreen(page, screen, vp, outDir) {
  const screenDir = path.join(outDir, screen.name);
  await fs.mkdir(screenDir, { recursive: true });
  const file = path.join(screenDir, `${vp.name}.png`);
  const domFile = path.join(screenDir, `${vp.name}.html`);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(`${BASE}${screen.path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: file, fullPage: false });
  const html = await page.content();
  await fs.writeFile(domFile, html, "utf-8");
  captured.push({ screen: screen.name, viewport: vp.name, file: path.relative(process.cwd(), file) });
}

async function runtimeChecks(page, vp) {
  const findings = [];
  const bodyWeight = await page.evaluate(() => getComputedStyle(document.body).fontWeight);
  if (bodyWeight !== "500" && bodyWeight !== "700" && bodyWeight !== "bold") {
    findings.push({ check: "body-weight-500", actual: bodyWeight });
  }
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  if (!/Pretendard/i.test(bodyFont)) {
    findings.push({ check: "pretendard-font", actual: bodyFont });
  }
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (hasOverflow) findings.push({ check: "horizontal-overflow" });

  const ctaInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a[role='button']"));
    return btns
      .filter((b) => b.offsetParent !== null)
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { label: (b.innerText || b.getAttribute("aria-label") || "").trim().slice(0, 60), x: r.x, y: r.y, w: r.width, h: r.height };
      });
  });
  const oob = ctaInfo.filter((b) => b.x < 0 || b.x + b.w > vp.width + 1);
  if (oob.length) findings.push({ check: "cta-out-of-bounds", actual: oob });

  const missingAlt = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    return imgs.filter((i) => i.offsetParent !== null && (i.alt == null || i.alt === "")).map((i) => ({ src: (i.currentSrc || i.src).slice(0, 100) }));
  });
  if (missingAlt.length) findings.push({ check: "missing-alt", actual: missingAlt.slice(0, 8) });

  const unlabeledBtns = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns
      .filter((b) => b.offsetParent !== null)
      .filter((b) => !(b.innerText || "").trim() && !b.getAttribute("aria-label"))
      .map((b) => ({ html: b.outerHTML.slice(0, 200) }));
  });
  if (unlabeledBtns.length) findings.push({ check: "unlabeled-button", actual: unlabeledBtns.slice(0, 5) });

  const hasH1 = await page.evaluate(() => document.querySelectorAll("h1, [role='heading']").length > 0);
  if (!hasH1) findings.push({ check: "no-heading-landmark" });

  return findings;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: "ko-KR", colorScheme: "light" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("[pageerror]", e.message));

  for (const vp of VIEWPORTS) {
    viewportResults[vp.name] = { viewport: vp.name, screens_captured: 0, issues: [] };
    for (const screen of SCREENS) {
      try {
        await captureScreen(page, screen, vp, OUT);
        const findings = await runtimeChecks(page, vp);
        viewportResults[vp.name].screens_captured++;
        for (const f of findings) viewportResults[vp.name].issues.push({ screen: screen.name, ...f });
      } catch (e) {
        viewportResults[vp.name].issues.push({ screen: screen.name, error: String(e.message || e) });
      }
    }
  }

  await browser.close();

  await fs.writeFile(path.join(OUT, "sweep-results.json"), JSON.stringify({ captured, viewportResults, issues }, null, 2), "utf-8");
  console.log(JSON.stringify({ captured: captured.length, viewports: VIEWPORTS.length }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
