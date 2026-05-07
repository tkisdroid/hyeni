-- Down migration for 20260507000000_location_history_is_estimated.sql
-- RPC 를 Phase C 시점 (is_estimated 미사용) 으로 원복하고 컬럼 drop.
-- 데이터 손실: is_estimated=true 로 표시됐던 row 들의 플래그 정보가 사라지지만,
-- 좌표 자체는 유지되므로 기능 영향 없음 (frontend 는 거리 임계값 폴백으로 동작).

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
      CONTINUE;
    END;
  END LOOP;
END;
$$;

ALTER TABLE public.location_history
  DROP COLUMN IF EXISTS is_estimated;

COMMIT;
