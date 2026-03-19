# Phase 1a: 컴포넌트 분리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5,609줄 모놀리식 App.jsx를 ~20개 파일로 분리하여 유지보수 가능한 구조로 전환. 기능 변경 없이 구조만 변경 (한국어 하드코딩 유지).

**Architecture:** 컴포넌트 = UI만, hooks = 비즈니스 로직, lib = 유틸리티. 기존 상태 관리(useState/useEffect)를 커스텀 훅으로 추출하고, JSX 블록을 독립 컴포넌트로 분리.

**Tech Stack:** React 19, Vite 7, Capacitor 8, Supabase

**Spec:** `docs/superpowers/specs/2026-03-19-global-i18n-design.md` Section 3

**검증 방법:** 자동화 테스트 없음. 각 Task 완료 후 `npx vite build` 성공 확인. 마지막 Task에서 APK 빌드 + 설치 + 수동 스모크 테스트.

### 스펙 컴포넌트명 ↔ 계획 컴포넌트명 매핑

스펙(Section 3)의 이상적 구조와 실제 코드 기반 추출 결과가 다른 경우:

| 스펙 이름 | 계획 이름 | 이유 |
|----------|----------|------|
| FamilySetup.jsx | ParentSetupScreen.jsx | 기존 함수명 유지 |
| RoleSelect.jsx | LoginScreen.jsx에 통합 | RoleSetupModal이 로그인 플로우 일부 |
| DaySchedule.jsx | DayTimetable.jsx | 기존 함수명 유지 |
| ScheduleForm.jsx | AcademyManager.jsx | 기존 함수명 유지 |
| CategoryPicker.jsx | CategoryAddForm.jsx | 기존 함수명 유지 |
| StickerPanel.jsx | StickerBookModal.jsx | 기존 함수명 유지 |
| KkukButton.jsx | ChildCallButtons.jsx에 통합 | 꾹 버튼이 통화 버튼과 같은 블록 |
| Navigation.jsx | RouteOverlay.jsx | 기존 함수명 유지 |
| DangerZone.jsx | DangerZoneManager.jsx | 기존 함수명 유지 |
| ArrivalDetector.jsx | useLocation.js에 포함 | 도착 판정은 UI 아닌 로직 |
| NotificationSettings.jsx | Phase 1b에서 생성 | i18n과 함께 생성 |
| PermissionGuide.jsx | Phase 1b에서 생성 | i18n과 함께 생성 |
| Layout.jsx, Modal.jsx | Phase 1b에서 생성 | i18n 적용 시 공통 레이아웃 추출 |
| LanguageSwitcher.jsx | Phase 1b에서 생성 | 언어 전환 UI |
| LoadingSpinner.jsx | Phase 1b에서 생성 | i18n과 함께 생성 |
| VoiceParse.jsx | AiScheduleModal.jsx | 기존 함수명 유지 |

---

## Task 0: global 브랜치 생성

**Files:** 없음 (git 작업만)

- [ ] **Step 1: global 브랜치 생성**

```bash
cd C:/Users/TK/Desktop/kids-app && git checkout -b global
```

- [ ] **Step 2: 빌드 확인**

Run: `cd C:/Users/TK/Desktop/kids-app && npx vite build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git commit --allow-empty -m "chore: global 브랜치 생성 (다국어 글로벌 버전)"
```

---

## Task 1: lib/utils.js — 공통 헬퍼 함수 + 상수 추출

**Files:**
- Create: `src/lib/utils.js`
- Modify: `src/App.jsx`

**추출 대상 (실제 함수/변수명 — App.jsx 참조):**

