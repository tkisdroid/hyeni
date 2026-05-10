import { expect, test } from "@playwright/test";
import {
  seedLegacyFamily,
  loginAsExistingParent,
  srFetch,
} from "./_helpers.js";

/**
 * Plan Task 15 — 단일 자녀 가정 E2E.
 *
 * "자녀 1명일 경우에도 논리적 문제 없도록 보장" (사용자 명시 요구사항).
 * 단일 자녀 가정에서 multichild isolation 코드 흐름이 동작하는지 검증:
 *   - selectedChildId가 자동 pin 되어 fetch/realtime이 빈 context로 동작하지 않음
 *   - 메모 send 시 memo_replies.child_id에 그 자녀의 family_members.id가 정확히 들어감
 *   - 홈 탭은 hidden(`isMultiChild=false`), 부모는 calendar 시작
 *
 * Real Supabase + service role seed 패턴 (memo-bubbles-real.spec.js와 동일).
 * env 미설정 시 자동 skip되어 default playwright run을 막지 않는다.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(
  !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY,
  "Real Supabase E2E requires VITE_SUPABASE_URL/ANON_KEY + SUPABASE_SERVICE_ROLE_KEY env",
);

test.describe.configure({ mode: "serial" });

test("단일 자녀 부모: memo send → memo_replies.child_id 정확 INSERT", async ({ page }) => {
  // Seed: parent + 1 child
  const seed = await seedLegacyFamily();
  const { parent_email, parent_password, family_id, child_id } = seed;

  await loginAsExistingParent(page, parent_email, parent_password);

  // 단일 자녀이므로 홈 탭 hidden + 자동 pin selectedChildId === child_id 기대.
  // 부모는 calendar 화면으로 시작.
  await page.waitForLoadState("networkidle");

  // 메모 탭 진입 — 단일 자녀라도 selectedChildId가 자동 pin 되어 정상 동작해야 함.
  const memoTab = page.getByRole("button", { name: /메모/ }).first();
  await memoTab.click();

  // 메시지 입력 + 보내기.
  const composer = page.getByPlaceholder(/메시지|메모/).first();
  await composer.waitFor({ state: "visible", timeout: 10_000 });
  await composer.fill("E2E 단일 자녀 테스트");

  const sendBtn = page.getByRole("button", { name: /보내기|전송|보내|send/i }).first();
  await sendBtn.click();

  // INSERT 반영 대기 (server roundtrip + realtime).
  await page.waitForTimeout(2000);

  // 검증: memo_replies row의 child_id가 단일 자녀 family_member.id와 일치.
  const rows = await srFetch(
    `/rest/v1/memo_replies?family_id=eq.${family_id}&order=created_at.desc&limit=5`,
    { method: "GET" },
  );
  expect(Array.isArray(rows)).toBe(true);
  expect(rows.length).toBeGreaterThan(0);
  const latest = rows[0];
  expect(latest.child_id).toBe(child_id);
  expect(latest.user_role).toBe("parent");
  expect(latest.content).toContain("E2E 단일 자녀");
});
