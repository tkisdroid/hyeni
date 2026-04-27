import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";

vi.mock("../src/lib/friendPlaydate.js", () => ({
  findCandidates: vi.fn(),
  startPlaydate: vi.fn(),
  fetchActiveSession: vi.fn(),
  subscribeActiveSession: vi.fn(() => () => {}),
  endPlaydate: vi.fn(),
}));

import FriendPlaydateChildPanel from "../src/components/friendPlaydate/FriendPlaydateChildPanel.jsx";
import {
  findCandidates,
  startPlaydate,
  fetchActiveSession,
} from "../src/lib/friendPlaydate.js";

beforeEach(() => {
  vi.clearAllMocks();
  fetchActiveSession.mockResolvedValue(null);
});

afterEach(() => cleanup());

describe("FriendPlaydateChildPanel", () => {
  it("초기 — 안전장소 안: PlaydateStartButton 활성화", async () => {
    findCandidates.mockResolvedValueOnce({
      candidates: [],
      public_place_id: "p-1",
    });
    render(<FriendPlaydateChildPanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /친구랑 놀래요/ }),
      ).not.toBeDisabled();
    });
  });

  it("not_in_safe_place → 버튼 disabled", async () => {
    findCandidates.mockResolvedValueOnce({
      candidates: [],
      error: "not_in_safe_place",
    });
    render(<FriendPlaydateChildPanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /친구랑 놀래요/ }),
      ).toBeDisabled();
    });
  });

  it("버튼 클릭 → 후보 fetch → CandidateList 표시", async () => {
    findCandidates
      .mockResolvedValueOnce({ candidates: [], public_place_id: "p-1" })
      .mockResolvedValueOnce({
        candidates: [
          {
            family_id: "fam-2",
            child_user_id: "u-2",
            child_name: "지민",
            public_place_id: "p-1",
          },
        ],
        public_place_id: "p-1",
      });
    render(<FriendPlaydateChildPanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /친구랑 놀래요/ }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /친구랑 놀래요/ }));
    await waitFor(() =>
      expect(screen.getByLabelText(/지민/)).toBeInTheDocument(),
    );
  });

  it("active session 있으면 ActivePlaydateChildView 표시", async () => {
    fetchActiveSession.mockResolvedValueOnce({
      id: "s1",
      friend_child_name: "지민",
      started_at: "2026-04-27T14:32:00Z",
    });
    render(<FriendPlaydateChildPanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /그만 놀래요/ }),
      ).toBeInTheDocument(),
    );
  });

  it("familyId 없으면 fetch 안 함", () => {
    render(<FriendPlaydateChildPanel familyId={null} currentUserId="u-1" />);
    expect(findCandidates).not.toHaveBeenCalled();
    expect(fetchActiveSession).not.toHaveBeenCalled();
  });

  it("startPlaydate 호출 후 active로 전환", async () => {
    findCandidates
      .mockResolvedValueOnce({ candidates: [], public_place_id: "p-1" })
      .mockResolvedValueOnce({
        candidates: [
          {
            family_id: "fam-2",
            child_user_id: "u-2",
            child_name: "지민",
            public_place_id: "p-1",
          },
        ],
        public_place_id: "p-1",
      });
    startPlaydate.mockResolvedValueOnce({ session_id: "s1", delivered: true });
    fetchActiveSession
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "s1",
        friend_child_name: "지민",
        started_at: "2026-04-27T14:32:00Z",
      });
    render(<FriendPlaydateChildPanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /친구랑 놀래요/ }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /친구랑 놀래요/ }));
    await waitFor(() =>
      expect(screen.getByLabelText(/지민/)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByLabelText(/지민/));
    fireEvent.click(
      screen.getByRole("button", { name: /친구랑 놀래요 시작/ }),
    );
    await waitFor(() =>
      expect(startPlaydate).toHaveBeenCalledWith(
        expect.objectContaining({
          publicPlaceId: "p-1",
          familyAId: "fam-1",
          familyBId: "fam-2",
          childAId: "u-1",
          childBId: "u-2",
          initiatorUserId: "u-1",
        }),
      ),
    );
  });
});
