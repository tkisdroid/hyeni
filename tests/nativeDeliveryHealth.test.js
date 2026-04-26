import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const notificationPlugin = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/NotificationPlugin.java",
  "utf8",
);
const pushNotifications = readFileSync("src/lib/pushNotifications.js", "utf8");

describe("native delivery health contract", () => {
  it("reports child safety readiness fields needed for no-touch remote listen", () => {
    expect(notificationPlugin).toContain('result.put("recordAudioGranted", recordAudioGranted)');
    expect(notificationPlugin).toContain('result.put("remoteListenChannelEnabled", remoteListenChannelEnabled)');
    expect(notificationPlugin).toContain('result.put("locationServiceRunning", locationServiceRunning)');
    expect(notificationPlugin).toContain('result.put("sdkInt", Build.VERSION.SDK_INT)');
    expect(notificationPlugin).toContain('result.put("manufacturer", Build.MANUFACTURER)');
    expect(notificationPlugin).toContain('result.put("model", Build.MODEL)');
  });

  it("opens app details and remote-listen channel settings from the native setup gate", () => {
    expect(notificationPlugin).toContain("openAppDetailsSettings");
    expect(notificationPlugin).toContain("openNotificationChannelSettings");
    expect(notificationPlugin).toContain("Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS");
    expect(pushNotifications).toContain('target === "appDetails"');
    expect(pushNotifications).toContain('target === "remoteListenChannel"');
    expect(pushNotifications).toContain('channelId: "hyeni_remote_listen"');
  });
});
