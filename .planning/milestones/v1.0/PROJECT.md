# 혜니캘린더 — Production Stabilization (v1.0)

## What This Is

혜니캘린더(hyenicalendar.com)는 카카오 OAuth로 로그인한 부모와 익명 페어링된 아이가 일정·메모·위치·SOS("꾹")·주위소리듣기를 주고받는 가족 안전 앱입니다. 이 마일스톤은 **2026-04-21 프로덕션 라이브 감사**에서 발견된 9개 결함을 순서대로 수정해 앱을 "실제 프로덕션 레벨"로 끌어올리는 긴급 안정화 작업입니다. 신기능 추가는 없고, 기존 약속된 기능이 **닫힌 앱/백그라운드에서도 신뢰 가능하게 동작**하도록 만드는 것이 목적입니다.

## Core Value

**부모가 보낸 SOS/알림이 아이에게, 아이가 보낸 꾹이 부모에게, 앱이 닫혀 있어도 반드시 도달한다.** 현재는 realtime WebSocket이 가려서 표면상 작동하는 것처럼 보이지만, push-notify Edge Function이 401로 죽어있어 모든 백그라운드 푸시가 실패하고 있음. 이 하나만 보장돼도 안전 앱으로서 약속을 지킬 수 있음.

## Requirements

### Validated

<!-- 감사 중 실측으로 "정상 작동"이 확인된 기능들 -->

