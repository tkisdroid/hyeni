-- 친구놀이: get_active_playdate_session RPC
--
-- 문제: 패널을 직접 열 때 (FCM 미수신 상태) ActivePlaydateCard에서
-- session.friend_family_phones / friend_child_name / place_name이 비어
-- "상대 가족 연락처가 등록되어 있지 않습니다" 표시. 기존 fetchActiveSession은
-- friend_playdate_sessions의 컬럼만 SELECT 했고, families RLS는 자가족만
-- read 허용해서 직접 JOIN 불가.
--
-- 해결: SECURITY DEFINER RPC로 perspective-aware (현 가족 = A인지 B인지에 따라
-- 친구 가족 결정) 후 친구 가족의 phones / 친구 child_name / place_name을 enrich.
-- find_playdate_candidates와 같은 authz (caller가 p_family_id 멤버여야) + REVOKE
-- 패턴 + PIPA: child auth UUID는 노출하지 않고 name만 리턴.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_active_playdate_session(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session record;
  v_friend_family_id uuid;
  v_friend_child_id uuid;
  v_friend_mom text;
  v_friend_dad text;
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

  SELECT mom_phone, dad_phone INTO v_friend_mom, v_friend_dad
  FROM public.families WHERE id = v_friend_family_id;

  SELECT name INTO v_place_name
  FROM public.public_places WHERE id = v_session.public_place_id;

  SELECT name INTO v_friend_child_name
  FROM public.family_members WHERE user_id = v_friend_child_id;

  v_phones := COALESCE(
    (SELECT jsonb_agg(p) FROM (
       SELECT v_friend_mom AS p WHERE v_friend_mom IS NOT NULL AND v_friend_mom <> ''
       UNION ALL
       SELECT v_friend_dad WHERE v_friend_dad IS NOT NULL AND v_friend_dad <> ''
     ) t),
    '[]'::jsonb
  );

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
