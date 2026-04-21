# Phase 2: Unblock Core (Push Gateway · Realtime · Pair Security) - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** `--auto` — all decisions auto-resolved from research (SUMMARY.md, STACK.md, PITFALLS.md) which already prescribed specific library/config choices per REQ-ID. Single-pass.

<domain>
## Phase Boundary

모든 후속 phase (3, 4, 5)를 가로막는 **세 gateway**를 세 개의 disjoint한 스트림으로 동시에 뚫는다:

- **Stream A (P0-1)** — `supabase/functions/push-notify/index.ts` ES256 JWT 검증 실패(v30 회귀)를 수정 → PUSH-01
- **Stream B (P0-2)** — `saved_places`·`family_subscription` realtime publication 등록 + REPLICA IDENTITY FULL + per-table channel 패턴 → RT-01, RT-02, RT-03, RT-04
- **Stream C (P0-3)** — `pair_code` TTL/회전 + 단일 아이 INSERT guard + 아이 self-DELETE 차단 + 좀비 정리 → PAIR-01, PAIR-02, PAIR-03, PAIR-04

Parallelizable: 세 스트림은 **file overlap 0** (Edge Function TS / SQL publications / SQL RLS + client pair UI). 같은 날 동시 진행 가능.

**핵심 보너스 발견** (Phase 1 Edge Function 로그 분석): push-notify v29는 POST 200 정상 → v30 배포에서 ES256 회귀. 즉 Stream A는 "auth 게이트웨이 구조 버그"가 아니라 **단순 배포 회귀** — `getClaims(jwt)` 패턴으로 코드만 수정해 v31 재배포하면 복구.

</domain>

<decisions>
## Implementation Decisions

### Stream A — PUSH-01: push-notify ES256 Fix

**D-A01:** **`supabase.auth.getClaims(jwt)` 패턴 사용** (SUMMARY.md §Stack). `@supabase/supabase-js@2.99.1`에 이미 포함 — **새 deps 0**. 의존 버전 bump 금지.
  - 내부 동작: ES256 + JWKS + kid rotation + Web Crypto 전부 transparent
  - 인증된 호출만 처리, 무인증 호출은 401 유지

