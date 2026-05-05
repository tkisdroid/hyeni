import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent, openSubscriptionSettings } from "./_helpers.js";

test.describe("multichild — both children subscribed shows ₩3,000 total", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for seed helpers",
  );

  test("두 자녀 모두 구독 → 합계 ₩3,000 표시, 양쪽 모두 device stats", async ({ page }) => {
    const { parent_email, parent_password, child1_id, child2_id, family_id } =
      await seedFamilyWith2Children();

    // Activate both children's subscriptions via service-role REST. The UI
    // PerChildToggle path goes through Qonversion native, which throws on web
    // (qonversion.js:381). Write both rows directly, then assert the live UI
    // PriceSummary reflects ₩3,000 once realtime hydrates.
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const expires = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
    for (const [child_id, product_id] of [
      [child1_id, "hyeni_child_slot_1"],
      [child2_id, "hyeni_child_slot_2"],
    ]) {
      await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
        method: "POST",
        headers: {
          apikey: SR, Authorization: `Bearer ${SR}`,
          "Content-Type": "application/json", Prefer: "return=minimal",
        },
        body: JSON.stringify({
          family_id, child_id,
          status: "active", product_id, price_krw: 1500, expires_at: expires,
        }),
      });
    }

    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    await openSubscriptionSettings(page, { timeoutMs: 8000 });
    // avatar-stepper button (data-child-id) replaced PerChildToggle's
    // nested [role='switch'] in the SubscriptionManagement refactor.
    await page.waitForSelector(`button[data-child-id='${child1_id}']`, { timeout: 8000 });
    await expect(page.locator(`button[data-child-id='${child1_id}']`)).toHaveAttribute("data-filled", "true");
    await expect(page.locator(`button[data-child-id='${child2_id}']`)).toHaveAttribute("data-filled", "true");

    // PriceSummary renders the SELECTED plan's total ("/월" suffix). The
    // default plan is "annual" → annualPriceForCount, so click the monthly
    // plan card to surface the ₩3,000 monthly total
    // (SubscriptionManagement.jsx PriceSummary call).
    await page.click('button.plan-card:has-text("월 플랜")');
    await expect(page.locator("text=₩3,000").first()).toBeVisible({ timeout: 8000 });
  });
});
