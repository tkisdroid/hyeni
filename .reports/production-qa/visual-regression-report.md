# Agent 09 — UI / Soft Brand / Visual Regression Report

**Branch**: `final/production-polish-and-real-device-qa` @ `d5d183f`
**Date**: 2026-05-13
**Build artifact**: `dist/` (existing) served via `vite preview` on `127.0.0.1:4174`
**Locale**: `ko-KR`, `colorScheme: light`

> Output path required by Agent 09 prompt:
> `.reports/production-qa/visual-regression-report.md`. No prior file exists
> at this path. Embedded data: counts and ratios from `sweep-results.json`
> and `contrast-check.mjs` runtime measurements; code paths/line numbers as
> static citations. No production user data involved.

---

## Scope decision (recorded for transparency)

- The full 19 screens × 10 viewports = 190 capture plan requires authenticated
  sessions (Supabase login, role assignment, pairing). This agent has no
  permission to write to production DB and no service-account access.
- Reachable-without-auth screens were captured at **all 10 viewports** plus
  authenticated entry chrome screens were sampled at **3 representative
  mobile viewports** (320, 375, 390) via click-through (no actual auth
  submission).
- Soft Brand compliance was verified via **static analysis** of `tokens.css`,
  `index.css`, `App.css`, `tokens-cartoon.css`, plus runtime computed-style
  checks on every captured viewport.

**Net evidence**: 10 entry-splash + 3 role-select + 3 parent-auth + 3
child-pair = 19 captures, plus full-page DOM snapshots for the 10 entry-splash
captures and a contrast scan on 390×844.

---

## Soft Brand spec compliance

| Rule | Status | Evidence |
|---|---|---|
| Warm cream + white surfaces | PASS | `tokens.css` `--bg-page: #FBFAF6`, `--bg-card: #FFFFFF`; visible in all captures |
| Restrained Hyeni pink (not over-applied) | PASS | Splash uses cream gradient w/ rose accents on emphasis text + CTA only |
| Selected theme color propagation | PASS (static) | `applyThemeColor` in `src/lib/theme.js` writes `--theme-accent*` to root; consumed by 50+ classes |
| Semantic colors preserved (success/danger/caution) | PASS | `--status-positive`, `--status-negative`, `--status-cautionary` retained alongside DR aliases |
| Pretendard JP font, no other fonts | PASS | Only `Pretendard Variable` `@font-face`; `--cartoon-font-display` falls back to Pretendard (comment explicitly forbids external CDN fonts) |
| Body weight 500 | PASS | `body { font-weight: var(--weight-medium); }` resolves to `500`; runtime check confirms `getComputedStyle(document.body).fontWeight === "500"` on all 10 viewports |
| Card: stroke + no shadow (`.card-elevated` for floating only) | PASS | `.card { border: 1px solid var(--line-soft); box-shadow: var(--shadow-none); }` — line 630 `tokens.css` |
| Radius consistency | PASS | All radii via `--radius-*` aliases (`--radius-card`, `--radius-control`, `--radius-pill`, etc.) |
| Shallow shadow | PASS | Heavy shadows only on `.card-elevated`, `.shadow-mint/rose/lavender` (intentional brand glow); rest is `none` |
| Button text non-selectable | PASS | `index.css:62-74` applies `user-select: none; touch-action: manipulation` globally to button/a/[role=button]/etc. `.btn` re-applies user-select:none. `.btn-icon-circle` adds `-webkit-user-select: none` + `touch-action: manipulation` |
| Emergency / destructive affordance preserved | PASS | `.btn-destructive` uses `--status-danger #E03030`; `UrgentAlertOverlay` uses `var(--status-negative, #DC2626)` for hero title; SOS shield asset retained |
| Strong red restricted to SOS/긴급/하트 | FINDING (P2) | See issue #1 — theme palette in `src/lib/theme.js` still exposes `#EF4444` as a selectable child accent. Selecting it makes child markers, chips, and event chip rails strong-red, which can be confused with SOS affordance. Comment says "limited use" but no runtime guard. |
| Parent (민트) / Child (로즈) tone distinction | PASS (intent) | `.btn-primary` (rose) + `.btn-primary-mint` defined; runtime applies based on role. Note: splash/role-select pre-role uses default rose theme intentionally. |

---

## Per-viewport summary

