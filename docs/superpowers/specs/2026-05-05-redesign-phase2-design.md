# Phase 2 Design Spec — 부모 모드 Daily 4 화면

> 2026-05-05 · 부모 홈 · 캘린더 그리드 · 일정 모달 · 자녀 상세 · sign-off 대상 문서
> 리서치: `.lazyweb/design-research/redesign-phase2-2026-05-05/report.md`
> 기준 토큰: Phase 1 spec(`2026-05-05-redesign-phase1-design.md`) 토큰 + Wanted DS + 6 카테고리 컬러
> CLAUDE.md hard rules 준수: 토큰만, 4px grid, body 500, stroke-first, dark-mode aware, 핸들러 보존

---

## 1. 범위와 비범위

### IN scope (Phase 2)
- 화면 1: **부모 홈 (HomeTab 재구성)** — big-stat 헤더 + 섹션 위계 재배치 + 자녀 카드 변형
- 화면 2: **캘린더 그리드 (`renderParentCalendarGrid`)** — Cron식 절제, dots → chips, today ring
- 화면 3: **일정 모달 (`openEditEventModal`)** — full-screen → bottom sheet 전환
- 화면 4: **자녀 상세 화면 (신규)** — 안전 dot 헤더 + 지도 trail + 일정 timeline 통합

### OUT of scope (후속 phase)
- 페어링·구독·친구놀이·장소관리 (Phase 4)
- 자녀 모드 화면 (Phase 3)
- Drag-and-drop 일정 이동 (별도 작업)
- Daily morning brief 푸시 (별도 작업, 메모만)

### 보존 (변경 금지)
- 모든 핸들러: `setSelectedDate`, `prevMonth`, `nextMonth`, `openEditEventModal`, `getEvs`, `buildEventPlaceItems`, `formatDashboardTime`
- 6 카테고리 컬러 (`--hyeni-cat-school/sports/hobby/family/friend/other`)
- 6 테마 픽커 (`--theme-accent` 동적 override)
- 자녀 색 코딩 (`color_hex` per child)
- 안전 dots 로직 (`deriveSafetyDots`)
- Kakao Map SDK 통합 (`MiniMap.jsx`)
- Phase 1 토큰 (`--mode-parent-*`, `--mode-child-*`, `--space-screen-*`)

---

## 2. 디자인 토큰 — 신규 추가

### 2.1 타이포그래피 — big-stat
```css
:root {
  /* Phase 2 신규 */
  --t-bigstat-eyebrow-size:   12px;
  --t-bigstat-eyebrow-tracking: 0.06em;
  --t-bigstat-date-size:      28px;
  --t-bigstat-date-weight:    var(--weight-bold);
  --t-bigstat-next-size:      14px;
}

.t-bigstat-eyebrow {
  font-size: var(--t-bigstat-eyebrow-size);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--t-bigstat-eyebrow-tracking);
  color: var(--fg-tertiary);
  text-transform: uppercase;     /* 영문 fallback, 한글은 시각 효과 없음 */
}
.t-bigstat-date {
  font-size: var(--t-bigstat-date-size);
  font-weight: var(--t-bigstat-date-weight);
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
  color: var(--fg-primary);
  margin: 0;
}
.t-bigstat-next {
  font-size: var(--t-bigstat-next-size);
  font-weight: var(--weight-medium);
  color: var(--theme-accent-text);
  margin: var(--space-1) 0 0;
}
.t-bigstat-next-time {
  font-weight: var(--weight-bold);
}
```

