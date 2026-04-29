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

  test("keeps the parent bottom tabbar compact and lets tabs close management overlays", () => {
    expect(app).toContain("const parentBottomTabCount =");
    expect(app).toContain("gridTemplateColumns: `repeat(${parentBottomTabCount}, minmax(0, 1fr))`");
    expect(app).toContain("handleParentHomeTabClick");
    expect(app).toContain("closeParentManagementPanels()");
    expect(app).toContain("<span aria-hidden=\"true\">📅</span>일정");
    expect(app).toContain("<span aria-hidden=\"true\">📍</span>장소관리");
  });

  test("keeps frequent places managed inside the academy manager", () => {
    expect(app).toContain("function AcademyManager({ academies, savedPlaces");
    expect(app).toContain("onSavedPlacesSave");
    expect(app).toContain("자주 가는 장소");
  });

  test("supports adding friend-playdate safe places from the academy manager", () => {
    expect(app).toContain("openNewSafePlace");
    expect(app).toContain("+ 안전장소");
    expect(app).toContain("➕ 안전장소 추가");
    expect(app).toContain("is_playdate_safe");
    expect(app).toContain("public_place_id");
    expect(app).toContain("upsertPublicPlace");
  });

  test("uses the in-app confirmation dialog for unpair actions", () => {
    expect(app).toContain("function AppConfirmDialog");
    expect(app).toContain("const [confirmDialog, setConfirmDialog] = useState(null)");
    expect(app).toContain('title: "아이 연동 해제"');
    expect(app).toContain("onConfirm={openConfirmDialog}");
    expect(app).not.toContain("window.confirm(`${child.name} 연동을 해제할까요?`)");
  });
});
