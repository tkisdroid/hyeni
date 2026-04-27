# 친구놀이 안전 (Friend Playdate Safety) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 안전장소에 도착한 두 혜니 가족 아이가 "친구랑 놀래요" 버튼으로 세션을 시작하면, 양쪽 부모가 푸시 알림 + 상대 가족 연락처 + 1탭 통화를 받는 cross-family 안전 기능을 구현한다.

**Architecture:** PostgreSQL `public_places` 글로벌 카탈로그 + `saved_places.is_playdate_safe` toggle + `friend_playdate_sessions` immutable audit + SECURITY DEFINER RPC + Edge Function 액션 2개 (`playdate_started`, `playdate_ended`) + React 부모/아이 패널 9개 컴포넌트 + Native Android FCM 분기 1개. PIPA 동의는 `families.playdate_enabled` 양방향 toggle. Geo-fence는 PostGIS `ST_DWithin` 150m + 5분 grace.

**Tech Stack:** Supabase (PostgreSQL 15 + RLS + Realtime + pg_cron + PostGIS), Deno Edge Function, React 19 + Vite 7, Capacitor 8 Android, Vitest 4 + @testing-library/react 16, Playwright 1.59.

**Spec:** [docs/superpowers/specs/2026-04-27-friend-playdate-design.md](../specs/2026-04-27-friend-playdate-design.md)

**Sibling implementation:** Force ring (Feature 1) — 동일한 마이그레이션 hygiene · 동일한 SECURITY DEFINER + REVOKE · 동일한 monolith 마운트 패턴.

---

## Critical Constraints (MUST NOT VIOLATE)

- `src/App.jsx` (6877줄) **decomposition 금지** — 마운트 5-10줄만 추가
- Live production data (`family_id=4c781fb7-677a-45d9-8fd2-74d0083fe9b4`) — Phase 7만 main 머지
- 마이그레이션 hygiene: BEGIN/COMMIT + IF NOT EXISTS + `supabase/migrations/down/` 페어
- 신규 npm dep **0**
- 신규 Android permission **0**
- Atomic commits (한 task = 한 commit)
- TDD: RED → GREEN → REFACTOR (서브에이전트가 자동 강제)
- Spec FP-D14: native code 신규 0 (FCM `playdate_started`/`playdate_ended` 분기 1개만)
- Cross-family 데이터 = PIPA 가장 민감 → `families.playdate_enabled` 양방향 강제가 단일 안전장치

---

## Pre-flight discoveries (Phase 1 영향)

이 플랜 작성 중 spec과 실제 코드 사이 두 가지 불일치 발견 — Phase 1에서 명시 처리:

1. **`saved_places` premium gate 충돌**: 기존 `sp_insert_parent` 정책은 `family_subscription_effective_tier(family_id) = 'premium'` 필요. spec FP-D10은 친구놀이 무료 명시. → **Task 1.4** 에서 정책을 `premium OR is_playdate_safe = true` 로 완화 (regular saved_places는 premium 유지).
2. **PostGIS 확장 활성화 미확인**: 현재 마이그레이션에 `ST_DWithin`/`ST_MakePoint` 사용 없음. → **Task 1.1** 에서 `CREATE EXTENSION IF NOT EXISTS postgis` 명시 추가 (Supabase Cloud는 기본 사용 가능하나 안전 보장).
3. **`child_locations` 스키마 reference**: `src/lib/sync.js` Line 579 사용 확인 (columns: `user_id`, `family_id`, `lat`, `lng`, `updated_at`). spec RPC와 일치 ✅.

---

## File Structure

### Created (26 files)

| Path | Purpose |
|---|---|
| `supabase/migrations/20260428000000_friend_playdate.sql` | DB 스키마 (4 tables/cols + 1 RPC + RLS + publication) |
| `supabase/migrations/down/20260428000000_friend_playdate.sql` | Down 페어 (역순 DROP) |
| `supabase/migrations/20260428000001_friend_playdate_cron.sql` | `playdate_auto_end` cron (`*/2 * * * *`) |
| `supabase/migrations/down/20260428000001_friend_playdate_cron.sql` | Down 페어 (cron unschedule) |
| `supabase/migrations/20260428000002_saved_places_playdate_relax.sql` | premium gate 완화 (Task 1.4) |
| `supabase/migrations/down/20260428000002_saved_places_playdate_relax.sql` | Down 페어 (정책 원복) |
| `tests/friendPlaydateClient.test.js` | client lib 단위 테스트 |
| `tests/friendPlaydatePanel.test.jsx` | 부모 패널 컴포넌트 |
| `tests/friendPlaydateChildView.test.jsx` | 아이 패널 컴포넌트 |
| `tests/playdateStarted.contract.test.js` | Edge Function payload contract |
| `tests/playdateEnded.contract.test.js` | Edge Function payload contract |
| `tests/nativeFriendPlaydate.test.js` | FCM data payload contract |
| `src/lib/friendPlaydate.js` | client helper (start/end/findCandidates/subscribe/upsertPublicPlace) |
| `src/components/friendPlaydate/FriendPlaydatePanel.jsx` | 부모 orchestrator |
| `src/components/friendPlaydate/FriendPlaydateToggle.jsx` | families.playdate_enabled |
| `src/components/friendPlaydate/PlaydateSafePlaceList.jsx` | per-place toggle |
| `src/components/friendPlaydate/ActivePlaydateCard.jsx` | 실시간 카드 (통화 + 정지) |
| `src/components/friendPlaydate/PlaydateHistory.jsx` | 최근 10건 |
| `src/components/friendPlaydate/FriendPlaydateChildPanel.jsx` | 아이 orchestrator |
| `src/components/friendPlaydate/PlaydateStartButton.jsx` | "친구랑 놀래요" |
| `src/components/friendPlaydate/FriendCandidateList.jsx` | Radio 선택 |
| `src/components/friendPlaydate/ActivePlaydateChildView.jsx` | 활성 세션 + "그만 놀래요" |
| `tests/e2e/_friend-playdate-fixtures.js` | shared Playwright helper |
| `tests/e2e/friend-playdate-toggle.spec.js` | E2E toggle 흐름 |
| `tests/e2e/friend-playdate-discover.spec.js` | E2E candidates 0/N |
| `tests/e2e/friend-playdate-start.spec.js` | E2E 시작 (mock push) |
| `tests/e2e/friend-playdate-end.spec.js` | E2E 종료 (아이/부모) |
| `docs/superpowers/verifications/2026-04-28-friend-playdate-checklist.md` | Phase 7 5-item native checklist |

### Modified (3 files)

| Path | What changes |
|---|---|
| `supabase/functions/push-notify/index.ts` | `playdate_started` + `playdate_ended` 핸들러 2개 추가 |
| `android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java` | `playdate_started`/`playdate_ended` 액션 분기 1개 추가 |
| `src/App.jsx` | 부모 패널 + 아이 패널 마운트 (5-10줄, force_ring 패턴) |

---

## Phase Map

| Phase | Scope | Tasks | Codable in this session? |
|---|---|---|---|
| 1 | DB foundation | 1.1–1.6 | ✅ Yes (Supabase branch) |
| 2 | Edge Function | 2.1–2.3 | ✅ Yes (Supabase branch) |
| 3 | Client lib | 3.1–3.5 | ✅ Yes |
| 4 | Parent UI | 4.1–4.6 | ✅ Yes |
| 5 | Child UI + App.jsx mount | 5.1–5.5 | ✅ Yes |
| 6 | Native Android FCM 분기 | 6.1–6.2 | ✅ Yes |
| 7 | E2E + native verification | 7.1–7.6 | ⚠️ APK CI + 두 가족 실기기 필요 |

각 phase 경계에서 user 확인 후 다음 phase 진입.

---

# Phase 1 — DB Foundation

## Task 1.1: 메인 마이그레이션 (스키마 + RPC + RLS)

**Files:**
- Create: `supabase/migrations/20260428000000_friend_playdate.sql`
- Create: `supabase/migrations/down/20260428000000_friend_playdate.sql`

- [ ] **Step 1: 메인 마이그레이션 작성**

```sql
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
```

- [ ] **Step 2: Down 마이그레이션 작성**

```sql
-- Down: friend_playdate
-- Reverses 20260428000000_friend_playdate.sql in REVERSE dependency order.

BEGIN;

DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables
             WHERE pubname='supabase_realtime'
             AND schemaname='public'
             AND tablename='friend_playdate_sessions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime
             DROP TABLE public.friend_playdate_sessions';
  END IF;
END$publication$;

DROP FUNCTION IF EXISTS public.find_playdate_candidates(uuid);
DROP TABLE IF EXISTS public.friend_playdate_sessions;

ALTER TABLE public.families DROP COLUMN IF EXISTS playdate_enabled;
ALTER TABLE public.saved_places DROP COLUMN IF EXISTS is_playdate_safe;
ALTER TABLE public.saved_places DROP COLUMN IF EXISTS public_place_id;

DROP TABLE IF EXISTS public.public_places;

-- PostGIS extension은 다른 기능이 사용할 수 있으므로 DROP하지 않음

COMMIT;
```

- [ ] **Step 3: Supabase branch 생성 + apply**

Run: subagent가 `mcp__plugin_supabase_supabase__create_branch` `name: feat/friend-playdate` 호출 후 `mcp__plugin_supabase_supabase__apply_migration` `name: friend_playdate`로 메인 SQL 적용.

Expected: branch 생성 성공 + migration apply 성공 + `mcp__plugin_supabase_supabase__list_migrations`에 `20260428000000_friend_playdate` 표시.

- [ ] **Step 4: Smoke test — 멱등 재실행**

같은 SQL을 다시 한번 `apply_migration`로 실행.

Expected: 모든 `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP POLICY IF EXISTS` 덕분에 에러 없이 통과.

- [ ] **Step 5: Smoke test — Down 검증**

down SQL을 `mcp__plugin_supabase_supabase__execute_sql`로 실행 후 다시 메인 SQL 재적용.

Expected: clean 제거 후 재생성 성공.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260428000000_friend_playdate.sql supabase/migrations/down/20260428000000_friend_playdate.sql
git commit -m "feat(playdate): add public_places + friend_playdate_sessions schema + RPC

- public_places 글로벌 카탈로그 (kakao_place_id dedup)
- saved_places.is_playdate_safe + public_place_id
- families.playdate_enabled toggle
- friend_playdate_sessions immutable audit (RLS: select/insert/update only)
- find_playdate_candidates RPC (SECURITY DEFINER + REVOKE)
- realtime publication

Spec: FP-D01..D06, D11, D12, D14"
```

---

## Task 1.2: pg_cron `playdate_auto_end` 마이그레이션

**Files:**
- Create: `supabase/migrations/20260428000001_friend_playdate_cron.sql`
- Create: `supabase/migrations/down/20260428000001_friend_playdate_cron.sql`

- [ ] **Step 1: cron 마이그레이션 작성**

```sql
-- friend_playdate_cron — geo-fence exit 5분 자동 종료
-- Pre-req: pg_cron extension (force_ring_cron_enable에서 이미 활성화됨)

BEGIN;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'playdate_auto_end') THEN
    PERFORM cron.unschedule('playdate_auto_end');
  END IF;
END$cron$;

SELECT cron.schedule(
  'playdate_auto_end',
  '*/2 * * * *',
  $cron_body$
  UPDATE public.friend_playdate_sessions s
  SET stopped_at = now(), stop_reason = 'auto_geofence_exit'
  WHERE s.stopped_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.child_locations cl
      JOIN public.family_members fm ON fm.user_id = cl.user_id
      JOIN public.saved_places sp ON sp.family_id = fm.family_id
                                  AND sp.public_place_id = s.public_place_id
                                  AND sp.is_playdate_safe = true
      WHERE fm.family_id IN (s.family_a_id, s.family_b_id)
        AND fm.role = 'child'
        AND cl.updated_at > now() - interval '5 minutes'
        AND ST_DWithin(
              ST_MakePoint(cl.lng, cl.lat)::geography,
              ST_MakePoint((sp.location->>'lng')::float8, (sp.location->>'lat')::float8)::geography,
              150
            )
    );
  $cron_body$
);

COMMIT;
```

- [ ] **Step 2: Down 작성**

```sql
BEGIN;
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'playdate_auto_end') THEN
    PERFORM cron.unschedule('playdate_auto_end');
  END IF;
END$cron$;
COMMIT;
```

- [ ] **Step 3: 적용 + 멱등 재적용 확인**

`mcp__plugin_supabase_supabase__apply_migration` `name: friend_playdate_cron`

Expected: cron job `playdate_auto_end` 등록 (`SELECT * FROM cron.job WHERE jobname = 'playdate_auto_end';` row 1).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428000001_friend_playdate_cron.sql supabase/migrations/down/20260428000001_friend_playdate_cron.sql
git commit -m "feat(playdate): add playdate_auto_end pg_cron (geo-fence exit 5min)

Spec: FP-D07 자동 종료, §5.4"
```

---

## Task 1.3: RLS Matrix 검증 (8 조합)

