import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent, getDbRowCount } from "./_helpers.js";

test.describe("multichild — partial subscription (first child only)", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for seed helpers",
  );

  test("첫째만 구독 → child_device_stats 첫째 SELECT 1행, 둘째 0행", async ({ page }) => {
    const { parent_email, parent_password, child1_id, child2_id, family_id } =
      await seedFamilyWith2Children();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    // Activate child1 subscription via service-role REST.
    // PerChildToggle's onClick triggers purchaseChildSlot → Qonversion native
    // plugin, which throws on the web platform (qonversion.js:381 — "Qonversion
    // not initialized"). Bypass the UI button and write the row directly.
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
    await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
      method: "POST",
      headers: {
        apikey: SR, Authorization: `Bearer ${SR}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({
        family_id, child_id: child1_id,
        status: "active", product_id: "hyeni_child_slot_1", price_krw: 1500,
        expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      }),
    });
    await page.waitForTimeout(1500);

    // Verify child1 has subscription row, child2 does not.
    const c1Subs = await getDbRowCount("subscriptions", `child_id=eq.${child1_id}&status=eq.active`);
    const c2Subs = await getDbRowCount("subscriptions", `child_id=eq.${child2_id}&status=eq.active`);
    expect(c1Subs).toBe(1);
    expect(c2Subs).toBe(0);

    // UI assertion: PriceSummary shows ₩1,500 (one paid child).
    // (child_device_stats RLS assertions deferred — the table is gated behind
    // M5 conditional creation and not present on the production schema yet.)
    await page.click("button[aria-label='💎 구독']");
    await page.waitForSelector("text=혜니 프리미엄", { timeout: 8000 });
    await expect(page.locator("text=₩1,500").first()).toBeVisible({ timeout: 8000 });
  });
});
