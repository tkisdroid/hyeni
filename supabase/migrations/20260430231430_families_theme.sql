-- supabase/migrations/20260430231430_families_theme.sql
-- v1.1 Theme System · Phase A (SPEC §5.A in .planning/v1.1-theme-system/SPEC.md)
--
-- Adds families.theme column for storing a per-family color theme ID.
-- 6 themes locked via CHECK constraint, matching THEMES in src/lib/theme.js.
-- Default 'warm-pink' = current pink visual identity, so existing rows migrate
-- transparently with no UI change.
--
-- Realtime publication adds families so that when one parent device updates
-- the theme, sibling devices in the same family receive the UPDATE event and
-- can call applyTheme() to repaint immediately.
--
-- REPLICA IDENTITY remains DEFAULT — Realtime filter uses families:id=eq.{id}
-- which is the PK, so DEFAULT identity covers it (per .planning/research/
-- PITFALLS.md §2.2 the FULL-identity requirement only applies to non-PK filters).

BEGIN;

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'warm-pink';

DO $$ BEGIN
  ALTER TABLE public.families
    ADD CONSTRAINT families_theme_check
    CHECK (theme IN (
      'warm-pink',
      'soft-lavender',
      'mint-fresh',
      'sky-blue',
      'sunny-amber',
      'cool-charcoal'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.families.theme IS
  'Per-family color theme ID. One of 6 presets defined in src/lib/theme.js. Drives --th-* CSS variables across all member devices via applyTheme(). Default warm-pink matches the original pink visual identity.';

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.families;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
