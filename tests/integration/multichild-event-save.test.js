// tests/integration/multichild-event-save.test.js
//
// saveEventWithChildren now delegates atomicity to the
// public.save_event_with_children RPC. The integration test verifies the RPC
// is invoked with the correct payload and surfaces errors instead of
// silently swallowing them.

import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcCalls = [];
let nextRpcResponse = { data: { id: "e1" }, error: null };

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {
    rpc: (name, args) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(nextRpcResponse);
    },
  },
}));

beforeEach(() => {
  rpcCalls.length = 0;
  nextRpcResponse = { data: { id: "e1" }, error: null };
});

import { saveEventWithChildren } from "../../src/lib/sync.js";

describe("saveEventWithChildren", () => {
  it("자녀 1명 선택 시 RPC 에 p_child_ids:[c1] 전달", async () => {
    await saveEventWithChildren(
      { id: "e1", title: "학원", familyId: "f1", userId: "u1", dateKey: "2026-12-31" },
      { childIds: ["c1"], familyAll: false }
    );
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("save_event_with_children");
    expect(rpcCalls[0].args.p_child_ids).toEqual(["c1"]);
    expect(rpcCalls[0].args.p_family_all).toBe(false);
    expect(rpcCalls[0].args.p_event.is_family_event).toBe(false);
    expect(rpcCalls[0].args.p_event.id).toBe("e1");
  });

  it("'가족 전체' 시 p_family_all:true + p_child_ids:[]", async () => {
    await saveEventWithChildren(
      { id: "e1", title: "저녁식사", familyId: "f1", userId: "u1", dateKey: "2026-12-31" },
      { childIds: [], familyAll: true }
    );
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].args.p_family_all).toBe(true);
    expect(rpcCalls[0].args.p_child_ids).toEqual([]);
    expect(rpcCalls[0].args.p_event.is_family_event).toBe(true);
  });

  it("familyAll=true 일 때 client 가 보낸 childIds 는 무시되고 빈 배열 전달", async () => {
    await saveEventWithChildren(
      { id: "e1", title: "외식", familyId: "f1", userId: "u1", dateKey: "2026-12-31" },
      { childIds: ["c1", "c2"], familyAll: true }
    );
    expect(rpcCalls[0].args.p_child_ids).toEqual([]);
    expect(rpcCalls[0].args.p_family_all).toBe(true);
  });

  it("RPC 가 error 를 반환하면 throw — 자체 rollback 시도 없음", async () => {
    nextRpcResponse = { data: null, error: { message: "permission denied" } };
    await expect(
      saveEventWithChildren(
        { id: "e1", title: "학원", familyId: "f1", userId: "u1", dateKey: "2026-12-31" },
        { childIds: ["c1"], familyAll: false }
      )
    ).rejects.toMatchObject({ message: "permission denied" });
    // 호출은 정확히 1회 — client 는 더 이상 step 1/2/3 으로 나누지 않는다.
    expect(rpcCalls).toHaveLength(1);
  });

  it("event.updatedAt 가 있으면 p_expected_updated_at 으로 전달", async () => {
    await saveEventWithChildren(
      { id: "e1", title: "수정", familyId: "f1", userId: "u1", dateKey: "2026-12-31", updatedAt: "2026-05-15T01:00:00Z" },
      { childIds: ["c1"], familyAll: false }
    );
    expect(rpcCalls[0].args.p_expected_updated_at).toBe("2026-05-15T01:00:00Z");
  });

  it("event.updatedAt 없으면 p_expected_updated_at:null — OC 비활성 (add path)", async () => {
    await saveEventWithChildren(
      { id: "e1", title: "추가", familyId: "f1", userId: "u1", dateKey: "2026-12-31" },
      { childIds: ["c1"], familyAll: false }
    );
    expect(rpcCalls[0].args.p_expected_updated_at).toBeNull();
  });

  it("RPC 가 SQLSTATE 40001 (concurrent_modification) 반환 시 client 가 그대로 surface", async () => {
    nextRpcResponse = {
      data: null,
      error: { message: "concurrent_modification: events.updated_at moved from ...", code: "40001" },
    };
    await expect(
      saveEventWithChildren(
        { id: "e1", title: "충돌", familyId: "f1", userId: "u1", dateKey: "2026-12-31", updatedAt: "2026-05-15T00:00:00Z" },
        { childIds: ["c1"], familyAll: false }
      )
    ).rejects.toMatchObject({ code: "40001" });
  });
});
