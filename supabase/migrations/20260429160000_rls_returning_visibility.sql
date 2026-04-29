-- Fix: INSERT ... RETURNING evaluates SELECT USING on the new row, but
-- get_my_family_ids() does not see the just-inserted families row in time
-- (the function's subquery isn't inlined into the policy). PostgreSQL surfaces
-- this with the same SQLSTATE 42501 / "new row violates row-level security
-- policy" message as a true WITH CHECK failure.
--
-- We make the SELECT USING express the primary-parent fact directly so that
-- INSERT RETURNING and follow-up SELECTs both visit the new row.
-- Same pattern for family_members: a primary parent must be able to write
-- (and immediately read back) child rows that have user_id IS NULL.

BEGIN;

-- families.SELECT
DROP POLICY IF EXISTS fam_sel ON public.families;
CREATE POLICY fam_sel
  ON public.families
  FOR SELECT
  USING (
    parent_id = auth.uid()
    OR id IN (SELECT get_my_family_ids())
  );

-- family_members.SELECT
DROP POLICY IF EXISTS fm_sel ON public.family_members;
CREATE POLICY fm_sel
  ON public.family_members
  FOR SELECT
  USING (
    family_id IN (SELECT get_my_family_ids())
    OR family_id IN (SELECT id FROM public.families WHERE parent_id = auth.uid())
  );

-- family_members.INSERT
-- Primary parent inserts child rows with user_id IS NULL during PairingWizard.
DROP POLICY IF EXISTS fm_ins ON public.family_members;
CREATE POLICY fm_ins
  ON public.family_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND family_id IN (SELECT id FROM public.families WHERE parent_id = auth.uid())
    )
  );

COMMIT;
