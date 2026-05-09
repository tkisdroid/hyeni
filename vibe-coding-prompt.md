# 혜니캘린더 — 바이브 코딩 마스터 프롬프트 (v1, 2026-05-08)

> 다른 AI(ChatGPT/Claude/Cursor/Copilot 등)에 **이 문서 전체를 그대로 입력**하면 혜니캘린더 앱을 처음부터 끝까지 만들 수 있도록 작성된 단일 사양서.
> 코드 검증된 실제 앱 동작을 기반으로 함. 추측 표현 금지, 모든 항목은 "이렇게 동작한다"로 단정.

---

## 🟦 SECTION 0 · 메타 지시 (모든 LLM에게)

### 0.1 너의 역할
너는 시니어 풀스택 + 모바일 엔지니어다. 이 문서를 읽고 **혜니캘린더(com.hyeni.calendar)** 라는 가족 캘린더 + 자녀 안전 모니터링 앱을 처음부터 만든다.

### 0.2 작업 원칙 (절대 위반 금지)
1. **추측 금지**: 명세에 없는 동작은 만들지 말고, 문서를 그대로 따른다.
2. **단계별 빌드**: SECTION 18 우선순위(Phase 1~5)대로 진행하고 각 단계마다 빌드/실행 가능한 상태로 만든다.
3. **토큰 only**: 색상·간격·반경은 SECTION 4의 CSS 변수만 사용. 절대 hex/rgb/hsl/px 매직넘버를 컴포넌트에 직접 쓰지 않는다.
4. **불변(immutable) 패턴**: `array[i] = x` 같은 mutation 금지. 항상 `[...arr]` / `{...obj}`.
5. **존댓말/반말 분기**:
   - 부모 대상 화면 = 존댓말 ("가족 이름을 알려주세요")
   - 자녀 대상 화면 = 친근한 반말 ("부모님 코드 확인할게")
   - 같은 마스코트라도 화자에 따라 톤이 다르다.
