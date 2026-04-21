-- DOWN: Phase 2 Stream B rollback — enable_realtime_publications
-- Drops the three Phase-2-added tables from supabase_realtime publication
-- and restores REPLICA IDENTITY DEFAULT on all six.
--
-- Note: memo_replies was in the publication pre-Phase-2 (likely added via Supabase
-- dashboard per 02-02 CONTEXT §D-B05). This down removes it — acceptable since
-- the DO-block wrapping makes both up and down idempotent.
--
-- events, memos, academies were in the publication pre-Phase-2 — NOT dropped on
-- rollback. Only REPLICA IDENTITY is restored to DEFAULT.

BEGIN;

-- Step 1 — Drop Phase-2-added tables from publication (idempotent via DO block)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.saved_places;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.family_subscription;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.memo_replies;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Step 2 — Restore REPLICA IDENTITY DEFAULT (pre-Phase-2 baseline)
ALTER TABLE public.events REPLICA IDENTITY DEFAULT;
ALTER TABLE public.memos REPLICA IDENTITY DEFAULT;
ALTER TABLE public.academies REPLICA IDENTITY DEFAULT;
ALTER TABLE public.saved_places REPLICA IDENTITY DEFAULT;
ALTER TABLE public.family_subscription REPLICA IDENTITY DEFAULT;
ALTER TABLE public.memo_replies REPLICA IDENTITY DEFAULT;

COMMIT;

-- Schema cache reload (run outside transaction via execute_sql after rollback apply):
-- NOTIFY pgrst, 'reload schema';
