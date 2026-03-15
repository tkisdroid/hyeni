-- Fix memos RLS: allow both parent and child to insert/update memos

DROP POLICY IF EXISTS "memos_insert" ON memos;
CREATE POLICY "memos_insert" ON memos FOR INSERT WITH CHECK (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "memos_update" ON memos;
CREATE POLICY "memos_update" ON memos FOR UPDATE USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
