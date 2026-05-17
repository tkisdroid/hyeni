// tests/unit/ChildSettingsScreen.test.jsx
// 자녀 설정 화면 — 변경 요청 모델 (Phase 2). 이름만 직접 수정, 나머지는 요청 전용.
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChildSettingsScreen } from "../../src/components/childMode/ChildSettingsScreen.jsx";

afterEach(() => {
    cleanup();
});

describe("ChildSettingsScreen", () => {
    it("헤더 타이틀과 뒤로 버튼 렌더", () => {
        const onBack = vi.fn();
        render(<ChildSettingsScreen onBack={onBack} />);
        expect(screen.getByText("설정")).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("뒤로"));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("childName / parentNames 표시", () => {
        render(
            <ChildSettingsScreen onBack={() => {}} childName="혜니" parentNames="엄마, 아빠" />,
        );
        expect(screen.getByText("혜니")).toBeInTheDocument();
        expect(screen.getByText("엄마, 아빠")).toBeInTheDocument();
    });

    it("이름/부모 미입력 시 — 표시", () => {
        render(<ChildSettingsScreen onBack={() => {}} />);
        expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    });

    it("onEditName 있으면 이름 Row가 탭 가능하고 클릭 시 onEditName 호출", () => {
        const onEditName = vi.fn();
        render(<ChildSettingsScreen onBack={() => {}} childName="혜니" onEditName={onEditName} />);
        fireEvent.click(screen.getByLabelText(/이름 수정/));
        expect(onEditName).toHaveBeenCalledTimes(1);
    });

    it("onEditName 없으면 이름 Row는 읽기 전용 (수정 버튼 미렌더)", () => {
        render(<ChildSettingsScreen onBack={() => {}} childName="혜니" />);
        expect(screen.queryByLabelText(/이름 수정/)).toBeNull();
    });

    it("테마/캐릭터/소리/마스코트 4개 변경 요청 Row 렌더", () => {
        render(<ChildSettingsScreen onBack={() => {}} onRequestChange={() => {}} />);
        ["테마 색깔", "캐릭터", "소리·진동", "마스코트 보여주기"].forEach((label) => {
            expect(screen.getByRole("button", { name: `${label} 변경 요청` })).toBeInTheDocument();
        });
    });

    it("변경 요청 버튼 클릭 시 해당 menuKey로 onRequestChange 호출", () => {
        const onRequestChange = vi.fn();
        render(<ChildSettingsScreen onBack={() => {}} onRequestChange={onRequestChange} />);
        fireEvent.click(screen.getByRole("button", { name: "테마 색깔 변경 요청" }));
        fireEvent.click(screen.getByRole("button", { name: "캐릭터 변경 요청" }));
        fireEvent.click(screen.getByRole("button", { name: "소리·진동 변경 요청" }));
        fireEvent.click(screen.getByRole("button", { name: "마스코트 보여주기 변경 요청" }));
        expect(onRequestChange.mock.calls.map((c) => c[0])).toEqual([
            "theme", "character", "sound", "mascot",
        ]);
    });

    it("자녀 직접 컨트롤(테마 picker·토글) 부재", () => {
        render(<ChildSettingsScreen onBack={() => {}} onRequestChange={() => {}} />);
        // 구버전의 색상 picker / 소리·마스코트 토글이 더 이상 없어야 한다.
        expect(screen.queryByLabelText(/테마$/)).toBeNull();
        expect(screen.queryByRole("switch")).toBeNull();
        expect(screen.queryAllByRole("radio")).toHaveLength(0);
    });

    it("onLogout 있으면 로그아웃 버튼 노출 + 클릭 호출", () => {
        const onLogout = vi.fn();
        render(<ChildSettingsScreen onBack={() => {}} onLogout={onLogout} />);
        fireEvent.click(screen.getByText("로그아웃"));
        expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it("onLogout 없으면 로그아웃 버튼 미렌더", () => {
        render(<ChildSettingsScreen onBack={() => {}} />);
        expect(screen.queryByText("로그아웃")).toBeNull();
    });
});
