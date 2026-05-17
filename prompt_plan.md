# 구현 계획: `family_members.phone`를 부모 전화번호 단일 소스로 통합

> 작성: 2026-05-17 · 상태: 승인됨 · 결정 방식: 대안 A / PhoneSettingsModal Deprecate / 친구놀이 Realtime는 RPC 재조회 한정

## 목표

부모 전화번호를 `family_members.phone` 단일 소스(canonical source)로 삼고 두 다운스트림을 연결한다.
1. 자녀 화면 전화 바로가기 (`ChildCallCard`)
2. 친구놀이(friend-playdate) 상대 가족 부모 연락처 전달
3. 자녀 카드는 완전 Realtime, 친구놀이는 RPC 재조회 기반 갱신.

## 선행 완료 (별도 작업)

- `supabase/migrations/20260517000000_add_family_members_phone.sql` — `family_members.phone text NOT NULL DEFAULT ''` (운영 DB 사용자 직접 적용 예정)
- `src/lib/auth.js` `getMyFamily()` SELECT 두 곳에 `phone` 추가
- → 부모 설정 화면(내 계정 › 전화번호) 저장 동작

## 확정된 설계 결정

- **성별 라벨링**: 대안 A — `family_members.gender('mom'|'dad'|null)` 컬럼 추가, `user_profiles.gender`에서 백필. `gender=null` 부모는 `name` 기반 + 중립 아이콘 fallback.
- **PhoneSettingsModal**: Deprecate. 진입점을 `EditFieldModal`(내 전화번호 → `updateMyProfile`)로 교체. `fm_upd` RLS(`user_id=auth.uid()`)와 일관.
- **친구놀이 Realtime**: cross-family는 RLS상 직접 구독 불가 → `get_active_playdate_session` RPC 재조회(패널 재오픈/세션 이벤트 시)로 한정.
- **`families.mom_phone/dad_phone`**: 즉시 DROP 안 함. 읽기 경로만 `family_members`로 전환, 컬럼은 deprecated 주석. DROP은 후속 정리 마이그레이션(별도).

## Phase 구성

### Phase 1 — DB 마이그레이션
- 신규 `supabase/migrations/20260518000000_add_family_members_gender.sql`: `ADD COLUMN gender text` (CHECK `gender IN ('mom','dad')` or NULL), `user_profiles.gender`에서 `UPDATE...FROM` 백필. down 파일 동반.
- 백필 검증 주석: `gender IS NULL AND role='parent'` 카운트.
- RLS: `fm_sel`/`fm_upd` 기존 정책으로 충분, 신규 정책 불필요.
- 의존: 없음(선행 `phone` 마이그레이션 후). 운영 DB 사용자 직접 적용.

### Phase 2 — RPC 갱신
- 신규 `supabase/migrations/20260518000001_playdate_session_member_phones.sql` (`CREATE OR REPLACE get_active_playdate_session`).
- `families.mom_phone/dad_phone` 대신 친구 가족 `family_members`(role='parent')의 `phone`+`gender`+`name` 집계.
- SECURITY DEFINER + caller 멤버십 검증 유지. `phone`만 노출, auth UUID 미노출. 빈 phone 필터.
- 의존: Phase 1.

### Phase 3 — Edge Function
- `supabase/functions/push-notify/index.ts` `handlePlaydateStarted` 수정.
- `families.select("mom_phone,dad_phone,parent_id")` → `family_members`(family_id + role='parent')에서 `phone,gender,name` 조회.
- `parent_id`(FCM 토큰용)는 별도 유지 또는 `family_members` user_id 집계로 전환 검토.
- free/premium tier별 `friend_family_phones` payload 게이트(PIPA) 보존. `handlePlaydateEnded`은 변경 불필요.
- 의존: Phase 1.

