-- 20260513000011_fix_push_sent_rls.sql
--
-- QA P0-2 (Agent 02 F-002): push_sent RLS drift.
--
-- Symptom: production public.push_sent allows anon SELECT/INSERT (182 rows
-- exposed). Attacker with anon key can pre-claim arbitrary
-- (event_id, notif_key) pairs to permanently suppress timed reminders
-- (15min / 5min / start).
--
-- Root cause: original migration 20260313000000_push_tables.sql:28-32 declares
-- ENABLE ROW LEVEL SECURITY + USING (false) SELECT policy, but production
-- state has drifted to RLS-off / no-policy.
--
-- Fix:
--   1) Force-enable RLS (idempotent).
--   2) Drop all existing policies, then a single anon/authenticated deny-all.
--   3) push-notify Edge Function uses service_role -> unaffected.
--
-- Operational note: after apply, anon probe must show
--   GET /rest/v1/push_sent -> 0 rows
--   POST /rest/v1/push_sent {"event_id":"qa","notif_key":"qa"} -> 401/403
--
-- Pairing: supabase/migrations/down/20260513000011_fix_push_sent_rls.sql

BEGIN;

ALTER TABLE public.push_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_sent_service_only ON public.push_sent;
DROP POLICY IF EXISTS "push_sent_service_only" ON public.push_sent;
DROP POLICY IF EXISTS push_sent_no_anon ON public.push_sent;
DROP POLICY IF EXISTS push_sent_select ON public.push_sent;
DROP POLICY IF EXISTS push_sent_insert ON public.push_sent;
DROP POLICY IF EXISTS push_sent_update ON public.push_sent;
DROP POLICY IF EXISTS push_sent_delete ON public.push_sent;
DROP POLICY IF EXISTS push_sent_all ON public.push_sent;
DROP POLICY IF EXISTS push_sent_no_client_access ON public.push_sent;

CREATE POLICY push_sent_no_client_access ON public.push_sent
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY push_sent_no_client_access ON public.push_sent IS
  'QA P0-2: anon/authenticated client direct access denied. push-notify Edge Function uses service_role.';

COMMIT;
