-- supabase/migrations/20260517000000_add_family_members_phone.sql
-- Add per-member phone to family_members.
--
-- Root cause of "설정에서 전화번호 저장이 안 됨": the parent settings screen
-- (내 계정 › 전화번호) edits family_members.phone via updateMyProfile(), and
-- App.jsx reads members[me].phone for display — but the column was never
-- created, so every UPDATE failed with 42703 and the value always read empty.
--
-- This is the parent's own contact number stored on their member row. It is
-- distinct from families.mom_phone/dad_phone (the emergency contacts shown to
-- the child) and from auth phone identity (user_profiles.phone, E.164 login).
--
-- Existing RLS fm_upd (user_id = auth.uid()) already covers self-updates;
-- no new policy required.

BEGIN;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.family_members.phone IS
  'Member''s own contact phone number (free-form, Korean local format). Edited via the parent settings screen. Distinct from families.mom_phone/dad_phone (child-facing emergency contacts) and user_profiles.phone (E.164 auth login identity).';

COMMIT;
