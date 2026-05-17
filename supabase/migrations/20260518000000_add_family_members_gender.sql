-- supabase/migrations/20260518000000_add_family_members_gender.sql
-- Add a per-member gender label to family_members for parent contact labelling.
--
-- The child call shortcut (ChildCallCard) and the friend-playdate parent
-- contacts both need to label a parent as 엄마/아빠. The canonical source is
-- now family_members; this column carries that mom/dad label.
--
-- It is backfilled from user_profiles.gender for members who have an auth
-- identity row. Members without one (most family_members rows, and Kakao/OAuth
-- users whose user_profiles.gender is null) stay gender=NULL and fall back to a
-- name-based label + neutral icon in the client.
--
-- Only 'mom' | 'dad' | NULL are valid. Children always keep gender=NULL.
-- Existing RLS fm_sel/fm_upd already cover this column; no new policy required.

BEGIN;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.family_members
  DROP CONSTRAINT IF EXISTS family_members_gender_check;

ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_gender_check
  CHECK (gender IS NULL OR gender IN ('mom', 'dad'));

COMMENT ON COLUMN public.family_members.gender IS
  'Parent gender label (''mom'' | ''dad'' | NULL). Backfilled from user_profiles.gender. NULL parents fall back to a name-based label + neutral icon in the client. Children are always NULL.';

-- Backfill from the member's auth identity profile.
UPDATE public.family_members fm
SET gender = up.gender
FROM public.user_profiles up
WHERE fm.user_id = up.user_id
  AND up.gender IN ('mom', 'dad')
  AND fm.gender IS NULL;

-- Backfill verification: count parent members still missing a gender label.
-- A non-zero count is expected — most parents have no user_profiles.gender row
-- and rely on the client name-based fallback.
DO $$
DECLARE
  missing int;
BEGIN
  SELECT count(*) INTO missing
  FROM public.family_members
  WHERE role = 'parent' AND gender IS NULL;
  RAISE NOTICE 'family_members parents without gender label: %', missing;
END $$;

COMMIT;
