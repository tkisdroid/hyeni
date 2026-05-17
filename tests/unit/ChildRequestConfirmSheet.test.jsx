// tests/unit/ChildRequestConfirmSheet.test.jsx
// 자녀 설정 변경 요청 확인 시트 (Phase 2).
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChildRequestConfirmSheet } from "../../src/components/childMode/ChildRequestConfirmSheet.jsx";

afterEach(() => {
    cleanup();
});

describe("ChildRequestConfirmSheet", () => {
    it("open=false면 아무것도 렌더하지 않는다", () => {
        const { container } = render(
            <ChildRequestConfirmSheet open={false} menuKey="theme" onConfirm={() => {}} onClose={() => {}} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("menuKey가 없으면 렌더하지 않는다", () => {
        const { container } = render(
            <ChildRequestConfirmSheet open menuKey={null} onConfirm={() => {}} onClose={() => {}} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("열리면 메뉴 라벨 질문과 버튼을 보여준다", () => {
        render(<ChildRequestConfirmSheet open menuKey="theme" onConfirm={() => {}} onClose={() => {}} />);
        expect(screen.getByText(/테마 색깔 바꾸고 싶어/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "요청 보내기" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    });

    it("요청 보내기 클릭 시 onConfirm 호출", () => {
        const onConfirm = vi.fn();
        render(<ChildRequestConfirmSheet open menuKey="character" onConfirm={onConfirm} onClose={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: "요청 보내기" }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("취소 클릭 시 onClose 호출", () => {
        const onClose = vi.fn();
        render(<ChildRequestConfirmSheet open menuKey="sound" onConfirm={() => {}} onClose={onClose} />);
        fireEvent.click(screen.getByRole("button", { name: "취소" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("busy=true면 버튼이 비활성화되고 전송 중 라벨을 보여준다", () => {
        const onConfirm = vi.fn();
        const onClose = vi.fn();
        render(
            <ChildRequestConfirmSheet open menuKey="mascot" busy onConfirm={onConfirm} onClose={onClose} />,
        );
        const confirmBtn = screen.getByRole("button", { name: "보내는 중…" });
        expect(confirmBtn).toBeDisabled();
        fireEvent.click(confirmBtn);
        fireEvent.click(screen.getByRole("button", { name: "취소" }));
        expect(onConfirm).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });
});
