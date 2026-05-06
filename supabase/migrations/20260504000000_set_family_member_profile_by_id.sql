-- supabase/migrations/20260504000000_set_family_member_profile_by_id.sql
-- Update a child's profile name + theme color from the parent profile editor.
--
-- Pairing: supabase/migrations/down/20260504000000_set_family_member_profile_by_id.sql
--
-- Mirrors rename_family_member_by_id / set_family_member_photo_url_by_id:
-- parents cannot update child family_members rows directly through fm_upd
-- because that policy is scoped to user_id = auth.uid(). This RPC verifies
-- the caller is the primary parent and then updates by family_members.id.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_family_member_profile_by_id(
  p_family_id uuid,
  p_member_id uuid,
  p_new_name text,
  p_color_hex text
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

  IF p_color_hex IS NULL OR p_color_hex !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION '테마 색상이 올바르지 않아요';
  END IF;

  UPDATE public.family_members
     SET name = trim(p_new_name),
         color_hex = upper(trim(p_color_hex))
   WHERE id = p_member_id
     AND family_id = p_family_id
     AND role = 'child';

  IF NOT FOUND THEN
    RAISE EXCEPTION '아이 정보를 찾지 못했어요';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.set_family_member_profile_by_id(uuid, uuid, text, text) TO authenticated;

COMMIT;
