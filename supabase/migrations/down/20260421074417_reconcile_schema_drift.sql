-- 20260421074417_reconcile_schema_drift.sql (DOWN)
--
-- Paired rollback for:
--   supabase/migrations/20260421074417_reconcile_schema_drift.sql
--
-- Executes the exact inverse DDL in REVERSE ORDER of the up file
-- (per supabase/migrations/down/README.md Rule 1). All DROPs use
-- IF EXISTS so partial rollback is safe.
--
-- Data impact: DROP COLUMN removes the column AND its data.
-- If `memos` has accumulated rows with non-NULL values in the dropped
-- columns between apply and rollback, those values are lost. This is
-- acceptable per Phase 1 scope — the columns restored in the up file
-- did not exist in prod before this migration, and rolling back
-- returns the tracked schema to its pre-reconciliation state (the
-- exact condition documented in
-- .planning/phases/01-migration-hygiene-baseline/db-diff-output.txt
-- Finding 1 before Plan 01-03 ran).
--
-- Note: NOT dropping the `memos` table itself — the up file only ADDs
-- columns; a table-level DROP would destroy production data on
-- rollback. The pairing is strictly column-level.

BEGIN;

-- Reverse order: user_role -> user_id -> created_at
-- (Up order: created_at -> user_id -> user_role; reverse stacks here.)

ALTER TABLE public.memos
  DROP COLUMN IF EXISTS user_role;

ALTER TABLE public.memos
  DROP COLUMN IF EXISTS user_id;

ALTER TABLE public.memos
  DROP COLUMN IF EXISTS created_at;

COMMIT;
