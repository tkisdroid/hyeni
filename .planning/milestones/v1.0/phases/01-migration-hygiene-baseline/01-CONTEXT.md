# Phase 1: Migration Hygiene & Baseline - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** `--auto` — all gray areas auto-resolved with recommended defaults, single-pass

<domain>
## Phase Boundary

프로덕션 데이터에 영향을 줄 Phase 2~5의 **전제 조건**을 세운다. REQ-ID를 직접 수정하지 않는다.

**핵심 deliverables:**
1. `supabase/migrations/down/` 디렉터리 + README(컨벤션 선언) 생성
2. 루스 `supabase/*.sql` 파일들을 `supabase/archive/_deprecated_*.sql` 로 이동
3. `supabase db diff` 로 프로덕션 ↔ `supabase/migrations/` 드리프트 보고
4. 드리프트 재조정(reconciliation) 마이그레이션 작성 + Supabase branch에서 1회 적용 — **특히 `memos` 누락 컬럼** (`created_at`, `user_id` 등 42703 재현 해결)
5. `pg_policies` 스냅샷 → `.planning/research/baselines/pg-policies-20260421.sql`
6. VAPID 공개키·FCM project_id·Supabase anon URL 메타데이터 스냅샷 → `.planning/research/baselines/env-metadata.md` (비밀키는 committable 아님)
7. 현재 `push-notify` Edge Function 배포를 `push-notify-baseline-20260421` git 태그로 고정
8. 위 reconciliation이 적용된 Supabase branch에서 `npx playwright test --config=playwright.real.config.js` 회귀 0건

</domain>

<decisions>
## Implementation Decisions

### Archive Layout
- **D-01:** 루스 `supabase/*.sql` 파일(`add-phone-columns.sql`, `add-write-policies.sql`, `child-locations.sql`, `fix-all-rls.sql`, `fix-rls*.sql`, `fix-sync-final.sql`, `parent-pairing-fix.sql`, `patch-existing-db.sql`, `push-tables.sql`, `stickers-and-geofence.sql`, `migration.sql`) 을 `supabase/archive/` 로 이동. 원본 파일명 앞에 `_deprecated_` 접두사 부여. 이동 후에도 repo에 남아있어 `grep`·`git log` 가능.
- **D-02:** `supabase/archive/README.md` 에 "이 파일들은 더 이상 적용되지 않음. 현행은 `supabase/migrations/`" 선언 + 각 파일별 한 줄 요약.

### Down Migrations
- **D-03:** `supabase/migrations/down/` 디렉터리 신규 생성. README에 컨벤션 명시: "up 파일 `YYYYMMDDHHMMSS_name.sql` 마다 `down/YYYYMMDDHHMMSS_name.sql` 에 DROP/REVOKE 스텝". 기존 up 파일들에 대한 down 작성은 **이 phase 범위 외** (향후 phase에서 필요 시 작성). 컨벤션만 세움.
- **D-04:** BEGIN/COMMIT wrap 컨벤션 README에 동일 명시: DROP POLICY + CREATE POLICY 같은 세트는 반드시 트랜잭션 내에서.

### Reconciliation Migration
- **D-05:** 파일명 `YYYYMMDDHHMMSS_reconcile_schema_drift.sql` (실제 timestamp는 작성 시점). 기존 `supabase/migrations/20260418*` 규약 따름.
- **D-06:** 내용 범위 — `supabase db diff` 결과에 따라 최소 포함 예상:
  - `memos` 테이블에 누락 컬럼 추가 (`created_at timestamptz default now()`, `user_id uuid references auth.users`, `user_role text`) — 이미 데이터가 있으므로 `NOT NULL` 금지, 기본값 `NULL`
  - 루스 SQL에만 있던 RLS/policy 중 현재 `supabase/migrations/` 에 미반영된 항목을 트래킹된 migration으로 흡수
- **D-07:** 마이그레이션은 `down/` 페어 파일도 함께 작성 (ADD COLUMN → DROP COLUMN; CREATE POLICY → DROP POLICY). BEGIN/COMMIT 래핑.

