# sync.js → SECURITY DEFINER RPC Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-call client-side dance in `saveEventWithChildren` (events upsert → events_children delete → events_children insert + snapshot/rollback) with a single transactional Postgres function so the database owns atomicity. Eliminates santa-loop e9afa89 critical #3 (rollback's stale `priorEventRow` upsert overwriting concurrent edits).

**Architecture:** A new `public.save_event_with_children(p_event jsonb, p_child_ids uuid[], p_family_all boolean, p_expected_updated_at timestamptz DEFAULT NULL)` Postgres function. `LANGUAGE plpgsql` with `SECURITY INVOKER` (default) so the caller's RLS still applies — this preserves the existing ev_ins/ev_upd/events_children_modify_parent policies as the single source of truth for authorization. The function executes as a single transaction, so partial failure rolls back automatically; the client no longer needs the snapshot/rollback bookkeeping.

**Optimistic concurrency:** the optional `p_expected_updated_at` parameter implements stale-write detection. When non-null on an edit path, the function `SELECT ... FOR UPDATE` locks the row, compares `updated_at`, and `RAISE EXCEPTION` with `SQLSTATE '40001'` (serialization_failure) on mismatch — so a client editing a row whose state has moved on receives an explicit conflict instead of silently overwriting. When null (e.g., the add path, or callers not yet wired) the check is skipped and behavior is plain last-write-wins atomicity. Today's two callers in `App.jsx` (lines 4057, 4313) are both add-path; this plan installs the RPC infrastructure for OC and threads `expected` from the client as `event.updatedAt ?? null`, but practical use awaits a follow-up that migrates the `updateEvent` edit path through `saveEventWithChildren`.

**Tech Stack:** PostgreSQL/Supabase, React 19 + Vite 7 client, Vitest 4 integration test. Same project as OAuth linking work; deployment via `npx supabase db push --linked` (already linked).

---

## File Structure

- Create `supabase/migrations/20260515000002_save_event_with_children_rpc.sql`: defines `public.save_event_with_children(jsonb, uuid[], boolean) RETURNS public.events`. SECURITY INVOKER, plpgsql, single transaction.
- Create `supabase/migrations/down/20260515000002_save_event_with_children_rpc.sql`: drops the function.
- Modify `src/lib/sync.js` `saveEventWithChildren` (lines 1160–1297): rewrite to a single `supabase.rpc("save_event_with_children", { ... })` call. Delete the snapshot read, snapshotFailed flag, isNewRow derivation, both rollback branches, and the TODO comment that this migration resolves.
- Modify `tests/integration/multichild-event-save.test.js`: replace the supabase.from() chain mock with a `supabase.rpc(...)` mock and verify the RPC is invoked with the correct payload for both single-child and family-all cases. Add a failure case that confirms the client surfaces the RPC error (no client-side rollback to test anymore).
- Touch `docs/superpowers/verifications/2026-05-15-sync-rpc-verification.md`: manual smoke + concurrent-edit race test checklist.

---

## Open Production Settings (코드 외부)

- 추가 secret 없음. `SUPABASE_ACCESS_TOKEN` 은 `.env.local` 에 이미 있음 (OAuth deploy 때 set).
- Dashboard 토글 없음 — RPC만 추가.
- Deploy: `npx supabase db push --linked` 하나로 끝.

---

### Task 1: Verify events column list from production schema

**Files:**
- (no commit) — pre-flight verification

- [ ] **Step 1: Confirm the column list we'll use in the RPC matches production**

The RPC's UPSERT `ON CONFLICT (id) DO UPDATE SET ...` needs the exact column list from `public.events`. The client (sync.js `eventToRow`) currently writes these columns:
`id, family_id, date_key, title, time, category, emoji, color, bg, memo, location, notif_override, end_time, created_by` + `is_family_event` (added in saveEventWithChildren). Plus `updated_at` should be set to `now()` on every update.

Run in Dashboard → SQL Editor:

```sql
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='events'
 ORDER BY ordinal_position;
```

- [ ] **Step 2: Record the column list in this plan**

Append a comment in Task 2's SQL `ON CONFLICT DO UPDATE SET` block with the verified column list. If any column exists in `public.events` that the client does not currently write (e.g., a future `priority` column), include it in `<col> = COALESCE(EXCLUDED.<col>, public.events.<col>)` form so a partial payload from the client doesn't accidentally null it. If a column the client writes does not exist in production, STOP and surface to the human — schema/client drift.

