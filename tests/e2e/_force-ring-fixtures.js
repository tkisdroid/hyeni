import process from "node:process";
import dotenv from "dotenv";
import { expect } from "@playwright/test";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://example.supabase.co";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";
const PAIR_CODE = "KID-804DF582";

export const FORCE_RING_FIXTURES = {
  PROJECT_REF,
  FAMILY_ID,
  PARENT_ID,
  CHILD_ID,
  PAIR_CODE,
};

export async function installForceRingParentMocks(page, options = {}) {
  const {
    quotaResponse = { allowed: true, quota: 1, used: 0, tier: "free" },
    pushNotifyResponse = null,
    pushNotifyStatus = 200,
    historyResponse = [],
  } = options;

  const calls = {
    pushNotify: [],
    rpcQuota: 0,
    historyFetched: 0,
  };

  await page.addInitScript(
    ({ projectRef, familyId, parentId }) => {
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
            id: parentId,
            aud: "authenticated",
            role: "authenticated",
            email: "parent@example.com",
            app_metadata: { provider: "kakao" },
            // OAuth→phone bridge 를 이미 끝낸 카카오 부모로 모킹. linked_providers
            // 마커가 없으면 getOAuthUserNeedsBridge 가 true 가 되어 부모 대시보드
            // 대신 OAuthBridgeScreen 이 뜬다.
            user_metadata: { linked_providers: { kakao: { linkedAt: new Date().toISOString() } } },
            identities: [{ provider: "kakao" }],
          },
        }),
      );
      window.sessionStorage.setItem("hyeni-my-role", "parent");
      window.localStorage.setItem("hyeni-my-role", "parent");
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
              currentPeriodEnd: new Date(Date.now() + 30 * 86400_000).toISOString(),
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
        success({ coords: { latitude: 37.5665, longitude: 126.978, accuracy: 12 } });
      };
      navigator.geolocation.watchPosition = (success) => {
        success({ coords: { latitude: 37.5665, longitude: 126.978, accuracy: 12 } });
        return 1;
      };
      navigator.geolocation.clearWatch = () => {};
      navigator.mediaDevices = navigator.mediaDevices || {};
      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop() {} }],
      });
      window.Notification = class {
        static permission = "granted";
        static requestPermission() {
          return Promise.resolve("granted");
        }
        constructor() {}
      };
      window.Audio = class {
        play() {
          return Promise.resolve();
        }
        set onended(handler) {
          if (handler) window.setTimeout(handler, 0);
        }
        set onerror(_handler) {}
      };
      class FakeLatLng {
        constructor(lat, lng) {
          this._lat = lat;
          this._lng = lng;
        }
        getLat() {
          return this._lat;
        }
        getLng() {
          return this._lng;
        }
      }
      window.kakao = {
        maps: {
          load: (callback) => callback(),
          LatLng: FakeLatLng,
          LatLngBounds: class {
            extend() {}
          },
          Map: class {
            constructor() {}
            setCenter() {}
            panTo() {}
            setLevel() {}
            getLevel() {
              return 3;
            }
            relayout() {}
            setBounds() {}
            setMapTypeId() {}
          },
          Marker: class {
            constructor() {}
            setPosition() {}
            getPosition() {
              return null;
            }
            setMap() {}
          },
          Circle: class {
            setMap() {}
            setRadius() {}
          },
          Polyline: class {
            setMap() {}
            setPath() {}
          },
          CustomOverlay: class {
            setMap() {}
            setPosition() {}
          },
          StaticMap: class {},
          MapTypeId: { ROADMAP: "roadmap", HYBRID: "hybrid" },
          event: {
            addListener(target, name, handler) {
              target[`on${name}`] = handler;
            },
          },
          services: {
            Status: { OK: "OK" },
            Geocoder: class {
              coord2Address(_lng, _lat, callback) {
                callback(
                  [
                    {
                      road_address: { address_name: "서울특별시 중구 세종대로 110" },
                      address: { address_name: "서울특별시 중구 세종대로 110" },
                    },
                  ],
                  "OK",
                );
              }
            },
            Places: class {
              keywordSearch(_keyword, callback) {
                callback([], "ZERO_RESULT");
              }
            },
          },
        },
      };
    },
    { projectRef: PROJECT_REF, familyId: FAMILY_ID, parentId: PARENT_ID },
  );

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const fulfillJson = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (!url.hostname.endsWith("supabase.co")) {
      return route.continue();
    }

    if (url.pathname.includes("/auth/v1/user")) {
      return fulfillJson({ id: PARENT_ID, aud: "authenticated", role: "authenticated" });
    }

    if (url.pathname.includes("/functions/v1/push-notify")) {
      const body = request.postData() ? request.postDataJSON() : null;
      calls.pushNotify.push(body);
      if (pushNotifyResponse) {
        return fulfillJson(pushNotifyResponse, pushNotifyStatus);
      }
      return fulfillJson({ ok: true });
    }

    if (url.pathname.includes("/rest/v1/rpc/force_ring_check_quota")) {
      calls.rpcQuota += 1;
      return fulfillJson(quotaResponse);
    }

    if (url.pathname.includes("/rest/v1/rpc/")) {
      return fulfillJson([]);
    }

    if (!url.pathname.includes("/rest/v1/")) {
      return fulfillJson({ ok: true });
    }

    const table = url.pathname.split("/").pop();
    const query = url.searchParams;

    if (table === "family_members") {
      if (query.get("user_id")) {
        return fulfillJson({
          family_id: FAMILY_ID,
          role: "parent",
          name: "엄마",
        });
      }
      if (query.get("role")?.includes("child")) {
        return fulfillJson([{ user_id: CHILD_ID }]);
      }
      return fulfillJson([
        { user_id: PARENT_ID, role: "parent", name: "엄마", emoji: "👩" },
        { user_id: CHILD_ID, role: "child", name: "혜니", emoji: "🐰" },
      ]);
    }

    if (table === "families") {
      return fulfillJson({
        id: FAMILY_ID,
        pair_code: PAIR_CODE,
        parent_name: "엄마",
        mom_phone: "01012345678",
        dad_phone: "",
        pair_code_expires_at: null,
        user_tier: "premium",
      });
    }

    if (table === "family_subscription") {
      return fulfillJson({
        status: "trial",
        trial_ends_at: new Date(Date.now() + 6 * 86400_000).toISOString(),
        current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
        product_id: "premium_monthly",
      });
    }

    if (table === "force_ring_events") {
      calls.historyFetched += 1;
      return fulfillJson(historyResponse);
    }

    return fulfillJson([]);
  });

  return calls;
}

export async function dismissEmergencyBannerIfPresent(page) {
  const ackBtn = page.getByRole("button", { name: "확인했어요" });
  if (await ackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ackBtn.click();
  }
}

export async function openForceRingPage(page) {
  const shortcut = page.getByRole("button", { name: /응급 강제 알림|응급알림/ });
  await shortcut.scrollIntoViewIfNeeded();
  await shortcut.click();
  await expect(page.getByRole("heading", { name: /응급 강제 알림/ })).toBeVisible({
    timeout: 15_000,
  });
}

export async function holdLongPressTrigger(page) {
  const trigger = page.getByRole("button", { name: /5초 누르고 있기/ });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.dispatchEvent("mousedown");
  await page.waitForTimeout(5200);
  await trigger.dispatchEvent("mouseup").catch(() => {});
}
