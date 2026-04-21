---
phase: 01-migration-hygiene-baseline
plan: 03
subsystem: database
tags: [supabase, migrations, drift, reconciliation, memos, infra]

# Dependency graph
requires:
  - phase: 01-migration-hygiene-baseline
    plan: 01
    provides: "Archived loose supabase/*.sql helpers; clean migrations/ directory to author into"
  - phase: 01-migration-hygiene-baseline
    plan: 02
    provides: "supabase/migrations/down/ + README declaring up-down pairing + BEGIN/COMMIT wrap convention"
provides:
  - "First tracked reconciliation migration authored per down/README.md conventions"
  - "public.memos reconciliation DDL (created_at, user_id, user_role columns) ready for branch apply"
  - "Paired rollback file at down/20260421074417_reconcile_schema_drift.sql"
  - "Schema drift evidence (db-diff-output.txt) with deferred-item annotations for Phase 2+"
affects: [01-05, 02-unblock-core, phase-4-memo-model]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Docker-less drift capture via `supabase db query --linked` over information_schema / pg_policies (fallback for Windows executors where shadow-DB spin-up is unavailable)"
    - "ADD COLUMN IF NOT EXISTS + NULLABLE-with-default for legacy-row-safe schema reconciliation (no backfill)"
    - "Column-level paired rollback (DROP COLUMN IF EXISTS) with strict reverse ordering"

key-files:
  created:
    - ".planning/phases/01-migration-hygiene-baseline/db-diff-output.txt"
    - "supabase/migrations/20260421074417_reconcile_schema_drift.sql"
    - "supabase/migrations/down/20260421074417_reconcile_schema_drift.sql"
  modified: []

key-decisions:
  - "Timestamp chosen: 20260421074417 (UTC at author time) — lexicographically > 20260418000006 so migration ordering is correct"
  - "Fell back to `supabase db query --linked` + information_schema reads (documented inside db-diff-output.txt) because Docker Desktop is unavailable; canonical `supabase db diff` requires a local shadow container"
  - "All three new columns NULLABLE per CONTEXT.md D-06 — NOT NULL DEFAULT now() would destroy legacy chronological ordering by stamping identical migration-time timestamps on every pre-existing row"
  - "user_id FK declared ON DELETE SET NULL (audit-log preservation; same intent as SOS-01 immutable-audit direction)"
  - "RLS policy duplication on memos (six policies across two naming families) deferred to Phase 2 Stream C — outside Phase 1 boundary, flagged in db-diff-output.txt Finding 2 for traceability"
  - "No CREATE TABLE public.memos authored retroactively — out of scope per CONTEXT.md D-03; ADD COLUMN IF NOT EXISTS works regardless of whether tracked migrations ever defined the table"

patterns-established:
  - "Drift-reconciliation migration format: metadata header citing CONTEXT.md, BEGIN/COMMIT wrap, one ADD COLUMN IF NOT EXISTS per numbered block, comments explaining NULLABLE rationale and FK cascade choice"
  - "Down file mirrors up 1:1 in REVERSE order with IF EXISTS guards and explicit data-impact note"

requirements-completed: []

# Metrics
duration: ~5min
completed: 2026-04-21
---

# Phase 01 Plan 03: Reconcile Schema Drift Summary

**Authored the first consumer of the Plan 01-02 up-down migration convention — a reconciliation migration that adds the three `memos` columns (`created_at`, `user_id`, `user_role`) missing from production and confirmed as the 42703 root cause, plus a byte-identical paired down file.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-21T07:41:16Z
- **Completed:** 2026-04-21T07:46:13Z
- **Tasks:** 3 (atomic commits per task)
- **Files created:** 3 / Files modified: 0

## Accomplishments

- Captured production schema drift evidence at `.planning/phases/01-migration-hygiene-baseline/db-diff-output.txt` via live `supabase db query --linked` reads against project `qzrrscryacxhprnrtpjd`. Confirmed `public.memos` in prod has only 6 columns (`id`, `family_id`, `date_key`, `content`, `updated_at`, `read_by`) and is MISSING `created_at` / `user_id` / `user_role` — the 42703 root cause documented in CONTEXT.md D-06 and PITFALLS.md line 150.
- Authored forward reconciliation migration `supabase/migrations/20260421074417_reconcile_schema_drift.sql` with BEGIN/COMMIT wrap, `IF NOT EXISTS` guards on every `ADD COLUMN`, and all three new columns declared NULLABLE per CONTEXT.md D-06 (prevents destruction of legacy chronological ordering).
- Authored paired rollback `supabase/migrations/down/20260421074417_reconcile_schema_drift.sql` with byte-identical filename (down/README.md Rule 1), DROPs in reverse order (`user_role` → `user_id` → `created_at`), `IF EXISTS` guards on every DROP, and explicit refusal to DROP the table itself.
- Documented deferred drift items (RLS policy duplication on `memos`, untracked `CREATE TABLE memos`) inside `db-diff-output.txt` so downstream phases (Phase 2 Stream C, Phase 4 memo-model) have a pointer rather than having to re-discover.
- Zero database changes applied — Plan 05 owns apply + Playwright regression on the Supabase branch.

