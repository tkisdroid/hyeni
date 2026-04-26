import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("src/App.jsx", "utf8");

describe("child safety setup gate", () => {
  it("blocks child mode behind the one-time safety connection checklist", () => {
    expect(app).toContain("CHILD_SAFETY_SETUP_STEPS");
    expect(app).toContain("getChildSafetySetupSteps");
    expect(app).toContain("childSafetySetupBlocked");
    expect(app).toContain("안전 연결 준비");
    expect(app).toContain("안전 기능을 먼저 준비해요");
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
