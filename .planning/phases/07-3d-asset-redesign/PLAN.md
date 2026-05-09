# Phase 07 — 3D 이모티콘 일관성 리디자인 PLAN

> 사용자 결정 (2026-05-09): "둘 다 동시 진행" + "이모지·마스코트 교체. 그리고 모든 기능에 대해 일관성있는 디자인 교체까지 진행"
>
> 상위 산출물: `src/stitch/STITCH-PROMPTS.md` (Stitch 외부 트랙) · 본 PLAN (코드 직접 통합 트랙)

---

## 1. Goal

`src/stitch/extracted/` 안의 3D 일러스트(배경 투명 PNG, 약 230+장)를 **마스코트, 카테고리/학원 이모지, 동물 캐릭터, UI 아이콘(🔔💗📍 등), 일러스트 영역**에 일관되게 적용. 시각적으로 한 우주(브랜드)에 속한다는 인상을 주는 것이 목표.

**Out of scope (이번 phase):**
- 레이아웃 변경, 컴포넌트 prop 인터페이스 변경
- 이벤트 핸들러·hooks·Supabase 호출 변경
- 다크모드 새 색 토큰 추가
- Stitch 가 받아올 새 화면 시안 생성 — 외부 트랙

---

## 2. Constraints (CLAUDE.md 규칙 준수)

- **token-only**: 색은 토큰만, hex/rgb 직접 사용 금지
- **prop interface 보존**: `<HyeniMascot size variant />` 등 호출부 코드 무수정
- **dark-mode aware**: PNG 자산이 어두운 배경에서도 정상 보이도록 검증 (3D 일러스트는 light bg 가정 — 다크 시 적절한 wrapper)
- **bundle size 가드**: 추가 자산 총량 1.5MB 이내 (현재 마스코트는 인라인 SVG 0KB)
- **silent failure 금지**: 자산 로드 실패 시 fallback (분홍 색 배경의 placeholder)
- **incremental 빌드 green**: 매 step 종료 시 `npm run build` exit 0 + `npx tsc --noEmit` 0 errors
- **단계별 commit**: phase 1 step 단위로 atomic commit, push 는 사용자 승인 후

---

## 3. Pre-decisions (실행 전 사용자 컨펌 필요)

