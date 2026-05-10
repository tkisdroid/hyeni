# 부모 메뉴 구조 재정비 — Design

**Date**: 2026-05-10
**Status**: design 승인 완료, plan 단계 대기
**Branch (예정)**: `fix/multichild-isolation` 연속 또는 신규 `feat/menu-restructure`

## 1. Problem

현재 부모 모드 하단 메뉴(6개 탭)가 다음 문제를 가짐:

1. **중복 화면** — "홈"·"오늘"·"일정" 3개 탭이 모두 자녀 + 일정 정보를 보여줘 사용자 혼선
2. **사용 안 되는/리다이렉트 view** — `parentCalendar` view (= "일정" 탭)가 "오늘"과 거의 동일
3. **흐름 불일치** — "메모"·"가족" 탭은 modal flag(`showParentMemoPage`, `showPairing`)로 동작, 다른 탭은 `activeView` 변경. 행동 패턴이 둘로 갈림
4. **Tabbar 누락** — 일부 modal/sheet 화면에서 하단 탭바가 가려져 navigation 끊김
5. **multichild 데이터 혼선** — 홈에서 자녀를 선택해도 다른 화면에서 다른 자녀 데이터가 섞일 위험 (이번 fix branch의 핵심 동기)

## 2. Goals

- 6개 탭 각각 단일·명확한 책임
- 홈에서 선택한 자녀의 데이터만 다른 모든 탭에 노출 (multichild isolation)
- 모든 view에서 하단 tabbar 항시 노출
- modal-as-tab 패턴 제거, view-as-tab으로 통일
- 기존 자녀 모드 화면은 영향 없음

## 3. Non-Goals

- 자녀 모드 화면 재구성 (별도 작업)
- 캘린더 인터랙션 자체 변경 (현재 동작 유지)
- 메모 storage 스키마 변경 (기존 활용)
- 단일 자녀 가정의 흐름 변경 (현재 잘 작동)

## 4. Design

### 4.1 Navigation Structure

| 순서 | 탭 | activeView | 조건 | 진입 시 동작 |
|---|---|---|---|---|
| 1 | 🏠 홈 | `home` | multichild ONLY | 자녀 카드 리스트 (선택 hub) |
| 2 | ☀️ 오늘 | `calendar` | 항상 | 오늘 일정·상태·메모 (selectedChild 1명) |
| 3 | 📝 일정등록 | `eventAdd` (신규) | 항상 | 오늘 날짜 default form 즉시 |
| 4 | 📍 장소 | `maplist` | `parentCapabilities.canManagePlaces` | 장소 관리 |
| 5 | 💬 메모 | `memo` (신규) | 항상 | selectedChild와 1:1 채팅 (full screen) |
| 6 | 👨‍👩‍👧 가족 | `family` (신규) | 항상 | 페어링/관리 화면 |

#### 제거 대상

- `parentCalendar` view 분기 (`activeView === "parentCalendar"`)
- `handleParentCalendarTabClick` 핸들러
- `showParentMemoPage` state + 관련 분기
- `showPairing`/`showParentSetup` modal-as-tab 패턴 (가족 view로 통합)

### 4.2 Multichild Isolation Rule (CRITICAL)

**`selectedChildId`** = 모든 per-child 데이터의 single source of truth.

| 데이터 | 격리 규칙 |
|---|---|
| `events` | `event.child_ids.includes(selectedChildId)` 또는 `event.is_family_event === true` |
| `dashboardChildren` (위치/배터리/안전) | multichild + 미선택 시 `[]` (홈으로 강제), 선택 시 `[selectedChild]` |
| `memo replies` | `child_id = selectedChildId` 만 query |
| 장소(학원/안전/위험) | `child_user_id = selectedChildId` 만 |
| Realtime channel | `family:{familyId}:child:{selectedChildId}` 단일 |

자녀 미선택 multichild + 오늘/일정등록/장소/메모 탭 클릭 → `setActiveView("home")` redirect + hint toast.

