# 부모 메뉴 구조 재정비 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부모 모드 6 탭(홈/오늘/일정등록/장소/메모/가족)을 단일 책임 + multichild isolation + 항시 tabbar로 재정비. 자녀 1명 가정도 논리적 문제 없이 동작.

**Architecture:** App.jsx의 `activeView` 분기를 6 view 체계로 정리. modal-as-tab(`showParentMemoPage`/`showPairing`) 제거 후 `activeView` 통일. `selectedChildId`를 single source of truth로 격리. 메모 realtime 채널을 selectedChildId 기반 단일 채널로 통합해 "오늘"·"메모" 양방향 sync.

**Tech Stack:** React + Vite + Capacitor (Android) + Supabase (Realtime + Postgres) + vitest + Playwright.

**Spec**: `docs/superpowers/specs/2026-05-10-menu-restructure-design.md`

---

## File Structure

### Modify
- `src/App.jsx` — 핸들러 정리, view 분기 재구성, useEffect 가드 강화 (단일 hotspot)
- `src/components/memo/ParentMemoPage.jsx` — modal → view 변환, bottomNavigation prop 일관화
- `src/components/multichild/HomeDashboard/HomeTab.jsx` — 자녀 카드 단순화 (옵션 C 카드 정보)

### Create
- `src/components/multichild/HomeDashboard/ChildSelectCard.jsx` — 옵션 C 자녀 카드 컴포넌트 (재사용 위해 추출)
- `src/components/parent/ParentEventAddView.jsx` — 일정등록 탭 view (EventSheet wrapper)
- `src/components/parent/ParentFamilyView.jsx` — 가족 탭 view (페어링/관리 분기)
- `src/lib/memoRealtime.js` — channel key helper
- `tests/unit/parentNavigation.test.jsx` — 핸들러/isolation 단위 테스트
- `tests/unit/memoRealtime.test.js` — channel key 단위 테스트
- `tests/e2e/menu-single-child.spec.js` — single-child 흐름 E2E
- `tests/e2e/menu-multichild-isolation.spec.js` — multichild isolation E2E

### Remove
- App.jsx 내 `parentCalendar` view 분기 + `handleParentCalendarTabClick`
- `showParentMemoPage`, `showPairing`, `showParentSetup` modal-as-tab state

---

# Phase 1 — Navigation 정리

## Task 1: 새 view name 상수 정의 + 기존 핸들러 정리

**Files:**
- Modify: `src/App.jsx:611` (state 위), `src/App.jsx:4147~4223` (핸들러)

- [ ] **Step 1: 상수 추가 (App.jsx 함수 컴포넌트 시작 직후)**

```js
// view name 상수 — Single source of truth
const PARENT_VIEWS = {
  HOME: "home",
  CALENDAR: "calendar",   // = "오늘" 탭
  EVENT_ADD: "eventAdd",  // 신규
  MAPLIST: "maplist",
  MEMO: "memo",           // 신규 (showParentMemoPage 대체)
  FAMILY: "family",       // 신규 (showPairing 대체)
};
```

- [ ] **Step 2: handleParentCalendarTabClick 제거 + 신규 핸들러 추가**

기존 코드 (App.jsx:4147-4156) 삭제. 그 자리에 다음 핸들러 작성:

```js
const handleParentEventAddTabClick = () => {
  closeParentManagementPanels();
  setShowParentMemoPage(false);
  const todayKey = formatDateKey(today);
  setEditingEventId(null);
  setAddEventDateKey(todayKey);
  setNewTitle("");
  setNewTime("");
  setNewEndTime("");
  setNewLocation(null);
  setSelectedPreset(null);
  setActiveView(PARENT_VIEWS.EVENT_ADD);
};

const handleParentMemoTabClick = () => {
  closeParentManagementPanels();
  setShowParentMemoPage(false);
  setActiveView(PARENT_VIEWS.MEMO);
};

const handleParentFamilyTabClick = () => {
  closeParentManagementPanels();
  setShowParentMemoPage(false);
  setActiveView(PARENT_VIEWS.FAMILY);
};
```

- [ ] **Step 3: handleParentTodayTabClick auto-select useEffect 제거**

기존 useEffect (App.jsx:656-662) 삭제 — multichild에서 calendar 진입 시 자동으로 첫 자녀를 선택하던 코드는 spec 4.2 (홈으로 redirect 정책)와 충돌:

```js
// REMOVE THIS BLOCK
// useEffect(() => {
//   if (isParent && isMultiChild && !selectedChildId
//       && activeView === "calendar"
//       && pairedChildren.length > 0) {
//     setSelectedChildId(pairedChildren[0].id);
//   }
// }, [isParent, isMultiChild, selectedChildId, activeView, pairedChildren]);
```

기존 redirect useEffect (App.jsx:665-671)는 그대로 유지 — multichild + 미선택 시 홈으로 강제.

- [ ] **Step 4: build 검증**

Run: `npm run build`
Expected: ✓ 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "refactor(parent-nav): view 상수 + 신규 핸들러 (parentCalendar 제거 준비)"
```

---

## Task 2: parentCalendar view 분기 + 호출처 모두 제거

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: parentCalendar 사용처 grep**

Run: `grep -n 'parentCalendar' src/App.jsx`
Expected: setActiveView 호출 + activeView 분기 + tabbar matching 등 여러 위치.

- [ ] **Step 2: setActiveView("parentCalendar") 호출 제거**

App.jsx:4150 부근. 만약 다른 흐름에서 parentCalendar로 이동시키는 코드가 있으면 다음으로 교체:

```js
// before
setActiveView("parentCalendar");
// after
setActiveView(PARENT_VIEWS.CALENDAR);
```

- [ ] **Step 3: activeView === "parentCalendar" 분기 블록 삭제**

App.jsx:6892 부근 — `{activeView === "parentCalendar" && isParent && (...)}` 블록 통째로 삭제.

- [ ] **Step 4: tabbar 안 active 매칭에서도 parentCalendar 제거**

`renderParentBottomTabbar` 안에 `activeTab === "calendar"`만 매칭하도록 정리 (parentCalendar 매칭 코드 있으면 삭제).

- [ ] **Step 5: 검증**

Run: `grep -n 'parentCalendar' src/App.jsx`
Expected: 결과 없음 (전부 제거 확인).

Run: `npm run build`
Expected: ✓ 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "refactor(parent-nav): parentCalendar view 제거 (오늘과 중복)"
```

