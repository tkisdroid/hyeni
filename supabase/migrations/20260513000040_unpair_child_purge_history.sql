-- 20260513000040_unpair_child_purge_history.sql
--
-- QA P1 (Agent 05 L-002): unpair_child does not purge location_history.
--
-- Symptom: on child unpair, child_locations / fcm_tokens / push_subscriptions /
-- pending_notifications / child_audio_chunks are deleted but
-- public.location_history is preserved. The child's full movement trail
-- remains accessible via parent SECURITY DEFINER queries -> privacy
-- (location history) leakage after unpair.
--
-- Root cause: original 20260429000010_unpair_child_rpc.sql was authored before
-- location_history existed, so it was never added to the cleanup list.
--
-- Fix: CREATE OR REPLACE the RPC adding a guarded DELETE on location_history.
-- All other cleanup logic preserved verbatim.
--
-- Retention policy: location_history is operational, not audit. Deleting on
-- unpair aligns with privacy-first principles. memos/memo_replies and other
-- audit targets remain (current RPC keeps that intact).
--
-- Pairing: supabase/migrations/down/20260513000040_unpair_child_purge_history.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.unpair_child(p_family_id uuid, p_child_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.families
    WHERE id = p_family_id AND parent_id = v_caller
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id
      AND user_id = p_child_user_id
      AND role = 'child'
  ) THEN
    -- Idempotent: already unpaired or never paired.
    RETURN;
  END IF;

  DELETE FROM public.fcm_tokens
   WHERE family_id = p_family_id AND user_id = p_child_user_id;

  DELETE FROM public.push_subscriptions
   WHERE family_id = p_family_id AND user_id = p_child_user_id;

  IF to_regclass('public.child_locations') IS NOT NULL THEN
    EXECUTE format(
      'DELETE FROM public.child_locations WHERE family_id = %L AND user_id = %L',
      p_family_id, p_child_user_id
    );
  END IF;

  IF to_regclass('public.pending_notifications') IS NOT NULL THEN
    EXECUTE format(
      'DELETE FROM public.pending_notifications WHERE family_id = %L AND user_id = %L',
      p_family_id, p_child_user_id
    );
  END IF;

  IF to_regclass('public.child_audio_chunks') IS NOT NULL THEN
    EXECUTE format(
      'DELETE FROM public.child_audio_chunks WHERE family_id = %L AND child_id = %L',
      p_family_id, p_child_user_id
    );
  END IF;

  -- QA P1 (L-002): purge child movement history on unpair.
  IF to_regclass('public.location_history') IS NOT NULL THEN
    EXECUTE format(
      'DELETE FROM public.location_history WHERE family_id = %L AND user_id = %L',
      p_family_id, p_child_user_id
    );
  END IF;

  DELETE FROM public.family_members
   WHERE family_id = p_family_id
     AND user_id = p_child_user_id
     AND role = 'child';
END;
$$;

REVOKE ALL ON FUNCTION public.unpair_child(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unpair_child(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.unpair_child(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.unpair_child(uuid, uuid) IS
  'Parent-only: detach a child from a family and clean up user-tied push/location rows including location_history (QA P1 L-002). SECURITY DEFINER bypasses per-user RLS.';

COMMIT;
