# Phase 4: Memo Model Unification - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** `--auto` single-pass (decisions from SUMMARY.md §Phase 4 + STACK.md §MEMO-01)

<domain>
## Phase Boundary

이원화된 `memos` + `memo_replies` 데이터 모델을 **`memo_replies` 중심으로 통합**하되, **shadow-running DoD**. Legacy `memos` DROP은 v1.1로 예약 — 이번엔 절대 DROP 금지.

**범위:**
- SQL: `memos` → `memo_replies` 마이그레이션 + `origin` 컬럼 + `memos_legacy_20260421` 스냅샷 + `memos` VIEW 재정의
- 클라이언트: `sync.js` 메모 함수 5개 + `App.jsx` 7개 site 수정 (SUMMARY.md §Phase 4 surface map)
- 읽음: 뷰포트 3초 노출 기반 수동 업데이트 (auto-read-on-receipt 제거)

</domain>

<decisions>
## Implementation Decisions

**D-01: 섀도우-런닝 DoD** — Phase 4 완료 = 새 통합 경로 live + `memos_legacy_20260421` 스냅샷 + `memos` VIEW retained 30일. **DROP은 안 함**. v1.1 MEMO-CLEANUP-01 으로 예약.

**D-02: 스키마 변경** — MCP apply_migration:
```sql
BEGIN;
-- 1. 스냅샷 (rollback anchor)
CREATE TABLE IF NOT EXISTS public.memos_legacy_20260421 AS
  SELECT * FROM public.memos;
ALTER TABLE public.memos_legacy_20260421 ADD CONSTRAINT memos_legacy_20260421_pk PRIMARY KEY (id);

-- 2. memo_replies에 origin 컬럼 추가
ALTER TABLE public.memo_replies
  ADD COLUMN IF NOT EXISTS origin text DEFAULT 'reply';
-- 값: 'reply' (기본, 기존), 'original' (레거시에서 이관된 최초 메모), 'legacy_memo' (구 memos 행)

-- 3. 이관: 구 memos 의 content가 non-empty + non-emoji 인 행을 memo_replies로 복제
INSERT INTO public.memo_replies (family_id, date_key, user_id, user_role, content, origin, created_at)
  SELECT 
    family_id, date_key, 
    NULL::uuid AS user_id,        -- legacy rows have no sender attribution
    'legacy'::text AS user_role,  -- marker
    content,
    'legacy_memo'::text AS origin,
    updated_at AS created_at
  FROM public.memos
  WHERE content IS NOT NULL 
    AND length(trim(content)) > 1  -- skip pure emoji like "💬"
    AND NOT EXISTS (
      SELECT 1 FROM public.memo_replies mr
      WHERE mr.family_id = memos.family_id
        AND mr.date_key = memos.date_key
        AND mr.origin = 'legacy_memo'  -- idempotent: 중복 이관 방지
    );

-- 4. memos를 VIEW로 전환 (읽기 호환성 유지 for 30일)
--    단, 기존 TABLE memos를 DROP하면 RLS/policies 증발. 대신 이름 바꾸기:
--    (a) 기존 memos 테이블은 그대로 두고 (읽기 쓰기 모두 작동)
--    (b) 신규 쓰기 경로는 memo_replies 로만 함 (클라이언트 레벨 스위치)
--    이렇게 하면 DROP 없이 전환 완료. VIEW 전환은 v1.1로.
-- 결론: SQL에서는 origin 컬럼 추가 + 스냅샷 + 이관만. memos TABLE은 그대로 유지.

COMMIT;
```
Down: `DROP TABLE IF EXISTS public.memos_legacy_20260421; ALTER TABLE public.memo_replies DROP COLUMN IF EXISTS origin; DELETE FROM memo_replies WHERE origin = 'legacy_memo';`

