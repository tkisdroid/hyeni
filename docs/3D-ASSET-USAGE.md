# 3D Asset Usage Guide

> Phase 07 (`.planning/phases/07-3d-asset-redesign/PLAN.md`) 산출 가이드.
> 22개 3D WebP 자산을 어디에·어떻게 사용하는지 한 페이지 요약.

---

## 컴포넌트 4종 (단일 진입점)

| 컴포넌트 | 위치 | 자산 | Props | 용도 |
|---------|------|------|-------|------|
| `<HyeniMascot>` | `src/components/auth/HyeniMascot.jsx` | `mascot/{static,wave,phone,cheer*}.webp` | `size`, `variant`, `className`, `aria-label` | 마스코트 (모든 hero/empty/transition) |
| `<CategoryIcon>` | `src/components/icons/CategoryIcon.jsx` | `category/{school,sports,hobby,family,other}.webp` + emoji 폴백 | `categoryId`, `size`, `aria-label` | 일정 카테고리 (학원·운동·취미·가족·친구·기타) |
| `<AnimalIcon>` | `src/components/icons/AnimalIcon.jsx` | `animal/{rabbit,cat,fox,dog,chick,bear,panda,tiger}.webp` | `name` 또는 `emoji`, `size` | 자녀 캐릭터 (settings picker, 아바타 fallback) |
| `<ThreeDIcon>` | `src/components/icons/ThreeDIcon.jsx` | `ui/{bell,heart,pin,shield,calendar-heart,calendar-check}.webp` | `name`, `size` | UI chrome 아이콘 (헤더 종/꾹, 위치 핀, 안전 방패 등) |

`*` cheer 변종은 별도 자산 부재 → 임시 wave 로 alias. 추후 ChatGPT 재발급 시 `mascot/cheer.webp` 추가하고 `HyeniMascot.jsx` 의 `SOURCES.cheer` 만 교체.

---

## 사용 예

```jsx
import { HyeniMascot } from "./components/auth/HyeniMascot.jsx";
import { CategoryIcon } from "./components/icons/CategoryIcon.jsx";
import { AnimalIcon } from "./components/icons/AnimalIcon.jsx";
import { ThreeDIcon } from "./components/icons/ThreeDIcon.jsx";

// 마스코트 — variant 별 자산 자동 선택
<HyeniMascot variant="static" size={88} />
<HyeniMascot variant="wave" size={144} />
<HyeniMascot variant="phone" size={36} className="header-trailing" />

// 카테고리 — id 기반 (CATEGORIES 의 iconKey)
<CategoryIcon categoryId="school" size={28} />
<CategoryIcon categoryId="friend" size={28} /> // → 자동 emoji 👫 폴백

// 동물 — DB emoji 또는 canonical name
<AnimalIcon emoji={member.emoji} size={48} />
<AnimalIcon name="rabbit" size={64} />

// UI 아이콘 — name 기반
<ThreeDIcon name="bell" size={22} />
<ThreeDIcon name="pin" size={20} />
```

---

## 이미 적용된 호출처 (Phase 07 Step 2~5)

| 파일 | 변경 |
|------|------|
| `src/components/auth/HyeniMascot.jsx` | 인라인 SVG → WebP 자산 (variant: static/wave/phone/cheer alias) |
| `src/lib/scheduleCategories.js` | `iconKey` 필드 추가 (school/sports/hobby/family/other), friend 는 null |
| `src/App.jsx` | 헤더 알림 종 🔔 → `<ThreeDIcon name="bell" />`, 꾹 버튼 💗 → `<ThreeDIcon name="heart" />` |
| `src/components/childMode/ChildSettingsScreen.jsx` | 8종 캐릭터 picker → `<AnimalIcon emoji={option.emoji} />` |

마스코트는 단일 컴포넌트 교체로 6 호출부 (RoleSetupModal, ChildEntryTransition, PairingWizard, NextEventHero, HomeGreeting, App.jsx) 가 자동 상속.

---

## 잔여 incremental 작업 (선택적, 점진 적용)

PLAN Step 5/6 의 "전수 교체" 는 이번 무중단 진행에서 핵심 호출처만 적용. 다음 위치는 화면 보고 필요할 때 같은 패턴으로 patch:

### Category 호출처 (이모지 → CategoryIcon)

