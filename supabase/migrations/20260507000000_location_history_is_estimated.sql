-- 20260507000000_location_history_is_estimated.sql
--
-- Phase D: 도보 매칭 실패 시각 구분.
--
-- 증상: Kakao Mobility 도보 API 가 짧은 거리/권역 외 등으로 빈 결과를 줄 때
--       LocationService.buildLocationHistoryRows 는 interpolateLinearPath
--       폴백으로 12m 간격 직선 보간점을 history 에 저장한다. frontend 의
--       buildTrailGradientSegments 는 인접 두 row 의 거리 > 150m 이면서
--       시간차 > 90s 일 때만 dashed 로 그리는데, 12m 보간은 절대 임계값을
--       넘지 못해 solid 직선으로 표시 → 사용자가 "도보 매칭 실패" 와
--       "정상 매칭" 을 시각 구분할 수 없다.
--
-- 수정 방식:
--   1) location_history 에 is_estimated boolean 컬럼 추가.
--   2) record_location_history_rows RPC 가 row 의 is_estimated 보존.
--   3) Native 가 보간 폴백 row 에 is_estimated=true 명시 (다음 commit).
--   4) Frontend 가 is_estimated 우선 사용해 dashed 표시 (다음 commit).
--
-- 호환성: 기본값 false → 기존 row 와 신규 정상 매칭 row 는 그대로 solid.

BEGIN;

ALTER TABLE public.location_history
  ADD COLUMN IF NOT EXISTS is_estimated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.location_history.is_estimated IS
  'true 이면 Kakao 도보 매칭 실패로 인한 직선 보간 추정 좌표. frontend 가 dashed polyline 으로 시각 구분.';

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
      INSERT INTO public.location_history (user_id, family_id, lat, lng, recorded_at, is_estimated)
      VALUES (
        v_user_id,
        v_family_id,
        NULLIF(v_row->>'lat', '')::double precision,
        NULLIF(v_row->>'lng', '')::double precision,
        COALESCE(NULLIF(v_row->>'recorded_at', '')::timestamptz, now()),
        COALESCE((v_row->>'is_estimated')::boolean, false)
      );
    EXCEPTION WHEN OTHERS THEN
      -- 한 row 의 invalid lat/lng 가 batch 전체를 실패시키지 않도록.
      CONTINUE;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.record_location_history_rows(jsonb) IS
  'Phase D: SECURITY DEFINER inserter for location_history. Bypasses RLS for native anon-key fallback path. Authz: user_id-family_id pair must exist in family_members. Per-row error tolerance — invalid rows skipped, batch continues. is_estimated boolean per-row preserves Kakao-fail dashed marker.';

GRANT EXECUTE ON FUNCTION public.record_location_history_rows(jsonb) TO anon, authenticated;

COMMIT;