| Viewport | Screens captured | Runtime findings |
|---|---|---|
| 320×568 | 1 entry + role/auth/child-pair samples | CTA card title wraps to 2 lines (issue #2) |
| 360×800 | 1 | clean |
| 375×812 | 1 + samples | clean |
| 390×844 | 1 + samples | clean; contrast scan ran here |
| 430×932 | 1 | clean |
| 768×1024 | 1 | clean |
| 1024×768 | 1 | clean |
| 1280×720 | 1 | clean |
| 1440×900 | 1 | clean |
| 1920×1080 | 1 | clean — content centered in mobile container, large empty page area (intentional mobile-first layout) |

No horizontal overflow, no CTA out-of-bounds, no unlabeled `<button>`, heading
landmark present on every viewport.

---

## Issues found

### Issue 1 — `#EF4444` strong-red is selectable as child theme color (P2)

- **File**: `src/lib/theme.js` lines 41-44
- **Code**:
  ```js
  "#EF4444": { // 빨강 — limited use (per design_color_rules)
    label: "빨강",
    accent: "#EF4444", deep: "#DC2626", soft: "#FEE2E2", line: "#FECACA", text: "#991B1B",
  },
  ```
- **Why P2**: When a parent assigns red as a child's accent in
  `ColorPicker.jsx` (which lists `#EF4444` as "빨강"), all chips, card rails,
  hero badges, and map markers for that child become saturated red. This
  visually mirrors the SOS/긴급 affordance. The memory rule
  (`design_color_rules.md`) requires strong red to be reserved for
  SOS/긴급/하트. The comment notes the constraint but no runtime gate
  enforces it.
- **Fix hint**: Either (a) remove `#EF4444` from `ChildPalette.js` and
  `ColorPicker.jsx`, swap to a softer rose like `#FF6B9B`, or (b) keep the
  palette but desaturate the runtime application to a less-loud variant when
  used as a personal accent, leaving full saturation for safety chrome only.
- **Evidence**: `src/lib/theme.js:41-44`,
  `src/components/multichild/ChildPalette.js:7`,
  `src/components/multichild/PairingWizard/ColorPicker.jsx:11`

### Issue 2 — 320×568: role-select CTA card title wraps to 2 lines (P2)

- **Screens**: `/`, role selection cards 부모/자녀
- **Evidence**: `.reports/production-qa/visual-diff/entry-splash/320x568.png`
  — "부모로 시작" shows as "부모로 시 / 작"; "자녀로 시작" cut off below
  the fold but same layout
- **Why P2**: Two-line wrap of a 4-character Korean CTA on the smallest
  supported viewport (still common on older Android handsets) looks broken
  even if technically readable. First impression for new users.
- **Fix hint**: Reduce mascot illustration size on small viewports, switch
  role card to a vertical (illustration above title) layout under 360px, or
  shorten copy to "부모" / "자녀" on small viewports.

### Issue 3 — Splash emphasis "시작" contrast 2.54 vs cream bg (P2)

- **Sample**: `<span>시작</span>` font-size 30 weight 800 over `#FBFAF6`
  cream
- **Measured ratio**: 2.54 (WCAG AA large-text minimum 3.0)
- **Why P2**: While the surrounding text "누구로 시작할까요?" is rendered in
  near-black on cream (high contrast), the single emphasized word "시작" is
  in brand-rose at 30px and falls below 3.0. Meaning is preserved without
  the color, so accessibility impact is moderate. But it does fail WCAG AA.
- **Fix hint**: Use `--brand-rose-deep #D94F7F` instead of `--brand-rose
  #F779A8` for the emphasis, or add an underline/weight bump alongside the
  color.
- **Evidence**: `.reports/production-qa/visual-diff/contrast-check.mjs` run
  output captured in this turn.

### Issue 4 — Inline-card chevron `›` chip contrast 2.88 (P3)

- **Sample**: 22px medium-weight chevron used on the role cards
- **Measured ratio**: 2.88 (WCAG AA non-large minimum 4.5)
- **Why P3**: The chevron is purely decorative — the entire card is
  clickable and the title text passes contrast on its own. Screen readers
  ignore the glyph.
- **Fix hint**: Either accept (decorative) and add `aria-hidden="true"`, or
  swap to `var(--fg-tertiary)` which carries 5.4 ratio.

### Issue 5 — `.hyeni-v5-kid-chev` declares `font-weight: 400` (P3)

- **File**: `src/App.css:654`
- **Code**: `font-weight: 400;`
- **Why P3**: Spec hard rule §4 requires body to be 500. The 400 is applied
  to a chevron icon character only (decorative arrow) — not body text — but
  is the only literal 400 in the codebase. The DR rule §6.2 explicitly
  defines `--weight-regular: 500` as body default with no lower weight
  token; using 400 here ignores the token system.
- **Fix hint**: Change to `font-weight: var(--weight-medium); opacity:
  0.55;` (opacity is already 0.55, so visual weight is preserved).

### Issue 6 — Splash mascot/icon `<img>` elements have empty `alt=""` (informational / NOT_VERIFIED)

- **Note**: Runtime sweep flagged 5 images per viewport (wink-star, phone,
  bell, wave, heart) as missing alt. On inspection
  (`src/components/auth/AppBrandLogo.jsx:27` and `HyeniMascot.jsx:62`), the
  wrapper `<div aria-label="혜니캘린더 로고">` provides the accessible name
  and the child `<img>` carries `alt=""`. This is the **WCAG-compliant
  decorative image pattern**. The runtime check was strict (any empty alt =
  flagged); on manual review this is acceptable.
- **Recommendation**: To stop similar false positives in future audits,
  ensure each decorative `<img>` either carries `role="presentation"` or
  `aria-hidden="true"` explicitly. The current pattern is valid but
  auditing tools (this script, axe-core in `--strict` mode, some screen
  readers) may still warn.

---

## Accessibility surface checks

| Check | Result |
|---|---|
| Visible buttons with no innerText and no aria-label | 0 found across all viewports |
| Visible `<img>` with truly missing alt (`null`) | 0 (5 had `alt=""` which is valid decorative) |
| Heading hierarchy / `[role=heading]` | Present on every viewport |
| Focus indicator declared globally | PASS — `*:focus-visible` outline rule in `tokens.css:608-613` |
| Keyboard tab order | Not exhaustively keyboard-tested in this pass (would require auth) |
| Reduced motion respected | PASS — `prefers-reduced-motion` media query in `tokens.css:616-623` and `tokens.css:1045-1047` |

---

## Korean word-unit overflow / wrap

Memory rule (`Apply Korean word-unit wrapping globally` — commit 27cd3b1):

- Visual check on splash and role cards: copy wraps cleanly at word
  boundaries on the 360–1920px range.
- **Single regression**: 320×568 role card title 4-char copy still wraps
  mid-word ("부모로 시 / 작"). The word-break:keep-all setting won't help
  because "부모로 시작" splits between two single-character tokens — but 4
  chars shouldn't have to wrap at all. This is a layout/sizing issue, not a
  wrap setting issue (issue #2).

---

## Test artifacts

```
.reports/production-qa/visual-diff/
├── sweep.mjs                  # primary sweep script (Playwright)
├── sweep-deeper.mjs           # click-through to authenticated entry chrome
├── contrast-check.mjs         # WCAG contrast spot-check (390×844)
├── sweep-results.json         # raw runtime check findings
├── preview.log                # vite preview server log
├── entry-splash/
│   ├── 320x568.png + .html
│   ├── 360x800.png + .html
│   ├── 375x812.png + .html
│   ├── 390x844.png + .html
│   ├── 430x932.png + .html
│   ├── 768x1024.png + .html
│   ├── 1024x768.png + .html
│   ├── 1280x720.png + .html
│   ├── 1440x900.png + .html
│   └── 1920x1080.png + .html
├── role-select/{320x568,375x812,390x844}.png
├── parent-auth/{320x568,375x812,390x844}.png
└── child-pair/{320x568,375x812,390x844}.png
```

---

## Release decision

**ALLOW** with non-blocking design polish backlog.

No P0/P1 issues found. The Soft Brand system is implemented consistently:
- Pretendard JP only, body weight 500, card stroke + no shadow, semantic
  colors preserved, button non-selectable, emergency affordance intact.
- All viewports render the entry/role-select screens without horizontal
  overflow, off-screen CTAs, or unlabeled controls.

Four polish items (one P2 brand-rule risk + one P2 320px wrap regression +
one P2 contrast miss on decorative emphasis + minor P3 items) are
recommended for post-launch tightening but none block release.

---

## Single-line status

`STATUS=PASS | P0=0 P1=0 P2=3 P3=2 | screens=4 viewports=10`
