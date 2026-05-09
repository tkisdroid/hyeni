# DESIGN.md — 혜니캘린더 Premium Kawaii Design System

> Version: 1.0  
> Product: 혜니캘린더  
> App ID: `com.hyeni.calendar`  
> Design Direction: **Premium Kawaii Family Productivity**  
> Primary Viewport: **Mobile 360–430px**, target **390px**  
> Last Updated: 2026-05-09

---

## 0. Purpose

이 문서는 혜니캘린더 앱을 새롭게 디자인할 때 사용하는 **단일 디자인 시스템 문서**다.

기존 앱 화면의 시각 디자인은 따르지 않는다.  
기존 앱 프롬프트의 **기능, 정보 구조, 역할 분기, 부모/자녀 사용 맥락**만 반영한다.

디자인 목표는 다음과 같다.

1. 가족 일정 관리 앱으로서 신뢰감이 있어야 한다.
2. 자녀 안전 확인 앱이지만 감시앱처럼 보이면 안 된다.
3. 귀엽지만 유치하지 않아야 한다.
4. 부모가 매일 사용할 수 있는 프리미엄 생산성 앱처럼 보여야 한다.
5. 자녀 화면은 따뜻하고 친근한 친구 같은 앱처럼 보여야 한다.
6. 모든 화면은 모바일 우선으로 설계한다.
7. 색상, 간격, 반경, 그림자, 타이포그래피, 아이콘 스타일은 이 문서의 토큰을 기준으로 한다.

---

## 1. Product Design Identity

### 1.1 One-line Identity

**혜니캘린더는 가족의 하루를 다정하게 정리하고, 부모가 자녀의 일정과 안전 상태를 부드럽게 확인할 수 있게 돕는 프리미엄 패밀리 캘린더 앱이다.**

### 1.2 Brand Keywords

```txt
Premium Kawaii
Soft Productivity
Family Safety
Gentle Monitoring
Warm Korean Mobile UI
Cute but not childish
Rounded, airy, calm
Soft 3D pastel sticker
Trustworthy family dashboard
```

### 1.3 Visual Personality

| Attribute | Direction |
|---|---|
| 귀여움 | 있음. 단, 과하지 않음 |
| 프리미엄 | 매우 중요 |
| 안정감 | 매우 중요 |
| 감시 느낌 | 금지 |
| 키즈앱 느낌 | 자녀 모드에서만 허용 |
| 생산성 앱 느낌 | 부모 모드에서 중요 |
| 한국 모바일 UI 감성 | 중요 |
| 여백 | 넉넉하게 |
| 색감 | 민트, 핑크, 크림, 라벤더 중심 |
| 일러스트 | 부드러운 3D 스티커 스타일 |

---

## 2. Role-based Design Modes

혜니캘린더는 하나의 앱에서 부모 모드와 자녀 모드를 분기한다.

```txt
myRole === "parent" → Parent Mode
myRole === "child"  → Child Mode
```

두 모드는 같은 브랜드를 공유하지만, 시각적 밀도와 카피 톤이 다르다.

---

## 3. Parent Mode Design

### 3.1 Parent Mode Concept

부모 모드는 **Minimal Premium + Cute Family Accent**다.

부모는 일정, 위치, 자녀 상태, 알림, 장소, 구독 등을 빠르게 확인해야 한다. 따라서 화면은 예쁘기만 하면 안 되고, 정보 계층이 명확해야 한다.

### 3.2 Parent Mode Principles

1. 부모가 3초 안에 오늘의 다음 일정을 파악할 수 있어야 한다.
2. 부모가 3초 안에 두 아이가 안전한지 확인할 수 있어야 한다.
3. 홈 화면은 정보 대시보드지만 차갑거나 관리자 도구처럼 보이면 안 된다.
4. 마스코트와 3D 아이콘은 브랜드 감성용으로 작고 절제되게 사용한다.
5. 카드와 칩은 고급스럽고 부드럽게 표현한다.
6. 강한 색상은 CTA, 활성 상태, 안전 상태, 긴급 상태에만 사용한다.
7. 자녀 위치 기능은 “추적”보다 “안전 확인”처럼 보여야 한다.

### 3.3 Parent Mode Tone

| Area | Direction |
|---|---|
| Background | 아주 연한 민트 또는 크림 오프화이트 |
| Card | 흰색, 크림, 민트 소프트 배경 |
| Accent | 민트 중심, 핑크 보조 |
| Mascot | 32–72px, 작고 정제된 사용 |
| Copy | 존댓말, 차분하고 짧게 |
| Icon | 선형 아이콘 + soft 3D sticker 혼합 |
| Motion | subtle, 거의 없는 편 |
| 위험 표현 | 빨강 남발 금지 |

---

## 4. Child Mode Design

### 4.1 Child Mode Concept

자녀 모드는 **Cartoon-Warm + Friendly Companion**이다.

자녀가 앱을 사용할 때는 “관리받는다”는 느낌보다 “일정을 알려주는 귀여운 친구”처럼 느껴야 한다.

### 4.2 Child Mode Principles

1. 마스코트를 크게 사용한다.
2. 핑크와 크림 배경을 더 많이 사용한다.
3. 말풍선, 스티커, 캐릭터 애니메이션을 적극 활용한다.
4. 카피는 반말이고 친근해야 한다.
5. 위험·경고 표현은 부드럽게 표현한다.
6. SOS 빨강은 필요한 경우에만 사용하고, 하트형 쉴드로 덜 위협적으로 표현한다.
7. 부모 기능은 자녀 화면에 노출하지 않는다.

