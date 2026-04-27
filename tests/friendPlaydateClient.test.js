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
    const mockSelect = vi.fn().mockResolvedValueOnce({
      data: [{ id: "sess-1" }],
      error: null,
    });
    supabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ select: mockSelect }),
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

  it("rejects invalid stop_reason", async () => {
    await expect(endPlaydate("sess-1", "invalid_reason")).rejects.toThrow(
      /invalid stop_reason/,
    );
  });
});

describe("upsertPublicPlace", () => {
  it("uses upsert when kakaoPlaceId present", async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: { id: "p-1" },
      error: null,
    });
    supabase.from.mockReturnValueOnce({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });
    const id = await upsertPublicPlace({
      kakaoPlaceId: "k-123",
      name: "한강공원",
      lat: 37.5,
      lng: 127.0,
    });
    expect(id).toBe("p-1");
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
  it("returns first row WHERE stopped_at IS NULL", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: "sess-1" }, error: null }),
    };
    supabase.from.mockReturnValueOnce(builder);
    const session = await fetchActiveSession("fam-1");
    expect(session?.id).toBe("sess-1");
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
});
