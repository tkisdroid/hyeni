import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import process from "node:process";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://example.supabase.co";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_CHILD_ID = "44444444-4444-4444-8444-444444444444";
const PAIR_CODE = "KID-804DF582";
const TEST_PLACE = {
  lat: 37.5665,
  lng: 126.978,
  address: "서울특별시 중구 세종대로 110",
};

function currentDateParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
    dateKey: `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`,
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
  };
}

async function waitForStableExactMinuteWindow() {
  const seconds = new Date().getSeconds();
  if (seconds < 40) return;
  await new Promise((resolve) => setTimeout(resolve, (62 - seconds) * 1000));
}

function buildEventRow({ insideArrivalZone = false, ...overrides } = {}) {
  const { dateKey, time } = currentDateParts();
  const eventRow = {
    id: "event-current",
    family_id: FAMILY_ID,
    date_key: dateKey,
    title: "영어 학원",
    time,
    category: "school",
    emoji: "📚",
    color: "#A78BFA",
    bg: "#EDE9FE",
    memo: "",
    location: insideArrivalZone
      ? TEST_PLACE
      : { lat: 37.5796, lng: 126.977, address: TEST_PLACE.address },
    notif_override: null,
    end_time: null,
    created_by: PARENT_ID,
    // Treat the seed event as family-wide so the multi-child visibility
    // filter (App.jsx visibleEvents) lets a child see it without needing
    // the mock to also seed events_children rows tied to the child's
    // family_members.id (which the mock does not expose).
    is_family_event: true,
    events_children: [],
  };
  return { ...eventRow, ...overrides };
}

function buildFutureEventRow({ id, title, offsetMinutes }) {
  const eventDate = new Date(Date.now() + offsetMinutes * 60_000);
  return buildEventRow({
    id,
    title,
    date_key: `${eventDate.getFullYear()}-${eventDate.getMonth()}-${eventDate.getDate()}`,
    time: `${String(eventDate.getHours()).padStart(2, "0")}:${String(eventDate.getMinutes()).padStart(2, "0")}`,
    end_time: null,
    location: null,
  });
}

async function selectParentCalendarDate(page, dateKey) {
  const [targetYear, targetMonth, targetDay] = dateKey.split("-").map(Number);
  const calendarPage = page.getByRole("region", { name: "부모 캘린더" });
  const calendarCard = calendarPage.locator(".hyeni-v5-calendar-card").first();

  for (let guard = 0; guard < 14; guard += 1) {
    const visible = await calendarCard.evaluate((card) => {
      const year = Number(card.querySelector(".hyeni-v5-calendar-year")?.textContent);
      const monthText = card.querySelector(".hyeni-v5-calendar-month")?.textContent || "";
      return {
        year,
        month: Number(monthText.replace("월", "")) - 1,
      };
    });
    if (visible.year === targetYear && visible.month === targetMonth) break;

    const visibleIndex = visible.year * 12 + visible.month;
    const targetIndex = targetYear * 12 + targetMonth;
    await calendarPage.getByRole("button", { name: visibleIndex < targetIndex ? "다음 달" : "이전 달" }).click();
  }

  await calendarPage.getByRole("button", { name: new RegExp(`${targetMonth + 1}월 ${targetDay}일`) }).click();
}

async function expectCalendarEventStatus(page, eventRow, expectedStatus) {
  await selectParentCalendarDate(page, eventRow.date_key);
  const card = page.locator(".hyeni-v5-event-card").filter({ hasText: eventRow.title }).first();
  await expect(card).toBeVisible();
  await expect(card.locator(".hyeni-v5-event-tag")).toHaveText(expectedStatus);
}

