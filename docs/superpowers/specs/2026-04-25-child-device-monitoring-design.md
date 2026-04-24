# Design: 아이 스마트폰 정보 대시보드 (Digital Safety Dashboard)

| Field | Value |
|---|---|
| Status | Approved for planning |
| Brainstormed | 2026-04-25 (Saturday) |
| Target milestone | **v1.4 "Digital Safety Dashboard"** (신규) |
| Source | `/superpowers:brainstorming` 세션, 브라우저 와이어프레임 승인 포함 |
| Superseded by | — |
| Feeds into | `/superpowers:writing-plans` (다음 단계) |

---

## 1. 문제와 동기

혜니캘린더의 컨셉은 "안전 + 스케쥴"이다. **아이의 스마트폰 사용 자체가 디지털 안전의 일부**이므로, 부모가 아이 기기의 **사용 시간·앱 통계·기기 상태**를 확인할 수 있어야 한다. 기존 기능(주위소리듣기, SOS, 위치)은 물리/정서 안전이지만, 스마트폰 사용 관찰은 **디지털 안전** 축을 메운다.

**채택된 범위 (브레인스토밍 합의):**
- **데이터**: 사용 시간·앱 통계 + 설치된 앱 목록 + 기기 상태 (배터리·연결·전원)
- **권한 모델**: 읽기 전용 (제어/차단 없음)
- **갱신**: 매일 자정 정산 + 부모 온디맨드 리프레시
- **플랫폼**: Android 전용 (프로젝트 stack lock)

**제외(명시):** 통화/SMS 내용, 사용 시간 제한·차단, iOS, 실시간(분 단위) 업데이트, 새 npm dep 도입, `src/App.jsx` 분해. 자세한 목록은 §11.

---

## 2. 마일스톤 배치

**v1.4 "Digital Safety Dashboard"** 신규 마일스톤으로 배치.

**배치 근거:**
- v1.1 (활성, Native Deploy & Polish) / v1.2 (스테이징, Sound Around & Consent Port) / v1.3 (예정, SOS Hardening) 어느 쪽과도 스코프가 겹치지 않음.
- 구현적으로 v1.2의 `family_agreements` + `feature_flags` + `family_subscription` 확장이 **전제조건**이므로 v1.2 complete 이후 시작이 자연스러움.
- SOS(v1.3)와는 코드 경로가 독립(다른 테이블·채널·컴포넌트)이므로 병행도 기술적으로 가능.

**대안(거부):** v1.2 스코프 확장은 잠금된 14-REQ 경계 위반. v1.1 삽입은 Phase 7 Android 빌드 스코프 교란.

---

## 3. 고수준 아키텍처

```
[아이 Android 기기]                              [Supabase]                 [부모 기기]
┌────────────────────┐                          ┌──────────────┐          ┌──────────────┐
│ DeviceStatsPlugin  │                          │              │          │              │
│  (Capacitor 8)     │                          │              │          │              │
│ ├ UsageStatsMgr    │                          │              │          │              │
│ ├ PackageManager   │                          │              │          │              │
│ └ BatteryManager   │                          │              │          │              │
│                    │   WorkManager periodic   │              │          │              │
│ DeviceStatsWorker  │ ────▶ INSERT ──▶ RLS ────▶ child_device │          │              │
│  (24h local time)  │                          │    _stats    │  SELECT  │  Dashboard   │
│                    │                          │    (30d TTL) │ ◀─────── │  (B card +   │
│                    │                          │              │          │   detail)    │
│ refresh.js         │                          │ device-stats │          │              │
│ ◀─── FCM data ─────┼─── push-notify ──────────│   -refresh   │ ◀── POST │              │
│      action:       │                          │  (edge func) │          │              │
│   device_stats_    │                          │              │          │              │
│   refresh          │                          │              │          │              │
└────────────────────┘                          └──────────────┘          └──────────────┘
                                                       │
                                                       ▼
                        3중 게이트: feature_flags.device_stats_enabled = true
                                  AND family_agreements.device_stats_monitoring_enabled = true
                                  AND family_subscription.device_stats_monitoring_enabled = true
```

**핵심 원칙:**
- v1.1 FCM data-wake 경로 / v1.2 consent·flag·kill-switch 프레임워크 재사용 최대화
- 새 노출(플러그인·테이블·엣지)은 최소한으로
- App.jsx 는 라인 치환만, 분해 없음

