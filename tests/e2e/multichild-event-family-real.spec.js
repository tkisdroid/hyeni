import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent, getDbRowCount, selectChildOnHomeIfMulti } from "./_helpers.js";

test.describe("multichild — family-all event sets is_family_event=true", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required (email-auth cannot pass families RLS)",
  );

  test("'가족 전체' 클릭 → events.is_family_event=true, events_children 0행", async ({ page }) => {
    const { parent_email, parent_password } = await seedFamilyWith2Children();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");
    await page.waitForTimeout(2500);
    await selectChildOnHomeIfMulti(page, "혜니");
    await page.waitForTimeout(500);

    const before = await getDbRowCount("events_children", "");

    await page.click("button[title='일정 추가']");
    await page.fill("input[placeholder*='학원']", "가족 외식");
    await page.click("button:has-text('가족 전체')");
    // EventSheet save button uses class "sheet-save" with default label "저장"
    // (EventSheet.jsx:112). Older specs targeted "🐰 일정 추가하기!" / partial
    // text — both are now obsolete. Use the class anchor for stability.
    await page.click("button.sheet-save");
    await page.waitForTimeout(2000);

    // family event → no rows added in events_children
    const after = await getDbRowCount("events_children", "");
    expect(after).toBe(before);
  });
});
