-- supabase/migrations/down/20260429000016_family_members_user_id_nullable.sql
-- DOWN: re-impose NOT NULL on family_members.user_id
--
-- WARNING: this will fail if any unpaired child slot rows exist (user_id IS NULL).
-- Before running this rollback, either delete those rows or backfill user_id to
-- a real auth.users.id (e.g. by calling pairing).
--
-- Manual pre-check:
--   SELECT count(*) FROM public.family_members WHERE user_id IS NULL;
-- Must return 0 before applying this rollback.

BEGIN;

ALTER TABLE public.family_members
  ALTER COLUMN user_id SET NOT NULL;

COMMIT;
