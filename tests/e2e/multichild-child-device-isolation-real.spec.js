import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsChild } from "./_helpers.js";

test.describe("multichild — child device privacy (no sibling leakage)", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for seed helpers",
  );

  test("자녀 단말 로그인 후 DOM 에 자녀2 이름 텍스트 검색 0건", async ({ page }) => {
    const { child1_id } = await seedFamilyWith2Children();
    await loginAsChild(page, child1_id);
    await page.goto("/");

    // wait for app to fully render
    await page.waitForTimeout(3000);

    // 자녀2 이름은 "민준" — DOM 에 0건이어야 함 (privacy 원칙 5)
    const sibling = await page.locator("text=민준").count();
    expect(sibling).toBe(0);

    // 자녀1 본인 이름 "혜니"는 보여야 함
    const own = await page.locator("text=혜니").count();
    expect(own).toBeGreaterThan(0);
  });
});
