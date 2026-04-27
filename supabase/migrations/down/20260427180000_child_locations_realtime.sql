-- Down: child_locations Realtime
-- Reverses 20260427180000_child_locations_realtime.sql.
-- REPLICA IDENTITY revert to DEFAULT is safe — only affects how UPDATE/DELETE
-- WAL records carry old-row data, no data loss.

BEGIN;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.child_locations;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.child_locations REPLICA IDENTITY DEFAULT;

COMMIT;
