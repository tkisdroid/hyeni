// tests/unit/ParentSettingsScreen.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ParentSettingsScreen } from "../../src/components/settings/ParentSettingsScreen.jsx";

describe("ParentSettingsScreen", () => {
    it("타이틀 + 뒤로 버튼", () => {
        const onBack = vi.fn();
        render(<ParentSettingsScreen onBack={onBack} />);
        expect(screen.getByText("설정")).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("뒤로"));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("7 섹션 헤더 모두 노출 (계정/자녀/알림/구독/데이터/도움말/위험)", () => {
        render(<ParentSettingsScreen onBack={() => {}} />);
        ["내 계정", "자녀 관리", "알림", "구독", "데이터·개인정보", "도움말", "위험 영역"].forEach((title) => {
            expect(screen.getByText(title)).toBeInTheDocument();
        });
    });

    it("parentName / parentPhone / childCount trailing 표시", () => {
        render(
            <ParentSettingsScreen
                onBack={() => {}}
                parentName="홍길동"
                parentPhone="010-1234-5678"
                childCount={2}
            />
        );
        expect(screen.getByText("홍길동")).toBeInTheDocument();
        expect(screen.getByText("010-1234-5678")).toBeInTheDocument();
        expect(screen.getByText("2명")).toBeInTheDocument();
    });

    it("parentEmail 있으면 row 노출, 없으면 미렌더", () => {
        const { rerender, container } = render(
            <ParentSettingsScreen onBack={() => {}} parentEmail="user@example.com" />
        );
        expect(screen.getByText("user@example.com")).toBeInTheDocument();
        rerender(<ParentSettingsScreen onBack={() => {}} />);
        expect(container.textContent).not.toContain("이메일");
    });

    it("phone 미등록 시 '미등록' 표시", () => {
        render(<ParentSettingsScreen onBack={() => {}} />);
        expect(screen.getByText("미등록")).toBeInTheDocument();
    });

    it("3 알림 토글 동작", () => {
        const onChangeNotifyEvents = vi.fn();
        const onChangeNotifyChildLocation = vi.fn();
        const onChangeNotifyPlaydate = vi.fn();
        render(
            <ParentSettingsScreen
                onBack={() => {}}
                notifyEvents
                notifyChildLocation={false}
                notifyPlaydate
                onChangeNotifyEvents={onChangeNotifyEvents}
                onChangeNotifyChildLocation={onChangeNotifyChildLocation}
                onChangeNotifyPlaydate={onChangeNotifyPlaydate}
            />
        );
        fireEvent.click(screen.getByLabelText("일정 알림"));
        expect(onChangeNotifyEvents).toHaveBeenCalledWith(false);
        fireEvent.click(screen.getByLabelText("자녀 위치 알림"));
        expect(onChangeNotifyChildLocation).toHaveBeenCalledWith(true);
        fireEvent.click(screen.getByLabelText("친구놀이 알림"));
        expect(onChangeNotifyPlaydate).toHaveBeenCalledWith(false);
    });

    it("subscriptionPlanLabel trailing + onOpenSubscription 클릭 호출", () => {
        const onOpenSubscription = vi.fn();
        render(
            <ParentSettingsScreen
                onBack={() => {}}
                subscriptionPlanLabel="프리미엄"
                onOpenSubscription={onOpenSubscription}
            />
        );
        expect(screen.getByText("프리미엄")).toBeInTheDocument();
        fireEvent.click(screen.getByText("현재 플랜"));
        expect(onOpenSubscription).toHaveBeenCalledTimes(1);
    });

    it("위험 영역: 로그아웃·연결해제·구독해지 핸들러 있을 때만 노출 + danger 클래스", () => {
        const onLogout = vi.fn();
        const onUnlinkChild = vi.fn();
        const onCancelSubscription = vi.fn();
        const { container } = render(
            <ParentSettingsScreen
                onBack={() => {}}
                onLogout={onLogout}
                onUnlinkChild={onUnlinkChild}
                onCancelSubscription={onCancelSubscription}
            />
        );
        const dangerRows = container.querySelectorAll(".settings-danger-row");
        expect(dangerRows.length).toBeGreaterThanOrEqual(3);
        fireEvent.click(screen.getByText("로그아웃"));
        expect(onLogout).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText("자녀 연결 해제"));
        expect(onUnlinkChild).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText("구독 해지"));
        expect(onCancelSubscription).toHaveBeenCalledTimes(1);
    });

    it("위험 영역 핸들러 미제공 시 모두 미렌더", () => {
        const { container } = render(<ParentSettingsScreen onBack={() => {}} />);
        expect(screen.queryByText("로그아웃")).toBeNull();
        expect(screen.queryByText("자녀 연결 해제")).toBeNull();
        expect(screen.queryByText("구독 해지")).toBeNull();
        expect(container.querySelectorAll(".settings-danger-row").length).toBe(0);
    });

    it("계정 삭제는 별도 섹션 + severity=critical 적용", () => {
        const onDeleteAccount = vi.fn();
        const { container } = render(
            <ParentSettingsScreen onBack={() => {}} onDeleteAccount={onDeleteAccount} />
        );
        const critical = container.querySelector('[data-severity="critical"]');
        expect(critical).not.toBeNull();
        expect(critical.textContent).toContain("계정 삭제");
        fireEvent.click(screen.getByText("계정 삭제"));
        expect(onDeleteAccount).toHaveBeenCalledTimes(1);
    });

    it("appVersion trailing 표시", () => {
        render(<ParentSettingsScreen onBack={() => {}} appVersion="1.2.3" />);
        expect(screen.getByText("1.2.3")).toBeInTheDocument();
    });

    it("선택 핸들러들 (FAQ/문의/장소관리/데이터다운로드/개인정보) 클릭 호출", () => {
        const onOpenFAQ = vi.fn();
        const onContactSupport = vi.fn();
        const onOpenPlaceManager = vi.fn();
        const onDataDownload = vi.fn();
        const onPrivacyPolicy = vi.fn();
        render(
            <ParentSettingsScreen
                onBack={() => {}}
                onOpenFAQ={onOpenFAQ}
                onContactSupport={onContactSupport}
                onOpenPlaceManager={onOpenPlaceManager}
                onDataDownload={onDataDownload}
                onPrivacyPolicy={onPrivacyPolicy}
            />
        );
        fireEvent.click(screen.getByText("자주 묻는 질문"));
        expect(onOpenFAQ).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText("문의하기"));
        expect(onContactSupport).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText("장소 관리"));
        expect(onOpenPlaceManager).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText("내 데이터 다운로드"));
        expect(onDataDownload).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText("개인정보 처리방침"));
        expect(onPrivacyPolicy).toHaveBeenCalledTimes(1);
    });

    it("onAddChild 핸들러 있을 때만 '아이 추가하기' 노출", () => {
        const { rerender } = render(<ParentSettingsScreen onBack={() => {}} />);
        expect(screen.queryByText("아이 추가하기")).toBeNull();
        const onAddChild = vi.fn();
        rerender(<ParentSettingsScreen onBack={() => {}} onAddChild={onAddChild} />);
        fireEvent.click(screen.getByText("아이 추가하기"));
        expect(onAddChild).toHaveBeenCalledTimes(1);
    });
});
