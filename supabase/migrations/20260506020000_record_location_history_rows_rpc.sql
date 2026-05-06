-- 20260506020000_record_location_history_rows_rpc.sql
--
-- Phase C: location_history 누락 회복.
--
-- 증상: LocationService.uploadLocation 의 인증 ladder (user JWT → refreshed
--       JWT → anon JWT) 중 마지막 anon JWT 폴백이 성공해도, 다음 단계인
--       location_history 직접 insert 는 RLS 가 거부 (user_id = auth.uid()).
--       결과: access token 만료 후 자녀의 모든 이동경로가 영영 저장 안 됨.
--
-- 근본 원인: location_history 테이블의 INSERT 정책이 user_id = auth.uid() 만
--           허용하므로, anon JWT 호출에는 auth.uid() 가 NULL → 무조건 reject.
--
-- 수정 방식: upsert_child_location 과 동일 패턴의 SECURITY DEFINER RPC 추가.
--           authz 는 user_id-family_id pair 가 family_members 테이블에 존재
--           하는지로 검증 (기존 upsert 패턴과 동일 강도).
--
-- 호출자: android/app/src/main/java/com/hyeni/calendar/LocationService.java
--         의 uploadLocationHistoryRows() 가 본 RPC 로 라우팅 변경 (이후 commit).

BEGIN;

CREATE OR REPLACE FUNCTION public.record_location_history_rows(p_rows jsonb)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb;
  v_user_id uuid;
  v_family_id uuid;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN;
  END IF;

  FOR v_row IN SELECT jsonb_array_elements(p_rows) LOOP
    v_user_id := NULLIF(v_row->>'user_id', '')::uuid;
    v_family_id := NULLIF(v_row->>'family_id', '')::uuid;

    IF v_user_id IS NULL OR v_family_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Authz: user must belong to family_id (matches upsert_child_location intent).
    IF NOT EXISTS (
      SELECT 1 FROM public.family_members
      WHERE user_id = v_user_id AND family_id = v_family_id
    ) THEN
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.location_history (user_id, family_id, lat, lng, recorded_at)
      VALUES (
        v_user_id,
        v_family_id,
        NULLIF(v_row->>'lat', '')::double precision,
        NULLIF(v_row->>'lng', '')::double precision,
        COALESCE(NULLIF(v_row->>'recorded_at', '')::timestamptz, now())
      );
    EXCEPTION WHEN OTHERS THEN
      -- 한 row 의 invalid lat/lng 가 batch 전체를 실패시키지 않도록.
      CONTINUE;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.record_location_history_rows(jsonb) IS
  'Phase C: SECURITY DEFINER inserter for location_history. Bypasses RLS for native anon-key fallback path. Authz: user_id-family_id pair must exist in family_members. Per-row error tolerance — invalid rows skipped, batch continues.';

GRANT EXECUTE ON FUNCTION public.record_location_history_rows(jsonb) TO anon, authenticated;

COMMIT;
