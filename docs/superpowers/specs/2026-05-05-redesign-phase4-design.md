# Phase 4 Design Spec — 운영 5 화면 (Minimal-Pro)

> 2026-05-05 · 운영 5 화면 redesign · sign-off 대상 문서
> 리서치: `.lazyweb/design-research/redesign-phase4-2026-05-05/report.md`
> 기준 토큰: Phase 1+2+3 확립된 `src/styles/tokens.css` (Wanted DS + mode tokens)
> CLAUDE.md hard rules 준수 + memory: 강한 빨강은 SOS 전용 — 위험 액션은 amber 우선 (계정 삭제만 red)
> Phase 1·2·3 sign-off 결과 그대로 유지

---

## 1. 범위와 비범위

### IN scope (Phase 4 — 운영 5 화면, 모두 부모 모드)
- 화면 1: **PairingWizard** (재구성 — 1-thing/1-page + dot progress + 디바이스 종류 picker)
- 화면 2: **SubscriptionScreen** (재구성 — Linear style 플랜 카드 + avatar stepper)
- 화면 3: **친구놀이 약속 만들기** (`FriendPlaydatePanel` + 신규 `CreatePlaydateSheet` 3-step)
- 화면 4: **장소 관리 통합** (savedPlaceMgr/academyMgr/dangerZone → 1 화면 4 카테고리 collapsible)
- 화면 5: **부모 설정 통합** (신규 `ParentSettingsScreen` — 7 그룹, 위험 영역 격리)

### OUT of scope
- 자녀 모드 화면 (Phase 3 그대로)
- 부모 캘린더·홈 (Phase 2 그대로)
- 결제 시스템 (Qonversion) 자체 변경 — 핸들러만 호출
- Supabase 스키마·RPC 시그니처 변경

### 보존 (변경 금지)
- `setupFamily`, `set_family_member_photo_url_by_id` RPC
- Qonversion `purchaseChildSlot`, `useChildSubscriptions`, `deriveChildEntitlements`, `totalMonthlyPrice`
- `find_playdate_candidates`, `get_active_playdate_session`, `upsertPublicPlace`
- 모든 sync.js CRUD: `insert/update/delete Academy/SavedPlace/DangerZone`
- `saveParentPhones`
- 권한·인증 흐름 (SMS, Kakao, ID/PW)
- 자녀 모드에서 운영 화면 접근 차단 (isParent 가드)

---

## 2. 디자인 약속 — Phase 4 운영 화면 헌법

| 차원 | Phase 4 운영 (Minimal-Pro) |
|---|---|
| **마스코트** | **금지** — 도구 톤 절대 |
| **gradient** | **금지** — 단색 stroke 카드만 |
| **카드** | `border: 1px solid var(--line-soft)`, `box-shadow: none` |
| **CTA** | full-width 56px primary, `--theme-accent` solid |
| **section header** | 12/600 caps muted (`.t-section-label` 재사용) |
| **row** | leading icon + label + trailing (toggle / chevron / value) |
| **single-screen-single-decision** | 페어링·약속 = 1 화면 1 input cluster |
| **위험 액션 색** | amber (`--status-cautionary`) 기본, 계정 삭제만 red (`--status-negative`) |
| **위험 액션 위치** | 별도 카드 + `--space-8` spacing 격리 |
| **typography** | body 14-15 / 500, sub 12 / 500 muted |

공유 (Phase 2와 동일):
- Wanted DS 토큰 그대로
- 핑크 #F779A8 accent (CTA·진행 dot 등 minimal 강조)
- 6 카테고리 컬러 (장소·친구놀이 카테고리 dot)

---

## 3. 디자인 토큰 — 신규 추가

