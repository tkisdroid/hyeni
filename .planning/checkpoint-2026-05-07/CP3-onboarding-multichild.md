# CP-3 — Phase 2 Onboarding E2E + Phase 3 Case 2 다자녀 격리 (2026-05-07)

## 환경

| 기기 | 역할 | 모델 | 상태 |
|------|------|------|------|
| R5CY521CFNZ | 부모 | SM_S937N (Galaxy S25 Edge) | ✅ device |
| R5CY40EE6QE | 자녀 | SM_A556S (Galaxy A55) | ✅ device (USB 단속 잦음) |
| ZY22H9VTQD | (이전 세션 자녀 데이터) | motorola razr 40 ultra | 미연결, 가족에 자녀 row만 잔존 |

## Phase 2 Onboarding E2E ✅

| 단계 | 결과 |
|------|------|
| 학부모 카드 → 카카오 OAuth | 사용자 직접 통과 |
| 새 가족 만들기 | 페어링 코드 KID-E50A1041 발급 |
| 자녀 페어링 (A55) | "아이" 카드 → ChildPairInput → KID 입력 → 가족 합류 |
| 자녀 메인 화면 진입 | "오늘은 자유시간!" + 토끼 카드 + 메모/스티커/전화/친구놀이 |
| 부모 메인 화면 진입 (다자녀) | "혜니와 아이, 오늘은 여유로워요" + 자녀 2명 카드 + 배터리/화면시간 |

스크린샷:
- `cp3-parent-launch.png`, `cp4-child-fresh2.png` — 첫 화면 RoleSetupModal
- `cp5c-child-pair.png` — ChildPairInput
- `cp7-child-paired.png` — 자녀 모드 메인
- `cp8-parent-after-back.png`, `cp9b-small.png` — 부모 다자녀 모드 메인

## Phase 3 Case 2 다자녀 격리 ✅

### DB-level 검증 (S25 부모 화면)
- 가족 1개에 자녀 2명 ("연동된 아이 2/2")
- 자녀1 = 혜니 + 핑크 컬러 + Razr 매핑 (배터리 99%)
- 자녀2 = 아이 + 올리브 컬러 + A55 매핑 (배터리 79%)
- 각 자녀 device_health 분리 표시, user_id 격리 확인
- 스크린샷: `cp10-small.png`

### 데이터 격리 확인
- TodayMultiChildView 자녀 카드 2개에 각각 다른 배터리/화면시간 표시
- 자녀1 (혜니, 0분) vs 자녀2 (아이, 5분) 화면 시간 다름 → user_id 별 분리
- 위치: 두 자녀 모두 "수지구 대지로15번길 60" (현재 같은 위치, A55가 부모와 같은 곳)

### 코드 fix (CP-2 commit 84361b9)
- `forceRing.js`: `targetChildUserId` 인자 추가
- `push-notify`: `body.target_user_id` 우선, 없으면 `children[0]` fallback. 동일 family_id child 검증 (`target_child_not_in_family` 404)
- `ForceRingPanel`: `childList` prop, 자녀 선택 칩 (1명 자동, 2명+ 강제), `selectedChildUserId` state
- `App.jsx`: ForceRingPanel 호출부에 `childList` 전달

## logcat 점검 ✅

S25 부모 측 — `com.hyeni.calendar` 패키지 관련 **에러/경고 0건**. 시스템 GNSS noise (`E/LocSvc_*`, `W/AlarmManager`) 만 발생 — 우리 앱 무관.

## 시각 무결성 (스크린샷 검증) ✅

- 카드 padding/곡률/타이포 모두 일관
- 핑크 톤 디자인 토큰 통일
- 자녀별 색상 구분 (핑크/올리브) 명확
- 친근한 한국어 문구 ("오늘은 자유시간!", "혜니와 아이, 오늘은 여유로워요")
- 배지/카드 정렬 OK
- ChildPairInput KID-prefix UI + QR 옵션 모두 정돈

## 회귀 ✅

- `npx vitest run`: 99 files / 655 tests pass
- React build + cap sync + APK 빌드 성공
- 두 Galaxy 기기 설치 OK

## End Condition 진행도

| 항목 | 상태 |
|------|------|
| #1 ADB Logcat 에러/경고 0 | ✅ (S25 부모 측) |
| #2 실기 데이터 레이턴시 + 회귀 | ✅ 부분 (S25 + A55, Razr 미연결) |
| #3 시각 결함 0% | ✅ 스크린샷 캡처 화면 모두 깨끗 |
| #4 글로벌 Top-tier 완결성 | ⚠️ Phase 4 (Monetization/Skeleton) + Phase 0-C (Play Store policy) 미수행 |

## 차단된 항목

- **운영자 작업**: `supabase db push` (3 migration 미적용, RPC 404 경고 원인)
- **Naver/Google OAuth secrets**: Edge Function deploy 대기
- **다자녀 SOS UI 실기 검증**: 자녀 카드 → 자녀 상세 → quickActions → 응급알림 navigation 시간 비용 큼. 코드 + 회귀 테스트로 검증 완료.

## 권장 다음 체크포인트

A. Phase 4 (Monetization 티어 구분 + 페이지 전환 micro-interactions + 스켈레톤 UI) — 코드 only
B. Phase 0-C Play Store 정책 텍스트 감사 — 코드 only
C. 운영자 작업 완료 후 `supabase functions deploy push-notify` + 실기 SOS 트리거 검증

사용자 지시 대기.
