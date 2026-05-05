# Phase 1 Design Spec — Splash · 역할 선택 · 학부모 로그인

> 2026-05-05 · 4 공유 진입 화면 redesign · sign-off 대상 문서
> 리서치: `.lazyweb/design-research/redesign-phase1-2026-05-05/report.md`
> 기준 토큰: `src/styles/tokens.css` (Wanted DS) + `src/App.css` (`--theme-accent` = #F779A8 brand pink)
> CLAUDE.md hard rules 준수: 토큰만 사용, spacing 4px grid, body weight 500, stroke-first cards, dark-mode aware

---

## 1. 범위와 비범위

### IN scope (Phase 1)
- 화면 1: **Splash + 세션 복원 로딩** (신규)
- 화면 2: **RoleSetupModal** (재구성)
- 화면 3: **ParentAuthScreen** (재구성)
- 화면 4: 자녀 모드 즉시 진입 시 **첫 인사 transition** (1초 micro)

### OUT of scope (후속 Phase)
- 페어링 마법사 본체 (Phase 4)
- 권한 마법사 (Phase 3)
- 마스코트 일러스트 *세트 production* — Phase 1은 스플래시·자녀 카드용 1-2개 illustration만

### 보존 (변경 금지)
- 모든 기존 핸들러: `kakaoLogin`, `signInWithLoginId`, `requestPhoneSignupCode`, `verifyPhoneSignupCode`, `setMyRole`
- `localStorage` 기존 키: `hyeni-has-visited`, `hyeni-pairing-intent`
- 6 테마 픽커 (`--theme-accent` 동적 override 그대로 작동해야 함)
- AppBrandLogo 컴포넌트 (사이즈/사용처만 조정)

---

## 2. 디자인 토큰 — 신규 추가

### 2.1 Spacing — 진입 화면 전용
기존 4px grid 그대로. 신규 alias 1개 추가:

```css
/* src/styles/tokens.css 추가 */
--space-screen-pad: 24px;   /* alias for --space-6, 진입 화면 좌우 패딩 표준 */
--space-screen-gap: 48px;   /* alias for var(--space-12), 화면 내 섹션 간격 */
```

### 2.2 Mode tone tokens — 신규 (Phase 1 도입, 후속 phase에서 확장)
부모/자녀 두 톤의 *공식 차이*를 토큰화. 색은 그대로지만 *강도/높이/radius*가 다름.

```css
:root {
  /* Parent mode — Minimal-Pro tone */
  --mode-parent-card-height: 80px;
  --mode-parent-card-radius: var(--radius-card);    /* 16px, stroke-first */
  --mode-parent-card-bg: var(--bg-base);
  --mode-parent-card-border: 1px solid var(--line-soft);
  --mode-parent-card-shadow: var(--shadow-none);
  --mode-parent-icon-size: 32px;

  /* Child mode — Playful-Character tone */
  --mode-child-card-height: 104px;
  --mode-child-card-radius: var(--radius-2xl);     /* 20px, 약간 더 부드럽게 */
  --mode-child-card-bg:
    linear-gradient(135deg, var(--theme-accent-soft) 0%, var(--bg-base) 100%);
  --mode-child-card-border: 1px solid var(--theme-accent-line);
  --mode-child-card-shadow: var(--hyeni-shadow-card);  /* pink-tinted */
  --mode-child-mascot-size: 56px;
}

/* Dark mode override */
@media (prefers-color-scheme: dark) {
  :root {
    --mode-child-card-bg:
      linear-gradient(135deg,
        color-mix(in srgb, var(--theme-accent) 12%, var(--bg-base)) 0%,
        var(--bg-base) 100%);
  }
}
```

### 2.3 Motion — 진입 micro-interactions
```css
--duration-screen-fade: 280ms;     /* splash → role transition */
--duration-mascot-bounce: 600ms;   /* child card hover bounce */
--easing-mascot: cubic-bezier(0.34, 1.56, 0.64, 1);  /* slight overshoot */
```

### 2.4 Typography — 진입 화면 위계 (신규 클래스)
```css
.t-screen-title {
  font-size: 26px;
  font-weight: var(--weight-bold);    /* 700 */
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
  color: var(--fg-primary);
}
.t-screen-subtitle {
  font-size: 14px;
  font-weight: var(--weight-medium);  /* 500 */
  line-height: var(--leading-normal);
  color: var(--fg-secondary);
}
.t-screen-promise {
  font-size: 12px;
  font-weight: var(--weight-semibold); /* 600 */
  letter-spacing: 0.02em;
  text-transform: uppercase;          /* 영문만, 한글은 효과 없음 — 안전 */
  color: var(--theme-accent-text);
}
```

---

## 3. 화면별 Spec

### 3.1 Splash + 세션 복원 로딩

#### 트리거
- App 마운트 직후, `getSession()` 또는 `getMyFamily()` 진행 중
- 현재: `RoleSetupModal`에 `loading={true}` 전달 (텍스트만 변함)
- 신규: 별도 컴포넌트 `<SplashScreen />` 으로 분리, 로딩 끝나면 cross-fade로 RoleSetupModal에 자리 양보

#### 레이아웃
```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│                                     │  (top safe-area + space-12)
│         [88px AppBrandLogo]         │
│            혜니캘린더                │  ← .t-screen-title
│                                     │
│        가족 일정 동기화 중           │  ← .t-screen-subtitle
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░ │   │  ← skeleton card 1
│  └─────────────────────────────┘   │     height: 80px
│                                     │     gap: var(--space-3)
│  ┌─────────────────────────────┐   │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░ │   │  ← skeleton card 2
│  └─────────────────────────────┘   │     height: 104px
│                                     │
│                                     │
└─────────────────────────────────────┘
```

#### 토큰 매핑
| 요소 | 토큰 |
|---|---|
| 배경 | `var(--bg-subtle)` |
| 좌우 패딩 | `var(--space-screen-pad)` (24px) |
| 로고-제목 간격 | `var(--space-4)` (16px) |
| 제목-서브 간격 | `var(--space-2)` (8px) |
| 서브-skeleton 간격 | `var(--space-screen-gap)` (48px) |
| Skeleton 카드 1 height | `var(--mode-parent-card-height)` (80px) |
| Skeleton 카드 2 height | `var(--mode-child-card-height)` (104px) |
| Skeleton bg | `linear-gradient(90deg, var(--bg-muted) 0%, var(--bg-subtle) 50%, var(--bg-muted) 100%)` + shimmer animation 1.4s infinite |
| Skeleton radius | `var(--radius-card)` / `var(--radius-2xl)` |

#### Motion
- 마운트: opacity 0 → 1, `var(--duration-base)` (200ms)
- Skeleton shimmer: `background-position-x` 애니메이션 1400ms infinite linear
- Splash → RoleSetupModal: `var(--duration-screen-fade)` (280ms) cross-fade
- `prefers-reduced-motion`: shimmer 정지, 단색 `var(--bg-muted)`

#### 종료 조건
- 세션 fetch 완료 OR 최대 1500ms 경과 — 둘 중 빠른 것
- (1500ms 후에도 로딩 중이면 skeleton 유지, RoleSetupModal로 전환하지 않음)

---

### 3.2 RoleSetupModal — 재구성

#### 레이아웃
```
┌─────────────────────────────────────┐
│  [한 가족, 두 시점]                  │  ← .t-screen-promise (top promise banner)
│                                     │
│         [72px AppBrandLogo]         │
│            혜니캘린더                │  ← .t-screen-title
│        함께 보는 우리 가족 일정       │  ← .t-screen-subtitle
│                                     │
│  ─── 마지막 사용 역할 hint ───      │  ← (조건부, 아래 3.2.1 참고)
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 👤  학부모            ›    │   │  ← Parent card (80px, white, stroke)
│  │     ID·카카오로 로그인       │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🍦  아이              ›    │   │  ← Child card (104px, pink gradient)
│  │     부모님 코드로 시작        │   │     (mascot illustration 56px)
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

#### 컴포넌트 spec

##### Top promise banner
- 텍스트: `한 가족, 두 시점` (대안: `함께 쓰는 캘린더 · 부모와 아이`)
- 클래스: `.t-screen-promise`
- 정렬: 가운데
- 위치: top safe-area + `var(--space-4)`
- 표시 조건: 항상 (재방문에도 약속 재확인 효과)

##### Parent card
| 항목 | 값 |
|---|---|
| 높이 | `var(--mode-parent-card-height)` (80px) |
| 배경 | `var(--mode-parent-card-bg)` (white) |
| 테두리 | `var(--mode-parent-card-border)` (1px solid line-soft) |
| 그림자 | `var(--mode-parent-card-shadow)` (none) |
| Radius | `var(--mode-parent-card-radius)` (16px) |
| 아이콘 | system icon `User` outline (Lucide / heroicons), `var(--mode-parent-icon-size)` (32px) — emoji 폐기 |
| 아이콘 color | `var(--fg-secondary)` |
| 아이콘 좌측 여백 | `var(--space-5)` (20px) |
| 라벨 "학부모" | 17px, weight-bold, `var(--fg-primary)` |
| 보조 카피 "ID·카카오로 로그인" | 13px, weight-medium, `var(--fg-secondary)` |
| Chevron | `›`, 17px, `var(--fg-tertiary)`, 우측 여백 `var(--space-5)` |
| Hover | `border-color: var(--line-default)`, `bg-subtle` |
| Active | `transform: scale(0.98)` (간소함) |

##### Child card
| 항목 | 값 |
|---|---|
| 높이 | `var(--mode-child-card-height)` (104px) |
| 배경 | `var(--mode-child-card-bg)` (pink → white gradient) |
| 테두리 | `var(--mode-child-card-border)` (1px solid theme-accent-line) |
| 그림자 | `var(--mode-child-card-shadow)` (pink-tinted) |
| Radius | `var(--mode-child-card-radius)` (20px) |
| 마스코트 | SVG illustration, `var(--mode-child-mascot-size)` (56px) — Phase 1 신규 자산 (3.5 참고) |
| 라벨 "아이" | 18px, weight-bold, `var(--theme-accent-text)` |
| 보조 카피 "부모님 코드로 시작" | 13px, weight-medium, `var(--fg-secondary)` |
| Chevron | `›`, 17px, `var(--theme-accent-text)` |
| Hover | mascot 살짝 위로 (`translateY(-2px)`), `var(--easing-mascot)` |
| Active | `transform: scale(0.98)` |

##### 카드 간 간격
- `var(--space-3)` (12px) — 두 카드가 형제임을 약속

#### 3.2.1 마지막 사용 역할 hint (선택적 hint banner)

- `localStorage`에 `hyeni-last-role` 키 추가 (`"parent"` | `"child"`)
- 값이 있고 첫 진입 아닐 때 (= `hyeni-has-visited === "1"`)에만 표시
- 위치: subtitle 아래, role 카드 위, `var(--space-4)` 위아래 여백
- 모양: full-width pill button, `border: 1px dashed var(--line-default)`, bg transparent
- 텍스트: `지난번엔 학부모로 사용하셨어요 · [다시 시작 →]`
- 탭 시: 즉시 해당 역할 진입 (학부모면 ParentAuthScreen, 아이면 child mode)

```
┌─────────────────────────────────────┐
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄    │
│  ┊  지난번엔 학부모로  다시 시작 → ┊ │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄    │
└─────────────────────────────────────┘
```

#### 3.2.2 토큰 매핑 표
| 요소 | 토큰 |
|---|---|
| 외곽 좌우 패딩 | `var(--space-screen-pad)` (24px) |
| top safe-area 보정 | `env(safe-area-inset-top, 0px) + var(--space-4)` |
| 카드 max-width | 344px (현재 값 유지) |
| 폰트 | `var(--font-sans)` (Pretendard) |

---

### 3.3 ParentAuthScreen — 재구성

#### 레이아웃 (login default)
```
┌─────────────────────────────────────┐
│ [← 36px]    [56px Logo]   (placeholder)│
│                                     │
│            학부모 로그인              │  ← .t-screen-title
│         아이 일정 관리를 시작해 주세요  │  ← .t-screen-subtitle
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 💬  카카오로 시작           │   │  ← Primary CTA (Kakao yellow)
│  └─────────────────────────────┘   │     height: 56px (extra-tall)
│                                     │
│  ─────────── 또는 ───────────       │
│                                     │
│  ▾ ID/PW로 로그인                   │  ← 접힘 상태 (탭하면 펼침)
│                                     │
│                                     │
│      처음 오셨나요? 가입하기 →       │  ← signup link, footer
└─────────────────────────────────────┘
```

#### 카카오 CTA 변경점
| 항목 | 값 |
|---|---|
| Height | 56px (`--control-height` 48 + extra 8) — 메인 CTA 강조 |
| 배경 | `#FEE500` (카카오 공식) |
| 테두리 | `none` (현재 `border: 1.5px solid #FACC15`는 제거 — flat) |
| 색상 | `#191919` (카카오 가이드 검정) |
| 로고 | 카카오 talk SVG 좌측 (24px), `var(--space-2)` gap |
| Radius | `var(--radius-control)` (12px) |
| Font | weight-bold (700), 16px |
| Hover/Active | `filter: brightness(0.96)` / `0.92` |

#### Divider
- `<hr>` 양옆 가운데 `또는`
- 1px line `var(--line-soft)`, 텍스트 `var(--fg-tertiary)` 12px
- 위아래 `var(--space-4)` 여백

#### ID/PW 폼 — collapsed by default
- Disclosure pattern: `<details>` 또는 useState 토글
- 닫힌 상태: `▾ ID/PW로 로그인` (44px 탭 영역, weight-semibold, `var(--fg-secondary)`)
- 열린 상태: 기존 `inputStyle` 유지 (이미 토큰 사용 중) + `.btn-primary` 한 개
- 펼치기 motion: max-height 0 → auto, opacity 0 → 1, `var(--duration-base)`

#### Signup link (footer)
- 위치: 화면 bottom, `safe-area-inset-bottom` + `var(--space-4)`
- 텍스트: `처음 오셨나요? 가입하기 →`
- 스타일: 14px, weight-medium, `var(--theme-accent-text)`, underline on hover
- 탭 시: 별도 화면 (`ParentSignupScreen`) 으로 이동 — 현재 탭 전환 → **풀 페이지 분리**

#### 회원가입 분리
**중요**: 현재 ParentAuthScreen 안의 `mode === "signup"` 분기를 별도 컴포넌트 `ParentSignupScreen`으로 추출.
- 이유: 로그인 화면 인지 부하 줄임 + 가입은 한국 가족 앱 기준 2~3% 사용자만 — secondary 동선이 맞음
- 가입 폼 자체 (이름·아이디·PW·인증) 는 현재 그대로 유지, 시각적 wrapper만 분리

#### Hardware back 동작
- ID/PW 폼 열림 → 닫기
- 닫힌 상태에서 → `onBack()` 호출 (RoleSetupModal로)
- 가입 화면에서 → 로그인으로 (별도 화면이므로 navigation back)

---

### 3.4 자녀 모드 첫 인사 transition (1초 micro)

자녀 카드 탭 → 즉시 child mode 진입은 너무 갑작스러움. 1초 transition 추가:

```
┌─────────────────────────────────────┐
│                                     │
│         [72px Mascot wave]          │  ← 마스코트가 손 흔드는 모션
│            안녕!                     │  ← 28px, weight-bold
│      잠깐만, 부모님 코드 확인할게      │  ← 14px
│                                     │
└─────────────────────────────────────┘
```

- 표시 시간: 800ms (가족 정보 로딩 완료 시 cross-fade out)
- 마스코트 wave: SVG SMIL 또는 CSS keyframe, 0.6s loop
- `prefers-reduced-motion`: 정지 마스코트 + 텍스트만
- 가족 정보 fetch 실패 시: 페어링 코드 입력 화면으로 이동 (기존 동선 유지)

---

### 3.5 마스코트 illustration spec (Phase 1 신규 자산)

#### 컨셉
- 기존 로고(여자아이+아이스크림)에서 *얼굴+상반신*만 추출한 단일 SVG
- 표정 한 가지: 친근하게 웃음 (눈 ‿‿, 살짝 미소)
- 색: 핑크 #F779A8 + 크림 #FFF5FA + 검정 #171719 (3색)
- 크기: 56×56 viewBox 기준, viewBox 변형으로 100×100까지 확장 가능

#### 사용 placement (Headspace 패턴)
| Placement | 모드 | Phase |
|---|---|---|
| 자녀 카드 (RoleSetupModal) | 자녀 | **Phase 1** |
| 자녀 모드 첫 인사 transition | 자녀 | **Phase 1** |
| 자녀 홈 빈 상태 ("일정 없음") | 자녀 | Phase 3 |
| 자녀 success ("오늘 일정 다 봤어요") | 자녀 | Phase 3 |
| 부모 모드 어디에도 등장 X | - | - |

#### 산출물
- `src/assets/mascot/hyeni-wave.svg` (정적)
- `src/assets/mascot/hyeni-static.svg` (motion 비활성 fallback)
- 두 파일 모두 inline SVG로 import 가능 (테마 토큰 적용 위해)

---

## 4. 카피 (writing tone)

Toss 패턴 (모드 무관 voice 통일) 적용. 모든 카피 한국어 존댓말, 짧고 따뜻함.

| 화면 | 위치 | 카피 |
|---|---|---|
| Splash | subtitle | 가족 일정 동기화 중 |
| RoleSetupModal | top promise | 한 가족, 두 시점 |
| RoleSetupModal | subtitle | 함께 보는 우리 가족 일정 |
| RoleSetupModal | last-role hint | 지난번엔 {학부모/아이}로 사용하셨어요 · 다시 시작 → |
| RoleSetupModal | parent label | 학부모 |
| RoleSetupModal | parent sub | ID·카카오로 로그인 |
| RoleSetupModal | child label | 아이 |
| RoleSetupModal | child sub | 부모님 코드로 시작 |
| ParentAuthScreen | title | 학부모 로그인 |
| ParentAuthScreen | subtitle | 아이 일정 관리를 시작해 주세요 |
| ParentAuthScreen | kakao CTA | 카카오로 시작 |
| ParentAuthScreen | divider | 또는 |
| ParentAuthScreen | id/pw toggle | ID/PW로 로그인 |
| ParentAuthScreen | signup link | 처음 오셨나요? 가입하기 → |
| 자녀 transition | 인사 | 안녕! |
| 자녀 transition | 보조 | 잠깐만, 부모님 코드 확인할게 |

대안 후보 (sign-off 시 선택):
- promise: `함께 쓰는 캘린더 · 부모와 아이` / `한 가족, 두 시점` ✓ / `우리 가족만의 캘린더`
- 자녀 인사: `안녕!` ✓ / `반가워!` / `오늘도 안녕!`

---

## 5. Acceptance criteria (sign-off 체크리스트)

빌드·테스트가 다 통과하고 아래가 모두 만족돼야 "Phase 1 완료".

### 기능
- [ ] App load → splash skeleton 화면 표시 (1500ms 이내)
- [ ] 세션 fetch 완료 시 RoleSetupModal로 cross-fade
- [ ] RoleSetupModal에서 학부모 카드 탭 → ParentAuthScreen
- [ ] RoleSetupModal에서 아이 카드 탭 → 자녀 transition (800ms) → child mode
- [ ] `localStorage["hyeni-last-role"]` 저장 + 재방문 시 hint banner
- [ ] ParentAuthScreen에서 카카오 버튼이 default primary CTA, ID/PW 폼은 collapsed
- [ ] 가입 흐름 별도 화면 (`ParentSignupScreen`) 으로 이동
- [ ] Hardware back: 펼친 ID/PW 폼 → 접힘, 그 외 → 직전 화면

### 시각
- [ ] 두 역할 카드의 *시각적 차이*가 분명 (높이, 그림자, 배경 그라디언트, mascot 등장)
- [ ] 부모 카드는 stroke-only, 그림자 없음 (CLAUDE.md rule 5)
- [ ] 자녀 카드는 핑크 그라디언트 + soft shadow
- [ ] 마스코트 illustration이 자녀 카드에 56px로 표시 (emoji 제거 확인)
- [ ] 6 테마 픽커 변경 시 `--theme-accent` 변경되며 자녀 카드 그라디언트·테두리 자동 반영
- [ ] 다크 모드에서 모든 토큰 정상 작동

### 코드 품질
- [ ] 인라인 hex/rgb 0개 (CLAUDE.md rule 1)
- [ ] 인라인 magic px (off-grid) 0개 (CLAUDE.md rule 2)
- [ ] body weight 500 유지 (CLAUDE.md rule 4)
- [ ] 새 파일 분리: `<SplashScreen />`, `<ParentSignupScreen />` 별도 컴포넌트
- [ ] RoleSetupModal·ParentAuthScreen 인라인 style 비율 ↓ 50% (Wanted DS 클래스로 대체)

### 회귀
- [ ] 카카오 OAuth 흐름: `kakaoLogin()` 정상 호출, 콜백 정상 처리
- [ ] ID 로그인: `signInWithLoginId()` 정상
- [ ] 폰 인증 회원가입: `requestPhoneSignupCode` + `verifyPhoneSignupCode` 정상
- [ ] 페어링 의도 (`hyeni-pairing-intent`) localStorage 흐름 보존
- [ ] 자녀 모드 진입: 기존 child mode 라우팅 정상
- [ ] `npm run build` 0 errors
- [ ] `npx tsc --noEmit` 0 errors (해당 시)

---

## 6. 구현 단계 (sign-off 후 진행 순서)

> 한 phase = 한 commit (CLAUDE.md rule 13). Phase 1 = 1 commit, message: `wanted-ds: phase 8 — redesign entry (splash · role · parent auth)`

| 단계 | 산출물 | 예상 LOC |
|---|---|---|
| 1 | `tokens.css` 신규 토큰 추가 (mode-parent/child, motion, screen spacing) | +30 |
| 2 | `SplashScreen.jsx` 신규 컴포넌트 | +80 |
| 3 | `mascot/hyeni-wave.svg` + `hyeni-static.svg` 자산 | +2 files |
| 4 | RoleSetupModal 재구성 (인라인 style → 클래스, 카드 분리, hint banner) | -90 / +60 |
| 5 | `ChildEntryTransition.jsx` 신규 컴포넌트 | +50 |
| 6 | ParentAuthScreen 재구성 (카카오 우선, ID/PW collapsed, 가입 분리) | -120 / +90 |
| 7 | `ParentSignupScreen.jsx` 신규 컴포넌트 (기존 가입 폼 추출) | +180 |
| 8 | App.jsx에서 라우팅 갱신 (Splash → RoleSetup → ParentAuth/Signup/Child) | +20 |
| 9 | 단위 테스트: `RoleSetupModal.test.jsx`, `ParentAuthScreen.test.jsx` | +120 |
| 10 | `npm run build` + `npx tsc --noEmit` 통과 확인 | - |

**예상 작업 시간 (CC)**: 90~120 분  
**예상 작업 시간 (사람)**: 6~8 시간

---

## 7. 미결 결정 — sign-off 시 확정 필요

| # | 질문 | 옵션 | 권장 |
|---|---|---|---|
| Q1 | Top promise 카피 | a) "한 가족, 두 시점" b) "함께 쓰는 캘린더 · 부모와 아이" c) "우리 가족만의 캘린더" | a (가장 짧고 비대칭 약속 명료) |
| Q2 | Skeleton card 표시 임계값 | a) 항상 ≥1500ms 표시 b) fetch 완료 즉시 사라짐 (<1500ms) | b (불필요한 대기 X) |
| Q3 | 마지막 사용 역할 hint banner 위치 | a) subtitle 아래 (제안) b) 카드 위 dashed border 없이 c) 미표시 (이번 phase 보류) | a |
| Q4 | 가입 화면 분리 정도 | a) 별도 라우트 (`/signup`, deep link 가능) b) 같은 컴포넌트 안 모달 | a (한국 가족 앱 통상) |
| Q5 | 자녀 transition 표시 시간 | a) 800ms 고정 b) fetch 완료 즉시 종료 (최대 1500ms) | b (실제 진행에 맞춤, UX 정직성) |
| Q6 | 마스코트 motion | a) wave SVG SMIL b) CSS keyframe c) Lottie | b (가벼움 + reduced-motion 쉽게 비활성) |
| Q7 | 가입 단계의 카카오 가입 추가 여부 | a) 카카오 OAuth = 자동 가입+로그인 (현재) 이므로 가입 화면은 ID/PW 전용 b) 가입 화면에도 카카오 버튼 노출 | a (현재 흐름 유지) |
| Q8 | "한 가족, 두 시점" 영문 sub-text 필요? | a) 한글만 b) `One Family. Two Views.` 보조 | a (혜니는 한국 시장 단독) |

---

## 8. 비고

- 이 spec은 *의도*만 기술. 픽셀 단위 final mock은 sign-off 후 prototype HTML로 별도 생성 (`huashu-design` 또는 `lazyweb-design-improve` 스킬).
- 이 spec 자체에서 `htmlPlace` 키워드 등 불필요한 검색 SEO 메타 X.
- 후속 Phase 2~4는 이 Phase 1의 토큰·voice·mascot 자산 위에 얹히도록 설계됨. Phase 1 sign-off가 곧 후속 phase의 기준선.
