-- friend_playdate: backfill existing families to match the new default.
--
-- Migration 20260428000005_friend_playdate_default_allowed.sql changed
-- families.playdate_enabled DEFAULT from false to true so that newly created
-- families opt in by default. Pre-existing rows still carry false because
-- ALTER COLUMN ... SET DEFAULT does not touch existing data.
--
-- This one-time backfill aligns legacy rows with the post-default_allowed
-- intent. Parents can still disable matching from the management page; the
-- write path (setFamilyPlaydateEnabled) is unaffected.

BEGIN;

UPDATE public.families
   SET playdate_enabled = true
 WHERE playdate_enabled = false;

COMMIT;
