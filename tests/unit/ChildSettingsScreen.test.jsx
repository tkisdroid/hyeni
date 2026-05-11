// tests/unit/ChildSettingsScreen.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChildSettingsScreen } from "../../src/components/childMode/ChildSettingsScreen.jsx";

describe("ChildSettingsScreen", () => {
    it("헤더 타이틀과 뒤로 버튼 렌더", () => {
        const onBack = vi.fn();
        const { container } = render(<ChildSettingsScreen onBack={onBack} />);
        expect(screen.getByText("설정")).toBeInTheDocument();
        expect(container.querySelectorAll(".hyeni-child-settings-row").length).toBeGreaterThanOrEqual(4);
        fireEvent.click(screen.getByLabelText("뒤로"));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("THEME_PALETTE 6 색 모두 picker로 노출", () => {
        render(<ChildSettingsScreen onBack={() => {}} />);
        // canonical 6 colors: 핑크/파랑/초록/노랑/보라/빨강
        ["핑크", "파랑", "초록", "노랑", "보라", "빨강"].forEach((label) => {
            expect(screen.getByLabelText(new RegExp(`^${label} 테마`))).toBeInTheDocument();
        });
    });

    it("테마 색 클릭 시 onChangeTheme(hex) 호출", () => {
        const onChangeTheme = vi.fn();
        render(<ChildSettingsScreen onBack={() => {}} onChangeTheme={onChangeTheme} />);
        fireEvent.click(screen.getByLabelText(/^파랑 테마/));
        expect(onChangeTheme).toHaveBeenCalledWith("#3B82F6");
    });

    it("themeLocked=true 시 picker disabled + 안내 문구", () => {
        const onChangeTheme = vi.fn();
        render(
            <ChildSettingsScreen
                onBack={() => {}}
                onChangeTheme={onChangeTheme}
                themeLocked
            />
        );
        expect(screen.getByText(/부모님이 잠궜어/)).toBeInTheDocument();
        const pinkBtn = screen.getByLabelText(/^핑크 테마/);
        expect(pinkBtn).toBeDisabled();
        fireEvent.click(pinkBtn);
        expect(onChangeTheme).not.toHaveBeenCalled();
    });

    it("currentTheme 일치 시 (선택됨) 라벨 표시", () => {
        render(<ChildSettingsScreen onBack={() => {}} currentTheme="#10B981" />);
        expect(screen.getByLabelText("초록 테마 (선택됨)")).toBeInTheDocument();
    });

    it("소리 토글 클릭 시 onChangeSound(!value) 호출", () => {
        const onChangeSound = vi.fn();
        render(
            <ChildSettingsScreen
                onBack={() => {}}
                soundEnabled
                onChangeSound={onChangeSound}
            />
        );
        fireEvent.click(screen.getByLabelText("소리·진동"));
        expect(onChangeSound).toHaveBeenCalledWith(false);
    });

    it("마스코트 토글 클릭 시 onChangeShowMascot(!value) 호출", () => {
        const onChangeShowMascot = vi.fn();
        render(
            <ChildSettingsScreen
                onBack={() => {}}
                showMascot={false}
                onChangeShowMascot={onChangeShowMascot}
            />
        );
        fireEvent.click(screen.getByLabelText("마스코트 보여주기"));
        expect(onChangeShowMascot).toHaveBeenCalledWith(true);
    });

    it("childName / parentNames 표시", () => {
        render(
            <ChildSettingsScreen
                onBack={() => {}}
                childName="혜니"
                parentNames="엄마, 아빠"
            />
        );
        expect(screen.getByText("혜니")).toBeInTheDocument();
        expect(screen.getByText("엄마, 아빠")).toBeInTheDocument();
    });

    it("이름/부모 미입력 시 — 표시", () => {
        render(<ChildSettingsScreen onBack={() => {}} />);
        const dashes = screen.getAllByText("—");
        expect(dashes.length).toBeGreaterThanOrEqual(2);
    });

    it("onRequestParentChange 핸들러 있으면 변경 요청 버튼 노출", () => {
        const onRequestParentChange = vi.fn();
        render(
            <ChildSettingsScreen
                onBack={() => {}}
                onRequestParentChange={onRequestParentChange}
            />
        );
        const btn = screen.getByText("부모님께 변경 요청");
        fireEvent.click(btn);
        expect(onRequestParentChange).toHaveBeenCalledTimes(1);
    });

    it("onRequestParentChange 핸들러 없으면 변경 요청 버튼 미렌더", () => {
        render(<ChildSettingsScreen onBack={() => {}} />);
        expect(screen.queryByText("부모님께 변경 요청")).toBeNull();
    });

    it("onLogout 핸들러 있으면 로그아웃 버튼 노출 + 클릭 호출", () => {
        const onLogout = vi.fn();
        render(<ChildSettingsScreen onBack={() => {}} onLogout={onLogout} />);
        const btn = screen.getByText("로그아웃");
        fireEvent.click(btn);
        expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it("onLogout 핸들러 없으면 로그아웃 버튼 미렌더", () => {
        render(<ChildSettingsScreen onBack={() => {}} />);
        expect(screen.queryByText("로그아웃")).toBeNull();
    });
});
