-- memo_replies: ensure RLS policies exist (table already exists)

ALTER TABLE memo_replies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "memo_replies_select" ON memo_replies;
DROP POLICY IF EXISTS "memo_replies_insert" ON memo_replies;
DROP POLICY IF EXISTS "memo_replies_delete" ON memo_replies;

-- Select: family members can read
CREATE POLICY "memo_replies_select" ON memo_replies FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- Insert: family members can write (both parent and child)
CREATE POLICY "memo_replies_insert" ON memo_replies FOR INSERT WITH CHECK (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- Delete: only own replies
CREATE POLICY "memo_replies_delete" ON memo_replies FOR DELETE USING (
  user_id = auth.uid()
);
