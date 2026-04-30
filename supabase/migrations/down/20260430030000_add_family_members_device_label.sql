-- supabase/migrations/down/20260430030000_add_family_members_device_label.sql
-- DOWN pair for 20260430030000_add_family_members_device_label.sql
-- Drops the device_label column. RLS policies unchanged (no policy was added).

BEGIN;

ALTER TABLE public.family_members
  DROP COLUMN IF EXISTS device_label;

COMMIT;
