import { describe, expect, it } from "vitest";
import { getChildSafetySetupSteps } from "../src/lib/nativeSetup.js";

// Phase 2 — Usage Access(화면 시간 측정) 선택 권한 항목.
describe("getChildSafetySetupSteps — 화면 시간 측정 선택 항목", () => {
    it("screenTime 선택 권한 항목을 포함한다", () => {
        const steps = getChildSafetySetupSteps({}, false);
        const screenTime = steps.find((s) => s.id === "screenTime");
        expect(screenTime).toBeTruthy();
        expect(screenTime.optional).toBe(true);
        expect(screenTime.target).toBe("usageAccess");
    });

    it("usageAccessGranted 가 true 일 때만 screenTime 이 ready", () => {
        const granted = getChildSafetySetupSteps({ usageAccessGranted: true }, false)
            .find((s) => s.id === "screenTime");
        const notGranted = getChildSafetySetupSteps({ usageAccessGranted: false }, false)
            .find((s) => s.id === "screenTime");
        const missing = getChildSafetySetupSteps({}, false)
            .find((s) => s.id === "screenTime");
        expect(granted.ready).toBe(true);
        expect(notGranted.ready).toBe(false);
        expect(missing.ready).toBe(false);
    });

    it("기존 필수 권한 항목은 optional 이 아니다", () => {
        const steps = getChildSafetySetupSteps({}, false);
        const required = steps.filter((s) => !s.optional);
        // microphone/notifications/remoteListenChannel/fullScreen/battery/backgroundLocation/locationService = 7
        expect(required.length).toBe(7);
        expect(required.some((s) => s.id === "screenTime")).toBe(false);
    });
});
