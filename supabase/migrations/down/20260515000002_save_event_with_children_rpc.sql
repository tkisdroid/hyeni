BEGIN;
DROP FUNCTION IF EXISTS public.save_event_with_children(jsonb, uuid[], boolean, timestamptz);
COMMIT;
