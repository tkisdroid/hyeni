-- supabase/migrations/20260430010000_rename_family_member_by_id.sql
-- Add rename_family_member_by_id RPC so parents can rename ANY family member
-- (including placeholder rows where user_id IS NULL) by family_members.id.
--
-- Pairing: supabase/migrations/down/20260430010000_rename_family_member_by_id.sql
--
-- Background: existing rename_family_member RPC (20260317100000) takes p_user_id
-- and updates WHERE user_id = p_user_id, so placeholder rows (user_id IS NULL,
-- pre-pair child slots created by parent's setupFamily) can never be renamed.
-- The PairingModal in src/App.jsx already shows N placeholders + N paired
-- children to the parent, but the rename button only worked for paired ones.
-- Reported by user (2026-04-30):
-- "1. 아이 연동 관리에서 모든 아이의 이름 수정이 안됨"
--
-- The new RPC takes p_member_id (always present) and verifies the caller is
-- the primary parent of that family. Old RPC kept for backwards compat.

BEGIN;

CREATE OR REPLACE FUNCTION public.rename_family_member_by_id(
  p_family_id uuid,
  p_member_id uuid,
  p_new_name text
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.families
    WHERE id = p_family_id AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_new_name IS NULL OR length(trim(p_new_name)) = 0 THEN
    RAISE EXCEPTION '이름이 비어 있어요';
  END IF;

  UPDATE public.family_members
     SET name = trim(p_new_name)
   WHERE id = p_member_id
     AND family_id = p_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.rename_family_member_by_id(uuid, uuid, text) TO authenticated;

COMMIT;
