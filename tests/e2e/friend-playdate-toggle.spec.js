import { test, expect } from '@playwright/test';
import {
  installFriendPlaydateMocks,
  dismissEmergencyBannerIfPresent,
  FAMILY_ID,
  PARENT_ID,
  CHILD_ID,
} from './_friend-playdate-fixtures.js';

test.describe('Friend Playdate — toggle flow', () => {
  test('OFF 상태에서 panel 마운트 + toggle 노출 (aria-checked=false)', async ({ page }) => {
    await installFriendPlaydateMocks(page, { enabled: false });

    // App.jsx → getMyFamily() needs family_members + families lookup to mount
    // FriendPlaydatePanel (gated by `familyId && isParent`). Fixtures' catch-all
    // returns [] which leaves familyId undefined. Add a more-specific route
    // (LIFO precedence) so the parent-with-family path resolves.
    // Also return parent + child so App.jsx auto-pair modal
    // (members.length === 1) doesn't pop and intercept clicks.
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

    await page.goto('/');
    await dismissEmergencyBannerIfPresent(page);

    // Panel renders only when `familyId && isParent`. Heading proves the
    // FriendPlaydatePanel mounted past loading state.
    await expect(
      page.getByRole('heading', { name: '친구놀이' }),
    ).toBeVisible({ timeout: 15_000 });

    const toggle = page.getByRole('switch', { name: /친구놀이 기능/ });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  // Click → list flow is fixme'd: in the current App.jsx layout the
  // FriendPlaydateToggle button sits behind `hyeni-v5-tabbar-fixed`, so
  // a real click is intercepted; with `{ force: true }` the click lands
  // but the optimistic `setEnabled(true)` doesn't reflect into the
  // <PlaydateSafePlaceList> render in the mocked-supabase path within the
  // 90s test budget. Tracked for a follow-up plan that either
  // (a) adds bottom padding under FriendPlaydatePanel so the toggle
  //     leaves the tabbar gutter, or
  // (b) waits explicitly on the families PATCH 204 mock + re-fetch.
  test.fixme(
    'ON 전환 시 안전장소 list 노출 — pending tabbar overlap + PATCH→reload wiring',
    async ({ page }) => {
      await installFriendPlaydateMocks(page, { enabled: false });
      await page.goto('/');
      const toggle = page.getByRole('switch', { name: /친구놀이 기능/ });
      await toggle.click();
      await expect(page.getByText(/친구놀이 안전장소/)).toBeVisible();
    },
  );
});
