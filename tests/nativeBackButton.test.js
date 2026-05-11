import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const app = readFileSync("src/App.jsx", "utf8");

function getBackButtonSection() {
  const start = app.indexOf("// ── Android 뒤로가기 버튼 처리");
  const end = app.indexOf("// ── Helpers", start);
  return start >= 0 && end > start ? app.slice(start, end) : "";
}

describe("native Android back button behavior", () => {
  test("closes parent and child memo chat pages before minimizing the app", () => {
    const section = getBackButtonSection();

    expect(section).toContain("showChildMemoPage");
    expect(section).toContain("activeView");
    expect(section).toContain("if (s.showChildMemoPage)");
    expect(section).toContain("setShowChildMemoPage(false)");
    expect(section).toContain('if (s.activeView !== "calendar")');
    expect(section).toContain('setActiveView("calendar")');

    expect(section.indexOf("if (s.showChildMemoPage)")).toBeLessThan(section.indexOf("CapApp.minimizeApp()"));
    expect(section.indexOf('if (s.activeView !== "calendar")')).toBeLessThan(section.indexOf("CapApp.minimizeApp()"));
  });
});
