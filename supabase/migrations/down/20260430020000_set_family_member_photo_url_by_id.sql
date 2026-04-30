-- supabase/migrations/down/20260430020000_set_family_member_photo_url_by_id.sql
-- DOWN pair for 20260430020000_set_family_member_photo_url_by_id.sql
-- Removes set_family_member_photo_url_by_id RPC. RLS fm_upd policy unchanged.

BEGIN;

DROP FUNCTION IF EXISTS public.set_family_member_photo_url_by_id(uuid, uuid, text);

COMMIT;
