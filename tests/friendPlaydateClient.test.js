import { describe, it, expect, vi, beforeEach } from "vitest";

// 모든 supabase 호출을 mock 처리. RED 단계에서는 stub들이
// `not_implemented`를 던지므로 호출 mock이 무엇을 반환하든 의미 없다.
// GREEN 단계에서 같은 mock을 재사용하기 위해 풍부하게 정의한다.
vi.mock("../src/lib/supabase.js", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

import {
  findCandidates,
  startPlaydate,
  endPlaydate,
  upsertPublicPlace,
  setFamilyPlaydateEnabled,
  setSavedPlacePlaydateSafe,
  subscribeActiveSession,
  fetchActiveSession,
  fetchHistory,
} from "../src/lib/friendPlaydate.js";
import { supabase } from "../src/lib/supabase.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findCandidates", () => {
  it("calls RPC find_playdate_candidates with familyId", async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: { candidates: [], error: "not_in_safe_place" },
      error: null,
    });
    const result = await findCandidates("fam-1");
    expect(supabase.rpc).toHaveBeenCalledWith("find_playdate_candidates", {
      p_family_id: "fam-1",
    });
    expect(result.candidates).toEqual([]);
  });

  it("returns hit with candidates array", async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: {
        candidates: [
          {
            family_id: "fam-2",
            child_user_id: "u-2",
            child_name: "지민",
            public_place_id: "p-1",
          },
        ],
        public_place_id: "p-1",
      },
      error: null,
    });
    const result = await findCandidates("fam-1");
    expect(result.candidates).toHaveLength(1);
    expect(result.public_place_id).toBe("p-1");
  });
});

describe("startPlaydate", () => {
  it("inserts session row + invokes push-notify", async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: { id: "sess-1" },
      error: null,
    });
    supabase.from.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });
    supabase.functions.invoke.mockResolvedValueOnce({
      data: { delivered: true },
      error: null,
    });

    const result = await startPlaydate({
      publicPlaceId: "p-1",
      familyAId: "fam-1",
      familyBId: "fam-2",
      childAId: "u-1",
      childBId: "u-2",
      initiatorUserId: "u-1",
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "push-notify",
      expect.objectContaining({
        body: expect.objectContaining({
          action: "playdate_started",
          session_id: "sess-1",
        }),
      }),
    );
    expect(result.session_id).toBe("sess-1");
    expect(result.delivered).toBe(true);
  });

  it("throws when same family", async () => {
    await expect(
      startPlaydate({
        publicPlaceId: "p-1",
        familyAId: "fam-1",
        familyBId: "fam-1",
        childAId: "u-1",
        childBId: "u-2",
        initiatorUserId: "u-1",
      }),
    ).rejects.toThrow(/same family/);
  });
});

describe("endPlaydate", () => {
  it("updates stopped_at + invokes push-notify playdate_ended", async () => {
    // Mock chain: from().update().eq("id").is("stopped_at", null).select()
    const mockSelect = vi.fn().mockResolvedValueOnce({
      data: [{ id: "sess-1" }],
      error: null,
    });
    supabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({ select: mockSelect }),
        }),
      }),
    });
    supabase.functions.invoke.mockResolvedValueOnce({
      data: { delivered: true },
      error: null,
    });

    await endPlaydate("sess-1", "parent_end");
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "push-notify",
      expect.objectContaining({
        body: { action: "playdate_ended", session_id: "sess-1" },
      }),
    );
  });

  it("skips push when session already stopped (idempotent guard)", async () => {
    // Mock returns no rows — the .is("stopped_at", null) filter excluded the
    // row because another caller already set stopped_at.
    supabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
          }),
        }),
      }),
    });

    const result = await endPlaydate("sess-1", "parent_end");
    expect(result).toEqual({ stopped: false, reason: "already_stopped" });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("rejects invalid stop_reason", async () => {
    await expect(endPlaydate("sess-1", "invalid_reason")).rejects.toThrow(
      /invalid stop_reason/,
    );
  });
});

