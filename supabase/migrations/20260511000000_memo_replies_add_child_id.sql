-- memo_replies 에 child_id 컬럼 추가 — multichild 가정에서 자녀별 thread 격리.
-- 기존 row backfill: 가족이 single child면 그 자녀 ID로, multichild면 NULL (legacy 보존).
-- 새 row INSERT는 client에서 child_id 명시.
-- family_members.role 값: 'child' | 'parent' (기존 migration 패턴 확인됨)

BEGIN;

ALTER TABLE memo_replies
  ADD COLUMN IF NOT EXISTS child_id uuid
    REFERENCES family_members(id) ON DELETE SET NULL;

-- backfill: family에 자녀가 1명뿐인 row 자동으로 그 자녀 ID 채움
UPDATE memo_replies mr
SET child_id = (
  SELECT fm.id
  FROM family_members fm
  WHERE fm.family_id = mr.family_id
    AND fm.role = 'child'
  LIMIT 1
)
WHERE mr.child_id IS NULL
  AND mr.family_id IN (
    SELECT family_id
    FROM family_members
    WHERE role = 'child'
    GROUP BY family_id
    HAVING COUNT(*) = 1
  );

-- index — query 성능 (family_id + child_id + date_key)
CREATE INDEX IF NOT EXISTS memo_replies_family_child_date_idx
  ON memo_replies (family_id, child_id, date_key);

COMMIT;