자녀 변경 (`selectedChildId` 변경) 시 useEffect로 모든 stale state cleanup:
- events 재query
- memo realtime 재구독
- 장소 리스트 재로드
- device status 새로고침
- 진행 중 일정등록 form 확인 prompt

### 4.3 View별 변경

#### 홈 (`activeView === "home"`)

- 현재: `TodayMultiChildView` + 가족 대시보드 (다양한 정보)
- 변경: **자녀 카드 리스트만**
- 카드 콘텐츠 (옵션 C — 풍부): 이름·사진·안전 dot 3개·위치명·배터리%·다음 일정 한 줄
- 카드 탭 → `setSelectedChildId(child.id)` + `setActiveView("calendar")`

#### 오늘 (`activeView === "calendar"` + isParent)

- 현재 화면 구조 유지 (헤더 + 캘린더 + 오늘 카드 + 메모 섹션)
- isolation 강화: `dashboardChildren = selectedChild ? [selectedChild] : []`
- multichild + 미선택 → 홈 redirect
- 메모 섹션 = MemoSection (selectedChildId, "메모" 탭과 같은 realtime channel)

#### 일정등록 (`activeView === "eventAdd"` 신규)

- view layer에서 EventSheet 열림
  - `open=true`
  - `addEventDateKey=todayKey`
  - `editingEventId=null`
- form 초기화 (`newTitle`, `newTime`, `newEndTime`, `newLocation`, `selectedPreset` reset)
- 저장 성공 → form clear + `setActiveView("calendar")` 자동 복귀
- 취소/뒤로 → `setActiveView("calendar")`
- 다른 탭 이동 시 isDirty form은 confirm prompt

#### 장소 (`activeView === "maplist"`)

- 동작 유지
- 모달 형식 컴포넌트도 `bottomNavigation` prop으로 tabbar 일관 노출

#### 메모 (`activeView === "memo"` 신규)

- 기존 `ParentMemoPage`를 modal → view로 변환
- selectedChildId 기반 1:1 채팅
- 하단 tabbar 노출 (현재 modal에 가려지던 부분 fix)
- "오늘" MemoSection과 같은 데이터 source — Supabase realtime 양방향 sync

#### 가족 (`activeView === "family"` 신규)

- familyId 유무로 분기
  - `familyId`: 가족 관리 화면 (자녀 추가/제거, 코파런트 초대)
  - `familyId === null`: 페어링 시작 화면
- 하단 tabbar 노출

### 4.4 Memo Realtime Sync

**테이블** (기존 활용): `messages` (또는 `memo_replies`)
- `family_id`, `child_id`, `from_user_id`, `to_user_id`, `body`, `created_at`, `read_by`

**채널 디자인**: `family:{familyId}:child:{selectedChildId}` (단일)
- "오늘" 탭 MemoSection과 "메모" 탭 ParentMemoPage가 동일 채널 구독
- INSERT 발생 → 두 화면 동시 업데이트
- 자녀 앱에서 INSERT → 부모 두 화면 동시 update
- selectedChildId 변경 → unsubscribe 후 새 채널 구독

**read receipt**: `read_by` array. "오늘"·"메모" 어느 쪽에서 조회되든 mark.

**send 실패 처리**: 기존 MemoSection의 send-failure toast UX 재사용.

**연결 끊김**: exponential backoff 재구독, optional 재연결 indicator.

### 4.5 selectedChildId 영속성

- `localStorage.setItem("hyeni-selected-child-id", id)`
- 앱 재시작 시 복원
- 자녀가 family에서 제거되어 invalid → null로 reset (multichild면 홈)

### 4.6 하단 tabbar 항시 노출

```jsx
<div className="page-shell">
  <main>{viewContent}</main>
  {renderParentBottomTabbar(activeTab)}
</div>
```

- modal-as-screen 컴포넌트(장소/메모/가족) → `bottomNavigation` prop 통해 tabbar 포함
- safe-area-inset-bottom 고려해 main padding 조정

## 5. Edge Cases

