-- Down migration for 20260504010000_restrict_family_insert_to_parent_auth_providers.sql.
-- Restores the previous production policy captured from pg_policies:
-- WITH CHECK (parent_id = auth.uid()).

BEGIN;

DROP POLICY IF EXISTS fam_ins ON public.families;
CREATE POLICY fam_ins
  ON public.families
  FOR INSERT
  WITH CHECK (parent_id = auth.uid());

COMMENT ON POLICY fam_ins ON public.families IS
  'Restored legacy policy: any authenticated owner session with parent_id = auth.uid() may create a family.';

COMMIT;
