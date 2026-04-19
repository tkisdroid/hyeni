import { expect, test } from "@playwright/test";

/**
 * Real-services E2E: Qonversion (subscription) web-layer test.
 *
 * Qonversion's native plugin (@qonversion/capacitor-plugin) only activates
 * on Capacitor native runtime (Android/iOS device or emulator). In a web
 * browser context — which is what Playwright runs — the native plugin
 * short-circuits via `shouldUseNativeQonversion()` in src/lib/qonversion.js.
 *
 * We therefore validate the web fallback path: the app must render without
 * crashing when Qonversion is not available (the common case for browser
 * users on Kakao web flow).
 *
 * True native subscription flow testing requires a connected Android device
 * and Play Billing sandbox credentials — out of scope for web Playwright.
 */

test.describe("qonversion web fallback", () => {
  test("web boot does not crash when Qonversion native plugin is unavailable", async ({ page }) => {
    const pageErrors = [];
    const qonversionErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("console", (m) => {
      const text = m.text();
      if (m.type() === "error" && /qonversion/i.test(text)) {
        qonversionErrors.push(text);
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Role gate renders — no Qonversion-triggered crash.
    await expect(page.getByText(/학부모/).first()).toBeVisible({ timeout: 10_000 });
    expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);

    // Qonversion errors to console are acceptable (expected on web) but
    // should not include uncaught exception signatures.
    const uncaught = qonversionErrors.filter((t) => /uncaught|is not a function/i.test(t));
    expect(uncaught, `uncaught qonversion errors: ${JSON.stringify(uncaught)}`).toEqual([]);
  });

  test("settings surface shows subscription-management affordance for parents", async ({ page }) => {
    // Parent-settings gate is deep in the app; we approximate by checking
    // that the bundle at least contains the management URL the Qonversion
    // module references. This guards against someone accidentally stripping
    // the manage-subscriptions link on web.
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Vite serves sources in dev. Fetch the qonversion module source to
    // verify the Google Play subscription management URL is still present.
    const srcResp = await page.request.get("/src/lib/qonversion.js");
    expect(srcResp.ok(), "qonversion.js is served by dev server").toBe(true);
    const src = await srcResp.text();
    expect(
      src,
      "subscription management URL still referenced in qonversion.js",
    ).toContain("play.google.com/store/account/subscriptions");
  });
});
