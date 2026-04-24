# 혜니캘린더 "Illustrated Warm" 리디자인 구현 plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `design/` 폴더의 Illustrated Warm 프로토타입 7종(v1/v2/v3/v4-A/B/C/D)에 맞춰 **기능 삭제 없이** 기존 혜니캘린더 앱의 UI 를 전면 리디자인. 디자인에만 있고 코드에 없는 기능은 새로 구현.

**Architecture:** `src/App.jsx` (9,285 line 모놀리스) 에 **이미 존재하는** `DESIGN` 상수 오브젝트(line 621-676)와 `App.css` CSS 변수(이미 `--hyeni-*` 토큰 존재)를 기반으로, 각 inline 컴포넌트(28개)와 외부 컴포넌트(5개)를 순차적으로 디자인 HTML 의 레이아웃·여백·일러스트·micro-interaction 에 맞춰 재작성. App.jsx 분해 금지 정책(CLAUDE.md) 준수 — 라인 범위 치환 + 외부 컴포넌트 추출(`src/components/redesign/`) 만 허용.

**Tech Stack:** React 19.2 · Vite 7 · Capacitor 8.2 · CSS Variables (이미 셋업) · JSX 인라인 스타일(DESIGN 객체) · SVG (heart-shield 뱃지 · 도트 패턴 · 일러스트) · 새 npm dep **0개**.

**Spec/Design Source:**
- `design/Redesign v3 · Illustrated Warm Full.html` — **최종 B 방향 6 화면** (baseline)
- `design/Redesign v4-A · Alerts Popups SOS.html` — **9 알림 + 4 SOS 플로우**
- `design/Redesign v4-B · Core Feature Modals.html` — **11 핵심 모달** (기존 component 와 1:1 매핑)
- `design/Redesign v4-C · Splash Onboarding.html` — **3 스플래시 + 8 온보딩 스텝**
- `design/Redesign v4-D · Responsive PC Tablet.html` — **DEFERRED** (현 milestone 안드로이드 only)
- `design/preview-*.png` — 시각 확인용 미리보기 (9개)

---

## Prerequisites (execution 시작 전 검증)

- ✅ **App.css 토큰 + DESIGN 상수 이미 존재**: 색/그라데이션/반경/그림자 대부분 설정 완료. Phase DX-0 에서 빠진 토큰만 보강.
- ✅ **Pretendard Variable 이미 사용** (`FF` 상수, App.jsx:619). Source Serif 는 현재 미사용 → DX-0 에서 선택 로딩.
- ⏳ **Splash variant 결정** (Minimal / Gradient / Bloom) — **실행 시점에 사용자 확정**. plan 기본값 **A Minimal**.
- ⏳ **Branch 정책**: 현 branch `codex/child-mode-cards-supplies` 에 **uncommitted changes 11건** (M 파일: AndroidManifest, AmbientListenService, MainActivity, MyFirebaseMessagingService, NotificationHelper, App.jsx, pushNotifications.js, push-notify/index.ts 등). 실행 전 이 changes 들을 별도 커밋 or stash. 그 후 **`git checkout -b feature/redesign-illustrated-warm main`** 에서 plan 진행.
- ✅ **App.jsx 분해 금지** (CLAUDE.md) — 라인 범위 치환만. 새 component 는 `src/components/redesign/` 하위 신규 디렉토리로 추출 가능.
- ✅ **현재 기능 삭제 금지** (사용자 명시). 각 task 의 "회귀 체크" step 에서 기존 기능 유지 확인.

---

## Scope Check

**In scope (이 plan 범위):**
- v3 · 6 core screens 재작성
- v4-A · 9 alert banner 통합 + 4-step SOS 비주얼
- v4-B · 11 모달 재작성
- v4-C · 스플래시 1 variant + 8 온보딩 스텝
- 디자인에 있으나 코드에 없는 기능: DX-1-9 Tutorial, DX-4-3 Heart-shield SOS SVG, DX-5-1 Dot pattern bg 등 (Gap 분석 참고)

**Out of scope (deferred to post-v1.1+):**
- v4-D · PC / Tablet / School Ops Console (responsive breakpoints) — Android-only 스택 lock
- 새 npm dep (예: framer-motion, lottie) — 0 new dep 정책
- Dark mode — 현재 디자인이 라이트 전용
- 기능 축소/변경 — "기능 절대 삭제 금지" 사용자 지시

---

## Current Code ↔ Design 매핑 요약

### v3 6 screens ↔ App.jsx activeView 상태 + 조건부 render

| v3 화면 | 현 코드 위치 | 변경 유형 |
|---|---|---|
| 01 부모 홈 | App.jsx parent render branch (~7500-8700) | 라인 범위 치환 |
| 02 자녀 홈 | App.jsx child render branch (~8700-9200) | 라인 범위 치환 |
| 03 캘린더 | `DayTimetable` (3380) + calendar view (8100-8500) | 라인 범위 치환 |
| 04 메모 | `MemoSection` (2989) | **v1.1 Phase 5.5 에서 이미 부분 적용**. 잔여 polish 만 |
| 05 페어링/온보딩 | `ParentSetupScreen` (744) + `PairingModal` (1830) + `ChildPairInput` (2048) | v4-C Step 05/07 과 통합 |
| 06 위치 | `LocationMapView` (3964) + `ChildTrackerOverlay` (5064) | 라인 범위 치환 |

### v4-B 11 modals ↔ App.jsx inline 컴포넌트 1:1

| v4-B Modal | App.jsx 컴포넌트 (라인) |
|---|---|
| 01 AI Voice | `AiScheduleModal` (4285) |
| 02 Sticker Book | `StickerBookModal` (3556) |
| 03 QR Pair | `QrPairScanner` (1929) |
| 04 Academy | `AcademyManager` (2122) |
| 05 Saved Places | `SavedPlaceManager` (4703) |
| 06 Danger Zones | `DangerZoneManager` (4528) |
| 07 Phone | `PhoneSettingsModal` (4672) |
| 08 Notifications | `NotificationSettingsModal` (4830) |
| 09 Audio | `AmbientAudioRecorder` (3661) |
| 10 Route | `RouteOverlay` (2279) |
| 11 Map Picker | `MapPicker` (1444) |

### v4-A 9 alerts + 4 SOS flows ↔ Banner 컴포넌트 + SOS 이벤트

| v4-A 항목 | 현 코드 |
|---|---|
| 01 Arrival | `AlertBanner` (1607) + `showArrivalNotification` (lib/pushNotifications.js) |
| 02 Danger Zone | `EmergencyBanner` (1631) + danger zone event |
| 03 Late | 스케줄 기반 push — **코드 있음**, UI 재디자인만 |
| 04 SOS Received | `EmergencyBanner` (1631) + `showEmergencyNotification` |
| 05 Wave | `showKkukNotification` — 현재 UI 없음 → **신규 배너 타입 추가** |
| 06 Sticker | 스티커 알림 — **배너 통합 필요** |
| 07 Reminder | 일정 리마인더 — **배너 통합** |
| 08 Battery | **코드에 없음** → 새 배너 타입 + 데이터 소스 필요 |
| 09 Pairing | 페어링 성공 후 배너 — **통합** |
| SOS Flow 01 Idle | KKUK/SOS 버튼 idle state |
| SOS Flow 02 Holding | long-press holding animation |
| SOS Flow 03 Activated | 활성 완료 상태 |
| SOS Flow 04 Active Banner | 부모 화면 SOS banner |

### v4-C 3 splash + 8 onboarding ↔ 현 온보딩

| v4-C | 현 코드 |
|---|---|
| Splash (3종 중 1) | **현재 Capacitor splash 기본** → 새 JSX 필요 |
| Step 01 Welcome | 현재 생략 → **신규** |
| Step 02 Role Pick | `RoleSetupModal` (1665) |
| Step 03 Permissions | 권한 요청 UI 현재 없음 → **신규 (알림/위치/마이크 한번에)** |
| Step 04 Family Created | `ParentSetupScreen` create 후 success UI — **신규** |
| Step 05 Invite | `PairCodeSection` (1727) + invite screen 재구성 |
| Step 06 Profile | 프로필 입력 현재 부분적 → **완성 필요** |
| Step 07 Paired | `PairingModal` 완료 상태 |
| Step 08 Tutorial | **현재 없음** → 신규 (4-5 tip) |

---

## File Structure

**총 변경: 수정 33 + 신규 42 = ~75 파일.**