### 4.3 Child Mode Tone

| Area | Direction |
|---|---|
| Background | 크림 + 블러시 핑크 그라디언트 |
| Card | 핑크 소프트, 크림, 흰색 |
| Accent | 핑크 중심, 라벤더 보조 |
| Mascot | 80–160px, 적극 사용 |
| Copy | 반말, 친근함 |
| Icon | 3D 스티커 중심 |
| Motion | bounce, cheer, pulse 허용 |

---

## 5. Core Color System

### 5.1 CSS Variables

```css
:root {
  /* App Background */
  --bg-app: #F8FFF9;
  --bg-page: #FBFAF6;
  --bg-page-mint: #F1FBF6;
  --bg-page-rose: #FFF7FA;
  --bg-card: #FFFFFF;
  --bg-card-soft: #FFFDF8;
  --bg-mint-soft: #EAF9F1;
  --bg-rose-soft: #FFF0F5;
  --bg-lavender-soft: #F2ECFF;
  --bg-cream-soft: #FFF7E8;

  /* Text */
  --fg-primary: #202024;
  --fg-secondary: #5F6368;
  --fg-tertiary: #9A9AA0;
  --fg-disabled: #C7C7CC;
  --fg-on-accent: #FFFFFF;

  /* Brand Mint */
  --brand-mint: #31C48D;
  --brand-mint-deep: #15936B;
  --brand-mint-soft: #DDF7EA;
  --brand-mint-line: #BCEBD8;
  --brand-mint-text: #087653;

  /* Brand Rose */
  --brand-rose: #F779A8;
  --brand-rose-deep: #D94F7F;
  --brand-rose-soft: #FFE2EC;
  --brand-rose-line: #FFD0DD;
  --brand-rose-text: #B83262;

  /* Brand Lavender */
  --brand-lavender: #A78BFA;
  --brand-lavender-deep: #7C5CE1;
  --brand-lavender-soft: #EFE8FF;
  --brand-lavender-line: #DDD1FF;
  --brand-lavender-text: #5F43B2;

  /* Warm Accent */
  --brand-cream: #FFF7E8;
  --brand-yellow: #FFD76A;
  --brand-yellow-soft: #FFF3C7;

  /* Lines */
  --line-soft: #F1ECEE;
  --line-default: #E7E0E4;
  --line-mint: #BCEBD8;
  --line-rose: #FFD0DD;
  --line-lavender: #DDD1FF;
  --line-strong: #D8D2D6;

  /* Status */
  --status-safe: #23B96F;
  --status-safe-soft: #DDF7EA;
  --status-safe-text: #087653;

  --status-caution: #F5A524;
  --status-caution-soft: #FFF1D6;
  --status-caution-text: #9A6500;

  --status-danger: #E03030;
  --status-danger-soft: #FFE3E3;
  --status-danger-text: #B91C1C;

  /* Map */
  --map-green: #BDEFD0;
  --map-road: #EFE6DA;
  --map-water: #CFEAFB;
  --map-building: #F8D9E1;
  --map-pin-mint: #31C48D;
  --map-pin-rose: #F779A8;
}
```

### 5.2 Color Usage Rules

| Usage | Primary Color |
|---|---|
| 부모 모드 활성 상태 | Mint |
| 자녀 모드 활성 상태 | Rose |
| 가족 감성, 꾹, 하트 | Rose |
| 위치, 연동, 안전 확인 | Mint |
| 보조 장식, 위치 핀, 안전 쉴드 | Lavender |
| 일반 주의 | Amber |
| 진짜 긴급, SOS | Strong Red |
| 배경 | Off-white, Cream, Soft Mint |

### 5.3 Red Usage Rule

강한 빨강은 다음 경우에만 사용한다.

```txt
- SOS
- 응급 강제 알림
- 즉시 확인이 필요한 위험 상태
- 자녀 안전에 직접적인 위험이 있는 alert
```

다음에는 빨강을 쓰지 않는다.

```txt
- 일반 위치 미갱신
- 일반 알림
- 배터리 낮음
- 읽지 않은 메모
- 기본 경고
```

이 경우에는 amber, coral, muted rose를 사용한다.

---

## 6. Typography

### 6.1 Font Family

```css
:root {
  --font-sans: "Pretendard JP", "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", Consolas, monospace;
}

body {
  font-family: var(--font-sans);
  font-weight: 500;
}
```

### 6.2 Type Scale

```css
:root {
  --text-hero: 44px;
  --text-title-xl: 30px;
  --text-title-lg: 26px;
  --text-title-md: 22px;
  --text-title-sm: 18px;

  --text-body-lg: 17px;
  --text-body: 15px;
  --text-caption: 13px;
  --text-tiny: 11px;

  --weight-regular: 500;
  --weight-semibold: 700;
  --weight-bold: 800;

  --leading-tight: 1.15;
  --leading-normal: 1.45;
  --leading-loose: 1.65;
}
```

### 6.3 Typography Usage

| Purpose | Size | Weight | Notes |
|---|---:|---:|---|
| Hero date number | 40–48px | 800 | 홈 날짜, 카운트다운 |
| Screen title | 26–30px | 800 | 주요 화면 제목 |
| Section title | 20–22px | 700 | 오늘 일정, 위치 지도 |
| Card title | 17–19px | 700 | 일정명, 아이 이름 |
| Body | 14–16px | 500 | 설명, 주소 |
| Caption | 12–13px | 500 | 시간, 보조 상태 |
| Tiny label | 10–11px | 600 | 배지, dot label |

