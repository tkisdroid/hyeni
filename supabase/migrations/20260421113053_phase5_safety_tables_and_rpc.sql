-- Phase 5 · GATE / RL / KKUK / SOS hardening — safety surfaces
-- Creates the Phase 5 backend surface required by Streams B (remote listen
-- accountability) and C (꾹 press-hold + SOS audit):
--
--   1. public.remote_listen_sessions — per-session audit log for ambient mic
--      capture (RL-01). family-scoped RLS (select + insert); UPDATE/DELETE
--      intentionally left to service_role bypass so closed sessions remain
--      auditable for honest-flow transparency.
--   2. public.family_subscription.remote_listen_enabled — remote feature flag
--      kill switch (RL-04 / D-B07). Defaults true so all existing families
--      keep current behaviour; flipping to false server-side disables Stream B
--      without an APK rebuild.
--   3. public.sos_events — immutable audit log for 꾹 dispatches (SOS-01).
--      Insert-only RLS; UPDATE/DELETE policies deliberately omitted so only
--      service_role can mutate, satisfying OWASP MASTG safety-action logging
--      and PIPA 개인정보 안전조치 기록 requirements.
--   4. public.kkuk_check_cooldown(sender uuid) → boolean — server-side 5s
--      cooldown RPC (KKUK-03). SECURITY DEFINER so unprivileged authenticated
--      calls can probe the sos_events table even though direct SELECT is
--      family-scoped. Returns true when the sender may fire again, false
--      otherwise; no side effects.
--
-- HARD RULES (CLAUDE.md Phase 5 + CONTEXT.md D-B01/D-B07/D-C03/D-C04):
--   - Idempotent: every DDL uses IF NOT EXISTS / CREATE OR REPLACE.
--   - No data backfill; these tables are v1 audit surfaces starting empty.
--   - RLS enabled on every new table; policies scoped via family_members.
--   - family_subscription.remote_listen_enabled defaults TRUE so the flag is
--     purely opt-out, never breaks existing families on migration apply.
--
-- Pairing: supabase/migrations/down/20260421113053_phase5_safety_tables_and_rpc.sql
-- (drops RPC, policies, tables, and the remote_listen_enabled column in reverse
-- order. Safe to run: these are new surfaces with no production dependencies
-- at migration time.)

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. remote_listen_sessions (RL-01)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.remote_listen_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  initiator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  child_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms integer,
  end_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rls_family_time_idx
  ON public.remote_listen_sessions (family_id, started_at DESC);

ALTER TABLE public.remote_listen_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_remote_listen_select ON public.remote_listen_sessions;
CREATE POLICY rls_remote_listen_select ON public.remote_listen_sessions
  FOR SELECT TO authenticated
  USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS rls_remote_listen_insert ON public.remote_listen_sessions;
CREATE POLICY rls_remote_listen_insert ON public.remote_listen_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

-- UPDATE/DELETE policies intentionally absent → only service_role can mutate,
-- giving us an append-mostly audit trail. The client UPDATE for ended_at is
-- issued via the same session initiator row + RLS UPDATE would require a
-- policy; since we need the client to close sessions, we add a narrow UPDATE
-- policy restricted to the initiator.
DROP POLICY IF EXISTS rls_remote_listen_update_owner ON public.remote_listen_sessions;
CREATE POLICY rls_remote_listen_update_owner ON public.remote_listen_sessions
  FOR UPDATE TO authenticated
  USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    AND (initiator_user_id = auth.uid() OR child_user_id = auth.uid())
  )
  WITH CHECK (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. family_subscription.remote_listen_enabled (D-B07, RL kill switch)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.family_subscription
  ADD COLUMN IF NOT EXISTS remote_listen_enabled boolean DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. sos_events (SOS-01, immutable audit log)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_user_ids uuid[] DEFAULT '{}',
  triggered_at timestamptz NOT NULL DEFAULT now(),
  delivery_status jsonb DEFAULT '{}'::jsonb,
  client_request_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sos_family_time_idx
  ON public.sos_events (family_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS sos_sender_time_idx
  ON public.sos_events (sender_user_id, triggered_at DESC);

ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sos_events_select ON public.sos_events;
CREATE POLICY sos_events_select ON public.sos_events
  FOR SELECT TO authenticated
  USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS sos_events_insert ON public.sos_events;
CREATE POLICY sos_events_insert ON public.sos_events
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    AND sender_user_id = auth.uid()
  );

-- Intentionally no UPDATE/DELETE policies → immutable for all authenticated
-- callers. Only service_role (Edge Functions, migrations) can mutate rows.

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. kkuk_check_cooldown RPC (KKUK-03)
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns TRUE when the sender has NOT dispatched a 꾹 in the last 5 seconds
-- (i.e., they may fire again). Returns FALSE when throttled. SECURITY DEFINER
-- so authenticated callers can probe sos_events even with family-scoped SELECT.

CREATE OR REPLACE FUNCTION public.kkuk_check_cooldown(p_sender uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_last timestamptz;
BEGIN
  SELECT MAX(triggered_at) INTO v_last
    FROM public.sos_events
    WHERE sender_user_id = p_sender
      AND triggered_at > now() - interval '5 seconds';
  RETURN v_last IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kkuk_check_cooldown(uuid) TO authenticated;

COMMIT;
