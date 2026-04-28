-- Down: remove family_members from realtime publication. Reverts replica
-- identity to DEFAULT; family_members realtime stops, pairing/unpair UI
-- requires manual reload again.

BEGIN;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.family_members;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.family_members REPLICA IDENTITY DEFAULT;

COMMIT;