---

## 4. 컴포넌트 (파일 트리)

### Android 네이티브 (Capacitor 8)
```
android/app/src/main/java/com/hyeni/calendar/
├── DeviceStatsPlugin.java          [신규] Capacitor @CapacitorPlugin
│                                         start()/stop()/getStats()/requestPermissions()
├── DeviceStatsCollector.java       [신규] UsageStats + PackageManager +
│                                         BatteryManager 통합 리더 (Robolectric-testable)
├── DeviceStatsWorker.java          [신규] androidx.work.Worker (24h periodic,
│                                         Constraints.NOT_LOW_BATTERY + NETWORK_UNMETERED 선호)
└── MainActivity.java               [수정] registerPlugin(DeviceStatsPlugin.class)

android/app/src/main/AndroidManifest.xml
                                    [수정] <uses-permission PACKAGE_USAGE_STATS />
                                           <uses-permission QUERY_ALL_PACKAGES
                                             (Play Declaration 필요)/>
```

### JavaScript/React
```
src/lib/deviceStats/
├── collector.js                    [신규] DeviceStatsPlugin JS wrapper
├── dailyDigest.js                  [신규] 원시 이벤트 → payload 집계
├── sync.js                         [신규] Supabase insert + 재시도 + RLS 에러 매핑
└── refresh.js                      [신규] FCM 수신 → 즉시 수집·업로드

src/components/childSafety/
├── ChildDeviceCard.jsx             [신규] 홈 4-칩 카드 (B 안 확정)
├── DeviceStatsDashboard.jsx        [신규] 상세 대시보드 entry
├── ScreenTimeCard.jsx              [신규] 히어로: 스크린타임 + 7일 차트
├── TopAppsList.jsx                 [신규] TOP5 앱 바 리스트
├── InstalledAppsPanel.jsx          [신규] 설치 앱 총수 + 신규 설치 하이라이트
├── DeviceStatusCard.jsx            [신규] 배터리/충전/저배터리 24h 타임라인
└── EmptyStatePanel.jsx             [신규] 미동의/미권한/오프라인 상태

src/App.jsx                         [수정] 라인 범위 Phase 플래닝 시 확정
                                           (라인 치환만)
src/lib/pushNotifications.js        [수정] action === 'device_stats_refresh' 분기 추가
```

### Supabase
```
supabase/migrations/
├── NNNNNN_child_device_stats.sql               [신규] 메인 테이블 + RLS + trigger + TTL cron
├── NNNNNN_family_agreements_device_stats.sql   [신규] 동의서 열 확장 + v2.1 bump
├── NNNNNN_family_subscription_device_stats.sql [신규] kill switch 열 추가
└── NNNNNN_feature_flag_device_stats.sql        [신규] flag row seed (기본 OFF)

supabase/migrations/down/                       [신규] 위 4개 역방향
supabase/functions/device-stats-refresh/
└── index.ts                                    [신규] 부모 요청 → SEC-01 가드 →
                                                        FCM data-wake 전송
```

### 테스트
```
tests/unit/
├── dailyDigest.test.js                         [신규]
├── sync.test.js                                [신규]
├── refresh.test.js                             [신규]
└── consent/agreement.test.js                   [신규] (device_stats 조항 확장분)

tests/e2e/
├── device-stats-consent.spec.js                [신규] Playwright real-config
└── device-stats-refresh.spec.js                [신규]

android/app/src/test/java/com/hyeni/calendar/
├── DeviceStatsCollectorTest.java               [신규] Robolectric
├── DeviceStatsWorkerTest.java                  [신규] WorkManager TestDriver
└── DeviceStatsPluginTest.java                  [신규]

supabase/tests/
└── child_device_stats_rls.sql                  [신규] RLS + 3중 게이트 검증

supabase/functions/device-stats-refresh/
└── test.ts                                     [신규] Deno test runner
```

**총계**: 신규 24개 · 수정 4개 (MainActivity · AndroidManifest · App.jsx · pushNotifications.js).

---

## 5. 데이터 흐름

### 흐름 ①: 최초 동의 + 권한 설정

