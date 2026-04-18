CREATE OR REPLACE FUNCTION recompute_subscription_soft_lock_slots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_premium boolean := COALESCE(NEW.subscription_tier, 'free') = 'premium';
BEGIN
  IF v_is_premium THEN
    UPDATE family_members SET active_slot = true
      WHERE family_id = NEW.id AND role = 'child';
    UPDATE danger_zones SET active_slot = true
      WHERE family_id = NEW.id;
  ELSE
    UPDATE family_members SET active_slot = false
      WHERE family_id = NEW.id AND role = 'child';
    UPDATE family_members SET active_slot = true
      WHERE id = (
        SELECT id FROM family_members
        WHERE family_id = NEW.id AND role = 'child'
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      );
    UPDATE danger_zones SET active_slot = false
      WHERE family_id = NEW.id;
    UPDATE danger_zones SET active_slot = true
      WHERE id = (
        SELECT id FROM danger_zones
        WHERE family_id = NEW.id
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS families_recompute_subscription_soft_lock_slots ON families;
CREATE TRIGGER families_recompute_subscription_soft_lock_slots
  AFTER UPDATE OF subscription_tier, user_tier ON families
  FOR EACH ROW
  WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier OR OLD.user_tier IS DISTINCT FROM NEW.user_tier)
  EXECUTE FUNCTION recompute_subscription_soft_lock_slots();
