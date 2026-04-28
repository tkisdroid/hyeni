-- supabase/migrations/20260429000006_multichild_storage_child_photos_bucket.sql
-- Storage: child-photos bucket + RLS for PhotoUpload (Task 5.2 pre-req)
-- Path format: {family_id}/child-{order}-{ts}.{ext}
-- Pairing: supabase/migrations/down/20260429000006_multichild_storage_child_photos_bucket.sql

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('child-photos', 'child-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "child_photos_parent_insert" ON storage.objects;
CREATE POLICY "child_photos_parent_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'child-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT family_id::text FROM public.family_members
    WHERE user_id = auth.uid() AND role = 'parent'
  )
);

DROP POLICY IF EXISTS "child_photos_parent_update" ON storage.objects;
CREATE POLICY "child_photos_parent_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'child-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT family_id::text FROM public.family_members
    WHERE user_id = auth.uid() AND role = 'parent'
  )
);

DROP POLICY IF EXISTS "child_photos_family_select" ON storage.objects;
CREATE POLICY "child_photos_family_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'child-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT family_id::text FROM public.family_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "child_photos_parent_delete" ON storage.objects;
CREATE POLICY "child_photos_parent_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'child-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT family_id::text FROM public.family_members
    WHERE user_id = auth.uid() AND role = 'parent'
  )
);

COMMIT;
