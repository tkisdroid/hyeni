-- Fix: break ALL circular references between families and family_members
-- Rule: family_members NEVER references families, families references family_members (one-way only)

DROP POLICY IF EXISTS "members_select" ON family_members;
DROP POLICY IF EXISTS "families_select" ON families;
DROP POLICY IF EXISTS "events_select" ON events;
DROP POLICY IF EXISTS "memos_select" ON memos;
DROP POLICY IF EXISTS "academies_select" ON academies;

-- 1. family_members: ONLY direct user_id check (no cross-table reference)
CREATE POLICY "members_select" ON family_members FOR SELECT USING (
  user_id = auth.uid()
);

-- 2. families: direct parent check OR lookup via family_members (safe: family_members doesn't reference families)
CREATE POLICY "families_select" ON families FOR SELECT USING (
  parent_id = auth.uid()
  OR id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- 3. events/memos/academies: lookup via family_members (safe: same reason)
CREATE POLICY "events_select" ON events FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

CREATE POLICY "memos_select" ON memos FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

CREATE POLICY "academies_select" ON academies FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
