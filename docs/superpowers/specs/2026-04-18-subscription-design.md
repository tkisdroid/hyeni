# 구독 모델 설계 — hyeni

## Overview

부모-아이 일정 관리 앱 **hyeni**에 구독 모델을 도입한다. 카드 등록 기반 7일 체험 후 유료 전환 구조이며, 미결제 시 **최소 안전 기능 무료 티어**로 다운그레이드된다. 결제 인프라는 Google Play Billing 단일 + Qonversion SaaS 래퍼를 사용한다.

핵심 컨셉: **"아빠가 아이 위해 만든 앱"** — 저가·정직·가족 전체 커버.

## Goals

1. **패밀리 단위 구독** — 부모 한 명 결제로 가족 전체(공동 부모 + 모든 아이) 프리미엄 해제
2. **안전은 무료, 편의·첨단은 유료** — 기본 안전 기능은 영구 무료, 원격 음성·AI·학원·다자녀·실시간 위치 등은 프리미엄
3. **카드 등록 7일 체험** — 체험 중 언제든 해지 가능, 미해지 시 자동 전환
4. **Soft-Lock 다운그레이드** — 프리미엄 기간에 만든 데이터는 삭제하지 않고 UI만 잠김
5. **Early Adopter 평생 락인** — 출시 기념 가격을 기존 구독자에게 영구 유지

## Non-Goals (MVP 제외)

- iOS 확장 (현재 앱은 Android only)
- 라이트/베이직 등 다티어 구조
- 프로모션 코드 / 쿠폰 시스템
- A/B 페이월 실험
- 아이 기기 재배정 (이혼·재혼 케이스)
- 연간→월간 다운그레이드 UX (Play Store 기본 동작에 위임)
- 환불 자동화 (수동 CS 대응 유지)

## Pricing & Launch Strategy

### Early Adopter 출시 가격 (현재)

| 상품 | 가격 | 일 환산 |
|---|---|---|
| Premium Monthly | ₩1,500 / 월 | 약 ₩50 / 일 |
| Premium Yearly | ₩15,000 / 년 | 약 ₩41 / 일 (2개월 무료 효과) |

체험 기간: **7일 무료**, 카드 등록 필수.

### 정가 계획 (출시 후 12개월 이후 신규 가입자)

| 상품 | 정가 | 비고 |
|---|---|---|
| Premium Monthly | ₩4,900 / 월 | GPB VAT·수수료 차감 후 실수령 약 ₩3,786 |
| Premium Yearly | ₩49,000 / 년 | |

**Grandfathering**: 출시 후 12개월 이내 가입한 모든 구독자는 **평생 ₩1,500/₩15,000 유지**. Google Play는 기존 Base Plan의 가격을 유지하므로, 신규 Base Plan을 생성하여 정가 적용 → 기존 Base Plan 가입자에게는 영향 없음.

### 카피 전략

페이월·배너 카피에 **Early Adopter 프레임 + "하루 50원" 가치 앵커** 결합:

```
🎁 출시 기념 Early Adopter 가격
   월 ₩1,500  (정가 ₩4,900 예정)
   하루 50원으로 아이를 지키세요
   지금 구독하면 평생 이 가격 유지

   [7일 무료 체험 시작하기]
```

**법적 안전장치**: 정가 ₩4,900 전환을 실제로 실행할 계획이 있을 때만 이 카피 사용 가능. 정가 전환 시점·조건은 문서화하여 표시광고법 리스크 차단.

### GPB 수수료 · VAT 환산 (월 ₩1,500 기준)

```
판매가 (VAT 포함)  = ₩1,500
VAT 10% 차감      = ₩1,363.64
GPB 수수료 15%    = ₩1,159 (실수령)
```

연간 ₩15,000 기준 실수령 약 ₩11,591.

## Feature Matrix

### 무료 티어 (기본 안전)

- 일정 동기화 (부모↔아이)
- 메모·답장
- 칭찬 스티커
- 푸시 알림
- **5분 지연 위치** (실시간 아님, 1자녀만)
- 위험 구역 **1개**
- AI 분석 이력 **읽기만**

### 프리미엄 티어 (체험 + 구독)

