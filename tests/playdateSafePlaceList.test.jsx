import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("../src/lib/friendPlaydate.js", () => ({
  setSavedPlacePlaydateSafe: vi.fn(),
  upsertPublicPlace: vi.fn(),
}));

import {
  setSavedPlacePlaydateSafe,
  upsertPublicPlace,
} from "../src/lib/friendPlaydate.js";
import PlaydateSafePlaceList from "../src/components/friendPlaydate/PlaydateSafePlaceList.jsx";

describe("PlaydateSafePlaceList", () => {
  const places = [
    {
      id: "sp-1",
      name: "한강공원",
      location: { lat: 37.5, lng: 127.0, kakao_place_id: "k-1" },
      is_playdate_safe: false,
      public_place_id: null,
    },
    {
      id: "sp-2",
      name: "집",
      location: { lat: 37.6, lng: 127.1 },
      is_playdate_safe: true,
      public_place_id: "p-2",
    },
  ];

  beforeEach(() => {
    setSavedPlacePlaydateSafe.mockReset();
    upsertPublicPlace.mockReset();
    cleanup();
  });

  it("renders each place with toggle", () => {
    render(<PlaydateSafePlaceList places={places} onUpdate={vi.fn()} />);
    expect(screen.getByText("한강공원")).toBeInTheDocument();
    expect(screen.getByText("집")).toBeInTheDocument();
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    expect(switches[0]).toHaveAttribute("aria-checked", "false");
    expect(switches[1]).toHaveAttribute("aria-checked", "true");
  });

  it("empty state copy", () => {
    render(<PlaydateSafePlaceList places={[]} onUpdate={vi.fn()} />);
    expect(screen.getByText(/안전장소를 먼저 등록/)).toBeInTheDocument();
  });

  it("toggling ON — upserts public_place + calls setSavedPlacePlaydateSafe", async () => {
    upsertPublicPlace.mockResolvedValueOnce("p-1");
    setSavedPlacePlaydateSafe.mockResolvedValueOnce(undefined);
    const onUpdate = vi.fn();
    render(<PlaydateSafePlaceList places={places} onUpdate={onUpdate} />);
    fireEvent.click(screen.getAllByRole("switch")[0]);
    await waitFor(() => {
      expect(upsertPublicPlace).toHaveBeenCalledWith({
        kakaoPlaceId: "k-1",
        name: "한강공원",
        lat: 37.5,
        lng: 127.0,
      });
      expect(setSavedPlacePlaydateSafe).toHaveBeenCalledWith("sp-1", true, "p-1");
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it("toggling OFF — only setSavedPlacePlaydateSafe", async () => {
    setSavedPlacePlaydateSafe.mockResolvedValueOnce(undefined);
    render(<PlaydateSafePlaceList places={places} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("switch")[1]);
    await waitFor(() => {
      expect(setSavedPlacePlaydateSafe).toHaveBeenCalledWith("sp-2", false, null);
      expect(upsertPublicPlace).not.toHaveBeenCalled();
    });
  });

  it("kakao_place_id 없는 OFF 장소는 toggle disabled + hint 표시 (HIGH-1)", () => {
    const lockedPlaces = [
      {
        id: "sp-3",
        name: "동네공원",
        location: { lat: 37.5, lng: 127.0 },
        is_playdate_safe: false,
        public_place_id: null,
      },
    ];
    render(<PlaydateSafePlaceList places={lockedPlaces} onUpdate={vi.fn()} />);
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(
      screen.getByText(/카카오 장소 검색으로 등록된 곳만 지정 가능/),
    ).toBeInTheDocument();
  });
});
