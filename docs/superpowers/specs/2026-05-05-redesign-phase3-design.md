# Phase 3 Design Spec — 자녀 모드 5 화면 (Playful-Character)

> 2026-05-05 · 자녀 5 화면 redesign · sign-off 대상 문서
> 리서치: `.lazyweb/design-research/redesign-phase3-2026-05-05/report.md` (작성 중 — 본 spec과 병행)
> 기준 토큰: Phase 1+2에서 확립된 `src/styles/tokens.css` (Wanted DS + `--mode-child-card-*`)
> CLAUDE.md hard rules 준수: 토큰만 사용, spacing 4px grid, body weight 500, dark-mode aware
> Phase 1·2 sign-off 결정 그대로 유지: 자녀 모드 = Playful-Character (Duolingo·Headspace·Khan Academy Kids·iMessage·카카오 키즈 톤)

---

## 1. 범위와 비범위

### IN scope (Phase 3 — 자녀 모드 5 화면)
- 화면 1: **권한 마법사** (`ChildPermissionWizard.jsx` 재구성)
- 화면 2: **자녀 홈 dashboard** (`App.jsx` line 13175-13475 재구성)
- 화면 3: **자녀 read-only 캘린더** (`App.jsx` line 13745-13871, `DayTimetable` child 분기 톤 분리)
- 화면 4: **부모 메모 응답 + 스티커 보내기** (ParentMemoPage child mode + 신규 SendStickerSheet)
- 화면 5: **자녀 설정** (신규 — 현재 미존재)

### OUT of scope
- 페어링·구독·친구놀이·장소관리 운영 화면 (Phase 4)
- 부모 모드 변경 (Phase 2 그대로)
- Supabase 스키마·핸들러 변경

### 보존 (변경 금지)
- `handleMemoReplySubmit → sendMemo(...)` Supabase 흐름
- `addSticker / fetchStickersForDate / fetchStickerSummary` 호출
- `ChildCallCard`, `FriendPlaydateChildPanel` 컴포넌트 — 톤만 자녀 모드와 일치하도록 wrapper 조정
- 권한 마법사의 6 step 정의 + `onAllowAll / onAction / onDismiss` 시그니처
- `visibleEvents` 프라이버시 필터링 로직

---

## 2. 디자인 약속 — 부모/자녀 모드 분리 헌법

| 차원 | 부모 (Phase 2 확정) | 자녀 (Phase 3 확정) |
|---|---|---|
| **밀도** | 높음 (80px row, 1-2 자녀시 full) | 낮음 (104px hero, 큰 여백) |
| **카드 chrome** | stroke-first, shadow none | filled gradient + 핑크 tinted shadow |
| **radius** | `--radius-card` (16px) | `--radius-2xl` (20px) + `--radius-pill` for chips |
| **마스코트 등장** | 없음 (도구 톤) | 홈 hero / 빈 상태 / 보상 전용 |
| **micro-animation** | 없음 / 0.12s linear transitions | wave·bounce·sparkle (--easing-mascot) |
| **Copy 톤** | 짧고 정보 위주 ("새 일정", "수정") | 친근체 ("오늘 뭐 해?", "메모 보냈어!") |
| **이모지 사용** | 일정 카테고리 한정 | hero·CTA·피드백 자유롭게 |
| **typography 위계** | 28px/16px/13px | 22px hero + 큰 emoji 36-44px |
| **버튼 height** | 44-56px | 56px (탭 영역 넓게) |

공유 (모드 무관):
- 핑크 #F779A8 accent (`--theme-accent`)
- 6 카테고리 컬러 (`--hyeni-cat-*`)
- Pretendard JP body 500
- 6 테마 픽커 (자녀가 본인 테마 선택 가능 — 화면 5에서 노출)
- 마스코트 SVG (`HyeniMascot` static/wave/cheer 3 variant)

---

## 3. 디자인 토큰 — 신규 추가

