-- Paired rollback for 20260421110904_memo_model_unification.sql
-- (Phase 4 · MEMO-01/02/03)
--
-- Reverse order of the up migration:
--   1. DELETE ingested legacy rows (origin='legacy_memo') from memo_replies
--      — this is the only data-mutating step of the up migration, so it gets
--        reverted first before column drops.
--   2. RESTORE memo_replies.user_id NOT NULL (reverse of up step #4).
--      SAFE: step #1 has already deleted every NULL-user_id row (they are
--      all origin='legacy_memo'); no other INSERT path produces NULL user_id.
--   3. DROP COLUMN read_by on memo_replies  (was ADD #3 in up)
--   4. DROP COLUMN origin on memo_replies   (was ADD #2 in up)
--   5. DROP TABLE memos_legacy_20260421     (was CREATE #1 in up)
--
-- public.memos table is NOT touched by either direction. Rollback leaves
-- prod memos fully intact.
--
-- Data-impact note: step 1 PERMANENTLY erases any memo_replies row with
-- origin='legacy_memo', including ones that the ingestion step inserted
-- AND any organic rows that somehow acquired that marker (shouldn't
-- happen — client only ever writes 'reply' or 'original'). If this rollback
-- runs after client code has been reverted to write into public.memos,
-- memos still has every row that was ingested (that's why step 1 of up
-- didn't mutate memos).

BEGIN;

-- 1. Delete the ingested legacy rows.
DELETE FROM public.memo_replies WHERE origin = 'legacy_memo';

-- 2. Restore user_id NOT NULL (reverse of up step #4).
-- Precondition: step 1 has already purged NULL user_id rows (all legacy).
ALTER TABLE public.memo_replies ALTER COLUMN user_id SET NOT NULL;

-- 3. Drop the read_by column (reverse of up step #3).
ALTER TABLE public.memo_replies DROP COLUMN IF EXISTS read_by;

-- 4. Drop the origin column (reverse of up step #2).
ALTER TABLE public.memo_replies DROP COLUMN IF EXISTS origin;

-- 5. Drop the snapshot table (reverse of up step #1).
DROP TABLE IF EXISTS public.memos_legacy_20260421;

COMMIT;
