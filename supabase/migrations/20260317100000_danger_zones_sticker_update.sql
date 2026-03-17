-- ============================================================
-- 1. get_sticker_summary 업데이트: late_count 추가
-- ============================================================
CREATE OR REPLACE FUNCTION get_sticker_summary(
  p_family_id uuid
) RETURNS TABLE(user_id uuid, total_count bigint, early_count bigint, on_time_count bigint, late_count bigint) AS $$
  SELECT user_id,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE sticker_type = 'early') as early_count,
    COUNT(*) FILTER (WHERE sticker_type = 'on_time') as on_time_count,
    COUNT(*) FILTER (WHERE sticker_type = 'late') as late_count
  FROM stickers
  WHERE family_id = p_family_id
  GROUP BY user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION get_sticker_summary TO anon, authenticated;

-- ============================================================
-- 2. danger_zones 테이블 (위험지역 설정)
-- ============================================================
CREATE TABLE IF NOT EXISTS danger_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 200,
  zone_type text NOT NULL DEFAULT 'custom',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dz_family ON danger_zones(family_id);

ALTER TABLE danger_zones ENABLE ROW LEVEL SECURITY;

-- 가족 구성원 조회 가능
CREATE POLICY "dz_select_family" ON danger_zones
  FOR SELECT USING (family_id IN (SELECT get_my_family_ids()));

-- 부모만 INSERT
CREATE POLICY "dz_insert_parent" ON danger_zones
  FOR INSERT WITH CHECK (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

-- 부모만 UPDATE
CREATE POLICY "dz_update_parent" ON danger_zones
  FOR UPDATE USING (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

-- 부모만 DELETE
CREATE POLICY "dz_delete_parent" ON danger_zones
  FOR DELETE USING (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

GRANT ALL ON danger_zones TO anon, authenticated;
