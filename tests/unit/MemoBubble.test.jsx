// tests/unit/MemoBubble.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoBubble } from "../../src/components/childMode/MemoBubble.jsx";

describe("MemoBubble", () => {
    it("부모 발신 bubble", () => {
        const { container } = render(<MemoBubble from="parent" stamp="오후 2:30">안녕!</MemoBubble>);
        const row = container.querySelector('.memo-bubble-row');
        const bubble = container.querySelector('.memo-bubble');
        expect(row).toHaveAttribute("data-from", "parent");
        expect(bubble).toHaveAttribute("data-from", "parent");
        expect(screen.getByText("안녕!")).toBeInTheDocument();
        expect(screen.getByText("오후 2:30")).toBeInTheDocument();
    });

    it("자녀 발신 bubble", () => {
        const { container } = render(<MemoBubble from="child">답장</MemoBubble>);
        const row = container.querySelector('.memo-bubble-row');
        const bubble = container.querySelector('.memo-bubble');
        expect(row).toHaveAttribute("data-from", "child");
        expect(bubble).toHaveAttribute("data-from", "child");
        expect(screen.getByText("답장")).toBeInTheDocument();
    });

    it("from prop 누락 시 parent로 fallback", () => {
        const { container } = render(<MemoBubble>fallback</MemoBubble>);
        expect(container.querySelector('.memo-bubble')).toHaveAttribute("data-from", "parent");
    });

    it("stamp 없으면 stamp element 미렌더", () => {
        const { container } = render(<MemoBubble from="child">no stamp</MemoBubble>);
        expect(container.querySelector('.memo-bubble-stamp')).toBeNull();
    });
});
