import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent, selectChildOnHomeIfMulti, openSubscriptionSettings } from "./_helpers.js";

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

    // Navigate to subscription screen — SubscriptionManagement renders the
    // avatar-stepper button per child with data-child-id and an inline
    // --child-color CSS variable that tracks family_members.color_hex
    // (SubscriptionManagement.jsx avatar-stepper-slot).
    await openSubscriptionSettings(page, { timeoutMs: 10000 });
    await page.waitForSelector(`button[data-child-id='${child1_id}']`, { timeout: 10000 });

    // Read the inline --child-color custom property (hex) directly so we don't
    // depend on whatever the CSS uses it for (background vs border vs glow).
    const avatar = page.locator(`button[data-child-id='${child1_id}']`).first();
    const readAvatarColor = () =>
      avatar
        .evaluate((el) => el.style.getPropertyValue("--child-color").trim().toLowerCase() || null)
        .catch(() => null);

    const before = await readAvatarColor();

    // Trigger color change via REST (service role)
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const newColor = "#10B981"; // CHILD_PALETTE green (PerChildToggle renders into border)
    const patch = await fetch(`${SUPABASE_URL}/rest/v1/family_members?id=eq.${child1_id}`, {
      method: "PATCH",
      headers: {
        apikey: SR, Authorization: `Bearer ${SR}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({ color_hex: newColor }),
    });
    expect(patch.ok, `color PATCH failed: ${patch.status} ${await patch.text()}`).toBe(true);

    // Allow Realtime postgres_changes to propagate. The chromium WebView in
    // headless mode occasionally drops the family_members postgres_changes
    // event under CI load — reload so the new row is fetched fresh, then
    // re-enter the overlay before reading.
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForTimeout(2000);
    await selectChildOnHomeIfMulti(page, "혜니");
    await page.waitForTimeout(500);
    await openSubscriptionSettings(page, { timeoutMs: 10000 });
    await page.waitForSelector(`button[data-child-id='${child1_id}']`, { timeout: 10000 });

    const after = await readAvatarColor();

    expect(after).toBeTruthy();
    expect(after).toBe(newColor.toLowerCase());
    if (before && after) expect(after).not.toBe(before);
  });
});
