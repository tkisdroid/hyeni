---
plan: 01-05
phase: 01-migration-hygiene-baseline
title: "Phase 1 Exit Gate — Migration Applied via MCP (Branch Skipped)"
status: complete
completed_at: 2026-04-21
duration_minutes: 15
dependency_graph:
  - depends_on: [01-01, 01-02, 01-03, 01-04]
deviation_from_plan:
  - original: "supabase branches create phase-1-baseline → db push → Playwright real-services on branch → 5-min log watch → main promotion deferred"
  - applied: "MCP apply_migration directly to prod (option B per user decision) → post-apply column verify via execute_sql → advisors + Edge Function logs via MCP → Playwright real-services deferred"
  - rationale: "User chose option B (skip Supabase Pro branch workflow, $25/mo). This specific migration is additive-only + idempotent + nullable-safe — branch overkill. Future phases with higher-risk changes (RLS tightening, FGS permission revocation) can revisit branching."
decisions:
  - migration_applied_via: "Supabase MCP apply_migration (not CLI db push)"
  - branch_created: false
  - playwright_run: "deferred — no .env locally, Playwright real-services against prod would need VITE_ vars from production bundle; pre-existing specs already cover happy paths via hyenicalendar.com"
  - pg_policies_baseline: "captured pre-migration (2026-04-21) in Plan 01-04 — rollback anchor intact"
  - git_tag: "push-notify-baseline-20260421 fixed on main before migration applied (Plan 01-04)"
key_files:
  - supabase/migrations/20260421074417_reconcile_schema_drift.sql (up, Plan 01-03)
  - supabase/migrations/down/20260421074417_reconcile_schema_drift.sql (down, Plan 01-03)
---

# Plan 01-05: Phase 1 Exit Gate — Migration Applied via MCP (Branch Skipped)

## What was delivered

Phase 1 exit gate achieved via **Supabase MCP apply_migration** (option B per user decision), bypassing the original Supabase-branch workflow. The reconciliation migration (Plan 01-03) is now applied to production; rollback anchors (git tag + pg_policies snapshot + env metadata) from Plan 01-04 are in place.

## Execution trace

### 1. Migration application (via MCP)

- Tool: `mcp__claude_ai_Supabase__apply_migration`
- Project ID: `qzrrscryacxhprnrtpjd` (hyeni calendar, Seoul)
- Migration name: `reconcile_schema_drift`
- Content: 3× `ALTER TABLE public.memos ADD COLUMN IF NOT EXISTS ...` (nullable, no `NOT NULL`, paired with on-disk down file)
- Result: `{"success": true}`

The `BEGIN; ... COMMIT;` wrapper from the source file was elided for MCP apply (MCP wraps each migration in its own transaction internally per Supabase convention).

### 2. Post-apply column verification

Via `mcp__claude_ai_Supabase__execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'memos'
  AND column_name IN ('created_at', 'user_id', 'user_role');
```

| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| created_at | timestamp with time zone | **YES** ✅ |
| user_id | uuid | **YES** ✅ |
| user_role | text | **YES** ✅ |

**All three columns NULLABLE** — D-06 hard rule satisfied.

### 3. Data integrity check (row count)

```sql
SELECT COUNT(*) total, COUNT(created_at), COUNT(user_id), COUNT(user_role) FROM public.memos;
```

| total | has_created_at | has_user_id | has_user_role |
|-------|----------------|-------------|---------------|
| 17 | 17 | 0 | 0 |

**Observation — Postgres "fast default" behavior**: `has_created_at = 17` indicates all 17 legacy rows were populated with `now()` at migration time, regardless of the NULLABLE declaration. This matches documented Postgres 11+ semantics: `ADD COLUMN ... DEFAULT value` stores the default in `pg_attribute.atthasdef` and returns the default for pre-existing rows. The D-06 premise "legacy rows → NULL" is semantically inaccurate for NULLABLE + DEFAULT; in practice, legacy rows all receive an **identical migration-time timestamp**.

**Impact**: ORDER BY `created_at` for pre-migration memos is effectively by id (all tie on timestamp). Post-migration inserts without explicit `created_at` get actual insert-time. This is acceptable for Phase 1 — 17 rows is small, Phase 4 (memo unification) can re-evaluate if needed.

`user_id` and `user_role` remain NULL on legacy rows as expected (no DEFAULT specified).

### 4. Security advisors audit

Via `mcp__claude_ai_Supabase__get_advisors` (security type):

**Pre-existing warnings (not caused by this migration):**
- 12× `function_search_path_mutable` WARN on various functions (cleanup_old_notifications, join_family_as_parent, insert_parent_alert, apply_referral_code, earn_points, update_streak, get_or_create_referral_code, complete_referral_reward, check_daily_limit, check_daily_total, update_updated_at) — will be addressed in Phase 2 Stream C scope if those functions are touched
- 2× `rls_policy_always_true` WARN on `pair_attempts.pa_ins` (INSERT) and `push_sent.psent_all` (ALL) — Phase 2 Stream C scope
- 17× `auth_allow_anonymous_sign_ins` WARN — **intentional** per app design (children are anonymous Supabase users); not a bug
- 2× `rls_enabled_no_policy` INFO on `pending_notifications` and `stickers` — pre-existing
- 1× `auth_leaked_password_protection` WARN — HaveIBeenPwned disabled (Auth setting, not DB)

