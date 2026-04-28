-- Down: revert quota query to count all in-flight rows; unschedule crons.
-- Note: reverting the quota query re-exposes the zombie-row lockout for
-- free-tier users. Only roll back if the sweeper cron is replacing it via
-- an alternative mechanism.

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
      AND (delivered_at IS NOT NULL OR (delivered_at IS NULL AND stop_reason IS NULL));
  RETURN jsonb_build_object(
    'allowed', v_used < v_quota, 'quota', v_quota, 'used', v_used, 'tier', v_tier);
END;
$$;

COMMIT;

DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  PERFORM cron.unschedule('force_ring_delivery_timeout')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'force_ring_delivery_timeout');
  PERFORM cron.unschedule('force_ring_reminder_check')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'force_ring_reminder_check');
END$cron$;
