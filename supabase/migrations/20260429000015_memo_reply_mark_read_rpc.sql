-- mark_memo_reply_read RPC: atomic read-receipt append (CR6)
--
-- markMemoReplyRead in src/lib/sync.js was a SELECT → JS append → UPDATE
-- triple, with no concurrency control. Two devices marking the same reply
-- read at nearly the same time (parent + 2nd parent device, parent + child
-- on a shared reply) both read the same read_by array, both appended their
-- own user_id, and the second UPDATE overwrote the first — silently losing
-- one user's read receipt.
--
-- This RPC does the append atomically using array operators:
--   - SELECT 1 if userId already in read_by → no-op fast path
--   - else UPDATE with array_append on the existing column reference, which
--     reads the row's current value at write time so concurrent appends
--     accumulate instead of overwriting.
--
-- The RPC is callable by any authenticated user; the check_constraint on
-- memo_replies.read_by + RLS already restrict who can write.
--
-- Pairing: supabase/migrations/down/20260429000015_memo_reply_mark_read_rpc.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_memo_reply_read(p_reply_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'auth_required');
  END IF;
  -- p_user_id must equal the caller — prevents one user marking another's
  -- read receipt. Parent + child on the same family share visibility but
  -- each marks their own read.
  IF v_caller IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Atomic append: array_append against the existing column value, gated
  -- on NOT (p_user_id = ANY(read_by)) so a concurrent append from another
  -- session simply observes the row already includes us and no-ops. The
  -- WHERE keeps the write idempotent without needing a transaction.
  UPDATE public.memo_replies
     SET read_by = COALESCE(read_by, ARRAY[]::uuid[]) || ARRAY[p_user_id]
   WHERE id = p_reply_id
     AND NOT (p_user_id = ANY(COALESCE(read_by, ARRAY[]::uuid[])));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_memo_reply_read(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_memo_reply_read(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_memo_reply_read(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.mark_memo_reply_read(uuid, uuid) IS
  'Atomically append the caller to memo_replies.read_by. Replaces the JS read-modify-write that lost concurrent receipts.';

COMMIT;