### Baselines
- **D-08:** `pg_policies` 전체 행을 프로덕션에서 `psql -c "\copy (select * from pg_policies) to '/tmp/pg-policies.csv' csv header"` 로 추출 후 `.planning/research/baselines/pg-policies-20260421.csv` 에 커밋. 별도로 `SELECT ... ORDER BY schemaname, tablename, policyname` 결과를 `.sql` 변환본도 함께.
- **D-09:** `.planning/research/baselines/env-metadata.md` — 비밀 없는 메타데이터만:
  - Supabase URL (이미 번들 JS에 공개) + anon key (이미 공개)
  - FCM `project_id`
  - VAPID `public_key` (정의상 공개)
  - **절대 포함 금지**: VAPID private key, FCM service-account JSON, Supabase service-role key
- **D-10:** Git 태그 `push-notify-baseline-20260421` 를 현재 main HEAD에 고정. `git tag -a push-notify-baseline-20260421 -m "Edge Function state before v1.0 remediation"` + `git push origin push-notify-baseline-20260421`.

### Playwright Regression Scope
- **D-11:** 회귀 smoke 경로(모두 `playwright.real.config.js` 사용):
  1. 역할 선택(부모) → Kakao OAuth 모킹 → `families` 생성 + pair_code 발급
  2. 역할 선택(아이) → 익명 로그인 → 잘못된 코드 rejection
  3. 아이 페어링 → `family_members` row 확인
  4. 부모 → 아이 꾹 → realtime overlay 도달
  5. 부모 메모 작성 → `memo_replies` INSERT → 아이 UI 반영
  6. 아이 메모 답글 → `memo_replies` INSERT → 부모 UI 반영
  7. 부모 이벤트 생성 → 아이 polling UI 에 표시
- **D-12:** 기존 specs(있다면) 보존 + D-11의 누락 경로만 신규 추가. 이 phase에서 신규로 추가된 spec은 **브랜치에서 먼저 GREEN**.

### Supabase Branch Workflow
- **D-13:** `supabase branches create phase-1-baseline` 로 브랜치 생성. 모든 D-05~D-07 마이그레이션을 branch에 push. D-11 Playwright를 branch endpoint 대상으로 실행. GREEN 확인 후 `supabase db push` 로 main 프로모션. 5분 프로덕션 Edge Function 로그 모니터링 (Supabase Dashboard → Functions → Logs).
- **D-14:** 프로모션 후 branch 삭제 (`supabase branches delete phase-1-baseline`). 모든 후속 phase는 자신의 branch로 재생성.

### Claude's Discretion
- **D-15:** reconciliation 마이그레이션의 **정확한 SQL 본문** — `supabase db diff` 출력에 따라 가변. gsd-planner + gsd-executor 가 실행 시점에 결정.
- **D-16:** D-11 Playwright specs의 **정확한 selector/locator 전략** — 기존 tests/ 디렉토리 관례에 맞춰 executor 판단.
- **D-17:** `supabase/archive/` 내부 하위 디렉토리 구조(카테고리별 분류 여부) — executor가 파일 수와 자연스러운 grouping 판단.

### Folded Todos
(no todos matched Phase 1 via `gsd-sdk query todo.match-phase 1` — count: 0)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level context
- `.planning/PROJECT.md` — Core value + constraints (live prod data; monolith decomposition forbidden; Supabase branch mandatory)
- `.planning/REQUIREMENTS.md` — 28 REQ-IDs (Phase 1 has 0 REQs; this phase unblocks all others)
- `.planning/ROADMAP.md` §Phase 1 — Success criteria + non-negotiable exit gates
- `.planning/STATE.md` — Current progress + cross-phase metrics