```
src/App.jsx                                 [수정] 라인 범위 ~30곳 (screens + inline components)
src/App.css                                 [수정] 토큰 보강 + 유틸리티 클래스 추가
src/index.css                               [수정] body 기본 + 폰트 import
public/fonts/                               [신규] Pretendard Variable subset (옵션)
public/illustrations/                       [신규]
  parent-home-hero.svg
  child-home-hero.svg
  calendar-empty.svg
  memo-empty.svg
  pairing-hero.svg
  map-hero-cloud.svg
  onboarding-welcome.svg
  onboarding-role-parent.svg
  onboarding-role-child.svg
  onboarding-family-created.svg
  onboarding-paired.svg
  tutorial-1..4.svg
  sos-heart-shield.svg                      [Heart-shield SOS 뱃지]
  dot-pattern-22px.svg                      [배경 도트 패턴]

src/components/redesign/                    [신규 디렉토리]
  Splash.jsx                                [신규] variant A Minimal (기본)
  onboarding/
    OnboardingShell.jsx                     [신규] 8-step shell + progress
    StepWelcome.jsx
    StepRolePick.jsx
    StepPermissions.jsx
    StepFamilyCreated.jsx
    StepInvite.jsx
    StepProfile.jsx
    StepPaired.jsx
    StepTutorial.jsx
  chrome/
    DotPatternBg.jsx                        [신규] 재사용 도트 배경
    HeartShieldSOS.jsx                      [신규] SVG 뱃지 컴포넌트
    AppTopBar.jsx                           [신규] 공통 상단 바
    BottomTabBar.jsx                        [신규] 공통 하단 탭
    CategoryChip.jsx                        [신규] 6색 카테고리 칩
    CardSection.jsx                         [신규] 공통 카드 wrapper
    ProgressBar.jsx                         [신규] 일정 진행 바
    SheetShell.jsx                          [신규] 모달 공통 sheet
  alerts/
    AlertBannerV2.jsx                       [신규] 9종 타입 통합
    SosHoldButton.jsx                       [신규] long-press UI
    SosActiveBanner.jsx                     [신규]
  docs/
    TOKENS.md                               [신규] 토큰 설계서
    MIGRATION_NOTES.md                      [신규] 각 screen 별 라인 범위 기록

tests/e2e/redesign/
  screens.spec.js                           [신규] 5 screens baseline
  modals.spec.js                            [신규] 11 modals baseline

tests/e2e/__screenshots__/2026-04-25-redesign/
  (Playwright 자동 생성 baseline)

docs/v1.x-redesign/
  EVIDENCE_DX-0..5.md                       [신규 × 6] phase 별 증거 기록
```

---

# Phase DX-0 · Foundation (Week 1)

**목표**: 이후 모든 task 가 기댈 토큰/유틸/에셋 완비. Task 당 ≤30분.

---

### Task DX-0-1 · App.css 토큰 보강 + 유틸리티 클래스

**Files:**
- Modify: `src/App.css`

**현재 상태 (App.css:9-38):** 대부분의 토큰 이미 존재. 누락: 도트 패턴, border-radius 명시 스케일, font-family 변수, ease-curve, 유틸 클래스.

- [ ] **Step 1: 누락 토큰 추가**

Append inside `:root { ... }` in App.css after line 37:
```css
  /* Radius scale (DESIGN.radius 미러링) */
  --hyeni-r-sm: 12px;
  --hyeni-r-md: 16px;
  --hyeni-r-lg: 20px;
  --hyeni-r-xl: 24px;
  --hyeni-r-hero: 32px;

  /* Typography */
  --hyeni-font-sans: 'Pretendard Variable','Pretendard','Noto Sans KR','Apple SD Gothic Neo',sans-serif;
  --hyeni-font-serif: 'Source Serif 4','Source Serif Pro','Noto Serif KR',serif;

  /* Easing */
  --hyeni-ease-out: cubic-bezier(.2, .8, .2, 1);
  --hyeni-ease-spring: cubic-bezier(.34, 1.56, .64, 1);

  /* Spacing rhythm */
  --hyeni-s-1: 4px; --hyeni-s-2: 8px; --hyeni-s-3: 12px;
  --hyeni-s-4: 16px; --hyeni-s-5: 20px; --hyeni-s-6: 24px;
  --hyeni-s-8: 32px; --hyeni-s-10: 40px;

  /* Background image: dot pattern 22px */
  --hyeni-dot-pattern:
    radial-gradient(circle at 1px 1px, rgba(232,121,160,0.18) 1px, transparent 1.2px);
  --hyeni-dot-size: 22px 22px;
```

- [ ] **Step 2: 유틸리티 클래스 추가**

