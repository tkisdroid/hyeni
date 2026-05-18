-- Down: native location refresh recovery.

BEGIN;

DROP FUNCTION IF EXISTS public.get_pending_notifications_for_device(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.upsert_fcm_token(uuid, uuid, text, text);

COMMIT;
