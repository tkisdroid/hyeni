-- ============================================================
-- 1. families 테이블에 user_tier 컬럼 추가 (가족 단위 구독)
-- ============================================================
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS user_tier text NOT NULL DEFAULT 'free'
  CHECK (user_tier IN ('free', 'premium', 'subscription'));

-- ============================================================
-- 2. emergency_audio_chunks 테이블 (긴급 오디오 녹음 저장)
-- ============================================================
CREATE TABLE IF NOT EXISTS emergency_audio_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 10,
  sequence_number integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  latitude double precision,
  longitude double precision
);

CREATE INDEX IF NOT EXISTS idx_eac_family ON emergency_audio_chunks(family_id);
CREATE INDEX IF NOT EXISTS idx_eac_child_recorded ON emergency_audio_chunks(child_id, recorded_at);

-- ============================================================
-- 3. RLS 정책 — emergency_audio_chunks
-- ============================================================
ALTER TABLE emergency_audio_chunks ENABLE ROW LEVEL SECURITY;

-- 아이: 자기 child_id로만 INSERT 가능
CREATE POLICY "eac_insert_child" ON emergency_audio_chunks
  FOR INSERT WITH CHECK (
    child_id = auth.uid()
    AND family_id IN (SELECT get_my_family_ids())
  );

-- 가족 구성원: SELECT 가능
CREATE POLICY "eac_select_family" ON emergency_audio_chunks
  FOR SELECT USING (
    family_id IN (SELECT get_my_family_ids())
  );

-- 부모(가족 소유자)만 DELETE 가능
CREATE POLICY "eac_delete_parent" ON emergency_audio_chunks
  FOR DELETE USING (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

-- ============================================================
-- 4. sos_audio 스토리지 버킷 (Private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('sos_audio', 'sos_audio', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- 업로드: 가족 구성원만 자기 family 폴더에 업로드
CREATE POLICY "sos_audio_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'sos_audio'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT family_id::text FROM family_members WHERE user_id = auth.uid()
    )
  );

-- 다운로드: 가족 구성원만 자기 family 폴더에서 다운로드
CREATE POLICY "sos_audio_download" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'sos_audio'
    AND (storage.foldername(name))[1] IN (
      SELECT family_id::text FROM family_members WHERE user_id = auth.uid()
    )
  );

-- 삭제: 부모만 삭제 가능
CREATE POLICY "sos_audio_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'sos_audio'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM families WHERE parent_id = auth.uid()
    )
  );
