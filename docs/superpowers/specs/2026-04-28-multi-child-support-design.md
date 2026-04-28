---
title: 다중 자녀 지원 (Multi-Child Support) — Design Spec
date: 2026-04-28
status: draft
supersedes:
  - docs/superpowers/specs/2026-04-18-subscription-design.md
coordinates_with:
  - docs/superpowers/specs/2026-04-25-child-device-monitoring-design.md
visual_reference:
  - design/Multi-Child UX · Overview v1.html
---

# 다중 자녀 지원 — Design Spec

## 1. 문제 · 동기

현재 혜니캘린더는 **자녀 1명 기준**으로 UI가 하드코딩되어 있다. 자녀 2명 이상 페어링된 가족은 다음 핵심 기능에서 첫 번째 자녀만 표시된다:

| 기능 | 현재 동작 | 문제 |
|------|-----------|------|
| 위치확인 (지도 탭) | `pairedChildren[0]` 만 표시 | 둘째 자녀 위치 안 보임 |
| 아이 기기 안전 지표 | `_pairedDevice = pairedChildren[0]` (App.jsx L6628) | 첫째 자녀 디바이스만 모니터링 |
| 일정 등록 | 자녀 선택 UI 없음 | 어느 자녀 일정인지 구분 불가 |
| 홈 대시보드 | 단일 자녀 위젯 | 형제 비교 불가, 둘째 자녀 정보 누락 |
| 구독 (현재 v1.0) | 가족 단위 1:1 | 1자녀 가족과 3자녀 가족이 동일 가격 — 불공정 |

**근본 원인**: `paired_children` 배열은 이미 존재하지만, 다운스트림 로직 전부 `[0]` 인덱스로 단일 자녀를 가정한다. UI 다중화 + 데이터 모델 보강 + 구독 모델 per-child 전환이 동시에 필요하다.

**비즈니스 동기**:
- 형제 자매가 있는 한국 초·중 가정 → 핵심 타겟 (교육청 B2B 제안 라인업)
- 1:1 구독은 다자녀 가정에서 개당 가격이 비싸 보임 (0.5만원도 망설임)
- 1인당 ₩1,500/월 = 다자녀에서도 1자녀 부담 최소화 + 회사는 ARPU 상승

## 2. 9가지 분기 원칙 (Single Source of Truth)

모든 UI/데이터/구독 분기는 다음 9가지 원칙에서 파생된다. 구현 시 이 원칙을 위반하는 코드는 리뷰에서 즉각 거부.

### 원칙 1 — 1자녀 모드는 현재 화면 큰틀 유지

`paired_children.length === 1` 일 때, **기존 UI를 거의 그대로 유지**. 새 위젯/탭/선택 UI 추가 금지. 자녀 1명 가정의 학습 비용 0.

### 원칙 2 — `paired_children.length` 가 분기의 단일 진실원

```javascript
const isMultiChild = paired_children.length >= 2;
```

`families.planned_child_count` (계획값), `family_members.role='child'` (등록값), `subscriptions.length` (구독값)와 **별개**. 페어링 완료된 자녀 수만 UI 분기 기준.

### 원칙 3 — 부모 초기 세팅에서 자녀 수 + 자녀별 생년월일 입력

가족 생성 시:
1. 자녀 수 선택 (1~5)
2. 자녀별: 이름 + 생년월일 + 자녀 색 + (선택) 사진
3. 페어링 코드는 자녀 슬롯별 발급

생년월일은 **구독 시 자녀 식별 표시자**로 활용 (이름 동음이의/오타 방지).

### 원칙 4 — 일정은 다중 자녀 + '가족 전체' 옵션

일정 등록 모달:
- 자녀 다중 체크박스 (혜니 ☑, 민준 ☑)
- '가족 전체' 옵션 (대시 라인 강조 — `border-style: dashed`)
- 1자녀 모드에서는 체크박스 자동 숨김

