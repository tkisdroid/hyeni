# Theme System · v1.1 SPEC

**Status:** Draft (awaiting user approval)
**Authored:** 2026-04-30
**Milestone:** v1.1 (분리 — v1.0 emergency stabilization과 병행 금지)
**디자인 시안:** `design/Theme Picker · v1.html` ~ `v5.html` (sign-off 완료)

---

## 1. Context · 왜

현재 앱은 핑크 톤 + 부분적 다른 색이 혼재 (parent blue, success green 등). 사용자가 회원가입 시 본인 가족의 정체성을 표현할 색을 선택해서 가족 전체 디바이스에 일관 반영하길 원함.

핵심 의도:
- 가족 단위 색상 정체성 (자녀가 부모와 같은 색 보면 "우리집"이라는 소속감)
- 안전 신호색 (SOS 빨강, 경고 amber, 부모 파랑, 카테고리 4색)은 절대 변경 금지
- 시안 v1-v5에서 6 테마 풀 팔레트 + 안전 잠금 시스템 검증 완료

---

## 2. Scope

### In scope (v1.1)

1. `families.theme` 컬럼 추가 (text default `'warm-pink'`, check constraint)
2. `src/lib/theme.js` 신규 — 6 테마 정의 + CSS variable 주입 함수
3. `src/App.jsx` DESIGN object를 CSS 변수 참조로 전환 (108 사용처)
4. 회원가입 플로우에 색상 선택 단계 추가 (5단계 → 6단계)
5. 설정 화면에 "우리집 색깔" 변경 항목 추가
6. Realtime sync — 한 디바이스에서 변경 시 가족 전체 즉시 반영

### Out of scope (v1.2+)

- ChildPalette (자녀 6색 구분) 시스템 변경 — **현재 그대로 유지**, 테마와 별개
- 다크모드 — 별도 dimension, 현재 6 테마는 모두 라이트
- 사용자 정의 색상 (HEX 입력) — 6 프리셋만
- 테마별 일러스트/이모지 변형 — 색상만 적용

### 명시적 비목표

- v1.0 emergency milestone (Phase 1~5) 작업과 충돌 금지 — 별도 브랜치
- `src/App.jsx` 분해 금지 (CLAUDE.md 정책 유지)

---

## 3. Constraints

| 제약 | 출처 | 대응 |
|---|---|---|
| App.jsx 6877줄 monolith 분해 금지 | CLAUDE.md | DESIGN 객체 내부만 수정, line 794-851 범위 |
| 라이브 프로덕션 데이터 | CLAUDE.md | Supabase branch → Playwright real-services E2E → main |
| 안전 신호색 변경 금지 | memory: design_color_rules | `--safe-*` `--cat-*` 변수 hardcode, theme override 차단 |
| v1.0 emergency 병행 금지 | CLAUDE.md | 별도 feature 브랜치, v1.0 phases 완료 후 머지 |

---

## 4. Architecture

### 4.1 Theme model

**6 테마** (시안 v2-v5 검증 완료):

| ID | 이름 | Primary | Soft | Deep | Text |
|---|---|---|---|---|---|
| `warm-pink` | 따뜻한 핑크 (현재) | `#F779A8` | `#FFF5FA` | `#E65C92` | `#B0477A` |
| `soft-lavender` | 부드러운 라벤더 | `#A78BFA` | `#F5F3FF` | `#7C3AED` | `#6D28D9` |
| `mint-fresh` | 상쾌한 민트 | `#10B981` | `#ECFDF5` | `#059669` | `#047857` |
| `sky-blue` | 맑은 하늘 | `#3B82F6` | `#EFF6FF` | `#2563EB` | `#1D4ED8` |
| `sunny-amber` | 햇살 amber | `#F59E0B` | `#FFFBEB` | `#D97706` | `#B45309` |
| `cool-charcoal` | 차분한 차콜 | `#475569` | `#F8FAFC` | `#334155` | `#1E293B` |

각 테마 = 8 토큰 × 1 그라디언트 = 9 CSS 변수.

### 4.2 CSS Variable 시스템

```css
/* theme.css — 전역 주입 */
:root {
  /* 테마 변수 (런타임에 JS가 덮어씀) */
  --th-primary: #F779A8;
  --th-deep:    #E65C92;
  --th-text:    #B0477A;
  --th-soft:    #FFF5FA;
  --th-line:    #FFE4EF;
  --th-line-strong: #FFD4E7;
  --th-grad-primary: linear-gradient(135deg, #F779A8 0%, #E65C92 100%);
  --th-grad-shell:   /* radial gradient 유지 */;

  /* 안전 잠금 변수 (절대 변경 금지) */
  --safe-sos:    #DC2626;
  --safe-warn:   #D97706;
  --safe-parent: #3B82F6;
  --safe-success: #059669;

  /* 카테고리 색 (절대 변경 금지) */
  --cat-school:   #3B82F6;
  --cat-academy:  #8B5CF6;
  --cat-family:   #F779A8;
  --cat-hospital: #EF4444;
}
```

