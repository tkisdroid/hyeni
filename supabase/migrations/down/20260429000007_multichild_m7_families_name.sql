-- supabase/migrations/down/20260429000007_multichild_m7_families_name.sql
BEGIN;

ALTER TABLE public.families DROP COLUMN IF EXISTS name;

COMMIT;
