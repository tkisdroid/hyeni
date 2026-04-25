import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import process from "node:process";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://example.supabase.co";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";
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
  const {
    role = "parent",
    initiallyPaired = true,
    insideArrivalZone = false,
    walkingRoute = "success",
    seedEvents = [],
  } = options;
  const state = {
    paired: role === "parent" ? true : initiallyPaired,
    insertedEvents: [],
    functionCalls: [],
    rpcCalls: [],
    routeRequests: [],
  };
  const userId = role === "child" ? CHILD_ID : PARENT_ID;

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
    { projectRef: PROJECT_REF, role, userId, familyId: FAMILY_ID },
  );

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const fulfillJson = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
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
      state.functionCalls.push({
        name: url.pathname.split("/").pop(),
        body: request.postData() ? request.postDataJSON() : null,
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
      if (query.get("user_id")) {
        if (role === "child" && !state.paired) return fulfillJson(null);
        return fulfillJson({
          family_id: FAMILY_ID,
          role,
          name: role === "child" ? "혜니" : "엄마",
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
      if (method === "POST") state.insertedEvents.push(request.postDataJSON());
      return fulfillJson(method === "GET" ? eventRows : []);
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
      return fulfillJson(
        method === "GET"
          ? [
              {
                user_id: CHILD_ID,
                lat: 37.5665,
                lng: 126.978,
                updated_at: new Date().toISOString(),
              },
            ]
          : [],
      );
    }

    if (
      [
        "academies",
        "memos",
        "memo_replies",
        "location_history",
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
  test("parent mode covers emergency, location, scheduling, AI, notifications, remote audio, and kkuk", async ({ page }) => {
    const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "오늘의 가족" })).toBeVisible();
    await expect(page.getByText("학부모 모드")).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    await expect(page.getByRole("button", { name: "🔗 연동 (1명)" })).toBeVisible();
    await page.getByRole("button", { name: "📍 우리아이" }).click();
    await expect(page.getByText("아이 위치 · 안전")).toBeVisible();
    await expect(page.getByText("혜니 실시간")).toBeVisible();
    await page.getByRole("button", { name: "← 돌아가기" }).click();

    await page.getByRole("button", { name: "+" }).click();
    await page.getByPlaceholder("예) 영어 학원, 태권도...").fill("피아노 연습");
    await page.getByRole("button", { name: "🗺️ 지도에서 장소 선택" }).click();
    await page.getByPlaceholder("🔍 학원 이름이나 주소 검색...").fill("세종대로");
    await page.getByRole("button", { name: "검색" }).click();
    await page.getByText("세종대로", { exact: true }).click();
    await page.getByRole("button", { name: "📍 이 장소로 설정하기" }).click();
    await expect(page.getByText("서울특별시 중구 세종대로 110").first()).toBeVisible();
    await page.getByRole("button", { name: "🐰 일정 추가하기!" }).click();
    await expect(page.getByText("피아노 연습")).toBeVisible();

    await page.getByRole("button", { name: "🤖 AI로 일정입력" }).click();
    await page.locator("#ai-text-input").fill("오늘 4시 반 수학 학원, 교재 챙기기");
    await page.getByRole("button", { name: "✅ 다 입력했어요^^" }).click();
    await expect(page.getByText("수학 학원", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "모두 등록" }).click();
    await expect(page.getByText("수학 학원", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "🔔 일정알림" }).click();
    await expect(page.getByText("일정 알림 설정")).toBeVisible();
    await page.getByRole("button", { name: "10분 전 알림" }).click();
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("일정 알림 설정이 저장됐어요!")).toBeVisible();

    await page.getByRole("button", { name: "🎙️ 주변소리" }).click();
    await expect(page.getByText("주변 소리 듣기")).toBeVisible();
    await page.getByRole("button", { name: "🎙️ 듣기 시작" }).click();
    await expect(page.getByText("아이 기기 연결 중...")).toBeVisible();
    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "remote_listen")).toBeTruthy();
    await page.getByRole("button", { name: "⏹️ 중지" }).click();
    await page.getByRole("button", { name: "닫기" }).click();

    await page.getByRole("button", { name: "💗 꾹" }).click();
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

    await expect(page.getByRole("region", { name: "오늘의 가족" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
    await expect(mainTabbar.getByRole("button", { name: "캘린더" })).toBeVisible();

    await mainTabbar.getByRole("button", { name: "캘린더" }).click();

    await expect(page.getByRole("region", { name: "부모 캘린더" })).toBeVisible();
    await expect(page.getByRole("region", { name: "오늘의 가족" })).toHaveCount(0);

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
    expect(navState.activeText).toContain("캘린더");
    expect(navState.position).toBe("fixed");
    expect(navState.bottomGap).toBeLessThanOrEqual(16);
    expect(navState.scrollY).toBe(0);
  });

  test("parent child tracker sends a native location refresh push fallback", async ({ page }) => {
    const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "오늘의 가족" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    await page.getByRole("button", { name: "📍 우리아이" }).click();
    await expect(page.getByText("아이 위치 · 안전")).toBeVisible();

    await expect.poll(() => state.functionCalls.find((call) => call.body?.action === "request_location")?.body).toMatchObject({
      action: "request_location",
      familyId: FAMILY_ID,
      targetRole: "child",
    });
  });

  test("parent main calendar selection uses distinct colors and filters the schedule list", async ({ page }) => {
    const now = new Date();
    const targetDay = now.getDate() === 1 ? 2 : now.getDate() - 1;
    const visibleMonth = now.getMonth() + 1;
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "오늘의 가족" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainCalendar = page.getByRole("region", { name: "캘린더" }).first();
    await mainCalendar.getByRole("button", { name: new RegExp(`${visibleMonth}월 ${targetDay}일`) }).click();

    const colors = await page.evaluate(
      ({ todayDay, targetDay, visibleMonth }) => {
        const calendar = document.querySelector('[aria-label="캘린더"]');
        const buttonFor = (day) => Array.from(calendar?.querySelectorAll("button") || [])
          .find((button) => button.textContent?.trim() === String(day));
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

    await page.getByRole("button", { name: "+", exact: true }).click();
    await page.getByPlaceholder("예) 영어 학원, 태권도...").fill("미술 학원");
    await page.getByRole("button", { name: "🐰 일정 추가하기!" }).click();

    const parentMain = page.getByLabel("부모 메인");
    await expect(parentMain.getByText("미술 학원", { exact: true })).toBeVisible();
    await expect(parentMain.getByText(`${visibleMonth}월 ${targetDay}일`)).toBeVisible();
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

    await expect(page.getByRole("region", { name: "오늘의 가족" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
    await mainTabbar.getByRole("button", { name: "캘린더" }).click();
    await expect(page.getByRole("region", { name: "부모 캘린더" })).toBeVisible();

    await expectCalendarEventStatus(page, minuteEvent, /^\d+분 뒤$/);
    await expectCalendarEventStatus(page, hourEvent, /^1시간 \d+분 뒤$/);
    await expectCalendarEventStatus(page, dayEvent, "1일 뒤");
  });

  test("parent dashboard uses redesign v1 calendar and timeline details", async ({ page }) => {
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "오늘의 가족" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const main = page.getByLabel("부모 메인");
    const calendar = main.getByRole("region", { name: "캘린더" });

    await expect(calendar.locator(".hyeni-v5-calendar-card")).toBeVisible();

    const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
    await mainTabbar.getByRole("button", { name: "캘린더" }).click();
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
    expect(details.calendarDotColor).toBe("rgba(255, 255, 255, 0.9)");
  });

  test("parent home matches redesign v1 family hero and today summary cards", async ({ page }) => {
    await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "오늘의 가족" })).toBeVisible();
    await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "확인했어요" }).click();

    const details = await page.evaluate(() => {
      const shell = document.querySelector(".hyeni-app-shell");
      const hero = document.querySelector('[aria-label="오늘의 가족"]');
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

    await expect(page.getByRole("region", { name: "오늘의 가족" })).toBeVisible();
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
    await expect(page.getByRole("region", { name: "오늘의 가족" })).toBeVisible();
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
    await expect(page.getByText("아이 모드")).toBeVisible();
    await expect(page.getByText("영어 학원")).toBeVisible();
    await expect(page.getByText("지금 나는 어디에 있나요?").first()).toBeVisible();
    await expect(page.getByText("서울특별시 중구 세종대로 110").first()).toBeVisible();
    await expect(page.getByText("도로명 기준").first()).toBeVisible();
    await expect(page.getByText(/GPS 정확도/)).toHaveCount(0);

    await page.getByRole("button", { name: "💗 꾹" }).click();
    await expect(page.getByText("꾹을 보냈어요!")).toBeVisible();
    expect(state.rpcCalls.some((call) => call.name === "join_family")).toBeTruthy();
    await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "kkuk")).toBeTruthy();
  });

  test("child route view uses in-app guidance instead of OSRM road-like routes", async ({ page }) => {
    const state = await installCriticalMocks(page, {
      role: "child",
      initiallyPaired: true,
      insideArrivalZone: false,
      walkingRoute: "failure",
    });
    await page.goto("/");

    await expect(page.getByRole("region", { name: "오늘은 뭐해?" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "길 안내 보기" }).click();

    await expect(page.getByRole("button", { name: "길안내 시작" })).toBeVisible();
    await expect(page.getByText("경로 검색 중")).toBeHidden({ timeout: 8_000 });
    await expect(page.getByText(/예상 직선거리 · 도보 약/)).toBeVisible();
    expect(state.routeRequests).toHaveLength(0);
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
    await page.getByRole("button", { name: "길 안내 보기" }).click();

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
