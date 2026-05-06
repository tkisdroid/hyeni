import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/android-remote-listen-matrix.mjs";

describe("android remote listen matrix collector", () => {
  it("captures the Android state required for remote listen device-state evidence", () => {
    expect(existsSync(scriptPath)).toBe(true);
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("adb devices -l");
    expect(script).toContain("--scenario");
    expect(script).toContain("scenarioSlug");
    expect(script).toContain("RECORD_AUDIO");
    expect(script).toContain("POST_NOTIFICATIONS");
    expect(script).toContain("FOREGROUND_SERVICE_MICROPHONE");
    expect(script).toContain("ACCESS_NETWORK_STATE");
    expect(script).toContain("notification_policy_access");
    expect(script).toContain("dumpsys\", \"notification\", \"--noredact");
    expect(script).toContain("remoteListenChannels");
    expect(script).toContain("hyeni_remote_listen_v2");
    expect(script).toContain("ambient_listen_fgs");
    expect(script).toContain("blocked:");
    expect(script).toContain("parsedImportance === 0");
    expect(script).toContain("zen_mode");
    expect(script).toContain("ringer_mode");
    expect(script).toContain("dumpsys\", \"audio");
    expect(script).toContain("ringer_mode_source");
    expect(script).toContain("mDreamingLockscreen");
    expect(script).toContain("cmd\", \"device_state");
    expect(script).toContain("deviceState");
    expect(script).toContain("supportedStateNames");
    expect(script).toContain("print-states-simple");
    expect(script).toContain("networkConnected");
    expect(script).toContain("get-package-networking-enabled");
    expect(script).toContain("packageNetworking");
    expect(script).toContain("chain3Enabled");
    expect(script).toContain("batteryOptimization");
    expect(script).toContain("AmbientListenService");
    expect(script).toContain("remote_listen");
    expect(script).toContain("requiresTwoDevices");
  });
});
