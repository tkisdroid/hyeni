-- DOWN: force_ring cron activation — reverses 20260427041300_force_ring_cron_enable.sql

BEGIN;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'force_ring_delivery_timeout') THEN
    PERFORM cron.unschedule('force_ring_delivery_timeout');
  END IF;
END$cron$;

COMMIT;
