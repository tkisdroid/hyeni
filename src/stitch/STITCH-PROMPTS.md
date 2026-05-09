# 혜니캘린더 — Google Stitch 리디자인 프롬프트 세트 v1

> **사용 흐름**
> 1. Stitch (stitch.withgoogle.com) 새 프로젝트 → Mobile, 393×852 (iPhone 14 Pro)
> 2. **§0 마스터 헤더** 를 첫 메시지(Theme/System) 에 한 번만 붙여넣기
> 3. 화면별 §1~§7 프롬프트는 새 generation 마다 그대로 입력
> 4. 각 화면이 요구하는 reference 이미지를 "Add reference" 로 업로드
> 5. 부모 화면(§1·§2·§3·§4·§5)과 자녀 화면(§6·§7)은 **다른 세션**에서 진행 (톤 혼선 방지)
>
> **언어 규칙**: 모든 디자인 지시는 영어, 화면에 노출되는 카피는 한국어. 부모 화면은 존댓말, 자녀 화면은 친근한 반말.

---

## 자료 구성 안내

`src/stitch/` 안의 시트 30장은 두 종류로 처리되어 있습니다.

### A. 추출된 개별 요소 (`src/stitch/extracted/<sheet stem>/element-NN.png`)

각 시트에서 **배경 투명** 으로 분리된 개별 요소들. 시트마다 요소 개수가 다릅니다.
요약 인덱스: `src/stitch/extracted/_INDEX.md`

| 시트 | 모드 | 추출 개수 | 의미 |
|------|------|----------|------|
| `01_54_50 (1)` | grid | 14 | 가족 캐릭터 (엄마/아빠/딸 9포즈) + 핵심 아이콘 (캘린더·하트·말풍선·핀·방패) |
| `01_54_50 (2)` | grid | 9 | 마스코트 12 표정 시트 (일부 인접 표정은 한 element 로 묶일 수 있음 — 폴더 직접 확인) |
| `01_54_51 (3)` | grid | 12 | 가족 활동 12 장면 (폰 보기, 안기, 재우기 등) |
| `01_54_51 (4)` | grid | 16 | UI 시스템 아이콘 (집·캘린더·할일·추가·시계·새로고침·펜·설정·사용자·돋보기·화살표·벨·하트북마크 등) |
| `01_54_51 (5)` | grid | 20 | 학교/취미/장소/생활 아이콘 (학원·덤벨·팔레트·말풍선·음악·연필·책·도시락·집·여행·병원·선물·곰돌이·달 등) |
| `01_54_52 (6)` | grid | 22 | 메시지·UI 디테일 (말풍선·하트·탭표시·뱃지·선물·전화·노트·마이크·이모티콘·엄지·별·무지개·풍선·네잎클로버 등) |
| `01_54_52 (7)` | grid | 16 | 위치·안전·디바이스 (위치핀 5종·라우트·방패·벨·배터리·휴대폰·마이크·음소거·위험존·알람시계 등) |
| `01_54_53 (8)` | grid | 16 | 장소 아이콘 (학교·시계탑·도서관·놀이터·문방구·주택·핀·버스정류장·횡단보도·친구원·별·하트·위험) |
| `01_54_53 (9)` | grid | 24 | 버튼·배지·토글·뱃지 (체크·X·뒤로·추가·iOS 토글·캘린더 뱃지·하트 알림·말풍선) |
| `01_54_53 (10)` | grid | 20 | 동물 캐릭터 8종 (🐰🐱🐶🦊🐥🐻🐼🐯) + 별·왕관·색종이·무지개·유니콘·풍선·쿠키·사과·꽃·하트·이모티콘 |
| `12_59_52 (1)` | single | 1 | **마스코트 정면 미소 + 아이스크림 + 분홍 노트** (가장 중요한 캐릭터 정의) |
| `12_59_52 (2)` | single | 3 | 캘린더 + 체크 (체크가 분리될 수 있음 — 원본 시트 사용 권장) |
| `12_59_52 (3)` | single | 2 | 캘린더 + 하트 |
| `12_59_52 (4)` | single | 1 | 라벤더 위치 핀 |
| `12_59_52 (5)` | single | 5 | 말풍선 + 하트 |
| `12_59_52 (6)` | single | 1 | 분홍 하트 |
| `12_59_52 (7)` | single | 1 | 라벤더 방패 + 하트 |
| `12_59_52 (8)` | single | 1 | 분홍 종 (notification bell) |
| `12_59_52 (9)` | single | 1 | **마스코트 카디건 + 폰 보기** (성숙 톤 — 부모 화면 hero 후보) |
| `12_59_52 (10)` | single | 1 | **마스코트 wave (손 흔드는 모습)** + 분홍 노트 |

### B. 통째 사용 시트 (`src/stitch/ChatGPT Image ... (07_30_50 / 07_31_06).png`)

이미 모바일 화면 mockup 형태이므로 분리하지 않고 **단일 reference 로 업로드**.