- **실시간 위치 추적** (지연 없음)
- **다자녀 지원** (2명 이상)
- **원격 음성 청취** (아이 기기 주변 소리)
- **AI 이미지 분석** (일정 사진 자동 인식 - 신규 요청)
- **학원 일정 관리**
- **위험 구역 무제한**
- **30일 이상 장기 위치 이력**

### FeatureKey 상수 (코드 공유)

```js
export const FEATURES = {
  REALTIME_LOCATION: 'realtime_location',
  MULTI_CHILD: 'multi_child',
  REMOTE_AUDIO: 'remote_audio',
  AI_ANALYSIS: 'ai_analysis',
  ACADEMY_SCHEDULE: 'academy_schedule',
  MULTI_GEOFENCE: 'multi_geofence',
  EXTENDED_HISTORY: 'extended_history',
}
```

## Architecture

```
┌───────────── Parent Device (Capacitor) ─────────────┐
│  React App                                           │
│  ├─ Qonversion Plugin (Cordova or 자체 래퍼)          │
│  │     └─ Google Play Billing                        │
│  └─ Supabase Client                                  │
│       └─ Realtime sub: family_subscription           │
└─────────────────────┬────────────────────────────────┘
                      │
┌───────────── Child Device (Capacitor) ──────────────┐
│  React App (결제 UI 전면 숨김)                         │
│  └─ Supabase Client (family.subscription_tier 조회만) │
└─────────────────────┬────────────────────────────────┘
                      │
              ┌───────▼────────┐
              │  Supabase      │
              │  ├─ DB         │
              │  │   └─ family_subscription (NEW)   │
              │  ├─ RLS        │
              │  └─ Edge Func  │
              │     └─ /webhooks/qonversion         │
              └───────▲────────┘
                      │ webhook
              ┌───────┴────────┐
              │  Qonversion    │
              │  ├─ RTDN 수신  │
              │  ├─ 엔타이틀먼트│
              │  └─ 대시보드    │
              └───────▲────────┘
                      │ RTDN
              ┌───────┴────────┐
              │  Google Play   │
              └────────────────┘
```

### 원칙

- **Qonversion이 GPB와 Supabase 사이의 중개자** — RTDN 파싱·영수증 검증·엔타이틀먼트 계산 일체를 Qonversion에 위임
- **Supabase는 Qonversion의 계산 결과를 저장·조회**하는 종속 저장소. 독자 판단 안 함
- **클라이언트는 Supabase만 읽음** — Qonversion SDK 호출은 구매/복원 시점에만

## Database Schema

### 신규 테이블: `family_subscription`

| Column | Type | Constraints | 설명 |
|---|---|---|---|
| `family_id` | uuid | **PK**, FK → families(id) ON DELETE CASCADE | 가족당 구독 1개 (1:1) |
| `status` | text | NOT NULL, CHECK (`trial` / `active` / `grace` / `cancelled` / `expired`) | 구독 상태 |
| `product_id` | text | NOT NULL | `premium_monthly` or `premium_yearly` |
| `qonversion_user_id` | text | NOT NULL | = `family_id` (동일 값 사용) |
| `trial_ends_at` | timestamptz | | 체험 중에만 값 있음 |
| `current_period_end` | timestamptz | | 다음 청구·만료일 |
| `cancelled_at` | timestamptz | | 해지 시각 |
| `last_event_id` | text | | 웹훅 멱등성 체크용 |
| `last_event_at` | timestamptz | | 웹훅 최종 수신 시각 |
| `raw_event` | jsonb | | 마지막 웹훅 페이로드 (디버그용, 30일 후 purge) |
| `updated_at` | timestamptz | default now() | 트리거로 auto-update |
| `created_at` | timestamptz | default now() | |

### 기존 테이블 변경

**`families` 테이블에 추가**:
- `subscription_tier` text DEFAULT 'free' CHECK (`free` / `premium`)
  - `family_subscription.status` 변경 시 **트리거로 자동 계산**
  - `trial`/`active`/`grace` → `premium`
  - `cancelled`/`expired`/row 없음 → `free`
  - 이 컬럼은 denormalize된 캐시. 핫 패스 쿼리에서 JOIN 회피 목적
  - **클라이언트 직접 UPDATE 불가** — 트리거만 쓰기 권한

