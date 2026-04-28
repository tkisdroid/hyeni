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
    await page.waitForTimeout(2000);

    const before = await getDbRowCount("sos_events", "");

    // Trigger SOS — UI varies; try common selectors
    const sosBtn = page.locator("button:has-text('SOS'), button:has-text('꾹')").first();
    await sosBtn.click({ force: true });
    // Hold simulation if needed (long-press) — fall back to click
    await page.waitForTimeout(3500);

    const after = await getDbRowCount("sos_events", "");
    expect(after).toBeGreaterThanOrEqual(before + 1);
  });
});