```
[아이 기기]
  페어링 완료 이벤트
    → AgreementModal (v1.2 CONSENT-02 확장)
       체크박스: "매일 밤 사용 통계를 부모님께 공유"
    → 동의 시: agreement.js
         signature_sha256 = SHA256(shown_text + "device_stats_v1")
         INSERT family_agreements (..., device_stats_monitoring_enabled=true,
                                   agreement_version='v2.1', signature_sha256,
                                   device_stats_opted_in_at=now())
    → DeviceStatsPlugin.requestPermissions()
         Settings.ACTION_USAGE_ACCESS_SETTINGS 로 시스템 설정 이동
         사용자가 "혜니캘린더" 토글 ON → 복귀
         hasUsageStatsPermission() true 면 완료 배너
    → DeviceStatsWorker.enqueuePeriodic(Interval=1d)
    → 아이 모드 설정 화면: 영구 상태 카드
         "📊 사용 통계를 매일 부모님께 공유 중" (해제 토글 포함)
```

### 흐름 ②: 매일 자정 정산 (백그라운드)

```
[아이 기기] 00:00 로컬 시간 전후 (WorkManager 재량)
  DeviceStatsWorker.doWork()
    → DeviceStatsCollector.collect(dateRange=yesterday 00:00~23:59)
        UsageStatsManager.queryUsageStats(INTERVAL_DAILY, start, end)
          → 앱별 totalTimeInForeground (ms)
        PackageManager.getInstalledApplications(MATCH_ALL)
          → package names + install time + system/user flag
        BatteryManager 현재 레벨 + Intent.ACTION_BATTERY_CHANGED sticky
          + SharedPreferences 시간별 snapshot 누적
    → dailyDigest.js: 집계
        { schema:'v1',
          screen_time_minutes: 237,
          top_apps: [{pkg,label,minutes}, ...up to 10],
          installed_count: 84,
          apps_added: ['com.newapp.example'],
          apps_removed: [],
          battery: {now, avg, low_events, charge_sessions, low_ranges:[['04:12','05:03']]},
          connectivity_uptime_pct: 96 }
    → sync.js: supabase.from('child_device_stats').insert({
         family_id, child_user_id, stat_date, payload,
         collected_at: now(), source:'scheduled', agreement_version
      })
    → RLS 자동 검증: auth.uid()=child_user_id AND family 소속
    → trigger BEFORE INSERT: 3중 게이트 평가 (§9 참고)
    → 실패 시 WorkManager 기본 backoff (30s→1m→5m→...×10)
    → 성공 시 SharedPreferences last_sync_at 기록
```

### 흐름 ③: 부모 온디맨드 새로고침

```
[부모 기기] Dashboard → "지금 새로고침" 탭
    → fetch('/functions/v1/device-stats-refresh',
        { method:'POST', body:{ child_user_id } })

[Edge Function device-stats-refresh]
  (1) JWT verify → parent_user_id
  (2) SEC-01 패턴: parent_user_id ∈ family_members AND role='parent'
  (3) family_agreements.device_stats_monitoring_enabled = true 확인
  (4) feature_flags.device_stats_enabled = true 확인
  (5) family_subscription.device_stats_monitoring_enabled = true 확인
  (6) 모두 통과 → FCM data-message 발송:
        { action:'device_stats_refresh', request_id: uuid(), requested_at: now() }
        to: push_subscriptions[child 기기]
  (7) 즉시 { ok:true, request_id } 응답 반환 (non-blocking)

[아이 기기] MyFirebaseMessagingService.onMessageReceived(data)
  → switch(data.action)
      case 'device_stats_refresh':
        refresh.js → DeviceStatsCollector.collect(TODAY_PARTIAL, 00:00~now)
        → sync.js.upsert(stat_date=today, source='on_demand', request_id)

[부모 기기] Supabase Realtime subscription
  child_device_stats INSERT/UPDATE WHERE family_id=... AND stat_date=today AND source='on_demand'
  → Dashboard 상태 갱신 + "방금 업데이트됨" 배지

[부모 기기 클라이언트 타임아웃 15초] Realtime 이벤트 수신 없음 →
  "아이 기기에 연결할 수 없어요" 토스트 + "마지막 동기화: N시간 전" 표기
  (edge function 자체는 (7) 에서 즉시 반환하므로 타임아웃 소유권은 부모 클라이언트)
```

---

## 6. DB 스키마

