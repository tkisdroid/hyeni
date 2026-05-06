import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { RouteOverlay } from "../../src/components/route/RouteOverlay.jsx";

const { fetchWalkingRouteMock } = vi.hoisted(() => ({
  fetchWalkingRouteMock: vi.fn(),
}));

vi.mock("../../src/lib/kakaoMap.js", () => ({
  KAKAO_APP_KEY: "test-kakao-key",
}));

vi.mock("../../src/lib/walkingRoute.js", () => ({
  ROUTE_REQUEST_TIMEOUT_MS: 12000,
  fetchWalkingRoute: fetchWalkingRouteMock,
}));

function installFakeKakao() {
  globalThis.window.__hyeniCreatedPolylines = [];

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

  globalThis.window.kakao = {
    maps: {
      MapTypeId: { ROADMAP: "roadmap", HYBRID: "hybrid" },
      LatLng: FakeLatLng,
      LatLngBounds: class {
        extend() {}
      },
      Map: class {
        setBounds() {}
        setLevel() {}
        panTo() {}
        setMapTypeId() {}
      },
      CustomOverlay: class {
        constructor(options = {}) {
          this.position = options.position || null;
        }
        setMap() {}
        setPosition(position) {
          this.position = position;
        }
      },
      Polyline: class {
        constructor(options = {}) {
          this.options = options;
          globalThis.window.__hyeniCreatedPolylines.push(options);
        }
        setMap() {}
      },
    },
  };
}

describe("RouteOverlay", () => {
  afterEach(() => {
    cleanup();
    fetchWalkingRouteMock.mockReset();
    vi.restoreAllMocks();
    delete globalThis.window.kakao;
    delete globalThis.window.__hyeniCreatedPolylines;
  });

  it("keeps parent route guidance anchored to the child position instead of parent GPS", async () => {
    installFakeKakao();
    const getCurrentPosition = vi.fn((success) => {
      success({ coords: { latitude: 35.1796, longitude: 129.0756 } });
    });
    const watchPosition = vi.fn(() => 7);
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition,
        watchPosition,
        clearWatch: vi.fn(),
      },
    });
    fetchWalkingRouteMock.mockResolvedValue({
      provider: "test",
      points: [
        { lat: 37.5665, lng: 126.9780 },
        { lat: 37.5672, lng: 126.9791 },
      ],
      distance: 140,
      duration: 120,
    });

    render(
      <RouteOverlay
        ev={{
          id: "event-1",
          title: "태권도",
          emoji: "🥋",
          time: "15:00",
          color: "#A78BFA",
          bg: "#EDE9FE",
          location: { lat: 37.5672, lng: 126.9791, address: "서울 태권도장" },
        }}
        childPos={{ user_id: "child-1", lat: 37.5665, lng: 126.9780, updatedAt: "2026-05-06T01:00:00Z" }}
        childProfile={{ name: "혜니", emoji: "🐰", color_hex: "#F779A8" }}
        mapReady
        isChildMode={false}
        onClose={() => {}}
      />
    );

    await waitFor(() => expect(fetchWalkingRouteMock).toHaveBeenCalled());

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(watchPosition).not.toHaveBeenCalled();
    expect(fetchWalkingRouteMock.mock.calls[0][0]).toMatchObject({
      lat: 37.5665,
      lng: 126.9780,
    });
  });

  it("does not draw a straight fallback line when walking route lookup fails", async () => {
    installFakeKakao();
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      },
    });
    fetchWalkingRouteMock.mockRejectedValue(new Error("Kakao walking unavailable"));

    render(
      <RouteOverlay
        ev={{
          id: "event-2",
          title: "영어 학원",
          emoji: "📚",
          time: "16:00",
          color: "#A78BFA",
          bg: "#EDE9FE",
          location: { lat: 37.5796, lng: 126.9770, address: "서울 영어 학원" },
        }}
        childPos={{ user_id: "child-1", lat: 37.5665, lng: 126.9780, updatedAt: "2026-05-06T01:00:00Z" }}
        childProfile={{ name: "혜니", emoji: "🐰", color_hex: "#F779A8" }}
        mapReady
        isChildMode={false}
        onClose={() => {}}
      />
    );

    await waitFor(() => expect(fetchWalkingRouteMock).toHaveBeenCalled());

    await waitFor(() => {
      expect(
        globalThis.window.__hyeniCreatedPolylines.some((options) => options.strokeStyle === "shortdash")
      ).toBe(false);
    });
  });

  it("loads walking route points before Kakao map is ready so fallback maps are not straight lines", async () => {
    fetchWalkingRouteMock.mockResolvedValue({
      provider: "test",
      points: [
        { lat: 37.5665, lng: 126.9780 },
        { lat: 37.5700, lng: 126.9786 },
        { lat: 37.5796, lng: 126.9770 },
      ],
      distance: 1800,
      duration: 1600,
    });

    const { container } = render(
      <RouteOverlay
        ev={{
          id: "event-3",
          title: "영어 학원",
          emoji: "📚",
          time: "16:00",
          color: "#A78BFA",
          bg: "#EDE9FE",
          location: { lat: 37.5796, lng: 126.9770, address: "서울 영어 학원" },
        }}
        childPos={{ user_id: "child-1", lat: 37.5665, lng: 126.9780, updatedAt: "2026-05-06T01:00:00Z" }}
        childProfile={{ name: "혜니", emoji: "🐰", color_hex: "#F779A8" }}
        mapReady={false}
        mapLoadError="지도 로딩 실패"
        isChildMode={false}
        onClose={() => {}}
      />
    );

    await waitFor(() => expect(fetchWalkingRouteMock).toHaveBeenCalled());
    await waitFor(() => {
      const routePolyline = container.querySelector('[data-testid="hyeni-fallback-map"] polyline');
      const pointCount = routePolyline?.getAttribute("points")?.trim().split(/\s+/).length || 0;
      expect(pointCount).toBe(3);
    });
  });
});
