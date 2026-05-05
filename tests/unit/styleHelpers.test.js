// tests/unit/styleHelpers.test.js
import { describe, it, expect } from "vitest";
import {
    DESIGN,
    FF,
    modalBackdropStyle,
    makeCardStyle,
    makeSheetStyle,
    makeInputStyle,
    makePrimaryButtonStyle,
    makeSecondaryButtonStyle,
} from "../../src/lib/styleHelpers.js";

describe("constants", () => {
    it("FF에 Pretendard 우선", () => {
        expect(FF).toMatch(/^'Pretendard Variable','Pretendard'/);
    });

    it("DESIGN은 frozen", () => {
        expect(Object.isFrozen(DESIGN)).toBe(true);
    });

    it("DESIGN.colors에 핵심 키 존재", () => {
        expect(DESIGN.colors).toMatchObject({
            surface: expect.any(String),
            line: expect.any(String),
            ink: expect.any(String),
        });
    });

    it("DESIGN.gradients.primary는 theme-accent token 사용", () => {
        expect(DESIGN.gradients.primary).toContain("var(--theme-accent)");
        expect(DESIGN.gradients.primary).toContain("var(--theme-accent-deep)");
    });

    it("DESIGN.radius에 sm/md/lg/xl/hero/sheet", () => {
        expect(DESIGN.radius).toMatchObject({
            sm: expect.any(Number),
            md: expect.any(Number),
            lg: expect.any(Number),
            xl: expect.any(Number),
            hero: expect.any(Number),
            sheet: expect.any(String),
        });
    });
});

describe("modalBackdropStyle", () => {
    it("rgba background + backdrop-filter blur", () => {
        expect(modalBackdropStyle.background).toMatch(/^rgba/);
        expect(modalBackdropStyle.backdropFilter).toContain("blur");
    });
});

describe("makeCardStyle", () => {
    it("base 스타일 반환", () => {
        const result = makeCardStyle();
        expect(result.background).toBe(DESIGN.colors.surface);
        expect(result.borderRadius).toBe(DESIGN.radius.xl);
        expect(result.border).toContain("var(--theme-accent-line)");
    });

    it("overrides 머지", () => {
        const result = makeCardStyle({ padding: 20, background: "red" });
        expect(result.padding).toBe(20);
        expect(result.background).toBe("red"); // override wins
    });

    it("override 없는 호출도 안전", () => {
        expect(() => makeCardStyle()).not.toThrow();
    });
});

describe("makeSheetStyle", () => {
    it("sheet radius + sheet shadow", () => {
        const result = makeSheetStyle();
        expect(result.borderRadius).toBe(DESIGN.radius.sheet);
        expect(result.boxShadow).toBe(DESIGN.shadow.sheet);
    });
});

describe("makeInputStyle", () => {
    it("body weight medium + Pretendard", () => {
        const result = makeInputStyle();
        expect(result.fontWeight).toBe("var(--weight-medium)");
        expect(result.fontFamily).toBe(FF);
    });

    it("기본 box-sizing border-box", () => {
        expect(makeInputStyle().boxSizing).toBe("border-box");
    });

    it("overrides 적용", () => {
        const result = makeInputStyle({ width: "50%" });
        expect(result.width).toBe("50%");
    });
});

describe("makePrimaryButtonStyle", () => {
    it("primary gradient + bold weight + min-height 48", () => {
        const result = makePrimaryButtonStyle();
        expect(result.background).toBe(DESIGN.gradients.primary);
        expect(result.fontWeight).toBe("var(--weight-bold)");
        expect(result.minHeight).toBe(48);
    });

    it("색은 fg-on-primary token", () => {
        expect(makePrimaryButtonStyle().color).toBe("var(--fg-on-primary)");
    });
});

describe("makeSecondaryButtonStyle", () => {
    it("surface background + secondary text", () => {
        const result = makeSecondaryButtonStyle();
        expect(result.background).toBe(DESIGN.colors.surface);
        expect(result.color).toBe("var(--fg-secondary)");
    });

    it("min-height 44", () => {
        expect(makeSecondaryButtonStyle().minHeight).toBe(44);
    });
});

describe("style factories — overrides 우선순위", () => {
    it.each([
        ["card", makeCardStyle],
        ["sheet", makeSheetStyle],
        ["input", makeInputStyle],
        ["primary", makePrimaryButtonStyle],
        ["secondary", makeSecondaryButtonStyle],
    ])("%s: overrides는 base를 덮어씀", (_label, factory) => {
        const result = factory({ background: "test-override" });
        expect(result.background).toBe("test-override");
    });
});