### 6.4 Typography Rules

1. 핵심 숫자와 날짜는 크게 보여준다.
2. 한국어 문장은 너무 길게 쓰지 않는다.
3. 부모 화면의 텍스트는 차분하고 실용적이어야 한다.
4. 자녀 화면의 텍스트는 둥글고 친근해야 한다.
5. 카드 안에서는 제목, 보조 정보, 상태를 명확히 구분한다.
6. 주소와 일정명은 한 줄 말줄임을 허용한다.

---

## 7. Spacing & Layout

### 7.1 Viewport

```css
:root {
  --screen-width-min: 360px;
  --screen-width-target: 390px;
  --screen-width-max: 430px;

  --safe-top: env(safe-area-inset-top);
  --safe-bottom: env(safe-area-inset-bottom);

  --page-padding: 20px;
  --section-gap: 26px;
  --card-gap: 14px;
}
```

### 7.2 Spacing Tokens

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-10: 48px;
  --space-12: 64px;
}
```

### 7.3 Layout Rules

| Area | Rule |
|---|---|
| Page padding | 20px 기본 |
| Section gap | 24–28px |
| Card internal padding | 16–28px |
| Small chip gap | 8–10px |
| Card list gap | 12–14px |
| Bottom nav safe gap | safe-area 포함 |

### 7.4 Parent Home Layout Order

```txt
Safe Area
└── Header Card
    ├── Mascot Avatar
    ├── App Title
    ├── Role Chip
    ├── Linked Chip
    ├── Notification Button
    └── Kkuk Button

└── Child Quick Switch Chips

└── Date Hero Card
    ├── Weekday
    ├── Large Date
    ├── Next Event Chip
    └── Small Illustration

└── Today Schedule Section
    ├── Section Header
    └── Event Cards

└── Child Status Section
    ├── Section Header
    └── Child Status Cards

└── Location Map Preview

└── Bottom Navigation
```

---

## 8. Radius & Shape

### 8.1 Radius Tokens

```css
:root {
  --radius-xs: 8px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 22px;
  --radius-xl: 28px;
  --radius-2xl: 34px;
  --radius-3xl: 40px;
  --radius-pill: 999px;
}
```

### 8.2 Radius Usage

| Element | Radius |
|---|---:|
| Small chip | pill |
| Status badge | pill |
| Button | 18–24px |
| General card | 22–28px |
| Hero card | 30–36px |
| Header card | 32–40px |
| Bottom nav | 28–36px |
| Avatar | pill |
| Map preview | 22–28px |
| Modal sheet | 28–34px top radius |

### 8.3 Shape Rules

1. 혜니캘린더의 기본 형태는 둥근 사각형과 pill이다.
2. 모든 인터랙션 요소는 손가락으로 누르기 쉬운 둥근 형태여야 한다.
3. 너무 많은 원형 버튼을 동시에 사용하지 않는다.
4. hero, header, nav는 더 큰 radius를 사용해 프리미엄 느낌을 만든다.

---

## 9. Shadow & Depth

### 9.1 Shadow Tokens

```css
:root {
  --shadow-xs: 0 2px 8px rgba(31, 24, 28, 0.04);
  --shadow-soft: 0 8px 24px rgba(31, 24, 28, 0.06);
  --shadow-card: 0 12px 32px rgba(31, 24, 28, 0.08);
  --shadow-floating: 0 18px 44px rgba(31, 24, 28, 0.12);
  --shadow-mint: 0 12px 30px rgba(49, 196, 141, 0.16);
  --shadow-rose: 0 12px 30px rgba(247, 121, 168, 0.18);
  --shadow-lavender: 0 12px 30px rgba(167, 139, 250, 0.16);
}
```

### 9.2 Depth Rules

1. 부모 모드에서는 그림자를 얇고 고급스럽게 사용한다.
2. 자녀 모드에서는 그림자를 조금 더 폭신하게 사용한다.
3. 버튼에는 색상 그림자를 약하게 사용할 수 있다.
4. 상태 카드는 그림자보다 라인과 배지를 우선한다.
5. 3D 아이콘은 자체 그림자를 포함할 수 있다.
6. 진한 그림자와 과한 입체감은 피한다.

---

## 10. Illustration & Icon System

### 10.1 Illustration Style

혜니캘린더의 아이콘과 캐릭터는 **Soft 3D Pastel Sticker Style**을 사용한다.

특징:

```txt
- 둥근 형태
- 부드러운 젤리/클레이/플라스틱 질감
- 은은한 하이라이트
- 짧고 부드러운 그림자
- 두꺼운 검은 외곽선 없음
- pastel pink, cream, mint, lavender 중심
- 귀엽지만 과장되지 않음
- 고해상도 앱 아이콘/스티커 품질
```

### 10.2 Mascot Identity

마스코트는 혜니캘린더의 핵심 브랜드 요소다.

```txt
- 검은색 또는 짙은 갈색 머리
- 둥근 얼굴
- 큰 눈
- 부드러운 미소
- 볼터치
- 핑크 또는 크림 후드
- 핑크 아이스크림
- 핑크 플래너 또는 노트
- 하트 요소
```

### 10.3 Mascot Usage by Mode

| Mode | Size | Usage |
|---|---:|---|
| Parent Header | 32–48px | 브랜드 아바타 |
| Parent Hero | 56–96px | 장식용, 정보 보조 |
| Empty State | 80–120px | 안내 |
| Child Hero | 96–160px | 주인공 요소 |
| Onboarding | 140–240px | 중심 일러스트 |
| Kkuk Overlay | 100–140px | 감정 피드백 |

### 10.4 Mascot Poses

앱 전반에서 사용할 마스코트 포즈:

```txt
- static smile
- wave
- cheer
- holding planner
- holding ice cream
- holding calendar
- holding phone
- holding heart
- holding location pin
- thumbs up
- surprised
- sleepy
- reading memo
- SOS heart shield pose
- permission guide pose
```

### 10.5 Icon Categories

#### Core Navigation Icons

```txt
home
calendar
today
daily timetable
place
memo
family
settings
search
profile
notification
add
close
back
chevron
```

#### Schedule Icons

```txt
calendar with check
clock
checklist
repeat
pencil/edit
bookmark
countdown chip
academy
exercise
hobby
family event
friend event
other
```

#### Safety Icons

```txt
location pin
live location
route trail
refresh location
safe zone
geofence
danger zone
shield with heart
SOS heart shield
force ring bell
battery
charging battery
low battery
network status
device status
microphone
remote listening
exact alarm
```

#### Communication Icons

```txt
heart
kkuk heart tap
speech bubble
heart speech bubble
phone call
quick reply
memo card
voice bubble
praise sticker
gift sticker
star sticker
thumbs up
rainbow
balloon
clover
flower
```

#### Place Icons

```txt
home
school
academy
library
park
playground
cafe
sports center
hospital
bus stop
crosswalk
public place
frequent place
safe place
friend playdate
travel
```

### 10.6 Icon Rules

1. 앱 기본 아이콘은 선형 아이콘과 3D 아이콘을 혼합할 수 있다.
2. 상단 헤더, 바텀 내비는 선형 아이콘 중심으로 간결하게 사용한다.
3. hero, empty state, onboarding, 자녀 화면은 3D 아이콘을 적극 사용한다.
4. 같은 화면 안에서 서로 다른 아이콘 스타일을 너무 많이 섞지 않는다.
5. 기능 아이콘은 24px 선형, 장식 아이콘은 48–96px 3D를 기준으로 한다.

---

## 11. Component System

## 11.1 Header Card

### Purpose

브랜드, 역할, 연결 상태, 주요 액션을 보여준다.

### Structure

```txt
HeaderCard
├── MascotAvatar
├── AppTitle
├── ModeChip
├── LinkedChip
├── NotificationButton
└── KkukButton
```

### Style

```css
.header-card {
  background: linear-gradient(135deg, var(--bg-card), var(--bg-card-soft));
  border: 1px solid rgba(49, 196, 141, 0.14);
  border-radius: var(--radius-3xl);
  box-shadow: var(--shadow-card);
  padding: 18px;
}
```

### Rules

- 앱 이름은 굵고 명확하게 표시한다.
- `학부모 모드`, `연동 (2명)`은 pill chip으로 표시한다.
- 알림 버튼은 작은 dot badge를 가질 수 있다.
- 꾹 버튼은 핑크 하트가 명확해야 한다.
- 헤더 높이는 너무 크지 않게 유지한다.

---

## 11.2 Child Quick Switch Chip

### Purpose

부모가 자녀별 상태를 빠르게 전환한다.

### Structure

```txt
ChildChip
├── Avatar
├── Name
└── StatusDot
```

### Style

```css
.child-chip {
  height: 56px;
  border-radius: var(--radius-pill);
  padding: 6px 16px 6px 6px;
  background: var(--bg-card);
  border: 1px solid var(--line-soft);
}

