import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const app = readFileSync("src/App.jsx", "utf8");
const pushNotify = readFileSync("supabase/functions/push-notify/index.ts", "utf8");
const fcmService = readFileSync(
  "android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java",
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
    expect(app).toContain("requestId: options.requestId");
    expect(app).toContain('sequence === "" ? fallbackSource : "seq"');
    expect(app).toContain('sequence === "" ? String(detail.data || "").slice(0, 96) : sequence');
    expect(ambientService).toContain("EXTRA_REQUEST_ID");
    expect(ambientService).toContain("activeRequestId");
    expect(ambientService).toContain('"duplicate_start"');
    expect(ambientService).toContain('.put("requestId", requestId)');
  });
});
