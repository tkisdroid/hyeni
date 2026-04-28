import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";

// 모든 친구놀이 RPC/Realtime을 mock — orchestrator는 합성만 검증한다.
vi.mock("../src/lib/friendPlaydate.js", () => ({
  fetchActiveSession: vi.fn(),
  fetchHistory: vi.fn(),
  subscribeActiveSession: vi.fn(() => () => {}),
  setFamilyPlaydateEnabled: vi.fn(),
  setSavedPlacePlaydateSafe: vi.fn(),
  upsertPublicPlace: vi.fn(),
  endPlaydate: vi.fn(),
}));

vi.mock("../src/lib/sync.js", () => ({
  fetchSavedPlaces: vi.fn(),
}));

// supabase.js 직접 SELECT (families.playdate_enabled) chain mock
const mockMaybeSingle = vi.fn();
vi.mock("../src/lib/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    })),
  },
}));

import FriendPlaydatePanel from "../src/components/friendPlaydate/FriendPlaydatePanel.jsx";
import {
  fetchActiveSession,
  fetchHistory,
} from "../src/lib/friendPlaydate.js";
import { fetchSavedPlaces } from "../src/lib/sync.js";

beforeEach(() => {
  vi.clearAllMocks();
  fetchActiveSession.mockResolvedValue(null);
  fetchHistory.mockResolvedValue([]);
  fetchSavedPlaces.mockResolvedValue([
    {
      id: "sp-1",
      name: "한강공원",
      location: { lat: 37.5, lng: 127.0 },
      is_playdate_safe: true,
      public_place_id: "p-1",
    },
  ]);
  mockMaybeSingle.mockResolvedValue({
    data: { id: "fam-1", playdate_enabled: true },
    error: null,
  });
});

afterEach(() => cleanup());

describe("FriendPlaydatePanel", () => {
  it("패널 헤더 렌더 (loading → ready)", async () => {
    render(<FriendPlaydatePanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "친구놀이" }),
      ).toBeInTheDocument();
    });
  });

  it("toggle ON 상태일 때 active session 카드 표시", async () => {
    fetchActiveSession.mockResolvedValueOnce({
      id: "sess-1",
      place_name: "한강공원",
      friend_child_name: "지민",
      friend_family_phones: ["010-1111-2222"],
    });
    render(<FriendPlaydatePanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => {
      expect(screen.getByText(/지민/)).toBeInTheDocument();
    });
  });

  it("toggle OFF 상태에서도 안전장소 설정은 표시", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "fam-1", playdate_enabled: false },
      error: null,
    });
    render(<FriendPlaydatePanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "친구놀이" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/친구놀이 안전장소/)).toBeInTheDocument();
  });

  it("playdate_enabled 값이 없으면 기본 허용으로 표시", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "fam-1" },
      error: null,
    });
    render(<FriendPlaydatePanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => {
      expect(screen.getByRole("switch", { name: /친구놀이 기능/ })).toHaveAttribute("aria-checked", "true");
    });
    expect(screen.getByText(/친구놀이 안전장소/)).toBeInTheDocument();
  });

  it("loading 상태 표시 후 ready 전환", async () => {
    let resolvePlaces;
    fetchSavedPlaces.mockReturnValueOnce(
      new Promise((r) => {
        resolvePlaces = r;
      }),
    );
    render(<FriendPlaydatePanel familyId="fam-1" currentUserId="u-1" />);
    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument();
    resolvePlaces([]);
    await waitFor(() => {
      expect(screen.queryByText(/불러오는 중/)).not.toBeInTheDocument();
    });
  });

  it("familyId 없으면 fetch 안 함", () => {
    render(<FriendPlaydatePanel familyId={null} currentUserId="u-1" />);
    expect(fetchSavedPlaces).not.toHaveBeenCalled();
    expect(fetchActiveSession).not.toHaveBeenCalled();
  });
});
