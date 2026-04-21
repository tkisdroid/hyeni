-- DOWN: Phase 2 Stream A push_idempotency table rollback
-- Paired with: supabase/migrations/20260421103838_push_idempotency_table.sql
-- Reverses: CREATE TABLE + CREATE INDEX (see up file).

BEGIN;

DROP INDEX IF EXISTS public.idx_push_idempotency_created_at;
DROP TABLE IF EXISTS public.push_idempotency;

COMMIT;
