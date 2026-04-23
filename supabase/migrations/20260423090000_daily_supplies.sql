CREATE TABLE IF NOT EXISTS daily_supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  date_key text NOT NULL,
  content text NOT NULL DEFAULT '',
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, date_key)
);

CREATE INDEX IF NOT EXISTS idx_daily_supplies_family_date
  ON daily_supplies(family_id, date_key);

CREATE OR REPLACE FUNCTION touch_daily_supplies_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_supplies_touch_updated_at ON daily_supplies;
CREATE TRIGGER daily_supplies_touch_updated_at
  BEFORE UPDATE ON daily_supplies
  FOR EACH ROW
  EXECUTE FUNCTION touch_daily_supplies_updated_at();

ALTER TABLE daily_supplies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ds_select_family" ON daily_supplies;
CREATE POLICY "ds_select_family" ON daily_supplies
  FOR SELECT USING (
    family_id IN (SELECT get_my_family_ids())
  );

DROP POLICY IF EXISTS "ds_insert_parent" ON daily_supplies;
CREATE POLICY "ds_insert_parent" ON daily_supplies
  FOR INSERT WITH CHECK (
    family_id IN (
      SELECT family_id
      FROM family_members
      WHERE user_id = auth.uid()
        AND role = 'parent'
    )
  );

DROP POLICY IF EXISTS "ds_update_parent" ON daily_supplies;
CREATE POLICY "ds_update_parent" ON daily_supplies
  FOR UPDATE USING (
    family_id IN (
      SELECT family_id
      FROM family_members
      WHERE user_id = auth.uid()
        AND role = 'parent'
    )
  ) WITH CHECK (
    family_id IN (
      SELECT family_id
      FROM family_members
      WHERE user_id = auth.uid()
        AND role = 'parent'
    )
  );

DROP POLICY IF EXISTS "ds_delete_parent" ON daily_supplies;
CREATE POLICY "ds_delete_parent" ON daily_supplies
  FOR DELETE USING (
    family_id IN (
      SELECT family_id
      FROM family_members
      WHERE user_id = auth.uid()
        AND role = 'parent'
    )
  );

GRANT ALL ON daily_supplies TO anon, authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_supplies;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

ALTER TABLE public.daily_supplies REPLICA IDENTITY FULL;