.child-chip-active {
  background: var(--brand-mint-soft);
  border-color: var(--brand-mint);
  box-shadow: var(--shadow-mint);
}
```

### Rules

- active child는 민트 배경을 사용한다.
- inactive child는 흰색/크림/핑크 소프트 배경을 사용한다.
- 각 자녀는 고유 accent color를 가진다.
- 3명 이상일 때는 가로 스크롤 rail로 전환한다.

---

## 11.3 Date Hero Card

### Purpose

오늘 날짜와 다음 일정을 가장 먼저 보여준다.

### Structure

```txt
DateHero
├── Weekday
├── LargeDate
├── NextEventChip
└── Illustration
```

### Style

```css
.date-hero {
  background: linear-gradient(135deg, #F0FBF5, #FFF9FB);
  border-radius: var(--radius-3xl);
  border: 1px solid rgba(49, 196, 141, 0.14);
  box-shadow: var(--shadow-soft);
  padding: 28px;
}
```

### Rules

- 날짜 숫자는 화면에서 가장 큰 텍스트 중 하나여야 한다.
- 다음 일정은 pill 형태로 간결하게 표시한다.
- 오른쪽에는 작은 3D 달력 또는 마스코트 일러스트를 둘 수 있다.
- illustration은 정보보다 강하면 안 된다.

---

## 11.4 Event Card

### Purpose

일정명, 시간, 자녀, 카테고리를 한눈에 보여준다.

### Structure

```txt
EventCard
├── AccentStripe
├── CategoryIcon
├── EventTitle
├── ChildLabel
├── Time
└── Chevron
```

### Style

```css
.event-card {
  min-height: 76px;
  background: var(--bg-card);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  padding: 14px 16px;
}
```

### Rules

- 좌측 accent stripe로 일정 카테고리 또는 자녀 색을 표시한다.
- 시간은 오른쪽에 크게 표시한다.
- 카테고리 아이콘은 3D 미니 아이콘 또는 선형 아이콘을 사용할 수 있다.
- 카드는 과도하게 장식하지 않는다.

---

## 11.5 Child Status Card

### Purpose

자녀의 현재 안전 상태, 위치, 배터리, 마지막 업데이트를 보여준다.

### Structure

```txt
ChildStatusCard
├── AvatarWithLocationBadge
├── ChildName
├── AddressSnippet
├── BatteryInfo
├── LastUpdatedInfo
├── SafetyChip
├── StatusDots
└── Chevron
```

### Style

```css
.child-status-card {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  border: 1px solid var(--line-soft);
  box-shadow: var(--shadow-soft);
  padding: 16px;
}

.child-status-card.safe-mint {
  border-color: var(--line-mint);
}

.child-status-card.safe-rose {
  border-color: var(--line-rose);
}
```

### Status Rules

| Status | Visual |
|---|---|
| 안전 | Mint chip + green dots |
| 확인 필요 | Amber chip + amber dots |
| 위치 미갱신 | Gray/Amber chip |
| 위험 | Red chip, SOS-only style |

### Content Rules

- 주소는 한 줄 말줄임 처리한다.
- 배터리와 마지막 업데이트는 작은 icon + text 조합으로 표시한다.
- 아이 이름은 명확히 크게 표시한다.
- 안전 상태는 색상뿐 아니라 텍스트로도 표시한다.

---

## 11.6 Map Preview Card

### Purpose

부모가 두 자녀의 위치를 시각적으로 빠르게 확인한다.

### Structure

```txt
MapPreview
├── SoftMapBackground
├── ChildPinMint
├── ChildPinRose
├── SmallPlaceSticker
└── ExpandAction
```

### Style

```css
.map-preview {
  height: 112px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: #F3F7EF;
  border: 1px solid var(--line-soft);
  box-shadow: var(--shadow-soft);
}
```

### Map Visual Rules

- 실제 지도처럼 복잡하게 만들지 않는다.
- 도로는 크림/베이지.
- 물길은 연한 하늘색.
- 공원은 연한 민트.
- 아이 위치 pin에는 아이별 색상과 아바타를 사용한다.

---

## 11.7 Bottom Navigation

### Structure

```txt
BottomNav
├── 홈
├── 오늘
├── 일정
├── 장소
├── 메모
└── 가족
```

### Style

```css
.bottom-nav {
  height: 76px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(18px);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-3xl);
  box-shadow: var(--shadow-floating);
}
```

### Rules

- active tab은 민트 soft pill로 표시한다.
- 비활성 탭은 muted gray icon + label.
- 가족 탭에는 작은 하트 badge를 허용한다.
- 터치 영역은 최소 44px 이상이다.

---

## 11.8 Primary Button

### Style

```css
.primary-button {
  min-height: 56px;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--brand-rose), var(--brand-rose-deep));
  color: var(--fg-on-accent);
  box-shadow: var(--shadow-rose);
  font-weight: var(--weight-bold);
}
```

### Rules

- 온보딩과 자녀 화면의 CTA는 핑크를 기본으로 한다.
- 부모 모드의 주요 CTA는 민트 또는 핑크 중 화면 목적에 따라 선택한다.
- 위험 액션에는 primary button 스타일을 쓰지 않는다.

---

## 11.9 Chip

### Types

```txt
ModeChip
LinkedChip
SafetyChip
CountdownChip
ChildChip
CategoryChip
PremiumChip
```

### Rules

- chip은 항상 pill 형태다.
- 텍스트는 12–14px.
- 아이콘은 14–16px.
- 배경은 soft fill, border는 연하게.

---

## 12. Screen Templates

## 12.1 Parent Home Screen

### Information Hierarchy

```txt
1. 날짜 / 다음 일정
2. 오늘 일정
3. 자녀 위치 및 안전 상태
4. 지도 미리보기
5. 하단 내비게이션
```

### Required Sections

```txt
- HeaderCard
- ChildSwitchRail
- DateHero
- TodayScheduleList
- ChildStatusList
- MapPreview
- BottomNavigation
```

### Required Copy Example

```txt
혜니캘린더
학부모 모드
연동 (2명)
꾹
금요일
5월 8일
다음 일정 · 오후 2시 30분 피아노
오늘 일정
피아노
태권도
아이 2명 · 지금 어디?
지금 새로고침
안전
위치 지도
펼치기
```

---

## 12.2 Calendar Screen

### Direction

부모 캘린더는 미니멀하고 읽기 쉬워야 한다.

### Components

```txt
MonthHeader
WeekdayRow
CalendarGrid
DayCell
EventDots
SelectedDatePanel
EventList
AddEventButton
```

### Rules

- 선택 날짜는 민트 또는 핑크 soft fill.
- 오늘 날짜는 얇은 outline.
- 일정 dot은 최대 3개.
- 일요일/토요일은 과하게 색을 넣지 않는다.
- 빈 날짜를 누르면 새 일정 sheet를 연다.

---

## 12.3 Event Sheet

### Direction

80vh bottom sheet로, 고급스럽고 입력하기 쉬워야 한다.

### Sections

```txt
- Sheet Handle
- Title
- Quick Presets
- Event Name
- Time Picker
- Category Chips
- Place Chips
- Memo
- Repeat
- Child Selector
- Save Button
```

### Rules

- 입력 필드는 크고 둥글게.
- 시간 선택은 rail + 직접 입력을 모두 지원.
- 반복 옵션은 preview를 보여준다.
- 저장 버튼은 하단 sticky.

---

## 12.4 Child Tracker Overlay

### Direction

부모가 자녀 위치를 확인하는 화면이지만 감시처럼 보이면 안 된다.

### Components

```txt
ChildRail
Map
ChildMarker
Trail
RefreshButton
BottomPanel
StatusStats
NextEventDistance
```

### Rules

- 지도는 복잡하지 않고 부드러운 색상.
- 아이 마커는 사진/아바타 + 컬러 ring.
- 위험 색상은 danger zone에만 제한.
- “추적”보다 “위치 확인”, “안전 확인” 표현을 사용한다.

---

## 12.5 Child Pair Input

### Direction

자녀가 부모님 코드로 연결하는 화면이다. 귀엽고 안심되는 느낌이 중요하다.

### Components

```txt
MascotHero
Title
Subtitle
KIDInput
QRConnectButton
InfoCard
ConnectButton
```

### Copy

```txt
부모님과 연결하기
부모님 앱에 있는 연동 코드를 입력해 주세요
KID-
QR로 연결하기
코드는 24시간 동안만 사용할 수 있어요
연결하기
```

### Rules

- 자녀 카피는 반말로 조정 가능.
- 입력칸은 8개 box로 명확히 표현.
- QR 연결은 secondary button.
- 마스코트는 100px 이상 사용 가능.

---

## 12.6 Child Home Screen

### Direction

자녀가 오늘 일정을 쉽고 즐겁게 확인하는 화면이다.

### Components

```txt
ChildHero
NextEventCard
QuickActionGrid
CallParentCard
StickerEntry
MemoEntry
BottomNavigation
```

### Rules

- 마스코트를 크게 보여준다.
- 다음 일정은 가장 큰 카드로 표현한다.
- 버튼은 2x2 그리드 허용.
- 카피는 반말.
- 부모 전용 기능은 숨긴다.

---

## 12.7 Permission Wizard

### Direction

자녀 안전 기능을 켜는 화면이다. 부담감 없이 친절하게 안내한다.

### Components

```txt
MascotGuide
StepList
PermissionCard
ProgressState
RunAllButton
DismissText
```

### Rules

- 경고처럼 보이면 안 된다.
- “허용해야 해”보다 “켜볼게” 톤을 사용한다.
- 완료 상태는 민트 check.
- 필요 상태는 핑크/앰버로 부드럽게 표시한다.

---

## 12.8 Memo & Sticker Screens

### Direction

부모와 자녀의 소통 화면은 채팅앱처럼 친숙하되, 가족 앱의 따뜻함이 있어야 한다.

### Components

```txt
MemoBubble
QuickReplyChip
StickerGrid
PraiseStickerCard
SendButton
```

### Rules

- 부모 bubble은 차분한 cream/gray.
- 자녀 bubble은 rose soft.
- 스티커는 3D pastel sticker style.
- 빠른 답장은 pill chip.

---

## 12.9 Subscription Screen

### Direction

구독 화면은 귀엽지만 신뢰감이 중요하다.

### Components

```txt
PremiumHero
ChildSlotStepper
PlanCardMonthly
PlanCardYearly
PriceSummary
AutoRenewalDisclosure
CTA
```

### Rules

- 과도한 압박감 금지.
- 가격은 명확하게.
- 자녀 1인당 가격 구조를 쉽게 이해시킨다.
- premium badge는 gold/rose 조합 가능.

---

## 12.10 Alert Panel

### Direction

알림 화면은 긴급도에 따라 명확하지만 과하게 불안감을 주면 안 된다.

### Severity Visuals

| Severity | Color | Icon |
|---|---|---|
| info | mint/blue | info/calendar |
| caution | amber | caution |
| critical | red | heart shield / SOS |

---

## 13. Copy System

## 13.1 Parent Copy Tone

부모 화면은 존댓말, 짧고 명확하게 작성한다.

### Examples

```txt
좋은 아침이에요
오늘 일정이 3개 있어요
아이 2명 · 지금 어디?
위치가 3분 전에 업데이트됐어요
다음 일정 · 오후 2시 30분 피아노
연결 상태가 안정적이에요
지금 새로고침
전체 보기
펼치기
```

## 13.2 Child Copy Tone

자녀 화면은 반말, 친근하고 안심되는 표현을 사용한다.

### Examples

```txt
안녕, 하은!
오늘 일정 3개 있어
부모님 코드 확인할게
도착이야! 잘했어
스티커 보내볼래?
길찾기 시작해볼까?
조금 있다 전화할게
```

## 13.3 Forbidden Copy

다음 표현은 피한다.

```txt
감시 중
추적 중
위험 아동
통제
강제 관리
비정상
위반
감청
```

대신 다음 표현을 사용한다.

```txt
안전 확인
위치 공유
지금 어디?
도착 확인
연결 상태
응급 확인
주변 소리 확인
```

---

## 14. Motion System

### 14.1 Motion Tokens

```css
:root {
  --duration-fast: 160ms;
  --duration-normal: 240ms;
  --duration-slow: 420ms;
  --duration-mascot-bounce: 600ms;
  --duration-mascot-cheer: 900ms;

  --easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --easing-soft-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 14.2 Motion Rules

| Interaction | Motion |
|---|---|
| Button tap | scale 0.98 |
| Chip select | soft fill transition |
| Card open | fade + translateY |
| Bottom sheet | slide up |
| Kkuk send | heart pulse |
| Mascot child mode | bounce / cheer |
| Parent mode | subtle only |
| SOS | quick, clear, not playful |

---

## 15. Accessibility

### 15.1 Rules

1. 모든 버튼은 최소 44px 터치 영역을 가진다.
2. 색상만으로 상태를 전달하지 않는다.
3. 안전 상태에는 텍스트를 반드시 함께 표시한다.
4. 캡션은 11px 이하로 내려가지 않는다.
5. 주요 정보는 대비를 충분히 확보한다.
6. 장식용 SVG와 이미지에는 `aria-hidden="true"`를 사용한다.
7. 실제 버튼에는 텍스트 또는 `aria-label`이 있어야 한다.
8. 주소, 일정명은 말줄임이 가능하지만 핵심 정보는 유지한다.

### 15.2 Status Accessibility

```txt
안전: green dots + “안전” text
주의: amber icon + “확인 필요” text
위험: red + “응급” 또는 “즉시 확인” text
```

---

## 16. Dark Mode

다크 모드는 출시 polish 단계에서 적용한다.  
어두운 배경에서도 브랜드의 따뜻함이 유지되어야 한다.

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-app: #111417;
    --bg-page: #15181B;
    --bg-card: #1E2226;
    --bg-card-soft: #22262B;

    --fg-primary: #FAFAFA;
    --fg-secondary: #C7C7CC;
    --fg-tertiary: #8E8E93;

    --line-soft: #2D3338;
    --line-default: #3A4046;

    --brand-mint-soft: rgba(49, 196, 141, 0.16);
    --brand-rose-soft: rgba(247, 121, 168, 0.18);
    --brand-lavender-soft: rgba(167, 139, 250, 0.18);
  }
}
```

Dark Mode Rules:

1. 카드와 배경의 대비를 충분히 둔다.
2. 핑크와 민트는 채도를 약간 낮춘다.
3. 3D 아이콘은 그대로 사용할 수 있으나 그림자를 조정한다.
4. SOS 빨강은 다크 모드에서도 명확해야 한다.

---

## 17. Implementation Notes

### 17.1 CSS Token Source

실제 구현 시 모든 디자인 토큰은 다음 파일 하나에 모은다.

```txt
src/styles/tokens.css
```

컴포넌트 내부에서 raw hex, px magic number를 직접 사용하지 않는다.

### 17.2 Component Naming

권장 컴포넌트명:

```txt
AppHeaderCard
ChildSwitchRail
ChildSwitchChip
DateHeroCard
NextEventChip
TodayScheduleSection
EventSummaryCard
ChildStatusSection
ChildStatusCard
MapPreviewCard
BottomNavigation
MascotAvatar
KkukButton
SafetyChip
StatusDots
```

### 17.3 Asset Naming

```txt
assets/mascot/mascot-static.png
assets/mascot/mascot-wave.png
assets/mascot/mascot-cheer.png
assets/mascot/mascot-sleepy.png
assets/mascot/mascot-thumbs-up.png

