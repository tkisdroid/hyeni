-- supabase/migrations/20260430020000_set_family_member_photo_url_by_id.sql
-- Add set_family_member_photo_url_by_id RPC so parents can update ANY family
-- member's photo_url (including placeholder rows where user_id IS NULL).
--
-- Pairing: supabase/migrations/down/20260430020000_set_family_member_photo_url_by_id.sql
--
-- Background: family_members RLS UPDATE policy fm_upd is `(user_id = auth.uid())`,
-- so a parent .update()-ing a child row's photo_url silently affects 0 rows
-- (no error thrown — supabase-js returns row count = 0 on RLS reject). Both
-- PairingWizard.uploadPendingPhotos and the "📷 사진 수정" button in
-- PairingModal hit this. As a result, photo_url has been NULL for every member
-- in production despite the storage bucket containing the uploaded files.
--
-- This RPC mirrors rename_family_member_by_id (20260430010000): SECURITY
-- DEFINER, primary-parent check via families.parent_id = auth.uid().

BEGIN;

CREATE OR REPLACE FUNCTION public.set_family_member_photo_url_by_id(
  p_family_id uuid,
  p_member_id uuid,
  p_url text
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.families
    WHERE id = p_family_id AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.family_members
     SET photo_url = p_url
   WHERE id = p_member_id
     AND family_id = p_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.set_family_member_photo_url_by_id(uuid, uuid, text) TO authenticated;

COMMIT;
