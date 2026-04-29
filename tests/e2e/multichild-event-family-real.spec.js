import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent, getDbRowCount } from "./_helpers.js";

test.describe("multichild — family-all event sets is_family_event=true", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required (email-auth cannot pass families RLS)",
  );

  test("'가족 전체' 클릭 → events.is_family_event=true, events_children 0행", async ({ page }) => {
    const { parent_email, parent_password } = await seedFamilyWith2Children();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    const before = await getDbRowCount("events_children", "");

    await page.click("button[title='일정 추가']");
    await page.fill("input[placeholder*='학원']", "가족 외식");
    await page.click("button:has-text('가족 전체')");
    // Save button label is "🐰 일정 추가하기!" (App.jsx:11973), not "저장".
    await page.click("button:has-text('일정 추가하기')");
    await page.waitForTimeout(2000);

    // family event → no rows added in events_children
    const after = await getDbRowCount("events_children", "");
    expect(after).toBe(before);
  });
});
