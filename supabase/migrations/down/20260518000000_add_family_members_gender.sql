-- supabase/migrations/down/20260518000000_add_family_members_gender.sql
-- DOWN pair for 20260518000000_add_family_members_gender.sql
-- Drops the gender column and its check constraint.

BEGIN;

ALTER TABLE public.family_members
  DROP CONSTRAINT IF EXISTS family_members_gender_check;

ALTER TABLE public.family_members
  DROP COLUMN IF EXISTS gender;

COMMIT;
