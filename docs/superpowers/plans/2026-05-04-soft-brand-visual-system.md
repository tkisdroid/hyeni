# Soft Brand Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the app-wide visual system so Hyeni looks simpler, more consistent, theme-driven, and production-ready without changing functional behavior.

**Architecture:** Keep the implementation CSS-first. Use existing theme variables from `src/lib/theme.js` and the current setup color picker flow, then update app surfaces, calendar, tabbar, memo, and button/tap reliability through `src/App.css` and minimal static visual constants in `src/App.jsx`.

**Tech Stack:** React 19, Vite 7, plain CSS, Vitest, Playwright MCP/browser verification.

---

## File Map

- `tests/softBrandVisualSystem.test.js`: source-level regression tests for non-selectable controls, theme-variable adoption, and setup color copy.
- `src/App.css`: app-wide Soft Brand surfaces, no-select button behavior, theme-driven calendar/tabbar/memo/tool styling.
- `src/App.jsx`: only static visual constants and Korean copy that cannot be reached from CSS; do not alter handlers, state, effects, API calls, routing, or conditionals.
- `src/components/multichild/PairingWizard/ChildDetailsStep.jsx`: clarify that selected color is the app/family theme.
- `src/components/multichild/PairingWizard/ColorPicker.jsx`: preserve `applyThemeColor(color)` live preview and make color buttons non-selectable.
- `docs/superpowers/specs/2026-05-04-soft-brand-visual-system-design.md`: already updated and committed; do not rewrite during implementation.

## Task 1: Add Visual-System Regression Tests

**Files:**
- Create: `tests/softBrandVisualSystem.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/softBrandVisualSystem.test.js`:

```js
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const appCss = readFileSync("src/App.css", "utf8");
const appSource = readFileSync("src/App.jsx", "utf8");
const childDetailsSource = readFileSync("src/components/multichild/PairingWizard/ChildDetailsStep.jsx", "utf8");
const colorPickerSource = readFileSync("src/components/multichild/PairingWizard/ColorPicker.jsx", "utf8");

describe("Soft Brand visual system", () => {
  test("button-like controls prevent accidental text selection without disabling content selection globally", () => {
    expect(appCss).toContain(".hyeni-app-shell button");
    expect(appCss).toContain("-webkit-user-select: none");
    expect(appCss).toContain("user-select: none");
    expect(appCss).toContain("-webkit-touch-callout: none");
    expect(appCss).not.toMatch(/\.hyeni-app-shell\s*\{[^}]*user-select:\s*none/i);
  });

  test("non-semantic app chrome uses the selected theme variables", () => {
    expect(appCss).toContain("--hyeni-theme-gradient");
    expect(appCss).toContain("var(--theme-accent)");
    expect(appCss).toContain(".hyeni-v5-tabbar button.active");
    expect(appCss).toContain(".hyeni-v5-calendar-day.selected");
    expect(appCss).toContain(".hyeni-memo-message.mine .hyeni-memo-bubble");
    expect(appSource).toContain("linear-gradient(135deg,var(--theme-accent)");
  });

  test("first setup color is presented as an app theme while preserving live preview", () => {
    expect(childDetailsSource).toContain("앱 테마 색상");
    expect(childDetailsSource).toContain("앱 전체에 반영돼요");
    expect(colorPickerSource).toContain("applyThemeColor(color)");
    expect(colorPickerSource).toContain("userSelect");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- tests/softBrandVisualSystem.test.js
```

Expected: FAIL because `--hyeni-theme-gradient`, the no-select block, theme-driven calendar/tabbar/memo CSS, and setup copy do not exist yet.

- [ ] **Step 3: Commit the failing test only if the project workflow requires red commits**

Do not commit the failing test by itself in this workspace. Keep it unstaged until implementation passes, because the current worktree already has unrelated user changes.

## Task 2: Apply Soft Brand Tokens And Tap Reliability

**Files:**
- Modify: `src/App.css`
- Modify: `src/App.jsx`

- [ ] **Step 1: Update app CSS variables and control selection rules**

In `src/App.css`, extend the first `:root` block and button/control section with:

