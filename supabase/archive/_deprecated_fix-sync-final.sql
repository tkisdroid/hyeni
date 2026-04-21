-- ============================================================================
-- FINAL RLS + Realtime fix for cross-device sync
-- This script is idempotent — safe to run multiple times
-- ============================================================================

-- ── 1. Drop ALL existing policies ──────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── 2. Create/replace SECURITY DEFINER helper ──────────────────────────────
-- This function bypasses RLS to check family membership
CREATE OR REPLACE FUNCTION get_my_family_ids()
RETURNS SETOF uuid AS $$
  SELECT family_id FROM family_members WHERE user_id = auth.uid()
  UNION
  SELECT id FROM families WHERE parent_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ── 3. Ensure RLS is enabled ───────────────────────────────────────────────
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;

-- ── 3-b. Native push support tables/functions (idempotent) ─────────────────
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  platform text NOT NULL DEFAULT 'android',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_family_id ON fcm_tokens(family_id);

CREATE TABLE IF NOT EXISTS pending_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text DEFAULT '',
  data jsonb DEFAULT '{}'::jsonb,
  delivered boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 day')
);

CREATE INDEX IF NOT EXISTS idx_pending_notifications_lookup
  ON pending_notifications(family_id, delivered, created_at);

DO $$ BEGIN ALTER TABLE pair_attempts ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE child_locations ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE push_sent ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pending_notifications ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;

CREATE OR REPLACE FUNCTION get_pending_notifications(p_family_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  data jsonb,
  created_at timestamptz
) AS $$
  SELECT pn.id, pn.title, pn.body, pn.data, pn.created_at
  FROM pending_notifications pn
  WHERE pn.family_id = p_family_id
    AND pn.delivered = false
    AND COALESCE(pn.expires_at, now() + interval '1 day') > now()
  ORDER BY pn.created_at ASC
  LIMIT 20;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION mark_notifications_delivered(p_ids jsonb)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE pending_notifications
     SET delivered = true,
         delivered_at = now()
   WHERE id IN (
     SELECT value::uuid
     FROM jsonb_array_elements_text(COALESCE(p_ids, '[]'::jsonb))
   );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_today_events(p_family_id uuid, p_date_key text)
RETURNS TABLE (
  event_id uuid,
  event_title text,
  event_time text,
  event_emoji text,
  event_location jsonb
) AS $$
  SELECT e.id, e.title, e.time, e.emoji, e.location
  FROM events e
  WHERE e.family_id = p_family_id
    AND e.date_key = p_date_key
  ORDER BY e.time ASC;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at'
      AND pg_function_is_visible(oid)
  ) THEN
    DROP TRIGGER IF EXISTS fcm_tokens_updated_at ON fcm_tokens;
    CREATE TRIGGER fcm_tokens_updated_at BEFORE UPDATE ON fcm_tokens
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ── 4. families policies ───────────────────────────────────────────────────
CREATE POLICY "fam_sel" ON families FOR SELECT
  USING (id IN (SELECT get_my_family_ids()));

CREATE POLICY "fam_ins" ON families FOR INSERT
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "fam_upd" ON families FOR UPDATE
  USING (parent_id = auth.uid());

-- ── 5. family_members policies ─────────────────────────────────────────────
-- Users can see all members in their family
CREATE POLICY "fm_sel" ON family_members FOR SELECT
  USING (family_id IN (SELECT get_my_family_ids()));

CREATE POLICY "fm_ins" ON family_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "fm_upd" ON family_members FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "fm_del" ON family_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

-- ── 6. events policies (BOTH parent AND child can read) ────────────────────
CREATE POLICY "ev_sel" ON events FOR SELECT
  USING (family_id IN (SELECT get_my_family_ids()));

CREATE POLICY "ev_ins" ON events FOR INSERT
  WITH CHECK (family_id IN (SELECT get_my_family_ids()));

CREATE POLICY "ev_upd" ON events FOR UPDATE
  USING (family_id IN (SELECT get_my_family_ids()));

CREATE POLICY "ev_del" ON events FOR DELETE
  USING (family_id IN (SELECT get_my_family_ids()));

