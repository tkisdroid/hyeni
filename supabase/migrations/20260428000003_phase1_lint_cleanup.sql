-- Phase 1 lint cleanup: address Supabase advisor findings on friend_playdate
--
-- Three categories addressed:
--
-- 1. function_search_path_mutable on guard_friend_playdate_update
--    Pin search_path so the function cannot be hijacked by per-session schema
--    overrides. SECURITY DEFINER trigger functions especially need this.
--
-- 2. unindexed_foreign_keys on friend_playdate_sessions
--    The three child/initiator FKs (child_a_id, child_b_id, initiator_user_id)
--    have no covering index. JOINs from auth.users → sessions and on-delete
--    cascade scans both became seq scans. Add btree indexes.
--
-- 3. auth_rls_initplan on saved_places.sp_insert_parent
--    Re-applies the Task 1.4 policy with auth.uid() wrapped in a SELECT so
--    Postgres caches the value for the whole statement instead of re-running
--    per row.
--
-- NOT addressed (intentional design):
--   - authenticated_security_definer_function_executable on
--     find_playdate_candidates: FP-D04 requires children to call this RPC.
--   - auth_allow_anonymous_sign_ins on friend_playdate_sessions /
--     public_places: this app uses anonymous child sign-ins; the playdate
--     flow is reachable from those JWTs by design.
--
-- Pairing: supabase/migrations/down/20260428000003_phase1_lint_cleanup.sql

BEGIN;

-- (1) Pin search_path on the immutable-fields trigger guard
ALTER FUNCTION public.guard_friend_playdate_update() SET search_path = public, pg_catalog;

-- (2) Cover the three FKs on friend_playdate_sessions
CREATE INDEX IF NOT EXISTS idx_fps_child_a_id
  ON public.friend_playdate_sessions (child_a_id);
CREATE INDEX IF NOT EXISTS idx_fps_child_b_id
  ON public.friend_playdate_sessions (child_b_id);
CREATE INDEX IF NOT EXISTS idx_fps_initiator_user_id
  ON public.friend_playdate_sessions (initiator_user_id);

-- (3) Wrap auth.uid() so RLS evaluates it once per statement
DROP POLICY IF EXISTS "sp_insert_parent" ON public.saved_places;
CREATE POLICY "sp_insert_parent" ON public.saved_places
  FOR INSERT WITH CHECK (
    family_id IN (
      SELECT id FROM public.families WHERE parent_id = (SELECT auth.uid())
    )
    AND (
      family_subscription_effective_tier(family_id) = 'premium'
      OR is_playdate_safe = true
    )
  );

COMMENT ON POLICY "sp_insert_parent" ON public.saved_places IS
  'Saved places: premium-only by default. is_playdate_safe places are free (FP-D10). auth.uid() wrapped in SELECT for per-statement evaluation.';

COMMIT;
