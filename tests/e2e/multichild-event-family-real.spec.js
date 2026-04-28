import { test, expect } from "@playwright/test";
import { signupParent, getDbRowCount } from "./_helpers.js";

test.describe("multichild — family-all event sets is_family_event=true", () => {
  test.skip(
    !process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY,
    "real Supabase env required",
  );

  test("'가족 전체' 클릭 → events.is_family_event=true, events_children 0행", async ({ page }) => {
    await signupParent(page);
    await page.goto("/");

    await page.fill("input[name='familyName'], input[placeholder*='혜니네']", "혜니네");
    await page.click("button:has-text('다음')");
    await page.click("button:has-text('2명')");
    await page.click("button:has-text('다음')");
    for (const [name, birthdate] of [["혜니","2015-03-21"], ["민준","2018-07-04"]]) {
      await page.fill("input[type='text']", name);
      await page.fill("input[type='date']", birthdate);
      await page.click("button:has-text('다음')");
    }
    await expect(page.locator("text=KID-")).toBeVisible({ timeout: 10000 });
    await page.click("button:has-text('모든 자녀 페어링 완료')");
    await page.click("button:has-text('시작하기')");

    const before = await getDbRowCount("events_children", "");

    await page.click("button:has-text('+'), button:has-text('일정 추가')");
    await page.fill("input[type='text']", "가족 외식");
    await page.click("button:has-text('가족 전체')");
    await page.click("button:has-text('저장')");
    await page.waitForTimeout(2000);

    // family event → no rows added in events_children
    const after = await getDbRowCount("events_children", "");
    expect(after).toBe(before);
  });
});
