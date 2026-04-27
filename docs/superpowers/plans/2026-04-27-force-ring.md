# Force Ring (강제 소리 울리기) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부모가 5초 long-press로 트리거 시 아이 단말이 무음·DND·잠금 화면 어떤 조건에서도 풀볼륨 알람 + 풀스크린으로 15초간 표시되는 응급 백업 기능 구현.

**Architecture:** 부모 단말(웹/Android) → push-notify Edge Function (3개 신규 액션) → FCM data-only → 아이 Android (FOREGROUND_SERVICE_SPECIAL_USE + USE_FULL_SCREEN_INTENT) → Supabase Realtime으로 부모에 실시간 피드백. 모든 트리거는 immutable `force_ring_events` 테이블에 기록.

**Tech Stack:** PostgreSQL/Supabase RLS · Deno Edge Function · React 19 + Capacitor 8 · Android Java (FGS + 풀스크린 Activity) · FCM HTTP v1 · pg_cron · Vitest 4 · Playwright 1.59 (real-services config).

**Spec:** `docs/superpowers/specs/2026-04-27-force-ring-design.md` (14 sections, 11 locked decisions)

---

## File Structure (created/modified)

### Created
| 경로 | 책임 |
|---|---|
| `supabase/migrations/<timestamp>_force_ring.sql` | Forward 마이그레이션 (테이블 + RLS + RPC + cron 2개 + publication) |
| `supabase/migrations/down/<timestamp>_force_ring.sql` | Down 역적용 |
| `src/lib/forceRing.js` | 클라이언트 헬퍼 (trigger / stop / subscribeStatus / fetchHistory + client_request_hash 자동 생성 + 80자 truncation) |
| `src/components/ForceRingPanel.jsx` | 안전 도구 패널 (orchestrator) |
| `src/components/ForceRingTriggerButton.jsx` | 5초 long-press 트리거 버튼 |
| `src/components/ForceRingConfirmModal.jsx` | 메시지 입력 + 최종 확인 모달 |
| `src/components/ForceRingActiveStatus.jsx` | Realtime subscription + 6개 상태 분기 |
| `src/components/ForceRingHistory.jsx` | 최근 10건 audit |
| `tests/forceRingClient.test.js` | forceRing.js 단위 테스트 |
| `tests/forceRingQuota.test.js` | RPC `force_ring_check_quota` 분기 테스트 |
| `tests/forceRingPanel.test.jsx` | ForceRingTriggerButton + ConfirmModal 테스트 |
| `tests/forceRingActiveStatus.test.jsx` | Realtime 분기 테스트 |
| `tests/forceRingHistory.test.js` | History 정렬·라벨 테스트 |
| `tests/nativeForceRingService.test.js` | Native FCM payload contract 테스트 |
| `tests/e2e/force-ring-trigger.spec.js` | E2E mock: trigger flow |
| `tests/e2e/force-ring-quota.spec.js` | E2E mock: quota exceeded |
| `tests/e2e/force-ring-failure.spec.js` | E2E mock: delivery failure |
| `tests/e2e/force-ring-realtime.spec.js` | E2E mock: ack realtime |
| `tests/e2e/real/force-ring-end-to-end.spec.js` | Real services: full flow |
| `tests/e2e/real/force-ring-quota-real.spec.js` | Real services: tier toggle |
| `tests/e2e/real/force-ring-stop.spec.js` | Real services: parent remote stop |
| `tests/e2e/real/force-ring-reminder.spec.js` | Real services: 5min reminder (slow) |
| `android/app/src/main/java/com/hyeni/calendar/ForceRingService.java` | FGS, USAGE_ALARM, 15초 hard cap |
| `android/app/src/main/java/com/hyeni/calendar/ForceRingActivity.java` | 풀스크린 takeover |
| `android/app/src/main/java/com/hyeni/calendar/ForceRingRequestStore.java` | event_id 중복 방지 |
| `android/app/src/main/res/layout/activity_force_ring.xml` | 풀스크린 layout |
| `android/app/src/main/res/raw/force_ring_alarm.ogg` | 알람 사운드 자산 |
| `docs/PLAY-CONSOLE-FORCE-RING-DISCLOSURE.md` | Play Console 제출용 disclosure |

### Modified
| 경로 | 변경 |
|---|---|
| `supabase/functions/push-notify/index.ts` | 액션 분기 3개 추가 (force_ring / force_ring_stop / force_ring_reminder) |
| `src/App.jsx` | 안전 도구 섹션에 ForceRingPanel 추가 (~10라인 wiring) |
| `android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java` | force_ring / force_ring_stop 데이터 메시지 분기 |
| `android/app/src/main/java/com/hyeni/calendar/NotificationHelper.java` | `ensureForceRingChannel()` 메서드 |
| `android/app/src/main/AndroidManifest.xml` | 권한 5개 + Service + Activity 등록 |
| `android/app/src/main/res/values/styles.xml` | `Theme.Hyeni.ForceRing.Fullscreen` 추가 |

---

## Phase Breakdown

| Phase | 범위 | 검증 게이트 | 의존 |
|---|---|---|---|
| 1 | DB Migration (forward + down + RPC + RLS) | Vitest + psql 매트릭스 + Supabase branch 적용 | none |
| 2 | Edge Function (3 액션) | curl 검증 + Vitest mock | Phase 1 |
| 3 | Client lib (`src/lib/forceRing.js`) | Vitest 80%+ | Phase 2 |
| 4 | Parent UI Components (App.jsx 통합) | Vitest 컴포넌트 + 모의 Playwright | Phase 3 |
| 5 | Native Android (FGS + Activity + 매니페스트) | Vitest mock + 로컬 lint + CI APK 빌드 | Phase 4 |
| 6 | Real-services E2E + Native 수동 24개 | `playwright.real.config.js` + 실기기 | Phase 5 |
| 7 | Production deploy + Play Console disclosure | live smoke + 24h 모니터링 | Phase 6 |

---

# Phase 1: DB Migration

### Task 1.1: Generate timestamp + scaffold forward + down files

**Files:**
- Create: `supabase/migrations/<timestamp>_force_ring.sql`
- Create: `supabase/migrations/down/<timestamp>_force_ring.sql`

- [ ] **Step 1: Generate UTC timestamp**

```bash
TIMESTAMP=$(date -u +%Y%m%d%H%M%S)
echo $TIMESTAMP
```

Save the output (e.g., `20260427143000`) — used for both files. Replace `<timestamp>` in this plan with the actual value.

- [ ] **Step 2: Create empty files with headers**

Forward file `supabase/migrations/${TIMESTAMP}_force_ring.sql`:

```sql
-- force_ring (강제 소리 울리기) — Spec: docs/superpowers/specs/2026-04-27-force-ring-design.md
--
-- Creates:
--   1. public.force_ring_events — immutable parent→child emergency alert audit log
--   2. UNIQUE partial indexes (request_hash, one-active-per-family)
--   3. RLS policies (select / insert / update_initiator / update_target)
--   4. force_ring_check_quota(uuid) RPC — SECURITY DEFINER, free 1/day vs premium 10/day
--   5. supabase_realtime publication 추가
--   6. pg_cron force_ring_reminder_check (1분 단위)
--   7. pg_cron force_ring_delivery_timeout (2분 단위, 10분 경과 cleanup)
--
-- HARD RULES:
--   - Idempotent: IF NOT EXISTS / CREATE OR REPLACE
--   - No data backfill; v1 audit surface starting empty
--   - RLS enabled on new table
--   - DELETE policy intentionally absent → service_role only (immutable audit)
--
-- Pairing: supabase/migrations/down/<timestamp>_force_ring.sql

BEGIN;
COMMIT;
```

Down file `supabase/migrations/down/${TIMESTAMP}_force_ring.sql`:

```sql
-- DOWN: force_ring — reverses <timestamp>_force_ring.sql
-- Order: cron jobs → publication → RPC → policies → table

BEGIN;
COMMIT;
```

- [ ] **Step 3: Commit scaffolding**

```bash
git add supabase/migrations/${TIMESTAMP}_force_ring.sql \
        supabase/migrations/down/${TIMESTAMP}_force_ring.sql
git commit -m "chore(force_ring): scaffold migration files"
```

---

### Task 1.2: Implement forward migration — table + indexes

**Files:**
- Modify: `supabase/migrations/<timestamp>_force_ring.sql`

- [ ] **Step 1: Replace empty BEGIN/COMMIT with table DDL**

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.force_ring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  initiator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text CHECK (message IS NULL OR char_length(message) <= 80),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  stopped_at timestamptz,
  stop_reason text CHECK (stop_reason IN
    ('child_ack','parent_stop','auto_timeout','delivery_failed')),
  reminder_sent_at timestamptz,
  delivery_status jsonb DEFAULT '{}'::jsonb,
  client_request_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS force_ring_family_time_idx
  ON public.force_ring_events (family_id, triggered_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS force_ring_request_hash_idx
  ON public.force_ring_events (client_request_hash)
  WHERE client_request_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS force_ring_one_active_per_family_idx
  ON public.force_ring_events (family_id)
  WHERE stopped_at IS NULL;

COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/${TIMESTAMP}_force_ring.sql
git commit -m "feat(force_ring): add force_ring_events table + indexes"
```

---

### Task 1.3: Add RLS policies

**Files:**
- Modify: `supabase/migrations/<timestamp>_force_ring.sql`

- [ ] **Step 1: Insert policies before COMMIT**

```sql
ALTER TABLE public.force_ring_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS force_ring_select ON public.force_ring_events;
CREATE POLICY force_ring_select ON public.force_ring_events
  FOR SELECT TO authenticated
  USING (family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS force_ring_insert ON public.force_ring_events;
CREATE POLICY force_ring_insert ON public.force_ring_events
  FOR INSERT TO authenticated
  WITH CHECK (
    initiator_user_id = auth.uid()
    AND family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'parent'
    )
  );

DROP POLICY IF EXISTS force_ring_update_initiator ON public.force_ring_events;
CREATE POLICY force_ring_update_initiator ON public.force_ring_events
  FOR UPDATE TO authenticated
  USING (initiator_user_id = auth.uid())
  WITH CHECK (initiator_user_id = auth.uid());

DROP POLICY IF EXISTS force_ring_update_target ON public.force_ring_events;
CREATE POLICY force_ring_update_target ON public.force_ring_events
  FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid())
  WITH CHECK (target_user_id = auth.uid());

