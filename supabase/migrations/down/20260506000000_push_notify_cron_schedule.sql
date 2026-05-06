-- Down migration for 20260506000000_push_notify_cron_schedule.sql
-- pg_cron 작업 'push_notify_cron' 만 제거. push-notify Edge Function 자체는
-- 본 마이그레이션에서 만든 게 아니므로 건드리지 않는다.

DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;

  PERFORM cron.unschedule('push_notify_cron')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push_notify_cron');
END$cron$;