| 상황 | 동작 |
|---|---|
| multichild + selectedChildId=null + 오늘/일정등록/장소/메모 클릭 | hint + 홈 redirect |
| selectedChildId가 가족에서 제거됨 | localStorage cleanup + null reset, multichild → 홈 |
| 페어링 없는 부모 (familyId=null) | 가족 탭으로 redirect, 다른 탭 disabled + hint |
| 일정등록 dirty form + 다른 탭 클릭 | EventSheet isDirty confirm 재사용 |
| 자녀 변경 직후 form 열려있음 | 자동 close + 새 form |
| 메모 realtime 끊김 | exponential backoff 재구독 |
| 자녀 모드 (isParent=false) | 영향 없음 |

## 6. Error Handling

- Supabase query 에러 → 기존 `showNotif` 패턴, stale data 보존
- localStorage 손상 → null fallback
- realtime duplicate subscription → useEffect cleanup
- 자녀 변경 race condition → effect cleanup token 패턴
- navigation guard 우회 방지 → 모든 view 분기 첫 줄에 `if (multichild && !selectedChild && view !== "home" && view !== "family") return redirect;`

## 7. Testing

### 단위 (vitest)
- 핸들러: `handleParentEventAddTabClick` → activeView/addEventDateKey 정확히 set
- isolation: `dashboardChildren`이 selectedChild만 반환
- `selectedChildId` useEffect → events refetch 트리거

### 통합 (vitest + jsdom)
- 자녀 A 선택 후 자녀 B events 비노출
- 메모 탭 send → 오늘 탭 MemoSection 즉시 반영 (realtime mock)
- 자녀 변경 시 진행 중 form clear

### E2E (Playwright, critical-flows 확장)
- multichild 페어링 → 홈 → A 선택 → 오늘 → 일정 추가 → 메모 send → 홈 → B 선택 → A 데이터 비노출
- 하단 tabbar 6개 view 모두에서 visible
- 자녀 미선택 multichild + 오늘 탭 클릭 → 홈 redirect

### 시각 회귀 (manual)
- 6 탭 active state 일관성
- 홈 카드 (옵션 C) 자녀 수 1·2·3명 레이아웃

## 8. Migration / Rollout

회귀 위험 최소화 위해 **2단계** 분할:

### Phase 1 — Navigation 정리
- `parentCalendar` view 제거
- 메모/가족 view-as-tab 통일
- 하단 tabbar 항시 노출 보장
- isolation guard 강화 (selectedChildId useEffect, redirect)
- 홈 자녀 카드 리스트 단순화 (옵션 C)
- 일정등록 view 신규

### Phase 2 — 메모 채팅 강화
- realtime channel 단일화 (selectedChildId 기반)
- "오늘" MemoSection ↔ "메모" ParentMemoPage 양방향 sync 보강
- read receipt 일관

각 phase 종료 후 device 검증 + commit.

## 9. Open Questions / Future Work

- 가족 단톡 (multichild 모두 한 방) 옵션 — 사용자 피드백 받은 후 추가 검토
- 일정등록 탭에 "이번 주" "다음 주" 같은 빠른 날짜 칩 추가 가능성
- 홈 카드 정렬 우선순위 (안전 위험 자녀 상단 등)

## 10. Acceptance Criteria

- [ ] 6 탭이 정의대로 동작 (홈/오늘/일정등록/장소/메모/가족)
- [ ] `parentCalendar` view 코드 완전 제거
- [ ] 모든 view에서 하단 tabbar 노출 확인
- [ ] multichild 자녀 변경 시 모든 화면 isolation 검증
- [ ] 메모 탭 ↔ 오늘 MemoSection 실시간 sync 동작
- [ ] 일정등록 탭 진입 시 오늘 날짜 default form 즉시 표시
- [ ] 단위·통합·E2E 테스트 작성 + 모두 pass
- [ ] device(R5CY521CFNZ, ZY22H9VTQD) 시연 통과

---

**Next step**: `/superpowers:writing-plans` skill로 implementation plan 작성