assets/icons/icon-calendar-check.png
assets/icons/icon-heart.png
assets/icons/icon-location-pin.png
assets/icons/icon-shield-heart.png
assets/icons/icon-bell.png
assets/icons/icon-kkuk-heart.png
assets/icons/icon-force-ring.png
```

---

## 18. AI Design Prompt Template

아래 프롬프트는 디자인 AI, Figma AI, Cursor, Claude, ChatGPT 등에 붙여 넣어 사용할 수 있다.

```txt
혜니캘린더 앱을 Premium Kawaii Family Productivity 디자인 시스템에 맞춰 디자인해 주세요.

귀엽지만 유치하지 않고, 부모가 매일 사용할 수 있을 만큼 세련되고 안정적인 프리미엄 모바일 앱이어야 합니다.
전체적으로 soft pastel mint, blush pink, warm cream, lavender 팔레트를 사용하고, 둥근 카드, 넉넉한 여백, 부드러운 그림자, 고급스러운 iOS 스타일 구성을 적용합니다.

부모 모드는 정보 중심의 Minimal Premium 톤입니다.
부모 화면에서는 마스코트와 3D 아이콘을 작고 절제되게 사용하고, 날짜, 다음 일정, 자녀 위치, 안전 상태가 빠르게 읽히도록 합니다.
자녀 상태는 감시처럼 보이면 안 되며, “안전 확인”, “위치 공유”, “지금 어디?”처럼 부드럽고 안심되는 표현을 사용합니다.