6. **모바일 우선**: 모든 디자인은 360-414px 모바일 viewport 기준. iOS Safe Area + Android back button 반드시 처리.
7. **토큰 단일 출처**: `src/styles/tokens.css` 1개 파일로 모든 디자인 토큰 정의.
8. **SOS는 진한 빨강(#E03030 류) 전용** — 일반 경고는 amber. 자녀에게 평상시 빨강 노출 금지.

### 0.3 출력 형식
- 매 단계마다 (a) 생성한 파일 목록 (b) 핵심 코드 (c) 검증 명령(`npm run build`)을 보여준다.
- 한 단계 끝나면 사용자 승인 받고 다음 단계 진행.
- 파일은 한 번에 완전한 형태로(부분 코드 / TODO 금지).

---

## 🟦 SECTION 1 · 제품 정의

### 1.1 한 줄 정의
**한국 가족(부모 + 초·중 자녀)이 일정을 함께 관리하면서 부모가 자녀의 위치·디바이스·일정 도착을 안전하게 모니터링하는 모바일 앱.**

### 1.2 핵심 가치
1. **가족 단위 일정 동기화** — 한 일정을 가족 전체 또는 특정 자녀에게 보내고, 자녀 폰에서도 확인.
2. **자녀 안전** — 위치 실시간 공유, 디바이스 상태(배터리·화면시간), 응급 강제 알림.
3. **부담 적은 부모-자녀 소통** — 짧은 메모, 칭찬 스티커, "꾹"(♥ 푸시).

### 1.3 사용자
- **부모(주 보호자 / 보조 보호자)**: 일정 작성, 자녀 추적, 가족·구독·장소 관리
- **자녀(초·중)**: 일정 read-only, 위치 자동 송신, 메모/스티커 답신, ⚙ 자기 캐릭터 선택

### 1.4 같은 앱, 역할 기반 분기
하나의 APK로 두 모드 모두 운영. `myRole === "parent"` / `"child"` 로 분기.

---

## 🟦 SECTION 2 · 기술 스택 (정확)

| 영역 | 선택 | 비고 |
|------|------|------|
| 프론트 | **React 19 + Vite + TypeScript-optional** (JS도 OK) | 함수형 컴포넌트만 |
| 모바일 셸 | **Capacitor 8** | Android 기본, iOS 추후 |
| 스타일 | **순수 CSS + CSS Variables** (Tailwind X) | 토큰 단일 출처, 내장 클래스만 |
| 폰트 | **Pretendard JP**(Variable) → fallback Pretendard, system-ui | body weight 500 |
| 백엔드 | **Supabase** | Postgres + Realtime + Storage + Auth + Edge Functions |
| 지도 | **Kakao Maps SDK**(JS) | 한국 환경, 한국어 주소 정확 |
| 위치 추적 | **Capacitor 커스텀 플러그인 BackgroundLocation** | foreground service |
| 푸시 | **FCM**(Android) — 자체 Edge Function `send-instant-push` | iOS는 추후 |
| 결제 | **Qonversion**(Capacitor 플러그인) | RevenueCat 대체, 한국 결제 친화 |
| 상태관리 | React `useState` + custom hooks (Redux/Zustand 없음) | App.jsx 단일 orchestrator |
| 빌드 | Vite | 빌드 산출물 → `dist/` → Capacitor가 `android/app/src/main/assets/public`로 sync |
| 폴더 | `src/components/{auth,childMode,multichild,onboarding,...}` | feature 별 폴더 |

### 2.1 권장 패키지(`package.json` 핵심)
```json
{
  "dependencies": {
    "@capacitor/app": "^8.0",
    "@capacitor/browser": "^8.0",
    "@qonversion/capacitor-plugin": "^1.4",
    "@supabase/supabase-js": "^2.99",
    "react": "^19.2",
    "react-dom": "^19.2",
    "lucide-react": "^1.14"
  }
}
```

### 2.2 환경 변수 (절대 코드에 하드코딩 X)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_KAKAO_MAP_KEY`
- `VITE_QONVERSION_API_KEY`
- (선택) `VITE_FEEDBACK_RECIPIENT`

값 없을 시 `throw new Error("...")` — silent fallback 금지.

---

## 🟦 SECTION 3 · 디자인 시스템 (양쪽 모드 톤 분리 + 공유 brand)

### 3.1 톤 분기

| 항목 | 부모 화면 | 자녀 화면 |
|------|---------|---------|
| 톤 | **Minimal-Pro** (Notion Calendar / Cron / Fantastical) | **Cartoon-Warm** (Khan Academy Kids / Duolingo / Headspace 류) |
| 배경 | 흰색 | 흰색 + 핑크 액센트 카드(cartoon-rose-soft) |
| 마스코트 노출 | 작게 (28-40px), chip 없이, opacity 0.85-0.9 | 크게 (56-96px), 핑크 chip 안에, cheer 애니메이션 |
| 카피 | 존댓말, 절제 ("좋은 아침이에요") | 반말, 친근 ("안녕! 너 부모님 코드 확인할게") |
| 색상 톤 | monochrome backbone + 단일 accent | 핑크 강조 + 6 카테고리 컬러 |
| 타이포 | 큰 headline 22-28px, 한 줄 sub | medium body 14-16px, 말풍선 |
| chrome | hairline 1px stroke 외 거의 없음 | 둥근 카드 + soft shadow |
| 애니메이션 | 거의 없음 (subtle transition만) | mascot bounce / cheer / pulse 자유 |

### 3.2 공유 brand layer (양쪽 공통)
- **마스코트**: 분홍 후드 여자아이 + 아이스크림. 단일 캐릭터.
- **로고**: 같은 마스코트의 아이콘화 → `public/icon-192.png` / `public/icon-512.png`
- **분홍**: `#F779A8` 계열 (theme accent). 6 테마 픽커로 사용자가 변경 가능.
- **카테고리 6색**: 학원 #A78BFA / 운동 #34D399 / 취미 #F59E0B / 가족 #F87171 / 친구 #60A5FA / 기타 #EC4899
- **SOS 빨강**: 강한 빨강은 SOS·긴급·하트 아이콘에만. 일반 알림은 amber.
- **하트 쉴드 SOS 배지**: 16-160px 어느 크기에서도 일관된 SVG (참고: 아이가 강한 SOS 빨강에 두려움 갖지 않도록 하트로 보이게).

### 3.3 마스코트 구현 (`src/components/auth/HyeniMascot.jsx`)
인라인 SVG, 토큰 기반 색상. variants:
- `static` (88x88 viewBox) — 미소 + 양 볼 + 아이스크림 콘
- `wave` (96x96 viewBox) — 위 + 흔드는 손 (CSS keyframe `hyeni-mascot-wave-arm`)
- 추가 `cheer` 클래스 (`hyeni-mascot-cheer`) — 점프 + 회전 keyframe

색상은 다음 CSS 변수만 사용 (theme 변경 시 자동 반영):
```jsx
style={{
  "--mascot-pink": "var(--theme-accent)",
  "--mascot-pink-soft": "var(--theme-accent-soft)",
  "--mascot-pink-line": "var(--theme-accent-line)",
  "--mascot-cream": "var(--bg-base)",
  "--mascot-ink": "var(--fg-primary)",
}}
```

---

## 🟦 SECTION 4 · 디자인 토큰 (CSS Variables)

`src/styles/tokens.css` 1개 파일에 모든 토큰. 컴포넌트는 절대 raw 값을 쓰지 않는다.

### 4.1 색상 (라이트 모드 기준, 다크 모드는 SECTION 4.6)
```css
:root {
  --bg-base: #FFFFFF;
  --bg-page: #FAFAF7;
  --bg-elevated: #FFFFFF;
  --fg-primary: #1A1A1A;
  --fg-secondary: #595959;
  --fg-tertiary: #8C8C8C;
  --fg-on-accent: #FFFFFF;
  --theme-accent: #F779A8;
  --theme-accent-soft: #FFC1CF;
  --theme-accent-line: #FFD6DD;
  --theme-accent-text: #C3325B;
  --line-default: #E5E5E0;
  --line-soft: #EFEEEA;
  --line-strong: #D6D5D0;
  --status-positive: #34D399;
  --status-positive-strong: #1C8245;
  --status-cautionary: #F59E0B;
  --status-cautionary-strong: #B87A00;
  --status-negative: #F87171;
  --status-negative-strong: #E03030;
  --cartoon-rose: #FF6E8E;
  --cartoon-rose-strong: #F04A6F;
  --cartoon-rose-soft: #FFC1CF;
  --cartoon-rose-text: #C3325B;
  --cartoon-line: #FFD6DD;
  --cartoon-bg-card: #FFFFFF;
  --cartoon-bg-chip: #FFE0E6;
  --cartoon-bg-chip-mint: #DAF6E3;
  --cartoon-bg-chip-yellow: #FFF1A8;
  --cat-academy: #A78BFA;
  --cat-exercise: #34D399;
  --cat-hobby: #F59E0B;
  --cat-family: #F87171;
  --cat-friend: #60A5FA;
  --cat-other: #EC4899;
}
```

### 4.2 간격
```css
:root {
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-7: 32px; --space-8: 40px;
  --space-12: 64px;
  --space-screen-pad: 16px;
  --space-screen-gap: 20px;
}
```

### 4.3 반경
```css
:root {
  --radius-chip: 8px;
  --radius-button: 10px;
  --radius-card: 16px;
  --radius-card-lg: 20px;
  --cartoon-radius-card: 20px;
  --radius-pill: 999px;
}
```

### 4.4 타이포
```css
:root {
  --font-sans: "Pretendard JP", "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", Consolas, monospace;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --leading-loose: 1.7;
}
body { font-weight: var(--weight-medium); font-family: var(--font-sans); }
```

### 4.5 motion
```css
:root {
  --duration-fast: 160ms;
  --duration-normal: 240ms;
  --duration-mascot-bounce: 600ms;
  --duration-mascot-cheer: 900ms;
  --easing-default: cubic-bezier(0.2, 0, 0, 1);
  --easing-mascot: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 4.6 다크 모드
```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-base: #1A1A1A;
    --bg-page: #0F0F0F;
    --fg-primary: #FAFAFA;
    --fg-secondary: #A0A0A0;
    --line-default: #2E2E2E;
  }
}
```

### 4.7 6 테마 픽커
JS에서 `applyThemeColor(hex)` 호출 시 `document.documentElement.style.setProperty("--theme-accent", hex)` + soft/line/text 자동 derive. 캐시는 localStorage `hyeni-theme-color`.

---

## 🟦 SECTION 5 · Supabase 데이터 모델

### 5.1 테이블

**families**
```sql
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pair_code text unique not null,
  pair_code_expires_at timestamptz,
  primary_parent_id uuid references auth.users(id),
  planned_child_count int default 1,
  device_type text,
  playdate_enabled boolean default false,
  phones jsonb default '{"mom":"","dad":""}',
  created_at timestamptz default now()
);
```

**family_members**
```sql
create type family_role as enum ('parent', 'child', 'co_parent');
create table family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid references auth.users(id),
  role family_role not null,
  name text,
  child_order int,
  birthdate date,
  color_hex text,
  photo_url text,
  emoji text default '🐰',
  parent_kind text,
  record_audio_granted boolean,
  post_notification_granted boolean,
  notifications_enabled boolean,
  channels_enabled boolean,
  full_screen_intent_allowed boolean,
  battery_optimizations_ignored boolean,
  bg_location_granted boolean,
  remote_listen_channel_enabled boolean,
  location_service_running boolean,
  exact_alarm_granted boolean,
  battery_level int,
  battery_low boolean,
  charging boolean,
  network_type text,
  screen_on_ms bigint,
  last_seen_at timestamptz,
  app_blocked boolean default false,
  created_at timestamptz default now()
);
create unique index on family_members (family_id, user_id);
create unique index on family_members (family_id, child_order) where role='child';
```

**events** (일정)
```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  date date not null,
  time time not null,
  end_time time,
  title text not null,
  emoji text,
  category text,
  child_ids uuid[] default '{}',
  is_family_event boolean default false,
  location jsonb,
  memo text,
  repeat_weeks int,
  repeat_group_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create index on events (family_id, date);
