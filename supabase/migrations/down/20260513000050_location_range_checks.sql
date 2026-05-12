-- Reverse of 20260513000050_location_range_checks.sql
--
-- 경고: 본 down 적용 시 lat/lng range CHECK 제거 + record_location_history_rows
--       anon-callable 회귀. 운영 환경 적용 금지.
--
-- 원본 20260507000000_location_history_is_estimated.sql 의 함수 정의 복원.

BEGIN;

-- 1) CHECK 제약 제거.
ALTER TABLE public.child_locations
  DROP CONSTRAINT IF EXISTS child_locations_lat_range_check;
ALTER TABLE public.child_locations
  DROP CONSTRAINT IF EXISTS child_locations_lng_range_check;

ALTER TABLE public.location_history
  DROP CONSTRAINT IF EXISTS location_history_lat_range_check;
ALTER TABLE public.location_history
  DROP CONSTRAINT IF EXISTS location_history_lng_range_check;

-- 2) record_location_history_rows 원본 (20260507000000) 복원.
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
      CONTINUE;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_location_history_rows(jsonb) TO anon, authenticated;

COMMIT;
