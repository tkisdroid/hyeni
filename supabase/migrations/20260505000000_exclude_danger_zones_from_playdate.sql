BEGIN;

-- 친구놀이 후보는 안전장소 기준으로만 매칭하되, 우리 가족 또는 상대 가족의
-- 위험장소 반경과 겹치는 현재 위치/안전장소는 후보에서 제외한다.
CREATE OR REPLACE FUNCTION public.find_playdate_candidates(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_my_place uuid;
  v_results jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = auth.uid() AND family_id = p_family_id
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.families
                 WHERE id = p_family_id AND playdate_enabled = true) THEN
    RETURN jsonb_build_object('candidates', '[]'::jsonb,
                              'error', 'playdate_not_enabled');
  END IF;

  SELECT sp.public_place_id INTO v_my_place
  FROM public.child_locations cl
  JOIN public.family_members fm ON fm.user_id = cl.user_id
  JOIN public.saved_places sp ON sp.family_id = fm.family_id
                              AND sp.is_playdate_safe = true
                              AND sp.public_place_id IS NOT NULL
  WHERE fm.family_id = p_family_id AND fm.role = 'child'
    AND cl.updated_at > now() - interval '10 minutes'
    AND ST_DWithin(
          ST_MakePoint(cl.lng, cl.lat)::geography,
          ST_MakePoint((sp.location->>'lng')::float8, (sp.location->>'lat')::float8)::geography,
          150
        )
    AND NOT EXISTS (
      SELECT 1
      FROM public.danger_zones dz
      WHERE dz.family_id = p_family_id
        AND (
          ST_DWithin(
            ST_MakePoint(cl.lng, cl.lat)::geography,
            ST_MakePoint(dz.lng, dz.lat)::geography,
            COALESCE(dz.radius_m, 200)
          )
          OR ST_DWithin(
            ST_MakePoint((sp.location->>'lng')::float8, (sp.location->>'lat')::float8)::geography,
            ST_MakePoint(dz.lng, dz.lat)::geography,
            COALESCE(dz.radius_m, 200)
          )
        )
    )
  ORDER BY cl.updated_at DESC
  LIMIT 1;

  IF v_my_place IS NULL THEN
    RETURN jsonb_build_object('candidates', '[]'::jsonb,
                              'error', 'not_in_safe_place');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'family_id', other_fm.family_id,
    'child_user_id', other_fm.user_id,
    'child_name', other_fm.name,
    'public_place_id', v_my_place
  )) INTO v_results
  FROM public.family_members other_fm
  JOIN public.families other_f ON other_f.id = other_fm.family_id
  JOIN public.child_locations other_cl ON other_cl.user_id = other_fm.user_id
  JOIN public.saved_places other_sp ON other_sp.family_id = other_fm.family_id
                                     AND other_sp.public_place_id = v_my_place
                                     AND other_sp.is_playdate_safe = true
  WHERE other_fm.role = 'child'
    AND other_fm.family_id <> p_family_id
    AND other_f.playdate_enabled = true
    AND other_cl.updated_at > now() - interval '10 minutes'
    AND ST_DWithin(
          ST_MakePoint(other_cl.lng, other_cl.lat)::geography,
          ST_MakePoint((other_sp.location->>'lng')::float8, (other_sp.location->>'lat')::float8)::geography,
          150
        )
    AND NOT EXISTS (
      SELECT 1
      FROM public.danger_zones other_dz
      WHERE other_dz.family_id = other_fm.family_id
        AND (
          ST_DWithin(
            ST_MakePoint(other_cl.lng, other_cl.lat)::geography,
            ST_MakePoint(other_dz.lng, other_dz.lat)::geography,
            COALESCE(other_dz.radius_m, 200)
          )
          OR ST_DWithin(
            ST_MakePoint((other_sp.location->>'lng')::float8, (other_sp.location->>'lat')::float8)::geography,
            ST_MakePoint(other_dz.lng, other_dz.lat)::geography,
            COALESCE(other_dz.radius_m, 200)
          )
        )
    );

  RETURN jsonb_build_object(
    'candidates', COALESCE(v_results, '[]'::jsonb),
    'public_place_id', v_my_place
  );
END;
$$;

REVOKE ALL ON FUNCTION public.find_playdate_candidates(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_playdate_candidates(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_playdate_candidates(uuid) TO authenticated;

COMMIT;
