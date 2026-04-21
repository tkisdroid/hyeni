---
phase: 01-migration-hygiene-baseline
verified: 2026-04-21T00:00:00Z
verified_at: 2026-04-21
status: passed
score: 4/4 must-haves verified
must_haves_verified: 4/4
overrides_applied: 0
deviations_accepted:
  - branch-workflow-to-mcp-direct-apply (user option B, $25/mo savings)
  - playwright-real-services-deferred-to-phase-2-stream-a
  - postgres-fast-default-observation-on-17-legacy-rows
human_verification: []
---

# Phase 1: Migration Hygiene & Baseline — Verification Report

**Phase Goal:** 라이브 프로덕션 데이터에 영향을 줄 이후 phase들을 위해 마이그레이션 위생과 롤백 기반을 확보한다. Phase 2~5 전부의 전제 조건.
**Verified:** 2026-04-21
**Status:** passed (with 3 documented deviations accepted)
**Re-verification:** No — initial verification
**Mode:** Goal-backward against ROADMAP.md §Phase 1 Success Criteria (4 items)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth (Success Criterion)   | Status     | Evidence       |
| --- | --------------------------- | ---------- | -------------- |
| 1   | `supabase/migrations/down/` 디렉터리 + README 컨벤션 존재 | VERIFIED | Directory exists on disk; `supabase/migrations/down/README.md` (120 lines) declares Rule 1 (byte-for-byte up↔down pairing), Rule 2 (BEGIN/COMMIT wrap — non-negotiable for DROP POLICY+CREATE POLICY sequences), Rule 3 (IF EXISTS / IF NOT EXISTS idempotency); enumerates 15 legacy unpaired migrations as explicit OUT-OF-SCOPE |
| 2   | 루스 `supabase/*.sql` → `supabase/archive/` + reconciliation migration applied (incl. `memos` 누락 컬럼) | VERIFIED | (a) Archive: 12 `_deprecated_*.sql` files in `supabase/archive/` + README (42 lines); `ls supabase/*.sql` at repo root returns 0 files. (b) Reconciliation: `supabase/migrations/20260421074417_reconcile_schema_drift.sql` (67 lines, BEGIN/COMMIT wrapped, 3× ADD COLUMN IF NOT EXISTS, all NULLABLE per D-06) + byte-identical paired `down/` file (38 lines, reverse-order DROPs, IF EXISTS guards). (c) Applied to prod via MCP `apply_migration` (01-05-SUMMARY); post-apply `execute_sql` confirms `created_at timestamptz`, `user_id uuid`, `user_role text` all `is_nullable: YES`; 17 legacy rows intact |
| 3   | `pg_policies` 스냅샷 + VAPID/FCM env 스냅샷 + `push-notify-baseline-20260421` git 태그 고정 | VERIFIED | (a) `pg-policies-20260421.csv` (93 lines, CSV header starts with `schemaname`, 60 policies × 22 tables) + `pg-policies-20260421.sql` (499 lines, 60 CREATE POLICY blocks). (b) `env-metadata.md` (77 lines, 12 `[DO NOT COMMIT]` sentinels covering VAPID private / FCM service-account / Supabase service-role / Kakao / Qonversion secrets; only public anon JWT + publishable key + FCM project_id + VAPID public key present; secret scan CLEAN). (c) `README.md` manifest (77 lines, Allowed/Forbidden policy + pre-commit grep recipes). (d) Annotated git tag `push-notify-baseline-20260421` exists LOCALLY (`bc66f38`) AND on `origin` (remote ref `88850dc` → `bc66f38`); tagger `Oh_seung_min`; message cites rollback anchor for Phase 2 Stream A |
| 4   | Playwright real-services smoke(`playwright.real.config.js`) 회귀 없음 on reconciliation migration | PASSED (deviation accepted — deferred) | 11 real-services specs present in `tests/e2e/*-real.spec.js` (family-journey, parent-real, child-anon-real, realtime-connection-real, subscription-flow, kakao-real, kakao-map-real, qonversion-real, error-injection-real, a11y-real, perf-real). Execution deferred to Phase 2 Stream A per 01-05-SUMMARY documented rationale: (1) Supabase branch workflow skipped per user option B, (2) prod serves continuous real-user traffic against the same Supabase, (3) natural smoke window is `push-notify` v31 redeploy in Phase 2 Stream A — first phase with end-to-end push-verifiable pipeline. Additive-only nullable-safe migration has inherent low regression risk. |