| 파일 | 의미 |
|------|------|
| `07_30_50 (1)` / `07_31_06 (1)` | Splash/RoleSetup hero — "가족의 하루를 더 다정하게" |
| `07_30_50 (2)` / `07_31_06 (2)` | RoleSetupModal — "누구로 시작할까요?" 부모/자녀 카드 |
| `07_30_50 (3)` / `07_31_06 (3)` | ParentAuth — 카카오/구글/네이버 + 마스코트 |
| `07_30_50 (4)` / `07_31_06 (4)` | PairingWizard Step 0 — 가족 정보 1/4 |
| `07_30_50 (5)` / `07_31_06 (5)` | ChildPairInput — KID-A1B2C3D4 + QR |

> **추출 재실행**: 파라미터를 바꾸고 싶으면 `python src/stitch/extract_elements.py` 다시 돌리면 됩니다.

---

## §0 마스터 헤더 (Theme prompt — 모든 generation 공통)

```
You are designing screens for "혜니캘린더" (Hyeni Calendar), a Korean family
schedule + child-safety mobile app. Design only mobile portrait, 393×852,
honoring iOS safe-area top 47px and bottom 34px.

═══════════════════════════════════════════════════════════════════
DUAL-TONE DESIGN SYSTEM (CRITICAL — never blend the two)
═══════════════════════════════════════════════════════════════════

Parent screens → tone "Minimal-Pro"
  Inspired by Notion Calendar, Cron, Fantastical, Linear.
  • White (#FFFFFF) page, near-black ink (#1A1A1A) headlines 22-28px bold.
  • 1px hairline borders #E5E5E0, NO drop shadows on default cards.
  • Mascot small (28-40px), no chip, opacity 0.85-0.9.
  • Single accent #F779A8 (hyeni-pink), used sparingly.
  • Information-dense, tight spacing, tabular numerals for time.
  • Korean copy is polite/formal (존댓말): "좋은 아침이에요", "다음 일정이 있어요".
  • Animation: almost none, only subtle 160ms transitions.

Child screens → tone "Cartoon-Warm"
  Inspired by Khan Academy Kids, Duolingo, Headspace.
  • Soft cream/pink background (#FFF7F9 / #FFE0E6 chips), rounded 20px cards.
  • Mascot LARGE (56-96px), inside a pink chip with 1px border #FFD6DD,
    speech bubble with tail.
  • Body 14-16px, headlines 18-22px in cartoon-rose-text #C3325B.
  • Korean copy is friendly casual (반말): "안녕!", "준비됐어?", "잘했어!"
  • Animation: mascot bounce/cheer/wave allowed.

═══════════════════════════════════════════════════════════════════
COLOR TOKENS (use these hex only)
═══════════════════════════════════════════════════════════════════

Surface     --bg-base #FFFFFF  --bg-page #FAFAF7  --bg-elevated #FFFFFF
Ink         --fg-primary #1A1A1A  --fg-secondary #595959  --fg-tertiary #8C8C8C
Brand pink  --theme-accent #F779A8  --theme-accent-soft #FFC1CF
            --theme-accent-line #FFD6DD  --theme-accent-text #C3325B
Lines       --line-default #E5E5E0  --line-soft #EFEEEA
Status      --status-positive #34D399  --status-cautionary #F59E0B
            --status-negative #F87171  --status-negative-strong #E03030 (SOS ONLY)
Categories  학원 #A78BFA  운동 #34D399  취미 #F59E0B
            가족 #F87171  친구 #60A5FA  기타 #EC4899
Cartoon     --cartoon-bg-card #FFFFFF  --cartoon-bg-chip #FFE0E6
            --cartoon-bg-chip-mint #DAF6E3  --cartoon-bg-chip-yellow #FFF1A8

═══════════════════════════════════════════════════════════════════
TYPOGRAPHY
═══════════════════════════════════════════════════════════════════

Pretendard JP (Variable) → Pretendard → -apple-system fallback.
Body weight 500 (NEVER 400). Semibold 600 for buttons. Bold 700 for headlines.
Line height: tight 1.2 for headlines, normal 1.5 for body.
Korean text only — no English filler copy.

═══════════════════════════════════════════════════════════════════
SPACING & RADIUS
═══════════════════════════════════════════════════════════════════

Spacing 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 64 px only.
Screen padding 16, vertical section gap 20.
Radius: chip 8 / button 10 / card 16 / card-lg 20 / cartoon-card 20 / pill 999.
Cards = 1px stroke + radius 16, NO shadow. Use shadow only for floating modals.

═══════════════════════════════════════════════════════════════════
BRAND MASCOT (single character, never replaced)
═══════════════════════════════════════════════════════════════════

A 3D-rendered Korean girl, ~7 years old, black bob hair tied in a small top
bun, wearing a soft pink hoodie. Holding a pastel pink ice-cream cone in one
hand and a small pink notebook with a heart in the other. Friendly smile,
big shiny round eyes, pastel cheeks. Pixar-soft 3D, pastel pink palette,
no harsh outlines. ALWAYS render her with these props. Do not change her hair
color, hoodie color, or accessories. When she waves, she raises one hand only.

═══════════════════════════════════════════════════════════════════
ICONOGRAPHY
═══════════════════════════════════════════════════════════════════

All icons are soft 3D pastel style (matching the mascot), pink + lavender
palette, no flat strokes. Safety/protection icons use pastel lavender
(#C7B8F5) shield. Hearts always pink. Calendar icons have pink top-clip
and a heart inside.

═══════════════════════════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════════════════════════

1. Never blend Minimal-Pro and Cartoon-Warm in one screen.
2. Strong red (#E03030) ONLY for SOS / 긴급 / parent header heart icon.
   Normal warnings = amber #F59E0B. Children must not see strong red.
3. Mascot is the only character brand. Animals appear ONLY as
   child-selectable avatars (§7).
4. Body weight is 500. Never 400.
5. Cards have stroke, not shadow.
6. All Korean text uses Pretendard JP.
7. Time labels use tabular numerals.
8. Dark mode aware: all colors must work on #1A1A1A background too.

═══════════════════════════════════════════════════════════════════
ALWAYS-ON REFERENCES (upload at every generation)
═══════════════════════════════════════════════════════════════════

  • src/stitch/extracted/ChatGPT Image 2026년 5월 9일 오전 12_59_52 (1)/element-01.png
    → mascot canonical pose
  • src/stitch/ChatGPT Image 2026년 5월 9일 오전 01_54_50 (2).png
    → mascot expression sheet (use whole sheet so Stitch sees the variants)

Per-screen extras are listed inside each prompt.
```