### Phase 4 — 클라이언트 (자녀 전화 바로가기)
- `src/lib/auth.js`: `getMyFamily` SELECT에 `gender` 추가. 순수 함수 `selectParentContacts(members)` → `{mom, dad, others}` 신규.
- `src/App.jsx`: `parentPhones`를 `familyInfo.members` + `selectParentContacts`로 파생. legacy 슬롯 스왑 effect(1338-1366) 제거. SOS `onCall`(8301)도 멤버 기반.
- `src/components/contact/ChildCallCard.jsx`: `phones={{mom,dad}}` prop 유지(역호환). `gender=null` 부모용 `name` 라벨 + 중립 아이콘 fallback 분기.
- PhoneSettingsModal 진입점(`App.jsx` 5318/7959/7964)을 `EditFieldModal`로 교체(Deprecate).
- 의존: Phase 1.

### Phase 5 — Realtime
- 신규 훅 `src/hooks/useParentContacts.js`(또는 App.jsx): `family_members` `family_id=eq.{familyId}` `postgres_changes` 구독 → `parentPhones` 재파생. `friendPlaydate.js:subscribeActiveSession` 패턴(unique 채널명, cleanup) 참고.
- 친구놀이: `subscribeActiveSession`은 `friend_playdate_sessions`만 구독 → 상대 phone은 stale. `ActivePlaydateCard`/`Banner` 마운트·세션 이벤트 시 `fetchActiveSession` RPC 재조회.
- 의존: Phase 4, Phase 2.

## 의존성 그래프

```
Phase 1 (DB) ──┬─→ Phase 2 (RPC) ──→ Phase 5 친구놀이 RPC 재조회
               ├─→ Phase 3 (Edge)
               └─→ Phase 4 (클라이언트) ──→ Phase 5 ChildCallCard Realtime
```

## 위험

| 위험 | 영향 | 완화 |
|---|---|---|
| cross-family PIPA — 친구 가족 phone 노출 | 높음 | RPC SECURITY DEFINER + caller 멤버십 검증, premium tier 게이트, phone만 노출 |
| `gender` 백필 누락 (Kakao/OAuth `user_profiles.gender=null`) | 중 | `ChildCallCard` name 기반 fallback, 백필 후 카운트 검증 |
| `fm_upd` RLS — 타 부모 phone 수정 불가 | 중 | PhoneSettingsModal Deprecate, 본인 행 편집 일원화 |
| 친구놀이 phone Realtime 불가 | 중 | RPC 재조회로 범위 한정(합의됨) |
| `parentPhones` SOS·ChildCallCard 동시 사용 | 중 | 두 경로 회귀 테스트 |
| `families.*_phone` 잔존 경로(가입 플로우) | 중 | 읽기만 전환, 컬럼 DROP 별도 후속 |

## 테스트 전략

- 단위: `selectParentContacts` (mom/dad/null/공동보호자 다수/빈 phone). `ChildCallCard` 렌더(gender 유무).
- RPC: `get_active_playdate_session` 멤버십 검증·phone 집계·빈 phone 필터·비멤버 거부.
- Edge: `handlePlaydateStarted` tier별 payload phone 노출 회귀.
- E2E: 부모 번호 변경 → 자녀 `ChildCallCard` Realtime 갱신. 친구놀이 시작 → 상대 FCM phone(premium 포함/free 미포함).
- 회귀: 가입 플로우, SOS `onCall`.
- 게이트: 각 Phase 후 `npm run build` + `npx vitest run`.

## 복잡도

중간 규모. 신규 3 + 수정 4~5 파일. 각 Phase = 1 커밋. Phase 1은 단독 배포, 2·3·4는 Phase 1 후 독립 mergeable.

## 구현 중 확인할 잔여 항목 (planner STOP, 미결)

1. `ThreeDIcon`에 중립(성별 무관) 부모 아이콘 에셋 존재 여부 — Phase 4 시작 시 확인.
2. `friend_family_phones` 형태 — 기존 `[phone]` 문자열 배열 유지(변경 최소) 기본. `ActivePlaydateCard.jsx:12`·`Banner.jsx:37`이 `.filter(Boolean)`만 함.
3. 가입 플로우(`auth.js` ~368-375)가 `families.*_phone`에 쓰는 부분 — `family_members.phone`+`gender` 일원화 여부, Phase 4에서 검토.
4. 공동 보호자 3명 이상 시 `ChildCallCard` 표시 정책.
