import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent, getDbRowCount, selectChildOnHomeIfMulti } from "./_helpers.js";

test.describe("multichild — single-child event creates 1 events_children row", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required (email-auth cannot pass families RLS)",
  );

  test("일정 등록 시 자녀 1명 체크 → events_children 1행 생성", async ({ page }) => {
    const { parent_email, parent_password } = await seedFamilyWith2Children();

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

    const before = await getDbRowCount("events_children", "");

    // Open event-add modal
    await page.click("button[title='일정 추가']");
    await page.waitForSelector("input[placeholder*='학원']", { timeout: 8000 });
    await page.fill("input[placeholder*='학원']", "수업");
    // ChildSelector renders <input type=checkbox aria-label=<child.name>>
    // wrapped in a <label>. Use Playwright .check() — it scrolls into view
    // and asserts the checkbox transitions to checked.
    const childCheck = page.locator("input[aria-label='혜니']").first();
    await childCheck.waitFor({ state: "visible", timeout: 8000 });
    await childCheck.check();
    await expect(childCheck).toBeChecked();
    // Settle React batched setState for eventChildSelection before save click.
    await page.waitForTimeout(500);
    // Save button label is "🐰 일정 추가하기!" (App.jsx:11973). Match the full
    // emoji+label form so we don't accidentally hit a different button that
    // happens to contain "일정 추가" substring.
    await page.click("button:has-text('🐰 일정 추가하기!')");

    // Wait for INSERT events + INSERT events_children to settle.
    await page.waitForTimeout(5000);

    const after = await getDbRowCount("events_children", "");
    if (after !== before + 1 && consoleErrors.length) {
      console.error("[event-single] console errors:", consoleErrors);
    }
    expect(after).toBe(before + 1);
  });
});
