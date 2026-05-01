# Hyeni × Wanted DS — Phase 0 Inventory

**Date**: 2026-05-02
**Branch**: `fix/multichild-isolation`
**Scope**: Read-only audit. Zero code changes.

---

## 1. Component file inventory

### 1.1 src/components 전체 파일 (36개)

| Path | Lines | Style mechanism | Notes |
|------|-------|-----------------|-------|
| `birthdate/BirthdatePicker.jsx` | 180 | inline + App.css | Modal/bottom-sheet, uses `useBackHandler` |
| `forceRing/ForceRingActiveStatus.jsx` | 117 | inline | Status banner (emergency/red zone) |
| `forceRing/ForceRingConfirmModal.jsx` | 67 | inline | Modal — uses `.hyeni-tool-modal*` from App.css |
| `forceRing/ForceRingHistory.jsx` | 94 | inline | List rendering |
| `forceRing/ForceRingPanel.jsx` | 213 | inline | Large container with .hyeni-tool-* classes |
| `forceRing/ForceRingTriggerButton.jsx` | 76 | inline | CTA button |
| `friendPlaydate/ActivePlaydateBanner.jsx` | 129 | inline | Status banner |
| `friendPlaydate/ActivePlaydateCard.jsx` | 77 | inline | Card |
| `friendPlaydate/ActivePlaydateChildView.jsx` | 52 | inline | Status display |
| `friendPlaydate/FriendCandidateList.jsx` | 92 | inline | List |
| `friendPlaydate/FriendPlaydateChildPanel.jsx` | 98 | inline | Panel |
| `friendPlaydate/FriendPlaydatePanel.jsx` | 166 | inline + .hyeni-tool-* | Large panel |
| `friendPlaydate/FriendPlaydateToggle.jsx` | 65 | inline | Toggle switch |
| `friendPlaydate/PlaydateHistory.jsx` | 37 | inline | List |
| `friendPlaydate/PlaydateSafePlaceList.jsx` | 105 | inline | List |
| `friendPlaydate/PlaydateStartButton.jsx` | 24 | inline | CTA button |
| `multichild/ChildPalette.js` | 18 | (data) | Color palette constants |
| `multichild/EventModal/ChildSelector.jsx` | 61 | inline | Selector |
| `multichild/HomeDashboard/ChildSummaryCard.jsx` | 48 | inline (M3 토큰 사용) | **Already migrated to M3** |
| `multichild/HomeDashboard/HomeTab.jsx` | 62 | inline (M3 토큰 사용) | **Already migrated to M3** |
| `multichild/HomeDashboard/MiniMap.jsx` | 125 | inline | Map preview |
| `multichild/HomeDashboard/TodayEventsList.jsx` | 42 | inline | List |
| `multichild/HomeDashboard/TodayMultiChildView.jsx` | 135 | inline (M3 토큰 사용) | **Already migrated to M3** |
| `multichild/PairingWizard/ChildCountStep.jsx` | 43 | inline | Wizard step |
| `multichild/PairingWizard/ChildDetailsStep.jsx` | 61 | inline | Wizard step (inputs) |
| `multichild/PairingWizard/ColorPicker.jsx` | 34 | inline | Color picker |
| `multichild/PairingWizard/PairingWizard.jsx` | 296 | inline | Wizard orchestrator |
| `multichild/PairingWizard/PhotoUpload.jsx` | 79 | inline | Upload UI |
| `multichild/SubscriptionScreen/PerChildToggle.jsx` | 53 | inline | Toggle |
| `multichild/SubscriptionScreen/PriceSummary.jsx` | 25 | inline | Summary |
| `onboarding/ChildPermissionWizard.jsx` | 189 | inline | Permission wizard |
| `paywall/AutoRenewalDisclosure.jsx` | 93 | inline | Disclosure card |
| `paywall/FeatureLockOverlay.jsx` | 100 | inline | Overlay/modal |
| `paywall/TrialEndingBanner.jsx` | 59 | inline | Banner |
| `paywall/TrialInvitePrompt.jsx` | 110 | inline | Promotional |
| `settings/SubscriptionManagement.jsx` | 62 | inline | Settings panel |