```css
/* src/styles/tokens.css 추가 — Phase 4 운영 화면 */
:root {
  /* === Settings rows === */
  --settings-row-height:    56px;           /* 1탭 영역 */
  --settings-row-padding:   var(--space-3) var(--space-4);
  --settings-section-gap:   var(--space-5);
  --settings-group-gap:     var(--space-2); /* 그룹 내 카드 간 */
  --settings-danger-gap:    var(--space-8); /* 위험 영역 격리 */

  /* === Pairing / Wizard progress dots === */
  --wizard-dot-size:        8px;
  --wizard-dot-gap:         var(--space-1);
  --wizard-dot-active:      var(--theme-accent);
  --wizard-dot-inactive:    var(--line-default);
  --wizard-step-padding:    var(--space-screen-pad);
  --wizard-cta-height:      56px;

  /* === Pricing plan card === */
  --plan-card-radius:       var(--radius-card);
  --plan-card-padding:      var(--space-4);
  --plan-card-min-height:   180px;
  --plan-card-recommended-border: 1.5px solid var(--theme-accent);

  /* === Avatar stepper (인원수) === */
  --avatar-stepper-size:    36px;
  --avatar-stepper-gap:     var(--space-2);

  /* === Place category dot === */
  --place-dot-size:         8px;

  /* === Caution (조심할 곳) — amber, NOT red === */
  --place-caution-fg:       var(--status-cautionary-strong);
  --place-caution-bg:       var(--status-cautionary-subtle);
  --place-caution-border:   color-mix(in srgb, var(--status-cautionary) 35%, transparent);
}

/* --- Phase 4 component classes --- */

/* Settings */
.settings-screen {
  position: fixed; inset: 0; z-index: 400;
  background: var(--bg-subtle);
  display: flex; flex-direction: column;
  font-family: var(--font-sans);
}
.settings-header {
  background: var(--bg-base);
  padding: calc(env(safe-area-inset-top, 0px) + var(--space-3)) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--line-soft);
  display: flex; align-items: center; gap: var(--space-3);
  flex-shrink: 0;
}
.settings-back {
  width: 36px; height: 36px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line-soft);
  background: var(--bg-base);
  cursor: pointer;
  font-family: inherit; font-size: 16px;
  color: var(--fg-secondary);
}
.settings-title {
  margin: 0;
  font-size: 17px;
  font-weight: var(--weight-bold);
  color: var(--fg-primary);
}
.settings-body {
  flex: 1; overflow-y: auto;
  padding: var(--space-4) 0 var(--space-6);
}
.settings-section {
  margin-bottom: var(--settings-section-gap);
  padding: 0 var(--space-4);
}
.settings-section-header {
  font-size: 12px;
  font-weight: var(--weight-semibold);
  color: var(--fg-tertiary);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin: 0 0 var(--space-2) var(--space-2);
}
.settings-card {
  background: var(--bg-base);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.settings-row {
  display: flex; align-items: center; gap: var(--space-3);
  min-height: var(--settings-row-height);
  padding: var(--settings-row-padding);
  border-bottom: 1px solid var(--line-subtle);
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  border: none; border-bottom: 1px solid var(--line-subtle);
}
.settings-card > .settings-row:last-child { border-bottom: none; }
.settings-row-icon {
  width: 28px; text-align: center; font-size: 18px;
  flex-shrink: 0;
}
.settings-row-label {
  flex: 1; min-width: 0;
  font-size: 14px;
  font-weight: var(--weight-semibold);
  color: var(--fg-primary);
}
.settings-row-trailing {
  font-size: 13px;
  color: var(--fg-tertiary);
  font-weight: var(--weight-medium);
  flex-shrink: 0;
}
.settings-row-chev::after {
  content: "›"; color: var(--fg-tertiary); margin-left: var(--space-1);
}
.settings-danger-section {
  margin-top: var(--settings-danger-gap);
}
.settings-danger-row {
  color: var(--status-cautionary-strong);
}
.settings-danger-row[data-severity="critical"] {
  color: var(--status-negative-strong);
}

/* Wizard progress dots */
.wizard-dots {
  display: flex; gap: var(--wizard-dot-gap);
  align-items: center; justify-content: center;
}
.wizard-dot {
  width: var(--wizard-dot-size);
  height: var(--wizard-dot-size);
  border-radius: var(--radius-full);
  background: var(--wizard-dot-inactive);
  transition: background var(--duration-fast) var(--easing-standard);
}
.wizard-dot[data-active="true"] {
  background: var(--wizard-dot-active);
  width: 20px; /* current step expands to oval */
  border-radius: var(--radius-pill);
}
.wizard-dot[data-done="true"] {
  background: var(--wizard-dot-active);
  opacity: 0.5;
}

/* Plan cards (subscription) */
.plan-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.plan-card {
  position: relative;
  display: flex; flex-direction: column; gap: var(--space-2);
  padding: var(--plan-card-padding);
  min-height: var(--plan-card-min-height);
  border-radius: var(--plan-card-radius);
  background: var(--bg-base);
  border: 1px solid var(--line-soft);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.plan-card[data-recommended="true"] {
  border: var(--plan-card-recommended-border);
}
.plan-card[data-selected="true"] {
  border: 2px solid var(--theme-accent);
  background: var(--theme-accent-soft);
}
.plan-card-badge {
  position: absolute;
  top: -8px; left: var(--space-3);
  padding: 2px 8px;
  background: var(--theme-accent);
  color: #FFFFFF;
  font-size: 10px;
  font-weight: var(--weight-bold);
  border-radius: var(--radius-pill);
}
.plan-card-name {
  font-size: 13px;
  font-weight: var(--weight-semibold);
  color: var(--fg-secondary);
}
.plan-card-price {
  font-size: 22px;
  font-weight: var(--weight-bold);
  color: var(--fg-primary);
  line-height: 1.1;
}
.plan-card-price-period {
  font-size: 13px;
  font-weight: var(--weight-medium);
  color: var(--fg-tertiary);
}
.plan-card-features {
  list-style: none;
  padding: 0;
  margin: var(--space-2) 0 0;
  display: flex; flex-direction: column; gap: 4px;
}
.plan-card-feature {
  font-size: 12px;
  font-weight: var(--weight-medium);
  color: var(--fg-secondary);
  display: flex; align-items: center; gap: var(--space-1);
}
.plan-card-feature::before {
  content: "✓";
  color: var(--status-positive-strong);
  font-weight: var(--weight-bold);
}

/* Place category */
.place-section {
  background: var(--bg-base);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-card);
  margin-bottom: var(--space-2);
  overflow: hidden;
}
.place-section-head {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
.place-section-head[data-caution="true"] {
  background: var(--place-caution-bg);
  color: var(--place-caution-fg);
}
.place-section-icon {
  font-size: 18px; width: 28px; text-align: center;
}
.place-section-label {
  flex: 1;
  font-size: 14px;
  font-weight: var(--weight-bold);
  color: var(--fg-primary);
}
.place-section-head[data-caution="true"] .place-section-label {
  color: var(--place-caution-fg);
}
.place-section-count {
  font-size: 12px;
  color: var(--fg-tertiary);
  font-weight: var(--weight-medium);
}
.place-section-chev {
  color: var(--fg-tertiary);
  transition: transform var(--duration-fast) var(--easing-standard);
}
.place-section[data-open="true"] .place-section-chev {
  transform: rotate(180deg);
}
.place-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--line-subtle);
  background: var(--bg-base);
}
.place-row-dot {
  width: var(--place-dot-size);
  height: var(--place-dot-size);
  border-radius: var(--radius-full);
  background: var(--rail, var(--theme-accent));
  flex-shrink: 0;
}

/* Avatar stepper */
.avatar-stepper {
  display: flex; gap: var(--avatar-stepper-gap);
  align-items: center;
  padding: var(--space-3);
  background: var(--bg-base);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-card);
}
.avatar-stepper-slot {
  width: var(--avatar-stepper-size);
  height: var(--avatar-stepper-size);
  border-radius: var(--radius-full);
  border: 1px dashed var(--line-default);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  color: var(--fg-tertiary);
  background: var(--bg-base);
}
.avatar-stepper-slot[data-filled="true"] {
  border: 2px solid var(--child-color, var(--theme-accent));
  background: var(--child-color, var(--theme-accent));
  color: #FFFFFF;
  font-weight: var(--weight-bold);
}
```