- [ ] **Step 3: Confirm RLS policy names**

Run in Dashboard → SQL Editor:

```sql
SELECT policyname, cmd
  FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('events','events_children')
 ORDER BY tablename, cmd;
```

Expected policies (per `supabase/migrations/20260429120000_coparent_permissions.sql` and `20260429000005_multichild_m5_rls_policies.sql`):
- `events`: `ev_ins` (INSERT), `ev_upd` (UPDATE), `ev_del` (DELETE), plus existing SELECT.
- `events_children`: `events_children_select_family` (SELECT), `events_children_modify_parent` (ALL).

If any are missing/renamed, surface — the RPC's SECURITY INVOKER mode depends on these policies still being authoritative.

No commit at this step; findings inform Task 2.

---

### Task 2: DB migration — save_event_with_children RPC

**Files:**
- Create: `supabase/migrations/20260515000002_save_event_with_children_rpc.sql`
- Create: `supabase/migrations/down/20260515000002_save_event_with_children_rpc.sql`

- [ ] **Step 1: Write the up migration**

Use this skeleton (replace the `-- VERIFIED COLUMN LIST` block with the columns confirmed in Task 1):

```sql
-- Atomic write of an event row + its events_children M:N links.
-- Replaces the 3-call client dance (events upsert → events_children delete →
-- events_children insert) that produced data-loss windows when a rollback
-- needed to upsert a stale priorEventRow snapshot (see santa-loop e9afa89 #3).
--
-- LANGUAGE plpgsql + SECURITY INVOKER (default) — the caller's RLS continues
-- to authorize each statement, so ev_ins / ev_upd / events_children_modify_parent
-- remain the single source of truth for who can write what.

BEGIN;

CREATE OR REPLACE FUNCTION public.save_event_with_children(
  p_event jsonb,
  p_child_ids uuid[],
  p_family_all boolean,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.events
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_saved public.events;
  v_event_id uuid := (p_event->>'id')::uuid;
  v_current_updated_at timestamptz;
BEGIN
  -- 0. Optimistic concurrency: only when caller passes an expected timestamp,
  -- and only meaningful for the edit path. We lock the row to serialize the
  -- check against concurrent UPDATEs.
  IF p_expected_updated_at IS NOT NULL AND v_event_id IS NOT NULL THEN
    SELECT updated_at INTO v_current_updated_at
      FROM public.events
     WHERE id = v_event_id
     FOR UPDATE;
    -- If the row vanished (FOUND=false) we let the upsert path INSERT it
    -- afresh — no concurrent edit to conflict with.
    IF FOUND AND v_current_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'concurrent_modification: events.updated_at moved from % to %',
        p_expected_updated_at, v_current_updated_at
      USING ERRCODE = '40001';
    END IF;
  END IF;

  -- 1. Atomic upsert of the events row.
  -- jsonb_populate_record fills every public.events column from p_event.
  -- ON CONFLICT covers the edit path; INSERT covers the add path.
  INSERT INTO public.events
  SELECT * FROM jsonb_populate_record(NULL::public.events, p_event)
  ON CONFLICT (id) DO UPDATE SET
    -- VERIFIED COLUMN LIST (Task 1 step 2 will adjust if production differs)
    family_id        = EXCLUDED.family_id,
    date_key         = EXCLUDED.date_key,
    title            = EXCLUDED.title,
    time             = EXCLUDED.time,
    category         = EXCLUDED.category,
    emoji            = EXCLUDED.emoji,
    color            = EXCLUDED.color,
    bg               = EXCLUDED.bg,
    memo             = EXCLUDED.memo,
    location         = EXCLUDED.location,
    notif_override   = EXCLUDED.notif_override,
    end_time         = EXCLUDED.end_time,
    is_family_event  = EXCLUDED.is_family_event,
    updated_at       = now()
  RETURNING * INTO v_saved;

  -- 2. Rewrite child links: delete-then-insert in the same tx.
  DELETE FROM public.events_children WHERE event_id = v_saved.id;

  -- 3. Insert the new links only when not family-all and we have children.
  IF NOT COALESCE(p_family_all, false)
     AND p_child_ids IS NOT NULL
     AND array_length(p_child_ids, 1) IS NOT NULL THEN
    INSERT INTO public.events_children (event_id, child_id)
    SELECT v_saved.id, unnest(p_child_ids);
  END IF;

  RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION public.save_event_with_children(jsonb, uuid[], boolean, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_event_with_children(jsonb, uuid[], boolean, timestamptz) TO authenticated;

COMMIT;
```