### 2.2 캘린더 그리드 — Cron식 절제
```css
:root {
  /* Cell 본체 */
  --cal-cell-min-height:    48px;       /* mobile */
  --cal-cell-padding:       var(--space-2);   /* 8px */
  --cal-cell-radius:        var(--radius-md); /* 8px */
  --cal-cell-bg:            transparent;
  --cal-cell-bg-selected:   var(--theme-accent-soft);

  /* Today highlight = ring */
  --cal-today-ring:         1px solid var(--theme-accent);
  --cal-today-ring-offset:  -1px;

  /* Event chip */
  --cal-chip-rail-width:    3px;        /* 그리드 셀 안에서는 좁게 */
  --cal-chip-height:        16px;
  --cal-chip-font-size:     10.5px;
  --cal-chip-padding:       0 var(--space-1) 0 var(--space-2);  /* L: 8 R: 4 */
  --cal-chip-radius:        var(--radius-xs);  /* 4px */
  --cal-chip-bg:            var(--bg-base);
  --cal-chip-bg-overflow:   var(--bg-muted);

  /* Weekday header */
  --cal-weekday-color:      var(--fg-tertiary);
  --cal-weekday-color-sun:  var(--status-negative-strong);
  --cal-weekday-color-sat:  var(--primary);
}
```

**핵심 변경**: 현재는 max 3 dots만 표시. 신규는 **textual chip** (제목 첫 5자 + 가족 일정 dashed border) 표시. 4번째부터는 `+N` overflow chip.

### 2.3 Bottom sheet
```css
:root {
  --sheet-bg:               var(--bg-base);
  --sheet-radius-top:       var(--radius-2xl);  /* 20px */
  --sheet-handle-width:     32px;
  --sheet-handle-height:    4px;
  --sheet-handle-color:     var(--line-default);
  --sheet-handle-margin:    var(--space-3) auto var(--space-2);
  --sheet-padding-x:        var(--space-screen-pad);
  --sheet-shadow:           var(--shadow-lg);
  --sheet-backdrop:         rgba(15, 15, 18, 0.32);

  --sheet-height-default:   80vh;
  --sheet-height-quick:     32vh;
  --sheet-height-min:       30vh;
  --sheet-height-max:       92vh;

  --duration-sheet-open:    320ms;
  --duration-sheet-close:   240ms;
  --easing-sheet:           cubic-bezier(0.32, 0.72, 0, 1);  /* iOS spring */
}
```

### 2.4 자녀 카드 변형 (multi-child density)
```css
:root {
  --child-card-full-height:  80px;   /* 1자녀 */
  --child-card-row-height:   56px;   /* 2-3자녀 */
  --child-card-mini-size:    72px;   /* 4+자녀, square */
  --child-card-row-avatar:   36px;
  --child-card-mini-avatar:  44px;
}
```

---

## 3. 화면별 Spec

### 3.1 부모 홈 (HomeTab 재구성)

#### 레이아웃
```
┌─────────────────────────────┐
│ 목요일                       │  ← .t-bigstat-eyebrow
│ 5월 5일                      │  ← .t-bigstat-date (28px bold)
│ 다음 일정 · 오후 3시 영어    │  ← .t-bigstat-next (with .t-bigstat-next-time)
│ ─────────────────────────── │  ← divider 1px line-soft
│                              │
│ 오늘 일정                    │  ← section label (.t-section-label)
│  ▌영어 학원 · 오후 3시        │  ← TodayEventsList (기존 스타일 유지)
│  ▌피아노 · 오후 5시           │
│  ▌가족 외출 · 오후 7시 (dashed)│
│                              │
│ 자녀                         │  ← section label
│  ◯ 채니 · 학교 · ●●●        │  ← 1줄 row (2-3 자녀일 때)
│  ◯ 민주 · 학원 · ●●●        │
│                              │
│ ▾ 위치 보기                  │  ← collapsed by default
│ [Tap to expand → MiniMap]    │
└─────────────────────────────┘
```

#### 컴포넌트 spec

##### Big-stat 헤더 (신규 컴포넌트 `<HomeBigStat />`)
- 위치: HomeTab 최상단, padding `var(--space-screen-pad)` 좌우 + `var(--space-6)` top
- 데이터 source:
  - 요일·날짜: `new Date()` (이미 App.jsx에 있음)
  - 다음 일정: `events` props에서 현재 시각 이후 가장 가까운 미래 일정 1건. 없으면 카피 "오늘 일정 끝"
