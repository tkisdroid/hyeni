// tests/unit/ChildSummaryCard.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChildSummaryCard } from "../../src/components/multichild/HomeDashboard/ChildSummaryCard.jsx";

const child = { user_id: "c1", name: "혜니", color_hex: "#F779A8", photo_url: "https://test/h.jpg" };

describe("ChildSummaryCard", () => {
  it("이름과 사진 표시", () => {
    render(<ChildSummaryCard child={child} location="학교" safetyDots={["green","green","green"]} />);
    expect(screen.getByText("혜니")).toBeInTheDocument();
  });

  it("위치 텍스트 표시", () => {
    render(<ChildSummaryCard child={child} location="학교" safetyDots={[]} />);
    expect(screen.getByText("학교")).toBeInTheDocument();
  });

  it("위치 누락 시 placeholder", () => {
    render(<ChildSummaryCard child={child} location={null} safetyDots={[]} />);
    expect(screen.getByText(/위치 확인/i)).toBeInTheDocument();
  });

  it("safety dots 개수 렌더링", () => {
    const { container } = render(
      <ChildSummaryCard child={child} location="학교" safetyDots={["green","yellow","red"]} />
    );
    expect(container.querySelectorAll("[data-safety-dot]")).toHaveLength(3);
  });
});
