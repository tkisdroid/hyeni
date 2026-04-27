-- Down: get_active_playdate_session RPC 제거.
BEGIN;

DROP FUNCTION IF EXISTS public.get_active_playdate_session(uuid);

COMMIT;
