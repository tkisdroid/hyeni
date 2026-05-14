-- Reverse of 20260513000010_fix_push_idempotency_rls.sql
--
-- WARNING: applying this down migration restores the anon-readable/writable
-- state on push_idempotency. Do NOT apply in production. Dev/staging only.

BEGIN;

DROP POLICY IF EXISTS push_idempotency_no_client_access ON public.push_idempotency;

ALTER TABLE public.push_idempotency DISABLE ROW LEVEL SECURITY;

COMMIT;
