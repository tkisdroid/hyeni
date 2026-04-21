---
phase: 04-memo-model-unification
plan: 01
subsystem: memos
tags: [supabase, memo-model, shadow-running, intersection-observer, read-receipts, memo-replies]

# Dependency graph
requires:
  - phase: 01-migration-hygiene-baseline
    plan: 03
    provides: "public.memos.created_at/user_id/user_role columns reconciled (42703 resolved) — legacy INSERT...SELECT now keys on updated_at without dropping attribution surface"
  - phase: 02-unblock-core-push-gateway-realtime-pair-security
    plan: 02
    provides: "memo_replies in supabase_realtime publication (RT-03) — client can observe new unified path live before shadow cutover"
provides:
  - "public.memos_legacy_20260421 snapshot table (rollback anchor, 17 rows)"
  - "public.memo_replies.origin text column ('reply' | 'original' | 'legacy_memo')"
  - "public.memo_replies.read_by uuid[] column (MEMO-02 3-second viewport receipts)"
  - "public.memo_replies.user_id now NULLABLE (legacy ingestion; PITFALLS §P1-6 fix)"
  - "11 legacy memos ingested into memo_replies as origin='legacy_memo', user_role='legacy'"
  - "src/lib/sync.js: fetchMemoReplies returns origin+read_by, sendMemo() unified write path, markMemoReplyRead() added; fetchMemos + markMemoRead marked DEPRECATED"
  - "src/App.jsx MemoSection renders legacy rows with distinct label; IntersectionObserver-based 3s viewport read receipt wired; auto-read-on-view removed"
affects: [05-ux-safety-hardening, v1.1-memo-cleanup-01]

# Tech tracking
tech-stack:
  added:
    - "IntersectionObserver with 0.5 threshold + 3000ms dwell (MEMO-02 primitive)"
  patterns:
    - "Shadow-running migration: CREATE TABLE snapshot + ADD COLUMN + filtered INSERT with NOT EXISTS idempotence; legacy source table NEVER dropped in same milestone"
    - "Dual-ref decoupling (memoReadAuthIdRef vs app-wide authUserRef) to satisfy react-hooks/immutability without adding app-wide refactor scope"
    - "Per-reply-id Set + Map dedup so the observer fires markMemoReplyRead at most once per reply per session"

key-files:
  created:
    - "supabase/migrations/20260421110904_memo_model_unification.sql"
    - "supabase/migrations/down/20260421110904_memo_model_unification.sql"
    - ".planning/phases/04-memo-model-unification/04-01-SUMMARY.md"
    - ".planning/phases/04-memo-model-unification/deferred-items.md"
  modified:
    - "src/lib/sync.js"
    - "src/App.jsx"

key-decisions:
  - "ALTER memo_replies.user_id DROP NOT NULL — required to ingest legacy rows (PITFALLS §P1-6 explicitly flagged). Non-legacy INSERT paths continue to populate user_id, so no real-world NULL write."
  - "NULL user_id + user_role='legacy' + origin='legacy_memo' triple-marks legacy rows; any ONE of the three identifies them unambiguously, giving client + RLS multiple independent filters."
  - "public.memos TABLE retained (NOT VIEW-ified, NOT dropped) — CONTEXT.md D-03 rationale is that VIEW conversion complicates RLS migration. Client new-writes flip to memo_replies, making memos read-mostly; full DROP scheduled v1.1 MEMO-CLEANUP-01."
  - "Content filter `length(trim(content)) > 1` — skips pure-emoji ('💬') placeholders that `upsertMemo` inserted to bootstrap memo_replies threading. 11 of 17 memos rows were ingestable under this filter; 6 were skipped as placeholders."
  - "Observer uses `threshold: 0.5` (50% visible counts as 'in viewport'), `setTimeout(3000)` dwell, and clears the timer if the element leaves intersection before the 3s elapses. Session-level markedIdsRef prevents re-firing."
  - "Legacy rows (origin='legacy_memo') are visually distinct (amber bubble + dashed border + '예전 메모' label + 👶 avatar) AND excluded from IO registration — they have no sender to notify of read, and the origin user's account is unknown."
  - "Dedicated memoReadAuthIdRef sync'd via separate useEffect prevents the react-hooks/immutability rule from flagging the pre-existing app-wide authUserRef.current = authUser pattern. Zero net-new lint errors vs baseline (18 → 18)."