```css
/* src/styles/tokens.css 추가 — Phase 3 child mode */
:root {
  /* === Child mode — hero & quick-action 화면 전용 === */
  --child-hero-padding:       var(--space-6);              /* 24px */
  --child-hero-min-height:    160px;
  --child-hero-radius:        var(--radius-2xl);            /* 20px */
  --child-hero-bg:
    linear-gradient(135deg, var(--theme-accent-soft) 0%, var(--theme-accent-glow) 100%);
  --child-hero-mascot-size:   88px;

  /* === Child quick-action grid === */
  --child-quick-card-height:  88px;        /* 1탭 영역 보장 */
  --child-quick-card-radius:  var(--radius-2xl);
  --child-quick-card-padding: var(--space-3) var(--space-4);
  --child-quick-card-gap:     var(--space-2);             /* 카드 간 간격 */
  --child-quick-grid-cols:    2;                          /* 2 컬럼 grid */

  /* === Memo bubble (iMessage 풍) === */
  --memo-bubble-radius:       var(--radius-2xl);
  --memo-bubble-tail:         6px;                        /* tail clip 시각 보강 */
  --memo-bubble-parent-bg:    var(--bg-muted);            /* 부모가 보낸 메모 = 좌측 회색 */
  --memo-bubble-child-bg:     var(--theme-accent);        /* 자녀가 보낸 답장 = 우측 핑크 */
  --memo-bubble-child-fg:     var(--theme-accent-text-on);

  /* === Sticker grid === */
  --sticker-cell-size:        72px;        /* 4×4 grid in sheet */
  --sticker-cell-radius:      var(--radius-xl);
  --sticker-grid-gap:         var(--space-2);
  --sticker-emoji-size:       40px;

  /* === Permission wizard step === */
  --perm-step-card-height:    72px;
  --perm-step-card-radius:    var(--radius-card);
  --perm-step-icon-size:      40px;
  --perm-step-progress-height: 6px;        /* 진행 바 높이 */

  /* === Child mode motion === */
  --duration-mascot-cheer:    900ms;       /* 메모 보냄 / 권한 완료 시 */
  --duration-sticker-pop:     220ms;
  --easing-cheer:             cubic-bezier(0.22, 1.4, 0.36, 1);
}

/* Dark mode override */
@media (prefers-color-scheme: dark) {
  :root {
    --child-hero-bg:
      linear-gradient(135deg,
        color-mix(in srgb, var(--theme-accent) 16%, var(--bg-base)) 0%,
        color-mix(in srgb, var(--theme-accent) 6%, var(--bg-base)) 100%);
    --memo-bubble-parent-bg: var(--bg-elevated);
  }
}
```

신규 typography 클래스:

```css
.t-child-hero-title {
  font-size: 22px;
  font-weight: var(--weight-bold);
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
  color: var(--fg-primary);
}
.t-child-hero-sub {
  font-size: 14px;
  font-weight: var(--weight-medium);
  color: var(--fg-secondary);
  margin-top: var(--space-1);
}
.t-child-hero-emoji {
  font-size: 36px;     /* hero 내 큰 emoji */
  line-height: 1;
}
.t-child-quick-label {
  font-size: 13px;
  font-weight: var(--weight-bold);
  color: var(--fg-primary);
}
.t-child-quick-meta {
  font-size: 11px;
  font-weight: var(--weight-medium);
  color: var(--fg-tertiary);
  margin-top: 2px;
}
```

신규 컴포넌트 클래스:

