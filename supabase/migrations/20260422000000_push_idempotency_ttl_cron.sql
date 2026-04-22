-- IDEMP-TTL-01 (Phase 6 Stream C) — pg_cron sweeper for push_idempotency.
-- Rows older than 24 hours are deleted hourly. Upstream table defined in
-- 20260421103838_push_idempotency_table.sql; this migration does NOT modify
-- that schema. Paired down: down/20260422000000_push_idempotency_ttl_cron.down.sql

BEGIN;

-- 1. Ensure pg_cron is available. Supabase allow-lists it on every project.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Sweeper function. SECURITY DEFINER so the cron runner (postgres role
--    in Supabase) can DELETE regardless of RLS state on push_idempotency.
--    Function is owned by postgres; pg_cron executes as postgres on Supabase.
CREATE OR REPLACE FUNCTION public.cleanup_push_idempotency()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n_deleted integer;
BEGIN
  DELETE FROM public.push_idempotency
   WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS n_deleted = ROW_COUNT;
  RETURN n_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_push_idempotency() IS
  'IDEMP-TTL-01: deletes push_idempotency rows older than 24h. Called hourly by pg_cron job cleanup_push_idempotency.';

-- Lock down PUBLIC execute privilege (SECURITY DEFINER function on public schema).
-- Only postgres (pg_cron runner) needs to call this.
REVOKE ALL ON FUNCTION public.cleanup_push_idempotency() FROM PUBLIC;

-- 3. Schedule. If a previous run left a job with the same name, unschedule it
--    first so re-running this migration is idempotent.
DO $cron$
DECLARE
  existing_jobid bigint;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job
   WHERE jobname = 'cleanup_push_idempotency';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;

  PERFORM cron.schedule(
    'cleanup_push_idempotency',
    '0 * * * *',
    $cmd$SELECT public.cleanup_push_idempotency();$cmd$
  );
END
$cron$;

COMMIT;
