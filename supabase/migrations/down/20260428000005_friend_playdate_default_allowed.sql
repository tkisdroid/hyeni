-- Down: restore friend_playdate default approval to opt-out default false.

BEGIN;

ALTER TABLE public.families
  ALTER COLUMN playdate_enabled SET DEFAULT false;

COMMIT;
