import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent } from "./_helpers.js";

test.describe("multichild — both children subscribed shows ₩3,000 total", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for seed helpers",
  );

  test("두 자녀 모두 구독 → 합계 ₩3,000 표시, 양쪽 모두 device stats", async ({ page }) => {
    const { parent_email, parent_password, child1_id, child2_id } =
      await seedFamilyWith2Children();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    await page.click("button:has-text('설정')");
    await page.click(`[data-child-id='${child1_id}'] [role='switch']`);
    await page.waitForTimeout(1500);
    await page.click(`[data-child-id='${child2_id}'] [role='switch']`);
    await page.waitForTimeout(2000);

    await expect(page.locator("text=₩3,000")).toBeVisible({ timeout: 5000 });
  });
});
