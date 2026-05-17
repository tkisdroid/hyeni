-- 친구놀이: get_active_playdate_session RPC — phone 소스를 family_members로 전환
--
-- 기존: 친구 가족 연락처를 families.mom_phone/dad_phone에서 읽음.
-- 변경: 부모 전화번호의 canonical source가 family_members.phone 으로 통합되어,
--       친구 가족(role='parent') 멤버 행의 phone 을 집계한다.
--
-- friend_family_phones 출력 형태는 기존과 동일한 [phone] 문자열 배열을 유지한다
-- (ActivePlaydateCard.jsx:12 / Banner.jsx:37 이 .filter(Boolean) 로 소비).
-- gender 컬럼은 정렬(엄마→아빠→미상)에만 사용하고 출력에 노출하지 않는다.
-- PIPA: phone 만 노출, child/parent auth UUID 미노출. 빈 phone 은 필터.
--
-- authz: caller 가 p_family_id 멤버여야 함 (기존과 동일) + SECURITY DEFINER.
-- 의존: 20260518000000_add_family_members_gender.sql (gender 컬럼).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_active_playdate_session(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session record;
  v_friend_family_id uuid;
  v_friend_child_id uuid;
  v_place_name text;
  v_friend_child_name text;
  v_phones jsonb;
BEGIN
  -- Authz: caller must be member of p_family_id
  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = auth.uid() AND family_id = p_family_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, public_place_id, family_a_id, family_b_id,
         child_a_id, child_b_id, started_at, stopped_at, stop_reason
    INTO v_session
  FROM public.friend_playdate_sessions
  WHERE (family_a_id = p_family_id OR family_b_id = p_family_id)
    AND stopped_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_friend_family_id := CASE
    WHEN v_session.family_a_id = p_family_id THEN v_session.family_b_id
    ELSE v_session.family_a_id
  END;
  v_friend_child_id := CASE
    WHEN v_session.family_a_id = p_family_id THEN v_session.child_b_id
    ELSE v_session.child_a_id
  END;

  -- 친구 가족 부모 연락처: family_members.phone 집계 (엄마 → 아빠 → 미상 순).
  v_phones := COALESCE(
    (SELECT jsonb_agg(phone ORDER BY
              CASE gender WHEN 'mom' THEN 0 WHEN 'dad' THEN 1 ELSE 2 END, name)
       FROM public.family_members
      WHERE family_id = v_friend_family_id
        AND role = 'parent'
        AND phone IS NOT NULL
        AND phone <> ''),
    '[]'::jsonb
  );

  SELECT name INTO v_place_name
  FROM public.public_places WHERE id = v_session.public_place_id;

  SELECT name INTO v_friend_child_name
  FROM public.family_members WHERE user_id = v_friend_child_id;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'public_place_id', v_session.public_place_id,
    'family_a_id', v_session.family_a_id,
    'family_b_id', v_session.family_b_id,
    'started_at', v_session.started_at,
    'stopped_at', v_session.stopped_at,
    'stop_reason', v_session.stop_reason,
    'place_name', COALESCE(v_place_name, '안전장소'),
    'friend_child_name', COALESCE(v_friend_child_name, '친구'),
    'friend_family_phones', v_phones
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_playdate_session(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_active_playdate_session(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_active_playdate_session(uuid) TO authenticated;

COMMIT;