데이터: `events ↔ events_children` M:N + `events.is_family_event boolean`.

### 원칙 5 — 부모 단말만 다중 자녀 UI 적용

자녀 단말은 **자기 정보만** 표시:
- 자기 위치 (ripple 애니)
- 자기 일정 + 가족 전체 일정 (형제 일정 X)
- 엄마 메시지 카드
- SOS 버튼 (자기 발신)

형제 자녀 정보 노출 = privacy 위반. 자녀 단말 UI는 1자녀 모드와 동일하게 유지 (간소).

### 원칙 6 — 구독은 per-child opt-in

가족 구독 ❌. **자녀 1인당 ₩1,500/월**. 자녀별로 구독 ON/OFF 가능. 구독 안 한 자녀도 등록 유지 (무료 자녀 + 유료 자녀 혼재 정상).

### 원칙 7 — 안전은 무료, 서버 비용은 유료

| 카테고리 | 무료 (모든 자녀) | 유료 (구독 자녀만) |
|---------|--------|--------|
| SOS 발신/수신 | ✅ 무제한 | — |
| 위치 1회 확인 | ✅ 즉시 | 30일 히스토리 |
| 음성 메시지 송수신 | ✅ 실시간 | 30일 보관 + 다운로드 |
| 오늘 일정 보기 | ✅ | 알림 푸시 |
| 디바이스 안전 지표 | — | ✅ 스크린타임/배터리/앱 통계 |

기준: **서버 저장/연산 비용 발생 여부**. 안전 = 영구 무료 (회사 미션 + 교육청 B2B 정당화).

### 원칙 8 — 자녀별 색은 6색 팔레트에서 자동 + 수동 변경 가능

기본 6색 팔레트: `#F779A8`(핑크), `#3B82F6`(파랑), `#10B981`(초록), `#F59E0B`(노랑), `#A78BFA`(보라), `#EF4444`(빨강).

자녀 등록 시 자동 할당 (충돌 시 다음 색). 수동 변경 가능. 일정 카드/지도 핀/대시보드 위젯 색은 자녀 색을 직접 사용 (CSS variable 주입).

### 원칙 9 — 한 번에 구현 + 9-Phase 병렬 실행

마이그레이션 ↔ UI ↔ 구독 ↔ 보안 → 의존성 그래프 분석 후 9-Phase로 분해, 가능한 phase는 병렬 실행 (GSD `--auto` 모드 + parallel agent dispatch).

## 3. 범위 (In/Out)

### In Scope
- 페어링 wizard에 자녀 수 + 자녀별 생년월일/색/사진 입력
- 홈 통합 대시보드 신설 (NEW 탭)
- 다중 자녀 지도 핀 (자녀 색 마커)
- 일정 등록 모달 자녀 다중 체크박스 + '가족 전체'
- 구독 화면 per-child 토글
- 자녀 단말 UI (자기 정보만)
- DB 마이그레이션 5개 (M1~M5)
- 기존 1자녀 가족 마이그레이션 시나리오
- Qonversion entitlement 재설계

### Out of Scope (별도 spec)
- 스크린타임 통계 시각화 디테일 → `2026-04-25-child-device-monitoring-design.md`
- 음성 메시지 보관 정책 디테일
- SOS 응급 워크플로우 변경 (현재 동작 유지)
- 자녀 → 자녀 간 위치/일정 공유 (privacy 원칙 5 위반)

## 4. UX 5화면 (디자인 문서)

비주얼 mockup: `design/Multi-Child UX · Overview v1.html`

