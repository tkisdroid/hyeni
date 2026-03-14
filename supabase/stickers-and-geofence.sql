-- ============================================================
-- Stickers system: table, indexes, RLS, RPCs, and grants
-- ============================================================

-- 1. Stickers table
CREATE TABLE IF NOT EXISTS stickers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  family_id uuid NOT NULL,
  event_id text NOT NULL,
  date_key text NOT NULL,
  sticker_type text NOT NULL DEFAULT 'on_time',  -- 'early', 'on_time', 'completed'
  emoji text NOT NULL DEFAULT '⭐',
  title text NOT NULL DEFAULT '',
  earned_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stickers_family ON stickers(family_id);
CREATE INDEX IF NOT EXISTS idx_stickers_user_date ON stickers(user_id, date_key);

ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickers_family_access" ON stickers FOR ALL USING (
  family_id IN (SELECT get_my_family_ids())
);

-- 2. RPC: add_sticker (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION add_sticker(
  p_user_id uuid,
  p_family_id uuid,
  p_event_id text,
  p_date_key text,
  p_sticker_type text DEFAULT 'on_time',
  p_emoji text DEFAULT '⭐',
  p_title text DEFAULT ''
) RETURNS void AS $$
BEGIN
  -- Prevent duplicate stickers for same event
  IF NOT EXISTS (SELECT 1 FROM stickers WHERE user_id = p_user_id AND event_id = p_event_id AND sticker_type = p_sticker_type) THEN
    INSERT INTO stickers (user_id, family_id, event_id, date_key, sticker_type, emoji, title)
    VALUES (p_user_id, p_family_id, p_event_id, p_date_key, p_sticker_type, p_emoji, p_title);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. RPC: get_stickers_for_date (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_stickers_for_date(
  p_family_id uuid,
  p_date_key text
) RETURNS TABLE(id uuid, user_id uuid, event_id text, sticker_type text, emoji text, title text, earned_at timestamptz) AS $$
  SELECT id, user_id, event_id, sticker_type, emoji, title, earned_at
  FROM stickers
  WHERE family_id = p_family_id AND date_key = p_date_key
  ORDER BY earned_at;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 4. RPC: get_sticker_summary (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_sticker_summary(
  p_family_id uuid
) RETURNS TABLE(user_id uuid, total_count bigint, early_count bigint, on_time_count bigint) AS $$
  SELECT user_id,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE sticker_type = 'early') as early_count,
    COUNT(*) FILTER (WHERE sticker_type = 'on_time') as on_time_count
  FROM stickers
  WHERE family_id = p_family_id
  GROUP BY user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION add_sticker TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_stickers_for_date TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sticker_summary TO anon, authenticated;
GRANT ALL ON stickers TO anon, authenticated;