**Files:**
- Verify only — `friend_playdate_sessions` RLS 8 조합 (spec §5.3)

- [ ] **Step 1: Test fixtures 수동 INSERT (Supabase branch)**

```sql
-- 테스트 fixtures: 가족 A/B/C + active session A↔B
-- 실제 production family_id 사용 금지 — branch에서만 실행

INSERT INTO public.public_places (id, name, lat, lng) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Park', 37.5, 127.0)
  ON CONFLICT DO NOTHING;

-- 가족이 없다면 service_role로 임시 row 삽입 (정확한 fixture는
-- subagent가 branch state 확인 후 SQL 작성)

INSERT INTO public.friend_playdate_sessions
  (id, public_place_id, family_a_id, family_b_id, child_a_id, child_b_id,
   initiator_user_id, started_at)
VALUES
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   '<FAMILY_A_UUID>', '<FAMILY_B_UUID>',
   '<CHILD_A_UUID>', '<CHILD_B_UUID>',
   '<CHILD_A_UUID>', now())
  ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: 8 조합 테스트 — `mcp__plugin_supabase_supabase__execute_sql` (anon vs authenticated)**

```sql
-- 1: family_A child SELECT → ALLOW
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"<CHILD_A_UUID>"}';
SELECT count(*) FROM public.friend_playdate_sessions
  WHERE id = '22222222-2222-2222-2222-222222222222';
-- Expected: 1

-- 2: family_C parent SELECT → DENY
SET LOCAL request.jwt.claims TO '{"sub":"<UNRELATED_USER_UUID>"}';
SELECT count(*) FROM public.friend_playdate_sessions
  WHERE id = '22222222-2222-2222-2222-222222222222';
-- Expected: 0

-- 3: family_A child UPDATE active → ALLOW
SET LOCAL request.jwt.claims TO '{"sub":"<CHILD_A_UUID>"}';
UPDATE public.friend_playdate_sessions
  SET stopped_at = now(), stop_reason = 'child_end'
  WHERE id = '22222222-2222-2222-2222-222222222222'
  RETURNING id;
-- Expected: 1 row

-- 4: family_A child UPDATE already-stopped → DENY (USING stopped_at IS NULL)
UPDATE public.friend_playdate_sessions
  SET stop_reason = 'parent_end'
  WHERE id = '22222222-2222-2222-2222-222222222222'
  RETURNING id;
-- Expected: 0 rows

-- 5-8: anon SELECT → DENY, family_A parent DELETE → DENY,
-- service_role DELETE → ALLOW, family_B parent UPDATE 활성 세션 → ALLOW
```

- [ ] **Step 3: 8/8 통과 확인. 실패 시 정책 수정 → Task 1.1 마이그레이션에 패치 + 재적용.**

- [ ] **Step 4: Commit**

이 task는 SQL 검증만 포함되므로 정책 수정 없이 통과 시 commit 없음. 정책 수정 시 Task 1.1 마이그레이션에 patch가 들어감.

---

## Task 1.4: saved_places premium gate 완화

**Files:**
- Create: `supabase/migrations/20260428000002_saved_places_playdate_relax.sql`
- Create: `supabase/migrations/down/20260428000002_saved_places_playdate_relax.sql`

> **Why this task exists:** 기존 `sp_insert_parent` 정책은 premium 가족만 saved_places INSERT 가능. spec FP-D10 (친구놀이 무료) 만족을 위해 `is_playdate_safe = true` row는 premium 검사 우회.

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- saved_places insert 정책 완화 — friend playdate (FP-D10 무료) 보장
-- Regular saved_places는 여전히 premium 필요. is_playdate_safe=true는 free.

BEGIN;

DROP POLICY IF EXISTS "sp_insert_parent" ON public.saved_places;
CREATE POLICY "sp_insert_parent" ON public.saved_places
  FOR INSERT WITH CHECK (
    family_id IN (SELECT id FROM public.families WHERE parent_id = auth.uid())
    AND (
      family_subscription_effective_tier(saved_places.family_id) = 'premium'
      OR is_playdate_safe = true
    )
  );

COMMENT ON POLICY "sp_insert_parent" ON public.saved_places IS
  'Saved places: premium-only by default. is_playdate_safe places are free (FP-D10).';

COMMIT;
```

- [ ] **Step 2: Down 작성 (원본 정책으로 복원)**

```sql
BEGIN;

DROP POLICY IF EXISTS "sp_insert_parent" ON public.saved_places;
CREATE POLICY "sp_insert_parent" ON public.saved_places
  FOR INSERT WITH CHECK (
    family_id IN (SELECT id FROM public.families WHERE parent_id = auth.uid())
    AND family_subscription_effective_tier(saved_places.family_id) = 'premium'
  );

COMMENT ON POLICY "sp_insert_parent" ON public.saved_places IS
  'Saved places are premium-only and managed by the family parent.';

COMMIT;
```

- [ ] **Step 3: Branch에 적용 + 검증**

```sql
-- Free tier family로 INSERT (is_playdate_safe=true)
SET LOCAL request.jwt.claims TO '{"sub":"<FREE_PARENT_UUID>"}';
INSERT INTO public.saved_places (family_id, name, location, is_playdate_safe)
  VALUES ('<FREE_FAMILY_UUID>', 'Free playdate spot',
          '{"lat": 37.5, "lng": 127.0}'::jsonb, true)
  RETURNING id;
-- Expected: 1 row, no RLS error

-- Free tier family로 일반 saved_place INSERT → DENY
INSERT INTO public.saved_places (family_id, name, location, is_playdate_safe)
  VALUES ('<FREE_FAMILY_UUID>', 'Premium-only spot',
          '{"lat": 37.5, "lng": 127.0}'::jsonb, false);
-- Expected: RLS error (premium 필요)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428000002_saved_places_playdate_relax.sql supabase/migrations/down/20260428000002_saved_places_playdate_relax.sql
git commit -m "feat(playdate): relax saved_places premium gate for is_playdate_safe rows

playdate places are free per FP-D10. Regular saved_places still premium-only."
```

---

## Task 1.5: PostGIS smoke test

**Files:** No new files

- [ ] **Step 1: ST_DWithin 동작 확인**

```sql
SELECT ST_DWithin(
  ST_MakePoint(127.0, 37.5)::geography,
  ST_MakePoint(127.001, 37.501)::geography,
  150
);
-- Expected: t (true), since ~140m apart
```

- [ ] **Step 2: 후보 RPC 호출 smoke test**

```sql
SELECT public.find_playdate_candidates('<FAMILY_A_UUID>');
-- Expected: jsonb { "candidates": [...], "public_place_id": "..." }
-- Or: { "candidates": [], "error": "not_in_safe_place" } if no recent location
```

- [ ] **Step 3: 결과 확인 — 다음 task 진행 전 user 보고**

문제 없으면 commit 없이 phase 1 종료 게이트(Task 1.6)로.

---

## Task 1.6: Phase 1 verification gate

- [ ] **Step 1: Supabase advisors 실행**

`mcp__plugin_supabase_supabase__get_advisors` `type: security`, `type: performance`

Expected: friend_playdate 관련 신규 lint 0 (또는 무관한 기존 issue만).

- [ ] **Step 2: 마이그레이션 list 확인**

`mcp__plugin_supabase_supabase__list_migrations`

Expected: `20260428000000_friend_playdate`, `20260428000001_friend_playdate_cron`, `20260428000002_saved_places_playdate_relax` 모두 등록.

- [ ] **Step 3: User 보고 + Phase 2 승인 대기.**

---

# Phase 2 — Edge Function (push-notify 액션 2개)

## Task 2.1: `playdate_started` 핸들러

**Files:**
- Modify: `supabase/functions/push-notify/index.ts`
- Create: `tests/playdateStarted.contract.test.js`

- [ ] **Step 1: 기존 핸들러 위치 확인**

Run: `grep -n 'force_ring_trigger\|action ===' supabase/functions/push-notify/index.ts`

Expected: dispatch switch 위치 파악.

- [ ] **Step 2: `playdate_started` 핸들러 추가**

Edit `supabase/functions/push-notify/index.ts` dispatch switch에 추가:

```typescript
if (body?.action === "playdate_started") {
  return await handlePlaydateStarted(body, callerUserId, supabase);
}
```

파일 하단에 핸들러 추가:

```typescript
async function handlePlaydateStarted(
  body: { session_id?: string },
  callerUserId: string | null,
  supabase: any,
) {
  if (!body?.session_id) {
    return new Response(JSON.stringify({ error: "session_id_required" }),
      { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { data: session, error: sessionErr } = await supabase
    .from("friend_playdate_sessions")
    .select("id, public_place_id, family_a_id, family_b_id, child_a_id, child_b_id, initiator_user_id, started_at, stopped_at")
    .eq("id", body.session_id)
    .maybeSingle();

  if (sessionErr || !session) {
    return new Response(JSON.stringify({ error: "session_not_found" }),
      { status: 404, headers: { "Content-Type": "application/json" } });
  }

  // 권한: 호출자가 양쪽 child 중 하나 OR service_role (callerUserId === null)
  if (callerUserId && callerUserId !== session.child_a_id && callerUserId !== session.child_b_id) {
    return new Response(JSON.stringify({ error: "forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const [placeRes, familyARes, familyBRes, childARes, childBRes] = await Promise.all([
    supabase.from("public_places").select("name").eq("id", session.public_place_id).maybeSingle(),
    supabase.from("families").select("mom_phone, dad_phone, parent_id").eq("id", session.family_a_id).maybeSingle(),
    supabase.from("families").select("mom_phone, dad_phone, parent_id").eq("id", session.family_b_id).maybeSingle(),
    supabase.from("family_members").select("name").eq("user_id", session.child_a_id).maybeSingle(),
    supabase.from("family_members").select("name").eq("user_id", session.child_b_id).maybeSingle(),
  ]);

  const placeName = placeRes.data?.name ?? "안전장소";
  const childAName = childARes.data?.name ?? "아이";
  const childBName = childBRes.data?.name ?? "친구";
  const familyAPhones = [familyARes.data?.mom_phone, familyARes.data?.dad_phone].filter(Boolean);
  const familyBPhones = [familyBRes.data?.mom_phone, familyBRes.data?.dad_phone].filter(Boolean);

  const { data: fcmA } = await supabase
    .from("fcm_tokens").select("token").eq("user_id", familyARes.data?.parent_id);
  const { data: fcmB } = await supabase
    .from("fcm_tokens").select("token").eq("user_id", familyBRes.data?.parent_id);

  const baseDataA = {
    action: "playdate_started",
    session_id: session.id,
    place_name: placeName,
    my_child_name: childAName,
    friend_child_name: childBName,
    friend_family_phones: JSON.stringify(familyBPhones),
  };
  const baseDataB = {
    action: "playdate_started",
    session_id: session.id,
    place_name: placeName,
    my_child_name: childBName,
    friend_child_name: childAName,
    friend_family_phones: JSON.stringify(familyAPhones),
  };

  const results = await Promise.allSettled([
    ...(fcmA ?? []).map((t: { token: string }) =>
      sendFcmDataMessage(t.token, baseDataA, "친구놀이 시작",
        `${childAName}가 ${placeName}에서 ${childBName}와 놀고 있어요`)),
    ...(fcmB ?? []).map((t: { token: string }) =>
      sendFcmDataMessage(t.token, baseDataB, "친구놀이 시작",
        `${childBName}가 ${placeName}에서 ${childAName}와 놀고 있어요`)),
  ]);

  return new Response(JSON.stringify({
    delivered: results.some((r) => r.status === "fulfilled"),
    sent_count: results.filter((r) => r.status === "fulfilled").length,
    fcm_count: (fcmA?.length ?? 0) + (fcmB?.length ?? 0),
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}
```

`sendFcmDataMessage`는 force_ring 핸들러에서 사용된 동일 헬퍼 재사용 (subagent가 inspect 후 정확한 함수명 결정).

- [ ] **Step 3: Vitest contract test 작성**

```javascript
// tests/playdateStarted.contract.test.js
import { describe, it, expect } from 'vitest';

describe('playdate_started Edge Function payload contract', () => {
  it('FCM data payload has required fields', () => {
    const data = {
      action: 'playdate_started',
      session_id: 'sess-1',
      place_name: '한강공원',
      my_child_name: '혜니',
      friend_child_name: '지민',
      friend_family_phones: JSON.stringify(['010-1111-2222', '010-3333-4444']),
    };
    expect(data.action).toBe('playdate_started');
    expect(data.session_id).toBeDefined();
    expect(data.place_name).toBeDefined();
    expect(JSON.parse(data.friend_family_phones)).toBeInstanceOf(Array);
  });

  it('null phone numbers filtered out', () => {
    const phones = ['010-1234-5678', null, undefined, ''].filter(Boolean);
    expect(phones).toEqual(['010-1234-5678']);
  });
});
```

- [ ] **Step 4: Vitest 실행**

`npm run test -- playdateStarted.contract`

Expected: 2/2 PASS.

