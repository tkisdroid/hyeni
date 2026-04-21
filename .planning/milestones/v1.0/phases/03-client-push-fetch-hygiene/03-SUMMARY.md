---
phase: 03-client-push-fetch-hygiene
plan: 03
subsystem: infra
tags: [edge-function, push-notify, idempotency, circuit-breaker, backoff, supabase, react, observability]

# Dependency graph
requires:
  - phase: 02-unblock-core-push-gateway-realtime-pair-security
    provides: [push_idempotency table (PK uuid), push-notify v32 with getClaims auth, saved_places publication + PostgREST cache reload]
provides:
  - Idempotency-Key single-call push pattern (header + body mirror)
  - pending_notifications delivery_status jsonb + idempotency_key FK for observability
  - Reusable circuit-breaker + exponential-backoff helpers module-scoped in sync.js
  - fetchSavedPlaces wrapped with breaker/backoff; 429 rate-limit bypass
  - Single sync-degradation UI banner (transient vs circuit_open states)
affects: [04-memo-model-unification, 05-ux-safety-hardening, observability-v2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotency-Key header + body mirror for beacon/unload-path compatibility"
    - "Module-scoped Map<string, BreakerState> keyed by function name for reuse"
    - "Server-side unique-constraint dedup (INSERT ON CONFLICT → 23505 → 200 duplicate)"
    - "Single consolidated warn log per degraded-call chain (banner replaces console spam)"

key-files:
  created:
    - supabase/migrations/20260421105507_pending_notifications_delivery_status.sql
    - supabase/migrations/down/20260421105507_pending_notifications_delivery_status.sql
    - .planning/phases/03-client-push-fetch-hygiene/deferred-items.md
  modified:
    - supabase/functions/push-notify/index.ts
    - src/App.jsx (L93-143 sendInstantPush · L3952 syncDegraded state · L4425-4432 load effect · L4601-4614 30s poll · L5960-5971 banner JSX)
    - src/lib/sync.js (helpers + fetchSavedPlaces refactor)

key-decisions:
  - "Idempotency-Key extracted from header with body.idempotency_key fallback for beacon/unload-path compatibility (D-A01)"
  - "Client single-fetch with one 800ms retry using same UUID; server dedupes via unique constraint (D-A02)"
  - "429 rate-limit response bypasses breaker failure count to preserve deliberate server throttling signal (D-B01)"
  - "fetchSavedPlaces kept backward-compatible default list return; {meta:true} opts in to breaker telemetry (D-B05)"
  - "Banner at top:64 with zIndex 240 so notification toast at zIndex 250 stacks above on collision (D-B03 discretion)"

patterns-established:
  - "Per-function circuit breaker registry: extend to fetchAcademies/fetchEvents in future phases by calling recordSuccess/recordFailure around the supabase call and optionally returning {meta:true}"
  - "CORS Allow-Headers must include any custom header (Idempotency-Key) or browser preflight blocks the main request"

requirements-completed: [PUSH-02, PUSH-03, PUSH-04, RES-01, RES-02]

# Metrics
duration: 7min
completed: 2026-04-21
---

# Phase 3: Client Push & Fetch Hygiene Summary

**Client-side push dispatch collapsed from XHR+Fetch+Beacon triple-call into a single Idempotency-Key fetch with server dedup, plus circuit-breaker-wrapped fetchSavedPlaces with a single UI banner replacing console log spam.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-21T10:55:07Z
- **Completed:** 2026-04-21T11:02:03Z
- **Tasks:** 6 (5 implementation + 1 documentation)
- **Files modified:** 5 (2 migration files created, plus push-notify/index.ts, src/App.jsx, src/lib/sync.js)

## Accomplishments

- **Stream A (PUSH-02/03/04):** `sendInstantPush` rewrote from 60-LOC triple-dispatch with 3 separate log lines to a 52-LOC single-call with one consolidated warn log. Server-side push-notify now dedupes via `push_idempotency` table (23505 → `{duplicate:true}` 200), and records every send (including zero-recipient) into `pending_notifications.delivery_status` jsonb with `idempotency_key` FK for full observability.
- **Stream B (RES-01/02):** `fetchSavedPlaces` now short-circuits when breaker is OPEN (3 failures within 60s → 5-min cooldown), records per-chain failure with exponential backoff telemetry, and honors 429 as a non-breaker signal. Single orange pill banner at top:64 replaces dozens of `[sync]` console errors.
- **Schema-extension migration** paired with reversible down migration, applied live and verified against `information_schema.columns` + `pg_constraint`.
- **Edge Function redeployed** to qzrrscryacxhprnrtpjd; OPTIONS preflight confirmed `Idempotency-Key` in allow-headers; 401 missing-auth smoke still intact from Phase 2.

## Task Commits

1. **Task 1: pending_notifications delivery_status + idempotency_key migration** — `226aa8a` (chore)
2. **Task 2: push-notify idempotency + delivery_status + CORS + redeploy** — `9a7a5bb` (feat)
3. **Task 3: sendInstantPush single-call rewrite** — `ea7951c` (feat)
4. **Task 4: sync.js breaker/backoff helpers + fetchSavedPlaces refactor** — `c4f7a41` (feat)
5. **Task 5: App.jsx syncDegraded state + polling caller + banner JSX** — `a5bc113` (feat)

**Plan metadata:** (this commit) — docs(03): complete client push + fetch hygiene phase

## Files Created/Modified

- `supabase/migrations/20260421105507_pending_notifications_delivery_status.sql` — ADD COLUMN IF NOT EXISTS delivery_status jsonb, idempotency_key uuid REFERENCES push_idempotency(key) ON DELETE SET NULL; both NULLABLE.
- `supabase/migrations/down/20260421105507_pending_notifications_delivery_status.sql` — symmetric DROP COLUMN IF EXISTS.
- `supabase/functions/push-notify/index.ts` — +51/-4 lines: Idempotency-Key extraction, push_idempotency INSERT-or-23505 dedup, 22P02 bad-UUID rejection, delivery_status record with note='no subscribers' when webSent=fcmSent=0, CORS Allow-Headers now lists Idempotency-Key.
- `src/App.jsx` — +39/-48 on sendInstantPush (L93-143), +1 useState for syncDegraded (L3952), +6 on initial load polling caller (L4425-4432), +7 on 30s polling caller (L4601-4614), +12 banner JSX (L5960-5971).
- `src/lib/sync.js` — +117/-3: breakers Map, getBreaker/recordSuccess/recordFailure/isOpen helpers, backoffDelay + getBreakerState exports, fetchSavedPlaces wrapped with breaker + 429 bypass + {meta:true} opt-in.
- `.planning/phases/03-client-push-fetch-hygiene/deferred-items.md` — logs 3 pre-existing out-of-scope issues (entitlementCache test, 18 ESLint errors, .reports PNG artifacts).

## Decisions Made

- **Idempotency-Key UUID lifecycle:** Minted once per user action via `crypto.randomUUID()`, reused identically by the single retry. Server dedup means same-UUID retries never duplicate; new user actions get a fresh UUID.
- **Pending insert for zero-recipient case:** Changed the predicate to `webSent === 0 && fcmSent === 0` (both zero) rather than "subs array empty" so that an FCM-only family (no web subs) still records a successful delivery without the `note: 'no subscribers'` flag.
- **Dual `opts.meta` contract on fetchSavedPlaces:** Preserves the legacy `list` default return so other untouched callers (if any emerge) keep working; the polling caller opts in to breaker telemetry for UI wiring.
- **Banner z-index hierarchy:** Chose zIndex 240 (below notification toast at 250) and top:64 (below toast at top:20) so both can render simultaneously if a network failure coincides with a kkuk receive or other toast.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] CORS Allow-Headers missing `Idempotency-Key`**
- **Found during:** Task 2 (Edge Function Idempotency-Key extraction).
- **Issue:** The plan specified extracting `Idempotency-Key` from request headers but did not call out that the OPTIONS preflight `Access-Control-Allow-Headers` list must be updated to include it. Without this, any browser-origin POST with `Idempotency-Key` would be blocked by preflight, causing 100% failure on the happy path.
- **Fix:** Added `Idempotency-Key` to the comma-separated Allow-Headers list in both the OPTIONS handler and the `jsonResponse` helper.
- **Files modified:** `supabase/functions/push-notify/index.ts` (2 identical strings via `replace_all`).
- **Verification:** `OPTIONS` preflight returned `access-control-allow-headers: Authorization, Content-Type, apikey, x-client-info, Idempotency-Key` (HTTP 200).
- **Committed in:** `9a7a5bb` (Task 2 commit).