**다른 테이블 (`family_members`, `danger_zones`, `academies`, `events` 등)**:
- 기존 스키마 유지
- Soft-Lock용 `active_slot` 컬럼 추가는 아래 참조
- AI 분석은 DB 미저장(클라이언트 일회성) → 스키마 영향 없음

### `family_members` 테이블 추가 필드 (다자녀 활성 슬롯 관리)

- `active_slot` boolean DEFAULT true
  - `role='child'` 행에만 의미 있음 (부모 행은 항상 `true` 유지, UI 무관)
  - 무료 티어 다운그레이드 시 가장 먼저 추가된 자녀 1명만 `true`, 나머지는 `false`
  - 프리미엄 복귀 시 전원 `true` 복원
  - UI에서 부모가 수동으로 "활성 슬롯" 변경 가능

### `danger_zones` 테이블 추가 필드

- `active_slot` boolean DEFAULT true
  - 무료 티어에서 1개만 `true` 유지, 나머지 `false`
  - 비활성 구역은 geofence 감지 중단, DB 유지

### `academies` 테이블 변경

- **스키마 변경 없음**
- 학원 자체는 `academies` 테이블 한 행, 일정은 `schedule` JSONB 컬럼에 임베드
- 프리미엄 가드는 INSERT 시점에만 적용 (상세는 RLS 정책 참조)

### RLS 정책

**SELECT**: 티어 무관, 모든 패밀리 멤버가 자기 가족 데이터 읽기 가능 (Soft-Lock 필수)

**INSERT (프리미엄 전용 리소스)**:
- 2번째 이후 `family_members` INSERT (role='child') → `families.subscription_tier = 'premium'` 요구
- 2번째 이후 `danger_zones` INSERT → 동일
- `academies` 모든 INSERT → 동일

**UPDATE**: 기존 행은 티어 무관 허용 (Soft-Lock 원칙 — 프리미엄 기간에 만든 데이터도 무료 전환 후 편집 가능)

**DELETE**: 티어 무관 허용 (유저가 자기 데이터 삭제할 권리)

**AI 분석 요청**: DB 테이블 없음. 클라이언트에서 `canUse(AI_ANALYSIS)` 가드로만 차단

## Client Architecture

### 엔타이틀먼트 훅

```js
useEntitlement() → {
  tier: 'free' | 'premium',
  status: 'trial' | 'active' | 'grace' | 'cancelled' | 'expired',
  isTrial: boolean,
  trialDaysLeft: number | null,
  currentPeriodEnd: Date | null,
  canUse: (feature: FeatureKey) => boolean,
  refresh: () => Promise<void>,
}
```

**데이터 소스**:
- 1순위: Supabase `family_subscription` Realtime 구독
- 2순위: localStorage 캐시 (TTL 7일)
- 3순위: Qonversion SDK 로컬 캐시 (`Qonversion.checkEntitlements()`)

**리프레시 트리거**:
- 앱 포그라운드 복귀
- 구매 완료 직후
- 수동 호출 (설정 → 구독 상태 새로고침)

### 페이월 컴포넌트 4종

| 컴포넌트 | 트리거 | 형태 |
|---|---|---|
| `TrialInvitePrompt` | 첫 일정 등록 성공 직후 **단 1회** | 하단 슬라이드업 시트. "🎁 Early Adopter · 하루 50원 · 7일 무료 체험" + "나중에 하기" |
| `FeatureLockOverlay` | 프리미엄 기능 탭 | 풀스크린 모달. 잠긴 기능명 + 혜택 3줄 + Early Adopter 프레임 + CTA |
| `InlineLockBadge` | 프리미엄 전용 UI (자녀 2번째, 위험구역 2번째 등) | 블러 + 자물쇠 아이콘, 탭 시 FeatureLockOverlay 오픈 |
| `TrialEndingBanner` | 체험 Day 4~7, 부모 기기만 | 상단 고정 배너. 일자별 카피 · CTA "계속 이용하기" |

### 아이 기기 특수 처리

- `useEntitlement()`는 동일하게 작동 (부모 가족의 구독 상태 조회)
- **결제 관련 UI 전면 숨김**:
  - `TrialInvitePrompt` 렌더 스킵
  - `FeatureLockOverlay` 문구만 "엄마/아빠에게 프리미엄 요청하세요" (CTA 없음)
  - `TrialEndingBanner` 렌더 스킵
  - `InlineLockBadge` 자물쇠는 표시하되 탭해도 문구만