| # | 화면 | 신규/수정 | 핵심 요소 |
|---|------|-----------|-----------|
| 1 | 페어링 (자녀 수/생년월일) | **신규** | 5-step progress bar, 자녀 stepper, 색 picker, 사진 업로드 |
| 2 | 홈 통합 대시보드 | **신규** (NEW 탭) | 자녀 카드 × N, 미니 지도, 오늘 일정 (자녀 색), 안전 지표 |
| 3 | 일정 등록 모달 | 수정 | 자녀 다중 체크박스 + '가족 전체' (dashed) |
| 4 | 구독 화면 | 수정 | per-child 토글, 미구독 자녀 회색, 합계 = N × ₩1,500 |
| 5 | 자녀 단말 | 수정 | 엄마 메시지 카드, 자기 위치 ripple, 자기/가족 일정만 |

### 4.1 페어링 wizard 흐름

```
Step 1: 가족 이름 입력
Step 2: 자녀 수 선택 (1~5)
Step 3: 자녀 N — 이름 + 생년월일 + 색 + (선택) 사진
        반복 N회
Step 4: 자녀 N별 페어링 코드 발급
Step 5: 모든 자녀 페어링 완료 확인
```

각 step 이탈 시 자동 저장 (resume 가능).

### 4.2 홈 통합 대시보드 — NEW 탭

기존 탭 (지도/일정/메시지/설정) 앞에 **'홈' 탭 추가**. 1자녀 모드는 홈 탭 숨김 (기존 그대로).

홈 탭 구성:
- 자녀 카드 × N (사진 + 이름 + 위치 텍스트 + 안전 지표 dots)
- 미니 지도 (자녀 N명 핀, 탭 시 지도 탭으로 이동)
- 오늘 일정 리스트 (자녀 색 좌측 vertical line)
- 빠른 액션 (SOS 호출, 음성 메시지 보내기)

### 4.3 일정 등록 모달 자녀 선택

```
대상:
☑ 혜니 [핑크]
☑ 민준 [파랑]
─────────────
[ 가족 전체 (모든 자녀 + 부모) ]   ← dashed border
```

'가족 전체' = `is_family_event = true`, `events_children` 미생성. 단일 자녀 + 가족 전체 동시 선택 불가 (XOR).

## 5. 데이터 모델

### 5.1 신규/변경 테이블

```sql
-- families: 자녀 수 계획값
ALTER TABLE families ADD COLUMN planned_child_count integer NOT NULL DEFAULT 1
  CHECK (planned_child_count BETWEEN 1 AND 5);

-- family_members: 자녀 메타데이터
ALTER TABLE family_members ADD COLUMN birthdate date;
ALTER TABLE family_members ADD COLUMN color_hex text
  CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE family_members ADD COLUMN photo_url text;
ALTER TABLE family_members ADD COLUMN child_order integer; -- 1, 2, 3...

-- subscriptions: per-child 구독 (기존 family_subscription 대체)
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  qonversion_user_id text NOT NULL,
  qonversion_entitlement_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','grace','expired','canceled')),
  expires_at timestamptz,
  product_id text NOT NULL,
  price_krw integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id) -- 자녀당 활성 구독 1개
);
CREATE INDEX subscriptions_family_idx ON subscriptions(family_id);
CREATE INDEX subscriptions_status_idx ON subscriptions(status) WHERE status = 'active';

-- events: 가족 전체 플래그
ALTER TABLE events ADD COLUMN is_family_event boolean NOT NULL DEFAULT false;

-- events_children: M:N 일정-자녀 (NEW)
CREATE TABLE events_children (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, child_id)
);
CREATE INDEX events_children_child_idx ON events_children(child_id);
```

### 5.2 변경되지 않는 테이블

| 테이블 | 사유 |
|--------|------|
| `child_device_stats` (2026-04-25 spec) | child_id 이미 존재. RLS 게이트만 per-child subscription 으로 전환 |
| `sos_events` | sender_id 이미 자녀 단위 |
| `voice_messages` | child_id 이미 존재 |
| `paired_children` (view) | 그대로 유지. UI는 length 만 사용 |

## 6. Migrations (M1~M5)

순서 의존성 있음. 각 마이그레이션 BEGIN/COMMIT 래핑 + `down/` 디렉토리에 rollback SQL.

