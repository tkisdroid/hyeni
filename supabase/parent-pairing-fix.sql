-- Existing DB patch for parent Kakao login -> pairing code flow
-- Run this in Supabase SQL Editor for projects where the tables already exist.

BEGIN;

DROP POLICY IF EXISTS "members_select" ON family_members;
DROP POLICY IF EXISTS "families_select" ON families;
DROP POLICY IF EXISTS "events_select" ON events;
DROP POLICY IF EXISTS "memos_select" ON memos;
DROP POLICY IF EXISTS "academies_select" ON academies;

CREATE POLICY "members_select" ON family_members FOR SELECT USING (
  user_id = auth.uid()
  OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);

CREATE POLICY "families_select" ON families FOR SELECT USING (
  parent_id = auth.uid()
  OR id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

CREATE POLICY "events_select" ON events FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

CREATE POLICY "memos_select" ON memos FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

CREATE POLICY "academies_select" ON academies FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "families_insert" ON families;
DROP POLICY IF EXISTS "families_update" ON families;
DROP POLICY IF EXISTS "members_insert" ON family_members;
DROP POLICY IF EXISTS "members_update" ON family_members;
DROP POLICY IF EXISTS "members_delete" ON family_members;

CREATE POLICY "families_insert" ON families FOR INSERT WITH CHECK (
  parent_id = auth.uid()
);

CREATE POLICY "families_update" ON families FOR UPDATE USING (
  parent_id = auth.uid()
);

CREATE POLICY "members_insert" ON family_members FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "members_update" ON family_members FOR UPDATE USING (
  user_id = auth.uid()
);

CREATE POLICY "members_delete" ON family_members FOR DELETE USING (
  user_id = auth.uid()
  OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);

COMMIT;