---

## §1 RoleSetupModal — 부모/자녀 진입 선택

> **Tone**: 브랜드 레이어 (Minimal-Pro × Cartoon-Warm 다리)
> **Reference (extra)**:
> - `src/stitch/ChatGPT Image 2026년 5월 9일 오후 07_31_06 (2).png` (구도 참조)
> - `src/stitch/extracted/.../12_59_52 (1)/element-01.png` (자녀 카드 마스코트)
> - `src/stitch/extracted/.../12_59_52 (9)/element-01.png` (부모 카드 마스코트 — 폰 보는 성숙 톤)
> - `src/stitch/extracted/.../01_54_50 (1)/element-NN.png` 중 가족 캐릭터 1~2 (선호 표정 골라 업로드)

```
Screen: Role Setup Modal — first decision after splash.

Layout (top → bottom, 16 padding):

1. Top safe area 47px.

2. Brand block (centered, 24 top margin):
   • App icon 56×56 — pink rounded-square with calendar+heart inside.
   • Wordmark "혜니캘린더" 18 bold #1A1A1A, with a tiny pink heart
     superscript after the last character.
   • Sub-label "가족 일정을 함께" 12 #8C8C8C, 4 below.

3. Headline block (32 top margin):
   • 28 bold "누구로 시작할까요?" — the word "시작할까요" tinted
     #C3325B, with a small floating pink heart at end.
   • 14 #595959 sub: "가족 일정 관리 또는 부모님 코드 연결을 선택해 주세요"

4. Two horizontal selection cards, vertically stacked, 12 gap, 24 top.

   Card A — 부모로 시작 (recommended)
     • #FFFFFF, 1px border #FFD6DD, radius 20.
     • Height ~104, padding 16.
     • Left: 72×72 mascot — adult-looking version (pink cardigan, holding
       phone). Use mascot reference 12_59_52 (9).
     • Right column:
        - Title "부모로 시작" 17 bold #1A1A1A.
        - Sub "일정 작성 · 가족 관리 · 안전 확인" 12 #595959.
        - Chevron › on far right.
     • Subtle pink glow behind mascot (radial #FFE0E6 → transparent).

   Card B — 자녀로 시작
     • Same shell as Card A.
     • Left: 72×72 mascot canonical pose. Use 12_59_52 (1) element-01.
     • Title "자녀로 시작" 17 bold.
     • Sub "부모님 코드로 연결 · 내 일정 확인" 12 #595959.

5. Returning-user line (centered, 12 #8C8C8C, 16 top):
   • "지난번엔 부모로 사용했어요" with a tiny pink ♡ next to the
     last-used card. (Conditional — only when prior role exists.)

6. Primary button (sticky bottom, 16 above safe-area):
   • Full-width 56h pill, #F779A8, label "다음" 16 semibold #FFFFFF, › icon.
   • Disabled until a card is tapped.

7. Decorative bottom: tiny floating hearts and one lavender location pin,
   sparse — no more than 4 elements, opacity 0.4.

DO:
  • Two cards, equal weight, no upsell language.
  • Mascot expressions neutral-friendly (no cheer here).
  • Total visual density LOW.

DON'T:
  • No login providers here (next screen).
  • No red anywhere.
  • No mascot bubble.
```

---

## §2 PairingWizard Step 4 + Step 5 — 코드 발급 & Complete

> **Tone**: Minimal-Pro
> **Reference (extra)**:
> - `src/stitch/ChatGPT Image 2026년 5월 9일 오후 07_31_06 (4).png` (Step 0 시안 — dot 구조 참조)
> - `src/stitch/extracted/.../12_59_52 (10)/element-01.png` (Step 5 wave 마스코트)
> - `src/stitch/extracted/.../01_54_50 (2)/element-03.png` 또는 비슷한 만세 표정 element
> - `src/stitch/extracted/.../12_59_52 (7)/element-01.png` (라벤더 방패 — Step 4 expiry row)