```css
:root {
  --hyeni-theme-gradient: linear-gradient(135deg, var(--theme-accent) 0%, var(--theme-accent-deep) 100%);
  --hyeni-theme-shadow: 0 10px 24px color-mix(in srgb, var(--theme-accent) 20%, transparent);
  --hyeni-theme-shadow-soft: 0 6px 18px color-mix(in srgb, var(--theme-accent) 12%, transparent);
  --hyeni-surface-warm: #fffbf8;
  --hyeni-surface-cream: #fff8f2;
}

.hyeni-app-shell button,
.hyeni-app-shell [role="button"],
.hyeni-app-shell .btn,
.hyeni-app-shell .hyeni-v5-action-chip,
.hyeni-app-shell .hyeni-v5-event-card,
.hyeni-app-shell .hyeni-v5-calendar-day,
.hyeni-app-shell .hyeni-v5-tabbar button,
.hyeni-app-shell .hyeni-tool-button,
.hyeni-app-shell .hyeni-memo-quick-row button,
.hyeni-app-shell .hyeni-memo-input-shell button {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}
```

- [ ] **Step 2: Update `DESIGN.gradients` in `src/App.jsx`**

Replace only the static visual strings in `DESIGN.gradients`:

```js
shell: "radial-gradient(260px 180px at 10% 0%, color-mix(in srgb, var(--theme-accent) 16%, transparent) 0%, transparent 64%), radial-gradient(280px 220px at 100% 100%, rgba(245,158,11,0.10) 0%, transparent 62%), linear-gradient(180deg,#FFFBF8 0%,#F8F4F6 100%)",
page: "linear-gradient(180deg,#FFFBF8 0%,#F8F4F6 100%)",
primary: "linear-gradient(135deg,var(--theme-accent) 0%,var(--theme-accent-deep) 100%)",
hero: "linear-gradient(135deg,color-mix(in srgb, var(--theme-accent) 28%, #FFFFFF) 0%,var(--theme-accent) 100%)",
child: "linear-gradient(135deg,var(--theme-accent) 0%,var(--theme-accent-deep) 100%)",
warm: "linear-gradient(135deg,#FFFFFF 0%,var(--theme-accent-soft) 100%)",
onboard: "radial-gradient(460px 340px at 50% 0%, color-mix(in srgb, var(--theme-accent) 16%, transparent) 0%, transparent 62%), linear-gradient(180deg,#FFFBF8 0%,#F7F2F5 100%)",
map: "radial-gradient(260px 210px at 28% 24%, color-mix(in srgb, var(--theme-accent) 12%, transparent) 0%, transparent 62%), radial-gradient(300px 220px at 72% 64%, rgba(96,165,250,0.12) 0%, transparent 60%), linear-gradient(180deg,#FFFBF8 0%,#F4F1F5 100%)",
```

Do not change `DESIGN.colors.brand` or `DESIGN.colors.pink`, because marker color math appends alpha suffixes to some hex values.

- [ ] **Step 3: Run the focused test**

Run:

```bash
npm run test -- tests/softBrandVisualSystem.test.js
```

Expected: still FAIL until setup copy and component CSS are finished.

## Task 3: Propagate Theme Color Through Setup, Calendar, Tabbar, Memo, And Tools

**Files:**
- Modify: `src/components/multichild/PairingWizard/ChildDetailsStep.jsx`
- Modify: `src/components/multichild/PairingWizard/ColorPicker.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Clarify setup color copy**

In `ChildDetailsStep.jsx`, change the color label block to:

```jsx
<div style={{ marginTop: 20 }}>
  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "var(--fg-primary)" }}>앱 테마 색상</div>
  <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "var(--fg-tertiary)", lineHeight: 1.45 }}>
    선택한 색은 자녀 표시와 앱 전체 강조색에 함께 반영돼요.
  </p>
  <ColorPicker
    selected={child.color_hex}
    usedColors={usedColors.filter((c) => c !== child.color_hex)}
    onChange={(c) => update({ color_hex: c })}
  />
</div>
```

- [ ] **Step 2: Make color swatches tap-safe**

In `ColorPicker.jsx`, add these style properties to the color button:

```js
userSelect: "none",
WebkitUserSelect: "none",
WebkitTouchCallout: "none",
touchAction: "manipulation",
```

Do not remove `applyThemeColor(color)`.

- [ ] **Step 3: Update app-wide themed CSS**

In `src/App.css`, update these existing selectors to use theme variables and softer surfaces:

```css
.hyeni-v1-hero-count,
.hyeni-v1-live-meta,
.hyeni-v5-count-accent,
.hyeni-v5-page-kicker,
.hyeni-v5-calendar-year,
.hyeni-v5-calendar-list-head .hyeni-v5-count-accent {
  color: var(--theme-accent-text);
}