## Task Commits

Each task was committed atomically via `git commit` with hooks enabled (sequential main-tree mode):

1. **Task 1: Capture prod schema drift evidence** — `c81b16f` (chore)
2. **Task 2: Author forward reconciliation up migration** — `dd6eb18` (feat)
3. **Task 3: Pair the reconciliation down migration** — `eec63e4` (feat)

## Files Created/Modified

- `.planning/phases/01-migration-hygiene-baseline/db-diff-output.txt` — 148-line evidence file. Documents WHY `supabase db diff` was unavailable (Docker missing on Windows executor) and the documented fallback used, plus the observed prod schema, the missing-column table, the sister-table `memo_replies` template, Finding 2 (RLS policy duplication, deferred), Finding 3 (no tracked CREATE TABLE, deferred), a "TO ABSORB" / "DEFERRED" split for reviewer cross-check, and secrets hygiene assertions.
- `supabase/migrations/20260421074417_reconcile_schema_drift.sql` — 67-line forward migration. Metadata header citing CONTEXT.md D-06 and the db-diff evidence file; BEGIN/COMMIT wrap; three ADD COLUMN IF NOT EXISTS blocks with inline rationale comments for each NULLABLE choice.
- `supabase/migrations/down/20260421074417_reconcile_schema_drift.sql` — 38-line paired rollback. Same header citing the up file; BEGIN/COMMIT wrap; three DROP COLUMN IF EXISTS in reverse order with an explicit data-impact note.

## Decisions Made

- **Timestamp `20260421074417` (UTC at author time)** — 20260421074417 > 20260418000006 (last existing), so migration ordering is correct. Chose the execution-moment UTC timestamp rather than a future timestamp so the tracked migration history is chronologically honest.
- **Fell back to `supabase db query --linked` + `information_schema.columns` / `pg_policies` reads.** The canonical `supabase db diff --linked --schema public` command failed with `Docker Desktop is a prerequisite for local development` — shadow-DB spin-up requires Docker, unavailable on this Windows executor. Plan 01-03 Task 1's documented fallback explicitly covers this: "manually SELECT from `information_schema.columns` ... document whichever path is used." Evidence file begins with a header explaining the tool choice.
- **All three columns NULLABLE, no NOT NULL anywhere.** CONTEXT.md D-06 mandates this ("이미 데이터가 있으므로 NOT NULL 금지, 기본값 NULL"). Specifically `created_at` could tempt a `NOT NULL DEFAULT now()` but that would stamp every legacy row with an identical migration-time timestamp, destroying chronological ordering and breaking RT-03.
- **`user_id` FK with `ON DELETE SET NULL`** — preserves the memo row as an audit record when a child account is deleted, consistent with SOS-01 immutable-audit direction. Not `ON DELETE CASCADE` (would erase audit trail) and not `NO ACTION` (would block child account deletion).
- **`user_role` is plain `text`, no CHECK constraint.** Tightening to `CHECK IN ('parent','child')` is Phase 5 territory; Phase 1 is hygiene baseline.
- **Did NOT absorb RLS policy duplication on `memos` into this migration.** The prod diff revealed six policies across two naming families (`memo_*` using `get_my_family_ids()` vs `memos_*` using inline `family_members` join). Both families grant the same effective access, but reconciling them requires tracked tests to confirm no access-path regression. Deferred to Phase 2 Stream C per the Phase 1 scope boundary. Called out as Finding 2 in `db-diff-output.txt`.
- **Did NOT author a retroactive `CREATE TABLE public.memos`.** The table predates migration discipline; Phase 1 doesn't retroactively backfill table-creation history per CONTEXT.md D-03. `ADD COLUMN IF NOT EXISTS` is safe regardless.

## Deviations from Plan

### Rule 3 (blocking-issue repair) — documented fallback invocation

**1. [Rule 3 - Tooling] `supabase db diff` unavailable; used documented fallback**
- **Found during:** Task 1
- **Issue:** `supabase db diff --linked --schema public` failed with `Docker Desktop is a prerequisite for local development. failed to inspect docker image ... pipe/docker_engine: The system cannot find the file specified.` Docker Desktop is not installed/running on this Windows executor.
- **Fix:** Used the plan's own documented fallback (Plan 01-03 Task 1's `<action>` explicitly says "If the executor environment lacks ... `supabase` CLI ..., the fallback is: manually SELECT from `information_schema.columns`"). Invoked `npx supabase db query --linked -f <inspect.sql>` against the linked prod project, which routes through the Management API and requires no local Docker container. Captured both `information_schema.columns` for `memos` + `memo_replies` and `pg_policies` for `memos`. File begins with a header line explaining the fallback tool used (acceptance criterion requirement).
- **Files modified:** `.planning/phases/01-migration-hygiene-baseline/db-diff-output.txt`
- **Commit:** `c81b16f`
- **Not a plan violation** — explicitly covered by the plan's fallback clause.

