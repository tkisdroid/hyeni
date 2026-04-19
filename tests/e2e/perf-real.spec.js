import { expect, test } from "@playwright/test";

/**
 * Real-services E2E: performance budgets on localhost.
 *
 * We're testing the bundle + the dev server, not production CDN. Thresholds
 * are generous on purpose — they catch gross regressions (a 10s LCP) without
 * triggering on normal local variance. Tighten when a CI baseline is in place.
 *
 * Chromium-only: the underlying CDP `performance.getMetrics` is
 * Chrome-specific. Firefox/WebKit fall back to `performance.timing`, which
 * only yields loadEventEnd.
 */

const BUDGETS = {
  loadMs: 8_000,            // total load time
  firstPaintMs: 4_000,      // first contentful paint
  largestContentfulMs: 5_000, // largest contentful paint
  transferBytes: 8_000_000, // 8 MB transferred — catches ~2x regression off current ~4.5 MB baseline
};

test.describe("performance budgets (localhost)", () => {
  test("role gate load fits within gross budget (chromium only)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CDP metrics are Chrome-only");

    const transferSizes = [];
    page.on("response", async (r) => {
      try {
        const headers = r.headers();
        const len = Number(headers["content-length"]);
        if (Number.isFinite(len)) transferSizes.push(len);
      } catch {
        // ignore
      }
    });

    const start = Date.now();
    await page.goto("/", { waitUntil: "load" });
    const loadMs = Date.now() - start;

    const timings = await page.evaluate(() => {
      const entries = performance.getEntriesByType("paint");
      const fcp = entries.find((e) => e.name === "first-contentful-paint")?.startTime || 0;
      const nav = performance.getEntriesByType("navigation")[0] || {};
      return {
        fcpMs: fcp,
        domContentLoaded: nav.domContentLoadedEventEnd || 0,
        loadEventEnd: nav.loadEventEnd || 0,
      };
    });

    const lcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          try {
            let last = 0;
            const po = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                last = Math.max(last, entry.startTime);
              }
            });
            po.observe({ type: "largest-contentful-paint", buffered: true });
            // Give it a beat to collect any buffered entries.
            setTimeout(() => {
              po.disconnect();
              resolve(last);
            }, 500);
          } catch {
            resolve(0);
          }
        }),
    );

    const transferred = transferSizes.reduce((a, b) => a + b, 0);

    // Log metrics so we see them in CI output regardless of pass/fail.
    console.log(
      `[perf] loadMs=${loadMs} fcpMs=${Math.round(timings.fcpMs)} ` +
        `lcpMs=${Math.round(lcp)} transferBytes=${transferred}`,
    );

    expect(loadMs, `page load exceeded budget`).toBeLessThan(BUDGETS.loadMs);
    expect(timings.fcpMs, `first contentful paint budget`).toBeLessThan(BUDGETS.firstPaintMs);
    // LCP can be 0 if no large contentful element fired yet — skip hard
    // assertion when that happens (avoid false fails on very small pages).
    if (lcp > 0) {
      expect(lcp, `largest contentful paint budget`).toBeLessThan(BUDGETS.largestContentfulMs);
    }
    expect(transferred, `transfer size budget`).toBeLessThan(BUDGETS.transferBytes);
  });
});
