import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("../src/lib/auth.js", () => ({
    getSession,
}));

async function loadInstantPush() {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    return import("../src/lib/instantPush.js");
}

describe("sendInstantPush", () => {
    beforeEach(() => {
        getSession.mockResolvedValue({ access_token: "session-token" });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it("returns true when the push function accepts the request", async () => {
        const { sendInstantPush } = await loadInstantPush();

        const sent = await sendInstantPush({
            action: "request_device_status",
            familyId: "family-1",
            senderUserId: "parent-1",
            title: "",
            message: "",
            idempotencyKey: "11111111-1111-4111-8111-111111111111",
        });

        expect(sent).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            "https://project.supabase.co/functions/v1/push-notify",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    Authorization: "Bearer session-token",
                    "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
                }),
            }),
        );
    });

    it("returns true when the retry succeeds", async () => {
        vi.useFakeTimers();
        fetch
            .mockResolvedValueOnce({ ok: false, status: 503 })
            .mockResolvedValueOnce({ ok: true, status: 200 });
        const { sendInstantPush } = await loadInstantPush();

        const sentPromise = sendInstantPush({
            action: "request_device_status",
            familyId: "family-1",
            senderUserId: "parent-1",
            title: "",
            message: "",
            idempotencyKey: "22222222-2222-4222-8222-222222222222",
        });
        await vi.advanceTimersByTimeAsync(800);

        await expect(sentPromise).resolves.toBe(true);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("returns false when it cannot send a push", async () => {
        const { sendInstantPush } = await loadInstantPush();

        await expect(sendInstantPush({
            action: "request_device_status",
            familyId: "",
            senderUserId: "parent-1",
            title: "",
            message: "",
        })).resolves.toBe(false);

        expect(fetch).not.toHaveBeenCalled();
    });

    it("returns false after the first attempt and retry both fail", async () => {
        vi.useFakeTimers();
        fetch.mockResolvedValue({ ok: false, status: 500 });
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { sendInstantPush } = await loadInstantPush();

        const sentPromise = sendInstantPush({
            action: "request_device_status",
            familyId: "family-1",
            senderUserId: "parent-1",
            title: "",
            message: "",
            idempotencyKey: "33333333-3333-4333-8333-333333333333",
        });
        await vi.advanceTimersByTimeAsync(800);

        await expect(sentPromise).resolves.toBe(false);
        expect(fetch).toHaveBeenCalledTimes(2);
        warnSpy.mockRestore();
    });
});