After the existing `.hyeni-app-shell` rules:
```css
.hyeni-dot-bg {
  background-image: var(--hyeni-dot-pattern);
  background-size: var(--hyeni-dot-size);
  background-color: var(--hyeni-cream);
}

.hyeni-card {
  background: var(--hyeni-pink-soft, #FFF5FA);
  border: 2px solid var(--hyeni-pink-line);
  border-radius: var(--hyeni-r-xl);
  box-shadow: var(--hyeni-shadow-card);
  padding: var(--hyeni-s-5);
}

.hyeni-btn-primary {
  min-height: 48px;
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--hyeni-pink) 0%, var(--hyeni-pink-deep) 100%);
  color: #fff;
  border: 0;
  border-radius: var(--hyeni-r-lg);
  font-family: var(--hyeni-font-sans);
  font-weight: 900;
  box-shadow: 0 12px 26px rgba(190,24,93,0.22);
  cursor: pointer;
  transition: transform 150ms var(--hyeni-ease-out), box-shadow 150ms;
}
.hyeni-btn-primary:active { transform: translateY(1px) scale(0.98); }

.hyeni-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 700;
}
.hyeni-chip--school  { background: var(--hyeni-cat-school-bg);  color: var(--hyeni-cat-school); }
.hyeni-chip--sports  { background: var(--hyeni-cat-sports-bg);  color: var(--hyeni-cat-sports); }
.hyeni-chip--hobby   { background: var(--hyeni-cat-hobby-bg);   color: var(--hyeni-cat-hobby); }
.hyeni-chip--family  { background: var(--hyeni-cat-family-bg);  color: var(--hyeni-cat-family); }
.hyeni-chip--friend  { background: var(--hyeni-cat-friend-bg);  color: var(--hyeni-cat-friend); }
.hyeni-chip--other   { background: var(--hyeni-cat-other-bg);   color: var(--hyeni-cat-other); }
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```
Expected: `vite build` 성공, CSS 에 새 변수 포함.

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git commit -m "feat(dx-0-1): add missing design tokens + utility classes (dot-bg, card, btn, chip)"
```

---

### Task DX-0-2 · Font loading (Pretendard Variable)

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Font link**

In `index.html` `<head>`, before existing `<link rel="icon">`:
```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
```

- [ ] **Step 2: body defaults**

Edit `src/index.css`:
```css
:root {
  font-family: var(--hyeni-font-sans, system-ui, sans-serif);
}
body {
  font-family: var(--hyeni-font-sans, system-ui, sans-serif);
  background: var(--hyeni-cream, #FFF8F2);
  color: var(--hyeni-ink, #38252D);
}
```

- [ ] **Step 3: 시각 확인**

```bash
npm run dev
# localhost 에서 Pretendard Variable 로딩 확인 (devtools network → 200)
```

- [ ] **Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "feat(dx-0-2): load Pretendard Variable via jsDelivr CDN + body defaults"
```

---

### Task DX-0-3 · SOS Heart-Shield SVG + Dot pattern asset

**Files:**
- Create: `public/illustrations/sos-heart-shield.svg`
- Create: `public/illustrations/dot-pattern-22px.svg`
- Verify: `public/icon-192.png` (이미 존재)

- [ ] **Step 1: Heart-shield SVG**

```svg
<!-- public/illustrations/sos-heart-shield.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" role="img" aria-label="SOS 하트 쉴드">
  <defs>
    <linearGradient id="hs-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FF6B6B"/>
      <stop offset="100%" stop-color="#DC2626"/>
    </linearGradient>
  </defs>
  <path d="M24 4 L40 10 L40 24 C40 34 32 42 24 44 C16 42 8 34 8 24 L8 10 Z"
        fill="url(#hs-grad)" stroke="#B91C1C" stroke-width="1.5"/>
  <path d="M24 32 C19 28.5 15.5 25 15.5 21 C15.5 18 17.5 16 20.5 16
           C22 16 23.5 17 24 18 C24.5 17 26 16 27.5 16 C30.5 16 32.5 18 32.5 21
           C32.5 25 29 28.5 24 32 Z"
        fill="#FFFFFF" opacity="0.95"/>
</svg>
```

- [ ] **Step 2: Dot pattern (백업용)**

```svg
<!-- public/illustrations/dot-pattern-22px.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">
  <circle cx="1" cy="1" r="1" fill="rgba(232,121,160,0.18)"/>
</svg>
```

- [ ] **Step 3: Logo 경로 확인**

```bash
ls -la public/icon-192.png
```

- [ ] **Step 4: Commit**

```bash
git add public/illustrations/
git commit -m "feat(dx-0-3): heart-shield SOS SVG + dot pattern asset"
```

---

### Task DX-0-4 · `DotPatternBg` + `HeartShieldSOS` React 컴포넌트

**Files:**
- Create: `src/components/redesign/chrome/DotPatternBg.jsx`
- Create: `src/components/redesign/chrome/HeartShieldSOS.jsx`

- [ ] **Step 1: DotPatternBg**

```jsx
// src/components/redesign/chrome/DotPatternBg.jsx
export default function DotPatternBg({ children, className = "", style = {} }) {
  return (
    <div
      className={`hyeni-dot-bg ${className}`}
      style={{ position: 'relative', minHeight: '100%', ...style }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: HeartShieldSOS**

```jsx
// src/components/redesign/chrome/HeartShieldSOS.jsx
export default function HeartShieldSOS({ size = 48, className = '', style = {}, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size} height={size}
      role="img"
      aria-label="SOS 하트 쉴드"
      className={className}
      style={{ display: 'inline-block', ...style }}
      {...rest}
    >
      <defs>
        <linearGradient id="hs-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF6B6B"/>
          <stop offset="100%" stopColor="#DC2626"/>
        </linearGradient>
      </defs>
      <path d="M24 4 L40 10 L40 24 C40 34 32 42 24 44 C16 42 8 34 8 24 L8 10 Z"
            fill="url(#hs-grad)" stroke="#B91C1C" strokeWidth="1.5"/>
      <path d="M24 32 C19 28.5 15.5 25 15.5 21 C15.5 18 17.5 16 20.5 16
               C22 16 23.5 17 24 18 C24.5 17 26 16 27.5 16 C30.5 16 32.5 18 32.5 21
               C32.5 25 29 28.5 24 32 Z"
            fill="#FFFFFF" opacity="0.95"/>
    </svg>
  )
}
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build 2>&1 | grep -i error | head -5
```
Expected: 없음.

- [ ] **Step 4: Commit**

```bash
git add src/components/redesign/chrome/
git commit -m "feat(dx-0-4): DotPatternBg + HeartShieldSOS React components"
```

---

# Phase DX-1 · Splash + Onboarding (Week 2)

---

### Task DX-1-1 · Splash (variant A Minimal 기본)

**Files:**
- Create: `src/components/redesign/Splash.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 현재 splash 확인**

```bash
grep -n "splash\|Splash" src/App.jsx | head -5
```
Expected: 없음.

- [ ] **Step 2: Splash 컴포넌트**

```jsx
// src/components/redesign/Splash.jsx
import { useEffect } from 'react'

export default function Splash({ onDone, holdMs = 1800 }) {
  useEffect(() => {
    const t = setTimeout(onDone, holdMs)
    return () => clearTimeout(t)
  }, [holdMs, onDone])

  return (
    <div
      role="status" aria-label="혜니캘린더 로딩"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--hyeni-cream, #FFF8F2)',
      }}
      className="hyeni-dot-bg"
    >
      <img src="/icon-192.png" alt="" width="96" height="96"
           style={{ borderRadius: 24, boxShadow: '0 12px 32px rgba(247,121,168,0.30)' }} />
      <div style={{ marginTop: 16, fontWeight: 900, fontSize: 22, color: 'var(--hyeni-pink-text)', letterSpacing: '-0.02em' }}>
        혜니캘린더
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--hyeni-muted)' }}>
        오늘도 함께해요
      </div>
    </div>
  )
}
```

- [ ] **Step 3: App.jsx 마운트**

State addition (near line 5485):
```javascript
const [bootReady, setBootReady] = useState(false)
```

JSX top-level, before activeView render:
```jsx
{!bootReady && <Splash onDone={() => setBootReady(true)} />}
```

Top import:
```javascript
import Splash from './components/redesign/Splash.jsx'
```

- [ ] **Step 4: Commit**

```bash
git add src/components/redesign/Splash.jsx src/App.jsx
git commit -m "feat(dx-1-1): Splash variant A Minimal (1.8s hold)"
```

---

### Task DX-1-2 · OnboardingShell + Step 01 Welcome

**Files:**
- Create: `src/components/redesign/onboarding/OnboardingShell.jsx`
- Create: `src/components/redesign/onboarding/StepWelcome.jsx`

- [ ] **Step 1: OnboardingShell**

```jsx
// src/components/redesign/onboarding/OnboardingShell.jsx
import DotPatternBg from '../chrome/DotPatternBg.jsx'

export default function OnboardingShell({
  step, total, onBack, onNext, onSkip,
  nextLabel = '다음', nextDisabled = false, showSkip = true, children,
}) {
  return (
    <DotPatternBg>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '24px 20px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i < step ? 'var(--hyeni-pink)' : 'var(--hyeni-pink-line)',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          {onBack
            ? <button onClick={onBack} style={{ background: 'none', border: 0, color: 'var(--hyeni-muted)', fontSize: 14, cursor: 'pointer' }}>← 뒤로</button>
            : <span />}
          {showSkip && onSkip
            ? <button onClick={onSkip} style={{ background: 'none', border: 0, color: 'var(--hyeni-muted)', fontSize: 14, cursor: 'pointer' }}>건너뛰기</button>
            : <span />}
        </div>
        <div style={{ flex: 1 }}>{children}</div>
        <button onClick={onNext} disabled={nextDisabled} className="hyeni-btn-primary"
                style={{ opacity: nextDisabled ? 0.5 : 1 }}>
          {nextLabel}
        </button>
      </div>
    </DotPatternBg>
  )
}
```

- [ ] **Step 2: Step 01 Welcome**

```jsx
// src/components/redesign/onboarding/StepWelcome.jsx
import OnboardingShell from './OnboardingShell.jsx'

export default function StepWelcome({ onNext }) {
  return (
    <OnboardingShell step={1} total={8} onNext={onNext} showSkip={false}>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <img src="/icon-192.png" alt="" width="120" height="120"
             style={{ borderRadius: 28, boxShadow: '0 12px 32px rgba(247,121,168,0.30)' }} />
        <h1 style={{ marginTop: 24, fontSize: 28, fontWeight: 900, color: 'var(--hyeni-pink-text)', letterSpacing: '-0.03em' }}>
          혜니캘린더에 오신 걸 환영해요
        </h1>
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: 'var(--hyeni-muted)', maxWidth: 280, margin: '12px auto 0' }}>
          부모와 아이가 일정·위치·안전을<br/>함께 나누는 따뜻한 공간이에요.
        </p>
      </div>
    </OnboardingShell>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/onboarding/
git commit -m "feat(dx-1-2): OnboardingShell + Step 01 Welcome"
```

---

### Task DX-1-3 · Step 02 Role Pick (기존 RoleSetupModal 흡수)

**Files:**
- Create: `src/components/redesign/onboarding/StepRolePick.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: StepRolePick**

```jsx
// src/components/redesign/onboarding/StepRolePick.jsx
import OnboardingShell from './OnboardingShell.jsx'

export default function StepRolePick({ onBack, onSelect, loading }) {
  return (
    <OnboardingShell step={2} total={8} onBack={onBack} showSkip={false} nextLabel="계속" nextDisabled>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--hyeni-pink-text)', marginBottom: 20 }}>
        어떻게 참여할까요?
      </h1>
      <button disabled={loading} onClick={() => onSelect('parent')}
        style={{
          width: '100%', padding: 20, marginBottom: 12,
          background: 'linear-gradient(135deg,#60A5FA,#3B82F6)', color: '#fff',
          border: 0, borderRadius: 20, textAlign: 'left', cursor: 'pointer',
        }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>👨‍👩 부모로 시작</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>가족을 만들고 아이를 초대합니다</div>
      </button>
      <button disabled={loading} onClick={() => onSelect('child')}
        style={{
          width: '100%', padding: 20,
          background: 'linear-gradient(135deg,#F779A8,#E65C92)', color: '#fff',
          border: 0, borderRadius: 20, textAlign: 'left', cursor: 'pointer',
        }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>🧒 아이로 참여</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>부모가 준 초대 코드로 들어갑니다</div>
      </button>
    </OnboardingShell>
  )
}
```

- [ ] **Step 2: 회귀 체크**

- 부모 계정 로그인 직후 → StepRolePick → 부모 선택 → 기존 ParentSetupScreen 진입
- 아이 계정 로그인 직후 → StepRolePick → 아이 선택 → 기존 ChildPairInput 진입

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/onboarding/StepRolePick.jsx src/App.jsx
git commit -m "feat(dx-1-3): Step 02 Role Pick (replaces RoleSetupModal visual)"
```

---

### Task DX-1-4 · Step 03 Permissions (신규 · 권한 일괄 요청)

**Files:**
- Create: `src/components/redesign/onboarding/StepPermissions.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: StepPermissions**

```jsx
// src/components/redesign/onboarding/StepPermissions.jsx
import { useState } from 'react'
import OnboardingShell from './OnboardingShell.jsx'
import { requestPermission } from '../../../lib/pushNotifications.js'

export default function StepPermissions({ onBack, onNext, onSkip }) {
  const [status, setStatus] = useState({ notif: 'idle', loc: 'idle', mic: 'idle' })
  const anyRequested = Object.values(status).some(s => s !== 'idle')

  async function ask(kind) {
    setStatus(s => ({ ...s, [kind]: 'requesting' }))
    try {
      if (kind === 'notif') await requestPermission()
      if (kind === 'loc') await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej))
      if (kind === 'mic') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(t => t.stop())
      }
      setStatus(s => ({ ...s, [kind]: 'granted' }))
    } catch { setStatus(s => ({ ...s, [kind]: 'denied' })) }
  }

  return (
    <OnboardingShell step={3} total={8} onBack={onBack} onNext={onNext} onSkip={onSkip} nextDisabled={!anyRequested}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--hyeni-pink-text)', marginBottom: 8 }}>
        세 가지 권한을 열어주세요
      </h1>
      <p style={{ fontSize: 13, color: 'var(--hyeni-muted)', marginBottom: 20 }}>
        언제든 설정에서 바꿀 수 있어요.
      </p>
      {[
        { key: 'notif', icon: '🔔', title: '알림', sub: '일정·안전 소식을 놓치지 않게' },
        { key: 'loc', icon: '📍', title: '위치', sub: '지도와 도착 알림에 필요해요' },
        { key: 'mic', icon: '🎤', title: '마이크', sub: '음성으로 일정을 더해요' },
      ].map(p => (
        <button key={p.key} onClick={() => ask(p.key)} className="hyeni-card"
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ fontSize: 28 }}>{p.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900 }}>{p.title}</div>
            <div style={{ fontSize: 12, color: 'var(--hyeni-muted)' }}>{p.sub}</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800,
            color: status[p.key] === 'granted' ? 'var(--hyeni-cat-sports)'
                 : status[p.key] === 'denied' ? '#DC2626'
                 : 'var(--hyeni-pink-deep)' }}>
            {status[p.key] === 'granted' ? '허용됨' : status[p.key] === 'denied' ? '차단됨' : status[p.key] === 'requesting' ? '요청 중...' : '허용하기'}
          </div>
        </button>
      ))}
    </OnboardingShell>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/redesign/onboarding/StepPermissions.jsx src/App.jsx