- [ ] **Step 2: Write the down migration**

`supabase/migrations/down/20260515000002_save_event_with_children_rpc.sql`:

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.save_event_with_children(jsonb, uuid[], boolean, timestamptz);
COMMIT;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260515000002_save_event_with_children_rpc.sql \
        supabase/migrations/down/20260515000002_save_event_with_children_rpc.sql
git commit -m "feat(sync): add save_event_with_children RPC for atomic M:N event writes"
```

---

### Task 3: Apply migration to production

**Files:** (no source changes — deploy step)

- [ ] **Step 1: Push migration to linked project**

```bash
set -a && source .env.local && set +a && \
echo "Y" | npx supabase db push --linked
```

Expected: only `20260515000002_save_event_with_children_rpc.sql` listed (the two OAuth migrations are already applied from the earlier session — they should not relist).

- [ ] **Step 2: Verify the function exists**

Dashboard → SQL Editor:

```sql
SELECT proname, prosecdef, provolatile
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname = 'save_event_with_children';
-- Expected: prosecdef = false (SECURITY INVOKER), provolatile = 'v' (VOLATILE)
```

If `prosecdef = true`, the migration accidentally added SECURITY DEFINER — STOP and revert. RLS would be bypassed.

- [ ] **Step 3: Smoke test via SQL Editor (no client changes yet)**

Pick an arbitrary `family_id` + `created_by` from `public.user_profiles` and call the RPC manually:

```sql
SELECT public.save_event_with_children(
  jsonb_build_object(
    'id', gen_random_uuid(),
    'family_id', '<existing-family-id>',
    'date_key', '2026-12-31',
    'title', 'RPC smoke',
    'time', '00:00',
    'category', 'other',
    'emoji', '📝',
    'color', '#000',
    'bg', '#fff',
    'memo', '',
    'location', null,
    'notif_override', null,
    'end_time', null,
    'created_by', '<existing-user-id>',
    'is_family_event', true
  ),
  ARRAY[]::uuid[],
  true
);
-- Expected: returns the inserted row.

-- Clean up:
DELETE FROM public.events WHERE title = 'RPC smoke';
```

If RLS rejects (e.g., "new row violates row-level security policy for table 'events'"), the SECURITY INVOKER mode is doing its job. The Dashboard SQL Editor runs as `postgres` superuser by default; to actually exercise the policy run the smoke test from an authenticated session via supabase-js or curl with a real user JWT. Surface this to the human if you can't replicate the user-context smoke test.

---

### Task 4: Rewrite client saveEventWithChildren

**Files:**
- Modify: `src/lib/sync.js` (replace the function defined at lines 1160–1297)

- [ ] **Step 1: Replace the function body**

In `src/lib/sync.js`, replace the entire block from line 1160 (the `// ── Multi-child event saving ─` comment header) through line 1297 (the closing `}` of `saveEventWithChildren`) with:

```js
// ── Multi-child event saving ─────────────────────────────────────────────────
//
// saveEventWithChildren calls a single SECURITY INVOKER Postgres function
// `public.save_event_with_children(p_event, p_child_ids, p_family_all)` that
// performs (1) events row upsert, (2) events_children delete, (3) events_children
// insert in a single transaction. This eliminates the prior 3-call client dance
// plus its snapshot/rollback logic — and the data-loss window where a rollback
// could overwrite a concurrent edit with a stale snapshot.
export async function saveEventWithChildren(event, selection) {
  const { childIds = [], familyAll = false } = selection || {};

  // Build the event row in the same snake_case shape the RPC's
  // jsonb_populate_record(NULL::public.events, ...) expects.
  const { familyId, userId, dateKey, ...evCore } = event;
  const eventRow = {
    ...eventToRow(evCore, familyId, dateKey, userId),
    is_family_event: !!familyAll,
  };

  const { data, error } = await supabase.rpc("save_event_with_children", {
    p_event: eventRow,
    p_child_ids: familyAll ? [] : childIds,
    p_family_all: !!familyAll,
    // event.updatedAt is the timestamp the client saw at edit time. The RPC
    // raises SQLSTATE 40001 ("concurrent_modification") if the row moved on
    // since then. Today's callers (App.jsx voice/manual add) pass an event
    // without updatedAt so this is null and the check is skipped — leaving
    // last-write-wins atomicity. A follow-up plan will route the edit path
    // through here with a real expected timestamp.
    p_expected_updated_at: event?.updatedAt ?? null,
  });
  if (error) throw error;
  return data;
}
```

