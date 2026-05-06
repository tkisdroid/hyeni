// tests/unit/MemoBubble.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
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
        const stack = container.querySelector('.memo-bubble-stack');
        const bubble = container.querySelector('.memo-bubble');
        expect(row).toHaveAttribute("data-from", "child");
        expect(stack).toBeInTheDocument();
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

    it("한글 짧은 메시지가 한 글자씩 세로로 줄바꿈되지 않도록 CSS를 고정한다", () => {
        const childTokenCss = readFileSync("src/styles/tokens-phase3-child.css", "utf8");
        const childBubbleRule = childTokenCss.match(/\.memo-bubble\s*\{[^}]+\}/)?.[0] || "";
        const childBubbleStackRule = childTokenCss.match(/\.memo-bubble-stack\s*\{[^}]+\}/)?.[0] || "";

        expect(childBubbleStackRule).toContain("max-width: 78%");
        expect(childBubbleStackRule).toContain("min-width: 0");
        expect(childBubbleRule).toContain("word-break: keep-all");
        expect(childBubbleRule).toContain("overflow-wrap: break-word");
        expect(childBubbleRule).toContain("white-space: pre-wrap");
        expect(childBubbleRule).toContain("min-width: 0");
    });
});
