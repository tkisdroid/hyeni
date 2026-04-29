-- Auth user profile mapping for phone/password parent accounts and Kakao identity sync.
--
-- The app logs in normal parent accounts with a user-facing login_id, while
-- Supabase Auth authenticates phone/password credentials. This table stores the
-- minimal mapping needed for login and keeps Kakao name/phone identity data in
-- public DB rows keyed by auth.users.id.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  login_id text UNIQUE,
  display_name text NOT NULL DEFAULT '',
  phone text UNIQUE,
  provider text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_login_id_format
    CHECK (login_id IS NULL OR login_id ~ '^[a-z0-9][a-z0-9._-]{3,23}$'),
  CONSTRAINT user_profiles_phone_format
    CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE INDEX IF NOT EXISTS user_profiles_login_id_idx
  ON public.user_profiles (login_id)
  WHERE login_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_profiles_phone_idx
  ON public.user_profiles (phone)
  WHERE phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_user_profiles_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_touch_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_touch_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_profiles_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
CREATE POLICY user_profiles_select_own
  ON public.user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
CREATE POLICY user_profiles_insert_own
  ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
CREATE POLICY user_profiles_update_own
  ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.is_login_id_available(p_login_id text)
RETURNS boolean AS $$
  SELECT NOT EXISTS (
    SELECT 1
      FROM public.user_profiles
     WHERE login_id = lower(trim(p_login_id))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.is_login_id_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_login_id_available(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.lookup_auth_phone_by_login_id(p_login_id text)
RETURNS text AS $$
  SELECT phone
    FROM public.user_profiles
   WHERE login_id = lower(trim(p_login_id))
   LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.lookup_auth_phone_by_login_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_auth_phone_by_login_id(text) TO anon, authenticated;

COMMIT;
