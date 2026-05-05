import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DangerCard from "../../src/components/place-management/DangerCard.jsx";

const TYPES = [
    { id: "construction", label: "공사장", emoji: "🚧", color: "#D17600" },
    { id: "water", label: "수변지역", emoji: "🌊", color: "#3B82F6" },
    { id: "custom", label: "직접 설정", emoji: "⚠️", color: "#D17600" },
];

describe("DangerCard", () => {
    it("타이틀과 가치 메시지가 '조심할 곳' 라벨로 표시 (위험장소 X)", () => {
        render(<DangerCard list={[]} dangerTypes={TYPES} />);
        expect(screen.getByText("조심할 곳")).toBeInTheDocument();
        expect(screen.getByText("아이가 근접 시 알림을 드려요")).toBeInTheDocument();
        expect(screen.queryByText(/위험장소/)).not.toBeInTheDocument();
    });

    it("빈 상태 카피: 공사장·큰길 안내 노출", () => {
        render(<DangerCard list={[]} dangerTypes={TYPES} />);
        expect(screen.getByText(/공사장·큰길 같은 곳을 등록하면/)).toBeInTheDocument();
    });

    it("'+ 조심할 곳' 버튼 클릭 → onAddNew() (locked=false)", () => {
        const onAddNew = vi.fn();
        render(<DangerCard list={[]} dangerTypes={TYPES} onAddNew={onAddNew} />);
        fireEvent.click(screen.getByText("+ 조심할 곳"));
        expect(onAddNew).toHaveBeenCalled();
    });

    it("locked=true → 자물쇠 + '유료에서 무제한' 카피", () => {
        render(<DangerCard list={[]} dangerTypes={TYPES} locked={true} />);
        expect(screen.getByLabelText("유료에서 무제한")).toBeInTheDocument();
        expect(screen.getByText("유료에서 무제한")).toBeInTheDocument();
    });

    it("등록된 zone 렌더 + 타입 라벨 + 반경 + 삭제 콜백", () => {
        const onRemove = vi.fn();
        const zone = { id: "z1", name: "공사장 앞", lat: 37.5, lng: 127, radius_m: 200, zone_type: "construction" };
        render(<DangerCard list={[zone]} dangerTypes={TYPES} onRemove={onRemove} />);
        expect(screen.getByText("공사장 앞")).toBeInTheDocument();
        expect(screen.getByText(/공사장 · 반경 200m/)).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("공사장 앞 삭제"));
        expect(onRemove).toHaveBeenCalledWith(zone);
    });

    it("amber 토큰 사용 (--status-cautionary-subtle, 빨강 금지)", () => {
        const { container } = render(<DangerCard list={[]} dangerTypes={TYPES} />);
        const card = container.querySelector(".card");
        expect(card?.style.background).toContain("--status-cautionary-subtle");
    });
});
