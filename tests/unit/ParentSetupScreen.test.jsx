// tests/unit/ParentSetupScreen.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ParentSetupScreen } from "../../src/components/auth/ParentSetupScreen.jsx";

describe("ParentSetupScreen", () => {
    it("초기 상태: '새 가족 만들기' + '기존 가족에 합류' 버튼", () => {
        render(<ParentSetupScreen onCreateFamily={() => {}} onJoinAsParent={() => {}} />);
        expect(screen.getByText("가족 연결을 시작해요")).toBeInTheDocument();
        expect(screen.getByText("새 가족 만들기")).toBeInTheDocument();
        expect(screen.getByText("기존 가족에 합류")).toBeInTheDocument();
    });

    it("'새 가족 만들기' 클릭 → create 모드로 진입", () => {
        render(<ParentSetupScreen onCreateFamily={() => {}} onJoinAsParent={() => {}} />);
        fireEvent.click(screen.getByText("새 가족 만들기"));
        expect(screen.getByText(/연동코드가 생성됩니다/)).toBeInTheDocument();
        expect(screen.getByText("가족 만들기")).toBeInTheDocument();
    });

    it("'기존 가족에 합류' 클릭 → join 모드, 코드 input 표시", () => {
        render(<ParentSetupScreen onCreateFamily={() => {}} onJoinAsParent={() => {}} />);
        fireEvent.click(screen.getByText("기존 가족에 합류"));
        expect(screen.getByPlaceholderText(/KID-/)).toBeInTheDocument();
    });

    it("create 모드에서 '가족 만들기' 클릭 시 onCreateFamily 호출", async () => {
        const onCreateFamily = vi.fn().mockResolvedValue();
        render(<ParentSetupScreen onCreateFamily={onCreateFamily} onJoinAsParent={() => {}} />);
        fireEvent.click(screen.getByText("새 가족 만들기"));
        fireEvent.click(screen.getByText("가족 만들기"));
        expect(onCreateFamily).toHaveBeenCalledTimes(1);
    });

    it("join 모드에서 빈 코드로 '합류하기' 비활성화", () => {
        render(<ParentSetupScreen onCreateFamily={() => {}} onJoinAsParent={() => {}} />);
        fireEvent.click(screen.getByText("기존 가족에 합류"));
        expect(screen.getByText("합류하기")).toBeDisabled();
    });

    it("유효한 코드 입력 시 '합류하기' 활성화 + 클릭 시 onJoinAsParent 호출", async () => {
        const onJoinAsParent = vi.fn().mockResolvedValue();
        render(<ParentSetupScreen onCreateFamily={() => {}} onJoinAsParent={onJoinAsParent} />);
        fireEvent.click(screen.getByText("기존 가족에 합류"));
        const input = screen.getByPlaceholderText(/KID-/);
        fireEvent.change(input, { target: { value: "KID-ABCD1234" } });
        const submit = screen.getByText("합류하기");
        expect(submit).not.toBeDisabled();
        fireEvent.click(submit);
        expect(onJoinAsParent).toHaveBeenCalledWith("KID-ABCD1234");
    });

    it("뒤로 클릭 시 모드 리셋", () => {
        render(<ParentSetupScreen onCreateFamily={() => {}} onJoinAsParent={() => {}} />);
        fireEvent.click(screen.getByText("기존 가족에 합류"));
        expect(screen.queryByText("새 가족 만들기")).toBeNull();
        fireEvent.click(screen.getByText("← 뒤로"));
        expect(screen.getByText("새 가족 만들기")).toBeInTheDocument();
    });
});
