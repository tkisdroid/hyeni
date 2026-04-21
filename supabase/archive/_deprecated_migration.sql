-- ============================================================================
-- 혜니캘린더 Supabase Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. families
CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair_code text UNIQUE NOT NULL,
  parent_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 2. family_members
CREATE TABLE family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('parent','child')),
  name text NOT NULL DEFAULT '',
  emoji text DEFAULT '🐰',
  created_at timestamptz DEFAULT now(),
  UNIQUE (family_id, user_id)
);

-- 3. events
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  date_key text NOT NULL,
  title text NOT NULL,
  time text NOT NULL,
  category text NOT NULL,
  emoji text NOT NULL,
  color text NOT NULL,
  bg text NOT NULL,
  memo text DEFAULT '',
  location jsonb,
  notif_override jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_events_family_date ON events(family_id, date_key);

-- 4. memos
CREATE TABLE memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  date_key text NOT NULL,
  content text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  UNIQUE (family_id, date_key)
);

-- 5. academies
CREATE TABLE academies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL,
  category text NOT NULL,
  location jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. pair_attempts (rate limiting)
CREATE TABLE pair_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  attempted_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pair_attempts ON pair_attempts(user_id, attempted_at);

-- ============================================================================
-- Triggers: auto-update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER memos_updated_at BEFORE UPDATE ON memos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER academies_updated_at BEFORE UPDATE ON academies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- RPC: join_family (rate-limited pair code lookup)
-- ============================================================================
CREATE OR REPLACE FUNCTION join_family(p_pair_code text, p_user_id uuid, p_name text DEFAULT '아이')
RETURNS uuid AS $$
DECLARE
  v_family_id uuid;
  v_attempt_count int;
BEGIN
  -- Rate limit: max 5 attempts per user per hour
  SELECT count(*) INTO v_attempt_count
  FROM pair_attempts
  WHERE user_id = p_user_id AND attempted_at > now() - interval '1 hour';

  IF v_attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many attempts. Try again later.';
  END IF;

  INSERT INTO pair_attempts (user_id) VALUES (p_user_id);

  SELECT id INTO v_family_id FROM families WHERE pair_code = p_pair_code;
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid pair code';
  END IF;

  INSERT INTO family_members (family_id, user_id, role, name)
  VALUES (v_family_id, p_user_id, 'child', p_name)
  ON CONFLICT (family_id, user_id) DO UPDATE SET name = p_name;

  RETURN v_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pair_attempts ENABLE ROW LEVEL SECURITY;

-- Get user family IDs securely without triggering RLS (Security Definer)
CREATE OR REPLACE FUNCTION get_user_family_ids()
RETURNS SETOF uuid AS $$
  SELECT family_id FROM family_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- families
CREATE POLICY "families_select" ON families FOR SELECT USING (
  parent_id = auth.uid()
  OR id IN (SELECT get_user_family_ids())
);
CREATE POLICY "families_insert" ON families FOR INSERT WITH CHECK (
  parent_id = auth.uid()
);
CREATE POLICY "families_update" ON families FOR UPDATE USING (
  parent_id = auth.uid()
);
CREATE POLICY "families_delete" ON families FOR DELETE USING (
  parent_id = auth.uid()
);

-- family_members
CREATE POLICY "members_select" ON family_members FOR SELECT USING (
  family_id IN (SELECT get_user_family_ids())
);
CREATE POLICY "members_insert" ON family_members FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY "members_update" ON family_members FOR UPDATE USING (
  user_id = auth.uid()
);
CREATE POLICY "members_delete" ON family_members FOR DELETE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
-- Child pairing can also insert via join_family RPC (SECURITY DEFINER)

-- events
CREATE POLICY "events_select" ON events FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "events_update" ON events FOR UPDATE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "events_delete" ON events FOR DELETE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);

-- memos
CREATE POLICY "memos_select" ON memos FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "memos_insert" ON memos FOR INSERT WITH CHECK (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "memos_update" ON memos FOR UPDATE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "memos_delete" ON memos FOR DELETE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);

-- academies
CREATE POLICY "academies_select" ON academies FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "academies_insert" ON academies FOR INSERT WITH CHECK (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "academies_update" ON academies FOR UPDATE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "academies_delete" ON academies FOR DELETE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);

-- pair_attempts: only the RPC function accesses this (SECURITY DEFINER)
CREATE POLICY "pair_attempts_allow_rpc" ON pair_attempts FOR ALL USING (false);

-- ============================================================================
-- Enable Realtime for events, memos, academies
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE memos;
ALTER PUBLICATION supabase_realtime ADD TABLE academies;
