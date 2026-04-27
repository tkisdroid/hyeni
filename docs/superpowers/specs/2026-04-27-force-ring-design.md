# Force Ring (강제 소리 울리기) — Design Spec

**Date:** 2026-04-27
**Status:** Approved (brainstorming complete)
**Owner:** TK
**Codename:** `force_ring`
**Scope:** Feature 1 of 2-feature batch (Feature 2 = friend-playdate safety, deferred to separate spec)

---

## 1. Problem Statement

부모-자녀 안전 앱 혜니캘린더에서 다음 시나리오가 보장되지 않는다:

> 진짜 응급 상황 — 일반 전화도 일반 푸시도 닿지 않을 때, 부모가 아이의 무음·방해금지(DND) 단말을 풀볼륨 알람으로 강제로 울려 신호를 전달하고 응답을 받을 마지막 수단이 필요하다.

기존 `remote_listen` (주위 소리 듣기) 은 주변 청취용이고, `sos_events` 는 아이→부모 단방향이다. **부모→아이 응급 강제 알림 채널이 없다.**

## 2. Goals & Non-Goals

### Goals
- **G1.** 부모가 의도적으로(5초 long-press + 확인 모달) 트리거 시 아이 단말이 무음·DND·잠금 화면 어떤 조건에서도 풀볼륨 알람 + 풀스크린으로 표시
- **G2.** 아이가 명시적으로 "확인했어요" 탭 → 부모 화면 실시간 "확인됨 HH:MM:SS" 표시
- **G3.** 전달 실패 (오프라인/배터리 0) 시 부모에게 즉시 안내 + 119/직접 통화 폴백 제시
- **G4.** 5분 미응답 시 부모 단말에 reminder 푸시 → 골든타임 상실 방지
- **G5.** 모든 트리거를 immutable audit log 에 기록 (PIPA 안전조치 + Play 정책 transparency)
- **G6.** 학대·남용 도구화 방지: 무료 1/일, 프리미엄 10/일 hard cap

### Non-Goals
- ❌ 자동 트리거 (위치/시간 기반) — 부모 명시 trigger만
- ❌ 다자녀 동시 broadcast — v1은 첫 child만, v1.2 후속
- ❌ 양방향 (아이→부모 강제 알람) — 기존 `sos_events` 가 담당
- ❌ iOS — 현 프로젝트 Capacitor Android only
- ❌ 음성 메시지 / 동영상 — 80자 텍스트만
- ❌ 아이 측 스누즈 — 응급 백업 정체성과 충돌
- ❌ 사용자 권한 그랜트 (`Notification Policy Access`) 강요 — `USAGE_ALARM` 으로 우회

## 3. Locked Decisions

| # | 결정 | 근거 |
|---|---|---|
| D1 | 정체성: 진짜 응급 백업 (마지막 수단) | 빈도 ↓, 강도 최강. 일반 연락 도구와 명확 구분 |
| D2 | 트리거: 단일 경로 — 안전 도구 패널 → 5초 long-press → 확인 모달 | 컨텍스트 노출 듀얼 경로는 일일 1~10회 한도에서 의미 무력화 |
| D3 | 아이 응답: 알람 풀볼륨 + 풀스크린 + 부모 메시지(80자) + 부모 원격 정지 | 풀 패키지가 "마지막 수단" 정체성과 정합 |
| D4 | 한도: 무료 1/일, 프리미엄 10/일, 스누즈 없음 | 학대 방지 + Premium 차별화 |
| D5 | 게이팅: 누구나 사용, 한도만 차등 | 안전 기본기 — 페이월 뒤로 숨기지 않음 |
| D6 | 전달: 실시간 + 10분 큐(FCM TTL=600s) + 5분 reminder push | 골든타임 보호 |
| D7 | 쿼터: 확인 전달 시에만 차감 | 안 닿은 시도가 한도를 갉아먹지 않음 |
| D8 | 자동 종료: 15초 hard cap | 60초는 아이 노이즈 가두기 위험. 15초면 인지 충분 |
| D9 | DND 우회: `USAGE_ALARM` + `setFullScreenIntent` + `setShowWhenLocked` 4중 안전망 | 사용자 권한 그랜트 0회 |
| D10 | UI 카피: "그만 울릴께요" (부모 정지 버튼) | 사용자 지정 |
| D11 | 다자녀: v1 첫 child만, v1.2 child 선택 UI | 스코프 컨트롤 |