This replaces ~137 lines with ~17. The TODO comment at the prior lines 1174–1178 is intentionally removed because it's now resolved.

- [ ] **Step 2: Build sanity check**

Run:

```bash
npm run build
```

Expected: success, no missing import errors. (We removed code; we did not add imports.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync.js
git commit -m "refactor(sync): saveEventWithChildren → single save_event_with_children RPC call"
```

---

### Task 5: Update integration tests + new error-surfacing case

**Files:**
- Modify: `tests/integration/multichild-event-save.test.js` (rewrite the mock + add a failure case)

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `tests/integration/multichild-event-save.test.js` with:

```js
// tests/integration/multichild-event-save.test.js
//
// saveEventWithChildren now delegates atomicity to the
// public.save_event_with_children RPC. The integration test verifies the RPC
// is invoked with the correct payload and surfaces errors instead of
// silently swallowing them.

import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcCalls = [];
let nextRpcResponse = { data: { id: "e1" }, error: null };

vi.mock("../../src/lib/supabase.js", () => ({
  supabase: {
    rpc: (name, args) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(nextRpcResponse);
    },
  },
}));

beforeEach(() => {
  rpcCalls.length = 0;
  nextRpcResponse = { data: { id: "e1" }, error: null };
});

import { saveEventWithChildren } from "../../src/lib/sync.js";

