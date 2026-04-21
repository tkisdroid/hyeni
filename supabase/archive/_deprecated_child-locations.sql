-- Child location tracking table (upsert per child, keeps latest only)
CREATE TABLE IF NOT EXISTS child_locations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE child_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "child_locations_select" ON child_locations;
CREATE POLICY "child_locations_select" ON child_locations FOR SELECT
  USING (family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
    OR user_id = auth.uid()
    OR family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "child_locations_upsert" ON child_locations;
CREATE POLICY "child_locations_upsert" ON child_locations FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "child_locations_update" ON child_locations;
CREATE POLICY "child_locations_update" ON child_locations FOR UPDATE
  USING (user_id = auth.uid());
