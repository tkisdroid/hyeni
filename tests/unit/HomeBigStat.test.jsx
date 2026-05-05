// tests/unit/HomeBigStat.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeBigStat, pickNextEvent, formatTimeLabel } from "../../src/components/multichild/HomeDashboard/HomeBigStat.jsx";

describe("HomeBigStat — pickNextEvent", () => {
    it("현재 이후의 가장 가까운 이벤트 반환", () => {
        const now = new Date(2026, 4, 5, 14, 0); // 14:00
        const events = [
            { id: 1, time: "10:00", title: "morning" },
            { id: 2, time: "15:30", title: "next" },
            { id: 3, time: "17:00", title: "later" },
        ];
        expect(pickNextEvent(events, now)?.id).toBe(2);
    });

    it("미래 이벤트가 없으면 null", () => {
        const now = new Date(2026, 4, 5, 18, 0);
        const events = [{ id: 1, time: "10:00", title: "past" }];
        expect(pickNextEvent(events, now)).toBeNull();
    });

    it("빈 배열이면 null", () => {
        expect(pickNextEvent([], new Date())).toBeNull();
    });

    it("시간 형식 잘못된 항목은 무시", () => {
        const now = new Date(2026, 4, 5, 9, 0);
        const events = [
            { id: 1, time: "invalid" },
            { id: 2, time: "10:00", title: "valid" },
        ];
        expect(pickNextEvent(events, now)?.id).toBe(2);
    });
});

describe("HomeBigStat — formatTimeLabel", () => {
    it("오전/오후 분기", () => {
        expect(formatTimeLabel("09:00")).toBe("오전 9시");
        expect(formatTimeLabel("13:30")).toBe("오후 1시 30분");
    });

    it("자정은 오전 12시", () => {
        expect(formatTimeLabel("00:00")).toBe("오전 12시");
    });
});

describe("HomeBigStat — render", () => {
    it("다음 일정 있을 때 시간 + 제목 표시", () => {
        const now = new Date(2026, 4, 5, 14, 0); // 화요일 5/5
        render(<HomeBigStat events={[{ id: 1, time: "16:00", title: "영어학원" }]} now={now} />);
        expect(screen.getByText(/영어학원/)).toBeInTheDocument();
        expect(screen.getByText(/오후 4시/)).toBeInTheDocument();
    });

    it("다음 일정 없을 때 빈 상태 메시지", () => {
        const now = new Date(2026, 4, 5, 23, 0);
        render(<HomeBigStat events={[]} now={now} />);
        expect(screen.getByText(/오늘 일정 마무리/)).toBeInTheDocument();
    });

    it("요일/날짜 hero 표시", () => {
        const now = new Date(2026, 4, 5, 12, 0); // 화요일
        render(<HomeBigStat events={[]} now={now} />);
        expect(screen.getByText("화요일")).toBeInTheDocument();
        expect(screen.getByText("5월 5일")).toBeInTheDocument();
    });
});
