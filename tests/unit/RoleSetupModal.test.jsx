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

    it("기본 role 선택 카드 렌더", () => {
        render(<RoleSetupModal onSelect={() => {}} />);
        expect(screen.getByText(/누구로/)).toBeInTheDocument();
        expect(screen.getByLabelText("부모로 시작")).toBeInTheDocument();
        expect(screen.getByLabelText("자녀로 시작")).toBeInTheDocument();
    });

    it("아이 카드 클릭 시 onSelect('child') 호출", () => {
        const onSelect = vi.fn();
        render(<RoleSetupModal onSelect={onSelect} />);
        fireEvent.click(screen.getByLabelText("자녀로 시작"));
        fireEvent.click(screen.getByRole("button", { name: "다음" }));
        expect(onSelect).toHaveBeenCalledWith("child");
    });

    it("부모 카드 클릭 → ParentAuthScreen 으로 전환", () => {
        render(<RoleSetupModal onSelect={() => {}} />);
        fireEvent.click(screen.getByLabelText("부모로 시작"));
        fireEvent.click(screen.getByRole("button", { name: "다음" }));
        expect(screen.getByText("아이디 · 비밀번호로 로그인")).toBeInTheDocument();
    });

    it("loading=true → SplashScreen 분기", () => {
        const { container } = render(<RoleSetupModal onSelect={() => {}} loading />);
        // SplashScreen 자체는 별도 모듈 — promise 텍스트가 없는지 확인
        expect(screen.queryByText(/누구로/)).toBeNull();
        expect(container.firstChild).not.toBeNull();
    });

    it("재방문 + lastRole 있을 때 단축 진입 버튼 노출", () => {
        localStorage.setItem("hyeni-has-visited", "1");
        localStorage.setItem("hyeni-last-role", "child");
        render(<RoleSetupModal onSelect={() => {}} />);
        expect(
            screen.getByRole("button", { name: /지난번엔.*자녀.*로 사용했어요/ })
        ).toBeInTheDocument();
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
        fireEvent.click(screen.getByLabelText("자녀로 시작"));
        fireEvent.click(screen.getByRole("button", { name: "다음" }));
        expect(localStorage.getItem("hyeni-last-role")).toBe("child");
    });

    it("부모 선택 시 hyeni-last-role=parent 기록", () => {
        render(<RoleSetupModal onSelect={() => {}} />);
        fireEvent.click(screen.getByLabelText("부모로 시작"));
        fireEvent.click(screen.getByRole("button", { name: "다음" }));
        expect(localStorage.getItem("hyeni-last-role")).toBe("parent");
    });
});