자녀 모드는 더 귀엽고 따뜻한 Cartoon-Warm 톤입니다.
마스코트를 크게 사용하고, 말풍선, 핑크 카드, 부드러운 애니메이션, 친근한 반말 카피를 사용할 수 있습니다.

일러스트와 아이콘은 soft 3D pastel sticker style입니다.
둥근 형태, 부드러운 젤리/클레이 질감, 은은한 하이라이트, 짧은 그림자, 핑크·크림·민트·라벤더 중심 색상으로 만듭니다.
강한 빨강은 SOS와 진짜 응급 상황에만 사용합니다.

모바일 기준 화면 폭은 390px입니다.
기본 좌우 padding은 20px, 섹션 간격은 24~28px, 카드 radius는 22~34px, 버튼과 칩은 pill 형태를 사용합니다.
배경은 완전 흰색보다 아주 연한 민트 또는 크림 오프화이트를 사용합니다.

부모 홈 화면의 구조는 다음 순서로 구성합니다.
1. 상단 브랜드 헤더 카드: 로고, 혜니캘린더, 학부모 모드, 연동 상태, 알림, 꾹 버튼
2. 자녀 빠른 전환 칩: 자녀 이름, 아바타, 상태 dot
3. 날짜 히어로 카드: 요일, 큰 날짜, 다음 일정, 작은 달력/마스코트 일러스트
4. 오늘 일정 카드 목록
5. 아이 2명 위치·안전 상태 카드
6. 위치 지도 미리보기
7. 하단 내비게이션

