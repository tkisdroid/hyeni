// tests/unit/AppConfirmDialog.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppConfirmDialog } from "../../src/components/dialogs/AppConfirmDialog.jsx";

describe("AppConfirmDialog", () => {
    it("dialog === null 이면 미렌더", () => {
        const { container } = render(
            <AppConfirmDialog dialog={null} onCancel={() => {}} onConfirm={() => {}} />
        );
        expect(container.firstChild).toBeNull();
    });

    it("기본 라벨 (확인/취소)", () => {
        render(
            <AppConfirmDialog
                dialog={{ title: "삭제", message: "지울까요?" }}
                onCancel={() => {}}
                onConfirm={() => {}}
            />
        );
        expect(screen.getByText("삭제")).toBeInTheDocument();
        expect(screen.getByText("지울까요?")).toBeInTheDocument();
        expect(screen.getByText("확인")).toBeInTheDocument();
        expect(screen.getByText("취소")).toBeInTheDocument();
    });

    it("커스텀 confirmLabel/cancelLabel", () => {
        render(
            <AppConfirmDialog
                dialog={{ title: "x", confirmLabel: "지우기", cancelLabel: "그만" }}
                onCancel={() => {}}
                onConfirm={() => {}}
            />
        );
        expect(screen.getByText("지우기")).toBeInTheDocument();
        expect(screen.getByText("그만")).toBeInTheDocument();
    });

    it("확인 클릭 → onConfirm", () => {
        const onConfirm = vi.fn();
        render(
            <AppConfirmDialog
                dialog={{ title: "x" }}
                onCancel={() => {}}
                onConfirm={onConfirm}
            />
        );
        fireEvent.click(screen.getByText("확인"));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("취소 클릭 → onCancel", () => {
        const onCancel = vi.fn();
        render(
            <AppConfirmDialog
                dialog={{ title: "x" }}
                onCancel={onCancel}
                onConfirm={() => {}}
            />
        );
        fireEvent.click(screen.getByText("취소"));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("backdrop 클릭 → onCancel", () => {
        const onCancel = vi.fn();
        const { container } = render(
            <AppConfirmDialog
                dialog={{ title: "x" }}
                onCancel={onCancel}
                onConfirm={() => {}}
            />
        );
        const backdrop = container.querySelector('[role="presentation"]');
        fireEvent.click(backdrop);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("dialog 본체 클릭은 backdrop 이벤트 차단 (stopPropagation)", () => {
        const onCancel = vi.fn();
        render(
            <AppConfirmDialog
                dialog={{ title: "x" }}
                onCancel={onCancel}
                onConfirm={() => {}}
            />
        );
        fireEvent.click(screen.getByRole("dialog"));
        expect(onCancel).not.toHaveBeenCalled();
    });

    it("기본 아이콘 = ?", () => {
        render(<AppConfirmDialog dialog={{ title: "x" }} onCancel={() => {}} onConfirm={() => {}} />);
        expect(screen.getByText("?")).toBeInTheDocument();
    });

    it("tone=danger → 기본 아이콘 !", () => {
        render(<AppConfirmDialog dialog={{ title: "x", tone: "danger" }} onCancel={() => {}} onConfirm={() => {}} />);
        expect(screen.getByText("!")).toBeInTheDocument();
    });

    it("커스텀 icon", () => {
        render(<AppConfirmDialog dialog={{ title: "x", icon: "🗑" }} onCancel={() => {}} onConfirm={() => {}} />);
        expect(screen.getByText("🗑")).toBeInTheDocument();
    });

    it("aria-modal=true + labelledby/describedby", () => {
        render(<AppConfirmDialog dialog={{ title: "x" }} onCancel={() => {}} onConfirm={() => {}} />);
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAttribute("aria-labelledby");
        expect(dialog).toHaveAttribute("aria-describedby");
    });
});
