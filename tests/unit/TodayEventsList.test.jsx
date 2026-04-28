// tests/unit/TodayEventsList.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayEventsList } from "../../src/components/multichild/HomeDashboard/TodayEventsList.jsx";

const children = [
  { user_id: "c1", name: "혜니", color_hex: "#F779A8" },
  { user_id: "c2", name: "민준", color_hex: "#3B82F6" },
];

const events = [
  { id: "e1", title: "학원", time: "15:00", child_ids: ["c1"], is_family_event: false },
  { id: "e2", title: "저녁 식사", time: "19:00", child_ids: [], is_family_event: true },
];

describe("TodayEventsList", () => {
  it("일정 제목과 시간 표시", () => {
    render(<TodayEventsList events={events} children={children} />);
    expect(screen.getByText("학원")).toBeInTheDocument();
    expect(screen.getByText("15:00")).toBeInTheDocument();
  });

  it("자녀 이벤트는 자녀 색 vertical line", () => {
    const { container } = render(<TodayEventsList events={events} children={children} />);
    const learn = container.querySelector('[data-event-id="e1"]');
    expect(learn.style.borderLeftColor).toContain("rgb(247, 121, 168)");
  });

  it("가족 이벤트는 dashed border", () => {
    const { container } = render(<TodayEventsList events={events} children={children} />);
    const dinner = container.querySelector('[data-event-id="e2"]');
    expect(dinner.style.borderLeftStyle).toBe("dashed");
  });

  it("일정 없으면 placeholder", () => {
    render(<TodayEventsList events={[]} children={children} />);
    expect(screen.getByText(/오늘 일정이 없어요/)).toBeInTheDocument();
  });
});
