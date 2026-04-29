-- supabase/migrations/down/20260430010000_rename_family_member_by_id.sql
-- DOWN pair for 20260430010000_rename_family_member_by_id.sql
-- Removes rename_family_member_by_id RPC. Old rename_family_member RPC remains.

BEGIN;

DROP FUNCTION IF EXISTS public.rename_family_member_by_id(uuid, uuid, text);

COMMIT;