### M1 — `families.planned_child_count` 추가
- 기본값 1, 모든 기존 가족 영향 없음
- Down: `ALTER TABLE families DROP COLUMN planned_child_count;`

### M2 — `family_members` 메타데이터 컬럼 추가
- `birthdate`, `color_hex`, `photo_url`, `child_order` 추가
- 기존 자녀: `child_order = 1`, `color_hex = '#F779A8'` 디폴트 백필
- Down: 4개 컬럼 DROP

### M3 — `subscriptions` 테이블 생성 + 기존 `family_subscription` 데이터 마이그레이션
- 새 `subscriptions` 테이블 생성
- 기존 `family_subscription` 행 → 가족당 첫째 자녀에게 자동 발급 (₩1,500 가격으로 grandfather)
- 기존 `family_subscription.tier` denormalized cache는 유지 (Phase 2까지) → 이후 deprecate
- Realtime publication: `subscriptions` 추가
- Down: subscriptions 테이블 DROP + family_subscription 복원

### M4 — `events.is_family_event` + `events_children` 추가
- 기존 events 모두 `is_family_event = false` 백필
- 기존 events 자녀 연결: `events.child_id` (있다면) → `events_children` 행으로 복사
  - `child_id` 컬럼 존재 여부 확인 후 분기
- Down: `events_children` DROP + `events.is_family_event` DROP

### M5 — RLS 정책 갱신
- `subscriptions`: 자녀 본인 + 가족 부모만 SELECT, 부모만 INSERT/UPDATE
- `events_children`: 가족 멤버만 SELECT, 부모만 INSERT/UPDATE/DELETE
- 기존 `child_device_stats` 게이트: `family_subscription.tier` → `subscriptions.status='active' AND child_id=stats.child_id` 으로 전환
- Down: 이전 정책 SQL 복원 (스냅샷 필수)

**검증**: 각 마이그레이션 후 Playwright real-services E2E 통과 + `pg_policies` 스냅샷 비교.

## 7. RLS 정책

```sql
-- subscriptions: 가족 부모 R/W, 본인 자녀 R
CREATE POLICY "subscriptions_select_family"
  ON subscriptions FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "subscriptions_insert_parent"
  ON subscriptions FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid() AND role = 'parent'
    )
  );

CREATE POLICY "subscriptions_update_parent"
  ON subscriptions FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid() AND role = 'parent'
    )
  );

-- events_children: 가족 멤버 R, 부모 W
CREATE POLICY "events_children_select_family"
  ON events_children FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE family_id IN (
        SELECT family_id FROM family_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "events_children_modify_parent"
  ON events_children FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE family_id IN (
        SELECT family_id FROM family_members
        WHERE user_id = auth.uid() AND role = 'parent'
      )
    )
  );

-- child_device_stats: per-child subscription 게이트
DROP POLICY IF EXISTS "child_device_stats_select_subscriber" ON child_device_stats;

CREATE POLICY "child_device_stats_select_subscriber"
  ON child_device_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.child_id = child_device_stats.child_id
        AND s.status = 'active'
    )
    AND child_id IN (
      SELECT id FROM family_members
      WHERE family_id IN (
        SELECT family_id FROM family_members
        WHERE user_id = auth.uid()
      )
    )
  );
```

## 8. 구독 (Qonversion per-Child 재설계)

### 8.1 옵션 비교

| 옵션 | A — Quantity-based | B — N-SKU |
|------|---------------------|-----------|
| 구조 | 단일 product, qty=N | child1 SKU + child2 SKU + ... |
| Google Play 지원 | 일부 (subscription qty 필요) | 전체 |
| Qonversion 매핑 | 복잡 (qty → entitlement count) | 직관적 (entitlement 1:1) |
| 가격 표시 | "₩1,500 × 2 = ₩3,000" | "혜니 ₩1,500 + 민준 ₩1,500" |
| **추천** | ❌ Google Play 지원 불확실 | ✅ |

