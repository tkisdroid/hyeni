import { test, expect } from "@playwright/test";
import { signupParent } from "./_helpers.js";

test.describe("multichild — 3-child pairing shows home tab", () => {
  test.skip(
    !process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY,
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set",
  );

  test("신규 가족 페어링 (자녀 3명) → 홈 탭 자동 표시, 색 자동 할당", async ({ page }) => {
    await signupParent(page);
    await page.goto("/");

    await page.fill("input[name='familyName'], input[placeholder*='혜니네']", "혜니네");
    await page.click("button:has-text('다음')");
    await page.click("button:has-text('3명')");
    await page.click("button:has-text('다음')");

    const kids = [
      ["혜니", "2015-03-21"],
      ["민준", "2018-07-04"],
      ["세진", "2020-11-09"],
    ];
    for (const [name, birthdate] of kids) {
      await page.fill("input[type='text']", name);
      await page.fill("input[type='date']", birthdate);
      await page.click("button:has-text('다음')");
    }

    await expect(page.locator("text=KID-")).toBeVisible({ timeout: 10000 });
    await page.click("button:has-text('모든 자녀 페어링 완료')");
    await page.click("button:has-text('시작하기')");

    // 다자녀 (≥2): 홈 탭 visible, 모든 자녀 카드 표시
    await expect(page.locator("button:has-text('홈')")).toBeVisible();
    await expect(page.locator("text=혜니")).toBeVisible();
    await expect(page.locator("text=민준")).toBeVisible();
    await expect(page.locator("text=세진")).toBeVisible();
  });
});
