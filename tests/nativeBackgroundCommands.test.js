import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

// Phase 5 #4 / B12: AmbientAudioRecorder + remoteAudio constants moved out of App.jsx.
const appJsxOnly = readFileSync("src/App.jsx", "utf8");
const ambientAudioRecorderSrc = readFileSync("src/components/audio/AmbientAudioRecorder.jsx", "utf8");
const remoteAudioSrc = readFileSync("src/lib/remoteAudio.js", "utf8");
const app = `${appJsxOnly}\n${ambientAudioRecorderSrc}\n${remoteAudioSrc}`;
const pushNotify = readFileSync("supabase/functions/push-notify/index.ts", "utf8");
const fcmService = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java",
  "utf8",
);
const mainActivity = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/MainActivity.java",
  "utf8",
);
const ambientPlugin = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/AmbientListenPlugin.java",
  "utf8",
);
const locationService = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/LocationService.java",
  "utf8",
);
const ambientService = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/AmbientListenService.java",
  "utf8",
);
const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const remoteListenActivityPath = "android/app/src/main/java/com/hyeni/calendar/RemoteListenActivity.java";
const remoteListenActivity = existsSync(remoteListenActivityPath)
  ? readFileSync(remoteListenActivityPath, "utf8")
  : "";

describe("native background command contracts", () => {
  it("routes parent location refresh through child-targeted FCM and native refresh handlers", () => {
    expect(app).toContain('action: "request_location"');
    expect(pushNotify).toContain('body?.action === "request_location"');
    expect(pushNotify).toContain('const isLocationRefresh = action === "request_location"');
    expect(pushNotify).toContain('isLocationRefresh ? { targetRole: "child" }');
    expect(fcmService).toContain('"request_location".equals(type)');
    expect(fcmService).toContain("startLocationRefreshService(data)");
    expect(locationService).toContain('public static final String ACTION_REFRESH_NOW = "REFRESH_NOW"');
    expect(locationService).toContain('"request_location".equals(type)');
    expect(locationService).toContain("isPendingTargetedToThisDevice(data)");
    expect(locationService).toContain("requestImmediateLocationFix()");
  });

  it("deduplicates remote listen capture and playback by request id", () => {
    expect(app).toContain("remoteAudioCurrentRequestIdRef");
    expect(app).toContain("remoteAudioSeenChunksRef");
    expect(app).toContain("startInFlightRef");
    expect(app).toContain("playbackGenerationRef");
    expect(app).toContain("activeSourcesRef");
    expect(app).toContain("activeAudioElementsRef");
    expect(app).toContain("stopActivePlayback");
    expect(app).toContain('if (startInFlightRef.current || (status !== "idle" && status !== "failed")) return;');
    expect(app).toContain("waiting_for_child_notification");
    expect(app).toContain("연결 요청 전송 중");
    expect(app).toContain('const showRemoteListenDiagnostics = status !== "listening" && remoteListenDiagnostics.length > 0;');
    expect(app).toContain("requestId: options.requestId");
    expect(app).toContain('sequence === "" ? fallbackSource : "seq"');
    expect(app).toContain('sequence === "" ? String(detail.data || "").slice(0, 96) : sequence');
    expect(ambientService).toContain("EXTRA_REQUEST_ID");
    expect(ambientService).toContain("activeRequestId");
    expect(ambientService).toContain('"duplicate_start"');
    expect(ambientService).toContain("Microphone foreground-service type denied; stopping ambient listen");
    expect(ambientService).toContain("Protocol.HTTP_1_1");
    expect(ambientService).toContain("Realtime audio chunk sent seq=");
    expect(fcmService).toContain("resolveRemoteListenRequestId");
    expect(fcmService).toContain('data.get("pushId")');
    expect(fcmService).toContain('data.get("idempotencyKey")');
    expect(fcmService).toContain("Remote listen native start skipped on Android 14+");
    expect(locationService).toContain("Remote listen pending start skipped on Android 14+");
    expect(locationService).toContain("Protocol.HTTP_1_1");
    expect(locationService).toContain("readRemoteListenRequestId(data)");
    expect(ambientService).toContain('.put("requestId", requestId)');
  });

  it("limits remote listen to one minute and keeps the parent UI premium-gated", () => {
    expect(app).toContain("const REMOTE_AUDIO_DEFAULT_DURATION_SEC = 60;");
    expect(fcmService).toContain("private static final int DEFAULT_REMOTE_LISTEN_DURATION_SEC = 60;");
    expect(ambientService).toContain("private static final int DEFAULT_DURATION_SEC = 60;");
    expect(app).toContain("최대 1분 · 프리미엄 전용");
    expect(app).toContain("showRemoteAudio && isParent && entitlement.canUse(FEATURES.REMOTE_AUDIO)");
    expect(app).toContain("주변 소리 듣기는 프리미엄 회원만 사용할 수 있어요.");
    expect(pushNotify).toContain("remote_listen_requires_premium");
    expect(pushNotify).toContain("remote_listen_disabled_by_family");
  });

  it("stops native remote listen through child-targeted FCM when the child WebView is backgrounded", () => {
    expect(app).toContain('action: "remote_listen_stop"');
    expect(app).toContain('idempotencyKey: `${requestId}:stop`');
    expect(pushNotify).toContain('body?.action === "remote_listen_stop"');
    expect(pushNotify).toContain('const isRemoteListenStop = action === "remote_listen_stop"');
    expect(fcmService).toContain('"remote_listen_stop".equals(type)');
    expect(fcmService).toContain("stopAmbientListenService(data)");
    expect(locationService).toContain('"remote_listen_stop".equals(type)');
    expect(locationService).toContain("stopAmbientListenFromPending(data)");
  });

  it("keeps remote listen and location refresh scoped to the selected child user", () => {
    expect(app).toContain("buildSelectedChildCommandPayload");
    expect(app).toContain("remoteAudioCurrentTargetUserIdRef");
    expect(app).toContain("const targetUserId = remoteAudioCurrentTargetUserIdRef.current || targetChildUserId || null");
    expect(app).toContain("fetchTodayLocationHistory(familyId, targetUserId)");
    expect(fcmService).toContain("target user mismatch");
    expect(fcmService).toContain('putIfPresent(intent, "targetUserId", data.get("targetUserId"))');
    expect(mainActivity).toContain('sourceIntent.getStringExtra("targetUserId")');
    expect(remoteListenActivity).toContain('sourceIntent.getStringExtra("targetUserId")');
    expect(remoteListenActivity).toContain('copyIfPresent(pendingIntent, intent, "targetUserId")');
    expect(locationService).toContain('putIfNotBlank(launchIntent, "targetUserId", data.optString("targetUserId", ""))');
  });

  it("blocks wrong-child or wrong-family remote listen launches before JS fallback", () => {
    expect(mainActivity).toContain("private enum RemoteListenStartResult");
    expect(mainActivity).toContain("RemoteListenStartResult.BLOCKED");
    expect(mainActivity).toContain("Remote listen native start skipped: family mismatch");
    expect(mainActivity).toContain("Remote listen native start skipped: target user mismatch");
    expect(mainActivity).toContain("if (result == RemoteListenStartResult.FALLBACK_ALLOWED)");
    expect(remoteListenActivity).toContain("Remote listen foreground start skipped: family mismatch");
    expect(remoteListenActivity).toContain("Remote listen foreground start skipped: target user mismatch");
    expect(fcmService).toContain('commandLabel + " skipped: family mismatch"');
    expect(locationService).toContain("Skipping pending notification for another family");
  });

  it("keeps the Android 14+ remote-listen launcher visible until the bridge activity opens", () => {
    expect(manifest).toContain('android:name=".RemoteListenActivity"');
    expect(fcmService).toContain("new Intent(this, RemoteListenActivity.class)");
    expect(locationService).toContain("new Intent(this, RemoteListenActivity.class)");
    expect(remoteListenActivity).toContain("setShowWhenLocked(true)");
    expect(remoteListenActivity).toContain("setTurnScreenOn(true)");
    expect(remoteListenActivity).toContain("AmbientListenService.ACTION_START");
    expect(remoteListenActivity).toContain("startForegroundService(serviceIntent)");
    expect(fcmService).not.toContain("cancelRemoteListenLauncher(launcherNotificationId)");
    expect(fcmService).toContain('putExtra("launcherNotificationId", launcherNotificationId)');
    expect(remoteListenActivity).toContain("RemoteListenRequestStore.markLauncherShown(this, requestId)");
    expect(locationService).toContain("RemoteListenRequestStore.wasLauncherRecentlyShown(this, requestId)");
    expect(locationService).toContain("Skipping duplicate remote listen pending fallback");
    expect(locationService).toContain('putExtra("launcherNotificationId", notificationId)');
    expect(remoteListenActivity).toContain("cancelLauncherNotification");
    expect(remoteListenActivity).toContain("handler.postDelayed(() -> cancelLauncherNotification(pendingIntent), 800)");
  });

  it("does not suppress the pending remote-listen fallback before the bridge activity actually opens", () => {
    expect(fcmService).not.toContain(
      [
        "int launcherNotificationId = showRemoteListenLauncher(data);",
        "RemoteListenRequestStore.markLauncherShown(this, requestId);",
        "launchRemoteListenActivity(data, launcherNotificationId);",
      ].join("\r\n                "),
    );
    expect(remoteListenActivity).toContain("RemoteListenRequestStore.markLauncherShown(this, requestId)");
  });

  it("opts remote-listen activity pending intents into Android background launch rules", () => {
    expect(fcmService).toContain("remoteListenCreatorOptions()");
    expect(fcmService).toContain("remoteListenSendOptions()");
    expect(fcmService).toContain("setPendingIntentCreatorBackgroundActivityStartMode");
    expect(fcmService).toContain("setPendingIntentBackgroundActivityStartMode");
    expect(fcmService).toContain("send(this, 0, null, null, null, null, remoteListenSendOptions())");
    expect(locationService).toContain("remoteListenCreatorOptions()");
    expect(locationService).toContain("remoteListenSendOptions()");
    expect(locationService).toContain("setPendingIntentCreatorBackgroundActivityStartMode");
    expect(locationService).toContain("setPendingIntentBackgroundActivityStartMode");
    expect(locationService).toContain("launchPendingIntent.send(this, 0, null, null, null, null, remoteListenSendOptions())");
  });

  it("does not claim native microphone capture started from a hidden Android 14+ WebView", () => {
    expect(mainActivity).toContain("isAppForegroundForMicrophone");
    expect(mainActivity).toContain("appForegroundForMicrophone = true");
    expect(mainActivity).toContain("appForegroundForMicrophone = false");
    expect(ambientPlugin).toContain("MainActivity.isAppForegroundForMicrophone()");
    expect(ambientPlugin).toContain("remote_listen_requires_foreground_activity");
  });

  it("keeps native command polling alive when the stored access token is stale", () => {
    expect(locationService).toContain("Pending notification auth failed");
    expect(locationService).toContain("retrying with apikey fallback");
    expect(locationService).toContain('"Authorization", "Bearer " + supabaseKey');
    expect(locationService).toContain("Pending notification poll fallback failed");
  });

  it("does not require VAPID secrets before queuing native pending fallback", () => {
    expect(pushNotify).toContain("const webPushConfigured = Boolean(VAPID_PUBLIC && VAPID_PRIVATE)");
    expect(pushNotify).toContain("if (webPushConfigured) {");
    expect(pushNotify).toContain("webpush.setVapidDetails");
    expect(pushNotify).toContain("if (webPushConfigured && subs?.length)");
  });

  it("removes the ambient foreground notification on normal capture completion", () => {
    expect(ambientService).toContain("removeForegroundNotification()");
    expect(ambientService).toContain("stopForeground(Service.STOP_FOREGROUND_REMOVE)");
    expect(ambientService).toContain("nm.cancel(NOTIF_ID)");
    expect(ambientService).toContain("Ambient audio capture finished requestId=");
    expect(ambientService).toContain("finishServiceAfterCapture()");
    expect(ambientService).toContain("mainHandler.post(cleanup)");
  });
});
