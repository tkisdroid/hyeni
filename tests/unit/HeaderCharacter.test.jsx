import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { HeaderCharacter } from "../../src/components/header/HeaderCharacter.jsx";

const HEADER_ASSETS = [
    { mood: "static", file: "../../src/assets/3d/header/static.webp" },
    { mood: "diary", file: "../../src/assets/3d/header/diary.webp" },
    { mood: "sad", file: "../../src/assets/3d/header/sad.webp" },
];

const ALPHA_THRESHOLD = 8;
const MAX_TRANSPARENT_MARGIN_RATIO = 0.08;

async function getAlphaBounds(relativeFile) {
    const filePath = fileURLToPath(new URL(relativeFile, import.meta.url));
    const image = sharp(filePath).ensureAlpha();
    const metadata = await image.metadata();
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
            const alpha = data[(y * info.width + x) * info.channels + 3];

            if (alpha > ALPHA_THRESHOLD) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    return {
        width: metadata.width,
        height: metadata.height,
        left: minX,
        top: minY,
        right: metadata.width - maxX - 1,
        bottom: metadata.height - maxY - 1,
    };
}

describe("HeaderCharacter", () => {
    it("renders the requested mood in a fixed square slot", () => {
        const { container } = render(<HeaderCharacter mood="diary" size={42} aria-label="혜니" />);

        const img = screen.getByRole("img", { name: "혜니" });
        const slot = container.querySelector("span");

        expect(slot.style.width).toBe("42px");
        expect(slot.style.height).toBe("42px");
        expect(img).toHaveAttribute("width", "42");
        expect(img).toHaveAttribute("height", "42");
        expect(img.style.objectFit).toBe("contain");
        expect(img.getAttribute("src")).toContain("/src/assets/3d/header/diary.webp");
    });

    it("falls back to static when the mood is unknown", () => {
        render(<HeaderCharacter mood="missing" aria-label="혜니" />);

        expect(screen.getByRole("img", { name: "혜니" }).getAttribute("src")).toContain(
            "/src/assets/3d/header/static.webp",
        );
    });

    it("keeps transparent margins tight so the character remains visible at header size", async () => {
        for (const asset of HEADER_ASSETS) {
            const bounds = await getAlphaBounds(asset.file);

            expect(bounds.width).toBeGreaterThan(0);
            expect(bounds.height).toBeGreaterThan(0);
            expect(bounds.left / bounds.width, `${asset.mood} left margin`).toBeLessThanOrEqual(
                MAX_TRANSPARENT_MARGIN_RATIO,
            );
            expect(bounds.right / bounds.width, `${asset.mood} right margin`).toBeLessThanOrEqual(
                MAX_TRANSPARENT_MARGIN_RATIO,
            );
            expect(bounds.top / bounds.height, `${asset.mood} top margin`).toBeLessThanOrEqual(
                MAX_TRANSPARENT_MARGIN_RATIO,
            );
            expect(bounds.bottom / bounds.height, `${asset.mood} bottom margin`).toBeLessThanOrEqual(
                MAX_TRANSPARENT_MARGIN_RATIO,
            );
        }
    });
});
