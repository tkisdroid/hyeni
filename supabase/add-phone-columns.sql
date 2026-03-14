-- Add parent phone numbers to families table
ALTER TABLE families ADD COLUMN IF NOT EXISTS mom_phone text DEFAULT '';
ALTER TABLE families ADD COLUMN IF NOT EXISTS dad_phone text DEFAULT '';
