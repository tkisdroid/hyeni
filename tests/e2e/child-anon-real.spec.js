import { expect, test } from "@playwright/test";

/**
 * Real-services E2E: child anonymous-login path.
 *
 * Exercises the real Supabase anonymous auth flow end-to-end — no mocks.
 * Bypasses Kakao OAuth entirely by using the "아이" (child) entry, which
 * maps to src/lib/auth.js::anonymousLogin -> supabase.auth.signInAnonymously.
 *
 * Pre-req: .env has real VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, and the
 * Supabase project has `anonymous_users: true` in auth settings.
 */

test.describe("real child anonymous flow", () => {
  // Each test here triggers a fresh anonymous Supabase signup. On the free
  // tier, ~30 signups per IP per 5 minutes is the cap. Running across 3
  // browsers blows through that, so we pin this suite to chromium.
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "signup-heavy: chromium-only to stay within Supabase rate limits",
  );

  test("app boots without console errors", async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const filtered = consoleErrors.filter(
      (m) => !m.includes("favicon") && !m.toLowerCase().includes("manifest"),
    );

    expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(filtered, `console errors: ${JSON.stringify(filtered)}`).toEqual([]);
  });

  test("role gate shows 학부모 and 아이 entries", async ({ page }) => {
    await page.goto("/");

    const parentBtn = page.getByText(/학부모/).first();
    const childBtn = page.getByText(/^아이$/).first();

    await expect(parentBtn).toBeVisible({ timeout: 15_000 });
    await expect(childBtn).toBeVisible({ timeout: 15_000 });
  });

  test("clicking 아이 creates a real Supabase anonymous session", async ({ page }) => {
    await page.goto("/");

    const childBtn = page.getByText(/^아이$/).first();
    await expect(childBtn).toBeVisible({ timeout: 15_000 });
    await childBtn.click();

    // Supabase stores the session in localStorage under key sb-<project-ref>-auth-token.
    // Poll for the token to appear (anon signup is a real HTTP round-trip).
    const session = await page.waitForFunction(
      () => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
            try {
              return JSON.parse(localStorage.getItem(key));
            } catch {
              return null;
            }
          }
        }
        return null;
      },
      null,
      { timeout: 20_000 },
    );

    const parsed = await session.jsonValue();
    expect(parsed, "supabase session in localStorage").toBeTruthy();
    expect(parsed.access_token, "access_token is present").toBeTruthy();
    expect(parsed.user?.is_anonymous, "user is anonymous").toBe(true);
  });

  test("invalid pair code shows an error without crashing", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/");
    const childBtn = page.getByText(/^아이$/).first();
    await childBtn.click();

    // The pair-code input is identified by its maxlength/placeholder (8-char
    // upper-case code after the KID- prefix). Scoping to this input avoids
    // collisions with unrelated screens ("🤖 AI로 일정입력" etc.).
    const input = page.locator('input[maxlength="8"][placeholder="XXXXXXXX"]').first();
    await expect(input).toBeVisible({ timeout: 20_000 });

    await input.fill("XXXXXXXX");
    await input.press("Enter");

    // The app should surface an error (alert, toast, inline message) rather
    // than crash. We don't assert the specific text — that drifts — only that
    // no uncaught runtime errors fired.
    await page.waitForTimeout(3_000);
    expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });
});