**선택**: **옵션 B (N-SKU)**. 자녀 슬롯별 SKU 발급 (`child_slot_1`, `child_slot_2`, ... `child_slot_5`).

### 8.2 SKU 정의 (Google Play Console)

```
hyeni_child_slot_1: ₩1,500/월, 자동 갱신
hyeni_child_slot_2: ₩1,500/월
hyeni_child_slot_3: ₩1,500/월
hyeni_child_slot_4: ₩1,500/월
hyeni_child_slot_5: ₩1,500/월
```

자녀별 어느 SKU 인지 → `subscriptions.product_id` 에 기록.

### 8.3 Qonversion entitlement 매핑

```
Entitlement: child_active_<slot>  (예: child_active_1)
Product: hyeni_child_slot_<slot>
```

클라이언트:
```javascript
const child1Active = await Qonversion.checkEntitlement('child_active_1');
const child2Active = await Qonversion.checkEntitlement('child_active_2');
```

서버 (Edge Function):
- Qonversion webhook → `subscriptions.status` 갱신
- Slot 번호 → `child_id` 매핑 (Edge function에서 `family_members.child_order = slot`)

### 8.4 구독 화면 UX

```
[혜니 사진]  혜니  (2015년생)            [Toggle ON]   ₩1,500/월
[민준 사진]  민준  (2018년생)            [Toggle OFF]  무료
─────────────────────────────────────────
합계                                                ₩1,500/월
[ 결제하기 ]
```

미구독 자녀는 카드 회색 + "구독하면 디바이스 안전, 위치 히스토리 사용 가능" 라벨.

## 9. Freemium 매핑 (원칙 7 구체화)

| 기능 | 무료 (모든 자녀) | 구독 자녀 추가 |
|------|------|------|
| SOS 발신 | ✅ | — |
| SOS 수신 (부모) | ✅ | — |
| 위치 1회 확인 | ✅ | 30일 히스토리, 무제한 폴링 |
| 음성 메시지 (실시간) | ✅ | 30일 보관, 다운로드 |
| 일정 보기 (오늘만) | ✅ | 무제한 + 푸시 알림 |
| 디바이스 안전 지표 | — | ✅ (스크린타임, 배터리, 앱 사용 통계) |
| Force-Ring | — | ✅ (자녀 단말 강제 벨소리) |
| 친구 playdate 코디네이션 | — | ✅ |

**무료 사용자도 안전을 보장한다** = 회사 미션. 교육청 B2B 제안 시 핵심 메시지.

## 10. Realtime · Push

- `subscriptions` Realtime publication 추가 → 부모 단말 실시간 status 갱신
- `events_children` Realtime publication 추가 → 자녀별 일정 변경 즉시 반영
- Push 알림: 무료 자녀는 SOS + 음성 메시지 도착만, 유료 자녀는 + 일정 알림 + 위치 이탈 알림

## 11. Component Tree (App.jsx 영향 범위)

App.jsx 6877라인 monolith 정책 — **분해 금지**. 신규 컴포넌트는 `src/components/multichild/` 디렉토리에 격리.

```
src/components/multichild/
├── PairingWizard/
│   ├── ChildCountStep.jsx
│   ├── ChildDetailsStep.jsx
│   ├── ColorPicker.jsx
│   └── PhotoUpload.jsx
├── HomeDashboard/
│   ├── HomeTab.jsx
│   ├── ChildSummaryCard.jsx
│   ├── MiniMap.jsx
│   └── TodayEventsList.jsx
├── EventModal/
│   └── ChildSelector.jsx
├── SubscriptionScreen/
│   ├── PerChildToggle.jsx
│   └── PriceSummary.jsx
└── ChildPalette.js   (단일 import 6색 상수)
```

