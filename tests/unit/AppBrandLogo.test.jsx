// tests/unit/AppBrandLogo.test.jsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AppBrandLogo } from "../../src/components/auth/AppBrandLogo.jsx";

describe("AppBrandLogo", () => {
    it("기본 size=80, radius=24, shadow=true", () => {
        const { container } = render(<AppBrandLogo />);
        const img = container.querySelector("img");
        expect(img).not.toBeNull();
        expect(img.style.width).toBe("80px");
        expect(img.style.height).toBe("80px");
        expect(img.style.borderRadius).toBe("24px");
        expect(img.style.boxShadow).toContain("--hyeni-theme-shadow-soft");
    });

    it("size/radius prop 적용", () => {
        const { container } = render(<AppBrandLogo size={48} radius={12} />);
        const img = container.querySelector("img");
        expect(img.style.width).toBe("48px");
        expect(img.style.borderRadius).toBe("12px");
    });

    it("shadow=false → boxShadow none", () => {
        const { container } = render(<AppBrandLogo shadow={false} />);
        expect(container.querySelector("img").style.boxShadow).toBe("none");
    });

    it("alt + src 고정", () => {
        const { container } = render(<AppBrandLogo />);
        const img = container.querySelector("img");
        expect(img.getAttribute("alt")).toBe("혜니캘린더 로고");
        expect(img.getAttribute("src")).toBe("/icon-192.png");
    });
});