### 신규 테이블 `public.child_device_stats`
```sql
create table public.child_device_stats (
  id              bigserial primary key,
  family_id       uuid not null references public.families(id) on delete cascade,
  child_user_id   uuid not null references auth.users(id) on delete cascade,
  stat_date       date not null,
  payload         jsonb not null,
  collected_at    timestamptz not null default now(),
  source          text not null check (source in ('scheduled','on_demand')),
  agreement_version text not null,
  created_at      timestamptz not null default now()
);

-- (family_id, child_user_id, stat_date, source) 튜플 단위 UNIQUE.
-- 'scheduled' 과 'on_demand' 는 같은 날짜에 공존 가능, 각각 1행.
-- on_demand upsert 의 onConflict 타겟으로도 사용.
create unique index child_device_stats_daily_unique
  on public.child_device_stats (family_id, child_user_id, stat_date, source);

create index child_device_stats_family_date_idx
  on public.child_device_stats (family_id, stat_date desc);
```

### Payload JSON 스키마 v1
```json
{
  "schema": "v1",
  "screen_time_minutes": 150,
  "top_apps": [{"pkg":"com.google.android.youtube","label":"YouTube","minutes":82}],
  "installed_count": 84,
  "apps_added":   ["com.example.new"],
  "apps_removed": [],
  "battery": {
    "now": 78, "avg": 71, "low_events": 1, "charge_sessions": 2,
    "low_ranges": [["04:12","05:03"]]
  },
  "connectivity_uptime_pct": 96,
  "error_code": null,
  "anomaly_flag": null
}
```

### RLS 정책
```sql
alter table public.child_device_stats enable row level security;

create policy "child inserts own stats" on public.child_device_stats
  for insert with check (
    child_user_id = auth.uid()
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = child_device_stats.family_id
        and fm.user_id   = auth.uid()
        and fm.role      = 'child'
    )
  );

create policy "family reads stats" on public.child_device_stats
  for select using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = child_device_stats.family_id
        and fm.user_id   = auth.uid()
    )
  );

create policy "child updates own on_demand" on public.child_device_stats
  for update using (child_user_id = auth.uid() and source = 'on_demand')
               with check (child_user_id = auth.uid() and source = 'on_demand');
-- DELETE: service_role only (TTL cron).
```

### 기존 테이블 확장 (v1.2 스테이징 기반)
```sql
-- family_agreements (v1.2 CONSENT-01 확장)
alter table public.family_agreements
  add column device_stats_monitoring_enabled boolean not null default false,
  add column device_stats_opted_in_at        timestamptz;
-- agreement_version: 'v2.0' → 'v2.1'

-- family_subscription (kill switch)
alter table public.family_subscription
  add column device_stats_monitoring_enabled boolean not null default true;

-- feature_flags (v1.2 FLAG-01 재사용, seed)
insert into public.feature_flags (key, enabled, updated_at)
values ('device_stats_enabled', false, now())
on conflict (key) do nothing;
```

### TTL cleanup (v1.1 IDEMP-TTL-01 패턴)
```sql
select cron.schedule('cleanup_child_device_stats', '15 3 * * *', $$
  delete from public.child_device_stats
  where stat_date < current_date - interval '30 days';
$$);
```

### Migration 파일 (up + down 페어)
- `supabase/migrations/NNNNNN_child_device_stats.sql` + down
- `supabase/migrations/NNNNNN_family_agreements_device_stats.sql` + down
- `supabase/migrations/NNNNNN_family_subscription_device_stats.sql` + down
- `supabase/migrations/NNNNNN_feature_flag_device_stats.sql` + down

---

## 7. UI 설계

**홈 레이아웃: 옵션 B 확정 — 독립 카드.**
- 기존 "우리 아이" 카드는 그대로 유지
- 그 아래 전용 `ChildDeviceCard` 추가
- 4-칩 구성: [스크린타임] [배터리] [TOP앱] [새앱]
- 탭 시 `DeviceStatsDashboard` 전체 화면 진입

