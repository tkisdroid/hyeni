// tests/unit/ChildSummaryCard.test.jsx
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChildSummaryCard } from "../../src/components/multichild/HomeDashboard/ChildSummaryCard.jsx";

const child = { user_id: "c1", name: "혜니", color_hex: "#F779A8", photo_url: "https://test/h.jpg" };

describe("ChildSummaryCard", () => {
  it("이름과 사진 표시", () => {
    render(<ChildSummaryCard child={child} location="학교" safetyDots={["green","green","green"]} />);
    expect(screen.getByText("혜니")).toBeInTheDocument();
  });

  it("프로필 사진은 로딩 중 fallback을 유지하고 로드 성공 후 이미지를 표시", () => {
    const { container } = render(<ChildSummaryCard child={child} location="학교" safetyDots={[]} />);
    const avatar = screen.getByRole("img", { name: "혜니 프로필" });
    const image = container.querySelector("img");

    expect(avatar).toHaveAttribute("data-avatar-state", "loading");
    expect(image).toHaveAttribute("src", child.photo_url);

    fireEvent.load(image);
    expect(avatar).toHaveAttribute("data-avatar-state", "loaded");
  });

  it("프로필 사진 로드 실패 시 색상 기반 fallback으로 복구", () => {
    const { container } = render(<ChildSummaryCard child={child} location="학교" safetyDots={[]} />);
    const avatar = screen.getByRole("img", { name: "혜니 프로필" });
    const image = container.querySelector("img");

    fireEvent.error(image);
    expect(avatar).toHaveAttribute("data-avatar-state", "fallback");
    expect(container.querySelector(`img[src="${child.photo_url}"]`)).not.toBeInTheDocument();
  });

  it("위치 텍스트 표시", () => {
    render(<ChildSummaryCard child={child} location="학교" safetyDots={[]} />);
    expect(screen.getByText(/학교/)).toBeInTheDocument();
  });

  it("다자녀 홈 위치는 시도와 시를 빼고 구동 중심으로 표시", () => {
    const { rerender } = render(<ChildSummaryCard child={child} location="서울특별시 강남구 역삼동 테헤란로 123" safetyDots={[]} />);

    expect(screen.getByText(/강남구 역삼동 테헤란로 123/)).toBeInTheDocument();
    expect(screen.queryByText(/서울특별시/)).not.toBeInTheDocument();

    rerender(<ChildSummaryCard child={child} location="경기도 성남시 분당구 정자동 느티로 2" safetyDots={[]} />);
    expect(screen.getByText(/분당구 정자동 느티로 2/)).toBeInTheDocument();
    expect(screen.queryByText(/경기도/)).not.toBeInTheDocument();
    expect(screen.queryByText(/성남시/)).not.toBeInTheDocument();
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