---

## 4. 화면별 spec

### 4.1 페어링 마법사 (`PairingWizard`)
**현재**: 5 step inline, 진행 표현 약함, OTP/디바이스 picker 없음.
**리디자인**:
- **상단 progress** = `.wizard-dots` (현재 step만 oval, 완료/대기는 dot)
- **6 step 분리** (1 화면 1 결정):
  1. 가족 이름 입력
  2. **자녀 디바이스 종류 picker** (자기 폰 / 부모 공기계 / 키즈폰) — 신규
  3. 자녀 수 선택
  4. 자녀별 상세 (이름/생년월일/색)
  5. 페어링 코드 표시 + 자녀 디바이스 OTP 입력 (`autocomplete="one-time-code"`)
  6. 완료 요약 + "시작하기" CTA
- **CTA** = full-width 56px primary 핑크 fill
- **back 버튼** 좌상단만 — 닫기 X 버튼 없음 (실수 방지)

### 4.2 구독 (`SubscriptionScreen`)
**현재**: 자녀별 toggle만, 플랜 비교 없음.
**리디자인**:
- **avatar stepper**: 우리 가족 아이 N명 visualization (자녀 색 dot), tap으로 toggle
- **plan-grid 2 column**: 월 플랜 / 년 플랜 — 추천(년)에 `data-recommended="true"` + "추천" 배지
- **PriceSummary**: 카드 안에 합계 (인원 변경 시 부드러운 transition)
- **CTA**: "체험으로 시작하기" full-width 56px (trial 가능 시) / "구독하기"
- **자동 갱신 고지**: CTA 아래 1줄 12/500 muted