```css
.child-hero { /* 자녀 홈 hero — Duolingo 캐릭터 카드 톤 */
  display: flex; align-items: center; gap: var(--space-4);
  padding: var(--child-hero-padding);
  min-height: var(--child-hero-min-height);
  border-radius: var(--child-hero-radius);
  background: var(--child-hero-bg);
  border: 1px solid var(--theme-accent-line);
  box-shadow: var(--hyeni-shadow-card);
}
.child-hero-mascot { width: var(--child-hero-mascot-size); height: var(--child-hero-mascot-size); flex-shrink: 0; }
.child-hero-body { flex: 1; min-width: 0; }

.child-quick-grid {
  display: grid;
  grid-template-columns: repeat(var(--child-quick-grid-cols), 1fr);
  gap: var(--child-quick-card-gap);
}
.child-quick-card {
  display: flex; flex-direction: column; justify-content: space-between;
  height: var(--child-quick-card-height);
  padding: var(--child-quick-card-padding);
  border-radius: var(--child-quick-card-radius);
  background: var(--bg-base);
  border: 1px solid var(--line-soft);
  box-shadow: var(--hyeni-shadow-card-soft);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--easing-mascot);
}
.child-quick-card:active { transform: scale(0.97); }
.child-quick-card[data-tone="memo"] { background: linear-gradient(135deg, var(--theme-accent-soft), var(--bg-base)); }
.child-quick-card[data-tone="sticker"] { background: linear-gradient(135deg, var(--hyeni-cat-hobby-soft), var(--bg-base)); }

.memo-bubble {
  display: inline-block; max-width: 80%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--memo-bubble-radius);
  font-size: 14px; font-weight: var(--weight-medium); line-height: var(--leading-normal);
  word-break: break-word;
}
.memo-bubble[data-from="parent"] {
  background: var(--memo-bubble-parent-bg);
  color: var(--fg-primary);
  border-bottom-left-radius: var(--memo-bubble-tail);
  align-self: flex-start;
}
.memo-bubble[data-from="child"] {
  background: var(--memo-bubble-child-bg);
  color: var(--memo-bubble-child-fg);
  border-bottom-right-radius: var(--memo-bubble-tail);
  align-self: flex-end;
}

.sticker-grid {
  display: grid;
  grid-template-columns: repeat(4, var(--sticker-cell-size));
  gap: var(--sticker-grid-gap);
  justify-content: center;
}
.sticker-cell {
  width: var(--sticker-cell-size); height: var(--sticker-cell-size);
  border-radius: var(--sticker-cell-radius);
  background: var(--bg-base);
  border: 1px solid var(--line-soft);
  display: flex; align-items: center; justify-content: center;
  font-size: var(--sticker-emoji-size);
  cursor: pointer;
  transition: transform var(--duration-sticker-pop) var(--easing-cheer);
}
.sticker-cell:active { transform: scale(0.92); }
.sticker-cell[data-selected="true"] {
  border: 2px solid var(--theme-accent);
  background: var(--theme-accent-soft);
}

.perm-step {
  display: flex; align-items: center; gap: var(--space-3);
  height: var(--perm-step-card-height);
  padding: 0 var(--space-4);
  border-radius: var(--perm-step-card-radius);
  background: var(--bg-base);
  border: 1px solid var(--line-soft);
}
.perm-step[data-ready="true"] { border-color: var(--status-positive); background: var(--status-positive-subtle); }
.perm-step-icon {
  width: var(--perm-step-icon-size); height: var(--perm-step-icon-size);
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-md);
  background: var(--theme-accent-soft);
  font-size: 22px;
}
.perm-step[data-ready="true"] .perm-step-icon { background: var(--status-positive-soft); }
.perm-step-body { flex: 1; min-width: 0; }
.perm-step-title { font-size: 14px; font-weight: var(--weight-bold); color: var(--fg-primary); }
.perm-step-desc { font-size: 12px; font-weight: var(--weight-medium); color: var(--fg-secondary); margin-top: 2px; }

.perm-progress {
  width: 100%; height: var(--perm-step-progress-height);
  border-radius: var(--radius-pill);
  background: var(--bg-muted);
  overflow: hidden;
}
.perm-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--theme-accent), var(--status-positive));
  transition: width 320ms var(--easing-mascot);
}

@keyframes hyeni-mascot-cheer {
  0%   { transform: translateY(0) scale(1); }
  35%  { transform: translateY(-12px) scale(1.05); }
  70%  { transform: translateY(0) scale(1); }
  100% { transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: no-preference) {
  .hyeni-mascot-cheer {
    animation: hyeni-mascot-cheer var(--duration-mascot-cheer) var(--easing-cheer);
  }
}
```

---

## 4. 화면별 spec

### 4.1 권한 마법사 (`ChildPermissionWizard`)

**현재**: 미니멀 회색 톤, 6 step 체크리스트, "한번에 모두 / 개별" 두 모드, 진행률 바 위계 약함.

**리디자인**:
- **헤더**: HyeniMascot wave variant 56px + "혜니가 도와줄게!" hero copy. 진행률 바 6px → 색상 그라디언트 (`--perm-step-progress-height`).
- **본문**: 6 step을 `.perm-step` 카드로. 완료 step은 `data-ready="true"` (초록 테두리 + soft fill). 아이콘 emoji 그대로 유지.
- **"한번에 모두 허용"**: primary CTA 56px, 핑크 fill. "개별" 모드는 secondary 작은 링크 형식 ("하나씩 확인할래요").
- **완료 상태**: 모든 step ready → mascot cheer 애니메이션 (한 번만, prefers-reduced-motion 가드) + "준비 완료! 시작해볼까?" + primary CTA "시작하기".
- **거부 상태**: 권한 거부된 step은 `data-ready="false"` + 작은 "다시 시도" 버튼 inline. 에러 메시지는 도구적이지 않은 친근체 ("위치를 켜야 부모님이 너 어디 있는지 알 수 있어").

