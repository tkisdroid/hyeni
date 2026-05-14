-- OAuth identity linking — adds tracking column + matching RPC for OAuth-first bridge.
--
-- Bridge flow:
--   1. Client (OAuth-only session) calls find_user_by_phone(p_phone) → returns target user_id or NULL.
--   2. Client OTP-verifies phone → signs in as target user → calls merge-oauth-into-phone Edge Function.
--   3. Edge Function moves auth.identities row and deletes the OAuth-only user.
--   4. Client calls mark_linked_provider for idempotency marker so the next OAuth login
--      skips the bridge.

BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS linked_providers jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS user_profiles_linked_providers_gin
  ON public.user_profiles USING gin (linked_providers);

-- Find an existing phone-primary user by their stored phone (E.164 +82...).
-- Returns NULL when no match.
-- SECURITY DEFINER because anon callers need to ask "does this phone have an account?"
-- without exposing the full user_profiles row (RLS prevents SELECT for anon today).
-- Reveals only existence (UUID) — not metadata.
CREATE OR REPLACE FUNCTION public.find_user_by_phone(p_phone text)
RETURNS uuid AS $$
  SELECT user_id
    FROM public.user_profiles
   WHERE phone = p_phone
   LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.find_user_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_by_phone(text) TO anon, authenticated;

-- Caller-self provider linking marker. Edge Function calls this on behalf of the
-- phone user (running with their JWT) after a successful merge.
CREATE OR REPLACE FUNCTION public.mark_linked_provider(
  p_user_id uuid,
  p_provider text,
  p_payload jsonb
)
RETURNS void AS $$
  UPDATE public.user_profiles
     SET linked_providers = linked_providers || jsonb_build_object(p_provider, p_payload),
         updated_at = now()
   WHERE user_id = p_user_id
     AND user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER VOLATILE SET search_path = public;

REVOKE ALL ON FUNCTION public.mark_linked_provider(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_linked_provider(uuid, text, jsonb) TO authenticated;

COMMIT;
