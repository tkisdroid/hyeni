-- supabase/migrations/down/20260429000008_multichild_m8_backfill_legacy_events.sql
-- DOWN for M8 — best-effort rollback.
--
-- Data migration: cannot perfectly distinguish rows backfilled by M8 from
-- rows that have always been is_family_event=true through the new write
-- path. Rolling back blindly risks hiding events from children for events
-- that were intentionally marked family-wide via the new modal.
--
-- Strategy: only flip is_family_event back to false for events that still
-- have NO events_children links AND were last touched on or before the
-- M8 deploy day (2026-04-29). New writes after that day either set
-- is_family_event=false + at least one events_children link, or stay
-- is_family_event=true through deliberate user action — so the date
-- filter approximates "wasn't created via the new modal".

BEGIN;

DO $rollback$
DECLARE
  rows_reverted integer;
BEGIN
  UPDATE public.events
  SET is_family_event = false
  WHERE is_family_event = true
    AND updated_at <= '2026-04-29 23:59:59+09'::timestamptz
    AND NOT EXISTS (
      SELECT 1 FROM public.events_children ec
      WHERE ec.event_id = events.id
    );
  GET DIAGNOSTICS rows_reverted = ROW_COUNT;
  RAISE NOTICE 'M8 down: % rows reverted to is_family_event=false', rows_reverted;
END$rollback$;

COMMIT;
