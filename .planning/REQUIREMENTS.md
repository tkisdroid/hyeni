# Requirements: 혜니캘린더 Production Stabilization (v1.0)

**Defined:** 2026-04-21
**Core Value:** 부모가 보낸 SOS/알림이 아이에게, 아이가 보낸 꾹이 부모에게, 앱이 닫혀 있어도 반드시 도달한다.

## v1 Requirements

9개 감사 기반 요구사항. 각 REQ는 정확히 1개 phase에 매핑됨(traceability 참고). 모든 항목은 **Playwright real-services E2E 커버리지 + Supabase branch 사전 검증**을 완료 조건에 포함.

### Push Infrastructure (인증·알림 파이프라인)

- [x] **PUSH-01**: `push-notify` Edge Function이 ES256 JWT를 정상 검증해 인증된 호출에 2xx 응답한다. 부모/아이 양쪽 세션의 Bearer token 모두 수용. (Phase 2/02-01)
- [ ] **PUSH-02**: 클라이언트 `sendInstantPush` 는 1회 액션당 1회 HTTP 호출만 발생한다(Idempotency-Key 포함). 성공 시 fallback 체인 조기 종료.
- [ ] **PUSH-03**: Edge Function은 수신자(push_subscriptions·fcm_tokens) 0건일 때도 `pending_notifications` 에 적재하여 차후 조회 가능.
- [ ] **PUSH-04**: 전송 영수증(delivered/failed 상태)이 `pending_notifications` 또는 별도 telemetry 테이블에 기록되어 관찰 가능.

### Realtime Reliability (실시간 채널 복구)

- [x] **RT-01**: `saved_places` 테이블이 생성되고 `supabase_realtime` publication에 포함되어 postgres_changes 구독이 성공한다(채널이 `status:ok` + system error 없음). (Phase 2/02-02)
- [x] **RT-02**: `family_subscription` 테이블이 생성되고 publication에 포함되어 Qonversion 상태 변화가 realtime으로 전파된다. (Phase 2/02-02)
- [x] **RT-03**: `events` · `memos` · `memo_replies` INSERT가 아이 세션 realtime 채널에 postgres_changes 이벤트로 30초 이내 도달한다(폴링 의존도 제거). (Phase 2/02-02)
- [x] **RT-04**: Supabase branch에서 Playwright E2E가 RT-01~03 모두 검증한다. (Phase 2/02-02 — browser smoke substituted per MCP-direct path)

### Pairing Security (페어링·데이터 노출 봉쇄)

- [x] **PAIR-01**: `pair_code`에 TTL(48시간 기본) + 부모 수동 회전 버튼이 존재한다. 만료된 코드로 join 시도 시 명확한 에러. (Phase 2/02-03+02-05)
- [x] **PAIR-02**: 한 가족에 `role='child'` 복수 row가 허용되더라도, 부모의 명시적 "아이 추가" 액션 없이 신규 익명 세션이 기존 `이름='아이'` slot을 덮어쓰지 않는다. (Phase 2/02-03 — name-suffix collision)
- [x] **PAIR-03**: 아이 self-DELETE membership이 RLS로 차단되고, 아이는 parent-approved "가족 나가기" 플로우를 통해서만 이탈 가능. (Phase 2/02-04 — parent-only fm_del via SECURITY DEFINER helper)
- [x] **PAIR-04**: 좀비 "아이" row 정리용 부모 UI (family_members 관리 화면 + 해제 버튼)가 작동한다. (Phase 2/02-05 — existing member list + unpairChild + new parent-only fm_del RLS)

### Client Resilience (클라이언트 리소스)

- [ ] **RES-01**: `fetchSavedPlaces` 등 polling 함수가 404/5xx 응답에 대해 exponential backoff(최대 5분) + circuit breaker 적용. 60초 동안 3회 연속 실패 시 5분 쿨다운.
- [ ] **RES-02**: 콘솔 에러 스팸 없이, 실패 상태를 관찰 가능한 단일 에러 배너로 표시.

### Memo Model Unification (메모 모델 정리)

- [ ] **MEMO-01**: 메모 데이터 모델을 단일(memo_replies 중심)로 통합. `memos` 테이블은 deprecate되고 마이그레이션으로 잔존 데이터를 memo_replies로 이관.
- [ ] **MEMO-02**: 읽음(read) 표시는 **사용자가 해당 메모가 뷰포트에 3초 이상 노출**되었을 때만 server-side 업데이트. 수신 시 자동 마크 제거.
- [ ] **MEMO-03**: 발신자 식별(user_id + user_role)이 모든 메모 레코드에 보존.

