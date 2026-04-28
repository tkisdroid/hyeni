-- Down: drop the mark_memo_reply_read RPC. Client falls back to the
-- read-modify-write path (which still works modulo the lost-update race).

BEGIN;

DROP FUNCTION IF EXISTS public.mark_memo_reply_read(uuid, uuid);

COMMIT;
