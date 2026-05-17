import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendInstantPush = vi.fn();
const rpc = vi.fn();

vi.mock("../src/lib/instantPush.js", () => ({ sendInstantPush }));
vi.mock("../src/lib/supabase.js", () => ({ supabase: { rpc } }));

async function loadLib() {
    vi.resetModules();
    return import("../src/lib/childSettingRequest.js");
}

describe("childSettingRequest", () => {
    beforeEach(() => {
        sendInstantPush.mockResolvedValue(true);
        rpc.mockResolvedValue({ error: null });
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
    });

    describe("SETTING_REQUEST_META", () => {
        it("covers exactly the theme/character/sound/mascot menus", async () => {
            const { SETTING_REQUEST_META } = await loadLib();
            expect(Object.keys(SETTING_REQUEST_META).sort()).toEqual(
                ["character", "mascot", "sound", "theme"],
            );
        });
    });

    describe("sendChildSettingRequest", () => {
        it("sends a parent_alert push with the child_setting_request type", async () => {
            const { sendChildSettingRequest } = await loadLib();
            const result = await sendChildSettingRequest({
                menuKey: "theme", familyId: "fam-1", senderUserId: "child-1", childName: "혜니",
            });
            expect(result).toBe(true);
            expect(sendInstantPush).toHaveBeenCalledWith(expect.objectContaining({
                action: "parent_alert",
                alertType: "child_setting_request",
                severity: "info",
                familyId: "fam-1",
                senderUserId: "child-1",
            }));
        });

        it("records a parent_alert via the insert_parent_alert RPC", async () => {
            const { sendChildSettingRequest } = await loadLib();
            await sendChildSettingRequest({ menuKey: "theme", familyId: "fam-1", childName: "혜니" });
            expect(rpc).toHaveBeenCalledWith("insert_parent_alert", expect.objectContaining({
                p_family_id: "fam-1",
                p_alert_type: "child_setting_request",
                p_severity: "info",
            }));
            // p_event_id 생략 — overload 모호성 회피 (Phase 0 경고)
            expect(rpc.mock.calls[0][1]).not.toHaveProperty("p_event_id");
        });

        it("includes the child name in the parent-facing message", async () => {
            const { sendChildSettingRequest } = await loadLib();
            await sendChildSettingRequest({ menuKey: "character", familyId: "fam-1", childName: "지우" });
            expect(rpc.mock.calls[0][1].p_message).toContain("지우");
        });

        it("falls back to '아이' when no child name is given", async () => {
            const { sendChildSettingRequest } = await loadLib();
            await sendChildSettingRequest({ menuKey: "sound", familyId: "fam-1" });
            expect(rpc.mock.calls[0][1].p_message).toContain("아이");
        });

        it("throws on an unknown menu key and does not call the RPC", async () => {
            const { sendChildSettingRequest } = await loadLib();
            await expect(sendChildSettingRequest({ menuKey: "wifi", familyId: "fam-1" }))
                .rejects.toThrow();
            expect(rpc).not.toHaveBeenCalled();
        });

        it("throws when the family id is missing", async () => {
            const { sendChildSettingRequest } = await loadLib();
            await expect(sendChildSettingRequest({ menuKey: "theme", familyId: "" }))
                .rejects.toThrow();
        });

        it("throws when the RPC returns an error", async () => {
            rpc.mockResolvedValue({ error: { message: "permission denied" } });
            const { sendChildSettingRequest } = await loadLib();
            await expect(sendChildSettingRequest({ menuKey: "theme", familyId: "fam-1" }))
                .rejects.toThrow("permission denied");
        });

        it("still resolves true when the push fails but the RPC succeeds", async () => {
            sendInstantPush.mockResolvedValue(false);
            const { sendChildSettingRequest } = await loadLib();
            await expect(sendChildSettingRequest({ menuKey: "theme", familyId: "fam-1" }))
                .resolves.toBe(true);
        });
    });

    describe("cooldown", () => {
        it("allows a request when the menu has never been used", async () => {
            const { checkRequestCooldown } = await loadLib();
            expect(checkRequestCooldown("theme").allowed).toBe(true);
        });

        it("blocks a repeat request within 60 seconds and reports remaining seconds", async () => {
            const { checkRequestCooldown, markRequestSent } = await loadLib();
            markRequestSent("theme", 1_000_000);
            const result = checkRequestCooldown("theme", 1_000_000 + 30_000);
            expect(result.allowed).toBe(false);
            expect(result.remainingSec).toBe(30);
        });

        it("allows a request again once 60 seconds have elapsed", async () => {
            const { checkRequestCooldown, markRequestSent } = await loadLib();
            markRequestSent("theme", 1_000_000);
            expect(checkRequestCooldown("theme", 1_000_000 + 60_000).allowed).toBe(true);
        });

        it("tracks cooldown per menu independently", async () => {
            const { checkRequestCooldown, markRequestSent } = await loadLib();
            markRequestSent("theme", 1_000_000);
            expect(checkRequestCooldown("theme", 1_000_000 + 10_000).allowed).toBe(false);
            expect(checkRequestCooldown("character", 1_000_000 + 10_000).allowed).toBe(true);
        });
    });
});