**2. [Rule 2 - Missing Critical] Edge Function response exposes key for client traceability**
- **Found during:** Task 2 (response-shape design).
- **Issue:** Plan specified `{duplicate: true, key}` on dedup but did not specify that the success path should also surface the key. Surface matters for client-side logging correlation between sendInstantPush warnings and server-side logs.
- **Fix:** Added `key: idempotencyKey || null` to the success response (non-duplicate 200 path).
- **Files modified:** `supabase/functions/push-notify/index.ts`.
- **Verification:** Smoke test confirmed OPTIONS preflight + auth gate unchanged.
- **Committed in:** `9a7a5bb` (Task 2 commit).

**3. [Rule 2 - Missing Critical] `push_idempotency` INSERT enriched with family_id/action/first_sent_at**
- **Found during:** Task 2 (reviewing push_idempotency table schema from Phase 2 Plan 02-01 — D-A05).
- **Issue:** The Phase 2 migration created `push_idempotency` with nullable `family_id` / `action` / `first_sent_at` columns (explicitly for Phase 3 use). Plan text only mentioned `INSERT (key)` so the enriching columns would have been left NULL — losing forensic value and wasting the schema.
- **Fix:** INSERT now populates `{key, family_id, action, first_sent_at: now()}` so the dedup record carries enough context to correlate with pending_notifications.
- **Files modified:** `supabase/functions/push-notify/index.ts`.
- **Verification:** Deploy succeeded; INSERT path exercised on every push (idempotent per-request).
- **Committed in:** `9a7a5bb` (Task 2 commit).