| 함수/상수 | App.jsx 위치 | 설명 |
|----------|-------------|------|
| `KAKAO_APP_KEY` | line 8 | 환경 변수 |
| `SUPABASE_URL` | line 9 | 환경 변수 |
| `SUPABASE_KEY` | line 10 | 환경 변수 |
| `PARENT_PAIRING_INTENT_KEY` | line 11 | localStorage 키 |
| `PUSH_FUNCTION_URL` | line 12 | Edge Function URL |
| `AI_PARSE_URL` | line 13 | AI 파싱 URL |
| `AI_MONITOR_URL` | line 14 | AI 모니터 URL |
| `FF` | line 282 | 폰트 패밀리 상수 |
| `DAYS_KO` | line 402 | 요일 배열 |
| `MONTHS_KO` | line 403 | 월 배열 |
| `ARRIVAL_R` | (확인 필요) | 도착 반경 |
| `DEPARTURE_TIMEOUT_MS` | (확인 필요) | 출발 타임아웃 |
| `DEFAULT_NOTIF` | (확인 필요) | 기본 알림 설정 |
| `getNativeSetupAction()` | line 16-34 | 알림 권한 상태 |
| `sendInstantPush()` | line 37-97 | Edge Function push |
| `rememberParentPairingIntent()` | line 245-249 | 부모 페어링 intent 저장 |
| `clearParentPairingIntent()` | line 251-255 | 부모 페어링 intent 삭제 |
| `escHtml()` | line 405-408 | HTML 이스케이프 |
| `haversineM()` | line 417+ | GPS 거리 계산 |
| `getDIM()`, `getFD()`, `fmtT()` | (확인 필요) | 날짜/시간 헬퍼 |

- [ ] **Step 1: src/lib/utils.js 생성**

App.jsx에서 위 함수/상수를 그대로 잘라내어 `export` 추가. `getSession` import 필요 (sendInstantPush에서 사용).

- [ ] **Step 2: App.jsx에서 import로 교체**

```javascript
import { KAKAO_APP_KEY, SUPABASE_URL, SUPABASE_KEY, FF, DAYS_KO, MONTHS_KO, ... , sendInstantPush, escHtml, haversineM } from "./lib/utils.js";
```

원래 정의 삭제.

- [ ] **Step 3: 빌드 확인**

