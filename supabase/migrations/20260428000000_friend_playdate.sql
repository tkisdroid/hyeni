-- friend_playdate (친구놀이 안전) — Spec: docs/superpowers/specs/2026-04-27-friend-playdate-design.md
--
-- Creates:
--   1. PostGIS extension (ST_DWithin / ST_MakePoint dependency)
--   2. public.public_places — 글로벌 장소 카탈로그 (kakao_place_id dedup)
--   3. saved_places.is_playdate_safe + public_place_id 컬럼
--   4. families.playdate_enabled 토글
--   5. public.friend_playdate_sessions — immutable audit log
--   6. find_playdate_candidates(uuid) RPC — SECURITY DEFINER + REVOKE 패턴
--   7. supabase_realtime publication 추가
--
-- HARD RULES (CLAUDE.md Phase 1 hygiene):
--   - Idempotent: every DDL uses IF NOT EXISTS / CREATE OR REPLACE
--   - No data backfill; v1 audit surface starting empty
--   - RLS enabled on every new table
--   - DELETE policies intentionally absent → service_role only (immutable audit)
--
-- Pairing: supabase/migrations/down/20260428000000_friend_playdate.sql

BEGIN;

-- 0. PostGIS extension (geo-fence 의존)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. public_places 글로벌 카탈로그
CREATE TABLE IF NOT EXISTS public.public_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_place_id text UNIQUE,
  name text NOT NULL,
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_places_kakao_idx
  ON public.public_places (kakao_place_id);

ALTER TABLE public.public_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_places_read ON public.public_places;
CREATE POLICY public_places_read ON public.public_places
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_places_insert ON public.public_places;
CREATE POLICY public_places_insert ON public.public_places
  FOR INSERT TO authenticated WITH CHECK (true);

-- DELETE/UPDATE 정책 없음 = service_role만 (불변 카탈로그)

-- 2. saved_places 컬럼 추가
ALTER TABLE public.saved_places
  ADD COLUMN IF NOT EXISTS is_playdate_safe boolean NOT NULL DEFAULT false;
ALTER TABLE public.saved_places
  ADD COLUMN IF NOT EXISTS public_place_id uuid REFERENCES public.public_places(id);

CREATE INDEX IF NOT EXISTS saved_places_playdate_idx
  ON public.saved_places (public_place_id) WHERE is_playdate_safe = true;

-- 3. families 토글 컬럼
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS playdate_enabled boolean NOT NULL DEFAULT false;

-- 4. friend_playdate_sessions (immutable audit)
CREATE TABLE IF NOT EXISTS public.friend_playdate_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_place_id uuid NOT NULL REFERENCES public.public_places(id),
  family_a_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  family_b_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_a_id uuid NOT NULL,
  child_b_id uuid NOT NULL,
  initiator_user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  stop_reason text CHECK (stop_reason IN ('child_end','parent_end','auto_geofence_exit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (family_a_id <> family_b_id)
);

CREATE INDEX IF NOT EXISTS friend_playdate_active_idx
  ON public.friend_playdate_sessions (public_place_id)
  WHERE stopped_at IS NULL;
CREATE INDEX IF NOT EXISTS friend_playdate_family_a_time_idx
  ON public.friend_playdate_sessions (family_a_id, started_at DESC);
CREATE INDEX IF NOT EXISTS friend_playdate_family_b_time_idx
  ON public.friend_playdate_sessions (family_b_id, started_at DESC);

ALTER TABLE public.friend_playdate_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friend_playdate_select ON public.friend_playdate_sessions;
CREATE POLICY friend_playdate_select ON public.friend_playdate_sessions
  FOR SELECT TO authenticated
  USING (
    family_a_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    OR family_b_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

-- INSERT 정책 없음 → start_playdate RPC (SECURITY DEFINER)가 강제 (또는 client INSERT는 RLS deny → 본 plan은 client INSERT 사용. INSERT 정책 추가가 필요한 경우 Task 1.3 검증 후 패치)

DROP POLICY IF EXISTS friend_playdate_insert ON public.friend_playdate_sessions;
CREATE POLICY friend_playdate_insert ON public.friend_playdate_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    initiator_user_id = auth.uid()
    AND (
      family_a_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
      OR family_b_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS friend_playdate_update ON public.friend_playdate_sessions;
CREATE POLICY friend_playdate_update ON public.friend_playdate_sessions
  FOR UPDATE TO authenticated
  USING (
    stopped_at IS NULL
    AND (
      family_a_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
      OR family_b_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (stopped_at IS NOT NULL);

-- DELETE 정책 없음 = service_role only (immutable audit)

-- 5. find_playdate_candidates RPC
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

-- 6. supabase_realtime publication 추가
DO $publication$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime'
                 AND schemaname='public'
                 AND tablename='friend_playdate_sessions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime
             ADD TABLE public.friend_playdate_sessions';
  END IF;
END$publication$;

COMMIT;