```

**child_locations / location_history**
```sql
create table child_locations (
  child_user_id uuid primary key references auth.users(id),
  family_id uuid not null references families(id),
  lat numeric not null,
  lng numeric not null,
  accuracy numeric,
  battery_level int,
  updated_at timestamptz default now()
);
create table location_history (
  id bigserial primary key,
  child_user_id uuid not null,
  family_id uuid not null,
  lat numeric not null,
  lng numeric not null,
  recorded_at timestamptz default now()
);
create index on location_history (child_user_id, recorded_at desc);
```

**saved_places / academies / danger_zones**
```sql
create table saved_places (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  category text not null,
  name text not null,
  address text,
  lat numeric, lng numeric,
  is_playdate_safe boolean default false,
  public_place_id uuid,
  created_at timestamptz default now()
);
create table academies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  emoji text, color_hex text,
  category text default 'academy',
  address text, lat numeric, lng numeric,
  schedule jsonb default '[]',
  created_at timestamptz default now()
);
create table danger_zones (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  lat numeric not null, lng numeric not null,
  radius_m int default 100,
  created_at timestamptz default now()
);
```

**memos / stickers / alerts / sos_events**
```sql
create table memos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  date_key text not null,
  content text not null,
  user_id uuid references auth.users(id),
  user_role family_role not null,
  origin text,
  read_by_partner boolean default false,
  created_at timestamptz default now()
);
create table stickers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  to_user_id uuid, from_user_id uuid,
  date_key text not null,
  type text not null,
  emoji text not null,
  title text,
  created_at timestamptz default now()
);
create table alerts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_user_id uuid,
  severity text not null,
  title text not null,
  message text,
  read boolean default false,
  created_at timestamptz default now()
);
create table sos_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  sender_id uuid not null,
  sender_role family_role not null,
  dedup_key text unique,
  created_at timestamptz default now()
);
```

**구독 / 친구놀이 / public_places / force_ring_logs**
```sql
create table family_subscriptions (
  family_id uuid primary key references families(id) on delete cascade,
  qonversion_user_id text,
  active_entitlements text[] default '{}',
  trial_started_at timestamptz, trial_ends_at timestamptz,
  updated_at timestamptz default now()
);
create table child_subscription_slots (
  family_id uuid not null references families(id) on delete cascade,
  child_order int not null,
  active boolean default false,
  product_id text,
  primary key (family_id, child_order)
);
create table friend_playdate_sessions (
  id uuid primary key default gen_random_uuid(),
  public_place_id uuid not null,
  family_a_id uuid not null, family_b_id uuid not null,
  child_a_id uuid not null, child_b_id uuid not null,
  initiator_user_id uuid not null,
  started_at timestamptz default now(),
  ended_at timestamptz, end_reason text
);
create table public_places (
  id uuid primary key default gen_random_uuid(),
  kakao_place_id text unique not null,
  name text, category text,
  lat numeric, lng numeric
);
create table force_ring_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  parent_user_id uuid not null,
  target_child_id uuid not null,
  message text,
  delivered_at timestamptz,
  created_at timestamptz default now()
);
```

### 5.2 RPC (Postgres functions)
- `setup_family(parent_user_id, parent_name, family_name, planned_child_count, children, parent_phone, parent_gender)` → families row
- `set_family_member_photo_url_by_id(family_id, member_id, url)`
- `set_family_member_profile_by_id(family_id, member_id, name, color_hex)`
- `rename_family_member_by_id(family_id, member_id, name)`
- `unpair_child(family_id, child_user_id)`
- `join_family(pair_code, child_user_id, name)` → families row + family_members row
- `kkuk_check_cooldown(p_sender)` → boolean
- `find_friend_candidates(family_id, public_place_id)` → 자녀 목록
- `start_playdate(public_place_id, family_a_id, family_b_id, child_a_id, child_b_id, initiator_user_id)`
- `end_playdate(session_id, end_reason)`

### 5.3 Storage 버킷
- `child-photos/` — 자녀 프로필 (path `{familyId}/child-{order}-{ts}.{ext}`)
- `parent-photos/` — 부모 프로필
- `audio-clips/` — 주변 소리 듣기 임시

### 5.4 Edge Functions
- `ai-voice-parse` — 음성/이미지 → 일정 N개 추출 (`{add_events, unknown}`)
- `send-instant-push` — FCM batch (idempotency_key 지원)
- `force-ring-trigger` — 자녀 폰 강제 알람

### 5.5 Realtime broadcast 이벤트
- `child_location` — 자녀 위치
- `kkuk` — 꾹
- `location_refresh_request` / `child_device_status_request` — 부모 → 자녀 fresh 요청
- `remote_listen_start` / `remote_listen_stop` — 주변 소리
- `mic-permission-denied` — 자녀 측 거절 통보

### 5.6 RLS
모든 테이블 RLS ON. 정책:
- 가족 멤버만 자기 family_id row read/write
- 자녀는 본인 child_ids 포함 events만 read (privacy filter)
- 부모만 academies/danger_zones/saved_places write
- 보조 보호자(co_parent) 일부 destructive RPC 차단 (서버 enforce)

---

## 🟦 SECTION 6 · 인증 / 가족 셋업 흐름

### 6.1 진입 라우팅 (App.jsx 의사코드)
```
1. localStorage["hyeni-last-role"] 읽기 → showSplash 1.5s
2. Splash 끝나면 → RoleSetupModal
3. 부모 카드 → ParentAuthScreen (카카오/구글/네이버/ID-PW)
4. 자녀 카드 → ChildEntryTransition 800ms → ChildPairInput

라우팅 가드 (매 render):
- !myRole || (!authUser && !authLoading) → RoleSetupModal
- isNativeApp && !isParent && !allReady && !permissionWizardDismissed → ChildPermissionWizard 오버레이
- showParentSetup && !familyInfo:
    showCreateWizard ? <PairingWizard/> : <ParentSetupScreen/>