-- DELETE: 정책 부재 = service_role only (immutable audit)
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/${TIMESTAMP}_force_ring.sql
git commit -m "feat(force_ring): add RLS policies (select/insert/update)"
```

---

### Task 1.4: Add force_ring_check_quota RPC

**Files:**
- Modify: `supabase/migrations/<timestamp>_force_ring.sql`

- [ ] **Step 1: Add RPC + GRANT before COMMIT**

```sql
CREATE OR REPLACE FUNCTION public.force_ring_check_quota(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quota int;
  v_status text;
  v_used int;
BEGIN
  SELECT status INTO v_status
    FROM public.family_subscription
    WHERE family_id = p_family_id;

  v_quota := CASE
    WHEN v_status IN ('trial','active','grace') THEN 10
    ELSE 1
  END;

  SELECT COUNT(*) INTO v_used
    FROM public.force_ring_events
    WHERE family_id = p_family_id
      AND triggered_at > now() - interval '24 hours'
      AND (
        delivered_at IS NOT NULL
        OR (delivered_at IS NULL AND stop_reason IS NULL)
      );

  RETURN jsonb_build_object(
    'allowed', v_used < v_quota,
    'quota', v_quota,
    'used', v_used,
    'tier', COALESCE(v_status, 'free')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_ring_check_quota(uuid) TO authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/${TIMESTAMP}_force_ring.sql
git commit -m "feat(force_ring): add force_ring_check_quota SECURITY DEFINER RPC"
```

---

### Task 1.5: Add Realtime publication + pg_cron jobs

**Files:**
- Modify: `supabase/migrations/<timestamp>_force_ring.sql`

- [ ] **Step 1: Add publication + cron before COMMIT**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.force_ring_events;

SELECT cron.schedule(
  'force_ring_reminder_check',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/push-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('action', 'force_ring_reminder')
    );
  $cron$
);

SELECT cron.schedule(
  'force_ring_delivery_timeout',
  '*/2 * * * *',
  $cleanup$
    UPDATE public.force_ring_events
       SET stopped_at = now(),
           stop_reason = 'delivery_failed'
     WHERE delivered_at IS NULL
       AND stopped_at IS NULL
       AND triggered_at < now() - interval '10 minutes';
  $cleanup$
);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/${TIMESTAMP}_force_ring.sql
git commit -m "feat(force_ring): add realtime publication + 2 pg_cron jobs"
```

---

### Task 1.6: Implement down migration

**Files:**
- Modify: `supabase/migrations/down/<timestamp>_force_ring.sql`

- [ ] **Step 1: Replace empty BEGIN/COMMIT**

```sql
BEGIN;

SELECT cron.unschedule('force_ring_delivery_timeout');
SELECT cron.unschedule('force_ring_reminder_check');

ALTER PUBLICATION supabase_realtime DROP TABLE public.force_ring_events;

DROP FUNCTION IF EXISTS public.force_ring_check_quota(uuid);

DROP POLICY IF EXISTS force_ring_update_target ON public.force_ring_events;
DROP POLICY IF EXISTS force_ring_update_initiator ON public.force_ring_events;
DROP POLICY IF EXISTS force_ring_insert ON public.force_ring_events;
DROP POLICY IF EXISTS force_ring_select ON public.force_ring_events;

DROP TABLE IF EXISTS public.force_ring_events;

COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/down/${TIMESTAMP}_force_ring.sql
git commit -m "feat(force_ring): add down migration"
```

---

### Task 1.7: Apply migration to Supabase branch + verify

- [ ] **Step 1: Create or switch to force-ring branch**

```bash
npx supabase branches list
# Create if not exists:
npx supabase branches create force-ring --persistent
```

- [ ] **Step 2: Apply forward migration**

```bash
npx supabase migration up --linked
```

Expected: `Applied migration <timestamp>_force_ring.sql`. No errors.

- [ ] **Step 3: Verify all objects exist**

Use Supabase dashboard SQL editor or MCP execute_sql:

```sql
SELECT relname FROM pg_class WHERE relname = 'force_ring_events';
SELECT proname FROM pg_proc WHERE proname = 'force_ring_check_quota';
SELECT jobname FROM cron.job WHERE jobname IN
  ('force_ring_reminder_check','force_ring_delivery_timeout');
SELECT schemaname, tablename FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = 'force_ring_events';
```

Expected: 5 rows total (1 table + 1 function + 2 cron jobs + 1 publication entry).

---

### Task 1.8: Write quota RPC unit tests

**Files:**
- Create: `tests/forceRingQuota.test.js`

- [ ] **Step 1: Write test file**

```javascript
// tests/forceRingQuota.test.js
import { describe, it, expect, afterEach, vi } from 'vitest';

const mockRpc = vi.fn();

vi.mock('../src/lib/supabase.js', () => ({
  supabase: {
    rpc: (...args) => mockRpc(...args)
  }
}));

describe('force_ring_check_quota RPC contract', () => {
  afterEach(() => mockRpc.mockReset());

  it('returns allowed=true with quota=1 for free tier', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, quota: 1, used: 0, tier: 'free' },
      error: null
    });

    const { supabase } = await import('../src/lib/supabase.js');
    const { data } = await supabase.rpc('force_ring_check_quota', {
      p_family_id: '00000000-0000-0000-0000-000000000001'
    });

    expect(data).toEqual({ allowed: true, quota: 1, used: 0, tier: 'free' });
  });

  it('returns quota=10 for trial/active/grace tier', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, quota: 10, used: 3, tier: 'active' },
      error: null
    });

    const { supabase } = await import('../src/lib/supabase.js');
    const { data } = await supabase.rpc('force_ring_check_quota', {
      p_family_id: '00000000-0000-0000-0000-000000000001'
    });

    expect(data.quota).toBe(10);
    expect(data.tier).toBe('active');
  });

  it('returns allowed=false when used >= quota', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: false, quota: 1, used: 1, tier: 'free' },
      error: null
    });

    const { supabase } = await import('../src/lib/supabase.js');
    const { data } = await supabase.rpc('force_ring_check_quota', {
      p_family_id: '00000000-0000-0000-0000-000000000001'
    });

    expect(data.allowed).toBe(false);
  });

  it('falls back to free tier when family_subscription absent', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, quota: 1, used: 0, tier: 'free' },
      error: null
    });

    const { supabase } = await import('../src/lib/supabase.js');
    const { data } = await supabase.rpc('force_ring_check_quota', {
      p_family_id: '00000000-0000-0000-0000-000000000001'
    });

    expect(data.tier).toBe('free');
    expect(data.quota).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- tests/forceRingQuota.test.js
```

Expected: 4 tests pass.

- [ ] **Step 3: Manual RLS matrix verification on branch**

Use Supabase dashboard SQL editor (set role for each):

```sql
-- Setup: get test parent + child UUIDs from existing branch family
SELECT user_id, family_id, role FROM family_members LIMIT 5;
-- Note 3 UUIDs: PARENT_UUID, CHILD_UUID, FAMILY_UUID

-- Test 1: parent INSERT (expected: success)
SET LOCAL "request.jwt.claims" TO '{"sub":"<PARENT_UUID>"}';
INSERT INTO force_ring_events (family_id, initiator_user_id, target_user_id)
VALUES ('<FAMILY_UUID>', '<PARENT_UUID>', '<CHILD_UUID>');

-- Test 2: child INSERT attempt (expected: ERROR violates RLS policy)
SET LOCAL "request.jwt.claims" TO '{"sub":"<CHILD_UUID>"}';
INSERT INTO force_ring_events (family_id, initiator_user_id, target_user_id)
VALUES ('<FAMILY_UUID>', '<CHILD_UUID>', '<CHILD_UUID>');

-- Test 3: child UPDATE acknowledged_at (expected: success)
SET LOCAL "request.jwt.claims" TO '{"sub":"<CHILD_UUID>"}';
UPDATE force_ring_events SET acknowledged_at = now()
  WHERE target_user_id = '<CHILD_UUID>';

-- Test 4: outsider SELECT (expected: 0 rows)
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-deadbeefdead"}';
SELECT count(*) FROM force_ring_events;
-- Cleanup test row
RESET ROLE;
DELETE FROM force_ring_events WHERE message IS NULL AND triggered_at > now() - interval '10 minutes';
```

Document results in PR description / commit message.

- [ ] **Step 4: Commit test file**

```bash
git add tests/forceRingQuota.test.js
git commit -m "test(force_ring): add force_ring_check_quota unit tests + RLS verification"
```

---

### Task 1.9: Verify down migration on branch

- [ ] **Step 1: Apply down migration**

```bash
psql $SUPABASE_DB_URL -f "supabase/migrations/down/${TIMESTAMP}_force_ring.sql"
```

- [ ] **Step 2: Verify all objects removed**

```sql
SELECT count(*) FROM pg_class WHERE relname = 'force_ring_events';
-- Expected: 0
SELECT count(*) FROM pg_proc WHERE proname = 'force_ring_check_quota';
-- Expected: 0
SELECT count(*) FROM cron.job WHERE jobname LIKE 'force_ring%';
-- Expected: 0
```

- [ ] **Step 3: Re-apply forward migration twice (idempotency)**

```bash
psql $SUPABASE_DB_URL -f "supabase/migrations/${TIMESTAMP}_force_ring.sql"
psql $SUPABASE_DB_URL -f "supabase/migrations/${TIMESTAMP}_force_ring.sql"
```

Expected: both runs succeed, no errors (IF NOT EXISTS guards everything).

---

# Phase 2: Edge Function (push-notify 확장)

### Task 2.1: Add force_ring action handler

**Files:**
- Modify: `supabase/functions/push-notify/index.ts`

- [ ] **Step 1: Locate dispatch logic**

```bash
grep -n "action ===\|action ==\|body\\?\\.action" supabase/functions/push-notify/index.ts
```

Identify where existing actions (`remote_listen`, `instant_push`) are dispatched.

- [ ] **Step 2: Add handler function**

Insert above the main `serve()` handler:

```typescript
async function handleForceRing(
  req: Request,
  body: { family_id?: string; message?: string; client_request_hash?: string },
  supabase: ReturnType<typeof createClient>,
  authClient: ReturnType<typeof createClient>
): Promise<Response> {
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ error: "missing_jwt" }, 401);

  const { data: claims, error: claimsErr } = await authClient.auth.getClaims(jwt);
  if (claimsErr || !claims) return jsonResponse({ error: "invalid_jwt" }, 401);

  const userId = claims.claims.sub;
  const familyId = body.family_id;
  if (!familyId) return jsonResponse({ error: "missing_family_id" }, 400);

  const { data: membership, error: memErr } = await supabase
    .from("family_members")
    .select("role, nickname")
    .eq("user_id", userId)
    .eq("family_id", familyId)
    .maybeSingle();
  if (memErr || !membership || membership.role !== "parent") {
    return jsonResponse({ error: "force_ring_requires_parent" }, 403);
  }

  if (body.client_request_hash) {
    const { data: existing } = await supabase
      .from("force_ring_events")
      .select("id, delivered_at")
      .eq("client_request_hash", body.client_request_hash)
      .maybeSingle();
    if (existing) {
      return jsonResponse({
        event_id: existing.id,
        delivered: !!existing.delivered_at,
        deduplicated: true
      }, 200);
    }
  }

  const { data: quota, error: quotaErr } = await supabase.rpc(
    "force_ring_check_quota", { p_family_id: familyId }
  );
  if (quotaErr) return jsonResponse({ error: "quota_check_failed" }, 500);
  if (!quota.allowed) {
    return jsonResponse({
      error: "force_ring_quota_exceeded",
      quota: quota.quota, used: quota.used, tier: quota.tier
    }, 429);
  }

  const { data: children } = await supabase
    .from("family_members")
    .select("user_id")
    .eq("family_id", familyId)
    .eq("role", "child")
    .order("created_at", { ascending: true })
    .limit(1);
  if (!children?.length) {
    return jsonResponse({ error: "no_child_in_family" }, 404);
  }
  const targetUserId = children[0].user_id;

  const message = (body.message || "").slice(0, 80);
  const { data: event, error: insertErr } = await supabase
    .from("force_ring_events")
    .insert({
      family_id: familyId,
      initiator_user_id: userId,
      target_user_id: targetUserId,
      message: message || null,
      client_request_hash: body.client_request_hash || null,
    })
    .select("id")
    .single();
  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: active } = await supabase
        .from("force_ring_events")
        .select("id")
        .eq("family_id", familyId)
        .is("stopped_at", null)
        .maybeSingle();
      return jsonResponse({
        error: "force_ring_already_active",
        active_event_id: active?.id
      }, 423);
    }
    return jsonResponse({ error: "insert_failed", details: insertErr }, 500);
  }

  const { data: tokens } = await supabase
    .from("native_push_tokens")
    .select("token, platform")
    .eq("user_id", targetUserId)
    .eq("platform", "android");

  if (!tokens?.length) {
    await supabase.from("force_ring_events")
      .update({
        stopped_at: new Date().toISOString(),
        stop_reason: "delivery_failed",
        delivery_status: { reason: "no_fcm_tokens" }
      })
      .eq("id", event.id);
    return jsonResponse({
      event_id: event.id,
      delivered: false,
      error: "no_fcm_tokens"
    }, 200);
  }

  const initiatorName = membership.nickname || "부모님";

  const fcmPayload = {
    data: {
      action: "force_ring",
      event_id: event.id,
      message,
      initiator_name: initiatorName,
    },
    android: {
      priority: "HIGH",
      ttl: "600s",
      direct_boot_ok: true,
    },
  };

  const fcmResults = await Promise.all(
    tokens.map(t => sendFcmDataOnly(t.token, fcmPayload))
  );
  const anySuccess = fcmResults.some(r => r.success);

  if (anySuccess) {
    await supabase.from("force_ring_events")
      .update({
        delivered_at: new Date().toISOString(),
        delivery_status: { fcm: fcmResults }
      })
      .eq("id", event.id);
  } else {
    await supabase.from("force_ring_events")
      .update({
        stopped_at: new Date().toISOString(),
        stop_reason: "delivery_failed",
        delivery_status: { fcm: fcmResults }
      })
      .eq("id", event.id);
  }

  return jsonResponse({
    event_id: event.id,
    delivered: anySuccess,
    quota_remaining: quota.quota - quota.used - (anySuccess ? 1 : 0)
  }, 200);
}
```

- [ ] **Step 3: Wire force_ring action into main dispatcher**

Find the `serve()` body action dispatch. Add at top of dispatch chain (before existing actions):

```typescript
if (body?.action === "force_ring") {
  return handleForceRing(req, body, supabase, authClient);
}
```

- [ ] **Step 4: Verify sendFcmDataOnly helper exists or add minimal version**

If `sendFcmDataOnly` doesn't exist in the file, find existing FCM helpers (`sendFcm`, `sendInstantFcm`, etc.) and either:
- Reuse with `notification: undefined, data: payload.data`
- Or add minimal wrapper:

```typescript
async function sendFcmDataOnly(
  token: string,
  payload: { data: Record<string, string>; android: Record<string, any> }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Reuse existing FCM access token + endpoint logic
  // Return { success: true } on 200, { success: false, error } otherwise
  // (Use same token-refresh + error-handling pattern as existing sendFcm helper)
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/push-notify/index.ts
git commit -m "feat(force_ring): add force_ring Edge Function action handler"
```

---

### Task 2.2: Add force_ring_stop action handler

**Files:**
- Modify: `supabase/functions/push-notify/index.ts`

- [ ] **Step 1: Add handler function**

```typescript
async function handleForceRingStop(
  req: Request,
  body: { event_id?: string },
  supabase: ReturnType<typeof createClient>,
  authClient: ReturnType<typeof createClient>
): Promise<Response> {
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: claims, error: claimsErr } = await authClient.auth.getClaims(jwt);
  if (claimsErr || !claims) return jsonResponse({ error: "invalid_jwt" }, 401);

  const userId = claims.claims.sub;
  const eventId = body.event_id;
  if (!eventId) return jsonResponse({ error: "missing_event_id" }, 400);

  const { data: event, error: selectErr } = await supabase
    .from("force_ring_events")
    .select("id, initiator_user_id, target_user_id, family_id, stopped_at")
    .eq("id", eventId)
    .maybeSingle();
  if (selectErr || !event) return jsonResponse({ error: "event_not_found" }, 404);
  if (event.initiator_user_id !== userId) return jsonResponse({ error: "not_initiator" }, 403);
  if (event.stopped_at) return jsonResponse({ stopped: true, already: true }, 200);

  const { error: updateErr } = await supabase
    .from("force_ring_events")
    .update({
      stopped_at: new Date().toISOString(),
      stop_reason: "parent_stop"
    })
    .eq("id", eventId)
    .is("stopped_at", null);
  if (updateErr) return jsonResponse({ error: "update_failed" }, 500);

  const { data: tokens } = await supabase
    .from("native_push_tokens")
    .select("token")
    .eq("user_id", event.target_user_id)
    .eq("platform", "android");

  if (tokens?.length) {
    await Promise.all(tokens.map(t => sendFcmDataOnly(t.token, {
      data: { action: "force_ring_stop", event_id: eventId },
      android: { priority: "HIGH", ttl: "60s" },
    })));
  }

  return jsonResponse({ stopped: true }, 200);
}
```

- [ ] **Step 2: Wire into dispatcher**

```typescript
if (body?.action === "force_ring_stop") {
  return handleForceRingStop(req, body, supabase, authClient);
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/push-notify/index.ts
git commit -m "feat(force_ring): add force_ring_stop Edge action"
```

---

### Task 2.3: Add force_ring_reminder action handler

**Files:**
- Modify: `supabase/functions/push-notify/index.ts`

- [ ] **Step 1: Add handler function**

```typescript
async function handleForceRingReminder(
  req: Request,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return jsonResponse({ error: "service_role_required" }, 401);
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: candidates, error: selErr } = await supabase
    .from("force_ring_events")
    .select("id, family_id, initiator_user_id, target_user_id")
    .not("delivered_at", "is", null)
    .is("acknowledged_at", null)
    .is("stopped_at", null)
    .lt("triggered_at", fiveMinAgo)
    .gt("triggered_at", fifteenMinAgo)
    .is("reminder_sent_at", null)
    .limit(50);

  if (selErr) return jsonResponse({ error: "select_failed", details: selErr }, 500);
  if (!candidates?.length) return jsonResponse({ reminded_count: 0 }, 200);

  let remindedCount = 0;
  for (const event of candidates) {
    const { data: tokens } = await supabase
      .from("native_push_tokens")
      .select("token, platform")
      .eq("user_id", event.initiator_user_id);

    const { data: webSubs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", event.initiator_user_id);

    const reminderPayload = {
      title: "응급 신호 5분 경과",
      body: "아이 응답이 없습니다. 직접 통화나 119를 고려하세요",
      data: { action: "force_ring_reminder", event_id: event.id },
    };

    if (tokens?.length) {
      await Promise.all(
        tokens.filter(t => t.platform === "android").map(t =>
          sendFcmNotification(t.token, reminderPayload)
        )
      );
    }
    if (webSubs?.length) {
      await Promise.all(webSubs.map(sub => sendWebPush(sub, reminderPayload)));
    }

    await supabase.from("force_ring_events")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", event.id);
    remindedCount++;
  }

  return jsonResponse({ reminded_count: remindedCount }, 200);
}
```

- [ ] **Step 2: Wire into dispatcher**

```typescript
if (body?.action === "force_ring_reminder") {
  return handleForceRingReminder(req, supabase);
}
```

- [ ] **Step 3: Verify `sendFcmNotification` and `sendWebPush` exist or reuse existing helpers**

These are already used elsewhere in push-notify for normal notifications. Reuse same pattern.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/push-notify/index.ts
git commit -m "feat(force_ring): add force_ring_reminder cron-triggered action"
```

---

### Task 2.4: Deploy Edge Function to branch + smoke test

- [ ] **Step 1: Deploy**

```bash
npx supabase functions deploy push-notify --no-verify-jwt
```

Expected: `Function push-notify deployed.`

- [ ] **Step 2: Curl smoke — invalid JWT**

```bash
curl -X POST "https://<branch-ref>.supabase.co/functions/v1/push-notify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid" \
  -d '{"action":"force_ring","family_id":"00000000-0000-0000-0000-000000000001"}'
```

Expected: `{"error":"invalid_jwt"}` HTTP 401.

- [ ] **Step 3: Curl smoke — service_role reminder (no candidates)**

```bash
curl -X POST "https://<branch-ref>.supabase.co/functions/v1/push-notify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"action":"force_ring_reminder"}'
```

Expected: `{"reminded_count":0}` HTTP 200.

- [ ] **Step 4: Curl smoke — wrong service role**

```bash
curl -X POST "https://<branch-ref>.supabase.co/functions/v1/push-notify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong_key" \
  -d '{"action":"force_ring_reminder"}'
```

Expected: `{"error":"service_role_required"}` HTTP 401.

---

# Phase 3: Client lib (`src/lib/forceRing.js`)

### Task 3.1: Write failing tests for forceRing client lib

**Files:**
- Create: `tests/forceRingClient.test.js`

- [ ] **Step 1: Write tests**

```javascript
// tests/forceRingClient.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFunctionsInvoke = vi.fn();
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn()
};
const mockSupabase = {
  functions: { invoke: mockFunctionsInvoke },
  channel: vi.fn().mockReturnValue(mockChannel),
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  is: vi.fn().mockReturnThis(),
};

vi.mock('../src/lib/supabase.js', () => ({ supabase: mockSupabase }));

describe('forceRing client lib', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFunctionsInvoke.mockReset();
  });

  describe('triggerForceRing', () => {
    it('truncates message to 80 chars', async () => {
      const { triggerForceRing } = await import('../src/lib/forceRing.js');
      mockFunctionsInvoke.mockResolvedValue({
        data: { event_id: 'evt-1', delivered: true }, error: null
      });

      const longMsg = 'a'.repeat(120);
      await triggerForceRing({ familyId: 'fam-1', message: longMsg });

      const callBody = mockFunctionsInvoke.mock.calls[0][1].body;
      expect(callBody.message.length).toBe(80);
    });

    it('generates client_request_hash automatically', async () => {
      const { triggerForceRing } = await import('../src/lib/forceRing.js');
      mockFunctionsInvoke.mockResolvedValue({
        data: { event_id: 'evt-1' }, error: null
      });

      await triggerForceRing({ familyId: 'fam-1', message: 'help' });

      const callBody = mockFunctionsInvoke.mock.calls[0][1].body;
      expect(callBody.client_request_hash).toBeTruthy();
      expect(callBody.client_request_hash.length).toBeGreaterThan(8);
    });

    it('returns error=force_ring_quota_exceeded on 429', async () => {
      const { triggerForceRing } = await import('../src/lib/forceRing.js');
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { context: { status: 429 }, message: 'force_ring_quota_exceeded' }
      });

      const result = await triggerForceRing({ familyId: 'fam-1' });
      expect(result.error).toBe('force_ring_quota_exceeded');
      expect(result.delivered).toBe(false);
    });

    it('throws on 5s timeout', async () => {
      const { triggerForceRing } = await import('../src/lib/forceRing.js');
      mockFunctionsInvoke.mockReturnValue(new Promise(() => {}));

      await expect(
        triggerForceRing({ familyId: 'fam-1', timeoutMs: 100 })
      ).rejects.toThrow(/timeout/i);
    });

    it('throws when familyId missing', async () => {
      const { triggerForceRing } = await import('../src/lib/forceRing.js');
      await expect(triggerForceRing({})).rejects.toThrow(/familyId/i);
    });
  });

  describe('stopForceRing', () => {
    it('calls force_ring_stop action with event_id', async () => {
      const { stopForceRing } = await import('../src/lib/forceRing.js');
      mockFunctionsInvoke.mockResolvedValue({ data: { stopped: true }, error: null });

      await stopForceRing('evt-1');

      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        'push-notify',
        expect.objectContaining({
          body: expect.objectContaining({ action: 'force_ring_stop', event_id: 'evt-1' })
        })
      );
    });

    it('throws when eventId missing', async () => {
      const { stopForceRing } = await import('../src/lib/forceRing.js');
      await expect(stopForceRing()).rejects.toThrow(/eventId/i);
    });
  });

  describe('subscribeForceRingStatus', () => {
    it('subscribes to force_ring_events:id=eq.<event_id>', async () => {
      const { subscribeForceRingStatus } = await import('../src/lib/forceRing.js');
      const callback = vi.fn();

      const channel = subscribeForceRingStatus('evt-1', callback);

      expect(mockSupabase.channel).toHaveBeenCalledWith(expect.stringContaining('evt-1'));
      expect(channel.subscribe).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
npm test -- tests/forceRingClient.test.js
```

Expected: FAIL — `Cannot find module '../src/lib/forceRing.js'`

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/forceRingClient.test.js
git commit -m "test(force_ring): add forceRing client lib tests (RED)"
```

---

### Task 3.2: Implement forceRing client lib

**Files:**
- Create: `src/lib/forceRing.js`

- [ ] **Step 1: Write implementation**

```javascript
// src/lib/forceRing.js
// Parent client helper — Edge Function `push-notify` action wrappers.
// Spec: docs/superpowers/specs/2026-04-27-force-ring-design.md

import { supabase } from './supabase.js';

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_MESSAGE_LENGTH = 80;

function generateRequestHash() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function withTimeout(promise, ms, label = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} after ${ms}ms`)), ms)
    )
  ]);
}

