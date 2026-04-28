-- supabase/migrations/20260429000001_multichild_m1_planned_count.sql
-- M1: families.planned_child_count — Spec §6
-- Pairing: supabase/migrations/down/20260429000001_multichild_m1_planned_count.sql

BEGIN;

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS planned_child_count integer NOT NULL DEFAULT 1
  CHECK (planned_child_count BETWEEN 1 AND 5);

COMMIT;
