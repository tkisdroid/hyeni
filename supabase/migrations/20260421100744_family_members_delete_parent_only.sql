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
--
-- SELF-REFERENCE RECURSION FIX: The co-parent EXISTS branch references
-- public.family_members from inside a policy ON public.family_members, which
-- causes "42P17 infinite recursion detected in policy" under DELETE — Postgres
-- re-evaluates fm_del against the subquery's table scan. The fix (matching the
-- project's existing `get_my_family_ids()` SECURITY DEFINER pattern) is to wrap
-- the parent-role lookup in a SECURITY DEFINER helper `is_family_parent(uuid)`
-- that bypasses RLS when called from the policy body. See migration body below.

BEGIN;

-- lock_timeout keeps this migration from blocking indefinitely under contention
-- (PITFALLS §Pitfall 3 prevention guidance).
SET LOCAL lock_timeout = '5s';

-- Helper: returns true if auth.uid() is a parent of the given family_id.
-- SECURITY DEFINER bypasses RLS on family_members, preventing the recursion
-- that would otherwise occur when the fm_del policy's USING clause references
-- family_members. Matches the existing `public.get_my_family_ids()` pattern.
CREATE OR REPLACE FUNCTION public.is_family_parent(p_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.families f
     WHERE f.id = p_family_id
       AND f.parent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.family_members me
     WHERE me.family_id = p_family_id
       AND me.user_id = auth.uid()
       AND me.role = 'parent'
  );
$$;

-- Only authenticated sessions may invoke; service_role obviously bypasses RLS anyway.
GRANT EXECUTE ON FUNCTION public.is_family_parent(uuid) TO authenticated;

DROP POLICY IF EXISTS "fm_del" ON public.family_members;

CREATE POLICY "fm_del" ON public.family_members
  FOR DELETE TO authenticated
  USING ( public.is_family_parent(family_members.family_id) );

COMMIT;
