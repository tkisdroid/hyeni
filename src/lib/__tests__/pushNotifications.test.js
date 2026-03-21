import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock modules before imports ─────────────────────────────────────────────
vi.mock("../supabase.js", () => ({
  supabase: { from: () => ({ upsert: () => ({}) }) },
}));

// ── Helpers ─────────────────────────────────────────────────────────────────
function createTestEvent(overrides = {}) {
  return {
    id: "evt-1",
    time: "16:30",
    title: "태권도",
    emoji: "\uD83E\uDD4B",
    location: { lat: 37.5, lng: 127.0 },
    ...overrides,
  };
}

function createNotifSettings(overrides = {}) {
  return {
    minutesBefore: [15, 5],
    parentEnabled: true,
    childEnabled: true,
    ...overrides,
  };
}

/**
 * Build a todayKey-based events map for a given date.
 * The key format must match `${y}-${month}-${day}` (0-based month, 1-based day).
 */
function buildEventsMap(events, date = new Date()) {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  return { [key]: events };
}

/**
 * Create a future time string (HH:MM) that is `minutesAhead` minutes from now.
 */
function futureTime(minutesAhead = 60) {
  const d = new Date(Date.now() + minutesAhead * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe("pushNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set a fixed "now": today at 10:00
    vi.setSystemTime(new Date(2026, 2, 21, 10, 0, 0));

    // Default: non-native, permission granted
    vi.stubGlobal("window", {
      Capacitor: undefined,
      Notification: { permission: "granted" },
    });
    // Provide Notification constructor on globalThis so hasNotificationAPI() returns true
    vi.stubGlobal("Notification", { permission: "granted" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // buildAlarmPayloads — directly testable via _buildAlarmPayloads
  // ──────────────────────────────────────────────────────────────────────────
  describe("buildAlarmPayloads (via _buildAlarmPayloads)", () => {
    // We must dynamically import after mocks are set up
    async function importModule() {
      // Reset module registry so mocks take effect each time
      vi.resetModules();
      return import("../pushNotifications.js");
    }

    it("parent: minutesBefore should only include >= 15 (no 5min)", async () => {
      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" }); // 4 hours ahead of 10:00
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev]);

      const payloads = mod._buildAlarmPayloads(events, settings, "parent");

      const minutePayloads = payloads.filter((p) => !p.id.endsWith("-start"));
      // Only 15min should remain; 5min filtered out
      expect(minutePayloads).toHaveLength(1);
      expect(minutePayloads[0].id).toBe("evt-1-15");
    });

    it("parent: should include start notification", async () => {
      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      const payloads = mod._buildAlarmPayloads(events, settings, "parent");

      const startPayloads = payloads.filter((p) => p.id.endsWith("-start"));
      expect(startPayloads).toHaveLength(1);
      expect(startPayloads[0].id).toBe("evt-1-start");
    });

    it("parent: should NOT include end notification", async () => {
      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      const payloads = mod._buildAlarmPayloads(events, settings, "parent");

      const endPayloads = payloads.filter((p) => p.id.endsWith("-end"));
      expect(endPayloads).toHaveLength(0);
    });

    it("parent start notification should NOT be silent", async () => {
      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      const payloads = mod._buildAlarmPayloads(events, settings, "parent");

      const startPayload = payloads.find((p) => p.id.endsWith("-start"));
      expect(startPayload).toBeDefined();
      // channel is "schedule" (not "silent") and no silent flag
      expect(startPayload.channel).toBe("schedule");
      expect(startPayload.silent).toBeUndefined();
    });

    it("child: should include all minutesBefore (15 and 5)", async () => {
      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev]);

      const payloads = mod._buildAlarmPayloads(events, settings, "child");

      const minutePayloads = payloads.filter((p) => !p.id.endsWith("-start"));
      expect(minutePayloads).toHaveLength(2);
      const ids = minutePayloads.map((p) => p.id);
      expect(ids).toContain("evt-1-15");
      expect(ids).toContain("evt-1-5");
    });

    it("child: should include start notification", async () => {
      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      const payloads = mod._buildAlarmPayloads(events, settings, "child");

      const startPayloads = payloads.filter((p) => p.id.endsWith("-start"));
      expect(startPayloads).toHaveLength(1);
    });

    it("should skip events in arrivedEventIds", async () => {
      const mod = await importModule();
      const ev1 = createTestEvent({ id: "evt-1", time: "14:00" });
      const ev2 = createTestEvent({ id: "evt-2", time: "15:00", title: "피아노" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev1, ev2]);

      const arrivedSet = new Set(["evt-1"]);
      const payloads = mod._buildAlarmPayloads(events, settings, "child", arrivedSet);

      // evt-1 should be skipped, evt-2 should remain
      const evt1Payloads = payloads.filter((p) => p.id.startsWith("evt-1"));
      const evt2Payloads = payloads.filter((p) => p.id.startsWith("evt-2"));
      expect(evt1Payloads).toHaveLength(0);
      expect(evt2Payloads.length).toBeGreaterThan(0);
    });

    it("events NOT in arrivedEventIds should still be scheduled", async () => {
      const mod = await importModule();
      const ev1 = createTestEvent({ id: "evt-1", time: "14:00" });
      const ev2 = createTestEvent({ id: "evt-2", time: "15:00", title: "피아노" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev1, ev2]);

      const arrivedSet = new Set(["evt-1"]);
      const payloads = mod._buildAlarmPayloads(events, settings, "child", arrivedSet);

      // evt-2 should have 15min + 5min + start = 3 payloads
      const evt2Payloads = payloads.filter((p) => p.id.startsWith("evt-2"));
      expect(evt2Payloads).toHaveLength(3);
    });

    it("should skip past events (event time already passed)", async () => {
      const mod = await importModule();
      // Event at 09:00, but "now" is 10:00 => already passed
      const ev = createTestEvent({ time: "09:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      const payloads = mod._buildAlarmPayloads(events, settings, "child");

      expect(payloads).toHaveLength(0);
    });

    it("parent: should skip when parentEnabled is false", async () => {
      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ parentEnabled: false });
      const events = buildEventsMap([ev]);

      const payloads = mod._buildAlarmPayloads(events, settings, "parent");

      expect(payloads).toHaveLength(0);
    });

    it("child: should skip when childEnabled is false", async () => {
      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ childEnabled: false });
      const events = buildEventsMap([ev]);

      const payloads = mod._buildAlarmPayloads(events, settings, "child");

      expect(payloads).toHaveLength(0);
    });

    it("should use event's notifOverride when present", async () => {
      const mod = await importModule();
      const ev = createTestEvent({
        time: "14:00",
        notifOverride: {
          minutesBefore: [30],
          parentEnabled: true,
          childEnabled: true,
        },
      });
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev]);

      const payloads = mod._buildAlarmPayloads(events, settings, "parent");

      const minutePayloads = payloads.filter((p) => !p.id.endsWith("-start"));
      // notifOverride says [30], which passes >= 15 filter for parent
      expect(minutePayloads).toHaveLength(1);
      expect(minutePayloads[0].id).toBe("evt-1-30");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // scheduleNotifications
  // ──────────────────────────────────────────────────────────────────────────
  describe("scheduleNotifications", () => {
    async function importModule() {
      vi.resetModules();
      return import("../pushNotifications.js");
    }

    it("should return immediately on native platform (no timers set)", async () => {
      // Simulate native platform
      vi.stubGlobal("window", {
        Capacitor: {
          isNativePlatform: () => true,
          registerPlugin: () => ({}),
        },
        Notification: { permission: "granted" },
      });
      vi.stubGlobal("Notification", { permission: "granted" });

      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      // Should not throw and should return undefined (early return)
      const result = mod.scheduleNotifications(events, settings, "parent");
      expect(result).toBeUndefined();
    });

    it("should return immediately when role is falsy", async () => {
      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      // null role => early return
      const result = mod.scheduleNotifications(events, settings, null);
      expect(result).toBeUndefined();
    });

    it("should return immediately when permission is not granted", async () => {
      vi.stubGlobal("Notification", { permission: "denied" });
      vi.stubGlobal("window", {
        Capacitor: undefined,
        Notification: { permission: "denied" },
      });

      const mod = await importModule();
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      const result = mod.scheduleNotifications(events, settings, "parent");
      expect(result).toBeUndefined();
    });
  });
});
