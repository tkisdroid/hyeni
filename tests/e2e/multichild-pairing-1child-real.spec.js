import { test, expect } from "@playwright/test";
import { seedLegacyFamily, loginAsExistingParent } from "./_helpers.js";

test.describe("multichild — 1-child mode UI (seeded family)", () => {
  // Email-auth signup cannot pass the families.insert RLS policy
  // (only Kakao sessions are permitted — see family-journey-real.spec.js:124).
  // We seed a 1-child family via service role then login as the parent.
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required (email-auth cannot pass families RLS)",
  );

  test("자녀 1명 가족 → 홈 탭 hidden, 자녀 이름 표시", async ({ page }) => {
    const { parent_email, parent_password } = await seedLegacyFamily();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    // 1자녀 모드: 홈 탭 hidden
    await expect(page.locator("button:has-text('홈')")).not.toBeVisible();
    await expect(page.locator("text=혜니")).toBeVisible();
  });
});
