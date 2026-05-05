// tests/unit/ChildHero.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChildHero } from "../../src/components/childMode/ChildHero.jsx";

describe("ChildHero — copy 분기", () => {
    const fixedNow = new Date(2026, 4, 5, 14, 30);

    it("0개 일정 → 자유시간 copy", () => {
        render(<ChildHero eventCount={0} now={fixedNow} />);
        expect(screen.getByText("오늘은 자유시간!")).toBeInTheDocument();
        expect(screen.getByText(/마음껏 놀아도 돼/)).toBeInTheDocument();
    });

    it("1개 → 1개 일정 있어 copy", () => {
        render(<ChildHero eventCount={1} now={fixedNow} />);
        expect(screen.getByText(/1개 일정 있어/)).toBeInTheDocument();
    });

    it("2개 이상 → 오늘 뭐 해? + N개 표시", () => {
        render(<ChildHero eventCount={3} now={fixedNow} />);
        expect(screen.getByText("오늘 뭐 해?")).toBeInTheDocument();
        expect(screen.getByText(/3개 일정 있어/)).toBeInTheDocument();
    });

    it("현재 시각 표시", () => {
        render(<ChildHero eventCount={0} now={fixedNow} />);
        expect(screen.getByText(/오후 2시 30분/)).toBeInTheDocument();
    });

    it("showMascot=false 시 mascot 미렌더", () => {
        const { container } = render(<ChildHero eventCount={0} showMascot={false} now={fixedNow} />);
        expect(container.querySelector('.child-hero-mascot')).toBeNull();
    });

    it("onSettings 핸들러가 ⚙ 클릭 시 호출됨", () => {
        const onSettings = vi.fn();
        render(<ChildHero eventCount={0} onSettings={onSettings} now={fixedNow} />);
        fireEvent.click(screen.getByLabelText("설정"));
        expect(onSettings).toHaveBeenCalledTimes(1);
    });
});
