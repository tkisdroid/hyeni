-- Co-parent permission enforcement.
-- Limits write access on events/events_children to the *primary* parent
-- (families.parent_id). Co-parents joined via join_family_as_parent retain
-- SELECT access plus memo/praise via add_sticker, but cannot mutate schedules.
-- Also enforces a single-co-parent invariant inside join_family_as_parent.

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.is_primary_parent(p_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.families f
    WHERE f.id = p_family_id
      AND f.parent_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_primary_parent(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_family_as_parent(
  p_pair_code text,
  p_user_id uuid,
  p_name text DEFAULT '부모'
) RETURNS uuid AS $$
DECLARE
  v_family_id uuid;
  v_primary_parent_id uuid;
  v_attempt_count int;
  v_expires_at timestamptz;
  v_existing_coparent_id uuid;
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

  SELECT id, parent_id, pair_code_expires_at
    INTO v_family_id, v_primary_parent_id, v_expires_at
    FROM public.families
   WHERE pair_code = upper(trim(p_pair_code));

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid pair code';
  END IF;

  IF v_primary_parent_id = p_user_id THEN
    RAISE EXCEPTION '이미 이 가족의 주 보호자입니다';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RAISE EXCEPTION '만료된 연동 코드예요. 가족 관리자에게 새 코드를 받아 주세요';
  END IF;

  SELECT user_id
    INTO v_existing_coparent_id
    FROM public.family_members
   WHERE family_id = v_family_id
     AND role = 'parent'
     AND user_id IS NOT NULL
     AND user_id <> v_primary_parent_id
     AND user_id <> p_user_id
   LIMIT 1;

  IF v_existing_coparent_id IS NOT NULL THEN
    RAISE EXCEPTION '이미 보조 보호자가 등록되어 있어요';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role, name)
  VALUES (v_family_id, p_user_id, 'parent', coalesce(nullif(trim(p_name), ''), '부모'))
  ON CONFLICT (family_id, user_id)
  DO UPDATE SET role = 'parent', name = EXCLUDED.name;

  RETURN v_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_family_as_parent(text, uuid, text) TO authenticated;

DROP POLICY IF EXISTS "ev_ins" ON public.events;
DROP POLICY IF EXISTS "events_insert" ON public.events;
CREATE POLICY "ev_ins" ON public.events FOR INSERT
  WITH CHECK (public.is_primary_parent(events.family_id));

DROP POLICY IF EXISTS "ev_upd" ON public.events;
DROP POLICY IF EXISTS "events_update" ON public.events;
CREATE POLICY "ev_upd" ON public.events FOR UPDATE
  USING (public.is_primary_parent(events.family_id))
  WITH CHECK (public.is_primary_parent(events.family_id));

DROP POLICY IF EXISTS "ev_del" ON public.events;
DROP POLICY IF EXISTS "events_delete" ON public.events;
CREATE POLICY "ev_del" ON public.events FOR DELETE
  USING (public.is_primary_parent(events.family_id));

DROP POLICY IF EXISTS events_children_modify_parent ON public.events_children;
CREATE POLICY events_children_modify_parent
  ON public.events_children FOR ALL
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE public.is_primary_parent(e.family_id)
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE public.is_primary_parent(e.family_id)
    )
  );

CREATE OR REPLACE FUNCTION public.add_sticker(
  p_user_id uuid,
  p_family_id uuid,
  p_event_id text,
  p_date_key text,
  p_sticker_type text DEFAULT 'on_time',
  p_emoji text DEFAULT '⭐',
  p_title text DEFAULT ''
) RETURNS void AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.family_members
  WHERE family_id = p_family_id AND user_id = v_caller
  LIMIT 1;

  SELECT role INTO v_target_role
  FROM public.family_members
  WHERE family_id = p_family_id AND user_id = p_user_id
  LIMIT 1;

  IF v_caller_role = 'child' THEN
    IF p_user_id <> v_caller OR p_sticker_type NOT IN ('early', 'on_time', 'late') THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  ELSIF v_caller_role = 'parent' THEN
    IF v_target_role <> 'child' OR p_sticker_type <> 'praise' THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.add_sticker(uuid, uuid, text, text, text, text, text) TO authenticated;

COMMIT;
