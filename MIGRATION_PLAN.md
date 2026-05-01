# Hyeni × Wanted DS — Migration Plan

8 phases. Each phase = one Claude Code session = one commit.
Copy the prompt for each phase verbatim into Claude Code.

---

## Phase overview

| # | Phase | Visual change | Risk | Time est |
|---|-------|---------------|------|----------|
| 0 | Inventory | None | Low | 30min |
| 1 | Token foundation | None | Low | 30min |
| 2 | Typography activation | Subtle weight change | Med | 1hr |
| 3 | Card migration | Major (shadow → hairline) | High | 2hr |
| 4 | Input migration | Minor | Low | 1hr |
| 5 | Button migration | Major (variants) | High | 2hr |
| 6 | Dark mode + toggle | Massive (new mode) | High | 3hr |
| 7 | Dark mode QA + polish | Bug fixes | Low | 2hr |

## Per-phase workflow

1. Open a fresh Claude Code session (`/clear` if continuing in same session)
2. Confirm `CLAUDE.md`, `WANTED_DS_SPEC.md`, and `src/styles/tokens.css` are present in the repo
3. Copy the Phase prompt below into Claude Code
4. When Claude Code outputs the **candidate list**, review and approve
5. After implementation, manually verify the **acceptance criteria**
6. Commit: `wanted-ds: phase N — [summary]`
7. `/clear` before next phase

---

## Phase 0 — Inventory

**Goal**: Full audit of components, hardcoded styles, and migration scope.

**Acceptance**:
- `HYENI_INVENTORY.md` exists at repo root
- Lists every file in `src/components` with: path, line count, style mechanism (inline / Tailwind / CSS module / styled-components)
- All hardcoded colors counted with occurrence frequency
- Each current component mapped to a Wanted DS class (1:1 / partial / bespoke-keep)
- "Confidence" or "needs review" flag on each ambiguous item

### Prompt

```
혜니 앱 코드베이스 전수조사. 결과를 HYENI_INVENTORY.md로 저장.

조사 항목:
1. src/components 전체 파일 목록 — 경로, 라인 수, 스타일 방식
   (inline style / className / styled-components / CSS module 등)
2. 하드코딩된 색상값 추출 (grep):
   - hex: /#[0-9a-fA-F]{3,8}\b/
   - rgba?: /rgba?\([^)]+\)/
   각 값별 사용 횟수와 대표 파일 1~2개
3. 하드코딩된 spacing/radius (px 단위) — 4px 그리드를 벗어난 값 별도 표시
4. 현재 컴포넌트 → Wanted DS 매핑 후보:
   - WANTED_DS_SPEC.md의 .card / .input / .btn-* 와 매칭되는 곳
   - 1:1 매칭 / 부분 매칭 / 보존 필요(혜니 고유) 로 분류
   - 보존 대상: 일정 카드, 혜니 포인트 표시, 캘린더 그리드, 가족 멤버 카드
5. 컴포넌트 의존 관계 (Modal이 어떤 Button을 쓰는지 등)

규칙:
- 코드 변경 절대 금지. 조사·분석만.
- 추측 금지. 코드에서 실제 발견한 것만 기록.
- 애매한 매칭은 "확인 필요"로 표시하고 사유 기록.

산출물:
HYENI_INVENTORY.md — 위 5개 항목을 표 형식으로.

마지막에 자체 평가:
- Phase 1로 넘어가도 되는지
- 발견된 blocker (만약 있다면)
- 예상 외 발견사항
```

**Manual verification**:
- Open `HYENI_INVENTORY.md`. Sanity check: is the component count plausible?
- Are bespoke components (일정 카드, 혜니 포인트) correctly flagged as "보존"?
- Note any unexpected files or hardcoded values

---

## Phase 1 — Token foundation

**Goal**: Install `tokens.css` and Pretendard JP. Zero visual change.

**Acceptance**:
- `src/styles/tokens.css` exists (content matches the file in this package)
- `import "./styles/tokens.css"` is in main entry, BEFORE other CSS imports
- Pretendard JP CDN link in `index.html`
- `npm run build` passes
- `npx tsc --noEmit` passes
- **No visual change** in any screen (compare before/after screenshots)