export async function triggerForceRing({ familyId, message = '', timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!familyId) throw new Error('familyId required');

  const truncated = String(message || '').slice(0, MAX_MESSAGE_LENGTH);
  const clientRequestHash = generateRequestHash();

  const invocation = supabase.functions.invoke('push-notify', {
    body: {
      action: 'force_ring',
      family_id: familyId,
      message: truncated,
      client_request_hash: clientRequestHash,
    }
  });

  const { data, error } = await withTimeout(invocation, timeoutMs, 'force_ring timeout');

  if (error) {
    const status = error?.context?.status;
    if (status === 429) {
      return { error: 'force_ring_quota_exceeded', delivered: false };
    }
    if (status === 423) {
      return { error: 'force_ring_already_active', delivered: false };
    }
    return { error: error.message || 'unknown_error', delivered: false };
  }

  return data;
}

export async function stopForceRing(eventId) {
  if (!eventId) throw new Error('eventId required');

  const { data, error } = await supabase.functions.invoke('push-notify', {
    body: { action: 'force_ring_stop', event_id: eventId }
  });

  if (error) return { stopped: false, error: error.message };
  return data;
}

export function subscribeForceRingStatus(eventId, callback) {
  if (!eventId) throw new Error('eventId required');

  const channel = supabase
    .channel(`force_ring_events:id=eq.${eventId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'force_ring_events',
        filter: `id=eq.${eventId}`
      },
      (payload) => callback(payload.new)
    )
    .subscribe();

  return channel;
}

export async function fetchActiveForceRing(familyId) {
  if (!familyId) return null;

  const { data, error } = await supabase
    .from('force_ring_events')
    .select('id, initiator_user_id, target_user_id, message, triggered_at, delivered_at, acknowledged_at, stopped_at, stop_reason')
    .eq('family_id', familyId)
    .is('stopped_at', null)
    .order('triggered_at', { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  return data[0];
}

export async function fetchForceRingHistory(familyId, limit = 10) {
  if (!familyId) return [];

  const { data, error } = await supabase
    .from('force_ring_events')
    .select('id, initiator_user_id, message, triggered_at, delivered_at, acknowledged_at, stopped_at, stop_reason')
    .eq('family_id', familyId)
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}
```

- [ ] **Step 2: Run tests**

```bash
npm test -- tests/forceRingClient.test.js
```

Expected: 8 tests pass (GREEN).

- [ ] **Step 3: Commit**

```bash
git add src/lib/forceRing.js
git commit -m "feat(force_ring): implement forceRing client lib (GREEN)"
```

---

# Phase 4: Parent UI Components

### Task 4.1: ForceRingTriggerButton (5s long-press)

**Files:**
- Create: `tests/forceRingPanel.test.jsx`
- Create: `src/components/ForceRingTriggerButton.jsx`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/forceRingPanel.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../src/lib/forceRing.js', () => ({
  triggerForceRing: vi.fn(),
  stopForceRing: vi.fn(),
  subscribeForceRingStatus: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  fetchActiveForceRing: vi.fn().mockResolvedValue(null),
  fetchForceRingHistory: vi.fn().mockResolvedValue([])
}));

