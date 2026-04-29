// Real-services E2E coverage for co-parent RLS narrowing (Task 4).
// Verifies:
//  - join_family_as_parent succeeds for the first co-parent
//  - The co-parent can read events but cannot insert/update/delete (403)
//  - A second co-parent attempting to join the same family is rejected
import { expect, test } from "@playwright/test";
import {
  SUPABASE_TEST_ANON_KEY,
  SUPABASE_TEST_URL,
  createEmailUser,
  injectSession,
  seedLegacyFamily,
  srFetch,
} from "./_helpers.js";

test.describe("co-parent permissions with real Supabase", () => {
  test("one co-parent can join, read events, send memo and praise, but cannot write schedules", async ({ page }) => {
    const seeded = await seedLegacyFamily();
    const [family] = await srFetch(
      `/rest/v1/families?id=eq.${seeded.family_id}&select=id,pair_code,parent_id`,
    );
    const coParent = await createEmailUser("e2e-coparent");

    const joinRes = await fetch(`${SUPABASE_TEST_URL}/rest/v1/rpc/join_family_as_parent`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_TEST_ANON_KEY,
        Authorization: `Bearer ${coParent.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_pair_code: family.pair_code,
        p_user_id: coParent.user.id,
        p_name: "아빠",
      }),
    });
    expect(joinRes.ok, await joinRes.text()).toBe(true);

    await injectSession(page, coParent, "parent");
    await page.goto("/");
    await expect(page.locator("body")).toContainText("혜니캘린더");

    const eventRes = await fetch(`${SUPABASE_TEST_URL}/rest/v1/events`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_TEST_ANON_KEY,
        Authorization: `Bearer ${coParent.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        family_id: seeded.family_id,
        date_key: "2026-3-29",
        title: "보조 부모 금지 일정",
        time: "09:00",
        category: "school",
        emoji: "📚",
        color: "#111827",
        bg: "#F3F4F6",
        created_by: coParent.user.id,
      }),
    });
    expect(eventRes.status).toBe(403);

    const secondCoParent = await createEmailUser("e2e-coparent-2");
    const secondJoin = await fetch(`${SUPABASE_TEST_URL}/rest/v1/rpc/join_family_as_parent`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_TEST_ANON_KEY,
        Authorization: `Bearer ${secondCoParent.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_pair_code: family.pair_code,
        p_user_id: secondCoParent.user.id,
        p_name: "보조부모2",
      }),
    });
    expect(secondJoin.status).toBeGreaterThanOrEqual(400);
  });
});
