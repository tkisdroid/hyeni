ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS active_slot boolean NOT NULL DEFAULT true;

ALTER TABLE danger_zones
  ADD COLUMN IF NOT EXISTS active_slot boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_family_members_active_slot
  ON family_members(family_id, role, active_slot)
  WHERE role = 'child' AND active_slot = true;

CREATE INDEX IF NOT EXISTS idx_danger_zones_active_slot
  ON danger_zones(family_id, active_slot)
  WHERE active_slot = true;
