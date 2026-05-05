import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AcademyCard from "../../src/components/place-management/AcademyCard.jsx";

const PRESETS = [
    { label: "영어학원", emoji: "🔤", category: "language" },
    { label: "수학학원", emoji: "🔢", category: "study" },
];
const CATEGORIES = [
    { id: "language", label: "어학", color: "#FF8C42", bg: "#FFF4EA" },
    { id: "study", label: "공부", color: "#4F46E5", bg: "#EEF2FF" },
];
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

describe("AcademyCard", () => {
    it("빈 상태에서 가치 메시지 + 프리셋 칩 렌더", () => {
        render(<AcademyCard list={[]} presets={PRESETS} categories={CATEGORIES} daysLabel={DAYS} />);
        expect(screen.getByText("학원·일정 관리")).toBeInTheDocument();
        expect(screen.getByText("일정이 자동으로 캘린더에 들어와요")).toBeInTheDocument();
        expect(screen.getByText(/학원·자녀 활동을 등록하면/)).toBeInTheDocument();
        expect(screen.getByText(/영어학원/)).toBeInTheDocument();
        expect(screen.getByText(/수학학원/)).toBeInTheDocument();
    });

    it("프리셋 클릭 → onAddPreset(preset)", () => {
        const onAddPreset = vi.fn();
        render(<AcademyCard list={[]} presets={PRESETS} categories={CATEGORIES} daysLabel={DAYS} onAddPreset={onAddPreset} />);
        fireEvent.click(screen.getByText(/영어학원/));
        expect(onAddPreset).toHaveBeenCalledWith(PRESETS[0]);
    });

    it("등록된 학원 list 렌더 + 카테고리 라벨 + 요일/시간", () => {
        const list = [{
            name: "혜니영어",
            category: "language",
            emoji: "🔤",
            schedule: { days: [1, 3], startTime: "15:00", endTime: "16:00", repeatWeeks: 4 },
        }];
        render(<AcademyCard list={list} presets={PRESETS} categories={CATEGORIES} daysLabel={DAYS} />);
        expect(screen.getByText("혜니영어")).toBeInTheDocument();
        expect(screen.getByText("어학")).toBeInTheDocument();
        expect(screen.getByText(/월, 수 15:00~16:00/)).toBeInTheDocument();
    });

    it("'+ 학원' 버튼 클릭 → onAddNew()", () => {
        const onAddNew = vi.fn();
        render(<AcademyCard list={[]} presets={PRESETS} categories={CATEGORIES} daysLabel={DAYS} onAddNew={onAddNew} />);
        fireEvent.click(screen.getByText("+ 학원"));
        expect(onAddNew).toHaveBeenCalled();
    });

    it("수정/삭제 버튼은 list 항목에만 노출 + 콜백 인덱스 전달", () => {
        const onEdit = vi.fn();
        const onRemove = vi.fn();
        const list = [{ name: "혜니영어", category: "language", emoji: "🔤" }];
        render(<AcademyCard list={list} presets={PRESETS} categories={CATEGORIES} daysLabel={DAYS} onEdit={onEdit} onRemove={onRemove} />);
        fireEvent.click(screen.getByLabelText("혜니영어 수정"));
        fireEvent.click(screen.getByLabelText("혜니영어 삭제"));
        expect(onEdit).toHaveBeenCalledWith(0);
        expect(onRemove).toHaveBeenCalledWith(0);
    });
});