git commit -m "feat(dx-1-4): Step 03 Permissions (notif/location/mic unified request UI)"
```

---

### Task DX-1-5 · Step 04 Family Created (신규)

**Files:**
- Create: `src/components/redesign/onboarding/StepFamilyCreated.jsx`

- [ ] **Step 1: 컴포넌트**

```jsx
// src/components/redesign/onboarding/StepFamilyCreated.jsx
import OnboardingShell from './OnboardingShell.jsx'

export default function StepFamilyCreated({ familyName, onBack, onNext }) {
  return (
    <OnboardingShell step={4} total={8} onBack={onBack} onNext={onNext} nextLabel="초대 코드 받기" showSkip={false}>
      <div style={{ textAlign: 'center', padding: '48px 0 24px' }}>
        <div style={{ fontSize: 72 }}>🎉</div>
        <h1 style={{ marginTop: 16, fontSize: 24, fontWeight: 900, color: 'var(--hyeni-pink-text)' }}>
          '{familyName}' 가족이<br/>만들어졌어요
        </h1>
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--hyeni-muted)', maxWidth: 260, margin: '12px auto 0' }}>
          이제 아이를 초대해봐요.<br/>초대 코드는 48시간 동안 유효해요.
        </p>
      </div>
    </OnboardingShell>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/redesign/onboarding/StepFamilyCreated.jsx
git commit -m "feat(dx-1-5): Step 04 Family Created celebration screen"
```

---

### Task DX-1-6 · Step 05 Invite

**Files:**
- Create: `src/components/redesign/onboarding/StepInvite.jsx`

- [ ] **Step 1: 컴포넌트**

```jsx
// src/components/redesign/onboarding/StepInvite.jsx
import OnboardingShell from './OnboardingShell.jsx'

export default function StepInvite({ pairCode, expiresAt, onRegenerate, onCopy, onBack, onNext }) {
  return (
    <OnboardingShell step={5} total={8} onBack={onBack} onNext={onNext} nextLabel="코드 보냈어요" showSkip>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--hyeni-pink-text)', marginBottom: 16 }}>
        아이에게 이 코드를<br/>보여주세요
      </h1>
      <div className="hyeni-card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '0.2em', color: 'var(--hyeni-pink-deep)' }}>
          {pairCode || '----'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--hyeni-muted)', marginTop: 12 }}>
          {expiresAt ? `${new Date(expiresAt).toLocaleString()} 까지 유효` : '생성 중...'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onCopy} style={{ flex: 1, padding: 12, borderRadius: 16, border: '1.5px solid var(--hyeni-pink-line)', background: '#fff', color: 'var(--hyeni-pink-deep)', fontWeight: 800, cursor: 'pointer' }}>코드 복사</button>
        <button onClick={onRegenerate} style={{ flex: 1, padding: 12, borderRadius: 16, border: '1.5px solid var(--hyeni-pink-line)', background: '#fff', color: 'var(--hyeni-pink-deep)', fontWeight: 800, cursor: 'pointer' }}>새 코드</button>
      </div>
    </OnboardingShell>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/redesign/onboarding/StepInvite.jsx
git commit -m "feat(dx-1-6): Step 05 Invite pair-code view (reuses existing pair logic)"
```

---

### Task DX-1-7 · Step 06 Profile

**Files:**
- Create: `src/components/redesign/onboarding/StepProfile.jsx`

- [ ] **Step 1: 컴포넌트**

```jsx
// src/components/redesign/onboarding/StepProfile.jsx
import { useState } from 'react'
import OnboardingShell from './OnboardingShell.jsx'

const ICONS = ['👧','🧒','👦','🧑','🦊','🐰','🐻','🐱','🐶','🐼']

export default function StepProfile({ initial = {}, onBack, onNext }) {
  const [name, setName] = useState(initial.name || '')
  const [icon, setIcon] = useState(initial.icon || ICONS[0])
  return (
    <OnboardingShell step={6} total={8} onBack={onBack} onNext={() => onNext({ name, icon })} nextDisabled={!name.trim()}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--hyeni-pink-text)', marginBottom: 12 }}>
        프로필을 만들어주세요
      </h1>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="이름 또는 애칭" maxLength={16}
        style={{ width: '100%', padding: 14, borderRadius: 16, border: '1.5px solid var(--hyeni-pink-line)', fontSize: 16, marginBottom: 16, boxSizing: 'border-box', fontFamily: 'var(--hyeni-font-sans)' }}
      />
      <div style={{ fontSize: 12, color: 'var(--hyeni-muted)', marginBottom: 8 }}>프로필 아이콘</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {ICONS.map(i => (
          <button key={i} onClick={() => setIcon(i)} style={{
            aspectRatio: '1/1', fontSize: 28, borderRadius: 16,
            border: icon === i ? '2px solid var(--hyeni-pink-deep)' : '1.5px solid var(--hyeni-line)',
            background: icon === i ? 'var(--hyeni-pink-soft)' : '#fff', cursor: 'pointer',
          }}>{i}</button>
        ))}
      </div>
    </OnboardingShell>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/redesign/onboarding/StepProfile.jsx
git commit -m "feat(dx-1-7): Step 06 Profile (name + icon picker)"
```

---

### Task DX-1-8 · Step 07 Paired + Step 08 Tutorial

**Files:**
- Create: `src/components/redesign/onboarding/StepPaired.jsx`
- Create: `src/components/redesign/onboarding/StepTutorial.jsx`

- [ ] **Step 1: Paired**

```jsx
// src/components/redesign/onboarding/StepPaired.jsx
import OnboardingShell from './OnboardingShell.jsx'

export default function StepPaired({ childName, onNext }) {
  return (
    <OnboardingShell step={7} total={8} onNext={onNext} nextLabel="사용해볼게요" showSkip={false}>
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 80 }}>🤝</div>
        <h1 style={{ marginTop: 20, fontSize: 24, fontWeight: 900, color: 'var(--hyeni-pink-text)' }}>
          {childName ? `${childName} 와 연결됐어요!` : '가족이 연결됐어요!'}
        </h1>
      </div>
    </OnboardingShell>
  )
}
```

- [ ] **Step 2: Tutorial (4 tip carousel)**

```jsx
// src/components/redesign/onboarding/StepTutorial.jsx
import { useState } from 'react'
import OnboardingShell from './OnboardingShell.jsx'

const TIPS = [
  { icon: '📅', title: '일정을 한눈에', body: '캘린더 탭에서 학원·운동·취미를 색별로 정리해요.' },
  { icon: '📍', title: '아이 위치 확인', body: '위치 탭에서 실시간으로 안전하게 지켜볼 수 있어요.' },
  { icon: '💬', title: '메모로 대화', body: '하루 메모를 남겨 부모·아이가 서로 챙겨줘요.' },
  { icon: '🆘', title: '안전이 먼저', body: '긴 꾹 제스처로 긴급 알림을 보낼 수 있어요.' },
]

export default function StepTutorial({ onNext }) {
  const [i, setI] = useState(0)
  const last = i === TIPS.length - 1
  const tip = TIPS[i]
  return (
    <OnboardingShell step={8} total={8} onNext={() => last ? onNext() : setI(i + 1)}
                     nextLabel={last ? '시작하기' : '다음 팁'} showSkip onSkip={onNext}>
      <div className="hyeni-card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 60 }}>{tip.icon}</div>
        <h2 style={{ marginTop: 16, fontSize: 20, fontWeight: 900 }}>{tip.title}</h2>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--hyeni-muted)', lineHeight: 1.6 }}>{tip.body}</p>
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 16 }}>
        {TIPS.map((_, j) => (
          <div key={j} style={{ width: 8, height: 8, borderRadius: 4, background: j === i ? 'var(--hyeni-pink-deep)' : 'var(--hyeni-pink-line)' }} />
        ))}
      </div>
    </OnboardingShell>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/onboarding/StepPaired.jsx src/components/redesign/onboarding/StepTutorial.jsx
