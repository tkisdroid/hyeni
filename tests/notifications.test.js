import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  __testing__,
  buildAlarmPayloads,
  normalizeNotifSettings,
  scheduleNotifications,
} from "../src/lib/pushNotifications.js";

function createEventsForToday() {
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  return {
    [dateKey]: [
      {
        id: "event-1",
        title: "영어 학원",
        time: "09:00",
        endTime: "10:00",
        emoji: "📚",
        notifOverride: null,
      },
    ],
  };
}

describe("push notification settings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 18, 8, 0, 0));

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: class FakeNotification {},
    });
    window.Notification.permission = "granted";
  });

  afterEach(() => {
    __testing__.resetScheduledTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete window.Notification;
  });

  test("normalizes reminder minutes into a unique descending list", () => {
    expect(
      normalizeNotifSettings({
        childEnabled: true,
        parentEnabled: true,
        minutesBefore: [10, 15, 10, -1, 0, "5", 15],
      }).minutesBefore,
    ).toEqual([15, 10, 5]);
  });

  test("builds unique native alarm payloads for configured reminder times", () => {
    const payloads = buildAlarmPayloads(
      createEventsForToday(),
      normalizeNotifSettings({
        childEnabled: true,
        parentEnabled: true,
        minutesBefore: [15, 10, 10],
      }),
      "parent",
    );

    expect(payloads.map((payload) => payload.id)).toEqual([
      "event-1-15",
      "event-1-10",
      "event-1-start",
      "event-1-end",
    ]);
  });

  test("schedules each reminder only once even when duplicate minutes are provided", () => {
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    scheduleNotifications(
      createEventsForToday(),
      {
        childEnabled: true,
        parentEnabled: true,
        minutesBefore: [15, 10, 10],
      },
      "parent",
    );

    expect(timeoutSpy).toHaveBeenCalledTimes(4);
    expect(__testing__.getScheduledTimerKeys()).toEqual([
      "event-1-15",
      "event-1-10",
      "event-1-start",
      "event-1-end",
    ]);
  });
});
