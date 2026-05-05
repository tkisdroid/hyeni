import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appJsx = readFileSync("src/App.jsx", "utf8");
// Phase 5 #4 / B22: native setup helpers moved to lib/nativeSetup.js — concatenate for string-presence checks.
const nativeSetup = readFileSync("src/lib/nativeSetup.js", "utf8");
const app = `${appJsx}\n${nativeSetup}`;
const wizard = readFileSync("src/components/onboarding/ChildPermissionWizard.jsx", "utf8");

describe("child safety setup gate", () => {
  it("blocks child mode behind the one-time safety connection checklist", () => {
    expect(app).toContain("CHILD_SAFETY_SETUP_STEPS");
    expect(app).toContain("getChildSafetySetupSteps");
    expect(app).toContain("childSafetySetupBlocked");
    expect(app).toContain("childSafetySetupBlocked && !permissionWizardDismissed");
    expect(app).toContain("ChildPermissionWizard");
    expect(wizard).toContain("안전 사용을 위해");
    expect(wizard).toContain("한 번에 모두 허용");
  });

  it("covers microphone, notifications, full-screen alerts, battery, location, and service readiness", () => {
    expect(app).toContain("마이크 권한");
    expect(app).toContain("알림 권한");
    expect(app).toContain("전체화면 알림");
    expect(app).toContain("배터리 예외");
    expect(app).toContain("위치 항상 허용");
    expect(app).toContain("위치 서비스");
    expect(app).toContain('target: "remoteListenChannel"');
    expect(app).toContain('target: "appDetails"');
  });
});