import { ForceRingTriggerButton } from '../src/components/ForceRingTriggerButton.jsx';

describe('ForceRingTriggerButton', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('does NOT call onConfirm on quick tap (less than 5s)', () => {
    const onConfirm = vi.fn();
    render(<ForceRingTriggerButton onConfirm={onConfirm} disabled={false} />);

    const btn = screen.getByRole('button');
    fireEvent.mouseDown(btn);
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.mouseUp(btn);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm after 5 second long-press', () => {
    const onConfirm = vi.fn();
    render(<ForceRingTriggerButton onConfirm={onConfirm} disabled={false} />);

    const btn = screen.getByRole('button');
    fireEvent.mouseDown(btn);
    act(() => { vi.advanceTimersByTime(5100); });

    expect(onConfirm).toHaveBeenCalled();
  });

  it('does not trigger when disabled', () => {
    const onConfirm = vi.fn();
    render(<ForceRingTriggerButton onConfirm={onConfirm} disabled={true} />);

    const btn = screen.getByRole('button');
    fireEvent.mouseDown(btn);
    act(() => { vi.advanceTimersByTime(6000); });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — fail expected**

```bash
npm test -- tests/forceRingPanel.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write component**

```jsx
// src/components/ForceRingTriggerButton.jsx
import React, { useRef, useState, useCallback, useEffect } from 'react';

const HOLD_MS = 5000;

export function ForceRingTriggerButton({ onConfirm, disabled }) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setHolding(false);
    setProgress(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(() => {
    if (disabled) return;
    setHolding(true);
    setProgress(0);

    const startedAt = Date.now();
    intervalRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / HOLD_MS) * 100);
      setProgress(pct);
    }, 50);

    timerRef.current = setTimeout(() => {
      cleanup();
      onConfirm?.();
    }, HOLD_MS);
  }, [disabled, onConfirm, cleanup]);

  const cancel = useCallback(() => {
    if (timerRef.current) cleanup();
  }, [cleanup]);

  const remaining = Math.max(0, Math.ceil((HOLD_MS - (HOLD_MS * progress / 100)) / 1000));

  return (
    <button
      type="button"
      aria-label="5초 누르고 있기 (응급 신호 발송)"
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={start}
      onTouchEnd={cancel}
      onTouchCancel={cancel}
      style={{
        background: disabled ? '#9CA3AF' : (holding ? '#991B1B' : '#DC2626'),
        color: 'white',
        padding: '20px',
        border: 'none',
        borderRadius: '12px',
        width: '100%',
        minHeight: '56px',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span style={{
        position: 'absolute', top: 0, left: 0, height: '100%',
        width: `${progress}%`, background: 'rgba(255,255,255,0.2)',
        transition: 'width 50ms linear', pointerEvents: 'none'
      }} />
      <span style={{ position: 'relative', display: 'block' }}>
        🔴 5초 누르고 있기 (응급 신호 발송)
        {holding && (
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            응급 알람을 발송하려면 계속 누르세요... ({remaining}초 남음)
          </div>
        )}
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
npm test -- tests/forceRingPanel.test.jsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/forceRingPanel.test.jsx src/components/ForceRingTriggerButton.jsx
git commit -m "feat(force_ring): implement ForceRingTriggerButton (5s long-press)"
```

---

### Task 4.2: ForceRingConfirmModal

**Files:**
- Modify: `tests/forceRingPanel.test.jsx`
- Create: `src/components/ForceRingConfirmModal.jsx`

- [ ] **Step 1: Append tests**

```javascript
// Append to tests/forceRingPanel.test.jsx
import { ForceRingConfirmModal } from '../src/components/ForceRingConfirmModal.jsx';

describe('ForceRingConfirmModal', () => {
  it('truncates input over 80 chars', () => {
    render(<ForceRingConfirmModal isOpen={true} onCancel={() => {}}
      onConfirm={() => {}} quotaInfo={{ quota: 1, used: 0 }} />);

    const ta = screen.getByPlaceholderText(/지금 바로 전화 줘/);
    fireEvent.change(ta, { target: { value: 'a'.repeat(120) } });

    expect(ta.value.length).toBe(80);
  });

  it('shows quota remaining', () => {
    render(<ForceRingConfirmModal isOpen={true} onCancel={() => {}}
      onConfirm={() => {}} quotaInfo={{ quota: 10, used: 3 }} />);
    expect(screen.getByText(/7 \/ 10/)).toBeDefined();
  });

  it('passes message to onConfirm', () => {
    const onConfirm = vi.fn();
    render(<ForceRingConfirmModal isOpen={true} onCancel={() => {}}
      onConfirm={onConfirm} quotaInfo={{ quota: 1, used: 0 }} />);

    const ta = screen.getByPlaceholderText(/지금 바로 전화 줘/);
    fireEvent.change(ta, { target: { value: '도와줘' } });
    fireEvent.click(screen.getByLabelText('응급 신호 보내기'));

    expect(onConfirm).toHaveBeenCalledWith('도와줘');
  });

  it('returns null when isOpen false', () => {
    const { container } = render(<ForceRingConfirmModal isOpen={false}
      onCancel={() => {}} onConfirm={() => {}} quotaInfo={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run — fail expected**

```bash
npm test -- tests/forceRingPanel.test.jsx
```

- [ ] **Step 3: Write component**

```jsx
// src/components/ForceRingConfirmModal.jsx
import React, { useState } from 'react';

export function ForceRingConfirmModal({ isOpen, onCancel, onConfirm, quotaInfo }) {
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const remaining = quotaInfo ? quotaInfo.quota - quotaInfo.used : null;

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: 'white', padding: 24, borderRadius: 12,
        maxWidth: 480, width: '90%', maxHeight: '90vh', overflowY: 'auto'
      }}>
        <h2 style={{ color: '#DC2626', marginTop: 0 }}>정말 응급 신호를 보낼까요?</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>아이 폰: 무음·방해금지 우회 풀볼륨</li>
          <li>풀스크린 알람 15초</li>
          <li>잠금 화면 위에 표시됨</li>
        </ul>

        <label style={{ display: 'block', marginTop: 16 }}>
          메시지 (선택, 80자)
          <textarea
            maxLength={80}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 80))}
            placeholder="예: 지금 바로 전화 줘"
            style={{ width: '100%', minHeight: 60, marginTop: 8, padding: 8 }}
          />
          <div style={{ fontSize: 12, textAlign: 'right' }}>{message.length} / 80</div>
        </label>

        {remaining !== null && (
          <p style={{ marginTop: 16 }}>
            오늘 남은 횟수: {remaining} / {quotaInfo.quota}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: 12, border: '1px solid #D1D5DB',
              background: 'white', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}
          >취소</button>
          <button
            onClick={() => onConfirm(message)}
            aria-label="응급 신호 보내기"
            style={{ flex: 2, padding: 12, border: 'none', background: '#DC2626',
              color: 'white', borderRadius: 8, fontSize: 16, fontWeight: 'bold',
              cursor: 'pointer' }}
          >🔴 응급 신호 보내기</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/forceRingPanel.test.jsx
```

Expected: 7 tests pass total (3 from 4.1 + 4 from 4.2).

- [ ] **Step 5: Commit**

```bash
git add tests/forceRingPanel.test.jsx src/components/ForceRingConfirmModal.jsx
git commit -m "feat(force_ring): implement ForceRingConfirmModal"
```

---

### Task 4.3: ForceRingActiveStatus + tests

**Files:**
- Create: `tests/forceRingActiveStatus.test.jsx`
- Create: `src/components/ForceRingActiveStatus.jsx`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/forceRingActiveStatus.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../src/lib/forceRing.js', () => ({
  subscribeForceRingStatus: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  stopForceRing: vi.fn(),
}));

import { ForceRingActiveStatus } from '../src/components/ForceRingActiveStatus.jsx';

describe('ForceRingActiveStatus', () => {
  it('renders 전송중 when delivered_at null and no stop', () => {
    const event = { id: 'evt-1', delivered_at: null, acknowledged_at: null, stopped_at: null };
    render(<ForceRingActiveStatus event={event} />);
    expect(screen.getByText(/전달 시도 중/)).toBeDefined();
  });

  it('renders 전달됨 + 응답 대기 when delivered, not acked', () => {
    const event = {
      id: 'evt-1',
      delivered_at: '2026-04-27T14:32:15Z',
      acknowledged_at: null,
      stopped_at: null
    };
    render(<ForceRingActiveStatus event={event} />);
    expect(screen.getByText(/전달됨/)).toBeDefined();
    expect(screen.getByText(/아이 응답 대기 중/)).toBeDefined();
  });

  it('renders 확인됨 when acknowledged_at set', () => {
    const event = {
      id: 'evt-1',
      delivered_at: '2026-04-27T14:32:15Z',
      acknowledged_at: '2026-04-27T14:32:27Z',
      stopped_at: '2026-04-27T14:32:27Z',
      stop_reason: 'child_ack'
    };
    render(<ForceRingActiveStatus event={event} />);
    expect(screen.getByText(/아이가 확인했어요/)).toBeDefined();
  });

  it('renders "그만 울릴께요" button when active and not acked', () => {
    const event = {
      id: 'evt-1',
      delivered_at: '2026-04-27T14:32:15Z',
      acknowledged_at: null,
      stopped_at: null
    };
    render(<ForceRingActiveStatus event={event} />);
    expect(screen.getByLabelText(/그만 울릴께요/)).toBeDefined();
  });

  it('renders 전달 실패 with 119 fallback when stop_reason=delivery_failed', () => {
    const event = {
      id: 'evt-1', delivered_at: null,
      stopped_at: '2026-04-27T14:32:25Z', stop_reason: 'delivery_failed'
    };
    render(<ForceRingActiveStatus event={event} />);
    expect(screen.getByText(/전달 실패/)).toBeDefined();
    expect(screen.getByText(/119/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Write component**

```jsx
// src/components/ForceRingActiveStatus.jsx
import React, { useEffect, useState } from 'react';
import { subscribeForceRingStatus, stopForceRing } from '../lib/forceRing.js';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour12: false });
}

export function ForceRingActiveStatus({ event: initialEvent, onCleared }) {
  const [event, setEvent] = useState(initialEvent);

  useEffect(() => {
    if (!initialEvent?.id) return;
    const ch = subscribeForceRingStatus(initialEvent.id, (updated) => {
      setEvent((prev) => ({ ...prev, ...updated }));
    });
    return () => ch?.unsubscribe?.();
  }, [initialEvent?.id]);

  if (!event) return null;

  if (event.stop_reason === 'delivery_failed') {
    return (
      <div style={errorBox}>
        <h3>✗ 전달 실패</h3>
        <p>아이 폰이 오프라인이거나 배터리가 꺼졌을 수 있습니다.</p>
        <p style={{ fontSize: 12, color: '#6B7280' }}>(오늘 사용 횟수 차감되지 않음)</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <a href="tel:" style={btnFallback}>📞 직접 통화하기</a>
          <a href="tel:119" style={btnEmergency}>🚨 119</a>
        </div>
      </div>
    );
  }

  if (event.acknowledged_at) {
    const responseSec = Math.round(
      (new Date(event.acknowledged_at) - new Date(event.delivered_at)) / 1000
    );
    return (
      <div style={successBox}>
        <h3>✓ 아이가 확인했어요</h3>
        <p>{fmtTime(event.acknowledged_at)} ({responseSec}초 응답)</p>
      </div>
    );
  }

  if (event.stopped_at && event.stop_reason !== 'delivery_failed') {
    const reasonText = {
      parent_stop: '부모 정지',
      auto_timeout: '15초 자동 종료',
      child_ack: '확인됨'
    }[event.stop_reason] || '종료됨';
    return (
      <div style={successBox}>
        <h3>✓ 알람 정지됨</h3>
        <p>{fmtTime(event.stopped_at)} — {reasonText}</p>
      </div>
    );
  }

  if (event.delivered_at) {
    return (
      <div style={infoBox}>
        <h3>✓ 전달됨 {fmtTime(event.delivered_at)}</h3>
        <p>아이 응답 대기 중...</p>
        <button
          onClick={() => stopForceRing(event.id)}
          aria-label="그만 울릴께요"
          style={btnStop}
        >🛑 그만 울릴께요</button>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <a href="tel:" style={btnFallbackSmall}>📞 직접 통화하기</a>
          <a href="tel:119" style={btnEmergencySmall}>🚨 119</a>
        </div>
      </div>
    );
  }

  return (
    <div style={infoBox}>
      <h3>전달 시도 중...</h3>
      <p style={{ fontSize: 12 }}>10분 후 자동 취소</p>
    </div>
  );
}

const errorBox = { background: '#FEE2E2', border: '2px solid #DC2626', padding: 16, borderRadius: 8 };
const successBox = { background: '#D1FAE5', border: '2px solid #059669', padding: 16, borderRadius: 8 };
const infoBox = { background: '#DBEAFE', border: '2px solid #2563EB', padding: 16, borderRadius: 8 };
const btnFallback = { flex: 1, padding: 12, background: '#1F2937', color: 'white', borderRadius: 8, textAlign: 'center', textDecoration: 'none' };
const btnEmergency = { flex: 1, padding: 12, background: '#DC2626', color: 'white', borderRadius: 8, textAlign: 'center', textDecoration: 'none' };
const btnFallbackSmall = { ...btnFallback, padding: 8, fontSize: 14 };
const btnEmergencySmall = { ...btnEmergency, padding: 8, fontSize: 14 };
const btnStop = { width: '100%', padding: 12, background: '#DC2626', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 'bold', cursor: 'pointer', marginTop: 12 };
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/forceRingActiveStatus.test.jsx
```

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/forceRingActiveStatus.test.jsx src/components/ForceRingActiveStatus.jsx
git commit -m "feat(force_ring): implement ForceRingActiveStatus component"
```

---

### Task 4.4: ForceRingHistory + tests

**Files:**
- Create: `tests/forceRingHistory.test.js`
- Create: `src/components/ForceRingHistory.jsx`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/forceRingHistory.test.js
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockFetch = vi.fn();
vi.mock('../src/lib/forceRing.js', () => ({
  fetchForceRingHistory: (...args) => mockFetch(...args)
}));

import { ForceRingHistory } from '../src/components/ForceRingHistory.jsx';

describe('ForceRingHistory', () => {
  it('renders 확인됨 label for child_ack events', async () => {
    mockFetch.mockResolvedValue([
      { id: '1', triggered_at: '2026-04-26T14:32:00Z',
        delivered_at: '2026-04-26T14:32:00Z',
        stopped_at: '2026-04-26T14:32:12Z',
        acknowledged_at: '2026-04-26T14:32:12Z', stop_reason: 'child_ack' }
    ]);
    render(<ForceRingHistory familyId="fam-1" />);
    await waitFor(() => expect(screen.getByText(/확인됨/)).toBeDefined());
  });

  it('renders 자동 종료 label for auto_timeout', async () => {
    mockFetch.mockResolvedValue([
      { id: '1', triggered_at: '2026-04-25T09:15:00Z',
        stopped_at: '2026-04-25T09:15:15Z', stop_reason: 'auto_timeout' }
    ]);
    render(<ForceRingHistory familyId="fam-1" />);
    await waitFor(() => expect(screen.getByText(/자동 종료/)).toBeDefined());
  });

  it('renders empty state when no history', async () => {
    mockFetch.mockResolvedValue([]);
    render(<ForceRingHistory familyId="fam-1" />);
    await waitFor(() => expect(screen.getByText(/사용 내역 없음/)).toBeDefined());
  });
});
```

- [ ] **Step 2: Write component**

```jsx
// src/components/ForceRingHistory.jsx
import React, { useEffect, useState } from 'react';
import { fetchForceRingHistory } from '../lib/forceRing.js';

const STOP_LABELS = {
  child_ack: '확인됨',
  parent_stop: '부모 정지',
  auto_timeout: '자동 종료',
  delivery_failed: '전달 실패',
};

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

export function ForceRingHistory({ familyId, limit = 10 }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!familyId) return;
    fetchForceRingHistory(familyId, limit).then(setItems);
  }, [familyId, limit]);

  if (items === null) return <div>불러오는 중...</div>;
  if (!items.length) return <div style={{ color: '#6B7280' }}>사용 내역 없음</div>;

  return (
    <details style={{ marginTop: 16 }}>
      <summary>최근 사용 내역 ({items.length}건)</summary>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map(item => (
          <li key={item.id} style={{ padding: 8, borderBottom: '1px solid #E5E7EB' }}>
            <span>{fmtDate(item.triggered_at)}</span>
            {' · '}
            <span>{STOP_LABELS[item.stop_reason] || '진행 중'}</span>
            {item.acknowledged_at && item.delivered_at && (
              <span style={{ color: '#6B7280', fontSize: 12 }}>
                {' '}({Math.round((new Date(item.acknowledged_at) - new Date(item.delivered_at)) / 1000)}s 응답)
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/forceRingHistory.test.js
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/forceRingHistory.test.js src/components/ForceRingHistory.jsx
git commit -m "feat(force_ring): implement ForceRingHistory component"
```

---

### Task 4.5: ForceRingPanel orchestrator

**Files:**
- Create: `src/components/ForceRingPanel.jsx`

- [ ] **Step 1: Write component**

```jsx
// src/components/ForceRingPanel.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { ForceRingTriggerButton } from './ForceRingTriggerButton.jsx';
import { ForceRingConfirmModal } from './ForceRingConfirmModal.jsx';
import { ForceRingActiveStatus } from './ForceRingActiveStatus.jsx';
import { ForceRingHistory } from './ForceRingHistory.jsx';
import { triggerForceRing, fetchActiveForceRing } from '../lib/forceRing.js';
import { supabase } from '../lib/supabase.js';

export function ForceRingPanel({ familyId, hasChild = true }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!familyId) return;
    const [active, quotaResult] = await Promise.all([
      fetchActiveForceRing(familyId),
      supabase.rpc('force_ring_check_quota', { p_family_id: familyId })
    ]);
    setActiveEvent(active);
    setQuotaInfo(quotaResult.data);
  }, [familyId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleConfirm = async (message) => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await triggerForceRing({ familyId, message });
      if (result.error === 'force_ring_quota_exceeded') {
        setError('quota_exceeded');
      } else if (result.error === 'force_ring_already_active') {
        setError('already_active');
        await refresh();
      } else if (result.event_id) {
        setActiveEvent({
          id: result.event_id,
          delivered_at: result.delivered ? new Date().toISOString() : null,
          stopped_at: result.delivered ? null : new Date().toISOString(),
          stop_reason: result.delivered ? null : 'delivery_failed'
        });
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'unknown');
    } finally {
      setSubmitting(false);
      setModalOpen(false);
    }
  };

  if (!hasChild) {
    return (
      <section style={panelStyle}>
        <h2>⚠️ 응급 강제 알람</h2>
        <p style={{ color: '#6B7280' }}>아이 페어링 후 사용 가능합니다.</p>
      </section>
    );
  }

  const quotaRemaining = quotaInfo ? quotaInfo.quota - quotaInfo.used : null;
  const isDisabled = submitting || !!activeEvent ||
    (quotaRemaining !== null && quotaRemaining <= 0);

  return (
    <section style={panelStyle}>
      <h2>⚠️ 응급 강제 알람</h2>
      <p>아이 폰이 무음·방해금지여도 풀볼륨 알람을 15초간 강제로 울립니다.</p>
      <p style={{ color: '#DC2626', fontSize: 14 }}>
        ⚠ 진짜 응급 시에만 사용하세요. 평상시 연락은 일반 알림으로.
      </p>

      {quotaInfo && (
        <p>오늘 남은 횟수: {quotaInfo.quota - quotaInfo.used} / {quotaInfo.quota}</p>
      )}

      {activeEvent ? (
        <ForceRingActiveStatus
          event={activeEvent}
          onCleared={() => { setActiveEvent(null); refresh(); }}
        />
      ) : error === 'quota_exceeded' ? (
        <div style={{ background: '#FEF3C7', padding: 16, borderRadius: 8 }}>
          <p>⚠ 오늘 사용 한도 초과 ({quotaInfo?.used}/{quotaInfo?.quota})</p>
          {quotaInfo?.tier === 'free' && (
            <p>프리미엄으로 업그레이드 시 일 10회까지 사용 가능</p>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <a href="tel:" style={fallbackBtn}>📞 직접 통화하기</a>
            <a href="tel:119" style={emergencyBtn}>🚨 119</a>
          </div>
        </div>
      ) : (
        <ForceRingTriggerButton
          disabled={isDisabled}
          onConfirm={() => setModalOpen(true)}
        />
      )}

      <ForceRingConfirmModal
        isOpen={modalOpen}
        quotaInfo={quotaInfo}
        onCancel={() => setModalOpen(false)}
        onConfirm={handleConfirm}
      />

      <ForceRingHistory familyId={familyId} />
    </section>
  );
}

const panelStyle = {
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: 16,
  marginTop: 16
};
const fallbackBtn = { flex: 1, padding: 8, background: '#1F2937', color: 'white',
  textAlign: 'center', borderRadius: 8, textDecoration: 'none' };
const emergencyBtn = { flex: 1, padding: 8, background: '#DC2626', color: 'white',
  textAlign: 'center', borderRadius: 8, textDecoration: 'none' };
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ForceRingPanel.jsx
git commit -m "feat(force_ring): implement ForceRingPanel orchestrator"
```

---

### Task 4.6: Wire ForceRingPanel into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Find safety tools section**

```bash
grep -n "안전 도구\|RemoteListenButton\|safety" src/App.jsx | head -20
```

Identify the existing safety panel area near `RemoteListenButton`. Note variable names for `currentFamily`, `hasChildInFamily` (or equivalent state in the file).

- [ ] **Step 2: Add import**

Find the existing component imports section in App.jsx and add:

```jsx
import { ForceRingPanel } from './components/ForceRingPanel.jsx';
```

- [ ] **Step 3: Insert ForceRingPanel in safety tools section**

In the JSX area where safety tools are rendered (near `RemoteListenButton`):

```jsx
{/* Force Ring (강제 소리 울리기) — Spec: docs/superpowers/specs/2026-04-27-force-ring-design.md */}
{currentFamily?.id && (
  <ForceRingPanel
    familyId={currentFamily.id}
    hasChild={hasChildInFamily}
  />
)}
```

(Use the actual variable names from the file. Common existing names: `family`, `currentFamily`, `selectedFamily`, `childMember`, `hasChild`, etc.)

- [ ] **Step 4: Smoke in browser**

```bash
npm run dev
# Open browser → log in as parent → navigate to settings/safety tools
# Verify ForceRingPanel renders with "오늘 남은 횟수" line
```

- [ ] **Step 5: Run all unit tests one more time**

```bash
npm test -- tests/forceRing
```

Expected: All Phase 3+4 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(force_ring): wire ForceRingPanel into App.jsx safety tools"
```

---

### Task 4.7: Mocked Playwright E2E specs

**Files:**
- Create: `tests/e2e/force-ring-trigger.spec.js`
- Create: `tests/e2e/force-ring-quota.spec.js`
- Create: `tests/e2e/force-ring-failure.spec.js`
- Create: `tests/e2e/force-ring-realtime.spec.js`

- [ ] **Step 1: Write trigger spec**

```javascript
// tests/e2e/force-ring-trigger.spec.js
import { test, expect } from '@playwright/test';

test('force_ring trigger: long-press → modal → send → delivered status', async ({ page }) => {
  await page.route('**/functions/v1/push-notify', route => {
    const body = route.request().postDataJSON();
    if (body.action === 'force_ring') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ event_id: 'evt-test-1', delivered: true, quota_remaining: 0 })
      });
    }
    return route.continue();
  });

  await page.route('**/rest/v1/rpc/force_ring_check_quota', route => {
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ allowed: true, quota: 1, used: 0, tier: 'free' })
    });
  });

  await page.goto('/');
  // Login (use existing fixture pattern from other e2e specs)
  // Navigate to settings → safety tools

  await expect(page.getByText('응급 강제 알람')).toBeVisible();

  const trigger = page.getByRole('button', { name: /5초 누르고 있기/ });
  await trigger.dispatchEvent('mousedown');
  await page.waitForTimeout(5200);

  await expect(page.getByText('정말 응급 신호를 보낼까요?')).toBeVisible();
  await page.fill('textarea', '도와줘');
  await page.getByLabel('응급 신호 보내기').click();

  await expect(page.getByText(/전달됨/)).toBeVisible();
});
```

- [ ] **Step 2: Write quota spec**

```javascript
// tests/e2e/force-ring-quota.spec.js
import { test, expect } from '@playwright/test';

test('force_ring quota exceeded: paywall + 119 fallback', async ({ page }) => {
  await page.route('**/rest/v1/rpc/force_ring_check_quota', route => {
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ allowed: false, quota: 1, used: 1, tier: 'free' })
    });
  });

  await page.route('**/functions/v1/push-notify', route =>
    route.fulfill({
      status: 429, contentType: 'application/json',
      body: JSON.stringify({ error: 'force_ring_quota_exceeded', quota: 1, used: 1, tier: 'free' })
    })
  );

  await page.goto('/');
  // Login + navigate

  const trigger = page.getByRole('button', { name: /5초 누르고 있기/ });
  await trigger.dispatchEvent('mousedown');
  await page.waitForTimeout(5200);
  await page.getByLabel('응급 신호 보내기').click();

  await expect(page.getByText(/오늘 사용 한도 초과/)).toBeVisible();
  await expect(page.getByText('🚨 119')).toBeVisible();
});
```

- [ ] **Step 3: Write failure spec**

```javascript
// tests/e2e/force-ring-failure.spec.js
import { test, expect } from '@playwright/test';

