-- supabase/migrations/20260430000000_join_family_fill_placeholder.sql
-- Fix: join_family RPC must fill an existing placeholder row instead of always
-- INSERTing a new row, otherwise multi-child families end up with N placeholder
-- slots + 1 orphan "아이" row when the child pairs.
--
-- Pairing: supabase/migrations/down/20260430000000_join_family_fill_placeholder.sql
--
-- Background: setupFamily() in src/lib/auth.js pre-creates N child slots in
-- family_members with user_id=NULL (one per planned child). Until v1.0 this
-- migration shipped, join_family() always INSERTed a new row keyed by the
-- child's auth.users.id, leaving the parent's placeholder rows orphaned. The
-- UI counts every family_members row with role='child' so the parent saw N+1
-- children where N had been registered. Reported by user (2026-04-30):
-- "아이 2명으로 회원가입을 했는데 '아이'라는 아이가 기본적으로 있어서 3명으로 나오네요."
--
-- This migration:
--   1. Rewrites join_family to prefer filling an unclaimed placeholder
--      (user_id IS NULL, role='child') over INSERTing a new row.
--   2. Cleans up already-affected families by merging orphan child rows
--      (user_id IS NOT NULL, name='아이') into the lowest-child_order
--      placeholder, re-keying events_children + subscriptions references.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── 1. Rewrite join_family with placeholder-fill logic ────────────────────
CREATE OR REPLACE FUNCTION public.join_family(
  p_pair_code text,
  p_user_id uuid,
  p_name text DEFAULT '아이'
) RETURNS uuid AS $$
DECLARE
  v_family_id uuid;
  v_attempt_count int;
  v_expires_at timestamptz;
  v_final_name text := p_name;
  v_suffix_n int := 2;
  v_existing_user uuid;
  v_placeholder_id uuid;
  v_already_member_id uuid;
BEGIN
  -- Rate limit (preserved from prod baseline)
  SELECT count(*) INTO v_attempt_count
  FROM public.pair_attempts
  WHERE user_id = p_user_id AND attempted_at > now() - interval '1 hour';

  IF v_attempt_count >= 10 THEN
    RAISE EXCEPTION 'Too many attempts. Try again later.';
  END IF;

  INSERT INTO public.pair_attempts (user_id) VALUES (p_user_id);

  -- Lookup family + TTL (preserves upper(trim()) normalization).
  SELECT id, pair_code_expires_at
    INTO v_family_id, v_expires_at
    FROM public.families
   WHERE pair_code = upper(trim(p_pair_code));

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid pair code';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RAISE EXCEPTION '만료된 연동 코드예요. 부모님께 새 코드를 받아 주세요';
  END IF;

  -- Already a member? No-op (idempotent re-pair).
  SELECT id INTO v_already_member_id
    FROM public.family_members
   WHERE family_id = v_family_id AND user_id = p_user_id
   LIMIT 1;

  IF v_already_member_id IS NOT NULL THEN
    RETURN v_family_id;
  END IF;

  -- Try to fill an unclaimed placeholder slot.
  -- Preference: name match first (parent named the slot to match the child),
  -- then lowest child_order, then deterministic by id.
  SELECT id INTO v_placeholder_id
    FROM public.family_members
   WHERE family_id = v_family_id
     AND role = 'child'
     AND user_id IS NULL
   ORDER BY
     CASE WHEN name = v_final_name THEN 0 ELSE 1 END,
     COALESCE(child_order, 999999),
     id
   LIMIT 1;

  IF v_placeholder_id IS NOT NULL THEN
    -- Fill the placeholder. Preserve the parent-set name unless the child
    -- arrived with a non-default name (i.e., they typed their own name during
    -- pair entry — currently the client sends '아이' as a fallback).
    UPDATE public.family_members
       SET user_id = p_user_id,
           name = CASE
             WHEN v_final_name IS NOT NULL
              AND v_final_name <> ''
              AND v_final_name <> '아이'
               THEN v_final_name
             ELSE name
           END
     WHERE id = v_placeholder_id;
    RETURN v_family_id;
  END IF;

  -- No placeholder available — fall back to original collision-aware INSERT.
  SELECT user_id INTO v_existing_user
    FROM public.family_members
   WHERE family_id = v_family_id
     AND role = 'child'
     AND name = v_final_name
   LIMIT 1;

  WHILE v_existing_user IS NOT NULL AND v_existing_user <> p_user_id LOOP
    v_final_name := p_name || ' ' || v_suffix_n::text;
    v_suffix_n := v_suffix_n + 1;
    SELECT user_id INTO v_existing_user
      FROM public.family_members
     WHERE family_id = v_family_id
       AND role = 'child'
       AND name = v_final_name
     LIMIT 1;
  END LOOP;

  INSERT INTO public.family_members (family_id, user_id, role, name)
  VALUES (v_family_id, p_user_id, 'child', v_final_name)
  ON CONFLICT (family_id, user_id) DO UPDATE SET name = EXCLUDED.name;

  RETURN v_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_family(text, uuid, text) TO authenticated, anon;

-- ── 2. Cleanup: merge orphan child rows into placeholders ────────────────
-- Targets rows with user_id IS NOT NULL, role='child', name='아이' (the
-- client-side fallback) where the same family also has at least one
-- placeholder row. Move user_id onto the placeholder, re-key all references,
-- delete the orphan. Skips families where no placeholder exists (the orphan
-- there is the legitimate sole child, e.g. legacy single-child flow).
DO $cleanup$
DECLARE
  rec RECORD;
  v_placeholder_id uuid;
  v_orphan_user_id uuid;
BEGIN
  FOR rec IN
    SELECT id AS orphan_id, family_id, user_id AS row_user_id
      FROM public.family_members
     WHERE role = 'child'
       AND user_id IS NOT NULL
       AND name = '아이'
  LOOP
    SELECT id INTO v_placeholder_id
      FROM public.family_members
     WHERE family_id = rec.family_id
       AND role = 'child'
       AND user_id IS NULL
     ORDER BY COALESCE(child_order, 999999), id
     LIMIT 1;

    IF v_placeholder_id IS NULL THEN
      CONTINUE;
    END IF;

    v_orphan_user_id := rec.row_user_id;

    -- Free up the unique (family_id, user_id) constraint so the placeholder
    -- can adopt the orphan's user_id without conflict.
    UPDATE public.family_members
       SET user_id = NULL
     WHERE id = rec.orphan_id;

    UPDATE public.family_members
       SET user_id = v_orphan_user_id
     WHERE id = v_placeholder_id;

    -- Re-key references that point at the orphan row's id.
    UPDATE public.events_children
       SET child_id = v_placeholder_id
     WHERE child_id = rec.orphan_id;

    UPDATE public.subscriptions
       SET child_id = v_placeholder_id
     WHERE child_id = rec.orphan_id;

    DELETE FROM public.family_members WHERE id = rec.orphan_id;
  END LOOP;
END
$cleanup$;

COMMIT;