### 4.3 DESIGN 객체 전환

**Before** (App.jsx line 794-851):
```js
const DESIGN = Object.freeze({
  colors: { pink: "#F779A8", pinkSoft: "#FFF5FA", ... }
});
```

**After**:
```js
const DESIGN = Object.freeze({
  colors: {
    pink:     "var(--th-primary)",
    pinkDeep: "var(--th-deep)",
    pinkText: "var(--th-text)",
    pinkSoft: "var(--th-soft)",
    pinkLine: "var(--th-line)",
    pinkLineStrong: "var(--th-line-strong)",

    // 안전 색은 변수 그대로
    parent:   "var(--safe-parent)",
    success:  "var(--safe-success)",
    warning:  "var(--safe-warn)",
    danger:   "var(--safe-sos)",
    // 기타 ink/muted 등 중립색은 hardcode 유지
  }
});
```

108 사용처는 그대로 — `DESIGN.colors.pink`가 알아서 `var(--th-primary)` 반환.

### 4.4 `src/lib/theme.js` (신규)

```js
export const THEMES = { 'warm-pink': {...}, 'soft-lavender': {...}, ... };

export function applyTheme(themeId) {
  const theme = THEMES[themeId] ?? THEMES['warm-pink'];
  const root = document.documentElement;
  Object.entries(theme.tokens).forEach(([key, value]) => {
    root.style.setProperty(`--th-${key}`, value);
  });
}

export function subscribeFamilyTheme(familyId, supabase) {
  // Realtime channel: families:id=eq.{familyId} → applyTheme on UPDATE
}
```

### 4.5 회원가입 플로우 변경

**Before** (5단계): 역할 → 가족 만들기 → 권한 → 페어링 → 완료

**After** (6단계): 역할 → 가족 만들기 → 권한 → **색상 선택** → 페어링 → 완료

색상 선택 UI = 시안 v3 Section 2 그대로 (6 카드 grid + 미리보기 strip). 선택 시 `applyTheme()` 즉시 호출 → 다음 화면부터 새 테마 보임. `createFamily()` insert에 `theme: selectedThemeId` 포함.

### 4.6 Realtime sync

- 부모 디바이스에서 설정 변경 → `families` UPDATE → Realtime publication에 이미 포함되어 있음 확인 필요
- 자녀 디바이스 + 다른 부모 디바이스 → channel subscribe → `applyTheme(newTheme)` 호출
- 페어링되지 않은 자녀는 부모 가입 시 선택한 테마를 자동 상속

---

## 5. Phased Implementation

### Phase A · DB + 테마 라이브러리 (1일)

**파일:**
- `supabase/migrations/2026XXXXXXXXXX_families_theme.sql` (up)
- `supabase/migrations/down/2026XXXXXXXXXX_families_theme.sql` (down)
- `src/lib/theme.js` (신규)
- `src/index.css` 또는 `src/theme.css` — `:root` 기본 변수 정의

**작업:**
1. Supabase branch에서 migration 적용 → 6 테마 ID check constraint
2. `theme.js` 작성 + Vitest unit test (applyTheme이 모든 9 변수 set 하는지)
3. Realtime publication에 families 테이블 포함 여부 확인 (이미 있으면 skip)

**검증:** Vitest pass + branch DB에서 SELECT theme FROM families 정상

### Phase B · App.jsx DESIGN 토큰 변환 (2일)

**파일:** `src/App.jsx` line 794-851

**작업:**
1. `DESIGN.colors.pink*` 6 토큰 → `var(--th-*)` 참조
2. `DESIGN.gradients.primary/child/hero` → `var(--th-grad-*)` 참조
3. `DESIGN.colors.parent/success/warning/danger` → `var(--safe-*)` 참조
4. 카테고리 색 사용처 grep → `var(--cat-*)` 참조
5. App.jsx 최상위에 `<Theme>` 효과: 마운트 시 `applyTheme(family?.theme ?? 'warm-pink')`

**검증:**
- `npm run dev` → 기본 핑크 그대로 (회귀 없음)
- DevTools에서 `:root` 스타일 변경 → 모든 핑크 사용처가 즉시 변경
- Playwright snapshot 비교 (warm-pink 적용 시 기존과 동일)

### Phase C · 회원가입 색상 선택 단계 (1일)

**파일:**
- `src/components/onboarding/ThemePickerStep.jsx` (신규)
- `src/App.jsx` ParentSetupScreen (line 919) — wizard step 추가
- `src/lib/auth.js` createFamily — insertRow에 `theme` 추가

**작업:**
1. ThemePickerStep 컴포넌트 (시안 v3 6 카드 grid)
2. 회원가입 wizard에 step 삽입 (권한 다음, 페어링 이전)
3. 선택 즉시 `applyTheme()` 호출 → 다음 단계부터 새 색상
4. createFamily insert/update에 theme 포함

