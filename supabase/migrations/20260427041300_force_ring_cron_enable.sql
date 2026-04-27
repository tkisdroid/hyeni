-- force_ring cron activation (Phase 2 follow-up)
-- Activates the deferred pg_cron job from 20260427041200_force_ring.sql §pg_cron-deferred.
--
-- ACTIVATED HERE:
--   force_ring_delivery_timeout (*/2 * * * *) — pure SQL UPDATE, no external deps
--     Marks events as delivery_failed if delivered_at IS NULL after 10 minutes
--     (clears the UNIQUE one-active-per-family idx so retry is possible)
--
-- STILL DEFERRED:
--   force_ring_reminder_check (* * * * *) — needs pg_net extension + vault.secrets
--     entry for service_role_key + supabase_url. Activate via a follow-up
--     migration once those prerequisites are in place (Phase 7 production
--     deploy is a natural point). Without these, the cron would fail every
--     minute on missing extension.
--
-- HARD RULES:
--   - Idempotent (DO block guards against duplicate cron.schedule)
--   - BEGIN/COMMIT wrapped
--   - Pairing: supabase/migrations/down/20260427041300_force_ring_cron_enable.sql

BEGIN;

-- delivery_timeout: 2분 단위로 stale active events를 delivery_failed 마킹
-- (UNIQUE one_active_per_family idx 잠금 해제 + audit 일관성)
DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'force_ring_delivery_timeout') THEN
    PERFORM cron.schedule(
      'force_ring_delivery_timeout',
      '*/2 * * * *',
      $cleanup$
        UPDATE public.force_ring_events
           SET stopped_at = now(),
               stop_reason = 'delivery_failed'
         WHERE delivered_at IS NULL
           AND stopped_at IS NULL
           AND triggered_at < now() - interval '10 minutes';
      $cleanup$
    );
  END IF;
END$cron$;

COMMIT;
