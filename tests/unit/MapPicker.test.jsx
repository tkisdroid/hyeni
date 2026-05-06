// tests/unit/MapPicker.test.jsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MapPicker } from "../../src/components/map/MapPicker.jsx";

const createdMaps = [];
const createdMarkers = [];

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
    createdMaps.push(this);
  }

  setCenter(center) {
    this.center = center;
  }

  setLevel(level) {
    this.level = level;
  }

  getLevel() {
    return this.level;
  }
}

class FakeMarker {
  constructor(options = {}) {
    this.position = options.position;
    createdMarkers.push(this);
  }

  setPosition(position) {
    this.position = position;
  }

  getPosition() {
    return this.position;
  }
}

function installKakaoStub() {
  window.kakao = {
    maps: {
      LatLng: FakeLatLng,
      Map: FakeMap,
      Marker: FakeMarker,
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
                  id: "place-1",
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
}

describe("MapPicker", () => {
  beforeEach(() => {
    createdMaps.length = 0;
    createdMarkers.length = 0;
    installKakaoStub();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.kakao;
  });

  it("일정 시트 위에서 클릭 가능한 최상위 지도 모달로 열린다", () => {
    const { container } = render(
      <MapPicker
        currentPos={{ lat: 37.5665, lng: 126.978 }}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    const overlay = container.firstElementChild;
    expect(overlay).toBeTruthy();
    expect(Number(overlay.style.zIndex)).toBeGreaterThan(601);
    expect(screen.getByRole("button", { name: "검색" })).toBeVisible();
  });

  it("사용자가 고른 위치를 이후 currentPos 갱신으로 덮어쓰지 않는다", () => {
    const { rerender } = render(
      <MapPicker
        currentPos={{ lat: 37.5665, lng: 126.978 }}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(createdMaps).toHaveLength(1);
    expect(createdMarkers).toHaveLength(1);

    act(() => {
      createdMaps[0].onclick({ latLng: new FakeLatLng(37.5, 127.0) });
    });

    rerender(
      <MapPicker
        currentPos={{ lat: 35.1796, lng: 129.0756 }}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    const markerPosition = createdMarkers[0].getPosition();
    expect(markerPosition.getLat()).toBe(37.5);
    expect(markerPosition.getLng()).toBe(127.0);
  });
});