- myRole==="child" && authUser && !familyInfo → <ChildPairInput/> (HARD GATE — 다른 UI 마운트 X)
- 그 외 → 메인 앱
```

---

## 🟦 SECTION 7 · 마스코트 호스팅 패턴 (재사용)

### 7.1 부모용 (Minimal-Pro)
- 마스코트 32-40px, chip 없이, opacity 0.85-0.9
- 큰 monochrome typo 22-28px headline + 작은 sub line
- 말풍선 사용 X

### 7.2 자녀용 (Cartoon-Warm)
- 마스코트 56px chip 안 (cartoon-bg-chip 배경 + cartoon-line border)
- 말풍선 (cartoon-rose-soft 배경 + cartoon-rose 보더 + tail)
- 16px bold cartoon-rose-text title + 12px sub

### 7.3 Step 6 Complete 패턴 (PairingWizard 끝)
- 마스코트 84-96px wave + cheer 클래스 (점프)
- 22px bold cartoon-rose-text headline
- 자녀 아바타 lineup (48px circles, photo or color, 이름 11px)

---

## 🟦 SECTION 8 · 부모 모드 — 상세 흐름

### 8.1 Splash → Role → Auth
- **Splash**: 로고 + "혜니캘린더 / 가족 일정 동기화 중" + 부모(80px) + 자녀(104px) shimmer skeleton, max 1500ms
- **RoleSetupModal**: HeartsBackground + AppBrandLogo + HyeniWordmark. 부모 카드(ParentMomDuo + "ID·카카오로 로그인") / 자녀 카드(HyeniGirl + "부모님 코드로 시작"). 재방문 시 "지난번엔 X로 사용하셨어요" 빠른 복귀 + 마지막 사용 카드에 ♡
- **ParentAuthScreen**: 카카오/구글/네이버 OAuth + ID·PW 펼치기 + "처음 오셨나요? 가입하기"
- **ParentSignupScreen**: 이름/아이디/PW(6+)/PW확인/역할(엄마/아빠/보호자)/생년월일/전화 → "인증번호 받기" → 6자리 OTP → "인증번호 확인 후 가입"

### 8.2 ParentSetupScreen
"가족 연결을 시작해요" 두 카드:
- 새 가족 만들기 → PairingWizard
- 기존 가족 합류 → 코드 입력(KID-XXXXXXXX) → `join_family_as_parent`

### 8.3 PairingWizard (6 step)
모든 step 상단: wizard-dots 6개 + 마스코트 인트로(말풍선 title/sub)

| Step | 화면 | 검증 |
|------|------|-----|
| 0 | 가족 이름 (max 20) | 비우면 다음 disabled |
| 1 | 디바이스 종류 picker (자기폰/공기계/키즈폰) | 미선택 disabled |
| 2 | 자녀 수 1-5명 chip | 미선택 disabled |
| 3 | 자녀 N번 반복 — 사진/이름/생년월일/색 | 마지막에서 이름·생년월일 모두 차야 다음 |
| 4 | 페어링 코드 큰 표시 + "코드는 24시간 후 자동 만료" | "모든 자녀 페어링 완료" |
| 5 | 마스코트 cheer + "{가족명} 가족이 시작됐어요!" + 자녀 아바타 lineup | "시작하기" → 부모 홈 |

**Step 3 사진 업로드**: data URL로 임시 → setupFamily 후 `uploadPendingPhotos`가 storage `child-photos/{familyId}/child-{order}-{ts}.{ext}` 업로드.

**back 동작**: step ≥ 4 → 강제 onComplete, step > 0 → 한 단계, step 0 → onCancel.

### 8.4 부모 홈 (HomeTab — 다자녀)
위계 (Minimal-Pro):
1. **HomeGreeting** — 시간대별 인사 (5-11 좋은 아침 / 11-18 오늘도 수고 / 18-23 하루 수고 / 심야 푹 쉬세요) + 32px 마스코트 trailing(opacity 0.9)
2. **HomeBigStat** — 큰 날짜 + 통계
3. **NextEventHero**:
   - 빈 상태: "오늘의 다음 일정 / 오늘 일정 모두 마무리됐어요" + 40px static 마스코트
   - 있을 때: eyebrow "다음 일정" + 카운트다운 chip + 큰 시계 + 이모지·제목 + 자녀 dot+이름 + 📍 위치. 좌측 borderInlineStart는 자녀 색상.
4. **자녀 그리드** — "아이 N명 · 지금 어디?" + 🗺️ 지도 토글. density: 4명+ mini / 2-3명 row / 1명 full. 클릭 → ChildDetailScreen
5. **TodayEventsList**

### 8.5 부모 헤더 + 공통
- 좌측 로고 (탭 → bounce + "안녕! 나는 혜니야 💗") / "혜니캘린더" 라벨
- 학부모 모드 chip (역할 재선택) / 연동 chip ("🔗 연동 (N명)" / "🔗 연동하기" / "👨‍👩‍👧 가족 만들기")
- 우측: 🔔 알림 종(미읽 ≤9 뱃지) · 💗 꾹(tap 즉시 / hold 500ms 자동 / 5s cooldown)
- 자녀 빠른 전환 chip rail (2명+) — 활성 시 자녀 컬러
- 푸시/네이티브 권한 배너
- TrialEndingBanner / ActivePlaydateBanner

### 8.6 캘린더 탭
- 큰 연도/월 + ‹/› 이전·다음 달
- 7 요일 헤더 (일=빨강 톤, 토=파랑 톤)
- 일자 셀: today/selected 강조, 일정 dot ≤3개, 클릭 → 빈 날이면 즉시 새 일정 모달
- 선택 날짜 일정 리스트 (이모지+제목+자녀라벨/시간·장소/distance chip/메모 chip/✏️ 수정/🗺️ 경로 보기/× 삭제/status tag)
- DailyTrailMap + 등록 장소 visit 리스트

### 8.7 일정 모달 (EventSheet — 80vh bottom sheet)
필드:
- ⚡ 빠른 선택 프리셋 (SCHEDULE_PRESETS) → 카테고리 자동 + 직전 일정 prefill
- 📌 일정 이름
- ⏰ 시간: 시작/종료 토글, 직접 입력 type=time(1분 단위), 시간 rail 7-21시 + 30분 슬롯, 빠른 종료 chips(30분/1시간/1.5시간/2시간), summary "{range} · {duration}"
- 🏷️ 종류 카테고리 칩
- 📍 학원/저장장소 chips → 선택 시 location prefill / "🗺️ 지도에서 장소 선택"
- 📝 메모
- 🔁 반복 — 토글 → 1/2/3개월 chips → 미리보기
- 다자녀 ChildSelector

저장: 가족 전체/자녀 ID 따라 분기. 반복 시 weeks*7 row 생성. sendInstantPush.

### 8.8 자녀 추적 (ChildTrackerOverlay)
- 상단 자녀 chip rail
- Kakao map: 마커(사진+컬러 border) + 30m 도보 반경 원 + 시간 그라데이션 trail + 오래 머문 곳 dwell markers + 일정/academy 마커
- "지금 갱신" → realtime broadcast `location_refresh_request`
- bottom panel 드래그 height (110px ↔ 62vh): 통계, 시간대 segment chips, 오래 머문 곳 ≤3개, 다음 일정 + 거리

### 8.9 ChildDetailScreen
- 헤더 ← + 아바타 + 이름 + (옵션)⚙
- 안전 dot 3개 + 상태 라벨
- HomeBigStat (자녀 events filter)
- 위치 placeholder
- 오늘 일정 timeline
- 안전 메트릭

### 8.10 친구놀이 (FriendPlaydatePanel)
FriendPlaydateToggle / PlaydateSafePlaceList / ActivePlaydateCard / PlaydateHistory(10개) / realtime subscribe

### 8.11 응급 강제 알림 (ForceRingPanel)
"진짜 응급 시에만" + quota chip + 미터 바 + 다자녀 picker + ForceRingTriggerButton(메시지 입력 → 확인 → force-ring-trigger Edge Fn) + ForceRingActiveStatus + ForceRingHistory

### 8.12 장소 관리
- **PlaceManagerScreen** — 4 collapsible (집/학원/자주 가는 곳/조심할 곳)
- **AcademyManager** — 학원 CRUD + schedule(요일·시작·종료·repeatWeeks). 변경 시 미래 events reconcile
- **SavedPlaceManager** — 자주 가는 장소 / 친구놀이 안전장소. 무료 1개 한도
- **DangerZoneManager** — 1개 초과 MULTI_GEOFENCE 게이트

### 8.13 활동 알림 패널 (AlertPanel — bottom sheet 82vh)
"활동 알림 / 아이 활동 리포트" + 분석 ON/OFF + 알림 카드 (severity별 컬러 🚨⚠️ℹ️ + 시간 + 미읽 표시 + 탭 → markAlertRead)

### 8.14 AI 일정 입력 (AiScheduleModal — 85vh)
- 3 입력: 🎤 말하기 / 📷 이미지 / ✏️ 텍스트
- "✅ 다 입력했어요^^" → ai-voice-parse Edge Fn
- 결과: add_events 카드 (모두 등록 / 개별 등록) / unknown 메시지

### 8.15 부모 메모 (ParentMemoPage)
풀스크린 채팅. partnerName 자동, 빠른 답장 chips, sendMemo + realtime + sendInstantPush. 첫 진입 onboarding toast 6초

### 8.16 스티커북 (StickerBookModal)
통계 그리드. 부모: 칭찬스티커 보내기 (emoji + title) → addSticker(... 'praise' ...) + sendInstantPush

### 8.17 구독 관리 (SubscriptionManagement)
"혜니 프리미엄 / 자녀 1인당 ₩1,500/월 · 가족 단위 결제". avatar stepper + plan-grid(월/년 33% 할인) + PriceSummary + AutoRenewalDisclosure

### 8.18 설정 (ParentSettingsScreen)
1. 내 계정 (이름/이메일/전화)
2. 자녀 관리 (PairingModal / 아이 추가)
3. 알림 (일정+MinutesBeforeSelector / 위치 / 친구놀이)
4. 구독 (현재 플랜)
5. 데이터·개인정보 (장소 관리 / 데이터 다운 / 처리방침)
6. 도움말 (FAQ / 문의 / 버전)
7. 위험 (로그아웃 / 자녀 연결 해제 / 구독 해지)
8. 계정 삭제 (severity=critical, "준비 중")

### 8.19 PairingModal
자녀 미연결: PairCodeSection (큰 코드 + 복사 + QR + TTL + 🔄 새로고침). 자녀 멤버 카드: 이름 변경 / 프로필 변경 / 사진 변경 / 연동 해제(danger confirm)

### 8.20 주변 소리 듣기 (AmbientAudioRecorder)
프리미엄 + canUseRemoteListen. realtime channel + initiator + targetChild. 자녀 mic 권한 거부 시 부모 측 showMicPermissionHelp

### 8.21 꾹 (Heart) 시스템
tap 즉시 / hold 500ms / 5초 cooldown / dedup_key 60s LRU / realtime broadcast → not-joined 시 1.8s polling → FCM 폴백. 수신 풀스크린 오버레이(마스코트 cheer + ♥ pulse). 자녀 꾹 → 부모 자동 후속 2분/5분 위치 갱신.

### 8.22 백 핸들러 stack (부모)
1. screen-local
2. routeEvent
3. showChildTracker
4. showMapPicker
5. showAddModal (isDirty 시 confirm)
6. showParentMemoPage
7. showAcademyMgr / showSavedPlaceMgr
8. showAlertPanel
9. showPhoneSettings / showMicPermissionHelp / showFeedbackModal / showParentSetup
10. editingLocForEvent
11. voicePreview
12. activeView !== "calendar" → calendar
13. showPairing
14. minimizeApp() (앱 최소화, **종료 X**)

---

## 🟦 SECTION 9 · 자녀 모드 — 상세 흐름

### 9.1 ChildPairInput (HARD GATE-01)
HeartsBackground + HyeniGirl 84px. zIndex 500.
- "부모님과 연결하기 / 부모님 앱에 있는 연동 코드에서 KID- 뒤의 코드를 입력해 주세요"
- prefix label "KID-" + 8자리 (A-Z0-9 외 자동 제거, 자동 대문자, placeholder "XXXXXXXX")
- 에러 분기: 빈 코드 / QR 실패 / 만료 / 시도 횟수 초과 / 잘못된 코드 / 프리미엄 키워드
- 🔗 연결하기 + 📷 QR로 연결하기 → QrPairScanner
- 연동 코드 안내 카드 (KID-A1B2C3 예시)
- 하단 FamilyHome 240px

### 9.2 QrPairScanner (zIndex 650)
카메라 권한: native → 웹 → getUserMedia. 단계 표시. BarcodeDetector(qr_code) + requestAnimationFrame. 거부 시 "권한 다시 확인" + "앱 설정 열기". viewfinder 360px max 3:4 + 마스크. 인식 → handleJoin.

### 9.3 연결 성공 phase
HyeniGirl 108px + "연결됐어요! / 가족 정보 불러오는 중 / 위치 권한을 묻는 창이 뜨면 허용해 주세요". 실패 시 1.5초 후 자동 새로고침.

### 9.4 ChildEntryTransition (800ms)
HyeniMascot wave 96px + "안녕! / 잠깐만, 부모님 코드 확인할게" → fade-out 280ms.

### 9.5 권한 마법사 (7단계)
| # | id | 액션 | ready 조건 |
|---|----|------|-----------|
| 1 | microphone | 권한 열기 | health.recordAudioGranted |
| 2 | notifications | 알림 켜기 | post && notif && channels |
| 3 | remoteListenChannel | 채널 열기 | channelEnabled !== false |
| 4 | fullScreen | 허용하기 | fullScreenIntentAllowed |
| 5 | battery | 예외 허용 | batteryOptimizationsIgnored |
| 6 | backgroundLocation | 위치 권한 | bgLocationGranted |
| 7 | locationService | 다시 시작 | locationServiceRunning |

"한 번에 모두 허용하기" → runAllChildSafetySteps (1.5s 직렬). 모든 ready 시 헤드라인 "준비 완료! 시작해볼까?" + 마스코트 cheer. dismiss 가능, 권한 회수 시 자동 재등장.

### 9.6 자녀 캘린더 hero (ChildHero)
- 제목: 0개 "오늘은 자유시간! / 마음껏 놀아도 돼" / 1개 "오늘 1개 일정 있어 / 준비됐어?" / 2+ "오늘 뭐 해? / {N}개 일정 있어"
- 시간: 오전/오후 N시 MM분
- 마스코트(showMascot=childShowMascot): 기본 🐰
- 우상단 ⚙ → ChildSettingsScreen

### 9.7 다음 일정 + 빠른 실행 (2x2)
- 다음 일정 카드 → setRouteEvent → RouteOverlay isChildMode
- 💌 메모 (미읽음 빨간 dot) / 🎁 스티커 보내기

### 9.8 부모에게 전화 (ChildCallCard)
mom/dad 8자리+ 전화번호만. `<a href="tel:01012345678">`. 엄마(👩)/아빠(👨) accent 색. 한 명만/둘 다 분기.

### 9.9 친구놀이 (FriendPlaydateChildPanel)
- idle: PlaydateStartButton (find_friend_candidates 매칭 시 활성)
- discover: FriendCandidateList → start_playdate
- active: ActivePlaydateChildView "{친구이름}와 놀고 있어요" + "그만 놀래요" → end_playdate(child_end)

### 9.10 캘린더 + DayTimetable (자녀)
- visibleEvents: 자녀 본인 child_ids 또는 is_family_event
- DayTimetable isParentMode=false: 편집/삭제 비활성, 메모 답장만
- "✏️ 추가" 자녀도 본인 일정 추가 가능
- 추가 모달 장소: "지도에서 장소 선택" 미노출, "부모님이 등록한 장소를 선택하면 일정에 바로 연결돼요" + 부모 saved place 칩만

### 9.11 일정 알림
- 친근한 톤 — friendlyChildMsg + 마스코트 bounce
- 도착 알림 — showArrivalNotification

### 9.12 자녀 설정 (ChildSettingsScreen)
- 테마: THEME_PALETTE 모든 색상 원형 칩 44px (locked 시 "부모님이 잠궜어")
- 동물 캐릭터 8개 (🐰🐱🐶🦊🐥🐻🐼🐯) → family_members.emoji UPDATE + 토스트 "{emoji} 캐릭터로 바꿨어!"
- 앱 설정: 🔔 소리·진동(자녀 끔 불가) / 🐰 마스코트 보여주기 토글
- 계정: 이름/부모(read-only) + "부모님께 변경 요청"
- 로그아웃: confirm "정말 로그아웃할까?"

### 9.13 자녀 메모
ParentMemoPage 재사용 mode="child". partnerName "부모님". empty "부모님과 나눈 메모가 아직 없어요". 자녀 quick replies: 👋 "다녀왔어요" / 💗 "사랑해요" / 📞 "조금 있다 전화해요". placeholder "답글을 남겨봐~ 🐰". user_role="child" 기록.

### 9.14 스티커 보내기 (SendStickerSheet)
16개 grid 4×4: ❤️🐰🎉👍 / 💪⭐🌟🎁 / 🍎🍪🌈🦄 / 🌸🐱🐶🎈. 한 개 선택 → addSticker(... 'child_to_parent' ...) → 부모에 instant push.

### 9.15 RouteOverlay (자녀)
isChildMode=true: watchPosition (high accuracy) + 50m 이동 시 재요청 + DeviceOrientation 나침반(iOS 13+). 마커 "🐰 내 위치". 자녀 톤 "🐰 길찾기" / "도착이야! 잘했어! 🐰".

### 9.16 자녀 모드 차단되는 부모 기능
모두 `isParent && ...` 가드: AiScheduleModal / DangerZoneManager / AcademyManager(read만) / ParentSettingsScreen / PairingModal / AlertPanel / voicePreview / ChildTrackerOverlay / AmbientAudioRecorder UI / TrialInvitePrompt / FeatureLockOverlay. 구독 시작 child role 즉시 차단.

### 9.17 자녀 백 핸들러 stack
부모와 거의 동일 + showChildSettings, showAddModal(자녀 자기 일정), showChildMemoPage 추가.

---

## 🟦 SECTION 10 · 위치 공유

### 10.1 GPS watch (자녀 본인)
- 네이티브: `startNativeLocationService(authUser.id, familyId, accessToken, "child")` — Android forced foreground service
- 웹 supplement: getCurrentPosition + watchPosition (enableHighAccuracy: true, maximumAge: 1000, timeout: 15000)
- 변동 시 setChildPos + realtime broadcast `child_location`
- 저장: DB 10초마다 / history 50m+ 또는 5분 경과
- 에러 토스트: PERMISSION_DENIED "📍 위치 권한이 꺼져 있어요" / POSITION_UNAVAILABLE "📍 위치를 찾을 수 없어요" / 기타 "📍 위치 추적 오류"

### 10.2 위치 갱신 응답
부모 `location_refresh_request` → 자녀: targetUserId 본인이거나 미지정 시만 처리. requestNativeCurrentLocation + getCurrentPosition + setChildPos + broadcast + saveChildLocation + saveLocationHistory.

### 10.3 device_status_request 응답
`child_device_status_request` → 자녀: family_members 행에 battery/network/screen/권한 스냅샷 UPDATE.

---

## 🟦 SECTION 11 · SOS / 꾹 / 응급

### 11.1 꾹
- 클라이언트 5초 cooldown
- 서버 RPC `kkuk_check_cooldown` — 5초 내 sos_events row 있으면 false. 에러 시 fail-open
- dedup_key UUID + 60s LRU dedup
- 전송: realtime broadcast → not-joined 시 1.8s polling → FCM 폴백
- payload: `{senderId, senderRole, senderLabel, senderEmoji, timestamp, dedup_key}`

### 11.2 수신 풀스크린 오버레이
zIndex 9999, cartoon 핑크 그라디언트 + cheer pulse. 마스코트 112×112 (kkukPulse 1.2s) + ♥ 큰 하트 (kkukFloat 2s) + kkukFadeIn 0.3s. "꾹!" 28pt + "{from}가 꾹을 보냈어요" + "화면을 터치하면 닫혀요".

### 11.3 자녀 꾹 → 부모 자동 후속
부모 측: 2분 후 자동 위치 갱신, 5분 후 자동 위치 갱신, 5분간 위치 없으면 critical alert + 푸시. (자녀는 후속 없음.)

### 11.4 응급 강제 알림 (Force Ring)
ForceRingPanel → 메시지 입력 → confirmModal → `force-ring-trigger` Edge Fn. 자녀 폰: 무음·방해금지여도 풀볼륨 알람 15초 + full-screen-intent. 한도(plan별) + force_ring_logs.

### 11.5 EmergencyBanner
부모 firedEmergencies 자동 등록. "출발 안 함" / "도착 미확인" alert. dismiss "contact" → showNotif "📞 전화 앱을 열어주세요".

---

## 🟦 SECTION 12 · 메시지 / 메모 / 스티커

### 12.1 메모
- 일자별 채팅 (memos.date_key)
- 부모 quick replies: 시간대별 4-6개
- 자녀 quick replies: 👋 / 💗 / 📞
- MemoBubble: parent 좌측 회색 / child 우측 핑크
- partner에게 sendInstantPush "💬 새 메모"
- 자녀 측 AI 자동 답장 (aiEnabled)

### 12.2 칭찬 스티커
부모: StickerBookModal "칭찬스티커 주기" → emoji+title → addSticker(child, ..., 'praise') + sendInstantPush "{emoji} 칭찬스티커! / 부모님이 칭찬스티커를 보냈어요!"

### 12.3 자녀 발신
SendStickerSheet 16개 → addSticker(... 'child_to_parent' ...) → 부모에 instant push.

---

## 🟦 SECTION 13 · 권한 / 푸시 / 네이티브

### 13.1 권한 배너 (자녀)
- 백그라운드 위치 미허용: "위치 권한을 \"항상 허용\"으로 바꿔주세요" + "설정 열기"
- 푸시 미완: nativeSetupAction별 동적 라벨

### 13.2 권한 배너 (부모)
- 네이티브: nativeSetupAction → "설정 열기"
- 웹: !granted → "푸시 알림을 켜주세요" / denied → "알림이 꺼져있어요" + ×

### 13.3 Capacitor 플러그인
- @capacitor/app — back button, minimizeApp
- @capacitor/browser
- BackgroundLocation (커스텀) — Android forced foreground, openAppLocationSettings, requestNativeCurrentLocation, startNativeLocationService
- CameraPermission (커스텀)
- @qonversion/capacitor-plugin

### 13.4 FCM (send-instant-push Edge Fn)
입력:
```ts
{
  family_id: uuid,
  to_user_ids?: uuid[],
  title: string,
  body: string,
  action?: string,
  data?: Record<string,string>,
  idempotency_key?: string
}
```
내부: family_members.fcm_token 조회 + batch 100개씩 + exact_alarm 시 high priority.

### 13.5 권한 상태 publish (자녀)
60초 + visibilitychange 시 family_members 행 업데이트: recordAudio / postNotif / fullScreen / battery / exactAlarm / bgLocationGranted / channelsEnabled / locationServiceRunning / remoteListenChannelEnabled.

---

## 🟦 SECTION 14 · Capability / 게이팅

### 14.1 parentCapabilities
- canManageFamily — 보조 차단
- canManagePlaces / canEditParentPhones / canRequestChildLocation / canWriteSchedule
- canUseForceRing — 프리미엄
- canUseRemoteListen — 프리미엄
- canManageSubscription

차단 시: notif "보조 보호자는 ..." 또는 FeatureLockOverlay.

### 14.2 entitlement (Qonversion)
- realtime_location — 무료 5분에 1번, 프리미엄 실시간
- multi_child — 무료 1자녀, 프리미엄 무제한
- multi_geofence — 무료 위험구역 1개
- force_ring — 프리미엄 quota
- remote_listen — 프리미엄
- playdate_safe_place_unlimited — 무료 1개

### 14.3 FeatureLockOverlay
잠긴 기능 호출 시 feature title + body + "시작" / "닫기". 자녀에는 미노출.

### 14.4 TrialInvitePrompt / TrialEndingBanner
1회만 (localStorage `TRIAL_INVITE_SHOWN_KEY`). 만료 임박 자동 노출. 자녀는 isChild로 톤만. AutoRenewalDisclosure 결제 직전 confirmStartTrial.

---

## 🟦 SECTION 15 · Realtime / 동기화

### 15.1 channel
```js
const channel = supabase.channel(`family:${familyId}`, {
  config: { broadcast: { self: false }, presence: { key: userId } }
});
channel
  .on("broadcast", {event:"kkuk"}, ...)
  .on("broadcast", {event:"child_location"}, ...)
  .on("broadcast", {event:"location_refresh_request"}, ...)
  .on("broadcast", {event:"child_device_status_request"}, ...)
  .on("broadcast", {event:"remote_listen_start"}, ...)
  .on("broadcast", {event:"remote_listen_stop"}, ...)
  .on("postgres_changes", {table:"events"}, ...)
  .on("postgres_changes", {table:"family_members"}, ...)
  .on("postgres_changes", {table:"memos"}, ...)
  .subscribe();
