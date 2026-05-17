-- supabase/migrations/down/20260517000000_add_family_members_phone.sql
-- DOWN pair for 20260517000000_add_family_members_phone.sql
-- Drops the phone column. RLS policies unchanged (no policy was added).

BEGIN;

ALTER TABLE public.family_members
  DROP COLUMN IF EXISTS phone;

COMMIT;