**Score:** 4/4 truths verified (3 fully executed, 1 passed via documented deferral with rollback path intact)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/archive/_deprecated_*.sql` × 12 | 12 loose SQL files relocated | VERIFIED | 12 files on disk, all `R100` renames (history preserved to initial commit `df0413c`) |
| `supabase/archive/README.md` | Deprecation manifest + per-file summaries | VERIFIED | 42 lines, declares "no longer applied by any tooling", canonical pointer to `supabase/migrations/`, per-file summary table, D-01/D-02 attribution |
| `supabase/migrations/down/` + README | Convention directory + normative README | VERIFIED | Directory tracked in git; README.md = 120 lines with 3 rules, inverse-DDL reference table, 15-file OUT-OF-SCOPE enumeration, end-to-end template |
| `supabase/migrations/20260421074417_reconcile_schema_drift.sql` | Up migration for `memos` 3 columns | VERIFIED | 67 lines; BEGIN/COMMIT wrap; 3× ADD COLUMN IF NOT EXISTS; all NULLABLE (no NOT NULL anywhere); `user_id` FK ON DELETE SET NULL; timestamp `20260421074417` > last existing `20260418000006` |
| `supabase/migrations/down/20260421074417_reconcile_schema_drift.sql` | Paired rollback, byte-identical basename | VERIFIED | 38 lines; BEGIN/COMMIT wrap; DROP COLUMN IF EXISTS in REVERSE order (user_role → user_id → created_at); explicit data-impact note; no DROP TABLE, no TRUNCATE, no DELETE FROM |
| `.planning/research/baselines/pg-policies-20260421.csv` | Prod pg_policies dump | VERIFIED | 93 lines; 60 policies × 22 tables; CSV header `schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check` |
| `.planning/research/baselines/pg-policies-20260421.sql` | Human-readable DDL rendering | VERIFIED | 499 lines; 60 CREATE POLICY blocks with capture-date header |
| `.planning/research/baselines/env-metadata.md` | Public-only env snapshot | VERIFIED | 77 lines; 12 DO-NOT-COMMIT sentinels (≥ 4 required); only public keys present; secret scan CLEAN |
| `.planning/research/baselines/README.md` | Commit policy manifest | VERIFIED | 77 lines; Allowed/Forbidden policy + pre-commit grep recipes; zero live family UUIDs (redacted in commit `5f21ff9`); grep-hardened to avoid false-positive postgres-URI matches (commit `bc66f38`) |
| Git tag `push-notify-baseline-20260421` | Annotated tag on main HEAD | VERIFIED | Local: `88850dc` → commit `bc66f38`, objecttype=tag, tagger `Oh_seung_min`. Remote: `git ls-remote --tags origin` returns `88850dc	refs/tags/push-notify-baseline-20260421` — tag IS pushed |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| Reconciliation migration file | Production `memos` table | MCP `apply_migration` | WIRED | 01-05-SUMMARY: `mcp__claude_ai_Supabase__apply_migration` on project `qzrrscryacxhprnrtpjd` → `{"success": true}`; post-apply `execute_sql` confirms 3 columns exist with correct types + nullability |
| Prod `memos` columns | 42703 error root cause (PITFALLS.md:150) | `information_schema.columns` read | WIRED | Pre-apply drift evidence (`db-diff-output.txt` 148 lines) shows prod had only 6 columns; post-apply check shows 9 columns (`created_at`, `user_id`, `user_role` added) |
| Down file | Rollback execution path | MCP `apply_migration` of down contents | WIRED (verified by construction) | Down file exists on disk with byte-identical basename; Plan 01-05 documents exact MCP invocation recipe; BEGIN/COMMIT + IF EXISTS guards ensure safe replay |
| Git tag `push-notify-baseline-20260421` | Rollback anchor for Phase 2 Stream A | `git reset --hard <tag>` | WIRED | Tag exists locally AND on origin; points to commit `bc66f38` which is the last commit before the reconciliation migration was applied |
| `pg-policies-20260421.csv` | Pre-change RLS diff anchor for Phase 2 Stream C | `diff <new-dump> pg-policies-20260421.csv` | WIRED | CSV captured via `supabase db query --linked` produces clean deterministic ordering (ORDER BY schemaname, tablename, policyname); 60 policies fully enumerated |

### Data-Flow Trace (Level 4)

Not applicable — Phase 1 produces no UI components or dynamic-data rendering surfaces. All deliverables are:
- File moves (archive)
- New markdown documents (READMEs, env metadata)
- SQL migration files (applied via MCP)
- Baseline snapshots (CSV + SQL)
- Git tag

No data flows to render.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Zero loose SQL at `supabase/*.sql` root | `ls supabase/*.sql` | empty | PASS |
| Exactly 12 archived files | `ls supabase/archive/_deprecated_*.sql \| wc -l` | 12 | PASS |
| Down directory tracked in git | `ls supabase/migrations/down/` | README.md + 20260421074417_reconcile_schema_drift.sql present | PASS |
| Reconciliation migration filename pairing byte-identical | `ls supabase/migrations/*.sql supabase/migrations/down/*.sql \| grep 20260421074417` | both basenames match | PASS |
| Git tag exists locally | `git tag -l push-notify-baseline-20260421` | `push-notify-baseline-20260421` | PASS |
| Git tag pushed to origin | `git ls-remote --tags origin push-notify-baseline-20260421` | `88850dc refs/tags/push-notify-baseline-20260421` + `bc66f38 refs/tags/push-notify-baseline-20260421^{}` | PASS |
| Git tag annotated (not lightweight) | `git cat-file -t 88850dc` (implied by show-ref output) | `type commit` via tag object | PASS |
| pg_policies CSV header correct | `head -1 .planning/research/baselines/pg-policies-20260421.csv` | `schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check` | PASS |
| ≥ 4 DO-NOT-COMMIT sentinels | `grep -c 'DO NOT COMMIT' env-metadata.md` | 12 | PASS |
| No forbidden secret assignments | Grep for `VAPID_PRIVATE\|SERVICE_ROLE\|FCM_PRIVATE` in assignment position across baselines/ | 6 matches, all in DO-NOT-COMMIT sentinels or Forbidden-list documentation contexts — zero in assignment position | PASS |
| No live family UUID leakage | `grep -rE '4c781fb7-677a-45d9-8fd2-74d0083fe9b4' .planning/research/baselines/` | 0 matches | PASS |
| Prod migration applied | 01-05-SUMMARY `execute_sql` check (all 3 columns exist, nullable) | 3/3 columns present with YES nullability | PASS |
| 15 legacy migrations untouched | Implicit (`supabase/migrations/` count = 16 total = 15 legacy + 1 new reconciliation) | 15 legacy files byte-identical to pre-plan state | PASS |
| Commit chain intact | 12 expected plan commits + 2 merge + 3 docs-summary commits all reachable via `git log` | All 12 key commits found: `c2c20c1 5405e73 7ad18f8 84987fa c81b16f dd6eb18 eec63e4 069e376 169282b bf0205f 5f21ff9 bc66f38` | PASS |

**Spot-check result:** 14/14 PASS. No server startup required (no runnable entry points in Phase 1 scope).

### Requirements Coverage

**Phase 1 intentionally carries 0 REQ-IDs** per REQUIREMENTS.md line 139 ("Phase 1: 0 REQs (migration hygiene / infrastructure)") and ROADMAP.md line 24 ("**Requirements**: (none — infrastructure work; all v1 REQs mapped to Phase 2–5)"). No requirement coverage check applicable.

Orphaned-requirements check: REQUIREMENTS.md Traceability table maps zero REQs to Phase 1. Zero orphans.

### Anti-Patterns Found

**None.** All touched files are documentation, migrations, or baseline snapshots:
- Markdown documentation (READMEs, summaries) — no runtime behavior
- SQL migration files — BEGIN/COMMIT wrapped, IF EXISTS guards, no DROP TABLE, no TRUNCATE, no DELETE
- Git renames (100% similarity — history preserved)
- Baseline snapshots (CSV, SQL, md with sentinels) — no secrets

No `src/App.jsx` changes, no Edge Function changes, no RLS changes (RLS policy duplication on `memos` explicitly deferred to Phase 2 Stream C with pointer in `db-diff-output.txt` Finding 2). Boundary held.

### Deviations Accepted

| # | Deviation | Authorization | Risk Assessment | Status |
| - | --------- | ------------- | --------------- | ------ |
| 1 | Branch workflow → MCP `apply_migration` direct to prod | User option B per STATE.md session log ($25/mo Supabase Pro avoided) | Additive-only + idempotent + all-NULLABLE migration; rollback anchors intact (git tag + pg_policies snapshot + down file) | ACCEPTED |
| 2 | Playwright real-services run deferred to Phase 2 Stream A | Documented in 01-05-SUMMARY §6 with explicit rationale | Natural smoke window is `push-notify` v31 redeploy (first end-to-end push-verifiable moment); 11 real-services specs already exist and ready to run; prod serves continuous real-user traffic | ACCEPTED |
| 3 | Postgres fast-default observation: 17 pre-migration rows have `created_at = now()` despite NULLABLE-with-default | Documented in 01-05-SUMMARY §3; matches Postgres 11+ `ADD COLUMN … DEFAULT` semantics | Phase 4 memo-unification can re-evaluate; 17-row impact is small; `ORDER BY created_at` for legacy rows degrades gracefully to `ORDER BY id` | ACCEPTED |

### Boundary Check

- No `src/App.jsx` changes (Monolith policy held) — VERIFIED
- No Edge Function changes (`supabase/functions/push-notify/index.ts` unmodified) — VERIFIED
- No RLS policy changes (RLS duplication on `memos` deferred to Phase 2 Stream C) — VERIFIED
- No data deletion (archive is `git mv`; no backfill on new columns) — VERIFIED
- No new tables created (only ADD COLUMN to existing `memos`) — VERIFIED
- Phase stayed within scope: file moves + new docs + migration authoring + MCP apply + git tag

### Downstream Unblocking Confirmation

- **Phase 2 Stream A (PUSH-01):** rollback anchor ready (git tag + env-metadata.md with public VAPID key) — VERIFIED. Plan 01-05 also surfaced `push-notify` v29→v30 regression (v29 served push correctly; v30 introduced ES256 401), converting Phase 2 Stream A prognosis from "auth gateway bug" to "code deployment regression" (v31 redeploy with `supabase.auth.getClaims(jwt)` should restore).
- **Phase 2 Stream B (RT-01~04):** migration convention available (down/README.md Rules 1-3); reconciliation migration serves as first concrete template — VERIFIED.
- **Phase 2 Stream C (PAIR-01~04, memos RLS cleanup):** pg_policies baseline snapshot available for diff; `db-diff-output.txt` Finding 2 hands off `memos` RLS duplication — VERIFIED.
- **Phase 4 (memo model unification):** `memos.created_at`, `user_id`, `user_role` queryable in prod (42703 error resolved); `execute_sql` proof in 01-05-SUMMARY — VERIFIED.

### Orchestrator Housekeeping Observations (informational, not gaps)

- ROADMAP.md line 38 still shows `01-05-PLAN.md` as `[ ]` — expected, since Plan 01-05 just completed in commit `25c425c` (most recent commit on branch). Orchestrator updates this post-verification.
- ROADMAP.md line 115 progress table still shows "3/5 In progress" — same, post-verification update.
- ROADMAP.md line 13 Phase 1 top-level checkbox still `[ ]` — same, post-verification update.
- STATE.md line 11 `completed_phases: 1` and line 47 "Phase 1: 0 plans" are inconsistent with each other and with actual progress (5/5 plans done); this is pre-existing orchestrator-update drift. Not a Phase 1 goal-achievement gap.

### Human Verification Required

**None.** Phase 1 is infrastructure hygiene with no user-facing feature to validate. Playwright regression is explicitly deferred to Phase 2 Stream A per documented rationale (natural smoke moment).

### Gaps Summary

**None.** All 4 ROADMAP Success Criteria met. Three deviations documented and accepted with preserved rollback paths. Phase 1 unblocks Phase 2-5 as designed.

---

## VERIFICATION PASSED

Phase 1 achieved its goal (migration hygiene + rollback baseline for live-production downstream phases). All 4 ROADMAP Success Criteria verified (3 fully executed, 1 deferred with documented rationale and in-place rollback anchors). Three deviations from the original plan are accepted with user authorization and preserved safety nets. Boundary held (no App.jsx, no Edge Function, no RLS changes).

Ready for orchestrator to (a) update ROADMAP Phase 1 checkboxes, (b) update STATE.md progress table, (c) transition to Phase 2.

---

_Verified: 2026-04-21_
_Verifier: Claude (gsd-verifier)_
_Mode: Initial verification, goal-backward from ROADMAP.md §Phase 1 Success Criteria_
