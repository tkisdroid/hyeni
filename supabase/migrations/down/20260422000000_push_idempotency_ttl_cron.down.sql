-- Down: IDEMP-TTL-01 rollback. Unschedules the hourly sweeper and drops the
-- function. Does NOT drop pg_cron (other jobs may rely on it) and does NOT
-- touch push_idempotency table rows.

BEGIN;

DO $cron$
DECLARE
  existing_jobid bigint;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job
   WHERE jobname = 'cleanup_push_idempotency';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;
END
$cron$;

DROP FUNCTION IF EXISTS public.cleanup_push_idempotency();

COMMIT;
