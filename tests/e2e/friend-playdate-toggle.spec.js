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
});