### Pre-Pair UI Gate (페어링 전 UI 차단)

- [ ] **GATE-01**: 아이 역할 선택 + 익명 로그인 직후, 페어링 완료 전에는 "부모 코드 연결" 단일 화면만 노출. 메모/꾹/일정 작성 UI 접근 불가.
- [ ] **GATE-02**: 페어링 성공 시 전체 앱 UI로 전환. 페어링 해제 시 다시 "부모 코드 연결" 화면으로 복귀.

### Remote Listen Accountability (주위소리듣기 투명성·감사)

- [ ] **RL-01**: `remote_listen_sessions` 테이블 생성 (`id, family_id, initiator_user_id, child_user_id, started_at, ended_at, duration_ms, end_reason`). 모든 청취 세션 기록.
- [ ] **RL-02**: 아이 측에 청취 중 **지속 표시 인디케이터**(풀스크린 오버레이 또는 상단 고정 배너 + 진동/사운드)가 노출된다. 세션 끝날 때까지 사라지지 않음.
- [ ] **RL-03**: Android WebView의 `getUserMedia` 자동 승인 제거. 기존 허용을 세션별 명시 동의로 교체.
- [ ] **RL-04**: 마이크 스트림·MediaRecorder·Realtime 구독이 `stopRemoteAudioCapture` 실패나 앱 크래시 시에도 cleanup (beforeunload + 타임아웃 강제 stop).

### Kkuk Reliability (꾹 재설계)

- [ ] **KKUK-01**: 꾹 버튼이 **press-and-hold 500~1000ms** 에서만 발사(onMouseDown/onTouchStart 타이머 기반). 우발 터치 방지.
- [ ] **KKUK-02**: 송신 payload에 UUID `dedup_key` 포함. 수신 측은 `dedup_key`를 LRU로 60초간 보관, 중복 프레임은 1회만 오버레이·진동.
- [ ] **KKUK-03**: 서버사이드 쿨다운(Edge Function 또는 DB trigger) — 발신자당 5초에 1회만 broadcast/push 허용.
- [ ] **SOS-01** *(scope expansion from research)*: `sos_events` 불변 감사 로그 테이블 (`id, family_id, sender_user_id, receiver_user_ids[], triggered_at, delivery_status jsonb, client_request_hash text`). Insert-only RLS (service-role만 UPDATE/DELETE 가능). 모든 꾹 발송이 이 테이블에 1행 기록. OWASP MASTG + PIPA 안전 행위 감사 요건 충족.

## v2 Requirements

이번 마일스톤 범위 외, 다음 마일스톤에서 다룸.

### Observability

- **OBS-01**: Sentry 또는 Supabase Log Drain으로 Edge Function·클라이언트 에러 telemetry
- **OBS-02**: 푸시 전달 성공률·평균 레이턴시 대시보드 (Realtime vs FCM vs Web Push)
- **OBS-03**: 가족별 활동 메트릭(꾹 빈도, 메모 주고받음, 위치 업데이트)

### Decomposition

- **REFACTOR-01**: `src/App.jsx` 6877줄을 기능별 모듈로 분해 (auth/family, calendar, memo, kkuk, remote-listen, location, push-scheduler)
- **REFACTOR-02**: TypeScript 마이그레이션 로드맵

### Memo Legacy Cleanup (v1.0에서 shadow, v1.1에서 drop)

- **MEMO-CLEANUP-01**: `memos` VIEW DROP (Phase 4에서 30일 shadow 이후 예약)

### UX Polish

- **UX-01**: 페어링 QR코드 재디자인 + 공유 링크 방식
- **UX-02**: 역할 전환 공식 UX (부모가 아이 계정 만들기)
- **UX-03**: 좀비 row 자동 정리 주기 (예: 90일 비활성 DELETE)

## Out of Scope

