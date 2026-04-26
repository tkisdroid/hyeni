import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const app = readFileSync("src/App.jsx", "utf8");

function extractFunctionBody(name) {
  const match = app.match(new RegExp(`const ${name} = \\([^)]*\\) => \\{([\\s\\S]*?)\\n    \\};`));
  return match?.[1] || "";
}

describe("parent location management entry", () => {
  test("opens academy management from the parent bottom location tab", () => {
    const body = extractFunctionBody("handleParentMapTabClick");

    expect(body).toContain("openAcademyManagement()");
    expect(body).not.toContain('setActiveView("maplist")');
  });

  test("keeps frequent places managed inside the academy manager", () => {
    expect(app).toContain("function AcademyManager({ academies, savedPlaces");
    expect(app).toContain("onSavedPlacesSave");
    expect(app).toContain("자주 가는 장소");
  });
});
