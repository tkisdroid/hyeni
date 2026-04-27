# Friend Playdate Safety — Design

> **Topic**: `friend_playdate_safety` (친구놀이 안전)
> **Status**: Spec — pending plan + implementation
> **Author**: brainstorming session 2026-04-27 (Feature 2, FR-NEXT-02 후속)
> **Sibling spec**: `2026-04-27-force-ring-design.md` (Feature 1, 응급 강제 알람)

---

## 1. Problem Statement

부모는 아이가 친구와 놀고 있는 상황을 인지하고, 필요시 상대 학부모와 직접 연락할 수 있어야 합니다. 현재는 다음 공백이 존재:

- 아이가 친구 집·공원·운동장에 갔을 때 부모가 어떤 친구와 어디서 만났는지 알 수 없음
- 갑작스런 일정 변경·픽업·응급 상황에서 상대 부모 연락처가 없으면 응대 불가능
- 아이가 친구 가족과 어디 있는지 부모에게 명확히 전달할 단순 채널 없음

이 feature는 그 공백을 `안전장소 + 명시 트리거 + 양방향 연락처 표시` 흐름으로 메웁니다. 자동 GPS broadcast나 사전 친구 등록 같은 복잡성·privacy 부담은 의도적으로 회피합니다.

## 2. Goals & Non-Goals

### Goals

- 아이가 안전장소 안에서 다른 혜니 가족 아이를 발견하고 직접 "친구랑 놀래요" 요청 가능
- 양쪽 부모 모두에게 푸시 알림 + 상대 가족 연락처 + 1탭 통화 표시
- 안전장소를 부모가 명시 등록하고 "친구놀이 허용" 토글로 통제
- 양쪽 부모가 모두 "친구놀이 기능 ON" 상태일 때만 매칭 작동 (PIPA 사전 동의)
- 모든 세션 immutable audit log 기록
- 핵심 흐름 (시작·종료·연락처 표시·통화) 무료
- 신규 native code 거의 0 (geo-fence는 기존 LocationService 재사용)

### Non-Goals

- 위치 좌표를 cross-family로 노출하지 않음 (장소 ID만 매칭)
- 사전 친구 등록 절차 없음 (request → approve 흐름 의도적 제외)
- 다친구 동시 세션 없음 (1 session = 1 친구, UI Radio 강제)
- BLE/Bluetooth nearby 검색 없음 (신규 npm dep 회피)
- iOS 미지원 (force_ring과 동일 Capacitor Android only 정책)
- 즉석 미등록 친구와의 자동 매칭 없음 (등록된 안전장소 안에서만)
- 아이 위치 실시간 추적 화면 (기존 location 화면이 담당)

## 3. Locked Decisions

| ID | 결정 | 근거 |
|---|---|---|
| FP-D01 | 발견 메커니즘: **장소 기반 (geo-fence anchored)** | PIPA + Play stalkerware 안전. 좌표 비공개. 기존 saved_places·child_locations 인프라 재사용 |
| FP-D02 | 매칭: **글로벌 `public_places` 카탈로그** | 두 가족이 같은 장소를 가리킨다는 신뢰 가능한 ID 매칭. fuzzy 좌표 매칭 위험 회피 |
| FP-D03 | PIPA 사전 동의: **`families.playdate_enabled` toggle** | 단일 명시 동의로 cross-family 데이터 공유 합법화. 언제든 OFF 옵트아웃 |
| FP-D04 | 세션 시작 트리거: **아이의 명시적 버튼 클릭** | 자동 트리거 회피로 stalkerware 우려 0. 아이의 자율성 존중 |
| FP-D05 | 친구 사전 등록 절차 **없음** | 흐름 단순화 (사용자 명시 요구). PIPA는 D03 toggle로 충족 |
| FP-D06 | 1 session = 1 friend (다친구 금지) | UI 단순. audit 명확. 다자녀 동시는 별도 sessions |
| FP-D07 | 종료: **명시 (아이) + 자동 (geo-fence exit 5분)** | 아이가 잊어도 안전한 종료. 잘못된 GPS 흔들림은 5분 grace로 흡수 |
| FP-D08 | hard cap: **없음** | force_ring과 달리 자원 부담 없음 (cron만 모니터링). Geo-fence exit이 자연 종료 처리 |
| FP-D09 | 공유 연락처: `families.mom_phone` + `dad_phone` 등록된 모든 번호 | 응급 시 둘 중 한쪽이라도 연결될 가능성 ↑ |
| FP-D10 | Premium gating: **완전 무료** | 안전 기능 핵심 가치. abuse 방지는 RLS·toggle로 충분 |
| FP-D11 | toggle OFF 시 활성 세션: **유지** | 이미 시작된 세션 끊으면 안전 정보 흐름 중단 → 더 위험. 새 매칭만 차단 |
| FP-D12 | 마이그레이션 hygiene: BEGIN/COMMIT + IF NOT EXISTS + down 페어 | force_ring과 동일 정책 |
| FP-D13 | App.jsx **decomposition 금지** | 6877줄 monolith 정책 유지. 5-10줄 마운트만 |
| FP-D14 | Audio/native code 신규 0 | force_ring과 차별. push 액션 2개만 추가 (playdate_started · playdate_ended) |

