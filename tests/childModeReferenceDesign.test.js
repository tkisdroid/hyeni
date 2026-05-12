import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.jsx", "utf8");
const childTokens = readFileSync("src/styles/tokens-phase3-child.css", "utf8");
const childCallCard = readFileSync("src/components/contact/ChildCallCard.jsx", "utf8");

describe("child mode reference design", () => {
  test("uses a simple child header, compact hero, and arrow quick cards", () => {
    expect(appSource).toContain("hyeni-top-header--child");
    expect(appSource).toContain("child-quick-card__main");
    expect(appSource).toContain("child-quick-card__arrow");
    expect(childTokens).toContain(".hyeni-top-header--child");
    expect(childTokens).toContain("grid-template-columns: minmax(116px, 0.78fr) minmax(0, 1fr)");
    expect(childTokens).toContain("--child-hero-min-height:     178px;");
    expect(childTokens).toContain(".child-quick-card__arrow");
  });

  test("phone card follows the simple reference row style", () => {
    expect(childCallCard).toContain("child-call-card");
    expect(childCallCard).toContain("child-call-card__targets");
    expect(childCallCard).toContain("엄마 · 아빠");
  });
});
