-- Down migration for 20260429120000_coparent_permissions.sql.
-- Restores prior permissive RLS (any family_member with role='parent' could write)
-- and the looser join_family_as_parent + add_sticker function bodies.

BEGIN;

DROP POLICY IF EXISTS "ev_ins" ON public.events;
CREATE POLICY "ev_ins" ON public.events FOR INSERT
  WITH CHECK (family_id IN (SELECT public.get_my_family_ids()));

DROP POLICY IF EXISTS "ev_upd" ON public.events;
CREATE POLICY "ev_upd" ON public.events FOR UPDATE
  USING (family_id IN (SELECT public.get_my_family_ids()));

DROP POLICY IF EXISTS "ev_del" ON public.events;
CREATE POLICY "ev_del" ON public.events FOR DELETE
  USING (family_id IN (SELECT public.get_my_family_ids()));

DROP POLICY IF EXISTS events_children_modify_parent ON public.events_children;
CREATE POLICY events_children_modify_parent
  ON public.events_children FOR ALL
  USING (event_id IN (
    SELECT id FROM public.events
    WHERE family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'parent'
    )
  ));

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

CREATE OR REPLACE FUNCTION public.add_sticker(
  p_user_id uuid,
  p_family_id uuid,
  p_event_id text,
  p_date_key text,
  p_sticker_type text DEFAULT 'on_time',
  p_emoji text DEFAULT '⭐',
  p_title text DEFAULT ''
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.stickers
    WHERE user_id = p_user_id
      AND event_id = p_event_id
      AND sticker_type = p_sticker_type
  ) THEN
    INSERT INTO public.stickers (user_id, family_id, event_id, date_key, sticker_type, emoji, title)
    VALUES (p_user_id, p_family_id, p_event_id, p_date_key, p_sticker_type, p_emoji, p_title);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.add_sticker(uuid, uuid, text, text, text, text, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.is_primary_parent(uuid);

COMMIT;