async function installCriticalMocks(page, options = {}) {
  await waitForStableExactMinuteWindow();
  const {
    role = "parent",
    initiallyPaired = true,
    insideArrivalZone = false,
    walkingRoute = "success",
    seedEvents = [],
    locationHistoryRows = [],
    childDeviceHealth = null,
    secondChildDeviceHealth = null,
    refreshLocationAfterRequest = false,
    extraChild = false,
    deviceLocation = { latitude: 37.5665, longitude: 126.978, accuracy: 12 },
    qrRawValue = "",
  } = options;
  const state = {
    paired: role === "parent" ? true : initiallyPaired,
    childEmoji: "🐰",
    insertedEvents: [],
    insertedEventChildren: [],
    insertedMemoReplies: [],
    memberUpdates: [],
    functionCalls: [],
    rpcCalls: [],
    routeRequests: [],
    locationRefreshRequests: 0,
    childLocationGetsAfterRefresh: 0,
    enableRefreshedLocation: false,
  };
  const userId = role === "child" ? CHILD_ID : PARENT_ID;

  await page.addInitScript(
    ({ projectRef, role, userId, familyId, deviceLocation, qrRawValue }) => {
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
            identities: [{ provider: role === "parent" ? "kakao" : "anonymous" }],
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

      const originalPermissions = navigator.permissions;
      const grantedPermissionStatus = () => ({
        state: "granted",
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
      });
      Object.defineProperty(navigator, "permissions", {
        configurable: true,
        value: {
          query: async (descriptor) => {
            if (descriptor?.name === "camera") return grantedPermissionStatus();
            try {
              if (originalPermissions?.query) return originalPermissions.query(descriptor);
            } catch {
              // fall back to a granted mock below
            }
            return grantedPermissionStatus();
          },
        },
      });
      window.__hyeniGeoCalls = { getCurrentPosition: 0, watchPosition: 0 };
      navigator.geolocation.getCurrentPosition = (success) => {
        window.__hyeniGeoCalls.getCurrentPosition += 1;
        success({ coords: { latitude: deviceLocation.latitude, longitude: deviceLocation.longitude, accuracy: deviceLocation.accuracy } });
      };
      navigator.geolocation.watchPosition = (success) => {
        window.__hyeniGeoCalls.watchPosition += 1;
        success({ coords: { latitude: deviceLocation.latitude, longitude: deviceLocation.longitude, accuracy: deviceLocation.accuracy } });
        return 1;
      };
      navigator.geolocation.clearWatch = () => {};
      navigator.mediaDevices = navigator.mediaDevices || {};
      window.__hyeniCameraCalls = { getUserMedia: 0 };
      navigator.mediaDevices.getUserMedia = async () => {
        window.__hyeniCameraCalls.getUserMedia += 1;
        return {
          getTracks: () => [{ stop() {} }],
        };
      };
      if (window.HTMLMediaElement?.prototype) {
        window.HTMLMediaElement.prototype.play = () => Promise.resolve();
        Object.defineProperty(window.HTMLMediaElement.prototype, "srcObject", {
          configurable: true,
          get() {
            return this.__hyeniTestSrcObject || null;
          },
          set(value) {
            this.__hyeniTestSrcObject = value;
          },
        });
      }
      if (qrRawValue) {
        window.__hyeniQrValues = [qrRawValue];
        window.BarcodeDetector = class {
          async detect() {
            const rawValue = window.__hyeniQrValues.shift();
            return rawValue ? [{ rawValue }] : [];
          }
        };
      }
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
      class FakeMap {
        constructor(_element, options = {}) {
          this.center = options.center;
          this.level = options.level || 3;
        }
        setCenter(center) {
          this.center = center;
        }
        panTo(center) {
          this.center = center;
        }
        setLevel(level) {
          this.level = level;
        }
        getLevel() {
          return this.level;
        }
        relayout() {}
        setBounds() {}
        setMapTypeId() {}
      }
      class FakeMarker {
        constructor(options = {}) {
          this.position = options.position;
        }
        setPosition(position) {
          this.position = position;
        }
        getPosition() {
          return this.position;
        }
        setMap() {}
      }
      window.kakao = {
        maps: {
          load: (callback) => callback(),
          LatLng: FakeLatLng,
          LatLngBounds: class {
            extend() {}
          },
          Map: FakeMap,
          Marker: FakeMarker,
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
              keywordSearch(keyword, callback) {
                callback(
                  [
                    {
                      place_name: keyword,
                      road_address_name: "서울특별시 중구 세종대로 110",
                      address_name: "서울특별시 중구 세종대로 110",
                      x: "126.978",
                      y: "37.5665",
                    },
                  ],
                  "OK",
                );
              }
            },
          },
        },
      };
    },
    { projectRef: PROJECT_REF, role, userId, familyId: FAMILY_ID, deviceLocation, qrRawValue },
  );

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization,content-type,accept,service",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    };
    const fulfillJson = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify(body),
      });

    if (url.hostname === "router.project-osrm.org" && url.pathname.includes("/route/v1/foot/")) {
      state.routeRequests.push(url.href);
      if (walkingRoute === "failure") {
        return fulfillJson({ code: "NoRoute", routes: [] }, 503);
      }
      return fulfillJson({
        code: "Ok",
        routes: [
          {
            distance: 420,
            duration: 360,
            geometry: {
              coordinates: [
                [126.978, 37.5665],
                [126.9795, 37.5671],
                [126.981, 37.5678],
              ],
            },
          },
        ],
      });
    }

    if (url.hostname.includes("kakaomobility.com") && url.pathname.includes("directions")) {
      state.routeRequests.push(url.href);
      if (method === "OPTIONS") {
        return route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      }
      if (walkingRoute === "failure") {
        return fulfillJson({ routes: [{ result_code: 104, result_message: "No walking route" }] }, 503);
      }
      return fulfillJson({
        routes: [{
          result_code: 0,
          summary: { distance: 420, duration: 360 },
          sections: [{
            distance: 420,
            duration: 360,
            roads: [{
              vertexes: [
                126.9780, 37.5665,
                126.9795, 37.5671,
                126.9810, 37.5678,
              ],
            }],
          }],
        }],
      });
    }

    if (!url.hostname.endsWith("supabase.co")) {
      return route.continue();
    }

    if (url.pathname.includes("/auth/v1/user")) {
      return fulfillJson({ id: userId, aud: "authenticated", role: "authenticated" });
    }

    if (url.pathname.includes("/functions/v1/ai-voice-parse")) {
      state.functionCalls.push({ name: "ai-voice-parse", body: request.postDataJSON() });
      const { year, month, day } = currentDateParts();
      return fulfillJson({
        action: "add_event",
        title: "수학 학원",
        time: "16:30",
        category: "school",
        emoji: "📚",
        memo: "교재 챙기기",
        year,
        month,
        day,
      });
    }

    if (url.pathname.includes("/functions/v1/")) {
      const body = request.postData() ? request.postDataJSON() : null;
      if (body?.action === "request_location") {
        state.locationRefreshRequests += 1;
      }
      state.functionCalls.push({
        name: url.pathname.split("/").pop(),
        body,
      });
      return fulfillJson({ ok: true });
    }

    if (url.pathname.includes("/rest/v1/rpc/")) {
      const rpcName = url.pathname.split("/").pop();
      state.rpcCalls.push({ name: rpcName, body: request.postData() ? request.postDataJSON() : null });
      if (rpcName === "join_family") {
        state.paired = true;
        return fulfillJson({ family_id: FAMILY_ID });
      }
      if (rpcName === "check_kkuk_cooldown") {
        return fulfillJson({ allowed: true, remaining_seconds: 0 });
      }
      if (rpcName === "get_stickers_for_date" || rpcName === "get_sticker_summary") {
        return fulfillJson([]);
      }
      return fulfillJson([]);
    }

    if (!url.pathname.includes("/rest/v1/")) {
      return fulfillJson({ ok: true });
    }

    const table = url.pathname.split("/").pop();
    const query = url.searchParams;
    const eventRows = [buildEventRow({ insideArrivalZone }), ...seedEvents];

    if (table === "family_members") {
      if (method === "PATCH") {
        const body = request.postData() ? request.postDataJSON() : {};
        state.memberUpdates.push(body);
        if (typeof body?.emoji === "string" && body.emoji) {
          state.childEmoji = body.emoji;
        }
        return fulfillJson({ id: "member-child-1", user_id: CHILD_ID, role: "child", name: "혜니", emoji: state.childEmoji });
      }
      if (query.get("user_id")) {
        if (role === "child" && !state.paired) return fulfillJson(null);
        return fulfillJson({
          family_id: FAMILY_ID,
          role,
          name: role === "child" ? "혜니" : "엄마",
          emoji: role === "child" ? state.childEmoji : "👩",
        });
      }
      if (query.get("role")?.includes("child")) {
        return fulfillJson(extraChild
          ? [{ id: "member-child-1", user_id: CHILD_ID }, { id: "member-child-2", user_id: SECOND_CHILD_ID }]
          : [{ id: "member-child-1", user_id: CHILD_ID }]);
      }
      const members = [
        { id: "member-parent", user_id: PARENT_ID, role: "parent", name: "엄마", emoji: "👩" },
        { id: "member-child-1", user_id: CHILD_ID, role: "child", name: "혜니", emoji: state.childEmoji, child_order: 1, device_health: childDeviceHealth },
      ];
      if (extraChild) members.push({ id: "member-child-2", user_id: SECOND_CHILD_ID, role: "child", name: "민이", emoji: "🐥", child_order: 2, device_health: secondChildDeviceHealth });
      return fulfillJson(members);
    }

    if (table === "families") {
      if (role === "child" && !state.paired && query.get("parent_id")) return fulfillJson(null);
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

    if (table === "events") {
      if (method === "POST") {
        const body = request.postDataJSON();
        const eventRow = Array.isArray(body) ? body[0] : body;
        state.insertedEvents.push(body);
        return fulfillJson({
          id: eventRow?.id || `event-inserted-${state.insertedEvents.length}`,
          ...eventRow,
        });
      }
      return fulfillJson(method === "GET" ? eventRows : []);
    }

    if (table === "events_children") {
      if (method === "POST") {
        const body = request.postDataJSON();
        const rows = Array.isArray(body) ? body : [body];
        state.insertedEventChildren.push(...rows);
        return fulfillJson(rows);
      }
      return fulfillJson([]);
    }

    if (table === "memo_replies") {
      if (method === "POST") {
        const body = request.postDataJSON();
        const row = {
          id: `memo-reply-${state.insertedMemoReplies.length + 1}`,
          created_at: new Date().toISOString(),
          read_by: [],
          ...(Array.isArray(body) ? body[0] : body),
        };
        state.insertedMemoReplies.push(row);
        return fulfillJson(row);
      }
      return fulfillJson(method === "GET" ? state.insertedMemoReplies : []);
    }

    if (table === "saved_places") {
      return fulfillJson(
        method === "GET"
          ? [
              {
                id: "place-1",
                family_id: FAMILY_ID,
                name: "영어 학원",
                location: TEST_PLACE,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ]
          : [],
      );
    }

    if (table === "child_locations") {
      const useRefreshedLocation = refreshLocationAfterRequest
        && state.enableRefreshedLocation
        && state.locationRefreshRequests > 0
        && ++state.childLocationGetsAfterRefresh >= 2;
      if (method !== "GET") return fulfillJson([]);
      const locations = [
        {
          user_id: CHILD_ID,
          lat: useRefreshedLocation ? 37.5699 : 37.5665,
          lng: useRefreshedLocation ? 126.9822 : 126.978,
          updated_at: new Date(Date.now() + (useRefreshedLocation ? 5000 : 0)).toISOString(),
        },
      ];
      if (extraChild) {
        locations.push({
          user_id: SECOND_CHILD_ID,
          lat: 37.5702,
          lng: 126.9828,
          updated_at: new Date(Date.now() + 2000).toISOString(),
        });
      }
      return fulfillJson(locations);
    }

    if (table === "location_history") {
      if (method !== "GET") return fulfillJson([]);
      const userIdsParam = query.get("user_id") || "";
      const selectedUserIds = userIdsParam.match(/in\.\(([^)]*)\)/)?.[1]
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean) || [];
      const recordedFilters = query.getAll("recorded_at");
      const gte = recordedFilters.find((value) => value.startsWith("gte."))?.slice(4);
      const lt = recordedFilters.find((value) => value.startsWith("lt."))?.slice(3);
      const rows = locationHistoryRows.filter((row) => {
        if (selectedUserIds.length && !selectedUserIds.includes(row.user_id)) return false;
        const recordedMs = Date.parse(row.recorded_at);
        if (gte && recordedMs < Date.parse(gte)) return false;
        if (lt && recordedMs >= Date.parse(lt)) return false;
        return true;
      });
      return fulfillJson(rows);
    }

    if (
      [
        "academies",
        "memos",
        "danger_zones",
        "parent_alerts",
        "remote_listen_sessions",
        "push_subscriptions",
        "fcm_tokens",
        "sos_events",
      ].includes(table)
    ) {
      return fulfillJson([]);
    }

    return fulfillJson([]);
  });

  return state;
}