### Prompt

```
src/styles/tokens.css 파일 생성 + main 진입점에서 import.

파일 내용은 첨부된 tokens.css를 그대로 사용 (이미 작성되어 있음).

추가 작업:
1. src/main.tsx (또는 main entry — index.tsx, App.tsx 중 진입점) 맨 위에:
   import "./styles/tokens.css"
   - 다른 CSS import보다 먼저 와야 함 (override 방지)
2. index.html <head>에 Pretendard JP CDN 추가:
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-jp.css">
3. 만약 기존에 다른 폰트 import가 있다면 (구 Pretendard, Noto 등) 보고만 하고 제거하지는 말 것

규칙:
- 다른 CSS는 일체 건드리지 말 것 (이 단계는 토큰 정의만)
- 컴포넌트 파일 변경 금지
- Tailwind config 변경 금지
- 만약 tokens.css의 변수와 충돌하는 기존 변수가 있다면 발견만 보고

검증:
- npm run build 통과
- npx tsc --noEmit 통과
- npm run dev 후 메인 캘린더 화면 시각적으로 변화 없는지 확인
- 보고: import 위치 / 빌드 결과 / 기존 폰트/CSS 충돌 여부 / 시각 변화 없음 확인
```

**Manual verification**:
- Open dev tools → Computed → check `body` shows `font-family: "Pretendard JP", ...`
- Take a screenshot of main calendar screen — should be identical to before
- DevTools → Application → check no console errors

---

## Phase 2 — Typography activation

**Goal**: Activate body font + weight 500 + line-height + letter-spacing globally.

**Acceptance**:
- Body text across all screens is now weight 500
- Headings unaffected (still 700)
- Buttons unaffected at this stage (Phase 5 handles them)
- No layout breakage (line-height changes can shift things slightly)

### Prompt

```
Body 텍스트 스타일 활성화.

작업:
1. src/styles/tokens.css의 body 셀렉터가 다음과 같이 정의되어 있는지 확인:
   body {
     font-family: var(--font-sans);
     font-weight: var(--weight-medium);
     font-size: 15px;
     line-height: var(--leading-normal);
     letter-spacing: var(--tracking-tight);
   }
   (이미 패키지에 포함되어 있음 — 활성화만 확인)

2. 영향 분석을 먼저 수행:
   - grep으로 font-weight: 400 또는 fontWeight: 400 / "normal" 명시한 곳 찾기
   - 이런 곳은 body 변경에 영향 안 받음 (override 됨)
   - 반대로, weight 미명시 텍스트는 모두 500으로 두꺼워짐
   - 영향 받을 컴포넌트 카테고리별 추정:
     · 캘린더 일정 제목, 일정 설명
     · 폼 라벨, placeholder, 도움말 텍스트
     · 설정 화면 메뉴 텍스트
     · 본문 일반 텍스트
   - 의도하지 않게 깨질 가능성이 있는 곳 (e.g., 매우 좁은 너비에서 줄바꿈 변화)

3. 영향 분석 보고서를 출력하고 내 승인 받은 후 적용

검증:
- npm run build 통과
- 메인 캘린더, 일정 추가, 설정 — 본문이 자연스럽게 두꺼워졌는지 확인
- 헤딩(이미 700이면)은 변화 없음 확인
- 버튼은 component-specific weight를 가져야 — Phase 5에서 처리할 예정이므로 지금은 변화 없거나 살짝 두꺼워져도 OK
- 줄바꿈 또는 overflow 깨진 곳 있으면 보고
```

**Manual verification**:
- Side-by-side screenshot comparison: before vs after — body text visibly thicker
- Check Korean text readability at small sizes (캡션, 메타)
- Compare button labels — should still look right (will be canonicalized in Phase 5)

---

## Phase 3 — Card migration

**Goal**: Replace all card containers with `.card` / `.card-elevated` / `.card-interactive`.