Run: `npx vite build`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add src/lib/utils.js src/App.jsx
git commit -m "refactor: 공통 헬퍼 함수/상수를 lib/utils.js로 추출"
```

---

## Task 2: lib/categories.js — 카테고리 관리 추출

**Files:**
- Create: `src/lib/categories.js`
- Modify: `src/App.jsx`

**추출 대상 (App.jsx line 354-400):**

| 항목 | 설명 |
|------|------|
| `DEFAULT_CATEGORIES` | 기본 카테고리 배열 |
| `LS_CUSTOM_CATS` | localStorage 키 |
| `loadCategories()` | 카테고리 로드 |
| `let CATEGORIES` | 현재 카테고리 (mutable) |
| `saveCustomCategories()` | 커스텀 카테고리 저장 |
| `getCustomCategories()` | 커스텀 카테고리 조회 |
| `DEFAULT_CAT_IDS` | 기본 카테고리 ID Set |
| `ACADEMY_PRESETS` | 학원 프리셋 배열 |
| `SCHEDULE_PRESETS` | 스케줄 프리셋 배열 |

> **주의**: `CATEGORIES`는 mutable `let` 변수. `saveCustomCategories()`가 직접 재할당함. `categories.js`에서 `export let CATEGORIES`로 내보내고, 외부에서는 `getCategories()` getter 함수를 통해 접근하도록 변경.

```javascript
// src/lib/categories.js
let CATEGORIES = loadCategories();
export function getCategories() { return CATEGORIES; }
export function saveCustomCategories(customs) { /* ... CATEGORIES 재할당 */ }
```

App.jsx에서 `CATEGORIES` 직접 참조 → `getCategories()` 호출로 교체.

- [ ] **Step 1: src/lib/categories.js 생성**
- [ ] **Step 2: App.jsx에서 import + CATEGORIES → getCategories() 교체**
- [ ] **Step 3: 빌드 확인**

Run: `npx vite build`

- [ ] **Step 4: 커밋**

```bash
git add src/lib/categories.js src/App.jsx
git commit -m "refactor: 카테고리 관리를 lib/categories.js로 추출"
```

---

## Task 3: lib/remoteAudio.js — 원격 오디오 유틸리티 추출

**Files:**
- Create: `src/lib/remoteAudio.js`
- Modify: `src/App.jsx`

**추출 대상 (App.jsx line 99-209, 정확히 여기까지만 — line 211 이후는 제외):**
- `REMOTE_AUDIO_CHUNK_MS`, `REMOTE_AUDIO_DEFAULT_DURATION_SEC`, `REMOTE_AUDIO_MIME_TYPES`
- `getRemoteAudioMimeType()`
- `stopRemoteAudioCapture()`
- `blobToBase64()`
- `waitForRealtimeChannelReady()`
- `startRemoteAudioCapture()`

> **경계**: line 211-255는 `startNativeLocationService`, `stopNativeLocationService`, `rememberParentPairingIntent`, `clearParentPairingIntent` — 이들은 Task 1(utils.js)과 Task 4(locationService.js)에서 처리. remoteAudio.js에 포함하지 않음.

- [ ] **Step 1: src/lib/remoteAudio.js 생성**
- [ ] **Step 2: App.jsx에서 import로 교체**
- [ ] **Step 3: 빌드 확인**

Run: `npx vite build`

- [ ] **Step 4: 커밋**

```bash
git add src/lib/remoteAudio.js src/App.jsx
git commit -m "refactor: 원격 오디오 유틸리티를 lib/remoteAudio.js로 추출"
```

---

## Task 4: lib/locationService.js + lib/kakaoMaps.js — 네이티브 위치 + 지도 SDK 추출

**Files:**
- Create: `src/lib/locationService.js`
- Create: `src/lib/kakaoMaps.js`
- Modify: `src/App.jsx`

### lib/locationService.js

**추출 대상 (App.jsx line 211-243):**
- `startNativeLocationService()` — Capacitor BackgroundLocation 시작
- `stopNativeLocationService()` — Capacitor BackgroundLocation 중지

이 함수들은 `SUPABASE_URL`, `SUPABASE_KEY`를 utils.js에서 import 필요.

> **의존성**: Task 1 (utils.js) 완료 후 진행.

### lib/kakaoMaps.js

**추출 대상 (App.jsx line 427-455):**
- `let kakaoReady = null;` (line 428) — 싱글턴 캐시 변수, 반드시 포함
- `loadKakaoMap(appKey)` — SDK 동적 로드 Promise

- [ ] **Step 1: src/lib/locationService.js 생성**
- [ ] **Step 2: src/lib/kakaoMaps.js 생성** (`kakaoReady` 포함)
- [ ] **Step 3: App.jsx에서 import로 교체**
- [ ] **Step 4: 빌드 확인**

Run: `npx vite build`

- [ ] **Step 5: 커밋**

```bash
git add src/lib/locationService.js src/lib/kakaoMaps.js src/App.jsx
git commit -m "refactor: 네이티브 위치 서비스 + 카카오맵 SDK를 별도 모듈로 추출"
```

---

## Task 5: 소형 UI 컴포넌트 추출 (7개)

**Files:**
- Create: `src/components/common/BunnyMascot.jsx`
- Create: `src/components/common/AlertBanner.jsx`
- Create: `src/components/common/EmergencyBanner.jsx`
- Create: `src/components/common/MapZoomControls.jsx`
- Create: `src/components/common/KakaoStaticMap.jsx`
- Create: `src/components/auth/ChildPairInput.jsx`
- Create: `src/components/auth/PairCodeSection.jsx`
- Modify: `src/App.jsx`

> **의존성**: Task 1 완료 필수 (FF 상수가 utils.js에 있음)

각 컴포넌트의 필요 import:

| 컴포넌트 | 필요 import |
|---------|-----------|
| BunnyMascot (line 260-277) | 없음 (순수 SVG). default size = **80** (원본 그대로) |
| AlertBanner (line 614-633) | `FF` from utils.js |
| EmergencyBanner (line 638-667) | `FF` from utils.js |
| MapZoomControls (line 477-490) | 없음 |
| KakaoStaticMap (line 461-472) | `useRef`, `useEffect` from react, `window.kakao` |
| ChildPairInput (line 862-899) | `useState` from react, `FF` from utils.js |
| PairCodeSection (line 724-763) | `FF` from utils.js |

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p src/components/common src/components/auth src/components/calendar src/components/location src/components/memo src/components/ai
```

- [ ] **Step 2: 7개 컴포넌트 파일 생성** (각각 App.jsx에서 잘라내어 별도 파일로)
- [ ] **Step 3: App.jsx에서 import로 교체**
- [ ] **Step 4: 빌드 확인**

Run: `npx vite build`

- [ ] **Step 5: 커밋**

```bash
git add src/components/ src/App.jsx
git commit -m "refactor: 소형 UI 컴포넌트 7개 추출"
```

---

## Task 6: 인증 관련 컴포넌트 추출

**Files:**
- Create: `src/components/auth/ParentSetupScreen.jsx`
- Create: `src/components/auth/LoginScreen.jsx` (RoleSetupModal 통합)
- Create: `src/components/auth/PairingModal.jsx`
- Modify: `src/App.jsx`

