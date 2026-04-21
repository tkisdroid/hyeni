-- 20260421074417_reconcile_schema_drift.sql
--
-- Phase 1 — Migration Hygiene & Baseline (per .planning/phases/01-migration-hygiene-baseline/01-CONTEXT.md D-05..D-07).
--
-- Purpose: Reconcile schema drift between production and supabase/migrations/.
-- Specifically: restore the three `memos` columns (created_at, user_id,
-- user_role) that are missing from production (confirmed via
-- `supabase db query --linked` in
-- .planning/phases/01-migration-hygiene-baseline/db-diff-output.txt) and
-- which are the documented root cause of the 42703 errors seen in
-- consumer code that reads `memos.created_at` / `memos.user_id` /
-- `memos.user_role` (PITFALLS.md line 150).
--
-- Safety notes:
-- - All three columns added as NULLABLE per CONTEXT.md D-06:
--     "이미 데이터가 있으므로 NOT NULL 금지, 기본값 NULL"
--   Live data exists in `memos` (prod family has active rows); applying
--   NOT NULL DEFAULT now() to an ADD COLUMN would stamp every legacy
--   row with an IDENTICAL migration-time `created_at`, destroying
--   chronological ordering and breaking RT-03 memo ordering.
--   NULLABLE-with-default lets consumers distinguish "unknown creation
--   time" (legacy -> NULL) from "actual creation time" (post-migration)
--   and fall back to ORDER BY id for legacy rows.
-- - `created_at` defaults to now() so NEW rows populate automatically;
--   existing rows remain NULL (no backfill in this migration — live
--   data invariant per CONTEXT.md D-06 and Phase 1 boundary "ONLY:
--   file moves, new files, git tag, Supabase branch ops").
-- - `user_id` references auth.users(id) with ON DELETE SET NULL to keep
--   memos when a child account is deleted (audit log preservation;
--   aligns with memo_replies semantics and SOS-01 immutable-audit
--   principle).
-- - `user_role` is plain text (no CHECK constraint). Phase 5 SOS-01 may
--   later tighten this with a CHECK IN ('parent','child'); not in
--   Phase 1 scope.
-- - Idempotent via IF NOT EXISTS — safe to re-run on the Supabase
--   branch during Plan 05 apply.
-- - Additive only: no DROP, no UPDATE, no policy changes. RLS policy
--   duplication observed on `memos` (see db-diff-output.txt Finding 2)
--   is deferred to Phase 2 Stream C.
--
-- Paired rollback: supabase/migrations/down/20260421074417_reconcile_schema_drift.sql

BEGIN;

-- 1. memos.created_at — used by ORDER BY across RT-03 consumers.
--    NULLABLE by design (D-06): NOT NULL DEFAULT now() would assign
--    identical migration-time timestamp to every legacy row, destroying
--    chronological ordering. NULL signals "unknown creation time" so
--    consumers fall back to ORDER BY id for legacy rows.
ALTER TABLE public.memos
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 2. memos.user_id — sender attribution (MEMO-03 placeholder; full
--    wiring lands in Phase 4 memo-model unification). NULLABLE: legacy
--    rows have no known author and there is no safe default.
--    ON DELETE SET NULL preserves the memo row as an audit record when
--    a child account is deleted.
ALTER TABLE public.memos
  ADD COLUMN IF NOT EXISTS user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. memos.user_role — 'parent' | 'child' | NULL for legacy rows.
--    No CHECK constraint here; Phase 5 may add one.
ALTER TABLE public.memos
  ADD COLUMN IF NOT EXISTS user_role text;

COMMIT;
