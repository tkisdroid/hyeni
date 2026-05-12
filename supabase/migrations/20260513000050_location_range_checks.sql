-- 20260513000050_location_range_checks.sql
--
-- QA P1 (Agent 05 L-003, L-004): lat/lng range CHECK + record_location_history_rows
-- anon hardening.
--
-- 증상 1 (L-003): upsert_child_location / direct insert 가 lat/lng 범위 검증 부재.
--                 anon 폴백 + 임의 user_id/family_id pair 만 알면 lat=999.9 같은
--                 비정상 좌표 저장 가능.
--                 saveLocationHistoryRows (src/lib/sync.js:616-631) 가 Number.isFinite
--                 만 검증 -> NaN / Infinity 만 차단, 범위 검증 없음.
--                 LocationService.handleLocation 도 accuracy 50m 만 검증.
--
-- 증상 2 (L-004): record_location_history_rows 가 anon role 에 EXECUTE GRANT.
--                 함수 내부에서 family_members 멤버십만 확인하지 caller authz 없음.
--                 anon key + (user_id, family_id) 추측 쌍으로 임의 trail row 삽입 가능.
--
-- 수정 방식:
--   1) child_locations / location_history 에 lat/lng CHECK 제약 추가:
--      lat BETWEEN -90 AND 90, lng BETWEEN -180 AND 180. NULL 도 허용 (스키마 호환).
--      신규 INSERT/UPDATE 만 검증 (기존 row 가 invalid 면 NOT VALID 후 차후 정합).
--   2) record_location_history_rows:
--      - 함수 내부에 auth.uid() = v_user_id 검증 추가 (caller 가 본인 row 만 기록 가능).
--      - REVOKE EXECUTE FROM anon (defense in depth).
--      - 함수 내부 lat/lng 범위 검증으로 무효 row skip.
--      - is_estimated 컬럼 보존 (20260507000000 기준).
--
-- 호환성 주의: Android LocationService 의 "anon-key fallback" 경로가 본 변경 후 401
--             로 떨어지므로 client 측에서 anon JWT 시 record_location_history_rows
--             호출하지 않도록 fallback ladder 재구성 필요. 본 migration 은 DB hardening
--             만 수행 -> Android 변경은 별도 follow-up PR.
--
-- Pairing: supabase/migrations/down/20260513000050_location_range_checks.sql

BEGIN;

-- 1) child_locations lat/lng range CHECK. NOT VALID 로 기존 row 영향 없이 신규만 검증.
ALTER TABLE public.child_locations
  DROP CONSTRAINT IF EXISTS child_locations_lat_range_check;
ALTER TABLE public.child_locations
  DROP CONSTRAINT IF EXISTS child_locations_lng_range_check;

ALTER TABLE public.child_locations
  ADD CONSTRAINT child_locations_lat_range_check
  CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)) NOT VALID;

ALTER TABLE public.child_locations
  ADD CONSTRAINT child_locations_lng_range_check
  CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)) NOT VALID;

-- 2) location_history lat/lng range CHECK.
ALTER TABLE public.location_history
  DROP CONSTRAINT IF EXISTS location_history_lat_range_check;
ALTER TABLE public.location_history
  DROP CONSTRAINT IF EXISTS location_history_lng_range_check;

ALTER TABLE public.location_history
  ADD CONSTRAINT location_history_lat_range_check
  CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)) NOT VALID;

ALTER TABLE public.location_history
  ADD CONSTRAINT location_history_lng_range_check
  CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)) NOT VALID;

-- 3) record_location_history_rows hardening: caller authz + lat/lng range + anon revoke.
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
  v_lat double precision;
  v_lng double precision;
  v_caller uuid := (SELECT auth.uid());
BEGIN
  -- QA P1 L-004: caller 가 authenticated 여야 함. anon 폴백 차단.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = 'P0001';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN;
  END IF;

  FOR v_row IN SELECT jsonb_array_elements(p_rows) LOOP
    v_user_id := NULLIF(v_row->>'user_id', '')::uuid;
    v_family_id := NULLIF(v_row->>'family_id', '')::uuid;

    IF v_user_id IS NULL OR v_family_id IS NULL THEN
      CONTINUE;
    END IF;

    -- QA P1 L-004: caller 가 본인 row 만 기록 가능.
    IF v_user_id <> v_caller THEN
      CONTINUE;
    END IF;

    -- Authz: user must belong to family_id.
    IF NOT EXISTS (
      SELECT 1 FROM public.family_members
      WHERE user_id = v_user_id AND family_id = v_family_id
    ) THEN
      CONTINUE;
    END IF;

    -- QA P1 L-003: lat/lng 범위 검증.
    v_lat := NULLIF(v_row->>'lat', '')::double precision;
    v_lng := NULLIF(v_row->>'lng', '')::double precision;

    IF v_lat IS NULL OR v_lng IS NULL THEN
      CONTINUE;
    END IF;
    IF v_lat < -90 OR v_lat > 90 OR v_lng < -180 OR v_lng > 180 THEN
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.location_history (user_id, family_id, lat, lng, recorded_at, is_estimated)
      VALUES (
        v_user_id,
        v_family_id,
        v_lat,
        v_lng,
        COALESCE(NULLIF(v_row->>'recorded_at', '')::timestamptz, now()),
        COALESCE((v_row->>'is_estimated')::boolean, false)
      );
    EXCEPTION WHEN OTHERS THEN
      -- 한 row 의 invalid lat/lng/timestamp 가 batch 전체를 실패시키지 않도록.
      CONTINUE;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.record_location_history_rows(jsonb) IS
  'QA P1: SECURITY DEFINER inserter for location_history. Authz: auth.uid() must equal v_user_id AND pair must exist in family_members. Per-row lat/lng range gate. anon EXECUTE revoked.';

-- defense in depth: anon EXECUTE 차단.
REVOKE ALL ON FUNCTION public.record_location_history_rows(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_location_history_rows(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_location_history_rows(jsonb) TO authenticated;

COMMIT;