**Acceptance**:
- All cards use the canonical class
- All inline `borderRadius` / `border` / `boxShadow` removed
- Bespoke components (일정 카드, 혜니 포인트, 가족 멤버 카드) keep internal layout but use `.card` baseline
- Modal/Dialog/Toast use `.card-elevated`
- Clickable cards use `.card-interactive` and hover works

### Prompt

```
카드 컴포넌트 마이그레이션.

준비:
1. HYENI_INVENTORY.md에서 카드 후보 목록 가져오기
2. 추가 grep 검증: borderRadius + (border|boxShadow) 조합

분류 기준:
- .card (standard) — 정적 컨테이너, 클릭 X, 떠 있지 않음
- .card-elevated — 떠 있어야 하는 것: Modal, Dialog, Toast, Dropdown, Popover, BottomSheet
- .card-interactive — 클릭 가능한 카드 (목록 아이템, 선택 가능 카드)
- 혜니-bespoke (.card 베이스만) — CLAUDE.md 보존 목록 참고:
  · 일정 카드 (CalendarEventCard 등)
  · 혜니 포인트 표시
  · 가족 멤버 카드
  · 캘린더 그리드 (이건 카드 아닐 수도)

작업:
1. 후보 표 출력:
   | 파일 경로 | 컴포넌트명 | 현재 스타일 (요약) | 제안 클래스 | bespoke여부 |
2. 내가 모든 행 승인할 때까지 대기. 의문점은 행마다 "?"로 표시하고 별도 질문.
3. 승인 후 한 컴포넌트씩 수정:
   - inline style의 borderRadius / border / boxShadow / backgroundColor 제거
   - className에 적절한 클래스 추가 (기존 className 보존)
   - bespoke 컴포넌트: .card만 추가하고 내부 레이아웃 / padding / 색 강조 등 보존
4. 모든 수정 완료 후 변경 파일 목록 + 각 파일 diff 요약

규칙:
- onClick / onChange / hover 핸들러 절대 건드리지 말 것
- prop 인터페이스 보존
- 새 색상값 도입 절대 금지 — tokens.css에 없는 색이 필요하면 멈추고 보고
- bespoke 컴포넌트의 내부 시각 디자인은 건드리지 말 것

검증:
- npm run build / typecheck 통과
- 메인 캘린더 화면 시각 확인 — 카드 그림자 사라지고 hairline으로 통일
- 모달 띄워서 .card-elevated 그림자 작동 확인
- 클릭 가능한 카드 hover 시 색 변화 확인
```

**Manual verification**:
- All cards now have hairline border, no shadow
- Modals/dropdowns still elevated with subtle shadow
- 일정 카드 internal layout (color strip, time, etc.) preserved
- No card looks "broken" or empty

---

## Phase 4 — Input migration

**Goal**: All form inputs use `.input` class.

**Acceptance**:
- All `<input>`, `<textarea>`, `<select>` use `.input` (or are flagged as special)
- Focus halo works (blue 3px halo on focus)
- Placeholder color consistent
- Disabled state uses tokens

### Prompt

```
입력 필드 마이그레이션.

준비:
1. grep으로 모든 입력 요소 찾기:
   - <input ... />
   - <textarea ... />
   - <select ... />
   - input role 컴포넌트 (Radix UI, MUI 등 사용한다면)
2. type별 분류 (text, email, password, number, date, search, tel, url, checkbox, radio, file)
3. 현재 스타일 mechanism (inline / className / wrapper component) 정리

작업:
1. 후보 표 출력:
   | 파일 | 라인 | type | 현재 스타일 | 제안 처리 |
2. 처리 방식:
   - 일반 텍스트 입력 (text/email/password/number/tel/url/search) → .input
   - textarea → .input + 추가 padding (수직 padding 별도 처리)
   - checkbox / radio → .input 적용 금지, 별도 보고 (커스텀 디자인 필요)
   - file input → 보고만 (브라우저 네이티브 스타일 충돌)
   - 특수 형태 (OTP 6자리, masked input 등) → .input 적용 금지, 별도 보고
3. 내 승인 후 진행
4. 각 입력에 .input 추가, 기존 inline의 height / padding / border / background / borderRadius 제거
5. 검색바처럼 prefix 아이콘이 있는 경우: .input은 그대로, wrapper로 아이콘 처리

규칙:
- name / id / value / onChange / onBlur 등 form 속성 모두 보존
- aria-* 속성 보존 (접근성)
- 라벨 컴포넌트는 이번 phase에서 건드리지 말 것 (라벨은 그냥 텍스트)

검증:
- 일정 추가 폼, 회원가입 폼, 검색바 — 시각 확인
- 포커스 시 파란 halo (3px) 작동
- placeholder 색이 --fg-tertiary로 통일
- disabled 상태 회색 처리
- 모바일에서 iOS auto-zoom 안 일어나는지 (font-size 15px 이상이어야 함, OK)
```