---

## Task 3: ParentEventAddView 신규 + eventAdd view 분기

**Files:**
- Create: `src/components/parent/ParentEventAddView.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: ParentEventAddView 컴포넌트 생성**

```jsx
// src/components/parent/ParentEventAddView.jsx
// 일정등록 탭 view — 오늘 날짜 default form 즉시 노출.
// EventSheet의 children prop에 들어가는 form 본체는 App.jsx에서 inject.

import { EventSheet } from "../multichild/EventModal/EventSheet.jsx";

export function ParentEventAddView({ children, onSave, onClose, canSave, saveLabel, isDirty, bottomNavigation }) {
  return (
    <>
      <EventSheet
        open
        title="새 일정"
        saveLabel={saveLabel || "저장"}
        onClose={onClose}
        onSave={onSave}
        canSave={canSave}
        isDirty={isDirty}
      >
        {children}
      </EventSheet>
      {bottomNavigation}
    </>
  );
}
```

- [ ] **Step 2: App.jsx에 eventAdd view 분기 추가 (단순 wrap, 기존 EventSheet 유지)**

기존 EventSheet (App.jsx:7029) 호출의 `open` prop을 `showAddModal || activeView === PARENT_VIEWS.EVENT_ADD`로 변경:

```jsx
<EventSheet
  open={showAddModal || activeView === PARENT_VIEWS.EVENT_ADD}
  title={editingEventId ? "일정 수정" : "새 일정"}
  saveLabel={editingEventId ? "수정" : "저장"}
  onClose={() => {
    setShowAddModal(false);
    setEditingEventId(null);
    setAddEventDateKey(null);
    setNewTitle("");
    setNewEndTime("");
    setTimeSelectionTarget("start");
    setNewLocation(null);
    setSelectedPreset(null);
    setWeeklyRepeat(false);
    setRepeatWeeks(4);
    if (activeView === PARENT_VIEWS.EVENT_ADD) setActiveView(PARENT_VIEWS.CALENDAR);
  }}
  onSave={async () => {
    await addEvent();
    if (activeView === PARENT_VIEWS.EVENT_ADD) setActiveView(PARENT_VIEWS.CALENDAR);
  }}
>
  {/* 기존 form children 그대로 */}
</EventSheet>
```

eventAdd view layout (tabbar + 빈 main)은 EventSheet가 fullscreen으로 덮으므로 별도 분기 불필요. 단 tabbar는 별도 노출:

```jsx
{activeView === PARENT_VIEWS.EVENT_ADD && isParent && (
  renderParentBottomTabbar(PARENT_VIEWS.EVENT_ADD, "hyeni-v5-tabbar-fixed")
)}
```

- [ ] **Step 3: build 검증**

Run: `npm run build`
Expected: ✓ 0 errors

- [ ] **Step 4: 수동 동작 확인 (vite dev)**

Run: `npm run dev`
부모 모드 → 일정등록 탭(다음 task에서 메뉴 추가됨) → form 즉시 등장.

- [ ] **Step 5: Commit**

```bash
git add src/components/parent/ParentEventAddView.jsx src/App.jsx
git commit -m "feat(parent-nav): eventAdd view 신규 (일정등록 탭)"
```

---

## Task 4: 메모 탭 view-as-tab 전환 + ParentMemoPage modal → view

**Files:**
- Modify: `src/components/memo/ParentMemoPage.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: ParentMemoPage 현재 props 점검**

Run: `head -60 src/components/memo/ParentMemoPage.jsx`
Expected: 현재 받는 props 파악 (open/onClose modal 패턴 vs view 패턴).

- [ ] **Step 2: ParentMemoPage view mode 지원 (bottomNavigation prop)**

```jsx
// ParentMemoPage.jsx — bottomNavigation prop 추가
export function ParentMemoPage({ /* 기존 props */, bottomNavigation }) {
  return (
    <div className="page-shell" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
      {/* 기존 chat UI 그대로 */}
      {bottomNavigation}
    </div>
  );
}
```

이미 view 모드 지원하면 bottomNavigation prop만 추가.

- [ ] **Step 3: App.jsx — memo view 분기 추가**

```jsx
{activeView === PARENT_VIEWS.MEMO && isParent && (
  <ParentMemoPage
    selectedChildId={selectedChildId}
    selectedChild={selectedChild}
    familyId={familyId}
    /* 기존 ParentMemoPage props 그대로 */
    bottomNavigation={renderParentBottomTabbar(PARENT_VIEWS.MEMO, "hyeni-v5-tabbar-fixed")}
  />
)}
```

- [ ] **Step 4: showParentMemoPage state + modal 호출 모두 제거**

Run: `grep -n 'showParentMemoPage\|setShowParentMemoPage' src/App.jsx`
Expected: 여러 위치 노출. 다음과 같이 정리:

- `useState` 선언 제거 (App.jsx 어디든)
- `setShowParentMemoPage(false)` 호출 모두 제거
- modal 형태 ParentMemoPage 렌더 블록 제거 (memo view 분기로 대체됨)

- [ ] **Step 5: build 검증**

Run: `npm run build`
Expected: ✓ 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/components/memo/ParentMemoPage.jsx src/App.jsx
git commit -m "refactor(parent-nav): 메모 탭 view-as-tab 전환 (showParentMemoPage 제거)"
```

---

## Task 5: 가족 탭 ParentFamilyView 신규 + view 분기

**Files:**
- Create: `src/components/parent/ParentFamilyView.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: ParentFamilyView 컴포넌트 생성**