```

### 15.2 sync degraded banner
circuit_open / transient_error → 상단 배너 "연결이 불안정해요. 자동 재시도 중..."

### 15.3 자녀 격리
부모 다자녀 + 자녀 선택 시 dashboardChildren = [selectedChild]만. 비-home/calendar 진입 시 자녀 미선택이면 home 강제 + multiChildHint. ChildSelector + filterEventMapForChild + buildSelectedChildCommandPayload.

---

## 🟦 SECTION 16 · 모바일 / 네이티브 / Capacitor

### 16.1 capacitor.config.json
```json
{
  "appId": "com.hyeni.calendar",
  "appName": "혜니캘린더",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "allowNavigation": ["*.supabase.co", "*.kakao.com"]
  }
}
```

### 16.2 Android 권한 (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT"/>
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"/>
<uses-permission android:name="android.permission.PACKAGE_USAGE_STATS"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>
<uses-permission android:name="android.permission.VIBRATE"/>
```

### 16.3 빌드 / 설치 (auto-ship)
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
adb -s <DEVICE_ID> install -r app/build/outputs/apk/debug/app-debug.apk
```

### 16.4 Safe Area / iOS-ready
- `padding-top: env(safe-area-inset-top)`
- `padding-bottom: env(safe-area-inset-bottom)`
- viewport meta `viewport-fit=cover`

### 16.5 useBackHandler 훅
Capacitor `App.addListener("backButton", ...)` 등록 + 사용자 정의 stack 우선순위. 마지막은 `App.minimizeApp()` (앱 종료 X).

---

## 🟦 SECTION 17 · 코드 품질 규칙

### 17.1 파일 / 함수 크기
- 파일 800줄 max
- 함수 50줄 max (inline style 객체는 module-level 상수로 lift)
- 중첩 4레벨 max

### 17.2 immutability
mutation 금지. 항상 spread.

### 17.3 input validation
사용자 입력 + 외부 API 응답은 zod로 검증. 내부는 trust.

### 17.4 error handling
silent failure 금지. 실패 시 사용자에게 명시적 안내.

### 17.5 console.log 금지
console.error만 catch 안에서.

### 17.6 emoji
도메인 콘텐츠(카테고리/캐릭터)는 OK. 코드/주석에는 사용 금지.

### 17.7 i18n 준비
컴포넌트 외부 const COPY 객체에 모음.

### 17.8 a11y
모든 button aria-label 또는 텍스트. decorative SVG는 `aria-hidden="true"`.

### 17.9 보안
RLS 모든 테이블 ON. API key는 env. 자녀 데이터는 가족 외부 노출 X. Storage upload 가족 path 강제.

---

## 🟦 SECTION 18 · 빌드 우선순위 (Phase 1~6)

### Phase 1 — Foundation (1-2일)
1. Vite + React init + Capacitor add android
2. `tokens.css` 전체
3. HyeniMascot.jsx (static + wave)
4. Supabase client + .env
5. SplashScreen → RoleSetupModal → ParentAuthScreen(카카오만) → ChildPairInput stub
6. 빌드/install 검증

**검증**: 부모 카드 → 카카오 로그인 → 빈 화면 / 자녀 카드 → ChildPairInput.

### Phase 2 — 가족 셋업 (2-3일)
1. Supabase: families / family_members / setup_family / join_family
2. ParentSetupScreen + PairingWizard 6 step
3. ChildPairInput → joinFamily → ChildEntryTransition → 자녀 더미 홈
4. PairingModal

**검증**: emul1 부모로 코드 발급 → emul2 자녀로 입력 → 두 폰 동기화.

### Phase 3 — 일정 (3-4일)
1. events 테이블 + RLS
2. EventSheet (시간 picker, 카테고리, 자녀 선택, 반복)
3. 캘린더 그리드 + 일자 선택 + 일정 dot
4. TodayEventsList + DayTimetable
5. realtime subscribe events
6. 부모 작성 → 자녀 폰 즉시 (read-only)

**검증**: 부모 일정 추가 → 자녀 캘린더 즉시 표시.

### Phase 4 — 위치 + 디바이스 + SOS (4-5일)
1. BackgroundLocation Capacitor 플러그인
2. child_locations + realtime broadcast
3. ChildTrackerOverlay (Kakao Map + 마커 + trail)
4. 꾹 시스템 (헤더 💗 + RPC + 풀스크린 오버레이)
5. ChildPermissionWizard 7단계
6. ForceRingPanel + force-ring-trigger Edge Fn
7. 권한 배너

**검증**: 자녀 권한 모두 허용 → 부모 트래커 위치 + 자녀 꾹 → 부모 풀스크린 오버레이.

### Phase 5 — 친구놀이 / 메모 / 스티커 / 구독 / 설정 (4-5일)
1. 메모 (memos + ParentMemoPage / ChildMemoPage)
2. 스티커 (stickers + StickerBookModal + SendStickerSheet)
3. 장소 관리 (PlaceManagerScreen + AcademyManager + SavedPlaceManager + DangerZoneManager)
4. 친구놀이 (toggle + 부모 패널 + 자녀 패널 + SafePlaceList + ActivePlaydateBanner)
5. 구독 (Qonversion + SubscriptionManagement + capability gating)
6. AlertPanel
7. AiScheduleModal + ai-voice-parse Edge Fn
8. ParentSettingsScreen + ChildSettingsScreen
9. AmbientAudioRecorder

**검증**: 모든 화면 도달, capability 분기, 다크 모드.

### Phase 6 — Polish + Release
- 다크 모드 검증 / 6 테마 / 트레일링 polish / SOS 빨강 다이얼로그(하트 쉴드 SVG) / Play Store listing(개인정보 처리방침, 백그라운드 위치 disclosure) / e2e 테스트.

---

## 🟦 SECTION 19 · 검증 체크리스트

### 19.1 Phase별 종료 기준
- [ ] `npm run build` exit 0
- [ ] `npx eslint src/` 변경 파일 0 errors
- [ ] APK install 성공
- [ ] 모든 화면 도달
- [ ] 부모/자녀 두 모드 회귀 없음
- [ ] 오프라인 → 온라인 시 realtime 자동 재연결
- [ ] 백 버튼 stack 정상 (마지막 minimizeApp)

### 19.2 출시 전
- [ ] 모든 텍스트 한국어 + 부모 존댓말/자녀 반말 일관
- [ ] 다크 모드 모든 화면
- [ ] 6 테마 변경 시 마스코트 + accent 즉시 반영
- [ ] iOS Safe Area 처리
- [ ] Android 키보드 가려짐 없음
- [ ] Play Store 백그라운드 위치 disclosure
- [ ] 개인정보 처리방침 / 약관 동작
- [ ] 로그아웃 → 모든 캐시 클리어
- [ ] 자녀 폰 부모 화면 우회 진입 불가능 (HARD GATE)
- [ ] RLS — 다른 가족 read 불가능
- [ ] Edge Function idempotency_key 처리
- [ ] FCM 토큰 만료 시 재등록

### 19.3 Edge case
- [ ] 1자녀 → 2자녀 시 layout density 자동 변경
- [ ] 자녀 페어링 해제 → ChildPairInput 자동 재진입 (GATE-02)
- [ ] 보조 보호자 차단 액션 → notif
- [ ] 무료 한도 초과 → FeatureLockOverlay
- [ ] 시간 picker 1분 단위 + 30분 슬롯 + 빠른 종료 chips 동기화
- [ ] 반복 일정 N개 row + repeat_group_id
- [ ] 학원 schedule 변경 → 미래 events reconcile
- [ ] 꾹 5초 cooldown / dedup_key 60s LRU
- [ ] 자녀 mic 거부 → 부모 모달

---

## 🟦 SECTION 20 · 너에게 (LLM)

이 문서를 입력받은 너는:
1. **즉시 코드 생성을 시작하지 말고**, 먼저 SECTION 1-5 정독 후 "이해한 내용 요약"을 1페이지로 사용자에게 보고.
2. 사용자 승인 후 SECTION 18 Phase 1부터 순서대로 진행.
3. 각 Phase 시작 시 "이번 Phase에서 만들 파일/기능 목록" 제시 → 승인.
4. 파일 생성 시 한 번에 완전한 형태로 (TODO 금지).
5. Phase 끝나면 "검증 명령" 함께 제시.
6. 사용자 피드백 시:
   - 즉시 인정
   - 메모리(SECTION 3) 톤(부모 Minimal-Pro / 자녀 Cartoon-Warm)과 비교해 진단
   - 정정안 제시
7. 모르는 것은 추측 말고 사용자 질문.
8. 실 device 시각 검증 없이 "완료" 말하지 말 것.

---

## 🟦 SECTION 21 · 참고 출처

이 사양은 다음 실제 동작 앱에서 추출:
- `com.hyeni.calendar` (혜니캘린더, 2026-05) — Capacitor + React + Supabase
- 코드 검증 범위: `src/App.jsx`(7777라인), `src/components/{auth, multichild, childMode, onboarding, friendPlaydate, route, banners, sticker, contact}/**/*.jsx`, `src/lib/*.js`
- 디자인 톤 ref: Notion Calendar / Cron / Fantastical (부모) / Khan Academy Kids / Duolingo / Headspace (자녀)
- UX cross-pollination ref (PairingWizard): Spotify Jam / Jackbox 로비 / Gemini Storybook

---

**END OF MASTER PROMPT**

이 문서를 다른 AI에 입력하고, "위 문서를 정독하고 SECTION 20 지시에 따라 작업해 주세요."라고 시작하면 됩니다.
