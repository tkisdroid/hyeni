import { test, expect } from "@playwright/test";
import { seedLegacyFamily, loginAsExistingParent } from "./_helpers.js";

test.describe("multichild — add/remove child updates total price", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for seed helpers",
  );

  test("자녀 추가/삭제 후 합계 자동 갱신 (₩1,500 → ₩3,000 → ₩1,500)", async ({ page }) => {
    const { parent_email, parent_password, child_id, family_id } = await seedLegacyFamily();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");
    await page.waitForTimeout(2000);

    // Subscribe child1
    await page.click("button:has-text('설정')");
    await page.click(`[data-child-id='${child_id}'] [role='switch']`);
    await page.waitForTimeout(1500);
    await expect(page.locator("text=₩1,500")).toBeVisible({ timeout: 5000 });

    // Add a 2nd child via REST + subscribe
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    await page.waitForTimeout(2500); // realtime
    await page.click(`[data-child-id='${child2.id}'] [role='switch']`);
    await page.waitForTimeout(2000);
    await expect(page.locator("text=₩3,000")).toBeVisible({ timeout: 5000 });

    // Remove child2 (delete row) — total should drop back
    await fetch(`${SUPABASE_URL}/rest/v1/family_members?id=eq.${child2.id}`, {
      method: "DELETE",
      headers: { apikey: SR, Authorization: `Bearer ${SR}` },
    });
    await page.waitForTimeout(2500);
    await expect(page.locator("text=₩1,500")).toBeVisible({ timeout: 5000 });
  });
});
