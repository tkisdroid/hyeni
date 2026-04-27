-- DOWN: force_ring — reverses 20260427041200_force_ring.sql
-- Order: cron jobs → publication → RPC → policies → table

BEGIN;

SELECT cron.unschedule('force_ring_delivery_timeout');
SELECT cron.unschedule('force_ring_reminder_check');

ALTER PUBLICATION supabase_realtime DROP TABLE public.force_ring_events;

DROP FUNCTION IF EXISTS public.force_ring_check_quota(uuid);

DROP POLICY IF EXISTS force_ring_update_target ON public.force_ring_events;
DROP POLICY IF EXISTS force_ring_update_initiator ON public.force_ring_events;
DROP POLICY IF EXISTS force_ring_insert ON public.force_ring_events;
DROP POLICY IF EXISTS force_ring_select ON public.force_ring_events;

DROP TABLE IF EXISTS public.force_ring_events;

COMMIT;
