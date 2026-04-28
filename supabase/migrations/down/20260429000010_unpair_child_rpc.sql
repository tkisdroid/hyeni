-- Down: drop the unpair_child RPC. The client falls back to the original
-- family_members-only delete in src/lib/auth.js (which leaves user-tied
-- push/location rows orphaned).

BEGIN;

DROP FUNCTION IF EXISTS public.unpair_child(uuid, uuid);

COMMIT;
