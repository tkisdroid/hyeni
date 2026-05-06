-- Restrict family creation to first-party parent auth providers.
--
-- Current production policy only checked parent_id = auth.uid(), so any
-- authenticated email session could create a family row by direct REST insert.
-- The app's parent onboarding supports Kakao OAuth and phone/password auth;
-- email sessions are E2E seed/login helpers only and must not create families
-- through the public RLS path.
--
-- Pairing: supabase/migrations/down/20260504010000_restrict_family_insert_to_parent_auth_providers.sql

BEGIN;

DROP POLICY IF EXISTS fam_ins ON public.families;
CREATE POLICY fam_ins
  ON public.families
  FOR INSERT
  WITH CHECK (
    parent_id = (SELECT auth.uid())
    AND (
      ((SELECT auth.jwt()) -> 'app_metadata' ->> 'provider') IN ('kakao', 'phone')
      OR ((SELECT auth.jwt()) -> 'user_metadata' ->> 'auth_provider') = 'phone'
      OR COALESCE((SELECT auth.jwt()) -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'kakao'
      OR COALESCE((SELECT auth.jwt()) -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'phone'
    )
  );

COMMENT ON POLICY fam_ins ON public.families IS
  'Family creation is limited to first-party parent auth providers: Kakao OAuth or phone/password auth. Email sessions may read seeded families through family_members but cannot create new families by direct REST insert.';

COMMIT;
