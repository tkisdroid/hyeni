-- supabase/migrations/down/20260430040000_add_family_members_device_health.sql
-- DOWN pair for 20260430040000_add_family_members_device_health.sql
-- Drops the device_health column. RLS policies unchanged (no policy was added).

BEGIN;

ALTER TABLE public.family_members
  DROP COLUMN IF EXISTS device_health;

COMMIT;
