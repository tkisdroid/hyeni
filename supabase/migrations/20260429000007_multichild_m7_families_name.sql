-- supabase/migrations/20260429000007_multichild_m7_families_name.sql
-- M7: families.name — family display name from PairingWizard Step 1
-- Plan reference: Task 5.5 setupFamily insert with name=familyName
-- Pairing: supabase/migrations/down/20260429000007_multichild_m7_families_name.sql

BEGIN;

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS name text;

COMMIT;
