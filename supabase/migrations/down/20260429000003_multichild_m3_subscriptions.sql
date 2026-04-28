-- supabase/migrations/down/20260429000003_multichild_m3_subscriptions.sql
BEGIN;

DO $publication$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions';
  END IF;
END$publication$;

DROP TABLE IF EXISTS public.subscriptions;
COMMIT;
