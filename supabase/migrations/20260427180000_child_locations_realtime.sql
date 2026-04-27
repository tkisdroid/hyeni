-- Enable Realtime postgres_changes on child_locations
--
-- Why: Parent client subscribes to child_locations broadcast for live updates,
-- but if the broadcast HTTP request drops (network glitch, child app suspended
-- briefly, etc.) the parent UI never sees the new GPS fix. Adding a
-- postgres_changes subscription gives a second delivery path keyed off the
-- actual DB row write — the upsert_child_location RPC will trigger a Realtime
-- event regardless of broadcast success.
--
-- Pattern follows 20260421103134_enable_realtime_publications.sql:
--   - DO block with EXCEPTION WHEN duplicate_object → idempotent ADD
--   - REPLICA IDENTITY FULL → required because client filters on family_id
--     (non-PK column); without FULL, UPDATE events with the filter silently
--     drop server-side (PITFALLS §Pitfall 2.2).
--
-- Pairing: supabase/migrations/down/20260427180000_child_locations_realtime.sql

BEGIN;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.child_locations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.child_locations REPLICA IDENTITY FULL;

COMMIT;
