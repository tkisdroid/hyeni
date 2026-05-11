// tests/unit/AppBrandLogo.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppBrandLogo } from "../../src/components/auth/AppBrandLogo.jsx";

describe("AppBrandLogo", () => {
    it("기본 size=80, shadow=true", () => {
        const { container } = render(<AppBrandLogo />);
        const logo = screen.getByLabelText("혜니캘린더 로고");
        const img = container.querySelector("img");
        expect(img).not.toBeNull();
        expect(logo.style.width).toBe("80px");
        expect(logo.style.height).toBe("80px");
        expect(logo.style.filter).toContain("drop-shadow");
        expect(img.style.width).toBe("80px");
        expect(img.style.height).toBe("80px");
    });

    it("size prop 적용", () => {
        const { container } = render(<AppBrandLogo size={48} radius={12} />);
        const logo = screen.getByLabelText("혜니캘린더 로고");
        const img = container.querySelector("img");
        expect(logo.style.width).toBe("48px");
        expect(img.style.width).toBe("48px");
    });

    it("shadow=false → filter none", () => {
        render(<AppBrandLogo shadow={false} />);
        expect(screen.getByLabelText("혜니캘린더 로고").style.filter).toBe("none");
    });

    it("mascot image uses decorative alt and asset src", () => {
        const { container } = render(<AppBrandLogo />);
        const img = container.querySelector("img");
        expect(img.getAttribute("alt")).toBe("");
        expect(img.getAttribute("src")).toContain("/src/assets/3d/mascot/");
    });
});
