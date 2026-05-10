import { expect, test } from "@playwright/test";
import {
  seedFamilyWith2Children,
  loginAsExistingParent,
  srFetch,
  selectChildOnHomeIfMulti,
} from "./_helpers.js";

/**
 * Plan Task 16 — multichild isolation E2E.
 *
 * 부모가 자녀 A를 선택 후 send한 메모는 child_id=A로, 자녀 B를 선택 후 send한 메모는
 * child_id=B로 INSERT 되어 자녀 device 간 thread가 정확히 분리되는지 검증.
 *
 * Edge function의 push routing(targetChildUserId)도 client에서 함께 전달되어
 * 다른 자녀 device에는 알림음이 가지 않지만, push 검증은 unit + 실 device로 별도
 * cover. 이 spec은 DB INSERT의 정확성에 집중한다.
 *
 * Real Supabase + service role seed 패턴.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(
  !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY,
  "Real Supabase E2E requires VITE_SUPABASE_URL/ANON_KEY + SUPABASE_SERVICE_ROLE_KEY env",
);

test.describe.configure({ mode: "serial" });

test("multichild 부모: 자녀별 send → memo_replies.child_id로 thread 격리", async ({ page }) => {
  // Seed: parent + 2 children (혜니, 민준)
  const seed = await seedFamilyWith2Children();
  const { parent_email, parent_password, family_id, child1_id, child2_id } = seed;

  await loginAsExistingParent(page, parent_email, parent_password);
  await page.waitForLoadState("networkidle");

  // 자녀 1(혜니) 선택 → 메모 → send
  await selectChildOnHomeIfMulti(page, "혜니");
  let memoTab = page.getByRole("button", { name: /메모/ }).first();
  await memoTab.click();
  let composer = page.getByPlaceholder(/메시지|메모/).first();
  await composer.waitFor({ state: "visible", timeout: 10_000 });
  await composer.fill("혜니에게 보내는 E2E 메시지");
  await page.getByRole("button", { name: /보내기|전송|보내|send/i }).first().click();
  await page.waitForTimeout(1500);

  // 자녀 2(민준) 선택 → 메모 → send
  const homeTab = page.getByRole("button", { name: /^홈/ }).first();
  await homeTab.click();
  await selectChildOnHomeIfMulti(page, "민준");
  memoTab = page.getByRole("button", { name: /메모/ }).first();
  await memoTab.click();
  composer = page.getByPlaceholder(/메시지|메모/).first();
  await composer.waitFor({ state: "visible", timeout: 10_000 });
  await composer.fill("민준에게 보내는 E2E 메시지");
  await page.getByRole("button", { name: /보내기|전송|보내|send/i }).first().click();
  await page.waitForTimeout(1500);

  // 검증: memo_replies에 두 row 각각의 child_id가 서로 다른 자녀 ID로 들어감
  const rows = await srFetch(
    `/rest/v1/memo_replies?family_id=eq.${family_id}&user_role=eq.parent&order=created_at.desc&limit=5`,
    { method: "GET" },
  );
  expect(Array.isArray(rows)).toBe(true);
  expect(rows.length).toBeGreaterThanOrEqual(2);

  const 혜니Row = rows.find((r) => r.content?.includes("혜니에게"));
  const 민준Row = rows.find((r) => r.content?.includes("민준에게"));

  expect(혜니Row).toBeTruthy();
  expect(민준Row).toBeTruthy();
  expect(혜니Row.child_id).toBe(child1_id);
  expect(민준Row.child_id).toBe(child2_id);
  expect(혜니Row.child_id).not.toBe(민준Row.child_id);
});
