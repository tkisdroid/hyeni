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

-- H-1: INSERT는 Kakao 검색 결과만 허용 (kakao_place_id 필수).
-- nameless/coordsless rows은 service_role admin tools로만 생성 가능.
DROP POLICY IF EXISTS public_places_insert ON public.public_places;
CREATE POLICY public_places_insert ON public.public_places
  FOR INSERT TO authenticated
  WITH CHECK (kakao_place_id IS NOT NULL);

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
-- H-3: child_a_id / child_b_id / initiator_user_id → auth.users FK + ON DELETE SET NULL
-- (force_ring_events sibling pattern — supabase/migrations/20260427041200_force_ring.sql L26-44).
-- NOT NULL은 DROP, 대신 INSERT RLS WITH CHECK에서 강제.
CREATE TABLE IF NOT EXISTS public.friend_playdate_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_place_id uuid NOT NULL REFERENCES public.public_places(id),
  family_a_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  family_b_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_a_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  child_b_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  initiator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
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

-- C-1: (SELECT auth.uid()) 패턴 — planner가 statement당 한번만 평가하도록 wrap.
DROP POLICY IF EXISTS friend_playdate_select ON public.friend_playdate_sessions;
CREATE POLICY friend_playdate_select ON public.friend_playdate_sessions
  FOR SELECT TO authenticated
  USING (
    family_a_id IN (SELECT family_id FROM public.family_members WHERE user_id = (SELECT auth.uid()))
    OR family_b_id IN (SELECT family_id FROM public.family_members WHERE user_id = (SELECT auth.uid()))
  );

-- INSERT 정책 없음 → start_playdate RPC (SECURITY DEFINER)가 강제 (또는 client INSERT는 RLS deny → 본 plan은 client INSERT 사용. INSERT 정책 추가가 필요한 경우 Task 1.3 검증 후 패치)

-- H-3 + C-1: INSERT 정책에서 NOT NULL 강제 + (SELECT auth.uid()) wrap.
DROP POLICY IF EXISTS friend_playdate_insert ON public.friend_playdate_sessions;
CREATE POLICY friend_playdate_insert ON public.friend_playdate_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    initiator_user_id = (SELECT auth.uid())
    AND child_a_id IS NOT NULL
    AND child_b_id IS NOT NULL
    AND (
      family_a_id IN (SELECT family_id FROM public.family_members WHERE user_id = (SELECT auth.uid()))
      OR family_b_id IN (SELECT family_id FROM public.family_members WHERE user_id = (SELECT auth.uid()))
    )
  );

-- C-1: (SELECT auth.uid()) 패턴.
DROP POLICY IF EXISTS friend_playdate_update ON public.friend_playdate_sessions;
CREATE POLICY friend_playdate_update ON public.friend_playdate_sessions
  FOR UPDATE TO authenticated
  USING (
    stopped_at IS NULL
    AND (
      family_a_id IN (SELECT family_id FROM public.family_members WHERE user_id = (SELECT auth.uid()))
      OR family_b_id IN (SELECT family_id FROM public.family_members WHERE user_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (stopped_at IS NOT NULL);

-- DELETE 정책 없음 = service_role only (immutable audit)

-- C-2: BEFORE UPDATE trigger — RLS update 정책으로 stopped_at만 수정 가능하게 한 위에,
-- immutable 필드(family_*, child_*, initiator, public_place, started_at, created_at) 변조 차단.
CREATE OR REPLACE FUNCTION public.guard_friend_playdate_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.family_a_id <> OLD.family_a_id
     OR NEW.family_b_id <> OLD.family_b_id
     OR NEW.child_a_id IS DISTINCT FROM OLD.child_a_id
     OR NEW.child_b_id IS DISTINCT FROM OLD.child_b_id
     OR NEW.initiator_user_id IS DISTINCT FROM OLD.initiator_user_id
     OR NEW.public_place_id <> OLD.public_place_id
     OR NEW.started_at <> OLD.started_at
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'friend_playdate_sessions: immutable fields cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_playdate_immutable_fields ON public.friend_playdate_sessions;
CREATE TRIGGER friend_playdate_immutable_fields
  BEFORE UPDATE ON public.friend_playdate_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_friend_playdate_update();

-- H-4: defensive index on family_members.user_id (cross-cutting RLS hot path).
-- friend_playdate RLS 정책은 매 row마다 family_members WHERE user_id = auth.uid() lookup 발생 →
-- user_id 인덱스가 없으면 모든 family_members seq scan. 다른 RLS도 동일 hot path 사용.
CREATE INDEX IF NOT EXISTS family_members_user_id_idx
  ON public.family_members (user_id);

-- 5. find_playdate_candidates RPC
CREATE OR REPLACE FUNCTION public.find_playdate_candidates(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_my_place uuid;
  v_results jsonb;
BEGIN
  -- NOTE: Both 'parent' and 'child' roles can call this RPC by design (FP-D04 아이의
  -- 명시적 버튼 클릭). PIPA mitigation = bilateral families.playdate_enabled 토글
  -- (FP-D03). Children seeing other children's names is intended; parents seeing
  -- contact info is intended.
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
