DROP POLICY IF EXISTS "families_insert" ON families;
DROP POLICY IF EXISTS "families_update" ON families;
CREATE POLICY "families_insert" ON families FOR INSERT WITH CHECK (parent_id = auth.uid());
CREATE POLICY "families_update" ON families FOR UPDATE USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "members_insert" ON family_members;
DROP POLICY IF EXISTS "members_update" ON family_members;
DROP POLICY IF EXISTS "members_delete" ON family_members;
CREATE POLICY "members_insert" ON family_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "members_update" ON family_members FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "members_delete" ON family_members FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "events_insert" ON events;
DROP POLICY IF EXISTS "events_update" ON events;
DROP POLICY IF EXISTS "events_delete" ON events;
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "events_update" ON events FOR UPDATE USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "events_delete" ON events FOR DELETE USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "memos_insert" ON memos;
DROP POLICY IF EXISTS "memos_update" ON memos;
DROP POLICY IF EXISTS "memos_delete" ON memos;
CREATE POLICY "memos_insert" ON memos FOR INSERT WITH CHECK (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "memos_update" ON memos FOR UPDATE USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "memos_delete" ON memos FOR DELETE USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "academies_insert" ON academies;
DROP POLICY IF EXISTS "academies_update" ON academies;
DROP POLICY IF EXISTS "academies_delete" ON academies;
CREATE POLICY "academies_insert" ON academies FOR INSERT WITH CHECK (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "academies_update" ON academies FOR UPDATE USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "academies_delete" ON academies FOR DELETE USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pair_attempts_insert" ON pair_attempts;
CREATE POLICY "pair_attempts_insert" ON pair_attempts FOR INSERT WITH CHECK (true);
