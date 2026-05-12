-- Reverse of 20260513000011_fix_push_sent_rls.sql
--
-- WARNING: applying this restores anon-readable state. Do NOT apply in production.

BEGIN;

DROP POLICY IF EXISTS push_sent_no_client_access ON public.push_sent;

-- Restore the original 20260313000000 deny-SELECT-only policy (pre-drift).
CREATE POLICY "push_sent_service_only" ON public.push_sent
  FOR SELECT USING (false);

COMMIT;
