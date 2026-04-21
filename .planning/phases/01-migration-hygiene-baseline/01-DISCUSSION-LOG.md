# Phase 1: Migration Hygiene & Baseline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 01-migration-hygiene-baseline
**Mode:** `--auto` (YOLO — all decisions auto-resolved with recommended defaults, single-pass)
**Areas discussed:** Archive Layout, Down Migrations, Reconciliation Migration, Baselines, Playwright Regression Scope, Supabase Branch Workflow

---

## Archive Layout

| Option | Description | Selected |
|--------|-------------|----------|
| `supabase/archive/_deprecated_*.sql` | Keep files in repo, prefix with `_deprecated_`, searchable via git | ✓ |
| `supabase/deprecated/` without prefix | Simpler naming, directory name carries the signal | |
| `git rm` outright | Smallest repo footprint | |

**User's choice:** Auto-resolved to option 1 (matches SUMMARY.md Pre-Phase 0 recommendation).
**Notes:** Per PITFALLS.md, drift between loose SQL and tracked migrations was root cause of `memos` 42703 bug. Archive-in-repo preserves history for forensic debugging; `git rm` would lose context.

---

## Down Migrations

| Option | Description | Selected |
|--------|-------------|----------|
| `supabase/migrations/down/` dir, 1:1 filename pairs | One down file per up file, identical name | ✓ |
| Inline `-- DOWN:` comment blocks in up files | Single-file approach, no sibling directory | |
| Script-driven diff-based rollback | Derive rollback from diff, no static files | |

**User's choice:** Auto-resolved to option 1.
**Notes:** Backfilling down files for all existing migrations is out of scope; Phase 1 only ensures convention exists + reconciliation migration (D-07) has matching down file. Future migrations follow the pattern.

---

## Reconciliation Migration

| Option | Description | Selected |
|--------|-------------|----------|
| `YYYYMMDDHHMMSS_reconcile_schema_drift.sql` | Follows existing `20260418*` convention | ✓ |
| `20260421_reconcile.sql` (no timestamp precision) | Shorter name | |
| Split into per-table files | Multiple reconciliation migrations | |

**User's choice:** Auto-resolved to option 1.
**Notes:** Full timestamp precision (YYYYMMDDHHMMSS) sorts deterministically in migration order. Single consolidated file simpler to review; reconciliation scope is finite (bounded by `supabase db diff` output at a point in time).

---

## Baselines — Storage Location

| Option | Description | Selected |
|--------|-------------|----------|
| `.planning/research/baselines/` committed to git | Auditable, versioned, visible in PRs | ✓ |
| External (gist, S3, shared drive) | Keeps repo slim | |
| Git tag only, no file snapshots | Minimal but less inspectable | |

**User's choice:** Auto-resolved to option 1.
**Notes:** Only committable content (pg_policies, FCM project_id, VAPID public key, anon URL) — all already public or structurally safe. Private keys explicitly excluded (D-09).

---

## Baselines — Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata only (public keys, project IDs) + git tag for Edge Function | Safe to commit, sufficient for rollback identification | ✓ |
| Everything including private keys (encrypted) | Full snapshot but introduces key-management burden | |
| Git tag only, no separate files | Minimal | |

**User's choice:** Auto-resolved to option 1 (metadata-only + tag).
**Notes:** Per STACK.md + PITFALLS.md, VAPID rotation is explicitly forbidden during redeploy. Snapshotting the PUBLIC key in repo lets future phases confirm "we are still on the same VAPID pair" without risking secret exposure.

---

## Playwright Regression Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full happy-path sweep: auth, pair, kkuk, memo, events, location | All currently-working flows stay green | ✓ |
| Critical-path subset: kkuk + memo only (audit's main flows) | Fast but less complete | |
| New spec per each future phase, none in Phase 1 | Defer regression to phase-level | |

**User's choice:** Auto-resolved to option 1.
**Notes:** Phase 1 is the reconciliation migration's only verification gate before it touches production data (even via branch). Broader coverage reduces surprise in Phase 2+.

---

## Supabase Branch Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Per-phase branch (`phase-1-baseline`, `phase-2-A-push`, …) | Isolation; delete after merge | ✓ |
| Single long-lived `staging` branch | Less branch churn, but state accumulates | |
| No branch — local-only verification + direct main push | Fastest but violates PROJECT.md constraint | |

**User's choice:** Auto-resolved to option 1 (matches ARCHITECTURE.md §Supabase branch → main workflow).
**Notes:** Per-phase branching also matches research-agent recommendation — each phase owns its isolated Supabase state.

---

## Claude's Discretion

Areas where executor has flexibility (planner should not ask further):

- **D-15**: Exact reconciliation SQL body — depends on `supabase db diff` runtime output.
- **D-16**: Playwright selector strategy — follow existing `tests/` conventions.
- **D-17**: `supabase/archive/` subdirectory structure — by file count and natural grouping.

## Deferred Ideas

- Backfill down/ files for all existing up migrations (future as-needed basis)
- Supabase CLI version upgrade (only if `supabase db diff` is broken)
- Automated schema-drift CI check (v2 observability milestone)
- Rotating VAPID keys (explicitly forbidden; out of scope)
- Sub-team permission splits (operational, not code)
