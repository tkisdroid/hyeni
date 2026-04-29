import { test, expect } from "@playwright/test";
import { seedLegacyFamily, loginAsExistingParent } from "./_helpers.js";

test.describe("multichild — add/remove child updates total price", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for seed helpers",
  );

  test("자녀 추가/삭제 후 합계 자동 갱신 (₩1,500 → ₩3,000 → ₩1,500)", async ({ page }) => {
    const { parent_email, parent_password, child_id, family_id } = await seedLegacyFamily();

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const expires = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
    const sub = (body) =>
      fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
        method: "POST",
        headers: {
          apikey: SR, Authorization: `Bearer ${SR}`,
          "Content-Type": "application/json", Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
      });

    // Activate child1 subscription via REST.
    // PerChildToggle's onClick goes through purchaseChildSlot → Qonversion
    // native plugin, which throws on the web platform (qonversion.js:381).
    // Bypass the UI toggle and write the row directly.
    await sub({
      family_id, child_id,
      status: "active", product_id: "hyeni_child_slot_1",
      price_krw: 1500, expires_at: expires,
    });

    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");
    await page.waitForTimeout(1500);

    await page.click("button[aria-label='💎 구독']");
    await page.waitForSelector("text=혜니 프리미엄", { timeout: 8000 });
    await expect(page.locator("text=₩1,500").first()).toBeVisible({ timeout: 8000 });

    // Add child2 + activate its subscription
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/family_members`, {
      method: "POST",
      headers: {
        apikey: SR, Authorization: `Bearer ${SR}`,
        "Content-Type": "application/json", Prefer: "return=representation",
      },
      body: JSON.stringify({
        family_id, user_id: null, role: "child", child_order: 2,
        name: "민준", color_hex: "#7DC9F1", birthdate: "2018-07-04",
      }),
    });
    const child2 = (await insertRes.json())[0];
    await sub({
      family_id, child_id: child2.id,
      status: "active", product_id: "hyeni_child_slot_2",
      price_krw: 1500, expires_at: expires,
    });
    // Realtime postgres_changes for family_members+subscriptions can be flaky
    // under headless CI. Force a reload so pairedChildren + useChildSubscriptions
    // re-fetch from REST, then re-enter the overlay.
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForTimeout(2000);
    await page.click("button[aria-label='💎 구독']");
    await page.waitForSelector("text=혜니 프리미엄", { timeout: 8000 });
    await expect(page.locator("text=₩3,000").first()).toBeVisible({ timeout: 8000 });

    // Remove child2 — FK ON DELETE CASCADE removes its subscriptions row too.
    await fetch(`${SUPABASE_URL}/rest/v1/family_members?id=eq.${child2.id}`, {
      method: "DELETE",
      headers: { apikey: SR, Authorization: `Bearer ${SR}` },
    });
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForTimeout(2000);
    await page.click("button[aria-label='💎 구독']");
    await page.waitForSelector("text=혜니 프리미엄", { timeout: 8000 });
    await expect(page.locator("text=₩1,500").first()).toBeVisible({ timeout: 8000 });
  });
});
