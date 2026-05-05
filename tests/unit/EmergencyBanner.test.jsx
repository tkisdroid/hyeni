// tests/unit/EmergencyBanner.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EmergencyBanner } from "../../src/components/banners/EmergencyBanner.jsx";

describe("EmergencyBanner", () => {
    const sampleEm = {
        id: "em1",
        emoji: "📚",
        title: "영어학원",
        time: "15:00",
        location: "강남구 역삼동",
    };

    it("emergencies 비면 미렌더", () => {
        const { container } = render(<EmergencyBanner emergencies={[]} onDismiss={() => {}} />);
        expect(container.firstChild).toBeNull();
    });

    it("긴급 알림 카피 + emoji + title + time + location 표시", () => {
        render(<EmergencyBanner emergencies={[sampleEm]} onDismiss={() => {}} />);
        expect(screen.getByText("긴급 알림")).toBeInTheDocument();
        expect(screen.getByText("📚")).toBeInTheDocument();
        expect(screen.getByText("영어학원")).toBeInTheDocument();
        expect(screen.getByText(/15:00/)).toBeInTheDocument();
        expect(screen.getByText("강남구 역삼동")).toBeInTheDocument();
    });

    it("'전화' 버튼 → onDismiss(id, 'contact')", () => {
        const onDismiss = vi.fn();
        render(<EmergencyBanner emergencies={[sampleEm]} onDismiss={onDismiss} />);
        fireEvent.click(screen.getByText(/아이에게 전화/));
        expect(onDismiss).toHaveBeenCalledWith("em1", "contact");
    });

    it("'확인했어요' 버튼 → onDismiss(id, 'ok')", () => {
        const onDismiss = vi.fn();
        render(<EmergencyBanner emergencies={[sampleEm]} onDismiss={onDismiss} />);
        fireEvent.click(screen.getByText("확인했어요"));
        expect(onDismiss).toHaveBeenCalledWith("em1", "ok");
    });

    it("emergencies 배열의 첫 항목만 렌더", () => {
        const second = { ...sampleEm, id: "em2", title: "다른 학원" };
        render(<EmergencyBanner emergencies={[sampleEm, second]} onDismiss={() => {}} />);
        expect(screen.getByText("영어학원")).toBeInTheDocument();
        expect(screen.queryByText("다른 학원")).toBeNull();
    });

    it("학부모 안내 문구 표시", () => {
        render(<EmergencyBanner emergencies={[sampleEm]} onDismiss={() => {}} />);
        expect(screen.getByText(/학부모님, 확인이 필요해요!/)).toBeInTheDocument();
        expect(screen.getByText(/5분 후 시작인데 아직 미도착!/)).toBeInTheDocument();
    });
});