App.jsx 변경 라인 (사전 측정):
- L6628: `_pairedDevice` 단일 → 다중 분기 (5라인 수정)
- L6679: `childPos` → `allChildPositions` 활용 (10라인 수정)
- L6695: `childDeviceStatusMap` 소비 (15라인 수정)
- 페어링 wizard 진입점 (1라인 import + 5라인 분기)
- 일정 등록 진입점 (1라인 import + 3라인 분기)
- 구독 화면 진입점 (1라인 import + 3라인 분기)

총 App.jsx 영향: 약 50라인. 800라인 분해 정책 위반 없음.

## 12. 9-Phase 병렬 분해

GSD `--auto` 모드. 의존성 그래프 기반.

```
Phase 1: M1 + M2 마이그레이션 (families.planned_child_count + family_members 메타)
   ↓
Phase 2: M3 마이그레이션 (subscriptions 테이블) ← Phase 1 의존
Phase 3: M4 마이그레이션 (events_children M:N) ← Phase 1 의존
   ↓ Phase 2 || Phase 3 병렬 가능
Phase 4: M5 RLS 정책 갱신 ← Phase 2, 3 모두 의존
   ↓
Phase 5: 페어링 wizard UI (PairingWizard/*) ← Phase 1
Phase 6: 홈 통합 대시보드 (HomeDashboard/*) ← Phase 1
Phase 7: 일정 모달 자녀 선택 (EventModal/*) ← Phase 3
Phase 8: 구독 화면 per-child + Qonversion 재설계 ← Phase 2
   ↓ Phase 5,6,7,8 모두 병렬 가능
Phase 9: 자녀 단말 UI 정리 + E2E 통합 테스트 ← Phase 5-8 모두 의존
```

병렬 실행 가능 phase: (2, 3) 동시 / (5, 6, 7, 8) 동시. 직렬: 1 → (2,3) → 4 → (5,6,7,8) → 9.

각 phase 끝에 atomic commit + Playwright real-services E2E.

## 13. 마이그레이션 시나리오 (기존 가족 처리)

### 13.1 기존 1자녀 가족
- `planned_child_count = 1` 백필
- `family_members.child_order = 1`, `color_hex = '#F779A8'` 백필
- 기존 `family_subscription.tier='active'` → `subscriptions(child_id=첫째자녀, status='active', price_krw=1500, product_id='hyeni_child_slot_1')` 자동 발급 (grandfather)
- UI: 1자녀 모드 (큰틀 그대로)

### 13.2 기존 2자녀+ 가족 (실제로는 paired_children=2지만 첫째만 보였던 가족)
- `planned_child_count = 2` 백필
- 두 자녀 모두 `family_members.color_hex` 다른 색 백필 (palette 순환)
- 기존 `family_subscription.tier='active'` → 첫째 자녀에게만 grandfather (₩1,500)
- 둘째 자녀는 무료 시작 → 부모가 구독 화면에서 추가 ON 가능
- UI: 자동으로 다중 자녀 모드 (홈 탭 표시, 지도 다중 핀)

### 13.3 기존 미구독 가족
- 영향 없음 (subscriptions 테이블에 행 없음, 기존 무료 기능 유지)

## 14. 테스트 전략

12개 E2E 시나리오 (Playwright real-services config):

