# Wanted Design System — Hyeni App Spec

**Source:** Figma (Wanted DS) — verified 2026-05-02
**Target:** 혜니캘린더 (com.hyeni.calendar)
**Token file:** `src/styles/tokens.css`

This document is the single source of truth. If anything in code conflicts with this spec, the spec wins.

---

## 1. Typography

### Font stack
```
"Pretendard JP", "Pretendard", -apple-system, BlinkMacSystemFont,
"Apple SD Gothic Neo", "Helvetica Neue", "Segoe UI", Roboto,
"Hiragino Sans", "Hiragino Kaku Gothic ProN", system-ui, sans-serif
```

Pretendard JP is the primary face. Korean glyphs are identical to standard Pretendard, so this is safe for Korean-only screens.

**CDN load** (in `index.html`):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-jp.css">
```

### Weight scale
| Weight | Token | Use |
|--------|-------|-----|
| 400 | `--weight-regular` | Reserved (not used for body) |
| 500 | `--weight-medium` | **Body text default** — Body 1/2, Label 1/2, Caption1, input values |
| 600 | `--weight-semibold` | Button labels |
| 700 | `--weight-bold` | Strong emphasis, Caption2 (category badges) |

Body weight 500 is Wanted DS's signature — 400 is too thin for Korean glyphs, 700 too heavy.

### Line-height & letter-spacing
| Token | Value | Use |
|-------|-------|-----|
| `--leading-tight` | 1.3 | Headings |
| `--leading-normal` | 1.5 | Body (default) |
| `--leading-loose` | 1.7 | Long-form reading |
| `--tracking-tight` | -0.01em | Body, headings |

---

## 2. Colors

### Light mode (default)
| Token | Value | Use |
|-------|-------|-----|
| `--bg-base` | `#FFFFFF` | Cards, primary canvas |
| `--bg-subtle` | `#F7F7F8` | App background, hover state |
| `--bg-muted` | `#EFEFF1` | Disabled surface, input on white |
| `--bg-inverse` | `#18181B` | Inverted surfaces |
| `--fg-primary` | `#0F0F12` | Body text |
| `--fg-secondary` | `#46464A` | Secondary text |
| `--fg-tertiary` | `#71717A` | Placeholder, meta |
| `--fg-disabled` | `rgba(15, 15, 18, 0.28)` | Disabled text |
| `--fg-strong` | `#000000` | Maximum contrast |
| `--fg-on-primary` | `#FFFFFF` | Text on primary buttons |
| `--primary` | `#0066FF` | Wanted Blue |
| `--primary-hover` | `#005EEB` | -10% L |
| `--primary-press` | `#0054D1` | -20% L |

### Dark mode
| Token | Value | Notes |
|-------|-------|-------|
| `--bg-base` | `#18181B` | Cards (NOT pure black — OLED smear) |
| `--bg-subtle` | `#0F0F12` | Canvas (one step darker than card) |
| `--bg-muted` | `#26262C` | Inputs, disabled |
| `--fg-primary` | `#F4F4F5` | 90% white (NOT `#FFFFFF` — eye strain at night) |
| `--fg-secondary` | `#A1A1AA` | |
| `--primary` | `#3B82FF` | One step brighter (4.5:1 contrast on dark bg) |
| `--primary-hover` | `#1F6BFF` | |
| `--primary-press` | `#1556D9` | |

### Lines (alpha-based, cool gray)
Using alpha (not solid gray) so lines blend on any background.

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--line-subtle` | `rgba(112, 115, 124, 0.08)` | `rgba(255, 255, 255, 0.06)` | Faint divider |
| `--line-soft` | `rgba(112, 115, 124, 0.16)` | `rgba(255, 255, 255, 0.10)` | **Card border default** |
| `--line-default` | `rgba(112, 115, 124, 0.22)` | `rgba(255, 255, 255, 0.16)` | Hover, strong divider |
| `--line-strong` | `rgba(112, 115, 124, 0.40)` | `rgba(255, 255, 255, 0.28)` | Pressed, emphasized |
| `--line-disabled` | `rgba(15, 15, 18, 0.10)` | `rgba(244, 244, 245, 0.08)` | Disabled border |

### Status colors
**⚠️ TODO: verify exact hex from Figma.** Values below are best-fit defaults.

| Token | Light | Dark |
|-------|-------|------|
| `--status-positive` | `#16A34A` | `#2DD478` |
| `--status-positive-subtle` | `rgba(22, 163, 74, 0.10)` | `rgba(45, 212, 120, 0.14)` |
| `--status-negative` | `#DC2626` | `#FF6B6B` |
| `--status-negative-subtle` | `rgba(220, 38, 38, 0.10)` | `rgba(255, 107, 107, 0.14)` |
| `--status-cautionary` | `#D97706` | `#FFB020` |
| `--status-cautionary-subtle` | `rgba(217, 119, 6, 0.10)` | `rgba(255, 176, 32, 0.14)` |

---

## 3. Radius scale

| Token | Value | Use |
|-------|-------|-----|
| `--radius-xs` | 4px | Badge, chip |
| `--radius-sm` | 6px | (rare) |
| `--radius-md` | 8px | Input, button-small → aliased as `--radius-input` |
| `--radius-lg` | 12px | Button, small card → aliased as `--radius-control` |
| `--radius-xl` | **16px** | **★ Card default** → aliased as `--radius-card` |
| `--radius-2xl` | 20px | Hero card, modal |
| `--radius-full` | 9999px | Pill, avatar |