| Feature | Reason |
|---------|--------|
| 신규 기능 (화면·알림 유형 추가) | 이번 마일스톤은 안정화 전용 |
| `src/App.jsx` 대규모 해체 | 사용자 명시 금지. v2 REFACTOR-01로 이동 |
| iOS 네이티브 빌드 | 현재 Android + Web 만 지원. PWA iOS는 별개 이슈 |
| 결제/구독 플로우 변경 | Qonversion 경로 유지. `family_subscription` 테이블 생성만 범위 |
| Push 수신 앱 외부 확장 (SMS, Kakao 메시지) | 별도 채널은 v2+ |
| AI 음성 파싱 개선 | `supabase/functions/ai-voice-parse` 는 현행 유지 |
| 스티커/학원 UX 재설계 | 감사상 작동 중. 변경 필요성 낮음 |
| 모니터링/APM 도입 | 필요하지만 v2 OBS-01~03 으로 |

## Traceability

**Final phase mapping (confirmed by roadmapper 2026-04-21).** Every v1 REQ-ID maps to exactly one phase; zero unmapped. Phase 1 intentionally carries zero REQ-IDs — it is pre-remediation migration hygiene that every subsequent phase depends on.

| Requirement | Phase | Stream | Status |
|-------------|-------|--------|--------|
| PUSH-01 | Phase 2 | A (P0-1) | Pending |
| PUSH-02 | Phase 3 | A (P1-4) | Pending |
| PUSH-03 | Phase 3 | A (P1-4) | Pending |
| PUSH-04 | Phase 3 | A (P1-4) | Pending |
| RT-01 | Phase 2 | B (P0-2) | Pending |
| RT-02 | Phase 2 | B (P0-2) | Pending |
| RT-03 | Phase 2 | B (P0-2) | Pending |
| RT-04 | Phase 2 | B (P0-2) | Pending |
| PAIR-01 | Phase 2 | C (P0-3) | Pending |
| PAIR-02 | Phase 2 | C (P0-3) | Pending |
| PAIR-03 | Phase 2 | C (P0-3) | Pending |
| PAIR-04 | Phase 2 | C (P0-3) | Pending |
| RES-01 | Phase 3 | B (P1-5) | Pending |
| RES-02 | Phase 3 | B (P1-5) | Pending |
| MEMO-01 | Phase 4 | solo (P1-6) | Pending |
| MEMO-02 | Phase 4 | solo (P1-6) | Pending |
| MEMO-03 | Phase 4 | solo (P1-6) | Pending |
| GATE-01 | Phase 5 | A (P2-7) | Pending |
| GATE-02 | Phase 5 | A (P2-7) | Pending |
| RL-01 | Phase 5 | B (P2-8) | Pending |
| RL-02 | Phase 5 | B (P2-8) | Pending |
| RL-03 | Phase 5 | B (P2-8) | Pending |
| RL-04 | Phase 5 | B (P2-8) | Pending |
| KKUK-01 | Phase 5 | C (P2-9) | Pending |
| KKUK-02 | Phase 5 | C (P2-9) | Pending |
| KKUK-03 | Phase 5 | C (P2-9) | Pending |
| SOS-01 | Phase 5 | C (P2-9) | Pending |

**Coverage:**
- v1 requirements: **28 total** (SOS-01 added from research synthesis)
- Mapped to phases: **28**
- Unmapped: **0**

**Phase distribution:**
- Phase 1: 0 REQs (migration hygiene / infrastructure)
- Phase 2: 9 REQs (PUSH-01 + RT-01~04 + PAIR-01~04)
- Phase 3: 5 REQs (PUSH-02~04 + RES-01~02)
- Phase 4: 3 REQs (MEMO-01~03)
- Phase 5: 10 REQs (GATE-01~02 + RL-01~04 + KKUK-01~03 + SOS-01)

**Dependency rationale:**
- Phase 2 unblocks everything: ES256 gateway (PUSH-01) must open before PUSH-02~04·RL-02·KKUK-03 can be push-verified; RT-01~04 must work before RES-01 backoff can target the real 404 path; PAIR-01~04 is independent and parallel-safe.
- Phase 3 before Phase 4 because RT-03 (Phase 2) already includes memo channels, and `memo_replies` dual-write needs a clean push pipeline first (PUSH-02~04).
- Phase 4 solo (14 line regions in `src/App.jsx` + `sync.js` + SQL) — shared phase = unsafe.
- Phase 5 after Phase 3 because P1-4 (Phase 3) and P2-9 (Phase 5 Stream C) touch the same `App.jsx` L4603–4657 region — must serialize. P2-8 merges **last** within Phase 5 behind remote feature flag.

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 — Final phase mapping confirmed by roadmapper (28/28 mapped, 0 unmapped).*
