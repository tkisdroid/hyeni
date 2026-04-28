// Friend Playdate E2E fixtures.
// critical-flows.spec.js와 동일한 auth + entitlement + geolocation 패턴.
// supabase REST는 page.route로 friend_playdate 관련 endpoint만 좁게 intercept.

import dotenv from "dotenv";
import process from "node:process";

dotenv.config();

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://example.supabase.co";
export const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

export const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
export const PARENT_ID = "22222222-2222-4222-8222-222222222222";
export const CHILD_ID = "33333333-3333-4333-8333-333333333333";
export const FRIEND_FAMILY_ID = "44444444-4444-4444-8444-444444444444";
export const FRIEND_CHILD_ID = "55555555-5555-4555-8555-555555555555";
export const PUBLIC_PLACE_ID = "66666666-6666-4666-8666-666666666666";
export const SAVED_PLACE_ID = "77777777-7777-4777-8777-777777777777";

const DEFAULT_PLACES = [
  {
    id: SAVED_PLACE_ID,
    name: "한강공원",
    family_id: FAMILY_ID,
    lat: 37.5665,
    lng: 126.978,
    location: { lat: 37.5665, lng: 126.978, kakao_place_id: "k-han-1" },
    is_playdate_safe: true,
    public_place_id: PUBLIC_PLACE_ID,
    is_premium_locked: false,
  },
];

/**
 * Install auth + role + entitlement + geolocation BEFORE page navigation.
 * Mirrors critical-flows.spec.js pattern so app behaves as a logged-in family.
 */
export async function installPlaydateAuth(page, opts = {}) {
  const role = opts.role ?? "parent";
  const userId = role === "child" ? CHILD_ID : PARENT_ID;
  const familyId = opts.familyId ?? FAMILY_ID;

  await page.addInitScript(
    ({ projectRef, role, userId, familyId }) => {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      window.localStorage.setItem(
        `sb-${projectRef}-auth-token`,
        JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_at: expiresAt,
          expires_in: 3600,
          user: {
            id: userId,
            aud: "authenticated",
            role: "authenticated",
            email: `${role}@example.com`,
            app_metadata: { provider: role === "parent" ? "kakao" : "anonymous" },
            user_metadata: {},
            identities: [
              { provider: role === "parent" ? "kakao" : "anonymous" },
            ],
          },
        }),
      );
      window.sessionStorage.setItem("hyeni-my-role", role);
      window.localStorage.setItem("hyeni-my-role", role);
      window.localStorage.setItem(
        "hyeni-entitlement-cache-v1",
        JSON.stringify({
          [familyId]: {
            savedAt: Date.now(),
            value: {
              tier: "premium",
              status: "trial",
              isTrial: true,
              trialDaysLeft: 6,
              currentPeriodEnd: new Date(
                Date.now() + 30 * 86400_000,
              ).toISOString(),
              productId: "premium_monthly",
              features: [
                "realtime_location",
                "remote_audio",
                "saved_places",
                "academy_schedule",
                "danger_zones",
                "multi_geofence",
              ],
            },
          },
        }),
      );

      navigator.geolocation.getCurrentPosition = (success) => {
        success({
          coords: { latitude: 37.5665, longitude: 126.978, accuracy: 12 },
        });
      };
      navigator.geolocation.watchPosition = (success) => {
        success({
          coords: { latitude: 37.5665, longitude: 126.978, accuracy: 12 },
        });
        return 1;
      };
      navigator.geolocation.clearWatch = () => {};
    },
    { projectRef: PROJECT_REF, role, userId, familyId },
  );
}

/**
 * Intercept the supabase REST + Edge Function endpoints that friend_playdate
 * components touch. Caller passes opts to override default fixture data.
 *
 * Returns a `state` object the test can inspect (e.g., to assert PATCH was called).
 */
export async function installPlaydateRoutes(page, opts = {}) {
  const enabled = opts.enabled ?? true;
  const places = opts.places ?? DEFAULT_PLACES;
  const candidates = opts.candidates ?? [];
  const activeSession = opts.activeSession ?? null;
  const history = opts.history ?? [];

  const state = {
    sessionInsertCalled: false,
    sessionPatchCalled: false,
    pushNotifyCalls: [],
    rpcCalls: [],
  };

  // Catch-all auth/anon endpoints — return empty/ok so app doesn't error.
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: PARENT_ID } }),
    }),
  );

  // 다른 모든 supabase REST는 빈 응답 (events / academies / memos 등) — friend_playdate
  // 외 영역은 이 spec에서 검증 대상 아님. Playwright route는 나중에 등록한
  // handler가 먼저 실행되므로 catch-all을 먼저 등록해 아래 전용 mock이 우선되게 한다.
  await page.route("**/rest/v1/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });

  // families.playdate_enabled
  await page.route("**/rest/v1/families**", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: FAMILY_ID, playdate_enabled: enabled }),
      });
      return;
    }
    if (route.request().method() === "PATCH") {
      route.fulfill({ status: 204, body: "" });
      return;
    }
    route.fulfill({ status: 200, body: "[]" });
  });

  // saved_places — fetched via fetchSavedPlaces
  await page.route("**/rest/v1/saved_places**", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(places),
      });
      return;
    }
    route.fulfill({ status: 204, body: "" });
  });

  // public_places upsert
  await page.route("**/rest/v1/public_places**", (route) => {
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify([{ id: PUBLIC_PLACE_ID }]),
    });
  });

  // friend_playdate_sessions select / insert / update
  await page.route("**/rest/v1/friend_playdate_sessions**", (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(activeSession ? [activeSession] : history),
      });
      return;
    }
    if (method === "POST") {
      state.sessionInsertCalled = true;
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify([{ id: "sess-1" }]),
      });
      return;
    }
    if (method === "PATCH") {
      state.sessionPatchCalled = true;
      route.fulfill({ status: 204, body: "" });
      return;
    }
    route.fulfill({ status: 200, body: "[]" });
  });

  // find_playdate_candidates RPC
  await page.route("**/rest/v1/rpc/find_playdate_candidates**", (route) => {
    state.rpcCalls.push("find_playdate_candidates");
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        candidates,
        public_place_id: candidates.length > 0 ? PUBLIC_PLACE_ID : null,
      }),
    });
  });

  // push-notify Edge Function
  await page.route("**/functions/v1/push-notify", async (route) => {
    state.pushNotifyCalls.push(await route.request().postDataJSON());
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ delivered: true }),
    });
  });

  // Realtime subscribe — never resolves (테스트는 polling 패턴이 아닌 page.route 결과로 검증)
  await page.route("**/realtime/v1/**", (route) => {
    route.fulfill({ status: 101, body: "" });
  });

  return state;
}

/**
 * Convenience: auth + routes in one call.
 */
export async function installFriendPlaydateMocks(page, opts = {}) {
  await installPlaydateAuth(page, opts);
  return installPlaydateRoutes(page, opts);
}

export async function dismissEmergencyBannerIfPresent(page) {
  const banner = page.locator('[data-testid="emergency-banner-close"]');
  if (await banner.isVisible().catch(() => false)) await banner.click();
}
