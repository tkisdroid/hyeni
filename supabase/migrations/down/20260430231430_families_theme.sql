-- supabase/migrations/down/20260430231430_families_theme.sql
-- Roll back v1.1 theme system Phase A migration (counterpart to
-- supabase/migrations/20260430231430_families_theme.sql).

BEGIN;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.families;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.families
  DROP CONSTRAINT IF EXISTS families_theme_check;

ALTER TABLE public.families
  DROP COLUMN IF EXISTS theme;

COMMIT;
