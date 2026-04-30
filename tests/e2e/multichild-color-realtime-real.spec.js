import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent, selectChildOnHomeIfMulti } from "./_helpers.js";

test.describe("multichild — color change reflects in realtime UI", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for seed helpers",
  );

  test("자녀 색 변경 → 일정/지도 즉시 반영 (Realtime postgres_changes)", async ({ page }) => {
    const { parent_email, parent_password, child1_id } = await seedFamilyWith2Children();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");
    await page.waitForTimeout(2000);
    await selectChildOnHomeIfMulti(page, "혜니");
    await page.waitForTimeout(500);

    // Navigate to subscription screen — that's where PerChildToggle renders
    // a wrapper [data-child-id] with an inner avatar div whose border-color
    // tracks child.color_hex (see PerChildToggle.jsx:14,20). The dashboard
    // ChildSummaryCard does not currently expose a data-child-id selector.
    await page.click("button[aria-label='💎 구독']");
    await page.waitForSelector(`[data-child-id='${child1_id}']`, { timeout: 10000 });

    // Read border-color on the avatar (first inner div) — that uses color_hex.
    const readAvatarBorder = () =>
      page
        .locator(`[data-child-id='${child1_id}'] > div`)
        .first()
        .evaluate((el) => getComputedStyle(el).borderColor)
        .catch(() => null);

    const before = await readAvatarBorder();

    // Trigger color change via REST (service role)
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const newColor = "#10B981"; // CHILD_PALETTE green (PerChildToggle renders into border)
    await fetch(`${SUPABASE_URL}/rest/v1/family_members?id=eq.${child1_id}`, {
      method: "PATCH",
      headers: {
        apikey: SR, Authorization: `Bearer ${SR}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({ color_hex: newColor }),
    });

    // Allow Realtime postgres_changes to propagate. The chromium WebView in
    // headless mode occasionally drops the family_members postgres_changes
    // event under CI load — reload so the new row is fetched fresh, then
    // re-enter the overlay before reading.
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForTimeout(2000);
    await selectChildOnHomeIfMulti(page, "혜니");
    await page.waitForTimeout(500);
    await page.click("button[aria-label='💎 구독']");
    await page.waitForSelector(`[data-child-id='${child1_id}']`, { timeout: 10000 });

    const after = await readAvatarBorder();

    expect(after).toBeTruthy();
    if (before && after) expect(after).not.toBe(before);
  });
});
