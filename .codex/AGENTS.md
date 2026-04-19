# hyeni — Agent Guidance (Codex)

Project-scoped guidance for Codex CLI. Mirrors the role of `.claude/` for Claude Code.
Global defaults live in `~/.codex/AGENTS.md`; entries here override/extend for this repo.

## Stack

- React 19 + Vite 7 (JavaScript, **no TypeScript** — no `tsconfig.json`)
- Capacitor 8 (Android native wrapper)
- Supabase (auth, DB, Edge Functions under `supabase/functions/`)
- Qonversion (subscription entitlements, `@qonversion/capacitor-plugin`)
- Vitest (unit), Playwright (E2E)
- Package manager: **npm** (only `package-lock.json` present)

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Unit tests | `npm run test` (vitest) |
| E2E tests | `npm run test:e2e` (Playwright — hits real services, skip by default) |
| Android sync | `npx cap sync android` |

## Key source paths

- `src/App.jsx` — monolithic app entry (large file, caution when editing)
- `src/lib/` — shared modules: `auth.js`, `entitlement.js`, `entitlementCache.js`,
  `features.js`, `paywallCopy.js`, `pushNotifications.js`, `qonversion.js`,
  `realtime.js`, `supabase.js`, `supabase.mock.js`, `sync.js`
- `src/components/paywall/`, `src/components/settings/` — UI components
- `android/app/src/main/java/com/hyeni/calendar/` — native Android (MainActivity, FCM service)
- `supabase/functions/` — Deno Edge Functions (`jsr:`/`npm:` imports are Deno-native, not Node)

## Domain notes

- App is a Korean family calendar/notifier ("hyeni"). UI strings are Korean.
- Kakao OAuth is the primary login (native deep-link on Android).
- Parent↔child role split: child receives memos, parent sends memos + remote audio listen.
- Remote audio listen uses FCM data-only push (no visible notification in happy path).
- Subscription gating via Qonversion entitlements; paywall components enforce premium-only features.

## Testing expectations

- Do **not** mock Supabase at unit-test level for flows that depend on real RLS/SQL —
  `src/lib/supabase.mock.js` exists for isolated lib tests only.
- Playwright runs (`playwright.real.config.js`) depend on live Kakao + Supabase;
  never assume they can run in CI without env secrets.
- E2E is opt-in; don't block verification flows on it.

## Editing guardrails

- `src/App.jsx` has pre-existing React Compiler / `react-hooks` violations
  (`preserve-manual-memoization`, `refs`, `set-state-in-effect`). When touching
  surrounding code, avoid introducing new violations; fixing existing ones is a
  separate, planned refactor — don't bundle into unrelated changes.
- Capacitor plugins are dynamically imported in `App.jsx`; the Vite chunking warning
  (>500 kB main chunk) is pre-existing and out of scope for routine edits.
- Edge Functions under `supabase/functions/` run on Deno — do not apply Node-specific
  lint/type rules to them.

## Dead-code reports

- `.reports/dead-code-analysis.md` — latest `knip`/`depcheck` findings and the
  5-file SAFE cleanup applied 2026-04-19. Consult before re-running `/refactor-clean`.
