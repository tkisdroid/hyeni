-- DOWN: remove phone/password login profile mapping.
-- This drops the login_id -> phone lookup used by normal parent login.

BEGIN;

REVOKE ALL ON FUNCTION public.lookup_auth_phone_by_login_id(text) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.lookup_auth_phone_by_login_id(text);
REVOKE ALL ON FUNCTION public.is_login_id_available(text) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.is_login_id_available(text);

DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;

DROP TRIGGER IF EXISTS user_profiles_touch_updated_at ON public.user_profiles;
DROP FUNCTION IF EXISTS public.touch_user_profiles_updated_at();
DROP TABLE IF EXISTS public.user_profiles;

COMMIT;
