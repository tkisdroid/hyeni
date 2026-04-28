import { test, expect } from "@playwright/test";
import { seedLegacy2ChildFamilyWithSubscription, loginAsExistingParent } from "./_helpers.js";

test.describe("multichild — legacy 2-child grandfather (first only)", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for legacy seed helpers",
  );

  test("기존 2자녀 가족 → 첫째 grandfather active, 둘째 free", async ({ page }) => {
    const { parent_email, parent_password, child1_id, child2_id } =
      await seedLegacy2ChildFamilyWithSubscription();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    await page.click("button:has-text('설정')");
    await expect(page.locator(`[data-child-id='${child1_id}'] [role='switch']`)).toBeChecked();
    await expect(page.locator(`[data-child-id='${child2_id}'] [role='switch']`)).not.toBeChecked();
    await expect(page.locator("text=₩1,500/월")).toBeVisible();
  });
});