> **의존성**: Task 1 완료 필수 (FF, rememberParentPairingIntent, clearParentPairingIntent)

- [ ] **Step 1: ParentSetupScreen.jsx** (line 284-348) — props: `{ onCreateFamily, onJoinAsParent }`
- [ ] **Step 2: LoginScreen.jsx** — RoleSetupModal (line 672-719) 통합. props: `{ onLogin, onAnonymousLogin }`
- [ ] **Step 3: PairingModal.jsx** (line 769-857) — props: `{ children, onUnpair, onClose }`
- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
git add src/components/auth/ src/App.jsx
git commit -m "refactor: 인증 컴포넌트 3개 추출"
```

---

## Task 7: 캘린더/일정 관련 컴포넌트 추출

**Files:**
- Create: `src/components/calendar/DayTimetable.jsx`
- Create: `src/components/calendar/AcademyManager.jsx`
- Create: `src/components/calendar/CategoryAddForm.jsx`
- Create: `src/components/calendar/StickerBookModal.jsx`
- Modify: `src/App.jsx`

> **의존성**: Task 2 완료 필수 (categories.js — AcademyManager, CategoryAddForm이 getCategories() 사용)

- [ ] **Step 1: DayTimetable.jsx** (line 1786-1968, ~182줄)
- [ ] **Step 2: AcademyManager.jsx** (line 904-1062, ~158줄)
- [ ] **Step 3: CategoryAddForm.jsx** (line 1656-1708) + **StickerBookModal.jsx** (line 1973-2072)
- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
git add src/components/calendar/ src/App.jsx
git commit -m "refactor: 캘린더 관련 컴포넌트 4개 추출"
```

---

## Task 8: 위치/지도 관련 컴포넌트 추출 (4개)

**Files:**
- Create: `src/components/location/MapPicker.jsx`
- Create: `src/components/location/LocationMapView.jsx`
- Create: `src/components/location/DangerZoneManager.jsx`
- Create: `src/components/location/ChildTrackerOverlay.jsx`
- Modify: `src/App.jsx`

> **의존성**: Task 4 완료 필수 (kakaoMaps.js — loadKakaoMap 사용)

실제 props (코드 원본 기준):

| 컴포넌트 | 실제 props |
|---------|-----------|
| MapPicker (line 495-609) | `{ initial, currentPos, title, onConfirm, onClose }` |
| LocationMapView (line 2201-2368) | (코드에서 직접 확인) |
| DangerZoneManager (line 2670-2803) | (코드에서 직접 확인) |
| ChildTrackerOverlay (line 2872-3102) | (코드에서 직접 확인) |

- [ ] **Step 1: MapPicker.jsx** — `window.kakao.maps` 직접 참조 유지 (Phase 2에서 교체)
- [ ] **Step 2: LocationMapView.jsx**
- [ ] **Step 3: DangerZoneManager.jsx**
- [ ] **Step 4: ChildTrackerOverlay.jsx** (~230줄)
- [ ] **Step 5: 빌드 확인 + 커밋**

```bash
git add src/components/location/ src/App.jsx
git commit -m "refactor: 위치/지도 컴포넌트 4개 추출"
```

---

## Task 9: RouteOverlay 추출 (대형 컴포넌트)

**Files:**
- Create: `src/components/location/RouteOverlay.jsx`
- Modify: `src/App.jsx`

> **의존성**: Task 1, Task 4 완료 필수 (sendInstantPush, loadKakaoMap)

App.jsx에서 가장 큰 컴포넌트 (~584줄, line 1067-1651).

실제 props: `{ ev, childPos, mapReady, onClose, isChildMode }` (코드에서 `event`가 아닌 `ev`, `startPos`가 아닌 `childPos`)

내부에 자체 useState/useRef/useEffect가 많아 비교적 독립적.

- [ ] **Step 1: RouteOverlay.jsx** 추출
- [ ] **Step 2: 빌드 확인 + 커밋**

```bash
git add src/components/location/RouteOverlay.jsx src/App.jsx
git commit -m "refactor: RouteOverlay 컴포넌트 추출 (~584줄)"
```

---

## Task 10: 메모/소통 + AI 컴포넌트 추출

