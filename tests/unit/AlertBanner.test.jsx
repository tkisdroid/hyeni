// tests/unit/AlertBanner.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AlertBanner } from "../../src/components/banners/AlertBanner.jsx";

describe("AlertBanner", () => {
    it("alerts 비면 미렌더", () => {
        const { container } = render(<AlertBanner alerts={[]} onDismiss={() => {}} />);
        expect(container.firstChild).toBeNull();
    });

    it("alert 1개 메시지 + 라벨 표시", () => {
        render(<AlertBanner alerts={[{ id: "a1", type: "parent", msg: "안녕" }]} onDismiss={() => {}} />);
        expect(screen.getByText("부모님 알림")).toBeInTheDocument();
        expect(screen.getByText("안녕")).toBeInTheDocument();
    });

    it("type 별 라벨 매핑 (parent/child/friend/emergency/sync)", () => {
        const types = [
            ["parent", "부모님 알림"],
            ["child", "아이 알림"],
            ["friend", "친구 알림"],
            ["emergency", "⚠️ 긴급 미도착"],
            ["sync", "📅 일정 동기화"],
        ];
        types.forEach(([type, label]) => {
            const { unmount } = render(<AlertBanner alerts={[{ id: type, type, msg: "x" }]} onDismiss={() => {}} />);
            expect(screen.getByText(label)).toBeInTheDocument();
            unmount();
        });
    });

    it("미지원 type → fallback '알림'", () => {
        render(<AlertBanner alerts={[{ id: "u", type: "unknown", msg: "x" }]} onDismiss={() => {}} />);
        expect(screen.getByText("알림")).toBeInTheDocument();
    });

    it("확인 버튼 클릭 시 onDismiss(id) 호출", () => {
        const onDismiss = vi.fn();
        render(<AlertBanner alerts={[{ id: "alert-1", type: "parent", msg: "x" }]} onDismiss={onDismiss} />);
        fireEvent.click(screen.getByText("확인"));
        expect(onDismiss).toHaveBeenCalledWith("alert-1");
    });

    it("여러 alert 모두 렌더", () => {
        render(<AlertBanner alerts={[
            { id: "a1", type: "parent", msg: "p" },
            { id: "a2", type: "child", msg: "c" },
        ]} onDismiss={() => {}} />);
        expect(screen.getByText("p")).toBeInTheDocument();
        expect(screen.getByText("c")).toBeInTheDocument();
    });
});
