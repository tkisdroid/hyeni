# Hyeni Calendar Brand Spec

> Captured: 2026-04-24
> Source: `design/Redesign v3 · Illustrated Warm Full.html` confirmed mobile screenshots
> Scope: app redesign work using the huashu-design asset-first workflow

## Core Assets

### Logo

- Primary app logo: `src/assets/new_logo.png` (1024x1024 PNG)
- Runtime icon: `public/icon-192.png` (192x192 PNG)
- Large PWA icon: `public/icon-512.png` (512x512 PNG)
- In-app usage: prefer `AppBrandLogo` with `APP_BRAND_LOGO_SRC = "/icon-192.png"` for rendered app surfaces.
- Do not redraw the logo with CSS, SVG, emoji, or text-only substitutes.

## Color Tokens

- Brand primary: `#E65C92`
- Brand dark: `#C4447A`
- Brand pink: `#F779A8`
- Pink text: `#B0477A`
- App surface: `#FFFAF5`
- Parent blue: `#3B82F6`
- Parent deep: `#2563EB`
- Body text: `#38252D`
- Secondary text: `#75525C`
- Muted text: `#9B7C85`
- Surface: `#FFFFFF`
- Pink border: `#FFE4EF`
- Strong pink border: `#FFD4E7`

## Category Tokens

- School: `#A78BFA`, background `#EDE9FE`
- Sports: `#34D399`, background `#D1FAE5`
- Hobby: `#F59E0B`, background `#FEF3C7`
- Family: `#F87171`, background `#FEE2E2`
- Friend: `#60A5FA`, background `#DBEAFE`
- Other: `#EC4899`, background `#FCE7F3`

## Gradients

- Global background: `radial-gradient(1400px 800px at 10% -10%, #FFDEEC 0%, transparent 55%), radial-gradient(1400px 800px at 90% 110%, #FFEBBE 0%, transparent 55%), radial-gradient(1200px 700px at 50% 50%, #D0E0FA 0%, transparent 60%), linear-gradient(180deg, #FCF1EB 0%, #F5EBF3 100%)`
- App background: `radial-gradient(240px 160px at 10% 0%, rgba(255,200,220,0.8) 0%, transparent 60%), radial-gradient(240px 200px at 100% 100%, rgba(255,225,180,0.6) 0%, transparent 60%), #FFFAF5`
- Hero: `linear-gradient(135deg, #FFC2D9 0%, #FF9EBF 100%)`
- Primary button: `linear-gradient(135deg, #F779A8 0%, #E65C92 100%)`

## Type

- App font stack: `'Pretendard Variable','Pretendard','Noto Sans KR','Apple SD Gothic Neo',sans-serif`
- Korean body text should stay at 13px or larger.
- Use 700/800/900 weights only for labels, controls, and short headings.

## Design Direction

- The app should feel like a calm family safety utility, not a marketing landing page.
- Use the logo as the primary brand signal on first-run, splash, and setup surfaces.
- Use color to distinguish parent and child actions, but keep pink as the app identity anchor.
- Keep buttons large enough for Android touch targets and avoid text overflow on 320px-wide screens.

## Avoid

- Generic purple-blue gradients as the main brand look.
- Decorative blobs, arbitrary stats, or filler icon rows.
- Replacing real assets with emoji-only branding.
- Changing behavior, routing, auth, or Supabase calls during visual-only redesign work.
