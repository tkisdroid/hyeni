---
phase: 01-migration-hygiene-baseline
plan: 01
subsystem: supabase-hygiene
tags: [migration-hygiene, supabase, archive, drift-reduction, devops]
requires: []
provides:
  - supabase-archive-manifest
  - loose-sql-eliminated
affects:
  - supabase/
  - supabase/archive/
tech_stack:
  added: []
  patterns: [git-rename-for-history, deprecation-manifest]
key_files:
  created:
    - supabase/archive/_deprecated_add-phone-columns.sql
    - supabase/archive/_deprecated_add-write-policies.sql
    - supabase/archive/_deprecated_child-locations.sql
    - supabase/archive/_deprecated_fix-all-rls.sql
    - supabase/archive/_deprecated_fix-rls.sql
    - supabase/archive/_deprecated_fix-rls-v2.sql
    - supabase/archive/_deprecated_fix-sync-final.sql
    - supabase/archive/_deprecated_migration.sql
    - supabase/archive/_deprecated_parent-pairing-fix.sql
    - supabase/archive/_deprecated_patch-existing-db.sql
    - supabase/archive/_deprecated_push-tables.sql
    - supabase/archive/_deprecated_stickers-and-geofence.sql
    - supabase/archive/README.md
  modified: []
decisions:
  - D-01 glob `fix-rls*.sql` resolved to 2 files, producing 12 archived files (not 11)
  - Flat archive layout chosen over sub-categorization (D-17 executor discretion) — 12 files do not warrant grouping
  - `git mv` used for every file so renames are recognised at 100% similarity and `git log --follow` continues to reach pre-archive history
metrics:
  duration: ~4 minutes
  completed_date: 2026-04-21
  tasks_completed: 2
  files_touched: 13
  commits: 2
---

# Phase 1 Plan 1: Archive Loose Supabase SQL Summary

Moved the 12 loose `supabase/*.sql` ad-hoc patch files into `supabase/archive/_deprecated_*.sql` via `git mv` (history preserved as renames) and added a deprecation manifest README that redirects readers to `supabase/migrations/` as the canonical schema source. This removes the "two SQL directories with drift" pre-condition (PITFALLS.md line 155) so that downstream plans can produce a clean `supabase db diff` signal.

## What Was Built

### Task 1 — Archive move (commit c2c20c1)

All 12 loose SQL files moved into `supabase/archive/_deprecated_*.sql`:

| Original path | Archived path |
|---------------|---------------|
| supabase/add-phone-columns.sql | supabase/archive/_deprecated_add-phone-columns.sql |
| supabase/add-write-policies.sql | supabase/archive/_deprecated_add-write-policies.sql |
| supabase/child-locations.sql | supabase/archive/_deprecated_child-locations.sql |
| supabase/fix-all-rls.sql | supabase/archive/_deprecated_fix-all-rls.sql |
| supabase/fix-rls.sql | supabase/archive/_deprecated_fix-rls.sql |
| supabase/fix-rls-v2.sql | supabase/archive/_deprecated_fix-rls-v2.sql |
| supabase/fix-sync-final.sql | supabase/archive/_deprecated_fix-sync-final.sql |
| supabase/migration.sql | supabase/archive/_deprecated_migration.sql |
| supabase/parent-pairing-fix.sql | supabase/archive/_deprecated_parent-pairing-fix.sql |
| supabase/patch-existing-db.sql | supabase/archive/_deprecated_patch-existing-db.sql |
| supabase/push-tables.sql | supabase/archive/_deprecated_push-tables.sql |
| supabase/stickers-and-geofence.sql | supabase/archive/_deprecated_stickers-and-geofence.sql |

All 12 renames recorded at 100% similarity (`R100`). `git log --follow supabase/archive/_deprecated_fix-rls.sql` reaches the initial project commit (`df0413c`), confirming history preservation.

### Task 2 — Deprecation manifest (commit 5405e73)

Created `supabase/archive/README.md` (42 lines, zero secrets) containing:

- **Headline DEPRECATED declaration** — "no longer applied by any tooling"
- **Canonical pointer** — `supabase/migrations/` referenced twice (header + body)
- **Archive date** — 2026-04-21 with D-01/D-02 attribution
- **Glob expansion note** — Explicit call-out that D-01's 11 entries expanded to 12 files via `fix-rls*.sql`
- **Per-file summary table** — 8-15 word description of each file's primary operation (e.g., "Creates `child_locations` table (one row per child, latest lat/lng) with RLS")
- **Archived-not-deleted rationale** — `git log --follow` auditability, Phase 2 `join_family` RPC reuse path, PIPA retention traceability

`_deprecated_` appears 13 times in the README (12 filenames plus one in the glob-expansion header note).

## File Count Note — 11 Listed, 12 Archived

CONTEXT.md D-01 lists 11 filename entries. One of them — `fix-rls*.sql` — is a glob that matches two real files in the repo: `fix-rls.sql` and `fix-rls-v2.sql`. Per D-17 (executor discretion on archive layout), the glob was expanded to both real files, producing a final count of **12 archived files** rather than 11. This expansion is documented explicitly in the PLAN objective, in the archive README, and again here so reviewers aren't surprised by the discrepancy.

## Decisions Made

1. **Flat archive layout** (no sub-directories) — 12 files do not justify grouping and the `_deprecated_` prefix already signals the shared status. Sub-categorization (e.g., `rls/`, `schema/`) would add lookup friction without benefit. Per D-17.
2. **`git mv` used everywhere** — never `mv` + `git rm`. Confirmed by `git status` showing 12 `R` entries at 100% similarity and by `git log --follow` reaching pre-archive history.
3. **Separate atomic commits for move and README** — Task 1 is a pure rename (reviewable as a refactor), Task 2 adds new prose (reviewable as docs). Squashing them would hide the clean rename diff.

## Deviations from Plan

None — plan executed exactly as written. The 11→12 glob expansion was anticipated and documented in the plan objective itself, so it is not a deviation.

## Authentication Gates

None.

## Verification Results

Plan-level verification block (all 5 checks pass):

| # | Check | Result |
|---|-------|--------|
| 1 | `test -z "$(ls supabase/*.sql 2>/dev/null)"` — zero loose SQL | PASS |
| 2 | `ls supabase/archive/_deprecated_*.sql \| wc -l` = 12 | PASS (12) |
| 3 | `grep -c '_deprecated_' supabase/archive/README.md` ≥ 12 | PASS (13) |
| 4 | `git log --name-status HEAD~1` shows `^R` lines | PASS (12 renames) |
| 5 | `git status supabase/migrations supabase/functions supabase/config.toml` clean | PASS (untouched) |

Playwright / branch verification explicitly out of scope for this plan (pure filesystem rename, zero runtime impact). End-to-end exit gate runs in Plan 05.

## Known Stubs

None. No UI or data-source code touched.

## Commits

| Commit | Task | Message |
|--------|------|---------|
| c2c20c1 | Task 1 | chore(01-01): archive 12 loose supabase/*.sql files into supabase/archive/ |
| 5405e73 | Task 2 | docs(01-01): add supabase/archive/README.md deprecation manifest |

## Self-Check: PASSED

Verified on disk:
- `supabase/archive/` contains exactly 12 `_deprecated_*.sql` files plus `README.md`.
- `supabase/*.sql` glob returns nothing at top level.
- Both commits (`c2c20c1`, `5405e73`) are reachable via `git log --oneline`.
- `supabase/migrations/`, `supabase/functions/`, `supabase/config.toml`, `supabase/PUSH-SETUP.md`, and `src/App.jsx` all unmodified by this plan.