**ASCII 와이어프레임**:
```
┌──────────────────────────────┐
│  🐰 혜니가 도와줄게!         │
│  ▓▓▓▓▓▓░░░░░  3/6           │  ← 진행률 + N/6
├──────────────────────────────┤
│  ✓ 🔔 알림 켜기   (소리/진동) │  ← ready=true 초록
│  ✓ 📍 위치 권한   (집·학원)   │
│  ✓ 🔋 배터리 최적화 끄기      │
│  □ 🔊 소리 채널   (긴급용)    │  ← ready=false
│  □ 📱 백그라운드 위치         │
│  □ 🎤 마이크 (긴급 음성)      │
├──────────────────────────────┤
│  [ 한번에 모두 허용하기 ]    │  ← primary 56px
│  하나씩 확인할래요            │  ← secondary text
└──────────────────────────────┘
```

### 4.2 자녀 홈 dashboard (`App.jsx` 13175-13475 재구성)

**현재**: 그래디언트 hero + 위치 박스 + 빠른 실행 패널 (메모/스티커북/연락처/친구만남) — 정보 흐름이 평탄, hero 압도, 일정은 하단.

**리디자인**:
- **(1) Hero 섹션** — `.child-hero`: HyeniMascot static 88px + child-hero-title "오늘 뭐 해?" + sub "{N}개 일정 있어" or "오늘은 자유시간!" + 작은 시간 표시 (오후 3시 25분). hero 배경은 dynamic copy에 따라 톤 변화 (자유시간 = soft pink, 일정 多 = energetic).
- **(2) 다음 일정 큰 카드** — Phase 2 부모 BigStat 변형. "다음 일정 · 오후 4시 영어학원 🎒". 탭하면 길찾기.
- **(3) 빠른 실행 grid (2×2)** — `.child-quick-grid`:
  - 메모 카드 (`data-tone="memo"`) — "💌 부모님 메모 N개". 미열독 N >0면 핑크 dot 배지.
  - 스티커북 카드 (`data-tone="sticker"`) — "★ 받은 스티커 N개" + 가장 최근 sticker emoji 미리보기.
  - 부모 연락 카드 — 기존 ChildCallCard 톤 wrapping.
  - 친구만남 카드 — 기존 FriendPlaydateChildPanel 톤 wrapping.
- **(4) 오늘 일정 timeline** — Phase 2 TodayEventsList 재사용 (read-only 모드 prop으로 삭제 버튼 숨김). 자녀가 본 일정은 약한 fade.
- **(5) 보상 영역 (선택)** — 없음. 오늘 받은 스티커는 (3) 스티커북 카드 미리보기로 노출만.

**ASCII 와이어프레임**:
```
┌─────────────────────────────────┐
│ ┌─────────────────────────────┐ │
│ │ 🐰  오늘 뭐 해?             │ │ ← child-hero
│ │     2개 일정 있어 · 오후 3시 │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 다음 일정 · 오후 4시         │ │ ← BigStat 변형
│ │ 🎒 영어학원   ▸             │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌──────────┐ ┌──────────┐      │
│ │💌 메모 ●│ │★ 스티커 5│      │ ← 2×2 quick grid
│ └──────────┘ └──────────┘      │
│ ┌──────────┐ ┌──────────┐      │
│ │📞 엄마  │ │👫 친구   │      │
│ └──────────┘ └──────────┘      │
│                                 │
│  오늘 일정                       │ ← t-section-label
│  ・ 4시 🎒 영어학원              │
│  ・ 6시 🏠 집                   │
└─────────────────────────────────┘
```

### 4.3 자녀 read-only 캘린더 (DayTimetable 자녀 분기)

**현재**: `renderParentCalendarGrid` 공유, 자녀에게 동일 보기. cell chip은 부모 톤 그대로.

