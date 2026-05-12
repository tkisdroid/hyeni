-- 20260513000020_fix_get_pending_notifications_auth.sql
--
-- QA P1 (Agent 06 N1): get_pending_notifications anon-callable.
--
-- Symptom: public.get_pending_notifications(uuid) is SECURITY DEFINER but has
-- EXECUTE GRANT to anon (original migration 20260314000002:95). An attacker
-- with anon key + a guessed family_id UUID can read every pending
-- notification's title/body/data/created_at.
--
-- Root cause:
--   1) The SECURITY DEFINER function does no caller authz.
--   2) anon role has explicit EXECUTE GRANT.
--
-- Fix (defense in depth):
--   1) Add caller authz gate: reject if auth.uid() is NULL OR caller is not
--      a member of family_id (family_members lookup).
--   2) REVOKE EXECUTE FROM anon. Only authenticated/service_role may call.
--
-- Compatibility: legitimate clients (child app) only query their own family,
-- so this change is transparent. anon-fallback callers (if any) will get 401
-- and must retry with a fresh user JWT.
--
-- Pairing: supabase/migrations/down/20260513000020_fix_get_pending_notifications_auth.sql

BEGIN;

DROP FUNCTION IF EXISTS public.get_pending_notifications(uuid);

CREATE FUNCTION public.get_pending_notifications(p_family_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  data jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id AND user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT pn.id, pn.title, pn.body, pn.data, pn.created_at
  FROM public.pending_notifications pn
  WHERE pn.family_id = p_family_id
    AND pn.delivered = false
    AND COALESCE(pn.expires_at, now() + interval '1 day') > now()
  ORDER BY pn.created_at ASC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pending_notifications(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pending_notifications(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pending_notifications(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_pending_notifications(uuid) IS
  'QA P1: caller authorization (family_members membership) verified before returning pending notifications. anon EXECUTE revoked.';

COMMIT;
