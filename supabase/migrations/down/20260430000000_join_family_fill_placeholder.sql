-- supabase/migrations/down/20260430000000_join_family_fill_placeholder.sql
-- DOWN pair for 20260430000000_join_family_fill_placeholder.sql
--
-- Restores join_family() to its prior baseline (TTL + suffix-collision INSERT
-- without placeholder fill). The cleanup DO block in the up migration is
-- intentionally NOT reversed here — orphan rows that were merged into
-- placeholders cannot be reconstructed (the user_id alone doesn't tell us
-- which row was the synthetic '아이' duplicate).

BEGIN;

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
  SELECT count(*) INTO v_attempt_count
  FROM public.pair_attempts
  WHERE user_id = p_user_id AND attempted_at > now() - interval '1 hour';

  IF v_attempt_count >= 10 THEN
    RAISE EXCEPTION 'Too many attempts. Try again later.';
  END IF;

  INSERT INTO public.pair_attempts (user_id) VALUES (p_user_id);

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

COMMIT;