**Files:**
- Create: `src/components/memo/MemoSection.jsx`
- Create: `src/components/memo/PhoneSettingsModal.jsx`
- Create: `src/components/memo/ChildCallButtons.jsx`
- Create: `src/components/ai/AiScheduleModal.jsx`
- Create: `src/components/common/AmbientAudioRecorder.jsx`
- Modify: `src/App.jsx`

> **의존성**: Task 1 완료 필수 (AiScheduleModal이 sendInstantPush 사용). Task 3 완료 필수 (AmbientAudioRecorder가 remoteAudio.js 사용).

- [ ] **Step 1: MemoSection.jsx** (line 1713-1781)
- [ ] **Step 2: PhoneSettingsModal.jsx** (line 2809-2838) + **ChildCallButtons.jsx** (line 2843-2870)
- [ ] **Step 3: AiScheduleModal.jsx** (line 2372-2665, ~293줄)
- [ ] **Step 4: AmbientAudioRecorder.jsx** (line 2078-2196, ~118줄)
- [ ] **Step 5: 빌드 확인 + 커밋**

```bash
git add src/components/memo/ src/components/ai/ src/components/common/AmbientAudioRecorder.jsx src/App.jsx
git commit -m "refactor: 메모/AI/오디오 컴포넌트 5개 추출"
```

---

## Task 11: 커스텀 훅 추출 (비즈니스 로직 분리)

**Files:**
- Create: `src/hooks/useAuth.js`
- Create: `src/hooks/useFamily.js`
- Create: `src/hooks/useSchedules.js`
- Create: `src/hooks/useLocation.js`
- Create: `src/hooks/useNotification.js`
- Modify: `src/App.jsx`

> **이 Task는 가장 복잡합니다.** KidsScheduler 내부의 useState + useEffect + useCallback + **useRef**를 그룹별로 추출.

### useAuth.js

| 소유 대상 | 타입 |
|----------|------|
| `userId`, `role`, `isInitialized` | useState |
| `user` 객체 캐시 | useRef |
| 인증 초기화 리스너 | useEffect (onAuthChange) |
| `handleLogin`, `handleLogout` | useCallback |

### useFamily.js

| 소유 대상 | 타입 |
|----------|------|
| `familyId`, `familyCode`, `children`, `parentPhones` | useState |
| 가족 데이터 로드 | useEffect |
| `handleSetupFamily`, `handleJoinFamily`, `handleUnpair` | useCallback |
| Supabase 실시간 구독 ref | useRef |

### useSchedules.js

| 소유 대상 | 타입 |
|----------|------|
| `events`, `academies`, `memos`, `stickers`, `currentDate` | useState |
| 일정/학원/메모 로드 | useEffect |
| Supabase 실시간 구독 ref | useRef |
| CRUD 콜백 (add/update/delete event, academy, memo) | useCallback |

### useLocation.js

| 소유 대상 | 타입 |
|----------|------|
| `currentPos`, `childPos`, `locationTrail`, `dangerZones`, `livePos` | useState |
| GPS watchPosition ID | useRef |
| 위치 저장 interval | useRef |
| GPS 추적 useEffect | useEffect |
| 도착 판정 로직 (ArrivalDetector 역할) | useCallback |
| `startNativeLocationService` / `stopNativeLocationService` 호출 | useEffect |

### useNotification.js

| 소유 대상 | 타입 |
|----------|------|
| `notifHealth`, `notifSettings` | useState |
| 알림 스케줄링 | useEffect |
| 네이티브 건강 체크 | useCallback |

- [ ] **Step 1-5: 각 훅 파일 생성** (위 표의 소유 대상을 각 훅으로 이동)
- [ ] **Step 6: App.jsx에서 훅 사용으로 교체**

```jsx
function KidsScheduler() {
  const { userId, role, ... } = useAuth();
  const { familyId, familyCode, ... } = useFamily(userId);
  const { events, academies, ... } = useSchedules(familyId);
  const { currentPos, childPos, ... } = useLocation(userId, role, familyId);
  const { notifHealth } = useNotification(events, role);
  // ... UI 렌더링만 남김
}
```

- [ ] **Step 7: 빌드 확인**

Run: `npx vite build`

- [ ] **Step 8: 커밋**

```bash
git add src/hooks/ src/App.jsx
git commit -m "refactor: 커스텀 훅 5개 추출 (useAuth, useFamily, useSchedules, useLocation, useNotification)"
```

---

## Task 12: App.jsx 슬림화 + 최종 검증