헤더, 히어로, 일정 카드, 자녀 상태 카드, 지도 미리보기, 바텀 내비게이션은 모두 하나의 디자인 언어로 통일합니다.
모든 UI는 실제 앱에서 사용할 수 있을 만큼 정돈되고, 가독성이 높고, 고급스럽게 완성되어야 합니다.
```

---

## 19. Parent Home Specific Prompt

```txt
혜니캘린더의 부모 모드 홈 화면을 새롭게 디자인해 주세요.

화면은 390x844 모바일 기준입니다.
디자인은 Premium Kawaii Family Productivity 스타일입니다.
귀엽지만 유치하지 않고, 부모가 매일 사용하는 프리미엄 캘린더 앱처럼 세련되어야 합니다.

컬러는 soft mint, blush pink, warm cream, lavender를 사용합니다.
배경은 아주 연한 민트/크림 오프화이트입니다.
카드는 흰색 또는 크림색, radius 28~34px, 부드러운 그림자를 사용합니다.
아이콘과 마스코트는 soft 3D pastel sticker style입니다.

화면 구성:
1. 상단 헤더 카드
- 왼쪽: 작은 마스코트 아바타
- 앱 이름: 혜니캘린더
- 칩: 학부모 모드, 연동 (2명)
- 오른쪽: 알림 버튼, 💗 꾹 버튼

