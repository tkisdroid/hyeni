-- Parent pairing RPC.
-- The app cannot safely join a second parent by selecting families and
-- inserting family_members from the client because RLS can hide the pair-code
-- row before membership exists. Keep the same pair-code and TTL checks as the
-- child join RPC, but require an authenticated caller and force p_user_id to
-- match auth.uid().

BEGIN;

CREATE OR REPLACE FUNCTION public.join_family_as_parent(
  p_pair_code text,
  p_user_id uuid,
  p_name text DEFAULT '부모'
) RETURNS uuid AS $$
DECLARE
  v_family_id uuid;
  v_attempt_count int;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인 후 다시 시도해 주세요';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION '현재 로그인한 사용자로만 가족에 합류할 수 있어요';
  END IF;

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
    RAISE EXCEPTION '만료된 연동 코드예요. 가족 관리자에게 새 코드를 받아 주세요';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role, name)
  VALUES (v_family_id, p_user_id, 'parent', coalesce(nullif(trim(p_name), ''), '부모'))
  ON CONFLICT (family_id, user_id)
  DO UPDATE SET role = 'parent', name = EXCLUDED.name;

  RETURN v_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_family_as_parent(text, uuid, text) TO authenticated;

COMMIT;
