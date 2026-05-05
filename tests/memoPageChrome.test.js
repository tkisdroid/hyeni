import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

// Phase 5 #4 / B19: ParentMemoPage moved to src/components/memo/ParentMemoPage.jsx.
const parentMemoPageSrc = readFileSync("src/components/memo/ParentMemoPage.jsx", "utf8");

function getParentMemoPageSource() {
  return parentMemoPageSrc;
}

describe("today memo page chrome", () => {
  test("does not render fake phone status or unused right-side mark", () => {
    const source = getParentMemoPageSource();

    expect(source).not.toContain("hyeni-memo-status");
    expect(source).not.toContain("9:41");
    expect(source).not.toContain("▮▮ ▰");
    expect(source).not.toContain("hyeni-memo-voice");
    expect(source).not.toContain("음성 메모");
  });
});
