import { afterEach, describe, expect, it, vi } from "vitest";

async function loadLib() {
    vi.resetModules();
    return import("../../src/lib/appConfirm.js");
}

describe("appConfirm", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("핸들러 미등록 시 false 로 resolve 된다", async () => {
        const { appConfirm } = await loadLib();
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        await expect(appConfirm({ message: "삭제할까요?" })).resolves.toBe(false);
        warn.mockRestore();
    });

    it("핸들러에 옵션과 resolve 콜백을 전달한다", async () => {
        const { appConfirm, setAppConfirmHandler } = await loadLib();
        const handler = vi.fn();
        setAppConfirmHandler(handler);
        appConfirm({ title: "삭제", message: "정말요?", tone: "danger", confirmLabel: "삭제" });
        const req = handler.mock.calls[0][0];
        expect(req.title).toBe("삭제");
        expect(req.message).toBe("정말요?");
        expect(req.tone).toBe("danger");
        expect(req.confirmLabel).toBe("삭제");
        expect(typeof req.resolve).toBe("function");
    });

    it("resolve(true) 호출 시 promise 가 true 로 풀린다", async () => {
        const { appConfirm, setAppConfirmHandler } = await loadLib();
        let captured;
        setAppConfirmHandler((req) => { captured = req; });
        const promise = appConfirm({ message: "진행?" });
        captured.resolve(true);
        await expect(promise).resolves.toBe(true);
    });

    it("resolve(false) 호출 시 promise 가 false 로 풀린다", async () => {
        const { appConfirm, setAppConfirmHandler } = await loadLib();
        let captured;
        setAppConfirmHandler((req) => { captured = req; });
        const promise = appConfirm({ message: "진행?" });
        captured.resolve(false);
        await expect(promise).resolves.toBe(false);
    });

    it("옵션을 생략하면 기본값을 채운다", async () => {
        const { appConfirm, setAppConfirmHandler } = await loadLib();
        const handler = vi.fn();
        setAppConfirmHandler(handler);
        appConfirm();
        const req = handler.mock.calls[0][0];
        expect(req.title).toBe("확인");
        expect(req.confirmLabel).toBe("확인");
        expect(req.cancelLabel).toBe("취소");
        expect(req.tone).toBe("default");
    });

    it("resolve 가 두 번 호출돼도 첫 결과만 반영된다", async () => {
        const { appConfirm, setAppConfirmHandler } = await loadLib();
        let captured;
        setAppConfirmHandler((req) => { captured = req; });
        const promise = appConfirm({ message: "진행?" });
        captured.resolve(true);
        captured.resolve(false);
        await expect(promise).resolves.toBe(true);
    });
});
