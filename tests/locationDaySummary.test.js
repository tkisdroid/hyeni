import { describe, expect, test } from "vitest";
import {
  buildLocationDaySummary,
  getLocationHistoryDayBounds,
} from "../src/lib/locationTrailDisplay.js";

describe("location day summary helpers", () => {
  const at = (hour, minute) => new Date(2026, 4, 5, hour, minute).toISOString();

  test("summarizes only the selected child's day trail and nearby places", () => {
    const summary = buildLocationDaySummary(
      [
        { user_id: "child-a", lat: 37.5000, lng: 127.0000, recorded_at: at(9, 0) },
        { user_id: "child-b", lat: 35.1000, lng: 129.0000, recorded_at: at(9, 5) },
        { user_id: "child-a", lat: 37.5002, lng: 127.0001, recorded_at: at(9, 20) },
        { user_id: "child-a", lat: 37.5030, lng: 127.0040, recorded_at: at(10, 10) },
      ],
      {
        childUserId: "child-a",
        savedPlaces: [
          { name: "영어 학원", location: { lat: 37.5001, lng: 127.0001 } },
        ],
      },
    );

    expect(summary.hasData).toBe(true);
    expect(summary.pointCount).toBe(3);
    expect(summary.timeline.map((item) => item.placeLabel).filter(Boolean)).toContain("영어 학원");
    expect(summary.dwellPlaces[0]).toMatchObject({
      placeLabel: "영어 학원",
      durationLabel: "20분",
    });
    expect(summary.distanceMeters).toBeGreaterThan(300);
  });

  test("builds simple registered-place movement entries", () => {
    const summary = buildLocationDaySummary(
      [
        { user_id: "child-a", lat: 37.5000, lng: 127.0000, recorded_at: at(8, 28) },
        { user_id: "child-a", lat: 37.5001, lng: 127.0001, recorded_at: at(8, 40) },
        { user_id: "child-a", lat: 37.5500, lng: 127.0500, recorded_at: at(12, 0) },
        { user_id: "child-a", lat: 37.6000, lng: 127.1000, recorded_at: at(19, 56) },
      ],
      {
        childUserId: "child-a",
        savedPlaces: [
          { name: "학교", location: { lat: 37.5000, lng: 127.0000 } },
          { name: "태권도", location: { lat: 37.6000, lng: 127.1000 } },
        ],
      },
    );

    expect(summary.placeVisits).toEqual([
      expect.objectContaining({
        label: "등교",
        timeLabel: "12분 머무름",
      }),
      expect.objectContaining({
        label: "태권도 도착",
        timeLabel: "19:56분",
      }),
    ]);
  });

  test("returns a safe empty state when the selected child has no rows", () => {
    const summary = buildLocationDaySummary(
      [{ user_id: "child-b", lat: 37.5, lng: 127, recorded_at: at(9, 0) }],
      { childUserId: "child-a" },
    );

    expect(summary).toMatchObject({
      hasData: false,
      pointCount: 0,
      timeline: [],
      dwellPlaces: [],
      placeVisits: [],
    });
  });

  test("builds a 24 hour local day window for location history queries", () => {
    const { start, end } = getLocationHistoryDayBounds({ year: 2026, month: 4, day: 5 });

    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(4);
    expect(start.getDate()).toBe(5);
  });
});