**상세 대시보드 구성 (세로 스택):**
1. **히어로** — 오늘 스크린타임 + 7일 차트 (`ScreenTimeCard`)
2. **TOP 앱** — 오늘 많이 쓴 앱 TOP 5 (`TopAppsList`, 가로 바)
3. **설치 앱** — 총수 + 어제 신규 설치 하이라이트 (`InstalledAppsPanel`)
4. **기기 상태** — 배터리/충전/저배터리 24h 타임라인 (`DeviceStatusCard`)
5. **푸터** — 동의 내역 / 자동 수집 끄기 링크

**제약:**
- 새 npm dep 금지 → 차트는 SVG + CSS 자체 구현
- 카드·색상 톤은 혜니 design tokens (기존 스타일 파일 기반)
- 상단 네비 좌측 ← 뒤로가기, 우측 "↻ 새로고침" 버튼

**와이어프레임 참조 (파생 금지, 참고 전용):**
- 홈 카드: `.superpowers/brainstorm/1207-1777050602/content/parent-card-layout.html` (옵션 B)
- 상세: `.superpowers/brainstorm/1207-1777050602/content/detail-dashboard.html`

(상기 파일은 `.superpowers/` 가 `.gitignore` 되어 있으므로 로컬 전용. UI-SPEC 은 `/gsd-ui-phase` 단계에서 tokens 준수 버전으로 재생성.)

---

## 8. 에러 처리 + Kill Switch

### 에러 매트릭스

| 상황 | 아이 기기 동작 | 부모 대시보드 | 복구 |
|---|---|---|---|
| `PACKAGE_USAGE_STATS` 미부여 | `{error:'no_usage_access'}` payload 업로드 | "아이 기기 설정이 필요해요" 배너 + 가이드 | 부모 푸시로 링크 재전송 |
| 아이가 권한 나중 해제 | 다음 수집에 `no_usage_access` | "권한이 해제됐어요" FCM 알림 1회 | 아이측 재설정 |
| `family_agreements` 동의 해제 | 업로드 skip + WorkManager 일시 정지 | "아이 동의가 철회됐어요" | 재페어링 or 설정 재동의 |
| `family_subscription` kill switch OFF | RLS INSERT reject | "자동 수집이 꺼져 있어요" 토글 | 부모가 설정에서 ON |
| `feature_flags` OFF (글로벌) | Edge/INSERT `feature_disabled` 반환 | 대시보드 렌더 skip | 서버 수동 flip |
| FCM 온디맨드 15s 타임아웃 | 지연 or 누락 | "연결할 수 없어요" + 마지막 집계 시간 | 재탭 |
| 네트워크 오프라인 | WorkManager backoff 자동 | 어제 데이터 유지 | 네트워크 복구 시 자동 |
| 기기 종일 꺼짐 | `screen_time:0 + source_evidence:'device_off'` | "기기 사용 없음" 빈 상태 | 정상 |
| `agreement_version` 불일치 | 업로드 `agreement_stale` | 소프트 프롬프트 "동의서 업데이트됐어요" | 다음 페어링/설정 진입 시 재서명 |
| Payload 스키마 미래 버전 | `payload.schema` 체크, fallback | "앱 업데이트 필요" | Play 업데이트 |

**`agreement_stale` 정책**: 기존 수집은 멈추지 않음 (소프트). 다음 페어링·설정 진입 시 재서명 배너만 표시.

### Kill Switch 3중 방어 (fail-closed)
```
INSERT 시도
  → RLS 정책 (1차): auth.uid() 와 family_members 매칭
  → BEFORE INSERT trigger (2차):
      feature_flags.device_stats_enabled = true ? no → raise 'feature_disabled'
      family_subscription.device_stats_monitoring_enabled = true ? no → skip(noop)
      family_agreements.device_stats_monitoring_enabled = true ? no → raise 'consent_missing'
      agreement_version match ? no → raise 'agreement_stale'
  → INSERT 성공

SELECT (부모 조회)
  → RLS: auth.uid() ∈ family_members(family_id) ? no → 0 rows
  → feature_flags 는 클라이언트 UI 게이트 (렌더 skip)
```

**게이트 의미:**
- `feature_flags` = 글로벌 PagerDuty 킬스위치
- `family_subscription` = 가족 단위 토글 (부모 통제)
- `family_agreements` = 법적 동의 (PIPA · Play 증빙)