**Files:**
- Modify: `src/App.jsx` (최종 정리)

- [ ] **Step 1: App.jsx 라인 수 확인**

```bash
wc -l src/App.jsx
```

목표: 300줄 이하. 남아있는 인라인 로직이 있으면 적절한 컴포넌트/훅으로 이동.

- [ ] **Step 2: 미사용 import 정리**

- [ ] **Step 3: 전체 빌드 + APK**

```bash
cd C:/Users/TK/Desktop/kids-app && npx vite build
cd android && ./gradlew assembleDebug
```

- [ ] **Step 4: APK 설치 + 수동 스모크 테스트**

```bash
export PATH="$PATH:/c/Users/TK/AppData/Local/Android/Sdk/platform-tools" && adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

체크리스트:
- [ ] 앱 실행 → 로그인 화면 표시
- [ ] 카카오 로그인 성공
- [ ] 캘린더 뷰 + 일정 추가/수정/삭제
- [ ] 지도에서 위치 선택
- [ ] 알림 수신 (hyeni_notification.mp3 사운드)
- [ ] 꾹 기능 동작
- [ ] 메모 작성/확인
- [ ] 길 안내 (RouteOverlay) 동작
- [ ] 위치 추적 (부모 모드)

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "refactor: Phase 1a 완료 — App.jsx 컴포넌트 분리 (5609줄 → ~300줄)"
```

---

## 최종 파일 구조

```
src/
├── components/
│   ├── common/
│   │   ├── BunnyMascot.jsx
│   │   ├── AlertBanner.jsx
│   │   ├── EmergencyBanner.jsx
│   │   ├── MapZoomControls.jsx
│   │   ├── KakaoStaticMap.jsx
│   │   └── AmbientAudioRecorder.jsx
│   ├── auth/
│   │   ├── LoginScreen.jsx
│   │   ├── ParentSetupScreen.jsx
│   │   ├── PairingModal.jsx
│   │   ├── PairCodeSection.jsx
│   │   └── ChildPairInput.jsx
│   ├── calendar/
│   │   ├── DayTimetable.jsx
│   │   ├── AcademyManager.jsx
│   │   ├── CategoryAddForm.jsx
│   │   └── StickerBookModal.jsx
│   ├── location/
│   │   ├── MapPicker.jsx
│   │   ├── LocationMapView.jsx
│   │   ├── RouteOverlay.jsx
│   │   ├── DangerZoneManager.jsx
│   │   └── ChildTrackerOverlay.jsx
│   ├── memo/
│   │   ├── MemoSection.jsx
│   │   ├── PhoneSettingsModal.jsx
│   │   └── ChildCallButtons.jsx
│   └── ai/
│       └── AiScheduleModal.jsx
├── hooks/
│   ├── useAuth.js
│   ├── useFamily.js
│   ├── useSchedules.js
│   ├── useLocation.js
│   └── useNotification.js
├── lib/
│   ├── utils.js            (신규 — 상수, 헬퍼 함수)
│   ├── categories.js       (신규 — 카테고리 관리)
│   ├── remoteAudio.js      (신규 — 원격 오디오)
│   ├── locationService.js  (신규 — 네이티브 위치 서비스)
│   ├── kakaoMaps.js        (신규 — 카카오맵 SDK 로더)
│   ├── supabase.js         (기존)
│   ├── auth.js             (기존)
│   ├── sync.js             (기존)
│   └── pushNotifications.js (기존)
└── App.jsx                 (~300줄 — 조합기 역할)
```

### Task 의존성 순서

```
Task 0 (브랜치) → Task 1 (utils.js) → Task 2 (categories.js) → Task 3 (remoteAudio.js)
                                     → Task 4 (locationService + kakaoMaps) [Task 1 필요]
                                     → Task 5 (소형 UI) [Task 1 필요]
Task 5 → Task 6 (인증) [Task 1 필요]
Task 2 → Task 7 (캘린더) [Task 2 필요]
Task 4 → Task 8 (위치/지도) [Task 4 필요]
Task 1,4 → Task 9 (RouteOverlay) [Task 1,4 필요]
Task 1,3 → Task 10 (메모/AI/오디오) [Task 1,3 필요]
Task 5-10 → Task 11 (훅 추출)
Task 11 → Task 12 (최종 검증)
```

Tasks 2, 3, 4, 5는 Task 1 완료 후 **병렬 실행 가능**.