```
Two screens at parent setup, mascot host header on top.

═══ Common header ═══

  • Back arrow ← 24 (top-left, 16 from edge), only on Step 4.
  • 6 progress dots centered, 8 gap, 6×6 each. Step 4 → 4 filled #F779A8,
    last 2 outlined. Step 5 → all 6 filled.
  • Mascot host strip below dots, 16 top:
      Step 4: small mascot 36×36 left, single bubble title "이제 거의
              다 됐어요" 16 bold + sub "코드를 자녀에게 알려주세요"
              13 #595959.
      Step 5: large mascot 96×96 centered, cheer pose (both arms up).
              Use 01_54_50 (2) cheer expression element.

═══ SCREEN A — Step 4: 페어링 코드 발급 ═══

1. Big code display card (24 top):
   • White card, 1px #FFD6DD, radius 20, padding 28.
   • Eyebrow label "연동 코드" 12 #C3325B.
   • Code "KID-A1B2C3D4" rendered as 8 individual square chips in a row,
     each 36×44, 1px #FFD6DD, mono numeral, 22 bold, 8 gap.
     "KID-" prefix label 14 #8C8C8C to the left of chips.
   • Below code: pill "📋 코드 복사" + pill "🔄 새로 발급" (10 gap),
     each 36h, radius 999, 1px #E5E5E0.

2. QR alternative card (12 below):
   • 1px #E5E5E0 radius 16.
   • Left: 72×72 QR preview.
   • Right: title "QR로도 가능해요" 14 bold + sub "자녀 폰 카메라로
     스캔하세요" 12 #595959.

3. Expiry info row (12 below, no card, just lavender shield + text):
   • 12_59_52 (7) shield 20 + "코드는 24시간 동안 사용할 수 있어요"
     13 #595959. "24시간" tinted #C3325B.

4. Primary button bottom: full-width pill, "모든 자녀 페어링 완료"
   16 semibold white on #F779A8.

═══ SCREEN B — Step 5: Complete cheer ═══

1. Headline (centered, 24 top):
   • 24 bold "{가족명} 가족이 시작됐어요!" (sample "하은이네")
     — family name in #C3325B.
   • Sub "이제 함께 일정을 나눌 수 있어요" 14 #595959.

2. Children avatar lineup (centered, 32 top):
   • Up to 5 circular avatars 56×56, 8 gap, 11 name labels below.
   • Each avatar = pastel circle + first letter, OR uploaded photo.
     2px ring in child's --child-color.
   • Sample: 하은(pink), 시우(blue), 지유(mint).

3. Confetti decoration (subtle, behind avatars):
   • Tiny stars #FFD33C, pink hearts (use 12_59_52 (6) heart),
     pastel ribbon strokes, opacity 0.5. Sparse.

4. Primary button "시작하기" full-width pill #F779A8 white,
   16 above safe-area.

DO:
  • Monochrome backbone with single pink accent — Step 5 cheer should
    feel premium-friendly, not childish (parent-mode tone).
  • Tabular numerals for code chips.

DON'T:
  • No big confetti explosion.
  • No mascot bubble on Step 5 — body copy speaks for itself.
  • No emojis inside the headline.
```

---

## §3 부모 홈 — HomeGreeting + NextEventHero + 자녀 그리드

> **Tone**: Minimal-Pro
> **Reference (extra)**:
> - `src/stitch/extracted/.../12_59_52 (9)/element-01.png` (greeting trailing 마스코트)
> - `src/stitch/extracted/.../01_54_51 (4)/element-NN.png` 중 종/하트 (헤더 우측)
> - `src/stitch/extracted/.../01_54_52 (7)/element-NN.png` 중 위치/배터리/방패 (자녀 그리드 메트릭)

