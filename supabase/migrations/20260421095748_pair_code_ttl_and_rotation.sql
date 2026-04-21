-- Phase 2 Stream C Wave 1 — Pair Code TTL + Rotation
-- Satisfies PAIR-01 (TTL + parent rotation) and PAIR-02 (slot-squat prevention).
--
-- Pattern per STACK.md §Issue #3 + PITFALLS §Pitfall 3.3:
--   - pair_code_expires_at is NULLABLE (grandfathered existing codes)
--   - TTL enforced in function body, NOT via CHECK constraint
--   - join_family RPC: existing rate limit + invalid-code + new TTL check +
--     new name-suffix collision handling (D-C06)
--   - regenerate_pair_code RPC: SECURITY DEFINER, parent-only

BEGIN;

-- ── 1. Add nullable expires_at column (D-C01) ─────────────────────────
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS pair_code_expires_at timestamptz;

COMMENT ON COLUMN public.families.pair_code_expires_at IS
  'Phase 2 PAIR-01: TTL for pair_code. NULL = grandfathered (no TTL). Non-NULL = expires at this timestamp (new codes default 48h).';

-- ── 2. Rewrite join_family with TTL + suffix collision (D-C02 + D-C06) ──
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
BEGIN
  -- Rate limit (preserved from prod baseline)
  SELECT count(*) INTO v_attempt_count
  FROM public.pair_attempts
  WHERE user_id = p_user_id AND attempted_at > now() - interval '1 hour';

  IF v_attempt_count >= 10 THEN
    RAISE EXCEPTION 'Too many attempts. Try again later.';
  END IF;

  INSERT INTO public.pair_attempts (user_id) VALUES (p_user_id);

  -- Lookup family + TTL (D-C01, D-C02). Preserves upper(trim()) normalization from prod baseline.
  SELECT id, pair_code_expires_at
    INTO v_family_id, v_expires_at
    FROM public.families
   WHERE pair_code = upper(trim(p_pair_code));

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid pair code';
  END IF;

  -- TTL check — only non-NULL expires_at is enforced (grandfathered = NULL)
  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RAISE EXCEPTION '만료된 연동 코드예요. 부모님께 새 코드를 받아 주세요';
  END IF;

  -- Name-suffix collision handling (D-C06) — prevent slot squatting
  -- If (family_id, name, role='child') already claimed by a DIFFERENT user_id,
  -- suffix with ' 2', ' 3', ... until unique. Same user_id → UPDATE path below.
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

  -- Upsert membership (same user_id → update name; new user_id → insert)
  INSERT INTO public.family_members (family_id, user_id, role, name)
  VALUES (v_family_id, p_user_id, 'child', v_final_name)
  ON CONFLICT (family_id, user_id) DO UPDATE SET name = EXCLUDED.name;

  RETURN v_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_family(text, uuid, text) TO authenticated, anon;

-- ── 3. regenerate_pair_code RPC (D-C03) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.regenerate_pair_code(p_family_id uuid)
RETURNS TABLE(pair_code text, pair_code_expires_at timestamptz) AS $$
DECLARE
  v_is_parent boolean;
  v_new_code text;
  v_new_expires timestamptz;
BEGIN
  -- Parent-only caller verification per D-C03. Parent = families.parent_id = auth.uid()
  -- OR a family_members row with role='parent' for this family_id.
  SELECT EXISTS (
    SELECT 1 FROM public.families f
     WHERE f.id = p_family_id AND f.parent_id = auth.uid()
    UNION
    SELECT 1 FROM public.family_members fm
     WHERE fm.family_id = p_family_id
       AND fm.user_id = auth.uid()
       AND fm.role = 'parent'
  ) INTO v_is_parent;

  IF NOT v_is_parent THEN
    RAISE EXCEPTION '부모 계정만 연동 코드를 재생성할 수 있어요';
  END IF;

  -- Generate new code in existing format ('KID-' + 8 upper hex)
  v_new_code := 'KID-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_new_expires := now() + interval '48 hours';

  UPDATE public.families
     SET pair_code = v_new_code,
         pair_code_expires_at = v_new_expires
   WHERE id = p_family_id;

  RETURN QUERY SELECT v_new_code, v_new_expires;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.regenerate_pair_code(uuid) TO authenticated;

COMMIT;
