-- 20260513000010_fix_push_idempotency_rls.sql
--
-- QA P0-1 (Agent 02 F-001): push_idempotency RLS bypass.
--
-- Symptom: production public.push_idempotency allows anon SELECT/INSERT/DELETE.
-- An attacker with only the anon key can (1) enumerate every idempotency_key,
-- (2) pre-claim arbitrary UUIDs to permanently suppress legitimate pushes
-- including emergency alerts (sos / kkuk / not_arrived / danger_zone /
-- force_ring_reminder) via 23505 unique-violation short-circuit in
-- push-notify Edge Function.
--
-- Root cause: original migration 20260421103838_push_idempotency_table.sql
-- only ran CREATE TABLE without ENABLE ROW LEVEL SECURITY or any policy,
-- defaulting the table to "RLS off".
--
-- Fix:
--   1) Enable RLS.
--   2) Single deny-all policy for anon + authenticated (USING/WITH CHECK false).
--   3) push-notify Edge Function uses service_role -> bypasses RLS, unaffected.
--   4) push_idempotency_ttl cleanup cron is SECURITY DEFINER, also unaffected
--      (see comment in 20260422000000_push_idempotency_ttl_cron.sql).
--
-- Operational note: production drift requires this migration to be applied
-- via supabase branch first; verify with anon probe (GET / POST returns
-- 401/403, 0 rows) before merging to main.
--
-- Pairing: supabase/migrations/down/20260513000010_fix_push_idempotency_rls.sql

BEGIN;

ALTER TABLE public.push_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_idempotency_no_anon ON public.push_idempotency;
DROP POLICY IF EXISTS push_idempotency_select ON public.push_idempotency;
DROP POLICY IF EXISTS push_idempotency_insert ON public.push_idempotency;
DROP POLICY IF EXISTS push_idempotency_update ON public.push_idempotency;
DROP POLICY IF EXISTS push_idempotency_delete ON public.push_idempotency;
DROP POLICY IF EXISTS push_idempotency_all ON public.push_idempotency;
DROP POLICY IF EXISTS push_idempotency_no_client_access ON public.push_idempotency;

CREATE POLICY push_idempotency_no_client_access ON public.push_idempotency
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY push_idempotency_no_client_access ON public.push_idempotency IS
  'QA P0-1: anon/authenticated client direct access denied. push-notify Edge Function uses service_role.';

COMMIT;