git commit -m "feat(dx-1-8): Step 07 Paired + Step 08 Tutorial (4 tips)"
```

---

### Task DX-1-9 · Onboarding 라우터 in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: State + router**

State (near line 5485):
```javascript
const [onboardStep, setOnboardStep] = useState(null)

useEffect(() => {
  if (localStorage.getItem('hyeni-onboarding-done') === 'v1') { setOnboardStep(null); return }
  if (!user) { setOnboardStep(null); return }
  if (!currentRole) { setOnboardStep(1); return }
  if (currentRole === 'parent' && !currentFamily) { setOnboardStep(4); return }
  setOnboardStep(8)
}, [user, currentRole, currentFamily])
```

- [ ] **Step 2: Render switch**

Before activeView render tree:
```jsx
{onboardStep === 1 && <StepWelcome onNext={() => setOnboardStep(2)} />}
{onboardStep === 2 && <StepRolePick onSelect={r => { setRole(r); setOnboardStep(3) }} onBack={() => setOnboardStep(1)} />}
{onboardStep === 3 && <StepPermissions onBack={() => setOnboardStep(2)} onNext={() => setOnboardStep(4)} onSkip={() => setOnboardStep(4)} />}
{onboardStep === 4 && <StepFamilyCreated familyName={currentFamily?.name} onBack={() => setOnboardStep(3)} onNext={() => setOnboardStep(5)} />}
{onboardStep === 5 && <StepInvite pairCode={pairCode} expiresAt={pairCodeExpiresAt} onCopy={copyPairCode} onRegenerate={regenerate} onBack={() => setOnboardStep(4)} onNext={() => setOnboardStep(6)} />}
{onboardStep === 6 && <StepProfile onBack={() => setOnboardStep(5)} onNext={data => { updateProfile(data); setOnboardStep(7) }} />}
{onboardStep === 7 && <StepPaired childName={pairedChildName} onNext={() => setOnboardStep(8)} />}
{onboardStep === 8 && <StepTutorial onNext={() => { localStorage.setItem('hyeni-onboarding-done', 'v1'); setOnboardStep(null) }} />}
{onboardStep === null && (<>{/* 기존 activeView 렌더 */}</>)}
```

실제 변수명은 기존 코드에 맞춰 rename.

- [ ] **Step 3: 시각 smoke**

```bash
npm run dev
# localStorage.removeItem('hyeni-onboarding-done') → 재로드 → 8-step 순회
```

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(dx-1-9): onboarding step router in App.jsx (8 steps)"
```

---

# Phase DX-2 · Core 6 Screens (Week 3-4)

---

### Task DX-2-0 · 앱 쉘에 DotPatternBg 적용

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Wrap**

```jsx
import DotPatternBg from './components/redesign/chrome/DotPatternBg.jsx'
// ...
return (
  <DotPatternBg className="hyeni-app-shell">
    {/* 기존 render tree */}
  </DotPatternBg>
)
```

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat(dx-2-0): wrap app shell with DotPatternBg"
```

---

### Task DX-2-1 · v3 Screen 01 부모 홈

**Files:**
- Modify: `src/App.jsx` (parent home render branch ~7500-8200)
- Design 참고: `design/Redesign v3 · Illustrated Warm Full.html:309-386`

- [ ] **Step 1: 구간 식별**

```bash
grep -n "isParent\s*&&\|부모 홈" src/App.jsx | head -20
```

- [ ] **Step 2: 부모 홈 JSX 재작성**

구조:
```
<section>
  <AppTopBar>아이 프로필(아바타+이름+위치 요약)</AppTopBar>
  <HeroSection>오늘의 일정 요약 카드 (그라데이션 + mascot)</HeroSection>
  <CategoryChipsRow>6색 카테고리 필터</CategoryChipsRow>
  <CardSection title="오늘 일정">DayTimetable 재사용</CardSection>
  <CardSection title="알림">최근 알림 3개 미리보기</CardSection>
  <FabButton onClick={openAiSchedule}>+ AI 일정 추가</FabButton>
  <BottomTabBar>
</section>
```

- [ ] **Step 3: 회귀 체크 (기능 유지)**

- 일정 생성 → AiScheduleModal
- 카테고리 필터 → 필터 적용
- 이벤트 탭 → RouteOverlay
- 설정 → 기존 설정
- 바텀 네비 → 각 view 이동

- [ ] **Step 4: 라인 범위 기록**

`docs/v1.x-redesign/EVIDENCE_DX-2.md` 에 `App.jsx:<start>-<end> parent-home replaced` 기록.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx docs/v1.x-redesign/EVIDENCE_DX-2.md
git commit -m "feat(dx-2-1): parent home redesign (App.jsx range, all features preserved)"
```

---

### Task DX-2-2 · v3 Screen 02 자녀 홈

**Files:**
- Modify: `src/App.jsx` (child home branch ~8700-9200)
- Design: v3 line 387-452

- [ ] **Step 1: 구간 식별 + 재작성**

```
<section>
  <AppTopBar>내 프로필 + 부모와 연결 상태</AppTopBar>
  <HeroSection>오늘 일정 카운트 + 응원 문구</HeroSection>
  <CardSection>DayTimetable 재사용</CardSection>
  <CardSection>부모에게 메시지/스티커</CardSection>
  <SosHoldButton>긴 꾹 SOS</SosHoldButton>  (DX-4-3 에서 완성, 일단 placeholder)
  <BottomTabBar>
</section>
```

- [ ] **Step 2: 회귀 체크**

- 일정 탭 / 메모 작성 / 위치 확인 / SOS 기능 유지

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(dx-2-2): child home redesign (App.jsx range)"
```

---

### Task DX-2-3 · v3 Screen 03 캘린더

**Files:**
- Modify: `src/App.jsx` (calendar view ~8100-8500 + DayTimetable 3380)
- Design: v3 line 453-530

- [ ] **Step 1: 월간 + 일간 뷰 재스타일**

- 월간: 카드형 grid, 오늘 셀 pink 하이라이트, 카테고리 도트 max 3
- 일간: DayTimetable 안쪽 이벤트 row 를 `hyeni-card` + `hyeni-chip--{category}` wrap (기존 핸들러 유지)

- [ ] **Step 2: 회귀**

- 월간↔일간 전환, 이벤트 CRUD (AiScheduleModal), 스티커(StickerBookModal)

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(dx-2-3): calendar redesign (App.jsx range + DayTimetable styling)"
```

---

### Task DX-2-4 · v3 Screen 04 메모 polish

**Files:**
- Modify: `src/App.jsx` (MemoSection 2989)
- Design: v3 line 531-603

- [ ] **Step 1: 적용 (Phase 5.5 위에 경량)**

