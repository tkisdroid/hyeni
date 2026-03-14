-- ── Push notification tables (idempotent) ────────────────────────────────────

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

CREATE TABLE IF NOT EXISTS push_sent (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL,
  notif_key text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  UNIQUE(event_id, notif_key)
);

ALTER TABLE push_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_sent_service_only" ON push_sent;
CREATE POLICY "push_sent_service_only" ON push_sent
  FOR SELECT USING (false);
