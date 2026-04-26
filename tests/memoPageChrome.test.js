import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const app = readFileSync("src/App.jsx", "utf8");

function getParentMemoPageSource() {
  const start = app.indexOf("function ParentMemoPage(");
  const end = app.indexOf("function DayTimetable(", start);
  return start >= 0 && end > start ? app.slice(start, end) : "";
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