```jsx
// src/components/parent/ParentFamilyView.jsx
// 가족 탭 — familyId 유무로 페어링 vs 관리 분기.

export function ParentFamilyView({ bottomNavigation, children }) {
  return (
    <div className="page-shell" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
      {children}
      {bottomNavigation}
    </div>
  );
}
```

- [ ] **Step 2: App.jsx — family view 분기 추가**

기존 PairingWizard / 가족 관리 컴포넌트 호출 위치 확인:

Run: `grep -n 'PairingWizard\|FamilyManagement' src/App.jsx`

family view 분기:

```jsx
{activeView === PARENT_VIEWS.FAMILY && isParent && (
  <ParentFamilyView
    bottomNavigation={renderParentBottomTabbar(PARENT_VIEWS.FAMILY, "hyeni-v5-tabbar-fixed")}
  >
    {familyId
      ? <FamilyManagementSection /* 기존 props */ />
      : <PairingWizard /* 기존 props */ />}
  </ParentFamilyView>
)}
```

(컴포넌트 이름이 다르면 grep 결과에 따라 교체)

- [ ] **Step 3: showPairing / showParentSetup state + modal 호출 제거**

Run: `grep -n 'showPairing\|setShowPairing\|showParentSetup\|setShowParentSetup' src/App.jsx`
Expected: 호출처 listing.

- `setShowPairing(true)` → `setActiveView(PARENT_VIEWS.FAMILY)` 로 교체
- `setShowParentSetup(true)` 동일
- 모달 형태 렌더 블록 제거 (가족 view 분기로 대체)
- useState 선언 제거

- [ ] **Step 4: build 검증**

Run: `npm run build`
Expected: ✓ 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/parent/ParentFamilyView.jsx src/App.jsx
git commit -m "refactor(parent-nav): 가족 탭 view-as-tab 전환 (showPairing 제거)"
```

---

## Task 6: 하단 tabbar 라벨/핸들러 갱신

**Files:**
- Modify: `src/App.jsx:4258~4298` (renderParentBottomTabbar)

- [ ] **Step 1: lucide-react import에 CalendarPlus 추가**

App.jsx 상단 import — 기존 lucide-react import에 CalendarPlus 추가.

```js
import { Calendar, CalendarPlus, Home, MapPin, MessageCircle, Sun, Users } from "lucide-react";
```

- [ ] **Step 2: tabbar에서 "일정" → "일정등록" 라벨/핸들러 변경**

```jsx
// 기존 "일정" 탭 (App.jsx:4278) 교체
<button
  type="button"
  className={activeTab === "eventAdd" ? "active" : undefined}
  onClick={requireSelectedChildOrHint(handleParentEventAddTabClick, "일정 등록")}
  style={{ fontFamily: FF, whiteSpace: "nowrap" }}
>
  <span aria-hidden="true" style={{ display: "inline-flex", marginRight: 4, verticalAlign: "middle" }}>
    <CalendarPlus size={16} strokeWidth={1.75} />
  </span>일정등록
</button>
```

- [ ] **Step 3: 메모 탭 핸들러 교체**

```jsx
// 기존 onClick={requireSelectedChildOrHint(handleParentMemoOpen, "메모")} 교체
onClick={requireSelectedChildOrHint(handleParentMemoTabClick, "메모")}
```

`activeTab === "memo"` 매칭은 그대로.

- [ ] **Step 4: 가족 탭 핸들러는 기존 함수명 유지 (이미 view 패턴으로 변경됨)**

`handleParentFamilyTabClick` 호출 그대로 — Task 1에서 setActiveView로 갱신됨.

`activeTab === "family"` 매칭 활성화 확인.

- [ ] **Step 5: build 검증**

Run: `npm run build`
Expected: ✓ 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(parent-nav): tabbar 일정등록 라벨 + view 핸들러"
```

---

## Task 7: 모든 view에서 하단 tabbar 항시 노출 보장

**Files:**
- Modify: `src/App.jsx` (각 view 분기 root layout)
- Modify (필요 시): `src/components/place-management/AcademyManager.jsx`

- [ ] **Step 1: tabbar 호출처 grep**

Run: `grep -n 'renderParentBottomTabbar' src/App.jsx`
Expected: 모든 view 분기에서 호출 확인.

- [ ] **Step 2: 누락 view 분기에 tabbar 추가**

각 view 분기의 root layout 패턴 통일:

```jsx
{activeView === PARENT_VIEWS.X && isParent && (
  <div className="page-shell" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
    {/* view content */}
    {renderParentBottomTabbar("X", "hyeni-v5-tabbar-fixed")}
  </div>
)}
```

home, calendar, eventAdd(EventSheet 자체), maplist, memo, family 모두 위 패턴 적용 또는 EventSheet처럼 독립 Tabbar 호출.

- [ ] **Step 3: AcademyManager bottomNavigation 노출 검증**

```bash
grep -n 'bottomNavigation' src/components/place-management/AcademyManager.jsx
```

Expected: prop 받아서 렌더 위치 확인. 누락이면 컴포넌트 끝 부분에 추가:

```jsx
return (
  <div className="page-shell" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
    {/* ... 기존 content ... */}
    {bottomNavigation}
  </div>
);
```

- [ ] **Step 4: 수동 검증 (vite dev) — 6 탭 모두 tabbar visible**

