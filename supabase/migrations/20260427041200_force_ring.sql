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
COMMIT;
