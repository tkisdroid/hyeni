import { describe, expect, test } from "vitest";
import {
  LOCATION_TRAIL_GRADIENT_STOPS,
  findAcademyForStay,
  getStayDisplayParts,
  getStayDisplayTitle,
} from "../src/lib/locationTrailDisplay.js";

describe("location trail display helpers", () => {
  test("uses at most two colors for trail gradients", () => {
    expect(LOCATION_TRAIL_GRADIENT_STOPS.length).toBeLessThanOrEqual(2);
  });

  test("matches a dwell place to a nearby registered academy", () => {
    const academy = findAcademyForStay(
      { lat: 37.5001, lng: 127.0001 },
      [
        { name: "피아노 학원", location: { lat: 37.50012, lng: 127.00009 } },
        { name: "먼 학원", location: { lat: 37.55, lng: 127.05 } },
      ],
    );

    expect(academy?.name).toBe("피아노 학원");
  });

  test("uses academy name before address and never falls back to duration label", () => {
    const place = { lat: 37.5, lng: 127, label: "09:10-10:20", durationMs: 70 * 60_000 };

    expect(
      getStayDisplayTitle(place, {
        academies: [{ name: "영어 학원", location: { lat: 37.5, lng: 127 } }],
        locationInfo: { label: "서울 송파구 올림픽로 300" },
      }),
    ).toBe("영어 학원");

    expect(
      getStayDisplayTitle(place, {
        academies: [],
        locationInfo: { label: "서울 송파구 올림픽로 300" },
      }),
    ).toBe("서울 송파구 올림픽로 300");
  });

  test("shows a recognizable place name before the full address for dwell places", () => {
    const place = { lat: 37.333, lng: 127.123, label: "14:10-15:20" };
    const parts = getStayDisplayParts(place, {
      locationInfo: {
        placeName: "대지마을3차2단지 현대홈타운",
        label: "경기 용인시 수지구 대지로 36",
      },
    });

    expect(parts.title).toBe("대지마을3차2단지 현대홈타운");
    expect(parts.addressLabel).toBe("경기 용인시 수지구 대지로 36");

    expect(
      getStayDisplayParts(place, {
        locationInfo: { label: "경기 용인시 수지구 대지로 36 · 대지마을3차2단지 현대홈타운" },
      }),
    ).toEqual({
      title: "대지마을3차2단지 현대홈타운",
      addressLabel: "경기 용인시 수지구 대지로 36",
    });
  });
});
