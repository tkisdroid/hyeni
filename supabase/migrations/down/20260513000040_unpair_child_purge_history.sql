-- Reverse of 20260513000040_unpair_child_purge_history.sql
--
-- WARNING: applying this restores location_history retention on unpair (privacy regression).
-- Do NOT apply in production.
--
-- Restores the function body verbatim from 20260429000010_unpair_child_rpc.sql.

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

  DELETE FROM public.family_members
   WHERE family_id = p_family_id
     AND user_id = p_child_user_id
     AND role = 'child';
END;
$$;

REVOKE ALL ON FUNCTION public.unpair_child(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unpair_child(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.unpair_child(uuid, uuid) TO authenticated;

COMMIT;