```
Screen: Parent Home for a 3-children family.
Mode: Minimal-Pro. White surface, hairline strokes, no shadows.

═══ Top app bar (sticky, 56h, white, bottom border 1px #EFEEEA) ═══

  • Left: 28×28 logo + wordmark "혜니캘린더" 14 medium.
  • Mid: small chip "🔗 연동 (3)" 12 on #FFE0E6, radius 999, h24, p0 10.
  • Right (12 gap):
      - 🔔 bell 22 #1A1A1A, 8×8 red dot when unread.
      - 💗 heart 22 #F779A8 — the "꾹" button.

═══ Body (16 padding, 20 section gap) ═══

1. HomeGreeting row (24 top from app bar):
   • Left: 22 bold "좋은 아침이에요, 지영님" #1A1A1A.
     Sub "오늘은 5월 9일 금요일이에요" 13 #8C8C8C.
   • Right: 36×36 mascot trailing, opacity 0.9, no chip.
     Use 12_59_52 (9).

2. HomeBigStat row (compact, no card):
   • Big tabular "5/9" 32 bold, then small "오늘 일정 4 · 자녀 3"
     12 #595959 next to it.

3. NextEventHero card:
   • 1px #E5E5E0, radius 16, padding 20.
   • Left vertical accent bar 4px wide, full height, child color.
   • Top row: eyebrow "다음 일정" 11 upper-tracked #8C8C8C +
     pill "1시간 32분 후" 11 on #FFF1A8, radius 999.
   • Big time "14:30" 28 tabular bold + " — 16:00" 14 medium #595959 inline.
   • Title row: "🎨 미술학원" 18 bold #1A1A1A.
   • Meta row: child dot (#F779A8) + "하은" 13 medium + dot separator +
     "📍 빛고을 미술학원" 13 #595959.
   • Right corner small chevron ›.

4. Section header "아이 3명 · 지금 어디?" 14 bold + right-side toggle
   "🗺️ 지도" pill 28h, secondary.

5. Children grid (3 mini cards, equal width, 8 gap):
   Each card:
     • White, 1px #E5E5E0, radius 16, padding 12, height ~120.
     • Top: 48×48 circular avatar with 2px child-color ring.
     • Name 13 bold + age "8세" 11 #8C8C8C.
     • Status dots row: green/green/amber 6×6 with 4 gap.
     • One-line context "📍 학교" 11 #595959.

6. TodayEventsList (compact, rows separated by 1px #EFEEEA):
   Each row 56h:
     • Left: time "14:30" 13 tabular bold.
     • Mid: category dot 6×6 + title 14 medium.
     • Right: child mini-avatars 16×16 stack overlapping.
   Show 4 rows. Past events 50% opacity.

═══ Bottom tab bar (sticky, 56h + safe-area 34) ═══

  • 4 tabs: 홈 (active, #F779A8) / 캘린더 / 추적 / 설정.
  • Active has small pink dot above icon. Inactive #8C8C8C.

DO:
  • Tabular numerals for ALL time/date.
  • Single pink accent only on next-event hero bar; rest grayscale + tiny
    child-color dots.
  • Mascot small (36×36), decorative.

DON'T:
  • No drop shadows.
  • No giant illustrations.
  • No animals in children grid — actual avatars only.
```

---

## §4 부모 캘린더 + EventSheet (80vh bottom sheet)

> **Tone**: Minimal-Pro
> **Reference (extra)**:
> - `src/stitch/extracted/.../12_59_52 (3)/element-01.png` (캘린더+하트 — 헤더 작은 아이콘)
> - `src/stitch/extracted/.../01_54_51 (4)/element-NN.png` 중 캘린더·할일·체크·연필 (UI)
> - `src/stitch/extracted/.../01_54_52 (6)/element-NN.png` 중 선물·말풍선·전화 (preset chips)

```
Render TWO mobile frames side by side, label them "Calendar" / "EventSheet".

═══ FRAME A — Calendar tab ═══

Same top bar and bottom tab bar as §3.

Body (16 padding):

1. Month header row, centered:
   • "‹  2026년 5월  ›" — chevrons 24 #1A1A1A, "2026년 5월" 20 bold tabular.
   • Right inline today-pill "오늘로" 12 on #FFE0E6, radius 999, h24.

2. Weekday header (7 cells equal width):
   • 일 (#F87171), 월 화 수 목 금 (#1A1A1A), 토 (#60A5FA), 12 medium.

3. Calendar grid (6 rows × 7 cols, gapless, hairline 1px #EFEEEA):
   • Each cell h48.
   • Date number top-right, 14 tabular #1A1A1A.
   • Today: pink dot 6×6 above number (NOT a fill).
   • Selected: 2px border #F779A8, radius 8, soft #FFE0E6 fill.
   • Event dots row at bottom — up to 3 dots 4×4, 3 gap, in category colors.
   • Out-of-month days #C0C0BB.

4. Selected-date header (24 top from grid):
   • "5월 9일 금요일 · 일정 4개" 14 bold + right "+ 추가" pill 28h on
     #1A1A1A foreground / white.

5. Selected-date events list (rows, 1px #EFEEEA separator):
   Row template (h72):
     • Left: time "14:30" 13 tabular bold + duration "1h 30m" 11 #8C8C8C.
     • Mid: emoji 18 + title 14 medium + sub "하은 · 📍 빛고을 미술학원"
       11 #595959.
     • Right: 16×16 status icon (✓ done / ! warning / › default).
   Show 4 rows.

═══ FRAME B — EventSheet (80vh bottom sheet) ═══

Background: page dimmed 35% black overlay.

Sheet:
  • Top corners radius 24, white, 1px #E5E5E0 top.
  • Drag handle 36×4 #D6D5D0, 8 from top.
  • Header: "새 일정" 18 bold + right ✕ 24.

Body (scrollable, 16 padding):

1. Quick presets (horizontal scroll, 8 gap):
   • 6 chips h32 radius 999, 1px #E5E5E0:
     "⚡ 학원" "🍽️ 가족 식사" "🏃 운동" "🎉 파티" "🎂 생일" "📚 공부".
   • Active: filled #FFE0E6, border #F779A8.

2. Title field:
   • Label "📌 일정 이름" 12 #595959.
   • Input 56h, 1px #E5E5E0, radius 12, placeholder "어떤 일정인가요?"
     14 #8C8C8C.

3. Time block:
   • Label "⏰ 시간".
   • Two-segment toggle "시작 / 종료" (h32, radius 8).
   • Big time wheel — 14:30 selected. 30-min slot rail 7-21시 horizontal.
   • Quick-end chips "30분 / 1시간 / 1.5시간 / 2시간" — h28 pills.
   • Summary "14:30 – 16:00 · 1시간 30분" 13 #595959.

4. Category row:
   • Label "🏷️ 종류".
   • 6 chips h32, each colored to its category (학원 #A78BFA etc.),
     filled at 14% opacity, text in category color, 1px border same.

5. Place row:
   • Label "📍 장소".
   • Saved-place chips horizontal scroll: "🏫 학교 / 🎨 미술학원 / 🏠 집".
   • Below, ghost button "🗺️ 지도에서 장소 선택" full-width 48h.

6. Memo field — multiline 88h, hint "메모를 남겨보세요".

7. Repeat toggle row:
   • Label "🔁 반복" + iOS switch right.
   • When on: chips "1개월 / 2개월 / 3개월".

8. ChildSelector (multi-child):
   • 3 avatars (48×48) with name. Tapped = 2px ring #F779A8 + ✓ overlay.
   • "👨‍👩‍👧 가족 전체" toggle pill at the front.

Sticky bottom in sheet:
  • Cancel "취소" 56h half / Save "저장하기" 56h half, 12 gap.
  • Save = filled pink pill, Cancel = outline.

DO:
  • Category color only inside chips, never on save button.
  • All chips height 32 to avoid jitter.

DON'T:
  • Save button color is always #F779A8.
  • No DELETE here — only in edit mode.
```

