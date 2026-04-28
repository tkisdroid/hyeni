-- supabase/migrations/down/20260429000006_multichild_storage_child_photos_bucket.sql
BEGIN;

DROP POLICY IF EXISTS "child_photos_parent_delete" ON storage.objects;
DROP POLICY IF EXISTS "child_photos_family_select" ON storage.objects;
DROP POLICY IF EXISTS "child_photos_parent_update" ON storage.objects;
DROP POLICY IF EXISTS "child_photos_parent_insert" ON storage.objects;

-- NOTE: bucket itself preserved unless explicitly dropped (data preservation).
-- To remove: DELETE FROM storage.objects WHERE bucket_id='child-photos';
--             DELETE FROM storage.buckets WHERE id='child-photos';

COMMIT;
