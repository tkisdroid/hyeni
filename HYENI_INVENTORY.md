# Hyeni × Wanted DS — Phase 0 Inventory

**Date**: 2026-05-02
**Branch**: `fix/multichild-isolation`
**Scope**: Read-only audit. Zero code changes.
**Spec source**: [files/WANTED_DS_SPEC.md](files/WANTED_DS_SPEC.md), [files/MIGRATION_PLAN.md](files/MIGRATION_PLAN.md), [files/CLAUDE.md](files/CLAUDE.md), [files/tokens.css](files/tokens.css)
**Already in repo**: [src/styles/tokens.css](src/styles/tokens.css), [src/styles/m3-tokens.css](src/styles/m3-tokens.css), `tokens.css` import in [src/main.jsx](src/main.jsx#L3) (Phase 1 commit `2c198e5`)

---

## 1. Component file inventory

### 1.1 src/components 파일 36개 (라인 수 검증 완료)

| # | Path | Lines | Inline `style={{}}` | className | M3 토큰 | Wanted 토큰 |
|---|------|------:|---:|---:|:---:|:---:|
| 1 | [birthdate/BirthdatePicker.jsx](src/components/birthdate/BirthdatePicker.jsx) | 180 | 7 | — | — | — |
| 2 | [forceRing/ForceRingActiveStatus.jsx](src/components/forceRing/ForceRingActiveStatus.jsx) | 117 | 2 | 28 | — | — |
| 3 | [forceRing/ForceRingConfirmModal.jsx](src/components/forceRing/ForceRingConfirmModal.jsx) | 67 | 3 | 10 | — | — |
| 4 | [forceRing/ForceRingHistory.jsx](src/components/forceRing/ForceRingHistory.jsx) | 94 | 3 | 8 | — | — |
| 5 | [forceRing/ForceRingPanel.jsx](src/components/forceRing/ForceRingPanel.jsx) | 213 | 2 | 33 | — | — |
| 6 | [forceRing/ForceRingTriggerButton.jsx](src/components/forceRing/ForceRingTriggerButton.jsx) | 76 | 1 | 4 | — | — |
| 7 | [friendPlaydate/ActivePlaydateBanner.jsx](src/components/friendPlaydate/ActivePlaydateBanner.jsx) | 129 | 8 | 7 | — | — |
| 8 | [friendPlaydate/ActivePlaydateCard.jsx](src/components/friendPlaydate/ActivePlaydateCard.jsx) | 77 | 4 | 9 | — | — |
| 9 | [friendPlaydate/ActivePlaydateChildView.jsx](src/components/friendPlaydate/ActivePlaydateChildView.jsx) | 52 | 4 | 8 | — | — |
| 10 | [friendPlaydate/FriendCandidateList.jsx](src/components/friendPlaydate/FriendCandidateList.jsx) | 92 | 2 | 17 | — | — |
| 11 | [friendPlaydate/FriendPlaydateChildPanel.jsx](src/components/friendPlaydate/FriendPlaydateChildPanel.jsx) | 98 | — | — | — | — |
| 12 | [friendPlaydate/FriendPlaydatePanel.jsx](src/components/friendPlaydate/FriendPlaydatePanel.jsx) | 166 | 3 | 12 | — | — |
| 13 | [friendPlaydate/FriendPlaydateToggle.jsx](src/components/friendPlaydate/FriendPlaydateToggle.jsx) | 65 | — | 10 | — | — |
| 14 | [friendPlaydate/PlaydateHistory.jsx](src/components/friendPlaydate/PlaydateHistory.jsx) | 37 | — | 5 | — | — |
| 15 | [friendPlaydate/PlaydateSafePlaceList.jsx](src/components/friendPlaydate/PlaydateSafePlaceList.jsx) | 105 | 4 | 10 | — | — |
| 16 | [friendPlaydate/PlaydateStartButton.jsx](src/components/friendPlaydate/PlaydateStartButton.jsx) | 24 | 2 | 4 | — | — |
| 17 | [multichild/ChildPalette.js](src/components/multichild/ChildPalette.js) | 18 | — | — | — | — |
| 18 | [multichild/EventModal/ChildSelector.jsx](src/components/multichild/EventModal/ChildSelector.jsx) | 61 | 7 | — | — | — |
| 19 | [multichild/HomeDashboard/ChildSummaryCard.jsx](src/components/multichild/HomeDashboard/ChildSummaryCard.jsx) | 48 | 8 | — | **Y** | — |
| 20 | [multichild/HomeDashboard/HomeTab.jsx](src/components/multichild/HomeDashboard/HomeTab.jsx) | 62 | 2 | — | **Y** | — |
| 21 | [multichild/HomeDashboard/MiniMap.jsx](src/components/multichild/HomeDashboard/MiniMap.jsx) | 125 | 3 | — | — | — |
| 22 | [multichild/HomeDashboard/TodayEventsList.jsx](src/components/multichild/HomeDashboard/TodayEventsList.jsx) | 42 | 7 | — | — | — |
| 23 | [multichild/HomeDashboard/TodayMultiChildView.jsx](src/components/multichild/HomeDashboard/TodayMultiChildView.jsx) | 135 | 18 | 1 | **Y** | — |
| 24 | [multichild/PairingWizard/ChildCountStep.jsx](src/components/multichild/PairingWizard/ChildCountStep.jsx) | 43 | 5 | — | — | — |
| 25 | [multichild/PairingWizard/ChildDetailsStep.jsx](src/components/multichild/PairingWizard/ChildDetailsStep.jsx) | 61 | 9 | — | — | — |
| 26 | [multichild/PairingWizard/ColorPicker.jsx](src/components/multichild/PairingWizard/ColorPicker.jsx) | 34 | 2 | — | — | — |
| 27 | [multichild/PairingWizard/PairingWizard.jsx](src/components/multichild/PairingWizard/PairingWizard.jsx) | 296 | 20 | — | — | — |
| 28 | [multichild/PairingWizard/PhotoUpload.jsx](src/components/multichild/PairingWizard/PhotoUpload.jsx) | 79 | 4 | — | — | — |
| 29 | [multichild/SubscriptionScreen/PerChildToggle.jsx](src/components/multichild/SubscriptionScreen/PerChildToggle.jsx) | 53 | 8 | — | — | — |
| 30 | [multichild/SubscriptionScreen/PriceSummary.jsx](src/components/multichild/SubscriptionScreen/PriceSummary.jsx) | 25 | 4 | — | — | — |
| 31 | [onboarding/ChildPermissionWizard.jsx](src/components/onboarding/ChildPermissionWizard.jsx) | 189 | 18 | — | — | — |
| 32 | [paywall/AutoRenewalDisclosure.jsx](src/components/paywall/AutoRenewalDisclosure.jsx) | 93 | 8 | — | — | — |
| 33 | [paywall/FeatureLockOverlay.jsx](src/components/paywall/FeatureLockOverlay.jsx) | 100 | 9 | — | — | — |
| 34 | [paywall/TrialEndingBanner.jsx](src/components/paywall/TrialEndingBanner.jsx) | 59 | 6 | — | — | — |
| 35 | [paywall/TrialInvitePrompt.jsx](src/components/paywall/TrialInvitePrompt.jsx) | 110 | 12 | — | — | — |
| 36 | [settings/SubscriptionManagement.jsx](src/components/settings/SubscriptionManagement.jsx) | 62 | 7 | — | — | — |

**합계**: 36 파일 / inline `style={{}}` 호출 **202건** (32 파일) / className **166건** (15 파일).
- styled-components: **0**
- CSS Module: **0**
- Tailwind: **0** (Tailwind config / class 모두 없음)
- 외부 UI 라이브러리: **0**

### 1.2 비-컴포넌트 메가 표면

| Path | Lines | 역할 |
|------|------:|------|
| [src/App.jsx](src/App.jsx) | **13,691** | 단일 모놀리스. 모든 page-level UI / 모달 / 캘린더 / 메모 / 설정 |
| [src/App.css](src/App.css) | 2,220 | `.hyeni-*` 클래스 (캘린더 그리드, tool DS, 메모, 가족 카드) |
| [src/index.css](src/index.css) | 63 | 글로벌 폰트 / 배경 |
| [src/styles/m3-tokens.css](src/styles/m3-tokens.css) | 71 | **M3 Expressive 토큰** (이전 세션 commit `5560a67/6592738/8d96132`) |
| [src/styles/tokens.css](src/styles/tokens.css) | 359 | **Wanted DS 토큰** (Phase 1 commit `2c198e5`) |
| [src/main.jsx](src/main.jsx) | 52 | 진입점 (`main.jsx`, NOT `main.tsx`). Tokens 둘 다 import. ErrorBoundary 인라인 색상 보유 |

### 1.3 [src/App.jsx](src/App.jsx)가 직접 import 하는 컴포넌트 (15개)

```
BirthdatePicker, PairingWizard, HomeTab, TodayMultiChildView,
ChildPermissionWizard, ChildSelector,
TrialInvitePrompt, FeatureLockOverlay, TrialEndingBanner, AutoRenewalDisclosure,
SubscriptionManagement,
FriendPlaydatePanel, FriendPlaydateChildPanel, ActivePlaydateBanner,
ForceRingPanel
```

App.jsx 내부 element 카운트: `<button>` **184**, `<input>` **31**, `<textarea>` **2**, `<select>` **1**.
컴포넌트 측 element: `<button>/<input>/<textarea>/<select>` **49** (26 파일).

---

## 2. 하드코딩된 색상

`src/**/*.{jsx,js}` 한정 (App.css, index.css 제외).

- **Hex 리터럴**: **882건 / 27 파일** (`/#[0-9a-fA-F]{3,8}\b/`)
- **rgba/rgb**: **185건 / 9 파일** (`/rgba?\([^)]+\)/`)
- App.jsx 단독: hex **729건**, rgba **169건** (전체의 약 88%, 91%)

### 2.1 Hex 빈도 — Top 25 (실측)

| 순위 | Hex | 횟수 | 추정 분류 | 대표 위치 |
|---:|---|---:|---|---|
| 1 | `#6B7280` | 104 | gray-500 (body/secondary) | App.jsx 다수, [src/main.jsx#L28](src/main.jsx#L28) |
| 2 | `#9CA3AF` | 87 | gray-400 (meta) | [src/main.jsx#L31](src/main.jsx#L31), App.jsx |
| 3 | `#E879A0` | 61 | **brand pink** (혜니 강조) | [src/main.jsx#L27](src/main.jsx#L27), App.jsx |
| 4 | `#F3F4F6` | 60 | gray-100 (border, subtle bg) | App.jsx |
| 5 | `#BE185D` | 49 | brand deep pink | App.jsx |
| 6 | `#1F2937` | 47 | gray-800 (heading) | App.jsx |
| 7 | `#E5E7EB` | 45 | gray-200 (divider) | App.jsx |
| 8 | `#374151` | 38 | gray-700 (sub-heading) | App.jsx |
| 9 | `#FEF3C7` | 34 | amber-100 (메모 bg) | App.jsx |
| 10 | `#FFF0F7` | 33 | custom pink-soft (브랜드 표면) | [src/main.jsx#L25](src/main.jsx#L25), App.jsx |
| 11 | `#059669` | 25 | emerald-600 (positive) | App.jsx |
| 12 | `#92400E` | 24 | amber-800 (메모 텍스트) | App.jsx |
| 13 | `#D1D5DB` | 21 | gray-300 (border) | App.jsx, [ChildSummaryCard.jsx#L42](src/components/multichild/HomeDashboard/ChildSummaryCard.jsx#L42) |
| 13 | `#B45309` | 21 | amber-700 | App.jsx |
| 15 | `#F9A8D4` | 19 | pink-300 | App.jsx |
| 15 | `#F779A8` | 19 | pink-400 | App.jsx |
| 15 | `#F59E0B` | 19 | amber-500 (warning) | App.jsx, [ChildSummaryCard.jsx#L2](src/components/multichild/HomeDashboard/ChildSummaryCard.jsx#L2) |
| 18 | `#EF4444` | 18 | red-500 (negative) | App.jsx, [ChildSummaryCard.jsx#L2](src/components/multichild/HomeDashboard/ChildSummaryCard.jsx#L2) |
| 19 | `#F9FAFB` | 17 | gray-50 (bg) | App.jsx, [src/main.jsx#L31](src/main.jsx#L31) |
| 19 | `#3B82F6` | 17 | blue-500 (info) | App.jsx |
| 21 | `#DBEAFE` | 16 | blue-100 | App.jsx |
| 21 | `#D1FAE5` | 16 | emerald-100 | App.jsx |
| 23 | `#EC4899` | 15 | pink-500 | App.jsx |
| 24 | `#FCE7F3` | 14 | pink-100 | App.jsx |
| 24 | `#10B981` | 14 | emerald-500 (positive) | [ChildSummaryCard.jsx#L2](src/components/multichild/HomeDashboard/ChildSummaryCard.jsx#L2), App.jsx |

(이하 `#047857`, `#FBCFE8`, `#FFFFFF`/`#FFF`, `#EFF6FF`, `#111827`, `#065F46`, `#FFF7ED`, `#FFB3D1`, `#ECFDF5`, `#A78BFA`, `#64748B` 등 — 전체 hex 고유값 약 60종.)

**관찰 — 분류**:
- **회색 패밀리** (`#6B7280`, `#9CA3AF`, `#1F2937`, `#374151`, `#E5E7EB`, `#F3F4F6`, `#D1D5DB`, `#F9FAFB`, `#111827`, `#64748B`) → 합 **497건**, Wanted `--fg-*` / `--line-*` / `--bg-*` 토큰으로 매핑 가능.
- **브랜드 핑크** (`#E879A0`, `#BE185D`, `#F779A8`, `#F9A8D4`, `#EC4899`, `#FCE7F3`, `#FBCFE8`, `#FFF0F7`, `#FFB3D1`) → 합 **189건**. **확인 필요** — Wanted `--primary` (Wanted Blue)와 별도. CLAUDE.md "기존 brand colors 보존" 규칙에 따라 `--brand-pink-*` 토큰을 `tokens.css`에 추가할지 사용자 결정 필요.
- **Status — 긍정/주의/부정** (`#059669`/`#10B981`/`#047857`/`#D1FAE5`/`#ECFDF5`/`#065F46` = positive 75건, `#F59E0B`/`#FEF3C7`/`#FCD34D`/`#FFFBEB` = cautionary 70건, `#EF4444` = negative 18건) → Wanted `--status-*` 토큰 후보. **확인 필요** — 정확 hex가 spec에서 TODO.
- **Amber 메모 팔레트** (`#FEF3C7`/`#92400E`/`#B45309`/`#FFF7ED`) → 합 **88건**. 메모 (Bespoke) — 보존 후보.
- **블루 인포** (`#3B82F6`/`#DBEAFE`/`#EFF6FF`/`#60A5FA`) → 합 **53건**. info 카테고리 — Wanted `--primary`와 충돌 가능 (둘 다 파랑). **확인 필요**.
- **퍼플** (`#A78BFA`) → 10건, 카테고리 색.

### 2.2 rgba 빈도 — Top 12 (실측, 공백 정규화)

| 순위 | rgba | 횟수 | 추정 용도 |
|---:|---|---:|---|
| 1 | `rgba(0,0,0,0.08)` | 8 | shadow tier-1 |
| 2 | `rgba(255,255,255,0.85)` | 7 | translucent overlay |
| 2 | `rgba(0,0,0,0.15)` | 7 | shadow tier-2 |
| 4 | `rgba(255,255,255,0.8)` | 6 | translucent overlay |
| 4 | `rgba(255,228,239,0.8)` | 6 | brand pink overlay |
| 6 | `rgba(31,41,55,0.38)` | 4 | dim overlay |
| 6 | `rgba(255,255,255,0.9)` | 4 | overlay |
| 6 | `rgba(255,255,255,0.88)` | 4 | overlay |
| 6 | `rgba(190,24,93,0.22)` | 4 | brand-pink line |
| 6 | `rgba(180,120,150,0.10)` | 4 | warm-pink shadow tint |
| 6 | `rgba(0,0,0,0.2)` | 4 | shadow tier-3 |
| 6 | `rgba(0,0,0,0.06)` | 4 | shadow tier-0 |
| ... | (60+ 고유값 분산) | | |

**관찰**: rgba는 *대부분 unique* (ad-hoc shadow/overlay 튜닝). 정규화 시 `--shadow-sm/md/lg` 토큰 / `--line-*` 토큰으로 흡수 가능. 단, 브랜드 핑크 overlay (`rgba(255,228,239,...)`, `rgba(190,24,93,...)`)는 **확인 필요**.

---

## 3. 하드코딩 spacing / radius

### 3.1 borderRadius 분포 (jsx/js, top values)

| px | 횟수 | 4px 그리드 | Wanted 토큰 매핑 |
|---:|---:|:---:|---|
| **14** | **75** | ❌ | 12 (`--radius-control`) 또는 16 (`--radius-card`) — **확인 필요** (의도된 시각 디자인) |
| 16 | 61 | ✓ | `--radius-card` ★ |
| 12 | 58 | ✓ | `--radius-control` |
| **10** | **37** | ❌ | 8 (`--radius-input`) 또는 12 |
| **18** | **30** | ❌ | 16 또는 20 (`--radius-2xl`) |
| 999/9999 | 25 | ✓ | `--radius-full` |
| 20 | 25 | ✓ | `--radius-2xl` |
| 50 | 23 | (원형 의도) | `--radius-full` |
| **24** | **13** | ❌ Wanted scale 없음 | 20 또는 28 — **확인 필요** |
| 8 | 10 | ✓ | `--radius-input` |
| 22, 28, 5, 9, 4, 11, 15, 26 | 미세 | 일부 ❌ | 정규화 |

**Off-grid radius 합 ≈ 159건** (14·10·18·24 등).

### 3.2 spacing 분포 (`padding|margin|gap` numeric, jsx/js, top values)

| px | 횟수 | 4px 그리드 | `--space-*` |
|---:|---:|:---:|---|
| 8 | 163 | ✓ | `--space-2` |
| 12 | 154 | ✓ | `--space-3` |
| **10** | **118** | ❌ | 8 또는 12 |
| **6** | **101** | ❌ | 4 또는 8 |
| **14** | **86** | ❌ | 12 또는 16 |
| 4 | 70 | ✓ | `--space-1` |
| 16 | 67 | ✓ | `--space-4` |
| **2** | **60** | ❌ (hairline OK) | — |
| 20 | 39 | ✓ | `--space-5` |
| 0 | 38 | ✓ | — |
| 24 | 22 | ✓ | `--space-6` |
| **18** | **22** | ❌ | 16 또는 20 |
| 3, 5, 7, 9, 11, 13, 15, 22, 30 | 미세 | ❌ | 정규화 |
| 32 | 9 | ✓ | `--space-8` |
| 28 | 8 | ❌ | 24 또는 32 |

**Off-grid spacing 합 ≈ 470건** (10·6·14·18·기타).

### 3.3 결론

**약 630건**이 4px 그리드를 벗어남. 14·10·6 px는 **의도적 시각 디자인** (촘촘한 리듬). 일괄 정규화는 시각 변화 큼 — phase별로 사용자 검증 필요.

---

## 4. 컴포넌트 → Wanted DS 매핑

판정 기준: `WANTED_DS_SPEC.md` §5 (.card / .input / .btn-*) + `CLAUDE.md` rule 15 (bespoke 보존 목록).

### 4.1 1:1 매칭 후보 (canonical class 직접 적용 가능)

| 컴포넌트 | Wanted DS | 사유 |
|---|---|---|
| [ForceRingConfirmModal](src/components/forceRing/ForceRingConfirmModal.jsx) | `.card-elevated` | Modal — `.hyeni-tool-modal*` 클래스 사용 중 |
| [BirthdatePicker](src/components/birthdate/BirthdatePicker.jsx) | `.card-elevated` | Bottom-sheet/모달 |
| [FeatureLockOverlay](src/components/paywall/FeatureLockOverlay.jsx) | `.card-elevated` | Overlay/모달 |
| [PriceSummary](src/components/multichild/SubscriptionScreen/PriceSummary.jsx) | `.card` | 정적 요약 카드 |
| [AutoRenewalDisclosure](src/components/paywall/AutoRenewalDisclosure.jsx) | `.card` | 정적 고지문 카드 |
| [TrialEndingBanner](src/components/paywall/TrialEndingBanner.jsx) | `.card` + status-cautionary | Banner — **확인 필요**: cautionary 적정성 |
| [ActivePlaydateBanner](src/components/friendPlaydate/ActivePlaydateBanner.jsx) | `.card` + status-positive | Banner — **확인 필요**: positive 적정성 |
| [PlaydateStartButton](src/components/friendPlaydate/PlaydateStartButton.jsx) | `.btn-primary` | CTA |
| [ForceRingTriggerButton](src/components/forceRing/ForceRingTriggerButton.jsx) | `.btn-primary` 또는 `.btn-destructive` | **확인 필요** — 긴급 호출/SOS 성격. CLAUDE.md rule 14 destructive guard. (메모리 design_color_rules.md: 강한 빨강은 SOS/긴급/하트만) |
| [FriendCandidateList](src/components/friendPlaydate/FriendCandidateList.jsx) | `.card` (각 row) | 리스트 |
| [PlaydateSafePlaceList](src/components/friendPlaydate/PlaydateSafePlaceList.jsx) | `.card` (각 row) | 리스트 |
| [ForceRingHistory](src/components/forceRing/ForceRingHistory.jsx) | `.card` (각 row) | 리스트 |
| [PlaydateHistory](src/components/friendPlaydate/PlaydateHistory.jsx) | `.card` (각 row) | 리스트 |
| [ChildDetailsStep](src/components/multichild/PairingWizard/ChildDetailsStep.jsx) `<input>` | `.input` | 이름/학년 입력 (3개 input) |

### 4.2 부분 매칭 (`.card` baseline + 내부 시각 보존)

| 컴포넌트 | 보존 요소 | 사유 |
|---|---|---|
| [ChildSummaryCard](src/components/multichild/HomeDashboard/ChildSummaryCard.jsx) | `child.color_hex` ring, status dot (`#10B981`/`#F59E0B`/`#EF4444`) | 자녀 색 정체성 |
| [TodayMultiChildView](src/components/multichild/HomeDashboard/TodayMultiChildView.jsx) | `borderLeft` 색 strip (자녀 색) | 자녀 카드 시그니처 |
| [ActivePlaydateCard](src/components/friendPlaydate/ActivePlaydateCard.jsx) | playdate 시각 (위치/시간) | 시각적 컨텍스트 |
| [ActivePlaydateChildView](src/components/friendPlaydate/ActivePlaydateChildView.jsx) | 자녀 시점 표시 | 자녀 모드 UX |
| [FriendPlaydatePanel](src/components/friendPlaydate/FriendPlaydatePanel.jsx) | `.hyeni-tool-*` sub-section | 큰 panel 내부 |
| [ForceRingPanel](src/components/forceRing/ForceRingPanel.jsx) | `.hyeni-tool-*` sub-section | 큰 panel 내부 |
| [ChildSelector](src/components/multichild/EventModal/ChildSelector.jsx) | 자녀 색 dot | 자녀 색 정체성 |
| [TrialInvitePrompt](src/components/paywall/TrialInvitePrompt.jsx) | 프로모션 시각 (그라디언트) | 마케팅 카드 |
| [SubscriptionManagement](src/components/settings/SubscriptionManagement.jsx) | per-child 카드 | 결제 표 |
| [HomeTab](src/components/multichild/HomeDashboard/HomeTab.jsx) | M3 토큰 이미 사용 | (M3 사용 중) |
| [PerChildToggle](src/components/multichild/SubscriptionScreen/PerChildToggle.jsx) | 자녀 색 표시 | per-child UX |
| [FriendPlaydateToggle](src/components/friendPlaydate/FriendPlaydateToggle.jsx) | 토글 스위치 자체 | Wanted DS 토글 정의 없음 — **확인 필요** |
| [ColorPicker](src/components/multichild/PairingWizard/ColorPicker.jsx) | 색 선택 (자녀 팔레트) | bespoke |
| [PhotoUpload](src/components/multichild/PairingWizard/PhotoUpload.jsx) | 업로드 영역 | bespoke 시각 |

### 4.3 보존 — Hyeni bespoke (`.card` baseline만 추가)

CLAUDE.md rule 15 + `WANTED_DS_SPEC.md` §9 "Brand-preservation list" 기준.

| 항목 | 코드 위치 | 이유 |
|---|---|---|
| **일정 카드** | [App.css `.hyeni-v5-event-card`](src/App.css) (다수 정의) + [App.jsx](src/App.jsx) inline | 카테고리 strip, 시간 표시 — 브랜드 정체성 |
| **혜니 포인트 표시** | **⚠️ 미발견** — 코드베이스 grep 결과 `포인트` 0건 (lib/jsx/js 전체) | spec에는 보존 대상으로 적혀 있으나 실제 컴포넌트 부재. **확인 필요** — 미구현 / 외부 / 명칭 다름 가능성 |
| **가족 멤버 카드** | [App.css `.hyeni-v5-kid-card`](src/App.css), [TodayMultiChildView](src/components/multichild/HomeDashboard/TodayMultiChildView.jsx), [ChildSelector](src/components/multichild/EventModal/ChildSelector.jsx) | 자녀 색 정체성 + avatar 패턴 |
| **캘린더 그리드** | [App.css `.hyeni-v5-calendar-*`](src/App.css) + [App.jsx](src/App.jsx) | grid 수학, 오늘/선택 강조 |

### 4.4 분류 모호 — "확인 필요" 사유

| 항목 | 사유 |
|---|---|
| `ForceRingTriggerButton` | primary vs destructive — 긴급/SOS 시그니처. CLAUDE.md 14번 destructive guard, 메모리 `design_color_rules.md`(SOS만 강한 빨강 허용) |
| `TrialEndingBanner`, `ActivePlaydateBanner` 색 매핑 | status-cautionary / status-positive 적정성 — Spec status hex가 TODO |
| 메모 amber 팔레트 (`#FEF3C7`/`#92400E`/`#B45309`) | bespoke vs `--status-cautionary-subtle` |
| 카테고리 핑크/블루/퍼플/엠버 (App.jsx hyeni 카테고리) | bespoke 보존 vs 토큰 재맵핑 |
| `FriendPlaydateToggle`, `PerChildToggle` | Wanted DS 토글 정의 없음 — Spec §10 "decisions deferred" |
| `BirthdatePicker` 내부 input (날짜) | spec §4 "checkbox/radio/file/특수형 → .input 금지" — bottom-sheet picker는 별도 처리 |
| 6테마 v1.1 picker 시스템 | Wanted DS는 light/dark만 — **충돌**. 메모리 `theme_system_v11.md` 참고 |
| brand pink 팔레트 (`#E879A0`/`#BE185D`/...) | Wanted `--primary`(Wanted Blue)와 별개. 토큰 추가 (`--brand-pink-*`) 여부 |
| `--secondary-press-bg` `#E9EAEC` (tokens.css L46) | 회색 명시 — `--bg-muted`(`#EFEFF1`)와 거의 동일. 두 토큰 공존 의도 확인 |
| info blue (`#3B82F6`) vs Wanted `--primary` (`#0066FF`) | 의미 충돌 가능 — info 표시인지 primary 액션인지 |
| `main.jsx` ErrorBoundary 인라인 색상 (`#FFF0F7`/`#E879A0`/`#6B7280`) | "디자인 마이그" 외 영역인지 — Phase 3에서 같이 처리 여부 |

### 4.5 Input 매칭 표

| 컴포넌트 / 위치 | 처리 |
|---|---|
| [ChildDetailsStep](src/components/multichild/PairingWizard/ChildDetailsStep.jsx) text inputs | `.input` |
| [BirthdatePicker](src/components/birthdate/BirthdatePicker.jsx) | custom (.input 금지) |
| [PlaydateSafePlaceList](src/components/friendPlaydate/PlaydateSafePlaceList.jsx) text input | `.input` |
| [App.jsx](src/App.jsx) `<input>` × 31, `<textarea>` × 2, `<select>` × 1 | 일정 추가/메모/검색/설정 — 화면 단위 분류 필요 (Phase 4) |
| App.jsx `<input type="checkbox|radio|file">` (있다면) | `.input` 금지 — Phase 4에서 별도 보고 |

---

## 5. 컴포넌트 의존 관계

leaf-level 우세. 주요 import 트리:

```
App.jsx (root, 13691 lines)
├─ BirthdatePicker
├─ PairingWizard
│   ├─ ChildCountStep
│   ├─ ChildDetailsStep
│   │   ├─ BirthdatePicker
│   │   ├─ ColorPicker (← ChildPalette.js)
│   │   └─ PhotoUpload
│   └─ ChildPalette.js
├─ HomeTab
│   ├─ ChildSummaryCard
│   ├─ MiniMap
│   └─ TodayEventsList
├─ TodayMultiChildView
├─ ChildPermissionWizard
├─ ChildSelector
├─ TrialInvitePrompt
├─ FeatureLockOverlay
├─ TrialEndingBanner
├─ AutoRenewalDisclosure
├─ SubscriptionManagement
│   ├─ PerChildToggle
│   └─ PriceSummary
├─ FriendPlaydatePanel
│   ├─ FriendPlaydateToggle
│   ├─ PlaydateSafePlaceList
│   ├─ ActivePlaydateCard
│   └─ PlaydateHistory
├─ FriendPlaydateChildPanel
│   ├─ PlaydateStartButton
│   ├─ FriendCandidateList
│   └─ ActivePlaydateChildView
├─ ActivePlaydateBanner
└─ ForceRingPanel
    ├─ ForceRingTriggerButton
    ├─ ForceRingConfirmModal
    ├─ ForceRingActiveStatus
    └─ ForceRingHistory
```

**관찰**:
- 공통 Button / Modal / Dialog 컴포넌트 **부재** — 각 모달이 자체 inline `<button>` 사용 (예: ForceRingConfirmModal 안의 confirm/cancel 버튼은 `.hyeni-tool-button` className).
- 공통 Card / Panel wrapper **부재** — 각 컴포넌트가 inline 또는 `.hyeni-tool-card`/`.hyeni-v5-event-card` 등을 직접 사용.
- 모달 prop 표준 없음. `onClose` 시그니처가 컴포넌트마다 다를 가능성 — Phase 3 시 재확인 필요.
- `lib/` 의존: `auth.js`, `supabase.js`, `friendPlaydate.js`, `forceRing.js`, `pushNotifications.js`, `paywallCopy.js`, `qonversion.js`, `childSubscriptions.js`, `backHandler.js`, `sync.js`, `deviceFormat.js`, `ChildPalette.js`. 모두 비-시각 로직 — Phase 마이그 영향 없음.

---

## 6. 자체 평가

### 6.1 Phase 1 진입 가능 여부

**이미 완료됨** — git log: `2c198e5 wanted-ds: phase 1 — token foundation install`. 따라서 **Phase 2 (Typography activation) 진입 가능**.

검증:
- ✓ [src/styles/tokens.css](src/styles/tokens.css) 존재 (359 라인, files/tokens.css와 동일)
- ✓ [src/main.jsx](src/main.jsx#L3) 첫 import — `import './styles/tokens.css'`
- ✓ index.html 확인 필요 (Pretendard JP CDN — Phase 1 acceptance 항목)
- ✓ Wanted DS 토큰 사용 컴포넌트: 0 (Phase 2+ 작업 대기)

### 6.2 발견된 Blockers (사용자 결정 필요)

| # | Blocker | 영향 phase | 사유 |
|---|---|---|---|
| **B1** | **이중 토큰 시스템 동시 적용**: `tokens.css` (Wanted DS) + `m3-tokens.css` (M3 Expressive) | 모든 phase | M3 토큰을 사용 중인 3개 컴포넌트(ChildSummaryCard, HomeTab, TodayMultiChildView)와 변수 의미 중첩: `--radius-card` 둘 다 16px (호환), but `--shadow-card` (M3) vs `--shadow-md` (Wanted) 다른 시각. 사용자 결정 필요: M3 폐기? 공존? Wanted를 모든 새 작업에 우선? |
| **B2** | **CLAUDE.md 스택 불일치**: "TypeScript + Tailwind" 명시 vs 실제 JSX + inline | Phase 1 검증 | `npx tsc --noEmit` 실행 가능 여부 / acceptance 검증법 변경 필요 |
| **B3** | **`혜니 포인트` 컴포넌트 부재** | Phase 3 | 보존 대상 spec에 포함되었으나 코드 grep 결과 `포인트` 0건. 확인 필요 — 미구현 / 다른 명칭 / 외부 / 미래 기능 |
| **B4** | **App.jsx 13,691줄 모놀리스** | Phase 3, 5 | 184개 `<button>`, 31개 `<input>` 단일 파일. candidate-list-first 규칙(CLAUDE.md 10) 적용 시 한 번에 검토 어려움. **화면/탭 단위 sub-phase로 분할 필요** |
| **B5** | **6테마 picker (v1.1) 시스템 vs Wanted light/dark** | Phase 6, 7 | 메모리 `theme_system_v11.md`. Wanted DS는 light/dark 단일 — 색상 시스템 충돌. 6테마 보존? 별도 옵션? |
| **B6** | **Brand pink 팔레트 (~189 hex 사용)** | Phase 3+ | Wanted `--primary`(Wanted Blue)와 별개. CLAUDE.md "preserve existing brand colors" → `tokens.css`에 `--brand-pink-*` 추가 여부 결정 필요 |
| **B7** | **Status hex TODO** (Spec §2) | Phase 3, 4 | positive/negative/cautionary 정확 hex 미확정. 현재 default(`#16A34A`/`#DC2626`/`#D97706`) 채택 시 Figma 추후 재맞춤 필요 |
| **B8** | **`ForceRingTriggerButton` variant 결정** | Phase 5 | primary/destructive 모호. CLAUDE.md rule 14 destructive guard + 메모리 `design_color_rules.md` |
| **B9** | **`.hyeni-tool-*` / `.hyeni-v5-*` 부분 토큰 시스템** ([App.css](src/App.css) 2,220줄) | Phase 3+ | 별도 클래스 시스템이 이미 작동 중. Wanted `.card`/`.btn-*`로 흡수 vs 보존 결정 필요 |
| **B10** | **공통 Button/Modal 컴포넌트 부재** | Phase 3, 5 | 각 모달이 자체 inline button — Wanted 마이그를 위해 공통 wrapper 추출 vs 각 site에서 직접 className 적용 결정 필요 |

### 6.3 예상 외 발견사항

1. **두 토큰 시스템이 main.jsx 한 파일에서 동시 import** ([src/main.jsx#L3-L5](src/main.jsx#L3-L5)) — 변수 명 충돌 없으나 의미 중첩 (`--radius-card`, `--shadow-card`)
2. **App.jsx hex 729건 / rgba 169건** — 전체의 ~88-91%. 모놀리스 분해 없이 마이그하면 단일 파일 diff가 거대해짐
3. **borderRadius 14px이 1위 (75건)** — Wanted scale에 없는 값. 의도된 시각 디자인 — 일괄 정규화 시 시각 변화 큼
4. **`혜니 포인트` 컴포넌트 미발견** — spec/CLAUDE.md 보존 대상에 포함되어 있으나 코드 grep 0건
5. **`main.jsx` ErrorBoundary가 자체 인라인 색상 보유** ([src/main.jsx#L25-L37](src/main.jsx#L25-L37)) — 마이그 범위 외인지 확인 필요
6. **`<select>` 사용 1건뿐 (App.jsx)** — Phase 4 input 마이그 부담 작음
7. **외부 UI 라이브러리 0개** — Radix/MUI/shadcn 의존성 없음. 마이그 자유도 높음
8. **rgba 값 대부분 unique (60+ 고유값)** — ad-hoc 그림자/오버레이 튜닝. 정규화 효과 큼
9. **공통 Button / Modal 추상화 부재** — 마이그 시 각 site 직접 수정 필요
10. **`design_color_rules.md` 메모리** — 강한 빨강은 SOS/긴급/하트만 — `ForceRingTriggerButton` 분류에 직접 영향
11. **`tokens.css` `--secondary-press-bg: #E9EAEC`** ([tokens.css#L46](src/styles/tokens.css#L46)) — `--bg-muted` (`#EFEFF1`)와 거의 동일. 별도 정의 의도 확인 필요
12. **CLAUDE.md 스택 기재(TypeScript + Tailwind)와 실제(JSX + inline)가 불일치** — Phase 1 acceptance criteria의 `npx tsc --noEmit` 실행 가능성 재확인 필요

### 6.4 권장 진행 순서

1. **사용자 결정 받기 (Blocker B1, B5, B6, B10 우선)**: M3 토큰 운명, 6테마 정책, brand pink 토큰 추가, 공통 wrapper 추출 정책
2. **Phase 2 (Typography)** 진행 — 영향 분석 우선 (spec 144번 라인 — `font-weight: 400 명시 grep`)
3. **Phase 3 sub-phase 분할**: `App.jsx` 탭별 (홈 / 캘린더 / 메모 / 설정 / 자녀 모드) — 한 번에 13691줄 처리 금지
4. **Phase 5 destructive 분류**: `ForceRingTriggerButton` 단독 사용자 confirm
5. **Phase 6 토글**: 기존 6테마 v1.1 시스템과 어떻게 공존할지 별도 설계 세션