### 데이터 위생
- Payload 검증: Edge function 이 `schema`, `screen_time_minutes` 범위 (0 ≤ x ≤ 1440) 검증, 이상치는 `anomaly_flag` 기록
- RLS bypass 방지: 아이가 다른 `child_user_id` INSERT 시도 → 거부 (SEC-01 패턴)
- 중복 방지: `(family_id, child_user_id, stat_date, source)` 튜플 UNIQUE. `on_demand` 는 동일 튜플에 대해 upsert 로 최신값 덮어씀. `scheduled` 는 자정 집계 후 immutable

---

## 9. 테스트 전략

### 6계층 커버리지

**1. 단위 (Vitest)** — 80%+
- `dailyDigest.test.js`: 원시 이벤트 → 집계 payload (경계: 0분 / 24h 클램프 / 세션 합산 / 자정 split)
- `sync.test.js`: 업로드 shape, RLS 에러(42501) → `rls_denied` 매핑, 3중 게이트 실패 시 재시도 안 함
- `refresh.test.js`: FCM payload → WorkManager OneTime, 중복 request_id 무시
- `consent/agreement.test.js`: device_stats 조항 서명 해시 결정성

**2. Android 네이티브 (Robolectric)**
- `DeviceStatsCollectorTest`: UsageStatsManager 모의 파싱, PackageManager diff 로직, Battery 누적
- `DeviceStatsWorkerTest`: WorkManager TestDriver, 24h 주기, NETWORK_UNMETERED constraint, backoff
- `DeviceStatsPluginTest`: Capacitor Bridge 권한 분기

**3. DB/RLS (Supabase SQL tests, v1.0 패턴)**
- `child_device_stats_rls.sql`: 타가족 INSERT 거부, 타가족 SELECT 0행, 3중 게이트 4 분기, UNIQUE 검증

**4. Edge Function (Deno)**
- `device-stats-refresh/test.ts`: 401 / 403 × 3 (non-parent / no-agreement / flag-off) / 200 FCM dispatch 모의 / FCM 500 에러 매핑

**5. E2E (Playwright real-config, v1.2 precedent)**
- `device-stats-consent.spec.js`: 동의 없이 대시보드 → 빈 상태 / 동의 후 → 렌더 / 픽스처 주입 → 카드 표시 / kill switch OFF → "수집 꺼짐"
- `device-stats-refresh.spec.js`: 새로고침 → edge 200 모의 / 15s 타임아웃

**6. 실기기 (v1.1 APK CI 재사용)**
체크리스트 (Phase 18 E2E 조건):
1. APK 설치 → 페어링 → 동의 → UsageStats ON → 24h+ → 다음 자정 후 부모 대시보드에 데이터
2. "새로고침" → 15s 내 당일 부분 집계 수신
3. UsageStats OFF 전환 → 다음 수집 `no_usage_access` → 부모 배너 표시
4. kill switch 3종 각각 OFF → fail-closed 확인 (adb logcat skip 로그)

### 회귀 방지
- SEC-01 (push-notify sender∈family) grep 검증 — device-stats-refresh 에도 동일 가드
- 기존 remote_listen / family_agreements 동작 회귀 없음 확인

---

## 10. 마일스톤 구조 (v1.4)

| Phase | 이름 | Parallelism | 신규 REQ |
|---|---|---|---|
| 14 | Schema & Consent Extension | parallel ×3 (server-only) | STATS-SCHEMA-01 · STATS-CONSENT-01 · STATS-FLAG-01 |
| 15 | Android Collection Layer | solo (native 중심) | STATS-PLUGIN-01 · STATS-WORKER-01 · STATS-REFRESH-01 |
| 16 | Parent UI & On-Demand Edge | parallel ×2 | STATS-DASHBOARD-01 · STATS-CARD-01 · STATS-EDGE-01 |
| 17 | APK Rebuild & Submit | solo | STATS-APK-01 |
| 18 | Two-Device E2E & Rollout Flip | solo · user-in-loop | STATS-E2E-01 · STATS-ROLLOUT-01 |

**총 11 REQ · 5 phase · 예상 2주 (v1.1/v1.2 velocity 기준).**

### 전제조건
- ✅ v1.1 완료 — Android APK CI, MainActivity 패턴 (필수)
- ⏳ v1.2 완료 — `family_agreements`/`feature_flags`/`family_subscription` 확장 가능 스키마 (필수)
- ⏳ v1.3 SOS Hardening — 직접 의존 없음, 순서상 권장

