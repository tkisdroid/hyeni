import { test, expect } from "@playwright/test";
import { seedLegacyFamilyWithSubscription, loginAsExistingParent } from "./_helpers.js";

test.describe("multichild — legacy 1-child grandfather", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for legacy seed helpers",
  );

  test("기존 1자녀 가족 → grandfather 자동 발급 → 첫째 active", async ({ page }) => {
    const { parent_email, parent_password, child_id } = await seedLegacyFamilyWithSubscription();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    await page.click("button:has-text('설정')");
    await expect(page.locator("text=프리미엄")).toBeVisible();
    await expect(page.locator(`[data-child-id='${child_id}'] [role='switch']`)).toBeChecked();
  });
});