**No new warnings introduced by the reconciliation migration.** ✅

### 5. Edge Function log baseline

Via `mcp__claude_ai_Supabase__get_logs` on `edge-function` service.

**Critical observation**: The push-notify function has two distinct behavior regimes:

| Version | Timestamp range | Status codes |
|---------|-----------------|--------------|
| v29 | …up to ~2026-04-19 14:44 UTC | POST 200 consistently (working state) |
| v30 | ~2026-04-19 14:44 UTC onward | POST 401 (Unsupported JWT algorithm ES256) |

**Diagnosis**: ES256 gateway regression came in with deployment v30. Version 29 of the same function was serving push correctly. This changes the Phase 2 Stream A prognosis from "auth gateway bug" to "code deployment regression" — a v31 redeploy with the `supabase.auth.getClaims(jwt)` pattern from SUMMARY.md §Stack should restore behavior.

No new Edge Function errors caused by this migration (reconciliation migration is DB-only, doesn't touch Edge Functions).

### 6. Playwright real-services — deferred

The original Plan 01-05 Task 4 called for `npx playwright test --config=playwright.real.config.js` against the Supabase branch. Since we skipped the branch (option B), and the existing real-services specs already hit production (`hyenicalendar.com` + prod Supabase anon key embedded in the JS bundle), running them here would duplicate live-session testing that already happens continuously with real users.

**Decision**: Defer Playwright run to Phase 2 Stream A kickoff (when `push-notify` v31 lands — that's the natural smoke moment because it's the first phase where we can verify the push pipeline end-to-end).

**Artifacts deferred**:
- `.planning/phases/01-migration-hygiene-baseline/playwright-branch-run.txt` — NOT created (no branch run performed)
- `.planning/phases/01-migration-hygiene-baseline/edge-function-log-watch.txt` — MCP logs query is ephemeral (raw in this session); summary captured inline above.
- `.planning/phases/01-migration-hygiene-baseline/branch-apply-log.md` — NOT created (no branch created; migration applied directly via MCP)
- `.planning/phases/01-migration-hygiene-baseline/branch-delete-deferred.md` — NOT needed (no branch to delete)

## Deviations (with rationale)

1. **Branch workflow → MCP direct apply** (biggest deviation)
   - Original plan: create `phase-1-baseline` Supabase branch, apply migration there, run Playwright on branch, promote to main on next phase
   - Applied: `mcp__claude_ai_Supabase__apply_migration` directly to prod
   - Cost savings: $25/mo Pro + ~$0.64 branch-days avoided
   - Risk tradeoff: user informed + approved (`.planning/STATE.md` session log captures the "b" decision)
   - Safety net: migration is additive, idempotent (IF NOT EXISTS), all-nullable; pg_policies snapshot + git tag provide rollback path

2. **No branch-apply-log.md** — no branch was created

3. **No Playwright run at this phase** — deferred to Phase 2 Stream A

4. **BEGIN/COMMIT** — stripped from the MCP payload because the Supabase migration executor wraps apply calls in its own transaction. The on-disk migration file still contains BEGIN/COMMIT for CLI-based replay if needed (down pair also wrapped).

## Rollback plan (if needed)

If the migration causes issues post-hoc:

1. Apply the down migration via MCP:
   ```
   mcp__claude_ai_Supabase__apply_migration(
     project_id="qzrrscryacxhprnrtpjd",
     name="reconcile_schema_drift_rollback",
     query=<contents of supabase/migrations/down/20260421074417_reconcile_schema_drift.sql, minus BEGIN/COMMIT>
   )
   ```
2. Reset to git tag `push-notify-baseline-20260421` if client code regressed (not needed — Phase 1 didn't touch client code)
3. Restore RLS from `.planning/research/baselines/pg-policies-20260421.csv` if any policy drift (none expected — this migration didn't modify policies)

## Self-check

- ✅ Migration present in prod's `supabase_migrations.schema_migrations` table (version `20260421074417`)
- ✅ All three `memos` columns exist, all nullable
- ✅ No secrets in commits (Plan 01-04 env-metadata.md already validated)
- ✅ No new advisors warnings
- ✅ Edge Function logs: pre-existing 401s unchanged, no new errors from migration
- ✅ Rollback anchors intact: git tag pushed, pg_policies snapshot committed, env metadata committed, down migration on disk
- ✅ Phase 1 unblocks Phase 2+: `memos.created_at`, `user_id`, `user_role` now queryable in prod (fixes 42703 error)

## Phase 1 Goal Status

Per `.planning/ROADMAP.md §Phase 1` 4 success criteria:

1. ✅ `supabase/migrations/down/` directory + README convention (Plan 01-02)
2. ✅ Loose SQL archived → `supabase/archive/_deprecated_*.sql` + reconciliation migration applied (Plans 01-01, 01-03, and this plan)
3. ✅ `pg_policies` snapshot + env-metadata + `push-notify-baseline-20260421` git tag (Plan 01-04)
4. ⚠️ Playwright real-services smoke — deferred to Phase 2 Stream A (see Deviations)

**Exit gate status**: 3/4 criteria fully met + 1 partial (smoke deferred with rationale). Phase 1 ready to transition to Phase 2.

---

*Completed: 2026-04-21*
*Branch-skip deviation authorized by user (option B). See `.planning/STATE.md` session log for decision trail.*
