import { test, expect } from '@playwright/test';
import {
  installFriendPlaydateMocks,
  dismissEmergencyBannerIfPresent,
  FAMILY_ID,
  PARENT_ID,
  CHILD_ID,
} from './_friend-playdate-fixtures.js';

async function installParentFamilyRoutes(page) {
  await page.route('**/rest/v1/family_members**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('user_id')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          family_id: FAMILY_ID,
          role: 'parent',
          name: '엄마',
        }),
      });
      return;
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { user_id: PARENT_ID, role: 'parent', name: '엄마', emoji: '👩' },
        { user_id: CHILD_ID, role: 'child', name: '혜니', emoji: '👧' },
      ]),
    });
  });
}

test.describe('Friend Playdate — toggle flow', () => {
  test('OFF 상태에서 panel 마운트 + toggle 노출 (aria-checked=false)', async ({ page }) => {
    await installFriendPlaydateMocks(page, { enabled: false });

    // App.jsx → getMyFamily() needs family_members + families lookup to mount
    // FriendPlaydatePanel (gated by `familyId && isParent`). Fixtures' catch-all
    // returns [] which leaves familyId undefined. Add a more-specific route
    // (LIFO precedence) so the parent-with-family path resolves.
    // Also return parent + child so App.jsx auto-pair modal
    // (members.length === 1) doesn't pop and intercept clicks.
    await installParentFamilyRoutes(page);

    await page.goto('/');
    await dismissEmergencyBannerIfPresent(page);

    const shortcut = page.getByRole('button', { name: /친구놀이 관리/ });
    await shortcut.scrollIntoViewIfNeeded();
    await shortcut.click();

    // Heading proves the dedicated FriendPlaydatePanel page mounted past
    // loading state.
    await expect(
      page.getByLabel('친구놀이 패널').getByRole('heading', { name: '친구놀이' }),
    ).toBeVisible({ timeout: 15_000 });

    const toggle = page.getByRole('switch', { name: /친구놀이 기능/ });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('ON 전환 시 안전장소 list 노출', async ({ page }) => {
    await installFriendPlaydateMocks(page, { enabled: false });
    await installParentFamilyRoutes(page);

    await page.goto('/');
    await dismissEmergencyBannerIfPresent(page);

    const shortcut = page.getByRole('button', { name: /친구놀이 관리/ });
    await shortcut.scrollIntoViewIfNeeded();
    await shortcut.click();

    const toggle = page.getByRole('switch', { name: /친구놀이 기능/ });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText(/친구놀이 안전장소/)).toBeVisible();
  });

  test('허용 상태 부모 패널에서 진행 중 친구놀이 연락처 확인 + 정지 가능', async ({ page }) => {
    const state = await installFriendPlaydateMocks(page, {
      enabled: true,
      activeSession: {
        id: 'sess-1',
        public_place_id: '66666666-6666-4666-8666-666666666666',
        family_a_id: FAMILY_ID,
        family_b_id: '44444444-4444-4444-8444-444444444444',
        started_at: new Date().toISOString(),
        stopped_at: null,
        stop_reason: null,
        place_name: '한강공원',
        friend_child_name: '지민',
        friend_family_phones: ['010-1111-2222', '010-3333-4444'],
      },
    });
    await installParentFamilyRoutes(page);
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto('/');
    await dismissEmergencyBannerIfPresent(page);

    const shortcut = page.getByRole('button', { name: /친구놀이 관리/ });
    await shortcut.scrollIntoViewIfNeeded();
    await shortcut.click();

    const panel = page.getByLabel('친구놀이 패널');
    await expect(panel.getByRole('switch', { name: /친구놀이 기능/ })).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByText('상대 부모 연락처')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('link', { name: /010-1111-2222/ })).toHaveAttribute('href', 'tel:01011112222');
    await expect(panel.getByRole('link', { name: /010-3333-4444/ })).toHaveAttribute('href', 'tel:01033334444');

    await panel.getByRole('button', { name: /정지 - 친구 만남 종료/ }).click();
    await expect.poll(() => state.sessionPatchCalled, { timeout: 10_000 }).toBe(true);
    await expect.poll(() => state.pushNotifyCalls.some((call) => call.action === 'playdate_ended'), { timeout: 10_000 }).toBe(true);
  });
});