---

## §5 자녀 트래커 — Map + draggable bottom panel

> **Tone**: Minimal-Pro
> **Reference (extra)**:
> - `src/stitch/extracted/.../12_59_52 (4)/element-01.png` (라벤더 위치 핀)
> - `src/stitch/extracted/.../01_54_52 (7)/element-NN.png` 중 핀 5종·라우트·방패·배터리·벨
> - `src/stitch/extracted/.../01_54_53 (8)/element-NN.png` 중 학교·도서관·놀이터

```
Screen: ChildTrackerOverlay — full-bleed map, draggable panel on top.

═══ Top overlay bar ═══

  • Floating ← 40×40 #FFFFFF circle, 1px #E5E5E0, top-left 16 with safe-area.
  • Centered child chip rail (3 chips, scroll, top 16 from safe-area):
      Each chip h36: 24×24 avatar + name 13 medium. Active = filled #FFE0E6,
      border #F779A8; inactive = white border #E5E5E0.
  • Top-right floating pill "지금 갱신" h36, white, 1px #E5E5E0,
    icon ⟳ 14 + label.

═══ Map (Kakao Maps, full bleed) ═══

  • Seoul Gangnam-area, soft pastel tint (saturation -30%).
  • Active child marker (centered): 56×56 circle = child photo, 3px #F779A8
    border, with #F779A8 drop-pin tail under. Faint pulsing ring.
  • 30m walking radius circle around marker, fill #F779A8 alpha 0.08,
    stroke 1px #F779A8.
  • Trail polyline behind marker — gradient pink-to-pale, 4px wide,
    last hour of motion. Three small "dwell" 12×12 markers at waypoints.
  • Other map markers:
      - 🏫 학교 marker 32×32 (pink building, use 01_54_53 (8)).
      - 🎨 미술학원 marker 32×32 (lavender).
      - 📍 saved place "집" lavender pin (use 12_59_52 (4)).

═══ Bottom panel (drag, 62vh shown) ═══

  • Top corners radius 24, white, 1px #E5E5E0 top.
  • Drag handle 36×4 #D6D5D0, 8 from top.

Inside (16 padding):

1. Title row: "하은 · 지금 어디?" 16 bold + right time "방금 전" 11 #8C8C8C.

2. Stats row (3 stat cards inline, 8 gap):
   Each 1px #EFEEEA radius 12 padding 12 h64:
     • "🔋 배터리" 11 #8C8C8C + "78%" 16 tabular bold #1A1A1A.
     • "📶 네트워크" 11 + "Wi-Fi" 16 bold.
     • "🛡️ 권한" 11 + "정상" 16 bold #34D399.

3. Time-segment chips "1시간 / 오늘 / 7일" — h32 pills.

4. "오래 머문 곳" section title 13 bold + 3 list rows:
   Each h48: emoji + place name "🏫 학교" 13 medium + duration "3시간 12분"
   11 #595959 right.

5. "다음 일정" mini-card (h56):
   • Left vertical bar 3px child-color.
   • "14:30 미술학원" 13 bold + "12분 거리 · 도보 8분" 11 #595959.

═══ Annotations on map (thin pink callouts, optional) ═══

  • "drag panel down to see more map"
  • "tap a chip to switch child"
  • "tap 지금 갱신 to refresh"

DO:
  • Pastel map tint so markers pop.
  • Marker photo+ring is the single visual anchor.

DON'T:
  • No bright red. Battery-low is amber.
  • No SOS button here (lives in ForceRing, separate screen).
```

---

## §6 ChildPairInput — KID- 8자리 코드 입력 (자녀)