## 4. Architecture

```
┌─ 부모 단말 (web/PWA OR Android) ────────────────────────────────┐
│  설정 → 안전 도구 → 응급 강제 알람                                │
│  → 5초 long-press → 확인 모달 → supabase invoke push-notify      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  Edge Function: push-notify (action="force_ring", 확장)          │
│   1) auth.getClaims() + family_members.role='parent' (SEC-01)    │
│   2) client_request_hash 멱등                                     │
│   3) force_ring_check_quota RPC                                  │
│   4) target child 조회 (first only in v1)                        │
│   5) force_ring_events INSERT (delivered_at=null)                │
│   6) FCM data-only 발송 (priority=high, ttl=600s)                │
│   7) delivered_at UPDATE (성공) OR stop_reason='delivery_failed' │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  아이 단말 (Android, MyFirebaseMessagingService)                  │
│   data.action="force_ring" 수신                                   │
│   → ForceRingService 시작 (FOREGROUND_SERVICE_SPECIAL_USE)        │
│      • USAGE_ALARM 풀볼륨, force_ring_alarm.ogg 루프              │
│      • setFullScreenIntent → ForceRingActivity 자동 launch        │
│      • 15초 hard cap → stopSelf                                   │
│   → ForceRingActivity 풀스크린 표시                               │
│      • setShowWhenLocked + setTurnScreenOn                        │
│      • "확인했어요" 탭 → PATCH force_ring_events                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  실시간 부모 피드백 (Supabase Realtime)                           │
│   force_ring_events:id=eq.<event_id> 채널 subscribe              │
│   delivered_at / acknowledged_at / stopped_at 변경 → UI 전환      │
│   "그만 울릴께요" → action="force_ring_stop" Edge Function 호출   │
│                                                                   │
│  pg_cron 1분 단위 → reminder 후보 조회 → push-notify 호출         │
│   (delivered_at NOT NULL AND acknowledged_at IS NULL              │
│    AND triggered_at < now() - 5min AND reminder_sent_at IS NULL) │
└──────────────────────────────────────────────────────────────────┘
```

**재사용 패턴**: `remote_listen` (Edge action 분기) · `remote_listen_sessions` (audit table) · `kkuk_check_cooldown` (SECURITY DEFINER RPC) · `AmbientListenService` (FGS) · `RemoteListenActivity` (풀스크린 bridge) · `cleanup_push_idempotency` (pg_cron).

## 5. Data Model

