# Roadmap: 혜니캘린더 Production Stabilization (v1.0)

## Overview

2026-04-21 프로덕션 감사에서 드러난 9개 결함(+ 연구단계에서 추가된 SOS 감사 로그 1건, 총 28 REQs)을 의존성 순서대로 수정해 부모-아이 안전 앱을 "실제 프로덕션 레벨"로 끌어올린다. 라이브 가족 데이터가 활성 상태이므로 모든 DB 변경은 **Supabase branch에서 Playwright real-services E2E 통과 후 main 프로모션** 한다. 신기능은 금지, `src/App.jsx` 모놀리스 해체도 금지. 5개 phase로 완료하며 — Phase 1은 마이그레이션 위생 기반을 세우고, Phase 2는 모든 것을 가로막는 gateway 3개를 병렬로 뚫고, Phase 3·5는 병렬 스트림으로 부피 있는 작업을 처리하며, Phase 4는 단독 phase로 메모 모델을 섀도우 통합한다.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4, 5): Planned milestone work
- Decimal phases (X.Y): Reserved for urgent insertions via `/gsd-insert-phase`

- [ ] **Phase 1: Migration Hygiene & Baseline** - `supabase/migrations/down/` 구조 · 드리프트 재조정 · 환경 스냅샷 · 베이스라인 태깅 (no REQ-IDs)
- [x] **Phase 2: Unblock Core** - ES256 push-notify · realtime publications · pair code TTL·RLS (parallel ×3)
- [ ] **Phase 3: Client Push & Fetch Hygiene** - `sendInstantPush` idempotency · `fetchSavedPlaces` backoff·circuit breaker (parallel ×2)
- [ ] **Phase 4: Memo Model Unification** - `memo_replies` 단일화 + `memos_legacy` 섀도우 + 수동 read receipt (solo, shadow-running DoD)
- [ ] **Phase 5: UX & Safety Hardening** - pre-pair UI gate · remote listen 감사·FGS·feature flag · SOS press-hold·dedup·감사로그 (parallel ×3)

## Phase Details

### Phase 1: Migration Hygiene & Baseline
**Goal**: 라이브 가족 데이터에 영향을 줄 이후 phase들을 위해 마이그레이션 위생과 롤백 기반을 확보한다. 어떤 REQ-ID도 직접 수정하지 않으며, Phase 2~5 전부의 전제 조건이다.
**Depends on**: Nothing (first phase)
**Requirements**: (none — infrastructure work; all v1 REQs mapped to Phase 2–5)
**Success Criteria** (what must be TRUE):
  1. `supabase/migrations/down/` 디렉터리가 존재하고, 컨벤션을 선언하는 README가 포함되어 있다.
  2. 루스 `supabase/*.sql` 파일이 `supabase/archive/_deprecated_*.sql` 로 이동되고, `supabase db diff` 가 프로덕션 대비 드리프트를 보고하며, 재조정(reconciliation) 마이그레이션이 Supabase branch에서 한 번 적용된다 (`memos` 누락 컬럼 포함).
  3. `pg_policies` 스냅샷 + VAPID·FCM 환경변수 스냅샷이 `.planning/research/baselines/` 에 기록되고, 현재 `push-notify` 배포가 `push-notify-baseline-20260421` 태그로 고정된다.
  4. Supabase branch 재조정 마이그레이션에 대해 Playwright real-services smoke(`playwright.real.config.js`)가 기존 flow(로그인·페어링·꾹·메모 왕복) 회귀 없음을 증명한다.
**Plans**: 5 plans
**Research required for planning**: No (standard DevOps hygiene; no novel patterns)

