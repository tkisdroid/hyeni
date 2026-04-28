import { test, expect } from "@playwright/test";
import { signupParent } from "./_helpers.js";

test.describe("multichild — 1-child pairing keeps current UI", () => {
  test.skip(
    !process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY,
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for real-services E2E",
  );

  test("신규 가족 페어링 (자녀 1명) → 1자녀 모드 큰틀 유지", async ({ page }) => {
    await signupParent(page);
    await page.goto("/");

    await page.fill("input[name='familyName'], input[placeholder*='혜니네']", "혜니네");
    await page.click("button:has-text('다음')");
    await page.click("button:has-text('1명')");
    await page.click("button:has-text('다음')");
    await page.fill("input[type='text']", "혜니");
    await page.fill("input[type='date']", "2015-03-21");
    await page.click("button:has-text('다음')");

    await expect(page.locator("text=KID-")).toBeVisible({ timeout: 10000 });
    await page.click("button:has-text('모든 자녀 페어링 완료')");
    await page.click("button:has-text('시작하기')");

    // 1자녀 모드: 홈 탭 hidden
    await expect(page.locator("button:has-text('홈')")).not.toBeVisible();
    await expect(page.locator("text=혜니")).toBeVisible();
  });
});
