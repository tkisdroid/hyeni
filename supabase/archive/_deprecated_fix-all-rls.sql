-- ============================================================================
-- Complete RLS cleanup: drop ALL existing policies and recreate correctly
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- ── Drop ALL existing policies ──────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── Ensure RLS is enabled ───────────────────────────────────────────────────
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pair_attempts ENABLE ROW LEVEL SECURITY;

-- ── family_members: simplest base policy (no cross-table refs) ──────────────
-- A user can see their own membership
CREATE POLICY "members_select" ON family_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "members_insert" ON family_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "members_update" ON family_members FOR UPDATE
  USING (user_id = auth.uid());

-- Parent can delete child members from their family
CREATE POLICY "members_delete" ON family_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

-- ── families ────────────────────────────────────────────────────────────────
CREATE POLICY "families_select" ON families FOR SELECT
  USING (
    parent_id = auth.uid()
    OR id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "families_insert" ON families FOR INSERT
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "families_update" ON families FOR UPDATE
  USING (parent_id = auth.uid());

-- ── events: both parent and child can READ, only parent can WRITE ───────────
CREATE POLICY "events_select" ON events FOR SELECT
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

CREATE POLICY "events_insert" ON events FOR INSERT
  WITH CHECK (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

CREATE POLICY "events_update" ON events FOR UPDATE
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

CREATE POLICY "events_delete" ON events FOR DELETE
  USING (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

-- ── memos ───────────────────────────────────────────────────────────────────
CREATE POLICY "memos_select" ON memos FOR SELECT
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

CREATE POLICY "memos_insert" ON memos FOR INSERT
  WITH CHECK (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

CREATE POLICY "memos_update" ON memos FOR UPDATE
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

CREATE POLICY "memos_delete" ON memos FOR DELETE
  USING (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

-- ── academies ───────────────────────────────────────────────────────────────
CREATE POLICY "academies_select" ON academies FOR SELECT
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

CREATE POLICY "academies_insert" ON academies FOR INSERT
  WITH CHECK (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

CREATE POLICY "academies_update" ON academies FOR UPDATE
  USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

CREATE POLICY "academies_delete" ON academies FOR DELETE
  USING (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

-- ── pair_attempts: only RPC (SECURITY DEFINER) accesses this ────────────────
CREATE POLICY "pair_attempts_insert" ON pair_attempts FOR INSERT
  WITH CHECK (true);

-- ── push_subscriptions ─────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'push_subscriptions') THEN
    EXECUTE 'CREATE POLICY "push_sub_select" ON push_subscriptions FOR SELECT USING (
      user_id = auth.uid()
      OR family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
      OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
    )';
    EXECUTE 'CREATE POLICY "push_sub_insert" ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "push_sub_update" ON push_subscriptions FOR UPDATE USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "push_sub_delete" ON push_subscriptions FOR DELETE USING (user_id = auth.uid())';
  END IF;
END $$;

-- ── child_locations ────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'child_locations') THEN
    EXECUTE 'CREATE POLICY "child_loc_select" ON child_locations FOR SELECT USING (
      user_id = auth.uid()
      OR family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
      OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
    )';
    EXECUTE 'CREATE POLICY "child_loc_insert" ON child_locations FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "child_loc_update" ON child_locations FOR UPDATE USING (user_id = auth.uid())';
  END IF;
END $$;

-- ── Ensure Realtime is enabled ──────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE academies;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
