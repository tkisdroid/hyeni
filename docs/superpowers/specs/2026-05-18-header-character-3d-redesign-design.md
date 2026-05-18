# 헤더 캐릭터 3D 이미지 리디자인 — 디자인

- 작성일: 2026-05-18
- 상태: 승인됨 (브레인스토밍 종료)
- 범위: 혜니캘린더 최상단 헤더의 "혜니" 캐릭터

## 배경

최상단 헤더의 캐릭터는 `HyeniMascot` 컴포넌트가 렌더하는 사전 렌더된 3D WebP 에셋이다.
- 부모 헤더: `AppBrandLogo` → `HyeniMascot`, `appLogoMood`를 3개 variant(`static`/`diary`/`sad`)로 매핑 (`App.jsx` 6346줄).
- 자녀 헤더: `HyeniMascot variant="static"` 고정 (`App.jsx` 6350줄).

`AppBrandLogo`는 헤더 외 인증 화면 등 6개 파일에서도 사용되고, `HyeniMascot`은 9개 파일에서 공유된다.

## 목표

`src/stitch/extracted/renamed_images/`의 신규 3D "혜니" 이미지로 헤더 캐릭터를 교체한다.
- 캐릭터가 작은 크기(36~44px)에서도 또렷하게 보일 것.
- 캐릭터가 헤더 행에서 수직 정렬이 확실할 것.

## 브레인스토밍 결정 사항

1. 리디자인 형태: 기존 3D 에셋 → `renamed_images`의 신규 3D 이미지 사용 (코드 SVG 아님).
2. 범위: 헤더 + 헤더가 쓰는 3가지 표정만. 다른 화면/컴포넌트는 미변경.
3. 표정별 소스 이미지(승인됨):
   - `static`(평소) ← `메인캐릭터_미소짓는혜니_정면.png`
   - `diary`(일정·바쁨) ← `메인캐릭터_다이어리든혜니.png`
   - `sad`(위험 알림) ← `알림아이콘_걱정하는혜니.png`

## 설계

### 1. 에셋 처리
- 3개 소스 PNG의 투명 여백을 트림(캐릭터 bounding box 기준)해 캐릭터가 프레임을 채우게 한다 — "잘 보이게"의 핵심.
- 트림본을 WebP로 변환(기존 3D 에셋과 포맷 일치, 용량 절감).
- 신규 폴더 `src/assets/3d/header/`에 `static.webp`·`diary.webp`·`sad.webp`로 저장.

### 2. 신규 컴포넌트 `HeaderCharacter`
- 위치: `src/components/header/HeaderCharacter.jsx`.
- props: `mood`(`"static"|"diary"|"sad"`, 기본 `"static"`), `size`(px), `aria-label`.
- 고정 정사각 슬롯을 렌더하고 그 안에서 `<img>`를 `object-fit: contain` + `object-position: center`로 표시 → 슬롯 내 항상 중앙 정렬.
- 알 수 없는 `mood`는 `static`으로 폴백.

### 3. 헤더 통합 (`App.jsx` 최상단 헤더만)
- 부모 헤더: `<AppBrandLogo>` → `<HeaderCharacter mood={...} />`. mood 매핑은 기존 6346줄 로직(`statusScheduled`/`statusBusy`→`diary`, `statusDanger`→`sad`, 그 외→`static`) 재사용.
- 자녀 헤더: `<HyeniMascot variant="static">` → `<HeaderCharacter mood="static" />`.
- `hyeni-top-header-brand` flex 행이 `align-items: center`인지 확인·보장 → 캐릭터와 "혜니캘린더" 텍스트 수직 중앙 정렬.

### 비목표 (변경하지 않음)
- `AppBrandLogo`, `HyeniMascot` 컴포넌트 자체 및 헤더 외 사용처.
- `HyeniMascot`의 기존 `static`/`diary`/`sad` WebP 에셋 (`src/assets/3d/mascot/`).

## 엣지 케이스

- 알 수 없는/누락 `mood` → `static` 폴백.
- 다크 모드: 이미지가 자체 색을 가지며 헤더 배경은 양 모드 모두 밝은 톤 — 별도 처리 불필요.
- 소스 이미지가 전신 일러스트라 트림 후에도 작게 보이면 슬롯 크기를 36px→상향 조정(브레인스토밍에서 트림 우선, 필요 시 크기 조정 합의됨).

## 검증

- `npm run lint`, `npm run build` 통과.
- 갤럭시·모토로라 실기기 설치 후 부모(3표정)·자녀 헤더에서 캐릭터 가시성 + 수직 정렬 육안 확인.

## 영향 파일

- 신규: `src/assets/3d/header/{static,diary,sad}.webp`, `src/components/header/HeaderCharacter.jsx`
- 수정: `src/App.jsx` (헤더 2곳)
