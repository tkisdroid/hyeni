-- Relax saved_places INSERT premium gate for friend playdate (FP-D10)
--
-- Why: spec FP-D10 requires friend playdate to be free for all families. The
-- existing sp_insert_parent policy gates ALL saved_places writes behind
-- family_subscription_effective_tier(family_id) = 'premium', which would
-- block playdate flows for non-premium families.
--
-- Change: keep premium gate for regular saved_places, but exempt rows where
-- is_playdate_safe = true (the playdate-specific marker added in Task 1.1).
-- The auth path (parent owns family) is unchanged.
--
-- Pairing: supabase/migrations/down/20260428000002_saved_places_playdate_relax.sql

BEGIN;

DROP POLICY IF EXISTS "sp_insert_parent" ON public.saved_places;
CREATE POLICY "sp_insert_parent" ON public.saved_places
  FOR INSERT WITH CHECK (
    family_id IN (SELECT id FROM public.families WHERE parent_id = auth.uid())
    AND (
      family_subscription_effective_tier(family_id) = 'premium'
      OR is_playdate_safe = true
    )
  );

COMMENT ON POLICY "sp_insert_parent" ON public.saved_places IS
  'Saved places: premium-only by default. is_playdate_safe places are free (FP-D10).';

COMMIT;
