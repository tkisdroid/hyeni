import { test, expect } from '@playwright/test';
import {
  installFriendPlaydateMocks,
  FAMILY_ID,
  CHILD_ID,
} from './_friend-playdate-fixtures.js';

// Augment fixtures with the family_members + families rows the App needs to derive
// `familyId` and mount FriendPlaydateChildPanel (`familyId && !isParent`). Registered
// AFTER installFriendPlaydateMocks so they take priority (Playwright matches routes
// in reverse-registration order).
async function bootChildFamily(page) {
  await page.route('**/rest/v1/family_members**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('user_id')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          family_id: FAMILY_ID,
          role: 'child',
          name: '혜니',
          user_id: CHILD_ID,
        }),
      });
      return;
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { user_id: CHILD_ID, role: 'child', name: '혜니', emoji: '🐰' },
      ]),
    });
  });
  await page.route('**/rest/v1/families**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: FAMILY_ID,
          pair_code: 'KID-TEST0001',
          parent_name: '엄마',
          mom_phone: '01012345678',
          dad_phone: '',
          pair_code_expires_at: null,
          user_tier: 'premium',
          playdate_enabled: true,
        }),
      });
      return;
    }
    route.fulfill({ status: 204, body: '' });
  });
}

// FIXME (Task 7.3 — discover spec authoring blocker, 2026-04-27):
// Both tests are quarantined via test.fixme until the worktree boot path is
// solved. Two compounding mock/timing issues prevent the FriendPlaydateChildPanel
// from rendering at `/`:
//
//   1. App boot dies in src/lib/supabase.js:23 because no .env.local exists in
//      this worktree (only .env.example). `import.meta.env.VITE_SUPABASE_URL`
//      is undefined → supabase client throws → React tree never hydrates →
//      page is a blank pastel splash. Confirmed via test-failed-1.png.
//
//   2. Even with env in place, App.jsx:9624 short-circuits child sessions to
//      <ChildPairInput> whenever `familyInfo` is null. Populating familyInfo
//      requires the auth init path (App.jsx:7049-7071) to resolve getMyFamily()
//      against the family_members + families REST endpoints. The committed
//      _friend-playdate-fixtures.js (commit d6a1e4d) returns `[]` from the
//      `**/rest/v1/**` catch-all (line 238-244) and does not seed a child
//      membership row keyed on the localStorage CHILD_ID, so familyInfo never
//      hydrates. Per-spec page.route() overrides (attempted iterations 1-2)
//      partially help but the auth-init useEffect race + `.maybeSingle()`
//      content-negotiation make this brittle without expanding the fixtures
//      helper itself, which is out of scope for Task 7.3.
//
// Resolution (follow-up plan): broaden _friend-playdate-fixtures.js to seed a
// child membership row when role==='child' (mirroring critical-flows.spec.js
// lines 392-421), and add a worktree .env.local provisioning step to
// scripts/dev-playwright.mjs. Then drop the .fixme markers and re-verify.

test.describe('Friend Playdate — discover candidates', () => {
  test.fixme('candidates 0명 → 친구랑 놀래요 버튼 disabled (not_in_safe_place)', async ({ page }) => {
    await installFriendPlaydateMocks(page, { role: 'child', candidates: [] });
    await bootChildFamily(page);
    await page.goto('/');
    const startBtn = page.getByRole('button', { name: /친구랑 놀래요/ });
    await expect(startBtn).toBeVisible({ timeout: 15_000 });
    // candidates 0 + public_place_id null → inSafePlace=false → disabled
    await expect(startBtn).toBeDisabled();
  });

  test.fixme('candidates N명 → Radio 선택 + 시작 버튼 활성화', async ({ page }) => {
    await installFriendPlaydateMocks(page, {
      role: 'child',
      candidates: [
        { family_id: 'fam-2', child_user_id: 'u-2', child_name: '지민', public_place_id: '66666666-6666-4666-8666-666666666666' },
      ],
    });
    await bootChildFamily(page);
    await page.goto('/');
    const startBtn = page.getByRole('button', { name: /친구랑 놀래요/ });
    await expect(startBtn).toBeVisible({ timeout: 15_000 });
    await expect(startBtn).not.toBeDisabled();

    await startBtn.click();
    await expect(page.getByLabel(/지민/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /친구랑 놀래요 시작/ })).toBeDisabled();

    await page.getByLabel(/지민/).click();
    await expect(page.getByRole('button', { name: /친구랑 놀래요 시작/ })).not.toBeDisabled();
  });
});
