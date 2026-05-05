import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const appCss = readFileSync("src/App.css", "utf8");
const indexCss = readFileSync("src/index.css", "utf8");
const tokenCss = readFileSync("src/styles/tokens.css", "utf8");
// Phase 5 #4: DESIGN/FF/make*Style moved to lib/styleHelpers.js, so the
// "appSource" reference now spans both App.jsx and the helper module for
// string-presence checks (component behavior is unchanged).
const appJsxSource = readFileSync("src/App.jsx", "utf8");
const styleHelpersSource = readFileSync("src/lib/styleHelpers.js", "utf8");
const appSource = `${appJsxSource}\n${styleHelpersSource}`;
const mainSource = readFileSync("src/main.jsx", "utf8");
const indexHtmlSource = readFileSync("index.html", "utf8");
const manifestSource = readFileSync("public/manifest.json", "utf8");
const themeSource = readFileSync("src/lib/theme.js", "utf8");
const pairingWizardSource = readFileSync("src/components/multichild/PairingWizard/PairingWizard.jsx", "utf8");
const childCountSource = readFileSync("src/components/multichild/PairingWizard/ChildCountStep.jsx", "utf8");
const childDetailsSource = readFileSync("src/components/multichild/PairingWizard/ChildDetailsStep.jsx", "utf8");
const colorPickerSource = readFileSync("src/components/multichild/PairingWizard/ColorPicker.jsx", "utf8");
const trialInviteSource = readFileSync("src/components/paywall/TrialInvitePrompt.jsx", "utf8");
const featureLockSource = readFileSync("src/components/paywall/FeatureLockOverlay.jsx", "utf8");
const autoRenewalSource = readFileSync("src/components/paywall/AutoRenewalDisclosure.jsx", "utf8");
const perChildToggleSource = readFileSync("src/components/multichild/SubscriptionScreen/PerChildToggle.jsx", "utf8");
const priceSummarySource = readFileSync("src/components/multichild/SubscriptionScreen/PriceSummary.jsx", "utf8");
const homeTabSource = readFileSync("src/components/multichild/HomeDashboard/HomeTab.jsx", "utf8");
const miniMapSource = readFileSync("src/components/multichild/HomeDashboard/MiniMap.jsx", "utf8");
const todayEventsSource = readFileSync("src/components/multichild/HomeDashboard/TodayEventsList.jsx", "utf8");
const todayMultiChildSource = readFileSync("src/components/multichild/HomeDashboard/TodayMultiChildView.jsx", "utf8");
const childSelectorSource = readFileSync("src/components/multichild/EventModal/ChildSelector.jsx", "utf8");
const childPermissionWizardSource = readFileSync("src/components/onboarding/ChildPermissionWizard.jsx", "utf8");
const birthdatePickerSource = readFileSync("src/components/birthdate/BirthdatePicker.jsx", "utf8");
const subscriptionManagementSource = readFileSync("src/components/settings/SubscriptionManagement.jsx", "utf8");
const paywallCopySource = readFileSync("src/lib/paywallCopy.js", "utf8");

