-- force_ring_check_quota: use family_subscription_effective_tier()
--
-- The original RPC (migration 20260427041200_force_ring.sql) read
-- family_subscription.status directly. That table only contains rows for
-- families with active Qonversion subscriptions. Families on the legacy
-- families.subscription_tier='premium' path (pre-Qonversion) had no
-- family_subscription row, so the quota CASE fell to ELSE 1 and treated
-- them as free (1 force-ring/day) even though every other premium gate
-- recognized them.
--
-- family_subscription_effective_tier (defined in 20260418000001) is the
-- canonical "effective tier" reader: it consults family_subscription.status
-- first, then falls back to families.subscription_tier / families.user_tier.
-- Other premium gates (saved_places RLS, danger_zones RLS, academies RLS,
-- friend_playdate notifications) all use it. force_ring should too.
--
-- Pairing: supabase/migrations/down/20260429000012_force_ring_quota_effective_tier.sql

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
        delivered_at IS NOT NULL
        OR (delivered_at IS NULL AND stop_reason IS NULL)
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
  'Force-ring quota: 10/day premium, 1/day free. Tier reads from family_subscription_effective_tier so legacy families.subscription_tier=premium families are honored alongside Qonversion-active rows.';

COMMIT;
