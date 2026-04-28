-- supabase/migrations/20260429000008_multichild_m8_backfill_legacy_events.sql
-- M8: Backfill legacy events as family-wide for multichild compatibility.
-- Pairing: supabase/migrations/down/20260429000008_multichild_m8_backfill_legacy_events.sql
--
-- Context: Before multichild (M4), the events table had no scoping concept —
-- every event was implicitly visible to the whole family. M4 added
-- is_family_event boolean (default false) and the events_children M:N table
-- but its backfill block keyed off events.child_id, a column that never
-- existed in this schema. As a result every legacy row landed with
-- is_family_event=false and zero events_children links.
--
-- The post-multichild visibleEvents filter (src/App.jsx) shows a child only
-- events where is_family_event=true OR the child appears in child_ids. With
-- the post-M4 state above the child sees an empty calendar — a regression
-- from the legacy "everyone in the family sees everything" behaviour.
--
-- Fix: mark every still-unscoped row (is_family_event=false AND no
-- events_children link) as is_family_event=true. New events written through
-- saveEventWithChildren on/after the multichild release pick the correct
-- scope at write time and are ignored by this backfill.

BEGIN;

DO $backfill$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.events
  SET is_family_event = true
  WHERE is_family_event = false
    AND NOT EXISTS (
      SELECT 1 FROM public.events_children ec
      WHERE ec.event_id = events.id
    );
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'M8 backfill: % legacy events marked is_family_event=true', rows_updated;
END$backfill$;

COMMIT;
