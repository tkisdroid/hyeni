-- Down: irreversible by design.
--
-- This migration aligned legacy families to the post-default_allowed default
-- (true). Reversing it would require knowing which rows were originally false
-- — that information is not preserved. If you need to re-disable matching
-- per-family, use the application's toggle (setFamilyPlaydateEnabled) or a
-- targeted UPDATE on identified families.
--
-- Intentional no-op so the down folder stays in sync with the up folder.

BEGIN;
SELECT 1;
COMMIT;