Plans:
- [x] 01-01-PLAN.md — Archive loose supabase/*.sql (12 files) into supabase/archive/_deprecated_*.sql + author archive README (D-01, D-02)
- [x] 01-02-PLAN.md — Create supabase/migrations/down/ directory + README declaring up↔down pairing + BEGIN/COMMIT conventions (D-03, D-04)
- [x] 01-03-PLAN.md — Capture supabase db diff; author reconciliation migration + paired down file with memos.created_at/user_id/user_role (D-05, D-06, D-07)
- [x] 01-04-PLAN.md — Snapshot pg_policies + env metadata under .planning/research/baselines/; create + push git tag push-notify-baseline-20260421 (D-08, D-09, D-10)
- [ ] 01-05-PLAN.md — [BLOCKING schema push] Create Supabase branch phase-1-baseline, apply reconciliation migration, run Playwright real-services, 5-min Edge Function log watch (D-11..D-14)

### Phase 2: Unblock Core (Push Gateway · Realtime · Pair Security)
**Goal**: 모든 하위 phase를 가로막고 있는 세 gateway — (A) `push-notify` ES256 401, (B) `saved_places`·`family_subscription` publication 누락, (C) `pair_code` TTL·회전·단일아이·self-unpair RLS — 를 disjoint한 3개 스트림으로 동시에 뚫는다.
**Depends on**: Phase 1
**Requirements**: PUSH-01, RT-01, RT-02, RT-03, RT-04, PAIR-01, PAIR-02, PAIR-03, PAIR-04
**Success Criteria** (what must be TRUE):
  1. 유효한 ES256 JWT를 실은 `curl` 호출이 `push-notify` Edge Function에서 2xx로 응답하고(부모/아이 세션 모두), 기존 `push_subscriptions` 엔트리는 VAPID 교체 없이 그대로 유효하다 (PUSH-01 달성).
  2. Supabase Realtime WebSocket 프레임에서 `saved_places:${familyId}` · `family_subscription:${familyId}` 채널이 `status:ok` 를 받고, 각 테이블의 INSERT·UPDATE가 `postgres_changes` 이벤트로 30초 이내 아이/부모 세션에 도달한다 (RT-01~04 달성).
  3. 만료된 `pair_code` 로 `join_family` RPC 호출 시 명시적 에러를 반환하고, 기존(grandfathered) 페어 코드는 계속 redeem되며, 부모 UI에서 TTL 카운트다운 + 수동 회전 버튼이 작동한다 (PAIR-01 달성).
  4. 아이 세션이 `family_members` 자기 row DELETE를 시도하면 RLS 403이 반환되고, 좀비 아이 row 정리는 부모 UI의 해제 버튼을 통해서만 가능하다 (PAIR-02·03·04 달성).
  5. **Supabase branch 검증 스텝**: 세 스트림의 마이그레이션이 `supabase branches create phase-2-*` 에서 적용되고 5분 프로덕션 스모크가 Edge Function 로그 경고 0건 기록 / **Playwright E2E 커버리지 추가**: `playwright.real.config.js` 가 PUSH-01·RT-01~03·PAIR-01~03 각각의 happy/failure path를 검증한다.
**Plans**: 5 plans
**Research required for planning**: Yes — `/gsd-research-phase` needed for Stream A (VAPID 연속성·OEM `direct_boot_ok`) and Stream C (`join_family` RPC baseline 복원 — 루스 SQL). Stream B (publication ALTER) 은 4줄 표준 SQL, research 불필요.

Plans:
- [x] 02-01-PLAN.md — Stream A (Wave 1): push-notify ES256 in-function getClaims + push_idempotency table + v31 deploy (PUSH-01)
- [x] 02-02-PLAN.md — Stream B (Wave 1): publications ADD + REPLICA IDENTITY FULL + NOTIFY pgrst + sync.js per-table channels (RT-01, RT-02, RT-03, RT-04)
- [x] 02-03-PLAN.md — Stream C (Wave 1, SQL): pair_code_expires_at column + join_family TTL+suffix + regenerate_pair_code RPC (PAIR-01, PAIR-02)
- [x] 02-04-PLAN.md — Stream C (Wave 2, RLS): family_members DELETE policy tightened to parent-only (PAIR-03)
- [x] 02-05-PLAN.md — Stream C (Wave 2, UI): PairingModal TTL countdown + regenerate button + ChildPairInput expired-error branch (PAIR-01 UI, PAIR-04)

### Phase 3: Client Push & Fetch Hygiene
**Goal**: Phase 2가 서버/인프라를 연 후, 클라이언트 쪽에서 중복 발송·무한 재시도·영수증 공백을 정리한다. 두 스트림은 서로 다른 파일을 건드려 병렬 가능.
**Depends on**: Phase 2 (PUSH-01 이후에만 PUSH-02~04의 idempotency 체인이 의미를 가짐; RT-01 이후에만 RES-01의 backoff가 실제 404 경로를 대상으로 함)
**Requirements**: PUSH-02, PUSH-03, PUSH-04, RES-01, RES-02
**Success Criteria** (what must be TRUE):
  1. 동일 `Idempotency-Key` 를 30초 내 2회 호출해도 FCM·Web Push 각각 **정확히 1회** 전달된다(`push_idempotency` unique-violation으로 dedup); body-embedded mirror 로 sendBeacon 경로도 dedup된다 (PUSH-02).
  2. 수신자(push_subscriptions·fcm_tokens) 0건인 가족에 대해 `push-notify` 가 `pending_notifications` 에 1행을 적재하고, 모든 발송은 delivered/failed 상태를 같은 테이블(또는 telemetry 테이블)에 기록한다 (PUSH-03, PUSH-04).
  3. `saved_places` REST가 404/5xx 를 반환할 때 `fetchSavedPlaces` 는 exponential backoff(2s→4s→8s, 최대 5분)를 적용하고, 60초 내 3회 연속 실패 시 5분 회로 차단을 발동하며, 콘솔 에러 스팸 없이 UI 에러 배너 하나로 관찰 가능하다 (RES-01, RES-02).
  4. **Supabase branch 검증 스텝**: `push_idempotency` 테이블 마이그레이션이 branch에서 확인되고, dedup 유니크 제약이 실제 충돌 케이스에서 예상대로 동작함 / **Playwright E2E 커버리지 추가**: 꾹/알림 이중 클릭·네트워크 빠른 연타 → 정확히 1회 전달, `saved_places` 404 주입 → 회로 차단 발동.
**Plans**: TBD
**Research required for planning**: No — idempotency(MDN/Stripe/IETF)와 exponential backoff+circuit breaker는 산업 표준 패턴, SUMMARY Research Flags가 '표준 패턴' 분류.

Plans:
- [ ] 03-01: TBD — Stream A: P1-4 `sendInstantPush` 단일경로 + `Idempotency-Key` + `push_idempotency` dedup 테이블 (PUSH-02~04)
- [ ] 03-02: TBD — Stream B: P1-5 `fetchSavedPlaces` backoff + circuit breaker + 단일 에러 배너 (RES-01·02)

### Phase 4: Memo Model Unification
**Goal**: `memos`/`memo_replies` 이원화된 메모 모델을 `memo_replies` 중심으로 통합하되, 라이브 데이터 손실 위험을 이원화해 **"phase 완료 = shadow-running with read-parity"** 로 정의한다. legacy DROP은 v1.1로 예약. 14개 line region + SQL + `sync.js` 를 건드려 단독 phase 할당.
**Depends on**: Phase 2 (RT-03 에 `memos`/`memo_replies` 가 이미 포함돼야 postgres_changes로 실측 가능)
**Requirements**: MEMO-01, MEMO-02, MEMO-03
**Success Criteria** (what must be TRUE):
  1. 마이그레이션 후 `memos_legacy_20260421` 스냅샷 테이블이 존재하고, 이전 `memos` 모든 행이 `origin` 컬럼(`'legacy_memo'`)과 함께 `memo_replies` 에 통합되며 row-count + sender 속성(user_id·user_role) 패리티가 100% 이다 (MEMO-01, MEMO-03).
  2. 메모 "읽음" 은 사용자가 뷰포트에 3초 이상 노출했을 때만 서버 상태 업데이트되고, 수신 즉시 auto-read 경로는 제거된다(알림 프리뷰 노출로는 읽음 표시되지 않음) (MEMO-02).
  3. `memos` 는 DROP되지 않고 30일간 VIEW로 유지되어 기존 읽기 호출이 깨지지 않는다; v1.1 에 DROP 예약 항목이 PROJECT.md / Deferred items 에 기록된다.
  4. **Supabase branch 검증 스텝**: 마이그레이션 + dual-write가 branch에서 14일 shadow-parity 관찰 가능한 상태로 배포되고, production 프로모션 후 5분 스모크 clean / **Playwright E2E 커버리지 추가**: 부모→아이 메모 + 아이 reply + 3초 뷰포트 read receipt, `memos` VIEW 경유 legacy 읽기가 새 `memo_replies` 경로와 동일 결과.
**Plans**: TBD
**Research required for planning**: No — shadow + dual-write는 표준 패턴, SUMMARY가 '표준 패턴' 분류. (단, 14개 line region이므로 plan에서 touch map 필수.)

Plans:
- [ ] 04-01: TBD — Solo: P1-6 `memos_legacy_20260421` 스냅샷 + `origin` 컬럼 + `memo_replies` dual-write + `memos` VIEW + 수동 read receipt (MEMO-01~03)

### Phase 5: UX & Safety Hardening
**Goal**: 마일스톤의 외부 면(사용자 신뢰·플레이 스토어 정책·안전 행위 감사)을 완성한다. 3 스트림은 서로 다른 App.jsx region·native 코드를 건드려 병렬 가능. P2-8은 스토어 리스크가 높아 remote feature flag 뒤에서 **마지막으로** 병합.
**Depends on**: Phase 3 (PUSH-02~04 가 `sendInstantPush` 경로를 깨끗이 정리한 뒤에야 P2-9의 press-hold·dedup·cooldown을 동일 region에 얹을 수 있음 — L4603–4657 충돌)
**Requirements**: GATE-01, GATE-02, RL-01, RL-02, RL-03, RL-04, KKUK-01, KKUK-02, KKUK-03, SOS-01
**Success Criteria** (what must be TRUE):
  1. 아이가 익명 로그인 직후·페어링 이전 상태에서는 "부모 코드 연결" 단일 화면만 노출되고, 메모/꾹/일정 작성 UI에 접근 불가하다; 페어링 성공 시 전체 UI 전환, 페어링 해제 시 복귀한다 (GATE-01·02).
  2. 주위소리듣기 세션이 시작되기 **전에** `remote_listen_sessions` 에 1행이 insert되고, 세션 동안 아이 기기에는 **영구 비소거 Android 알림(`setOngoing(true)` + `FOREGROUND_SERVICE_MICROPHONE` FGS type)** + 풀스크린 인디케이터가 유지되며, WebView `PermissionRequest.grant()` 자동 승인이 제거되고 기존 사용자는 honor-legacy-consent 로 1회 `.grant()` 후 명시 동의로 전환된다; `stopRemoteAudioCapture` 실패 시에도 beforeunload + 강제 타임아웃으로 cleanup된다 (RL-01~04).
  3. 꾹 버튼이 500~1000ms press-and-hold 에서만 발사되고, 우발 터치 SOS 비율이 내부 테스트 <1% 이며, 같은 `dedup_key` 를 60초 내 재수신 시 오버레이·진동은 1회만 발생하고, 서버사이드 쿨다운(Edge Function 또는 DB trigger)이 발신자당 5초에 1회를 초과한 broadcast/push를 거부한다 (KKUK-01·02·03).
  4. 모든 꾹 발송이 `sos_events` 불변 감사 로그(insert-only RLS; service-role만 UPDATE/DELETE)에 1행 기록되고, `client_request_hash` · `delivery_status` · `receiver_user_ids[]` 가 포함되어 PIPA·OWASP MASTG 안전 행위 감사 요건을 충족한다 (SOS-01).
  5. **Remote feature flag 킬 스위치**가 `family_subscription.runtime_flags`(또는 대체 경로)를 통해 P2-8을 APK 재빌드 없이 비활성화할 수 있으며, 프로덕션 머지 후 flag off→on 왕복이 검증된다.
  6. **Supabase branch 검증 스텝**: 세 스트림의 마이그레이션·네이티브 변경이 Supabase branch + Android 내부 테스트 트랙에서 검증되고 Play Store 정책 자기 진단(스파이웨어 면제) 체크리스트 통과 / **Playwright E2E 커버리지 추가**: 페어링 전 UI gate, 주위소리듣기 audit row + 인디케이터 가시성, press-hold 500ms 미만 무시·정확 600ms 발사·연속 연타 서버 쿨다운 거부.
**Plans**: TBD
**Research required for planning**: Yes — `/gsd-research-phase` needed for Stream B (Android `FOREGROUND_SERVICE_MICROPHONE` manifest specifics + Play Store family-exception 제출 카피) and Stream C (`sos_events` 스키마 + retention + PIPA 체크리스트). Stream A (pre-pair gate) 는 순수 React early-return, research 불필요.

Plans:
- [ ] 05-01: TBD — Stream A: P2-7 pre-pair UI gate early-return (GATE-01·02)
- [ ] 05-02: TBD — Stream B: P2-8 `remote_listen_sessions` + persistent notification + FGS-type + WebView honor-legacy-consent + remote feature flag (RL-01~04) — **merge LAST**
- [ ] 05-03: TBD — Stream C: P2-9 press-hold + dedup + server cooldown + `sos_events` audit log (KKUK-01~03, SOS-01)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Migration Hygiene & Baseline | 5/5 | Complete ✅ | 2026-04-21 |
| 2. Unblock Core | 5/5 | Complete ✅ | 2026-04-21 |
| 3. Client Push & Fetch Hygiene | 0/2 | Not started | - |
| 4. Memo Model Unification | 0/1 | Not started | - |
| 5. UX & Safety Hardening | 0/3 | Not started | - |

## Coverage

- **v1 requirements:** 28 total (SOS-01 added from research synthesis)
- **Mapped to phases:** 28
- **Unmapped:** 0

Every v1 REQ-ID maps to exactly one phase. Phase 1 intentionally carries zero REQ-IDs because it is pre-remediation infrastructure hygiene; without it, Phases 2–5 carry unacceptable rollback risk on live production data.

## Non-Negotiable Exit Gates (every phase except Phase 1 where applicable)

1. **Supabase branch verification** — all DB/Edge Function changes applied on `supabase branches create phase-<N>-*`, seeded with test family, 5-min production smoke with Edge Function log watch after `db push` to main.
2. **Playwright real-services E2E coverage** — `playwright.real.config.js` gains phase-specific specs covering the success criteria; runs green against the Supabase branch before main promotion.

Phase 1 applies gate (1) to its reconciliation migration and gate (2) as regression smoke on existing flows; it does not introduce new feature coverage.
