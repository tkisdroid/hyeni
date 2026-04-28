-- Down: drop the force_ring_acknowledge RPC. Without it, child ack does
-- not propagate to the server and the 5-minute reminder cron will resume
-- spamming parents.

BEGIN;

DROP FUNCTION IF EXISTS public.force_ring_acknowledge(uuid);

COMMIT;
