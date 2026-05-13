# Agent 08 — Web E2E / Real Services Report

- Branch: `final/production-polish-and-real-device-qa` @ `d5d183f`
- Date: 2026-05-13
- Node: v24.13.1, Platform: win32
- Environment: `.env` present (Supabase URL + anon key + service role) — real-services tests had live credentials

## Top-line

| Suite | Total | Pass | Fail | Skip | Duration | Result |
|---|---:|---:|---:|---:|---:|---|
| Mocked (`playwright.config.js`) | 60 | 24 | 25 | 11 | 6.6 min | FAIL |
| Real-services (`playwright.real.config.js`) | 43 | 43 | 0 | 0 | 3.5 min | PASS |

- Mocked: confirms Agent 01's earlier finding (24-25 fails) — re-run reproduced. Retry didn't help; same assertions fail on retry #1.
- Real-services: zero regressions. Live Supabase, Realtime, RLS, Kakao Maps SDK, anon child flow, multichild SOS, payment-tier permissions all green.

## Mocked failures — root-cause clustered

All 25 mocked failures live in **`tests/e2e/critical-flows.spec.js`** (parent flow tests plus 2 child-flow tests). They split into TWO recent UI redesigns vs. test selector drift:

### Cluster A — strict-mode collision on `getByText('긴급 알림')` (22 unique tests, ~88% of fails)

- Failure mode: `Error: strict mode violation: getByText('긴급 알림') resolved to 2 elements: 1) <h2>긴급 알림</h2> (heading) 2) <div>긴급 알림</div>`
- Likely caused by commit **`d5d183f` "Show alerts as visible popups"** — the parent emergency-alert popup was promoted to a full `alertdialog`, which renders its own `<h2>긴급 알림</h2>` while the original tile `<div>긴급 알림</div>` was retained. Test selectors authored before that commit assumed a single match.
- Failure speed (~1.5 s) confirms the assertion blows up before any UI workflow runs — the strict-mode violation throws immediately on the second match.
- Severity: P1 (release-blocking for the mocked-suite CI gate; UI-only issue, real-services suite proves runtime is sane)
- Fix hint (DO NOT IMPLEMENT in this PR per agent contract): switch the test selector to `page.getByRole("heading", { name: "긴급 알림" })` OR `page.getByText("긴급 알림").first()`. UI is correct; tests are stale.

### Cluster B — `getByText('학부모 모드')` hidden (1 test — the long parent-mode suite, line 717)

- Failure mode: 14 element resolutions all report `hidden`. Element exists in DOM but `display: none`.
- Root cause: commit **`a4b5795` "Compact parent today navigation"** added `.hyeni-top-header--parent-compact .hyeni-top-header-mode-rail { display: none; }` (`src/App.css` line 712-714). The `학부모 모드` chip lives inside `.hyeni-top-header-mode-rail`, and the parent header switched to the compact variant.
- The full test (`parent mode covers emergency, location, scheduling, AI, notifications, remote audio, and kkuk`) gets all the way to the "혜니 오늘 요약" region check (line 721) and passes that, then fails one line later on `학부모 모드`.
- Severity: P1 (same as A — but this is the same test Agent 01 cited, so this is the canonical "first failure"; Agent 01 mis-described it as `img[name=혜니]`).
- Fix hint: drop the `학부모 모드` assertion, or replace with an alternate parent-mode signal (`getByRole("region", { name: "부모 메인" })` already passes per the trace).

