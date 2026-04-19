import { expect, test } from "@playwright/test";

/**
 * Real-services E2E: error injection.
 *
 * Simulates degraded network conditions to verify the app degrades
 * gracefully (no uncaught exceptions, user still sees meaningful content).
 */

const SUPABASE_HOST_PATTERN = /supabase\.co/i;

test.describe("error injection: network degradation", () => {
  test("offline at boot: app still renders without uncaught errors", async ({ page, context }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    // Go fully offline before any navigation so nothing loads from network.
    await context.setOffline(true);

    // Vite dev server is local so the HTML may still be served from cache/
    // prefetch; if the very first navigation fails, that's acceptable — we
    // retry online to confirm the app itself isn't corrupt.
    try {
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: 10_000 });
    } catch {
      // Expected in some configurations.
    }

    await context.setOffline(false);

    // The app should still boot when online.
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test("Supabase REST returns 503: app does not crash", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    // Intercept any REST (not auth) call to the Supabase host and return 503.
    await page.route(
      (url) => SUPABASE_HOST_PATTERN.test(url.hostname) && url.pathname.startsWith("/rest/"),
      (route) => {
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "service unavailable" }),
        });
      },
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // App must still render the role gate — role gate doesn't depend on REST.
    const parentBtn = page.getByText(/학부모/).first();
    await expect(parentBtn).toBeVisible({ timeout: 10_000 });

    // No uncaught errors from the 503s; they should be caught and logged.
    expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test("Supabase auth rejected (401): child flow still shows a usable screen", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    // Reject the anonymous signup; app must recover to an interactive state.
    await page.route(
      (url) => SUPABASE_HOST_PATTERN.test(url.hostname) && url.pathname === "/auth/v1/signup",
      (route) => {
        route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "signup_disabled", msg: "test injection" }),
        });
      },
    );

    await page.goto("/");
    const childBtn = page.getByText(/^아이$/).first();
    await expect(childBtn).toBeVisible({ timeout: 10_000 });
    await childBtn.click();

    // Give the app a window to handle the rejected signup.
    await page.waitForTimeout(2_500);

    // Body should still have content; no white-screen-of-death.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.trim().length, "body has non-trivial content").toBeGreaterThan(10);

    expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });
});