> **Tone**: Cartoon-Warm
> **Reference (extra)**:
> - `src/stitch/ChatGPT Image 2026년 5월 9일 오후 07_31_06 (5).png` (구도 참조)
> - `src/stitch/extracted/.../12_59_52 (10)/element-01.png` (마스코트 wave)
> - `src/stitch/extracted/.../12_59_52 (7)/element-01.png` (라벤더 방패)
> - `src/stitch/extracted/.../01_54_52 (6)/element-NN.png` 중 말풍선 + 하트 (mascot 위 bubble)

```
Screen: child first-launch "부모님과 연결하기" — HARD GATE before app loads.
Tone: Cartoon-Warm. Soft pastel pink page.

═══ Background ═══

  • Base #FFF7F9. Subtle floating decoration: pastel hearts, tiny location
    pins, sparkles — opacity 0.4, 6-8 elements sparsely placed. Don't crowd.

═══ Top brand strip (24 from safe-area) ═══

  • Centered: 40×40 app icon (pink calendar+heart, soft 3D) + 18 bold
    wordmark "혜니캘린더" with tiny pink heart superscript.

═══ Headline block (centered, 24 below brand) ═══

  • 26 bold "부모님과 연결하기" — "연결하기" tinted #C3325B,
    tiny pink heart at end.
  • Sub 14 #595959: "부모님 앱에 있는 연동 코드를 입력해 주세요"

═══ Code input row ═══

  • Prefix label "KID-" 18 bold #C3325B left of input.
  • 8 individual square slots 40×52, radius 12, 1.5px #FFD6DD, white,
    mono 22 tabular bold #1A1A1A.
  • Sample value "A1B2C3D4" filling slots.
  • Below: 12 #8C8C8C "8자리 코드를 입력하면 자동 대문자가 돼요".

═══ QR alternative button ═══

  • Pill h44, radius 999, white, 1px #FFD6DD.
  • Icon 📷 + label "QR로 연결하기" 14 semibold #C3325B.
  • Centered, 16 below code row.

═══ Help card (lavender, calmer than pink) ═══

  • Card padding 16, radius 16, background #F2EBFE, 1px #E0D2FB.
  • Lavender shield icon 24×24 left (use 12_59_52 (7) extracted element).
  • Title "코드는 24시간 동안 사용할 수 있어요" 13 bold #5B3FB0 +
    sub "새 코드는 부모님 앱에서 언제든 다시 발급할 수 있어요" 12 #6E5BC8.

═══ Mascot host (bottom anchor, large) ═══

  • Mascot 144×144 wave pose (12_59_52 (10) extracted element).
  • Behind: pink chip background (radius 20, 1px #FFD6DD) with overflowing
    decorative hearts on either side.
  • Speech bubble (above mascot, tail pointing down):
      Background #FFE0E6, 1px #FFD6DD, radius 16.
      Text "연결되면 내 일정과 알림을 바로 볼 수 있어!" 13 #C3325B.
      Bold the phrase "내 일정과 알림".

═══ Primary CTA (sticky bottom, 16 above safe-area) ═══

  • Full-width pill h56, gradient #FFA5C4 → #F779A8,
    label "🔗 연결하기" 16 semibold white.
  • Disabled: desaturated, tooltip "8자리를 모두 입력해 주세요".

═══ Footer micro-copy (centered, 12 above safe-area) ═══

  • "💗 소중한 우리 가족을 위한 첫걸음" 12 #8C8C8C.

DO:
  • Mascot is the emotional anchor — make her large and welcoming.
  • Mascot bubble = casual 반말. Headline stays polite (instructional).

DON'T:
  • No "skip" — this is a hard gate.
  • No login providers, no parent affordances.
  • No red. Cautions in lavender.
```

---

## §7 자녀 홈 — ChildHero + 다음 일정 + 2x2 빠른 실행

> **Tone**: Cartoon-Warm
> **Reference (extra)**:
> - `src/stitch/extracted/.../12_59_52 (1)/element-01.png` (마스코트 hero)
> - `src/stitch/extracted/.../01_54_53 (10)/element-NN.png` 중 동물 캐릭터 8종 (settings에서 선택 가능 표시 용)
> - `src/stitch/extracted/.../01_54_51 (5)/element-NN.png` 중 미술/학원 emoji
> - `src/stitch/extracted/.../01_54_52 (6)/element-NN.png` 중 선물·말풍선·전화 (2×2 그리드 아이콘)
> - `src/stitch/extracted/.../01_54_50 (1)/element-NN.png` 중 친구 두 명 (친구놀이 타일)