**Manual verification**:
- Tab through a form — every input shows blue focus halo
- Test on iOS — no auto-zoom on focus (need font-size ≥ 16px on some devices, but 15px usually OK with viewport meta)
- Disabled inputs grayed out properly

---

## Phase 5 — Button migration ⚠️ HIGH RISK

**Goal**: All buttons use `.btn-primary` / `.btn-secondary` / `.btn-destructive`.

**Acceptance**:
- Every `<button>` and button-role component uses canonical class
- Variant mapping was explicitly approved by user (no auto-classification)
- `disabled`, `:focus-visible`, `:hover`, `:active` all work
- No accidental destructive classification

### Prompt

```
⚠️ 버튼 마이그레이션 — 가장 위험한 단계. 신중하게 진행.

CLAUDE.md 규칙 14번 다시 읽기: "destructive variant 임의 분류 절대 금지"

준비:
1. grep으로 모든 버튼 찾기:
   - <button ... >
   - role="button"
   - styled button 컴포넌트 (Button, IconButton 등)
2. 각 버튼별 정보 수집:
   - 파일 / 라인
   - 버튼 텍스트 (label)
   - 부모 컨텍스트 (어느 화면, 어느 폼, 어느 모달인지)
   - 현재 styling
3. variant 추정 (틀려도 되니까 일단 추정 + 확신도 표시):
   - 메인 액션 (저장, 등록, 확인, 다음, 가입) → btn-primary
   - 보조 액션 (취소, 뒤로, 건너뛰기, 닫기) → btn-secondary
   - 파괴적 액션 (삭제, 탈퇴, 차단, 영구 제거) → btn-destructive
   - 아이콘 버튼 (X, ⋮ 등) → 별도 처리, .btn-sm 또는 커스텀
   - 애매한 것 → "?" 표시

작업:
1. 분류표 출력:
   | 파일 | 라인 | 텍스트 | 컨텍스트 | 추정 variant | 확신도 |
   확신도가 100%가 아닌 모든 행에 대해 "이 분류 맞나요?" 별도 질문 목록.
2. 내가 모든 destructive 분류와 모든 "?"를 명시 승인할 때까지 대기.
   destructive는 한 줄씩 확인 받을 것. 추정으로 진행 절대 금지.
3. 승인 후 화면 단위로 적용 (전체 일괄 X):
   - 한 화면 끝나면 보고
   - 다음 화면 진행 승인 받기
4. 적용 시:
   - <button>의 inline style 또는 기존 className 중 시각 속성 제거
   - .btn .btn-{variant} 클래스 추가
   - 기존 onClick / type="submit" / disabled 등 모든 prop 보존
   - loading 상태 (스피너 등)이 있는 버튼은 loading UI 보존

규칙:
- 절대 onClick 핸들러 변경 금지
- type="submit" 같은 form 속성 보존
- aria-label / aria-pressed 등 접근성 속성 보존
- destructive 임의 분류 = 사용자 데이터 삭제 위험 = 절대 금지
- 특수 버튼 (FAB, 캘린더 셀 클릭 등)은 .btn 적용 보류하고 보고

검증:
- 화면별 시각 확인
- 모든 액션 hover/press 색 변화 작동
- disabled 상태 회색 처리
- 키보드 Tab 시 focus ring 표시 (filled 버튼은 inner halo)
- npm run build / typecheck 통과
```