**리디자인** (최소 분리):
- 캘린더 그리드 자체는 공유 유지 (Phase 2 `.cal-day` + `.cal-chip` 그대로).
- 하지만 자녀 모드일 때 셀 chip을 **emoji-first** rendering으로 분기: 카테고리 emoji + 시간만 (제목 생략), 더 큰 chip height (`--cal-chip-height-child: 22px`). chip 클릭 시 자녀용 EventDetail bottom sheet (Phase 2 EventSheet 톤 분리 — 편집 X, "길찾기" "지도 보기" 액션만).
- **DayTimetable**: 자녀는 일정 카드를 탭 시 길찾기 / 지도 보기 두 액션만 노출. 제목·시간·장소·메모 read-only.

**신규 토큰**: `--cal-chip-height-child: 22px`, `--cal-chip-font-size-child: 12px`. `cal-chip[data-mode="child"]` 셀렉터로 분기.

### 4.4 부모 메모 응답 + 스티커 보내기

**현재**: `ParentMemoPage({ mode: "child" })` 풀스크린, textarea + 답글 보내기. 스티커는 받기 전용 (보내기 UI 없음).

**리디자인**:
- **메모 페이지** = iMessage 풍 chat list 톤:
  - 메모 한 건 = `.memo-bubble[data-from="parent"]` (좌측 회색) / 자녀 답장 = `.memo-bubble[data-from="child"]` (우측 핑크).
  - 시간 stamp는 bubble 위 작은 12px gray.
  - 입력 sticky 하단 input + send button (핑크 paper-plane icon). placeholder: "답장 보내~ 🐰".
  - 보냄 직후 mascot cheer 애니메이션 1회 + "메모 보냈어!" 토스트.
- **스티커 보내기** (신규 — `SendStickerSheet`):
  - 메모 입력창 옆 + 버튼 → bottom sheet (Phase 2 EventSheet 재사용, quick=true 32vh).
  - `.sticker-grid` 4×4 grid, 16개 기본 sticker (emoji set: ❤️🐰🎉👍💪⭐🌟🎁🍎🍪🌈🦄🌸🐱🐶🌟).
  - 탭 → `data-selected="true"` → 보내기 CTA → `addSticker(...)` 호출 → cheer + "스티커 보냈어!" 토스트.
- 받은 스티커 표시는 메모 위에 작은 row chip으로 inline (별도 섹션 아닌 메모 흐름 안).

### 4.5 자녀 설정 (신규 화면 — `ChildSettingsScreen.jsx`)

**현재**: 없음.

**신규 spec** — 자녀가 직접 만질 수 있는 최소 셋:
- **테마** (6 테마 픽커 — 본인 색 선택 가능. 부모가 잠금하면 잠금 표시).
- **소리/진동** (알림 소리 / 진동 토글).
- **마스코트 표시** (홈 hero에 마스코트 표시 ON/OFF — 사춘기 자녀 배려).
- **계정 정보** (이름·연결된 부모만 read-only 표시, "부모님께 변경 요청" 버튼만).
- **로그아웃** (작은 secondary 링크).

진입 경로: 홈 hero 우상단 ⚙ icon 또는 빠른 실행 grid에 "설정" 카드 5번째 추가.

**ASCII 와이어프레임**:
```
┌─────────────────────────────────┐
│  ←  설정                         │
├─────────────────────────────────┤
│  🎨 테마                         │
│  ●○○○○○  (6 색 piker)          │
├─────────────────────────────────┤
│  🔔 소리·진동           [ON ◉] │
│  🐰 마스코트 보여주기   [ON ◉] │
├─────────────────────────────────┤
│  계정                            │
│  이름: 지수                      │
│  부모: 엄마, 아빠                │
│  [ 부모님께 변경 요청 ]          │
├─────────────────────────────────┤
│  로그아웃                        │
└─────────────────────────────────┘
```

---

## 5. 보존 핸들러·호출 매핑

| 화면 | 보존할 핸들러 | 호출 위치 |
|---|---|---|
| 권한 마법사 | `onAllowAll`, `onAction(step)`, `onDismiss` | App.jsx → ChildPermissionWizard prop |
| 자녀 홈 | `setRouteEvent`, `setShowChildMemoPage`, `setShowStickerBook` | hero/quick card onClick |
| 자녀 홈 | `haversineM` 거리 계산 | 다음 일정 카드 distance |
| 자녀 캘린더 | `visibleEvents` 필터 | renderParentCalendarGrid |
| 메모 | `handleMemoReplySubmit → sendMemo(familyId, dateKey, text, authUser.id, "child", "memo_reply")` | 입력 send button |
| 스티커 보내기 | 신규 `addSticker(familyId, dateKey, emoji, authUser.id, "child")` | SendStickerSheet 보내기 CTA |
| 자녀 설정 | `applyThemeColor`, `setMyRole(null)` (로그아웃) | 설정 화면 액션 |