test('force_ring delivery failure shows fallback', async ({ page }) => {
  await page.route('**/rest/v1/rpc/force_ring_check_quota', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ allowed: true, quota: 1, used: 0, tier: 'free' })
  }));

  await page.route('**/functions/v1/push-notify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ event_id: 'evt-fail', delivered: false, error: 'no_fcm_tokens' })
  }));

  await page.goto('/');
  // Login + navigate

  const trigger = page.getByRole('button', { name: /5초 누르고 있기/ });
  await trigger.dispatchEvent('mousedown');
  await page.waitForTimeout(5200);
  await page.getByLabel('응급 신호 보내기').click();

  await expect(page.getByText(/전달 실패/)).toBeVisible();
  await expect(page.getByText('🚨 119')).toBeVisible();
});
```

- [ ] **Step 4: Write realtime spec (skippable if Realtime mock not set up)**

```javascript
// tests/e2e/force-ring-realtime.spec.js
import { test, expect } from '@playwright/test';

test.skip('force_ring acknowledges via realtime update (TODO: Realtime mock fixture)',
  async ({ page }) => {
    // Requires either:
    //   - Real Supabase connection (use real config) OR
    //   - Custom Realtime mock that injects postgres_changes payload
    // Document as deferred to real-services e2e in Phase 6.
  }
);
```

- [ ] **Step 5: Run all e2e mocked**

```bash
npx playwright test tests/e2e/force-ring-*.spec.js
```

Expected: 3 specs pass + 1 skipped (realtime).

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/force-ring-*.spec.js
git commit -m "test(force_ring): add 4 mocked Playwright e2e specs (1 skipped)"
```