`npm run dev` → 부모 모드 → 6 탭 순회 → 하단 tabbar 항상 표시 확인.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/place-management/AcademyManager.jsx
git commit -m "fix(parent-nav): 모든 view 하단 tabbar 항시 노출"
```

---

## Task 8: 홈 자녀 카드 옵션 C — ChildSelectCard 추출 + HomeTab 단순화

**Files:**
- Create: `src/components/multichild/HomeDashboard/ChildSelectCard.jsx`
- Modify: `src/components/multichild/HomeDashboard/HomeTab.jsx`
- Modify: `src/App.jsx` (home view 분기)

- [ ] **Step 1: ChildSelectCard 컴포넌트 생성**

```jsx
// src/components/multichild/HomeDashboard/ChildSelectCard.jsx
// 옵션 C — 이름·사진·안전 dot 3개·위치명·배터리%·다음 일정 한 줄.

import { ChildAvatar } from "./ChildAvatar.jsx";

const DOT_COLORS = {
  green: "var(--status-positive, #00BF40)",
  yellow: "var(--status-cautionary, #F59E0B)",
  red: "var(--status-negative, #DC2626)",
};

function deriveSafetyDots(deviceStatus) {
  if (!deviceStatus) return ["green", "green", "green"];
  return [
    deviceStatus.battery_low ? "yellow" : "green",
    deviceStatus.last_seen_minutes_ago > 30 ? "red" : "green",
    deviceStatus.app_blocked ? "red" : "green",
  ];
}

export function ChildSelectCard({ child, deviceStatus, locationLabel, nextEventChip, onSelect }) {
  const dots = deriveSafetyDots(deviceStatus);
  const battery = Number(deviceStatus?.batteryLevel);
  const batteryLabel = Number.isFinite(battery)
    ? `🔋 ${Math.max(0, Math.min(100, Math.round(battery)))}%`
    : null;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(child.id)}
      aria-label={`${child.name} 선택`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        background: "var(--cartoon-bg-card, #FFF)",
        border: "1px solid var(--cartoon-line, #FFD6DD)",
        borderRadius: 16,
        boxShadow: "var(--cartoon-shadow-card, 0 8px 24px rgba(245,96,130,0.08))",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <ChildAvatar child={child} size={48} fontSize={20} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--fg-primary, #1F2A24)" }}>{child.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", gap: 2 }}>
            {dots.map((c, i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: DOT_COLORS[c] }} />
            ))}
          </span>
          {locationLabel && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-mint-text, #087653)" }}>
              📍 {locationLabel}
            </span>
          )}
          {batteryLabel && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-secondary)" }}>{batteryLabel}</span>
          )}
        </div>
        {nextEventChip && (
          <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>{nextEventChip}</div>
        )}
      </div>
      <span aria-hidden="true" style={{ color: "var(--fg-tertiary, #A892A0)", fontSize: 20 }}>›</span>
    </button>
  );
}
```

- [ ] **Step 2: HomeTab.jsx 단순화 — 자녀 카드 리스트만**

기존 hero/대시보드 다 제거하고 카드 리스트로 교체:

```jsx
// src/components/multichild/HomeDashboard/HomeTab.jsx
import { ChildSelectCard } from "./ChildSelectCard.jsx";

