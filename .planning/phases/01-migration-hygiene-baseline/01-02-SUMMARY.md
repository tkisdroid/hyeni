---
phase: 01-migration-hygiene-baseline
plan: 02
subsystem: database
tags: [supabase, migrations, rollback, convention, infra]

# Dependency graph
requires:
  - phase: 00-pre-existing
    provides: "Existing supabase/migrations/ with 15 forward migrations and loose supabase/*.sql helpers"
provides:
  - "supabase/migrations/down/ directory tracked in git via .gitkeep"
  - "Normative rollback convention README declaring up-down pairing and BEGIN/COMMIT wrap"
  - "Explicit OUT OF SCOPE declaration deferring retroactive backfill of 15 pre-existing up-migrations"
affects: [01-03, 01-04, 01-05, 02-unblock-core, phase-2, phase-3, phase-4, phase-5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Up↔Down migration pairing: every forward YYYYMMDDHHMMSS_<name>.sql ships a matching down/<name>.sql with inverse DDL"
    - "Transactional wrap (BEGIN;/COMMIT;) mandatory for multi-statement DDL and all DROP POLICY+CREATE POLICY sets"
    - "Idempotency guards: IF NOT EXISTS on up ops, IF EXISTS on down ops"

key-files:
  created:
    - "supabase/migrations/down/.gitkeep"
    - "supabase/migrations/down/README.md"
  modified: []

key-decisions:
  - "Adopted .gitkeep (community convention) over .keep or other placeholders"
  - "README is a convention-only document; zero retroactive backfill of existing up-migrations (D-03)"
  - "Transactional wrap is non-negotiable for DROP POLICY + CREATE POLICY sequences (D-04)"
  - "Filename pairing is byte-for-byte exact — timestamp, name, extension must match"

patterns-established:
  - "Rollback rule 1 (pairing): every up migration authored from 2026-04-21 forward ships a paired down file at supabase/migrations/down/"
  - "Rollback rule 2 (transactional wrap): BEGIN;/COMMIT; required for multi-statement migrations; ROLLBACK; on exception"
  - "Rollback rule 3 (idempotency): IF NOT EXISTS on up, IF EXISTS on down"
  - "Deferred backfill: 15 legacy up-migrations remain unpaired until a specific rollback need arises"

requirements-completed: []

# Metrics
duration: ~4min
completed: 2026-04-21
---

# Phase 01 Plan 02: Down-migrations Convention Summary

**Established supabase/migrations/down/ directory and normative README declaring up-down pairing plus BEGIN/COMMIT transactional wrap conventions for all future migrations from 2026-04-21 forward.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-21T06:02:30Z
- **Completed:** 2026-04-21T06:06:33Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- Created `supabase/migrations/down/` directory tracked in git via a zero-byte `.gitkeep` stub, eliminating the "repo has no down/ directory" pre-condition from PITFALLS.md line 321.
- Authored `supabase/migrations/down/README.md` as the single normative convention document for rollback discipline: up-down filename pairing, BEGIN/COMMIT transactional wrap, IF EXISTS idempotency guards.
- Explicitly declared in writing that retroactive backfill of down files for the 15 pre-existing up-migrations is OUT OF SCOPE for Phase 1, enumerating each legacy filename so future authors know exactly which migrations are unpaired by design.
- Zero changes to existing `supabase/migrations/*.sql` — the 15 legacy up-migrations are byte-identical to pre-plan state.

## Task Commits

Each task was committed atomically with `git commit --no-verify` (parallel worktree mode):

1. **Task 1: Create supabase/migrations/down/ directory + .gitkeep stub** — `7ad18f8` (chore)
2. **Task 2: Author supabase/migrations/down/README.md declaring pairing + transaction conventions** — `84987fa` (docs)

**Plan metadata:** `8bc97d2` (docs: SUMMARY). `.planning/` is NOT gitignored in this repo, so the SUMMARY is committed into the worktree branch `worktree-agent-a5546728` and will be merged back by the orchestrator. A mirror copy was also written to the main-repo `.planning/` filesystem for out-of-band collection if needed.

## Files Created/Modified
- `supabase/migrations/down/.gitkeep` — Zero-byte stub so git tracks the empty directory until Plan 03 writes the first real down/*.sql file.
- `supabase/migrations/down/README.md` — Binding convention document (120 lines): three rules (pairing, transactional wrap, idempotency) + inverse-DDL reference table + enumerated OUT-OF-SCOPE list of 15 legacy unpaired up-migrations + end-to-end example template (up + down) for future authors.

## Decisions Made
- **Filename pairing is byte-for-byte exact** (same timestamp, same name, same extension) — unambiguous and grep-friendly for automated pair-checks in later phases.
- **`.gitkeep` over `.keep` or `.placeholder`** — long-standing community convention widely recognized by tooling.
- **README enumerates each of the 15 unpaired legacy migrations by filename** — machine-verifiable (`grep -c '20260' README.md ≥ 15`) and gives any future contributor a concrete list of "if you need to roll one of THESE back, write the down file at that moment."
- **Transactional wrap is normative for multi-statement migrations** and explicitly required for any `DROP POLICY ... ; CREATE POLICY ...` sequence (closes the race window where the table is fully open between DROP and CREATE).
- **Single-statement migrations are not strictly required to wrap** but README encourages it for uniform readability.

## Deviations from Plan

None — plan executed exactly as written.

The plan's exact acceptance criteria (including the 15-filename enumeration, the three literal markers `BEGIN;` / `COMMIT;` / `pairing` / `OUT OF SCOPE`, and the secret scan) all passed on first run. No Rule 1 bug fixes, no Rule 2 missing-critical additions, no Rule 3 blocking-issue repairs, no Rule 4 architectural checkpoints needed.

## Issues Encountered

- **Minor (non-blocking):** The plan's published automated verification one-liner embeds `grep -q 'Up .. Down pairing'` where the two `..` wildcards are intended to match the Unicode `↔` (U+2194) character. In Git Bash on Windows the multi-byte `↔` does not reliably match `.` in the current locale, so the compound single-line verification command returned non-zero even though the README contains the exact required phrase `Up ↔ Down pairing`. Split-step verification (each grep run individually) passed cleanly. The README content itself is correct and matches plan expectations; no code change required — this is a verifier-tooling locale nuance, not a plan deviation. Flagging for the verifier agent in case they want to split the compound verification in future plans on Windows.

## User Setup Required

None — no external service configuration required. This plan authors a single markdown convention document and a zero-byte stub file; there are no environment variables, dashboard changes, or credentials involved.

## Next Phase Readiness

- **Plan 01-03 (reconciliation migration) unblocked:** can now write its paired down file directly into `supabase/migrations/down/YYYYMMDDHHMMSS_reconcile_schema_drift.sql` with no pre-step, following the rules declared in the README.
- **Plan 01-04 (baselines) and 01-05 (branch verification):** no direct dependency on this plan.
- **Phases 2-5:** every migration authored from here on MUST follow the convention — planners and executors should cite `supabase/migrations/down/README.md` in their PLAN `context` blocks.

## Self-Check: PASSED

Verified before return:

- File `supabase/migrations/down/.gitkeep` exists (0 bytes).
- File `supabase/migrations/down/README.md` exists (120 lines).
- File `.planning/phases/01-migration-hygiene-baseline/01-02-SUMMARY.md` exists in both worktree and main-repo `.planning/`.
- Commit `7ad18f8` (chore: create down/ + .gitkeep) present in `git log`.
- Commit `84987fa` (docs: declare up-down + BEGIN/COMMIT conventions) present in `git log`.
- Commit `8bc97d2` (docs: SUMMARY) present in `git log`.
- Post-commit deletion scan: no unexpected file deletions across the 3 commits.
- Secret scan on README (`grep -E 'VAPID_PRIVATE|SERVICE_ROLE|eyJ'`): CLEAN.
- Existing 15 up-migrations in `supabase/migrations/*.sql`: byte-identical, `git diff` empty.
- All plan-level verification markers present: `BEGIN;` (4x), `COMMIT;` (4x), `OUT OF SCOPE` (1x), `pairing` (present), `20260` (17x ≥ 15 required).

---
*Phase: 01-migration-hygiene-baseline*
*Completed: 2026-04-21*
