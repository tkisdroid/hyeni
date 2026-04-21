-- Phase 2 Stream B — Enable Realtime on saved_places, family_subscription, memo_replies
-- + REPLICA IDENTITY FULL on all 6 postgres_changes-subscribed tables
-- + PostgREST schema cache reload.
--
-- Pattern per STACK.md §Issue #2: publication ADD + replica identity full + NOTIFY pgrst.
-- Idempotent DO-block wrapping on ADDs handles "already a member" cases (pattern
-- inherited from supabase/archive/_deprecated_fix-sync-final.sql lines 279-281).
--
-- Pre-apply state (Phase 2 Task 2, via pg_publication_tables probe):
--   publication members:     academies, events, memo_replies, memos
--   publication MISSING:     saved_places, family_subscription
--   replica FULL ('f'):      memo_replies
--   replica DEFAULT ('d'):   academies, events, family_subscription, memos, saved_places
--
-- Post-apply expected:
--   publication members:     academies, events, family_subscription, memo_replies, memos, saved_places  (6)
--   replica FULL ('f'):      academies, events, family_subscription, memo_replies, memos, saved_places  (6)

BEGIN;

-- Step 1 — Add tables to supabase_realtime publication (idempotent via DO block)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_places;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.family_subscription;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.memo_replies;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 2 — REPLICA IDENTITY FULL required when filtering on non-PK columns (family_id).
-- Without this, UPDATE events with family_id filter silently drop server-side.
-- (PITFALLS §Pitfall 2.2; Supabase docs guides/realtime/postgres-changes.mdx)
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.memos REPLICA IDENTITY FULL;
ALTER TABLE public.academies REPLICA IDENTITY FULL;
ALTER TABLE public.saved_places REPLICA IDENTITY FULL;
ALTER TABLE public.family_subscription REPLICA IDENTITY FULL;
ALTER TABLE public.memo_replies REPLICA IDENTITY FULL;

COMMIT;

-- Step 3 — Reload PostgREST schema cache (outside the transaction so the notify
-- fires immediately upon apply). Applied as a separate execute_sql call by the
-- executor after the migration commits.
-- NOTIFY pgrst, 'reload schema';
