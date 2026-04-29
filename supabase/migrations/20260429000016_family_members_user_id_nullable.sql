-- supabase/migrations/20260429000016_family_members_user_id_nullable.sql
-- M9: family_members.user_id DROP NOT NULL
--
-- Pairing: supabase/migrations/down/20260429000016_family_members_user_id_nullable.sql
--
-- Why: the multi-child PairingWizard (src/components/multichild/PairingWizard/)
-- pre-creates child slots in `family_members` before the child has paired their
-- own device — at that moment no auth.users row exists for the child. The legacy
-- single-child flow used join_family RPC which always supplied a user_id so the
-- NOT NULL constraint never fired in production. M2/M5 added multi-child columns
-- and policies but did not relax this constraint, leaving setupFamily()'s
-- `user_id: null` insert path broken (NOT NULL violation 23502).
--
-- The FK to auth.users(id) is preserved — when user_id is supplied (after pairing),
-- the FK still enforces referential integrity. NULL user_id rows are allowed for
-- unpaired slots and are invisible to RLS policies that filter by user_id =
-- auth.uid() (intentional — only the paired user sees their own slot).
--
-- UNIQUE (family_id, user_id): PostgreSQL treats each NULL as distinct, so
-- multiple unpaired child slots in the same family are allowed.

BEGIN;

ALTER TABLE public.family_members
  ALTER COLUMN user_id DROP NOT NULL;

COMMIT;
