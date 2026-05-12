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
    expect(wizard).toContain("위치 확인, 일정 알림, 위급 연결");
    expect(wizard).toContain("언제든 기기 설정에서 바꿀 수 있어요");
    expect(wizard).toContain("한 번에 모두 허용");
    expect(wizard).toContain("HyeniMascot");
    expect(wizard).toContain("처음 설정을 도와주는 혜니");
    expect(wizard).not.toContain("HyeniGirl");
  });

  it("covers microphone, notifications, full-screen alerts, battery, location, and service readiness", () => {
    expect(app).toContain("마이크 권한");
    expect(app).toContain("알림 권한");
    expect(app).toContain("전체화면 알림");
    expect(app).toContain("배터리 예외");
    expect(app).toContain("위치 항상 허용");
    expect(app).toContain("위치 서비스");
    expect(app).toContain("1분 주변 소리 연결");
    expect(app).toContain("일정 알림과 응급 연결이 늦어질 수 있어요");
    expect(app).toContain('target: "remoteListenChannel"');
    expect(app).toContain('target: "appDetails"');
  });
});
