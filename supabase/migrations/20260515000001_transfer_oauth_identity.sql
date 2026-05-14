-- Service-role only helper. Moves an auth.identities row from one user to another.
-- Called by the merge-oauth-into-phone Edge Function (which is the only caller
-- with service_role privileges). NEVER grant to authenticated/anon.

BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_oauth_identity(
  p_oauth_user uuid,
  p_phone_user uuid,
  p_provider text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_identity_count int;
BEGIN
  -- Defensive: only the configured provider; never accept 'phone' or 'email'
  IF p_provider NOT IN ('kakao', 'google') THEN
    RAISE EXCEPTION 'unsupported_provider: %', p_provider;
  END IF;

  -- Confirm the oauth user has exactly one identity row for this provider
  SELECT count(*) INTO v_identity_count
    FROM auth.identities
   WHERE user_id = p_oauth_user AND provider = p_provider;
  IF v_identity_count <> 1 THEN
    RAISE EXCEPTION 'oauth_identity_count_unexpected: %', v_identity_count;
  END IF;

  -- Confirm the phone user does NOT already own this provider
  SELECT count(*) INTO v_identity_count
    FROM auth.identities
   WHERE user_id = p_phone_user AND provider = p_provider;
  IF v_identity_count <> 0 THEN
    RAISE EXCEPTION 'phone_user_already_has_provider: %', p_provider;
  END IF;

  -- Perform the transfer
  UPDATE auth.identities
     SET user_id = p_phone_user,
         updated_at = now()
   WHERE user_id = p_oauth_user
     AND provider = p_provider;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_oauth_identity(uuid, uuid, text) FROM PUBLIC;
-- service_role only. authenticated/anon 절대 금지.
GRANT EXECUTE ON FUNCTION public.transfer_oauth_identity(uuid, uuid, text) TO service_role;

COMMIT;
