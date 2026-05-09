# 3D Asset Index — `src/assets/3d/`

> 23 WebP 자산 (총 334 KB). PLAN Step 1 산출물 (`.planning/phases/07-3d-asset-redesign/PLAN.md`).
>
> 재생성: `python src/stitch/optimize_assets.py`
> 매핑 변경 시 `src/stitch/optimize_assets.py` 의 `ASSETS` 리스트만 수정 후 재실행.

---

## Mascot — `mascot/`

| 파일 | 의미 | 원본 | 사용처 (예정) |
|------|------|------|--------------|
| `mascot/static.webp` | 정면 미소 + 아이스크림 + 분홍 노트 | `12_59_52 (1)/element-01` | Splash, RoleSetup 자녀 카드, ChildHero, NextEventHero 빈 상태 |
| `mascot/wave.webp` | 손 흔들기 + 분홍 노트 | `12_59_52 (10)/element-01` | ChildEntryTransition, ChildPairInput hero, PairingWizard host |
| `mascot/phone.webp` | 카디건 + 폰 보기 (성숙 톤) | `12_59_52 (9)/element-01` | RoleSetup 부모 카드, HomeGreeting trailing |

> **cheer 변종 미보유**: PairingWizard Step 5 의 cheer 포즈 자산은 분홍 hoodie 로는 아직 없음. PLAN D1=(a) 결정에 따라 임시로 wave 사용. ChatGPT 재생성 시 추가 발급 → `mascot/cheer.webp` 로 추가.

---

## UI Icons — `ui/`

| 파일 | 의미 | 원본 | 사용처 (예정) |
|------|------|------|--------------|
| `ui/bell.webp` | 분홍 종 (notification) | `12_59_52 (8)/element-01` | 부모 헤더 알림 종 (App.jsx) |
| `ui/heart.webp` | 분홍 하트 | `12_59_52 (6)/element-01` | "꾹" 버튼, 칭찬 stickers |
| `ui/pin.webp` | 라벤더 위치 핀 | `12_59_52 (4)/element-01` | 위치 마커, 📍 라벨 |
| `ui/shield.webp` | 라벤더 방패 + 하트 | `12_59_52 (7)/element-01` | 권한 배너, 안전 상태 |
| `ui/calendar-heart.webp` | 분홍 캘린더 + 하트 | `12_59_52 (3)/element-01` | 앱 로고, 캘린더 헤더 |
| `ui/calendar-check.webp` | 캘린더 + 체크 | `12_59_52 (2)/element-01` | 일정 완료 상태 |

> 12_59_52 (2/3/5) 시트는 단일 요소이지만 추출 알고리즘이 sub-part 를 분할. `element-01` 이 본체(가장 큰 component) 이므로 안전.

---

## Categories — `category/`

| 파일 | 의미 | 원본 | scheduleCategories.id |
|------|------|------|----------------------|
| `category/school.webp` | 학교 건물 (시계 + 트리) | `01_54_51 (5)/element-05` | `school` 학원 |
| `category/sports.webp` | 분홍 덤벨 | `01_54_51 (5)/element-03` | `sports` 운동 |
| `category/hobby.webp` | 팔레트 + 붓 | `01_54_51 (5)/element-04` | `hobby` 취미 |
| `category/family.webp` | 부모+딸 hug | `01_54_51 (5)/element-02` | `family` 가족 |
| _(friend.webp 미제공)_ | emoji `👫` 폴백 — 230 element 중 친구 페어 자산 부재. 추후 ChatGPT 재발급 후 추가 예정 | — | `friend` 친구 |
| `category/other.webp` | 노란 별 | `01_54_53 (10)/element-09` | `other` 기타 |

> ⚠️ **Spot-check 필요 (friend)**: `01_54_50 (1)` 시트는 가족 캐릭터 sticker pack 인데 element 순서가 예측 어려움. element-07 이 정확히 "친구 두 명" 인지 사용자 확인 필요. 잘못된 경우 다른 element 번호로 변경 후 `optimize_assets.py` 재실행.

---

## Animal Characters — `animal/`

자녀 캐릭터 (`family_members.emoji` 필드 ↔ 3D 자산 매핑).

| 파일 | DB emoji | 원본 (`01_54_53 (10)/...`) |
|------|---------|---------------------------|
| `animal/rabbit.webp` | 🐰 | `element-01` |
| `animal/cat.webp` | 🐱 | `element-02` |
| `animal/fox.webp` | 🦊 | `element-03` |
| `animal/dog.webp` | 🐶 | `element-04` |
| `animal/chick.webp` | 🐥 | `element-05` |
| `animal/bear.webp` | 🐻 | `element-06` |
| `animal/panda.webp` | 🐼 | `element-07` |
| `animal/tiger.webp` | 🐯 | `element-08` |

> 8종 모두 spot-check 완료.

---

## Step 2 ~ 6 진행 시 사용 패턴

```jsx
// Step 2 — Mascot
import mascotStatic from "@/assets/3d/mascot/static.webp";
import mascotWave from "@/assets/3d/mascot/wave.webp";

<HyeniMascot variant="static" size={88} />
// 내부적으로 <img src={mascotStatic} ... /> 렌더

// Step 3 — Category
import schoolIcon from "@/assets/3d/category/school.webp";
<CategoryIcon categoryId="school" size={32} />

// Step 4 — Animal
import rabbit from "@/assets/3d/animal/rabbit.webp";
<AnimalIcon emoji="🐰" size={48} />
// 또는 <AnimalIcon name="rabbit" />

// Step 5 — UI
<ThreeDIcon name="bell" size={24} />
<ThreeDIcon name="pin" size={20} />
```

빌드 시 Vite 가 hash + tree-shake 처리.

---

## 변경 이력

| 일자 | 변경 |
|------|------|
| 2026-05-09 | v1 — 23 자산 초기 큐레이션 (Step 1.2) |