### 완료 기준
1. 실기기 2대에서 자정 업로드 + 온디맨드 각각 **10회 연속 성공**
2. 3중 kill switch fail-closed **3/3 PASS**
3. 동의 없는 상태 SELECT/INSERT **3/3 차단**
4. Play Console family-exception 카피 수정 승인
5. `feature_flags.device_stats_enabled` flip 후 **24h 모니터링 이상 없음**

---

## 11. Out of Scope (v1.4)

| 항목 | 이유 | 이월 |
|---|---|---|
| 통화/SMS/알림 **내용** 열람 | Play Permissions Declaration · 스토커웨어 위험 | v2.0+ 법적 검토 후 |
| 사용 시간 **제한·차단**, 앱 원격 off | Device Admin / Accessibility 필요, Play 엄격 | v2.0+ |
| 위치 이력 수집 통합 | 기존 `locations` + v1.3 zoom-in 별도 | v1.3 |
| 웹 브라우징 기록 | Accessibility Service 필요 | 평가 보류 |
| iOS 지원 | stack lock | 영구 제외 |
| 실시간(분 단위) 업데이트 | 배터리/FGS 부담 | v2.0+ |
| 그래프 라이브러리 (Recharts 등) | 새 npm dep 금지 | 영구 제외 |
| 관측성 대시보드 | OBS-01..03 별도 마일스톤 | v1.5+ |
| 푸시 알림 (스크린타임 초과 등) | v1.4 는 대시보드만 | v2.0+ |
| `src/App.jsx` 분해 | CLAUDE.md 영구 금지 | 영구 제외 |

---

## 12. 제약 · 정책

### 프로젝트 locked (CLAUDE.md + v1.0/v1.1/v1.2 precedent)
- ✓ React 19.2 · Vite 7 · Capacitor 8.2 · Supabase · `@supabase/supabase-js@2.99.1` — 버전 변경 없음
- ✓ 새 npm dep **0개** (SVG+CSS 자체 차트, WorkManager는 이미 의존성 있음)
- ✓ `src/App.jsx` 분해 금지, 라인 치환만 — 라인 범위 Phase 플래닝 시 확정
- ✓ VAPID 키 회전 금지 (v1.0 D-A03)
- ✓ Supabase MCP 직배포 유지 (v1.0 precedent)

### Google Play 정책
- ✓ Family-exception 카테고리 유지 — 스토커웨어 경계 보강:
  - 아이 기기에 영구적으로 "공유 중" 표시 (아이 모드 설정 카드)
  - UsageStatsManager 는 Play family 카테고리에서 허용 권한
  - 콘텐츠(메시지/사진/위치) 수집 없음 — 통계/메타데이터만
- ✓ Play Console family-exception 카피 업데이트: "사용 시간 통계, 메타데이터만 수집, 제어·차단 기능 없음, 아이 기기에 상시 공시"

### PIPA
- ✓ `family_agreements.legal_rep_user_id` + `agreement_version` + `signature_sha256` 재사용
- ✓ `device_stats_monitoring_enabled` 개별 조항 + `device_stats_opted_in_at` timestamp
- ✓ 아이 기기에 "공유 중" 영구 공시 — 동의 철회 경로 상시 접근 가능

### SEC-01 (push-notify sender∈family) 상속
- ✓ `device-stats-refresh` edge function 에도 동일 가드 적용
- ✓ grep 회귀 체크 E2E 에 포함

### Codex Review 게이트 (v1.2 Codex Review Gate 상속)
- 매 Phase 완료 시 `/codex review` PASS 필수
- `src/lib/deviceStats/**`, `supabase/migrations/**`, `supabase/functions/**`, `android/**` 커밋 시 필수
- Model = config default (`gpt-5.4`)

---

## 13. 위험 · 완화

