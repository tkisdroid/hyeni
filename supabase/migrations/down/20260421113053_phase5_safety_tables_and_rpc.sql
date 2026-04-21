-- Paired rollback for 20260421113053_phase5_safety_tables_and_rpc.sql
-- (Phase 5 · GATE / RL / KKUK / SOS hardening)
--
-- Reverse order of the up migration:
--   1. DROP FUNCTION public.kkuk_check_cooldown(uuid)
--      (reverse of up step #4)
--   2. DROP TABLE public.sos_events CASCADE
--      (policies + indexes drop with the table; reverse of up step #3)
--   3. ALTER TABLE public.family_subscription DROP COLUMN remote_listen_enabled
--      (reverse of up step #2)
--   4. DROP TABLE public.remote_listen_sessions CASCADE
--      (policies + indexes drop with the table; reverse of up step #1)
--
-- Data-impact note: this rollback PERMANENTLY erases every remote_listen_sessions
-- and sos_events row inserted since the up migration shipped. That is acceptable
-- because both tables are v1 audit surfaces added in this phase and have no
-- production dependencies prior to Phase 5; dropping them returns the schema to
-- its pre-Phase-5 shape. If a rollback is performed AFTER real sessions have
-- been logged, operators should export both tables first (pg_dump --data-only
-- --table=public.remote_listen_sessions --table=public.sos_events) before
-- applying this down migration.
--
-- family_subscription.remote_listen_enabled defaults to TRUE; dropping the
-- column simply removes the kill switch — existing rows' other columns are
-- untouched and no data is lost.

BEGIN;

-- 1. RPC
DROP FUNCTION IF EXISTS public.kkuk_check_cooldown(uuid);

-- 2. sos_events
DROP POLICY IF EXISTS sos_events_insert ON public.sos_events;
DROP POLICY IF EXISTS sos_events_select ON public.sos_events;
DROP INDEX IF EXISTS public.sos_sender_time_idx;
DROP INDEX IF EXISTS public.sos_family_time_idx;
DROP TABLE IF EXISTS public.sos_events;

-- 3. family_subscription kill switch column
ALTER TABLE public.family_subscription
  DROP COLUMN IF EXISTS remote_listen_enabled;

-- 4. remote_listen_sessions
DROP POLICY IF EXISTS rls_remote_listen_update_owner ON public.remote_listen_sessions;
DROP POLICY IF EXISTS rls_remote_listen_insert ON public.remote_listen_sessions;
DROP POLICY IF EXISTS rls_remote_listen_select ON public.remote_listen_sessions;
DROP INDEX IF EXISTS public.rls_family_time_idx;
DROP TABLE IF EXISTS public.remote_listen_sessions;

COMMIT;