### 5.1 Migration: `supabase/migrations/202604XX000000_force_ring.sql`

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.force_ring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  initiator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  message text CHECK (message IS NULL OR char_length(message) <= 80),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  stopped_at timestamptz,
  stop_reason text CHECK (stop_reason IN
    ('child_ack','parent_stop','auto_timeout','delivery_failed')),
  reminder_sent_at timestamptz,
  delivery_status jsonb DEFAULT '{}'::jsonb,
  client_request_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS force_ring_family_time_idx
  ON public.force_ring_events (family_id, triggered_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS force_ring_request_hash_idx
  ON public.force_ring_events (client_request_hash)
  WHERE client_request_hash IS NOT NULL;

-- 동시 active 트리거 방지 (가족당 1개만 stopped_at IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS force_ring_one_active_per_family_idx
  ON public.force_ring_events (family_id)
  WHERE stopped_at IS NULL;

ALTER TABLE public.force_ring_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS force_ring_select ON public.force_ring_events;
CREATE POLICY force_ring_select ON public.force_ring_events
  FOR SELECT TO authenticated
  USING (family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS force_ring_insert ON public.force_ring_events;
CREATE POLICY force_ring_insert ON public.force_ring_events
  FOR INSERT TO authenticated
  WITH CHECK (
    initiator_user_id = auth.uid()
    AND family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'parent'
    )
  );

DROP POLICY IF EXISTS force_ring_update_initiator ON public.force_ring_events;
CREATE POLICY force_ring_update_initiator ON public.force_ring_events
  FOR UPDATE TO authenticated
  USING (initiator_user_id = auth.uid())
  WITH CHECK (initiator_user_id = auth.uid());

DROP POLICY IF EXISTS force_ring_update_target ON public.force_ring_events;
CREATE POLICY force_ring_update_target ON public.force_ring_events
  FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid())
  WITH CHECK (target_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.force_ring_check_quota(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quota int;
  v_status text;
  v_used int;
BEGIN
  SELECT status INTO v_status
    FROM public.family_subscription
    WHERE family_id = p_family_id;

  v_quota := CASE
    WHEN v_status IN ('trial','active','grace') THEN 10
    ELSE 1
  END;

  SELECT COUNT(*) INTO v_used
    FROM public.force_ring_events
    WHERE family_id = p_family_id
      AND triggered_at > now() - interval '24 hours'
      AND (
        delivered_at IS NOT NULL
        OR (delivered_at IS NULL AND stop_reason IS NULL)
      );

  RETURN jsonb_build_object(
    'allowed', v_used < v_quota,
    'quota', v_quota,
    'used', v_used,
    'tier', COALESCE(v_status, 'free')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_ring_check_quota(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.force_ring_events;

SELECT cron.schedule(
  'force_ring_reminder_check',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/push-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('action', 'force_ring_reminder')
    );
  $cron$
);

SELECT cron.schedule(
  'force_ring_delivery_timeout',
  '*/2 * * * *',
  $cleanup$
    UPDATE public.force_ring_events
       SET stopped_at = now(),
           stop_reason = 'delivery_failed'
     WHERE delivered_at IS NULL
       AND stopped_at IS NULL
       AND triggered_at < now() - interval '10 minutes';
  $cleanup$
);

COMMIT;
```

### 5.2 Down migration

`supabase/migrations/down/202604XX000000_force_ring.sql`:
- `cron.unschedule('force_ring_reminder_check')`
- `cron.unschedule('force_ring_delivery_timeout')`
- `ALTER PUBLICATION supabase_realtime DROP TABLE public.force_ring_events`
- `DROP FUNCTION public.force_ring_check_quota(uuid)`
- 모든 정책 DROP
- `DROP TABLE public.force_ring_events`

### 5.3 RLS Matrix

| Role | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Family parent | ✅ 자기 가족 | ✅ 자기 가족 (initiator=self) | ✅ initiator=self만 | ❌ |
| Family child | ✅ 자기 가족 | ❌ | ✅ target=self만 | ❌ |
| Other family | ❌ | ❌ | ❌ | ❌ |
| Anonymous | ❌ | ❌ | ❌ | ❌ |
| service_role | ✅ | ✅ | ✅ | ✅ |

## 6. Edge Function Changes

### 6.1 File: `supabase/functions/push-notify/index.ts`

새 액션 3개 분기 추가. 인증·FCM 헬퍼는 기존 코드 재사용.

#### Action 1: `force_ring`

```
요청: { action: "force_ring", family_id, message?, client_request_hash }
응답 200: { event_id, delivered: bool, quota_remaining: int }
응답 423: { error: "force_ring_already_active", active_event_id }
응답 429: { error: "force_ring_quota_exceeded", quota, used, tier }
응답 403: { error: "force_ring_requires_parent" }
응답 404: { error: "no_child_in_family" }
응답 500: { error: "delivery_failed", details }

흐름:
1. JWT 검증 (auth.getClaims)
2. family_members.role='parent' 확인
3. client_request_hash 멱등 SELECT — 있으면 기존 event_id 반환
4. force_ring_check_quota RPC — allowed=false면 429
5. family_members.role='child' 첫 row 조회
6. force_ring_events INSERT (UNIQUE partial index가 동시 active 차단)
   → 실패 시 423 + 기존 active_event_id
7. native_push_tokens 조회 (target_user_id)
8. FCM 발송:
     priority: "high"
     android: { priority: "HIGH", ttl: "600s", direct_boot_ok: true }
     data: { action: "force_ring", event_id, message, initiator_name }
9. 응답 분석 → delivered_at UPDATE OR stop_reason='delivery_failed' UPDATE
10. 응답 반환
```

#### Action 2: `force_ring_stop`

```
요청: { action: "force_ring_stop", event_id }
응답 200: { stopped: true }
응답 403: { error: "not_initiator" }
응답 404: { error: "event_not_found" }

흐름:
1. JWT 검증
2. force_ring_events SELECT — initiator_user_id=auth.uid() 검증
3. UPDATE stopped_at=now(), stop_reason='parent_stop'
4. target_user_id의 FCM 토큰으로 data-only 발송:
     data: { action: "force_ring_stop", event_id }
5. 응답 반환
```

**중요**: 부모 정지는 **반드시 이 Edge Function 통해서만** 수행해야 함. RLS는 initiator의 직접 UPDATE를 허용하지만, 클라이언트에서 직접 `supabase.from('force_ring_events').update(...)` 호출하면 child 단말에 FCM 정지 신호가 전달되지 않아 아이 단말이 15초 자동 종료까지 계속 울림. 클라이언트 lib (`src/lib/forceRing.js`) 의 `stopForceRing()` 헬퍼만 사용 (내부적으로 이 Edge action 호출).

#### Action 3: `force_ring_reminder`

```
요청: { action: "force_ring_reminder" } + Authorization: Bearer <service_role_key>
응답 200: { reminded_count: int }
응답 401: { error: "service_role_required" }

흐름:
1. Bearer 토큰 == SUPABASE_SERVICE_ROLE_KEY 검증
2. SELECT id, family_id, initiator_user_id
     FROM force_ring_events
     WHERE delivered_at IS NOT NULL
       AND acknowledged_at IS NULL
       AND stopped_at IS NULL
       AND triggered_at < now() - interval '5 minutes'
       AND triggered_at > now() - interval '15 minutes'
       AND reminder_sent_at IS NULL
3. 각 row 에 대해 initiator의 FCM/Web Push 발송:
     title: "응급 신호 5분 경과"
     body: "아이 응답이 없습니다. 직접 통화나 119를 고려하세요"
     data: { action: "force_ring_reminder", event_id }
4. UPDATE reminder_sent_at = now()
5. 처리 카운트 반환
```

## 7. Native Android

### 7.1 신규 파일

| 파일 | 역할 |
|---|---|
| `ForceRingService.java` | FGS, USAGE_ALARM 사운드, 15초 hard cap |
| `ForceRingActivity.java` | 풀스크린 takeover, "확인했어요" 단일 버튼 |
| `ForceRingRequestStore.java` | event_id 별 launcher 중복 방지 |
| `res/layout/activity_force_ring.xml` | 빨간 배경 풀스크린 layout |
| `res/raw/force_ring_alarm.ogg` | ≤3초 알람 사운드 자산 |
| `res/values/styles.xml` (확장) | `Theme.Hyeni.ForceRing.Fullscreen` 추가 |

### 7.2 수정 파일

| 파일 | 변경 |
|---|---|
| `MyFirebaseMessagingService.java` | `data.action == "force_ring"` / `"force_ring_stop"` 분기 |
| `AndroidManifest.xml` | 권한 5개 + Service + Activity 등록 |
| `NotificationHelper.java` | `ensureForceRingChannel()` 메서드 추가 |

### 7.3 AndroidManifest.xml 추가

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<service
  android:name=".ForceRingService"
  android:foregroundServiceType="specialUse"
  android:exported="false">
  <property
    android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
    android:value="emergency_parental_alert" />
</service>

<activity
  android:name=".ForceRingActivity"
  android:showOnLockScreen="true"
  android:turnScreenOn="true"
  android:excludeFromRecents="true"
  android:launchMode="singleInstance"
  android:exported="false"
  android:theme="@style/Theme.Hyeni.ForceRing.Fullscreen" />
```

### 7.4 DND 우회 — 4중 안전망

| 메커니즘 | 보장 | 권한 그랜트 |
|---|---|---|
| `AudioAttributes.USAGE_ALARM` 스트림 | 무음/DND에서도 사운드 재생 | 불필요 |
| Channel `setBypassDnd(true)` | NPA 그랜트 사용자엔 채널 자체 DND 우회 (보너스) | 옵션 |
| `setFullScreenIntent` + `CATEGORY_ALARM` | 백그라운드에서 풀스크린 Activity 강제 launch | 불필요 (Family exception) |
| `setShowWhenLocked` + `setTurnScreenOn` | Activity 자체 잠금 위 표시 + 화면 ON | 불필요 |

### 7.5 자동 종료

```java
// ForceRingService.onStartCommand 마지막
new Handler(Looper.getMainLooper()).postDelayed(this::stopSelf, 15_000L);

// ForceRingService.onDestroy
mediaPlayer.stop();
audioManager.setStreamVolume(STREAM_ALARM, originalAlarmVolume, 0);
vibrator.cancel();
patchForceRingStopped(eventId, "auto_timeout");
sendBroadcast(new Intent("com.hyeni.calendar.FORCE_RING_STOP"));
```

### 7.6 Play Console disclosure

`FOREGROUND_SERVICE_SPECIAL_USE` 사유:
> "Emergency parental alert service. Activated only by explicit parent trigger via 5-second long-press confirmation. Plays alarm sound on USAGE_ALARM stream and displays full-screen UI for up to 15 seconds. Auto-terminates. Child can dismiss with single tap. All triggers logged in immutable audit table for transparency. Same Family-exception as remote listen feature."

## 8. Parent UI Flow

### 8.1 Component tree (App.jsx 내 추가, decomposition 금지 정책 준수)

```
ForceRingPanel                   (안전 도구 섹션 자식, 컬랩스 가능)
├── ForceRingTriggerButton       (5초 long-press + progress ring + 햅틱)
├── ForceRingConfirmModal        (메시지 입력 + 최종 확인)
├── ForceRingActiveStatus        (Realtime subscription + 6개 상태 분기)
└── ForceRingHistory             (최근 10건 audit)
```

추정 추가 라인: 250-300줄. 모듈 분해는 v1.2 REFACTOR-01 까지 보류.

### 8.2 진입 위치

`설정 → 안전 도구 → 응급 강제 알람` (메인 화면 노출 안 함, 의도적 한 단계 깊이)

### 8.3 상태 다이어그램

```
[기본] ──long-press 5s──▶ [확인 모달] ──확인──▶ [전송중]
   ▲                          │                    │
   │                          ▼ 취소               ▼
   │                       [기본]          ┌───────┴──────────────┐
   │                                       ▼                      ▼
   │                                [전달됨·응답대기]      [전달실패/쿼터초과]
   │                                       │                      │
   │       ┌─────────────────┬─────────────┤                      │
   │       ▼                 ▼             ▼                      ▼
   └──[확인됨]         [부모정지]       [자동종료]              [폴백 안내]
       (3s 후 닫힘)
```

### 8.4 카피 (한국어 톤 일관)

| 위치 | 카피 |
|---|---|
| 패널 제목 | "응급 강제 알람" |
| 설명 | "아이 폰이 무음·방해금지여도 풀볼륨 알람을 15초간 강제로 울립니다. 진짜 응급 시에만 사용하세요." |
| 트리거 버튼 | "5초 누르고 있기 (응급 신호 발송)" |
| Long-press 진행 중 | "응급 알람을 발송하려면 계속 누르세요... (N초 남음)" |
| 확인 모달 제목 | "정말 응급 신호를 보낼까요?" |
| 메시지 placeholder | "예: 지금 바로 전화 줘" |
| 확인 버튼 | "응급 신호 보내기" |
| 전달됨 | "✓ 전달됨 HH:MM:SS" |
| 응답 대기 | "아이 응답 대기 중..." |
| 부모 정지 버튼 | **"그만 울릴께요"** |
| 확인됨 | "✓ 아이가 확인했어요 — HH:MM:SS (N초 응답)" |
| 전달 실패 | "✗ 전달 실패 — 아이 폰이 오프라인이거나 배터리가 꺼졌을 수 있습니다." |
| 폴백 버튼 | "📞 직접 통화하기" / "🚨 119" |
| 쿼터 초과 (무료) | "⚠ 오늘 사용 한도 초과 (1/1). 프리미엄으로 업그레이드하면 일 10회까지 사용할 수 있습니다." |
| Reminder 푸시 (5분) | "응급 신호 5분 경과 — 아이 응답이 없습니다. 직접 통화나 119를 고려하세요." |

### 8.5 Edge case 처리

| 상황 | UI 동작 |
|---|---|
| 부모 trigger 후 앱 끄고 다시 열기 | Realtime + 초기 fetch에서 active row 발견 → 자동으로 active status 화면 복원 |
| 부모가 다른 채널로 안전 확인 | "그만 울릴께요" → parent_stop |
| 공동 양육 부모 동시 trigger | client_request_hash로 멱등, 두 번째는 423 + 기존 active 화면 |
| 가족에 child 0명 | 패널 진입 자체 비활성 + "아이 페어링 후 사용 가능" 안내 |
| 다자녀 가족 | "다자녀 대상 선택은 v1.2 예정" 배너 + 첫 child 자동 선택 |

### 8.6 접근성

- min touch target 56pt
- aria-label 모든 버튼
- 색맹 고려: 빨강/녹색만이 아니라 아이콘(✓/✗/🛑) 동반
- 메시지 80자 카운터 (서버 CHECK + 클라 1차 방어)
- 모바일/데스크탑 long-press 동등 처리 (mouse down ≥5s)

## 9. Child Full-Screen UI

### 9.1 Layout sketch

```
┌────────────────────────────────────────┐
│  (빨간 #DC2626 배경, 시스템 바 숨김)     │
│         🚨 (펄싱)                       │
│      응급 신호                          │
│      엄마                               │
│      14:32:15                          │
│   ┌──────────────────────────┐         │
│   │ "지금 바로 전화 줘"        │         │ ← 메시지 카드 (있을 시, 잠금 시 블러)
│   └──────────────────────────┘         │
│   알람 자동 종료까지 ●●●●○ (4초 남음)   │
│ ┌────────────────────────────────┐    │
│ │      ✓ 확인했어요              │    │ ← 단일 큰 버튼 (80dp)
│ └────────────────────────────────┘    │
│  ※ 부모님이 응급으로 보낸 신호이며       │
│     무음모드를 우회했어요               │
└────────────────────────────────────────┘
```

### 9.2 카피 (공감 톤)

| 위치 | 카피 |
|---|---|
| 헤더 | "응급 신호" |
| 서브 | "엄마/아빠가 지금 너를 찾고 있어요" (메시지 없을 때) |
| 메시지 카드 헤더 | "부모님이 남긴 메시지" |
| 자동 종료 | "알람 자동 종료까지 N초" |
| 버튼 | "확인했어요" |
| 푸터 | "부모님이 응급 신호로 보낸 알람이라 무음모드를 우회했어요" |
| 부모 원격 정지 | "부모님이 알람을 종료했어요" |
| ack 후 토스트 | "부모님에게 확인 알림이 갔어요" |

### 9.3 잠금 화면 sensitive content

- PIN 잠금 + 잠금 상태: 메시지 카드 `View.GONE` (PIPA 미성년자 사생활 보호)
- "확인했어요" 탭은 PIN 입력 없이 가능 (응급 동작)
- ack 후 finish, 1.5초 fade out

## 10. Edge Cases & Error Handling

### 10.1 네트워크 / 전달 실패

| 위치 | 부모 화면 | DB |
|---|---|---|
| 부모 → Edge (인터넷 끊김) | "재시도" 버튼 | INSERT 안 됨 |
| Edge → FCM 장애 | 폴백 안내 | `delivery_failed`, 미차감 |
| FCM TTL 만료 | "10분 후 자동 취소" | 10분 후 cron이 `delivery_failed` UPDATE |
| 늦은 도착 (오프라인 복귀) | "전달됨 (지연)" | `delivered_at = now()` |
| ack PATCH 실패 | 로컬 pending ack 저장 후 재시도 | 부모 화면 잠시 대기 후 "확인됨" |

### 10.2 권한 / 단말 상태

- POST_NOTIFICATIONS 거부 → 사운드 재생, 풀스크린 미표시, 부모에 fallback 알림
- USE_FULL_SCREEN_INTENT 거부 → heads-up 노티만, fallback
- 도즈 모드 → high-priority FCM이 깨움
- 배터리 절약 → 동작
- Force-stopped → FCM 깨우기 불가, timeout 처리

### 10.3 동시성

- 더블 탭 → client_request_hash 멱등
- 공동 양육 동시 trigger → 첫 INSERT만 성공 (UNIQUE partial index)
- 14.9초 ack vs auto_timeout → `WHERE stopped_at IS NULL` 조건으로 한쪽만 적용
- 부모 stop vs 아이 ack → 같은 패턴

### 10.4 데이터 정합성

- 모든 시각 서버 `now()` 기록
- 가족 탈퇴 → RLS가 자연 처리
- subscription 만료 → 진행 중 알람 영향 없음, 새 trigger부터 새 한도

### 10.5 다자녀 / 미페어링

- child 0명 → UI 진입 차단
- child 2+ → 첫 child만, v1.2 후속

### 10.6 멱등성 / 재시도

- client_request_hash UNIQUE
- Edge 인서트 후 FCM 전 crash → row pending, 24h 후 stale (보수적 1회 차감 유지)
- pg_cron timeout → reminder_sent_at 기록되어 재발송 없음

### 10.7 Android 버전 분기

| API | 처리 |
|---|---|
| 24-25 | window flag만 |
| 26+ | NotificationChannel 필수 |
| 29+ | full-screen intent 강제 |
| 31+ | PendingIntent FLAG_IMMUTABLE |
| 33+ | POST_NOTIFICATIONS 런타임 |
| 34+ | FGS_SPECIAL_USE + USE_FULL_SCREEN_INTENT appop |

### 10.8 모니터링

- delivery_failed > 10% / 24h → Slack alert
- acknowledged NULL + auto_timeout > 50% → Native 디버깅
- 쿼터 초과 빈도 → 프리미엄 전환 신호
- reminder 후 ack 비율 → 효과 측정

### 10.9 보안 / 남용

- 24h 1회 = 의도된 학대 한도, 추가 차단 어려움 → 부모 history 시각화로 자기 인지
- 5초 long-press JS 우회 가능 → 서버 쿼터로 절대 한도 보장 (5초는 UX 마찰일 뿐)

## 11. Testing Strategy

### 11.1 Vitest (`npm run test`)

| 파일 | 검증 |
|---|---|
| `tests/forceRingQuota.test.js` | RPC 응답 형식, 무료/프리미엄 분기, pending/failed 카운트 |
| `tests/forceRingClient.test.js` | client lib: hash 자동 생성, 80자 truncation, 5s timeout, 응답 분기 |
| `tests/forceRingPanel.test.jsx` | Long-press progress, cancel, 모달 카운터, 쿼터 초과 paywall CTA |
| `tests/forceRingActiveStatus.test.jsx` | Realtime mock, 상태 분기 렌더, "그만 울릴께요" 동작 |
| `tests/forceRingHistory.test.js` | 정렬, 한국어 라벨 |
| `tests/nativeForceRingService.test.js` | Bridge mock, 15초 cap, USAGE_ALARM 검증 |

목표: 신규 모듈 80%+ 커버리지

### 11.2 Playwright 모의 (`npm run test:e2e`)

| 파일 | 시나리오 |
|---|---|
| `tests/e2e/force-ring-trigger.spec.js` | 진입 → long-press → 모달 → 보내기 → "전달됨" |
| `tests/e2e/force-ring-quota.spec.js` | 무료 1회 → 두 번째 paywall + 폴백 |
| `tests/e2e/force-ring-failure.spec.js` | Edge 500 → 실패 배너 + 119 + 미차감 |
| `tests/e2e/force-ring-realtime.spec.js` | Realtime mock, ack → "확인됨" 자동 전환 |

### 11.3 Playwright real-services (`--config=playwright.real.config.js`)

| 파일 | 시나리오 |
|---|---|
| `tests/e2e/real/force-ring-end-to-end.spec.js` | 부모 trigger → INSERT → child FCM → auto-ack → 부모 "확인됨" → DB 검증 |
| `tests/e2e/real/force-ring-quota-real.spec.js` | 무료 1회 → 2회 429, tier toggle 검증 |
| `tests/e2e/real/force-ring-stop.spec.js` | trigger → "그만 울릴께요" → child force_ring_stop FCM → DB stop_reason |
| `tests/e2e/real/force-ring-reminder.spec.js` | trigger → 5분 대기 → reminder push → reminder_sent_at UPDATE (slow test, CI 분리 태그) |

### 11.4 Migration test

| 검증 | 방법 |
|---|---|
| Forward BEGIN/COMMIT | Shadow DB 적용, 모든 객체 + RLS 매트릭스 |
| Down 역적용 | down 적용 후 깨끗이 제거 확인 |
| 멱등 재실행 | IF NOT EXISTS 보장 |
| RLS 매트릭스 | 12개 조합 expected matrix |

### 11.5 Native 수동 (24개)

**사운드 우회 (4)**: 무음 / DND 일반 / DND 우선순위 / 미디어 재생 중
**잠금 화면 (5)**: PIN 없음 / PIN 잠금 / 메시지 블러 / 다른 풀스크린 위 / 화면 OFF
**도즈/배터리 (3)**: 도즈 모드 / 배터리 절약 / 자동 정리됨
**권한 거부 (3)**: POST_NOTIFICATIONS / USE_FULL_SCREEN_INTENT / 채널 끔
**동시성 (3)**: 즉시 정지 / 14.9초 ack / 공동 trigger
**Android 버전 (4)**: API 24 / 28 / 33 / 34
**종합 (2)**: 15초 자동 종료 + reminder 5분

### 11.6 검증 게이트

```bash
npm run verify
npx playwright test --config=playwright.real.config.js --grep="force.ring"
# Native 수동 24/24 통과
```

## 12. Compliance / Policy

| 항목 | 준수 방법 |
|---|---|
| **PIPA 안전조치** | force_ring_events immutable audit log (DELETE 정책 부재), 미성년자 sensitive content 잠금 시 블러 |
| **Google Play Family Exception** | FOREGROUND_SERVICE_SPECIAL_USE + persistent notification + non-stealth + 명시적 부모 trigger only + Play Console disclosure |
| **Stalkerware 회피** | 자동 트리거 0, 전체 풀스크린 takeover, 아이가 즉시 dismiss 가능 |
| **OWASP MASTG safety logging** | sos_events 패턴 그대로 — initiator, target, 시각, 결과 모두 기록 |
| **남용 방지** | 무료 1/일, 프리미엄 10/일, 부모 history 시각화로 자기 인지 |

## 13. Future Work (Out of Scope)

| ID | 후속 |
|---|---|
| FR-NEXT-01 | 다자녀 child 선택 UI + 동시 broadcast |
| FR-NEXT-02 | 기능 2 (친구놀이 안전) — 별도 spec, cross-family 모델 |
| FR-NEXT-03 | iOS 지원 (현 Capacitor Android only 정책 변경 시) |
| FR-NEXT-04 | 부하 테스트 + reminder 효과 측정 대시보드 |
| FR-NEXT-05 | 운영 모니터링 (delivery_failed 비율) → OBS-02 와 통합 |
| FR-NEXT-06 | 가정 폭력 도구화 자기 인지 — 부모 측 "최근 7일 trigger 시각화" |

## 14. Acceptance Criteria

이 spec 기준 implementation 완료 = 다음 모두 통과:

1. ✅ Migration forward + down 양방향 적용 가능, RLS 12개 조합 매트릭스 통과
2. ✅ Edge Function 3개 액션 정상 동작 (force_ring / force_ring_stop / force_ring_reminder)
3. ✅ 부모 단말 (web + Android) 진입 → trigger → 6개 상태 모두 정상 표시
4. ✅ 아이 단말 무음/DND/잠금 + Android 24/28/33/34 4개 API 레벨에서 풀스크린 + 풀볼륨 알람 동작
5. ✅ 15초 자동 종료, 부모 원격 정지, 아이 ack 모두 정상
6. ✅ 무료 1/일 + 프리미엄 10/일 한도 서버 측 강제, 전달 실패 시 미차감
7. ✅ 5분 reminder 푸시 발송 + reminder_sent_at 기록
8. ✅ Vitest 커버리지 80%+ + Playwright real-services 4개 시나리오 통과
9. ✅ Native 수동 체크리스트 24/24 통과
10. ✅ Google Play Console disclosure 제출 + Family Exception 검토 통과

---

*Spec generated: 2026-04-27 by `/superpowers:brainstorming`*
*Next: implementation plan via `superpowers:writing-plans`*
