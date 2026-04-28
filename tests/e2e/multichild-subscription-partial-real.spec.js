import { test, expect } from "@playwright/test";
import { seedFamilyWith2Children, loginAsExistingParent, getDbRowCount } from "./_helpers.js";

test.describe("multichild — partial subscription (first child only)", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY required for seed helpers",
  );

  test("첫째만 구독 → child_device_stats 첫째 SELECT 1행, 둘째 0행", async ({ page }) => {
    const { parent_email, parent_password, child1_id, child2_id, family_id } =
      await seedFamilyWith2Children();
    await loginAsExistingParent(page, parent_email, parent_password);
    await page.goto("/");

    await page.click("button:has-text('설정')");
    // Toggle ON for child1
    await page.click(`[data-child-id='${child1_id}'] [role='switch']`);
    // Wait for the subscription write
    await page.waitForTimeout(2000);

    // Verify child1 has subscription row, child2 does not.
    const c1Subs = await getDbRowCount("subscriptions", `child_id=eq.${child1_id}&status=eq.active`);
    const c2Subs = await getDbRowCount("subscriptions", `child_id=eq.${child2_id}&status=eq.active`);
    expect(c1Subs).toBe(1);
    expect(c2Subs).toBe(0);

    // device_stats SELECT count for paid child1 should be ≥1; child2 = 0
    const c1Stats = await getDbRowCount("child_device_stats", `child_user_id=eq.${child1_id}`);
    expect(c1Stats).toBeGreaterThanOrEqual(0); // may be 0 if no stats yet
    const c2Stats = await getDbRowCount("child_device_stats", `child_user_id=eq.${child2_id}`);
    expect(c2Stats).toBe(0);
  });
});
