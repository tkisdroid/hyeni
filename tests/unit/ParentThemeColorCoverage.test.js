import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.jsx", "utf8");
const appCss = readFileSync("src/App.css", "utf8");
const cartoonCss = readFileSync("src/styles/tokens-cartoon.css", "utf8");

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("parent selected theme color coverage", () => {
  test("parent today hero date and mood copy use selected theme tokens", () => {
    const heroSource = sliceBetween(
      appSource,
      'className="hyeni-parent-today-hero"',
      "오늘 일정 보기",
    );

    expect(heroSource).toContain("dateLabel");
    expect(heroSource).toContain("moodLine");
    expect(heroSource).toContain('background: "var(--theme-accent-soft)"');
    expect(heroSource).toContain('border: "1px solid var(--theme-accent-line)"');
    expect(heroSource).toContain('color: "var(--theme-accent-text)"');
    expect(heroSource).not.toContain("brand-mint");
    expect(heroSource).not.toContain("rgba(49,196,141");
    expect(heroSource).not.toContain("#087653");
  });

  test("safety indicators and detail actions use selected theme tokens", () => {
    const safetySource = sliceBetween(
      appSource,
      'aria-label="아이 기기 사용 지표"',
      'className="hyeni-v5-memo-mini"',
    );

    expect(safetySource).toContain('color: "var(--theme-accent-text)"');
    expect(safetySource).toContain('background: "var(--theme-accent-soft)"');
    expect(safetySource).toContain('border: "1px solid var(--theme-accent-line)"');
    expect(safetySource).toContain("상세");
    expect(safetySource).not.toContain("brand-mint");
    expect(safetySource).not.toContain("#087653");
    expect(safetySource).not.toContain("#BCEBD8");
    expect(safetySource).not.toContain("#DDF7EA");
  });

  test("today memo preview label and count background use selected theme tokens", () => {
    const memoPreviewSource = sliceBetween(
      appSource,
      'className="hyeni-v5-memo-mini"',
      '<div className="hyeni-v5-section-head"',
    );

    expect(memoPreviewSource).toContain('className="hyeni-v5-memo-label"');
    expect(memoPreviewSource).toContain('color: "var(--theme-accent-text)"');
    expect(memoPreviewSource).toContain('background: "var(--theme-accent)"');
    expect(memoPreviewSource).not.toContain("brand-rose");
    expect(memoPreviewSource).not.toContain("#B83262");
    expect(memoPreviewSource).not.toContain("#F779A8");
  });

  test("bottom tab icon chrome follows selected theme tokens", () => {
    const tabbarIconCss = sliceBetween(
      appCss,
      ".hyeni-v5-tabbar button .tabbar-icon {",
      ".hyeni-v5-tabbar button .tabbar-label",
    );
    const cartoonTabbarCss = sliceBetween(
      cartoonCss,
      "body .hyeni-v5-tabbar button.active {",
      "body .hyeni-v5-tabbar button:active",
    );

    expect(tabbarIconCss).toContain("background: var(--theme-accent-soft)");
    expect(tabbarIconCss).toContain("color: var(--theme-accent-text)");
    expect(tabbarIconCss).toContain("var(--theme-accent-line)");
    expect(cartoonTabbarCss).toContain("background: var(--hyeni-theme-gradient)");
    expect(cartoonTabbarCss).not.toContain("var(--cartoon-rose-gradient)");
  });
});