### 4.3 친구놀이 약속 만들기 (신규 `CreatePlaydateSheet`)
**현재**: panel inline form만.
**리디자인**: EventSheet 재사용 (80vh), 3 step:
1. 누구랑 — 친구 가족 선택 (연락처 또는 카카오 공유)
2. 언제·어디서 — 안전장소 picker + 날짜·시간
3. 안전 옵션 — 알림·만료시간 설정 + "보내기"
- 진행 dots `.wizard-dots` 시트 헤더에
- 기존 ActiveBanner / ActiveCard / Toggle / SafePlace / History는 톤만 정비 (stroke-first 적용, gradient 제거)

### 4.4 장소 관리 통합 (신규 `PlaceManagerScreen`)
**현재**: 3 별도 진입점 (`showSavedPlaceMgr`, `showAcademyMgr`, dangerZone inline).
**리디자인**: 1 화면 4 collapsible section (`.place-section`):
1. 🏠 집 (1)
2. 🎒 학원 (N) — academies
3. 🌳 자주 가는 곳 (N) — savedPlaces (집 제외)
4. ⚠️ 조심할 곳 (N) — dangerZones, **amber 톤 (`data-caution="true"`)**
- 우상단 "+" → 컨텍스트별 추가 sheet
- 행 swipe로 편집/삭제 (long-press 대안)
- **"조심할 곳" 색은 amber만** — 강한 빨강 절대 금지 (memory rule)

### 4.5 부모 설정 통합 (신규 `ParentSettingsScreen`)
**현재**: 모달 흩어짐 (showPairing, showSubscriptionSettings, showPhoneSettings, …).
**리디자인**: 1 화면 7 그룹:
1. **내 계정** — 이름·이메일·전화번호 (편집 진입)
2. **자녀 관리** — 자녀 목록 + "자녀 추가" → PairingWizard 재진입
3. **알림** — 일정 알림 / 자녀 위치 알림 / 친구놀이 알림 (토글)
4. **구독** — 현재 플랜 + "구독 관리" → SubscriptionScreen 진입
5. **데이터·개인정보** — 데이터 다운로드 / 개인정보 처리방침
6. **도움말** — FAQ / 문의하기 / 버전 정보
7. **위험 영역** (`.settings-danger-section` 격리):
   - 로그아웃 (amber, 단순 confirm)
   - 자녀 연결 해제 (amber, 자녀 이름 입력 confirm)
   - 구독 해지 (amber, 잃는 혜택 list)
   - 계정 삭제 (red, "삭제" 타이핑 + 30일 grace)

진입: 부모 홈 우상단 ⚙ 또는 bottom tab "설정" 추가

---

## 5. 보존 핸들러·호출 매핑

