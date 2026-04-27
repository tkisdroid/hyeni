-- Down: revert saved_places INSERT to premium-only
-- Reverses 20260428000002_saved_places_playdate_relax.sql.
--
-- After this runs, free-tier families can no longer INSERT into saved_places
-- even with is_playdate_safe = true. Apply only when rolling back the entire
-- friend_playdate feature.

BEGIN;

DROP POLICY IF EXISTS "sp_insert_parent" ON public.saved_places;
CREATE POLICY "sp_insert_parent" ON public.saved_places
  FOR INSERT WITH CHECK (
    family_id IN (SELECT id FROM public.families WHERE parent_id = auth.uid())
    AND family_subscription_effective_tier(family_id) = 'premium'
  );

COMMENT ON POLICY "sp_insert_parent" ON public.saved_places IS
  'Saved places are premium-only and managed by the family parent.';

COMMIT;
