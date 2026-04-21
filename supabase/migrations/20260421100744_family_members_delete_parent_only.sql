-- Phase 2 Stream C Wave 2 — family_members DELETE parent-only (PAIR-03)
--
-- Pattern per PITFALLS §Pitfall 3.2: DROP + CREATE in ONE transaction so no
-- gap exists where the table has no DELETE policy. If the transaction fails,
-- the old permissive policy remains intact (consistent rollback).
--
-- Previous policy (captured pre-apply from pg_policies on 2026-04-21 10:07 UTC):
--   cmd    = DELETE
--   roles  = {public}
--   qual   = ((user_id = auth.uid()) OR (family_id IN ( SELECT families.id
--              FROM families WHERE (families.parent_id = auth.uid()))))
--   with_check = NULL
--   -> allowed children to self-DELETE their own row (PAIR-03 vulnerability)
--
-- New policy: parent-only. Either (a) primary parent (families.parent_id = auth.uid())
-- or (b) a co-parent (family_members row with role='parent' for auth.uid()).
-- Scoped TO authenticated (narrower than the old TO public default) so unauthenticated
-- DELETEs are never even evaluated.

BEGIN;

-- lock_timeout keeps this migration from blocking indefinitely under contention
-- (PITFALLS §Pitfall 3 prevention guidance).
SET LOCAL lock_timeout = '5s';

DROP POLICY IF EXISTS "fm_del" ON public.family_members;

CREATE POLICY "fm_del" ON public.family_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.families f
       WHERE f.id = family_members.family_id
         AND f.parent_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_members me
       WHERE me.family_id = family_members.family_id
         AND me.user_id = auth.uid()
         AND me.role = 'parent'
    )
  );

COMMIT;