## 4. Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ child A (페어링됨, family_A)                                    │
│ - GPS publish → child_locations (기존)                          │
│ - 안전장소 진입 시 UI에 "친구랑 놀래요" 버튼 활성화              │
└────────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────────┐
│ Supabase RPC: find_playdate_candidates(family_id)               │
│  - 내 아이 현재 안전장소 (saved_places.is_playdate_safe=true) 검출│
│  - 그 saved_place의 public_place_id = X                          │
│  - 같은 X에 위치한 다른 혜니 아이 (지난 N분 내 child_locations) 조회│
│  - 단, 양쪽 가족 families.playdate_enabled=true                  │
│  - 같은 family_id 제외 (형제 매칭 금지)                          │
└────────────────────────────────────────────────────────────────┘
                          ↓
            아이 후보 목록에서 1명 선택 (Radio)
                          ↓
┌────────────────────────────────────────────────────────────────┐
│ Supabase RPC: start_playdate(public_place_id, friend_family_id, │
│                              friend_child_id)                   │
│  - friend_playdate_sessions INSERT (started_at)                 │
│  - 양쪽 부모 FCM push (push-notify action=playdate_started)     │
│    payload: {child_a_name, child_b_name, place_name,            │
│              other_family_phones[]}                             │
└────────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────────┐
│ 세션 활성 (양쪽 부모 화면 ActivePlaydateCard 실시간 표시)        │
│  - 상대 부모 이름 + 전화번호 1탭 통화                           │
│  - 종료 버튼 (양쪽 부모 누구나 누를 수 있음)                    │
└────────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────────┐
│ 종료 경로 3가지:                                                │
│  1. 아이가 "그만 놀래요" → end_playdate(stop_reason='child_end') │
│  2. 부모가 "정지" → end_playdate(stop_reason='parent_end')      │
│  3. cron */2: child_locations가 안전장소 5분 떠남               │
│     → end_playdate(stop_reason='auto_geofence_exit')            │
│  → 양쪽 부모 FCM "친구놀이 종료"                                │
└────────────────────────────────────────────────────────────────┘
```

### 핵심 컴포넌트

| 컴포넌트 | 책임 | 의존 |
|---|---|---|
| `public_places` 테이블 | 글로벌 장소 카탈로그 (kakao_place_id dedup 키) | (없음) |
| `friend_playdate_sessions` 테이블 | session audit (immutable) | public_places, families, family_members |
| `find_playdate_candidates(uuid)` RPC | 같은 장소 + toggle ON 가족만 후보 | child_locations, saved_places, families |
| `start_playdate(...)` RPC | INSERT 세션 + push 트리거 | friend_playdate_sessions |
| `end_playdate(...)` RPC | UPDATE stopped_at | friend_playdate_sessions |
| `playdate_auto_end` cron (`*/2 * * * *`) | geo-fence exit 5분 자동 종료 | pure SQL UPDATE |
| `push-notify` Edge Function 액션 추가 | `playdate_started`, `playdate_ended` (양쪽 부모 동시 푸시 + 연락처 payload) | 기존 FCM 인프라 |
| `src/lib/friendPlaydate.js` | 클라이언트 헬퍼 (start/end/findCandidates/subscribe) | supabase, realtime |
| `src/components/friendPlaydate/*.jsx` (6개) | 부모/아이 UI | entitlement, 기존 paywall 패턴 |
| App.jsx 마운트 | 부모/아이 모드별 패널 마운트 (5-10줄) | (변경 없음) |
| Native Android | `MyFirebaseMessagingService`에 push action 분기 1개 추가 | (변경 거의 없음) |

## 5. Data Model

### 5.1 Migration: `supabase/migrations/202604XX000000_friend_playdate.sql`

```sql
BEGIN;

-- 5.1.1 글로벌 공용 장소 카탈로그
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

-- INSERT는 모든 authenticated 가능 (Kakao 검색 결과 등록)
DROP POLICY IF EXISTS public_places_insert ON public.public_places;
CREATE POLICY public_places_insert ON public.public_places
  FOR INSERT TO authenticated WITH CHECK (true);

-- DELETE/UPDATE 정책 없음 = service_role만 (불변 카탈로그)

-- 5.1.2 saved_places 컬럼 추가
ALTER TABLE public.saved_places
  ADD COLUMN IF NOT EXISTS is_playdate_safe boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_place_id uuid REFERENCES public.public_places(id);

CREATE INDEX IF NOT EXISTS saved_places_playdate_idx
  ON public.saved_places (public_place_id) WHERE is_playdate_safe = true;

-- 5.1.3 families 토글 컬럼
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS playdate_enabled boolean NOT NULL DEFAULT false;

-- 5.1.4 friend_playdate_sessions (immutable audit)
CREATE TABLE IF NOT EXISTS public.friend_playdate_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_place_id uuid NOT NULL REFERENCES public.public_places(id),
  family_a_id uuid NOT NULL REFERENCES public.families(id),
  family_b_id uuid NOT NULL REFERENCES public.families(id),
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

-- INSERT 정책 없음 — start_playdate RPC (SECURITY DEFINER)가 강제

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

-- 5.1.5 RPC: 후보 검색
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

-- 5.1.6 publication 추가 (Realtime)
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

### 5.2 Down migration: `supabase/migrations/down/202604XX000000_friend_playdate.sql`

```sql
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

COMMIT;
```

### 5.3 RLS Matrix (verification)

| Subject | Action | Target | Expected |
|---|---|---|---|
| family_A child | SELECT | friend_playdate_sessions row (A↔B) | ALLOW |
| family_C parent | SELECT | friend_playdate_sessions row (A↔B) | DENY |
| family_A child | UPDATE stopped_at | own active session | ALLOW |
| family_B parent | UPDATE stopped_at | A↔B active session | ALLOW |
| family_A child | UPDATE stopped_at | already-stopped session | DENY |
| anon | SELECT | any row | DENY |
| family_A parent | DELETE | any row | DENY |
| service_role | DELETE | row | ALLOW |

### 5.4 Cron: `supabase/migrations/202604XX000001_playdate_cron.sql`

```sql
SELECT cron.schedule(
  'playdate_auto_end',
  '*/2 * * * *',
  $$
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
  $$
);
```

## 6. Edge Function Changes

### 6.1 File: `supabase/functions/push-notify/index.ts`

신규 액션 2개:

#### `playdate_started`

```typescript
if (body?.action === "playdate_started") {
  return await handlePlaydateStarted(body, callerUserId, supabase);
}

