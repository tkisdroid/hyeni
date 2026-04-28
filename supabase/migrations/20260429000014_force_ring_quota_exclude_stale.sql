-- force_ring quota: exclude stale in-flight rows + schedule sweeper cron (CR8)
--
-- The original force_ring_check_quota counts rows with
-- (delivered_at IS NULL AND stop_reason IS NULL) as "used". If the push-notify
-- function crashes between the INSERT and the final UPDATE (FCM 5xx, network
-- drop, cold-start kill), the row stays in that state forever, permanently
-- charging a free-tier user (quota=1) and locking them out for 24 hours.
--
-- Two-part fix:
-- 1. The quota query now excludes in-flight rows older than 10 minutes —
--    matches the cleanup sweeper's grace window. A truly in-flight request
--    counts; a zombie does not.
-- 2. Schedules the previously-deferred force_ring_delivery_timeout cron so
--    zombies are positively flipped to stop_reason='delivery_failed'. Cron
--    schedule is wrapped in DO block to skip cleanly on environments without
--    pg_cron extension installed (e.g. local supabase reset).
-- 3. Schedules force_ring_reminder_check cron (also deferred in the original
--    migration) — push-notify now handles the 'force_ring_reminder' action so
--    activating the cron is safe.
--
-- Pairing: supabase/migrations/down/20260429000014_force_ring_quota_exclude_stale.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.force_ring_check_quota(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quota int;
  v_tier text;
  v_used int;
BEGIN
  v_tier := public.family_subscription_effective_tier(p_family_id);

  v_quota := CASE WHEN v_tier = 'premium' THEN 10 ELSE 1 END;

  SELECT COUNT(*) INTO v_used
    FROM public.force_ring_events
    WHERE family_id = p_family_id
      AND triggered_at > now() - interval '24 hours'
      AND (
        -- successfully delivered = always counts
        delivered_at IS NOT NULL
        -- in-flight only if recent (≤ 10 min); zombie rows are excluded so a
        -- crashed handler does not permanently consume the user's quota.
        OR (
          delivered_at IS NULL
          AND stop_reason IS NULL
          AND triggered_at > now() - interval '10 minutes'
        )
      );

  RETURN jsonb_build_object(
    'allowed', v_used < v_quota,
    'quota', v_quota,
    'used', v_used,
    'tier', v_tier
  );
END;
$$;

COMMENT ON FUNCTION public.force_ring_check_quota(uuid) IS
  'Force-ring quota: 10/day premium, 1/day free. Excludes in-flight rows older than 10min so a crashed handler cannot permanently lock the user. Tier reads from family_subscription_effective_tier.';

COMMIT;

-- pg_cron schedules — separate transaction so migration succeeds on
-- environments without pg_cron (the IF EXISTS guard short-circuits there).
DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed; skipping force_ring cron schedule';
    RETURN;
  END IF;

  -- Sweeper: flip zombie in-flight rows to delivery_failed after 10 min so
  -- they stop counting against quota (defense-in-depth alongside the quota
  -- query change above) and the parent UI surfaces the failure cleanly.
  PERFORM cron.unschedule('force_ring_delivery_timeout')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'force_ring_delivery_timeout');

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

  -- Reminder: 5min after delivery without ack, push-notify sends a parent
  -- reminder. Now that the force_ring_reminder action handler ships in
  -- push-notify, activating the cron is safe.
  PERFORM cron.unschedule('force_ring_reminder_check')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'force_ring_reminder_check');

  PERFORM cron.schedule(
    'force_ring_reminder_check',
    '* * * * *',
    $reminder$
      SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/push-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object('action', 'force_ring_reminder')
      );
    $reminder$
  );
END$cron$;
