-- Phase 4 · MEMO-01 / MEMO-02 / MEMO-03
-- Memo model unification: shadow snapshot + origin + read_by + legacy ingestion.
--
-- Scope (per .planning/phases/04-memo-model-unification/04-CONTEXT.md D-01..D-06):
--   1. CREATE public.memos_legacy_20260421 AS SELECT * FROM public.memos
--      (rollback anchor; NEVER DROP public.memos in this migration).
--   2. ALTER public.memo_replies: ADD origin text DEFAULT 'reply'
--      (values observed by client: 'reply' | 'original' | 'legacy_memo').
--   3. ALTER public.memo_replies: ADD read_by uuid[] DEFAULT '{}'
--      (3-second viewport read receipts, MEMO-02).
--   4. ALTER public.memo_replies.user_id DROP NOT NULL — required to ingest
--      legacy memos whose sender attribution is unrecoverable. PITFALLS.md
--      §P1-6 line 142 flagged this exact gap. Legacy-only rows are filtered
--      client-side by origin='legacy_memo' and user_role='legacy'; non-legacy
--      INSERTs continue to include user_id (App.jsx send path sets it).
--   5. Back-fill ingest — copy ingestable public.memos rows (content length > 1
--      to skip pure-emoji "💬" placeholders) into public.memo_replies with
--      origin='legacy_memo', user_id=NULL, user_role='legacy'. Idempotent via
--      NOT EXISTS probe on (family_id, date_key, origin='legacy_memo').
--
-- HARD RULES (CLAUDE.md + CONTEXT.md D-01/D-03):
--   - public.memos TABLE is NOT dropped. It stays writable but client code
--     (src/lib/sync.js + src/App.jsx) flips to memo_replies for all NEW writes
--     in this same phase. The memos table becomes read-mostly / legacy.
--   - No mass-UPDATE of existing memos rows.
--   - v1.1 MEMO-CLEANUP-01 owns the eventual DROP + VIEW-ification after 30d
--     of shadow-running.
--
-- Pairing: supabase/migrations/down/20260421110904_memo_model_unification.sql
-- (DROPs memos_legacy_20260421, drops read_by + origin columns, deletes the
-- ingested legacy rows via origin='legacy_memo' filter).

BEGIN;

-- ── 1. Rollback anchor: full snapshot of memos ──────────────────────────────
-- IF NOT EXISTS guard so re-apply on a branch that already ran this is a no-op
-- (important because Plan 04-01 is single-file but may be re-applied during
-- branch iteration).
CREATE TABLE IF NOT EXISTS public.memos_legacy_20260421 AS
  SELECT * FROM public.memos;

-- Add a PK only if the constraint doesn't already exist (idempotent for
-- re-applications). memos.id is the natural PK and is guaranteed unique by
-- the source table's own PK.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.memos_legacy_20260421'::regclass
      AND conname = 'memos_legacy_20260421_pk'
  ) THEN
    ALTER TABLE public.memos_legacy_20260421
      ADD CONSTRAINT memos_legacy_20260421_pk PRIMARY KEY (id);
  END IF;
END $$;

-- ── 2. memo_replies.origin ───────────────────────────────────────────────────
-- Default 'reply' preserves existing-row semantics. Legacy ingestion below
-- overrides to 'legacy_memo' on insert. Client writes new send-path rows with
-- explicit origin='reply' or 'original' (Task 2).
ALTER TABLE public.memo_replies
  ADD COLUMN IF NOT EXISTS origin text DEFAULT 'reply';

-- ── 3. memo_replies.read_by ──────────────────────────────────────────────────
-- uuid[] default '{}' — same shape as public.memos.read_by so the client-side
-- read-receipt logic carries over. MEMO-02: only the 3-second viewport
-- observer appends to this array, not receipt-time.
ALTER TABLE public.memo_replies
  ADD COLUMN IF NOT EXISTS read_by uuid[] DEFAULT '{}';

-- ── 4. memo_replies.user_id DROP NOT NULL ────────────────────────────────────
-- The live schema has memo_replies.user_id NOT NULL. Legacy ingestion (step 5)
-- inserts rows with NULL user_id because the original public.memos table
-- never tracked sender attribution. PITFALLS.md §P1-6 specifically flags
-- this as the known blocker for memo unification. We relax the constraint
-- to allow legacy rows; every organic (non-legacy) INSERT path (sync.js
-- sendMemo + insertMemoReply, plus ingestMemoReply) continues to populate
-- user_id, so no real-world write goes NULL.
ALTER TABLE public.memo_replies
  ALTER COLUMN user_id DROP NOT NULL;

-- ── 5. Back-fill ingestion: legacy memos → memo_replies ──────────────────────
-- Filters:
--   - content IS NOT NULL AND length(trim(content)) > 1
--     (skip empty/single-char placeholders including pure emoji "💬")
--   - NOT EXISTS probe makes this idempotent — re-run is a no-op once the
--     per-(family_id, date_key) legacy row already exists.
--
-- NULL user_id is intentional per CONTEXT.md D-02/D-05: legacy rows have no
-- sender attribution and must not masquerade as a current user's authored row.
-- user_role='legacy' is the marker the client uses to render "👶 예전 메모".
INSERT INTO public.memo_replies (family_id, date_key, user_id, user_role, content, origin, created_at)
  SELECT
    m.family_id,
    m.date_key,
    NULL::uuid          AS user_id,
    'legacy'::text      AS user_role,
    m.content,
    'legacy_memo'::text AS origin,
    m.updated_at        AS created_at
  FROM public.memos m
  WHERE m.content IS NOT NULL
    AND length(trim(m.content)) > 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.memo_replies mr
      WHERE mr.family_id = m.family_id
        AND mr.date_key  = m.date_key
        AND mr.origin    = 'legacy_memo'
    );

COMMIT;
