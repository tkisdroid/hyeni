-- DOWN: M1 — reverses 20260429000001_multichild_m1_planned_count.sql

BEGIN;

ALTER TABLE public.families DROP COLUMN IF EXISTS planned_child_count;

COMMIT;
