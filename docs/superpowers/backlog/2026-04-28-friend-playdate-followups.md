# Friend Playdate — Follow-up Backlog (post PR #5)

> 생성: 2026-04-28 (PR #5 native verification 중 사용자 피드백)
> 다음 brainstorm/spec/plan 사이클로 진행.

## FB-1. 안전장소 UI 구분 명확성 (UX, S)

**관찰**: `PlaydateSafePlaceList`가 일반 `saved_places`와 시각적으로 거의 동일해서, "친구놀이 전용" 의미가 한눈에 안 들어옴.

**아이디어**:
- 친구놀이 전용 라벨/배지 추가 ("친구놀이" 칩)
- 별도 섹션 분리 ("일반 안전장소" / "친구놀이 안전장소")
- 친구놀이 ON된 항목에 색상 강조 (현 #10b981보다 더 명확한 대비)
- "이 장소는 다른 가족과 공유됩니다" 같은 안내 문구

**범위**: PlaydateSafePlaceList.jsx + 부모 패널 레이아웃. 신규 dep 0.

---

## FB-2. 카카오 미등록 장소 친구놀이 지원 (Spec change, M-L)

**관찰**: 친구 집·동네 놀이터 등 카카오 검색에 안 나오는 곳도 친구놀이가 가능해야 한다는 강한 요구. 현 디자인은 RLS `WITH CHECK kakao_place_id IS NOT NULL` + 매칭 anchor가 `public_places.kakao_place_id`라서 카카오 등록 장소 only.

**원인 (spec FP-D04)**:
- 두 가족이 "같은 장소"라고 판정하는 anchor를 `kakao_place_id`로 단일화 — 카카오가 정규화된 장소 ID를 보장하니까 매칭이 단순.
- 사적 장소(친구 집)는 카카오 ID가 없으므로 같은 anchor 생성 불가 → matching 불가능.

**대안 매칭 모델 후보**:
- (a) **양방향 초대 코드**: 한 가족이 사적 장소를 등록하면 6자리 코드 발급, 친구 가족이 그 코드로 join → public_place 자동 link.
- (b) **GPS 좌표 + 이름 fuzzy match**: 두 가족이 비슷한 좌표(반경 50m) + 비슷한 이름으로 등록하면 자동 anchor 생성. 오탐 위험.
- (c) **친구 가족 명시적 share**: 가족 페어링처럼 "친구 가족 등록" 흐름 추가 + 그 가족과 공유할 장소만 share. PIPA 영향 큼.

**복잡도**: 매칭 모델 변경 = DB 스키마 + RLS + UI + 매칭 RPC 모두 영향. brainstorm 필수.

**선호 (개인 의견)**: (a) 양방향 초대 코드 — 명시적 동의 + UX 단순 + 오탐 0.

---

## 트리거
- PR #5 머지 + APK 1.2 release 후
- 새 brainstorm 시작 명령: `/brainstorm friend-playdate-private-places`