| 화면 | 보존 핸들러 |
|---|---|
| PairingWizard | `setupFamily`, `set_family_member_photo_url_by_id` |
| SubscriptionScreen | `useChildSubscriptions`, `deriveChildEntitlements`, `totalMonthlyPrice`, `purchaseChildSlot` |
| CreatePlaydateSheet | `find_playdate_candidates`, `get_active_playdate_session`, `upsertPublicPlace` |
| PlaceManagerScreen | sync.js CRUD 모두 (insert/update/delete Academy/SavedPlace/DangerZone) |
| ParentSettingsScreen | `saveParentPhones`, `supabase.auth.signOut`, Qonversion entitlement |

---

## 6. Sign-off 안건 (10건)

각 항목 **승인 / 변경 / 보류** 중 선택. "권장안 다 ok"로 일괄 승인 가능.

1. **페어링 6 step 분리** — 5 → 6 (디바이스 종류 picker 추가) **권장**. 또는 5 step 유지.
2. **OTP single input + AutoFill** — multi-box 금지 **권장 (확정)**. OS AutoFill 활용.
3. **plan-grid 2 column 가로** — 월/년 가로 비교 **권장**. 또는 세로 stacked.
4. **avatar stepper 인원수** — 자녀 색 dot로 visualization **권장**. 또는 단순 chip stepper (1·2·3·4).
5. **친구놀이 3 step sheet** — Calendly 풍 분리 **권장**. 또는 single form 유지.
6. **장소 관리 4 카테고리 통합 화면** — 집·학원·자주 가는 곳·조심할 곳 1 화면 **권장**. 또는 기존 3 별도 진입 유지.
7. **"조심할 곳" amber only** — 빨강 절대 금지 (memory rule) **권장 (확정)**.
8. **부모 설정 7 그룹 통합 화면** — 흩어진 모달 → 1 화면 **권장**. 또는 기존 흩어짐 유지하고 진입 hub만.
9. **위험 영역 색 단계** — 로그아웃/연결해제/구독해지 = amber, 계정삭제 = red **권장 (확정)**.
10. **계정 삭제 = "삭제" 타이핑 + 30일 grace** — 의도치 않은 데이터 손실 차단 **권장**. 또는 단순 confirm.

---

## 7. 작업 우선순위 (risk 낮은 → 높은)

1. tokens.css 신규 토큰 추가
2. 신규 컴포넌트 (의존 없음): PlaceManagerScreen, ParentSettingsScreen
3. CreatePlaydateSheet (EventSheet 재사용)
4. SubscriptionScreen 재구성 (기존 컴포넌트 톤 정비)
5. PairingWizard step 분리 (가장 위험 — 인증 흐름)
6. App.jsx 라우팅 통합 (모달 → 화면 진입)
7. 빌드 검증

---

## 8. 비정상 케이스

- **다크 모드** — 모든 새 토큰 prefers-color-scheme: dark override
- **테마 픽커 6색 변경** — `--theme-accent` propagation 검증
- **prefers-reduced-motion** — wizard-dot transition 가드 이미 토큰 단계에서 처리
- **OTP 자동 입력 실패** — 사용자가 직접 6자리 입력 가능 (numeric inputmode)
- **구독 해지 후 trial 다시 못 받음** — 카드에 명시
- **자녀 연결 해제 = 데이터 보존** — 30일 보존 후 영구 삭제 안내

---

## 9. 완료 기준 (acceptance)

- [ ] 5 화면 모두 Phase 4 토큰만 사용 (CLAUDE.md hard rule)
- [ ] 마스코트·gradient 0건 (운영 화면 도구 톤 보장)
- [ ] 강한 빨강 = 계정 삭제만 (memory rule 준수)
- [ ] `npm run build` exit 0
- [ ] 다크 모드에서 색·대비 깨지지 않음
- [ ] 모든 보존 핸들러 호출 시그니처 변경 없음
- [ ] 자녀 모드에서 운영 화면 진입 차단 (isParent 가드)
- [ ] OTP single input + AutoFill 검증
- [ ] 위험 액션 confirm flow 동작

---

> **다음 단계**: 사용자 sign-off (10건) → 코드 적용
