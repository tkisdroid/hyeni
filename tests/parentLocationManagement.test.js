import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const appSrc = readFileSync("src/App.jsx", "utf8");
const academyManagerSrc = readFileSync("src/components/place-management/AcademyManager.jsx", "utf8");
const placeManagerScreenSrc = readFileSync("src/components/settings/PlaceManagerScreen.jsx", "utf8");
// Phase 5 #4 / B9: PairingModal moved to components/pairing/PairingModal.jsx — unpair confirm dialog there.
const pairingModalSrc = readFileSync("src/components/pairing/PairingModal.jsx", "utf8");
const app = `${appSrc}\n${academyManagerSrc}\n${placeManagerScreenSrc}\n${pairingModalSrc}`;
const academyCardSrc = readFileSync("src/components/place-management/AcademyCard.jsx", "utf8");
const dangerCardSrc = readFileSync("src/components/place-management/DangerCard.jsx", "utf8");
const savedPlacesSrc = readFileSync("src/components/place-management/SavedPlacesSection.jsx", "utf8");

function extractFunctionBody(name) {
  const match = app.match(new RegExp(`const ${name} = \\([^)]*\\) => \\{([\\s\\S]*?)\\n    \\};`));
  return match?.[1] || "";
}

describe("parent location management entry", () => {
  test("opens academy management from the parent bottom location tab", () => {
    const body = extractFunctionBody("handleParentMapTabClick");

    expect(body).toContain("setShowPlaceManager(true)");
    expect(body).toContain("setShowAcademyMgr(false)");
    expect(body).not.toContain('setActiveView("maplist")');
    expect(placeManagerScreenSrc).toContain('className="settings-back"');
    expect(placeManagerScreenSrc).toContain('aria-label="뒤로"');
  });

  test("keeps the parent bottom tabbar compact and lets tabs close management overlays", () => {
    expect(app).toContain("const parentBottomTabCount =");
    expect(app).toContain("gridTemplateColumns: `repeat(${parentBottomTabCount}, minmax(0, 1fr))`");
    expect(app).toContain("handleParentHomeTabClick");
    expect(app).toContain("closeParentManagementPanels()");
    // Phase E P2: 탭 라벨의 시각 마커가 raw emoji → Lucide SVG 로 통일됨.
    // 텍스트(일정/장소관리)는 동일 위치, 마커만 <Calendar/MapPin> 컴포넌트로.
    expect(app).toContain("<CalendarPlus size={16} strokeWidth={1.75} />");
    expect(app).toContain('<span className="tabbar-label">일정등록</span>');
    expect(app).toContain("<MapPin size={16} strokeWidth={1.75} />");
    expect(app).toContain('<span className="tabbar-label">장소</span>');
  });

  test("keeps frequent places managed inside the academy manager", () => {
    const managerSource = academyManagerSrc;

    expect(managerSource).toContain("academies,");
    expect(managerSource).toContain("savedPlaces = []");
    expect(app).toContain("onSavedPlacesSave");
    expect(app).toContain("자주 가는 장소");
  });

  test("keeps safe and danger places under the single place management menu", () => {
    expect(app).toContain("dangerZones = []");
    expect(app).toContain("onDangerZoneAdd");
    expect(app).toContain("onDangerZoneDelete");
    expect(dangerCardSrc).toContain("+ 조심할 곳");
    expect(dangerCardSrc).toContain("조심할 곳");
    expect(app).toContain('label: "장소관리"');
    expect(app).not.toContain('label: "학원관리"');
    expect(app).not.toContain('label: "위험지역"');
  });

  test("renames 위험장소 → 조심할 곳 in user-facing UI strings while keeping data keys", () => {
    expect(app).toContain("조심할 곳을 삭제할까요?");
    expect(app).toContain("⚠️ 조심할 곳 설정");
    expect(app).toContain("➕ 조심할 곳 추가");
    expect(app).toContain("🗺️ 지도에서 조심할 곳 선택");
    expect(app).toContain("조심할 곳 저장");
    expect(app).toContain("보조 보호자는 조심할 곳을 수정할 수 없어요.");
    expect(app).toContain("조심할 곳이 삭제됐어요");
    expect(app).not.toContain('"위험장소를 삭제할까요?"');
    expect(app).not.toContain('title="⚠️ 위험장소 설정"');
    expect(app).not.toContain("➕ 위험장소 추가");
    expect(app).toContain("dangerZones");
    expect(app).toContain("dangerForm");
    expect(app).toContain("DANGER_TYPES");
  });

  test("place manager renders three sub-components in priority order: AcademyCard → DangerCard → SavedPlacesSection", () => {
    expect(app).toContain('from "./components/place-management/AcademyCard.jsx"');
    expect(app).toContain('from "./components/place-management/DangerCard.jsx"');
    expect(app).toContain('from "./components/place-management/SavedPlacesSection.jsx"');
    const academyIdx = app.indexOf("<AcademyCard");
    const dangerIdx = app.indexOf("<DangerCard");
    const savedIdx = app.indexOf("<SavedPlacesSection");
    expect(academyIdx).toBeGreaterThan(0);
    expect(dangerIdx).toBeGreaterThan(academyIdx);
    expect(savedIdx).toBeGreaterThan(dangerIdx);
  });

  test("sub-components use Wanted DS .card baseline and design tokens (no inline hex/magic px)", () => {
    expect(academyCardSrc).toContain('className="card"');
    expect(dangerCardSrc).toContain('className="card"');
    expect(academyCardSrc).toMatch(/var\(--space-/);
    expect(dangerCardSrc).toMatch(/var\(--status-cautionary-subtle\)/);
    expect(savedPlacesSrc).toMatch(/var\(--font-sans\)/);
    expect(academyCardSrc).not.toMatch(/#[0-9A-Fa-f]{3,6}/);
    expect(dangerCardSrc).not.toMatch(/var\(--status-negative-strong\)/);
  });

  test("place manager uses a top back button and keeps the save action at the bottom", () => {
    const managerSource = academyManagerSrc;

    expect(managerSource).toContain('aria-label="장소관리 닫기"');
    expect(managerSource).toContain("onClick={onClose}");
    expect(managerSource).toContain("저장하고 닫기");
    expect(managerSource).not.toContain("← 저장");
  });

  test("multi-child quick switch does not duplicate the bottom home tab", () => {
    const quickSwitchStart = app.indexOf("Multi-child quick switch");
    const quickSwitchSource = app.slice(quickSwitchStart, app.indexOf('{activeView === "calendar"', quickSwitchStart));

    expect(quickSwitchSource).not.toContain('aria-label="가족 홈으로 돌아가기"');
    expect(quickSwitchSource).not.toContain("🏡 홈");
  });

  test("schedule creation can choose academies and frequent places as location sources", () => {
    // buildSchedulePlaceOptions moved to lib/placeFormat.js (Phase 5 #4 / A2)
    const placeFormatSrc = readFileSync("src/lib/placeFormat.js", "utf8");
    expect(placeFormatSrc).toContain("export function buildSchedulePlaceOptions");
    expect(placeFormatSrc).toContain('source: "academy"');
    expect(placeFormatSrc).toContain('source: "saved_place"');
    expect(app).toContain("buildSchedulePlaceOptions");
    expect(app).toContain("const schedulePlaceOptions = useMemo");
    expect(app).toContain("schedulePlaceOptions.map");
  });

  test("academy schedule reconciliation treats location changes as event changes", () => {
    const managerStart = app.indexOf("if (showAcademyMgr) return");
    const managerSource = app.slice(managerStart, managerStart + 6000);
    expect(managerSource).toContain("JSON.stringify(oldAc.location || null)");
    expect(managerSource).toContain("JSON.stringify(nextAc.location || null)");
  });

  test("supports adding friend-playdate safe places from the academy manager", () => {
    expect(app).toContain("openNewSafePlace");
    expect(savedPlacesSrc).toContain("🛡️ 안전장소 추가");
    expect(app).toContain("➕ 안전장소 추가");
    expect(app).toContain("is_playdate_safe");
    expect(app).toContain("public_place_id");
    expect(app).toContain("upsertPublicPlace");
  });

  test("uses the in-app confirmation dialog for unpair actions", () => {
    // AppConfirmDialog moved to components/dialogs/AppConfirmDialog.jsx (Phase 5 #4 / B1)
    const dialogSrc = readFileSync("src/components/dialogs/AppConfirmDialog.jsx", "utf8");
    expect(dialogSrc).toContain("export function AppConfirmDialog");
    expect(app).toContain("AppConfirmDialog");
    expect(app).toContain("const [confirmDialog, setConfirmDialog] = useState(null)");
    expect(app).toContain('title: "아이 연동 해제"');
    expect(app).toContain("onConfirm={openConfirmDialog}");
    expect(app).not.toContain("window.confirm(`${child.name} 연동을 해제할까요?`)");
  });
});