```
Screen: ChildHome (자녀 캘린더 진입) for a child with 2 events today.
Tone: Cartoon-Warm. Background #FFF7F9 with subtle floating hearts.

═══ Top safe-area bar ═══

  • Left-top: 28×28 app icon + tiny wordmark.
  • Right-top: ⚙ settings 36×36, white circle 1px #FFD6DD.
    (Only this child sees a gear — no logout/family controls here.)

═══ Hero block (centered, 24 from safe-area) ═══

  • Pink chip background, radius 28, 1px #FFD6DD, padding 24.
  • Mascot 96×96 centered top of chip (default; if child-selected animal
    avatar, render that instead — use 01_54_53 (10) animal element).
  • Headline 22 bold "오늘 뭐 해? 🐰" — first line, then "2개 일정 있어 ✨"
    18 medium, "2개" tinted #C3325B.
  • Time badge below: pill h28 white, "오후 2시 30분" 13 bold tabular #C3325B
    with tiny clock icon.

═══ NextEvent card (16 below hero) ═══

  • White, 1px #FFD6DD, radius 20, padding 16.
  • Left: 56×56 emoji bubble for the event ("🎨" pastel chip).
  • Mid:
      - Eyebrow "다음 일정" 11 #8C8C8C.
      - Title "미술학원" 17 bold #1A1A1A.
      - Sub "오후 2시 30분 · 빛고을 미술학원" 12 #595959.
  • Right: chevron › with sub label "길찾기" 11 #C3325B underneath.

═══ Quick actions 2×2 grid (12 gap, 16 top) ═══

  Tile shell: white, 1px #FFD6DD, radius 20, h96, padding 16.

  Tile 1 — 💌 메모
    • 36 envelope+heart icon. Title "메모" 14 bold.
    • Tiny red unread dot top-right when unread.
    • Sub "부모님에게 답장" 11 #8C8C8C.

  Tile 2 — 🎁 스티커
    • 36 gift icon. Title "스티커 보내기" 14 bold.
    • Sub "고마운 마음을 담아" 11 #8C8C8C.

  Tile 3 — 📞 부모님께 전화
    • 36 phone icon. Title "전화" 14 bold.
    • Two mini badges below: 👩 엄마 + 👨 아빠 (only those with stored numbers).

  Tile 4 — 🐰 친구놀이
    • 36 two-kids icon (use 01_54_50 (1) friends element).
    • Title "친구놀이" 14 bold.
    • Sub "친구를 찾고 있어" 11 #8C8C8C (when no candidate found).

═══ Today timeline strip (16 below grid) ═══

  • Section title "오늘 일정 ✨" 13 bold + sub "2개" #8C8C8C.
  • Two horizontally-scrollable mini-cards (160 wide × 72 high):
    each = emoji + time + title. Read-only (no delete affordance).

═══ Bottom tab bar ═══

  • 4 tabs: 홈 (active 🐰 #F779A8) / 캘린더 / 메모 / 친구놀이.
  • Active has a pink chip behind icon. Inactive outline only.

═══ Decorative micro-elements ═══

  • Tiny floating hearts 6-8 around hero, opacity 0.4.
  • Sparkles near hero headline.

DO:
  • Warm and inviting, not cluttered.
  • Mascot OR chosen animal in hero slot (swap in settings).
  • Casual 반말 in headlines and bubbles.

DON'T:
  • No edit/delete affordances on events — child is read-only.
  • No SOS button. No location-tracking visualization.
  • No red color anywhere.
```

---

## §8 Stitch 운영 팁

1. **마스터 헤더는 한 번만 입력 (Theme 칸 활용)**
   §0 을 첫 generation Theme/System prompt 칸에 한 번 입력하면 이후 모든
   화면이 같은 디자인 시스템을 따릅니다.

2. **항상 첨부할 reference 2장**
   - `extracted/.../12_59_52 (1)/element-01.png` — 마스코트 정면
   - `ChatGPT Image 2026년 5월 9일 오전 01_54_50 (2).png` — 표정 시트 (통째)
   캐릭터 일관성 유지에 가장 효과적입니다.

3. **부모/자녀 generation 분리**
   같은 세션 안에서 톤이 섞이는 일이 잦음.
   부모 5화면(§1·§2·§3·§4·§5) 끝낸 뒤 새 세션에서 자녀 2화면(§6·§7) 시작.

4. **Reference element 선택 팁**
   각 시트 폴더(`extracted/.../<sheet stem>/`)를 직접 열어 element-NN 중
   화면 의도에 맞는 1-3개를 골라 업로드. element 번호는 시트 위→아래
   왼→오른쪽 스캔 순서.

5. **iteration 키워드 (결과 수정 시)**
   - "Make the next-event card more compact"
   - "Reduce category chips visible to 3"
   - "Use tabular numerals for all times"
   - "Remove drop shadows; only stroke"
   - "Use the uploaded mascot exactly — don't redraw her face"

6. **export 후 다음 단계**
   Stitch 가 Figma export 또는 HTML/Tailwind code 를 줍니다.
   이 프로젝트는 Tailwind X · 토큰 단일 출처(`src/styles/tokens.css`)
   구조라서 코드 export 는 참고만 하고 실제 마이그레이션은
   `WANTED_DS_SPEC.md` 흐름으로 진행 권장.

7. **다음 round 후보 (필요 시 같은 패턴으로 추가 작성)**
   - SOS 풀스크린 오버레이 (꾹 수신)
   - ParentSettings
   - ChildSettings (테마 + 동물 캐릭터 8종 — `01_54_53 (10)` 활용)
   - SubscriptionManagement
   - ChildPermissionWizard 7단계
   - AlertPanel (활동 알림 bottom sheet)
   - ParentMemoPage (풀스크린 채팅)

---

**END OF PROMPT SET v1**