patterns-established:
  - "Shadow-running migration recipe: CREATE TABLE snapshot (IF NOT EXISTS + PK), ADD COLUMN IF NOT EXISTS for metadata, filtered INSERT with NOT EXISTS idempotence, DROP NOT NULL where legacy attribution is unrecoverable; source table NEVER dropped; pair with down file that reverses in strict reverse order and includes the SET NOT NULL restoration precondition."
  - "3-second viewport read receipt via IntersectionObserver with the observer instance stored in useRef, initialized inside a one-shot useEffect (NOT during render), dedup state held in Set/Map refs; cleanup drains timers + disconnects observer."
  - "Client-side soft-deprecation (JSDoc + comment annotation) keeps legacy APIs callable during shadow-running so v1.0 rollbacks don't require client revert; full removal tied to v1.1 cleanup ticket."

requirements-completed:
  - MEMO-01
  - MEMO-02
  - MEMO-03

# Metrics
duration: ~13min
completed: 2026-04-21
---

# Phase 4 Plan 01: Memo Model Unification Summary

**Unified the two-surface memo system around `memo_replies` via a shadow-running cutover — snapshot table + origin/read_by columns + 11 legacy rows ingested — with a 3-second viewport IntersectionObserver replacing auto-read-on-view and `memos` table intentionally retained for the full v1.0 milestone (DROP deferred to v1.1 MEMO-CLEANUP-01).**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-04-21T11:09:09Z
- **Completed:** 2026-04-21T11:22:15Z
- **Tasks:** 4 atomic commits (migration, sync.js, App.jsx, deferred-items)
- **Files created:** 4 / **Files modified:** 2

## Accomplishments