| # | 결정 항목 | 옵션 | 본 plan 의 default |
|---|----------|------|-------------------|
| D1 | 마스코트 hoodie 색 통일 | (a) 분홍만 사용 — `12_59_52` batch 만 / (b) 베이지+분홍 혼용 — `01_54_50 (2)` 표정 시트도 활용 | **(a) 분홍만**. cheer/wave 같은 표정 추가가 필요하면 ChatGPT 재생성 별도 발급 |
| D2 | 145개 이모지 마이그레이션 깊이 | (a) 카테고리·학원·동물·UI 핵심만 (~ 80 occurrence) / (b) 145 전수 | **(a) 핵심**. 본문 콘텐츠 안 emoji (자녀가 직접 쓴 메모 답장 emoji 등) 는 그대로 |
| D3 | 자산 위치 | (a) `src/assets/3d/` (import) / (b) `public/3d/` (URL) | **(a) src/assets/3d/** — Vite tree-shake + hash 가능 |
| D4 | PNG vs WebP | (a) PNG 그대로 / (b) WebP 변환 (~ 50% 크기 절감) | **(b) WebP** — 추출 스크립트 옆에 변환 단계 추가 |
| D5 | 자산 사이즈 책정 | (a) 단일 사이즈 / (b) `@1x @2x` 두 사이즈 / (c) 360px 단일 (CSS scale) | **(c) 360px 원본** — 마스코트 hero, mid, small 모두 CSS `width` 로 처리 |

> 컨펌 받기 전엔 코드 변경 시작 안 함.

---

## 4. Step Breakdown

### Step 1 — 자산 큐레이션 + 매핑 테이블 (코드 변경 없음, 메타만)

**작업:**
- WebP 변환 스크립트 추가 (`src/stitch/optimize_assets.py`) — extracted/ 의 PNG 를 `src/assets/3d/<semantic-name>.webp` 로 복사+변환
- 의미 명명 매핑표 (`src/assets/3d/INDEX.md`):
  - `mascot/static.webp` <- extracted/.../12_59_52 (1)/element-01.png
  - `mascot/wave.webp` <- .../12_59_52 (10)/element-01.png
  - `mascot/phone.webp` <- .../12_59_52 (9)/element-01.png
  - `mascot/heart.webp` <- .../12_59_52 (6)/element-01.png
  - `category/school.webp` <- .../01_54_53 (8)/element-NN.png (학교 건물)
  - `category/sports.webp` <- .../01_54_51 (5)/element-NN.png (덤벨)
  - `category/hobby.webp` <- .../01_54_51 (5)/element-NN.png (팔레트)
  - `category/family.webp` <- .../01_54_50 (1)/element-NN.png (가족 hug)
  - `category/friend.webp` <- .../01_54_53 (8)/element-NN.png (친구 두 명)
  - `category/other.webp` <- .../01_54_53 (10)/element-NN.png (별)
  - `ui/bell.webp` <- .../12_59_52 (8)/element-01.png
  - `ui/heart-pink.webp` <- .../12_59_52 (6)/element-01.png
  - `ui/pin.webp` <- .../12_59_52 (4)/element-01.png
  - `ui/shield.webp` <- .../12_59_52 (7)/element-01.png
  - `ui/calendar-heart.webp` <- .../12_59_52 (3)/element-01.png
  - `ui/calendar-check.webp` <- .../12_59_52 (2)/element-01.png
  - `animal/{rabbit,cat,dog,fox,chick,bear,panda,tiger}.webp` <- .../01_54_53 (10)/element-NN.png
  - `place/{school,academy,library,playground,store,home,bus-stop,...}.webp` <- .../01_54_53 (8)/element-NN.png

**산출:**
- `src/assets/3d/` 디렉토리 (WebP 약 35-50개)
- `src/assets/3d/INDEX.md` (Markdown 매핑표)
- `src/stitch/optimize_assets.py`

**Acceptance:**
- 디렉토리 존재 + INDEX.md 의 모든 경로가 실제 파일과 매칭
- 총 자산 크기 < 1.5MB
- 빌드 변경 없음 (자산만 추가, import 아직 없음)

**위험:**
- element-NN 의미를 잘못 매핑하면 후속 step 모두 영향 → INDEX.md 작성 시 사용자 spot-check 1회 필요

---

### Step 2 — 마스코트 컴포넌트 교체

**작업:**
- `src/components/auth/HyeniMascot.jsx` 인라인 SVG → `<img>` (또는 `<picture>`) WebP 자산
- 기존 prop 인터페이스 (`size`, `variant`, `className`, `aria-label`) 전부 보존
- variant 매핑:
  - `variant="static"` → `mascot/static.webp`
  - `variant="wave"` → `mascot/wave.webp`
  - 기존 wave 의 CSS keyframe `hyeni-mascot-wave-arm` 은 PNG 위에서 동작하지 않으므로 제거 또는 wrapper bounce 로 대체
- theme color tinting 은 PNG 가 이미 분홍이라 token 의존성 단순화 (다크모드 시 wrapper bg 만 처리)

**영향 파일 (호출 6곳):**
- `src/components/auth/HyeniMascot.jsx` (구현)
- `src/components/auth/RoleSetupModal.jsx` (사용)
- `src/components/auth/ChildEntryTransition.jsx`
- `src/components/multichild/PairingWizard/PairingWizard.jsx`
- `src/components/multichild/HomeDashboard/HomeGreeting.jsx`
- `src/components/multichild/HomeDashboard/NextEventHero.jsx`
- `src/App.jsx`

**Acceptance:**
- 6 사용처가 코드 수정 없이 새 마스코트 렌더
- size 32 / 56 / 96 / 144 모두 깨지지 않음 (px-perfect)
- 다크모드에서도 자연스러움 (검증: `prefers-color-scheme: dark` toggle)
- `npm run build` 0 errors

---

### Step 3 — 카테고리 + 학원 preset 이모지 → 3D 아이콘 컴포넌트

**작업:**
- 새 컴포넌트 `src/components/icons/CategoryIcon.jsx` 생성
  - prop: `categoryId` ("school"/"sports"/...) + `size`
  - 내부에서 INDEX.md 매핑에 따라 webp 렌더
- `src/lib/scheduleCategories.js` 의 emoji 필드는 **그대로 유지** (텍스트 fallback). 새 `iconKey` 필드 추가 (예: `iconKey: "school"`).
- `<CategoryIcon categoryId={cat.id} />` 으로 호출하는 위치만 교체
- 학원 preset 도 같은 패턴 (`AcademyIcon` 컴포넌트 또는 generic `ThreeDIcon` 으로 통합)

**영향 파일 (10개 추정):**
- `src/lib/scheduleCategories.js`
- `src/components/multichild/EventModal/EventSheet.jsx`
- `src/components/place-management/AcademyManager.jsx`
- `src/components/place-management/AcademyCard.jsx`
- `src/components/aiSchedule/AiScheduleModal.jsx`
- `src/components/timetable/DayTimetable.jsx`
- `src/components/multichild/HomeDashboard/NextEventHero.jsx`
- `src/components/multichild/ChildDetail/ChildDetailScreen.jsx`
- `src/components/childMode/ChildHero.jsx`
- 기타 일정 row 렌더링하는 곳

**Acceptance:**
- 6 카테고리 모두 3D 아이콘으로 표시
- 학원 preset 10개 중 매핑 가능한 것은 3D, 매핑 없는 것 (예: 코딩 💻) 은 emoji fallback
- 기존 색상 토큰(cat-academy 등)은 카드 border/bg 에 그대로 사용

---

### Step 4 — 동물 캐릭터 (자녀 선택)

**작업:**
- 기존 `family_members.emoji` 필드(🐰🐱🐶🦊🐥🐻🐼🐯)는 DB 저장 유지
- 렌더 시점에만 emoji → 3D 캐릭터 매핑 (`src/components/icons/AnimalIcon.jsx`)
- ChildSettingsScreen 에서 8개 grid 도 3D 캐릭터 picker 로 교체

**영향 파일 (자녀 캐릭터 노출처):**
- `src/components/childMode/ChildSettingsScreen.jsx` (picker)
- `src/components/multichild/ChildDetail/ChildDetailScreen.jsx`
- `src/components/multichild/HomeDashboard/ChildSummaryCard.jsx`
- `src/components/childMode/ChildHero.jsx`
- 기타 자녀 아바타 렌더 위치 (사진 없을 때 fallback)

**Acceptance:**
- 8종 모두 3D 캐릭터로 픽커·표시 동작
- DB emoji 값 무수정 (RLS·sync 영향 없음)

---

### Step 5 — UI 이모지(🔔💗📍📅) Icon 컴포넌트 전환

**작업:**
- generic `<ThreeDIcon name="bell|heart|pin|calendar-heart|shield|..." size />` 컴포넌트
- 핵심 6 이모지 우선 (bell, heart, pin, shield, calendar-heart, calendar-check)
- D2 default: 본문 콘텐츠 emoji (메모 답장, 사용자 입력) 는 그대로 — 시스템 chrome (헤더 아이콘, 빈 상태, banner) 만 교체

**우선 교체 위치 (대략 80 occurrence):**
- 부모 헤더 종 🔔 / 하트 💗 (App.jsx)
- 위치 📍 (ChildTrackerOverlay, RouteOverlay, NextEventHero)
- 권한·안전 방패 (PermissionBanner, AlertBanner)
- 다음 일정 / 캘린더 헤더 아이콘
- 메모/스티커 헤더

**Acceptance:**
- 핵심 6 아이콘 시각 통일
- 그 외 자녀 콘텐츠 emoji (sticker grid, memo bubble) 는 변경 없음
- 145 → 약 80 occurrence 교체 (나머지 65는 의도적으로 유지)

---

### Step 6 — Empty / Hero / Splash 일러스트

**작업:**
- SplashScreen: 마스코트 + 분홍 노트 시리즈 일러스트
- RoleSetupModal Card B(자녀): `mascot/static.webp` 적용
- RoleSetupModal Card A(부모): `mascot/phone.webp` 적용 (성숙 톤)
- ChildPairInput (HARD GATE): `mascot/wave.webp` hero
- NextEventHero 빈 상태: `mascot/static.webp` 32px trailing
- HomeGreeting trailing: `mascot/phone.webp` 36px
- PairingWizard Step 5 cheer: 별도 cheer 자산 필요 — 사용자가 ChatGPT 재생성 발급 시까지 wave 로 임시 사용

**Acceptance:**
- 7화면(STITCH-PROMPTS.md §1~§7 매핑) 의 hero/empty 영역에 3D 자산 적용
- 시각 회귀: screenshots/captured/ 와 비교한 before/after 1세트 캡처

---

### Step 7 — 일관성 가이드 + 시각 회귀 검증

**작업:**
- `docs/3D-ASSET-USAGE.md` (또는 `src/assets/3d/USAGE.md`):
  - 어떤 자산을 어디 쓰는지 (마스코트, 카테고리, 동물, UI 아이콘 매트릭스)
  - 새 화면 만들 때 어떤 컴포넌트 호출하는지 (`<HyeniMascot>`, `<CategoryIcon>`, `<AnimalIcon>`, `<ThreeDIcon>`)
  - 다크모드 wrapper 패턴
- 부모/자녀 핵심 7화면 screenshot 비교본
- adb install 두 기기 — 시각 회귀 spot-check (R5CY521CFNZ, ZY22H9VTQD — auto-ship workflow)

**Acceptance:**
- 가이드 문서 작성
- 두 기기에서 시각 회귀 0 critical
- `npm run build` 0 errors, `npx tsc --noEmit` 0 errors

---

## 5. Rollback Plan

각 step 별 atomic commit. 문제 발생 시 step 단위 `git revert`. Step 1 자산 추가는 항상 안전 (코드 미사용). Step 2~6 의 컴포넌트 교체는 prop interface 보존이라 호출부 영향 없음.

---

## 6. Estimated effort

| Step | 예상 시간 | 영향 파일 수 |
|------|----------|-------------|
| 1. 자산 큐레이션 | 30~45분 | 자산 + INDEX |
| 2. 마스코트 교체 | 25~35분 | 1 (구현) + 6 (호출부 검증) |
| 3. 카테고리 아이콘 | 45~60분 | ~10 |
| 4. 동물 캐릭터 | 25~35분 | ~5 |
| 5. UI 이모지 | 60~90분 | ~20 (80 occurrence) |
| 6. Empty/Hero/Splash | 35~50분 | ~7 |
| 7. 가이드 + 회귀 | 25~35분 | 1 (docs) |
| **총계** | **약 4~6시간** | **~50 파일** |

---

## 7. Sequencing

- Step 1 → 2 → 3·4 (병렬 가능) → 5 → 6 → 7
- Step 3·4 는 자산이 다르고 호출부도 다르므로 병렬 안전
- 매 step 종료 시 사용자에게 결과 요약 + 다음 step 진행 묻기

---

## 8. Decisions awaiting user (요약)

위 §3 5개 decision (D1~D5) 컨펌 + 이 plan 자체의 step 순서·범위 컨펌이 있으면 Step 1 시작.

이 PLAN 자체에 추가/삭제/순서 변경 의견이 있으시면 알려주세요.
