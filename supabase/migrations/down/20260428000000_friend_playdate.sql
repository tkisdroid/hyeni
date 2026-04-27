-- Down: friend_playdate
-- Reverses 20260428000000_friend_playdate.sql in REVERSE dependency order.

BEGIN;

DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables
             WHERE pubname='supabase_realtime'
             AND schemaname='public'
             AND tablename='friend_playdate_sessions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime
             DROP TABLE public.friend_playdate_sessions';
  END IF;
END$publication$;

DROP FUNCTION IF EXISTS public.find_playdate_candidates(uuid);

-- C-2: trigger + function teardown (must precede table DROP).
DROP TRIGGER IF EXISTS friend_playdate_immutable_fields ON public.friend_playdate_sessions;
DROP FUNCTION IF EXISTS public.guard_friend_playdate_update();

DROP TABLE IF EXISTS public.friend_playdate_sessions;

ALTER TABLE public.families DROP COLUMN IF EXISTS playdate_enabled;
ALTER TABLE public.saved_places DROP COLUMN IF EXISTS is_playdate_safe;
ALTER TABLE public.saved_places DROP COLUMN IF EXISTS public_place_id;

DROP TABLE IF EXISTS public.public_places;

-- H-4: family_members_user_id_idx는 다른 RLS hot path에서도 유용 → DROP하지 않음.
-- PostGIS extension은 다른 기능이 사용할 수 있으므로 DROP하지 않음.

COMMIT;