describe("upsertPublicPlace", () => {
  it("returns existing id when kakaoPlaceId already maps to a public_place (select-then-insert)", async () => {
    // public_places는 INSERT/SELECT RLS만 있고 UPDATE policy가 없어 upsert가
    // conflict 시 RLS 거부됨 → SELECT-then-INSERT 패턴 사용.
    const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
      data: { id: "p-existing" },
      error: null,
    });
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
      }),
    });
    const id = await upsertPublicPlace({
      kakaoPlaceId: "k-123",
      name: "한강공원",
      lat: 37.5,
      lng: 127.0,
    });
    expect(id).toBe("p-existing");
  });

  it("inserts new row when kakaoPlaceId not yet mapped", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: { id: "p-new" },
      error: null,
    });
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      });
    const id = await upsertPublicPlace({
      kakaoPlaceId: "k-123",
      name: "한강공원",
      lat: 37.5,
      lng: 127.0,
    });
    expect(id).toBe("p-new");
  });

  it("plain insert when kakaoPlaceId null", async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: { id: "p-1" },
      error: null,
    });
    supabase.from.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });
    const id = await upsertPublicPlace({
      kakaoPlaceId: null,
      name: "동네",
      lat: 37.5,
      lng: 127.0,
    });
    expect(id).toBe("p-1");
  });
});

describe("setFamilyPlaydateEnabled", () => {
  it("updates families.playdate_enabled", async () => {
    const mockEq = vi.fn().mockResolvedValueOnce({ data: null, error: null });
    supabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({ eq: mockEq }),
    });
    await setFamilyPlaydateEnabled("fam-1", true);
    expect(supabase.from).toHaveBeenCalledWith("families");
  });
});

describe("setSavedPlacePlaydateSafe", () => {
  it("updates saved_places row", async () => {
    const mockEq = vi.fn().mockResolvedValueOnce({ data: null, error: null });
    supabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({ eq: mockEq }),
    });
    await setSavedPlacePlaydateSafe("sp-1", true, "p-1");
    expect(supabase.from).toHaveBeenCalledWith("saved_places");
  });
});

describe("fetchActiveSession", () => {
  it("returns RPC-enriched session (place_name + friend_family_phones)", async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: {
        id: "sess-1",
        public_place_id: "pp-1",
        family_a_id: "fam-1",
        family_b_id: "fam-2",
        started_at: "2026-04-28T10:00:00Z",
        stopped_at: null,
        stop_reason: null,
        place_name: "대지초등학교",
        friend_child_name: "지민",
        friend_family_phones: ["010-1111-2222", "010-3333-4444"],
      },
      error: null,
    });
    const session = await fetchActiveSession("fam-1");
    expect(supabase.rpc).toHaveBeenCalledWith("get_active_playdate_session", {
      p_family_id: "fam-1",
    });
    expect(session?.id).toBe("sess-1");
    expect(session?.friend_family_phones).toEqual([
      "010-1111-2222",
      "010-3333-4444",
    ]);
    expect(session?.friend_child_name).toBe("지민");
    expect(session?.place_name).toBe("대지초등학교");
  });

  it("returns null when no active session", async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null });
    const session = await fetchActiveSession("fam-1");
    expect(session).toBeNull();
  });
});

describe("fetchHistory", () => {
  it("returns array of past sessions", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce({
        data: [
          { id: "sess-2", stopped_at: "2026-04-26T12:00:00Z" },
          { id: "sess-3", stopped_at: "2026-04-25T12:00:00Z" },
        ],
        error: null,
      }),
    };
    supabase.from.mockReturnValueOnce(builder);
    const rows = await fetchHistory("fam-1", 10);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(2);
  });
});

describe("subscribeActiveSession", () => {
  it("returns an unsubscribe handle", () => {
    const unsubscribe = subscribeActiveSession("fam-1", () => {});
    expect(typeof unsubscribe).toBe("function");
  });

  it("uses a unique realtime topic for each subscription", () => {
    subscribeActiveSession("fam-1", () => {});
    subscribeActiveSession("fam-1", () => {});

    const topics = supabase.channel.mock.calls.map(([topic]) => topic);
    expect(topics).toHaveLength(2);
    expect(new Set(topics).size).toBe(2);
    expect(topics[0]).toMatch(/^friend_playdate-fam-1-/);
    expect(topics[1]).toMatch(/^friend_playdate-fam-1-/);
  });
});
