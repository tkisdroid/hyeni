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

test.describe("subscription and premium flow", () => {
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

    await parentPage.getByText("🎙️ 주변소리").click();
    await expect(parentPage.getByText("주변 소리 듣기는 프리미엄 전용이에요")).toBeVisible();
    await parentPage.getByText("7일 무료 체험 시작").click();
    await expect(parentPage.getByText("자동 갱신 안내")).toBeVisible();
    await parentPage.getByRole("button", { name: "안내를 확인했고 계속할게요" }).evaluate((button) => button.click());

    await parentPage.getByText("💎 구독").click();
    await expect(parentPage.getByText("무료 체험 중")).toBeVisible();
    await parentPage.getByText("닫기").click();

    const childPage = await context.newPage();
    await installMockBrowser(childPage);
    await childPage.goto("/");
    await childPage.getByRole("button", { name: /🐰 아이/ }).click();
    await childPage.getByPlaceholder("XXXXXXXX").fill(pairCode);
    await childPage.getByText("🔗 연결하기").click();
    await expect(childPage.getByText("🎉 부모님과 연동됐어요!")).toBeVisible();

    await parentPage.getByText("🎙️ 주변소리").click();
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
    await expect(childPage.getByText("엄마가 꾹을 보냈어요")).toBeVisible({ timeout: 5_000 });
    await expect(childPage.getByText("화면을 터치하면 닫혀요")).toBeVisible();

    await context.close();
  });
});