- **코드 레벨 가드**: `Qonversion.purchase()`는 `if (role === 'child') return` 가드로 호출 자체 차단

## Paywall UX Flow (B+C+D 조합)

### 가입 직후

- 카카오 로그인 → 가족 생성/페어링 → 홈 진입
- **페이월 노출 없음** (C)

### 첫 일정 등록 성공

- `TrialInvitePrompt` **1회** 노출 (B 완화판)
- "나중에" 탭 시 디스미스, 재노출 없음

### 프리미엄 기능 탭 (상시)

- `FeatureLockOverlay` 노출 (B·C 공통)
- 해당 기능 이름 명시 + Early Adopter 프레임

### 체험 Day 4 ~ 7 (D)

부모 기기에만 `TrialEndingBanner` 상단 고정:

| 일자 | 배너 카피 | 긴급도 |
|---|---|---|
| Day 4 (D-3) | 🎁 체험 종료 D-3 — Early Adopter 가격 하루 50원 유지하기 | ↓ |
| Day 5 (D-2) | ⏰ 체험 종료 D-2 — 지금 구독하면 평생 하루 50원 | ↓ |
| Day 6 (D-1) | 🔔 내일 체험 종료 — 지금 계속 이용하기 | ↑ |
| Day 7 (당일) | ✨ 오늘 체험 종료 — 계속 이용하기 → 하루 50원 유지 | ↑↑ |

**푸시 알림 (배너와 병행)**: Day 4·6·7 하루 1회 발송 (Day 5는 배너만, 피로도 관리)

### Day 8 분기

- 결제 유지: `status='active'`, UX 변화 없음
- 해지됨: `status='expired'`, 무료 티어 UI 전환 (데이터는 Soft-Lock 유지)

### 해지 접근성 (Play Store 정책 최소 준수)

- 설정 → **"구독 관리"** 버튼 → GPB 관리 페이지 딥링크
  - `https://play.google.com/store/account/subscriptions?sku={product_id}&package=com.hyeni.calendar`
- 배너·페이월에서는 해지 링크 생략 (전환 압력 유지)
- 전자상거래법 준수를 위해 **체험 시작 전 자동갱신 고지** 화면 1회 필수

## Qonversion Integration

### 대시보드 설정

| 리소스 | 값 |
|---|---|
| Entitlement | `premium` (단일) |
| Product (monthly) | `premium_monthly` — GPB SKU `premium_monthly_1500`, ₩1,500, 7일 체험 |
| Product (yearly) | `premium_yearly` — GPB SKU `premium_yearly_15000`, ₩15,000, 7일 체험 |
| Offering (default) | `main_paywall` — 두 상품 묶음, 연간 기본 강조 |

체험 기간 설정: **Google Play Console의 Base Plan에서 7일 Free Trial Offer**로 등록. Qonversion이 자동 인식.

### Capacitor 연동 3단계 전략

**1단계 (우선 시도): Qonversion Cordova 플러그인**
- `cordova-plugin-qonversion` 설치 + `npx cap sync`
- Capacitor의 Cordova 호환 브리지를 통해 동작
- JS 측: `cordova.plugins.Qonversion` 네임스페이스
- Day 1에 프로토타입 확인, 동작하면 채택

**2단계 (폴백): 커스텀 Capacitor 플러그인**
- `android/app/src/main/java/com/hyeni/qonversion/QonversionPlugin.java` 신규
- Qonversion Android SDK(`io.qonversion.android.sdk:sdk:8.x`) 직접 의존
- 노출 최소셋: `identify()`, `purchase()`, `checkEntitlements()`, `restore()`, `getOfferings()`
- JS 래퍼: `src/lib/qonversion.js`에서 `registerPlugin('Qonversion', ...)`
- 작업량 1~2일

**3단계 (제외)**: REST API — GPB 호출 불가로 실질 불가능, 기록용

### Identity 매핑

```
부모가 카카오 로그인 → Supabase family_id 조회 → Qonversion.identify(family_id)
```

