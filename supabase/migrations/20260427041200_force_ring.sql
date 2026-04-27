-- force_ring (강제 소리 울리기) — Spec: docs/superpowers/specs/2026-04-27-force-ring-design.md
--
-- Creates:
--   1. public.force_ring_events — immutable parent→child emergency alert audit log
--   2. UNIQUE partial indexes (request_hash, one-active-per-family)
--   3. RLS policies (select / insert / update_initiator / update_target)
--   4. force_ring_check_quota(uuid) RPC — SECURITY DEFINER, free 1/day vs premium 10/day
--   5. supabase_realtime publication 추가
--   6. pg_cron force_ring_reminder_check (1분 단위)
--   7. pg_cron force_ring_delivery_timeout (2분 단위, 10분 경과 cleanup)
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

COMMIT;
