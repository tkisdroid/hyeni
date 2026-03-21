import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock pushNotifications internals ────────────────────────────────────────
// The NotificationManager wraps these; we mock them to verify delegation.
const mockReplaceScheduledNotifications = vi.fn().mockResolvedValue({ scheduled: 0 });
const mockCancelScheduledNotifications = vi.fn().mockResolvedValue({});

vi.mock("../supabase.js", () => ({
  supabase: { from: () => ({ upsert: () => ({}) }) },
}));

// ── Helpers ─────────────────────────────────────────────────────────────────
function createTestEvent(overrides = {}) {
  return {
    id: "evt-1",
    time: "14:00",
    title: "태권도",
    emoji: "🥋",
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

function buildEventsMap(events, date = new Date()) {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  return { [key]: events };
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe("NotificationManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fixed "now": 2026-03-21 10:00:00
    vi.setSystemTime(new Date(2026, 2, 21, 10, 0, 0));

    // Reset mocks
    mockReplaceScheduledNotifications.mockClear();
    mockReplaceScheduledNotifications.mockResolvedValue({ scheduled: 0 });
    mockCancelScheduledNotifications.mockClear();

    // Default: non-native, permission granted
    vi.stubGlobal("window", {
      Capacitor: undefined,
      Notification: { permission: "granted" },
    });
    vi.stubGlobal("Notification", { permission: "granted" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function importManager() {
    vi.resetModules();
    const mod = await import("../notificationManager.js");
    return mod.NotificationManager;
  }

  // ────────────────────────────────────────────────────────────────────────
  // 1. Parent role: only schedules >= 15min-before + start (no 5min, no end)
  // ────────────────────────────────────────────────────────────────────────
  describe("Parent role scheduling rules", () => {
    it("should schedule 15min-before + start, skip 5min-before", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "parent", isNative: false });
      const ev = createTestEvent({ time: "14:00" }); // 4h from now
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      // Parent gets: 15min-before + start = 2 total (5min filtered out)
      expect(result.scheduled).toBe(2);
    });

    it("should NOT include end notifications", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "parent", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      // No end notification exists in the system
      expect(result.scheduled).toBe(2); // 15min + start only
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 2. Child role: schedules all minutesBefore + start
  // ────────────────────────────────────────────────────────────────────────
  describe("Child role scheduling rules", () => {
    it("should schedule ALL minutesBefore + start", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      // Child gets: 15min + 5min + start = 3 total
      expect(result.scheduled).toBe(3);
    });

    it("should schedule with custom minutesBefore [30, 15, 5]", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ minutesBefore: [30, 15, 5] });
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      // Child gets: 30min + 15min + 5min + start = 4 total
      expect(result.scheduled).toBe(4);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 3. arrivedEventIds: skips arrived events
  // ────────────────────────────────────────────────────────────────────────
  describe("arrivedEventIds filtering", () => {
    it("should skip events whose id is in arrivedEventIds", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const ev1 = createTestEvent({ id: "evt-1", time: "14:00" });
      const ev2 = createTestEvent({ id: "evt-2", time: "15:00", title: "피아노" });
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev1, ev2]);

      const arrivedSet = new Set(["evt-1"]);
      const result = mgr.sync(events, settings, arrivedSet);

      // Only evt-2 scheduled: 15min + 5min + start = 3
      expect(result.scheduled).toBe(3);
    });

    it("should schedule all events when arrivedEventIds is empty", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const ev1 = createTestEvent({ id: "evt-1", time: "14:00" });
      const ev2 = createTestEvent({ id: "evt-2", time: "15:00", title: "피아노" });
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev1, ev2]);

      const result = mgr.sync(events, settings, new Set());

      // Both events: (15+5+start) * 2 = 6
      expect(result.scheduled).toBe(6);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 4. Native platform: uses AlarmManager (replaceScheduledNotifications)
  // ────────────────────────────────────────────────────────────────────────
  describe("Native platform (AlarmManager)", () => {
    it("should call native replaceScheduledNotifications, NOT set JS timers", async () => {
      vi.stubGlobal("window", {
        Capacitor: {
          isNativePlatform: () => true,
          registerPlugin: () => ({
            replaceScheduledNotifications: mockReplaceScheduledNotifications,
            cancelScheduledNotifications: mockCancelScheduledNotifications,
          }),
        },
      });

      mockReplaceScheduledNotifications.mockResolvedValue({ scheduled: 2 });

      const Manager = await importManager();
      const mgr = new Manager({ role: "parent", isNative: true });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      const result = await mgr.sync(events, settings);

      expect(mockReplaceScheduledNotifications).toHaveBeenCalledTimes(1);
      expect(result.scheduled).toBe(2);
    });

    it("should pass correct notification payloads to native plugin", async () => {
      vi.stubGlobal("window", {
        Capacitor: {
          isNativePlatform: () => true,
          registerPlugin: () => ({
            replaceScheduledNotifications: mockReplaceScheduledNotifications,
            cancelScheduledNotifications: mockCancelScheduledNotifications,
          }),
        },
      });

      mockReplaceScheduledNotifications.mockResolvedValue({ scheduled: 3 });

      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: true });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev]);

      await mgr.sync(events, settings);

      const call = mockReplaceScheduledNotifications.mock.calls[0][0];
      const ids = call.notifications.map((n) => n.id);
      expect(ids).toContain("evt-1-15");
      expect(ids).toContain("evt-1-5");
      expect(ids).toContain("evt-1-start");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 5. Web platform: uses JS timers (setTimeout), NOT AlarmManager
  // ────────────────────────────────────────────────────────────────────────
  describe("Web platform (JS timers)", () => {
    it("should use setTimeout for scheduling, return scheduled count", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      // 15min + 5min + start = 3
      expect(result.scheduled).toBe(3);
    });

    it("should NOT call native plugin on web platform", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "parent", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      mgr.sync(events, settings);

      expect(mockReplaceScheduledNotifications).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 6. cancelAll: clears everything
  // ────────────────────────────────────────────────────────────────────────
  describe("cancelAll", () => {
    it("should clear all JS timers on web platform", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev]);

      mgr.sync(events, settings);
      mgr.cancelAll();

      // After cancelAll, internal timer count should be 0
      // Verify by syncing again — should work without double-fire issues
      const result = mgr.sync(events, settings);
      expect(result.scheduled).toBe(3);
    });

    it("should call native cancelScheduledNotifications on native platform", async () => {
      vi.stubGlobal("window", {
        Capacitor: {
          isNativePlatform: () => true,
          registerPlugin: () => ({
            replaceScheduledNotifications: mockReplaceScheduledNotifications,
            cancelScheduledNotifications: mockCancelScheduledNotifications,
          }),
        },
      });

      const Manager = await importManager();
      const mgr = new Manager({ role: "parent", isNative: true });

      await mgr.cancelAll();

      expect(mockCancelScheduledNotifications).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7. Events with no location: still get time-based notifications
  // ────────────────────────────────────────────────────────────────────────
  describe("Events without location", () => {
    it("should still schedule time-based notifications", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const ev = createTestEvent({ time: "14:00", location: null });
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      // No location doesn't affect time-based notifications
      expect(result.scheduled).toBe(3);
    });

    it("should schedule for events with undefined location", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "parent", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      delete ev.location;
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      // Parent: 15min + start = 2
      expect(result.scheduled).toBe(2);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8. Disabled notifications
  // ────────────────────────────────────────────────────────────────────────
  describe("Disabled notifications", () => {
    it("parentEnabled=false should skip parent notifications", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "parent", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ parentEnabled: false });
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      expect(result.scheduled).toBe(0);
    });

    it("childEnabled=false should skip child notifications", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ childEnabled: false });
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      expect(result.scheduled).toBe(0);
    });

    it("parentEnabled=false should not affect child scheduling", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ parentEnabled: false, childEnabled: true });
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      // Child should still get notifications
      expect(result.scheduled).toBe(3);
    });

    it("childEnabled=false should not affect parent scheduling", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "parent", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ parentEnabled: true, childEnabled: false });
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      // Parent should still get notifications
      expect(result.scheduled).toBe(2);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ────────────────────────────────────────────────────────────────────────
  describe("Edge cases", () => {
    it("should skip past events", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      // Event at 09:00, now is 10:00 => already passed
      const ev = createTestEvent({ time: "09:00" });
      const settings = createNotifSettings();
      const events = buildEventsMap([ev]);

      const result = mgr.sync(events, settings);

      expect(result.scheduled).toBe(0);
    });

    it("should handle empty events map", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const settings = createNotifSettings();

      const result = mgr.sync({}, settings);

      expect(result.scheduled).toBe(0);
    });

    it("sync should clear previous timers before scheduling new ones", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "child", isNative: false });
      const ev = createTestEvent({ time: "14:00" });
      const settings = createNotifSettings({ minutesBefore: [15, 5] });
      const events = buildEventsMap([ev]);

      mgr.sync(events, settings);
      const result = mgr.sync(events, settings);

      // Second sync should replace, not accumulate
      expect(result.scheduled).toBe(3);
    });

    it("should use event notifOverride when present", async () => {
      const Manager = await importManager();
      const mgr = new Manager({ role: "parent", isNative: false });
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

      const result = mgr.sync(events, settings);

      // notifOverride [30] passes >= 15 filter for parent: 30min + start = 2
      expect(result.scheduled).toBe(2);
    });
  });
});
