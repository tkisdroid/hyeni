// tests/unit/NextEventHero.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextEventHero } from "../../src/components/multichild/HomeDashboard/NextEventHero.jsx";

const children = [
  { id: "c1", user_id: "u1", name: "혜니", color_hex: "#F779A8" },
  { id: "c2", user_id: "u2", name: "민준", color_hex: "#3B82F6" },
];
const childLocations = {
  u1: { label: "경기 수원시 수지구 대지로51번길 6" },
  u2: { label: "동탄구 동탄대로 683" },
};

const fixedNow = new Date("2026-05-08T14:00:00");

describe("NextEventHero", () => {
  it("다음 일정 있을 때 시간 + 제목 + 자녀명 + 카운트다운 표시", () => {
    const events = [
      { id: "e1", title: "피아노", time: "14:30", child_ids: ["c1"], is_family_event: false },
    ];
    render(
      <NextEventHero events={events} children={children} childLocations={childLocations} now={fixedNow} />
    );
    expect(screen.getByText("다음 일정")).toBeInTheDocument();
    expect(screen.getByText(/오후 2시 30분/)).toBeInTheDocument();
    expect(screen.getByText("피아노")).toBeInTheDocument();
    expect(screen.getByText("혜니")).toBeInTheDocument();
    expect(screen.getByText("30분 후")).toBeInTheDocument();
  });

  it("다음 일정 없으면 마무리 문구 표시", () => {
    render(<NextEventHero events={[]} children={children} childLocations={childLocations} now={fixedNow} />);
    expect(screen.getByText(/오늘 일정 모두 마무리됐어요/)).toBeInTheDocument();
  });

  it("가족 이벤트는 '가족 전체' 라벨 + theme accent", () => {
    const events = [
      { id: "e2", title: "저녁 식사", time: "19:00", child_ids: [], is_family_event: true },
    ];
    render(
      <NextEventHero events={events} children={children} childLocations={childLocations} now={fixedNow} />
    );
    expect(screen.getByText("가족 전체")).toBeInTheDocument();
    expect(screen.getByText("저녁 식사")).toBeInTheDocument();
  });

  it("1시간 이상 남은 카운트다운 포맷", () => {
    const events = [
      { id: "e3", title: "태권도", time: "20:00", child_ids: ["c1"], is_family_event: false },
    ];
    render(
      <NextEventHero events={events} children={children} childLocations={childLocations} now={fixedNow} />
    );
    expect(screen.getByText("6시간 후")).toBeInTheDocument();
  });
});