describe("Soft Brand visual system", () => {
  test("global typography and browser chrome use Pretendard and the selected theme", () => {
    expect(indexHtmlSource).not.toContain("fonts.googleapis.com");
    expect(indexHtmlSource).not.toContain("fonts.gstatic.com");
    expect(indexHtmlSource).not.toContain("Noto+Sans+KR");
    expect(indexHtmlSource).toContain('<meta name="theme-color" content="#F779A8"');
    expect(manifestSource).toContain('"theme_color": "#F779A8"');
    expect(manifestSource).toContain('"background_color": "#FFF5FA"');

    expect(indexCss).toContain('@font-face');
    expect(indexCss).toContain('url("/fonts/PretendardVariable.woff2")');
    expect(indexCss).toContain('"Pretendard Variable", "Pretendard"');
    expect(indexCss).toContain("var(--theme-accent-soft");
    expect(tokenCss).toContain('--font-sans:');
    expect(tokenCss).toContain('"Pretendard Variable", "Pretendard"');
    expect(tokenCss).toContain("--tracking-tight:  0;");
    expect(themeSource).toContain('meta[name="theme-color"]');
    expect(themeSource).toContain('themeMeta.setAttribute("content", colors.accent)');

    for (const source of [appSource, mainSource, indexCss, tokenCss, childPermissionWizardSource, todayMultiChildSource]) {
      expect(source).not.toContain("BMHANNAPro");
      expect(source).not.toContain("Pretendard JP");
      expect(source).not.toContain("Noto Sans KR");
    }
    for (const source of [appSource, appCss, tokenCss, childPermissionWizardSource, homeTabSource]) {
      expect(source).not.toMatch(/letterSpacing:\s*-/);
      expect(source).not.toMatch(/letter-spacing:\s*-/);
    }
  });

  test("button-like controls prevent accidental text selection without disabling content selection globally", () => {
    expect(appCss).toContain(".hyeni-app-shell button");
    expect(appCss).toContain(".hyeni-app-shell a");
    expect(indexCss).toContain("button,\na,\n[role=\"button\"]");
    expect(indexCss).toContain("textarea {\n  -webkit-user-select: text;");
    expect(appCss).toContain("-webkit-user-select: none");
    expect(appCss).toContain("user-select: none");
    expect(appCss).toContain("-webkit-touch-callout: none");
    expect(appCss).toContain("-webkit-user-drag: none");
    expect(appCss).toContain('.hyeni-app-shell [style*="cursor: pointer"]');
    expect(appCss).toContain('.hyeni-app-shell [role="tab"]');
    expect(appCss).toContain('.hyeni-app-shell [role="radio"]');
    expect(appCss).not.toMatch(/\.hyeni-app-shell\s*\{[^}]*user-select:\s*none/i);
  });

  test("non-semantic app chrome uses the selected theme variables", () => {
    expect(appCss).toContain("--hyeni-theme-gradient");
    expect(appCss).toContain("--hyeni-pink: var(--theme-accent)");
    expect(appCss).toContain("--hyeni-pink-deep: var(--theme-accent-deep)");
    expect(appCss).toContain("--hyeni-pink-soft: var(--theme-accent-soft)");
    expect(appCss).toContain("var(--theme-accent)");
    expect(appCss).toContain(".hyeni-v5-tabbar button.active");
    expect(appCss).toContain(".hyeni-v5-calendar-day.selected");
    expect(appCss).toContain(".hyeni-memo-message.mine .hyeni-memo-bubble");
    expect(appCss).toContain(".hyeni-app-shell .btn-primary");
    expect(appCss).toContain(".hyeni-app-shell .input:focus");
    expect(appSource).toContain("linear-gradient(135deg,var(--theme-accent)");
    expect(appSource).toContain("input:focus,textarea:focus{border-color:var(--theme-accent)!important");
    expect(appSource).toContain('elevated: "var(--hyeni-theme-shadow)"');
    expect(appSource).toContain('sheet: "var(--hyeni-theme-shadow)"');
    expect(appSource).toContain('focus: "0 0 0 4px var(--theme-accent-soft)"');
    expect(appSource).toContain('border: "2px solid var(--theme-accent-line)"');
    expect(appSource).toContain('border: "1px solid var(--theme-accent-line)"');
    expect(appSource).not.toContain("rgba(247,121,168,0.30)");
    expect(appSource).not.toContain("rgba(180,120,150,0.20)");
    expect(appSource).not.toContain("rgba(255,228,239,0.8)");
    expect(appCss).not.toMatch(/rgba\(232,\s*121,\s*160/i);
    expect(appCss).not.toMatch(/rgba\(247,\s*121,\s*168/i);
    expect(appCss).not.toMatch(/rgba\(196,\s*68,\s*122/i);
    expect(appCss).not.toMatch(/rgba\(255,\s*228,\s*239/i);
    expect(appCss).not.toContain("linear-gradient(135deg, #f9a8d4, #e879a0)");
    expect(appCss).not.toContain("linear-gradient(135deg, #f779a8, #e65c92)");
  });

  test("first setup color is presented as an app theme while preserving live preview", () => {
    expect(childDetailsSource).toContain("앱 테마 색상");
    expect(childDetailsSource).toContain("앱 전체에 반영돼요");
    expect(colorPickerSource).toContain("applyThemeColor(color)");
    expect(mainSource).toContain("initThemeFromCache()");
    expect(appSource).toContain("initThemeFromCache()");
    expect(appSource).toContain("if (activeThemeColor) applyThemeColor(activeThemeColor)");
    expect(colorPickerSource).toContain("userSelect");
  });

  test("boot and error-boundary chrome use the selected theme variables", () => {
    expect(mainSource).toContain("initThemeFromCache()");
    expect(mainSource).toContain("var(--theme-accent-soft)");
    expect(mainSource).toContain("var(--theme-accent-text)");
    expect(mainSource).toContain("var(--hyeni-theme-gradient)");
    expect(mainSource).toContain("userSelect");
    expect(mainSource).not.toContain("#FFF0F7");
    expect(mainSource).not.toContain("#E879A0");
  });

  test("first setup wizard chrome follows the selected theme variables", () => {
    expect(pairingWizardSource).toContain("var(--theme-accent)");
    expect(pairingWizardSource).toContain("var(--theme-accent-soft)");
    expect(pairingWizardSource).toContain("var(--theme-accent-deep)");
    expect(childCountSource).toContain("var(--theme-accent)");
    expect(childCountSource).toContain("var(--theme-accent-soft)");
    expect(childCountSource).toContain("var(--theme-accent-text)");
  });

  test("subscription and paywall chrome follows the selected theme variables", () => {
    for (const source of [
      trialInviteSource,
      featureLockSource,
      autoRenewalSource,
      perChildToggleSource,
      priceSummarySource,
    ]) {
      expect(source).toContain("var(--theme-accent");
    }
    expect(trialInviteSource).toContain("var(--hyeni-theme-gradient)");
    expect(featureLockSource).toContain("var(--hyeni-theme-gradient)");
    expect(autoRenewalSource).toContain("var(--hyeni-theme-gradient)");
    expect(trialInviteSource).toContain("color-mix(in srgb, var(--fg-primary)");
    expect(featureLockSource).toContain("color-mix(in srgb, var(--fg-primary)");
    expect(autoRenewalSource).toContain("color-mix(in srgb, var(--fg-primary)");
  });

  test("multi-child dashboard chrome uses theme variables for shared accents", () => {
    expect(miniMapSource).toContain("var(--theme-accent-soft)");
    expect(miniMapSource).toContain("var(--theme-accent-line)");
    expect(miniMapSource).toContain("color-mix(in srgb, var(--fg-primary)");
    expect(todayEventsSource).toContain("var(--theme-accent)");
    expect(todayMultiChildSource).toContain("var(--theme-accent-text)");
    expect(childSelectorSource).toContain("var(--theme-accent)");
    expect(childSelectorSource).toContain("userSelect");
  });

  test("parent child status surfaces use full-width theme-led chrome", () => {
    const childStatusStart = appSource.indexOf("<span>아이 현황</span>");
    const childStatusEnd = appSource.indexOf("className=\"hyeni-v5-memo-mini\"", childStatusStart);
    const childStatusSource = appSource.slice(childStatusStart, childStatusEnd);

    expect(appCss).toContain(".hyeni-v5-kids-grid");
    expect(appCss).toContain("grid-template-columns: 1fr;");
    expect(childStatusSource).toContain("var(--theme-accent-soft)");
    expect(childStatusSource).toContain("var(--theme-accent-line)");
    expect(childStatusSource).toContain("var(--theme-accent-text)");
    expect(childStatusSource).not.toContain("#EEF2FF");
    expect(childStatusSource).not.toContain("#E0E7FF");
    expect(childStatusSource).not.toContain("#3730A3");
    expect(childStatusSource).not.toContain("#4338CA");
    expect(childStatusSource).not.toContain("#C7D2FE");
  });

  test("setup and management surfaces use theme variables for shared accents", () => {
    expect(childPermissionWizardSource).toContain("var(--theme-accent-text)");
    expect(childPermissionWizardSource).toContain("var(--hyeni-theme-gradient)");
    expect(birthdatePickerSource).toContain("var(--theme-accent)");
    expect(birthdatePickerSource).toContain("color-mix(in srgb, var(--fg-primary)");
    expect(birthdatePickerSource).toContain("userSelect");
    expect(subscriptionManagementSource).toContain("var(--theme-accent-line)");
    expect(subscriptionManagementSource).toContain("var(--theme-accent-soft)");
  });

  test("single-child calendar chrome follows the selected theme variables", () => {
    const noticeStart = appSource.indexOf("혜니캘린더는 아이와 함께 만들어갑니다");
    const calendarStart = appSource.lastIndexOf('aria-label="이전 달"', noticeStart);
    const calendarEnd = appSource.indexOf("{/* Academy quick pick */}", calendarStart);
    const calendarChrome = appSource.slice(calendarStart, calendarEnd);
    const noticeChrome = appSource.slice(noticeStart - 400, noticeStart + 400);
    const addStart = appSource.indexOf("openAiSchedule", noticeStart);
    const addChrome = appSource.slice(addStart, addStart + 1600);

    expect(calendarChrome).toContain("var(--theme-accent-text)");
    expect(calendarChrome).toContain("var(--theme-accent-line)");
    expect(calendarChrome).toContain("var(--hyeni-theme-shadow-soft)");
    expect(noticeChrome).toContain("var(--theme-accent-soft)");
    expect(noticeChrome).toContain("var(--theme-accent-line)");
    expect(noticeChrome).toContain("var(--theme-accent-text)");
    expect(addChrome).toContain("var(--hyeni-theme-gradient)");
    expect(addChrome).toContain("var(--hyeni-theme-shadow-soft)");
    expect(noticeChrome).not.toContain("#FFF0F7");
    expect(noticeChrome).not.toContain("#FCE7F3");
    expect(noticeChrome).not.toContain("#FBCFE8");
    expect(noticeChrome).not.toContain("#BE185D");
    expect(addChrome).not.toContain("linear-gradient(135deg,#F9A8D4,#E879A0)");
    expect(addChrome).not.toContain("rgba(232,121,160,0.25)");
  });

  test("home quick-action brand shortcuts use the selected theme variables", () => {
    const quickStart = appSource.indexOf("const quickPanelTone");
    const quickEnd = appSource.indexOf("const quickUtilityColumns", quickStart);
    const quickSource = appSource.slice(quickStart, quickEnd);

    expect(quickSource).toContain("var(--theme-accent-soft)");
    expect(quickSource).toContain("var(--theme-accent-line)");
    expect(quickSource).toContain("var(--theme-accent-text)");
    expect(quickSource).toContain("var(--hyeni-theme-shadow-soft)");
    expect(quickSource).not.toContain("linear-gradient(135deg,#FFF0F7,#FCE7F3)");
    expect(quickSource).not.toContain("linear-gradient(135deg,#FDF2F8,#FCE7F3)");
    expect(quickSource).not.toContain("rgba(232,121,160");
    expect(quickSource).not.toContain("rgba(190,24,93");
  });

  test("home shortcut icons and utility palettes stay simple and theme-led", () => {
    const quickStart = appSource.indexOf("const TABS");
    const quickEnd = appSource.indexOf("const quickUtilityColumns", quickStart);
    const quickSource = appSource.slice(quickStart, quickEnd);

    expect(quickSource).toContain('["calendar", "○ 달력"]');
    expect(quickSource).toContain('["maplist", "□ 장소관리"]');
    expect(quickSource).toContain('["maplist", "⌖ 장소"]');
    for (const icon of ["🏠", "📍", "🏫", "🤝", "🏆", "💎", "📞", "🎙️", "⚠️", "💌"]) {
      expect(quickSource).not.toContain(`icon: "${icon}"`);
    }
    expect(quickSource).not.toContain("var(--status-cautionary-subtle)");
    expect(quickSource).not.toContain("var(--status-positive-subtle)");
    expect(quickSource).not.toContain("#FDE68A");
    expect(quickSource).not.toContain("#ECFDF5");
    expect(quickSource).not.toContain("#FFF1F2");
    expect(quickSource).not.toContain("#FFE4E6");
  });

  test("schedule time picker clock uses the selected theme", () => {
    const timeInputCount = (appSource.match(/<input type="time"/g) || []).length;

    expect(timeInputCount).toBeGreaterThanOrEqual(4);
    expect(appSource).toContain('className="hyeni-time-input"');
    expect(appCss).toContain(".hyeni-time-input::-webkit-calendar-picker-indicator");
    expect(appCss).toContain("mask: url(\"data:image/svg+xml");
    expect(appCss).toContain("background-color: var(--theme-accent)");
  });

  test("memo preview and tracker stats use theme chrome instead of extra accent palettes", () => {
    const memoMiniStart = appCss.indexOf(".hyeni-v5-memo-mini {");
    const memoMiniEnd = appCss.indexOf(".hyeni-child-memo-card", memoMiniStart);
    const memoMiniCss = appCss.slice(memoMiniStart, memoMiniEnd);
    const trackerStart = appSource.indexOf("{/* 오늘 이동 동선 */}");
    const trackerSource = appSource.slice(trackerStart, trackerStart + 1600);

    expect(memoMiniCss).toContain("var(--theme-accent-soft)");
    expect(memoMiniCss).toContain("var(--theme-accent-line)");
    expect(memoMiniCss).toContain("var(--theme-accent-text)");
    expect(memoMiniCss).toContain("var(--hyeni-theme-shadow-soft)");
    expect(memoMiniCss).not.toContain("#fff7e5");
    expect(memoMiniCss).not.toContain("#fef3c7");
    expect(memoMiniCss).not.toContain("#92400e");
    expect(memoMiniCss).not.toContain("rgba(245, 158, 11");

    expect(trackerSource).toContain("var(--theme-accent-soft)");
    expect(trackerSource).toContain("var(--theme-accent-text)");
    expect(trackerSource).toContain("var(--bg-subtle)");
    expect(trackerSource).not.toContain("#3B82F6");
    expect(trackerSource).not.toContain("#60A5FA");
    expect(trackerSource).not.toContain("#F8FAFC");
  });

  test("home shell notifications and header accents use theme variables", () => {
    const toastStart = appSource.indexOf("{/* Toast */}");
    const toastEnd = appSource.indexOf("{/* RES-02", toastStart);
    const toastSource = appSource.slice(toastStart, toastEnd);
    const headerStart = appSource.indexOf("{/* ── Header Row 1");
    const headerEnd = appSource.indexOf("{/* Phase 5 KKUK-01", headerStart);
    const headerSource = appSource.slice(headerStart, headerEnd);
    const dashboardEventStart = appSource.indexOf("className={`hyeni-v5-event-card");
    const dashboardEventSource = appSource.slice(dashboardEventStart, dashboardEventStart + 700);

    for (const source of [toastSource, headerSource, dashboardEventSource]) {
      expect(source).toContain("var(--theme-accent");
    }
    expect(toastSource).not.toContain("DESIGN.colors.pinkSoft");
    expect(toastSource).not.toContain("DESIGN.colors.brand");
    expect(headerSource).not.toContain("DESIGN.colors.pinkLine");
    expect(headerSource).not.toContain("DESIGN.colors.pinkText");
    expect(dashboardEventSource).not.toContain("DESIGN.colors.pinkSoft");
    expect(dashboardEventSource).not.toContain("DESIGN.colors.pink");
  });

  test("schedule add modal controls follow the selected theme variables", () => {
    const modalStart = appSource.indexOf("{/* ── ADD MODAL ── */}");
    const modalEnd = appSource.indexOf("<button onClick={addEvent}", modalStart);
    const modalSource = appSource.slice(modalStart, modalEnd);

    expect(modalSource).toContain("var(--theme-accent)");
    expect(modalSource).toContain("var(--theme-accent-soft)");
    expect(modalSource).toContain("var(--theme-accent-line)");
    expect(modalSource).toContain("var(--theme-accent-text)");
    expect(modalSource).toContain("var(--hyeni-theme-gradient)");
    expect(modalSource).not.toContain("#FFF0F7");
    expect(modalSource).not.toContain("#F9A8D4");
    expect(modalSource).not.toContain("#E879A0");
    expect(modalSource).not.toContain("#BE185D");
    expect(modalSource).not.toContain("#DB2777");
    expect(modalSource).not.toContain("#FBCFE8");
  });

  test("calendar weekends and category chips do not add extra fixed accent colors", () => {
    const calendarStart = appSource.indexOf("{DAYS_KO.map((d) => <div key={d}");
    const calendarEnd = appSource.indexOf("{/* Academy quick pick */}", calendarStart);
    const calendarSource = appSource.slice(calendarStart, calendarEnd);
    const addModalStart = appSource.indexOf("<label style={labelSt}>🏷️ 종류");
    const addModalCategorySource = appSource.slice(addModalStart, addModalStart + 900);
    const academyStart = appSource.indexOf("<label style={{ fontSize: 12, fontWeight: 700, color: \"var(--fg-secondary)\", marginBottom: 6, display: \"block\" }}>카테고리</label>");
    const academyCategorySource = appSource.slice(academyStart, academyStart + 900);

    expect(calendarSource).toContain("var(--fg-secondary)");
    expect(calendarSource).not.toContain("#F87171");
    expect(calendarSource).not.toContain("#60A5FA");
    expect(calendarSource).not.toContain("DESIGN.colors.parent");

    for (const source of [addModalCategorySource, academyCategorySource]) {
      expect(source).toContain("var(--theme-accent-soft)");
      expect(source).toContain("var(--theme-accent-text)");
      expect(source).toContain("var(--theme-accent-line)");
      expect(source).not.toContain("cat.color");
      expect(source).not.toContain("cat.bg");
    }
  });

  test("product calm redesign keeps dashboard surfaces compact and theme-led", () => {
    const productPassStart = appCss.indexOf("Product Calm redesign pass");
    const productPassCss = appCss.slice(productPassStart);

    expect(productPassStart).toBeGreaterThan(-1);
    expect(productPassCss).toContain("--hyeni-product-border");
    expect(productPassCss).toContain("--hyeni-product-shadow");
    expect(productPassCss).toContain(".hyeni-v5-parent-main");
    expect(productPassCss).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(productPassCss).toContain(".hyeni-v5-action-chip > span:first-child");
    expect(productPassCss).toContain("color: var(--theme-accent-text)");
    expect(productPassCss).toContain(".hyeni-v5-event-icon");
    expect(productPassCss).toContain("background: var(--theme-accent-soft)");
    expect(productPassCss).toContain(".hyeni-v5-event-tag");
    expect(productPassCss).toContain('section[aria-label="아이 기기 사용 지표"]');
    expect(productPassCss).toContain("border-radius: 14px");
    expect(productPassCss).toContain("box-shadow: none");
    expect(appSource).toContain('shell: "var(--hyeni-product-canvas)"');
    expect(appSource).toContain('background: "var(--hyeni-product-canvas)"');
    expect(appSource).toContain("<AppBrandLogo size={88} radius={22} />");
    expect(productPassCss).not.toContain("border-radius: 30px");
    expect(productPassCss).not.toContain("dashboard-card");
  });

  test("map and saved-place management controls follow the selected theme variables", () => {
    const mapPickerStart = appSource.indexOf("function MapPicker");
    const mapPickerEnd = appSource.indexOf("// ─────────────────────────────────────────────────────────────────────────────\n// Alert Banner", mapPickerStart);
    const mapPickerSource = appSource.slice(mapPickerStart, mapPickerEnd);
    const academyStart = appSource.indexOf("function AcademyManager");
    const academyEnd = appSource.indexOf("function RouteOverlay", academyStart);
    const academySource = appSource.slice(academyStart, academyEnd);
    const savedPlaceStart = appSource.indexOf("function SavedPlaceManager");
    const savedPlaceEnd = appSource.indexOf("function FeedbackModal", savedPlaceStart);
    const savedPlaceSource = appSource.slice(savedPlaceStart, savedPlaceEnd);

    for (const source of [mapPickerSource, academySource, savedPlaceSource]) {
      expect(source).toContain("var(--theme-accent");
      expect(source).toContain("var(--hyeni-theme-gradient)");
      expect(source).not.toContain("#FFF0F7");
      expect(source).not.toContain("#FFF7FB");
      expect(source).not.toContain("#F9A8D4");
      expect(source).not.toContain("#E879A0");
      expect(source).not.toContain("#BE185D");
      expect(source).not.toContain("#FBCFE8");
      expect(source).not.toContain("linear-gradient(135deg,#E879A0,#BE185D)");
    }
  });

  test("location map saved-place accents follow the selected theme variables", () => {
    const locationMapStart = appSource.indexOf("function LocationMapView");
    const locationMapEnd = appSource.indexOf("function AiScheduleModal", locationMapStart);
    const locationMapSource = appSource.slice(locationMapStart, locationMapEnd);

    expect(locationMapSource).toContain("var(--theme-accent)");
    expect(locationMapSource).toContain("var(--theme-accent-soft)");
    expect(locationMapSource).toContain("var(--theme-accent-line)");
    expect(locationMapSource).toContain("var(--theme-accent-text)");
    expect(locationMapSource).toContain("var(--hyeni-theme-gradient)");
    expect(locationMapSource).toContain("var(--hyeni-theme-shadow-soft)");
    expect(locationMapSource).not.toContain("#FFF0F7");
    expect(locationMapSource).not.toContain("#FDF2F8");
    expect(locationMapSource).not.toContain("#FCE7F3");
    expect(locationMapSource).not.toContain("#BE185D");
    expect(locationMapSource).not.toContain("#DB2777");
    expect(locationMapSource).not.toContain("rgba(232,121,160");
    expect(locationMapSource).not.toContain("rgba(190,24,93");
    expect(locationMapSource).not.toContain("linear-gradient(135deg,#F472B6,#DB2777)");
  });

  test("first-run connection surfaces follow the selected theme variables", () => {
    const parentSetupStart = appSource.indexOf("가족 연결을 시작해요");
    const parentSetupEnd = appSource.indexOf("KID-804DF582", parentSetupStart);
    const parentSetupSource = appSource.slice(parentSetupStart, parentSetupEnd);
    const confirmStart = appSource.indexOf("function AppConfirmDialog");
    const confirmEnd = appSource.indexOf("function RoleSetupModal", confirmStart);
    const confirmSource = appSource.slice(confirmStart, confirmEnd);
    const roleStart = appSource.indexOf("function RoleSetupModal");
    const roleEnd = appSource.indexOf("function ParentAuthScreen", roleStart);
    const roleSource = appSource.slice(roleStart, roleEnd);
    const childPairStart = appSource.indexOf("function ChildPairInput");
    const childPairEnd = appSource.indexOf("function AcademyManager", childPairStart);
    const childPairSource = appSource.slice(childPairStart, childPairEnd);

    for (const source of [parentSetupSource, confirmSource, roleSource, childPairSource]) {
      expect(source).toContain("var(--theme-accent");
      expect(source).toContain("var(--hyeni-theme-shadow");
      expect(source).not.toContain("#BE185D");
      expect(source).not.toContain("#E879A0");
      expect(source).not.toContain("#FDF2F8");
      expect(source).not.toContain("rgba(190,24,93");
      expect(source).not.toContain("rgba(244,114,182");
    }
  });

  test("route, timetable, contact, and feedback surfaces use shared theme accents", () => {
    const routeStart = appSource.indexOf("function RouteOverlay");
    const routeEnd = appSource.indexOf("function getMemoTime", routeStart);
    const routeSource = appSource.slice(routeStart, routeEnd);
    const timetableStart = appSource.indexOf("function DayTimetable");
    const timetableEnd = appSource.indexOf("function StickerBookModal", timetableStart);
    const timetableSource = appSource.slice(timetableStart, timetableEnd);
    const phoneStart = appSource.indexOf("function PhoneSettingsModal");
    const phoneEnd = appSource.indexOf("function SavedPlaceManager", phoneStart);
    const phoneSource = appSource.slice(phoneStart, phoneEnd);
    const feedbackStart = appSource.indexOf("function FeedbackModal");
    const feedbackEnd = appSource.indexOf("function ChildCallCard", feedbackStart);
    const feedbackSource = appSource.slice(feedbackStart, feedbackEnd);
    const childCallStart = appSource.indexOf("function ChildCallCard");
    const childCallEnd = appSource.indexOf("function ChildTrackerOverlay", childCallStart);
    const childCallSource = appSource.slice(childCallStart, childCallEnd);

    for (const source of [routeSource, timetableSource, phoneSource, feedbackSource, childCallSource]) {
      expect(source).toContain("var(--theme-accent");
    }
    expect(routeSource).toContain("var(--hyeni-theme-gradient)");
    expect(routeSource).toContain("var(--hyeni-theme-shadow-soft)");
    expect(routeSource).toContain("childProfile");
    expect(routeSource).toContain("currentMarkerEmoji");
    expect(routeSource).toContain("기존 아이 이모티콘");
    expect(routeSource).not.toContain("bunnySvg");
    expect(routeSource).not.toContain("rgba(236,72,153");
    expect(routeSource).not.toContain("rgba(244,114,182");
    expect(routeSource).not.toContain("#F9A8D4");
    expect(routeSource).not.toContain("#FBCFE8");
    expect(routeSource).not.toContain("linear-gradient(135deg, #EC4899, #BE185D)");
    expect(routeSource).not.toContain("linear-gradient(135deg, #EC4899, #F472B6)");
    expect(timetableSource).not.toContain("linear-gradient(to bottom, #E879A0");
    expect(timetableSource).not.toContain("#FFF0F7");
    expect(phoneSource).not.toContain("linear-gradient(135deg,#E879A0,#BE185D)");
    expect(feedbackSource).not.toContain("#FBCFE8");
    expect(feedbackSource).not.toContain("linear-gradient(135deg,#E879A0,#BE185D)");
    expect(childCallSource).not.toContain("#BE185D");
    expect(childCallSource).not.toContain("#FFF0F7");
  });

  test("sticker book and kkuk receiver avoid legacy mascot chrome", () => {
    const stickerStart = appSource.indexOf("function StickerBookModal");
    const stickerEnd = appSource.indexOf("// Audio Recorder", stickerStart);
    const stickerSource = appSource.slice(stickerStart, stickerEnd);
    const kkukStart = appSource.indexOf("{/* ── 꾹 수신 전체화면 오버레이 ── */}");
    const kkukSource = appSource.slice(kkukStart, kkukStart + 2400);

    expect(appSource).not.toContain("const BunnyMascot");
    expect(stickerSource).toContain("var(--theme-accent-soft)");
    expect(stickerSource).toContain("var(--theme-accent-line)");
    expect(stickerSource).toContain("var(--theme-accent-text)");
    expect(stickerSource).not.toContain("#FFF0F5");
    expect(stickerSource).not.toContain("#F9A8D4");
    expect(stickerSource).not.toContain("#EC4899");
    expect(kkukSource).toContain("showKkukReceived.emoji");
    expect(kkukSource).toContain("var(--theme-accent-line)");
    expect(kkukSource).toContain("var(--theme-accent-soft)");
    expect(kkukSource).not.toContain("<svg width=\"120\"");
    expect(kkukSource).not.toContain("#FFF0F7");
    expect(kkukSource).not.toContain("#FFB3D1");
  });

  test("inline memo section follows the selected theme variables", () => {
    const memoStart = appSource.indexOf("function MemoSection");
    const memoEnd = appSource.indexOf("function ParentMemoPage", memoStart);
    const memoSource = appSource.slice(memoStart, memoEnd);

    expect(memoSource).toContain("var(--theme-accent)");
    expect(memoSource).toContain("var(--theme-accent-soft)");
    expect(memoSource).toContain("var(--theme-accent-line)");
    expect(memoSource).toContain("var(--theme-accent-text)");
    expect(memoSource).toContain("var(--hyeni-theme-gradient)");
    expect(memoSource).toContain("var(--hyeni-theme-shadow-soft)");
    expect(memoSource).not.toContain("#FFF5FA");
    expect(memoSource).not.toContain("#FDF2F8");
    expect(memoSource).not.toContain("#FCE7F3");
    expect(memoSource).not.toContain("#FBCFE8");
    expect(memoSource).not.toContain("#E879A0");
    expect(memoSource).not.toContain("#BE185D");
    expect(memoSource).not.toContain("rgba(232,121,160");
    expect(memoSource).not.toContain("linear-gradient(135deg,#E879A0,#BE185D)");
  });

  test("schedule quick-add copy avoids robot-style AI presentation", () => {
    const modalStart = appSource.indexOf("function AiScheduleModal");
    const modalIntroEnd = appSource.indexOf("{/* 3가지 입력 방식 버튼 */}", modalStart);
    const modalIntro = appSource.slice(modalStart, modalIntroEnd);
    const parentQuickAddStart = appSource.indexOf('className="hyeni-v5-ai-button"');
    const parentQuickAdd = appSource.slice(parentQuickAddStart, parentQuickAddStart + 500);
    const singleQuickAddStart = appSource.indexOf("openAiSchedule", appSource.indexOf("혜니캘린더는 아이와 함께 만들어갑니다"));
    const singleQuickAdd = appSource.slice(singleQuickAddStart, singleQuickAddStart + 700);

    expect(modalIntro).toContain("일정 빠른 입력");
    expect(parentQuickAdd).toContain("빠른 일정입력");
    expect(singleQuickAdd).toContain("빠른 일정입력");
    for (const source of [modalIntro, parentQuickAdd, singleQuickAdd]) {
      expect(source).not.toContain("🤖");
      expect(source).not.toContain("AI로 일정입력");
    }
    expect(appSource).not.toContain("AI가 분석하고 있어요");
    expect(appSource).not.toContain("AI 저장 완료");
    expect(appSource).not.toContain('alert.title.startsWith("🤖")');
    expect(appSource).toContain('replace(/^🤖\\s*(AI:\\s*)?/i, "")');
    expect(paywallCopySource).toContain("빠른 일정 정리");
    expect(paywallCopySource).not.toContain("AI 분석");
    expect(paywallCopySource).not.toContain("AI 일정 분석");
    expect(paywallCopySource).not.toContain("AI 음성");
    expect(paywallCopySource).not.toContain('emoji: "🤖"');
  });

  test("marker palettes remain hex colors because marker styles append hex alpha suffixes", () => {
    const paletteMatch = appSource.match(/const CHILD_MARKER_COLORS = \[([^\]]+)\]/);
    expect(paletteMatch?.[1]).toBeTruthy();
    expect(paletteMatch?.[1]).not.toContain("var(");
  });
});
