-- Down: restore original family_subscription-only quota check.
--
-- Reverting puts legacy premium families back on the free quota (1/day).

BEGIN;

CREATE OR REPLACE FUNCTION public.force_ring_check_quota(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quota int;
  v_status text;
  v_used int;
BEGIN
  SELECT status INTO v_status
    FROM public.family_subscription
    WHERE family_id = p_family_id;

  v_quota := CASE
    WHEN v_status IN ('trial','active','grace') THEN 10
    ELSE 1
  END;

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
    'tier', COALESCE(v_status, 'free')
  );
END;
$$;

COMMIT;