.hyeni-v5-kid-card,
.hyeni-v5-action-chip,
.hyeni-v5-event-card,
.hyeni-v5-calendar-card,
.hyeni-tool-card,
.hyeni-tool-list {
  border-color: color-mix(in srgb, var(--theme-accent-line) 62%, var(--line-soft));
  background: rgba(255, 255, 255, 0.94);
}

.hyeni-v5-action-chip:active,
.hyeni-v5-action-chip:hover {
  background: var(--theme-accent-soft);
  border-color: var(--theme-accent-line);
}

.hyeni-v5-calendar-card {
  border-radius: 18px;
}

.hyeni-v5-calendar-nav button {
  color: var(--theme-accent-text);
  box-shadow: var(--hyeni-theme-shadow-soft);
}

.hyeni-v5-calendar-grid {
  border: 1px solid color-mix(in srgb, var(--theme-accent-line) 68%, var(--line-soft));
  border-radius: 18px;
  box-shadow: none;
}

.hyeni-v5-calendar-day {
  transition:
    background-color var(--duration-fast) var(--easing-standard),
    color var(--duration-fast) var(--easing-standard),
    transform var(--duration-fast) var(--easing-standard);
}

.hyeni-v5-calendar-day:active {
  transform: scale(0.96);
}

.hyeni-v5-calendar-day.today {
  background: var(--theme-accent-soft);
  color: var(--theme-accent-text);
  box-shadow: inset 0 0 0 1px var(--theme-accent-line);
}

.hyeni-v5-calendar-day.selected {
  background: var(--hyeni-theme-gradient);
  color: #fff;
  box-shadow: var(--hyeni-theme-shadow-soft);
}

.hyeni-v5-page-add,
.hyeni-v5-plus-button,
.hyeni-v5-tabbar button.active,
.hyeni-memo-message.mine .hyeni-memo-bubble,
.hyeni-memo-input-shell button {
  background: var(--hyeni-theme-gradient);
  box-shadow: var(--hyeni-theme-shadow-soft);
}

.hyeni-v5-ai-button {
  background: var(--bg-base);
  color: var(--theme-accent-text);
  border: 1px solid var(--theme-accent-line);
  box-shadow: none;
}

.hyeni-v5-tabbar {
  border-color: color-mix(in srgb, var(--theme-accent-line) 68%, var(--line-soft));
  border-radius: 18px;
  box-shadow: 0 12px 28px rgba(31, 26, 34, 0.10);
}

.hyeni-memo-phone {
  border-radius: 24px;
  background: linear-gradient(180deg, #fffaf8 0%, #fffdfb 100%);
  border-color: color-mix(in srgb, var(--theme-accent-line) 72%, var(--line-soft));
  box-shadow: 0 16px 38px rgba(31, 26, 34, 0.10);
}

.hyeni-memo-date-row strong,
.hyeni-memo-quick-row button {
  color: var(--theme-accent-text);
  border-color: var(--theme-accent-line);
  background: var(--theme-accent-soft);
  box-shadow: none;
}

.hyeni-memo-input-shell {
  border-color: var(--theme-accent-line);
  box-shadow: none;
}
```

Do not override `.hyeni-tool--emergency` semantic variables.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- tests/softBrandVisualSystem.test.js
```

Expected: PASS.

## Task 4: Build And Browser Verification

**Files:**
- No source changes unless verification finds a visual or runtime issue.

- [ ] **Step 1: Run production build**

Run:

```bash
npm run build
```

Expected: exit code 0.

- [ ] **Step 2: Run focused unit test**

Run:

```bash
npm run test -- tests/softBrandVisualSystem.test.js
```

Expected: PASS.

- [ ] **Step 3: Verify entry screen in browser**

Use the existing dev server or start it:

```bash
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/` at 390x844. Confirm:

- signed-out role screen renders
- button text is not selected after taps/clicks
- current theme color affects app chrome when a cached theme is present
- console has no runtime error caused by the redesign

- [ ] **Step 4: Verify no accidental broad selection lock**

In the browser, confirm normal body text can still be selected where it is not inside a button. Pair codes must remain copyable when reachable.

## Self-Review

- Spec coverage: Soft Brand, Pretendard, theme propagation, no-select buttons, calendar polish, memo polish, and no functional changes all map to tasks.
- Marker scan: no task uses unresolved implementation markers or unspecified implementation.
- Type consistency: no new exported API is introduced; existing `applyThemeColor(color)` stays unchanged.
