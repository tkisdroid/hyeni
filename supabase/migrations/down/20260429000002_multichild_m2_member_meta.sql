-- DOWN: M2 — reverses 20260429000002_multichild_m2_member_meta.sql

BEGIN;

ALTER TABLE public.family_members DROP CONSTRAINT IF EXISTS family_members_color_hex_check;
ALTER TABLE public.family_members DROP COLUMN IF EXISTS child_order;
ALTER TABLE public.family_members DROP COLUMN IF EXISTS photo_url;
ALTER TABLE public.family_members DROP COLUMN IF EXISTS color_hex;
ALTER TABLE public.family_members DROP COLUMN IF EXISTS birthdate;

COMMIT;
