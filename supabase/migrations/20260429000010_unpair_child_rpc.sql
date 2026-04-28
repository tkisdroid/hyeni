-- unpair_child RPC: clean up user-tied push/location data alongside the
-- family_members delete.
--
-- Background: deleting a family_members row only cascades to tables whose FK
-- targets family_members(id) (events_children, subscriptions). User-tied
-- tables — fcm_tokens, push_subscriptions, child_locations,
-- pending_notifications, child_audio_chunks — reference auth.users(id) and
-- therefore survive the unpair. Their RLS policies are user-self-only
-- (USING user_id = auth.uid()), so the parent's JWT cannot DELETE the child's
-- rows from the client.
--
-- This SECURITY DEFINER RPC runs the cleanup in one transaction, gated on
-- the caller being the parent of the family in question.
--
-- Pairing: supabase/migrations/down/20260429000010_unpair_child_rpc.sql

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
    -- Idempotent: already unpaired or never paired. Nothing to do.
    RETURN;
  END IF;

  -- Best-effort cleanup of user-tied data scoped to this family. Each delete
  -- is family-scoped so a child paired to multiple families (rare) keeps the
  -- other family's tokens intact.
  DELETE FROM public.fcm_tokens
   WHERE family_id = p_family_id AND user_id = p_child_user_id;

  DELETE FROM public.push_subscriptions
   WHERE family_id = p_family_id AND user_id = p_child_user_id;

  -- child_locations / pending_notifications may not exist on every deploy;
  -- guard with to_regclass so this RPC stays portable across schema drift.
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

  -- The authoritative unpair signal. Cascades to events_children + subscriptions
  -- via the FK on family_members.id.
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
  'Parent-only: detach a child from a family and clean up user-tied push/location rows. SECURITY DEFINER bypasses per-user RLS on fcm_tokens/push_subscriptions/etc that would otherwise lock the parent out.';

COMMIT;