- 다음 일정 비교 함수: 이미 있는 `getDashboardEventStatus` 활용 가능
- 타이포: `.t-bigstat-eyebrow` → `.t-bigstat-date` → `.t-bigstat-next`
- 간격: eyebrow와 date 사이 `var(--space-1)` (4px), date와 next 사이 `var(--space-2)` (8px)

##### Section label (신규 클래스 `.t-section-label`)
```css
.t-section-label {
  font-size: 13px;
  font-weight: var(--weight-bold);
  color: var(--fg-secondary);
  margin: 0 0 var(--space-3);
  letter-spacing: 0;
}
```
현재 HomeTab의 `sectionLabelStyle` 인라인을 이 클래스로 대체.

##### Section 순서 변경 (HomeTab.jsx)
| 현재 | 변경 |
|---|---|
| 1) 등록된 아이 N명 | 1) **빅스탯** (신규) |
| 2) 위치 (MiniMap) | 2) **오늘 일정** (`TodayEventsList`) |
| 3) 오늘 일정 | 3) **자녀** (`ChildSummaryCard` 변형) |
| - | 4) **위치** (`MiniMap` collapsed) |

##### Section 간격
- 빅스탯과 다음 섹션 사이: `var(--space-screen-gap)` (48px)
- 섹션 간: `var(--space-6)` (24px)

##### `TodayEventsList` 카드 (변경 점)
현재 코드 유지하되:
- `border-radius: 8` → `var(--radius-input)` 또는 `var(--radius-card)` 일관화
- `background: "white"` → `var(--bg-base)` (다크 모드 대응 필수)
- `border-left: 4px` → 그대로 유지 (Cron 패턴 정합)
- `font-weight: 700` → `var(--weight-bold)`

##### `ChildSummaryCard` 변형 (자녀 수 분기)
**props 변경**: `density` prop 추가 (`"full" | "row" | "mini"`).
HomeTab에서 `children.length`에 따라 density 결정:
```jsx
const density = children.length === 1 ? "full" : children.length <= 3 ? "row" : "mini";
```

###### `density="full"` (1 자녀, 현재와 동일)
- 80px height
- 현재 레이아웃 그대로

###### `density="row"` (2-3 자녀, 신규 변형)
- 56px height
- 좌측: avatar 36px
- 가운데: 이름 (15px bold) + 위치 (12px secondary, 1줄 ellipsis)
- 우측: 안전 dots (8×3, 가로 정렬)
- border-left 4px child color 유지
- padding `var(--space-3) var(--space-4)`

```
┌─────────────────────────────────────┐
│ ▌◯ 채니 · 학교 · 화면켜짐 1시간   ●●●│
└─────────────────────────────────────┘
```

###### `density="mini"` (4+ 자녀, 신규 변형)
- 72×72 square
- 가로 스크롤 컨테이너 안 (`overflow-x: auto, scroll-snap`)
- 상단 avatar 44px (centered)
- 하단 이름 11px (1줄 ellipsis)
- 우상단 안전 dot 1개 (worst color, 6×6)
- border-left 제거, `border: 1px solid var(--line-soft)`, top color stripe 4px (child color)
- 탭 시 자녀 상세 진입

```
[◯ 채니 ●][◯ 민주 ●][◯ 지수 ][◯ 영호 ]→
```

##### `MiniMap` collapsible
- 기본: 접힘 상태 → label "▾ 위치 보기" + 자녀 N명 안전 요약 ("모두 정상" / "주의 1명")
- 탭하면 펼침 → 기존 MiniMap 컴포넌트
- 펼침 상태 maxHeight 240px
- 한 번 펼치면 세션 동안 펼침 유지 (`useState`)

##### Empty state (자녀 없음)
- 빅스탯은 항상 표시
- TodayEventsList 빈 state는 현재 `오늘 일정이 없어요` 그대로
- 자녀 섹션: "아이를 등록해 시작해 주세요 → [페어링하기]" CTA

---

### 3.2 캘린더 그리드 (`renderParentCalendarGrid`)

