ALTER TABLE families
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free'
  CHECK (subscription_tier IN ('free', 'premium'));

CREATE INDEX IF NOT EXISTS idx_families_subscription_tier ON families(subscription_tier);

UPDATE families
SET subscription_tier = CASE
  WHEN user_tier IN ('premium', 'subscription') THEN 'premium'
  ELSE 'free'
END
WHERE subscription_tier IS DISTINCT FROM CASE
  WHEN user_tier IN ('premium', 'subscription') THEN 'premium'
  ELSE 'free'
END;

CREATE OR REPLACE FUNCTION family_subscription_effective_tier(p_family_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_tier text := 'free';
BEGIN
  SELECT fs.status INTO v_status
  FROM family_subscription fs
  WHERE fs.family_id = p_family_id;

  IF v_status IN ('trial', 'active', 'grace') THEN
    RETURN 'premium';
  END IF;

  SELECT CASE
    WHEN COALESCE(f.subscription_tier, CASE WHEN f.user_tier IN ('premium', 'subscription') THEN 'premium' ELSE 'free' END) = 'premium'
      THEN 'premium'
    ELSE 'free'
  END INTO v_tier
  FROM families f
  WHERE f.id = p_family_id;

  RETURN COALESCE(v_tier, 'free');
END;
$$;

CREATE OR REPLACE FUNCTION normalize_family_subscription_tiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_tier text := NULL;
BEGIN
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    v_requested_tier := NEW.subscription_tier;
  ELSIF NEW.user_tier IS DISTINCT FROM OLD.user_tier THEN
    v_requested_tier := CASE WHEN NEW.user_tier IN ('premium', 'subscription') THEN 'premium' ELSE 'free' END;
  END IF;

  IF v_requested_tier IS NULL THEN
    v_requested_tier := CASE
      WHEN COALESCE(NEW.subscription_tier, OLD.subscription_tier, 'free') = 'premium'
        OR COALESCE(NEW.user_tier, OLD.user_tier, 'free') IN ('premium', 'subscription')
      THEN 'premium'
      ELSE 'free'
    END;
  END IF;

  NEW.subscription_tier := CASE WHEN v_requested_tier = 'premium' THEN 'premium' ELSE 'free' END;
  NEW.user_tier := CASE WHEN v_requested_tier = 'premium' THEN 'subscription' ELSE 'free' END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS families_normalize_subscription_tiers ON families;
CREATE TRIGGER families_normalize_subscription_tiers
  BEFORE UPDATE OF user_tier, subscription_tier ON families
  FOR EACH ROW
  EXECUTE FUNCTION normalize_family_subscription_tiers();

CREATE OR REPLACE FUNCTION sync_family_subscription_tiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid;
  v_tier text := 'free';
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_family_id := OLD.family_id;
  ELSE
    v_family_id := NEW.family_id;
    IF NEW.status IN ('trial', 'active', 'grace') THEN
      v_tier := 'premium';
    END IF;
  END IF;

  UPDATE families
     SET subscription_tier = v_tier,
         user_tier = CASE WHEN v_tier = 'premium' THEN 'subscription' ELSE 'free' END
   WHERE id = v_family_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS family_subscription_sync_tiers_insert ON family_subscription;
CREATE TRIGGER family_subscription_sync_tiers_insert
  AFTER INSERT ON family_subscription
  FOR EACH ROW EXECUTE FUNCTION sync_family_subscription_tiers();

DROP TRIGGER IF EXISTS family_subscription_sync_tiers_update ON family_subscription;
CREATE TRIGGER family_subscription_sync_tiers_update
  AFTER UPDATE OF status ON family_subscription
  FOR EACH ROW EXECUTE FUNCTION sync_family_subscription_tiers();

DROP TRIGGER IF EXISTS family_subscription_sync_tiers_delete ON family_subscription;
CREATE TRIGGER family_subscription_sync_tiers_delete
  AFTER DELETE ON family_subscription
  FOR EACH ROW EXECUTE FUNCTION sync_family_subscription_tiers();

GRANT EXECUTE ON FUNCTION family_subscription_effective_tier(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION normalize_family_subscription_tiers() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_family_subscription_tiers() TO anon, authenticated, service_role;