| # | 시나리오 | 검증 |
|---|---------|------|
| 1 | 신규 가족 페어링 (자녀 1명) | 1자녀 모드 큰틀 유지 |
| 2 | 신규 가족 페어링 (자녀 3명) | 홈 탭 자동 표시, 색 자동 할당 |
| 3 | 기존 1자녀 가족 마이그레이션 | grandfather 구독 자동 발급 |
| 4 | 기존 2자녀 가족 마이그레이션 | 첫째 grandfather, 둘째 무료 |
| 5 | 일정 등록: 자녀 1명만 선택 | events_children 1행 생성 |
| 6 | 일정 등록: 가족 전체 | is_family_event=true, events_children 0행 |
| 7 | 자녀 1명만 구독 | 구독 자녀 디바이스 통계 보임, 미구독 자녀 안 보임 |
| 8 | 두 자녀 모두 구독 | 합계 ₩3,000, 양쪽 모두 디바이스 통계 |
| 9 | 자녀 단말 자기 정보만 표시 | 형제 위치/일정 노출 0건 |
| 10 | 부모 SOS 수신 (무료 자녀) | 정상 수신 |
| 11 | 자녀 색 변경 → 일정/지도 즉시 반영 | Realtime |
| 12 | 자녀 추가/제거 후 구독 재계산 | 합계 자동 갱신 |

추가 unit 테스트:
- `paired_children.length` 분기 로직 (1, 2, 3, 5, 0 케이스)
- `subscriptions` RLS (다른 가족 자녀 SELECT 시도 → 0행)
- `events_children` cascade DELETE (자녀 삭제 시 일정 연결 자동 정리)

## 15. Risks

| 리스크 | 완화 |
|--------|------|
| Qonversion N-SKU 복잡도 | 5 SKU 까지만 정의 (자녀 5명 한도 명시) |
| 기존 1자녀 가족 grandfather 가격 동결 | ₩1,500 = 신규와 동일이라 grandfather 가격 인하 효과 (CS 부담 0) |
| 자녀 색 충돌 (2자녀 동일 색 선택) | 자동 할당 기본, 수동 변경 시 중복 경고 |
| events_children 백필 누락 | M4 dry-run + count 비교 검증 |
| Realtime publication 누락 | M3, M4 끝에 `pg_publication_tables` 체크 |
| 자녀 단말에 형제 정보 누출 | 자녀 단말 query 단에서 `paired_children[0]` (자기 자신) 만 사용. RLS는 부모 단말과 동일 |

## 16. Open Questions

1. **자녀 5명 초과 가족** — 한국 평균 자녀 수 1.6명, edge case로 5명 한도 OK. 6명+는 추후 v2.
2. **grandfather 가격 영구 동결?** — ₩1,500 → ₩2,000 인상 시 기존 가족 어떻게? → 별도 정책 spec 필요 (이번 milestone out-of-scope).
3. **자녀 사진 저장소** — Supabase Storage 버킷 신설 vs `family_members.photo_url` (외부 URL)? → MVP는 base64 또는 Supabase Storage. 별도 결정 필요.
4. **부모 1명/2명 다 구독 화면 보이게?** — 결제 권한은 한 명에게만 (가족 admin)? → 현재 `role='parent'` 모두 가능, MVP에서는 그대로.
5. **자녀 등록 후 이름 변경 시 구독 영향?** — `subscriptions.child_id` reference 만 유효, 이름 변경은 무관.

## 17. References

- 비주얼 mockup: `design/Multi-Child UX · Overview v1.html` (5화면 overview, iPhone frame, v3 Illustrated Warm tokens 재사용)
- Superseded: `docs/superpowers/specs/2026-04-18-subscription-design.md` (가족 단위 1:1 구독 → per-child 로 대체)
- Coordinated: `docs/superpowers/specs/2026-04-25-child-device-monitoring-design.md` (스크린타임 통계 — 본 spec 의 RLS 게이트 변경 필요)
- App.jsx 라인 참조: L6628 `_pairedDevice`, L6679 `childPos`, L6682 `allChildPositions`, L6695 `childDeviceStatusMap`
- GSD workflow: `.planning/PROJECT.md`, `.planning/ROADMAP.md` (v1.0 milestone 종료 후 v1.1 다중 자녀 milestone 으로 분리 검토)

## 18. Next Step

본 spec 사용자 승인 후 → `superpowers:writing-plans` 스킬로 9-Phase 구현 계획 작성. 각 phase는 atomic commit + Playwright real-services E2E gate.