**Note**: Hyeni current radius is already 16px in many places. There is no "16→24 expansion" phase. The earlier spec value of 24px was incorrect.

---

## 4. Spacing — 4px grid

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |

Arbitrary values (e.g. `gap-[13px]`, `padding: 17px`) are forbidden.

---

## 5. Components

### Card
```css
.card {
  background: var(--bg-base);
  border: 1px solid var(--line-soft);   /* 0.16 alpha */
  border-radius: var(--radius-card);     /* 16px */
  box-shadow: var(--shadow-none);
}
```

Variants:
- `.card-elevated` — floating UI: modals, dropdowns, toasts. Uses `--shadow-md` (2-layer: 1px close + 8px/24px far).
- `.card-interactive` — clickable cards. Hover: border → `--line-default` (0.22), background → `--bg-subtle`.

### Input
- Height 48px (`--control-height`)
- Padding `0 var(--space-4)` (0 16px)
- Border `1px solid var(--line-soft)`, radius 8px (`--radius-input`)
- Focus: border-color → `--primary`, box-shadow halo `rgba(0, 102, 255, 0.18)` 3px (no outline)

### Buttons
All buttons share `.btn` base: height 48px, font-weight 600, radius 12px (`--radius-control`).

| Variant | Class | Use |
|---------|-------|-----|
| Primary | `.btn-primary` | Main action (저장, 등록, 확인, 다음) — Wanted Blue fill |
| Secondary | `.btn-secondary` | Cancel, back, secondary action — outlined |
| Destructive | `.btn-destructive` | Delete, irreversible — `--status-negative` fill |

States: `:hover` (-10% L), `:active` (-20% L), `:disabled` (`--bg-muted` + `--fg-disabled`), `:focus-visible` (2px ring with inner halo for filled buttons).

---

## 6. Focus ring

- Ring color: `--primary` (light) / `#5B9DFF` (dark)
- 2px outline + 2px offset
- Use `:focus-visible` only — no ring on mouse click
- **Inputs**: border-color change + soft halo instead of outline (less visual noise)
- **Filled buttons** (primary, destructive): outline + inner halo via `box-shadow: 0 0 0 2px var(--bg-base)` for separation

---

## 7. Shadows (used sparingly)

| Token | Value |
|-------|-------|
| `--shadow-none` | `none` (default for cards) |
| `--shadow-sm` | `0 1px 2px rgba(15, 15, 18, 0.04)` |
| `--shadow-md` | `0 1px 2px rgba(15, 15, 18, 0.04), 0 8px 24px rgba(15, 15, 18, 0.08)` (2-layer) |
| `--shadow-lg` | `0 2px 4px rgba(15, 15, 18, 0.06), 0 16px 48px rgba(15, 15, 18, 0.12)` |

Wanted DS is **stroke-first**: hairline borders for elevation, shadows only for floating UI.

In dark mode, shadow values increase opacity since they're harder to perceive on dark backgrounds.

---

## 8. Motion

| Token | Value | Use |
|-------|-------|-----|
| `--duration-fast` | 120ms | Hover, press, focus |
| `--duration-base` | 200ms | Panel transitions |
| `--easing-standard` | `cubic-bezier(0.2, 0.0, 0.2, 1)` | Default |

Always respect `@media (prefers-reduced-motion: reduce)`.

---

## 9. Hyeni-specific guidance

### Brand-preservation list (NEVER replace with generic tokens)
- **혜니 포인트 표시** — bespoke. Do not use generic Badge.
- **캘린더 그리드** — keep current cell sizing and grid math.
- **일정 카드 (event card)** — apply `.card` baseline only. Preserve internal layout, color-coded category strip, time display.
- **가족 멤버 avatar group** — keep stacking pattern.

### Capacitor integration
- StatusBar color must sync with theme:
  - Light: `style: Style.Light`, `backgroundColor: '#FFFFFF'`
  - Dark: `style: Style.Dark`, `backgroundColor: '#0F0F12'`
- Splash screen: light bg `#FFFFFF`, dark bg `#0F0F12` (configure in `capacitor.config.ts`)
- Safe-area insets: use `env(safe-area-inset-*)` on root layout

---

## 10. Decisions deferred (do not invent)

These are **not defined yet**. If encountered, STOP and ask the user:
- Exact status color hex (positive/negative/cautionary) — verify with Figma
- Toast component — stack position, duration, swipe-to-dismiss
- Skeleton loader pattern
- Empty state illustrations
- Bottom sheet component (mobile-specific)
- 혜니 포인트 시각 디자인 (Wanted DS Badge로 대체 금지)

---

## 11. Conformance checklist

A component is conformant if:

- [ ] No hex/rgb/hsl literals in code — only `var(--*)` tokens
- [ ] No magic px for spacing/radius — only `--space-*` / `--radius-*`
- [ ] Uses `.card` / `.card-elevated` / `.card-interactive` for any container
- [ ] Uses `.input` for any text-entry control
- [ ] Uses `.btn-primary` / `.btn-secondary` / `.btn-destructive` for any button
- [ ] Body text inherits weight 500 from body (no override unless intentional)
- [ ] Works in both light and dark mode
- [ ] Has visible `:focus-visible` state for keyboard users
- [ ] Disabled state uses tokens (no manual gray)
