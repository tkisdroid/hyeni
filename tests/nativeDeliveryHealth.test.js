import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const notificationPlugin = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/NotificationPlugin.java",
  "utf8",
);
const deviceStatusReporter = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/DeviceStatusReporter.java",
  "utf8",
);
const locationService = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/LocationService.java",
  "utf8",
);
const nativeLocationService = readFileSync("src/lib/nativeLocationService.js", "utf8");
const pushNotifications = readFileSync("src/lib/pushNotifications.js", "utf8");
const appJsx = readFileSync("src/App.jsx", "utf8");
// Phase 5 #4 / B9: REMOTE_LISTEN_HEALTH_STEPS + summarize/resolve moved to lib/remoteListenHealth.js,
// ChildRemoteListenReadiness moved into components/pairing/PairingModal.jsx.
const remoteListenHealth = readFileSync("src/lib/remoteListenHealth.js", "utf8");
const pairingModal = readFileSync("src/components/pairing/PairingModal.jsx", "utf8");
const app = `${appJsx}\n${remoteListenHealth}\n${pairingModal}`;

describe("native delivery health contract", () => {
  it("reports child safety readiness fields needed for no-touch remote listen", () => {
    expect(notificationPlugin).toContain('result.put("recordAudioGranted", recordAudioGranted)');
    expect(notificationPlugin).toContain('result.put("fullScreenIntentAllowed", fullScreenIntentAllowed)');
    expect(notificationPlugin).toContain('result.put("remoteListenChannelEnabled", remoteListenChannelEnabled)');
    expect(notificationPlugin).toContain('result.put("remoteListenChannelImportance", remoteListenChannelImportance)');
    expect(notificationPlugin).toContain('result.put("remoteListenChannelBlocked", remoteListenChannelBlocked)');
    expect(notificationPlugin).toContain('result.put("ringerMode", ringerMode)');
    expect(notificationPlugin).toContain('result.put("dndMode", dndMode)');
    expect(notificationPlugin).toContain('result.put("dndAccess", dndAccess)');
    expect(notificationPlugin).toContain('result.put("networkConnected", networkConnected)');
    expect(notificationPlugin).toContain('result.put("networkValidated", networkValidated)');
    expect(notificationPlugin).toContain('result.put("screenInteractive", screenInteractive)');
    expect(notificationPlugin).toContain('result.put("keyguardLocked", keyguardLocked)');
    expect(notificationPlugin).toContain('result.put("foldState", foldState)');
    expect(notificationPlugin).toContain('result.put("powerSaveMode", powerSaveMode)');
    expect(notificationPlugin).toContain('result.put("backgroundRestricted", backgroundRestricted)');
    expect(notificationPlugin).toContain('result.put("locationServiceRunning", locationServiceRunning)');
    expect(notificationPlugin).toContain('result.put("sdkInt", Build.VERSION.SDK_INT)');
    expect(notificationPlugin).toContain('result.put("manufacturer", Build.MANUFACTURER)');
    expect(notificationPlugin).toContain('result.put("model", Build.MODEL)');
  });

  it("broadcasts the same remote-listen readiness fields from background FCM diagnostics", () => {
    expect(deviceStatusReporter).toContain('put("recordAudio", recordAudioGranted)');
    expect(deviceStatusReporter).toContain('put("postNotif", postPermissionGranted && notificationsEnabled)');
    expect(deviceStatusReporter).toContain('put("fullScreen", fullScreenIntentAllowed)');
    expect(deviceStatusReporter).toContain('put("channelOk", remoteListenChannelEnabled)');
    expect(deviceStatusReporter).toContain('put("remoteListenChannelImportance", remoteListenChannelImportance)');
    expect(deviceStatusReporter).toContain('put("remoteListenChannelBlocked", remoteListenChannelBlocked)');
    expect(deviceStatusReporter).toContain('put("powerSaveMode", powerSaveMode)');
    expect(deviceStatusReporter).toContain('put("backgroundRestricted", backgroundRestricted)');
    expect(deviceStatusReporter).toContain('put("fullScreenIntentAllowed", fullScreenIntentAllowed)');
    expect(deviceStatusReporter).toContain('NotificationManager.canUseFullScreenIntent');
  });

  it("uses fresh child device-status broadcasts before stale family_member health in parent diagnostics", () => {
    expect(app).toContain("resolveChildRemoteListenHealth");
    expect(app).toContain("childDeviceStatusMap?.[child.user_id]");
    expect(app).toContain("childDeviceStatusMap={childDeviceStatusMap}");
    expect(app).toContain("health?.remoteListenChannelBlocked === true");
  });

  it("does not label advisory Android states as remote-listen readiness failure", () => {
    expect(app).toContain('severity: "blocker", label: "마이크 권한 필요"');
    expect(app).toContain('severity: "blocker", label: "알림 권한 꺼짐"');
    expect(app).toContain('severity: "blocker", label: "연결 알림 채널 꺼짐"');
    expect(app).toContain('severity: "blocker", label: "네트워크 끊김"');
    expect(app).toContain('severity: "advisory", label: "배터리 최적화 제한"');
    expect(app).toContain('severity: "advisory", label: "방해 금지 모드 영향"');
    expect(app).toContain('severity: "advisory", label: "무음 모드"');
    expect(app).toContain('severity: "advisory", label: "화면 꺼짐/잠금"');
    expect(app).toContain("원격 청취 연결 가능");
    expect(app).not.toContain("원격 청취 준비 부족");
  });

  it("opens app details and remote-listen channel settings from the native setup gate", () => {
    expect(notificationPlugin).toContain("openAppDetailsSettings");
    expect(notificationPlugin).toContain("openNotificationChannelSettings");
    expect(notificationPlugin).toContain("Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS");
    expect(pushNotifications).toContain('target === "appDetails"');
    expect(pushNotifications).toContain('target === "remoteListenChannel"');
    expect(pushNotifications).toContain('const REMOTE_LISTEN_CHANNEL_ID = "hyeni_remote_listen_v2"');
    expect(pushNotifications).toContain("channelId: REMOTE_LISTEN_CHANNEL_ID");
  });

  it("stores native child movement history as detailed walking-route points when available", () => {
    expect(nativeLocationService).toContain("kakaoRestKey");
    expect(locationService).toContain("kakaoRestKey");
    expect(locationService).toContain("fetchWalkingRoutePoints");
    expect(locationService).toContain("uploadLocationHistoryRows");
    expect(locationService).toContain("interpolateRecordedAt");
    expect(locationService).toContain("apis-navi.kakaomobility.com/affiliate/walking/v1/directions");
  });
});