#### 변경 핵심
**1. dots → text chip**
현재 (`hyeni-v5-calendar-dots`): 셀 하단에 max 3 dots.
신규: 셀 하단에 max 2 chips, 3+면 `+N`.

```html
<!-- 현재 -->
<span className="hyeni-v5-calendar-dots">
  <span style="background: red"/>
  <span style="background: blue"/>
  <span style="background: green"/>
</span>

<!-- 신규 -->
<div className="cal-chips">
  <div className="cal-chip" style="--rail: var(--hyeni-cat-school)">영어</div>
  <div className="cal-chip" style="--rail: var(--hyeni-cat-family)" data-family>가족</div>
  <div className="cal-chip cal-chip-overflow">+1</div>
</div>
```

**2. Today highlight: 채움 → ring**
현재 `.today` class가 어떻게 스타일되는지는 `App.css`에 있음. spec 변경:
- 배경 채우기 X
- `border: var(--cal-today-ring)` (1px theme-accent)
- 숫자 색은 `var(--theme-accent-text)` weight-bold

**3. Selected highlight: 약한 배경**
- `.selected` (today와 다른 day) → `background: var(--cal-cell-bg-selected)` (theme-accent-soft)
- today AND selected 동시 → ring + soft bg 모두

**4. 셀 padding 8 → 12px (Cron 양보)**
- `--cal-cell-padding: var(--space-3)` (12px)
- 다만 mobile에서 그리드 7 columns 폭이 부족하므로 freeze: padding은 cell 내부 layout만 조정, cell 외곽 spacing은 그대로
- `min-height: 48 → 60` (chip 2개 들어갈 수 있도록)

#### Chip CSS (신규)
```css
.cal-chip {
  height: var(--cal-chip-height);          /* 16px */
  padding: var(--cal-chip-padding);
  background: var(--cal-chip-bg);
  border-radius: var(--cal-chip-radius);
  font-size: var(--cal-chip-font-size);    /* 10.5px */
  font-weight: var(--weight-semibold);
  color: var(--fg-primary);
  border-left: var(--cal-chip-rail-width) solid var(--rail);  /* 카테고리 색 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1;
  display: flex;
  align-items: center;
}
.cal-chip[data-family] {
  border-left-style: dashed;
}
.cal-chip-overflow {
  background: var(--cal-chip-bg-overflow);
  color: var(--fg-tertiary);
  border-left: none;
  text-align: center;
  padding: 0 var(--space-1);
}
.cal-chips {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--space-1);
  width: 100%;
  overflow: hidden;
}
```

#### 헤더 (`hyeni-v5-calendar-card-head`) 유지
- 좌측 연도 + 월
- 우측 ‹ › prev/next
- 변경 X (이미 좋음)

#### 요일 헤더 색
- 일: `var(--cal-weekday-color-sun)` (status-negative-strong)
- 토: `var(--cal-weekday-color-sat)` (primary blue)
- 평일: `var(--cal-weekday-color)` (fg-tertiary)
- weight: `var(--weight-semibold)`

#### Reduced motion
- prev/next 전환은 fade `var(--duration-base)` (200ms). 슬라이드 애니메이션 사용 안 함 (혼란 방지).
- `prefers-reduced-motion` 시 fade 제거.

---

### 3.3 일정 모달 → bottom sheet

#### 신규 컴포넌트 `<EventSheet />`
별도 파일 `src/components/multichild/EventModal/EventSheet.jsx`. 기존 EventModal 폴더 재사용.

#### 구조
```
┌─────────────────────────────┐
│         ▔▔▔                  │  ← drag handle (32×4)
│ 취소         일정          저장│  ← sheet header (50px)
│ ─────────────────────────── │
│ 제목                         │
│ [입력]                       │
│                              │
│ 날짜 · 시간                  │
│ [5월 5일 화]  [오후 3:00]    │
│                              │
│ 카테고리                     │
│ [○학원] [○운동] [●가족] ...  │
│                              │
│ 자녀                         │
│ [□채니] [□민주]              │
│                              │
│ 위치 (선택)                  │
│ [장소 검색]                  │
│                              │
│ 메모 (선택)                  │
│ [...]                        │
│                              │
│        [삭제 (편집 모드만)]   │  ← bottom destructive
└─────────────────────────────┘
```