---

# Phase 5: Native Android

### Task 5.1: Add audio asset

**Files:**
- Create: `android/app/src/main/res/raw/force_ring_alarm.ogg`

- [ ] **Step 1: Source CC0 audio**

Download a CC0-licensed alarm sound (≤3s, mono, 44.1kHz, .ogg vorbis):
- https://freesound.org/search/?q=alarm+beep&f=license:%22Creative+Commons+0%22

Save to `android/app/src/main/res/raw/force_ring_alarm.ogg`.

If no asset readily available, use system default fallback in code:

```java
// In ForceRingService.playAlarm(), replace alarmUri build with:
Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
// Mark TODO comment for asset replacement post-launch
```

- [ ] **Step 2: Verify size**

```bash
ls -lh android/app/src/main/res/raw/force_ring_alarm.ogg
# Expected: < 50 KB
```

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/res/raw/force_ring_alarm.ogg
git commit -m "feat(force_ring): add force_ring_alarm.ogg audio asset"
```

(If using system fallback, skip this commit and document in 5.5 Step 1.)

---

### Task 5.2: Activity layout + theme

**Files:**
- Create: `android/app/src/main/res/layout/activity_force_ring.xml`
- Modify: `android/app/src/main/res/values/styles.xml`

- [ ] **Step 1: Write layout XML**

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#DC2626"
    android:padding="24dp">

  <TextView
      android:id="@+id/icon_emoji"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="🚨"
      android:textSize="96sp"
      app:layout_constraintTop_toTopOf="parent"
      app:layout_constraintStart_toStartOf="parent"
      app:layout_constraintEnd_toEndOf="parent"
      android:layout_marginTop="48dp" />

  <TextView
      android:id="@+id/title_text"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="응급 신호"
      android:textColor="#FFFFFF"
      android:textSize="32sp"
      android:textStyle="bold"
      app:layout_constraintTop_toBottomOf="@id/icon_emoji"
      app:layout_constraintStart_toStartOf="parent"
      app:layout_constraintEnd_toEndOf="parent" />

  <TextView
      android:id="@+id/initiator_text"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:textColor="#FFFFFF"
      android:textSize="20sp"
      app:layout_constraintTop_toBottomOf="@id/title_text"
      app:layout_constraintStart_toStartOf="parent"
      app:layout_constraintEnd_toEndOf="parent"
      android:layout_marginTop="8dp" />

  <TextView
      android:id="@+id/time_text"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:textColor="#FFFFFF"
      android:textSize="16sp"
      app:layout_constraintTop_toBottomOf="@id/initiator_text"
      app:layout_constraintStart_toStartOf="parent"
      app:layout_constraintEnd_toEndOf="parent" />

  <androidx.cardview.widget.CardView
      android:id="@+id/message_card"
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_marginTop="24dp"
      android:layout_marginStart="16dp"
      android:layout_marginEnd="16dp"
      app:cardBackgroundColor="#FFFFFF"
      app:cardCornerRadius="8dp"
      app:layout_constraintTop_toBottomOf="@id/time_text"
      app:layout_constraintStart_toStartOf="parent"
      app:layout_constraintEnd_toEndOf="parent">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:padding="16dp">

      <TextView
          android:layout_width="wrap_content"
          android:layout_height="wrap_content"
          android:text="부모님이 남긴 메시지"
          android:textColor="#6B7280"
          android:textSize="12sp" />

      <TextView
          android:id="@+id/message_text"
          android:layout_width="wrap_content"
          android:layout_height="wrap_content"
          android:textColor="#1F2937"
          android:textSize="16sp"
          android:layout_marginTop="4dp" />
    </LinearLayout>
  </androidx.cardview.widget.CardView>

  <TextView
      android:id="@+id/countdown_text"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:textColor="#FFFFFF"
      android:textSize="14sp"
      android:layout_marginTop="32dp"
      app:layout_constraintTop_toBottomOf="@id/message_card"
      app:layout_constraintStart_toStartOf="parent"
      app:layout_constraintEnd_toEndOf="parent" />

  <Button
      android:id="@+id/btn_ack"
      android:layout_width="0dp"
      android:layout_height="80dp"
      android:text="✓ 확인했어요"
      android:textColor="#DC2626"
      android:textSize="28sp"
      android:textStyle="bold"
      android:background="@android:color/white"
      android:layout_marginStart="24dp"
      android:layout_marginEnd="24dp"
      android:layout_marginBottom="24dp"
      app:layout_constraintBottom_toTopOf="@id/footer_text"
      app:layout_constraintStart_toStartOf="parent"
      app:layout_constraintEnd_toEndOf="parent" />

  <TextView
      android:id="@+id/footer_text"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="※ 부모님이 응급 신호로 보낸 알람이라 무음모드를 우회했어요"
      android:textColor="#FECACA"
      android:textSize="12sp"
      android:layout_marginBottom="16dp"
      app:layout_constraintBottom_toBottomOf="parent"
      app:layout_constraintStart_toStartOf="parent"
      app:layout_constraintEnd_toEndOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>
```

- [ ] **Step 2: Add theme to styles.xml**

Append to `<resources>` block in `android/app/src/main/res/values/styles.xml`:

```xml
<style name="Theme.Hyeni.ForceRing.Fullscreen" parent="Theme.AppCompat.NoActionBar">
  <item name="android:windowNoTitle">true</item>
  <item name="android:windowFullscreen">true</item>
  <item name="android:windowContentOverlay">@null</item>
  <item name="android:statusBarColor">#DC2626</item>
  <item name="android:navigationBarColor">#DC2626</item>
</style>
```

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/res/layout/activity_force_ring.xml \
        android/app/src/main/res/values/styles.xml
git commit -m "feat(force_ring): add fullscreen activity layout + theme"
```

---

### Task 5.3: ForceRingRequestStore

**Files:**
- Create: `android/app/src/main/java/com/hyeni/calendar/ForceRingRequestStore.java`

- [ ] **Step 1: Write file**

```java
package com.hyeni.calendar;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.Nullable;

import java.util.concurrent.TimeUnit;

final class ForceRingRequestStore {

    private static final String PREFS_NAME = "hyeni_force_ring_requests";
    private static final long RECENT_WINDOW_MS = TimeUnit.MINUTES.toMillis(5);

    private ForceRingRequestStore() {}

    static void markLauncherShown(Context context, @Nullable String eventId) {
        if (context == null || isBlank(eventId)) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putLong(keyFor(eventId), System.currentTimeMillis()).apply();
    }

    static boolean wasLauncherRecentlyShown(Context context, @Nullable String eventId) {
        if (context == null || isBlank(eventId)) return false;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long shownAt = prefs.getLong(keyFor(eventId), 0L);
        if (shownAt <= 0L) return false;
        long ageMs = System.currentTimeMillis() - shownAt;
        return ageMs >= 0L && ageMs <= RECENT_WINDOW_MS;
    }

    private static String keyFor(String eventId) {
        return "force_ring_launcher_" + eventId;
    }

