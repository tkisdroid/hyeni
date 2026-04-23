import { expect, test } from "@playwright/test";

function extractPairCode(text) {
  const matched = text.match(/KID-[A-Z0-9]{8}/);
  if (!matched) {
    throw new Error(`Pair code not found in: ${text}`);
  }
  return matched[0].replace("KID-", "");
}

async function installMockBrowser(page) {
  await page.addInitScript(() => {
    const originalLocalStorageClear = window.localStorage.clear.bind(window.localStorage);
    const originalFetch = window.fetch.bind(window);
    const fixedPosition = { latitude: 37.5665, longitude: 126.978 };
    const watchers = new Map();
    let watcherId = 0;

    window.__mockQrValues = [];
    window.__mockFeedbackPayloads = [];
    window.__setMockQrValue = (value) => {
      if (typeof value === "string" && value.trim()) {
        window.__mockQrValues.push(value.trim());
      }
    };
    window.__getMockFeedbackPayloads = () => [...window.__mockFeedbackPayloads];

    class FakeBarcodeDetector {
      static async getSupportedFormats() {
        return ["qr_code"];
      }

      async detect() {
        const nextValue = window.__mockQrValues.shift();
        if (!nextValue) return [];
        return [{ rawValue: nextValue }];
      }
    }

    navigator.geolocation.getCurrentPosition = (success) => {
      success({ coords: { ...fixedPosition } });
    };

    navigator.geolocation.watchPosition = (success) => {
      const id = ++watcherId;
      watchers.set(id, success);
      success({ coords: { ...fixedPosition } });
      return id;
    };

    navigator.geolocation.clearWatch = (id) => {
      watchers.delete(id);
    };

    navigator.mediaDevices = navigator.mediaDevices || {};
    navigator.mediaDevices.getUserMedia = async () => ({
      getTracks: () => [{ stop() {} }],
    });

    Object.defineProperty(window, "BarcodeDetector", {
      configurable: true,
      writable: true,
      value: FakeBarcodeDetector,
    });

    if (window.HTMLMediaElement?.prototype) {
      const mediaProto = window.HTMLMediaElement.prototype;
      mediaProto.play = () => Promise.resolve();
      Object.defineProperty(mediaProto, "srcObject", {
        configurable: true,
        get() {
          return this.__mockSrcObject || null;
        },
        set(value) {
          this.__mockSrcObject = value;
        },
      });
    }

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      constructor(stream, options = {}) {
        this.stream = stream;
        this.mimeType = options.mimeType || "audio/webm";
        this.state = "inactive";
        this._timer = null;
        this.ondataavailable = null;
        this.onstop = null;
      }

      start(interval = 2000) {
        this.state = "recording";
        this._timer = window.setInterval(() => {
          const chunk = new Blob(["mock-audio"], { type: this.mimeType });
          this.ondataavailable?.({ data: chunk });
        }, interval);
      }

      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        if (this._timer) {
          window.clearInterval(this._timer);
          this._timer = null;
        }
        this.onstop?.();
      }
    }

    class FakeLatLng {
      constructor(lat, lng) {
        this.lat = lat;
        this.lng = lng;
      }

      getLat() {
        return this.lat;
      }

      getLng() {
        return this.lng;
      }
    }

    class FakeLatLngBounds {
      constructor() {
        this.points = [];
      }

      extend(point) {
        this.points.push(point);
      }
    }

    class FakeMap {
      constructor(_element, options = {}) {
        this.center = options.center || new FakeLatLng(fixedPosition.latitude, fixedPosition.longitude);
        this.level = options.level || 3;
        this.mapTypeId = options.mapTypeId || "roadmap";
        window.__lastKakaoMap = this;
      }

      setCenter(center) {
        this.center = center;
      }

      relayout() {}

      setBounds(_bounds) {}

      panTo(center) {
        this.center = center;
      }

      setMapTypeId(mapTypeId) {
        this.mapTypeId = mapTypeId;
      }

      getLevel() {
        return this.level;
      }

      setLevel(level) {
        this.level = level;
      }
    }

    class FakeMarker {
      constructor(options = {}) {
        this.position = options.position || null;
      }

      setPosition(position) {
        this.position = position;
      }

      getPosition() {
        return this.position;
      }

      setMap(_map) {}
    }

    class FakePolyline {
      constructor(options = {}) {
        this.path = options.path || [];
      }

      setPath(path) {
        this.path = path;
      }

      setMap(_map) {}
    }

    class FakeCircle {
      constructor(options = {}) {
        this.options = options;
        window.__lastKakaoCircle = this;
      }

      setMap(_map) {}
    }

    class FakeCustomOverlay {
      constructor(options = {}) {
        this.position = options.position || null;
      }

      setPosition(position) {
        this.position = position;
      }

      setMap(_map) {}
    }

    class FakeStaticMap {
      constructor() {}
    }

    const noop = () => {};

    if (!window.kakao) {
      window.kakao = {
        maps: {
          load(callback) {
            callback();
          },
          LatLng: FakeLatLng,
          LatLngBounds: FakeLatLngBounds,
          Map: FakeMap,
          Marker: FakeMarker,
          Polyline: FakePolyline,
          Circle: FakeCircle,
          CustomOverlay: FakeCustomOverlay,
          StaticMap: FakeStaticMap,
          MapTypeId: {
            ROADMAP: "roadmap",
            HYBRID: "hybrid",
          },
          event: {
            addListener(target, eventName, handler) {
              target.__listeners = target.__listeners || {};
              target.__listeners[eventName] = handler;
            },
          },
          services: {
            Status: {
              OK: "OK",
            },
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
                      x: String(fixedPosition.longitude + 0.003),
                      y: String(fixedPosition.latitude + 0.002),
                    },
                  ],
                  "OK",
                );
              }
            },
          },
        },
      };
    }

    window.MediaRecorder = FakeMediaRecorder;

    window.Audio = class {
      play() {
        return Promise.resolve();
      }

      set onended(handler) {
        if (handler) window.setTimeout(handler, 10);
      }

      set onerror(_handler) {}
    };

    window.Notification = class {
      static permission = "granted";

      static requestPermission() {
        return Promise.resolve("granted");
      }

      constructor() {}
    };

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("/functions/v1/feedback-email")) {
        const payload = init?.body ? JSON.parse(String(init.body)) : null;
        window.__mockFeedbackPayloads.push(payload);
        return new Response(
          JSON.stringify({ ok: true, mock: true }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      if (url.includes("router.project-osrm.org/route/v1/foot/")) {
        return new Response(
          JSON.stringify({
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
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return originalFetch(input, init);
    };

    navigator.vibrate = noop;
    if (!window.confirm) window.confirm = () => true;
    if (!window.alert) window.alert = noop;
    if (!window.location.assign) window.location.assign = noop;

    window.__resetMockApp = () => {
      originalLocalStorageClear();
      window.sessionStorage.clear();
    };
  });
}

async function seedMockRouteEvent(page, title = "영어 학원 길찾기") {
  await page.evaluate((eventTitle) => {
    const dbKey = Object.keys(window.localStorage).find((key) => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
        return (
          parsed &&
          Array.isArray(parsed.families) &&
          Array.isArray(parsed.family_members) &&
          Array.isArray(parsed.events)
        );
      } catch {
        return false;
      }
    });

    if (!dbKey) {
      throw new Error("mock db key not found");
    }

    const db = JSON.parse(window.localStorage.getItem(dbKey) || "null");
    if (!db?.families?.length) {
      throw new Error("mock family not found");
    }

    const family = db.families[0];
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    db.events = (db.events || []).filter((row) => row.title !== eventTitle);
    db.events.push({
      id: `event-${Date.now()}`,
      family_id: family.id,
      date_key: dateKey,
      title: eventTitle,
      time: "15:00",
      end_time: "16:00",
      category: "academy",
      emoji: "📚",
      color: "#3B82F6",
      bg: "#DBEAFE",
      memo: "길찾기 테스트",
      location: {
        lat: 37.5678,
        lng: 126.981,
        address: "서울특별시 중구 세종대로 110",
      },
      notif_override: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    window.localStorage.setItem(dbKey, JSON.stringify(db));
  }, title);
}

async function seedMockDuplicatePlaceEvents(page) {
  await page.evaluate(() => {
    const dbKey = Object.keys(window.localStorage).find((key) => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
        return (
          parsed &&
          Array.isArray(parsed.families) &&
          Array.isArray(parsed.family_members) &&
          Array.isArray(parsed.events)
        );
      } catch {
        return false;
      }
    });

    if (!dbKey) {
      throw new Error("mock db key not found");
    }

    const db = JSON.parse(window.localStorage.getItem(dbKey) || "null");
    if (!db?.families?.length) {
      throw new Error("mock family not found");
    }

    const family = db.families[0];
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const sharedLocation = {
      lat: 37.5678,
      lng: 126.981,
      address: "서울특별시 중구 세종대로 110",
    };

    db.events = (db.events || []).filter((row) => !String(row.memo || "").includes("장소중복테스트"));
    db.events.push(
      {
        id: `event-place-${Date.now()}-1`,
        family_id: family.id,
        date_key: dateKey,
        title: "피아노 학원",
        time: "08:30",
        end_time: "09:30",
        category: "school",
        emoji: "🎹",
        color: "#8B5CF6",
        bg: "#EDE9FE",
        memo: "장소중복테스트-1",
        location: sharedLocation,
        notif_override: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: `event-place-${Date.now()}-2`,
        family_id: family.id,
        date_key: dateKey,
        title: "미술 학원",
        time: "16:00",
        end_time: "17:00",
        category: "hobby",
        emoji: "🎨",
        color: "#F59E0B",
        bg: "#FEF3C7",
        memo: "장소중복테스트-2",
        location: sharedLocation,
        notif_override: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    );

    window.localStorage.setItem(dbKey, JSON.stringify(db));
  });
}

async function seedMockChildLocation(page) {
  await page.evaluate(() => {
    const dbKey = Object.keys(window.localStorage).find((key) => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
        return (
          parsed &&
          Array.isArray(parsed.families) &&
          Array.isArray(parsed.family_members) &&
          Array.isArray(parsed.child_locations)
        );
      } catch {
        return false;
      }
    });

    if (!dbKey) {
      throw new Error("mock db key not found");
    }

    const db = JSON.parse(window.localStorage.getItem(dbKey) || "null");
    if (!db?.families?.length) {
      throw new Error("mock family not found");
    }

    const family = db.families[0];
    const recordedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const childUserId = "child-walking-test";
    const childMember = {
      family_id: family.id,
      user_id: childUserId,
      role: "child",
      name: "아이",
      emoji: "🐰",
      created_at: recordedAt,
      updated_at: recordedAt,
    };
    const childLocation = {
      family_id: family.id,
      user_id: childUserId,
      lat: 37.5668,
      lng: 126.9784,
      updated_at: recordedAt,
    };

    db.family_members = (db.family_members || []).filter((row) => row.user_id !== childUserId);
    db.family_members.push(childMember);
    db.child_locations = (db.child_locations || []).filter((row) => row.user_id !== childUserId);
    db.child_locations.push(childLocation);
    db.location_history = (db.location_history || []).filter((row) => row.user_id !== childUserId);
    db.location_history.push(
      {
        id: "trail-walking-test-1",
        family_id: family.id,
        user_id: childUserId,
        lat: 37.5665,
        lng: 126.978,
        recorded_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      },
      {
        id: "trail-walking-test-2",
        family_id: family.id,
        user_id: childUserId,
        lat: childLocation.lat,
        lng: childLocation.lng,
        recorded_at: recordedAt,
      },
    );

    window.localStorage.setItem(dbKey, JSON.stringify(db));
  });
}

