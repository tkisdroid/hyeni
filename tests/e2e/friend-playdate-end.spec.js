import { test, expect } from '@playwright/test';
import { installFriendPlaydateMocks } from './_friend-playdate-fixtures.js';

test.describe('Friend Playdate — end session', () => {
  test('아이가 그만 놀래요 → PATCH friend_playdate_sessions + push-notify(playdate_ended)', async ({ page }) => {
    const state = await installFriendPlaydateMocks(page, {
      role: 'child',
      activeSession: {
        id: 'sess-1',
        public_place_id: '66666666-6666-4666-8666-666666666666',
        family_a_id: '11111111-1111-4111-8111-111111111111',
        family_b_id: '44444444-4444-4444-8444-444444444444',
        started_at: new Date().toISOString(),
        stopped_at: null,
        stop_reason: null,
        friend_child_name: '지민',
      },
    });

    // getMyFamily()는 family_members.eq("user_id").maybeSingle() → families.eq("id").single() 순으로 조회.
    // 픽스처의 catch-all `**/rest/v1/**`이 빈 배열을 반환해서 "child" 분류가 안 되므로 재정의.
    // page.route는 reverse 등록 순서로 매치되어 여기 등록된 핸들러가 catch-all보다 우선.
    await page.route('**/rest/v1/family_members**', (route) => {
      const url = route.request().url();
      // .maybeSingle() / .single() 호출은 객체로, 그 외는 배열로 응답.
      const wantsObject = url.includes('user_id=');
      const member = {
        family_id: '11111111-1111-4111-8111-111111111111',
        user_id: '33333333-3333-4333-8333-333333333333',
        role: 'child',
        name: '아이',
        emoji: '🧒',
      };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wantsObject ? member : [member]),
      });
    });
    await page.route('**/rest/v1/families**', (route) => {
      // getMyFamily 후속 .eq("id", family_id).single() 호출용 — 객체 반환.
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111',
          pair_code: 'KID-TESTCODE',
          parent_name: '엄마',
          mom_phone: '',
          dad_phone: '',
          pair_code_expires_at: null,
          playdate_enabled: true,
        }),
      });
    });
    // fetchActiveSession 은 .maybeSingle() 사용 → 객체 응답이 필요. PATCH는 픽스처가 추적.
    const sessionRow = {
      id: 'sess-1',
      public_place_id: '66666666-6666-4666-8666-666666666666',
      family_a_id: '11111111-1111-4111-8111-111111111111',
      family_b_id: '44444444-4444-4444-8444-444444444444',
      started_at: new Date().toISOString(),
      stopped_at: null,
      stop_reason: null,
      friend_child_name: '지민',
    };
    await page.route('**/rest/v1/friend_playdate_sessions**', (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        // .maybeSingle() 호출 형태 — 단일 객체로 반환.
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(sessionRow),
        });
        return;
      }
      if (method === 'PATCH') {
        state.sessionPatchCalled = true;
        route.fulfill({ status: 204, body: '' });
        return;
      }
      if (method === 'POST') {
        state.sessionInsertCalled = true;
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'sess-1' }]),
        });
        return;
      }
      route.fulfill({ status: 200, body: '[]' });
    });

    await page.goto('/');
    const stopBtn = page.getByRole('button', { name: /그만 놀래요/ });
    await expect(stopBtn).toBeVisible({ timeout: 15_000 });
    await stopBtn.click();

    await expect.poll(() => state.sessionPatchCalled, { timeout: 10_000 }).toBe(true);
    await expect.poll(() => state.pushNotifyCalls.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(state.pushNotifyCalls[0]).toMatchObject({ action: 'playdate_ended' });
  });
});
