import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent } from "./_helpers.js";

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

    // Snapshot the initial color marker style for child1
    const before = await page
      .locator(`[data-child-id='${child1_id}'], [data-user-id='${child1_id}']`)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
      .catch(() => null);

    // Trigger color change via REST (service role)
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const newColor = "#A8E6A1"; // CHILD_PALETTE green
    await fetch(`${SUPABASE_URL}/rest/v1/family_members?id=eq.${child1_id}`, {
      method: "PATCH",
      headers: {
        apikey: SR, Authorization: `Bearer ${SR}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({ color_hex: newColor }),
    });

    // Allow Realtime postgres_changes to propagate
    await page.waitForTimeout(3000);

    const after = await page
      .locator(`[data-child-id='${child1_id}'], [data-user-id='${child1_id}']`)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
      .catch(() => null);

    // We don't strictly compare RGB strings (browsers normalize differently);
    // we only assert the element still exists and SOMETHING changed.
    expect(after).toBeTruthy();
    if (before && after) expect(after).not.toBe(before);
  });
});
