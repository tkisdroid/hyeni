-- force_ring_acknowledge RPC: child sets acknowledged_at on a force_ring event.
--
-- The original migration added the acknowledged_at column but no RPC to set
-- it. ForceRingActivity wrote only to local SharedPreferences. The reminder
-- cron (handleForceRingReminder in push-notify) filters on acknowledged_at
-- IS NULL, so it sent the "5분간 응답 없습니다 / 119 고려" reminder on every
-- successful delivery — false-emergency spam after the child had already
-- dismissed the alarm.
--
-- This RPC is called by ForceRingActivity when the child taps the ack
-- button. SECURITY DEFINER so the child's anonymous JWT can update without
-- needing UPDATE rights on force_ring_events directly.
--
-- Authorization:
--   - the row's family must include the caller as a child member, OR
--   - the caller is the row's target_user_id (the targeted child)
-- Anyone else (including a wrong family) gets a no-op return.
-- Idempotent: re-acks just preserve the first acknowledged_at.
--
-- Pairing: supabase/migrations/down/20260429000013_force_ring_acknowledge_rpc.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.force_ring_acknowledge(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_event record;
  v_now timestamptz := now();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'auth_required');
  END IF;

  SELECT id, family_id, target_user_id, acknowledged_at, stopped_at, stop_reason
    INTO v_event
    FROM public.force_ring_events
   WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'event_not_found');
  END IF;

  -- Authorize: caller is the target, or a child member of the same family.
  IF v_event.target_user_id IS DISTINCT FROM v_caller
     AND NOT EXISTS (
       SELECT 1 FROM public.family_members
        WHERE family_id = v_event.family_id
          AND user_id   = v_caller
          AND role      = 'child'
     )
  THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Idempotent: only the first ack wins.
  IF v_event.acknowledged_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_acked', true,
                              'acknowledged_at', v_event.acknowledged_at);
  END IF;

  UPDATE public.force_ring_events
     SET acknowledged_at = v_now,
         stopped_at      = COALESCE(stopped_at, v_now),
         stop_reason     = COALESCE(stop_reason, 'child_ack')
   WHERE id = p_event_id
     AND acknowledged_at IS NULL;

  RETURN jsonb_build_object('ok', true, 'acknowledged_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.force_ring_acknowledge(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_ring_acknowledge(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.force_ring_acknowledge(uuid) TO authenticated;

COMMENT ON FUNCTION public.force_ring_acknowledge(uuid) IS
  'Child confirms a force_ring alarm. Sets acknowledged_at + stopped_at + stop_reason=child_ack. Idempotent. Caller must be the target child OR a child member of the row family.';

COMMIT;