- ✓ **카카오 OAuth 부모 로그인** — `families` row + `pair_code` 발급 ([auth.js:82-118](src/lib/auth.js#L82-L118))
- ✓ **아이 익명 로그인** — `supabase.auth.signInAnonymously()` ([auth.js:55-63](src/lib/auth.js#L55-L63))
- ✓ **페어 코드 수동/QR 입력 → 가족 가입** — `join_family` RPC 200 ([auth.js:121-131](src/lib/auth.js#L121-L131))
- ✓ **잘못된 페어 코드 에러 메시지** — RPC 400 + UI "잘못된 코드예요"
- ✓ **Realtime 브로드캐스트 꾹** — 바이너리 Phoenix frame으로 실제 전달 확인, 풀스크린 오버레이 노출
- ✓ **메모/메모답글 양방향 배달** — `memo_replies` INSERT → realtime postgres_changes
- ✓ **이벤트 생성 + polling 동기화** — 30s 폴링으로 `events` 테이블 읽음
- ✓ **RLS 메모 변조 방지** — 타인 `memo_replies` PATCH 차단 (200 empty)

### Active

<!-- 이번 마일스톤에서 달성해야 할 9개 수정 — REQUIREMENTS.md 에 REQ-ID로 정규화됨 -->

- [ ] **P0-1** push-notify Edge Function ES256 JWT 지원 — Web Push/FCM 전체 부활
- [ ] **P0-2** `saved_places`·`family_subscription` 테이블 배포 + Realtime publication 편입 — postgres_changes 신뢰성 복구
- [ ] **P0-3** pair_code TTL·회전 + 단일 아이 제약 + 아이 self-unpair 차단 RLS — 데이터 노출 창구 봉쇄
- [ ] **P1-4** `sendInstantPush` XHR+Fetch+Beacon 삼중 발송 수정 + Idempotency-Key — 중복 알림/비용 방지
- [ ] **P1-5** `fetchSavedPlaces` 404 재시도 백오프/회로 차단기 — 로그·트래픽 정화
- [ ] **P1-6** 메모 데이터 모델 단일화 + 수동 read receipt — 신뢰 가능한 "읽음"
- [ ] **P2-7** 아이 페어링 전 UI 가드 — 익명 로그인 후 빈 채널 UI 차단, "부모 코드 연결" 단일 화면
- [ ] **P2-8** 주위소리듣기 세션 인디케이터 + `remote_listen_sessions` 감사 로그 + WebView 자동 마이크 승인 제거
- [ ] **P2-9** 꾹 press-hold(500~1000ms) + dedup key + 수신 측 서버사이드 쿨다운

### Out of Scope

- **`src/App.jsx` 대규모 해체(6877줄 → 모듈 분해)** — 사용자 명시 금지. phase별 필요 범위만 touch
- **신기능 추가** (새 화면, 새 알림 타입, 새 과금 플랜) — 이번은 안정화 전용
- **역할 전환 UX 신설** (부모 ↔ 아이) — 기존 버그는 문서화만
- **스티커/학원/위치 기능의 재설계** — 실측상 작동 중. 본 마일스톤 범위 외
- **마이그레이션 무관한 pair_code 비주얼(QR) 리디자인** — 핵심 기능 수정이 우선
- **모니터링/APM 도입** — 필요하지만 다음 마일스톤

## Context

**기술 스택** (실측):
- React 19.2 + Vite 7 + `@vitejs/plugin-react`, `@testing-library/react` 16, `vitest` 4
- Capacitor 8 (Android only) — `android/app/src/main/java/com/hyeni/calendar/` 에 FCM·WebView·Location 서비스
- Supabase JS 2.99 — Auth(ES256 JWT) · Realtime(Phoenix 2.0 binary) · Edge Functions(Deno) · RLS
- Qonversion Capacitor 1.4 — 엔타이틀먼트
- Playwright 1.59 — `playwright.config.js` + `playwright.real.config.js` (real-services E2E)

**감사 증거** (2026-04-21):
- 프로덕션 family `4c781fb7-677a-45d9-8fd2-74d0083fe9b4` (부모 2 · 아이 4 + 좀비 3)
- `push-notify` 401 `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM: ES256` 재현 확인
- Realtime `family_subscription`·`saved_places` 구독 거부 메시지 WebSocket 프레임에서 확인
- `saved_places` REST 404 + sync.js 무한 재시도 루프 확인
- `memos` 테이블에 `created_at`·`user_id` 컬럼 없음(`42703`) — 스키마 드리프트

**프로덕션 상태**: 실제 가족 데이터 활성. 모든 DB 변경은 되돌리기 어려움.

**관련 파일**:
- `supabase/functions/push-notify/index.ts` — JWT 알고리즘 수정 대상
- `supabase/*.sql` — 테이블/RLS 마이그레이션 파일 다수
- `src/App.jsx` — 6877줄 모놀리스. 수정 범위 최소화
- `src/lib/auth.js`, `sync.js`, `pushNotifications.js` — 클라이언트 로직
- `android/app/src/main/java/com/hyeni/calendar/*.java` — 네이티브 권한·WebView

## Constraints

- **Tech stack**: React 19 + Capacitor 8 + Supabase — 대체 불가
- **Production data**: 라이브 가족 데이터 있음 — DB 변경은 **Supabase branch(프리뷰 환경)** 에서 먼저 검증, Playwright real-services 테스트 통과 후 main 프로모션
- **Monolith policy**: `src/App.jsx` 해체 금지. phase별 필요한 함수/섹션만 리팩터
- **Test gates**: 각 phase 완료 조건에 **Playwright E2E 커버리지 추가** 포함. `playwright.real.config.js` 로 실제 Supabase branch에 붙여 검증
- **Rollback**: SQL 마이그레이션은 모두 `down.sql` 대응 혹은 PR에 rollback 절차 명시
- **Security**: RLS 변경은 `supabase/add-write-policies.sql` 계열 파일에 append. anon key 공개 — 민감 연산은 Edge Function + verify_jwt
- **Android 배포**: FCM/권한 관련 수정은 네이티브 rebuild + 내부 테스트 트랙 필요
- **Timeline**: "지금 순서대로 실행" — P0는 당일~익일, P1~P2는 phase 단위로 순차

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| push-notify는 Supabase 플랫폼 `verify_jwt=true`로 전환 검토 | ES256 검증 자체를 Supabase가 대신 처리 → 라이브러리 호환 문제 제거 | — Pending (P0-1 research) |
| DB 변경은 모두 Supabase branch에서 검증 후 main 프로모션 | 라이브 가족 데이터 손상 방지 | — Pending |
| pair_code 회전은 TTL 48h + 부모 수동 갱신 버튼 | 기존 페어는 유지하면서 재발급만 제한 | — Pending (P0-3 discuss) |
| 메모 단일 모델은 `memo_replies` 보존 + `memos` deprecate 마이그레이션 | `memo_replies`가 이미 풍부한 스키마(user_id·user_role·created_at) | — Pending (P1-6) |
| `src/App.jsx` 해체 금지 | 사용자 명시 + 리스크 불균형 | ✓ Good (맥락적 판단) |
| E2E는 Playwright real-services 사용 | `playwright.real.config.js` 이미 존재, 실제 Supabase branch에 붙음 | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After milestone v1.0** (via `/gsd-complete-milestone`):
1. 9개 수정 전부 Validated로 이동
2. 모니터링/APM을 v1.1 마일스톤으로 신설
3. 모놀리스 분해는 v2.0 리팩터 마일스톤으로 예약

---
*Last updated: 2026-04-21 after initialization*
