import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SavedPlacesSection from "../../src/components/place-management/SavedPlacesSection.jsx";

describe("SavedPlacesSection", () => {
    it("섹션 헤더 + 부제 노출 (보조 위계)", () => {
        render(<SavedPlacesSection list={[]} />);
        expect(screen.getByText(/자주 가는 장소 \(0\)/)).toBeInTheDocument();
        expect(screen.getByText(/집·도서관처럼 일정과 길찾기에 자주 쓰는 장소/)).toBeInTheDocument();
    });

    it("빈 상태 → 안전장소 추가 칩 강조", () => {
        const onAddSafe = vi.fn();
        render(<SavedPlacesSection list={[]} onAddSafe={onAddSafe} />);
        const safeBtn = screen.getByRole("button", { name: "안전장소 추가" });
        fireEvent.click(safeBtn);
        expect(onAddSafe).toHaveBeenCalled();
    });

    it("자주가는 장소 + 안전장소 칩 모두 렌더", () => {
        const list = [
            { id: "p1", name: "집", is_playdate_safe: false },
            { id: "p2", name: "학교", is_playdate_safe: true },
        ];
        render(<SavedPlacesSection list={list} />);
        expect(screen.getByText("집")).toBeInTheDocument();
        expect(screen.getByText("학교")).toBeInTheDocument();
        expect(screen.getByText(/자주 가는 장소 \(2\)/)).toBeInTheDocument();
    });

    it("locked=true → '+ 장소' 버튼 회색화 + '유료에서 무제한' 카피", () => {
        render(<SavedPlacesSection list={[]} locked={true} />);
        expect(screen.getByText(/유료에서 무제한 — 안전장소는 무료에서도/)).toBeInTheDocument();
    });

    it("칩 이름 클릭 → onEdit(idx), ✕ 클릭 → onRemove(idx)", () => {
        const onEdit = vi.fn();
        const onRemove = vi.fn();
        const list = [{ id: "p1", name: "집", is_playdate_safe: false }];
        render(<SavedPlacesSection list={list} onEdit={onEdit} onRemove={onRemove} />);
        fireEvent.click(screen.getByLabelText("집 수정"));
        fireEvent.click(screen.getByLabelText("집 삭제"));
        expect(onEdit).toHaveBeenCalledWith(0);
        expect(onRemove).toHaveBeenCalledWith(0);
    });

    it("'+ 장소' 헤더 버튼 → onAddNew()", () => {
        const onAddNew = vi.fn();
        render(<SavedPlacesSection list={[]} onAddNew={onAddNew} />);
        fireEvent.click(screen.getByLabelText("자주 가는 장소 추가"));
        expect(onAddNew).toHaveBeenCalled();
    });
});
