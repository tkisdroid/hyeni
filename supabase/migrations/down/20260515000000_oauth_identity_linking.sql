BEGIN;
DROP FUNCTION IF EXISTS public.mark_linked_provider(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.find_user_by_phone(text);
DROP INDEX IF EXISTS user_profiles_linked_providers_gin;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS linked_providers;
COMMIT;