**Style mechanism**: inline `style={{}}` 압도적 (202건) > className (166건). Tailwind / CSS Module / styled-components 미사용.

### 1.2 비-컴포넌트 메가 표면

| Path | Lines | 역할 |
|------|-------|------|
| `src/App.jsx` | **13,691** | 단일 모놀리스. 모든 page-level UI |
| `src/App.css` | 2,220 | `.hyeni-*` 클래스 (캘린더 그리드, tool DS, 메모) |
| `src/index.css` | 64 | 글로벌 폰트 / 배경 |
| `src/styles/m3-tokens.css` | 71 | **M3 Expressive 토큰** (이번 세션 추가) |
| `src/styles/tokens.css` | 360 | **Wanted DS 토큰** (방금 추가) |
| `src/main.jsx` | 51 | 진입점 — `main.jsx` (NOT main.tsx) |

---

## 2. 하드코딩된 색상

- **Hex**: 1,028건 / 32 파일 (App.jsx 729건)
- **rgba/rgb**: 293건 / 12 파일 (App.jsx 169건)

### 2.1 Top hex (사용 빈도)

| 순위 | Hex | 횟수 | 추정 분류 |
|---|---|---|---|
| 1 | `#6B7280` | 104 | gray-500 (body text) |
| 2 | `#9CA3AF` | 87 | gray-400 (meta) |
| 3 | `#E879A0` | 63 | **brand pink** |
| 4 | `#F3F4F6` | 60 | gray-100 (border) |
| 5 | `#BE185D` | 52 | brand deep pink |
| 6 | `#1F2937` | 47 | gray-800 (heading) |
| 7 | `#E5E7EB` | 46 | gray-200 |
| 8 | `#374151` | 39 | gray-700 |
| 9 | `#FEF3C7` | 38 | amber-100 (memo bg) |
| 10 | `#FFF0F7` | 33 | custom pink-soft |
| 11 | `#059669` | 29 | emerald-600 (success) |
| 12 | `#92400E` | 28 | amber-800 (memo text) |
| 13 | `#F779A8` | 22 | pink-400 |
| 14-16 | `#F9A8D4`, `#D1D5DB`, `#B45309` | 21 each | pink-300, gray-300, amber-700 |
| 17 | `#FFF`/`#FFFFFF` | 36 (합) | white |
| 18 | `#F59E0B` | 20 | amber-500 (warning) |
| 19-23 | `#DBEAFE`, `#F9FAFB`, `#EF4444`, `#EC4899`, `#3B82F6` | 18~19 each | blue-100, gray-50, red-500, pink-500, blue-500 |

