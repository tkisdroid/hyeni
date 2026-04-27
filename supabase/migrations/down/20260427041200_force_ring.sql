-- DOWN: force_ring — reverses 20260427041200_force_ring.sql
-- Order: cron jobs → publication → RPC → policies → table

BEGIN;

-- Cron jobs are deferred in this migration (see forward .sql).
-- If the Phase 2 follow-up migration enabled them, uncomment these:
-- SELECT cron.unschedule('force_ring_delivery_timeout');
-- SELECT cron.unschedule('force_ring_reminder_check');

DO $publication$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'force_ring_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.force_ring_events';
  END IF;
END$publication$;

DROP FUNCTION IF EXISTS public.force_ring_check_quota(uuid);

DROP POLICY IF EXISTS force_ring_update_target ON public.force_ring_events;
DROP POLICY IF EXISTS force_ring_update_initiator ON public.force_ring_events;
DROP POLICY IF EXISTS force_ring_insert ON public.force_ring_events;
DROP POLICY IF EXISTS force_ring_select ON public.force_ring_events;

DROP TABLE IF EXISTS public.force_ring_events;

COMMIT;