**Manual verification per screen**:
- Click each primary button — color cycles correctly (default → hover → press)
- Cancel buttons all look secondary (outlined)
- Delete buttons all look destructive (red)
- No button looks broken or wrong-color

---

## Phase 6 — Dark mode + toggle

**Goal**: Activate dark mode tokens, build toggle UI, sync Capacitor StatusBar.

**Acceptance**:
- `:root[data-theme="dark"]` works on toggle
- localStorage persists choice
- System preference detected on first load
- Capacitor StatusBar color syncs with theme
- Splash screen color appropriate per theme
- No flash of wrong theme on load

### Prompt

```
다크모드 활성화 + 토글 UI 구현.

작업:
1. tokens.css의 :root[data-theme="dark"] 블록이 정의되어 있는지 확인 (이미 있음)

2. index.html <head>의 다른 모든 것보다 먼저 flash 방지 스크립트 추가:
   <script>
   (function() {
     try {
       var stored = localStorage.getItem('theme');
       var system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
       var theme = (stored === 'system' || !stored) ? system : stored;
       document.documentElement.dataset.theme = theme;
     } catch (e) {
       document.documentElement.dataset.theme = 'light';
     }
   })();
   </script>

3. ThemeProvider 컴포넌트 생성 (src/providers/ThemeProvider.tsx):
   - state: theme: 'light' | 'dark' | 'system'
   - 초기값: localStorage.getItem('theme') ?? 'system'
   - 실제 적용 theme: state가 'system'이면 matchMedia 결과
   - useEffect로:
     · document.documentElement.dataset.theme 업데이트
     · localStorage 저장
     · matchMedia('(prefers-color-scheme: dark)') 변경 감지 (state === 'system'일 때만)
   - Capacitor 환경 감지 (Capacitor.isNativePlatform()):
     · @capacitor/status-bar import
     · light: StatusBar.setStyle({ style: Style.Light }) + setBackgroundColor('#FFFFFF')
     · dark: StatusBar.setStyle({ style: Style.Dark }) + setBackgroundColor('#0F0F12')
   - Context로 { theme, resolvedTheme, setTheme } 노출

4. 설정 화면에 ThemeToggle 컴포넌트 추가:
   - 3-way segmented control: 라이트 | 다크 | 시스템
   - 현재 선택 시각 표시 (active state)
   - 접근성: role="radiogroup", 각 옵션 role="radio"
   - 텍스트는 한국어

5. App.tsx 또는 root에 <ThemeProvider>로 감싸기

6. capacitor.config.ts splash screen 검토:
   - SplashScreen plugin config:
     · backgroundColor: '#FFFFFF' (light 가정)
     · 다크 splash는 platform-specific 설정 필요 (선택사항, 추후)

7. 패키지 설치 확인:
   - @capacitor/status-bar 미설치면 npm install 후 npx cap sync 안내

규칙:
- 컴포넌트 코드는 이미 토큰 기반이어야 함. 만약 하드코딩 색상 발견 시 → 즉시 멈추고 목록 보고 (Phase 0~5에서 놓친 것)
- ThemeProvider 외 다른 컴포넌트 변경 최소화

검증:
- 토글 3가지 모두 작동: 라이트 / 다크 / 시스템
- 새로고침 후 마지막 선택 유지
- 'system' 모드: OS 다크모드 변경 시 즉시 반영
- 첫 로드 flash 없음 (data-theme이 paint 전에 설정됨)
- 실기기(npx cap run ios / android)에서 StatusBar 색 동기화 확인
```

**Manual verification**:
- Toggle 3-way works, persists across reload
- System mode: change OS dark mode → app follows
- iOS device: StatusBar text/icons readable in both modes
- No flash of light theme on dark mode reload
- Splash screen color appropriate

---

## Phase 7 — Dark mode QA + polish