-- ── 7. memos policies (BOTH parent AND child can read AND write) ───────────
CREATE POLICY "memo_sel" ON memos FOR SELECT
  USING (family_id IN (SELECT get_my_family_ids()));

CREATE POLICY "memo_ins" ON memos FOR INSERT
  WITH CHECK (family_id IN (SELECT get_my_family_ids()));

CREATE POLICY "memo_upd" ON memos FOR UPDATE
  USING (family_id IN (SELECT get_my_family_ids()));

CREATE POLICY "memo_del" ON memos FOR DELETE
  USING (family_id IN (SELECT get_my_family_ids()));

-- ── 8. academies policies ──────────────────────────────────────────────────
CREATE POLICY "ac_sel" ON academies FOR SELECT
  USING (family_id IN (SELECT get_my_family_ids()));

CREATE POLICY "ac_ins" ON academies FOR INSERT
  WITH CHECK (family_id IN (SELECT get_my_family_ids()));

CREATE POLICY "ac_upd" ON academies FOR UPDATE
  USING (family_id IN (SELECT get_my_family_ids()));

CREATE POLICY "ac_del" ON academies FOR DELETE
  USING (family_id IN (SELECT get_my_family_ids()));

-- ── 9. pair_attempts ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'pair_attempts' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "pa_ins" ON pair_attempts FOR INSERT WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "pa_sel" ON pair_attempts FOR SELECT USING (user_id = auth.uid())';
  END IF;
END $$;

-- ── 10-b. fcm_tokens ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'fcm_tokens' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "fcm_sel" ON fcm_tokens FOR SELECT USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "fcm_ins" ON fcm_tokens FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "fcm_upd" ON fcm_tokens FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "fcm_del" ON fcm_tokens FOR DELETE USING (user_id = auth.uid())';
  END IF;
END $$;

-- ── 10-c. pending_notifications / RPC grants ───────────────────────────────
GRANT EXECUTE ON FUNCTION get_pending_notifications(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_notifications_delivered(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_today_events(uuid, text) TO anon, authenticated, service_role;

-- ── 10. push_subscriptions ─────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'push_subscriptions' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "ps_sel" ON push_subscriptions FOR SELECT USING (family_id IN (SELECT get_my_family_ids()))';
    EXECUTE 'CREATE POLICY "ps_ins" ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "ps_upd" ON push_subscriptions FOR UPDATE USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "ps_del" ON push_subscriptions FOR DELETE USING (user_id = auth.uid())';
  END IF;
END $$;

-- ── 11. child_locations ────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'child_locations' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "cl_sel" ON child_locations FOR SELECT USING (family_id IN (SELECT get_my_family_ids()))';
    EXECUTE 'CREATE POLICY "cl_ins" ON child_locations FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "cl_upd" ON child_locations FOR UPDATE USING (user_id = auth.uid())';
  END IF;
END $$;

-- ── 12. push_sent (used by edge function with service key, open for service) ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'push_sent' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "psent_all" ON push_sent FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ── 13. Ensure join_family RPC exists with SECURITY DEFINER ────────────────
CREATE OR REPLACE FUNCTION join_family(p_pair_code text, p_user_id uuid, p_name text DEFAULT '아이')
RETURNS uuid AS $$
DECLARE
  v_family_id uuid;
  v_attempt_count int;
BEGIN
  -- Rate limit
  SELECT count(*) INTO v_attempt_count
  FROM pair_attempts
  WHERE user_id = p_user_id AND attempted_at > now() - interval '1 hour';

  IF v_attempt_count >= 10 THEN
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

-- ── 14. Enable Realtime publication ────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE events; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE memos; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE academies; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 15. Grant execute on helper function ───────────────────────────────────
GRANT EXECUTE ON FUNCTION get_my_family_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_family_ids() TO anon;
GRANT EXECUTE ON FUNCTION join_family(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION join_family(text, uuid, text) TO anon;

-- ============================================================================
-- Done! All RLS policies recreated with SECURITY DEFINER helper function.
-- Both parent and child can now read/write events, memos, academies
-- within their shared family.
-- ============================================================================