Beyond this one invocation of the documented fallback, **no other deviations**. No Rule 1 bugs surfaced, no Rule 2 missing-critical additions needed, no Rule 4 architectural decisions required.

## Drift Findings & Scope Decisions

The prod schema read surfaced three distinct drift items. Per the Plan 01-03 scope reminder ("DO NOT add non-memos DDL unless `db diff` proves additional drift"), only Finding 1 is absorbed here; Findings 2 and 3 are documented as deferred with phase pointers.

| Finding | Description | Plan 01-03 Decision |
|---------|-------------|---------------------|
| 1. `memos` missing 3 columns | `created_at`, `user_id`, `user_role` absent in prod, referenced by consumer code | ABSORBED — this IS the plan's scope |
| 2. `memos` RLS policy duplication | Six policies in two naming families (`memo_*` helper-based, `memos_*` inline join) | DEFERRED to Phase 2 Stream C — flagged in `db-diff-output.txt` Finding 2 |
| 3. No tracked `CREATE TABLE memos` | Table created by one of the archived loose SQL files pre-migration-discipline | DEFERRED — out of scope per CONTEXT.md D-03; ADD COLUMN IF NOT EXISTS is safe regardless |

No additional drift items were absorbed into the migration beyond the three `memos` columns, so no `ABSORBED FROM DIFF` annotations exist in the up file and no additional reverse DDL was added to the down file. The pairing is exactly 3 ADD ↔ 3 DROP.

## Issues Encountered

- **`supabase db diff` requires Docker Desktop** on Windows executors. Handled via the plan's documented fallback (see Deviations). Consider making this Windows-friendliness note explicit in future migration-hygiene plans so the fallback isn't rediscovered each time.
- **git CRLF warning** on each write (`LF will be replaced by CRLF the next time Git touches it`). Non-fatal; git applied its configured line-ending policy. All three files committed cleanly.

## User Setup Required

None for this plan. The migration files are authored and committed but NOT applied. Plan 05 owns the Supabase branch apply + Playwright regression step and will surface any human-action checkpoints needed at that time.

## Next Phase Readiness

- **Plan 01-05 (Supabase branch apply + Playwright regression) unblocked:** the up and down files are in `supabase/migrations/` ready for `supabase db push` onto the `phase-1-baseline` branch. The evidence file provides the pre-apply schema expectation so Plan 05 can verify post-apply state (memos should have 9 columns, not 6).
- **Phase 2 (unblock core):** inherits the now-enforced up-down pairing convention from Plan 01-02 plus this first concrete example. Each Phase 2 stream migration (`push_subscriptions` hardening, `saved_places` / `family_subscription` publication wiring, `pair_code` RLS) MUST ship with a paired down file — `db-diff-output.txt` Finding 2 explicitly hands off the `memos` RLS duplication to Phase 2 Stream C.
- **Phase 4 (memo model unification):** the three new columns unblock `memo_replies`-style queries against `memos` and set up the shadow-running DoD; Phase 4 can safely ORDER BY `memos.created_at` with the understanding that legacy rows have NULL (fall back to `ORDER BY id`).

## Self-Check: PASSED

Verified before return:

- File `.planning/phases/01-migration-hygiene-baseline/db-diff-output.txt` exists (148 lines).
- File `supabase/migrations/20260421074417_reconcile_schema_drift.sql` exists (67 lines).
- File `supabase/migrations/down/20260421074417_reconcile_schema_drift.sql` exists (38 lines).
- Filename pairing: up and down basenames are byte-identical (`20260421074417_reconcile_schema_drift.sql`).
- Commit `c81b16f` (chore: capture drift evidence) present in `git log`.
- Commit `dd6eb18` (feat: author up migration) present in `git log`.
- Commit `eec63e4` (feat: pair down migration) present in `git log`.
- Plan-level verification block all-green (see inline verification in execution log):
  - BEGIN/COMMIT wrap on both files.
  - `ADD COLUMN IF NOT EXISTS created_at timestamptz`, `user_id uuid`, `user_role text` — all present.
  - Zero matches for `ADD COLUMN IF NOT EXISTS (created_at|user_id|user_role)[^;]*NOT NULL` (the hard D-06 rule).
  - `DROP COLUMN IF EXISTS user_role | user_id | created_at` in reverse order in the down file.
  - No `DROP TABLE public.memos`, no `TRUNCATE`, no `DELETE FROM` in down file.
  - Timestamp `20260421074417` lexicographically > `20260418000006` (ordering correct).
- Secret scan (`grep -qE 'eyJ|SERVICE_ROLE|VAPID_PRIVATE|4c781fb7'`) on all three files: CLEAN.
- Post-commit deletion scan: no unexpected file deletions across the 3 commits.

---
*Phase: 01-migration-hygiene-baseline*
*Completed: 2026-04-21*
