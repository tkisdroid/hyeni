// tests/unit/RoleSetupModal.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RoleSetupModal } from "../../src/components/auth/RoleSetupModal.jsx";

// kakaoLogin / signInWithLoginId / requestPhoneSignupCode 등은 실제 호출되면 안 되므로 stub
vi.mock("../../src/lib/auth.js", () => ({
    kakaoLogin: vi.fn().mockResolvedValue(),
}));
vi.mock("../../src/lib/accountAuth.js", () => ({
    signInWithLoginId: vi.fn().mockResolvedValue(),
    requestPhoneSignupCode: vi.fn().mockResolvedValue({ phone: "010", profile: {}, session: null }),
    verifyPhoneSignupCode: vi.fn().mockResolvedValue(),
}));

describe("RoleSetupModal", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("기본 promise + 학부모/아이 카드 렌더", () => {
        render(<RoleSetupModal onSelect={() => {}} />);
        expect(screen.getByText("한 가족, 두 시점")).toBeInTheDocument();
        expect(screen.getByLabelText("학부모로 시작")).toBeInTheDocument();
        expect(screen.getByLabelText("아이로 시작")).toBeInTheDocument();
    });

    it("아이 카드 클릭 시 onSelect('child') 호출", () => {
        const onSelect = vi.fn();
        render(<RoleSetupModal onSelect={onSelect} />);
        fireEvent.click(screen.getByLabelText("아이로 시작"));
        expect(onSelect).toHaveBeenCalledWith("child");
    });

    it("학부모 카드 클릭 → ParentAuthScreen 으로 전환", () => {
        render(<RoleSetupModal onSelect={() => {}} />);
        fireEvent.click(screen.getByLabelText("학부모로 시작"));
        expect(screen.getByText("학부모 로그인")).toBeInTheDocument();
    });

    it("loading=true → SplashScreen 분기", () => {
        const { container } = render(<RoleSetupModal onSelect={() => {}} loading />);
        // SplashScreen 자체는 별도 모듈 — promise 텍스트가 없는지 확인
        expect(screen.queryByText("한 가족, 두 시점")).toBeNull();
        expect(container.firstChild).not.toBeNull();
    });

    it("재방문 + lastRole 있을 때 단축 진입 버튼 노출", () => {
        localStorage.setItem("hyeni-has-visited", "1");
        localStorage.setItem("hyeni-last-role", "child");
        render(<RoleSetupModal onSelect={() => {}} />);
        expect(screen.getByText(/지난번엔/)).toBeInTheDocument();
        // 단축 버튼 안에 '아이' 글자가 있어야 함
        expect(screen.getByText(/다시 시작/)).toBeInTheDocument();
    });

    it("첫 방문 시 단축 버튼 미노출", () => {
        render(<RoleSetupModal onSelect={() => {}} />);
        expect(screen.queryByText(/지난번엔/)).toBeNull();
    });

    it("렌더 후 hyeni-has-visited 자동 기록", async () => {
        render(<RoleSetupModal onSelect={() => {}} />);
        // useEffect는 mount 후 동기적으로 실행됨 (test env)
        await Promise.resolve();
        expect(localStorage.getItem("hyeni-has-visited")).toBe("1");
    });

    it("아이 선택 시 hyeni-last-role=child 기록", () => {
        render(<RoleSetupModal onSelect={() => {}} />);
        fireEvent.click(screen.getByLabelText("아이로 시작"));
        expect(localStorage.getItem("hyeni-last-role")).toBe("child");
    });

    it("학부모 선택 시 hyeni-last-role=parent 기록", () => {
        render(<RoleSetupModal onSelect={() => {}} />);
        fireEvent.click(screen.getByLabelText("학부모로 시작"));
        expect(localStorage.getItem("hyeni-last-role")).toBe("parent");
    });
});