- 말풍선 radius 24px 통일
- 날짜 구분선 dot + pink line
- Empty state 일러스트 (`public/illustrations/memo-empty.svg`)

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx public/illustrations/memo-empty.svg
git commit -m "feat(dx-2-4): memo section polish (radius + separator + empty illustration)"
```

---

### Task DX-2-5 · v3 Screen 05 페어링 (DX-1-3/6/8 에서 커버, skip)

**Files:** none

- [ ] **Step 1: Verify**

DX-1-3 (Role Pick), DX-1-6 (Invite), DX-1-8 (Paired) 가 v3 Screen 05 범위를 커버하는지 확인. 추가 작업 없음.

---

### Task DX-2-6 · v3 Screen 06 위치

**Files:**
- Modify: `src/App.jsx` (LocationMapView 3964, ChildTrackerOverlay 5064)
- Design: v3 line 663-746

- [ ] **Step 1: 재작성**

- 상단: 아이 이름 + 위치 상태 chip (3 state)
- 지도 floating pill: 마지막 업데이트, 거리, 배터리
- 하단 sheet: 최근 경로 + 새로고침 CTA + danger zone 리스트
- 지도는 KakaoMap 유지

- [ ] **Step 2: 회귀**

- 지도 panning / RouteOverlay / DangerZoneManager / SavedPlaceManager / onRefreshLocation

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(dx-2-6): location map redesign (LocationMapView + ChildTrackerOverlay)"
```

---

# Phase DX-3 · Core 11 Modals (Week 5-6)

### Task DX-3-0 · 공통 SheetShell

**Files:**
- Create: `src/components/redesign/chrome/SheetShell.jsx`

- [ ] **Step 1: 컴포넌트**

```jsx
// src/components/redesign/chrome/SheetShell.jsx
export default function SheetShell({ title, onClose, footer, children }) {
  return (
    <div role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(31,41,55,0.38)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxHeight: '92vh', background: '#fff', borderRadius: '32px 32px 0 0', boxShadow: '0 -16px 40px rgba(180,120,150,0.20)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--hyeni-pink-line)' }} />
        </div>
        <header style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ flex: 1, fontSize: 18, fontWeight: 900, color: 'var(--hyeni-ink)' }}>{title}</h2>
          <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: 'var(--hyeni-muted)' }}>✕</button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>{children}</div>
        {footer && <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--hyeni-line)' }}>{footer}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/redesign/chrome/SheetShell.jsx
git commit -m "feat(dx-3-0): SheetShell common modal frame (radius 32, grab handle, sticky footer)"
```

---

### Task DX-3-1..11 · 11 모달 리스타일

**공통 패턴 (각 task 에 동일 적용):**
1. Grep 으로 컴포넌트 함수 시작 라인 확정
2. Component JSX return 을 `<SheetShell title="..." onClose={onClose} footer={<CTA />}>...</SheetShell>` 로 wrap
3. 내부 폼/리스트를 `hyeni-card` + `hyeni-chip--*` 로 재스타일 (로직/props 불변)
4. 회귀 체크 (해당 모달 열고 모든 CTA 테스트)
5. 라인 범위 기록
6. Commit

---

- [ ] **Task DX-3-1 · AiScheduleModal (4285) · v4-B Modal 01**
  - 변경: record 버튼을 pink circle + pulse animation, 음성/이미지/텍스트 탭을 segmented control
  - Commit: `feat(dx-3-1): AiScheduleModal visual redesign`

- [ ] **Task DX-3-2 · StickerBookModal (3556) · v4-B Modal 02**
  - 변경: 스티커 그리드 카드형 + category tag
  - Commit: `feat(dx-3-2): StickerBookModal redesign`

- [ ] **Task DX-3-3 · QrPairScanner (1929) · v4-B Modal 03**
  - 변경: 카메라 viewport 에 pink 도트 프레임 + 안내 카피 + 수동 입력 fallback
  - Commit: `feat(dx-3-3): QrPairScanner redesign`

- [ ] **Task DX-3-4 · AcademyManager (2122) · v4-B Modal 04**
  - 변경: 학원 카드 + 추가 FAB + 프리셋 chip (ACADEMY_PRESETS)
  - Commit: `feat(dx-3-4): AcademyManager redesign`

- [ ] **Task DX-3-5 · SavedPlaceManager (4703) · v4-B Modal 05**
  - 변경: 저장된 장소 카드 (아이콘+이름+거리+slide action)
  - Commit: `feat(dx-3-5): SavedPlaceManager redesign`

- [ ] **Task DX-3-6 · DangerZoneManager (4528) · v4-B Modal 06**
  - 변경: 위험구역 카드 (반경+유형 chip) + 지도 picker 연동
  - Commit: `feat(dx-3-6): DangerZoneManager redesign`

- [ ] **Task DX-3-7 · PhoneSettingsModal (4672) · v4-B Modal 07**
  - 변경: 저장된 번호 카드 + 긴급 연락처 badge + 추가 폼
  - Commit: `feat(dx-3-7): PhoneSettingsModal redesign`

- [ ] **Task DX-3-8 · NotificationSettingsModal (4830) · v4-B Modal 08**
  - 변경: 각 알림 타입 row card + toggle + 몇 분 전 슬라이더 (NOTIFICATION_MINUTE_OPTIONS)
  - Commit: `feat(dx-3-8): NotificationSettingsModal redesign`

- [ ] **Task DX-3-9 · AmbientAudioRecorder (3661) · v4-B Modal 09**
  - 변경: 레벨 미터(REMOTE_AUDIO_LEVEL_BARS) 수직 bar 그래픽, 토글 큰 원형 버튼
  - Commit: `feat(dx-3-9): AmbientAudioRecorder redesign`

- [ ] **Task DX-3-10 · RouteOverlay (2279) · v4-B Modal 10**
  - 변경: 경로 요약 카드 + 지도 + 카카오맵 열기 CTA (KAKAO_WALKING_DIRECTIONS_URL)
  - Commit: `feat(dx-3-10): RouteOverlay redesign`

- [ ] **Task DX-3-11 · MapPicker (1444) · v4-B Modal 11**
  - 변경: 지도 상단 검색 + 하단 sticky "여기로 지정" CTA + pin drop animation
  - Commit: `feat(dx-3-11): MapPicker redesign`

---

# Phase DX-4 · Alerts (9) + SOS Flow (4 steps)

---

### Task DX-4-1 · AlertBannerV2 (9 타입 통합)

**Files:**
- Create: `src/components/redesign/alerts/AlertBannerV2.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 컴포넌트**

```jsx
// src/components/redesign/alerts/AlertBannerV2.jsx
const TYPES = {
  arrival:      { icon: '🏠', tone: 'pink',   title: '도착했어요' },
  danger_zone:  { icon: '⚠️', tone: 'danger', title: '위험구역' },
  late:         { icon: '⏰', tone: 'warning',title: '지연' },
  sos_received: { icon: '🛡', tone: 'danger', title: 'SOS 수신' },
  wave:         { icon: '👋', tone: 'pink',   title: '꾹 인사' },
  sticker:      { icon: '⭐️', tone: 'hobby',  title: '스티커' },
  reminder:     { icon: '📅', tone: 'parent', title: '일정 리마인더' },
  battery:      { icon: '🔋', tone: 'warning',title: '배터리 낮음' },
  pairing:      { icon: '🤝', tone: 'sports', title: '페어링 완료' },
}

const TONE_BG = {
  pink:    'linear-gradient(135deg,#FFD4E7,#FFE4EF)',
  danger:  'linear-gradient(135deg,#FEE2E2,#FECACA)',
  warning: 'linear-gradient(135deg,#FEF3C7,#FDE68A)',
  parent:  'linear-gradient(135deg,#DBEAFE,#BFDBFE)',
  hobby:   'linear-gradient(135deg,#FEF3C7,#FDE68A)',
  sports:  'linear-gradient(135deg,#D1FAE5,#A7F3D0)',
}