---

## 6. Sign-off 안건 (10건)

각 항목 **승인 / 변경 / 보류** 중 선택. "권장안 다 ok"로 일괄 승인 가능.

1. **권한 마법사 mascot 등장 시점** — wave variant + cheer (완료시) **권장**. 또는 정적 only.
2. **자녀 홈 hero copy 바리에이션** — "오늘 뭐 해?" / "{N}개 일정 있어" / "자유시간!" 3가지 자동 분기 **권장**. 또는 한 가지 고정.
3. **빠른 실행 grid 컬럼** — 2×2 (4 카드) **권장**. 5번째 "설정" 카드 추가하면 2×3 또는 3+2 비대칭. 권장: 2×2 + hero 우상단 ⚙ 아이콘 분리.
4. **자녀 캘린더 chip 분기** — emoji + 시간만 (제목 생략) **권장**. 또는 부모와 완전 동일.
5. **자녀 EventDetail sheet 액션** — "길찾기" "지도 보기" 2개만 **권장**. 또는 "메모 답장" 추가.
6. **메모 bubble 색** — 자녀 답장 = 핑크 fill **권장**. 또는 회색 fill (덜 도드라짐).
7. **스티커 grid 16개 기본 emoji set** — `❤️🐰🎉👍💪⭐🌟🎁🍎🍪🌈🦄🌸🐱🐶🎈` **권장**. 또는 사용자가 12개·24개 선호.
8. **자녀 설정 — 테마 자율권** — 자녀가 본인 테마 선택 가능 **권장** (부모 잠금 옵션 포함). 또는 부모만 선택.
9. **마스코트 표시 토글** — 설정에 ON/OFF 노출 **권장** (사춘기 배려). 또는 항상 ON.
10. **micro-animation prefers-reduced-motion** — 항상 가드 **권장 (확정)**. 사용자 OS 설정 존중.

---

## 7. 작업 우선순위

리서치 → spec sign-off → prototype HTML → 코드 적용 4단계.

코드 적용 시 작업 순서 (가장 risk 낮은 → 높은):
1. 자녀 설정 신규 (의존 없음, 새 파일)
2. 자녀 read-only 캘린더 chip 분기 (Phase 2 토큰 확장만)
3. 메모 bubble + 스티커 sheet (ParentMemoPage 분기 + 신규 SendStickerSheet)
4. 자녀 홈 dashboard 재구성 (App.jsx 큰 영역 — 가장 위험)
5. 권한 마법사 시각 재구성 (의존 적지만 mascot cheer 애니메이션 검증 필요)

---

## 8. 비정상 케이스

- **다크 모드** — 모든 새 토큰은 `prefers-color-scheme: dark` override 포함.
- **테마 픽커 6색 변경** — `--theme-accent` 동적 override가 모든 그라디언트·bubble·sticker 강조에 propagation 검증.
- **prefers-reduced-motion** — mascot cheer / sticker pop / sheet 슬라이드 모두 가드.
- **권한 거부 영구 상태** — 마법사에서 "다시 시도"가 OS settings deeplink로 fallback (기존 핸들러 유지).
- **메모 빈 상태** — bubble grid 없을 때 mascot static + "아직 메모가 없어. 부모님 답장 기다려볼까?" 친근체.

---

## 9. 완료 기준 (acceptance)

- [ ] 5 화면 모두 Phase 3 토큰만 사용 (CLAUDE.md hard rule).
- [ ] 부모 모드와 시각 차이 1초 안에 인지 가능 (마스코트·grad·radius·copy).
- [ ] `npm run build` exit 0.
- [ ] 다크 모드 에서도 색·대비 깨지지 않음.
- [ ] 모든 보존 핸들러 호출 시그니처 변경 없음.
- [ ] mascot 애니메이션 prefers-reduced-motion 가드 검증.
- [ ] 자녀 모드에서 추가/삭제 등 권한 외 동작 없음 확인.

---

> **다음 단계**: 사용자 sign-off (위 안건 10건) → prototype HTML → 코드 적용.
> 리서치 결과 도착 시 본 spec section 4 디테일 보정.