async function handlePlaydateStarted(body, callerUserId, supabase) {
  // 1) 호출자 권한: 시작 가족 child만
  // 2) session 행 SELECT (양쪽 family + 양쪽 child 정보)
  // 3) 양쪽 부모 FCM 토큰 fetch (fcm_tokens, family_members.role=parent)
  // 4) 동시 push:
  //    payload: {
  //      action: 'playdate_started',
  //      session_id, place_name, my_child_name, friend_child_name,
  //      friend_family_phones: [mom_phone, dad_phone],  // null 제외
  //      friend_parent_name
  //    }
  // 5) audit는 friend_playdate_sessions가 보장
}
```

#### `playdate_ended`

```typescript
if (body?.action === "playdate_ended") {
  return await handlePlaydateEnded(body, callerUserId, supabase);
}

async function handlePlaydateEnded(body, callerUserId, supabase) {
  // 1) session SELECT, stopped_at 확정
  // 2) 양쪽 부모 FCM:
  //    payload: { action: 'playdate_ended', session_id, stop_reason, place_name }
}
```

서비스 role JWT 분기 (cron 호출용)는 force_ring과 동일 패턴 — `auth.getClaims` sub 없음 + role=service_role 허용.

## 7. Native Android

### 7.1 신규 코드: 거의 0

force_ring과 달리 신규 service/activity/audio 모두 불필요. push action 분기만 추가.

### 7.2 수정 파일

`android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java`:

```java
if ("playdate_started".equals(action) || "playdate_ended".equals(action)) {
    String title = "playdate_started".equals(action)
        ? "친구놀이 시작"
        : "친구놀이 종료";
    String body = data.get("place_name") != null
        ? data.get("place_name") + (data.get("friend_child_name") != null
            ? " — " + data.get("friend_child_name") + "와 함께"
            : "")
        : "";
    NotificationHelper.showNotification(
        this, title, body,
        NotificationHelper.CHANNEL_SCHEDULE,
        false, false,
        Math.abs(data.get("session_id").hashCode())
    );
    return;
}
```

### 7.3 권한 추가: 0

기존 POST_NOTIFICATIONS·INTERNET·ACCESS_FINE_LOCATION 모두 충분.

### 7.4 채널: 신규 0

기존 `hyeni_schedule_v5` (IMPORTANCE_DEFAULT) 재사용 — playdate는 응급이 아니므로 일반 알림으로 충분.

## 8. Parent UI Flow

### 8.1 Component tree (App.jsx 내 추가, decomposition 금지 정책 준수)

```
src/components/friendPlaydate/
├── FriendPlaydatePanel.jsx          (orchestrator, isParent only)
├── FriendPlaydateToggle.jsx         (families.playdate_enabled 토글)
├── PlaydateSafePlaceList.jsx        (saved_places + per-place toggle)
├── ActivePlaydateCard.jsx           (실시간 세션 카드 + 통화 + 정지)
└── PlaydateHistory.jsx              (최근 10건 audit, optional)
```

App.jsx 마운트 (force_ring 패턴):

```jsx
{isParent && familyId && (
    <FriendPlaydatePanel
        familyId={familyId}
        currentUserId={authUser?.id}
    />
)}
```

위치: `AmbientAudioRecorder` + `ForceRingPanel` 다음 (안전 도구 클러스터).

### 8.2 진입 위치

부모 메인 화면 안전 도구 영역. 토글 OFF 상태 시 패널은 "친구놀이 기능 OFF — 켜시려면 토글" 안내만. ON 시 안전장소 토글 + 활성 세션 카드 표시.

### 8.3 부모 알림 흐름

세션 시작 시 받는 푸시:
- Title: "친구놀이 시작"
- Body: "혜니가 OO공원에서 지민이와 놀고 있어요"
- Tap → MainActivity → ActivePlaydateCard 표시
- Card 컨텐츠: `상대 부모 이름`, `📞 전화` (mom·dad 둘 다 있으면 2버튼), `🛑 정지`

### 8.4 카피

| 상황 | 카피 |
|---|---|
| toggle OFF | 친구놀이 기능을 켜면 같은 안전장소의 다른 혜니 가족과 자녀가 매칭됩니다. 양쪽 부모가 모두 켜야 작동합니다. |
| 안전장소 0개 | 친구놀이 안전장소를 먼저 등록하세요. 학교·공원·학원 같은 곳을 지정할 수 있습니다. |
| 활성 세션 | 혜니가 OO공원에서 지민이와 놀고 있어요. 부모님 전화: 010-XXXX-XXXX |
| 종료 | OO공원 친구놀이가 종료됐어요. (사유: 자동 / 아이 종료 / 부모 정지) |

### 8.5 접근성

- 모든 버튼 aria-label
- 토글 role=switch + aria-checked
- 통화 deep link: `<a href="tel:01012345678">📞 010-1234-5678</a>` (네이티브 dialer)

## 9. Child UI Flow

### 9.1 Components

```
src/components/friendPlaydate/
├── PlaydateStartButton.jsx          (안전장소 안에서만 활성)
├── FriendCandidateList.jsx          (Radio, 1명 선택)
└── ActivePlaydateChildView.jsx      (현재 친구 + "그만 놀래요")
```

App.jsx 마운트 (`!isParent` 분기):

```jsx
{!isParent && familyId && (
    <FriendPlaydateChildPanel
        familyId={familyId}
        currentUserId={authUser?.id}
    />
)}
```

### 9.2 흐름

1. 아이 화면 메인에 "친구랑 놀래요" 큰 버튼 (안전장소 밖이면 disabled + "안전장소 안에서만 사용 가능" 툴팁)
2. 누르면 `find_playdate_candidates` RPC 호출
3. 결과 0명: "지금 같은 곳에 친구가 없어요" 안내
4. 결과 N명: 친구 이름 Radio 목록 + "친구랑 놀래요" 큰 버튼
5. 시작 후: "지민이와 놀고 있어요 ⏰ 14:32 시작" + "그만 놀래요" 빨간 버튼
6. 종료: Toast "엄마에게 알렸어요" + 메인 화면 복귀

### 9.3 카피 (공감 톤)

| 상황 | 카피 |
|---|---|
| 안전장소 밖 | 친구놀이는 학교·공원처럼 등록된 곳에서만 시작할 수 있어요 |
| 친구 0명 | 지금 같은 곳에 친구가 없어요. 잠시 후 다시 봐요! |
| 친구 N명 | 누구랑 놀고 싶어? |
| 시작 완료 | 엄마·아빠한테 알렸어요. 친구랑 잘 놀아! |
| 종료 완료 | 잘 놀았어! 엄마한테 끝났다고 알렸어요 |

## 10. Edge Cases & Error Handling

### 10.1 네트워크 / 데이터

| 케이스 | 처리 |
|---|---|
| 아이 단말 오프라인 — start RPC 실패 | UI 에러 토스트 + 재시도. 세션 미생성. |
| 시작 후 부모 단말 푸시 도달 실패 | session 행은 있음. 부모가 앱 열면 ActivePlaydateCard 표시 (Realtime + REST fallback). |
| public_places 카탈로그 hit 0 | saved_place 등록 시 자동 카탈로그 INSERT (kakao_place_id 있으면 dedup). |
| Kakao 검색에 kakao_place_id 없음 | name + lat/lng만으로 카탈로그 row 생성, kakao_place_id NULL. MVP는 그냥 새 row 생성 (다중 매칭은 admin 도구로 후속 정리). |

### 10.2 권한 / 단말 상태

| 케이스 | 처리 |
|---|---|
| 아이 위치 권한 거부 | child_locations 미갱신 → find_candidates RPC가 `not_in_safe_place` 반환 → UI는 "위치 권한 필요" 안내 |
| 부모 알림 권한 거부 | session은 정상, 부모는 앱 열어야 인지 (Realtime card) |

### 10.3 동시성

| 케이스 | 처리 |
|---|---|
| 두 아이가 동시에 서로 시작 | 첫 INSERT만 성공 (UNIQUE 인덱스 권장: family_a_id+family_b_id WHERE stopped_at IS NULL). MVP에서는 양쪽 sessions 허용 + UI에서 dedup. |
| 한쪽 부모가 정지하는 사이 다른 부모도 정지 | UPDATE WHERE stopped_at IS NULL — 둘 중 하나만 성공. 나머지는 idempotent. |

### 10.4 데이터 정합성

| 케이스 | 처리 |
|---|---|
| 친구 child_id가 페어 해제된 가족 | start_playdate RPC가 child_id 유효성 다시 확인 (family_members 조회). 없으면 `friend_unavailable`. |
| 카탈로그 row가 잘못 등록됨 | service_role admin이 정리 (UPDATE/DELETE 정책 부재로 일반 사용자는 못 만짐). |

### 10.5 다자녀 / 미페어링

| 케이스 | 처리 |
|---|---|
| 다자녀 가족 | 각 아이 화면에서 독립적으로 친구놀이 시작. session 행도 child_a_id/child_b_id로 명확히 분리. |
| 미페어링 (자녀 없음) | UI에 "아이 페어링 후 사용 가능" (force_ring 패턴 동일) |

### 10.6 toggle / 옵트아웃

| 케이스 | 처리 |
|---|---|
| 부모 toggle ON → OFF (활성 세션 중) | 활성 세션 유지 (FP-D11). 새 매칭만 차단. |
| 양쪽 가족 모두 toggle OFF | find_candidates 결과 0. 기존 세션은 유지. |
| safe_place toggle OFF (활성 세션 중) | 새 매칭만 차단. 활성 세션 유지. |

### 10.7 모니터링

- `friend_playdate_sessions` 행 count by stop_reason (auto vs manual 비율)
- 세션 평균 지속 시간 (분포)
- 일일 매칭 시도 (find_candidates RPC 호출 수) vs 실제 시작 (start_playdate) 비율

## 11. Testing Strategy

### 11.1 Vitest (`npm run test`)

| 파일 | 검증 |
|---|---|
| `tests/friendPlaydateClient.test.js` | client lib: start/end/findCandidates 인자 형식, 응답 분기 |
| `tests/friendPlaydateRpc.test.js` | RPC `find_playdate_candidates` 분기 (toggle off, no safe place, no candidates, hit) |
| `tests/friendPlaydatePanel.test.jsx` | toggle UI, safe_place toggle, 활성 세션 카드 |
| `tests/friendPlaydateChildView.test.jsx` | "친구랑 놀래요" disabled 분기, candidate 선택 + 시작 |

목표: 신규 모듈 80%+ 커버리지

### 11.2 Playwright 모의 (`npm run test:e2e`)

| 파일 | 시나리오 |
|---|---|
| `tests/e2e/friend-playdate-toggle.spec.js` | 토글 ON/OFF + safe_place 토글 |
| `tests/e2e/friend-playdate-discover.spec.js` | candidates 0/N 분기 |
| `tests/e2e/friend-playdate-start.spec.js` | 친구 선택 → 시작 → 양쪽 부모 알림 (mock push) |
| `tests/e2e/friend-playdate-end.spec.js` | 아이 종료 / 부모 정지 |

### 11.3 Playwright real-services (`--config=playwright.real.config.js`)

| 파일 | 시나리오 |
|---|---|
| `tests/e2e/real/friend-playdate-end-to-end.spec.js` | 두 가족 페어링 → 양쪽 toggle ON → 같은 안전장소 → start → DB 검증 → end |
| `tests/e2e/real/friend-playdate-cron.spec.js` | geo-fence exit 5분 → cron 자동 종료 (slow test) |

### 11.4 Migration test

| 검증 | 방법 |
|---|---|
| Forward BEGIN/COMMIT | Shadow DB 적용 |
| Down 역적용 | down 적용 후 깨끗이 제거 |
| 멱등 재실행 | IF NOT EXISTS 보장 |
| RLS 매트릭스 | §5.3 8개 조합 |

### 11.5 Native 수동 (5개)

force_ring 24개와 달리 native 거의 없음:

- [ ] 1. 부모 단말 푸시 수신 (앱 foreground)
- [ ] 2. 부모 단말 푸시 수신 (앱 background)
- [ ] 3. 부모 단말 푸시 수신 (앱 종료 + 도즈 모드)
- [ ] 4. 푸시 탭 → MainActivity → ActivePlaydateCard 자동 표시
- [ ] 5. 1탭 통화 deep link (tel:) → 네이티브 dialer 진입

### 11.6 검증 게이트

```bash
npm run verify
npx playwright test --config=playwright.real.config.js --grep="friend.playdate"
# Native 수동 5/5 통과
```

## 12. Compliance / Policy

| 항목 | 준수 방법 |
|---|---|
| **PIPA 안전조치** | `families.playdate_enabled` toggle = 명시적 사전 동의. immutable audit log. 양쪽 어느 부모든 toggle OFF로 즉시 옵트아웃. 좌표 cross-family 미공유 (장소 ID만). |
| **Google Play Family Exception** | persistent notification 불필요 (긴급 FGS 아님). 신규 권한 0. force_ring과 같이 `isMonitoringTool=child_monitoring` meta 유지. |
| **Stalkerware 회피** | 자동 트리거 0 (아이 명시 시작), 좌표 비노출, 등록된 장소만 매칭, 양쪽 부모 사전 동의 강제. |
| **OWASP MASTG safety logging** | sos_events·force_ring_events 패턴 그대로 — initiator, target, 시각, 결과 모두 기록. |
| **남용 방지** | 같은 가족 매칭 금지 (family_a_id <> family_b_id CHECK), toggle 양방향 강제, 안전장소 ON 강제. |
| **PIPA 처리방침 업데이트** | "친구놀이 기능 사용 시 공유되는 정보 (아이 이름, 부모 전화번호, 안전장소 ID)" 별도 명시. |

## 13. Future Work (Out of Scope)

| ID | 후속 |
|---|---|
| FP-NEXT-01 | 다친구 동시 세션 (1 session = N friends) — UI checkbox 다중 선택 |
| FP-NEXT-02 | BLE nearby 옵션 (안전장소 등록 안 한 상태에서도 작동) |
| FP-NEXT-03 | iOS 지원 |
| FP-NEXT-04 | "최근 같이 놀았던 친구" 즐겨찾기 (학부모 친구 가족 카드 영구 저장) |
| FP-NEXT-05 | 친구놀이 종료 후 부모 간 자동 메시지 (예: "오늘 같이 놀아줘서 감사합니다") |
| FP-NEXT-06 | 친구놀이 통계 대시보드 (월별 친구 수·평균 지속 시간) |
| FP-NEXT-07 | 카탈로그 dedup admin 도구 (잘못 등록된 row 정리) |

## 14. Acceptance Criteria

이 spec 기준 implementation 완료 = 다음 모두 통과:

1. ✅ Migration forward + down 양방향 적용 가능, RLS 8개 매트릭스 통과
2. ✅ RPC `find_playdate_candidates` 정상 동작 (toggle off / no safe place / no candidates / hit 4분기)
3. ✅ Edge Function 2개 액션 정상 (`playdate_started` / `playdate_ended`) — 양쪽 부모 동시 푸시 + 연락처 payload
4. ✅ 부모 단말 (web + Android) 진입 → toggle ON → safe_place 등록 → 활성 세션 카드 표시 → 1탭 통화 deep link 동작
5. ✅ 아이 단말 안전장소 진입 → "친구랑 놀래요" 활성화 → 친구 선택 → 시작 → "그만 놀래요" 종료
6. ✅ Cron `playdate_auto_end` geo-fence exit 5분 후 자동 종료, stop_reason='auto_geofence_exit' 기록
7. ✅ 양쪽 toggle 한쪽이라도 OFF → 매칭 안 됨 (find_candidates 0 결과)
8. ✅ Vitest 커버리지 80%+ + Playwright real-services 2개 시나리오 통과
9. ✅ Native 수동 체크리스트 5/5 통과
10. ✅ PIPA 처리방침 업데이트 + Google Play Console disclosure 제출

---

*Spec generated: 2026-04-27 by `/superpowers:brainstorming`*
*Next: implementation plan via `superpowers:writing-plans`*
