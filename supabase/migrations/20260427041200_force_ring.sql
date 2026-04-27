-- force_ring (강제 소리 울리기) — Spec: docs/superpowers/specs/2026-04-27-force-ring-design.md
--
-- Creates:
--   1. public.force_ring_events — immutable parent→child emergency alert audit log
--   2. UNIQUE partial indexes (request_hash, one-active-per-family)
--   3. RLS policies (select / insert / update_initiator / update_target)
--   4. force_ring_check_quota(uuid) RPC — SECURITY DEFINER, free 1/day vs premium 10/day
--   5. supabase_realtime publication 추가
--
-- DEFERRED to Phase 2 follow-up migration:
--   6. pg_cron force_ring_reminder_check (1분 단위)
--   7. pg_cron force_ring_delivery_timeout (2분 단위, 10분 경과 cleanup)
--   (Cron activation requires push-notify Edge Function force_ring_reminder
--    handler to exist; otherwise reminder cron would log errors every minute.)
--
-- HARD RULES:
--   - Idempotent: IF NOT EXISTS / CREATE OR REPLACE
--   - No data backfill; v1 audit surface starting empty
--   - RLS enabled on new table
--   - DELETE policy intentionally absent → service_role only (immutable audit)
--
-- Pairing: supabase/migrations/down/20260427041200_force_ring.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.force_ring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  initiator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text CHECK (message IS NULL OR char_length(message) <= 80),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  stopped_at timestamptz,
  stop_reason text CHECK (stop_reason IN
    ('child_ack','parent_stop','auto_timeout','delivery_failed')),
  reminder_sent_at timestamptz,
  delivery_status jsonb DEFAULT '{}'::jsonb,
  client_request_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS force_ring_family_time_idx
  ON public.force_ring_events (family_id, triggered_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS force_ring_request_hash_idx
  ON public.force_ring_events (client_request_hash)
  WHERE client_request_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS force_ring_one_active_per_family_idx
  ON public.force_ring_events (family_id)
  WHERE stopped_at IS NULL;

ALTER TABLE public.force_ring_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS force_ring_select ON public.force_ring_events;
CREATE POLICY force_ring_select ON public.force_ring_events
  FOR SELECT TO authenticated
  USING (family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS force_ring_insert ON public.force_ring_events;
CREATE POLICY force_ring_insert ON public.force_ring_events
  FOR INSERT TO authenticated
  WITH CHECK (
    initiator_user_id = auth.uid()
    AND family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'parent'
    )
  );

DROP POLICY IF EXISTS force_ring_update_initiator ON public.force_ring_events;
CREATE POLICY force_ring_update_initiator ON public.force_ring_events
  FOR UPDATE TO authenticated
  USING (initiator_user_id = auth.uid())
  WITH CHECK (initiator_user_id = auth.uid());

DROP POLICY IF EXISTS force_ring_update_target ON public.force_ring_events;
CREATE POLICY force_ring_update_target ON public.force_ring_events
  FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid())
  WITH CHECK (target_user_id = auth.uid());

-- DELETE: 정책 부재 = service_role only (immutable audit)

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

GRANT EXECUTE ON FUNCTION public.force_ring_check_quota(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.force_ring_events;

-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron jobs DEFERRED until Phase 2 (push-notify Edge Function deploy)
-- ─────────────────────────────────────────────────────────────────────────────
-- Activating these now would cause `force_ring_reminder_check` to log
-- "unknown action" errors every minute until push-notify is updated.
-- A follow-up migration will SELECT cron.schedule(...) for both jobs after
-- Phase 2 deploys the force_ring_reminder action handler.
--
-- Original definitions kept here as documentation:
--
--   SELECT cron.schedule(
--     'force_ring_reminder_check',
--     '* * * * *',
--     $cron$
--       SELECT net.http_post(
--         url := current_setting('app.settings.supabase_url') || '/functions/v1/push-notify',
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--         ),
--         body := jsonb_build_object('action', 'force_ring_reminder')
--       );
--     $cron$
--   );
--
--   SELECT cron.schedule(
--     'force_ring_delivery_timeout',
--     '*/2 * * * *',
--     $cleanup$
--       UPDATE public.force_ring_events
--          SET stopped_at = now(),
--              stop_reason = 'delivery_failed'
--        WHERE delivered_at IS NULL
--          AND stopped_at IS NULL
--          AND triggered_at < now() - interval '10 minutes';
--     $cleanup$
--   );

COMMIT;
