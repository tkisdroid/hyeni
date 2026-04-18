CREATE TABLE IF NOT EXISTS family_subscription (
  family_id uuid PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('trial', 'active', 'grace', 'cancelled', 'expired')),
  product_id text NOT NULL CHECK (product_id IN ('premium_monthly', 'premium_yearly')),
  qonversion_user_id text NOT NULL,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  last_event_id text,
  last_event_at timestamptz,
  raw_event jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_subscription_status ON family_subscription(status);
CREATE INDEX IF NOT EXISTS idx_family_subscription_trial_ends_at ON family_subscription(trial_ends_at) WHERE status = 'trial';
CREATE INDEX IF NOT EXISTS idx_family_subscription_updated_at ON family_subscription(updated_at);

CREATE TABLE IF NOT EXISTS subscription_webhook_events (
  event_id text PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_webhook_events_family_id ON subscription_webhook_events(family_id, received_at DESC);

CREATE OR REPLACE FUNCTION touch_family_subscription_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_subscription_updated_at ON family_subscription;
CREATE TRIGGER family_subscription_updated_at
  BEFORE UPDATE ON family_subscription
  FOR EACH ROW
  EXECUTE FUNCTION touch_family_subscription_updated_at();

ALTER TABLE family_subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_subscription_select_family" ON family_subscription;
CREATE POLICY "family_subscription_select_family" ON family_subscription
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );
