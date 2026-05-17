import { afterEach, describe, expect, it, vi } from "vitest";

async function loadLib() {
    vi.resetModules();
    return import("../../src/lib/appToast.js");
}

describe("appToast", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("핸들러 미등록 시 false 를 반환하고 경고를 남긴다", async () => {
        const { appToast } = await loadLib();
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(appToast("실패했어요")).toBe(false);
        expect(warn).toHaveBeenCalled();
    });

    it("등록된 핸들러를 메시지·타입과 함께 호출한다", async () => {
        const { appToast, setAppToastHandler } = await loadLib();
        const handler = vi.fn();
        setAppToastHandler(handler);
        expect(appToast("저장 완료", "success")).toBe(true);
        expect(handler).toHaveBeenCalledWith("저장 완료", "success");
    });

    it("타입을 생략하면 error 로 기본 처리한다", async () => {
        const { appToast, setAppToastHandler } = await loadLib();
        const handler = vi.fn();
        setAppToastHandler(handler);
        appToast("문제가 생겼어요");
        expect(handler).toHaveBeenCalledWith("문제가 생겼어요", "error");
    });

    it("빈 메시지는 핸들러를 호출하지 않는다", async () => {
        const { appToast, setAppToastHandler } = await loadLib();
        const handler = vi.fn();
        setAppToastHandler(handler);
        expect(appToast("")).toBe(false);
        expect(handler).not.toHaveBeenCalled();
    });

    it("해제 함수 호출 후에는 핸들러를 더 이상 호출하지 않는다", async () => {
        const { appToast, setAppToastHandler } = await loadLib();
        const handler = vi.fn();
        const unregister = setAppToastHandler(handler);
        unregister();
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(appToast("뭔가")).toBe(false);
        expect(handler).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