export default function AlertBannerV2({ alerts, onDismiss }) {
  if (!alerts?.length) return null
  return (
    <div style={{ position: 'fixed', top: 12, left: 12, right: 12, zIndex: 90, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.map(a => {
        const t = TYPES[a.type] || TYPES.reminder
        return (
          <div key={a.id} role="status"
            style={{ background: TONE_BG[t.tone], border: '1px solid rgba(255,255,255,0.6)', borderRadius: 20, padding: 14, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 20px rgba(180,120,150,0.18)' }}>
            <div style={{ fontSize: 24 }}>{t.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{a.title || t.title}</div>
              {a.body && <div style={{ fontSize: 12, color: 'var(--hyeni-ink-soft)' }}>{a.body}</div>}
            </div>
            <button onClick={() => onDismiss(a.id)} aria-label="닫기" style={{ background: 'none', border: 0, fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: App.jsx 교체**

```bash
grep -n "AlertBanner\s" src/App.jsx | head -5
```
`<AlertBanner ... />` 를 `<AlertBannerV2 ... />` 로 교체. 기존 alert 객체에 `type` 필드 없으면 default `reminder`.

- [ ] **Step 3: 회귀 체크**

도착/위험구역/SOS/꾹/리마인더 각 이벤트 발화 → 해당 타입 배너.

- [ ] **Step 4: Commit**

```bash
git add src/components/redesign/alerts/AlertBannerV2.jsx src/App.jsx
git commit -m "feat(dx-4-1): AlertBannerV2 with 9 types unified"
```

---

### Task DX-4-2 · EmergencyBanner heart-shield 통합

**Files:**
- Modify: `src/App.jsx` (EmergencyBanner 1631)

- [ ] **Step 1: Icon 교체**

`EmergencyBanner` 의 기존 🆘 영역을 `<HeartShieldSOS size={48} />` 로 교체. 배경 유지.

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat(dx-4-2): EmergencyBanner uses HeartShieldSOS SVG (no 🆘 emoji)"
```

---

### Task DX-4-3 · SosHoldButton (4-state long-press)

**Files:**
- Create: `src/components/redesign/alerts/SosHoldButton.jsx`

- [ ] **Step 1: 컴포넌트**

```jsx
// src/components/redesign/alerts/SosHoldButton.jsx
import { useRef, useState } from 'react'
import HeartShieldSOS from '../chrome/HeartShieldSOS.jsx'

export default function SosHoldButton({ onActivate, holdMs = 2000 }) {
  const [state, setState] = useState('idle')  // idle | holding | activated
  const timerRef = useRef(null)

  function start() {
    if (state === 'activated') return
    setState('holding')
    timerRef.current = setTimeout(() => {
      setState('activated')
      onActivate?.()
      setTimeout(() => setState('idle'), 5000)
    }, holdMs)
  }
  function cancel() {
    clearTimeout(timerRef.current)
    if (state === 'holding') setState('idle')
  }

  return (
    <button onMouseDown={start} onMouseUp={cancel} onMouseLeave={cancel}
      onTouchStart={start} onTouchEnd={cancel}
      aria-label="SOS 꾹 눌러 활성화"
      style={{
        position: 'relative', width: 120, height: 120, borderRadius: 60,
        background: state === 'activated' ? 'linear-gradient(135deg,#EF4444,#B91C1C)'
                   : state === 'holding' ? 'linear-gradient(135deg,#FF6B6B,#EF4444)'
                   : 'linear-gradient(135deg,#F779A8,#E65C92)',
        border: 0, cursor: 'pointer', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: state === 'holding' ? 'scale(0.95)' : 'scale(1)',
        transition: `transform ${holdMs}ms var(--hyeni-ease-out), background 300ms`,
        boxShadow: '0 16px 40px rgba(247,121,168,0.40)',
      }}>
      <HeartShieldSOS size={60} />
      {state === 'holding' && (
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#fff" strokeWidth="3"
            strokeDasharray="0 289"
            style={{ animation: `sosProgress ${holdMs}ms linear forwards` }}/>
        </svg>
      )}
      <style>{`@keyframes sosProgress { to { stroke-dasharray: 289 289; } }`}</style>
    </button>
  )
}
```

- [ ] **Step 2: 아이 홈에 배치**

DX-2-2 의 SosHoldButton placeholder 를 실제 컴포넌트로 교체, `onActivate={triggerSosEvent}` 로 기존 SOS 핸들러 연결.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/alerts/SosHoldButton.jsx src/App.jsx
git commit -m "feat(dx-4-3): SosHoldButton with 4-state hold-to-activate flow"
```

---

### Task DX-4-4 · SosActiveBanner (부모측)

**Files:**
- Create: `src/components/redesign/alerts/SosActiveBanner.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 컴포넌트**

```jsx
// src/components/redesign/alerts/SosActiveBanner.jsx
import HeartShieldSOS from '../chrome/HeartShieldSOS.jsx'

export default function SosActiveBanner({ childName, onOpenCall, onOpenMap, onDismiss }) {
  return (
    <div role="alertdialog" aria-modal="true"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 95, background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', padding: 16, boxShadow: '0 8px 24px rgba(185,28,28,0.5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <HeartShieldSOS size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>긴급 상황</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{childName || '아이'} 가 SOS 를 보냈어요</div>
        </div>
        <button onClick={onDismiss} style={{ background: 'rgba(255,255,255,0.2)', border: 0, color: '#fff', borderRadius: 12, width: 36, height: 36 }}>✕</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onOpenCall} style={{ flex: 1, padding: 12, borderRadius: 16, background: '#fff', color: '#B91C1C', border: 0, fontWeight: 900, cursor: 'pointer' }}>📞 바로 전화</button>
        <button onClick={onOpenMap} style={{ flex: 1, padding: 12, borderRadius: 16, background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', fontWeight: 900, cursor: 'pointer' }}>📍 위치 보기</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 통합**

`firedEmergencies` handler 에서 type === 'sos' 시 SosActiveBanner 렌더.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/alerts/SosActiveBanner.jsx src/App.jsx
git commit -m "feat(dx-4-4): SosActiveBanner with call/map CTAs"
```

---

### Task DX-4-5 · 배터리 알림 (신규)

**Files:**
- Modify: `src/App.jsx` + `src/lib/pushNotifications.js`

- [ ] **Step 1: 아이측 배터리 감지**

App.jsx 내 useEffect (아이 모드만):
```javascript
useEffect(() => {
  if (!isChild || !currentFamily) return
  let battery
  const check = () => {
    if (battery && battery.level < 0.20 && !battery.charging) {
      sendBroadcastWhenReady(currentFamily.id, {
        type: 'battery_low', level: Math.round(battery.level * 100),
      })
    }
  }
  async function setup() {
    if (!navigator.getBattery) return
    battery = await navigator.getBattery()
    battery.addEventListener('levelchange', check)
    battery.addEventListener('chargingchange', check)
    check()
  }
  setup()
  return () => {
    if (battery) {
      battery.removeEventListener('levelchange', check)
      battery.removeEventListener('chargingchange', check)
    }
  }
}, [isChild, currentFamily])
```

- [ ] **Step 2: 부모측 realtime subscribe**

realtime listener 에 `battery_low` 타입 분기 → AlertBannerV2 에 `type='battery'` enqueue.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx src/lib/pushNotifications.js
git commit -m "feat(dx-4-5): battery-low broadcast detection and parent alert"
```

---

# Phase DX-5 · Polish (Week 8)

---

### Task DX-5-1 · 도트 배경 일관성 sweep

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 탐색**

```bash
grep -n "background:\s*['\"]#F\|background:\s*DESIGN.colors.cream\|background:\s*var(--hyeni-cream" src/App.jsx | head -30
```

- [ ] **Step 2: 모달 외 영역 shell 위임 (hyeni-dot-bg)**

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(dx-5-1): dot background consistency sweep"
```

---

### Task DX-5-2 · CategoryChip 추출 + 치환

**Files:**
- Create: `src/components/redesign/chrome/CategoryChip.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 컴포넌트**

```jsx
// src/components/redesign/chrome/CategoryChip.jsx
export default function CategoryChip({ category, size = 'sm' }) {
  const key = category?.key || 'other'
  const label = category?.label || '기타'
  return <span className={`hyeni-chip hyeni-chip--${key}`} style={size === 'lg' ? { padding: '6px 12px' } : undefined}>{label}</span>
}
```

- [ ] **Step 2: 사용처 치환**

```bash
grep -n "CATEGORIES\.\|category\.color\|categoryLabel" src/App.jsx | head -20
```
해당 지점들을 `<CategoryChip category={c} />` 로 교체.

- [ ] **Step 3: Commit**

```bash
git add src/components/redesign/chrome/CategoryChip.jsx src/App.jsx
git commit -m "feat(dx-5-2): extract CategoryChip + replace inline category displays"
```

---

### Task DX-5-3 · 버튼 일관성 sweep

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 인라인 버튼 탐색**

```bash
grep -c "background:\s*DESIGN.colors.pink\|background:\s*['\"]#E65C92" src/App.jsx
```

- [ ] **Step 2: 헬퍼 활용 변환**

`makePrimaryButtonStyle()` / `makeSecondaryButtonStyle()` 미사용 버튼을 선별해 교체 (또는 `.hyeni-btn-primary` 클래스).

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(dx-5-3): button consistency sweep"
```

---

### Task DX-5-4 · 접근성 sweep

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: 누락 탐색**

```bash
grep -c "aria-label\|role=\"dialog\"\|aria-modal" src/App.jsx
```

- [ ] **Step 2: 보강**

- 모든 모달: `role="dialog"` + `aria-modal="true"` + `aria-label`
- 아이콘-only 버튼에 `aria-label`
- 모달 오픈 시 첫 focusable 에 focus
- 이미지에 의미 있는 `alt` 또는 `alt=""`

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(dx-5-4): accessibility sweep (aria-label, role, focus trap)"
```

---

### Task DX-5-5 · Playwright visual regression

**Files:**
- Create: `tests/e2e/redesign/screens.spec.js`
- Create: `tests/e2e/redesign/modals.spec.js`

- [ ] **Step 1: Screens spec**

```javascript
// tests/e2e/redesign/screens.spec.js
import { test, expect } from '@playwright/test'

const SCREENS = ['parent-home', 'child-home', 'calendar', 'memo', 'location']

for (const s of SCREENS) {
  test(`screen ${s} matches baseline`, async ({ page }) => {
    await page.goto(`/?e2e=${s}`)
    await expect(page).toHaveScreenshot(`${s}.png`, { maxDiffPixelRatio: 0.02 })
  })
}
```

- [ ] **Step 2: Modals spec**

```javascript
// tests/e2e/redesign/modals.spec.js
import { test, expect } from '@playwright/test'

const MODALS = [
  'ai-schedule', 'sticker-book', 'qr-pair', 'academy', 'saved-places',
  'danger-zones', 'phone', 'notifications', 'audio', 'route', 'map-picker',
]

for (const m of MODALS) {
  test(`modal ${m} matches baseline`, async ({ page }) => {
    await page.goto(`/?e2e=modal-${m}`)
    await expect(page).toHaveScreenshot(`modal-${m}.png`, { maxDiffPixelRatio: 0.02 })
  })
}
```

- [ ] **Step 3: Baseline 생성 + commit**

```bash
npx playwright test tests/e2e/redesign --update-snapshots
git add tests/e2e/redesign/ tests/e2e/__screenshots__/
git commit -m "test(dx-5-5): Playwright visual regression baselines (5 screens + 11 modals)"
```

---

### Task DX-5-6 · 토큰 문서화

**Files:**
- Create: `src/components/redesign/docs/TOKENS.md`

- [ ] **Step 1: 문서**

토큰 레퍼런스: 색상 / 카테고리 6색 가이드 / 반경 / 그림자 / 폰트 / 공통 컴포넌트 경로 목록.

- [ ] **Step 2: Commit**

```bash
git add src/components/redesign/docs/TOKENS.md
git commit -m "docs(dx-5-6): redesign tokens reference"
```

---

# Phase DX-6 · DEFERRED · v4-D Responsive (PC / Tablet / School Console)

**상태:** **out of scope for 현 실행.** 별도 승인 시 신규 milestone 에서 진행.

**이유:**
- 현 stack lock: Android-only (Capacitor 8)
- PC 웹은 반응형 breakpoint 만 추가하면 일부 호환, 하지만 v4-D 는 sidebar layout full 재설계 필요
- School Ops Console (B2B) 은 별도 인증/권한/route 필요 — milestone 규모

**예상 Task list (미실행, 참고용):**
- DX-6-1 · Parent PC Web breakpoint (≥1024px)
- DX-6-2 · Parent Tablet (768-1023px)
- DX-6-3 · School Ops Console (`/console` route, 신규 테이블)

---

# Self-Review

**1. Spec coverage (design 7종 ↔ task)**

| Design | Task |
|---|---|
| v3 Screen 01 부모 홈 | DX-2-1 |
| v3 Screen 02 자녀 홈 | DX-2-2 |
| v3 Screen 03 캘린더 | DX-2-3 |
| v3 Screen 04 메모 | DX-2-4 |
| v3 Screen 05 페어링 | DX-1-3 / DX-1-6 / DX-1-8 (통합) |
| v3 Screen 06 위치 | DX-2-6 |
| v4-A 9 alerts | DX-4-1 (9 통합) |
| v4-A SOS 4 flows | DX-4-3 (idle/hold/activated) + DX-4-4 (banner) |
| v4-B 11 modals | DX-3-1 ~ DX-3-11 |
| v4-C splash | DX-1-1 |
| v4-C onboarding 8 steps | DX-1-2 ~ DX-1-9 |
| v4-D responsive | DX-6 deferred (명시) |

**갭 없음. DX-4-5 (배터리) 는 디자인에 있고 코드에 없어 신규.**

**2. Placeholder scan**

```bash
grep -n "TBD\|TODO\|XXX\|FIXME" docs/superpowers/plans/2026-04-25-redesign-illustrated-warm-plan.md
```
Expected: 0.

**3. Type consistency**

- `DESIGN.colors.*` ↔ `var(--hyeni-*)` ↔ `hyeni-chip--*` / `hyeni-btn-primary` 3-way 일관
- `AlertBannerV2` 9 타입 ↔ 레거시 alert 객체 backward-compat (default reminder)
- `SosHoldButton` 3 state ↔ `SosActiveBanner` 부모측 ↔ `EmergencyBanner` 통합
- `OnboardingShell` props (step/total/onBack/onNext/nextLabel/nextDisabled/onSkip/showSkip) ↔ 전 StepXx 호출처 일관
- `SheetShell` props (title/onClose/footer/children) ↔ 11 modal 호출 패턴 일관

**4. Scope**

- Phase 당 task: DX-0 4 / DX-1 9 / DX-2 6 / DX-3 12 / DX-4 5 / DX-5 6 = **42 task**
- 평균 step: 3–5, 누적 ~170 step
- 예상: 평균 20분 × 42 ≈ 14시간 순수 코딩 + baseline/smoke ≈ **3주 (1일 3-5시간)**

---

# Constraints · Non-Negotiable

- ✓ **기능 삭제 절대 금지.** 각 task "회귀 체크" step 강제.
- ✓ `src/App.jsx` decomposition 금지 (CLAUDE.md). 라인 범위 치환만.
- ✓ 새 npm dep 0개.
- ✓ VAPID 키 회전 금지.
- ✓ Supabase schema 변경 없음 (UI-only).
- ✓ iOS 작업 없음.

---

# Risks · Mitigations

| 위험 | 확률 | 영향 | 완화 |
|---|---|---|---|
| 인라인 스타일 vs CSS var 혼재로 시각 회귀 | 중 | 중 | DX-5-5 Playwright visual regression Phase 종료마다 필수 |
| 기존 기능 누락 (props 바인딩 오류) | 중 | 높음 | 각 task "회귀 체크" 강제. 11 modal 각 실기기 smoke |
| Pretendard CDN 장애 | 낮음 | 낮음 | font-family chain 에 Noto Sans KR + Apple SD Gothic Neo 포함 |
| Splash variant 미결 | 높음 | 낮음 | 기본 A Minimal. 실행 시 1-word override |
| Battery API 일부 브라우저 미지원 | 중 | 낮음 | try/catch + silent fallback |
| App.jsx 편집 병합 충돌 | 중 | 중 | 매일 main rebase. atomic commit 유지 |
| 픽셀 매칭 부담 | 중 | 낮음 | 구조+토큰+여백 목표, maxDiffPixelRatio 0.02 |

---

# Open Questions (실행 전 해결)

1. **Splash variant** — A Minimal (기본) / B Gradient / C Bloom. 1-word 확정.
2. **배터리 알림 임계값** — 20% (기본) vs 15%.
3. **Pretendard CDN vs 로컬 번들**.
4. **`codex/child-mode-cards-supplies` 의 uncommitted 11 M 파일 처리** (별도 PR or stash).
5. **v4-D 실제 승인 여부** — 완전 deferred (권장) vs DX-6 포함.

---

# References

- **Design:** `design/` 폴더 7 HTML + 9 preview PNG
- **Memory:** `~/.claude/projects/C--Users-TK-Desktop-hyeni-1/memory/design_direction.md`
- **Generated by skill:** huashu-design (github.com/alchaincyf/huashu-design)
- **Existing tokens:**
  - `src/App.css:9-38` (CSS vars root)
  - `src/App.jsx:621-676` (DESIGN JS object)
- **Existing helpers:** `makeCardStyle` / `makeSheetStyle` / `makeInputStyle` / `makePrimary/SecondaryButtonStyle` (App.jsx:683-742)
- **CLAUDE.md:** App.jsx 분해 금지, 새 dep 금지, 기능 보존

---

# Execution Handoff

Plan 저장 완료. 두 가지 실행 경로:

**1. Subagent-Driven (추천)** — 매 task 마다 신규 서브에이전트, 완료 후 리뷰.

**2. Inline Execution** — 이 세션에서 순차 실행. `/superpowers:executing-plans` Phase 단위 체크포인트.

**추천:** DX-0 은 Inline (빠름), DX-1 부터는 Subagent-Driven (화면 단위 분리).

실행 경로 지정 전까지 plan 저장·커밋만 완료.

---

*Plan 작성: 2026-04-25 (Saturday). 기반: `design/` 7 HTML + design memory · B · Illustrated Warm 확정.*
