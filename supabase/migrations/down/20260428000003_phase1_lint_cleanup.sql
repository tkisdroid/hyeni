-- Down: revert Phase 1 lint cleanup
-- Reverses 20260428000003_phase1_lint_cleanup.sql.
--
-- After this runs, the advisor warnings re-appear. The data layer keeps
-- working — only the perf/security best-practice fixes are removed.

BEGIN;

-- (3) Restore Task 1.4's pre-wrap policy
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

-- (2) Drop the FK indexes
DROP INDEX IF EXISTS public.idx_fps_initiator_user_id;
DROP INDEX IF EXISTS public.idx_fps_child_b_id;
DROP INDEX IF EXISTS public.idx_fps_child_a_id;

-- (1) Reset search_path to default (mutable per-session)
ALTER FUNCTION public.guard_friend_playdate_update() RESET search_path;

COMMIT;
