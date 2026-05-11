// tests/unit/PlaceManagerScreen.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlaceManagerScreen } from "../../src/components/settings/PlaceManagerScreen.jsx";

describe("PlaceManagerScreen", () => {
    it("4 카테고리 헤더 모두 표시 (집·학원·자주 가는 곳·조심할 곳)", () => {
        render(
            <PlaceManagerScreen
                onBack={() => {}}
                savedPlaces={[]}
                academies={[]}
                dangerZones={[]}
            />
        );
        expect(screen.getByText("집")).toBeInTheDocument();
        expect(screen.getByText("학원")).toBeInTheDocument();
        expect(screen.getByText("자주 가는 곳")).toBeInTheDocument();
        expect(screen.getByText("조심할 곳")).toBeInTheDocument();
    });

    it("카테고리별 갯수 표시", () => {
        render(
            <PlaceManagerScreen
                onBack={() => {}}
                savedPlaces={[{ id: "h", name: "우리집", is_home: true }]}
                academies={[{ id: "a1", name: "영어학원" }, { id: "a2", name: "수학학원" }]}
                dangerZones={[{ id: "d1", name: "공사장" }]}
            />
        );
        const numbers = screen.getAllByText(/^[0-9]+$/);
        const counts = numbers.map((n) => n.textContent);
        expect(counts).toContain("1"); // home
        expect(counts).toContain("2"); // academies
    });

    it("뒤로 버튼 클릭 시 onBack 호출", () => {
        const onBack = vi.fn();
        render(<PlaceManagerScreen onBack={onBack} savedPlaces={[]} academies={[]} dangerZones={[]} />);
        fireEvent.click(screen.getByLabelText("뒤로"));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("조심할 곳 헤더에 data-caution=true 적용", () => {
        const { container } = render(
            <PlaceManagerScreen onBack={() => {}} savedPlaces={[]} academies={[]} dangerZones={[]} />
        );
        const headers = container.querySelectorAll('.place-section-head[data-caution="true"]');
        expect(headers.length).toBeGreaterThanOrEqual(1);
    });

    it("default 열린 섹션이 학원 (academy)", () => {
        render(
            <PlaceManagerScreen
                onBack={() => {}}
                savedPlaces={[]}
                academies={[{ id: "a1", name: "테니스" }]}
                dangerZones={[]}
            />
        );
        // academy 섹션이 펼쳐져 있어 안의 항목명이 보임
        expect(screen.getByText("테니스")).toBeInTheDocument();
    });
});
