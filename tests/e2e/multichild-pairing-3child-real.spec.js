import { test, expect } from "@playwright/test";
import { seedFamilyWith3Children, loginAsExistingParent } from "./_helpers.js";

test.describe("multichild — 3-child mode UI (seeded family)", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required (email-auth cannot pass families RLS)",
  );

  test("자녀 3명 가족 → 홈 탭 visible, 모든 자녀 카드 표시", async ({ page }) => {
    const { parent_email, parent_password } = await seedFamilyWith3Children();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    // 다자녀 (≥2): 홈 탭 visible, 모든 자녀 카드 표시
    await expect(page.locator("button:has-text('홈')").first()).toBeVisible();
    await expect(page.locator("text=혜니").first()).toBeVisible();
    await expect(page.locator("text=민준").first()).toBeVisible();
    await expect(page.locator("text=세진").first()).toBeVisible();
  });
});
