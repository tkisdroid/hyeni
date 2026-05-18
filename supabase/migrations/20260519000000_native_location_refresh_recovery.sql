-- Native location refresh recovery.
--
-- Why:
-- - Child devices can hold an expired access token while still running the
--   foreground LocationService. The service must still be able to poll native
--   pending commands and re-register its FCM token after push context is known.
-- - Direct anon writes to fcm_tokens are blocked by RLS, so native code uses a
--   narrowly-scoped SECURITY DEFINER RPC that only accepts existing family
--   members.

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_fcm_token(
  p_user_id uuid,
  p_family_id uuid,
  p_fcm_token text,
  p_platform text DEFAULT 'android'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_family_id IS NULL OR NULLIF(btrim(p_fcm_token), '') IS NULL THEN
    RAISE EXCEPTION 'user_id, family_id, and fcm_token are required'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.family_members fm
     WHERE fm.family_id = p_family_id
       AND fm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'not_family_member'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.fcm_tokens (
    user_id,
    family_id,
    fcm_token,
    platform,
    updated_at
  )
  VALUES (
    p_user_id,
    p_family_id,
    btrim(p_fcm_token),
    COALESCE(NULLIF(btrim(p_platform), ''), 'android'),
    now()
  )
  ON CONFLICT (user_id, fcm_token)
  DO UPDATE SET
    family_id = EXCLUDED.family_id,
    platform = EXCLUDED.platform,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_fcm_token(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_fcm_token(uuid, uuid, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_pending_notifications_for_device(
  p_family_id uuid,
  p_user_id uuid,
  p_role text DEFAULT NULL
)
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
  v_role text;
BEGIN
  IF p_family_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'family_id and user_id are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT fm.role
    INTO v_role
    FROM public.family_members fm
   WHERE fm.family_id = p_family_id
     AND fm.user_id = p_user_id
   LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not_family_member'
      USING ERRCODE = '42501';
  END IF;

  v_role := COALESCE(NULLIF(btrim(p_role), ''), v_role);

  RETURN QUERY
  SELECT pn.id, pn.title, pn.body, pn.data, pn.created_at
    FROM public.pending_notifications pn
   WHERE pn.family_id = p_family_id
     AND pn.delivered = false
     AND COALESCE(pn.expires_at, now() + interval '1 day') > now()
     AND COALESCE(pn.data->>'senderUserId', '') <> p_user_id::text
     AND (
       COALESCE(pn.data->>'targetUserId', '') = ''
       OR pn.data->>'targetUserId' = p_user_id::text
     )
     AND (
       COALESCE(pn.data->>'targetRole', '') = ''
       OR lower(pn.data->>'targetRole') = lower(v_role)
     )
   ORDER BY pn.created_at ASC
   LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pending_notifications_for_device(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_notifications_for_device(uuid, uuid, text) TO anon, authenticated, service_role;

-- Re-assert grants used by native polling fallback. Some live environments can
-- retain the function body while losing anon/authenticated execute privileges.
GRANT EXECUTE ON FUNCTION public.get_pending_notifications(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_notifications_delivered(jsonb) TO anon, authenticated, service_role;

COMMIT;
