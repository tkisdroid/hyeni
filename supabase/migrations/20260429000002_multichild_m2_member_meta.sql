-- supabase/migrations/20260429000002_multichild_m2_member_meta.sql
-- M2: family_members メタデータ — Spec §5.1, §13.1
-- Adds: birthdate, color_hex, photo_url, child_order
-- Backfill: 자녀 행에 child_order=1, color_hex='#F779A8'
-- Pairing: supabase/migrations/down/20260429000002_multichild_m2_member_meta.sql

BEGIN;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS birthdate date,
  ADD COLUMN IF NOT EXISTS color_hex text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS child_order integer;

DO $color_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.family_members'::regclass AND conname='family_members_color_hex_check'
  ) THEN
    ALTER TABLE public.family_members
      ADD CONSTRAINT family_members_color_hex_check
      CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END$color_check$;

UPDATE public.family_members
SET child_order = 1, color_hex = '#F779A8'
WHERE role = 'child' AND child_order IS NULL;

COMMIT;
