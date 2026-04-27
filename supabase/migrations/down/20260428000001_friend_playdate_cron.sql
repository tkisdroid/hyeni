BEGIN;
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'playdate_auto_end') THEN
    PERFORM cron.unschedule('playdate_auto_end');
  END IF;
END$cron$;
COMMIT;