| 위험 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| UsageStatsManager 권한 그랜트 UX 부담 | 높음 | 중 | 최초 설정 시 명확한 가이드 + 부모 푸시로 링크 재전송 기능 |
| 아이가 기기를 오래 끄면 데이터 공백 | 중 | 낮음 | 빈 상태 UI 설계 완비. "기기 사용 없음" 명시 |
| Play Store 심사 지연/거부 | 낮음 | 높음 | Family-exception 카피 사전 준비, v1.1 precedent 활용 |
| WorkManager 자정 정확도 (±수시간) | 높음 | 낮음 | "자정 전후" 기준 명시, stat_date 로컬 타임존 고정 |
| QUERY_ALL_PACKAGES Declaration 거부 | 낮음 | 중 | 부분 fallback: PackageManager.getInstalledApplications() 제한 모드 (사용 기록 있는 앱만) |
| 기존 `family_agreements` 동의자 재서명 부담 | 중 | 낮음 | 소프트 프롬프트 정책 (§8), 다음 페어링 시 재서명 |
| FCM 온디맨드 지연(>15s) | 중 | 낮음 | "기기 꺼져있거나 오프라인" 안내 degrade |
| 새 npm dep 유혹 (차트 라이브러리) | 중 | 낮음 | 디자인 규칙: SVG+CSS 만 사용, 리뷰에서 거절 |

---

## 14. 오픈 퀘스천 (v1.4 discuss phase 에서 해결)

1. **stat_date 타임존** — Asia/Seoul 고정 vs 기기 로컬. 권장: Asia/Seoul 고정 (부모 UI 일관성).
2. **`apps_added` 로직** — 어제 snapshot 과의 diff vs `PackageManager.firstInstallTime` 사용. 권장: `firstInstallTime > 집계 시점 - 24h` (더 정확).
3. **TOP 앱 N** — 5 vs 10. 모바일 화면 공간상 5 가 기본, "전체 보기" 링크는 별도 모달.
4. **7일 차트 기간** — 7 vs 14 vs 30. 권장: 7 + "더 보기" 로 30일 전체.
5. **아이 모드 공시 강도** — 설정 화면 카드 vs persistent notification. v1.4 는 **설정 카드만**(주위소리듣기의 영구 알림과 톤 차별화). persistent notification 은 v2.0 이후.
6. **Family-exception 카피 wording** — `/gsd-discuss-phase 14` 에서 사용자 검토 필수 (auto 금지).
7. **Retention 기간** — 30 일 vs 60 일. 30 일 기본, 필요 시 bump.

---

## 15. 참조

### 상위 문서
- `CLAUDE.md` — 프로젝트 지침, stack lock, App.jsx 정책
- `.planning/ROADMAP.md` — v1.1 Native Deploy & Polish (활성)
- `.planning/milestones/v1.2/ROADMAP-STAGING.md` — v1.2 Sound Around & Consent Port 스테이징
- `.planning/milestones/v1.2/PROJECT-STAGING.md` — v1.2 동의 프레임워크 (재사용 기반)

### 재사용 패턴
- v1.0 **SEC-01**: push-notify sender∈family
- v1.0 **RLS**: family-scoped SELECT/INSERT
- v1.1 **FCM data-wake**: MyFirebaseMessagingService, push-notify edge func
- v1.1 **CI-01**: `.github/workflows/android-apk.yml`
- v1.1 **IDEMP-TTL-01**: pg_cron cleanup 패턴
- v1.2 **CONSENT-01**: family_agreements + agreement_version + signature_sha256
- v1.2 **CONSENT-02**: pairing-time AgreementModal
- v1.2 **FLAG-01**: feature_flags 테이블 + gradual rollout
- v1.2 **BRIDGE-01**: Capacitor 플러그인 템플릿 (AmbientListenPlugin 참조)

### 와이어프레임 (gitignored, 로컬 전용)
- `.superpowers/brainstorm/1207-1777050602/content/parent-card-layout.html` — 옵션 B 선택
- `.superpowers/brainstorm/1207-1777050602/content/detail-dashboard.html` — 상세 레이아웃 승인

---

## 16. Next Step

승인 확인 후 `/superpowers:writing-plans` 스킬로 전환 → v1.4 5-phase 구현 계획 수립.

Phase 14 부터 **`/gsd-discuss-phase 14 (auto 금지)` → `/gsd-plan-phase 14` → `/gsd-execute-phase 14`** 흐름으로 실행 예정 (v1.2 precedent 동일).

---

*설계 문서 작성: 2026-04-25 (Saturday). 기반: `/superpowers:brainstorming` 세션 + 브라우저 비주얼 컴패니언 승인 4건 (스코프 · 권한 모델 · 갱신 · 접근 방법 · 홈 카드 · 상세 대시보드).*
