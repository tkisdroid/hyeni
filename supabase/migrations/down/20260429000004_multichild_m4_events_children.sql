-- supabase/migrations/down/20260429000004_multichild_m4_events_children.sql
BEGIN;

DO $publication$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='events_children'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.events_children';
  END IF;
END$publication$;

DROP TABLE IF EXISTS public.events_children;
ALTER TABLE public.events DROP COLUMN IF EXISTS is_family_event;
COMMIT;