#### Sheet 컴포넌트 spec

##### Backdrop
- `position: fixed; inset: 0`
- `background: var(--sheet-backdrop)`
- 탭 시 swipe-down과 동일하게 닫기 (단, 폼 dirty면 confirm)

##### Sheet body
- `position: fixed; bottom: 0; left: 0; right: 0`
- `background: var(--sheet-bg)`
- `border-radius: var(--sheet-radius-top) var(--sheet-radius-top) 0 0`
- `box-shadow: var(--sheet-shadow)`
- `height: var(--sheet-height-default)` (80vh)
- `overflow: hidden` (내부 스크롤은 form 영역만)

##### Drag handle
- `width: var(--sheet-handle-width)` (32px)
- `height: var(--sheet-handle-height)` (4px)
- `background: var(--sheet-handle-color)`
- `border-radius: var(--radius-full)`
- 가운데 정렬, top margin `var(--space-3)`

##### Header
- height 50px
- padding `0 var(--sheet-padding-x)`
- 좌측 [취소] 버튼 (.btn-ghost or text-only), 우측 [저장] 버튼 (.btn-primary, 변경 있을 때만 enabled)
- 가운데 [제목] = "일정 추가" / "일정 편집" (16px bold)
- 하단 1px line-soft

##### Form 영역
- `flex: 1; overflow-y: auto`
- padding `var(--space-4) var(--sheet-padding-x) calc(var(--space-12) + env(safe-area-inset-bottom))`
- 각 필드 사이 `var(--space-5)` (20px)

##### Field labels
- 14px weight-semibold `var(--fg-secondary)`
- margin-bottom `var(--space-2)`

##### Inputs
- 기존 `.input` 클래스 사용 (Phase 1 토큰)
- 시간 입력은 native `<input type="time">` (모바일 OS 휠)

##### Category 선택
- pill button row, scroll-x
- 미선택: `bg-base`, 1px line-soft, weight-medium
- 선택: bg `--hyeni-cat-XXX-bg`, color `--hyeni-cat-XXX`, border 동일색

##### 자녀 선택
- chip toggle (multi-select)
- 미선택: 1px line-soft, color fg-secondary
- 선택: 1px child color, bg `color-mix(child color, bg-base 92%)`, color child color

##### 삭제 버튼 (편집 모드만)
- `.btn .btn-secondary` 스타일 with destructive text color
- 또는 별도 `.btn-destructive-text` (text only, no bg)
- "이 일정 삭제" 18px medium `var(--status-negative-strong)`
- 탭 시 confirm dialog ("정말 삭제할까요?")

##### Quick add (셀 long-press)
- height `var(--sheet-height-quick)` (32vh)
- 제목 입력 + 시간 + [더보기 ▴] + [저장]
- 더보기 탭 시 default sheet로 expand (height transition)

#### Open/close motion
```css
@keyframes sheet-in {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.event-sheet {
  animation: sheet-in var(--duration-sheet-open) var(--easing-sheet);
}
.event-sheet-backdrop {
  animation: backdrop-in var(--duration-sheet-open) ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .event-sheet, .event-sheet-backdrop { animation: none; }
}
```

#### Hardware back
- 펼친 상태: 닫기
- Quick add 펼침 → default sheet로: shrink (back은 sheet 자체 닫기)