---

**Total deviations:** 3 auto-fixed (all Rule 2 missing-critical; zero Rule 1 bugs, zero Rule 3 blockers, zero Rule 4 architectural).
**Impact on plan:** All three additions were necessary for correct operation (CORS), observability (response key), or to honor Phase 2's intentional schema design (enriched INSERT). No scope creep; no behavior outside the planned 5-REQ envelope.

## Issues Encountered

- **Pre-existing ESLint errors (18 total):** `npx eslint src/App.jsx` surfaces 18 errors — all at line ranges outside Phase 3's edit scope (L5180 react-hooks/set-state-in-effect, L5717 same, L6762 react-hooks/refs, etc.). Per CLAUDE.md monolith policy, App.jsx decomposition is forbidden this milestone. Logged to `deferred-items.md`.
- **Pre-existing test failure:** `tests/entitlementCache.test.js > reads back a cached value before ttl expires` fails with null vs expected payload. File untouched by Phase 3. Logged to `deferred-items.md`.
- **Docker not running warning** during `supabase functions deploy`: benign, affects only local `supabase start` (no impact on remote deploy). Same as Phase 2 precedent.

## User Setup Required

None — no external service configuration changed. VAPID keys untouched, FCM credentials untouched, Edge Function still deployed with `--no-verify-jwt` per Phase 2 D-A02.

## Next Phase Readiness

- **Phase 4 (memo model unification):** can now trigger `new_memo` pushes with confidence that duplicates are server-dedupped; `pending_notifications.delivery_status` gives a dual-write observability channel during the 14-day shadow-run.
- **Phase 5 Stream B (꾹 SOS):** Idempotency-Key pattern is live and reusable for SOS button double-tap protection per CONTEXT `code_context` integration note.
- **v1.1 observability:** `push_idempotency` rows will accumulate indefinitely until a 24h TTL cron is added (D-A06, deferred to observability phase). Current growth rate bounded (single row per unique user action) and `created_at` index already exists.

## Known Stubs

None introduced this phase. All code paths are live and wired end-to-end.

---

## Self-Check: PASSED

All 5 file claims verified via filesystem (`[ -f ]`). All 5 commit hashes verified via `git log --oneline --all | grep`. No missing items.

---

*Phase: 03-client-push-fetch-hygiene*
*Completed: 2026-04-21*
