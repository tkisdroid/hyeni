# Phase 3: Client Push & Fetch Hygiene - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** `--auto` — all decisions sourced from research (SUMMARY.md, STACK.md); single-pass.

<domain>
## Phase Boundary

두 개의 클라이언트 사이드 결함을 고친다:

- **Stream A (P1-4)** — `sendInstantPush`의 XHR→Fetch→Beacon 3중 발송을 **Idempotency-Key 기반 단일 HTTP 호출**로 재작성. Phase 2 Stream A에서 이미 배포된 `push_idempotency` 테이블 + Edge Function을 활용. → PUSH-02, PUSH-03, PUSH-04
- **Stream B (P1-5)** — `fetchSavedPlaces` 등 polling 함수에 **exponential backoff + circuit breaker** 적용. Phase 2 Stream B가 `saved_places` 404를 해결했지만 일반적인 리소스 보호용. → RES-01, RES-02

**DB 변경 없음** (클라이언트 only). 프로덕션 데이터 리스크 낮음. Supabase 롤백 불필요.

</domain>

<decisions>
## Implementation Decisions

### Stream A — PUSH-02/03/04 (sendInstantPush 재작성)

**D-A01:** **`Idempotency-Key` 헤더 + body mirror** 패턴 (STACK.md §Issue #3)
- 클라이언트가 `crypto.randomUUID()`로 UUID 생성
- HTTP 헤더 `Idempotency-Key: <uuid>` + JSON body에 `idempotency_key: <uuid>` 동시 포함 (beacon은 헤더 못 쓰니 body mirror 필수)

**D-A02:** **단일 시도, fallback 제거** (현재 XHR→Fetch→Beacon 순차 실행을 **one-shot**으로)
- 기본 경로: `fetch()` (auth header + body)
- 성공(2xx) 시 종료
- 실패(네트워크 에러 or 5xx) 시: **단일 retry** (최대 1회, 800ms 지연)
- 여전히 실패 시: body mirror는 이미 payload에 있으니 fallback 불필요. 실패 로깅만.
- Beacon은 **오직 `unload`/`pagehide` 이벤트** 같은 unmount 경로에서만 (window closing 시 최후의 시도)

**D-A03:** **Edge Function 측 멱등 체크** (`push-notify/index.ts`에 추가)
- 요청에서 `Idempotency-Key` 헤더 or `body.idempotency_key` 추출
- 없으면 그냥 기존 로직 (backward compatible)
- 있으면 `INSERT INTO public.push_idempotency (key) VALUES ($1) ON CONFLICT (key) DO NOTHING RETURNING key`
  - INSERT 성공 → 신규 요청 → 정상 처리
  - INSERT 무효(키 이미 존재) → 중복 요청 → 200 반환하되 실제 push 발송은 스킵, `{duplicate: true}` 응답

**D-A04:** **`pending_notifications` 기록 확장** (PUSH-03/04)
- 수신자 0건(웹푸시 구독 0 + FCM 토큰 0)일 때도 `pending_notifications` 에 적재 (PUSH-03)
- `delivery_status jsonb` 컬럼 추가 — 기존 인서트 페이로드에 `{webSent, fcmSent, webFailed, fcmFailed, duplicates}` 기록 (PUSH-04)
- `pending_notifications` 스키마에 `delivery_status jsonb`, `idempotency_key uuid REFERENCES push_idempotency(key) ON DELETE SET NULL` 컬럼 추가 (ADD COLUMN IF NOT EXISTS, nullable)

**D-A05:** **client-side 로그 정리** — 기존 `console.log("[Push] XHR failed")` 등 3단계 로그를 단일 `[Push] send <id> <outcome>` 로 축소. 스팸 감소.

**D-A06:** **cleanup cron 범위 외** — `push_idempotency` 24h TTL cron은 v1.1 observability phase. 이번엔 무한히 쌓이지만 24h 분량이 많지 않고 index on `created_at` 이미 있어서 쿼리 성능 문제 없음.

### Stream B — RES-01/02 (fetchSavedPlaces 백오프 + circuit breaker)

**D-B01:** **exponential backoff** 단일 재시도 파라미터 (STACK.md 표준)
- 시도 간격: 2s → 4s → 8s → 16s → 32s → 60s (max 5분 상한은 circuit breaker가 담당)
- Jitter: `backoff * (0.8 + Math.random() * 0.4)` (±20%)
- 재시도 대상: 4xx(429 제외) 제외, 404/5xx/네트워크 에러만

**D-B02:** **circuit breaker** — 60초 내 3회 연속 실패 → 5분 강제 cooldown
- state: `{ failureCount, openUntil, lastAttemptAt }`
- `failureCount >= 3 && lastAttemptAt > now - 60s` → `openUntil = now + 5min`
- open 상태에서 호출 시 즉시 에러 반환 (network 트래픽 안 발생)
- 성공 1회 → failureCount = 0

**D-B03:** **단일 에러 배너 UI** (RES-02)
- `src/App.jsx` 에서 polling 실패 시 컴포넌트 상단(설정 섹션 근처)에 **작은 배너 1개**만 표시
- 메시지: "일부 기능을 일시적으로 불러오지 못했어요 — 잠시 뒤 자동 재시도합니다"
- circuit breaker open 상태 → "5분 후 자동 재시도" 표시
- 콘솔 `[sync]` 스팸 수십 건 로그를 대체

**D-B04:** **대상 함수들**
- `fetchSavedPlaces` — 주 대상
- `fetchAcademies` — 같은 패턴 (optional)
- `fetchEvents` — 폴링이지만 backoff 주의 — 기존 30s 간격 유지, 실패 시에만 backoff 적용
- **가장 보수적으로**: 이번 phase는 `fetchSavedPlaces` 만 리팩터, 나머지는 helper 함수로 설계하되 호출 지점은 그대로 (후속 phase에서 확장 가능)

**D-B05:** **backoff 함수는 `src/lib/sync.js` 내부 helper** — 모듈 전역 상태로 `breakers: Map<string, BreakerState>` 보관. key는 함수 이름.

### Stream A 의존성
- `push_idempotency` 테이블 이미 존재 (Phase 2 Plan 02-01에서 생성)
- Edge Function v32 이미 live — `getClaims` 경로 위에 멱등 로직 추가 배포 필요 (v33)

### Claude's Discretion
- **D-15a:** backoff jitter 정확 계산식 세부 (±20% 범위 내)
- **D-15b:** 에러 배너 정확 포지션/스타일 — 기존 design tokens 따름
- **D-15c:** `delivery_status jsonb` 의 정확한 키 이름 (`webSent` vs `web_sent` 등) — 기존 Supabase JS 컨벤션 일관

### Folded Todos
(no todos matched — 0 folded)

</decisions>

<canonical_refs>
## Canonical References

### Research inputs
- `.planning/research/SUMMARY.md` §"Phase 3" — 2-stream scope
- `.planning/research/STACK.md` §"Issue #3 — Idempotency-Key" — 구현 패턴
- `.planning/research/PITFALLS.md` §"P1-4" — 없음(저위험 phase)

### Project-level
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §Phase 3
- `CLAUDE.md` — monolith policy

### Phase 2 artifacts (prereq)
- `.planning/phases/02-unblock-core-push-gateway-realtime-pair-security/02-01-SUMMARY.md` — push-notify v32 + push_idempotency 테이블 생성됨

### Repo artifacts
- `src/App.jsx` L94-154 — `sendInstantPush` (Stream A 수정 대상)
- `src/lib/sync.js` L176-191 (`fetchSavedPlaces`) + L548-573 (polling caller) — Stream B 수정 대상
- `supabase/functions/push-notify/index.ts` — Stream A Edge Function 추가 (v33)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `crypto.randomUUID()` — Web Crypto 브라우저 표준, 이미 App.jsx 다른 곳에서 사용 중
- Phase 2 Stream A deploy 경로 — `npx supabase functions deploy push-notify --no-verify-jwt` 이미 검증됨
- `push_idempotency` 테이블 — Phase 2 Plan 02-01에서 생성 완료 (PK uuid)

### Established Patterns
- Phase 2 PUSH-01 에서 `getClaims` 인증 경로 확립 — 이번 phase는 그 위에 멱등 체크 추가
- Phase 2 Stream B 완료로 `saved_places` 404 자체는 해결됨 → RES-01 backoff는 이제 404 방어가 아닌 일반 복원력 용도

### Integration Points
- Phase 4 P1-6 (memos model unification)은 Phase 3이 완료된 `push-notify` 위에서 메모 알림을 테스트하게 됨
- Phase 5 P2-9 (kkuk + sos_events)는 Idempotency-Key 패턴을 SOS 중복 방지에 재사용

</code_context>

<specifics>
## Specific Ideas

- Idempotency-Key는 **같은 사용자 액션 1회당 1개 UUID** (재시도는 같은 UUID, 새 액션은 새 UUID). 예: 꾹 버튼 1클릭 = 1 UUID, 내부 1회 재시도는 같은 UUID로.
- `body.idempotency_key`가 헤더와 다르면 헤더 우선. (Edge Function 측 양자 일치 확인 후 대표값 사용)
- Beacon은 pagehide/beforeunload 경로에서만: 현재 `sendInstantPush`의 `new Blob([payload])` beacon 호출을 **페이지 unload 핸들러 등록 함수**로 격리. 일반 호출 경로에서는 beacon 사용 안 함.

</specifics>

<deferred>
## Deferred Ideas

- `push_idempotency` 24h TTL cron — v1.1 observability
- `fetchAcademies`, `fetchEvents`도 backoff 적용 — 이번엔 `fetchSavedPlaces`만
- Sentry/Log Drain 연동 — v2 OBS-*
- Telemetry 대시보드 (push delivery success rate, realtime latency) — v2 OBS-02

### Reviewed Todos (not folded)
(none)

</deferred>

---

*Phase: 03-client-push-fetch-hygiene*
*Context gathered: 2026-04-21 (auto mode, single-pass)*
