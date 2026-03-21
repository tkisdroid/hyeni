import { describe, it, expect, beforeEach } from "vitest";
import { GeofenceEngine } from "../geofenceEngine.js";
import { ARRIVAL_R } from "../utils.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a test event with sensible defaults.
 * `time` is "HH:MM" format matching app convention.
 */
function createEvent(overrides = {}) {
  return {
    id: "evt-1",
    time: "14:00",
    title: "태권도",
    emoji: "\uD83E\uDD4B",
    location: { lat: 37.5000, lng: 127.0000 },
    ...overrides,
  };
}

/**
 * Return a position that is `distanceMetres` due-north of the event location.
 * At lat ~37.5, 1 degree latitude ≈ 111,200 m.
 */
function posAtDistance(eventLoc, distanceMetres) {
  const latOffset = distanceMetres / 111_200;
  return { lat: eventLoc.lat + latOffset, lng: eventLoc.lng };
}

/**
 * Build a Date for today at HH:MM with optional minute offset.
 */
function timeAt(hours, minutes, offsetMin = 0) {
  return new Date(2026, 2, 21, hours, minutes + offsetMin, 0);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GeofenceEngine", () => {
  let engine;

  beforeEach(() => {
    engine = new GeofenceEngine({
      arrivalRadius: ARRIVAL_R,       // 100 m
      departureTimeoutMs: 90_000,     // not used in detection itself
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Arrival: inside radius + correct time window → detected
  // ─────────────────────────────────────────────────────────────────────────
  it("detects arrival when inside radius and within time window (-90 to +60 min)", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30); // 30 m away = inside 100 m
    const now = timeAt(14, 0); // exactly event time

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(1);
    expect(result.arrivals[0].event.id).toBe("evt-1");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Arrival: inside radius but too early (>90 min before) → NOT detected
  // ─────────────────────────────────────────────────────────────────────────
  it("does NOT detect arrival when more than 90 min before event time", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(12, 29); // 91 min before 14:00

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Arrival: inside radius but too late (>60 min after) → NOT detected
  // ─────────────────────────────────────────────────────────────────────────
  it("does NOT detect arrival when more than 60 min after event time", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(15, 1); // 61 min after 14:00

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Arrival: outside radius → NOT detected
  // ─────────────────────────────────────────────────────────────────────────
  it("does NOT detect arrival when outside the radius", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 150); // 150 m away = outside
    const now = timeAt(14, 0);

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Arrival: already marked arrived → NOT detected again
  // ─────────────────────────────────────────────────────────────────────────
  it("does NOT detect arrival for already-arrived event", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(14, 0);

    engine.markArrived("evt-1");
    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Early arrival (diff <= -10) → isEarly=true
  // ─────────────────────────────────────────────────────────────────────────
  it("marks early arrival when arriving 10+ min before event", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(13, 45); // 15 min early → diff = -15

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(1);
    expect(result.arrivals[0].isEarly).toBe(true);
    expect(result.arrivals[0].isOnTime).toBe(false);
    expect(result.arrivals[0].isLate).toBe(false);
    expect(result.arrivals[0].diff).toBe(-15);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. On-time arrival (-10 < diff <= 0) → isOnTime=true
  // ─────────────────────────────────────────────────────────────────────────
  it("marks on-time arrival when arriving within 10 min before event", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(13, 55); // 5 min early → diff = -5

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(1);
    expect(result.arrivals[0].isEarly).toBe(false);
    expect(result.arrivals[0].isOnTime).toBe(true);
    expect(result.arrivals[0].isLate).toBe(false);
    expect(result.arrivals[0].diff).toBe(-5);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Late arrival (diff > 0) → isLate=true
  // ─────────────────────────────────────────────────────────────────────────
  it("marks late arrival when arriving after event time", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(14, 10); // 10 min late → diff = 10

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(1);
    expect(result.arrivals[0].isEarly).toBe(false);
    expect(result.arrivals[0].isOnTime).toBe(false);
    expect(result.arrivals[0].isLate).toBe(true);
    expect(result.arrivals[0].diff).toBe(10);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Departure: was arrived, now outside radius → detected
  // ─────────────────────────────────────────────────────────────────────────
  it("detects departure when child leaves radius after arriving", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 200); // outside radius
    const now = timeAt(14, 30);

    engine.markArrived("evt-1");
    const result = engine.check(childPos, [ev], now);

    expect(result.departures).toHaveLength(1);
    expect(result.departures[0].event.id).toBe("evt-1");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Departure: already alerted → NOT detected again
  // ─────────────────────────────────────────────────────────────────────────
  it("does NOT detect departure when already departure-alerted", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 200);
    const now = timeAt(14, 30);

    engine.markArrived("evt-1");
    engine.markDepartureAlerted("evt-1");
    const result = engine.check(childPos, [ev], now);

    expect(result.departures).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Event without location → skipped
  // ─────────────────────────────────────────────────────────────────────────
  it("skips events without a location", () => {
    const ev = createEvent({ time: "14:00", location: null });
    const childPos = { lat: 37.5, lng: 127.0 };
    const now = timeAt(14, 0);

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(0);
    expect(result.departures).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 12. Multiple events: one arrived, one not → only new arrival returned
  // ─────────────────────────────────────────────────────────────────────────
  it("returns only new arrivals when multiple events are checked", () => {
    const loc = { lat: 37.5, lng: 127.0 };
    const ev1 = createEvent({ id: "evt-1", time: "14:00", location: loc });
    const ev2 = createEvent({ id: "evt-2", time: "14:30", title: "피아노", location: loc });
    const childPos = posAtDistance(loc, 30);
    const now = timeAt(14, 0);

    engine.markArrived("evt-1"); // evt-1 already arrived
    const result = engine.check(childPos, [ev1, ev2], now);

    // evt-1: already arrived → no arrival, but inside radius → no departure either
    // evt-2: within -90..+60 window (event at 14:30, now 14:00 → diff = -30) → arrival
    expect(result.arrivals).toHaveLength(1);
    expect(result.arrivals[0].event.id).toBe("evt-2");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 13. reset() → clears all sets
  // ─────────────────────────────────────────────────────────────────────────
  it("reset() clears arrivedSet and departureAlerts", () => {
    engine.markArrived("evt-1");
    engine.markDepartureAlerted("evt-2");

    expect(engine.getArrivedSet().size).toBe(1);

    engine.reset();

    expect(engine.getArrivedSet().size).toBe(0);

    // After reset, evt-1 should be detectable again
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(14, 0);
    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge: boundary of time window (-90 exactly, +60 exactly)
  // ─────────────────────────────────────────────────────────────────────────
  it("detects arrival at exactly -90 min (boundary inclusive)", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(12, 30); // exactly 90 min before

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(1);
  });

  it("detects arrival at exactly +60 min (boundary inclusive)", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(15, 0); // exactly 60 min after

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals).toHaveLength(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge: on-time boundary (diff = -10 → isEarly, diff = 0 → isOnTime)
  // ─────────────────────────────────────────────────────────────────────────
  it("diff exactly -10 is classified as early", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(13, 50); // diff = -10

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals[0].isEarly).toBe(true);
    expect(result.arrivals[0].isOnTime).toBe(false);
  });

  it("diff exactly 0 is classified as on-time", () => {
    const ev = createEvent({ time: "14:00" });
    const childPos = posAtDistance(ev.location, 30);
    const now = timeAt(14, 0); // diff = 0

    const result = engine.check(childPos, [ev], now);

    expect(result.arrivals[0].isEarly).toBe(false);
    expect(result.arrivals[0].isOnTime).toBe(true);
    expect(result.arrivals[0].isLate).toBe(false);
  });
});