**Goal**: Audit every screen in dark mode, fix lingering hardcoded colors, validate contrast.

**Acceptance**:
- Every major screen reviewed in both light and dark
- WCAG AA contrast met (4.5:1 body, 3:1 large text/UI)
- No hardcoded colors remaining
- All shadows appropriate per theme

### Prompt

```
다크모드 QA — 시각 검증 + 잔존 이슈 수정.

작업:
1. 각 화면을 light / dark 양쪽 모드로 캡처:
   (Playwright MCP 가능하면 자동, 아니면 수동 스크린샷)
   - 메인 캘린더 (월/주/일 뷰 전부)
   - 일정 추가/수정 모달
   - 가족 관리 화면
   - 혜니 포인트 화면
   - 설정 화면
   - 로그인 / 회원가입
   - 로딩 / 에러 / 빈 상태

2. 발견 이슈 분류:
   - 카테고리 A: 하드코딩 색상 잔존 (다크에서 안 바뀌는 곳)
   - 카테고리 B: 대비 부족 (텍스트가 안 보임 — 4.5:1 미달)
   - 카테고리 C: 보더 안 보임 (line 토큰 잘못 사용)
   - 카테고리 D: 그림자 잔존 (다크에서 거의 안 보여야 정상)
   - 카테고리 E: 색상 의미 변화 (예: 파랑이 회색처럼 보임)

3. 이슈 목록 표 출력 + 우선순위:
   - P0: 텍스트 안 읽힘 / 버튼 안 보임 (즉시 수정)
   - P1: 시각적으로 어색 (수정)
   - P2: 미세 디테일 (선택 수정)

4. 우선순위별로 수정:
   - 하드코딩 색상은 토큰으로 교체
   - 대비 부족은 fg / bg 토큰 한 단계 조정
   - bespoke 컴포넌트는 신중하게 — 디자인 의도 보존

5. 접근성 자동 체크:
   - axe-core devtools 또는 Lighthouse contrast 검사
   - 모든 인터랙티브 요소가 :focus-visible 작동

규칙:
- 새 컴포넌트 만들지 말 것
- tokens.css에 없는 색이 필요하면 멈추고 사용자에게 추가 요청
- 토큰 자체를 수정하는 경우 신중히 — 모든 화면에 영향

검증:
- contrast: 4.5:1 (본문) / 3:1 (UI 요소)
- 모든 화면이 라이트/다크 모두 자연스러움
- Capacitor 실기기 1회 확인 권장
- npm run build / typecheck 통과
```

**Manual verification**:
- Walk through every flow in both themes
- Especially check: 일정 카드 (color category strip), 혜니 포인트 (brand visual), 캘린더 그리드 (오늘 날짜 강조)
- iOS + Android both look right

---

## Rollback strategy

Each phase = one commit, so:
- Phase 3 (cards) result is unsatisfactory → `git revert <phase-3-commit>` and redo
- Tokens themselves need adjustment → reset to right after Phase 1 commit, modify `tokens.css`, then re-apply phases as patch

For adventurous rollback:
```bash
git log --oneline | grep "wanted-ds:"
git revert <commit>      # creates a new "undo" commit, safer
# or
git reset --hard <commit-before>  # destructive, only on local branch
```

---

## When to break the plan

If during any phase:
- You discover a structural issue (e.g., 30+ uncategorized buttons) → pause migration, hold a planning session
- A dependency upgrade is needed (e.g., Tailwind v3 → v4) → handle separately, not in DS migration
- The user wants to add a new feature → finish current phase first, then branch off

The migration plan is more valuable than its individual steps. If a phase is fighting you, the plan is wrong; stop and re-plan.

---

## Pretendard JP downsizing (optional, post-migration)

If the JP variant feels heavy in bundle size and the app is Korean-only:
- Change CDN to standard `pretendard.css`
- Update `--font-sans` in `tokens.css`: drop `"Pretendard JP"`, lead with `"Pretendard"`
- No visual change for Korean glyphs (identical)

Save for after migration is stable.