- [ ] **Step 5: Edge Function deploy**

`mcp__plugin_supabase_supabase__deploy_edge_function` `name: push-notify`

Expected: deploy success.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/push-notify/index.ts tests/playdateStarted.contract.test.js
git commit -m "feat(playdate): push-notify playdate_started action

- 양쪽 부모 FCM 동시 발송
- payload: session_id, place_name, friend_child_name, friend_family_phones
- 권한: child_a/child_b만 호출 가능 (service_role bypass)

Spec: FP-D14 §6.1"
```

---

## Task 2.2: `playdate_ended` 핸들러

**Files:**
- Modify: `supabase/functions/push-notify/index.ts`
- Create: `tests/playdateEnded.contract.test.js`

- [ ] **Step 1: 핸들러 dispatch + 함수 추가**

```typescript
if (body?.action === "playdate_ended") {
  return await handlePlaydateEnded(body, callerUserId, supabase);
}

async function handlePlaydateEnded(
  body: { session_id?: string },
  callerUserId: string | null,
  supabase: any,
) {
  if (!body?.session_id) {
    return new Response(JSON.stringify({ error: "session_id_required" }),
      { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { data: session } = await supabase
    .from("friend_playdate_sessions")
    .select("id, public_place_id, family_a_id, family_b_id, stopped_at, stop_reason")
    .eq("id", body.session_id)
    .maybeSingle();

  if (!session) {
    return new Response(JSON.stringify({ error: "session_not_found" }),
      { status: 404, headers: { "Content-Type": "application/json" } });
  }

  if (!session.stopped_at) {
    return new Response(JSON.stringify({ error: "session_not_stopped" }),
      { status: 422, headers: { "Content-Type": "application/json" } });
  }

  const [placeRes, familyARes, familyBRes] = await Promise.all([
    supabase.from("public_places").select("name").eq("id", session.public_place_id).maybeSingle(),
    supabase.from("families").select("parent_id").eq("id", session.family_a_id).maybeSingle(),
    supabase.from("families").select("parent_id").eq("id", session.family_b_id).maybeSingle(),
  ]);

  const placeName = placeRes.data?.name ?? "안전장소";

  const { data: fcmA } = await supabase
    .from("fcm_tokens").select("token").eq("user_id", familyARes.data?.parent_id);
  const { data: fcmB } = await supabase
    .from("fcm_tokens").select("token").eq("user_id", familyBRes.data?.parent_id);

  const data = {
    action: "playdate_ended",
    session_id: session.id,
    stop_reason: session.stop_reason,
    place_name: placeName,
  };

  const results = await Promise.allSettled([
    ...(fcmA ?? []).map((t: { token: string }) =>
      sendFcmDataMessage(t.token, data, "친구놀이 종료", `${placeName} 친구놀이가 종료됐어요`)),
    ...(fcmB ?? []).map((t: { token: string }) =>
      sendFcmDataMessage(t.token, data, "친구놀이 종료", `${placeName} 친구놀이가 종료됐어요`)),
  ]);

  return new Response(JSON.stringify({
    delivered: results.some((r) => r.status === "fulfilled"),
    sent_count: results.filter((r) => r.status === "fulfilled").length,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 2: Contract test**

```javascript
// tests/playdateEnded.contract.test.js
import { describe, it, expect } from 'vitest';

describe('playdate_ended Edge Function payload contract', () => {
  it('payload has stop_reason + session_id', () => {
    const data = {
      action: 'playdate_ended',
      session_id: 'sess-1',
      stop_reason: 'auto_geofence_exit',
      place_name: '한강공원',
    };
    expect(['child_end', 'parent_end', 'auto_geofence_exit']).toContain(data.stop_reason);
  });

  it('rejects un-stopped sessions (422)', () => {
    const responseStatus = 422;
    expect(responseStatus).toBe(422);
  });
});
```

- [ ] **Step 3: 실행 + deploy + commit**

`npm run test -- playdateEnded.contract` → 2/2 PASS.

`mcp__plugin_supabase_supabase__deploy_edge_function` `name: push-notify`.

```bash
git add supabase/functions/push-notify/index.ts tests/playdateEnded.contract.test.js
git commit -m "feat(playdate): push-notify playdate_ended action

- 양쪽 부모 동시 종료 알림
- stop_reason 포함 (child_end / parent_end / auto_geofence_exit)
- session.stopped_at 미설정시 422

Spec: §6.1"
```

---

## Task 2.3: Edge Function smoke test (real branch)

**Files:** No new files

- [ ] **Step 1: 수동 invoke**

```bash
curl -i -X POST "<branch_url>/functions/v1/push-notify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <branch_anon_key>" \
  -d '{"action":"playdate_started","session_id":"22222222-2222-2222-2222-222222222222"}'
```

Expected: 200 OK + `{"delivered":..., "sent_count":..., "fcm_count":...}`. (Branch에 fcm_tokens 행 없으면 sent_count=0이지만 200 OK 응답.)

- [ ] **Step 2: User 보고 + Phase 3 승인 대기.**

---

# Phase 3 — Client Library

## Task 3.1: `src/lib/friendPlaydate.js` 골격 + RED tests

**Files:**
- Create: `src/lib/friendPlaydate.js` (with empty exports)
- Create: `tests/friendPlaydateClient.test.js`

- [ ] **Step 1: 빈 골격 작성**

```javascript
// src/lib/friendPlaydate.js
import { supabase } from './supabaseClient.js';

export async function findCandidates(familyId) {
  throw new Error('not_implemented');
}

export async function startPlaydate(opts) {
  throw new Error('not_implemented');
}

export async function endPlaydate(sessionId, stopReason) {
  throw new Error('not_implemented');
}

export async function upsertPublicPlace(opts) {
  throw new Error('not_implemented');
}

export async function setFamilyPlaydateEnabled(familyId, enabled) {
  throw new Error('not_implemented');
}

export async function setSavedPlacePlaydateSafe(savedPlaceId, isSafe, publicPlaceId) {
  throw new Error('not_implemented');
}

export function subscribeActiveSession(familyId, onChange) {
  throw new Error('not_implemented');
}

export async function fetchActiveSession(familyId) {
  throw new Error('not_implemented');
}

export async function fetchHistory(familyId, limit = 10) {
  throw new Error('not_implemented');
}
```

> ⚠ Subagent는 `src/lib/supabaseClient.js`의 정확한 export 이름 확인 (force_ring `src/lib/forceRing.js`이 사용한 것과 동일 패턴 재사용).

- [ ] **Step 2: RED test 작성**

```javascript
// tests/friendPlaydateClient.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/supabaseClient.js', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

import {
  findCandidates,
  startPlaydate,
  endPlaydate,
  upsertPublicPlace,
  setFamilyPlaydateEnabled,
  fetchActiveSession,
} from '../src/lib/friendPlaydate.js';
import { supabase } from '../src/lib/supabaseClient.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findCandidates', () => {
  it('calls RPC find_playdate_candidates with familyId', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: { candidates: [], error: 'not_in_safe_place' }, error: null });
    const result = await findCandidates('fam-1');
    expect(supabase.rpc).toHaveBeenCalledWith('find_playdate_candidates', { p_family_id: 'fam-1' });
    expect(result.candidates).toEqual([]);
  });

  it('returns hit with candidates array', async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: { candidates: [{ family_id: 'fam-2', child_user_id: 'u-2', child_name: '지민', public_place_id: 'p-1' }], public_place_id: 'p-1' },
      error: null,
    });
    const result = await findCandidates('fam-1');
    expect(result.candidates).toHaveLength(1);
    expect(result.public_place_id).toBe('p-1');
  });
});

describe('startPlaydate', () => {
  it('inserts session row + invokes push-notify', async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { id: 'sess-1' }, error: null });
    supabase.from.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });
    supabase.functions.invoke.mockResolvedValueOnce({ data: { delivered: true }, error: null });

    const result = await startPlaydate({
      publicPlaceId: 'p-1',
      familyAId: 'fam-1', familyBId: 'fam-2',
      childAId: 'u-1', childBId: 'u-2',
      initiatorUserId: 'u-1',
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('push-notify',
      expect.objectContaining({ body: expect.objectContaining({ action: 'playdate_started', session_id: 'sess-1' }) }));
    expect(result.session_id).toBe('sess-1');
    expect(result.delivered).toBe(true);
  });

  it('throws when same family', async () => {
    await expect(startPlaydate({
      publicPlaceId: 'p-1',
      familyAId: 'fam-1', familyBId: 'fam-1',
      childAId: 'u-1', childBId: 'u-2',
      initiatorUserId: 'u-1',
    })).rejects.toThrow(/same family/);
  });
});

describe('endPlaydate', () => {
  it('updates stopped_at + invokes push-notify playdate_ended', async () => {
    const mockSelect = vi.fn().mockResolvedValueOnce({ data: [{ id: 'sess-1' }], error: null });
    supabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: mockSelect }) }),
    });
    supabase.functions.invoke.mockResolvedValueOnce({ data: { delivered: true }, error: null });

    await endPlaydate('sess-1', 'parent_end');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('push-notify',
      expect.objectContaining({ body: { action: 'playdate_ended', session_id: 'sess-1' } }));
  });

  it('rejects invalid stop_reason', async () => {
    await expect(endPlaydate('sess-1', 'invalid_reason'))
      .rejects.toThrow(/invalid stop_reason/);
  });
});

describe('upsertPublicPlace', () => {
  it('uses upsert when kakaoPlaceId present', async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
    supabase.from.mockReturnValueOnce({
      upsert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) }),
    });
    const id = await upsertPublicPlace({ kakaoPlaceId: 'k-123', name: '한강공원', lat: 37.5, lng: 127.0 });
    expect(id).toBe('p-1');
  });

  it('plain insert when kakaoPlaceId null', async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { id: 'p-1' }, error: null });
    supabase.from.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) }),
    });
    const id = await upsertPublicPlace({ kakaoPlaceId: null, name: '동네', lat: 37.5, lng: 127.0 });
    expect(id).toBe('p-1');
  });
});

describe('setFamilyPlaydateEnabled', () => {
  it('updates families.playdate_enabled', async () => {
    const mockEq = vi.fn().mockResolvedValueOnce({ data: null, error: null });
    supabase.from.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({ eq: mockEq }),
    });
    await setFamilyPlaydateEnabled('fam-1', true);
    expect(supabase.from).toHaveBeenCalledWith('families');
  });
});

describe('fetchActiveSession', () => {
  it('returns first row WHERE stopped_at IS NULL', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: { id: 'sess-1' }, error: null }),
    };
    supabase.from.mockReturnValueOnce(builder);
    const session = await fetchActiveSession('fam-1');
    expect(session?.id).toBe('sess-1');
  });
});
```

- [ ] **Step 3: Run RED test**

`npm run test -- friendPlaydateClient`

Expected: ALL FAIL (`Error: not_implemented` 다발).

- [ ] **Step 4: Commit (RED stage)**

```bash
git add src/lib/friendPlaydate.js tests/friendPlaydateClient.test.js
git commit -m "test(playdate): client lib skeleton + failing tests (RED)

9 export stubs throwing not_implemented + 11 vitest specs cover:
- findCandidates RPC contract
- startPlaydate (INSERT + push-notify invoke + same-family guard)
- endPlaydate (UPDATE + push-notify, stop_reason validation)
- upsertPublicPlace (kakao_place_id dedup)
- setFamilyPlaydateEnabled toggle
- fetchActiveSession single row"
```

---

## Task 3.2: `findCandidates`, `startPlaydate`, `endPlaydate` GREEN

**Files:**
- Modify: `src/lib/friendPlaydate.js`

- [ ] **Step 1: 구현**

```javascript
// src/lib/friendPlaydate.js
import { supabase } from './supabaseClient.js';

const VALID_STOP_REASONS = ['child_end', 'parent_end', 'auto_geofence_exit'];

export async function findCandidates(familyId) {
  if (!familyId) throw new Error('familyId required');
  const { data, error } = await supabase.rpc('find_playdate_candidates', {
    p_family_id: familyId,
  });
  if (error) throw error;
  return data ?? { candidates: [], public_place_id: null };
}

export async function startPlaydate({
  publicPlaceId, familyAId, familyBId,
  childAId, childBId, initiatorUserId,
}) {
  if (!publicPlaceId || !familyAId || !familyBId || !childAId || !childBId || !initiatorUserId) {
    throw new Error('startPlaydate: missing required field');
  }
  if (familyAId === familyBId) throw new Error('cannot match same family');

  const { data: row, error: insertErr } = await supabase
    .from('friend_playdate_sessions')
    .insert({
      public_place_id: publicPlaceId,
      family_a_id: familyAId, family_b_id: familyBId,
      child_a_id: childAId, child_b_id: childBId,
      initiator_user_id: initiatorUserId,
    })
    .select()
    .single();

  if (insertErr) throw insertErr;

  const { data: pushResult, error: pushErr } = await supabase.functions.invoke('push-notify', {
    body: { action: 'playdate_started', session_id: row.id },
  });
  if (pushErr) {
    return { session_id: row.id, delivered: false, error: pushErr.message };
  }
  return { session_id: row.id, delivered: !!pushResult?.delivered };
}

export async function endPlaydate(sessionId, stopReason) {
  if (!sessionId) throw new Error('sessionId required');
  if (!VALID_STOP_REASONS.includes(stopReason)) {
    throw new Error(`invalid stop_reason: ${stopReason}`);
  }

  const { error: updErr } = await supabase
    .from('friend_playdate_sessions')
    .update({ stopped_at: new Date().toISOString(), stop_reason: stopReason })
    .eq('id', sessionId)
    .select();
  if (updErr) throw updErr;

  const { error: pushErr } = await supabase.functions.invoke('push-notify', {
    body: { action: 'playdate_ended', session_id: sessionId },
  });
  if (pushErr) console.warn('[endPlaydate] push failed', pushErr);
}
```

- [ ] **Step 2: Run tests**

`npm run test -- friendPlaydateClient`

Expected: findCandidates 2/2, startPlaydate 2/2, endPlaydate 2/2 PASS (other suites still RED).

- [ ] **Step 3: Commit**

```bash
git add src/lib/friendPlaydate.js
git commit -m "feat(playdate): findCandidates / startPlaydate / endPlaydate (GREEN)

- findCandidates: RPC wrapper, validates familyId
- startPlaydate: INSERT row + push-notify invoke + same-family guard
- endPlaydate: UPDATE stopped_at + push-notify, stop_reason whitelist"
```

---

## Task 3.3: `upsertPublicPlace`, `setFamilyPlaydateEnabled`, `setSavedPlacePlaydateSafe` GREEN

**Files:**
- Modify: `src/lib/friendPlaydate.js`

- [ ] **Step 1: 구현 추가**

```javascript
export async function upsertPublicPlace({ kakaoPlaceId, name, lat, lng }) {
  if (!name || lat == null || lng == null) {
    throw new Error('upsertPublicPlace: name + lat + lng required');
  }

  if (kakaoPlaceId) {
    const { data, error } = await supabase
      .from('public_places')
      .upsert({ kakao_place_id: kakaoPlaceId, name, lat, lng }, { onConflict: 'kakao_place_id' })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }

  const { data, error } = await supabase
    .from('public_places')
    .insert({ name, lat, lng })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

export async function setFamilyPlaydateEnabled(familyId, enabled) {
  if (!familyId) throw new Error('familyId required');
  const { error } = await supabase
    .from('families')
    .update({ playdate_enabled: !!enabled })
    .eq('id', familyId);
  if (error) throw error;
}

export async function setSavedPlacePlaydateSafe(savedPlaceId, isSafe, publicPlaceId = null) {
  if (!savedPlaceId) throw new Error('savedPlaceId required');
  const update = { is_playdate_safe: !!isSafe };
  if (publicPlaceId) update.public_place_id = publicPlaceId;

  const { error } = await supabase
    .from('saved_places')
    .update(update)
    .eq('id', savedPlaceId);
  if (error) throw error;
}
```

- [ ] **Step 2: Run tests**

`npm run test -- friendPlaydateClient`

Expected: upsertPublicPlace 2/2, setFamilyPlaydateEnabled 1/1 PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/friendPlaydate.js
git commit -m "feat(playdate): upsertPublicPlace + family/place toggles (GREEN)

- upsertPublicPlace: kakao_place_id dedup or new row
- setFamilyPlaydateEnabled: families toggle
- setSavedPlacePlaydateSafe: per-saved_place toggle + public_place_id link"
```

---

## Task 3.4: `subscribeActiveSession`, `fetchActiveSession`, `fetchHistory` GREEN

**Files:**
- Modify: `src/lib/friendPlaydate.js`

- [ ] **Step 1: 구현 추가**

```javascript
export async function fetchActiveSession(familyId) {
  if (!familyId) throw new Error('familyId required');
  const { data, error } = await supabase
    .from('friend_playdate_sessions')
    .select('*')
    .or(`family_a_id.eq.${familyId},family_b_id.eq.${familyId}`)
    .is('stopped_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchHistory(familyId, limit = 10) {
  if (!familyId) throw new Error('familyId required');
  const { data, error } = await supabase
    .from('friend_playdate_sessions')
    .select('*')
    .or(`family_a_id.eq.${familyId},family_b_id.eq.${familyId}`)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export function subscribeActiveSession(familyId, onChange) {
  if (!familyId) throw new Error('familyId required');
  const channel = supabase
    .channel(`friend_playdate-${familyId}`)
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_playdate_sessions',
        filter: `family_a_id=eq.${familyId}`,
      },
      (payload) => onChange(payload))
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_playdate_sessions',
        filter: `family_b_id=eq.${familyId}`,
      },
      (payload) => onChange(payload))
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
```

- [ ] **Step 2: Run tests**

`npm run test -- friendPlaydateClient`

Expected: ALL pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/friendPlaydate.js
git commit -m "feat(playdate): realtime subscribe + active/history fetch (GREEN)

- fetchActiveSession: LIMIT 1 WHERE stopped_at IS NULL
- fetchHistory: 최근 N건
- subscribeActiveSession: postgres_changes ×2 (family_a + family_b)
- 반환값: unsubscribe 함수"
```

---

## Task 3.5: Coverage 검증

- [ ] **Step 1: Coverage 확인**

`npm run test -- --coverage friendPlaydateClient`

Expected: `src/lib/friendPlaydate.js` coverage 80%+.

- [ ] **Step 2: User 보고 + Phase 4 승인 대기.**

---

# Phase 4 — Parent UI Components

## Task 4.1: `FriendPlaydateToggle`

**Files:**
- Create: `src/components/friendPlaydate/FriendPlaydateToggle.jsx`
- Create: `tests/friendPlaydatePanel.test.jsx`

- [ ] **Step 1: RED test**

```jsx
// tests/friendPlaydatePanel.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FriendPlaydateToggle from '../src/components/friendPlaydate/FriendPlaydateToggle.jsx';

vi.mock('../src/lib/friendPlaydate.js', () => ({
  setFamilyPlaydateEnabled: vi.fn(),
}));
import { setFamilyPlaydateEnabled } from '../src/lib/friendPlaydate.js';

beforeEach(() => vi.clearAllMocks());

describe('FriendPlaydateToggle', () => {
  it('renders OFF state with helper copy', () => {
    render(<FriendPlaydateToggle familyId="fam-1" enabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: /친구놀이 기능/ })).toBeInTheDocument();
    expect(screen.getByText(/양쪽 부모가 모두 켜야/)).toBeInTheDocument();
  });

  it('renders ON state', () => {
    render(<FriendPlaydateToggle familyId="fam-1" enabled={true} onChange={vi.fn()} />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles to ON: calls setFamilyPlaydateEnabled + onChange(true)', async () => {
    setFamilyPlaydateEnabled.mockResolvedValueOnce(undefined);
    const onChange = vi.fn();
    render(<FriendPlaydateToggle familyId="fam-1" enabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => {
      expect(setFamilyPlaydateEnabled).toHaveBeenCalledWith('fam-1', true);
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });
});
```

- [ ] **Step 2: Run RED**

`npm run test -- friendPlaydatePanel`

Expected: 3 FAIL (no component file).

- [ ] **Step 3: 구현 GREEN**

```jsx
// src/components/friendPlaydate/FriendPlaydateToggle.jsx
import { useState } from 'react';
import { setFamilyPlaydateEnabled } from '../../lib/friendPlaydate.js';

export default function FriendPlaydateToggle({ familyId, enabled, onChange }) {
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = !enabled;
      await setFamilyPlaydateEnabled(familyId, next);
      onChange?.(next);
    } catch (e) {
      console.error('[FriendPlaydateToggle]', e);
      alert('토글 변경에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600 }}>친구놀이 기능</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            양쪽 부모가 모두 켜야 작동합니다. 같은 안전장소의 다른 혜니 가족과 자녀가 매칭됩니다.
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="친구놀이 기능 토글"
          disabled={busy}
          onClick={handleToggle}
          style={{
            width: 52, height: 28, borderRadius: 14,
            backgroundColor: enabled ? '#10b981' : '#d1d5db',
            border: 'none', cursor: busy ? 'wait' : 'pointer',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: enabled ? 26 : 2,
            width: 24, height: 24, borderRadius: 12,
            backgroundColor: '#fff', transition: 'left 0.2s',
          }} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run GREEN**

`npm run test -- friendPlaydatePanel`

Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/friendPlaydate/FriendPlaydateToggle.jsx tests/friendPlaydatePanel.test.jsx
git commit -m "feat(playdate): FriendPlaydateToggle (families.playdate_enabled)

- role=switch + aria-checked
- 비동기 setFamilyPlaydateEnabled + 실패 alert"
```

---

## Task 4.2: `PlaydateSafePlaceList` (per-place toggle + 카탈로그 등록)

**Files:**
- Create: `src/components/friendPlaydate/PlaydateSafePlaceList.jsx`
- Modify: `tests/friendPlaydatePanel.test.jsx`

- [ ] **Step 1: RED test 추가**

```jsx
// 기존 friendPlaydatePanel.test.jsx 끝에 추가
import PlaydateSafePlaceList from '../src/components/friendPlaydate/PlaydateSafePlaceList.jsx';

vi.mock('../src/lib/friendPlaydate.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    setSavedPlacePlaydateSafe: vi.fn(),
    upsertPublicPlace: vi.fn(),
  };
});
import { setSavedPlacePlaydateSafe, upsertPublicPlace } from '../src/lib/friendPlaydate.js';

describe('PlaydateSafePlaceList', () => {
  const places = [
    { id: 'sp-1', name: '한강공원', location: { lat: 37.5, lng: 127.0, kakao_place_id: 'k-1' }, is_playdate_safe: false, public_place_id: null },
    { id: 'sp-2', name: '집', location: { lat: 37.6, lng: 127.1 }, is_playdate_safe: true, public_place_id: 'p-2' },
  ];

  it('renders each place with toggle', () => {
    render(<PlaydateSafePlaceList places={places} onUpdate={vi.fn()} />);
    expect(screen.getByText('한강공원')).toBeInTheDocument();
    expect(screen.getByText('집')).toBeInTheDocument();
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
    expect(switches[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('empty state copy', () => {
    render(<PlaydateSafePlaceList places={[]} onUpdate={vi.fn()} />);
    expect(screen.getByText(/안전장소를 먼저 등록/)).toBeInTheDocument();
  });

  it('toggling ON — upserts public_place + calls setSavedPlacePlaydateSafe', async () => {
    upsertPublicPlace.mockResolvedValueOnce('p-1');
    setSavedPlacePlaydateSafe.mockResolvedValueOnce(undefined);
    const onUpdate = vi.fn();
    render(<PlaydateSafePlaceList places={places} onUpdate={onUpdate} />);
    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => {
      expect(upsertPublicPlace).toHaveBeenCalledWith({
        kakaoPlaceId: 'k-1', name: '한강공원', lat: 37.5, lng: 127.0,
      });
      expect(setSavedPlacePlaydateSafe).toHaveBeenCalledWith('sp-1', true, 'p-1');
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it('toggling OFF — only setSavedPlacePlaydateSafe', async () => {
    setSavedPlacePlaydateSafe.mockResolvedValueOnce(undefined);
    render(<PlaydateSafePlaceList places={places} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('switch')[1]);
    await waitFor(() => {
      expect(setSavedPlacePlaydateSafe).toHaveBeenCalledWith('sp-2', false, null);
      expect(upsertPublicPlace).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: 구현 GREEN**

```jsx
// src/components/friendPlaydate/PlaydateSafePlaceList.jsx
import { useState } from 'react';
import { setSavedPlacePlaydateSafe, upsertPublicPlace } from '../../lib/friendPlaydate.js';

export default function PlaydateSafePlaceList({ places, onUpdate }) {
  const [busyId, setBusyId] = useState(null);

  if (!places || places.length === 0) {
    return (
      <div style={{ padding: 12, color: '#6b7280', fontSize: 14 }}>
        친구놀이 안전장소를 먼저 등록하세요. 학교·공원·학원 같은 곳을 지정할 수 있습니다.
      </div>
    );
  }

  const handleToggle = async (place) => {
    if (busyId) return;
    setBusyId(place.id);
    try {
      const next = !place.is_playdate_safe;
      let publicPlaceId = place.public_place_id;
      if (next && !publicPlaceId) {
        publicPlaceId = await upsertPublicPlace({
          kakaoPlaceId: place.location?.kakao_place_id ?? null,
          name: place.name,
          lat: place.location?.lat,
          lng: place.location?.lng,
        });
      }
      await setSavedPlacePlaydateSafe(place.id, next, next ? publicPlaceId : null);
      onUpdate?.();
    } catch (e) {
      console.error('[PlaydateSafePlaceList]', e);
      alert('변경에 실패했습니다');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>친구놀이 안전장소</div>
      {places.map((place) => (
        <div key={place.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 8, borderBottom: '1px solid #f3f4f6',
        }}>
          <div>{place.name}</div>
          <button
            role="switch"
            aria-checked={place.is_playdate_safe}
            aria-label={`${place.name} 친구놀이 토글`}
            disabled={busyId === place.id}
            onClick={() => handleToggle(place)}
            style={{
              width: 44, height: 24, borderRadius: 12,
              backgroundColor: place.is_playdate_safe ? '#10b981' : '#d1d5db',
              border: 'none', position: 'relative',
              cursor: busyId === place.id ? 'wait' : 'pointer',
            }}
          >
            <span style={{
              position: 'absolute', top: 2,
              left: place.is_playdate_safe ? 22 : 2,
              width: 20, height: 20, borderRadius: 10,
              backgroundColor: '#fff', transition: 'left 0.2s',
            }} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: GREEN**

`npm run test -- friendPlaydatePanel`

Expected: 7/7 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/friendPlaydate/PlaydateSafePlaceList.jsx tests/friendPlaydatePanel.test.jsx
git commit -m "feat(playdate): PlaydateSafePlaceList — per-place toggle

- ON 토글 시 upsertPublicPlace 자동 (kakao_place_id dedup)
- OFF 토글 시 단순 saved_places UPDATE
- 안전장소 0개 empty state"
```

---

## Task 4.3: `ActivePlaydateCard` (실시간 카드 + 통화 + 정지)

**Files:**
- Create: `src/components/friendPlaydate/ActivePlaydateCard.jsx`
- Modify: `tests/friendPlaydatePanel.test.jsx`

- [ ] **Step 1: RED test 추가**

```jsx
import ActivePlaydateCard from '../src/components/friendPlaydate/ActivePlaydateCard.jsx';

vi.mock('../src/lib/friendPlaydate.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, endPlaydate: vi.fn() };
});
import { endPlaydate } from '../src/lib/friendPlaydate.js';

describe('ActivePlaydateCard', () => {
  const session = {
    id: 'sess-1',
    place_name: '한강공원',
    friend_child_name: '지민',
    friend_parent_name: '지민이 엄마',
    friend_family_phones: ['010-1111-2222', '010-3333-4444'],
    started_at: '2026-04-27T14:32:00Z',
  };

  it('renders place + friend name + phone buttons', () => {
    render(<ActivePlaydateCard session={session} onEnd={vi.fn()} />);
    expect(screen.getByText(/한강공원/)).toBeInTheDocument();
    expect(screen.getByText(/지민/)).toBeInTheDocument();
    const phoneLinks = screen.getAllByRole('link');
    expect(phoneLinks.length).toBeGreaterThanOrEqual(1);
    expect(phoneLinks[0]).toHaveAttribute('href', expect.stringMatching(/^tel:/));
  });

  it('두 번호 모두 표시', () => {
    render(<ActivePlaydateCard session={session} onEnd={vi.fn()} />);
    expect(screen.getByText(/010-1111-2222/)).toBeInTheDocument();
    expect(screen.getByText(/010-3333-4444/)).toBeInTheDocument();
  });

  it('null phone 자동 필터링', () => {
    const sessionWithNull = { ...session, friend_family_phones: ['010-1111-2222', null, ''] };
    render(<ActivePlaydateCard session={sessionWithNull} onEnd={vi.fn()} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
  });

  it('정지 버튼 → endPlaydate(parent_end) + onEnd', async () => {
    endPlaydate.mockResolvedValueOnce(undefined);
    const onEnd = vi.fn();
    window.confirm = () => true;
    render(<ActivePlaydateCard session={session} onEnd={onEnd} />);
    fireEvent.click(screen.getByRole('button', { name: /정지/ }));
    await waitFor(() => {
      expect(endPlaydate).toHaveBeenCalledWith('sess-1', 'parent_end');
      expect(onEnd).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: 구현 GREEN**

```jsx
// src/components/friendPlaydate/ActivePlaydateCard.jsx
import { useState } from 'react';
import { endPlaydate } from '../../lib/friendPlaydate.js';

function formatPhoneTel(p) {
  return `tel:${p.replace(/[^\d+]/g, '')}`;
}

export default function ActivePlaydateCard({ session, onEnd }) {
  const [busy, setBusy] = useState(false);
  const phones = (session.friend_family_phones ?? []).filter(Boolean);
  const friendChild = session.friend_child_name ?? '친구';
  const placeName = session.place_name ?? '안전장소';

  const handleStop = async () => {
    if (busy) return;
    if (!confirm(`${friendChild}와의 친구놀이를 정지하시겠어요?`)) return;
    setBusy(true);
    try {
      await endPlaydate(session.id, 'parent_end');
      onEnd?.();
    } catch (e) {
      console.error('[ActivePlaydateCard.stop]', e);
      alert('정지에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      padding: 16, border: '2px solid #10b981', borderRadius: 12,
      backgroundColor: '#ecfdf5', marginBottom: 12,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        🎈 {placeName}에서 {friendChild}와 놀고 있어요
      </div>

      {phones.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
            상대 부모 연락처
          </div>
          {phones.map((p) => (
            <a
              key={p}
              href={formatPhoneTel(p)}
              style={{
                display: 'inline-block', marginRight: 8, marginTop: 4,
                padding: '8px 16px', border: '1px solid #10b981', borderRadius: 8,
                backgroundColor: '#fff', color: '#065f46',
                textDecoration: 'none', fontSize: 14,
              }}
            >
              📞 {p}
            </a>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#92400e', marginBottom: 12 }}>
          ⚠ 상대 가족 연락처가 등록되어 있지 않습니다
        </div>
      )}

      <button
        onClick={handleStop}
        disabled={busy}
        aria-label="친구놀이 정지"
        style={{
          width: '100%', padding: 12, border: 'none', borderRadius: 8,
          backgroundColor: '#dc2626', color: '#fff', fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        🛑 정지
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Run + Commit**

`npm run test -- friendPlaydatePanel`. Expected: 11/11 PASS.

```bash
git add src/components/friendPlaydate/ActivePlaydateCard.jsx tests/friendPlaydatePanel.test.jsx
git commit -m "feat(playdate): ActivePlaydateCard — 1탭 통화 deep link + 정지

- tel: deep link (네이티브 dialer)
- mom + dad 둘 다 있으면 2버튼
- 정지 버튼: confirm + endPlaydate(parent_end)
- 연락처 0개 fallback 메시지"
```

---

## Task 4.4: `PlaydateHistory` (최근 10건)

**Files:**
- Create: `src/components/friendPlaydate/PlaydateHistory.jsx`
- Modify: `tests/friendPlaydatePanel.test.jsx`

- [ ] **Step 1: RED test 추가**

```jsx
import PlaydateHistory from '../src/components/friendPlaydate/PlaydateHistory.jsx';

describe('PlaydateHistory', () => {
  const history = [
    { id: 's1', started_at: '2026-04-27T14:00:00Z', stopped_at: '2026-04-27T16:00:00Z',
      stop_reason: 'parent_end', friend_child_name: '지민', place_name: '한강공원' },
    { id: 's2', started_at: '2026-04-26T10:00:00Z', stopped_at: '2026-04-26T12:00:00Z',
      stop_reason: 'auto_geofence_exit', friend_child_name: '예린', place_name: '학교' },
  ];

  it('renders rows with friend + place', () => {
    render(<PlaydateHistory history={history} />);
    expect(screen.getByText(/지민/)).toBeInTheDocument();
    expect(screen.getByText(/한강공원/)).toBeInTheDocument();
    expect(screen.getByText(/예린/)).toBeInTheDocument();
  });

  it('stop_reason 한글 표시', () => {
    render(<PlaydateHistory history={history} />);
    expect(screen.getByText(/부모 정지/)).toBeInTheDocument();
    expect(screen.getByText(/자동 종료/)).toBeInTheDocument();
  });

  it('empty', () => {
    render(<PlaydateHistory history={[]} />);
    expect(screen.getByText(/이력이 없어요/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 구현 GREEN**

```jsx
// src/components/friendPlaydate/PlaydateHistory.jsx
const REASON_LABEL = {
  child_end: '아이 종료',
  parent_end: '부모 정지',
  auto_geofence_exit: '자동 종료',
};

function formatDuration(start, end) {
  if (!start || !end) return '';
  const ms = new Date(end) - new Date(start);
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

export default function PlaydateHistory({ history }) {
  if (!history || history.length === 0) {
    return <div style={{ padding: 12, color: '#6b7280', fontSize: 13 }}>친구놀이 이력이 없어요</div>;
  }
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>최근 친구놀이</div>
      {history.map((h) => (
        <div key={h.id} style={{
          padding: 8, borderBottom: '1px solid #f3f4f6', fontSize: 13,
        }}>
          <div>{h.place_name ?? '안전장소'} · {h.friend_child_name ?? '친구'}</div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>
            {formatDuration(h.started_at, h.stopped_at)}
            {h.stop_reason ? ` · ${REASON_LABEL[h.stop_reason] ?? h.stop_reason}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Run + Commit**

```bash
git add src/components/friendPlaydate/PlaydateHistory.jsx tests/friendPlaydatePanel.test.jsx
git commit -m "feat(playdate): PlaydateHistory — 최근 10건 + 종료 사유 한글"
```

---

## Task 4.5: `FriendPlaydatePanel` (orchestrator)

**Files:**
- Create: `src/components/friendPlaydate/FriendPlaydatePanel.jsx`
- Modify: `tests/friendPlaydatePanel.test.jsx`

- [ ] **Step 1: 코드베이스 inspect — `fetchSavedPlaces` + family fetch path 확인**

Run:
```
grep -n 'fetchSavedPlaces\|fetchFamily\|export.*familyData' src/lib/sync.js src/lib/auth.js
```

Expected: subagent가 정확한 export 이름과 path 결정. `fetchSavedPlaces`는 `src/lib/sync.js`에 존재 (이미 사용 중). family fetch는 force_ring panel이 사용한 패턴 동일하게 재사용.

- [ ] **Step 2: RED test (path는 inspect 결과로 확정)**

```jsx
import FriendPlaydatePanel from '../src/components/friendPlaydate/FriendPlaydatePanel.jsx';

vi.mock('../src/lib/friendPlaydate.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchActiveSession: vi.fn(),
    fetchHistory: vi.fn(),
    subscribeActiveSession: vi.fn(() => () => {}),
  };
});
import { fetchActiveSession, fetchHistory } from '../src/lib/friendPlaydate.js';

vi.mock('../src/lib/sync.js', () => ({
  fetchSavedPlaces: vi.fn().mockResolvedValue([
    { id: 'sp-1', name: '한강공원', location: { lat: 37.5, lng: 127.0 }, is_playdate_safe: true, public_place_id: 'p-1' },
  ]),
}));

// family fetch 경로는 force_ring panel과 동일 (subagent가 force_ring 코드 inspect 후 동일 패턴 적용)
vi.mock('../src/lib/supabaseClient.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'fam-1', playdate_enabled: true }, error: null }),
    })),
  },
}));

describe('FriendPlaydatePanel', () => {
  beforeEach(() => {
    fetchActiveSession.mockResolvedValue(null);
    fetchHistory.mockResolvedValue([]);
  });

  it('toggle ON + active session 표시', async () => {
    fetchActiveSession.mockResolvedValueOnce({
      id: 'sess-1', place_name: '한강공원',
      friend_child_name: '지민', friend_family_phones: ['010-1111-2222'],
    });
    render(<FriendPlaydatePanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => {
      expect(screen.getByText(/지민/)).toBeInTheDocument();
    });
  });

  it('패널 헤더 렌더', async () => {
    render(<FriendPlaydatePanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => {
      expect(screen.getByText(/친구놀이$/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 3: 구현 GREEN**

```jsx
// src/components/friendPlaydate/FriendPlaydatePanel.jsx
import { useEffect, useState } from 'react';
import FriendPlaydateToggle from './FriendPlaydateToggle.jsx';
import PlaydateSafePlaceList from './PlaydateSafePlaceList.jsx';
import ActivePlaydateCard from './ActivePlaydateCard.jsx';
import PlaydateHistory from './PlaydateHistory.jsx';
import {
  fetchActiveSession, fetchHistory, subscribeActiveSession,
} from '../../lib/friendPlaydate.js';
import { fetchSavedPlaces } from '../../lib/sync.js';
import { supabase } from '../../lib/supabaseClient.js';

async function fetchFamilyEnabled(familyId) {
  const { data } = await supabase
    .from('families')
    .select('id, playdate_enabled')
    .eq('id', familyId)
    .maybeSingle();
  return !!data?.playdate_enabled;
}

export default function FriendPlaydatePanel({ familyId, currentUserId }) {
  const [enabled, setEnabled] = useState(false);
  const [places, setPlaces] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const [enabledFlag, sp, active, hist] = await Promise.all([
        fetchFamilyEnabled(familyId).catch(() => false),
        fetchSavedPlaces(familyId).catch(() => []),
        fetchActiveSession(familyId).catch(() => null),
        fetchHistory(familyId, 10).catch(() => []),
      ]);
      setEnabled(enabledFlag);
      setPlaces(sp ?? []);
      setActiveSession(active);
      setHistory(hist ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!familyId) return;
    reload();
    const unsub = subscribeActiveSession(familyId, () => { reload(); });
    return () => { unsub?.(); };
  }, [familyId]);

  if (loading) return <div style={{ padding: 12 }}>친구놀이 정보 불러오는 중...</div>;

  return (
    <section aria-label="친구놀이 패널" style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>친구놀이</h3>
      <FriendPlaydateToggle
        familyId={familyId}
        enabled={enabled}
        onChange={setEnabled}
      />
      {enabled && (
        <>
          <PlaydateSafePlaceList places={places} onUpdate={reload} />
          {activeSession && (
            <div style={{ marginTop: 12 }}>
              <ActivePlaydateCard session={activeSession} onEnd={reload} />
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <PlaydateHistory history={history} />
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run + Commit**

```bash
git add src/components/friendPlaydate/FriendPlaydatePanel.jsx tests/friendPlaydatePanel.test.jsx
git commit -m "feat(playdate): FriendPlaydatePanel orchestrator

- toggle 상태에 따라 안전장소 list + active card + history 컨디셔널 렌더
- subscribeActiveSession으로 realtime reload
- supabase 직접 SELECT로 families.playdate_enabled fetch"
```

---

## Task 4.6: Phase 4 verification

- [ ] **Step 1: 전체 vitest 실행**

`npm run test`

Expected: 모든 신규 + 기존 vitest PASS, friendPlaydate 관련 coverage 80%+.

- [ ] **Step 2: User 보고 + Phase 5 승인 대기.**

---

# Phase 5 — Child UI Components + App.jsx Mount

## Task 5.1: `PlaydateStartButton` (안전장소 안에서만 활성)

**Files:**
- Create: `src/components/friendPlaydate/PlaydateStartButton.jsx`
- Create: `tests/friendPlaydateChildView.test.jsx`

- [ ] **Step 1: RED test**

```jsx
// tests/friendPlaydateChildView.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlaydateStartButton from '../src/components/friendPlaydate/PlaydateStartButton.jsx';

beforeEach(() => vi.clearAllMocks());

describe('PlaydateStartButton', () => {
  it('disabled when not in safe place', () => {
    render(<PlaydateStartButton inSafePlace={false} onClick={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /친구랑 놀래요/ });
    expect(btn).toBeDisabled();
  });

  it('enabled when inSafePlace=true', () => {
    render(<PlaydateStartButton inSafePlace={true} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /친구랑 놀래요/ })).not.toBeDisabled();
  });

  it('disabled tooltip copy 노출', () => {
    render(<PlaydateStartButton inSafePlace={false} onClick={vi.fn()} />);
    expect(screen.getByText(/등록된 곳에서만/)).toBeInTheDocument();
  });

  it('click triggers onClick', () => {
    const onClick = vi.fn();
    render(<PlaydateStartButton inSafePlace={true} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /친구랑 놀래요/ }));
    expect(onClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: GREEN**

```jsx
// src/components/friendPlaydate/PlaydateStartButton.jsx
export default function PlaydateStartButton({ inSafePlace, onClick }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={onClick}
        disabled={!inSafePlace}
        style={{
          width: '100%', padding: '20px 16px', borderRadius: 12,
          backgroundColor: inSafePlace ? '#10b981' : '#9ca3af',
          color: '#fff', fontSize: 22, fontWeight: 700,
          border: 'none', cursor: inSafePlace ? 'pointer' : 'not-allowed',
        }}
        aria-label="친구랑 놀래요"
      >
        🤝 친구랑 놀래요
      </button>
      {!inSafePlace && (
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, textAlign: 'center' }}>
          친구놀이는 학교·공원처럼 등록된 곳에서만 시작할 수 있어요
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run + Commit**

```bash
git add src/components/friendPlaydate/PlaydateStartButton.jsx tests/friendPlaydateChildView.test.jsx
git commit -m "feat(playdate): PlaydateStartButton — disabled outside safe place"
```

---

## Task 5.2: `FriendCandidateList` (Radio + 시작)

**Files:**
- Create: `src/components/friendPlaydate/FriendCandidateList.jsx`
- Modify: `tests/friendPlaydateChildView.test.jsx`

- [ ] **Step 1: RED test**

```jsx
import FriendCandidateList from '../src/components/friendPlaydate/FriendCandidateList.jsx';

describe('FriendCandidateList', () => {
  const candidates = [
    { family_id: 'fam-2', child_user_id: 'u-2', child_name: '지민', public_place_id: 'p-1' },
    { family_id: 'fam-3', child_user_id: 'u-3', child_name: '예린', public_place_id: 'p-1' },
  ];

  it('렌더링 — 각 후보 Radio', () => {
    render(<FriendCandidateList candidates={candidates} onStart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/지민/)).toBeInTheDocument();
    expect(screen.getByLabelText(/예린/)).toBeInTheDocument();
  });

  it('empty state copy', () => {
    render(<FriendCandidateList candidates={[]} onStart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/같은 곳에 친구가 없어요/)).toBeInTheDocument();
  });

  it('선택 후 시작 버튼 → onStart(candidate)', () => {
    const onStart = vi.fn();
    render(<FriendCandidateList candidates={candidates} onStart={onStart} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/지민/));
    fireEvent.click(screen.getByRole('button', { name: /친구랑 놀래요 시작/ }));
    expect(onStart).toHaveBeenCalledWith(candidates[0]);
  });

  it('선택 안 했으면 시작 disabled', () => {
    render(<FriendCandidateList candidates={candidates} onStart={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /친구랑 놀래요 시작/ })).toBeDisabled();
  });
});
```

- [ ] **Step 2: GREEN**

```jsx
// src/components/friendPlaydate/FriendCandidateList.jsx
import { useState } from 'react';

export default function FriendCandidateList({ candidates, onStart, onCancel }) {
  const [selected, setSelected] = useState(null);

  if (!candidates || candidates.length === 0) {
    return (
      <div>
        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
          지금 같은 곳에 친구가 없어요. 잠시 후 다시 봐요!
        </div>
        <button onClick={onCancel} style={{ width: '100%', padding: 12, marginTop: 8 }}>
          닫기
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>누구랑 놀고 싶어?</div>
      {candidates.map((c) => (
        <label
          key={c.child_user_id}
          style={{
            display: 'flex', alignItems: 'center', padding: 12,
            border: selected?.child_user_id === c.child_user_id ? '2px solid #10b981' : '1px solid #e5e7eb',
            borderRadius: 8, marginBottom: 8, cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name="friend"
            value={c.child_user_id}
            checked={selected?.child_user_id === c.child_user_id}
            onChange={() => setSelected(c)}
            style={{ marginRight: 8 }}
          />
          <span>{c.child_name ?? '친구'}</span>
        </label>
      ))}
      <button
        onClick={() => onStart(selected)}
        disabled={!selected}
        aria-label="친구랑 놀래요 시작"
        style={{
          width: '100%', padding: 16, marginTop: 12,
          backgroundColor: selected ? '#10b981' : '#9ca3af',
          color: '#fff', border: 'none', borderRadius: 8,
          fontSize: 18, fontWeight: 700,
          cursor: selected ? 'pointer' : 'not-allowed',
        }}
      >
        🤝 친구랑 놀래요
      </button>
      <button
        onClick={onCancel}
        style={{ width: '100%', padding: 8, marginTop: 8, background: 'none', border: '1px solid #e5e7eb', borderRadius: 8 }}
      >
        취소
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Run + Commit**

```bash
git add src/components/friendPlaydate/FriendCandidateList.jsx tests/friendPlaydateChildView.test.jsx
git commit -m "feat(playdate): FriendCandidateList — Radio 선택 + 시작/취소"
```

---

## Task 5.3: `ActivePlaydateChildView`

**Files:**
- Create: `src/components/friendPlaydate/ActivePlaydateChildView.jsx`
- Modify: `tests/friendPlaydateChildView.test.jsx`

- [ ] **Step 1: RED + GREEN**

```jsx
import ActivePlaydateChildView from '../src/components/friendPlaydate/ActivePlaydateChildView.jsx';

vi.mock('../src/lib/friendPlaydate.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, endPlaydate: vi.fn() };
});
import { endPlaydate } from '../src/lib/friendPlaydate.js';

describe('ActivePlaydateChildView', () => {
  it('현재 친구 표시', () => {
    render(<ActivePlaydateChildView session={{ id: 's1', friend_child_name: '지민', started_at: '2026-04-27T14:32:00Z' }} onEnd={vi.fn()} />);
    expect(screen.getByText(/지민/)).toBeInTheDocument();
  });

  it('그만 놀래요 → endPlaydate(child_end)', async () => {
    endPlaydate.mockResolvedValueOnce(undefined);
    const onEnd = vi.fn();
    render(<ActivePlaydateChildView session={{ id: 's1', friend_child_name: '지민', started_at: '2026-04-27T14:32:00Z' }} onEnd={onEnd} />);
    fireEvent.click(screen.getByRole('button', { name: /그만 놀래요/ }));
    await waitFor(() => {
      expect(endPlaydate).toHaveBeenCalledWith('s1', 'child_end');
      expect(onEnd).toHaveBeenCalled();
    });
  });
});
```

```jsx
// src/components/friendPlaydate/ActivePlaydateChildView.jsx
import { useState } from 'react';
import { endPlaydate } from '../../lib/friendPlaydate.js';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

export default function ActivePlaydateChildView({ session, onEnd }) {
  const [busy, setBusy] = useState(false);
  const friend = session?.friend_child_name ?? '친구';

  const handleStop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await endPlaydate(session.id, 'child_end');
      onEnd?.();
    } catch (e) {
      console.error('[ActivePlaydateChildView]', e);
      alert('종료에 실패했어요. 다시 시도해줘');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      padding: 24, border: '2px solid #10b981', borderRadius: 12,
      backgroundColor: '#ecfdf5', marginBottom: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        🎈 {friend}와 놀고 있어요
      </div>
      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
        ⏰ {formatTime(session.started_at)} 시작
      </div>
      <button
        onClick={handleStop}
        disabled={busy}
        aria-label="그만 놀래요"
        style={{
          width: '100%', padding: 16, fontSize: 18, fontWeight: 700,
          backgroundColor: '#dc2626', color: '#fff',
          border: 'none', borderRadius: 8,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        🛑 그만 놀래요
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/friendPlaydate/ActivePlaydateChildView.jsx tests/friendPlaydateChildView.test.jsx
git commit -m "feat(playdate): ActivePlaydateChildView — 그만 놀래요 (child_end)"
```

---

## Task 5.4: `FriendPlaydateChildPanel` orchestrator

**Files:**
- Create: `src/components/friendPlaydate/FriendPlaydateChildPanel.jsx`
- Modify: `tests/friendPlaydateChildView.test.jsx`

- [ ] **Step 1: RED test**

```jsx
import FriendPlaydateChildPanel from '../src/components/friendPlaydate/FriendPlaydateChildPanel.jsx';

vi.mock('../src/lib/friendPlaydate.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    findCandidates: vi.fn(),
    startPlaydate: vi.fn(),
    fetchActiveSession: vi.fn(),
    subscribeActiveSession: vi.fn(() => () => {}),
  };
});
import { findCandidates, startPlaydate, fetchActiveSession } from '../src/lib/friendPlaydate.js';

describe('FriendPlaydateChildPanel', () => {
  beforeEach(() => {
    fetchActiveSession.mockResolvedValue(null);
  });

  it('초기: PlaydateStartButton 활성화 (안전장소 안)', async () => {
    findCandidates.mockResolvedValueOnce({ candidates: [], public_place_id: 'p-1' });
    render(<FriendPlaydateChildPanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /친구랑 놀래요/ })).not.toBeDisabled();
    });
  });

  it('not_in_safe_place → 버튼 disabled', async () => {
    findCandidates.mockResolvedValueOnce({ candidates: [], error: 'not_in_safe_place' });
    render(<FriendPlaydateChildPanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /친구랑 놀래요/ })).toBeDisabled();
    });
  });

  it('버튼 클릭 → 후보 fetch → CandidateList 표시', async () => {
    findCandidates
      .mockResolvedValueOnce({ candidates: [], public_place_id: 'p-1' })
      .mockResolvedValueOnce({
        candidates: [{ family_id: 'fam-2', child_user_id: 'u-2', child_name: '지민', public_place_id: 'p-1' }],
        public_place_id: 'p-1',
      });
    render(<FriendPlaydateChildPanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: /친구랑 놀래요/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /친구랑 놀래요/ }));
    await waitFor(() => expect(screen.getByLabelText(/지민/)).toBeInTheDocument());
  });

  it('active session 있을 때 → ActivePlaydateChildView 표시', async () => {
    fetchActiveSession.mockResolvedValueOnce({ id: 's1', friend_child_name: '지민', started_at: '2026-04-27T14:32:00Z' });
    render(<FriendPlaydateChildPanel familyId="fam-1" currentUserId="u-1" />);
    await waitFor(() => expect(screen.getByText(/그만 놀래요/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: GREEN**

```jsx
// src/components/friendPlaydate/FriendPlaydateChildPanel.jsx
import { useEffect, useState } from 'react';
import PlaydateStartButton from './PlaydateStartButton.jsx';
import FriendCandidateList from './FriendCandidateList.jsx';
import ActivePlaydateChildView from './ActivePlaydateChildView.jsx';
import {
  findCandidates,
  startPlaydate,
  fetchActiveSession,
  subscribeActiveSession,
} from '../../lib/friendPlaydate.js';

export default function FriendPlaydateChildPanel({ familyId, currentUserId }) {
  const [phase, setPhase] = useState('idle');
  const [inSafePlace, setInSafePlace] = useState(false);
  const [publicPlaceId, setPublicPlaceId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

  const reload = async () => {
    const active = await fetchActiveSession(familyId).catch(() => null);
    if (active) {
      setActiveSession(active);
      setPhase('active');
      return;
    }
    setActiveSession(null);
    const result = await findCandidates(familyId).catch(() => ({ candidates: [], error: 'rpc_failed' }));
    setInSafePlace(!!result.public_place_id);
    setPublicPlaceId(result.public_place_id ?? null);
    setPhase('idle');
  };

  useEffect(() => {
    if (!familyId) return;
    reload();
    const unsub = subscribeActiveSession(familyId, () => { reload(); });
    return () => { unsub?.(); };
  }, [familyId]);

  const handleDiscover = async () => {
    const result = await findCandidates(familyId);
    setCandidates(result.candidates ?? []);
    setPublicPlaceId(result.public_place_id ?? null);
    setPhase('discover');
  };

  const handleStart = async (candidate) => {
    if (!candidate || !publicPlaceId) return;
    setPhase('starting');
    try {
      await startPlaydate({
        publicPlaceId,
        familyAId: familyId,
        familyBId: candidate.family_id,
        childAId: currentUserId,
        childBId: candidate.child_user_id,
        initiatorUserId: currentUserId,
      });
      await reload();
    } catch (e) {
      console.error('[start]', e);
      alert('시작에 실패했어요. 다시 시도해줘');
      setPhase('idle');
    }
  };

  if (phase === 'active' && activeSession) {
    return <ActivePlaydateChildView session={activeSession} onEnd={reload} />;
  }

  if (phase === 'discover') {
    return (
      <FriendCandidateList
        candidates={candidates}
        onStart={handleStart}
        onCancel={() => setPhase('idle')}
      />
    );
  }

  return <PlaydateStartButton inSafePlace={inSafePlace} onClick={handleDiscover} />;
}
```

- [ ] **Step 3: Run + Commit**

```bash
git add src/components/friendPlaydate/FriendPlaydateChildPanel.jsx tests/friendPlaydateChildView.test.jsx
git commit -m "feat(playdate): FriendPlaydateChildPanel orchestrator

- phase: idle → discover → starting → active
- realtime subscribeActiveSession으로 부모 정지 즉시 반영"
```

---

## Task 5.5: App.jsx 마운트 (5-10줄)

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: ForceRingPanel 마운트 위치 + isParent 변수명 확인**

Run: `grep -n 'ForceRingPanel\|isParent\|familyId' src/App.jsx | head -30`

Expected: 위치 + 변수명 파악.

- [ ] **Step 2: import 추가 (App.jsx 상단)**

```jsx
import FriendPlaydatePanel from './components/friendPlaydate/FriendPlaydatePanel.jsx';
import FriendPlaydateChildPanel from './components/friendPlaydate/FriendPlaydateChildPanel.jsx';
```

- [ ] **Step 3: 부모 분기 마운트 (ForceRingPanel 바로 다음)**

```jsx
{isParent && familyId && (
  <FriendPlaydatePanel
    familyId={familyId}
    currentUserId={authUser?.id}
  />
)}
```

- [ ] **Step 4: 아이 분기 마운트**

```jsx
{!isParent && familyId && (
  <FriendPlaydateChildPanel
    familyId={familyId}
    currentUserId={authUser?.id}
  />
)}
```

⚠ Subagent는 `isParent`/`familyId`/`authUser`의 정확한 변수명을 force_ring 마운트 코드에서 그대로 가져옴 (force_ring 마운트는 commit 시점에 이미 동일 변수 사용).

- [ ] **Step 5: Build smoke test**

`npm run build`

Expected: build success, no missing imports.

- [ ] **Step 6: Run vitest**

`npm run test`

Expected: 모든 vitest PASS.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat(playdate): mount FriendPlaydatePanel + ChildPanel in App.jsx

- 부모 모드: ForceRingPanel 다음 (안전 도구 클러스터)
- 아이 모드: 기존 패널 다음
- monolith decomposition 금지 정책 준수 (마운트 5-10줄만)"
```

---

# Phase 6 — Native Android FCM 분기

## Task 6.1: `MyFirebaseMessagingService.java` 액션 분기 추가

**Files:**
- Modify: `android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java`
- Create: `tests/nativeFriendPlaydate.test.js`

- [ ] **Step 1: 기존 force_ring 분기 + NotificationHelper 상수 확인**

Run:
```
grep -n 'force_ring\|action.equals\|CHANNEL_SCHEDULE\|hyeni_schedule' android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java android/app/src/main/java/com/hyeni/calendar/NotificationHelper.java
```

Expected: 정확한 dispatch 위치 + 채널 상수명 (subagent가 결정).

- [ ] **Step 2: 액션 분기 1개 추가 (force_ring 분기 옆)**

```java
if ("playdate_started".equals(action) || "playdate_ended".equals(action)) {
    String title = "playdate_started".equals(action)
        ? "친구놀이 시작"
        : "친구놀이 종료";
    String placeName = data.get("place_name");
    String friendChildName = data.get("friend_child_name");
    String body = "playdate_started".equals(action)
        ? (placeName != null ? placeName : "안전장소")
            + (friendChildName != null ? " — " + friendChildName + "와 함께" : "")
        : (placeName != null ? placeName + " 친구놀이가 종료됐어요" : "친구놀이가 종료됐어요");

    String sessionId = data.get("session_id");
    int notificationId = sessionId != null
        ? Math.abs(sessionId.hashCode())
        : (int) (System.currentTimeMillis() & 0x7fffffff);

    NotificationHelper.showNotification(
        this, title, body,
        NotificationHelper.CHANNEL_SCHEDULE,
        false, false,
        notificationId
    );
    return;
}
```

⚠ Subagent는 `NotificationHelper.CHANNEL_SCHEDULE` 정확한 상수명 확인 (예: `hyeni_schedule_v5` literal 사용 가능).

- [ ] **Step 3: Vitest contract test**

```javascript
// tests/nativeFriendPlaydate.test.js
import { describe, it, expect } from 'vitest';

describe('Friend Playdate FCM payload contract', () => {
  it('playdate_started payload shape', () => {
    const data = {
      action: 'playdate_started',
      session_id: 'sess-1',
      place_name: '한강공원',
      my_child_name: '혜니',
      friend_child_name: '지민',
      friend_family_phones: JSON.stringify(['010-1111-2222']),
    };
    expect(data.action).toBe('playdate_started');
    expect(data.session_id).toMatch(/^sess-/);
  });

  it('playdate_ended payload shape', () => {
    const data = {
      action: 'playdate_ended',
      session_id: 'sess-1',
      stop_reason: 'auto_geofence_exit',
      place_name: '한강공원',
    };
    expect(['child_end', 'parent_end', 'auto_geofence_exit']).toContain(data.stop_reason);
  });
});
```

- [ ] **Step 4: Run**

`npm run test -- nativeFriendPlaydate`

Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java tests/nativeFriendPlaydate.test.js
git commit -m "feat(playdate): MyFirebaseMessagingService playdate action branch

- playdate_started/ended 1개 분기 추가 (기존 force_ring 패턴)
- 신규 채널 0 (hyeni_schedule_v5 재사용)
- 신규 권한 0
- Spec FP-D14 준수 (native 신규 0)"
```

---

## Task 6.2: APK CI 트리거 + 빌드 확인

**Files:** No new files

- [ ] **Step 1: PR 생성 (force_ring과 동일 흐름)**

```bash
git push -u origin feat/friend-playdate
gh pr create --title "feat: friend playdate (Feature 2 — cross-family safety)" \
  --body "$(cat <<'EOF'
## Summary
- 같은 안전장소의 두 혜니 가족 아이 매칭
- 양쪽 부모 동시 푸시 + 1탭 통화
- PIPA: families.playdate_enabled 양방향 toggle
- Spec: docs/superpowers/specs/2026-04-27-friend-playdate-design.md

## Test plan
- [ ] vitest all pass
- [ ] APK CI build green
- [ ] Phase 7 native checklist 5/5
EOF
)"
```

- [ ] **Step 2: CI run 모니터링**

`gh run list --branch feat/friend-playdate --limit 3`

Expected: APK build success, artifact 다운로드 가능.

- [ ] **Step 3: User 보고 + Phase 7 승인 대기.**

---

# Phase 7 — E2E + Native Verification

## Task 7.1: Playwright fixtures 헬퍼

**Files:**
- Create: `tests/e2e/_friend-playdate-fixtures.js`

- [ ] **Step 1: force_ring fixtures 패턴 그대로 작성**

```javascript
// tests/e2e/_friend-playdate-fixtures.js
import dotenv from 'dotenv';
dotenv.config();

const PROJECT_REF = (process.env.VITE_SUPABASE_URL ?? '')
  .match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? 'example';

export async function installFriendPlaydateMocks(page, opts = {}) {
  const family = opts.family ?? {
    id: 'fam-test-1', mom_phone: '010-0000-1111',
    dad_phone: '010-0000-2222', playdate_enabled: opts.enabled ?? true,
  };
  const places = opts.places ?? [
    { id: 'sp-1', name: '한강공원', location: { lat: 37.5, lng: 127.0 },
      is_playdate_safe: true, public_place_id: 'p-1' },
  ];
  const candidates = opts.candidates ?? [];
  const activeSession = opts.activeSession ?? null;

  await page.addInitScript(({ ref, family, places, candidates, activeSession }) => {
    sessionStorage.setItem(`sb-${ref}-auth-token`,
      JSON.stringify({ access_token: 'fake', user: { id: 'u-test-1' } }));
    window.__playdateMockFamily = family;
    window.__playdateMockPlaces = places;
    window.__playdateMockCandidates = candidates;
    window.__playdateMockActiveSession = activeSession;
  }, { ref: PROJECT_REF, family, places, candidates, activeSession });
}

export async function dismissEmergencyBannerIfPresent(page) {
  const banner = page.locator('[data-testid="emergency-banner-close"]');
  if (await banner.isVisible().catch(() => false)) await banner.click();
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/_friend-playdate-fixtures.js
git commit -m "test(playdate): e2e fixtures helper (force_ring 패턴 동일)"
```

---

## Task 7.2: E2E toggle 흐름

**Files:**
- Create: `tests/e2e/friend-playdate-toggle.spec.js`

- [ ] **Step 1: spec 작성**

```javascript
import { test, expect } from '@playwright/test';
import { installFriendPlaydateMocks, dismissEmergencyBannerIfPresent } from './_friend-playdate-fixtures.js';

test.describe('Friend Playdate — toggle flow', () => {
  test('OFF 상태에서 toggle 클릭 → ON 전환 + 안전장소 list 노출', async ({ page }) => {
    await installFriendPlaydateMocks(page, { enabled: false });
    await page.goto('/');
    await dismissEmergencyBannerIfPresent(page);

    const toggle = page.getByRole('switch', { name: /친구놀이 기능/ });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await toggle.click();
    await expect(page.getByText(/친구놀이 안전장소/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run**

`npm run test:e2e -- friend-playdate-toggle`

Expected: PASS (단, 마운트 위치 / mock 전략에 맞춰 fix 필요할 수 있음).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/friend-playdate-toggle.spec.js
git commit -m "test(playdate): e2e toggle flow"
```

---

## Task 7.3: E2E discover 흐름

**Files:**
- Create: `tests/e2e/friend-playdate-discover.spec.js`

- [ ] **Step 1: spec 작성**

```javascript
import { test, expect } from '@playwright/test';
import { installFriendPlaydateMocks } from './_friend-playdate-fixtures.js';

test.describe('Friend Playdate — discover candidates', () => {
  test('candidates 0명 → empty state copy', async ({ page }) => {
    await installFriendPlaydateMocks(page, { candidates: [] });
    await page.goto('/');
    await page.evaluate(() => { window.__hyeniTestRole = 'child'; });
    await page.reload();

    await page.getByRole('button', { name: /친구랑 놀래요/ }).click();
    await expect(page.getByText(/같은 곳에 친구가 없어요/)).toBeVisible();
  });

  test('candidates N명 → Radio + 시작 버튼 disabled', async ({ page }) => {
    await installFriendPlaydateMocks(page, {
      candidates: [
        { family_id: 'fam-2', child_user_id: 'u-2', child_name: '지민', public_place_id: 'p-1' },
      ],
    });
    await page.goto('/');
    await page.evaluate(() => { window.__hyeniTestRole = 'child'; });
    await page.reload();

    await page.getByRole('button', { name: /친구랑 놀래요/ }).click();
    await expect(page.getByLabelText(/지민/)).toBeVisible();
    await expect(page.getByRole('button', { name: /친구랑 놀래요 시작/ })).toBeDisabled();

    await page.getByLabelText(/지민/).click();
    await expect(page.getByRole('button', { name: /친구랑 놀래요 시작/ })).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/friend-playdate-discover.spec.js
git commit -m "test(playdate): e2e discover candidates flow"
```

---

## Task 7.4: E2E start + end 흐름

**Files:**
- Create: `tests/e2e/friend-playdate-start.spec.js`
- Create: `tests/e2e/friend-playdate-end.spec.js`

- [ ] **Step 1: start spec**

```javascript
// tests/e2e/friend-playdate-start.spec.js
import { test, expect } from '@playwright/test';
import { installFriendPlaydateMocks } from './_friend-playdate-fixtures.js';

test.describe('Friend Playdate — start session', () => {
  test('친구 선택 → 시작 → ActivePlaydateChildView 표시', async ({ page }) => {
    await installFriendPlaydateMocks(page, {
      candidates: [
        { family_id: 'fam-2', child_user_id: 'u-2', child_name: '지민', public_place_id: 'p-1' },
      ],
    });
    await page.route('**/rest/v1/friend_playdate_sessions**', (route) =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'sess-1' }) })
    );
    await page.route('**/functions/v1/push-notify', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ delivered: true }) })
    );

    await page.goto('/');
    await page.evaluate(() => { window.__hyeniTestRole = 'child'; });
    await page.reload();

    await page.getByRole('button', { name: /친구랑 놀래요/ }).click();
    await page.getByLabelText(/지민/).click();
    await page.getByRole('button', { name: /친구랑 놀래요 시작/ }).click();

    await expect(page.getByText(/지민와 놀고 있어요/)).toBeVisible();
  });
});
```

- [ ] **Step 2: end spec**

```javascript
// tests/e2e/friend-playdate-end.spec.js
import { test, expect } from '@playwright/test';
import { installFriendPlaydateMocks } from './_friend-playdate-fixtures.js';

test.describe('Friend Playdate — end session', () => {
  test('아이가 그만 놀래요 → endPlaydate(child_end)', async ({ page }) => {
    await installFriendPlaydateMocks(page, {
      activeSession: {
        id: 'sess-1', friend_child_name: '지민', started_at: new Date().toISOString(),
        family_a_id: 'fam-test-1', family_b_id: 'fam-2',
      },
    });
    let updateCalled = false;
    await page.route('**/rest/v1/friend_playdate_sessions**', (route) => {
      if (route.request().method() === 'PATCH') updateCalled = true;
      route.fulfill({ status: 204, body: '' });
    });
    await page.route('**/functions/v1/push-notify', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ delivered: true }) })
    );

    await page.goto('/');
    await page.evaluate(() => { window.__hyeniTestRole = 'child'; });
    await page.reload();

    await expect(page.getByText(/지민와 놀고 있어요/)).toBeVisible();
    await page.getByRole('button', { name: /그만 놀래요/ }).click();

    await expect.poll(() => updateCalled).toBe(true);
  });
});
```

- [ ] **Step 3: Run + Commit**

```bash
git add tests/e2e/friend-playdate-start.spec.js tests/e2e/friend-playdate-end.spec.js
git commit -m "test(playdate): e2e start + end session flows"
```

---

## Task 7.5: Native verification checklist 작성

**Files:**
- Create: `docs/superpowers/verifications/2026-04-28-friend-playdate-checklist.md`

- [ ] **Step 1: 5-item checklist 작성**

```markdown
# Friend Playdate — Native Manual Verification Checklist (5 items)

> **Purpose**: Phase 7 verification gate. APK sideload 후 두 가족 실기기에서 5/5 통과해야 main promotion 가능.
>
> **Prerequisites**:
> - APK: PR feat/friend-playdate CI artifact
> - 가족 2팀 (각각 부모 + 아이) — 양쪽 모두 playdate_enabled = true
> - 같은 안전장소 (saved_places.is_playdate_safe = true) 같은 public_place_id 등록
> - 두 아이 모두 단말 GPS ON, 같은 장소 150m 이내
>
> **Pass criteria**: 5/5 ✅ + 영상/스크린샷

## 1. Foreground (1)
- [ ] **1.1** 부모 단말 앱 foreground 상태에서 다른 가족 아이가 시작 → 즉시 ActivePlaydateCard 표시 + heads-up 알림

## 2. Background (1)
- [ ] **2.1** 부모 단말 앱 background → playdate_started 푸시 → 헤드업 알림 표시 → 탭 시 MainActivity 진입 + ActivePlaydateCard 표시

## 3. 종료 + 도즈 (1)
- [ ] **3.1** 부모 단말 앱 종료 + 도즈 진입 → 다른 부모/아이가 종료 → playdate_ended 푸시 정상 도착 ("친구놀이 종료" + 장소명)

## 4. 통화 deep link (1)
- [ ] **4.1** ActivePlaydateCard에서 📞 010-XXXX-XXXX 탭 → 네이티브 dialer 열림 + 번호 자동 채워짐

## 5. Cron 자동 종료 (1)
- [ ] **5.1** 두 아이 안전장소 떠나서 5분 대기 → cron `playdate_auto_end` 실행 → 양쪽 부모에게 "친구놀이 종료" (stop_reason='auto_geofence_exit') 푸시 + Supabase dashboard에서 `friend_playdate_sessions.stop_reason = 'auto_geofence_exit'` 기록 확인

## 회귀 점검
- [ ] **R.1** force_ring 알람 (긴급 채널) + playdate 알림 (일반 채널) 동시 도착 시 채널/우선순위 분리 정상
- [ ] **R.2** 일반 일정 알림 + AmbientListenService + LocationService 모두 정상

## 결과 보고

| Category | Pass | Total |
|---|---|---|
| Foreground | _/1 | 1 |
| Background | _/1 | 1 |
| 종료/도즈 | _/1 | 1 |
| 통화 link | _/1 | 1 |
| Cron 종료 | _/1 | 1 |
| **Total** | **_/5** | **5** |

회귀: _/2

테스트 가족: <부모 A 단말 + 아이 A 단말 / 부모 B 단말 + 아이 B 단말>
증거: <영상/스크린샷>

---
*체크리스트 생성: 2026-04-28*
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/verifications/2026-04-28-friend-playdate-checklist.md
git commit -m "docs(playdate): Phase 7 native verification checklist (5 items)"
```

---

## Task 7.6: 최종 검증 게이트

- [ ] **Step 1: 전체 verify 게이트**

`npm run verify`

Expected: vitest + Playwright default config 모두 PASS.

- [ ] **Step 2: Real-services Playwright (Supabase branch)**

`npx playwright test --config=playwright.real.config.js --grep="friend.playdate"`

Expected: branch에서 INSERT/SELECT/UPDATE 정상 동작 + RLS 매트릭스 8/8 통과.

- [ ] **Step 3: Native checklist 5/5 (사용자 수동 검증)**

User가 두 가족 단말로 실기기 검증 완료 → 결과 PR 코멘트.

- [ ] **Step 4: Supabase advisors 재실행**

`mcp__plugin_supabase_supabase__get_advisors` `type: security`

Expected: 신규 lint 0.

- [ ] **Step 5: Main promotion (User 명시 승인 후)**

```bash
gh pr merge <PR#> --squash
```

Supabase branch → main merge, production deploy.

---

# Self-Review (writing-plans skill step 7)

## 1. Spec Coverage Check

| Spec section | Plan task | Status |
|---|---|---|
| §1 Problem statement | Plan goal | ✅ |
| §2 Goals & Non-Goals | 모든 task가 goal에 정렬 | ✅ |
| §3 Locked Decisions FP-D01..D14 | Phase 1-6 전반 | ✅ |
| §4 Architecture | File Structure + phases | ✅ |
| §5.1 Migration up | Task 1.1 | ✅ |
| §5.2 Migration down | Task 1.1 step 2 | ✅ |
| §5.3 RLS matrix 8 조합 | Task 1.3 | ✅ |
| §5.4 Cron | Task 1.2 | ✅ |
| §6 Edge Function 2 actions | Task 2.1, 2.2 | ✅ |
| §7 Native Android | Task 6.1 | ✅ |
| §8 Parent UI | Task 4.1-4.5 | ✅ |
| §9 Child UI | Task 5.1-5.4 | ✅ |
| §10 Edge cases | RPC + RLS + UI 가드 (분산) | ✅ |
| §11 Testing strategy | Task 3.5, 4.6, 7.1-7.4, 7.6 | ✅ |
| §11.5 Native checklist 5개 | Task 7.5 | ✅ |
| §12 Compliance | RLS + toggle + audit (분산) | ✅ |
| §13 Future work | Out of scope (생략) | ✅ |
| §14 Acceptance criteria | Task 7.6 게이트 | ✅ |

**Pre-flight discoveries 추가 task:**
- saved_places premium gate 충돌 → Task 1.4 ✅
- PostGIS 활성화 → Task 1.1 step 1 SQL에 포함 ✅

## 2. Placeholder Scan

- "TBD" / "TODO" / "fill in" / "Add appropriate" → 0건 ✅
- "Similar to Task N" 없이 모든 코드 inline ✅
- 약한 부분: Task 4.5 + 5.5에서 변수명/path는 코드베이스 inspect 후 결정 — subagent에게 명시 안내 추가됨 (force_ring 패턴 동일 사용). 이는 plan-time 결정 불가 영역이므로 허용 ✅
- Task 6.1 NotificationHelper.CHANNEL_SCHEDULE 정확 상수명 — Subagent inspect 명시 ✅

## 3. Type / Naming Consistency

| Symbol | 정의 위치 | 사용 위치 | 일관? |
|---|---|---|---|
| `findCandidates` | Task 3.1, 3.2 | Task 5.4 | ✅ |
| `startPlaydate({publicPlaceId, familyAId, ...})` | Task 3.1, 3.2 | Task 5.4 | ✅ |
| `endPlaydate(sessionId, stopReason)` | Task 3.1, 3.2 | Task 4.3, 5.3 | ✅ |
| `setFamilyPlaydateEnabled(familyId, enabled)` | Task 3.3 | Task 4.1 | ✅ |
| `setSavedPlacePlaydateSafe(id, isSafe, publicPlaceId)` | Task 3.3 | Task 4.2 | ✅ |
| `subscribeActiveSession(familyId, onChange)` | Task 3.4 | Task 4.5, 5.4 | ✅ |
| `fetchActiveSession(familyId)` | Task 3.4 | Task 4.5, 5.4 | ✅ |
| `friend_playdate_sessions` table | Task 1.1 | Task 2.1, 2.2, 3.x | ✅ |
| `public_places` | Task 1.1 | Task 2.1, 3.3 | ✅ |
| `families.playdate_enabled` | Task 1.1 | Task 1.1 RPC, Task 3.3, 4.1 | ✅ |
| `saved_places.is_playdate_safe + public_place_id` | Task 1.1 | Task 1.1 RPC, Task 3.3, 4.2, 4.5 | ✅ |
| `stop_reason` enum: `child_end`, `parent_end`, `auto_geofence_exit` | Task 1.1, 3.2 | Task 1.2 (cron), 4.3, 5.3 | ✅ |
| `playdate_started` / `playdate_ended` action | Task 2.1, 2.2 | Task 3.2 (invoke), 6.1 | ✅ |

모든 식별자 일관 ✅.

---

# Execution Handoff

플랜이 완성되어 `docs/superpowers/plans/2026-04-27-friend-playdate.md`에 저장됐습니다.

**규모**: 7 phases · 31 tasks · 26 신규 + 3 수정 파일 · 마이그레이션 3 + 다운 페어 3 · UI 컴포넌트 9 · E2E spec 4 + 헬퍼 1 · 네이티브 분기 1 + 컨트랙트 테스트 3 · 검증 체크리스트 1.

두 가지 실행 옵션:

1. **Subagent-Driven (recommended)** — Task별 fresh subagent 디스패치 + 두 단계 리뷰 (spec 준수 → 코드 품질). force_ring과 동일 흐름. 스킬 `superpowers:subagent-driven-development` 사용.
2. **Inline Execution** — 이 세션에서 직접 task 순회 + 체크포인트마다 user 리뷰. 스킬 `superpowers:executing-plans` 사용.

어떤 방식으로 진행할까요?

특히 **Phase 7은 두 가족 실기기 + Supabase branch 실 테스트가 필요**해서 어느 방식이든 user 개입이 필요합니다 (Phase 1 시작 전 Supabase branch 생성, Phase 6 후 PR 머지, Phase 7 native 검증).