**검증:**
- E2E (Playwright real config): 신규 가족 생성 → 6 테마 중 mint 선택 → 페어링 코드 화면이 mint로 보임 → DB families.theme = 'mint-fresh'

### Phase D · 설정 변경 + Realtime sync (1일)

**파일:**
- `src/App.jsx` 설정 화면 ("우리집 색깔" 항목) — 시안 v3 Section 2 라디오 리스트
- `src/lib/theme.js` `subscribeFamilyTheme()`

**작업:**
1. 설정 → 맞춤 → 우리집 색깔 (6 라디오 + 즉시 미리보기)
2. 변경 시 `families.theme` UPDATE
3. App.jsx mount 시 `subscribeFamilyTheme(familyId)` 시작
4. 다른 디바이스 변경 → 0.5초 내 화면 색 변경

**검증:**
- 두 디바이스 (R5CY521CFNZ, ZY22H9VTQD) 동시 로그인 후 한쪽에서 변경 → 다른쪽 즉시 반영 (수동 스모크)

### Phase E · QA + 회귀 + 문서 (0.5일)

**작업:**
1. 6 테마 × 주요 5 화면 (홈/일정/지도/도움/설정) Playwright 스크린샷 매트릭스
2. SOS 버튼이 6 테마 모두에서 빨강 유지 확인
3. 카테고리 점이 6 테마 모두에서 동일 색 확인
4. memory 업데이트 — design_direction.md에 v1.1 결과 기록
5. CLAUDE.md → v1.1 milestone 항목 추가

**검증:** `npm run verify` (Vitest + Playwright 모두 pass)

---

## 6. Test Plan

| 레이어 | 도구 | 케이스 |
|---|---|---|
| Unit | Vitest | `applyTheme()` 9 변수 set 검증, 잘못된 ID → fallback to warm-pink |
| Unit | Vitest | `createFamily()` theme 컬럼 포함 |
| E2E | Playwright real | 신규 가족 → 색상 선택 → DB persist → 재로그인 시 유지 |
| E2E | Playwright real | 설정에서 변경 → 다른 디바이스 Realtime 반영 |
| 회귀 | Playwright snapshot | warm-pink 적용 시 기존 UI와 픽셀 동일 (anti-regression) |
| 수동 | 두 폰 | 부모 → 자녀 동기화 (위 Phase D 검증과 중복 OK) |

---

## 7. Rollout

1. Feature 브랜치 `feat/v1.1-theme-system` 생성
2. v1.0 emergency milestone (Phase 1~5) 완료까지 머지 보류
3. v1.0 main 머지 후 → feat 브랜치 rebase
4. Supabase branch에서 migration 검증 → main DB 적용
5. Play Store internal testing track 배포
6. 두 디바이스 (R5CY521CFNZ, ZY22H9VTQD) 실기기 검증
7. Production 배포

---

## 8. Open Questions

1. **회원가입 시 색상 미선택**: skip 허용? → 기본 `warm-pink`로 진행, 나중에 변경 가능
2. **테마 변경 시 자녀 디바이스 알림**: "엄마가 색깔을 바꿨어요!" 토스트 띄울지? → MVP에서는 silent, v1.2 검토
3. **색맹 접근성**: amber/charcoal이 색맹에게 구분 어려움 — 카드에 패턴/아이콘 추가? → MVP skip, 별도 a11y 마일스톤
4. **테마 ID 마이그레이션**: 기존 가족들은 `'warm-pink'` 디폴트 → 이후 변경 권유 푸시? → silent, 사용자 자발적 변경

---

## 9. 리스크

| 리스크 | 가능성 | 영향 | 대응 |
|---|---|---|---|
| App.jsx CSS 변환 시 일부 색 누락 | 중 | 회귀 | Phase B 끝에 grep으로 hex 색상 잔존 확인 + Playwright snapshot |
| Realtime publication에 families 미포함 | 중 | 동기화 안됨 | Phase A에서 사전 확인, 없으면 alter publication |
| 안전 색 override 실수 | 낮 | SOS 색 변경 위험 | `--safe-*` 변수는 :root에서만 정의, 테마 JS는 `--th-*`만 set |
| v1.0 milestone과 머지 충돌 | 중 | 회귀 | 별도 브랜치, v1.0 완료 후 rebase |

---

## 10. Definition of Done

- [ ] 6 테마 모두 회원가입에서 선택 가능
- [ ] 선택한 테마가 DB families.theme에 저장됨
- [ ] App.jsx 모든 핑크 사용처가 테마에 따라 색 변경됨
- [ ] SOS/경고/카테고리 색은 테마와 무관하게 고정됨
- [ ] 설정에서 변경 가능 + Realtime으로 가족 전체 동기화
- [ ] Vitest + Playwright real 모두 pass
- [ ] 두 실기기에서 수동 스모크 완료

---

**다음 액션:** 사용자가 본 SPEC을 검토하고 승인하면 Phase A 착수.