- **키 = `family_id`** (UUID)
- 공동 부모 B 로그인 시 → 동일 `family_id`로 identify → 이미 `premium` → **결제 UI 자동 숨김**
- 중복 청구 방지 + 패밀리 엔타이틀먼트를 한 번에 해결

### 구매 플로우 (성공 경로)

1. 부모가 "체험 시작" 탭
2. `Qonversion.offerings()` → `main_paywall` 로드
3. 월간/연간 선택 → `Qonversion.purchase(product)`
4. GPB 다이얼로그 → 카드 등록 + 체험 시작 확인
5. Google → Qonversion (RTDN) → 엔타이틀먼트 `premium` 활성화
6. Qonversion → Supabase Edge Function 웹훅 호출
7. Edge Function이 `family_subscription` UPSERT → 트리거로 `families.subscription_tier='premium'` 자동
8. Supabase Realtime → 부모·아이 기기에 변경 전파
9. 클라이언트 `useEntitlement()` 갱신 → UI 전환 완료

지연: 4~6초. "체험 시작 중..." 로딩 상태 표시.

## Supabase Edge Function

### `/webhooks/qonversion`

**경로**: `supabase/functions/qonversion-webhook/index.ts` (신규)

**책임**:
1. `x-qonversion-signature` HMAC-SHA256 서명 검증 (Secret은 Supabase Vault에 보관)
2. `event.id`와 `last_event_id` 비교로 **멱등성 보장** (Qonversion 최대 72h 재시도 대응)
3. 이벤트 타입별 분기:
   - `trial_started` → INSERT, `status='trial'`, `trial_ends_at=+7d`
   - `trial_converted` → UPDATE, `status='active'`
   - `trial_canceled` / `subscription_canceled` → `status='cancelled'`, `cancelled_at=now()`
   - `subscription_renewed` → `current_period_end` 갱신
   - `subscription_refunded` → `status='expired'`
   - `grace_period_started` → `status='grace'`
4. `raw_event`에 payload 저장 (30일 후 cron으로 purge)
5. 트리거가 `families.subscription_tier` 자동 재계산

**권한**: `SERVICE_ROLE` 키로 실행, 클라이언트는 이 테이블에 WRITE 권한 없음.

### 복구 Cron (웹훅 소실 대응)

**경로**: `supabase/functions/subscription-reconcile/index.ts` (신규)

- 매 시간 실행
- `family_subscription.updated_at < now() - 24h` 인 가족 조회
- Qonversion REST API (`/v3/users/{family_id}/entitlements`)로 실제 상태 조회
- 불일치 시 강제 동기화

## Soft-Lock Rules (다운그레이드 동작)

### 자녀 `family_members.active_slot` 관리 (role='child' 한정)

- 프리미엄 기간: 모든 자녀 `active_slot=true`
- 다운그레이드 시점 트리거: `role='child'`인 행을 `created_at` ASC로 정렬 → **첫 1명만** `true`, 나머지 `false`
- 부모 행(`role='parent'`)은 이 컬럼과 무관하게 항상 활성 취급
- 부모가 수동으로 자녀 활성 슬롯 변경 가능 (무료 티어 내에서만 유효)
- 프리미엄 복귀 시: 모든 자녀 `active_slot=true` 복원

### 위험구역 `danger_zones.active_slot`

- 동일한 규칙. 첫 1개만 `true`, 비활성 구역은 geofence 감지 중단
- 데이터는 유지

### AI 분석

- DB 저장 없음 → "이력" 개념 없음
- 클라이언트에서 `canUse(AI_ANALYSIS)` 가드로 신규 분석 요청만 차단
- 과거에 AI로 인식하여 저장된 `events` 행은 영향 없음 (일반 이벤트와 동일)

### 학원 (`academies`)

- 기존 데이터 읽기·수정·삭제 가능
- **신규 학원 INSERT 차단** (RLS)
- 기존 학원의 `schedule` JSONB UPDATE는 허용 (일정 내용 편집은 가능)
- 무료 티어 중 기존 학원 알림 발송 중단 정책:
  - `academies` 테이블에 `notifications_suppressed` boolean 컬럼 추가
  - 다운그레이드 트리거에서 모든 학원을 `true`로 설정
  - 프리미엄 복귀 시 다시 `false`
  - 푸시 발송 로직에서 이 플래그 확인 후 drop