**D-03: `memos` TABLE은 유지** (VIEW 전환 안 함) — 이유: VIEW로 전환하면 기존 insert/update/delete RLS policy 적용이 복잡. 대신 클라이언트가 **신규 쓰기를 memo_replies로만** 보내도록 하면 memos 테이블은 점차 legacy-only가 됨. v1.1에서 memos 읽기 호출을 모두 제거한 뒤 DROP.

**D-04: 읽음(read) 3초 뷰포트 관측** (MEMO-02)
- `IntersectionObserver`로 memo_replies item이 뷰포트에 3초 노출되면 server-side update
- 구현: `src/App.jsx` 의 memo display 루프에 observer 추가
- 서버: `memo_replies.read_by jsonb` 컬럼 추가 (이미 memos에 있는 패턴 재사용) — migration에 ADD COLUMN
- 기존 `memos.read_by` 의 auto-mark 코드 **제거** — memo 수신 시점에 read_by를 추가하던 모든 코드 삭제

**D-05: 발신자 식별 (MEMO-03)** — `memo_replies` 는 이미 `user_id` + `user_role` 보유. Phase 1의 `memos` 컬럼 추가는 신규 시나리오 없음(D-03으로 memos 쓰기 경로 폐쇄)이라 사실상 사용 안 함. **기존 `memo_replies`의 데이터 무결성 확인만**.

**D-06: 클라이언트 변경 영역** (SUMMARY.md §Phase 4 surface map 14 regions)
- `src/lib/sync.js`:
  - `fetchMemos` → `fetchMemoReplies` 로 treat (origin='legacy_memo' 도 포함해 반환)
  - `sendMemo` → `memo_replies` 로만 INSERT (기존 memos 업데이트 경로 제거)
  - `markMemoRead` → `memo_replies.read_by` 업데이트 (memos 경로 제거)
- `src/App.jsx`:
  - memo display (L3888-3890 등): `memo_replies` 결과 표시, origin='legacy_memo'인 경우 "👶 예전 메모" 같은 라벨
  - memo send (L4011-4031, L4043-4062): memo_replies만 INSERT
  - memo_replies subscription 처리: 이미 Phase 2 RT-03에서 채널 있음
  - IntersectionObserver 추가 (MEMO-02): memo items 에 ref + 3초 타이머

### Claude's Discretion
- `legacy_memo` origin 라벨 문구 ("👶 예전 메모" vs "💬 기록")
- IntersectionObserver threshold/timeout 상수 — 기본 3초
- `memos`읽기 경로 완전 제거 vs 유지 — 이번엔 **유지** (VIEW 전환 안 함 → 기존 `fetchMemos` 호출 살려두되 새 UI는 `fetchMemoReplies` 기반)

</decisions>

<canonical_refs>
- `.planning/research/SUMMARY.md` §"Phase 4: Memo Model Unification"
- `.planning/research/STACK.md` §"MEMO-01" (shadow + origin column 패턴)
- `.planning/research/PITFALLS.md` §"P1-6" (42703 대비 안 했는데 Phase 1에서 선제 처리됨; NULL user_id legacy 보존; DROP 금지 two-phase)
- `.planning/phases/01-migration-hygiene-baseline/01-03-SUMMARY.md` — memos 컬럼 (created_at/user_id/user_role) 이미 prod에 존재
- `src/lib/sync.js` — fetchMemos, sendMemo, markMemoRead 수정 대상
- `src/App.jsx` L1954-2078 + L3888-3890 + L4011-4031 + L4043-4062 + L4433-4447 + L4493-4501 + L6341-6381 (surface map per SUMMARY.md)
- Phase 2 Plan 02-02: memo_replies realtime publication 활성화됨
</canonical_refs>

<deferred>
- `memos` TABLE DROP → v1.1 MEMO-CLEANUP-01
- VIEW 전환 → 같은 v1.1 작업
- 전체 memos 행의 user_id 백필(현재 NULL) — 안전하게 할 방법 없음, skip
- Per-memo reaction/emoji — 별개 기능, scope 외
</deferred>

---

*Phase: 04-memo-model-unification*
*Context gathered: 2026-04-21*
