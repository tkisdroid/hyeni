-- DOWN pair for 20260518000002_drop_families_phone_columns.sql
-- Recreates the columns (structure only). The dropped values cannot be
-- restored — they live on family_members.phone after the up migration's
-- backfill, which this rollback does not reverse.

BEGIN;

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS mom_phone text DEFAULT '';
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS dad_phone text DEFAULT '';

COMMIT;
