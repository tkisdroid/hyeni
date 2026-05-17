import { describe, expect, it } from "vitest";
import { resolveChildScreenTime, screenTimeScopeSuffix } from "../src/lib/screenTime.js";

describe("resolveChildScreenTime", () => {
    it("usage-stats 소스의 deviceScreenOnMs 를 device scope 로 우선 사용한다", () => {
        const r = resolveChildScreenTime({
            deviceScreenOnMs: 7_200_000,
            deviceScreenOnSource: "usage-stats",
            screenOnMs: 300_000,
        });
        expect(r).toEqual({ ms: 7_200_000, scope: "device" });
    });

    it("deviceScreenOnMs 가 0 이어도 usage-stats 소스면 device scope", () => {
        const r = resolveChildScreenTime({ deviceScreenOnMs: 0, deviceScreenOnSource: "usage-stats", screenOnMs: 500 });
        expect(r).toEqual({ ms: 0, scope: "device" });
    });

    it("권한 미허용(unavailable_permission)이면 screenOnMs 앱 시간으로 폴백한다", () => {
        const r = resolveChildScreenTime({
            deviceScreenOnMs: null,
            deviceScreenOnSource: "unavailable_permission",
            screenOnMs: 600_000,
        });
        expect(r).toEqual({ ms: 600_000, scope: "app" });
    });

    it("deviceScreenOnSource 가 없으면(구버전 native) 앱 시간으로 폴백한다", () => {
        const r = resolveChildScreenTime({ deviceScreenOnMs: 999_999, screenOnMs: 120_000 });
        expect(r).toEqual({ ms: 120_000, scope: "app" });
    });

    it("status 가 없으면 ms 0, app scope", () => {
        expect(resolveChildScreenTime(null)).toEqual({ ms: 0, scope: "app" });
        expect(resolveChildScreenTime(undefined)).toEqual({ ms: 0, scope: "app" });
    });

    it("screenOnMs 가 음수/비정상이면 0 으로 정규화", () => {
        expect(resolveChildScreenTime({ screenOnMs: -5 })).toEqual({ ms: 0, scope: "app" });
        expect(resolveChildScreenTime({ screenOnMs: "x" })).toEqual({ ms: 0, scope: "app" });
    });
});

describe("screenTimeScopeSuffix", () => {
    it("device scope 는 접미사 없음", () => {
        expect(screenTimeScopeSuffix("device")).toBe("");
    });
    it("app scope 는 '(앱 사용)' 접미사", () => {
        expect(screenTimeScopeSuffix("app")).toBe(" (앱 사용)");
    });
});