    private static boolean isBlank(@Nullable String value) {
        return value == null || value.trim().isEmpty();
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/java/com/hyeni/calendar/ForceRingRequestStore.java
git commit -m "feat(force_ring): add ForceRingRequestStore (dedup pattern)"
```

---

### Task 5.4: NotificationHelper.ensureForceRingChannel

**Files:**
- Modify: `android/app/src/main/java/com/hyeni/calendar/NotificationHelper.java`

- [ ] **Step 1: Add method + imports**

Add imports at top of NotificationHelper.java if not present:

```java
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
```

Append to the class body:

```java
public static final String FORCE_RING_CHANNEL_ID = "force_ring_emergency";

public static void ensureForceRingChannel(Context ctx) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = ctx.getSystemService(NotificationManager.class);
    if (nm == null) return;
    if (nm.getNotificationChannel(FORCE_RING_CHANNEL_ID) != null) return;

    NotificationChannel ch = new NotificationChannel(
        FORCE_RING_CHANNEL_ID,
        "응급 강제 알람",
        NotificationManager.IMPORTANCE_HIGH
    );
    ch.setDescription("부모가 직접 트리거한 응급 신호. 무음/방해금지를 우회합니다.");
    ch.setBypassDnd(true);
    ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    ch.enableVibration(true);
    ch.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});

    Uri alarmUri = new Uri.Builder()
        .scheme(ContentResolver.SCHEME_ANDROID_RESOURCE)
        .authority(ctx.getPackageName())
        .appendPath(String.valueOf(R.raw.force_ring_alarm))
        .build();

    AudioAttributes attrs = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build();
    ch.setSound(alarmUri, attrs);
    nm.createNotificationChannel(ch);
}
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/java/com/hyeni/calendar/NotificationHelper.java
git commit -m "feat(force_ring): add force_ring_emergency notification channel"
```

---

### Task 5.5: ForceRingService (FGS)

**Files:**
- Create: `android/app/src/main/java/com/hyeni/calendar/ForceRingService.java`

- [ ] **Step 1: Write file**

```java
package com.hyeni.calendar;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class ForceRingService extends Service {
    public static final String EXTRA_EVENT_ID = "event_id";
    public static final String EXTRA_MESSAGE = "message";
    public static final String EXTRA_INITIATOR = "initiator_name";
    public static final int NOTIF_ID = 7301;
    private static final long HARD_CAP_MS = 15_000L;

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private AudioManager audioManager;
    private int originalAlarmVolume = -1;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoStop = this::stopSelf;
    private String currentEventId;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        currentEventId = intent.getStringExtra(EXTRA_EVENT_ID);
        String message = intent.getStringExtra(EXTRA_MESSAGE);
        String initiator = intent.getStringExtra(EXTRA_INITIATOR);

        NotificationHelper.ensureForceRingChannel(this);

        Intent activityIntent = new Intent(this, ForceRingActivity.class);
        activityIntent.putExtra(EXTRA_EVENT_ID, currentEventId);
        activityIntent.putExtra(EXTRA_MESSAGE, message);
        activityIntent.putExtra(EXTRA_INITIATOR, initiator);
        activityIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            | Intent.FLAG_ACTIVITY_NO_HISTORY);

        PendingIntent fullScreenPI = PendingIntent.getActivity(
            this, 0, activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int iconRes = getApplicationInfo().icon != 0
            ? getApplicationInfo().icon
            : android.R.drawable.ic_dialog_alert;

        Notification notif = new NotificationCompat.Builder(this, NotificationHelper.FORCE_RING_CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle("응급 신호: " + (initiator != null ? initiator : "부모님"))
            .setContentText(message != null ? message : "")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPI, true)
            .setOngoing(true)
            .setAutoCancel(false)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIF_ID, notif);
        }

        playAlarm();
        startVibration();
        handler.postDelayed(autoStop, HARD_CAP_MS);

        return START_NOT_STICKY;
    }

    private void playAlarm() {
        try {
            audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
            originalAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
            int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, max, 0);

            Uri alarmUri;
            try {
                alarmUri = new Uri.Builder()
                    .scheme(android.content.ContentResolver.SCHEME_ANDROID_RESOURCE)
                    .authority(getPackageName())
                    .appendPath(String.valueOf(R.raw.force_ring_alarm))
                    .build();
            } catch (Exception fallback) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            }

            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(attrs);
            mediaPlayer.setDataSource(this, alarmUri);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            android.util.Log.e("ForceRingService", "Failed to play alarm", e);
        }
    }

    private void startVibration() {
        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        long[] pattern = { 0, 1000, 500, 1000, 500, 1000 };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
        } else {
            vibrator.vibrate(pattern, 0);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        handler.removeCallbacks(autoStop);
        if (mediaPlayer != null) {
            try { mediaPlayer.stop(); mediaPlayer.release(); } catch (Exception ignored) {}
            mediaPlayer = null;
        }
        if (audioManager != null && originalAlarmVolume >= 0) {
            try { audioManager.setStreamVolume(AudioManager.STREAM_ALARM, originalAlarmVolume, 0); } catch (Exception ignored) {}
        }
        if (vibrator != null) {
            try { vibrator.cancel(); } catch (Exception ignored) {}
        }

        sendBroadcast(new Intent("com.hyeni.calendar.FORCE_RING_STOP")
            .setPackage(getPackageName()));

        // Persist auto_timeout marker for next sync (handled by Edge Function delivery_timeout cron as backup)
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/java/com/hyeni/calendar/ForceRingService.java
git commit -m "feat(force_ring): implement ForceRingService FGS (USAGE_ALARM, 15s cap)"
```

---

### Task 5.6: ForceRingActivity

**Files:**
- Create: `android/app/src/main/java/com/hyeni/calendar/ForceRingActivity.java`

- [ ] **Step 1: Write file**

```java
package com.hyeni.calendar;

import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ForceRingActivity extends AppCompatActivity {

    private BroadcastReceiver stopReceiver;
    private final Handler countdownHandler = new Handler(Looper.getMainLooper());
    private int secondsLeft = 15;
    private TextView countdownText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(
              WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        KeyguardManager km = getSystemService(KeyguardManager.class);
        boolean isLocked = km != null && km.isKeyguardLocked();
        boolean isSecure = km != null && km.isKeyguardSecure();
        if (isLocked && !isSecure && km != null) {
            km.requestDismissKeyguard(this, null);
        }

        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = 1.0f;
        getWindow().setAttributes(lp);

        getWindow().getDecorView().setSystemUiVisibility(
              View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        setContentView(R.layout.activity_force_ring);

        Intent intent = getIntent();
        String eventId = intent.getStringExtra(ForceRingService.EXTRA_EVENT_ID);
        String message = intent.getStringExtra(ForceRingService.EXTRA_MESSAGE);
        String initiator = intent.getStringExtra(ForceRingService.EXTRA_INITIATOR);

        ((TextView) findViewById(R.id.initiator_text)).setText(
            initiator != null ? initiator : "부모님이 지금 너를 찾고 있어요");
        ((TextView) findViewById(R.id.time_text)).setText(
            new SimpleDateFormat("HH:mm:ss", Locale.KOREA).format(new Date()));

        CardView messageCard = findViewById(R.id.message_card);
        if (message != null && !message.trim().isEmpty()) {
            if (isLocked && isSecure) {
                messageCard.setVisibility(View.GONE);
            } else {
                ((TextView) findViewById(R.id.message_text)).setText(message);
                messageCard.setVisibility(View.VISIBLE);
            }
        } else {
            messageCard.setVisibility(View.GONE);
        }

        countdownText = findViewById(R.id.countdown_text);
        startCountdown();

        Button btnAck = findViewById(R.id.btn_ack);
        btnAck.setOnClickListener(v -> {
            Toast.makeText(this, "부모님에게 확인 알림이 갔어요", Toast.LENGTH_SHORT).show();
            stopService(new Intent(this, ForceRingService.class));
            sendAck(eventId);
            new Handler(Looper.getMainLooper()).postDelayed(this::finish, 1500);
        });

        stopReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent i) {
                Toast.makeText(ForceRingActivity.this,
                    "부모님이 알람을 종료했어요", Toast.LENGTH_SHORT).show();
                new Handler(Looper.getMainLooper()).postDelayed(
                    ForceRingActivity.this::finish, 1500);
            }
        };
        IntentFilter filter = new IntentFilter("com.hyeni.calendar.FORCE_RING_STOP");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(stopReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(stopReceiver, filter);
        }
    }

    private void startCountdown() {
        countdownHandler.post(new Runnable() {
            @Override
            public void run() {
                if (secondsLeft <= 0) return;
                countdownText.setText("알람 자동 종료까지 " + secondsLeft + "초");
                secondsLeft--;
                countdownHandler.postDelayed(this, 1000);
            }
        });
    }

    private void sendAck(String eventId) {
        if (eventId == null) return;
        getSharedPreferences("hyeni_force_ring_acks", MODE_PRIVATE)
            .edit()
            .putLong(eventId, System.currentTimeMillis())
            .apply();
        // App-side JS bridge handles actual REST PATCH to force_ring_events on next foregrounding.
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        countdownHandler.removeCallbacksAndMessages(null);
        if (stopReceiver != null) {
            try { unregisterReceiver(stopReceiver); } catch (Exception ignored) {}
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/java/com/hyeni/calendar/ForceRingActivity.java
git commit -m "feat(force_ring): implement ForceRingActivity (fullscreen lock-bypass)"
```

---

### Task 5.7: Wire FCM data dispatch

**Files:**
- Modify: `android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java`

- [ ] **Step 1: Locate onMessageReceived**

```bash
grep -n "onMessageReceived\|RemoteMessage\|getData" android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java
```

- [ ] **Step 2: Add force_ring branches at top of onMessageReceived**

Insert at the very top of `onMessageReceived(RemoteMessage msg)`:

```java
java.util.Map<String, String> data = msg.getData();
String action = data.get("action");

if ("force_ring".equals(action)) {
    String eventId = data.get("event_id");
    if (ForceRingRequestStore.wasLauncherRecentlyShown(this, eventId)) return;
    ForceRingRequestStore.markLauncherShown(this, eventId);

    Intent svc = new Intent(this, ForceRingService.class);
    svc.putExtra(ForceRingService.EXTRA_EVENT_ID, eventId);
    svc.putExtra(ForceRingService.EXTRA_MESSAGE, data.get("message"));
    svc.putExtra(ForceRingService.EXTRA_INITIATOR, data.get("initiator_name"));
    androidx.core.content.ContextCompat.startForegroundService(this, svc);
    return;
}

if ("force_ring_stop".equals(action)) {
    stopService(new Intent(this, ForceRingService.class));
    sendBroadcast(new Intent("com.hyeni.calendar.FORCE_RING_STOP")
        .setPackage(getPackageName()));
    return;
}

// ── existing handling continues below ──────────────────────────────────────
```

(Preserve all existing handling code below this insertion point.)

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/hyeni/calendar/MyFirebaseMessagingService.java
git commit -m "feat(force_ring): wire FCM action dispatch (force_ring/force_ring_stop)"
```

---

### Task 5.8: AndroidManifest.xml

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Verify or add permissions (within `<manifest>` tag)**

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

(Some may already exist — check first with `grep`. Add only those missing.)

- [ ] **Step 2: Add Service + Activity inside `<application>` tag**

```xml
<service
    android:name=".ForceRingService"
    android:foregroundServiceType="specialUse"
    android:exported="false">
  <property
      android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
      android:value="emergency_parental_alert" />
</service>

<activity
    android:name=".ForceRingActivity"
    android:showOnLockScreen="true"
    android:turnScreenOn="true"
    android:excludeFromRecents="true"
    android:launchMode="singleInstance"
    android:exported="false"
    android:theme="@style/Theme.Hyeni.ForceRing.Fullscreen" />
```

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat(force_ring): register ForceRingService + ForceRingActivity in manifest"
```

---

### Task 5.9: Native FCM payload contract test

**Files:**
- Create: `tests/nativeForceRingService.test.js`

- [ ] **Step 1: Write test**

```javascript
// tests/nativeForceRingService.test.js
import { describe, it, expect } from 'vitest';

describe('Native ForceRing FCM payload contract', () => {
  it('force_ring data payload shape is correct', () => {
    const data = {
      action: 'force_ring',
      event_id: 'evt-test-1',
      message: '도와줘',
      initiator_name: '엄마'
    };

    expect(data.action).toBe('force_ring');
    expect(data.event_id).toMatch(/^evt-/);
    expect(data.message.length).toBeLessThanOrEqual(80);
    expect(typeof data.initiator_name).toBe('string');
  });

  it('force_ring_stop payload shape is correct', () => {
    const data = { action: 'force_ring_stop', event_id: 'evt-test-1' };
    expect(data.action).toBe('force_ring_stop');
    expect(data.event_id).toBeDefined();
  });

  it('force_ring_reminder notification shape is correct', () => {
    const payload = {
      title: '응급 신호 5분 경과',
      body: '아이 응답이 없습니다. 직접 통화나 119를 고려하세요',
      data: { action: 'force_ring_reminder', event_id: 'evt-test-1' }
    };
    expect(payload.title).toContain('응급');
    expect(payload.body).toContain('119');
    expect(payload.data.action).toBe('force_ring_reminder');
  });
});
```

- [ ] **Step 2: Run**

```bash
npm test -- tests/nativeForceRingService.test.js
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/nativeForceRingService.test.js
git commit -m "test(force_ring): add native FCM payload contract tests"
```

---

### Task 5.10: Trigger CI APK build

- [ ] **Step 1: Push feature branch**

```bash
git push -u origin feat/force-ring
```

- [ ] **Step 2: Monitor GitHub Actions android-apk workflow**

```bash
gh run list --workflow=android-apk.yml --limit=1
gh run watch
```

Expected: workflow `android-apk.yml` completes in ~5 min, signed APK artifact attached.

- [ ] **Step 3: Download APK for manual sideload testing**

```bash
RUN_ID=$(gh run list --workflow=android-apk.yml --limit=1 --json databaseId -q '.[0].databaseId')
gh run download $RUN_ID --name app-release.apk -D ./build-test/
ls -lh build-test/
```

---

# Phase 6: Real-services E2E + Native Manual Verification

### Task 6.1: Verify branch state matches Phase 1 + 2

- [ ] **Step 1: Smoke check Edge Function reminder action**

```bash
curl -X POST "https://<branch-ref>.supabase.co/functions/v1/push-notify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_BRANCH_SERVICE_ROLE_KEY" \
  -d '{"action":"force_ring_reminder"}'
```

Expected: `{"reminded_count":0}` HTTP 200.

- [ ] **Step 2: Verify migration objects still present**

```sql
SELECT relname FROM pg_class WHERE relname = 'force_ring_events';
SELECT count(*) FROM cron.job WHERE jobname LIKE 'force_ring%';
```

Expected: 1 row + 2 cron jobs.

---

### Task 6.2: Real-services e2e — end-to-end

**Files:**
- Create: `tests/e2e/real/force-ring-end-to-end.spec.js`

- [ ] **Step 1: Write spec**

```javascript
// tests/e2e/real/force-ring-end-to-end.spec.js
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_BRANCH_URL,
  process.env.SUPABASE_BRANCH_SERVICE_ROLE_KEY
);

test.describe('force_ring end-to-end (real services)', () => {
  test('parent triggers → DB row → child auto-acks → status updates', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/');
    // Use existing parent login fixture
    // Navigate to safety tools
    await expect(page.getByText('응급 강제 알람')).toBeVisible({ timeout: 10_000 });

    const trigger = page.getByRole('button', { name: /5초 누르고 있기/ });
    await trigger.dispatchEvent('mousedown');
    await page.waitForTimeout(5200);
    await page.fill('textarea', 'e2e test ' + Date.now());
    await page.getByLabel('응급 신호 보내기').click();

    await expect(page.getByText(/전달됨/)).toBeVisible({ timeout: 10_000 });

    const { data: rows } = await supabase
      .from('force_ring_events')
      .select('*')
      .like('message', 'e2e test%')
      .order('triggered_at', { ascending: false })
      .limit(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].delivered_at).not.toBeNull();

    await supabase
      .from('force_ring_events')
      .update({
        acknowledged_at: new Date().toISOString(),
        stopped_at: new Date().toISOString(),
        stop_reason: 'child_ack'
      })
      .eq('id', rows[0].id);

    await expect(page.getByText(/아이가 확인했어요/)).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 2: Run**

```bash
npx playwright test --config=playwright.real.config.js \
  tests/e2e/real/force-ring-end-to-end.spec.js
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/real/force-ring-end-to-end.spec.js
git commit -m "test(force_ring): real-services end-to-end e2e"
```

---

### Task 6.3: Real-services e2e — quota + stop + reminder

**Files:**
- Create: `tests/e2e/real/force-ring-quota-real.spec.js`
- Create: `tests/e2e/real/force-ring-stop.spec.js`
- Create: `tests/e2e/real/force-ring-reminder.spec.js`

- [ ] **Step 1: Quota spec**

```javascript
// tests/e2e/real/force-ring-quota-real.spec.js
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_BRANCH_URL, process.env.SUPABASE_BRANCH_SERVICE_ROLE_KEY);

test('quota exceeded → 429 → tier toggle restores', async ({ page }) => {
  test.setTimeout(60_000);

  await supabase.from('family_subscription')
    .upsert({ family_id: process.env.TEST_FAMILY_ID, status: 'free' });

  await page.goto('/');
  // Login + navigate
  // Trigger first time → success expected
  const trigger = page.getByRole('button', { name: /5초 누르고 있기/ });
  await trigger.dispatchEvent('mousedown');
  await page.waitForTimeout(5200);
  await page.fill('textarea', 'quota test 1');
  await page.getByLabel('응급 신호 보내기').click();
  await expect(page.getByText(/전달됨/)).toBeVisible({ timeout: 10_000 });

  // Reload + try again → quota exceeded
  await page.reload();
  await trigger.dispatchEvent('mousedown');
  await page.waitForTimeout(5200);
  await page.getByLabel('응급 신호 보내기').click();
  await expect(page.getByText(/오늘 사용 한도 초과/)).toBeVisible();

  // Toggle to active tier → reload → trigger should succeed (premium quota=10)
  await supabase.from('family_subscription')
    .update({ status: 'active' })
    .eq('family_id', process.env.TEST_FAMILY_ID);
  await page.reload();
  await trigger.dispatchEvent('mousedown');
  await page.waitForTimeout(5200);
  await page.fill('textarea', 'quota test 2');
  await page.getByLabel('응급 신호 보내기').click();
  await expect(page.getByText(/전달됨/)).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 2: Stop spec**

```javascript
// tests/e2e/real/force-ring-stop.spec.js
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_BRANCH_URL, process.env.SUPABASE_BRANCH_SERVICE_ROLE_KEY);

test('parent remote stop sets stop_reason=parent_stop', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/');
  // Login + trigger
  const trigger = page.getByRole('button', { name: /5초 누르고 있기/ });
  await trigger.dispatchEvent('mousedown');
  await page.waitForTimeout(5200);
  await page.fill('textarea', 'stop test ' + Date.now());
  await page.getByLabel('응급 신호 보내기').click();
  await expect(page.getByText(/전달됨/)).toBeVisible({ timeout: 10_000 });

  await page.getByLabel(/그만 울릴께요/).click();
  await page.waitForTimeout(2000);

  const { data: rows } = await supabase
    .from('force_ring_events')
    .select('stop_reason, stopped_at')
    .order('triggered_at', { ascending: false })
    .limit(1);
  expect(rows[0].stop_reason).toBe('parent_stop');
  expect(rows[0].stopped_at).not.toBeNull();
});
```

- [ ] **Step 3: Reminder spec (slow)**

```javascript
// tests/e2e/real/force-ring-reminder.spec.js
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_BRANCH_URL, process.env.SUPABASE_BRANCH_SERVICE_ROLE_KEY);

test.describe('force_ring reminder (slow, ~6min)', () => {
  test.setTimeout(600_000);

  test('5min unacked event triggers reminder + reminder_sent_at UPDATE', async ({ page }) => {
    await page.goto('/');
    // Login + trigger
    const trigger = page.getByRole('button', { name: /5초 누르고 있기/ });
    await trigger.dispatchEvent('mousedown');
    await page.waitForTimeout(5200);
    await page.fill('textarea', 'reminder test ' + Date.now());
    await page.getByLabel('응급 신호 보내기').click();
    await expect(page.getByText(/전달됨/)).toBeVisible({ timeout: 10_000 });

    const { data: triggered } = await supabase
      .from('force_ring_events')
      .select('id')
      .like('message', 'reminder test%')
      .order('triggered_at', { ascending: false })
      .limit(1);
    const eventId = triggered[0].id;

    // Wait 6 minutes for cron
    await page.waitForTimeout(6 * 60 * 1000);

    const { data: refreshed } = await supabase
      .from('force_ring_events')
      .select('reminder_sent_at')
      .eq('id', eventId);
    expect(refreshed[0].reminder_sent_at).not.toBeNull();
  });
});
```

- [ ] **Step 4: Run all 4 real specs**

```bash
npx playwright test --config=playwright.real.config.js \
  tests/e2e/real/force-ring-*.spec.js
```

Expected: 3 fast specs pass + 1 slow reminder spec passes (~6min).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/real/force-ring-*.spec.js
git commit -m "test(force_ring): real-services quota + stop + reminder e2e"
```

---

### Task 6.4: Native manual 24-item checklist + Play Console disclosure

**Files:**
- Create: `docs/PLAY-CONSOLE-FORCE-RING-DISCLOSURE.md`

- [ ] **Step 1: Sideload APK from Phase 5.10 to test child device + parent device**

```bash
adb install build-test/app-release.apk
```

Or use Play internal track to push to test devices.

- [ ] **Step 2: Execute manual checklist on real device(s)**

Track results in PR description or `/tmp/force-ring-manual.md`:

```markdown
## Force Ring Native Manual — Date: ____ Tester: ____

### Sound bypass (4)
- [ ] Silent mode → STREAM_ALARM full volume plays
- [ ] DND general → plays
- [ ] DND priority (alarm blocked) → plays (USAGE_ALARM wins)
- [ ] Music playing → alarm wins, music ducks

### Lock screen (5)
- [ ] No PIN → fullscreen shows immediately
- [ ] PIN locked → fullscreen shows, ack tap works without PIN
- [ ] PIN locked + message card hidden (PIPA)
- [ ] Other app fullscreen (game) → force-ring overrides
- [ ] Screen off → turns ON automatically

### Doze / battery (3)
- [ ] Doze (1h idle) → high-priority FCM wakes
- [ ] Battery saver ON → works
- [ ] Auto cleanup (app marked unused) → FCM re-wakes

### Permission denial (3)
- [ ] POST_NOTIFICATIONS denied → sound plays, fullscreen blocked, parent fallback
- [ ] USE_FULL_SCREEN_INTENT denied → sound plays, heads-up only
- [ ] User disabled channel → fallback works

### Concurrency (3)
- [ ] Trigger then immediate "그만 울릴께요" (1s) → stops within 1s
- [ ] Child taps ack at 14.9s → recorded as child_ack
- [ ] Co-parents simultaneous trigger → second gets 423

### Android version (4)
- [ ] API 24 → fallback works (no NotificationChannel)
- [ ] API 28 → works
- [ ] API 33 → POST_NOTIFICATIONS prompt + works
- [ ] API 34 → FGS_SPECIAL_USE + USE_FULL_SCREEN_INTENT appop works

### Composite (2)
- [ ] 15s auto-stop → force_ring_events.stop_reason='auto_timeout'
- [ ] Reminder push at 5min, "전화 걸기" → tel: opens dialer
```

24/24 must pass before Phase 7.

- [ ] **Step 3: Write Play Console disclosure**

`docs/PLAY-CONSOLE-FORCE-RING-DISCLOSURE.md`:

```markdown
# Force Ring (강제 소리 울리기) — Google Play Console Disclosure

## Foreground Service Type: SPECIAL_USE
**Subtype value:** `emergency_parental_alert`

## Description for Play Review

Emergency parental alert service for child-parent safety app (Family-exception category).

**Activation:** Only by explicit parent action — 5-second long-press on a clearly-labeled red button followed by an explicit confirmation modal in the parent's UI.

**Behavior:** Plays alarm sound on `AudioAttributes.USAGE_ALARM` stream. Displays full-screen UI via `setFullScreenIntent` for up to 15 seconds. Auto-terminates via `Handler.postDelayed`.

**Child agency:** Child can dismiss with single tap on prominent "확인했어요" (I see it) button at any time. Parent can also remotely stop the alarm via the Edge Function.

**Transparency:** All activations are logged in immutable `force_ring_events` audit table (DB-level immutability via absent DELETE RLS policy). Both parent and child can view full history.

**Rate limits:** 1 trigger per 24 hours for free users; 10 per 24 hours for premium subscribers. Failed deliveries do not count against quota.

**Non-stealth:** Bright red full-screen takeover with system bars hidden but content always fully visible. Persistent notification while service runs. No silent / hidden modes.

**Same Family-exception** as our existing `remote_listen` feature (previously approved by Google Play review).

## Permissions Used

- `FOREGROUND_SERVICE` — base FGS
- `FOREGROUND_SERVICE_SPECIAL_USE` — emergency alarm service category
- `USE_FULL_SCREEN_INTENT` — Android 14+ family safety category exemption applies
- `WAKE_LOCK` — keep screen on during the 15-second alarm
- `MODIFY_AUDIO_SETTINGS` — temporarily set STREAM_ALARM to max, restore on stop

## Compliance

- **PIPA (KR)**: immutable audit log, sensitive content (parent message text) blurred on PIN-locked lock screen
- **OWASP MASTG safety logging**: full event records (initiator, target, timestamps, delivery_status JSON)
- **Anti-stalkerware**: no auto-trigger paths, fully visible UI never hidden, child-controlled dismiss tap, persistent notification

## Spec
`docs/superpowers/specs/2026-04-27-force-ring-design.md`
```

- [ ] **Step 4: Commit**

```bash
git add docs/PLAY-CONSOLE-FORCE-RING-DISCLOSURE.md
git commit -m "docs(force_ring): add Play Console disclosure for FGS_SPECIAL_USE"
```

---

# Phase 7: Production Deployment

### Task 7.1: Backup + apply migration to production

- [ ] **Step 1: Backup current schema**

```bash
mkdir -p backups/
npx supabase db dump --linked --schema public > backups/pre-force-ring-$(date +%Y%m%d).sql
```

- [ ] **Step 2: Apply forward migration to production**

```bash
npx supabase migration up --linked
```

- [ ] **Step 3: Verify objects + cron running**

```sql
SELECT relname FROM pg_class WHERE relname = 'force_ring_events';
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'force_ring%';
SELECT 1 FROM pg_publication_tables WHERE tablename = 'force_ring_events';
```

Expected: 1 + 2 active + 1.

---

### Task 7.2: Deploy Edge Function to production

- [ ] **Step 1: Deploy**

```bash
npx supabase functions deploy push-notify --no-verify-jwt --project-ref qzrrscryacxhprnrtpjd
```

- [ ] **Step 2: Smoke test**

```bash
curl -X POST "https://qzrrscryacxhprnrtpjd.supabase.co/functions/v1/push-notify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_PROD_SERVICE_ROLE_KEY" \
  -d '{"action":"force_ring_reminder"}'
```

Expected: `{"reminded_count":0}` HTTP 200.

---

### Task 7.3: Build + sign production APK via CI

- [ ] **Step 1: Merge to main**

```bash
git checkout main
git pull origin main
git merge --no-ff feat/force-ring -m "merge: force_ring v1"
git push origin main
```

- [ ] **Step 2: Monitor CI**

```bash
gh run watch
```

Expected: signed APK artifact built.

- [ ] **Step 3: Upload to Play Console internal testing track**

Manual via Play Console:
- New release → Upload signed APK
- Add release notes
- Paste disclosure from `docs/PLAY-CONSOLE-FORCE-RING-DISCLOSURE.md`
- Submit for internal review

---

### Task 7.4: Tag release + monitor 24h

- [ ] **Step 1: Tag**

```bash
git tag -a "force-ring-v1" -m "Force Ring v1 — parent→child emergency alert"
git push origin force-ring-v1
```

- [ ] **Step 2: Monitor metrics for 24h**

Run hourly:

```sql
SELECT
  date_trunc('hour', triggered_at) AS hour,
  count(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivered,
  count(*) FILTER (WHERE acknowledged_at IS NOT NULL) AS acked,
  count(*) FILTER (WHERE stop_reason = 'delivery_failed') AS failed,
  count(*) FILTER (WHERE stop_reason = 'auto_timeout') AS timed_out,
  count(*) FILTER (WHERE reminder_sent_at IS NOT NULL) AS reminded
FROM force_ring_events
WHERE triggered_at > now() - interval '24 hours'
GROUP BY 1 ORDER BY 1;
```

Alert thresholds (per spec §10.8):
- delivery_failed > 10% → investigate
- (acked NULL & auto_timeout) > 50% → native debugging needed

- [ ] **Step 3: Update PROJECT.md**

Append to `.planning/PROJECT.md` under "Validated":

```markdown
- ✓ Force Ring v1 (force_ring_events table + 3 Edge actions + Native FGS + Play Console disclosure submitted)
```

- [ ] **Step 4: Final commit**

```bash
git add .planning/PROJECT.md
git commit -m "docs(force_ring): mark v1 deployed in PROJECT.md"
git push origin main
```

---

## Acceptance Criteria — Final Gate

Per spec §14, all 10 must pass:

1. ✅ Migration forward + down applied, RLS 12-cell matrix passes (Phase 1)
2. ✅ Edge Function 3 actions deployed + smoke tests pass (Phase 2)
3. ✅ Parent UI 6 active states render correctly (Phase 4)
4. ✅ Vitest 80%+ coverage on new modules (Phase 3-5)
5. ✅ Mocked Playwright 4 specs (3 pass + 1 deferred-skip) (Phase 4)
6. ✅ Native built and installed on real device (Phase 5)
7. ✅ Real-services Playwright 4 specs green (Phase 6)
8. ✅ 24-item native manual checklist 24/24 (Phase 6)
9. ✅ Production deploy + Play Console disclosure submitted (Phase 7)
10. ✅ 24h metrics within thresholds (Phase 7)

---

*Plan generated: 2026-04-27 by `/superpowers:writing-plans`*
*Spec: `docs/superpowers/specs/2026-04-27-force-ring-design.md`*
