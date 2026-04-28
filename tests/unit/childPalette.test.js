import { describe, it, expect } from "vitest";
import { CHILD_PALETTE, autoAssignColor } from "../../src/components/multichild/ChildPalette.js";

describe("CHILD_PALETTE", () => {
  it("정확히 6색이고 모두 고유 hex 값이다", () => {
    expect(CHILD_PALETTE).toHaveLength(6);
    expect(new Set(CHILD_PALETTE).size).toBe(6);
  });

  it("모든 색이 #RRGGBB 형식이다", () => {
    for (const color of CHILD_PALETTE) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("autoAssignColor", () => {
  it("이미 사용된 색을 피해 다음 색을 반환한다", () => {
    const used = ["#F779A8"];
    const next = autoAssignColor(used);
    expect(next).not.toBe("#F779A8");
    expect(CHILD_PALETTE).toContain(next);
  });

  it("모든 색이 사용되면 첫 색으로 순환한다", () => {
    expect(autoAssignColor([...CHILD_PALETTE])).toBe(CHILD_PALETTE[0]);
  });

  it("빈 배열이면 첫 색을 반환한다", () => {
    expect(autoAssignColor([])).toBe(CHILD_PALETTE[0]);
  });
});
