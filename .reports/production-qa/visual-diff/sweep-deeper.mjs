/**
 * Try to reach role selection screen by clicking through.
 * Capture both role buttons (부모/자녀).
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:4174";
const OUT = path.resolve(".reports/production-qa/visual-diff");

const VPS = [
  { name: "375x812", w: 375, h: 812 },
  { name: "390x844", w: 390, h: 844 },
  { name: "320x568", w: 320, h: 568 },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "ko-KR", viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

for (const vp of VPS) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  // Capture role-select page
  await fs.mkdir(path.join(OUT, "role-select"), { recursive: true });
  await page.screenshot({ path: path.join(OUT, "role-select", `${vp.name}.png`), fullPage: true });

  // Click '부모로 시작' card
  const parentBtn = await page.locator("text=부모로 시작").first();
  if (await parentBtn.count() > 0) {
    await parentBtn.click({ trial: false }).catch(() => {});
    await page.waitForTimeout(600);
    // Then click '다음'
    const next = await page.locator("text=다음").first();
    if (await next.count() > 0) await next.click({ trial: false }).catch(() => {});
    await page.waitForTimeout(800);
    await fs.mkdir(path.join(OUT, "parent-auth"), { recursive: true });
    await page.screenshot({ path: path.join(OUT, "parent-auth", `${vp.name}.png`), fullPage: true });
  }

  // Go back to role select
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  const childBtn = await page.locator("text=자녀로 시작").first();
  if (await childBtn.count() > 0) {
    await childBtn.click({ trial: false }).catch(() => {});
    await page.waitForTimeout(600);
    const next2 = await page.locator("text=다음").first();
    if (await next2.count() > 0) await next2.click({ trial: false }).catch(() => {});
    await page.waitForTimeout(900);
    await fs.mkdir(path.join(OUT, "child-pair"), { recursive: true });
    await page.screenshot({ path: path.join(OUT, "child-pair", `${vp.name}.png`), fullPage: true });
  }
}

await browser.close();
console.log("done");
