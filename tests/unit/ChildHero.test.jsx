// tests/unit/ChildHero.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChildHero } from "../../src/components/childMode/ChildHero.jsx";

describe("ChildHero — copy 분기", () => {
    const fixedNow = new Date(2026, 4, 5, 14, 30);

    it("0개 일정 → 혜니가 함께 챙기는 친근한 copy", () => {
        render(<ChildHero eventCount={0} now={fixedNow} />);
        expect(screen.getByRole("region", { name: "아이 홈 요약" })).toBeInTheDocument();
        expect(screen.getByText("오늘은 여유 있어요")).toBeInTheDocument();
        expect(screen.getByText(/혜니가 일정이 생기면 바로 알려줄게요/)).toBeInTheDocument();
    });

    it("1개 → 오늘 일정 1개 copy", () => {
        render(<ChildHero eventCount={1} now={fixedNow} />);
        expect(screen.getByText("오늘 일정 1개")).toBeInTheDocument();
        expect(screen.getByText(/천천히 같이 챙겨요/)).toBeInTheDocument();
    });

    it("2개 이상 → 오늘 일정 N개 표시", () => {
        render(<ChildHero eventCount={3} now={fixedNow} />);
        expect(screen.getByText("오늘 일정 3개")).toBeInTheDocument();
        expect(screen.getByText(/하나씩 같이 챙겨요/)).toBeInTheDocument();
    });

    it("현재 시각 표시", () => {
        render(<ChildHero eventCount={0} now={fixedNow} />);
        expect(screen.getByText(/오후 2시 30분/)).toBeInTheDocument();
    });

    it("showMascot=false 시 mascot 미렌더", () => {
        const { container } = render(<ChildHero eventCount={0} showMascot={false} now={fixedNow} />);
        expect(container.querySelector('.child-hero-mascot')).toBeNull();
    });

    it("홈 hero에서 혜니 캐릭터를 크게 표시", () => {
        render(<ChildHero eventCount={0} now={fixedNow} />);
        expect(screen.getByAltText("혜니")).toHaveAttribute("width", "148");
    });

    it("onSettings 핸들러가 ⚙ 클릭 시 호출됨", () => {
        const onSettings = vi.fn();
        render(<ChildHero eventCount={0} onSettings={onSettings} now={fixedNow} />);
        fireEvent.click(screen.getByLabelText("설정"));
        expect(onSettings).toHaveBeenCalledTimes(1);
    });
});
