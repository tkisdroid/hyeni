import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent, getDbRows, selectChildOnHomeIfMulti } from "./_helpers.js";

test.describe("multichild — family-all event sets is_family_event=true", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required (email-auth cannot pass families RLS)",
  );

  test("'가족 전체' 클릭 → events.is_family_event=true, events_children 0행", async ({ page }) => {
    const { parent_email, parent_password, family_id } = await seedFamilyWith2Children();
    const eventTitle = `가족 외식 ${Date.now()}`;
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");
    await page.waitForTimeout(2500);
    await selectChildOnHomeIfMulti(page, "혜니");
    await page.waitForTimeout(500);

    await page.getByRole("navigation", { name: "부모 메인 탭" })
      .last()
      .getByRole("button", { name: "일정등록" })
      .click();
    await page.fill("input[placeholder*='학원']", eventTitle);
    await page.click("button:has-text('가족 전체')");
    // EventSheet save button uses class "sheet-save" with default label "저장"
    // (EventSheet.jsx:112). Older specs targeted "🐰 일정 추가하기!" / partial
    // text — both are now obsolete. Use the class anchor for stability.
    await page.click("button.sheet-save");
    await expect.poll(async () => {
      const events = await getDbRows(
        "events",
        `family_id=eq.${family_id}&title=eq.${encodeURIComponent(eventTitle)}`,
        "id,is_family_event",
      );
      if (!events[0]) return null;
      const links = await getDbRows(
        "events_children",
        `event_id=eq.${events[0].id}`,
        "event_id,child_id",
      );
      return {
        isFamilyEvent: events[0].is_family_event,
        linkCount: links.length,
      };
    }, { timeout: 10000 }).toEqual({
      isFamilyEvent: true,
      linkCount: 0,
    });
  });
});