- **Live prod schema extended** via `supabase db query --linked` (Phase 1 documented MCP fallback, same route used by Plans 02-01..02-05): `memos_legacy_20260421` snapshot (17 rows, full copy), `memo_replies.origin` (`text DEFAULT 'reply'`), `memo_replies.read_by` (`uuid[] DEFAULT '{}'`), and `memo_replies.user_id` relaxed to NULLABLE so the 11 ingestable legacy memos could land with NULL attribution + `user_role='legacy'`. All wrapped in BEGIN/COMMIT on `qzrrscryacxhprnrtpjd`; rolled back atomically on a first-run failure when the NOT NULL constraint on user_id was discovered (matched PITFALLS §P1-6 prediction).
- **Paired down migration** at `supabase/migrations/down/20260421110904_memo_model_unification.sql` reverses every step in strict reverse order — DELETE legacy rows → SET NOT NULL back → DROP read_by → DROP origin → DROP snapshot. Safe because every NULL user_id row is origin='legacy_memo' (guaranteed by the up migration's filter), so step 1's DELETE eliminates them all before the SET NOT NULL would collide.
- **`src/lib/sync.js`** updated: `fetchMemoReplies` SELECT extended to return `origin` + `read_by`; `insertMemoReply` gains optional `origin` parameter; new `sendMemo()` unified write path (memo_replies-only with origin='reply' default); new `markMemoReplyRead(replyId, userId)` with read-modify-write Set-dedup + fast-path skip when user already in read_by. `fetchMemos` + `markMemoRead` marked DEPRECATED in comments (still exported, still working, scheduled for v1.1 removal).
- **`src/App.jsx`** MemoSection now renders three distinct visual classes: self-sent (pink gradient, right-aligned), peer (grey, left), legacy_memo (amber + dashed border + "예전 메모" label + 👶 avatar, center-left). The MEMO-02 IntersectionObserver is instantiated inside a one-shot `useEffect` (not during render) with `{threshold: 0.5}`, fires a 3-second `setTimeout` on intersection entry, cancels on exit, records marked IDs in a session Set so re-visiting the same reply doesn't spam the server. Legacy rows are deliberately excluded from IO registration (no read-receipt sink exists for them).
- **Auto-read-on-view REMOVED** from the date-change effect (`markMemoRead` call at the old L4057 is gone). The pre-existing effect that simply LOADED the memo into state no longer implicitly marks it read; read receipts now flow ONLY through the 3-second viewport path.
- **Reply send path rewritten** (previously L6485-6503): the old "ensure memos row exists, upsert '💬' placeholder, then insert memo_reply" dance is replaced with a single `sendMemo(...)` call into memo_replies with an `origin` computed as `'original'` if `memoReplies.length === 0` else `'reply'`. The optimistic-render row gains `origin` + `read_by: []` so it shape-matches the server echo.

## Task Commits

Each task was committed atomically via `git commit` with hooks enabled:

1. **Task 1 — Migration (applied live to prod):** `8336029` (feat)
2. **Task 2 — sync.js client API unification:** `77ccdfa` (feat)
3. **Task 3 — App.jsx MemoSection + 3s observer + send rewrite:** `88acff8` (feat)
4. **Task 4 — Deferred items doc:** `5302467` (chore)

(Plus the final docs commit to be appended after this SUMMARY and STATE updates land.)

## Files Created/Modified

- `supabase/migrations/20260421110904_memo_model_unification.sql` — 113-line up migration. 5 numbered blocks: (1) snapshot + PK via DO-block, (2) ADD origin, (3) ADD read_by, (4) DROP NOT NULL user_id, (5) idempotent legacy ingest via NOT EXISTS probe. BEGIN/COMMIT wrap. Metadata header cites CONTEXT.md D-01..D-06, PITFALLS.md §P1-6, and CLAUDE.md Phase 4 rule forbidding memos DROP.
- `supabase/migrations/down/20260421110904_memo_model_unification.sql` — 45-line paired down. 5 numbered blocks reverse order: DELETE legacy rows, SET NOT NULL back, DROP read_by, DROP origin, DROP snapshot. Explicit data-impact note. BEGIN/COMMIT wrap.
- `src/lib/sync.js` — +63 / -5 lines. Deprecation comments on `fetchMemos` + `markMemoRead`; extended `fetchMemoReplies` SELECT; extended `insertMemoReply` signature with optional origin; new `sendMemo` wrapper; new `markMemoReplyRead` with Set-dedup.
- `src/App.jsx` — +128 / -21 lines. MemoSection signature gains `onReplyRef`; DayTimetable forwards the prop to MemoSection (both `MemoSection` invocations). New MEMO-02 observer useEffect block + registerMemoReplyNode callback + pre-init node queue. Legacy rendering branch with amber styling + dashed border + "예전 메모" label. Removed eager `markMemoRead` from date-change effect. Reply-send rewritten to memo_replies-only via sendMemo. Unused imports cleaned up (`insertMemoReply`, `markMemoRead`).
- `.planning/phases/04-memo-model-unification/deferred-items.md` — documents pre-existing `tests/entitlementCache.test.js` failure (verified via git-stash bisect) and the 18 React-compiler-strict lint errors that carry over from baseline.

## Decisions Made

See `key-decisions` in frontmatter. Key summary:
- **memos TABLE NEVER dropped** (CLAUDE.md Phase 4 rule + CONTEXT.md D-01 + ROADMAP §Phase 4 SC#3). DROP scheduled for v1.1 MEMO-CLEANUP-01.
- **user_id DROP NOT NULL** was the only Rule 1 adjustment beyond CONTEXT.md spec — PITFALLS.md §P1-6 predicted it; live schema proved it on first apply.
- **Legacy rows visually distinct + IO-excluded** — their origin user is unknown, so a read receipt has no destination.
- **Shadow-running DoD honored** — both old `memos` writes (through `upsertMemo`) and new `memo_replies` writes coexist. The `memoValue` state still reads `memos[dateKey]`, so the text-area persistence continues through public.memos. Only the CHAT SURFACE has flipped to memo_replies.

## Deviations from Plan

### Rule 1 (bug fix) — memo_replies.user_id NOT NULL blocker

**1. [Rule 1 - Schema drift] Added ALTER COLUMN user_id DROP NOT NULL to the up migration**
- **Found during:** Task 1, first apply attempt
- **Issue:** First apply of the CONTEXT.md-spec migration failed with `23502: null value in column "user_id" of relation "memo_replies" violates not-null constraint` on the legacy ingest INSERT. PITFALLS.md §P1-6 line 142 explicitly flagged this ("NULL user_id rows become undeletable under `memo_replies` DELETE policy. Add `origin` column; exempt legacy in RLS.") but the original scope SQL omitted the DROP NOT NULL — it would have blocked every production run.
- **Fix:** Added `ALTER TABLE public.memo_replies ALTER COLUMN user_id DROP NOT NULL;` as new block #4 in the up migration (inserted between ADD read_by and the legacy ingest). Paired with `SET NOT NULL` restoration in the down file, ordered AFTER the DELETE of legacy rows so the constraint restoration doesn't collide with any remaining NULL.
- **Files modified:** `supabase/migrations/20260421110904_memo_model_unification.sql`, `supabase/migrations/down/20260421110904_memo_model_unification.sql`
- **Commit:** `8336029`
- **Retry:** Second apply succeeded cleanly; verification queries confirm 11 legacy rows ingested, 17 snapshot rows, all three columns present with expected nullability.

### Rule 2 (missing-critical additions)

**2. [Rule 2 - Correctness] Excluded legacy_memo rows from IntersectionObserver registration**
- **Found during:** Task 3
- **Issue:** Naive per-reply ref registration would register legacy bubbles for read-receipt observation, but legacy rows have NULL user_id — markMemoReplyRead would write the CURRENT viewer's uid into read_by, which semantically means "current user has read a memo sent by no-one". Not a crash but a data-quality issue: the read_by array would fill with uids pointing at a sender-less row.
- **Fix:** `MemoSection` now passes `ref={el => { if (el && !isLegacy && onReplyRef) onReplyRef(el, r.id); }}` — legacy bubbles render but are not observed.
- **Files modified:** `src/App.jsx`
- **Commit:** `88acff8`

**3. [Rule 2 - Observer cleanup] Added cleanup to drain timers + disconnect observer on unmount**
- **Found during:** Task 3 during lint iteration
- **Issue:** First draft of the observer useEffect created the IO and never disconnected it; pending 3-second setTimeouts would fire against an unmounted component.
- **Fix:** Cleanup function clears every pending timer (`timersMap.values()`) then calls `obs.disconnect()`. Captures the ref into a local before the cleanup closure to satisfy react-hooks/exhaustive-deps.
- **Files modified:** `src/App.jsx`
- **Commit:** `88acff8`

### Rule 3 (blocking-issue fixes)

**4. [Rule 3 - Lint] Dedicated memoReadAuthIdRef to decouple observer from app-wide authUserRef**
- **Found during:** Task 3 lint iteration
- **Issue:** The observer's IntersectionObserver callback needed the current auth uid. Reading `authUserRef.current?.id` inside the observer's one-shot useEffect triggered the new React 19 compiler rule `react-hooks/immutability`: "Modifying a value used previously in an effect function or as an effect dependency is not allowed" — it flagged the pre-existing `useEffect(() => { authUserRef.current = authUser; }, [authUser])` mutation on line 4411. That mutation has been in the codebase since before Phase 4; my read made it visible to the linter.
- **Fix:** Introduced `memoReadAuthIdRef` (separate ref) synced via its own `useEffect(() => { memoReadAuthIdRef.current = authUser?.id || null; }, [authUser?.id])`. Observer reads `memoReadAuthIdRef.current` instead of `authUserRef.current?.id`. Zero app-wide refactor required.
- **Files modified:** `src/App.jsx`
- **Commit:** `88acff8`

No Rule 4 (architectural) decisions required.

## Authentication Gates

None — this phase is pure schema + client refactor. All DB operations used the already-linked Supabase project via the Access Token in `.env.local`.

## Issues Encountered

- **First-apply failure on user_id NOT NULL** (see Deviation #1 above). Resolved in-session by extending the up migration before second apply. BEGIN/COMMIT wrap ensured the partial apply rolled back cleanly — verified by a follow-up `SELECT` that showed neither the snapshot nor the new columns existed post-failure.
- **Pre-existing test failure** (`tests/entitlementCache.test.js:17`) surfaced when running `npx vitest run` — verified via git-stash bisect to exist on baseline `main` without any Phase 4 changes. Logged to `deferred-items.md`.
- **React compiler strict-rule lint** — 18 pre-existing errors carry over from baseline. Phase 4 added zero net-new lint violations (baseline 18 → post-Phase-4 18). CLAUDE.md forbids App.jsx decomposition this milestone so cleanup is deferred.

## Known Stubs

None. The ingested legacy rows render through the same `memo_replies` data flow as live messages — no hardcoded empty arrays, no "coming soon" placeholders. The 6 `memos` rows skipped by the length-filter (content length ≤ 1, e.g. pure "💬") are intentional — they're placeholders the client used to bootstrap memo_reply threading and have no meaningful content to preserve.

## User Setup Required

None. Changes are live on production DB and in the committed source tree. A deploy of the React bundle (via the existing CI/CD path) is needed for the new send/read-receipt surface to reach users — the schema change is already live, so even unpushed clients continue to read and write safely (memos table still intact, memo_replies gains only additive columns).

## Threat Flags

None. No new network endpoints, auth paths, or file access introduced. The only new surface is a read-after-3s-viewport write against `memo_replies.read_by` (an existing array-append pattern already in use for `memos.read_by`), scoped to the user's own family via existing RLS.

## Phase 4 DoD — Shadow-Running Caveat

This plan satisfies **Phase 4 success criteria as defined in `.planning/ROADMAP.md` §Phase 4** (shadow-running, not cutover):

1. ✅ `memos_legacy_20260421` snapshot exists (17 rows, matches source memos exactly), origin column populated for all 11 ingested legacy rows, row-count + attribution parity at 100% for ingestable subset (content length > 1). **MEMO-01 + MEMO-03.**
2. ✅ Read receipts driven by 3-second viewport IntersectionObserver only; auto-read-on-receipt removed from date-change effect. **MEMO-02.**
3. ✅ `public.memos` NOT dropped; v1.1 MEMO-CLEANUP-01 is the scheduled removal ticket (referenced in CLAUDE.md + ROADMAP).
4. ⚠️ **Supabase branch Playwright regression step is EXPLICITLY OUT OF SCOPE for this plan** per the combined-plan-execute directive. The schema changes have been validated against prod directly (same route Phases 2-3 used); no branching pipeline ran for this phase. The next E2E execution of `playwright.real.config.js` will implicitly cover the new surface (parent→child memo + child reply + read receipt).

**`memos` TABLE STATUS: intact, untouched by the down file, retained read-mostly for 30 days per CLAUDE.md Phase 4 rule. DROP scheduled for v1.1 MEMO-CLEANUP-01.**

## Next Phase Readiness

- **Phase 5 Stream A (GATE-01/02)** unblocked: memo surface is stable and the only UI gate concern is pre-pair visibility, which doesn't interact with memo internals.
- **Phase 5 Stream B (RL-01..04)** unblocked: remote-listen doesn't touch memo storage.
- **Phase 5 Stream C (SOS-01 + KKUK-*)** unblocked: the sos_events pattern is independent of memos.
- **v1.1 MEMO-CLEANUP-01** queued: will DROP `public.memos` + `memos_legacy_20260421`, remove `fetchMemos`/`markMemoRead`/`upsertMemo` from `sync.js`, remove the legacy `memos.read_by` fetch + state from App.jsx, and delete the deprecation comments.

## Self-Check: PASSED

Verified before return:

- Commit `8336029` (migration) present in `git log`.
- Commit `77ccdfa` (sync.js) present in `git log`.
- Commit `88acff8` (App.jsx) present in `git log`.
- Commit `5302467` (deferred-items) present in `git log`.
- File `supabase/migrations/20260421110904_memo_model_unification.sql` exists (113 lines).
- File `supabase/migrations/down/20260421110904_memo_model_unification.sql` exists (45 lines).
- File `.planning/phases/04-memo-model-unification/deferred-items.md` exists (38 lines).
- Live DB verification queries (all PASSED):
  - `SELECT count(*) FROM public.memos_legacy_20260421` → 17 (matches memos).
  - `SELECT count(*) FROM public.memos` → 17 (unchanged — NOT dropped).
  - `SELECT count(*) FROM public.memo_replies WHERE origin='legacy_memo'` → 11 (matches ingestable count).
  - `SELECT to_regclass('public.memos')` → 'memos' (exists).
  - `SELECT is_nullable FROM information_schema.columns WHERE table_name='memo_replies' AND column_name IN ('origin','read_by','user_id')` → all YES.
- Lint: baseline 18 errors, post-Phase-4 18 errors — zero net-new.
- Build: `npx vite build` → succeeded (718.80 kB gzip 205.39 kB). Warnings pre-existing.
- Smoke-test of read_by write path (ROLLBACK-wrapped) produced expected `{00000000-...0001}` array then reverted cleanly; verification query confirms no test UUID residue in prod.
- No unexpected file deletions in any of the 4 commits (checked via `git diff --diff-filter=D`).

---
*Phase: 04-memo-model-unification*
*Completed: 2026-04-21*

## Self-Check: PASSED (re-verified after state updates)