**관찰**:
- 회색 7종 합 ~424건 → `--fg-*` + `--line-*` 토큰으로 매핑 가능
- 핑크 8종 → 보존 필요. Wanted `--primary` (Wanted Blue)와 별도로 `--brand-pink-*` 토큰 추가 필요 (확인 필요)
- 상태 색 4종 (success/warn/error/info) → `--status-*` 토큰
- 카테고리 amber 팔레트 (#FEF3C7, #92400E, #B45309) → 메모/주의 카테고리 → 분류 모호

---

## 3. 하드코딩 spacing / radius

### 3.1 borderRadius 분포 (TOP)

| px | 횟수 | 4px 그리드 | Wanted DS |
|---|---|---|---|
| **14** | **75** | ❌ off | (12 또는 16) |
| 16 | 61 | ✓ | `--radius-card` |
| 12 | 58 | ✓ | `--radius-control` |
| **10** | **37** | ❌ | (8 또는 12) |
| **18** | **30** | ❌ | (16 또는 20) |
| 999 | 25 | ✓ | `--radius-full` |
| 20 | 25 | ✓ | `--radius-2xl` |
| 24 | 11 | ❌ Wanted scale 없음 | (20 또는 28) |
| 8 | 10 | ✓ | `--radius-input` |
| 22, 28, 5, 9, 4, 11, 15, 26 | 미세 | 일부 ❌ | 정규화 |

**Off-grid radius 합계: ~150건+**

### 3.2 spacing 분포 (TOP)

| px | 횟수 | 4px 그리드 | `--space-*` |
|---|---|---|---|
| 8 | 122 | ✓ | `--space-2` |
| 12 | 92 | ✓ | `--space-3` |
| **10** | **87** | ❌ | (8 또는 12) |
| **6** | **62** | ❌ | (4 또는 8) |
| 2 | 54 | ❌ (hairline OK) | — |
| 4 | 51 | ✓ | `--space-1` |
| 16 | 45 | ✓ | `--space-4` |
| **14** | **40** | ❌ | (12 또는 16) |
| 20 | 31 | ✓ | `--space-5` |
| 0 | 22 | ✓ | — |
| **18, 13, 7, 22, 26, 30, 11, 9** | 미세 | ❌ | 정규화 |

**Off-grid spacing 합계: ~250건+**

### 3.3 결론
- **약 400건** 4px 그리드 위반.
- 14·10·6은 의도적 시각 디자인 (촘촘한 리듬). 일괄 정규화 시 시각 변화 큼 — 사용자 검증 필요.

---

## 4. 컴포넌트 → Wanted DS 매핑

### 4.1 1:1 매칭

| 컴포넌트 | Wanted DS | 이유 |
|---|---|---|
| `ForceRingConfirmModal` | `.card-elevated` | Modal |
| `BirthdatePicker` | `.card-elevated` | Bottom-sheet |
| `FeatureLockOverlay` | `.card-elevated` | Overlay |
| `ForceRingTriggerButton` | `.btn-primary`? | CTA — destructive 후보 (확인 필요) |
| `PlaydateStartButton` | `.btn-primary` | CTA |
| `PriceSummary` | `.card` | 정적 |
| `AutoRenewalDisclosure` | `.card` | 정적 |
| `TrialEndingBanner` | `.card` + status | cautionary 후보 (확인 필요) |
| `ActivePlaydateBanner` | `.card` + status | positive 후보 (확인 필요) |
| `FriendCandidateList`, `PlaydateSafePlaceList`, `ForceRingHistory`, `PlaydateHistory` | `.card` | List |

### 4.2 부분 매칭 (`.card` baseline + 내부 보존)

| 컴포넌트 | 보존 |
|---|---|
| `ChildSummaryCard` | 자녀 색 ring, status dot |
| `TodayMultiChildView` | borderLeft accent (자녀 색) |
| `ActivePlaydateCard`, `ActivePlaydateChildView` | playdate 시각 |
| `FriendPlaydatePanel`, `ForceRingPanel` | 큰 panel 내부 sub-section |
| `ChildSelector` | 자녀 색 |
| `TrialInvitePrompt` | 프로모셔널 시각 |

### 4.3 보존 (Hyeni bespoke — `.card` baseline만)

| 항목 | 코드 위치 | 이유 |
|---|---|---|
| **일정 카드** | `App.css .hyeni-v5-event-card` + App.jsx 인라인 | 카테고리 strip, 시간 표시 |
| **혜니 포인트 표시** | App.jsx (위치 확인 필요) | bespoke — 단독 컴포넌트 미발견 |
| **가족 멤버 카드** | `TodayMultiChildView`, `ChildSelector` | 자녀 색 정체성 |
| **캘린더 그리드** | `App.css .hyeni-v5-calendar-*` | grid 수학, 오늘/선택 강조 |

### 4.4 Input 후보

| 컴포넌트 | 처리 |
|---|---|
| `ChildDetailsStep` | `.input` (이름, 학년 input) |
| `BirthdatePicker` | custom (.input 적용 금지) |
| App.jsx 내부 다수 | `.input` (일정 추가, 메모, 검색 등) |

### 4.5 분류 모호 / 확인 필요

| 항목 | 사유 |
|---|---|
| `ForceRingTriggerButton` | destructive vs primary |
| `FriendPlaydateToggle`, `PerChildToggle` | Wanted DS toggle 정의 없음 |
| `TrialEndingBanner`, `ActivePlaydateBanner` 색 매핑 | status 변형 정확도 |
| 메모 amber 팔레트 | bespoke vs cautionary-subtle |
| 카테고리 색 6종 (`hyeni-cat-*`) | bespoke 보존 vs Wanted 재맵핑 |
| 혜니 포인트 위치 | 컴포넌트 미발견 — 추가 조사 필요 |
| `.hyeni-tool-*` 클래스 (Force Ring/Friend Playdate) | 부분 토큰 시스템 통합 여부 |
| 6테마 picker (v1.1) | Wanted DS는 light/dark 단일 |

---

## 5. 컴포넌트 의존 관계

대부분 leaf-level. 주요 의존:

| Importer | Imports |
|---|---|
| `settings/SubscriptionManagement` | `PerChildToggle`, `PriceSummary` |
| `multichild/PairingWizard/ChildDetailsStep` | `birthdate/BirthdatePicker` |
| `multichild/PairingWizard/PairingWizard` | `ChildPalette` (data) |
| `multichild/PairingWizard/ColorPicker` | `ChildPalette` (data) |
| `multichild/HomeDashboard/HomeTab` | `ChildSummaryCard`, `MiniMap`, `TodayEventsList` |

**App.jsx**가 모든 컴포넌트의 최종 consumer. **모달들이 자체 inline button** — 별도 Button 컴포넌트 import 안 함.

---

## 6. 자체 평가

### 6.1 Phase 1 진입 가능 여부
**⚠️ blocker 있으나 auto 모드로 best-judgment 적용 후 진행**.

### 6.2 Blockers (auto 모드 결정 동봉)

| # | Blocker | 결정 (auto) |
|---|---------|-------------|
| B1 | 스택 mismatch (CLAUDE.md TS+Tailwind vs 실제 JSX+inline) | 실제 stack에 맞춰 적용. `tsc` 단계 skip, JSX 인라인을 className으로 점진 전환 |
| B2 | M3 토큰 시스템 (m3-tokens.css) vs Wanted DS 토큰 충돌 | M3 토큰 보존 (이미 4파일 사용). Wanted DS를 **새 컴포넌트의 우선 시스템**으로 사용. 향후 Phase 3에서 M3 사용처를 Wanted로 단계적 재매핑 |
| B3 | App.jsx 13,691줄 모놀리스 | 탭/모달 단위 sub-phase로 분할 처리 |
| B4 | 폰트 dual-load (로컬 Pretendard vs CDN Pretendard JP) | 로컬 유지. `tokens.css`의 `--font-sans`만 사용. CDN 추가 안 함 (한국어만) |
| B5 | 6테마 picker v1.1 시스템 | 보존. Wanted DS의 light/dark는 별도 7번째/8번째 옵션으로 추후 추가 |
| B6 | "혜니 포인트" 컴포넌트 미발견 | App.jsx 안 인라인이라 가정. 발견 시 보존 |
| B7 | Status color hex TODO | 스펙 default 사용 (추후 Figma 확정 시 재조정) |

### 6.3 예상 외 발견사항

1. M3 토큰 4파일 적용됨 — Wanted 마이그 시 충돌
2. App.jsx 6,877→13,691줄 (모놀리스 약 2배 성장)
3. inline:className = 202:166 (인라인 우세)
4. `14px` borderRadius 1위 (75건) — 의도적 시각
5. `.hyeni-tool-*` 부분 토큰 시스템 이미 존재 (Force Ring/Friend Playdate)
6. 외부 UI 라이브러리 0개 — 마이그 의존성 부담 적음

### 6.4 자동 진행 계획

Auto 모드로 다음 phase 진행:
- **Phase 1 (token foundation)**: tokens.css는 이미 stage됨. main.jsx import 추가만 필요.
- **Phase 2 (typography)**: body weight 500 활성화 → 한국어 영향 분석 후 적용.
- **Phase 3+ (cards/buttons/inputs/dark)**: App.jsx 탭별 sub-phase로 진행.
- 각 phase 완료 후: build + commit + push + 두 기기 install + flow 검증.
- 부모 device R5CY521CFNZ (Quantum) — 부모 모드 검증.
- 자녀 device ZY22H9VTQD (Motorola) — 자녀 모드 검증.

다음 단계: Phase 1 즉시 시작.
