import { test, expect } from "@playwright/test";
import { seedLegacy2ChildFamilyWithSubscription, loginAsExistingParent, openSubscriptionSettings } from "./_helpers.js";

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

    await openSubscriptionSettings(page, { timeoutMs: 8000 });
    // SubscriptionManagement now uses avatar-stepper buttons with data-child-id
    // and data-filled="true|false" instead of nested role="switch" toggles
    // (legacy PerChildToggle layout was removed in the avatar-stepper refactor).
    await page.waitForSelector(`button[data-child-id='${child1_id}']`, { timeout: 8000 });
    await expect(page.locator(`button[data-child-id='${child1_id}']`)).toHaveAttribute("data-filled", "true");
    await expect(page.locator(`button[data-child-id='${child2_id}']`)).toHaveAttribute("data-filled", "false");
    await expect(page.locator("text=₩1,500").first()).toBeVisible();
  });
});
