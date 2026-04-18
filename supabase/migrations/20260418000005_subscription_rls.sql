DROP POLICY IF EXISTS "fm_ins" ON family_members;
CREATE POLICY "fm_ins" ON family_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      role IS DISTINCT FROM 'child'
      OR COALESCE((
        SELECT COUNT(*) FROM family_members fm
        WHERE fm.family_id = family_members.family_id
          AND fm.role = 'child'
      ), 0) = 0
      OR family_subscription_effective_tier(family_members.family_id) = 'premium'
    )
  );

DROP POLICY IF EXISTS "dz_insert_parent" ON danger_zones;
CREATE POLICY "dz_insert_parent" ON danger_zones
  FOR INSERT WITH CHECK (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
    AND (
      COALESCE((
        SELECT COUNT(*) FROM danger_zones dz
        WHERE dz.family_id = danger_zones.family_id
      ), 0) = 0
      OR family_subscription_effective_tier(danger_zones.family_id) = 'premium'
    )
  );

DROP POLICY IF EXISTS "ac_ins" ON academies;
CREATE POLICY "ac_ins" ON academies
  FOR INSERT WITH CHECK (
    family_id IN (SELECT get_my_family_ids())
    AND family_subscription_effective_tier(academies.family_id) = 'premium'
  );

COMMENT ON POLICY "fm_ins" ON family_members IS
  'Soft-lock: first child is free, second requires premium';
COMMENT ON POLICY "dz_insert_parent" ON danger_zones IS
  'Soft-lock: first geofence is free, second requires premium';
COMMENT ON POLICY "ac_ins" ON academies IS
  'Academy creation is premium-only. Existing update/delete policies stay unchanged.';