| 파일 | 현재 | 권장 patch |
|------|------|-----------|
| `src/components/multichild/EventModal/EventSheet.jsx` | `cat.emoji` 직접 렌더 | `<CategoryIcon categoryId={cat.id} size={24} />` |
| `src/components/place-management/AcademyManager.jsx` | 카테고리 chip emoji | 동일 |
| `src/components/place-management/AcademyCard.jsx` | 카드 헤더 emoji | 동일 |
| `src/components/aiSchedule/AiScheduleModal.jsx` | parsed event 카테고리 dot | 동일 |
| `src/components/timetable/DayTimetable.jsx` | 일정 row 카테고리 dot | 동일 |
| `src/components/multichild/HomeDashboard/NextEventHero.jsx` | 일정 emoji 는 사용자 입력이라 그대로 — 카테고리 dot 만 교체 |
| `src/components/multichild/ChildDetail/ChildDetailScreen.jsx` | 일정 timeline | 동일 |

### UI 아이콘 호출처 (이모지 → ThreeDIcon)

| 위치 | 현재 | 권장 patch |
|------|------|-----------|
| `App.jsx` line ~5624, ~5809, ~5828 (push banner 종) | `🔔` | `<ThreeDIcon name="bell" />` |
| `src/components/childTracker/ChildTrackerOverlay.jsx` | 위치 마커 라벨 `📍` | `<ThreeDIcon name="pin" />` |
| `src/components/route/RouteOverlay.jsx` | `📍` | 동일 |
| `src/components/banners/AlertBanner.jsx` | `🛡️` | `<ThreeDIcon name="shield" />` |
| `src/components/multichild/HomeDashboard/NextEventHero.jsx` | 캘린더 헤더 | `<ThreeDIcon name="calendar-heart" />` |

### 의도적으로 유지하는 emoji (교체하지 말 것)

PLAN D2=(a) 결정: 본문 콘텐츠 emoji 는 유지.

- **메모 채팅 (자녀↔부모)**: 사용자 입력 emoji 그대로
- **스티커 grid 16종 (`SendStickerSheet.jsx`)**: 의도적 고밀도 emoji UX
- **카테고리·preset 의 fallback** — `friend` 는 폴백 emoji 그대로 (자산 부재)
- **사용자가 일정 입력 시 직접 고른 event emoji** (`event.emoji`)

---

## 자산 추가/교체 워크플로우

1. ChatGPT/Stitch 등에서 새 PNG 발급
2. `src/stitch/extracted/<sheet stem>/element-NN.png` 위치에 둠 (또는 새 시트 폴더)
3. `src/stitch/optimize_assets.py` 의 `ASSETS` 리스트에 매핑 한 줄 추가
4. `python src/stitch/optimize_assets.py` 실행 → WebP 생성
5. `src/assets/3d/INDEX.md` 매핑표 갱신
6. 사용처 컴포넌트(`HyeniMascot`/`CategoryIcon`/`AnimalIcon`/`ThreeDIcon`) 의 `SOURCES` 에 import 추가
7. `npm run build` 검증

---

## 다크 모드 처리

3D 자산은 light bg 가정으로 렌더됨. 현재 다크모드는 자산 자체는 그대로 렌더하되 hyeni-pink 가 darker accent 로 자동 시프트되므로 이질감 없음. 추후 다크 전용 variant 가 필요하면 `src/assets/3d/<category>/<name>--dark.webp` 를 추가하고 컴포넌트에서 `prefers-color-scheme` 분기.

---

## Bundle size 현황 (build 결과)

총 22 자산 dist/ assets/ 분리·해시:
- Mascot: static 41.6 + wave 44.5 + phone 79.9 = **166 KB**
- UI: bell 10.8 + heart 13.5 + pin 12.5 + shield 14.2 + cal-heart 20.7 + cal-check 12.9 = **84.6 KB**
- Animal 8종: 4.7~8.5 KB 합 **54.4 KB**
- Category 5종: 5.2 + 3.8 + 4.8 + 9.8 + 2.6 = **26.2 KB**

전체 **약 331 KB**, gzip 적용시 더 작음. PLAN 가드 1.5MB 한참 아래.

---

## 변경 이력

| 일자 | 변경 |
|------|------|
| 2026-05-09 | v1 — Step 1~7 무중단 마이그레이션 (마스코트·카테고리·동물·UI 컴포넌트 신규/교체 + 핵심 호출처 patch + 빌드 green) |
