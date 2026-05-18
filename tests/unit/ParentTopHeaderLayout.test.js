import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.jsx", "utf8");
const appCss = readFileSync("src/App.css", "utf8");
const homeTabSource = readFileSync("src/components/multichild/HomeDashboard/HomeTab.jsx", "utf8");

function sourceBetween(start, end) {
    const startIndex = appSource.indexOf(start);
    const endIndex = appSource.indexOf(end, startIndex);

    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeGreaterThan(startIndex);

    return appSource.slice(startIndex, endIndex);
}

describe("parent top header layout", () => {
    it("uses the same visible card width as the parent sections below", () => {
        const topHeaderBlock = sourceBetween(
            'className={`hyeni-top-header',
            '<div className="hyeni-top-header-brand">',
        );

        expect(topHeaderBlock).toContain('width: isParent ? "calc(100% - 28px)" : "100%"');
        expect(topHeaderBlock).toContain("maxWidth: isParent ? parentSectionMaxWidth - 28 : contentMaxWidth");
    });

    it("keeps the header character centered without continuous vertical float animation", () => {
        const brandBlock = sourceBetween(
            '<div className="hyeni-top-header-brand">',
            '<div style={{ minWidth: 0, flex: "1 1 auto" }}>',
        );

        expect(brandBlock).not.toContain("float 3s");
        expect(brandBlock).not.toContain("animation:");
        expect(brandBlock).toContain('alignItems: "center"');
        expect(brandBlock).toContain('justifyContent: "center"');
    });

    it("does not opt the header logo into shared pop animation", () => {
        expect(appCss).not.toContain(".hyeni-app-shell .hyeni-top-header-brand > div:first-child");
    });

    it("does not double-inset HomeTab cards inside the parent main frame", () => {
        expect(homeTabSource).toContain('padding: "8px 0 24px"');
        expect(homeTabSource).not.toContain('padding: "8px 16px 24px"');
    });
});