test.describe("critical Hyeni flows", () => {
  test("parent mode covers emergency, location, scheduling, AI, notifications, remote audio, and kkuk", async ({ page }, testInfo) => {
    const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("학부모 모드")).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    await expect(page.getByRole("button", { name: "연동 (1명)" })).toBeVisible();
    const managementRail = page.locator('[aria-label="관리 바로가기"]');
    await expect(managementRail.locator("button").first()).toHaveAttribute("aria-label", "빠른 일정입력");
    await expect(page.getByText("관리 바로가기", { exact: true })).toHaveCount(0);
    await expect(page.getByText("필요한 기능만 빠르게", { exact: true })).toHaveCount(0);
    await expect(page.locator(".hyeni-v5-add-row")).toHaveCount(0);
    const firstManagementButtonLayout = await managementRail.locator("button").first().evaluate((button) => {
      const styles = getComputedStyle(button);
      return {
        gridColumnEnd: styles.gridColumnEnd,
        flexDirection: styles.flexDirection,
      };
    });
    expect(firstManagementButtonLayout.gridColumnEnd).toBe("span 2");
    expect(firstManagementButtonLayout.flexDirection).toBe("row");
    await managementRail.getByRole("button", { name: "빠른 일정입력" }).click();
    await expect(page.getByText("일정 빠른 입력")).toBeVisible();
    await expect(page.getByRole("button", { name: "말하기" })).toBeVisible();
    await expect(page.getByRole("button", { name: "이미지" })).toBeVisible();
    await expect(page.getByRole("button", { name: "텍스트" })).toBeVisible();
    await page.getByRole("button", { name: "닫기" }).click();
    await page.getByRole("button", { name: "📍 우리아이" }).click();
    await expect(page.getByRole("button", { name: "현재 위치 다시 확인" })).toBeVisible();
    await expect(page.getByText("혜니 실시간")).toBeVisible();
    await page.getByRole("button", { name: "← 돌아가기" }).click();

    const now = new Date();
    const mainCalendar = page.getByRole("region", { name: "캘린더" }).first();
    await mainCalendar.getByRole("button", { name: new RegExp(`${now.getMonth() + 1}월 ${now.getDate()}일`) }).click();
    await page.getByPlaceholder("예) 영어 학원, 태권도...").fill("피아노 연습");
    const timePicker = page.locator(".hyeni-schedule-time-card").first();
    await expect(timePicker).toBeVisible();
    await timePicker.getByRole("button", { name: "오후 3:00 시작 시간 선택" }).click();
    await timePicker.getByRole("button", { name: "오후 4:30 종료 시간 선택" }).click();
    const timeSummary = timePicker.locator(".hyeni-time-summary");
    await expect(timeSummary.getByText("오후 3:00 ~ 오후 4:30")).toBeVisible();
    await expect(timeSummary.getByText("1시간 30분")).toBeVisible();
    const themedTimePickerStyles = await timePicker.evaluate((element) => {
      const styles = getComputedStyle(element);
      const selectedSlot = element.querySelector(".hyeni-time-slot.is-start");
      const selectedStyles = selectedSlot ? getComputedStyle(selectedSlot) : null;
      return {
        borderRadius: styles.borderRadius,
        selectedSlotBackground: selectedStyles?.backgroundColor || "",
      };
    });
    expect(themedTimePickerStyles.borderRadius).toBe("16px");
    expect(themedTimePickerStyles.selectedSlotBackground).toMatch(/^rgb\(/);
    expect(themedTimePickerStyles.selectedSlotBackground).not.toBe("rgb(255, 255, 255)");
    const timePickerScreenshot = testInfo.outputPath("time-picker-theme.png");
    await timePicker.screenshot({ path: timePickerScreenshot });
    await testInfo.attach("time-picker-theme", { path: timePickerScreenshot, contentType: "image/png" });
    await page.getByRole("button", { name: "🗺️ 지도에서 장소 선택" }).click();
    await page.getByPlaceholder("🔍 학원 이름이나 주소 검색...").fill("세종대로");
    await page.getByRole("button", { name: "검색" }).click();
    await page.getByText("세종대로", { exact: true }).click();
    await page.getByRole("button", { name: "📍 이 장소로 설정하기" }).click();
    await expect(page.getByText("서울특별시 중구 세종대로 110").first()).toBeVisible();
    await page.locator("button.sheet-save").click();
    await expect(page.getByRole("button", { name: "피아노 연습 편집" })).toBeVisible();

    await managementRail.getByRole("button", { name: "빠른 일정입력" }).click();
    await page.locator("#ai-text-input").fill("오늘 4시 반 수학 학원, 교재 챙기기");
    await page.getByRole("button", { name: "✅ 다 입력했어요^^" }).click();
    await expect(page.getByText("수학 학원", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "모두 등록" }).click();
    await expect(page.getByText("수학 학원", { exact: true }).first()).toBeVisible();

    // The "🔔 일정알림" quick-action was removed when notification settings
    // moved into the per-event detail / global push permission gate flow.
    // Coverage for the new flow lives in subscription-flow.spec.js
    // ("parent can configure reminder times without duplicate minute entries").
    await page.getByRole("button", { name: "🎙️ 주변소리" }).click();
    await expect(page.getByText("주변 소리 듣기")).toBeVisible();
    await page.getByRole("button", { name: "🎙️ 듣기 시작" }).click();
    // The remote-listen connect status surfaces one of the per-status copy
    // strings from the connection state machine (idle → connecting →
    // listening). Match the umbrella substring "연결" + the noun phrase
    // "아이 기기" so the test tolerates either "아이 기기 자동 연결 시도 중"
    // or future copy variants.
    await expect(page.getByText("아이 기기 자동 연결 시도 중")).toBeVisible();
    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "remote_listen")).toBeTruthy();
    await page.getByRole("button", { name: "⏹️ 중지" }).click();
    await page.getByRole("button", { name: "닫기" }).click();

    await page.getByRole("button", { name: "꾹 보내기" }).click();
    await expect(page.getByText("꾹을 보냈어요!")).toBeVisible();

    const appFont = await page.locator(".hyeni-app-shell").first().evaluate((element) => getComputedStyle(element).fontFamily);
    expect(appFont).toContain("Pretendard");
    expect(state.insertedEvents.length).toBeGreaterThanOrEqual(2);
    expect(state.functionCalls.some((call) => call.name === "ai-voice-parse")).toBeTruthy();
    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "remote_listen")).toBeTruthy();
  });

  test("parent bottom navigation opens a stable calendar page with active tab state", async ({ page }) => {
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
    await expect(mainTabbar.getByRole("button", { name: "일정" })).toBeVisible();

    await mainTabbar.getByRole("button", { name: "일정" }).click();

    await expect(page.getByRole("region", { name: "부모 캘린더" })).toBeVisible();
    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toHaveCount(0);

    const navState = await page.evaluate(() => {
      const nav = document.querySelector(".hyeni-v5-tabbar-fixed");
      const active = nav?.querySelector("button.active");
      const rect = nav?.getBoundingClientRect();
      return {
        activeText: active?.innerText || "",
        position: nav ? getComputedStyle(nav).position : "",
        bottomGap: rect ? Math.round(window.innerHeight - rect.bottom) : null,
        scrollY: Math.round(window.scrollY),
      };
    });
    expect(navState.activeText).toContain("일정");
    expect(navState.position).toBe("fixed");
    expect(navState.bottomGap).toBeLessThanOrEqual(16);
    expect(navState.scrollY).toBe(0);
  });

  test("parent calendar page add saves a single-child schedule with a child link", async ({ page }) => {
    const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
    await mainTabbar.getByRole("button", { name: "일정" }).click();
    await expect(page.getByRole("region", { name: "부모 캘린더" })).toBeVisible();

    await page.locator(".hyeni-v5-page-add").click();
    await page.getByPlaceholder("예) 영어 학원, 태권도...").fill("기본 연결 일정");
    await page.locator("button.sheet-save").click();

    await expect.poll(() => state.insertedEventChildren.length).toBeGreaterThan(0);
    expect(state.insertedEventChildren).toContainEqual(
      expect.objectContaining({ child_id: "member-child-1" }),
    );
  });

  test("parent child tracker sends a native location refresh push fallback", async ({ page }) => {
    const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    await page.getByRole("button", { name: "📍 우리아이" }).click();
    await expect(page.getByRole("button", { name: "현재 위치 다시 확인" })).toBeVisible();

    await expect.poll(() => state.functionCalls.find((call) => call.body?.action === "request_location")?.body).toMatchObject({
      action: "request_location",
      familyId: FAMILY_ID,
      targetRole: "child",
    });
  });

  test("parent dashboard bootstraps child location and device status after reload", async ({ page }) => {
    const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();

    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "request_location")).toBeTruthy();
    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "request_device_status")).toBeTruthy();
  });

  test("parent dashboard renders persisted child device health before live broadcast refresh", async ({ page }) => {
    await installCriticalMocks(page, {
      role: "parent",
      initiallyPaired: true,
      childDeviceHealth: {
        batteryLevel: 42,
        isCharging: true,
        connectionType: "wifi",
        screenOnMs: 65 * 60_000,
        recentApp: "com.youtube",
        usagePermission: "granted",
        updatedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      },
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();
    const deviceSection = page.getByRole("region", { name: "아이 기기 사용 지표" });

    await expect(deviceSection).toContainText("42%");
    await expect(deviceSection).toContainText("1시간 5분");
    await expect(deviceSection).not.toContainText("충전 중");
    await expect(deviceSection).not.toContainText("wifi");
    await expect(deviceSection).not.toContainText("com.youtube");

    await deviceSection.getByRole("button", { name: "상세" }).click();
    await expect(deviceSection).toContainText("충전 중");
    await expect(deviceSection).toContainText("wifi");
    await expect(deviceSection).toContainText("com.youtube");
  });

  test("parent dashboard manual refresh requests child location and device status together", async ({ page }) => {
    const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();
    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "request_device_status")).toBeTruthy();
    state.functionCalls.length = 0;

    await page.getByRole("button", { name: "지금 갱신" }).click();

    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "request_device_status")).toBeTruthy();
    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "request_location")).toBeTruthy();
  });

  test("parent dashboard device refresh targets every paired child", async ({ page }) => {
    const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true, extraChild: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();
    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "request_device_status")).toBeTruthy();
    state.functionCalls.length = 0;

    await page.getByRole("button", { name: "지금 갱신" }).click();

    await expect.poll(() => {
      return state.functionCalls
        .filter((call) => call.body?.action === "request_device_status")
        .map((call) => call.body?.targetUserId)
        .filter(Boolean)
        .sort();
    }).toEqual([CHILD_ID, SECOND_CHILD_ID].sort());
  });

  test("parent map refresh polls until refreshed child location is visible", async ({ page }) => {
    const state = await installCriticalMocks(page, {
      role: "parent",
      initiallyPaired: true,
      refreshLocationAfterRequest: true,
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();
    await page.getByRole("button", { name: "📍 우리아이" }).click();
    await expect(page.getByRole("button", { name: /37\.56650,\s*126\.97800/ })).toBeVisible();

    state.locationRefreshRequests = 0;
    state.childLocationGetsAfterRefresh = 0;
    state.enableRefreshedLocation = true;
    await page.getByRole("button", { name: "현재 위치 다시 확인" }).click();

    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "request_location")).toBeTruthy();
    await expect(page.getByRole("button", { name: /37\.56990,\s*126\.98220/ })).toBeVisible({ timeout: 7_000 });
  });

  test("parent child tracker shows dwell duration instead of same-place time range", async ({ page }) => {
    const selectedDay = currentDateParts();
    const at = (hour, minute) => new Date(selectedDay.year, selectedDay.month, selectedDay.day, hour, minute).toISOString();
    await installCriticalMocks(page, {
      role: "parent",
      initiallyPaired: true,
      locationHistoryRows: [
        { user_id: CHILD_ID, lat: 37.56650, lng: 126.97800, recorded_at: at(8, 23) },
        { user_id: CHILD_ID, lat: 37.56662, lng: 126.97804, recorded_at: at(8, 28) },
        { user_id: CHILD_ID, lat: 37.56673, lng: 126.97807, recorded_at: at(8, 34) },
      ],
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    await page.getByRole("button", { name: "📍 우리아이" }).click();

    await expect(page.getByText("오래 머문 곳")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("11분 머무름")).toBeVisible();
    await expect(page.getByText(/08:23.*08:34|오전 08:23.*오전 08:34/)).toHaveCount(0);
  });

  test("parent main calendar empty date tap opens schedule add sheet and saves to that date", async ({ page }) => {
    const now = new Date();
    const targetDay = now.getDate() === 1 ? 2 : now.getDate() - 1;
    const visibleMonth = now.getMonth() + 1;
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainCalendar = page.getByRole("region", { name: "캘린더" }).first();
    await mainCalendar.getByRole("button", { name: new RegExp(`${visibleMonth}월 ${targetDay}일`) }).click();
    await expect(page.getByRole("dialog", { name: "새 일정" })).toBeVisible();

    const colors = await page.evaluate(
      ({ todayDay, targetDay, visibleMonth }) => {
        const calendar = document.querySelector('[aria-label="캘린더"]');
        const buttonFor = (day) => Array.from(calendar?.querySelectorAll("button") || [])
          .find((button) => (button.getAttribute("aria-label") || "").includes(`${visibleMonth}월 ${day}일`));
        const visual = (button) => {
          if (!button) return "";
          const style = getComputedStyle(button);
          return style.backgroundImage === "none" ? style.backgroundColor : style.backgroundImage;
        };
        return {
          today: visual(buttonFor(todayDay)),
          selected: visual(buttonFor(targetDay)),
        };
      },
      { todayDay: now.getDate(), targetDay, visibleMonth },
    );
    expect(colors.selected).toBeTruthy();
    expect(colors.today).toBeTruthy();
    expect(colors.selected).not.toBe(colors.today);

    await page.getByPlaceholder("예) 영어 학원, 태권도...").fill("미술 학원");
    await page.locator("button.sheet-save").click();

    const parentMain = page.getByLabel("부모 메인");
    await expect(parentMain.getByRole("button", { name: "미술 학원 편집" })).toBeVisible();
    await expect(parentMain.locator(".hyeni-v5-section-head .hyeni-v5-date-count").getByText(`${visibleMonth}월 ${targetDay}일`)).toBeVisible();
  });

  test("parent main calendar event date tap still opens schedule add sheet for additional events", async ({ page }) => {
    const now = new Date();
    const targetDay = now.getDate() === 1 ? 2 : now.getDate() - 1;
    const visibleMonth = now.getMonth() + 1;
    const targetDateKey = `${now.getFullYear()}-${now.getMonth()}-${targetDay}`;
    const seedEvent = buildEventRow({
      id: "event-existing-on-tapped-date",
      date_key: targetDateKey,
      title: "태권도",
      time: "15:00",
      location: null,
    });
    await installCriticalMocks(page, {
      role: "parent",
      initiallyPaired: true,
      seedEvents: [seedEvent],
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainCalendar = page.getByRole("region", { name: "캘린더" }).first();
    await mainCalendar.getByRole("button", { name: new RegExp(`${visibleMonth}월 ${targetDay}일.*일정 1개`) }).click();
    await expect(page.getByRole("dialog", { name: "새 일정" })).toBeVisible();

    await page.getByPlaceholder("예) 영어 학원, 태권도...").fill("영어 보강");
    await page.locator("button.sheet-save").click();

    const parentMain = page.getByLabel("부모 메인");
    await expect(parentMain.getByRole("button", { name: "태권도 편집" })).toBeVisible();
    await expect(parentMain.getByRole("button", { name: "영어 보강 편집" })).toBeVisible();
    await expect(parentMain.locator(".hyeni-v5-section-head .hyeni-v5-date-count").getByText(`${visibleMonth}월 ${targetDay}일`)).toBeVisible();
  });

  test("parent event sheet closes when the sheet header is dragged down", async ({ page }) => {
    const now = new Date();
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainCalendar = page.getByRole("region", { name: "캘린더" }).first();
    await mainCalendar.getByRole("button", { name: new RegExp(`${now.getMonth() + 1}월 ${now.getDate()}일`) }).click();
    const sheet = page.getByRole("dialog", { name: "새 일정" });
    await expect(sheet).toBeVisible();

    const header = sheet.locator(".event-sheet-header");
    const box = await header.boundingBox();
    expect(box).toBeTruthy();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await header.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
      bubbles: true,
      cancelable: true,
    });
    await page.dispatchEvent("body", "pointermove", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y + 170,
      buttons: 1,
      bubbles: true,
      cancelable: true,
    });
    await page.dispatchEvent("body", "pointerup", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y + 170,
      button: 0,
      buttons: 0,
      bubbles: true,
      cancelable: true,
    });

    await expect(sheet).toHaveCount(0);
  });

  test("parent event location map picker closes when the sheet header is dragged down", async ({ page }) => {
    const now = new Date();
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainCalendar = page.getByRole("region", { name: "캘린더" }).first();
    await mainCalendar.getByRole("button", { name: new RegExp(`${now.getMonth() + 1}월 ${now.getDate()}일`) }).click();
    const sheet = page.getByRole("dialog", { name: "새 일정" });
    await expect(sheet).toBeVisible();

    await sheet.getByRole("button", { name: "🗺️ 지도에서 장소 선택" }).click();
    const mapDialog = page.getByRole("dialog", { name: "📍 장소 설정" });
    await expect(mapDialog).toBeVisible();

    const header = mapDialog.locator(".map-picker-header");
    const box = await header.boundingBox();
    expect(box).toBeTruthy();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await header.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
      bubbles: true,
      cancelable: true,
    });
    await page.dispatchEvent("body", "pointermove", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y + 180,
      buttons: 1,
      bubbles: true,
      cancelable: true,
    });
    await page.dispatchEvent("body", "pointerup", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y + 180,
      button: 0,
      buttons: 0,
      bubbles: true,
      cancelable: true,
    });

    await expect(mapDialog).toHaveCount(0);
    await expect(sheet).toBeVisible();
  });

  test("parent place manager keeps bottom navigation visible and usable", async ({ page }) => {
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const managementRail = page.locator('[aria-label="관리 바로가기"]');
    await managementRail.getByRole("button", { name: "장소관리" }).click();
    await expect(page.getByText("📍 장소관리").first()).toBeVisible();

    const navState = await page.evaluate(() => {
      const nav = document.querySelector(".hyeni-manager-bottom-nav .hyeni-v5-tabbar");
      const active = nav?.querySelector("button.active");
      const rect = nav?.getBoundingClientRect();
      const style = nav ? getComputedStyle(nav) : null;
      return {
        activeText: active?.innerText || "",
        position: style?.position || "",
        visible: !!rect && rect.width > 0 && rect.height > 0,
        bottomGap: rect ? Math.round(window.innerHeight - rect.bottom) : null,
      };
    });
    expect(navState.activeText).toContain("장소관리");
    expect(navState.position).toBe("relative");
    expect(navState.visible).toBe(true);
    expect(navState.bottomGap).toBeLessThanOrEqual(24);

    await page.getByRole("navigation", { name: "부모 메인 탭" }).getByRole("button", { name: "오늘" }).click();
    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("📍 장소관리")).toHaveCount(0);
  });

  test("parent calendar marks event days with color dots instead of clipped titles", async ({ page }) => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const targetDay = now.getDate() === daysInMonth ? now.getDate() - 1 : now.getDate() + 1;
    const targetDateKey = `${now.getFullYear()}-${now.getMonth()}-${targetDay}`;
    const taekwondoEvent = buildEventRow({
      id: "event-taekwondo",
      date_key: targetDateKey,
      title: "태권도",
      time: "15:00",
      color: "#A78BFA",
      location: null,
    });
    await installCriticalMocks(page, {
      role: "parent",
      initiallyPaired: true,
      seedEvents: [taekwondoEvent],
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
    await mainTabbar.getByRole("button", { name: "일정" }).click();

    const calendarPage = page.getByRole("region", { name: "부모 캘린더" });
    const dayButton = calendarPage.getByRole("button", {
      name: new RegExp(`${now.getMonth() + 1}월 ${targetDay}일.*일정 1개`),
    });
    await expect(dayButton).toBeVisible();
    await dayButton.click();

    const markerDetails = await dayButton.evaluate((button) => {
      const firstDot = button.querySelector(".hyeni-v5-calendar-dots span");
      return {
        text: button.textContent || "",
        chipCount: button.querySelectorAll(".cal-chip").length,
        dotCount: button.querySelectorAll(".hyeni-v5-calendar-dots span").length,
        firstDotColor: firstDot ? getComputedStyle(firstDot).backgroundColor : "",
      };
    });

    expect(markerDetails.text).not.toContain("태권도");
    expect(markerDetails.chipCount).toBe(0);
    expect(markerDetails.dotCount).toBe(1);
    expect(markerDetails.firstDotColor).toBe("rgb(247, 121, 168)");
  });

  test("parent calendar selected-day statuses use minute, hour-minute, and day labels", async ({ page }) => {
    const minuteEvent = buildFutureEventRow({ id: "event-future-minute", title: "분 단위 일정", offsetMinutes: 35 });
    const hourEvent = buildFutureEventRow({ id: "event-future-hour", title: "시간 단위 일정", offsetMinutes: 75 });
    const dayEvent = buildFutureEventRow({ id: "event-future-day", title: "일 단위 일정", offsetMinutes: 26 * 60 });
    await installCriticalMocks(page, {
      role: "parent",
      initiallyPaired: true,
      seedEvents: [minuteEvent, hourEvent, dayEvent],
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
    await mainTabbar.getByRole("button", { name: "일정" }).click();
    await expect(page.getByRole("region", { name: "부모 캘린더" })).toBeVisible();

    await expectCalendarEventStatus(page, minuteEvent, /^\d+분 뒤$/);
    await expectCalendarEventStatus(page, hourEvent, /^1시간 \d+분 뒤$/);
    await expectCalendarEventStatus(page, dayEvent, "1일 뒤");
  });

  test("parent route guidance uses the child's location instead of parent device GPS", async ({ page }) => {
    await installCriticalMocks(page, {
      role: "parent",
      initiallyPaired: true,
      deviceLocation: { latitude: 35.1796, longitude: 129.0756, accuracy: 10 },
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const routeButton = page.getByRole("button", { name: "영어 학원 경로 보기" }).first();
    await routeButton.scrollIntoViewIfNeeded();
    await routeButton.click();

    await expect(page.getByText("ROUTE")).toBeVisible();
    await expect(page.getByRole("button", { name: "🐰 아이 위치" })).toBeVisible();

    const geoCalls = await page.evaluate(() => window.__hyeniGeoCalls || {});
    expect(geoCalls).toMatchObject({ getCurrentPosition: 0, watchPosition: 0 });
  });

  test("parent calendar shows the selected child's day movement summary", async ({ page }) => {
    const selectedDay = currentDateParts();
    const at = (hour, minute) => new Date(selectedDay.year, selectedDay.month, selectedDay.day, hour, minute).toISOString();
    await installCriticalMocks(page, {
      role: "parent",
      initiallyPaired: true,
      extraChild: true,
      locationHistoryRows: [
        { user_id: CHILD_ID, lat: 37.5665, lng: 126.9780, recorded_at: at(8, 10) },
        { user_id: CHILD_ID, lat: 37.5670, lng: 126.9790, recorded_at: at(8, 35) },
        { user_id: CHILD_ID, lat: 37.5700, lng: 126.9820, recorded_at: at(9, 5) },
        { user_id: SECOND_CHILD_ID, lat: 37.5900, lng: 126.9900, recorded_at: at(10, 0) },
      ],
    });
    await page.goto("/");

    await page.getByRole("button", { name: /^혜니 오늘 일정/ }).evaluate((button) => button.click());
    const summary = page.getByRole("region", { name: "선택한 날짜 이동경로 요약" });
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("혜니");
    await expect(summary).not.toContainText("이동 기록");
    await expect(summary).toContainText("영어 학원 : 25분 머무름");
    const placeListIsUnderMap = await summary.evaluate((element) => {
      const map = element.querySelector('[aria-label="선택한 날짜 이동경로 지도"]');
      const list = element.querySelector(".hyeni-v5-movement-summary__visits");
      if (!map || !list) return false;
      return !!(map.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(placeListIsUnderMap).toBe(true);

    await page.getByRole("group", { name: "자녀 빠른 전환" }).getByRole("button", { name: "민이", exact: true }).evaluate((button) => button.click());
    await expect(summary).toContainText("민이");
    await expect(summary).toContainText("등록된 장소 근처 이동내역이 없어요.");
  });

  test("parent remote listen distinguishes child device failure reasons", async ({ page }) => {
    await installCriticalMocks(page, {
      role: "parent",
      initiallyPaired: true,
      childDeviceHealth: {
        recordAudio: false,
        postNotif: false,
        channelOk: false,
        fullScreen: false,
        battery: false,
        powerSaveMode: true,
        backgroundRestricted: true,
        locationOk: true,
        dndMode: "priority",
        dndAccess: false,
        ringerMode: "silent",
        networkConnected: false,
        screenInteractive: false,
        keyguardLocked: true,
        foldState: "possibly_folded",
        lastReportedAt: new Date().toISOString(),
      },
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    await page.getByRole("button", { name: "🎙️ 주변소리" }).click();
    const dialog = page.getByText("주변 소리 듣기").locator("..").locator("..");

    await expect(dialog).toContainText("마이크 권한 필요");
    await expect(dialog).toContainText("알림 권한 꺼짐");
    await expect(dialog).toContainText("방해 금지 모드 영향");
    await expect(dialog).toContainText("무음 모드");
    await expect(dialog).toContainText("화면 꺼짐/잠금");
    await expect(dialog).toContainText("네트워크 끊김");
    await expect(dialog).toContainText("배터리 최적화 제한");
    await expect(dialog).toContainText("절전 모드 켜짐");
    await expect(dialog).toContainText("백그라운드 제한");
    await expect(dialog).toContainText("폴더블 접힘 상태 확인");
  });

  test("family pairing management treats advisory remote-listen states as connectable", async ({ page }) => {
    await installCriticalMocks(page, {
      role: "parent",
      initiallyPaired: true,
      childDeviceHealth: {
        recordAudio: true,
        postNotif: true,
        channelOk: true,
        fullScreen: false,
        battery: false,
        powerSaveMode: true,
        backgroundRestricted: true,
        locationOk: true,
        dndMode: "priority",
        dndAccess: false,
        ringerMode: "vibrate",
        networkConnected: true,
        networkValidated: true,
        screenInteractive: false,
        keyguardLocked: true,
        foldState: "possibly_folded",
        lastReportedAt: new Date().toISOString(),
      },
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();
    await page.getByRole("button", { name: "연동 (1명)" }).click();

    await expect(page.getByText("원격 청취 연결 가능")).toBeVisible();
    await expect(page.getByText(/확인:/)).toBeVisible();
    await expect(page.getByText("배터리 최적화 제한")).toBeVisible();
    await expect(page.getByText("원격 청취 준비 부족")).toHaveCount(0);
    await expect(page.getByText("원격 청취 설정 필요")).toHaveCount(0);
  });

  test("parent dashboard uses redesign v1 calendar and timeline details", async ({ page }) => {
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const main = page.getByLabel("부모 메인");
    const calendar = main.getByRole("region", { name: "캘린더" });

    await expect(calendar.locator(".hyeni-v5-calendar-card")).toBeVisible();

    const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
    await mainTabbar.getByRole("button", { name: "일정" }).click();
    const calendarPage = page.getByRole("region", { name: "부모 캘린더" });
    await expect(calendarPage.locator(".hyeni-v5-timeline-list .hyeni-v5-event-card").first()).toBeVisible();

    const details = await page.evaluate(() => {
      const pageEl = document.querySelector('[aria-label="부모 캘린더"]');
      const countAccent = pageEl?.querySelector(".hyeni-v5-count-accent");
      const list = pageEl?.querySelector(".hyeni-v5-timeline-list");
      const firstCard = list?.querySelector(".hyeni-v5-event-card");
      const firstDot = pageEl?.querySelector(".hyeni-v5-calendar-dots span");
      const calendarGrid = pageEl?.querySelector(".hyeni-v5-calendar-grid");
      return {
        countText: countAccent?.textContent?.trim() || "",
        countColor: countAccent ? getComputedStyle(countAccent).color : "",
        calendarGridGap: calendarGrid ? getComputedStyle(calendarGrid).gap : "",
        timelineLineWidth: list ? getComputedStyle(list, "::before").width : "",
        eventStripeWidth: firstCard ? getComputedStyle(firstCard).borderLeftWidth : "",
        eventStripeColor: firstCard ? getComputedStyle(firstCard).borderLeftColor : "",
        eventDotWidth: firstCard ? getComputedStyle(firstCard, "::after").width : "",
        eventDotColor: firstCard ? getComputedStyle(firstCard, "::after").backgroundColor : "",
        calendarDotColor: firstDot ? getComputedStyle(firstDot).backgroundColor : "",
      };
    });

    expect(details.countText).toMatch(/\d+개/);
    expect(details.countColor).toBe("rgb(230, 92, 146)");
    expect(details.calendarGridGap).toContain("2px");
    expect(details.timelineLineWidth).toBe("2px");
    expect(details.eventStripeWidth).toBe("3px");
    expect(details.eventStripeColor).toBe("rgb(167, 139, 250)");
    expect(details.eventDotWidth).toBe("8px");
    expect(details.eventDotColor).toBe("rgb(167, 139, 250)");
    expect(details.calendarDotColor).toBe("rgb(247, 121, 168)");
  });

  test("parent top header controls do not overlap on narrow mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await page.getByRole("button", { name: "확인했어요" }).click({ timeout: 15_000 });
    const header = page.locator(".hyeni-top-header");
    await expect(header).toBeVisible();

    const metrics = await page.evaluate(() => {
      const headerEl = document.querySelector(".hyeni-top-header");
      if (!headerEl) return { missing: true, overflowX: 999, viewportOverflow: 999, overlaps: [] };

      const rectOf = (element) => {
        const r = element.getBoundingClientRect();
        return {
          label: element.getAttribute("aria-label") || element.textContent.trim().replace(/\s+/g, " "),
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      const rects = Array.from(headerEl.querySelectorAll("button")).map(rectOf);
      const overlaps = [];
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i];
          const b = rects[j];
          const separated = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          if (!separated) overlaps.push(`${a.label} / ${b.label}`);
        }
      }

      const headerRect = headerEl.getBoundingClientRect();
      return {
        missing: false,
        overflowX: Math.max(0, Math.ceil(headerEl.scrollWidth - headerEl.clientWidth)),
        viewportOverflow: Math.max(0, Math.ceil(headerRect.right - window.innerWidth), Math.ceil(-headerRect.left)),
        overlaps,
      };
    });

    expect(metrics.missing).toBe(false);
    expect(metrics.overflowX).toBeLessThanOrEqual(1);
    expect(metrics.viewportOverflow).toBe(0);
    expect(metrics.overlaps).toEqual([]);
  });

  test("parent home matches redesign v1 family hero and today summary cards", async ({ page }) => {
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const details = await page.evaluate(() => {
      const shell = document.querySelector(".hyeni-app-shell");
      const hero = document.querySelector('[aria-label="혜니 오늘 요약"]');
      const heroCount = hero?.querySelector(".hyeni-v1-hero-count");
      const parentMain = document.querySelector('[aria-label="부모 메인"]');
      const sectionHead = parentMain?.querySelector(".hyeni-v5-section-head");
      const kidCard = parentMain?.querySelector(".hyeni-v5-kid-card");
      const kidAvatar = kidCard?.querySelector(".hyeni-v5-kid-avatar");
      const eventList = parentMain?.querySelector(".hyeni-v1-home-event-list");
      const eventCard = eventList?.querySelector(".hyeni-v5-event-card");
      const eventIcon = eventCard?.querySelector(".hyeni-v5-event-icon");
      const eventDelete = eventCard?.querySelector(".hyeni-v5-event-delete");
      const styleOf = (element, pseudo) => element ? getComputedStyle(element, pseudo) : null;
      const shellStyle = styleOf(shell);
      const heroStyle = styleOf(hero);
      const heroCountStyle = styleOf(heroCount);
      const sectionHeadStyle = styleOf(sectionHead);
      const kidCardStyle = styleOf(kidCard);
      const kidAvatarStyle = styleOf(kidAvatar);
      const eventListBeforeStyle = styleOf(eventList, "::before");
      const eventCardStyle = styleOf(eventCard);
      const eventIconStyle = styleOf(eventIcon);
      const eventDeleteStyle = styleOf(eventDelete);
      return {
        shellBackground: shellStyle?.backgroundImage || "",
        heroBackground: heroStyle?.backgroundImage || "",
        heroColor: heroStyle?.color || "",
        heroBoxShadow: heroStyle?.boxShadow || "",
        heroRadius: heroStyle?.borderRadius || "",
        heroCountColor: heroCountStyle?.color || "",
        sectionHeadColor: sectionHeadStyle?.color || "",
        sectionHeadWeight: sectionHeadStyle?.fontWeight || "",
        kidCardBackground: kidCardStyle?.backgroundColor || "",
        kidCardRadius: kidCardStyle?.borderRadius || "",
        kidCardPadding: kidCardStyle?.padding || "",
        kidAvatarWidth: kidAvatarStyle?.width || "",
        kidAvatarRadius: kidAvatarStyle?.borderRadius || "",
        eventListClassed: Boolean(eventList),
        eventListBeforeContent: eventListBeforeStyle?.content || "",
        eventCardBackground: eventCardStyle?.backgroundColor || "",
        eventCardRadius: eventCardStyle?.borderRadius || "",
        eventStripeWidth: eventCardStyle?.borderLeftWidth || "",
        eventStripeColor: eventCardStyle?.borderLeftColor || "",
        eventIconWidth: eventIconStyle?.width || "",
        eventIconRadius: eventIconStyle?.borderRadius || "",
        eventDeleteDisplay: eventDeleteStyle?.display || "",
      };
    });

    expect(details.shellBackground).toContain("rgb(253, 250, 251)");
    expect(details.shellBackground).toContain("rgb(246, 240, 243)");
    expect(details.heroBackground).toBe("none");
    expect(details.heroColor).toBe("rgb(31, 26, 34)");
    expect(details.heroBoxShadow).toBe("none");
    expect(details.heroRadius).toBe("0px");
    expect(details.heroCountColor).toBe("rgb(230, 92, 146)");
    expect(details.sectionHeadColor).toBe("rgb(107, 95, 115)");
    expect(details.sectionHeadWeight).toBe("700");
    expect(details.kidCardBackground).toBe("rgb(255, 255, 255)");
    expect(details.kidCardRadius).toBe("20px");
    expect(details.kidCardPadding).toBe("12px 14px");
    expect(details.kidAvatarWidth).toBe("36px");
    expect(details.kidAvatarRadius).toBe("12px");
    expect(details.eventListClassed).toBe(true);
    expect(details.eventListBeforeContent).toBe("none");
    expect(details.eventCardBackground).toBe("rgb(255, 255, 255)");
    expect(details.eventCardRadius).toBe("20px");
    expect(details.eventStripeWidth).toBe("3px");
    expect(details.eventStripeColor).toBe("rgb(167, 139, 250)");
    expect(details.eventIconWidth).toBe("36px");
    expect(details.eventIconRadius).toBe("10px");
    expect(details.eventDeleteDisplay).toBe("none");
  });

  test("parent memo tab keeps the fixed bottom navigation visible", async ({ page }) => {
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
    await mainTabbar.getByRole("button", { name: "메모" }).click();

    await expect(page.getByRole("main", { name: "오늘의 메모 페이지" })).toBeVisible();

    const navState = await page.evaluate(() => {
      const nav = document.querySelector(".hyeni-v5-tabbar-fixed");
      const active = nav?.querySelector("button.active");
      const rect = nav?.getBoundingClientRect();
      const composerRect = document.querySelector(".hyeni-memo-composer")?.getBoundingClientRect();
      return {
        activeText: active?.innerText || "",
        position: nav ? getComputedStyle(nav).position : "",
        bottomGap: rect ? Math.round(window.innerHeight - rect.bottom) : null,
        composerClear: Boolean(rect && composerRect && composerRect.bottom <= rect.top),
      };
    });
    expect(navState.activeText).toContain("메모");
    expect(navState.position).toBe("fixed");
    expect(navState.bottomGap).toBeLessThanOrEqual(16);
    expect(navState.composerClear).toBe(true);

    await page.evaluate(() => {
      const nav = document.querySelector(".hyeni-v5-tabbar-fixed");
      const todayButton = Array.from(nav?.querySelectorAll("button") || [])
        .find((button) => button.innerText.includes("오늘"));
      todayButton?.click();
    });
    await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
  });

  test("child memo keeps short Korean replies horizontal", async ({ page }) => {
    await installCriticalMocks(page, {
      role: "child",
      initiallyPaired: true,
      insideArrivalZone: true,
    });
    await page.goto("/");

    await expect(page.getByRole("button", { name: /부모님 메모/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /부모님 메모/ }).click();
    await expect(page.getByRole("main", { name: "오늘의 메모 페이지" })).toBeVisible();

    await page.getByLabel("메모 입력").fill("하이");
    await page.getByRole("button", { name: "메시지 보내기" }).click();

    const bubble = page.locator(".memo-bubble").filter({ hasText: "하이" }).last();
    await expect(bubble).toBeVisible();
    const bubbleMetrics = await bubble.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        wordBreak: style.getPropertyValue("word-break"),
        whiteSpace: style.getPropertyValue("white-space"),
        overflowWrap: style.getPropertyValue("overflow-wrap"),
        width: rect.width,
        height: rect.height,
      };
    });

    expect(bubbleMetrics.wordBreak).toBe("keep-all");
    expect(bubbleMetrics.whiteSpace).toBe("pre-wrap");
    expect(bubbleMetrics.overflowWrap).toBe("break-word");
    expect(bubbleMetrics.width).toBeGreaterThan(bubbleMetrics.height);
  });

  test("child mode requires pairing before showing schedule and can send kkuk", async ({ page }) => {
    const state = await installCriticalMocks(page, {
      role: "child",
      initiallyPaired: false,
      insideArrivalZone: true,
    });
    await page.goto("/");

    await expect(page.getByText("부모님과 연결하기")).toBeVisible();
    await page.getByPlaceholder("XXXXXXXX").fill("804DF582");
    await page.getByRole("button", { name: "🔗 연결하기" }).click();

    await expect(page.getByRole("region", { name: "오늘은 뭐해?" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("img", { name: "🐰 캐릭터" })).toBeVisible();
    await expect(page.getByText("영어 학원").first()).toBeVisible();
    await expect(page.getByText("서울특별시 중구 세종대로 110").first()).toBeVisible();
    await expect(page.getByText(/GPS 정확도/)).toHaveCount(0);

    await page.getByRole("button", { name: "꾹 보내기" }).click();
    await expect(page.getByText("꾹을 보냈어요!")).toBeVisible();
    expect(state.rpcCalls.some((call) => call.name === "join_family")).toBeTruthy();
    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "kkuk")).toBeTruthy();
  });

  test("child QR pairing opens camera, scans the pair code, and joins family", async ({ page }) => {
    const state = await installCriticalMocks(page, {
      role: "child",
      initiallyPaired: false,
      insideArrivalZone: true,
      qrRawValue: `https://hyenicalendar.com/join?pairCode=${PAIR_CODE}`,
    });
    await page.goto("/");

    await expect(page.getByText("부모님과 연결하기")).toBeVisible();
    await page.getByRole("button", { name: /QR로 연결하기/ }).click();

    await expect(page.getByRole("region", { name: "오늘은 뭐해?" })).toBeVisible({ timeout: 15_000 });

    expect(state.rpcCalls.some((call) => call.name === "join_family")).toBeTruthy();
    expect(await page.evaluate(() => window.__hyeniCameraCalls?.getUserMedia || 0)).toBeGreaterThan(0);
  });

  test("child mode lets the child change their animal character", async ({ page }) => {
    const state = await installCriticalMocks(page, {
      role: "child",
      initiallyPaired: true,
      insideArrivalZone: true,
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "오늘은 뭐해?" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("img", { name: "🐰 캐릭터" })).toBeVisible();

    await page.getByRole("button", { name: "설정" }).click();
    await expect(page.getByRole("radiogroup", { name: "동물 캐릭터 선택" })).toBeVisible();

    await page.getByRole("radio", { name: /고양이 캐릭터/ }).click();
    await expect(page.getByRole("radio", { name: /고양이 캐릭터 \(선택됨\)/ })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "뒤로" }).click();
    await expect(page.getByRole("img", { name: "🐱 캐릭터" })).toBeVisible();
    expect(state.memberUpdates).toContainEqual(expect.objectContaining({ emoji: "🐱" }));
  });

  test("child route view does not fall back to a straight line when walking route fails", async ({ page }) => {
    await installCriticalMocks(page, {
      role: "child",
      initiallyPaired: true,
      insideArrivalZone: false,
      walkingRoute: "failure",
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "오늘은 뭐해?" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "🧭 길찾기" }).click();

    await expect(page.getByRole("button", { name: "길안내 시작" })).toBeVisible();
    await expect(page.getByText("경로 검색 중")).toBeHidden({ timeout: 8_000 });
    await expect(page.getByText("도보 경로를 불러오지 못했어요")).toBeVisible();
    await expect(page.getByText(/예상 직선거리/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "길안내 시작" })).toBeDisabled();
  });

  test("child route guidance stays inside the app", async ({ page }) => {
    await page.addInitScript(() => {
      window.__openedUrls = [];
      window.open = (url) => {
        window.__openedUrls.push(String(url));
        return { closed: false, focus() {} };
      };
    });
    await installCriticalMocks(page, {
      role: "child",
      initiallyPaired: true,
      insideArrivalZone: false,
      walkingRoute: "success",
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "오늘은 뭐해?" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "🧭 길찾기" }).click();

    const beforeUrl = page.url();
    await page.getByRole("button", { name: "길안내 시작" }).click();
    await expect(page.getByText("경로 검색 중")).toBeHidden();
    await expect(page.getByText("길안내를 시작했어요")).toBeVisible();
    await expect(page.getByRole("button", { name: "전체 경로 보기" })).toBeVisible();
    const openedUrls = await page.evaluate(() => window.__openedUrls || []);
    expect(openedUrls).toHaveLength(0);
    expect(page.url()).toBe(beforeUrl);
  });
});