**D-A02:** Edge Function deploy 시 `--no-verify-jwt` 플래그 **유지** (SUMMARY.md §Stack D-A01 cascade). Supabase 게이트웨이의 ES256 검증 버그(supabase#42244/#41691) 우회. 대신 함수 바디에서 `getClaims`로 검증.

**D-A03:** **VAPID 키 rotation 금지** (PITFALLS.md). 현재 `push_subscriptions` 테이블에 1건의 Apple Web Push subscription 등록되어 있으며(Phase 1 pg-policies 스냅샷 생성 시 확인), VAPID 키 회전 시 RFC 8292 §2.3에 따라 403으로 무효화됨. Phase 1 `.planning/research/baselines/env-metadata.md`에 VAPID public key 스냅샷 보존됨.

**D-A04:** **FCM v1 service-account JWT 경로 유지**. 현 구현 (`push-notify/index.ts:182` 영역)이 Firebase 공식 권장 패턴. Legacy FCM API 대체 없음.

**D-A05:** **`push_idempotency` dedup 테이블 신설** (Phase 3에서도 사용될 기반)
  - 스키마: `CREATE TABLE public.push_idempotency (key uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())`
  - TTL: 24시간 (Edge Function 시작 시점 또는 별도 cron)
  - unique violation INSERT = duplicate 감지
  - Phase 2 범위에선 테이블만 생성하고 미사용(Phase 3 PUSH-02가 실제 사용)

**D-A06:** **client-side 코드 수정 금지** (Phase 2 boundary). `src/App.jsx` 의 `sendInstantPush` 는 Phase 3 P1-4 범위. Phase 2 Stream A는 서버 측만.

**D-A07:** 배포 전략 — Edge Function redeploy는 atomic. Supabase는 blue/green 없음. v31 = 새 배포. 이전 v29/v30 로그 보존됨 (MCP get_logs로 검증 가능).

### Stream B — RT-01..04: Realtime Publications

**D-B01:** **4-step publication 활성화** (PITFALLS.md §P0-2):
  1. `ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_places, public.family_subscription;`
  2. `ALTER TABLE public.saved_places REPLICA IDENTITY FULL;` + `ALTER TABLE public.family_subscription REPLICA IDENTITY FULL;`
  3. `NOTIFY pgrst, 'reload schema';`
  4. 기존 realtime WebSocket 클라이언트 강제 재연결 (client bump `realtimeSchemaVersion` global)

**D-B02:** **per-table channel 패턴** (STACK.md §Issue #2):
  - 한 채널에 여러 binding 모으지 말 것 (supabase-js#1917, #1473)
  - 기존 채널 이름: `family-{familyId}` (events + memos + academies + saved_places 섞여 있음) → Phase 2 Stream B에서 **분리**:
    - `events-{familyId}`, `memos-{familyId}`, `memo_replies-{familyId}`, `saved_places-{familyId}`, `family_subscription-{familyId}` — 각 테이블당 독립 채널
    - 기존 broadcast 채널 `family-{familyId}` 는 broadcast-only로 **유지** (꾹/remote_listen 등)
  - 구현: `src/lib/sync.js` `subscribeToFamily` 분해 — Phase 2 Stream B 의 client 범위

**D-B03:** **`family_subscription` 테이블 존재 여부 확인 필수** (migration `20260418000000_family_subscription.sql`이 로컬에 있지만 프로덕션 적용 여부 불확실 — Phase 1 list_migrations에 보이지 않음). Stream B 실행 시 먼저 `list_tables` + `list_migrations` 확인 → 없으면 migration apply, 있으면 publication만 ADD.

**D-B04:** **`saved_places` 마찬가지** — migration `20260418000006_saved_places.sql` 프로덕션 적용 여부 확인 선행.

**D-B05:** **`memo_replies` 도 realtime publication에 포함** (SUMMARY.md §Gaps: "`memo_replies` has no explicit ADD found — likely added via dashboard"). Stream B 에서 동시에 ADD. 중복 시 Postgres가 실패 → 확인 쿼리 먼저.

**D-B06:** **클라이언트 broadcast events 이름 유지** (`kkuk`, `remote_listen_start`, `remote_listen_stop`, `audio_chunk`, `arrival`). Phase 2 Stream B는 postgres_changes 경로만 수정.

### Stream C — PAIR-01..04: Pair Code Security

**D-C01:** **`pair_code_expires_at timestamptz` 컬럼을 `families` 테이블에 NULLABLE 추가** (STACK.md §Issue #3 — nullable guarantees existing codes grandfathered)
  - 기존 row (live family `4c781fb7-…` + 기타)는 `expires_at = NULL` = 무기한 유효 (grandfathered)
  - **신규 발급은 48시간 TTL** — 발급 시 `expires_at = now() + interval '48 hours'`
  - CHECK 제약 금지 (STACK.md §Issue #3) — 함수 body 에서만 TTL 체크

**D-C02:** **`join_family` RPC 업데이트** — 기존 RPC는 `supabase/migrations/20260315152758_fix_memo_rls_for_child.sql` 또는 `supabase/archive/_deprecated_fix-sync-final.sql` 계열에 정의됨. 현 프로덕션 RPC 정의를 `list_migrations` + `execute_sql(pg_get_functiondef)` 로 복원한 뒤 업데이트:
  - TTL 체크: `IF p.pair_code_expires_at IS NOT NULL AND p.pair_code_expires_at < now() THEN RAISE EXCEPTION '만료된 연동 코드예요. 부모님께 새 코드를 받아 주세요'; END IF;`
  - 기존 rate limit (10회/시간) 유지

**D-C03:** **`families.pair_code` 회전 함수 추가** — `regenerate_pair_code(family_uuid uuid)` RPC:
  - 부모 role만 호출 가능 (RLS + `SECURITY DEFINER`)
  - 새 pair_code 생성 + `pair_code_expires_at = now() + interval '48 hours'` 설정
  - 부모 UI 버튼에 연결 (`src/App.jsx` `PairingModal` 확장 — 작은 범위 touch)

**D-C04:** **부모 UI TTL 카운트다운** — `src/App.jsx` 의 `PairingModal` 에 `expires_at` 표시 + "새로고침" 버튼 (→ D-C03 호출). 범위 최소화: 기존 섹션 내에 추가.

**D-C05:** **아이 self-DELETE 차단 RLS 정책** — `family_members` 테이블:
  ```sql
  DROP POLICY IF EXISTS fm_del ON public.family_members;
  CREATE POLICY fm_del ON public.family_members
    FOR DELETE TO authenticated
    USING (
      -- 부모만 삭제 가능 (아이 role row든 부모 role row든 불문)
      EXISTS (
        SELECT 1 FROM public.family_members me
        WHERE me.family_id = family_members.family_id
          AND me.user_id = auth.uid()
          AND me.role = 'parent'
      )
    );
  ```
  - BEGIN/COMMIT 으로 래핑 (Phase 1 D-04 convention)
  - **아이가 자기 row DELETE 시도 → 403** — Phase 1에서 실측된 자가 탈퇴 경로 차단
  - 부모가 아이 row DELETE = 가능 (unpair 기능 유지)

**D-C06:** **단일 "아이" 슬롯 semantic guard** — 기존 가족에 이미 `이름='아이'` row가 다수 존재 (live family 4명). 기존 row는 제거 안 함 (grandfathered). 신규 INSERT 만 제약:
  - `join_family` RPC 내부에서, 신규 anon 세션이 페어링할 때: 가족에 이미 `role='child' AND name='아이'` row가 **1개 이상** 존재하면 덮어쓰기 대신 **오류 or 추가 생성 선택** 옵션 → 이번 phase 기본값: **기존 '아이' 이름 row의 user_id를 새 anon user_id로 update** (현행 `ON CONFLICT DO UPDATE` 유지하되, **새 row를 추가하지 않음**). 
  - 실무적 효과: 코드 공유 받은 새 아이 기기가 기존 "아이" slot을 이어받음 (기기 교체 시나리오 보존)
  - PAIR-02 원 요구사항 "복수 '아이' row가 허용되더라도, 부모의 명시적 '아이 추가' 액션 없이 신규 익명 세션이 기존 slot을 덮어쓰지 않는다" → 재해석: **이름 기반 slot 스쿼팅 방지**. 기존 specific user_id들(실제 페어링된 기기)은 보존, 새 anon 세션은 slot 이어받기 경로만.
  - **대안 (더 엄격)**: 기본 이름 `"아이"` 로 매칭되는 row가 있으면 신규 anon 은 **"아이 2"** 로 이름 차별화 후 INSERT. 가족 구성에 따라 부모가 UI에서 rename 가능. 이번 phase 에선 이 대안을 채택:
    - join_family RPC: INSERT 시 `name`이 이미 같은 가족에 있으면 `name || ' 2'`, `name || ' 3'` 순으로 suffix

**D-C07:** **좀비 아이 정리 부모 UI** (PAIR-04) — 부모 UI에 `family_members` 목록 + "아이 해제" 버튼 (이미 `unpairChild` auth.js 함수 존재). 범위 최소화: `src/App.jsx` 기존 부모 settings 섹션에 목록 노출 + 기존 함수 재사용.

### Claude's Discretion (세부 구현은 executor 판단)

**D-15a:** `getClaims` 함수 내부 사용 지점의 정확한 코드 — 현재 `push-notify/index.ts` 구조 보존, auth 체크 블록만 교체
**D-15b:** Realtime publication migration 파일명 — `YYYYMMDDHHMMSS_enable_realtime_publications.sql` 규약
**D-15c:** Pair TTL UI 카운트다운의 시각 디자인 — 기존 PairingModal 스타일 유지, minimal 변경
**D-15d:** 좀비 정리 UI 의 배치/스타일 — 기존 부모 settings 섹션과 일관성

### Folded Todos
(no todos matched Phase 2 via todo.match-phase — 0 folded)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research inputs (primary spec)
- `.planning/research/SUMMARY.md` §"Phase 2: Unblock Core" — 4-stream structure + exit criteria
- `.planning/research/STACK.md` §"Issue #1 — push-notify Edge Function: ES256 JWT" — `getClaims` 권장
- `.planning/research/STACK.md` §"Issue #2 — Realtime Rejection" — 4-step publication + per-table channels
- `.planning/research/STACK.md` §"Issue #3 — Idempotency" (Phase 3에서 사용, Phase 2 테이블만 생성)
- `.planning/research/PITFALLS.md` §"P0-1 (push-notify ES256)" — gateway vs function body, VAPID mismatch, FCM private key scrubbing
- `.planning/research/PITFALLS.md` §"P0-2 (Realtime publications)" — REPLICA IDENTITY FULL 필수, NOTIFY pgrst, client reconnect
- `.planning/research/PITFALLS.md` §"P0-3 (Pair code + RLS)" — DROP+CREATE POLICY 트랜잭션 래핑, CHECK 제약 금지, snapshot pg_policies

### Project-level
- `.planning/PROJECT.md` — Core value + constraints (live prod data; monolith decomposition forbidden; Supabase MCP path approved)
- `.planning/REQUIREMENTS.md` §"v1 Requirements" — Phase 2 매핑: PUSH-01 + RT-01..04 + PAIR-01..04
- `.planning/ROADMAP.md` §"Phase 2: Unblock Core" — 3 streams + 5 exit criteria
- `CLAUDE.md` — Project instructions (live prod data, monolith policy, `npx supabase`, `.env.local`)

### Phase 1 artifacts (prerequisites)
- `.planning/phases/01-migration-hygiene-baseline/01-VERIFICATION.md` — Phase 1 이 완료됐음을 확인
- `.planning/research/baselines/pg-policies-20260421.csv` — RLS 정책 rollback 앵커
- `.planning/research/baselines/env-metadata.md` — VAPID public key + FCM project_id 스냅샷
- git tag `push-notify-baseline-20260421` (origin 등록) — Edge Function v30 rollback 포인트
- `supabase/migrations/20260421074417_reconcile_schema_drift.sql` — memos 컬럼 추가 (이미 prod 적용)

### Repo artifacts to read
- `supabase/functions/push-notify/index.ts` — **Stream A 수정 대상** (~400줄)
- `supabase/migrations/20260418000000_family_subscription.sql` — Stream B prereq (apply 여부 확인)
- `supabase/migrations/20260418000006_saved_places.sql` — Stream B prereq
- `supabase/migrations/20260315152655_memo_replies_setup.sql` — memo_replies 스키마 레퍼런스
- `supabase/archive/_deprecated_fix-sync-final.sql` — `join_family` RPC 현 정의 (archived; Stream C 복원용)
- `src/lib/auth.js` — `joinFamily`, `setupFamily`, `unpairChild` (Stream C 연결)
- `src/lib/sync.js` — `subscribeToFamily` (Stream B 채널 분리 대상)
- `src/App.jsx` (~6877줄) — PairingModal (~920-1012), ChildPairInput (~1148-1215), 부모 settings section — **최소 범위만 touch**

### External
- [Supabase Auth getClaims pattern](https://supabase.com/docs/guides/functions/auth)
- [Supabase JWT Signing Keys (2025-07-14)](https://supabase.com/blog/jwt-signing-keys)
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [supabase/supabase#42244](https://github.com/supabase/supabase/issues/42244) (ES256 after rotation)
- [supabase-js#1917](https://github.com/supabase/supabase-js/issues/1917) (CHANNEL_ERROR multi-binding)
- [RFC 8292 — VAPID](https://datatracker.ietf.org/doc/html/rfc8292)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@supabase/supabase-js@2.99.1` — ES256-aware `getClaims()` 이미 bundled. 새 npm install 0건.
- `supabase/functions/push-notify/index.ts` — 400줄, fetchFCMToken/sendFcm/sendWebPush 헬퍼 이미 존재. Auth 블록만 교체.
- Phase 1 `.env.local` — SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD 세팅됨 (session-scoped). `supabase functions deploy` 가능.
- `npx supabase` (devDep 2.93.0) — Edge Function deploy 가능.
- MCP `apply_migration` / `execute_sql` / `list_migrations` — Phase 1에서 검증됨. 동일 경로 재사용.

### Established Patterns
- Phase 1 D-04 convention: BEGIN/COMMIT 트랜잭션 래핑 + up/down pair
- Phase 1 D-06 convention: ADD COLUMN은 NULLABLE 기본, CHECK 제약 지양
- Phase 1 pg_policies snapshot → `.planning/research/baselines/pg-policies-20260421.csv` 가 Phase 2 RLS 변경 전 rollback 기준점

### Integration Points
- Phase 2 Stream A 완료 시 → Phase 3 P1-4 (sendInstantPush idempotency) 활성화 가능 (push_idempotency 테이블 이미 준비됨)
- Phase 2 Stream B 완료 시 → 클라이언트 realtime 채널이 신뢰성 있는 postgres_changes 수신 시작 → Phase 3 P1-5 fetchSavedPlaces 백오프 가시적 효과
- Phase 2 Stream C 완료 시 → 이후 phase들에서 child session 기반 테스트의 RLS 침해 경로 닫힘

</code_context>

<specifics>
## Specific Ideas

- **push-notify v29 → v30 회귀 증거**: Phase 1 Edge Function 로그에서 v29가 POST 200 정상, v30은 401. v31 배포 후 로그에서 POST 200 재출현이 Stream A 성공 시그널.
- **Realtime 재연결 스트래터지**: Stream B migration apply 후 기존 WebSocket 클라이언트는 SUBSCRIBE TO CHANNEL을 재발행해야 새 publication을 받음. `sync.js`의 `subscribeToFamily` 안에 `schema_version_bump` 감지 → 재구독 로직 추가 (또는 단순히 클라이언트 재로드 안내 — 이번 phase는 후자 선택).
- **아이 self-unpair RLS fix 전 기존 좀비 4명 처리**: Phase 2 Stream C 실행 전, PAIR-04 UI가 작동하기 전까지는 기존 "아이" 3명 + 제 테스트 세션 1명 (이미 self-DELETE 됨) 잔존. 부모 UI에 가족원 목록이 이번 phase로 나오므로 첫 프로덕션 노출 전에 `execute_sql` 로 수동 정리 가능 (executor 판단).
- **`join_family` RPC의 기존 정의**는 archive에 있는 `fix-sync-final.sql` 을 레퍼런스로 참고하되, 현 프로덕션 정의는 `execute_sql('SELECT pg_get_functiondef(''public.join_family''::regprocedure)')` 로 추출 후 비교 (드리프트 재발 방지).

</specifics>

<deferred>
## Deferred Ideas

- **`push_idempotency` TTL cron job** — 24h 이상 된 row 정리. Phase 2에서 테이블 스키마만 생성, cron은 Phase 3 P1-4 scope 또는 v2 observability.
- **Per-child rename UI** (D-C06 suffix `"아이 2"` 자동 생성 이후 부모가 `"수지"` 등으로 rename) — `src/App.jsx` 의 settings section 확장. 이번 phase 범위 외.
- **Edge Function blue/green** — Supabase 미지원. 모니터링/즉시 롤백 전략은 v2 observability.
- **`push-notify` Body-trusted senderUserId 해결** (PITFALLS P2-9 cross-ref: "push-notify body-trusted senderUserId is exploitable") — getClaims 로 인증된 JWT의 `sub` claim 으로 대체. **이건 Stream A 스코프 안에 포함** (D-A01 cascade).
- **Realtime subscription version mismatch fallback** — 클라이언트가 server-side publication 변경을 실시간으로 감지하는 메커니즘. 복잡도 대비 ROI 낮음, Phase 4/5 memo-unification 시 재검토.

### Reviewed Todos (not folded)
(none — todo 매칭 0건)

</deferred>

---

*Phase: 02-unblock-core-push-gateway-realtime-pair-security*
*Context gathered: 2026-04-21 (auto mode, single-pass, all decisions sourced from research outputs)*