2. 자녀 전환 칩
- 혜니 active chip: 민트 accent
- 아이 inactive chip: 핑크/크림 accent
- 각 칩에는 원형 아바타와 상태 dot 포함

3. 날짜 히어로 카드
- 금요일
- 큰 날짜: 5월 8일
- 다음 일정 · 오후 2시 30분 피아노
- 오른쪽에는 작은 3D 달력과 마스코트 일러스트

4. 오늘 일정
- 피아노 14:30
- 태권도 20:00
- 각 카드에는 카테고리 아이콘, child label ‘혜니’, 시간, chevron 포함

5. 아이 상태
- 제목: 아이 2명 · 지금 어디?
- 두 개의 child status card
- 혜니: 주소 snippet, 배터리 78%, 3분 전, 안전 chip, 초록 점 3개
- 아이: 주소 snippet, 배터리 82%, 2분 전, 안전 chip, 초록 점 3개
- 혜니는 민트 accent, 아이는 핑크 accent

6. 위치 지도
- 둥근 미니 지도
- 두 아이의 위치 핀
- 오른쪽에 펼치기 액션

7. 하단 내비게이션
- 홈, 오늘, 일정, 장소, 메모, 가족
- 홈 active
- glassy white rounded bar, mint active pill

전체적으로 실제 서비스 앱처럼 가독성, 여백, 컴포넌트 완성도를 높여 주세요.
```

---

## 20. Negative Prompt

디자인 AI에게 함께 전달할 금지 조건이다.

```txt
피해야 할 것:
- 기존 앱 화면을 그대로 복사한 레이아웃
- 너무 유치한 키즈앱 스타일
- 과한 네온 컬러
- 진한 초록색 위주의 공공기관 느낌
- 복잡한 지도
- 지나치게 많은 테두리
- 딱딱한 관리자 대시보드 느낌
- 감시앱처럼 보이는 표현
- 빨강 경고를 일반 상태에 남발
- 너무 작은 글자
- 정보가 한 화면에 과하게 밀집된 구성
- 투박한 아이콘
- 검은색 테두리가 강한 캐릭터
- 저해상도 스티커 느낌
- 랜덤한 이모지 혼용
- 모든 카드가 같은 크기와 같은 강조도를 갖는 구성
- 마스코트가 정보를 가리는 구성
- CTA가 너무 많아 우선순위가 흐려지는 구성
```

---

## 21. Quality Checklist

디자인 산출물은 다음 기준을 통과해야 한다.

```txt
[ ] 부모가 3초 안에 오늘 다음 일정을 알 수 있다.
[ ] 부모가 3초 안에 두 아이가 안전한지 볼 수 있다.
[ ] 귀엽지만 감시앱처럼 보이지 않는다.
[ ] 핑크와 민트가 균형 있게 쓰였다.
[ ] 마스코트가 브랜드 감성을 주되 정보를 방해하지 않는다.
[ ] 카드, 칩, 지도, 내비게이션이 하나의 디자인 언어로 보인다.
[ ] 실제 앱으로 구현 가능한 구조다.
[ ] 모든 텍스트가 모바일에서 읽기 쉽다.
[ ] 터치 영역이 충분하다.
[ ] 강한 빨강이 SOS/응급에만 사용된다.
[ ] 부모 화면은 존댓말 톤이다.
[ ] 자녀 화면은 친근한 반말 톤이다.
[ ] 다자녀 상태가 명확히 구분된다.
[ ] 지도는 복잡하지 않고 미리보기 역할에 맞다.
[ ] 바텀 내비게이션의 active 상태가 명확하다.
```

---

## 22. Final Design Direction Summary

혜니캘린더의 새 디자인은 다음 한 문장으로 판단한다.

```txt
가족의 하루를 다정하게 보여주는 프리미엄 캘린더 앱이며, 자녀 안전 상태를 부드럽고 신뢰감 있게 확인할 수 있는 귀여운 패밀리 생산성 앱.
```

이 문서의 기준을 벗어나는 디자인은 혜니캘린더의 신규 디자인 방향으로 사용하지 않는다.
