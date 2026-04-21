# 혜니캘린더 — Claude Agent Instructions

## Project

**Name:** 혜니캘린더 (Hyeni Calendar)
**Current milestone:** v1.0 Production Stabilization
**Status:** Roadmap created 2026-04-21, Phase 1 queued

Parent-child safety app (React 19 + Vite + Capacitor 8 Android + Supabase). Production URL: https://hyenicalendar.com. This milestone is **emergency remediation** of 9 audit-driven defects (→ 28 REQ-IDs after research synthesis). No new features.

## GSD Workflow

This project uses [Get Shit Done](https://github.com/jakubno/get-shit-done) planning. Every non-trivial change flows through:

1. `/gsd-progress` — where are we
2. `/gsd-discuss-phase N` — context gathering (or `--auto` for YOLO mode as configured)
3. `/gsd-plan-phase N` — decomposition into atomic plans
4. `/gsd-execute-phase N` — execution with atomic commits + verification
5. `/gsd-transition` — phase handoff + PROJECT.md evolution

**Config (YOLO · Standard granularity · Full workflow):** see `.planning/config.json`. Researcher + Plan Checker + Verifier are all ON. Auto-advance enabled.

**5-phase roadmap** (see `.planning/ROADMAP.md` for detail):
1. **Phase 1: Migration Hygiene & Baseline** (no REQs — infra)
2. **Phase 2: Unblock Core** — P0-1/P0-2/P0-3 parallel ×3 (9 REQs)
3. **Phase 3: Client Push & Fetch Hygiene** — P1-4/P1-5 parallel ×2 (5 REQs)
4. **Phase 4: Memo Model Unification** — P1-6 solo (3 REQs, shadow-running DoD)
5. **Phase 5: UX & Safety Hardening** — P2-7/P2-8/P2-9 parallel ×3 (10 REQs + SOS-01)

## Non-Negotiable Constraints

- **Live production data** (`family_id=4c781fb7-677a-45d9-8fd2-74d0083fe9b4` active). Every DB change goes through **Supabase branch** → Playwright real-services E2E (`playwright.real.config.js`) → main promotion.
- **Monolith policy**: `src/App.jsx` (6877 lines) decomposition is **forbidden** this milestone. Phase plans touch pre-computed minimum line ranges (see `.planning/research/ARCHITECTURE.md` §2.4).
- **Migration hygiene** (Phase 1 prerequisite): `supabase/migrations/down/` + BEGIN/COMMIT wrapping + `pg_policies` snapshots before any RLS change.
- **Google Play stalkerware policy**: P2-8 (remote listen) MUST include persistent Android notification + `FOREGROUND_SERVICE_MICROPHONE` FGS type + remote feature flag kill switch.
- **PIPA + OWASP MASTG**: P2-9 (꾹 SOS) MUST include `sos_events` immutable audit log (new REQ SOS-01 from research synthesis).

## Planning Artifacts

| File | Purpose |
|------|---------|
| `.planning/PROJECT.md` | Living project context — evolves at phase transitions |
| `.planning/REQUIREMENTS.md` | 28 v1 REQs with final phase traceability |
| `.planning/ROADMAP.md` | 5-phase structure + success criteria |
| `.planning/STATE.md` | Current position + velocity metrics |
| `.planning/research/SUMMARY.md` | Synthesized research — READ FIRST when planning |
| `.planning/research/STACK.md` | Per-fix library/config decisions |
| `.planning/research/ARCHITECTURE.md` | Dependency graph + App.jsx line-range map |
| `.planning/research/PITFALLS.md` | 10 failure modes with phase mapping |
| `.planning/research/FEATURES.md` | Competitor bar + regulatory scope additions |

## Stack (Locked)

- React 19.2 · Vite 7 · Capacitor 8.2 (Android only) · Deno 2 (Edge Functions)
- Supabase (Auth ES256 · RLS · Realtime Phoenix 2.0 binary · Edge Functions)
- `@supabase/supabase-js@2.99.1` — includes `auth.getClaims()` (ES256-aware, do NOT bump)
- Qonversion Capacitor 1.4 · Google Play Billing v7
- Playwright 1.59 — `playwright.real.config.js` talks to real Supabase branch
- Vitest 4 · testing-library/react 16

## Key Files

| Path | Notes |
|------|-------|
| `src/App.jsx` | 6877-line monolith. Decomposition forbidden. |
| `src/lib/auth.js` | Family creation, pairing, anonymous child signup |
| `src/lib/sync.js` | REST + Realtime subscribe. `fetchSavedPlaces` 404 retry bug (Phase 3). |
| `src/lib/pushNotifications.js` | Client-side scheduler + `showNotification` fallback chain |
| `supabase/functions/push-notify/index.ts` | Edge Function — ES256 401 (Phase 2 Stream A) |
| `supabase/migrations/20260418000000_family_subscription.sql` | Exists but not in realtime publication (Phase 2 Stream B) |
| `supabase/migrations/20260418000006_saved_places.sql` | Same — exists but publication missing |
| `android/app/src/main/java/com/hyeni/calendar/MainActivity.java` | WebView auto-grant removal (Phase 5 Stream B) |
| `android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java` | FCM data-only handling — keep as-is |

## Test Strategy

- **Unit**: `npm run test` (Vitest) — fast, no external deps
- **E2E (mocked)**: `npm run test:e2e` — Playwright default config
- **E2E (real)**: `npx playwright test --config=playwright.real.config.js` — real Supabase branch, use for phase verification
- **Full verify gate**: `npm run verify` runs Vitest + Playwright default

## Instruction Hygiene

- When implementing a phase, read `.planning/research/SUMMARY.md` first, then the phase section in `.planning/ROADMAP.md`, then the specific research file referenced.
- Do NOT touch `src/App.jsx` outside the pre-computed line ranges for your phase.
- Do NOT rotate VAPID keys during Phase 2 Stream A — snapshot them in Phase 1 first.
- Do NOT drop `memos` table in Phase 4 — v1.0 DoD is shadow-running, not cutover. Drop deferred to v1.1 (MEMO-CLEANUP-01 in v2 section of REQUIREMENTS.md).
- Pair code TTL default = 48h, exceeds Life360 baseline. Do NOT auto-rotate.
- **Atomic commits per plan.** Never bundle multi-plan work into one commit.

---
*Generated 2026-04-21 after `/gsd-new-project` completion.*
