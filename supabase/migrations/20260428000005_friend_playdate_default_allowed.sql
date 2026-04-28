-- friend_playdate default approval
--
-- New families should start with friend playdate matching allowed. Parents can
-- still disable matching from the friend playdate management page.

BEGIN;

ALTER TABLE public.families
  ALTER COLUMN playdate_enabled SET DEFAULT true;

COMMIT;
