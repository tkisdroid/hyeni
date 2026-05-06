-- supabase/migrations/down/20260504000000_set_family_member_profile_by_id.sql
-- DOWN pair for 20260504000000_set_family_member_profile_by_id.sql.

BEGIN;

DROP FUNCTION IF EXISTS public.set_family_member_profile_by_id(uuid, uuid, text, text);

COMMIT;