### Research inputs
- `.planning/research/SUMMARY.md` §"Implications for Roadmap" §Pre-Phase 0 — **Primary spec for this phase.** Deliverables list is mapped 1:1 from this section.
- `.planning/research/PITFALLS.md` §Repo-wide pre-condition — Explains WHY this phase exists (two-SQL-dirs drift + missing down/ + no BEGIN/COMMIT wrapping)
- `.planning/research/ARCHITECTURE.md` §Supabase branch → main workflow — 7-step promotion spec applies to D-13
- `.planning/research/STACK.md` — Referenced later; Phase 1 does not touch stack decisions

### Repo artifacts to inspect
- `supabase/config.toml` — Current Supabase config (verify branch support enabled)
- `supabase/migrations/*.sql` — Tracked migrations; compare against prod via `supabase db diff`
- `supabase/*.sql` (loose) — 11 files scheduled for archival (D-01)
- `playwright.real.config.js` — Real-services Playwright config used by D-11
- `tests/` — Existing E2E specs; preserve + extend

### External
- [Supabase Branches docs](https://supabase.com/docs/guides/deployment/branching) — D-13 workflow basis
- [Supabase db diff command](https://supabase.com/docs/reference/cli/supabase-db-diff) — D-05 generation
- No new external specs — Phase 1 is DevOps hygiene

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `playwright.real.config.js` — Real-services config already exists; extend with new specs (D-11), no new config needed.
- `supabase/config.toml` — Already configured; verify branches feature is enabled (default true in CLI ≥1.200).
- `git` tags — Standard workflow, no tooling work needed for D-10.

### Established Patterns
- `supabase/migrations/YYYYMMDDHHMMSS_name.sql` timestamp naming (e.g., `20260418000000_family_subscription.sql`). D-05 reconciliation follows same pattern.
- RLS policies declared in migration files (not dashboard) for audit (see `20260418000005_subscription_rls.sql`).
- Loose `supabase/*.sql` files (`fix-rls.sql`, `fix-sync-final.sql`, etc.) predate migration discipline — archiving them closes the drift gap.

### Integration Points
- `package.json` scripts: `"verify": "npm run test && npm run test:e2e"` currently uses default Playwright config. D-11 tests use `--config=playwright.real.config.js` (called out of band, not via `verify`).
- No CI wiring assumed. Phase 1 runs locally + against Supabase branch.

</code_context>

<specifics>
## Specific Ideas

- **No data deletion during archive** (D-01): file移動, not `git rm`. If future phases discover a reference to archived SQL, the file is still accessible.
- **Reconciliation migration must be idempotent-equivalent** on branch: running twice shouldn't break. Use `ADD COLUMN IF NOT EXISTS`, `CREATE POLICY IF NOT EXISTS` where Postgres supports it; otherwise `DO $$ BEGIN ... EXCEPTION ... END $$` wrappers.
- **D-11 spec must NOT mutate shared live state** when pointed at real Supabase. Use ephemeral test users per run (cleanup via `afterAll` hook against branch-scoped `service_role` key).

</specifics>

<deferred>
## Deferred Ideas

- **Backfill down/ files for all existing up migrations** — out of scope for Phase 1 (only the reconciliation migration in D-07 gets its down file). Down files for legacy migrations can be added as needed when specific rollbacks become necessary.
- **Supabase CLI version upgrade** — if `supabase db diff` is unavailable or buggy on current version, bump in a future phase. Do not block Phase 1 on tooling upgrades.
- **Automated schema-drift CI check** — nice-to-have, belongs in v2 OBS-* milestone. Phase 1 catches drift manually once.
- **Rotating VAPID keys** — explicitly out of scope (SUMMARY.md §Stack: "Do NOT rotate VAPID keys during redeploy"). Baseline snapshot (D-09) captures the current VAPID public key for future reference only.
- **Sub-team permission split between "deploy migrations" and "deploy Edge Function"** — operational, not code.

### Reviewed Todos (not folded)
(none — no todos matched Phase 1)

</deferred>

---

*Phase: 01-migration-hygiene-baseline*
*Context gathered: 2026-04-21 (auto mode, single-pass)*
