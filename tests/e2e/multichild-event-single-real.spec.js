import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent, getDbRows, selectChildOnHomeIfMulti, openParentEventAdd } from "./_helpers.js";

test.describe("multichild — single-child event creates 1 events_children row", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required (email-auth cannot pass families RLS)",
  );

  test("일정 등록 시 자녀 1명 체크 → events_children 1행 생성", async ({ page }) => {
    const { parent_email, parent_password, child1_id, family_id } = await seedFamilyWith2Children();
    const eventTitle = `수업 ${Date.now()}`;

    // Surface app-side console errors so a silent RLS / sync.js throw shows up
    // in the test output instead of looking like a "no row inserted" mystery.
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");
    // Let pairedChildren hydrate from family_members fetch before opening the modal.
    await page.waitForTimeout(2500);
    // Multi-child mode lands on the home tab; tap a child card to unlock the
    // calendar/event UI. Helper is no-op in single-child families.
    await selectChildOnHomeIfMulti(page, "혜니");
    await page.waitForTimeout(500);

    // Open event-add view from the current bottom navigation.
    await openParentEventAdd(page);
    await page.waitForSelector("input[placeholder*='학원']", { timeout: 8000 });
    await page.fill("input[placeholder*='학원']", eventTitle);
    // ChildSelector renders <input type=checkbox aria-label=<child.name>>
    // wrapped in a <label>. Use Playwright .check() — it scrolls into view
    // and asserts the checkbox transitions to checked.
    const childCheck = page.locator("input[aria-label='혜니']").first();
    await childCheck.waitFor({ state: "visible", timeout: 8000 });
    await childCheck.check();
    await expect(childCheck).toBeChecked();
    // Settle React batched setState for eventChildSelection before save click.
    await page.waitForTimeout(500);
    // EventSheet save button — class "sheet-save" with label "저장"
    // (EventSheet.jsx:112). The previous "🐰 일정 추가하기!" label was removed.
    await page.click("button.sheet-save");

    try {
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
          childIds: links.map((row) => row.child_id).sort(),
        };
      }, { timeout: 10000 }).toEqual({
        isFamilyEvent: false,
        childIds: [child1_id],
      });
    } catch (err) {
      if (consoleErrors.length) console.error("[event-single] console errors:", consoleErrors);
      throw err;
    }
  });
});
