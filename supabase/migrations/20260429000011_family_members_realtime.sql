-- Add family_members to realtime publication so pairing/unpair UI auto-refreshes.
--
-- Without this, the parent device does not get a realtime INSERT when a child
-- successfully pairs (joinFamily inserts a family_members row), and the
-- unpaired child's UI does not get a realtime DELETE when the parent removes
-- them. Both flows required a manual reload to reflect the change.
--
-- Pattern matches 20260421103134_enable_realtime_publications.sql:
--   - publication ADD (idempotent via duplicate_object catch)
--   - REPLICA IDENTITY FULL — required because the client subscribes with a
--     family_id filter (non-PK column).
--
-- Pairing: supabase/migrations/down/20260429000011_family_members_realtime.sql

BEGIN;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.family_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.family_members REPLICA IDENTITY FULL;

COMMIT;

-- NOTIFY pgrst, 'reload schema';