### 원격 음성 청취

- 실시간 기능이라 이력 개념 없음 → 단순 차단

### 장기 위치 이력

- 30일 이전 데이터는 무료 티어에서 조회 차단 (쿼리 레벨)
- 데이터는 유지 → 프리미엄 복귀 시 즉시 조회 가능

## Error Handling & Edge Cases

### 가족 구성 변화

| 시나리오 | 처리 |
|---|---|
| 공동 부모 B가 구독 가족에 가입 | B 기기에서 `checkEntitlements()` → `premium` 감지 → 결제 UI 자동 숨김 |
| 구독자 부모 A 탈퇴 | A 구독은 Google 계정에 유지. 가족은 `status='expired'` |
| 아이 타 가족 이동 | **MVP 미지원**. 기존 레코드 삭제 후 새 페어링 |
| 분가 (부모들이 각자 가족 만듦) | A는 한 가족만 유지 선택. 구독은 1 계정 1 구독 원칙 |
| 모든 부모 떠난 가족 | 7일 후 가족 레코드 soft-delete |

### 경쟁 상태

| 시나리오 | 처리 |
|---|---|
| 구매 성공 직후 앱 종료, 웹훅 지연 | SDK 로컬 캐시가 선반영. 재시작 시 `checkEntitlements()`로 복원 |
| 웹훅이 클라이언트 폴링보다 먼저 | Supabase Realtime push로 즉시 반영 |
| 동일 이벤트 2회 도착 | `last_event_id` 비교로 드롭 |
| 웹훅·클라이언트 동시 쓰기 | Edge Function만 `SERVICE_ROLE`로 write, 클라이언트는 SELECT만 |

### 오프라인·네트워크 장애

| 시나리오 | 처리 |
|---|---|
| 오프라인 실행 | localStorage 캐시 사용 (TTL 7일) |
| 체험 Day 6 오프라인 지속 | 캐시 'trial' 유지, 프리미엄 기능 사용 가능 |
| 체험 Day 8 오프라인 (자동 결제 후) | 캐시 만료 → `free` 보수 가정 → 온라인 복귀 시 보정 |
| 웹훅 소실 | Qonversion 72h 재시도 + 복구 Cron 이중화 |

### 보안

| 시나리오 | 처리 |
|---|---|
| 클라이언트 `subscription_tier` 위조 | RLS + 트리거로 차단. 직접 UPDATE 불가 |
| 체험 재시도 어뷰징 | GPB가 Google 계정당 체험 1회만 허용 (플랫폼 차단) |
| 서명 위조 웹훅 | HMAC 검증 실패 시 401 + 로그 |
| 아이 기기 루팅 후 구매 시도 | 아이 앱에 `Qonversion.purchase()` 호출 진입점 없음 |

## Testing Strategy

### 단위 테스트 (Vitest)

- `useEntitlement` 훅의 status 조합별 `canUse(feature)` 반환값
- `FeatureGuard` 컴포넌트의 티어별 렌더
- Soft-Lock `active_slot` 선택 로직
- Edge Function HMAC 서명 검증 유효/무효 케이스
- Edge Function 멱등성: 동일 `event.id` 중복 시 no-op

### 통합 테스트 (Vitest + Supabase Test Helpers)

- 테스트 DB에 fixture 생성 → 웹훅 payload 모킹 → `family_subscription` 상태 변화 검증
- RLS 정책 테스트: `free` 상태에서 2번째 `family_members` (role='child') INSERT 거부
- 트리거 테스트: `status` 변경 시 `families.subscription_tier` 자동 동기화
- 트리거 테스트: 다운그레이드 시 자녀 `active_slot` 재계산 정확성

### E2E (수동 체크리스트)