describe("saveEventWithChildren", () => {
  it("자녀 1명 선택 시 RPC 에 p_child_ids:[c1] 전달", async () => {
    await saveEventWithChildren(
      { id: "e1", title: "학원", familyId: "f1", userId: "u1", dateKey: "2026-12-31" },
      { childIds: ["c1"], familyAll: false }
    );
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("save_event_with_children");
    expect(rpcCalls[0].args.p_child_ids).toEqual(["c1"]);
    expect(rpcCalls[0].args.p_family_all).toBe(false);
    expect(rpcCalls[0].args.p_event.is_family_event).toBe(false);
    expect(rpcCalls[0].args.p_event.id).toBe("e1");
  });

  it("'가족 전체' 시 p_family_all:true + p_child_ids:[]", async () => {
    await saveEventWithChildren(
      { id: "e1", title: "저녁식사", familyId: "f1", userId: "u1", dateKey: "2026-12-31" },
      { childIds: [], familyAll: true }
    );
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].args.p_family_all).toBe(true);
    expect(rpcCalls[0].args.p_child_ids).toEqual([]);
    expect(rpcCalls[0].args.p_event.is_family_event).toBe(true);
  });

  it("familyAll=true 일 때 client 가 보낸 childIds 는 무시되고 빈 배열 전달", async () => {
    await saveEventWithChildren(
      { id: "e1", title: "외식", familyId: "f1", userId: "u1", dateKey: "2026-12-31" },
      { childIds: ["c1", "c2"], familyAll: true }
    );
    expect(rpcCalls[0].args.p_child_ids).toEqual([]);
    expect(rpcCalls[0].args.p_family_all).toBe(true);
  });

  it("RPC 가 error 를 반환하면 throw — 자체 rollback 시도 없음", async () => {
    nextRpcResponse = { data: null, error: { message: "permission denied" } };
    await expect(
      saveEventWithChildren(
        { id: "e1", title: "학원", familyId: "f1", userId: "u1", dateKey: "2026-12-31" },
        { childIds: ["c1"], familyAll: false }
      )
    ).rejects.toMatchObject({ message: "permission denied" });
    // 호출은 정확히 1회 — client 는 더 이상 step 1/2/3 으로 나누지 않는다.
    expect(rpcCalls).toHaveLength(1);
  });

  it("event.updatedAt 가 있으면 p_expected_updated_at 으로 전달", async () => {
    await saveEventWithChildren(
      { id: "e1", title: "수정", familyId: "f1", userId: "u1", dateKey: "2026-12-31", updatedAt: "2026-05-15T01:00:00Z" },
      { childIds: ["c1"], familyAll: false }
    );
    expect(rpcCalls[0].args.p_expected_updated_at).toBe("2026-05-15T01:00:00Z");
  });

  it("event.updatedAt 없으면 p_expected_updated_at:null — OC 비활성 (add path)", async () => {
    await saveEventWithChildren(
      { id: "e1", title: "추가", familyId: "f1", userId: "u1", dateKey: "2026-12-31" },
      { childIds: ["c1"], familyAll: false }
    );
    expect(rpcCalls[0].args.p_expected_updated_at).toBeNull();
  });

  it("RPC 가 SQLSTATE 40001 (concurrent_modification) 반환 시 client 가 그대로 surface", async () => {
    nextRpcResponse = {
      data: null,
      error: { message: "concurrent_modification: events.updated_at moved from ...", code: "40001" },
    };
    await expect(
      saveEventWithChildren(
        { id: "e1", title: "충돌", familyId: "f1", userId: "u1", dateKey: "2026-12-31", updatedAt: "2026-05-15T00:00:00Z" },
        { childIds: ["c1"], familyAll: false }
      )
    ).rejects.toMatchObject({ code: "40001" });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/integration/multichild-event-save.test.js
```

Expected: 7 passes.

- [ ] **Step 3: Run the entire suite to catch unrelated breakage**

```bash
npx vitest run
```

Expected: all tests pass (the prior oauthBridge.test.js 15 + this 4 + anything else). If any pre-existing test broke, do NOT fix it inside this task — surface as DONE_WITH_CONCERNS so the human can decide whether to bundle a fix or open a separate task.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/multichild-event-save.test.js
git commit -m "test(sync): rewrite multichild-event-save tests for RPC-based saveEventWithChildren"
```

---

### Task 6: Build, install, manual smoke + ship

**Files:**
- Create: `docs/superpowers/verifications/2026-05-15-sync-rpc-verification.md`

- [ ] **Step 1: Build + install on both devices**

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug && cd ..
adb -s R5CY40EE6QE install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s ZY22H9VTQD install -r android/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 2: Write the verification checklist**

Create `docs/superpowers/verifications/2026-05-15-sync-rpc-verification.md`:

```markdown
# sync.js RPC Migration — Manual Verification (2026-05-15)

Test environment: production Supabase + Android devices R5CY40EE6QE + ZY22H9VTQD.

## Scenario A — 새 이벤트 추가 (add path, 자녀 1명)

1. [ ] 캘린더 → 날짜 → "+" → 자녀 1명 선택 → 저장.
2. [ ] 다른 디바이스에서 동일 이벤트 표시 확인 (realtime sync 통과).
3. [ ] Dashboard SQL: `SELECT * FROM events WHERE title='<제목>'` — 1행 + `SELECT * FROM events_children WHERE event_id='<id>'` — 1행.

## Scenario B — 기존 이벤트 수정 (edit path, 자녀 변경)

1. [ ] Scenario A 의 이벤트 → 자녀 추가 → 저장.
2. [ ] Dashboard SQL: `events_children WHERE event_id='<id>'` — 2행.
3. [ ] 다시 자녀 1명만 → 저장 → 1행 + 다른 child_id 가 사라졌는지 확인 (delete-then-insert 검증).

## Scenario C — 가족 전체

1. [ ] 새 이벤트 → "가족 전체" 토글 ON → 저장.
2. [ ] Dashboard: `events.is_family_event = true`, `events_children` 행 0개.

## Scenario D — 동시 수정 (concurrent edit safety)

> 현재 caller (App.jsx) 는 add path 만 호출하므로 saveEventWithChildren 실측 OC 는 검증 불가.
> 본 시나리오는 RPC 의 atomicity (LWW) 만 검증한다. OC 자체는 Dashboard SQL Editor 에서 RPC 직접 호출로 별도 검증.

1. [ ] 디바이스 1: 이벤트 X 편집 화면 진입 (별도 updateEvent 경로).
2. [ ] 디바이스 2: 같은 이벤트 X 의 메모 만 수정 후 저장.
3. [ ] 디바이스 1: 자녀 변경만 수정 후 저장.
4. [ ] 결과: **stale priorEventRow upsert 로 메모가 옛 값으로 되돌아가는 일이 없는지** 가 핵심. RPC migration 이전 santa-loop 시나리오는 이 지점에서 데이터 손실 발생 가능했음.

## Scenario D-2 — Optimistic concurrency RPC 직접 검증 (Dashboard)

1. [ ] Dashboard SQL Editor 에서 이벤트 X 의 현재 `updated_at` 확인 — `T0`.
2. [ ] 같은 row 를 `UPDATE events SET updated_at = now() WHERE id = X` 으로 한 번 건드림 → 새 timestamp `T1`.
3. [ ] RPC 직접 호출:
   ```sql
   SELECT public.save_event_with_children(
     (SELECT to_jsonb(events) FROM events WHERE id = X),
     ARRAY[]::uuid[],
     false,
     'T0'::timestamptz  -- stale expected
   );
   ```
4. [ ] 결과: `ERROR: concurrent_modification: events.updated_at moved from T0 to T1` + SQLSTATE 40001. RPC 가 stale write 를 거부.
5. [ ] 동일 호출에서 expected 를 `T1` (현재 값) 으로 바꾸면 성공.

## Scenario E — 권한 거부 (다른 가족 데이터 시도)

1. [ ] (manual) 디바이스 1 의 access token 으로 디바이스 2 의 family_id 를 명시한 이벤트 추가 시도 (PostgREST direct call).
2. [ ] RLS 의 `ev_ins` 정책에 의해 거부 (HTTP 401/403).

## DB sanity

- [ ] `pg_proc` 에 `save_event_with_children(jsonb, uuid[], boolean)` 존재, `prosecdef=false`, `provolatile='v'`.
- [ ] `events_children.event_id → events.id` FK 무결성 통과 (orphan 없음).
```

- [ ] **Step 3: Walk through Scenarios A, B, C, D**. Scenario E는 manual API call이 필요해 시간 잡고 별도 진행 가능 — 우선순위 LOW. A-D 통과해야 ship.

- [ ] **Step 4: Commit checklist + ship**

```bash
git add docs/superpowers/verifications/2026-05-15-sync-rpc-verification.md
git commit -m "docs(sync): manual verification checklist for save_event_with_children RPC"
```

Pre-push hook marker + push (`workflow_auto_ship` 메모리 패턴):

```bash
for p in /tmp "$HOME/AppData/Local/Temp" "$LOCALAPPDATA/Temp" /c/tmp ; do
  [ -d "$p" ] && touch "$p/.claude_review_done"
done
git push origin main
```

Then install (already done in Step 1; repeat if there are commits beyond what was installed).

---

## Post-launch follow-ups (NOT in this plan)

- **edit path migrate**: `App.jsx` 의 `updateEvent` 호출들을 `saveEventWithChildren` 로 통합 → `event.updatedAt` 을 실어 보내 OC 가 실측 활성화. App.jsx 에 SQLSTATE `40001` catch UX ("다른 기기에서 먼저 수정됐어요, 새로고침 해 주세요") 추가. 별개 plan.
- `events.updated_at` column 가 auto-trigger 인지 RPC 내 `updated_at = now()` 가 권위인지 점검. 두 곳 모두에서 set 하면 trigger 가 RPC value 를 덮어쓸 수 있음. OC 의 expected 비교가 trigger 값을 보는지 RPC 값을 보는지 검증 필요. 필요시 trigger 제거 또는 RPC line 제거.
- 동일 패턴이 적용 가능한 다른 multi-statement write (예: academy save with schedule, saved_places save with public_place 동기화) 가 sync.js 에 더 있는지 audit. 이번 plan 은 saveEventWithChildren 만 다룬다.
- santa-loop e9afa89 의 두 번째 open follow-up — `VITE_KAKAO_REST_KEY` 클라이언트 번들 노출 — 은 별개 plan.

---

## Self-Review

**Spec coverage:**
- DB migration → Task 2 ✓
- Migration apply → Task 3 ✓
- Client rewrite → Task 4 ✓
- Tests → Task 5 ✓
- Build + install + manual verify + push → Task 6 ✓
- Production schema/RLS pre-flight → Task 1 ✓ (gated before code)

**Placeholder scan:** Only `-- VERIFIED COLUMN LIST` and `<existing-family-id>`/`<existing-user-id>`/`<제목>`/`<id>` markers in Task 1/3 SQL — these are intentional and resolved at execution time.

**Type consistency:** `save_event_with_children`, `p_event jsonb`, `p_child_ids uuid[]`, `p_family_all boolean`, `p_expected_updated_at timestamptz DEFAULT NULL`, `RETURNS public.events` — consistent across Task 2 (SQL), Task 4 (client), Task 5 (test mock), Task 6 (verification SQL). SQLSTATE `40001` for concurrent_modification surfaces in supabase-js error.code.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-05-15-sync-rpc-migration.md`. Subagent-driven execution: fresh subagent per task, two-stage review (spec compliance → code quality), final reviewer for the whole feature. Model selection: Task 1 sonnet (schema-judgment), Tasks 2/3/5 haiku (mechanical with complete spec), Task 4 sonnet (touches a 1500-line file, multi-edit), Task 6 haiku (doc + mechanical install).