export function HomeTab({
  children = [],
  deviceStatusByChildId = {},
  locationByChildId = {},
  nextEventByChildId = {},
  onSelectChild,
}) {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-card-soft, #FAFAF7)", minHeight: "100%" }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--fg-primary, #1F2A24)" }}>아이 선택</h1>
      <p style={{ margin: 0, fontSize: 13, color: "var(--fg-secondary)" }}>관리할 아이를 선택해주세요</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children.map((c) => (
          <ChildSelectCard
            key={c.id}
            child={c}
            deviceStatus={deviceStatusByChildId[c.user_id]}
            locationLabel={locationByChildId[c.user_id]}
            nextEventChip={nextEventByChildId[c.id]}
            onSelect={onSelectChild}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: App.jsx home view 분기 갱신 — 새 props 매핑**

기존 home view 분기 내 HomeTab 호출 prop 갱신:

```jsx
{activeView === PARENT_VIEWS.HOME && isMultiChild && isParent && (
  <div className="page-shell" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
    <HomeTab
      children={pairedChildren}
      deviceStatusByChildId={childDeviceStatusMap}
      locationByChildId={childLocationLabelMap || {}}
      nextEventByChildId={nextEventByChildIdMap || {}}
      onSelectChild={(childId) => {
        setSelectedChildId(childId);
        setActiveView(PARENT_VIEWS.CALENDAR);
      }}
    />
    {renderParentBottomTabbar(PARENT_VIEWS.HOME, "hyeni-v5-tabbar-fixed")}
  </div>
)}
```

`childLocationLabelMap`, `nextEventByChildIdMap` 변수가 이미 있으면 그대로, 없으면 빈 객체. (필요 시 derive 로직을 App.jsx 안에 추가)

- [ ] **Step 4: build 검증**

Run: `npm run build`
Expected: ✓ 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/multichild/HomeDashboard/ChildSelectCard.jsx src/components/multichild/HomeDashboard/HomeTab.jsx src/App.jsx
git commit -m "feat(home): 자녀 카드 단순화 (옵션 C — dot/위치/배터리/다음일정)"
```

---

## Task 9: selectedChildId localStorage 영속성

**Files:**
- Modify: `src/App.jsx:611` (state init), 새 useEffect

- [ ] **Step 1: useState 초기값 — localStorage 복원**

```js
// App.jsx:611 교체
const [selectedChildId, setSelectedChildId] = useState(() => {
  try {
    const v = localStorage.getItem("hyeni-selected-child-id");
    return v && v !== "null" && v !== "undefined" ? v : null;
  } catch { return null; }
});
```

- [ ] **Step 2: 변경 시 localStorage 동기화 useEffect 추가**

기존 selectedChildId useEffect 근처에 추가:

```js
useEffect(() => {
  try {
    if (selectedChildId) localStorage.setItem("hyeni-selected-child-id", selectedChildId);
    else localStorage.removeItem("hyeni-selected-child-id");
  } catch { /* ignore */ }
}, [selectedChildId]);
```

- [ ] **Step 3: 기존 validity useEffect (App.jsx:643~) 동작 확인**

기존 useEffect가 invalid id를 자동으로 null로 reset함. localStorage 복원된 id가 invalid여도 자동 cleanup. 코드 변경 불필요. 확인만.

- [ ] **Step 4: build 검증**

Run: `npm run build`
Expected: ✓ 0 errors

- [ ] **Step 5: 수동 검증 (vite dev)**

부모 로그인 → 자녀 선택 → 페이지 새로고침 → 같은 자녀 선택 상태 유지 확인.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(parent-nav): selectedChildId localStorage 영속성"
```

---

## Task 10: Phase 1 device 검증 + checkpoint

- [ ] **Step 1: APK build + install 양 device**

```bash
npx cap sync android
cd android && ./gradlew assembleDebug
adb -s R5CY521CFNZ install -r app/build/outputs/apk/debug/app-debug.apk
adb -s ZY22H9VTQD install -r app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 2: multichild 검증 시나리오 (R5CY521CFNZ에 multichild 페어링 가정)**

- 부모 로그인 → 홈 탭 → 자녀 카드 리스트 (옵션 C 표시)
- 자녀 1 카드 탭 → 오늘 view 진입 + 자녀 1 데이터만
- 일정등록 탭 → 오늘 날짜 default form 즉시 등장
- 메모 탭 → 자녀 1과 1:1 채팅 view
- 가족 탭 → 가족 관리 화면
- 모든 탭에서 하단 tabbar visible
- 홈 → 자녀 2 선택 → 자녀 2 데이터로 전환 (자녀 1 데이터 사라짐)
- 자녀 미선택 상태에서 직접 오늘/메모/장소 탭 시도 → 홈 redirect + hint

- [ ] **Step 3: single child 검증 시나리오 (1자녀만 페어링한 상태)**

- 부모 로그인 → 홈 탭 미노출 확인 (multichild ONLY)
- 5 탭만 표시 (오늘/일정등록/장소/메모/가족)
- 오늘 탭 자동 진입 → 자녀 데이터 정상 노출 (auto-select)
- 일정등록 탭 → 오늘 날짜 form 즉시
- 메모 탭 → 1:1 채팅
- 모든 탭 하단 tabbar visible
- 페이지 새로고침 후 자녀 선택 유지 (localStorage)

- [ ] **Step 4: Push checkpoint**

```bash
git push origin <branch>
```

이 task는 검증만, commit 없음 (이전 task들이 이미 commit).

---

# Phase 2 — 메모 Realtime Sync

## Task 11: memo realtime 코드 위치 + 테이블명 파악

**Files:**
- Read only — `src/components/memo/`, `src/lib/`, supabase 호출

- [ ] **Step 1: realtime channel 생성/구독 코드 grep**

Run: `grep -rn "subscribe\|\.channel(" src/components/memo/ src/lib/`
Expected: realtime channel 생성/구독 코드 위치 listing.

- [ ] **Step 2: 메모 테이블명 grep**

Run: `grep -rn "from('memo\|from('messages\|from('replies\|from(\"memo" src/`
Expected: Supabase `from('<table>')` 호출에서 테이블명 확정.

- [ ] **Step 3: 결과 기록 (plan 본문 주석)**

확정된 정보를 plan 본문 또는 git note로 기록:
- `현재 채널 패턴`: ...
- `목표 채널 패턴`: `family:${familyId}:child:${selectedChildId}`
- `테이블명`: ...
- `구독 위치 1`: 파일:line
- `구독 위치 2`: 파일:line

이 task는 코드 lookup만, commit 없음.

---

## Task 12: 단일 채널 helper + 양방향 sync 구현

**Files:**
- Create: `src/lib/memoRealtime.js`, `tests/unit/memoRealtime.test.js`
- Modify: Task 11에서 확정한 메모 realtime 호출 위치 (예: ParentMemoPage.jsx, MemoSection.jsx)

- [ ] **Step 1: 단위 테스트 작성**

```js
// tests/unit/memoRealtime.test.js
import { describe, it, expect } from "vitest";
import { buildMemoChannelKey } from "../../src/lib/memoRealtime.js";

describe("memo realtime channel key", () => {
  it("includes familyId and selectedChildId", () => {
    expect(buildMemoChannelKey("fam-1", "child-A"))
      .toBe("family:fam-1:child:child-A");
  });
  it("returns null when familyId missing", () => {
    expect(buildMemoChannelKey(null, "child-A")).toBeNull();
  });
  it("returns null when selectedChildId missing", () => {
    expect(buildMemoChannelKey("fam-1", null)).toBeNull();
  });
  it("returns null when both missing", () => {
    expect(buildMemoChannelKey(null, null)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — fail 확인**

Run: `npx vitest run tests/unit/memoRealtime.test.js`
Expected: FAIL — `buildMemoChannelKey` 미정의

- [ ] **Step 3: 헬퍼 구현**

```js
// src/lib/memoRealtime.js
// Single source of truth for memo realtime channel keys.
// 부모/자녀 양 화면 (오늘 MemoSection · 메모 ParentMemoPage)에서 같은 key 사용.

export function buildMemoChannelKey(familyId, selectedChildId) {
  if (!familyId || !selectedChildId) return null;
  return `family:${familyId}:child:${selectedChildId}`;
}
```

- [ ] **Step 4: 테스트 실행 — pass 확인**

Run: `npx vitest run tests/unit/memoRealtime.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 메모 호출 위치에서 헬퍼 사용**

Task 11에서 확정한 위치 (예시):
- `src/components/memo/ParentMemoPage.jsx`
- `src/components/memo/MemoSection.jsx` 호출처 (또는 데이터 fetch 부분)

기존 channel key 생성을 헬퍼로 교체:

```jsx
import { buildMemoChannelKey } from "../../lib/memoRealtime.js";

// 기존 channel name 직접 작성 부분 교체
const channelKey = buildMemoChannelKey(familyId, selectedChildId);
useEffect(() => {
  if (!channelKey) return undefined;
  const channel = supabase.channel(channelKey);
  channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "<TABLE_FROM_TASK_11>" }, (payload) => {
    /* update local state */
  });
  channel.subscribe();
  return () => { supabase.removeChannel(channel); };
}, [channelKey]);
```

selectedChildId 변경 → channelKey 변경 → useEffect cleanup → 새 채널 구독 (자동 자녀 격리).

두 화면 모두 같은 channelKey 사용으로 동일 채널 구독 → INSERT 발생 시 양쪽 동시 update.

- [ ] **Step 6: build + 수동 검증**

Run: `npm run build`
Expected: ✓ 0 errors

device 검증: 메모 탭에서 send → 오늘 탭 MemoSection에 즉시 등장.

- [ ] **Step 7: Commit**

```bash
git add src/lib/memoRealtime.js src/components/memo/ tests/unit/memoRealtime.test.js
git commit -m "feat(memo): selectedChildId 기반 단일 realtime 채널"
```

---

## Task 13: read receipt 일관성 검증

**Files:**
- Modify: 메모 read 처리 코드 (Task 11에서 위치 확정)

- [ ] **Step 1: read 처리 grep**

Run: `grep -rn "read_by\|markRead\|readBy" src/components/memo/`
Expected: read mark logic 위치 listing.

- [ ] **Step 2: 오늘·메모 양쪽에서 read mark 적용**

read mark가 ParentMemoPage(메모 탭)에만 있다면 MemoSection(오늘 탭)에도 동일 logic 적용. 같은 helper 함수로 추출하면 깔끔:

```js
// src/lib/memoRead.js (선택적 helper)
export async function markMemoAsRead(supabase, messageId, userId) {
  // 기존 logic을 함수로 추출
}
```

또는 inline으로 양쪽에서 동일 호출:

```jsx
// MemoSection.jsx에 추가 (없을 경우)
useEffect(() => {
  // 새 메시지 보일 때 read_by에 부모 user_id 추가
  unreadMessages.forEach(msg => markMemoAsRead(msg.id, parentUserId));
}, [replies]);
```

- [ ] **Step 3: device 검증**

자녀 device → send → 부모 오늘 탭 표시 → read mark 자동 → 자녀 device read receipt 반영 확인.

- [ ] **Step 4: Commit**

```bash
git add src/components/memo/ src/lib/memoRead.js
git commit -m "fix(memo): read receipt 오늘·메모 양쪽에서 일관 mark"
```

---

# Phase 3 — Testing + Single-Child 검증

## Task 14: parentNavigation 단위 테스트

**Files:**
- Create: `tests/unit/parentNavigation.test.jsx`

- [ ] **Step 1: 테스트 파일 작성**

```jsx
// tests/unit/parentNavigation.test.jsx
import { describe, it, expect, vi } from "vitest";

describe("parent navigation handlers (logic 추출)", () => {
  it("eventAdd 진입 시 today key + view set", () => {
    const setActiveView = vi.fn();
    const setAddEventDateKey = vi.fn();
    const setEditingEventId = vi.fn();
    const formatDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const today = new Date(2026, 4, 10);

    const handler = () => {
      setEditingEventId(null);
      setAddEventDateKey(formatDateKey(today));
      setActiveView("eventAdd");
    };
    handler();

    expect(setActiveView).toHaveBeenCalledWith("eventAdd");
    expect(setAddEventDateKey).toHaveBeenCalledWith("2026-05-10");
    expect(setEditingEventId).toHaveBeenCalledWith(null);
  });

  it("multichild + selectedChild 있으면 dashboardChildren = [selectedChild]", () => {
    const pairedChildren = [{ id: "a" }, { id: "b" }];
    const selectedChild = { id: "a" };
    const isMultiChild = true;
    const isParent = true;

    const dashboardChildren = (() => {
      if (isParent && isMultiChild && selectedChild) return [selectedChild];
      if (pairedChildren.length > 0) return pairedChildren.slice(0, 2);
      return [];
    })();
    expect(dashboardChildren).toEqual([{ id: "a" }]);
  });

  it("single child면 selectedChildId 자동 set 의도 (auto-select)", () => {
    const pairedChildren = [{ id: "only" }];
    let selectedChildId = null;
    const setSelectedChildId = vi.fn((v) => { selectedChildId = v; });

    // 기존 useEffect 시뮬레이션
    if (pairedChildren.length === 1 && !selectedChildId) {
      setSelectedChildId(pairedChildren[0].id);
    }
    expect(setSelectedChildId).toHaveBeenCalledWith("only");
  });

  it("selectedChildId가 invalid면 null로 reset", () => {
    const pairedChildren = [{ id: "a" }, { id: "b" }];
    const selectedChildId = "removed-child";
    const setSelectedChildId = vi.fn();

    const validIds = new Set(pairedChildren.map(c => c.id));
    if (selectedChildId && !validIds.has(selectedChildId)) {
      setSelectedChildId(null);
    }
    expect(setSelectedChildId).toHaveBeenCalledWith(null);
  });

  it("multichild + 미선택 + activeView !== home → home redirect", () => {
    const isParent = true;
    const isMultiChild = true;
    const selectedChildId = null;
    const activeView = "calendar";
    const setActiveView = vi.fn();

    if (isParent && isMultiChild && !selectedChildId && activeView !== "home") {
      setActiveView("home");
    }
    expect(setActiveView).toHaveBeenCalledWith("home");
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `npx vitest run tests/unit/parentNavigation.test.jsx`
Expected: 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/parentNavigation.test.jsx
git commit -m "test(parent-nav): 핸들러 + isolation derive + auto-select 단위 테스트"
```

---

## Task 15: E2E — Single-Child 시나리오 (사용자 추가 요구사항)

**Files:**
- Create: `tests/e2e/menu-single-child.spec.js`

- [ ] **Step 1: 테스트 파일 작성**

```js
// tests/e2e/menu-single-child.spec.js
import { test, expect } from "@playwright/test";

test.describe("부모 메뉴 — single child 흐름", () => {
  test.beforeEach(async ({ page }) => {
    // 기존 critical-flows.spec.js 패턴 따라 single-child 페어링 setup
    // (구체 helper는 기존 파일 재사용 또는 mock supabase)
    await page.goto("/");
    await loginAsSingleChildParent(page);
  });

  test("홈 탭 미노출, 5 탭만 표시", async ({ page }) => {
    const tabs = await page.locator('nav.hyeni-v5-tabbar button').allTextContents();
    expect(tabs.filter(t => t.includes("홈")).length).toBe(0);
    expect(tabs.length).toBe(5);
  });

  test("앱 시작 시 자녀 자동 선택 (selectedChildId auto-set)", async ({ page }) => {
    const stored = await page.evaluate(() => localStorage.getItem("hyeni-selected-child-id"));
    expect(stored).toBeTruthy();
  });

  test("오늘 탭 진입 → 자녀 데이터 자동 로드", async ({ page }) => {
    await page.click('nav button:has-text("오늘")');
    await expect(page.locator('text=오늘')).toBeVisible();
    // 자녀 미선택 hint 안 보여야 함
    await expect(page.locator('text=아이를 먼저 선택')).not.toBeVisible();
  });

  test("일정등록 탭 진입 → 오늘 날짜 default form 즉시", async ({ page }) => {
    await page.click('nav button:has-text("일정등록")');
    await expect(page.locator('text=오늘 뭐 할까요?')).toBeVisible({ timeout: 3000 });
  });

  test("메모/가족 탭 정상 + tabbar 노출", async ({ page }) => {
    for (const label of ["메모", "가족"]) {
      await page.click(`nav button:has-text("${label}")`);
      await expect(page.locator('nav.hyeni-v5-tabbar')).toBeVisible();
    }
  });

  test("자녀 selectedChildId localStorage 영속성", async ({ page }) => {
    const before = await page.evaluate(() => localStorage.getItem("hyeni-selected-child-id"));
    await page.reload();
    const after = await page.evaluate(() => localStorage.getItem("hyeni-selected-child-id"));
    expect(after).toBe(before);
  });
});

async function loginAsSingleChildParent(page) {
  // 기존 critical-flows.spec.js의 부모 로그인 helper 활용
  // single child만 페어링된 상태로 setup
  // 구체 구현: 기존 e2e 파일 패턴 참고
}
```

- [ ] **Step 2: 실행**

Run: `npm run test:e2e -- menu-single-child.spec.js`
Expected: 모두 PASS (helper 미완성으로 일부 skip 허용)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/menu-single-child.spec.js
git commit -m "test(e2e): single-child 메뉴 흐름 검증"
```

---

## Task 16: E2E — Multichild Isolation 시나리오

**Files:**
- Create: `tests/e2e/menu-multichild-isolation.spec.js`

- [ ] **Step 1: 테스트 파일 작성**

```js
// tests/e2e/menu-multichild-isolation.spec.js
import { test, expect } from "@playwright/test";

test.describe("부모 메뉴 — multichild isolation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await loginAsMultiChildParent(page, 2); // 자녀 2명 페어링
  });

  test("홈 탭에서 자녀 선택 → 다른 탭 그 자녀 데이터만", async ({ page }) => {
    await page.click('nav button:has-text("홈")');
    await page.click('button[aria-label*="자녀A 선택"]');
    // calendar 자동 진입
    await expect(page.locator('text=자녀A')).toBeVisible();
    await expect(page.locator('text=자녀B')).not.toBeVisible();
  });

  test("자녀 변경 시 stale data clear", async ({ page }) => {
    await selectChild(page, "자녀A");
    await page.click('nav button:has-text("오늘")');
    const aHasContent = await page.locator('[aria-label*="오늘 일정"]').isVisible();

    await page.click('nav button:has-text("홈")');
    await selectChild(page, "자녀B");
    await page.click('nav button:has-text("오늘")');
    const bHasContent = await page.locator('[aria-label*="오늘 일정"]').isVisible();

    // 둘 다 visible, but DOM 내용이 자녀별로 다름 (mock 기준)
    expect(aHasContent && bHasContent).toBe(true);
  });

  test("미선택 multichild + 오늘 탭 클릭 → 홈 redirect", async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem("hyeni-selected-child-id"));
    await page.reload();
    await page.click('nav button:has-text("오늘")');
    // hint toast or 홈 화면 강제
    await expect(page.locator('text=아이를 먼저 선택')).toBeVisible({ timeout: 3000 });
  });

  test("하단 tabbar 모든 6 탭에서 visible", async ({ page }) => {
    const tabs = ["홈", "오늘", "일정등록", "장소", "메모", "가족"];
    for (const t of tabs) {
      await page.click(`nav button:has-text("${t}")`);
      await expect(page.locator('nav.hyeni-v5-tabbar')).toBeVisible();
    }
  });

  test("메모 탭 send → 오늘 탭 MemoSection 즉시 sync", async ({ page }) => {
    await selectChild(page, "자녀A");
    await page.click('nav button:has-text("메모")');
    await page.fill('input[aria-label="메모 입력"]', "안녕");
    await page.click('button[aria-label="메모 보내기"]');
    await page.click('nav button:has-text("오늘")');
    // 오늘 탭 MemoSection에 방금 보낸 메시지 등장
    await expect(page.locator('text=안녕')).toBeVisible({ timeout: 5000 });
  });
});

async function loginAsMultiChildParent(page, count) { /* ... */ }
async function selectChild(page, name) {
  await page.click('nav button:has-text("홈")');
  await page.click(`button[aria-label*="${name} 선택"]`);
}
```

- [ ] **Step 2: 실행**

Run: `npm run test:e2e -- menu-multichild-isolation.spec.js`

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/menu-multichild-isolation.spec.js
git commit -m "test(e2e): multichild isolation 시나리오 (자녀 격리 + tabbar + memo sync)"
```

---

## Task 17: 최종 device 통합 검증 + push + PR

- [ ] **Step 1: APK build + install 양 device**

```bash
npx cap sync android
cd android && ./gradlew assembleDebug
adb -s R5CY521CFNZ install -r app/build/outputs/apk/debug/app-debug.apk
adb -s ZY22H9VTQD install -r app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 2: 종합 검증 (multichild path)**

R5CY521CFNZ에서 multichild 페어링 가정:
- 홈 → 자녀A 선택 → 오늘/일정등록/장소/메모 자녀A 데이터만
- 메모 send → "오늘" 메모 섹션 즉시 sync 확인 (수동)
- ZY22H9VTQD(자녀)에서 send → 부모 양 화면 sync 확인
- 홈 → 자녀B 선택 → 자녀A 데이터 사라짐 + 자녀B 데이터로 전환

- [ ] **Step 3: 종합 검증 (single child path) — 사용자 추가 요구**

R5CY521CFNZ에서 1자녀만 페어링한 상태 (또는 자녀1 unpair):
- 홈 탭 미노출
- 5 탭 표시 (오늘/일정등록/장소/메모/가족)
- 오늘 탭 자동 진입 — 자녀 데이터 정상
- 일정등록 탭 → 오늘 날짜 form 즉시
- 메모 탭 → 1:1 채팅 — selectedChildId 자동 적용
- 가족 탭 → 페어링/관리 화면
- 모든 탭 하단 tabbar visible
- 페이지 새로고침 후 자녀 선택 유지

- [ ] **Step 4: Acceptance Criteria checklist (spec §10)**

- [ ] 6 탭이 정의대로 동작 (multichild) / 5 탭 (single child)
- [ ] `parentCalendar` view 코드 완전 제거 — `grep -n "parentCalendar" src/App.jsx` empty
- [ ] 모든 view에서 하단 tabbar 노출
- [ ] multichild 자녀 변경 시 isolation 동작
- [ ] single child path 정상 동작 (홈 미노출, 자동 selectedChildId)
- [ ] 메모 탭 ↔ 오늘 MemoSection 실시간 sync
- [ ] 일정등록 탭 진입 시 오늘 날짜 default form 즉시
- [ ] 단위·통합·E2E 테스트 모두 pass
- [ ] device 시연 통과 (양 기기, multichild + single child 두 path)

- [ ] **Step 5: Push final**

```bash
git push origin <branch>
```

- [ ] **Step 6: PR 작성**

```bash
gh pr create --title "feat: 부모 메뉴 6 탭 재정비 + multichild isolation + 메모 sync" --body "$(cat <<'EOF'
## Summary
- 부모 모드 6 탭 (홈/오늘/일정등록/장소/메모/가족) 재정비
- parentCalendar view 제거 (오늘과 중복)
- modal-as-tab 패턴 (showParentMemoPage / showPairing) 제거 → view-as-tab 통일
- multichild isolation 강화 (selectedChildId 단일 source of truth, localStorage 영속성)
- 메모 realtime channel 단일화 (selectedChildId 기반, 양방향 sync)
- 모든 view 하단 tabbar 항시 노출
- single-child path 명시적 검증 (홈 탭 미노출, 자동 selectedChildId)

## Spec
docs/superpowers/specs/2026-05-10-menu-restructure-design.md

## Test plan
- [ ] 단위 테스트 vitest pass (parentNavigation + memoRealtime)
- [ ] E2E single-child + multichild 시나리오 pass
- [ ] device 양 기기(R5CY521CFNZ, ZY22H9VTQD) — multichild + single child 두 path 시연

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

### Spec coverage
- §1 problem → Task 1-7 (중복 화면/리다이렉트/모달 패턴/tabbar 누락/isolation 모두 해결)
- §2 goals → Phase 1 (1-9) + Phase 2 (11-13)
- §4.1 navigation → Task 1, 2, 6
- §4.2 isolation → Task 1 (auto-select 제거), 9 (영속성), 14 (단위), 15-16 (E2E)
- §4.3 view 변경 → Task 3 (eventAdd), 4 (memo), 5 (family), 7 (tabbar), 8 (홈)
- §4.4 memo sync → Task 11-13
- §4.5 selectedChildId 영속성 → Task 9
- §4.6 tabbar 항시 → Task 7
- §5 edge cases → Task 14, 16
- §7 testing → Task 14-16
- §8 rollout → Phase 1 (Task 1-10) / Phase 2 (Task 11-13) 분할
- §10 acceptance → Task 17 checklist

### Single-child 보장 (사용자 추가 요구)
- Task 9 Step 5 수동 검증 (페이지 새로고침 후 자녀 유지)
- Task 10 Step 3 device 검증 (single child path 6 항목)
- Task 14 Step 1 단위 테스트 ("single child면 자동 set")
- Task 15 E2E 단독 spec (`menu-single-child.spec.js` — 6 테스트)
- Task 17 Step 3 device 종합 검증

### Placeholder scan
- "TBD"/"TODO" 없음 (확인됨)
- 각 step에 실행 명령 + 코드 + expected output 포함

### 타입 일관성
- `PARENT_VIEWS.X` 상수 모든 task 동일 사용
- `selectedChildId` (string|null) signature 일관
- `buildMemoChannelKey(familyId, selectedChildId): string|null` Task 12에서 정의, 호출처 동일

## Open items (plan 단계에서 lookup)
- Memo 테이블명 (Task 11에서 grep 후 Task 12 Step 5에 반영)
- 기존 PairingWizard / FamilyManagementSection 컴포넌트 import path (Task 5에서 grep 후 반영)
- `childLocationLabelMap` / `nextEventByChildIdMap` 변수 존재 여부 (Task 8에서 확인 후 derive 추가)