test.describe("subscription and premium flow", () => {
  test("child can pair with parent immediately by scanning QR code", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation", "microphone", "camera"],
      geolocation: { latitude: 37.5665, longitude: 126.978 },
    });

    const parentPage = await context.newPage();
    await installMockBrowser(parentPage);
    await parentPage.goto("/");

    await parentPage.getByText("학부모").click();
    await parentPage.getByText("새 가족 만들기").click();
    await parentPage.getByText("가족 만들기").click();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();

    const pairCodeText = await parentPage.locator("text=/KID-[A-Z0-9]{8}/").first().textContent();
    const pairCode = extractPairCode(pairCodeText || "");

    const childPage = await context.newPage();
    await installMockBrowser(childPage);
    await childPage.goto("/");
    await childPage.getByRole("button", { name: /🐰 아이/ }).click();
    await childPage.evaluate((value) => {
      window.__setMockQrValue?.(value);
    }, `KID-${pairCode}`);
    await childPage.getByRole("button", { name: "📷 QR로 연결하기" }).click();
    await expect(childPage.getByText("🎉 부모님과 연동됐어요!")).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test("child sees microphone permission guidance when native mic access is denied", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation"],
      geolocation: { latitude: 37.5665, longitude: 126.978 },
    });

    const parentPage = await context.newPage();
    await installMockBrowser(parentPage);
    await parentPage.goto("/");

    await parentPage.getByText("학부모").click();
    await parentPage.getByText("새 가족 만들기").click();
    await parentPage.getByText("가족 만들기").click();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();

    const pairCodeText = await parentPage.locator("text=/KID-[A-Z0-9]{8}/").first().textContent();
    const pairCode = extractPairCode(pairCodeText || "");

    const childPage = await context.newPage();
    await installMockBrowser(childPage);
    await childPage.goto("/");
    await childPage.getByRole("button", { name: /🐰 아이/ }).click();
    await childPage.getByPlaceholder("XXXXXXXX").fill(pairCode);
    await childPage.getByText("🔗 연결하기").click();
    await expect(childPage.getByText("🎉 부모님과 연동됐어요!")).toBeVisible();

    await childPage.evaluate(() => {
      window.dispatchEvent(new CustomEvent("mic-permission-denied"));
    });

    await expect(childPage.getByRole("dialog", { name: "마이크 권한이 필요해요" })).toBeVisible();
    await expect(childPage.getByText("주위 소리 듣기 연결이 중단됐어요")).toBeVisible();
    await expect(childPage.getByText("Android 설정 > 앱 > 혜니캘린더 > 권한 > 마이크 > 허용")).toBeVisible();
    await childPage.getByRole("button", { name: "확인" }).click();
    await expect(childPage.getByRole("dialog", { name: "마이크 권한이 필요해요" })).toBeHidden();

    await context.close();
  });

  test("parent creates family, starts trial, child pairs, and remote audio starts", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation", "microphone"],
      geolocation: { latitude: 37.5665, longitude: 126.978 },
    });

    const parentPage = await context.newPage();
    await installMockBrowser(parentPage);
    await parentPage.goto("/");

    await parentPage.getByText("학부모").click();
    await parentPage.getByText("새 가족 만들기").click();
    await parentPage.getByText("가족 만들기").click();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();

    const pairCodeText = await parentPage.locator("text=/KID-[A-Z0-9]{8}/").first().textContent();
    const pairCode = extractPairCode(pairCodeText || "");

    await parentPage.getByText("닫기").click();

    await parentPage.getByRole("button", { name: "+" }).click();
    await parentPage.getByPlaceholder("예) 영어 학원, 태권도...").fill("영어 학원");
    await parentPage.locator('input[type="time"]').first().fill("15:00");
    await parentPage.getByText("🐰 일정 추가하기!").click();

    await expect(parentPage.getByText("7일 무료 체험으로 프리미엄 기능을 열어보세요")).toBeVisible();
    await parentPage.getByText("나중에").click();

    await parentPage.getByRole("button", { name: "🎙️ 주변소리", exact: true }).click();
    await expect(parentPage.getByText("주변 소리 듣기는 프리미엄 전용이에요")).toBeVisible();
    await parentPage.getByText("7일 무료 체험 시작").click();
    await expect(parentPage.getByText("자동 갱신 안내")).toBeVisible();
    await parentPage.getByRole("button", { name: "안내를 확인했고 계속할게요" }).evaluate((button) => button.click());

    await parentPage.getByRole("button", { name: "💎 구독", exact: true }).click();
    await expect(parentPage.getByText("무료 체험 중")).toBeVisible();
    await parentPage.getByText("닫기").click();

    const childPage = await context.newPage();
    await installMockBrowser(childPage);
    await childPage.goto("/");
    await childPage.getByRole("button", { name: /🐰 아이/ }).click();
    await childPage.getByPlaceholder("XXXXXXXX").fill(pairCode);
    await childPage.getByText("🔗 연결하기").click();
    await expect(childPage.getByText("🎉 부모님과 연동됐어요!")).toBeVisible();

    await parentPage.getByRole("button", { name: "🎙️ 주변소리", exact: true }).click();
    await expect(parentPage.getByText("주변 소리 듣기")).toBeVisible();
    await parentPage.getByText("🎙️ 듣기 시작").click();
    await expect(parentPage.getByText("아이 기기 연결 중...")).toBeVisible();
    await expect(parentPage.getByText("아이 주변 소리 듣는 중...")).toBeVisible({ timeout: 20_000 });

    await context.close();
  });

  test("child can open route guidance and receives kkuk on a single click", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation", "microphone"],
      geolocation: { latitude: 37.5665, longitude: 126.978 },
    });

    const parentPage = await context.newPage();
    await installMockBrowser(parentPage);
    await parentPage.goto("/");

    await parentPage.getByText("학부모").click();
    await parentPage.getByText("새 가족 만들기").click();
    await parentPage.getByText("가족 만들기").click();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();

    const pairCodeText = await parentPage.locator("text=/KID-[A-Z0-9]{8}/").first().textContent();
    const pairCode = extractPairCode(pairCodeText || "");

    await seedMockRouteEvent(parentPage);
    await parentPage.getByText("닫기").click();

    const childPage = await context.newPage();
    await installMockBrowser(childPage);
    await childPage.goto("/");
    await childPage.getByRole("button", { name: /🐰 아이/ }).click();
    await childPage.getByPlaceholder("XXXXXXXX").fill(pairCode);
    await childPage.getByText("🔗 연결하기").click();
    await expect(childPage.getByText("🎉 부모님과 연동됐어요!")).toBeVisible();

    const routeButton = childPage.getByRole("button", { name: /🧭 길찾기/ }).first();
    await expect(routeButton).toBeVisible();
    await routeButton.click();
    await expect(childPage.getByText("토끼가 길 안내 중~ 🐰")).toBeVisible();
    await expect(childPage.getByText("420m").last()).toBeVisible();
    await childPage.getByRole("button", { name: "닫기" }).first().click();

    await parentPage.getByRole("button", { name: "💗 꾹" }).click();
    await expect(parentPage.getByText("💗 꾹을 보냈어요!")).toBeVisible({ timeout: 2_000 });
    await expect(childPage.getByText("엄마가 꾹을 보냈어요")).toBeVisible({ timeout: 5_000 });
    await expect(childPage.getByText("화면을 터치하면 닫혀요")).toBeVisible();

    await context.close();
  });

  test("parent can open child tracker in walking precision zoom", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation", "microphone"],
      geolocation: { latitude: 37.5665, longitude: 126.978 },
    });

    const parentPage = await context.newPage();
    await installMockBrowser(parentPage);
    await parentPage.goto("/");

    await parentPage.getByText("학부모").click();
    await parentPage.getByText("새 가족 만들기").click();
    await parentPage.getByText("가족 만들기").click();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();

    await seedMockChildLocation(parentPage);
    await parentPage.reload();
    await expect(parentPage.getByRole("button", { name: "🔗 연동 (1명)" })).toBeVisible();
    await expect(parentPage.getByRole("button", { name: "📍 우리아이", exact: true })).toBeVisible();

    await parentPage.getByRole("button", { name: "📍 우리아이", exact: true }).click();
    await expect(parentPage.getByText("아이 정밀 위치")).toBeVisible();
    await expect(parentPage.getByText("도보 확인 반경 30m")).toBeVisible();
    await expect(parentPage.getByText("37.56680, 126.97840")).toBeVisible();
    await expect(parentPage.getByRole("button", { name: "아이 위치로 이동" })).toBeVisible();

    const mapState = await parentPage.evaluate(() => ({
      level: window.__lastKakaoMap?.level,
      centerLat: window.__lastKakaoMap?.center?.lat,
      centerLng: window.__lastKakaoMap?.center?.lng,
      radius: window.__lastKakaoCircle?.options?.radius,
    }));

    expect(mapState).toMatchObject({
      level: 2,
      centerLat: 37.5668,
      centerLng: 126.9784,
      radius: 30,
    });

    await context.close();
  });

  test("parent can configure reminder times without duplicate minute entries", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation", "microphone"],
      geolocation: { latitude: 37.5665, longitude: 126.978 },
    });

    const parentPage = await context.newPage();
    await installMockBrowser(parentPage);
    await parentPage.goto("/");

    await parentPage.getByText("학부모").click();
    await parentPage.getByText("새 가족 만들기").click();
    await parentPage.getByText("가족 만들기").click();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();
    await parentPage.getByText("닫기").click();

    await parentPage.getByRole("button", { name: "🔔 일정알림" }).click();
    await expect(parentPage.getByText("일정 알림 설정")).toBeVisible();

    const fifteenMinutes = parentPage.getByRole("button", { name: "15분 전 알림", exact: true });
    const tenMinutes = parentPage.getByRole("button", { name: "10분 전 알림", exact: true });
    const fiveMinutes = parentPage.getByRole("button", { name: "5분 전 알림", exact: true });

    await expect(fifteenMinutes).toHaveAttribute("aria-pressed", "true");
    await expect(tenMinutes).toHaveAttribute("aria-pressed", "false");
    await expect(fiveMinutes).toHaveAttribute("aria-pressed", "true");

    await tenMinutes.click();
    await fiveMinutes.click();
    await parentPage.getByRole("button", { name: "저장", exact: true }).click();
    await expect(parentPage.getByText("🔔 일정 알림 설정이 저장됐어요!")).toBeVisible();

    await parentPage.reload();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();
    await parentPage.getByRole("button", { name: "닫기" }).click();
    await parentPage.getByRole("button", { name: "🔔 일정알림" }).click();

    await expect(parentPage.getByRole("button", { name: "15분 전 알림", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(parentPage.getByRole("button", { name: "10분 전 알림", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(parentPage.getByRole("button", { name: "5분 전 알림", exact: true })).toHaveAttribute("aria-pressed", "false");

    await context.close();
  });

  test("saved places stay locked on free tier and become reusable after trial", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation", "microphone"],
      geolocation: { latitude: 37.5665, longitude: 126.978 },
    });

    const parentPage = await context.newPage();
    await installMockBrowser(parentPage);
    await parentPage.goto("/");

    await parentPage.getByText("학부모").click();
    await parentPage.getByText("새 가족 만들기").click();
    await parentPage.getByText("가족 만들기").click();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();
    await parentPage.getByRole("button", { name: "닫기" }).click();

    await parentPage.getByRole("button", { name: "📍 장소" }).click();
    await parentPage.getByRole("button", { name: "📍 자주 가는 장소 추가" }).click();
    await expect(parentPage.getByText("유료계정은 자주가는 장소를 무제한 등록할 수 있어요", { exact: true })).toBeVisible();

    await parentPage.getByRole("button", { name: "7일 무료 체험 시작" }).click();
    await expect(parentPage.getByText("자동 갱신 안내")).toBeVisible();
    await parentPage.getByRole("button", { name: "안내를 확인했고 계속할게요" }).evaluate((button) => button.click());

    await parentPage.getByRole("button", { name: "📍 자주 가는 장소 추가" }).click();
    await expect(parentPage.getByText("📍 자주 가는 장소")).toBeVisible();
    await parentPage.getByRole("button", { name: /\+ 장소 직접 추가/ }).click();
    await parentPage.getByPlaceholder("예) 할머니 집, 피아노 학원, 도서관").fill("피아노 학원");
    await parentPage.getByRole("button", { name: "🗺️ 지도에서 장소 선택" }).click();
    await expect(parentPage.getByText("📍 자주 가는 장소 설정")).toBeVisible();
    await parentPage.getByRole("button", { name: "📍 이 장소로 설정하기" }).click();
    await parentPage.getByRole("button", { name: "저장", exact: true }).click();
    await parentPage.getByRole("button", { name: "← 저장" }).click();
    await expect(parentPage.getByText("📍 자주 가는 장소가 저장됐어요!")).toBeVisible();
    await expect(parentPage.getByText("피아노 학원")).toBeVisible();

    await parentPage.getByRole("button", { name: "📅 달력" }).click();
    await parentPage.getByRole("button", { name: "+" }).click();
    await expect(parentPage.locator('button[aria-label="📍 자주 가는 장소 추가"]').last()).toBeVisible();
    await parentPage.getByPlaceholder("예) 영어 학원, 태권도...").fill("피아노 연습");
    await parentPage.getByRole("button", { name: /📍 피아노 학원/ }).click();
    await expect(parentPage.getByText("서울특별시 중구 세종대로 110")).toBeVisible();

    await context.close();
  });

  test("places view deduplicates schedule locations and keeps add buttons visible", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation", "microphone"],
      geolocation: { latitude: 37.5665, longitude: 126.978 },
    });

    const parentPage = await context.newPage();
    await installMockBrowser(parentPage);
    await parentPage.goto("/");

    await parentPage.getByText("학부모").click();
    await parentPage.getByText("새 가족 만들기").click();
    await parentPage.getByText("가족 만들기").click();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();

    await seedMockDuplicatePlaceEvents(parentPage);
    await parentPage.reload();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();
    await parentPage.getByRole("button", { name: "닫기" }).click();

    await parentPage.getByRole("button", { name: "📍 장소" }).click();
    await expect(parentPage.getByText("📍 1개 장소", { exact: true })).toBeVisible();
    await expect(parentPage.getByText(/2개 일정/)).toBeVisible();
    await expect(parentPage.getByRole("button", { name: "📍 장소 추가", exact: true })).toBeVisible();
    await expect(parentPage.getByRole("button", { name: "📍 자주 가는 장소 추가", exact: true })).toBeVisible();

    await parentPage.getByRole("button", { name: "📅 달력" }).click();
    await parentPage.getByRole("button", { name: "+" }).click();
    await expect(parentPage.locator('button[aria-label="📍 자주 가는 장소 추가"]').last()).toBeVisible();

    await context.close();
  });

  test("parent quick actions fit on one mobile screen without horizontal scrolling", async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      permissions: ["geolocation", "microphone"],
      geolocation: { latitude: 37.5665, longitude: 126.978 },
    });

    const parentPage = await context.newPage();
    await installMockBrowser(parentPage);
    await parentPage.goto("/");

    await parentPage.getByText("학부모").click();
    await parentPage.getByText("새 가족 만들기").click();
    await parentPage.getByText("가족 만들기").click();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();
    await parentPage.getByRole("button", { name: "닫기" }).click();

    const labels = [
      "📍 우리아이",
      "🏫 학원관리",
      "🏆 스티커",
      "🔔 일정알림",
      "💎 구독",
      "📞 연락처",
      "🎙️ 주변소리",
      "⚠️ 위험지역",
      "💌 피드백 보내기",
      "📅 달력",
      "📍 장소",
    ];

    for (const label of labels) {
      await expect(parentPage.getByRole("button", { name: label, exact: true })).toBeVisible();
    }

    const quickActionMetrics = await parentPage.evaluate(() => {
      const doc = document.documentElement;
      const trackedLabels = [
        "📍 우리아이",
        "🏫 학원관리",
        "🏆 스티커",
        "🔔 일정알림",
        "💎 구독",
        "📞 연락처",
        "🎙️ 주변소리",
        "⚠️ 위험지역",
        "💌 피드백 보내기",
        "📅 달력",
        "📍 장소",
      ];
      const buttons = trackedLabels
        .map((label) => document.querySelector(`button[aria-label="${label}"]`))
        .filter(Boolean);
      const firstButton = buttons[0];
      const quickPanel = firstButton ? firstButton.closest("div")?.parentElement : null;

      return {
        viewportWidth: window.innerWidth,
        documentClientWidth: doc.clientWidth,
        documentScrollWidth: doc.scrollWidth,
        hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth,
        quickPanelClientWidth: quickPanel ? quickPanel.clientWidth : null,
        quickPanelScrollWidth: quickPanel ? quickPanel.scrollWidth : null,
        quickActionCount: buttons.length,
        outOfViewportCount: buttons.filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left < 0 || rect.right > window.innerWidth;
        }).length,
      };
    });

    expect(quickActionMetrics.quickActionCount).toBe(labels.length);
    expect(quickActionMetrics.hasHorizontalOverflow).toBe(false);
    expect(quickActionMetrics.quickPanelScrollWidth).toBe(quickActionMetrics.quickPanelClientWidth);
    expect(quickActionMetrics.outOfViewportCount).toBe(0);

    await parentPage.screenshot({
      path: testInfo.outputPath("parent-quick-actions-mobile.png"),
      fullPage: true,
    });

    await context.close();
  });

  test("parent can send feedback suggestion from the last quick action card", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation", "microphone"],
      geolocation: { latitude: 37.5665, longitude: 126.978 },
    });

    const parentPage = await context.newPage();
    await installMockBrowser(parentPage);
    await parentPage.goto("/");

    await parentPage.getByText("학부모").click();
    await parentPage.getByText("새 가족 만들기").click();
    await parentPage.getByText("가족 만들기").click();
    await expect(parentPage.getByText("아이 연동 관리")).toBeVisible();
    await parentPage.getByRole("button", { name: "닫기" }).click();

    await parentPage.getByRole("button", { name: "💌 피드백 보내기", exact: true }).click();
    await expect(parentPage.getByText("필요한 기능이 있으면 제안해 주세요")).toBeVisible();
    await parentPage.getByPlaceholder("예) 형제자매별 위치 알림 시간을 따로 설정하고 싶어요").fill("등하원 확인 알림에 소리 옵션도 추가해 주세요");
    await parentPage.getByRole("button", { name: "제안 보내기", exact: true }).click();

    await expect(parentPage.getByText(/📮 (제안이 전달됐어요!|메일 앱으로 제안 작성을 이어갈게요!)/)).toBeVisible();

    const payloads = await parentPage.evaluate(() => window.__getMockFeedbackPayloads?.() || []);
    if (payloads.length > 0) {
      expect(payloads[0]?.content).toContain("등하원 확인 알림에 소리 옵션도 추가해 주세요");
    }

    await context.close();
  });
});
