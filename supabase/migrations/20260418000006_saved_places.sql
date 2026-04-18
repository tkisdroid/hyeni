CREATE TABLE IF NOT EXISTS saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  location jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_places_family
  ON saved_places(family_id, created_at);

CREATE OR REPLACE FUNCTION touch_saved_places_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS saved_places_touch_updated_at ON saved_places;
CREATE TRIGGER saved_places_touch_updated_at
  BEFORE UPDATE ON saved_places
  FOR EACH ROW
  EXECUTE FUNCTION touch_saved_places_updated_at();

ALTER TABLE saved_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sp_select_family" ON saved_places;
CREATE POLICY "sp_select_family" ON saved_places
  FOR SELECT USING (
    family_id IN (SELECT get_my_family_ids())
  );

DROP POLICY IF EXISTS "sp_insert_parent" ON saved_places;
CREATE POLICY "sp_insert_parent" ON saved_places
  FOR INSERT WITH CHECK (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
    AND family_subscription_effective_tier(saved_places.family_id) = 'premium'
  );

DROP POLICY IF EXISTS "sp_update_parent" ON saved_places;
CREATE POLICY "sp_update_parent" ON saved_places
  FOR UPDATE USING (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "sp_delete_parent" ON saved_places;
CREATE POLICY "sp_delete_parent" ON saved_places
  FOR DELETE USING (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

GRANT ALL ON saved_places TO anon, authenticated;

COMMENT ON POLICY "sp_insert_parent" ON saved_places IS
  'Saved places are premium-only and managed by the family parent.';
