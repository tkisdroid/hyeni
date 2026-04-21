-- ── Push notification tables ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Push subscriptions: stores browser push subscriptions per user
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  subscription jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_subs" ON push_subscriptions;
CREATE POLICY "users_manage_own_subs" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Push sent log: prevents duplicate notifications
CREATE TABLE IF NOT EXISTS push_sent (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL,
  notif_key text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  UNIQUE(event_id, notif_key)
);

ALTER TABLE push_sent ENABLE ROW LEVEL SECURITY;

-- Only edge function (service role) writes to push_sent, no client access needed
DROP POLICY IF EXISTS "push_sent_service_only" ON push_sent;
CREATE POLICY "push_sent_service_only" ON push_sent
  FOR SELECT USING (false);

-- 3. Native Android FCM tokens
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

ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_fcm_tokens" ON fcm_tokens;
CREATE POLICY "users_manage_own_fcm_tokens" ON fcm_tokens
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS fcm_tokens_updated_at ON fcm_tokens;
CREATE TRIGGER fcm_tokens_updated_at BEFORE UPDATE ON fcm_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Pending notifications for Android polling fallback
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

ALTER TABLE pending_notifications ENABLE ROW LEVEL SECURITY;

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

-- 5. Event lookup RPC used by Android background service
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

GRANT EXECUTE ON FUNCTION get_pending_notifications(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_notifications_delivered(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_today_events(uuid, text) TO anon, authenticated, service_role;

-- 6. Cleanup: delete old push_sent / pending records daily (optional, via pg_cron)
-- SELECT cron.schedule('cleanup-push-sent', '0 3 * * *',
--   $$DELETE FROM push_sent WHERE sent_at < now() - interval '2 days'$$
-- );