Capacitor + GPB 조합은 자동화가 어려움. Play Console 라이선스 테스터 계정으로 수동 시나리오 10개:

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 신규 부모 가입 → 홈 진입 | 페이월 없음, 무료 티어 진입 |
| 2 | 첫 일정 등록 | TrialInvitePrompt 1회 노출 |
| 3 | "나중에" 탭 | 디스미스, 재노출 없음 |
| 4 | AI 분석 탭 | FeatureLockOverlay 노출 |
| 5 | "체험 시작" → 월 ₩1,500 | GPB → 체험 시작 → 프리미엄 해제 |
| 6 | 공동 부모 B 로그인 | 결제 UI 자동 숨김 |
| 7 | 아이 기기 로그인 | 결제 UI 전무, 프리미엄 잠금 해제 |
| 8 | 체험 Day 4 로그인 | TrialEndingBanner "D-3 · 하루 50원" |
| 9 | Day 7 해지 | 체험 끝까지 프리미엄, Day 8 무료 |
| 10 | 다운그레이드 후 자녀 2번째 | InlineLockBadge, 데이터 보존 |

### Qonversion Sandbox

- 대시보드에서 Sandbox 모드 활성화
- `trial_started`, `cancel`, `refund`, `renew` 수동 트리거
- 실제 결제 없이 웹훅 플로우 전체 검증

## Rollout Plan

### Phase 0 — 인프라 준비 (약 3일)

- Google Play Console 상품 2개 + 7일 체험 Offer 등록
- Qonversion 계정 생성, entitlement/product/offering 설정
- `family_subscription` 마이그레이션 작성·적용
- `/webhooks/qonversion` Edge Function 스캐폴딩

### Phase 1 — 클라이언트 통합 (약 1주)

- Day 1: Cordova 플러그인 시도 → 동작 판정
- Day 2~3: 플러그인 경로 확정 (Cordova or 커스텀 래퍼)
- Day 3~5: `useEntitlement`, 페이월 컴포넌트 4종, B+C+D 플로우
- Day 6~7: Soft-Lock UI 가드 (자녀·위험구역·학원 등)

### Phase 2 — 통합 테스트 (약 3일)

- 수동 시나리오 10개 Sandbox 모드에서 실행
- Qonversion 대시보드 이벤트 수동 트리거 → 웹훅·DB 검증
- RLS 침투 테스트: 클라이언트 위조 INSERT 거부 확인

### Phase 3 — 내부 베타 (1~2주)

- Play Store Internal Testing 트랙 배포
- 5~10명이 실결제 진행 (환불 가능)
- Qonversion 대시보드 실시간 모니터링
- 전체 클리어 후에만 Production 승격

### Phase 4 — 프로덕션 출시

- 단계적 출시 10% → 50% → 100% (각 2일 간격)
- D+7 지표 리뷰: 체험 시작률, Day 1 해지율, 웹훅 성공률
- 이상 징후 시 즉시 롤백

## Pre-launch Checklist

- [ ] Play Console: 결제 플로우·환불 정책·구독 관리 설명 페이지 등록
- [ ] 개인정보 처리방침·이용약관에 구독 조항 추가 (자동갱신·해지·환불)
- [ ] 설정 화면 "구독 관리" 버튼 (GPB 딥링크)
- [ ] 체험 시작 전 자동갱신 고지 화면 (전자상거래법 준수)
- [ ] Qonversion 대시보드 Sandbox → Production 전환
- [ ] Edge Function Secret Supabase Vault 저장, `.env` 없음 확인
- [ ] Sentry/Supabase Log에 웹훅 실패 알림 채널 연결
- [ ] Early Adopter 정가 전환 계획서 문서화 (출시 12개월 후 신규 Base Plan 적용)

## Success Metrics (MVP 첫 달)

| 지표 | 목표 |
|---|---|
| 체험 시작률 (신규 가입자 중) | ≥ 30% |
| 체험→유료 전환율 | ≥ 40% |
| Day 1 해지율 | ≤ 15% |
| 월간→연간 업그레이드율 | 소프트 타겟 (측정만) |
| 웹훅 성공률 | ≥ 99.5% |
| 환불 요청 비율 | ≤ 3% |

## References

- `docs/superpowers/specs/2026-03-11-supabase-integration-design.md` — 기존 Supabase 통합 설계
- `WORKING_MEMORY.md` — 현재 개발 상태
- [Qonversion Android SDK](https://github.com/qonversion/android-sdk)
- [Qonversion Cordova Plugin](https://github.com/qonversion/cordova-plugin)
- [Google Play Billing Library v7](https://developer.android.com/google/play/billing)
- [표시·광고의 공정화에 관한 법률 제3조](https://www.law.go.kr/법령/표시·광고의공정화에관한법률)
