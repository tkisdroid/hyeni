import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsChild, getDbRowCount } from "./_helpers.js";

test.describe("multichild — SOS works for free-tier child", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for seed helpers",
  );

  test("무료 자녀 단말 SOS 발신 → 부모 수신 정상 (sos_events 1행 increment)", async ({ page }) => {
    const { child1_id } = await seedFamilyWith2Children();
    await loginAsChild(page, child1_id);
    await page.goto("/");
    // Wait for app init — the kkuk handler short-circuits if familyId/authUser
    // are not yet hydrated (App.jsx:8126), and that hydration takes longer on
    // a fresh anon child session than on a parent session.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4000);

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const before = await getDbRowCount("sos_events", "");

    // Trigger SOS — "💗 꾹" inserts into sos_events (App.jsx:8244).
    const sosBtn = page.locator("button:has-text('SOS'), button:has-text('꾹')").first();
    await sosBtn.waitFor({ state: "visible", timeout: 10000 });
    await sosBtn.click({ force: true });
    // RPC + audit insert + 5s cooldown — wait long enough for the row to land
    // even on slow CI runs where the child session takes longer to hydrate.
    await page.waitForTimeout(10000);

    const after = await getDbRowCount("sos_events", "");
    if (after < before + 1 && consoleErrors.length) {
      console.error("[sos-free] console errors:", consoleErrors);
    }
    expect(after).toBeGreaterThanOrEqual(before + 1);
  });
});
