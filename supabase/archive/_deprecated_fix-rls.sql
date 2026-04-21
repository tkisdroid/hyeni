-- Fix infinite recursion in family_members SELECT policy
-- The old policy referenced family_members from within family_members

-- Drop the problematic policies
DROP POLICY IF EXISTS "members_select" ON family_members;
DROP POLICY IF EXISTS "events_select" ON events;
DROP POLICY IF EXISTS "memos_select" ON memos;
DROP POLICY IF EXISTS "academies_select" ON academies;
DROP POLICY IF EXISTS "families_select" ON families;

-- Recreate without self-reference

-- family_members: can see own row OR parent can see all members
CREATE POLICY "members_select" ON family_members FOR SELECT USING (
  user_id = auth.uid()
  OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);

-- families: parent or own membership (uses fixed family_members policy)
CREATE POLICY "families_select" ON families FOR SELECT USING (
  parent_id = auth.uid()
  OR id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- events: family member can see (uses fixed family_members policy)
CREATE POLICY "events_select" ON events FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- memos: family member can see
CREATE POLICY "memos_select" ON memos FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- academies: family member can see
CREATE POLICY "academies_select" ON academies FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
