ALTER TABLE academies
  ADD COLUMN IF NOT EXISTS notifications_suppressed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_academies_notifications_suppressed
  ON academies(family_id, notifications_suppressed)
  WHERE notifications_suppressed = false;

CREATE OR REPLACE FUNCTION recompute_subscription_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_premium boolean := COALESCE(NEW.subscription_tier, 'free') = 'premium';
BEGIN
  UPDATE academies
     SET notifications_suppressed = NOT v_is_premium
   WHERE family_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS families_recompute_subscription_notifications ON families;
CREATE TRIGGER families_recompute_subscription_notifications
  AFTER UPDATE OF subscription_tier, user_tier ON families
  FOR EACH ROW
  WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier OR OLD.user_tier IS DISTINCT FROM NEW.user_tier)
  EXECUTE FUNCTION recompute_subscription_notifications();