### Evidence files (preserved before Playwright cleared `test-results/`)
- `.reports/production-qa/e2e-results/mocked/sample-fail-test14-parent-mode/` — trace.zip + video + error-context.md for the Cluster B failure (test #14)
- `.reports/production-qa/e2e-results/mocked/sample-fail-bottom-nav/` — trace.zip + video + screenshot + error-context.md for a Cluster A failure (test #29 `parent bottom navigation`)
- `.reports/production-qa/e2e-results/mocked-run.log` — full Playwright list reporter output

## Mocked skipped tests (11 — quarantined, NOT env-blocked)

- `tests/e2e/force-ring-realtime.spec.js:3` — `test.fixme` with comment "TODO: Realtime mock fixture"
- `tests/e2e/subscription-flow.spec.js` — 10 tests wrapped in `test.describe.fixme(...)` with code comment: "subscription-flow tests depended on the in-memory hyeni-mock-db-v1 localStorage backend... Quarantining via fixme until migration to page.route interceptors lands."

Per agent contract, env-skip = BLOCKED. These are NOT env-skips — they are intentional `fixme` quarantines (tech debt acknowledged in source comments). Logged as P3.

## Real-services results — all 43 PASS

Every real-services spec touched live Supabase (read-only or scratch-family pattern). Specs covered:
- accessibility (a11y-real.spec.js, 2 tests)
- child anon flow + role gate + invalid pair-code handling (4 tests)
- co-parent permissions / RLS (1 test)
- error injection: offline boot, REST 503, auth 401 (3 tests)
- family journey + RLS security boundary (2 tests)
- Kakao Maps SDK + OAuth redirect (2 tests)
- memo bubbles UX phase 5.5 (7 regression cases)
- menu/single+multichild isolation (2 tests)
- multichild full matrix: add/remove, child-device privacy, color realtime, family-vs-single events, migration 1-to-1 / 2-child grandfather, pairing 1-child / 3-child UI, free-tier SOS, partial/full subscription pricing (13 tests)
- parent flow (1 test)
- perf (1 test)
- profile-image signed URL fallback (1 test)
- Qonversion web fallback + settings affordance (2 tests)
- realtime channel open + RLS-block for anon insert (2 tests)

No console errors surfaced as test failures, no network 5xx, no Supabase auth rate-limit hits (workers=1 is sufficient).

## Server / dev environment notes

- Both suites auto-spawn the dev/preview server. No port conflict (port 4173).
- Real-services config builds prod bundle then `vite preview`; mocked config runs `vite dev`. Both completed cleanly.
- Vite warning surfaced during real-services build: dynamic+static import duplication for `src/lib/auth.js` and `@capacitor/core` (chunk splitting hint), plus the `>500 kB` chunk size warning Agent 01 already filed as P2-01. Non-blocking.

## Console / network errors observed

- No console fatal errors detected in failing mocked traces beyond the strict-mode assertion errors themselves.
- No 4xx / 5xx network failures in real-services run.
- The page snapshot from mocked test #14 trace shows the app rendered the full parent dashboard (calendar, today summary, management rail, alert dialog) — so the underlying React/runtime is healthy; the failures are pure selector drift.

## Severity ledger

| ID | Severity | Title | Evidence |
|---|---|---|---|
| AG08-01 | P1 | 22 mocked critical-flows tests fail strict-mode on `getByText('긴급 알림')` due to new alert popup (`d5d183f`) | `.reports/production-qa/e2e-results/mocked/sample-fail-bottom-nav/error-context.md` |
| AG08-02 | P1 | 1 mocked critical-flows test fails on `getByText('학부모 모드')` hidden by compact-header redesign (`a4b5795`) | `.reports/production-qa/e2e-results/mocked/sample-fail-test14-parent-mode/error-context.md` |
| AG08-03 | P1 | 2 mocked critical-flows tests fail on assorted child-mode selectors (child memo horizontal layout, child pairing pre-flight) — same root-cause family as Cluster A | `.reports/production-qa/e2e-results/mocked-run.log` (tests at lines 1757, 1792) |
| AG08-04 | P3 | 11 mocked tests pre-quarantined via `test.fixme` / `test.describe.fixme` — subscription-flow + force-ring-realtime tech debt | `tests/e2e/subscription-flow.spec.js:502` |
| AG08-05 | P3 | Vite dynamic/static import duplication warnings on `auth.js` and `@capacitor/core` (cosmetic chunk-splitting hint) | `.reports/production-qa/e2e-results/real-services-run.log` line 4-7 |

No P0. No real-services failures. No console fatals. No network 5xx.

## Release decision (this agent's scope only)

**ALLOW WITH CAVEATS** — same posture as Agent 01.

Justification:
1. Real-services suite is 43/43 — production-equivalent code paths against the actual Supabase backend are clean.
2. Mocked-suite failures are exclusively **test-vs-UI drift** from two intentional UI redesigns (commits `d5d183f` + `a4b5795`). The UI is shipping the new design; the tests assert the old design.
3. No runtime regressions, no security/RLS regressions, no API failures, no console fatals.
4. The mocked failures must still be cleared before the next CI run goes green — but they are NOT a runtime defect.

## Blocking reasons

None from this agent's checks. P1 issues are test-code maintenance, not product defects.

## One-line summary

`STATUS=FAIL | P0=0 P1=3 P2=0 P3=2 | mocked=24/60 real=43/43`

(Status is FAIL because mocked suite is red. Runtime / real-services posture is healthy.)