#### 라이브러리
- vaul (https://vaul.emilkowal.ski) — React bottom sheet 표준
- 또는 직접 구현 (`framer-motion` `useMotionValue` + drag handler)
- spec sign-off 시 결정 (질문 Q5 참고)

---

### 3.4 자녀 상세 화면 (신규)

#### 신규 컴포넌트 `<ChildDetailScreen />`
`src/components/multichild/ChildDetail/ChildDetailScreen.jsx` (신규 폴더)

#### 진입
- `HomeTab`의 `ChildSummaryCard.onClick(child.id)` → 라우팅 (현재 `onSelectChild` prop 활용)
- 페어링 마법사 끝나고 자녀 상세로 이동도 가능

#### 레이아웃
```
┌─────────────────────────────┐
│ ←  [avatar] 채니         ⚙ │  ← sticky header
│    오늘 정상  ●●●            │
│ ─────────────────────────── │
│  목요일                      │
│  5월 5일                     │  ← .t-bigstat (이름 위 메타)
│                              │
│ ┌─────────────────────────┐ │
│ │   [지도 — 50vh]          │ │  ← 큰 지도, trail dots
│ │   [위치 핀]              │ │
│ └─────────────────────────┘ │
│ • 학교 (오전 8:30~)          │  ← timeline 항목
│ • 학원 (오후 3:30~)          │
│ ─────────────────────────── │
│ 오늘 일정                    │
│ ▌영어 학원 · 오후 3시        │
│ ▌피아노 · 오후 5시           │
│ ─────────────────────────── │
│ 안전 메트릭                  │
│ 배터리  67% (1시간 전)        │
│ 위치    5분 전 갱신           │
│ 화면켜짐 오늘 1시간 23분       │
└─────────────────────────────┘
```

#### Sticky header
- height 56px + status-bar safe-area
- 좌측 ← back (`var(--control-height-sm)` 36px button)
- 가운데: [avatar 32 + 이름 17 bold]
- 우측: ⚙ 자녀 설정 진입 (자녀 이름 변경, 색 변경 등)
- 하단 lane 24px: 안전 dots 3개 + 라벨 ("오늘 정상" / "주의 1건" / "위험")
- bg `var(--bg-base)`, bottom border 1px line-soft

#### Big-stat (이름 아래 메타)
- 현재 `<HomeBigStat />`와 동일 컴포넌트 재사용. "다음 일정" 부분만 *해당 자녀의* 다음 일정 (filter)

#### 지도 영역
- 50vh, full-width
- Kakao Map (재사용 `MiniMap.jsx` 또는 신규 큰 버전)
- 오늘 위치 trail: `locationTrailDisplay.js` 데이터 활용
- trail dots: 5분 간격 작은 dot, 30분 간격 라벨 dot (시각 hover/tap)
- 현재 위치 핀: 자녀 색

#### Timeline 항목 (지도 아래)
- 위치 데이터에서 *체류* 추출 (10분 이상 한 곳에 머문 건)
- bullet (●) + 장소 + 시간 범위
- 14px medium fg-primary

#### 오늘 일정 섹션
- 해당 자녀에 연결된 일정만 (filter `event.child_ids.includes(child.id) || event.is_family_event`)
- 디자인은 `TodayEventsList`와 동일

#### 안전 메트릭 섹션
- 3 row table (배터리 / 위치 / 화면켜짐)
- 각 row: label (12px secondary) + value (14px primary) + meta (11px tertiary)
- 데이터 source: 기존 `childDeviceStatusMap[child.user_id]`

#### Empty states
- 위치 데이터 없음: 지도 영역 placeholder + "위치 정보 없음 · 권한 확인" → 권한 마법사 deeplink
- 일정 없음: "오늘 일정 없어요" (TodayEventsList 그대로)
- 디바이스 status 없음: "기기 응답 없음 · 마지막 N시간 전"

---

## 4. 카피 (writing tone — Toss 통일 voice 유지)

| 화면 | 위치 | 카피 |
|---|---|---|
| HomeBigStat | eyebrow | (요일) |
| HomeBigStat | date | (월일) |
| HomeBigStat | next (있음) | 다음 일정 · **{시간} {제목}** |
| HomeBigStat | next (없음) | 오늘 일정 마무리됐어요 |
| HomeTab | section | 오늘 일정 / 자녀 / 위치 |
| HomeTab | empty 자녀 | 아이를 등록해 시작해 주세요 → 페어링하기 |
| MiniMap collapsed | label | ▾ 위치 보기 · {모두 정상 / 주의 N명 / 위험 N명} |
| EventSheet | header (추가) | 일정 추가 |
| EventSheet | header (편집) | 일정 편집 |
| EventSheet | save | 저장 |
| EventSheet | cancel | 취소 |
| EventSheet | delete | 이 일정 삭제 |
| EventSheet | delete confirm | 정말 삭제할까요? |
| ChildDetail | header status (정상) | 오늘 정상 |
| ChildDetail | header status (주의) | 주의 — {배터리 부족 / 위치 오래됨} |
| ChildDetail | header status (위험) | 위험 — {앱 차단 / 응답 없음} |
| ChildDetail | empty location | 위치 정보 없음 · 권한 확인 |
| ChildDetail | metrics labels | 배터리 / 위치 / 화면켜짐 |

---

## 5. Acceptance criteria (sign-off 체크리스트)

### 기능
- [ ] 홈 진입 즉시 big-stat 헤더 표시 (요일/날짜/다음 일정)
- [ ] 다음 일정 자동 갱신 (현재 시각 기준 가장 가까운 미래)
- [ ] 자녀 1/2-3/4+ 케이스에서 카드 변형 자동 적용
- [ ] MiniMap 접힘 default, 한 번 펼치면 세션 동안 유지
- [ ] 캘린더 셀에 일정 chip 텍스트 표시 (max 2 + overflow)
- [ ] today highlight = ring, selected = soft bg
- [ ] 일정 추가/편집 = bottom sheet 80vh
- [ ] sheet swipe-down으로 닫기 (dirty 시 confirm)
- [ ] 셀 long-press = quick add 32vh
- [ ] 자녀 카드 탭 → 자녀 상세 화면 이동
- [ ] 자녀 상세 sticky header에 안전 dots + 라벨 표시
- [ ] 자녀 상세 지도에 오늘 trail dots 표시
- [ ] 자녀 상세 일정 섹션은 해당 자녀+가족 일정만 필터

### 시각
- [ ] big-stat eyebrow 12px → date 28px → next 14px 위계 명료
- [ ] 캘린더 셀 배경 흰색 유지 (카테고리 색으로 채우기 X)
- [ ] today ring + selected soft bg 동시 작동
- [ ] event chip 좌측 4px rail (가족 = dashed)
- [ ] event sheet drag handle 32×4 표시
- [ ] sheet open animation 320ms iOS spring
- [ ] 자녀 상세 안전 dots와 라벨 일치 (정상/주의/위험)

### 코드 품질
- [ ] 인라인 hex/rgb 0개 (CLAUDE.md rule 1)
- [ ] body weight 500 유지
- [ ] HomeBigStat / EventSheet / ChildDetailScreen 신규 컴포넌트 분리
- [ ] ChildSummaryCard density prop 추가, render 분기
- [ ] `hyeni-v5-calendar-dots` 클래스 → `cal-chips`로 마이그레이션

### 회귀
- [ ] 기존 일정 추가/편집/삭제 흐름 그대로 작동 (`openEditEventModal` 핸들러)
- [ ] `setSelectedDate`, `prevMonth`, `nextMonth` 모두 정상
- [ ] Kakao Map SDK 정상 로드
- [ ] 6 카테고리 컬러 모두 chip rail에 정상 표시
- [ ] 6 테마 픽커 변경 시 today ring·next time 색 자동 반영
- [ ] 다크 모드에서 모든 토큰 정상 작동
- [ ] `npm run build` 0 errors
- [ ] `npx tsc --noEmit` 0 errors (해당 시)

---

## 6. 구현 단계 (sign-off 후 진행 순서)

> 1 commit, message: `wanted-ds: phase 9 — redesign parent daily (home · grid · sheet · child detail)`

| 단계 | 산출물 | 예상 LOC |
|---|---|---|
| 1 | `tokens.css` 신규 토큰 추가 (typography, calendar, sheet, child-card) | +60 |
| 2 | `HomeBigStat.jsx` 신규 컴포넌트 + `getNextEvent` util | +90 |
| 3 | `ChildSummaryCard.jsx` density prop + 3 variant render | +70 / -30 |
| 4 | `HomeTab.jsx` 섹션 순서 변경 + collapsible MiniMap wrapper | +40 / -10 |
| 5 | `App.css` 캘린더 그리드 dots → chips 마이그레이션 + today ring | +40 / -20 |
| 6 | `renderParentCalendarGrid` JSX 변경 (chip 렌더) | +20 / -8 |
| 7 | `EventSheet.jsx` 신규 컴포넌트 (vaul 또는 자체) | +280 |
| 8 | `openEditEventModal` → EventSheet 라우팅 | +20 / -40 |
| 9 | `ChildDetailScreen.jsx` 신규 컴포넌트 + child detail 라우팅 | +220 |
| 10 | `App.jsx` child detail 진입 라우팅 | +25 / -5 |
| 11 | 단위 테스트 (HomeBigStat, ChildSummaryCard density, EventSheet open/close) | +180 |
| 12 | `npm run build` + `npx tsc --noEmit` 통과 확인 | - |

**예상 작업 시간 (CC)**: 180~240 분  
**예상 작업 시간 (사람)**: 12~16 시간

---

## 7. 미결 결정 — sign-off 시 확정 필요

| # | 질문 | 옵션 | 권장 |
|---|---|---|---|
| Q1 | Big-stat "다음 일정" 표시 형식 | a) `다음 일정 · 오후 3시 영어` b) `오후 3시 · 영어` c) `다음: 오후 3시` | a (액션·시간·제목 다 보임) |
| Q2 | 자녀 4+ mini card 가로 스크롤 vs 그리드 wrap | a) 가로 스크롤 (snap) b) 2 col grid wrap | a (스크롤이 모바일 자연스러움) |
| Q3 | MiniMap 펼침 상태 persistence | a) 세션 only b) localStorage 저장 c) 항상 접힘 | a (간소함) |
| Q4 | 캘린더 chip 텍스트 길이 | a) 5자 ellipsis b) 8자 c) 셀 폭 자동 계산 | a (모바일 좁음) |
| Q5 | Bottom sheet 라이브러리 | a) vaul (npm) b) 직접 구현 (framer-motion) c) react-modal-sheet | a (검증된 표준, 의존성 추가 OK?) |
| Q6 | 자녀 상세 지도 영역 비율 | a) 50vh b) 40vh + scroll 자유 c) 전체 화면 절반 절대값 | a (모바일 가로 스크롤 X) |
| Q7 | Quick add 셀 long-press 우선순위 | a) Phase 2에 포함 b) Phase 4 후속 | b (Phase 2는 sheet 자체 + 기존 + 버튼 진입만 우선) |
| Q8 | 자녀 상세 trail dots 시간 라벨 | a) 30분 간격 보임 b) tap/hover 시 c) 아예 없음 | b (시각 깔끔) |
| Q9 | 캘린더 셀 min-height | a) 48px (현재) b) 60px (chip 2개 들어가게) c) 화면 폭 비례 | b (chip 가시성) |
| Q10 | EventSheet 카테고리 표시 방식 | a) pill button row b) dropdown c) icon grid 6 | a (한눈에 보임) |

---

## 8. 비고

- 이 spec은 *의도*만. 픽셀 단위 prototype은 sign-off 후 별도 HTML 생성.
- Phase 1과 마찬가지로 1 phase = 1 commit. Phase 2 적용 후 코드 적용 시 Phase 1 미적용 작업도 같이 묶을지 별도 결정.
- 추후 Phase 3 (자녀 모드)는 부모 모드와의 *시각 분리*가 핵심: 마스코트 / pink gradient / playful motion 추가, 이 spec의 부모 톤 토큰은 자녀 모드에 그대로 쓰지 않음.
- Daily morning brief 푸시 (Cozi 영감) 는 Phase 2 본체 X, 별도 작업으로 메모.
