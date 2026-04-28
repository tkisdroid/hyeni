-- supabase/migrations/20260429000004_multichild_m4_events_children.sql
-- M4: events_children M:N + is_family_event — Spec §4.3, §5.1
-- Pairing: supabase/migrations/down/20260429000004_multichild_m4_events_children.sql

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_family_event boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.events_children (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, child_id)
);

CREATE INDEX IF NOT EXISTS events_children_child_idx
  ON public.events_children(child_id);

ALTER TABLE public.events_children ENABLE ROW LEVEL SECURITY;

DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='events_children'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.events_children';
  END IF;
END$publication$;

DO $backfill$
DECLARE
  has_child_id boolean;
  backfill_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events' AND column_name='child_id'
  ) INTO has_child_id;

  IF has_child_id THEN
    INSERT INTO public.events_children (event_id, child_id)
    SELECT e.id, e.child_id
    FROM public.events e
    WHERE e.child_id IS NOT NULL
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS backfill_count = ROW_COUNT;
    RAISE NOTICE 'M4 backfill: % events_children rows from events.child_id', backfill_count;
  ELSE
    RAISE NOTICE 'M4 backfill: events.child_id column not present, skipping';
  END IF;
END$backfill$;

COMMIT;
