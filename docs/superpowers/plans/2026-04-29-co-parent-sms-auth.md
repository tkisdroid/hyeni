# Co-Parent SMS Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one limited co-parent per subscribed family and add parent phone OTP login through NCP SENS alongside Kakao login.

**Architecture:** Keep `family_members.role = 'parent'` for compatibility, but derive primary-parent authority from `families.parent_id`. Add small tested helpers for client capabilities, phone normalization, NCP SENS signing, and push recipient routing. Enforce the same boundaries in client guards, Supabase RPC/RLS, and the `push-notify` Edge Function.

**Tech Stack:** React 19, Vite 7, Supabase Auth/RLS/Edge Functions, Deno 2 Edge Functions, Vitest 4, Playwright 1.59, Capacitor 8 Android.

---

## File Structure

- Create `src/lib/parentCapabilities.js`: pure helper for primary/co-parent capability derivation.
- Create `src/lib/phoneAuth.js`: phone normalization plus Supabase OTP wrappers.
- Modify `src/lib/auth.js`: return `parent_id` and primary/co-parent metadata from `getMyFamily()`.
- Modify `src/App.jsx`: add SMS login UI, co-parent UI guards, and `kkuk`/`sos` separation.
- Create `supabase/functions/_shared/ncpSens.ts`: NCP SENS request, phone normalization, and HMAC signature helpers.
- Create `supabase/functions/send-sms/index.ts`: Supabase Send SMS Auth Hook endpoint.
- Create `supabase/functions/push-notify/notificationRouting.ts`: pure recipient/action authorization helpers.
- Modify `supabase/functions/push-notify/index.ts`: use routing helpers and reject co-parent control actions.
- Create `supabase/migrations/20260429120000_coparent_permissions.sql`: RPC, helper, RLS, and sticker authorization changes.
- Create `supabase/migrations/down/20260429120000_coparent_permissions.sql`: paired rollback.
- Create `.planning/snapshots/2026-04-29-pg_policies-pre-coparent.txt`: pre-change RLS policy snapshot for affected tables.
- Modify `supabase/config.toml`: enable local phone signup. Configure the production Send SMS Hook in the Supabase Dashboard after deploying the `send-sms` Edge Function, because this repository does not currently define a local HTTP auth-hook section.
- Create or modify tests listed in each task.

---

### Task 1: Client Capability Helper

**Files:**
- Create: `src/lib/parentCapabilities.js`
- Create: `tests/parentCapabilities.test.js`

- [ ] **Step 1: Write failing capability tests**

Create `tests/parentCapabilities.test.js`:

```js
import { describe, expect, it } from "vitest";
import { deriveParentCapabilities } from "../src/lib/parentCapabilities.js";

describe("deriveParentCapabilities", () => {
  const baseFamily = {
    familyId: "family-1",
    primaryParentId: "mom",
    myRole: "parent",
    members: [
      { user_id: "mom", role: "parent", name: "엄마" },
      { user_id: "dad", role: "parent", name: "아빠" },
      { user_id: "child", role: "child", name: "혜니" },
    ],
  };

  it("grants full control only to the primary parent", () => {
    const result = deriveParentCapabilities(baseFamily, { id: "mom" }, "parent");

    expect(result.isPrimaryParent).toBe(true);
    expect(result.isCoParent).toBe(false);
    expect(result.canWriteSchedule).toBe(true);
    expect(result.canManageFamily).toBe(true);
    expect(result.canSendMemo).toBe(true);
    expect(result.canGivePraiseSticker).toBe(true);
    expect(result.canReceiveSos).toBe(true);
    expect(result.canReceiveKkuk).toBe(true);
  });

  it("limits the co-parent to read, memo, praise sticker, and SOS receipt", () => {
    const result = deriveParentCapabilities(baseFamily, { id: "dad" }, "parent");

    expect(result.isPrimaryParent).toBe(false);
    expect(result.isCoParent).toBe(true);
    expect(result.canWriteSchedule).toBe(false);
    expect(result.canManageFamily).toBe(false);
    expect(result.canSendMemo).toBe(true);
    expect(result.canGivePraiseSticker).toBe(true);
    expect(result.canReceiveSos).toBe(true);
    expect(result.canReceiveKkuk).toBe(false);
  });

  it("keeps child capabilities separate from parent controls", () => {
    const result = deriveParentCapabilities(
      { ...baseFamily, myRole: "child" },
      { id: "child" },
      "child",
    );

    expect(result.isPrimaryParent).toBe(false);
    expect(result.isCoParent).toBe(false);
    expect(result.canWriteSchedule).toBe(false);
    expect(result.canManageFamily).toBe(false);
    expect(result.canSendMemo).toBe(true);
    expect(result.canGivePraiseSticker).toBe(false);
    expect(result.canReceiveSos).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test -- tests/parentCapabilities.test.js`

Expected: FAIL with an import error for `../src/lib/parentCapabilities.js`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/parentCapabilities.js`:

```js
export function deriveParentCapabilities(familyInfo, authUser, selectedRole) {
  const userId = authUser?.id || "";
  const role = familyInfo?.myRole || selectedRole || null;
  const members = Array.isArray(familyInfo?.members) ? familyInfo.members : [];
  const primaryParentId = familyInfo?.primaryParentId || familyInfo?.parentId || "";
  const parentMember = members.find((member) => (
    member?.role === "parent" && member?.user_id === userId
  ));

  const isParentRole = role === "parent" || !!parentMember;
  const isPrimaryParent = !!userId && isParentRole && primaryParentId === userId;
  const isCoParent = !!userId && isParentRole && !!parentMember && !isPrimaryParent;
  const isChild = role === "child";

  return {
    isParentRole,
    isPrimaryParent,
    isCoParent,
    isChild,
    canManageFamily: isPrimaryParent,
    canWriteSchedule: isPrimaryParent,
    canManagePlaces: isPrimaryParent,
    canManageSubscription: isPrimaryParent,
    canRequestChildLocation: isPrimaryParent,
    canUseRemoteListen: isPrimaryParent,
    canUseForceRing: isPrimaryParent,
    canEditParentPhones: isPrimaryParent,
    canSendMemo: isParentRole || isChild,
    canGivePraiseSticker: isPrimaryParent || isCoParent,
    canReceiveSos: isPrimaryParent || isCoParent,
    canReceiveKkuk: isPrimaryParent,
  };
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm run test -- tests/parentCapabilities.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parentCapabilities.js tests/parentCapabilities.test.js
git commit -m "test: add parent capability helper"
```

---

### Task 2: Phone OTP Client Helper

**Files:**
- Create: `src/lib/phoneAuth.js`
- Create: `tests/phoneAuth.test.js`

- [ ] **Step 1: Write failing phone auth helper tests**

Create `tests/phoneAuth.test.js`:

```js
import { describe, expect, it, vi } from "vitest";
import {
  normalizeKoreanPhoneForOtp,
  requestParentPhoneOtp,
  verifyParentPhoneOtp,
} from "../src/lib/phoneAuth.js";

describe("normalizeKoreanPhoneForOtp", () => {
  it("normalizes Korean local mobile numbers to E.164", () => {
    expect(normalizeKoreanPhoneForOtp("010-1234-5678")).toBe("+821012345678");
    expect(normalizeKoreanPhoneForOtp("01012345678")).toBe("+821012345678");
  });

  it("keeps already normalized Korean E.164 numbers", () => {
    expect(normalizeKoreanPhoneForOtp("+821012345678")).toBe("+821012345678");
  });

  it("rejects unsupported phone numbers", () => {
    expect(() => normalizeKoreanPhoneForOtp("0212345678")).toThrow("휴대폰 번호");
    expect(() => normalizeKoreanPhoneForOtp("01012")).toThrow("휴대폰 번호");
  });
});

describe("phone OTP wrappers", () => {
  it("requests an SMS OTP through Supabase Auth", async () => {
    const auth = {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    };

    await requestParentPhoneOtp(auth, "010-1234-5678");

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      phone: "+821012345678",
      options: { channel: "sms", shouldCreateUser: true },
    });
  });

  it("verifies an SMS OTP through Supabase Auth", async () => {
    const auth = {
      verifyOtp: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
    };

    const result = await verifyParentPhoneOtp(auth, "01012345678", "123456");

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      phone: "+821012345678",
      token: "123456",
      type: "sms",
    });
    expect(result.user.id).toBe("u1");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test -- tests/phoneAuth.test.js`

Expected: FAIL with an import error for `../src/lib/phoneAuth.js`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/phoneAuth.js`:

```js
function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeKoreanPhoneForOtp(rawPhone) {
  const trimmed = String(rawPhone || "").trim();
  const digits = onlyDigits(trimmed);

  if (trimmed.startsWith("+82")) {
    const local = "0" + digits.slice(2);
    if (/^010\d{8}$/.test(local)) return `+82${local.slice(1)}`;
  }

  if (/^010\d{8}$/.test(digits)) {
    return `+82${digits.slice(1)}`;
  }

  if (/^8210\d{8}$/.test(digits)) {
    return `+${digits}`;
  }

  throw new Error("010으로 시작하는 휴대폰 번호를 입력해 주세요.");
}

export async function requestParentPhoneOtp(auth, rawPhone) {
  const phone = normalizeKoreanPhoneForOtp(rawPhone);
  const { error } = await auth.signInWithOtp({
    phone,
    options: {
      channel: "sms",
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
  return { phone };
}

export async function verifyParentPhoneOtp(auth, rawPhone, token) {
  const phone = normalizeKoreanPhoneForOtp(rawPhone);
  const cleanToken = String(token || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(cleanToken)) {
    throw new Error("6자리 인증번호를 입력해 주세요.");
  }

  const { data, error } = await auth.verifyOtp({
    phone,
    token: cleanToken,
    type: "sms",
  });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm run test -- tests/phoneAuth.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/phoneAuth.js tests/phoneAuth.test.js
git commit -m "feat: add parent phone otp helper"
```

---

### Task 3: Family Metadata in Auth Loader

**Files:**
- Modify: `src/lib/auth.js`
- Create: `tests/authFamilyRole.test.js`

- [ ] **Step 1: Write failing metadata tests**

Create `tests/authFamilyRole.test.js`:

```js
import { describe, expect, it } from "vitest";
import { deriveParentCapabilities } from "../src/lib/parentCapabilities.js";

describe("family role metadata contract", () => {
  it("treats a parent member whose id differs from primaryParentId as co-parent", () => {
    const familyInfo = {
      familyId: "family-1",
      primaryParentId: "mom",
      myRole: "parent",
      members: [
        { user_id: "mom", role: "parent" },
        { user_id: "dad", role: "parent" },
      ],
    };

    const result = deriveParentCapabilities(familyInfo, { id: "dad" }, "parent");

    expect(result.isCoParent).toBe(true);
    expect(result.canWriteSchedule).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify RED or contract gap**

Run: `npm run test -- tests/authFamilyRole.test.js`

Expected before Task 1 implementation: import failure. Expected after Task 1: PASS. The production gap remains in `getMyFamily()` because it does not yet populate `primaryParentId`.

- [ ] **Step 3: Update `getMyFamily()` selects and return objects**

Modify `src/lib/auth.js` in both family select branches.

Change:

```js
.select("id, pair_code, parent_name, mom_phone, dad_phone, pair_code_expires_at")
```

to:

```js
.select("id, parent_id, pair_code, parent_name, mom_phone, dad_phone, pair_code_expires_at")
```

In both return objects, add:

```js
primaryParentId: parentFamily.parent_id,
isPrimaryParent: parentFamily.parent_id === userId,
isCoParent: false,
```

for the direct primary-parent branch, and:

```js
primaryParentId: family?.parent_id || "",
isPrimaryParent: family?.parent_id === userId,
isCoParent: membership.role === "parent" && family?.parent_id !== userId,
```

for the membership branch.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- tests/authFamilyRole.test.js tests/parentCapabilities.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.js tests/authFamilyRole.test.js
git commit -m "feat: expose primary parent metadata"
```

---

### Task 4: Database RPC and RLS Enforcement

**Files:**
- Create: `supabase/migrations/20260429120000_coparent_permissions.sql`
- Create: `supabase/migrations/down/20260429120000_coparent_permissions.sql`
- Create: `tests/e2e/coparent-permissions-real.spec.js`
- Create: `.planning/snapshots/2026-04-29-pg_policies-pre-coparent.txt`
- Modify: `tests/e2e/_helpers.js`

- [ ] **Step 1: Export exact real-services helper functions**

Modify `tests/e2e/_helpers.js`:

```js
export const SUPABASE_TEST_URL = SUPABASE_URL;
export const SUPABASE_TEST_ANON_KEY = SUPABASE_ANON_KEY;

export async function srFetch(path, init = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set in env - legacy seed helpers unavailable");
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`SR ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function createEmailUser(prefix = "e2e-user") {
  return signupParentDirect(prefix);
}
```

Update the internal `signupParentDirect` helper to accept `prefix`:

```js
async function signupParentDirect(prefix = "e2e-seed") {
  const ts = Date.now() + Math.floor(Math.random() * 10000);
  const email = `${prefix}-${ts}@hyeni.test`;
  const password = `E2e-pw-${ts}!`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return { ...body, email, password, user_id: body.user.id };
}
```

- [ ] **Step 2: Write failing real-services E2E coverage**

Create `tests/e2e/coparent-permissions-real.spec.js`:

```js
import { expect, test } from "@playwright/test";
import {
  SUPABASE_TEST_ANON_KEY,
  SUPABASE_TEST_URL,
  createEmailUser,
  injectSession,
  seedLegacyFamily,
  srFetch,
} from "./_helpers.js";

test.describe("co-parent permissions with real Supabase", () => {
  test("one co-parent can join, read events, send memo and praise, but cannot write schedules", async ({ page }) => {
    const seeded = await seedLegacyFamily();
    const [family] = await srFetch(
      `/rest/v1/families?id=eq.${seeded.family_id}&select=id,pair_code,parent_id`,
    );
    const coParent = await createEmailUser("e2e-coparent");

    const joinRes = await fetch(`${SUPABASE_TEST_URL}/rest/v1/rpc/join_family_as_parent`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_TEST_ANON_KEY,
        Authorization: `Bearer ${coParent.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_pair_code: family.pair_code,
        p_user_id: coParent.user.id,
        p_name: "아빠",
      }),
    });
    expect(joinRes.ok, await joinRes.text()).toBe(true);

    await injectSession(page, coParent, "parent");
    await page.goto("/");
    await expect(page.locator("body")).toContainText("혜니캘린더");

    const eventRes = await fetch(`${SUPABASE_TEST_URL}/rest/v1/events`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_TEST_ANON_KEY,
        Authorization: `Bearer ${coParent.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        family_id: seeded.family_id,
        date_key: "2026-3-29",
        title: "보조 부모 금지 일정",
        time: "09:00",
        category: "school",
        emoji: "📚",
        color: "#111827",
        bg: "#F3F4F6",
        created_by: coParent.user.id,
      }),
    });
    expect(eventRes.status).toBe(403);

    const secondCoParent = await createEmailUser("e2e-coparent-2");
    const secondJoin = await fetch(`${SUPABASE_TEST_URL}/rest/v1/rpc/join_family_as_parent`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_TEST_ANON_KEY,
        Authorization: `Bearer ${secondCoParent.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_pair_code: family.pair_code,
        p_user_id: secondCoParent.user.id,
        p_name: "보조부모2",
      }),
    });
    expect(secondJoin.status).toBeGreaterThanOrEqual(400);
  });
});
```

- [ ] **Step 3: Run the real test and verify RED**

Run: `npx playwright test --config=playwright.real.config.js tests/e2e/coparent-permissions-real.spec.js`

Expected: FAIL because co-parent event insert is still allowed or the one-co-parent RPC rule is missing.

- [ ] **Step 4: Capture pre-change RLS policy snapshot**

Create `.planning/snapshots/2026-04-29-pg_policies-pre-coparent.txt` with the exact result of this query against the Supabase branch before applying the migration:

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('events', 'events_children', 'stickers')
ORDER BY tablename, policyname;
```

The snapshot file must include the query, result rows, timestamp, and branch/project target.

- [ ] **Step 5: Add migration**

Create `supabase/migrations/20260429120000_coparent_permissions.sql`:

```sql
BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.is_primary_parent(p_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.families f
    WHERE f.id = p_family_id
      AND f.parent_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_primary_parent(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_family_as_parent(
  p_pair_code text,
  p_user_id uuid,
  p_name text DEFAULT '부모'
) RETURNS uuid AS $$
DECLARE
  v_family_id uuid;
  v_primary_parent_id uuid;
  v_attempt_count int;
  v_expires_at timestamptz;
  v_existing_coparent_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인 후 다시 시도해 주세요';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION '현재 로그인한 사용자로만 가족에 합류할 수 있어요';
  END IF;

  SELECT count(*) INTO v_attempt_count
  FROM public.pair_attempts
  WHERE user_id = p_user_id AND attempted_at > now() - interval '1 hour';

  IF v_attempt_count >= 10 THEN
    RAISE EXCEPTION 'Too many attempts. Try again later.';
  END IF;

  INSERT INTO public.pair_attempts (user_id) VALUES (p_user_id);

  SELECT id, parent_id, pair_code_expires_at
    INTO v_family_id, v_primary_parent_id, v_expires_at
    FROM public.families
   WHERE pair_code = upper(trim(p_pair_code));

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid pair code';
  END IF;

  IF v_primary_parent_id = p_user_id THEN
    RAISE EXCEPTION '이미 이 가족의 주 보호자입니다';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RAISE EXCEPTION '만료된 연동 코드예요. 가족 관리자에게 새 코드를 받아 주세요';
  END IF;

  SELECT user_id
    INTO v_existing_coparent_id
    FROM public.family_members
   WHERE family_id = v_family_id
     AND role = 'parent'
     AND user_id IS NOT NULL
     AND user_id <> v_primary_parent_id
     AND user_id <> p_user_id
   LIMIT 1;

  IF v_existing_coparent_id IS NOT NULL THEN
    RAISE EXCEPTION '이미 보조 보호자가 등록되어 있어요';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role, name)
  VALUES (v_family_id, p_user_id, 'parent', coalesce(nullif(trim(p_name), ''), '부모'))
  ON CONFLICT (family_id, user_id)
  DO UPDATE SET role = 'parent', name = EXCLUDED.name;

  RETURN v_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_family_as_parent(text, uuid, text) TO authenticated;

DROP POLICY IF EXISTS "ev_ins" ON public.events;
DROP POLICY IF EXISTS "events_insert" ON public.events;
CREATE POLICY "ev_ins" ON public.events FOR INSERT
  WITH CHECK (public.is_primary_parent(events.family_id));

DROP POLICY IF EXISTS "ev_upd" ON public.events;
DROP POLICY IF EXISTS "events_update" ON public.events;
CREATE POLICY "ev_upd" ON public.events FOR UPDATE
  USING (public.is_primary_parent(events.family_id))
  WITH CHECK (public.is_primary_parent(events.family_id));

DROP POLICY IF EXISTS "ev_del" ON public.events;
DROP POLICY IF EXISTS "events_delete" ON public.events;
CREATE POLICY "ev_del" ON public.events FOR DELETE
  USING (public.is_primary_parent(events.family_id));

DROP POLICY IF EXISTS events_children_modify_parent ON public.events_children;
CREATE POLICY events_children_modify_parent
  ON public.events_children FOR ALL
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE public.is_primary_parent(e.family_id)
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE public.is_primary_parent(e.family_id)
    )
  );

CREATE OR REPLACE FUNCTION public.add_sticker(
  p_user_id uuid,
  p_family_id uuid,
  p_event_id text,
  p_date_key text,
  p_sticker_type text DEFAULT 'on_time',
  p_emoji text DEFAULT '⭐',
  p_title text DEFAULT ''
) RETURNS void AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.family_members
  WHERE family_id = p_family_id AND user_id = v_caller
  LIMIT 1;

  SELECT role INTO v_target_role
  FROM public.family_members
  WHERE family_id = p_family_id AND user_id = p_user_id
  LIMIT 1;

  IF v_caller_role = 'child' THEN
    IF p_user_id <> v_caller OR p_sticker_type NOT IN ('early', 'on_time', 'late') THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  ELSIF v_caller_role = 'parent' THEN
    IF v_target_role <> 'child' OR p_sticker_type <> 'praise' THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stickers
    WHERE user_id = p_user_id
      AND event_id = p_event_id
      AND sticker_type = p_sticker_type
  ) THEN
    INSERT INTO public.stickers (user_id, family_id, event_id, date_key, sticker_type, emoji, title)
    VALUES (p_user_id, p_family_id, p_event_id, p_date_key, p_sticker_type, p_emoji, p_title);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.add_sticker(uuid, uuid, text, text, text, text, text) TO authenticated;

COMMIT;
```

- [ ] **Step 6: Add paired down migration**

Create `supabase/migrations/down/20260429120000_coparent_permissions.sql`:

```sql
BEGIN;

DROP POLICY IF EXISTS "ev_ins" ON public.events;
CREATE POLICY "ev_ins" ON public.events FOR INSERT
  WITH CHECK (family_id IN (SELECT public.get_my_family_ids()));

DROP POLICY IF EXISTS "ev_upd" ON public.events;
CREATE POLICY "ev_upd" ON public.events FOR UPDATE
  USING (family_id IN (SELECT public.get_my_family_ids()));

DROP POLICY IF EXISTS "ev_del" ON public.events;
CREATE POLICY "ev_del" ON public.events FOR DELETE
  USING (family_id IN (SELECT public.get_my_family_ids()));

DROP POLICY IF EXISTS events_children_modify_parent ON public.events_children;
CREATE POLICY events_children_modify_parent
  ON public.events_children FOR ALL
  USING (event_id IN (
    SELECT id FROM public.events
    WHERE family_id IN (
      SELECT family_id FROM public.family_members
      WHERE user_id = auth.uid() AND role = 'parent'
    )
  ));

CREATE OR REPLACE FUNCTION public.join_family_as_parent(
  p_pair_code text,
  p_user_id uuid,
  p_name text DEFAULT '부모'
) RETURNS uuid AS $$
DECLARE
  v_family_id uuid;
  v_attempt_count int;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인 후 다시 시도해 주세요';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION '현재 로그인한 사용자로만 가족에 합류할 수 있어요';
  END IF;

  SELECT count(*) INTO v_attempt_count
  FROM public.pair_attempts
  WHERE user_id = p_user_id AND attempted_at > now() - interval '1 hour';

  IF v_attempt_count >= 10 THEN
    RAISE EXCEPTION 'Too many attempts. Try again later.';
  END IF;

  INSERT INTO public.pair_attempts (user_id) VALUES (p_user_id);

  SELECT id, pair_code_expires_at
    INTO v_family_id, v_expires_at
    FROM public.families
   WHERE pair_code = upper(trim(p_pair_code));

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid pair code';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RAISE EXCEPTION '만료된 연동 코드예요. 가족 관리자에게 새 코드를 받아 주세요';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role, name)
  VALUES (v_family_id, p_user_id, 'parent', coalesce(nullif(trim(p_name), ''), '부모'))
  ON CONFLICT (family_id, user_id)
  DO UPDATE SET role = 'parent', name = EXCLUDED.name;

  RETURN v_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_family_as_parent(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_sticker(
  p_user_id uuid,
  p_family_id uuid,
  p_event_id text,
  p_date_key text,
  p_sticker_type text DEFAULT 'on_time',
  p_emoji text DEFAULT '⭐',
  p_title text DEFAULT ''
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.stickers
    WHERE user_id = p_user_id
      AND event_id = p_event_id
      AND sticker_type = p_sticker_type
  ) THEN
    INSERT INTO public.stickers (user_id, family_id, event_id, date_key, sticker_type, emoji, title)
    VALUES (p_user_id, p_family_id, p_event_id, p_date_key, p_sticker_type, p_emoji, p_title);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.add_sticker(uuid, uuid, text, text, text, text, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.is_primary_parent(uuid);

COMMIT;
```

- [ ] **Step 7: Run migration checks**

Run:

```bash
supabase db reset
npm run test -- tests/parentCapabilities.test.js tests/authFamilyRole.test.js
```

Expected: migrations apply locally; tests pass.

- [ ] **Step 8: Run real-services co-parent test**

Run: `npx playwright test --config=playwright.real.config.js tests/e2e/coparent-permissions-real.spec.js`

Expected: PASS against a Supabase branch with the migration applied.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260429120000_coparent_permissions.sql supabase/migrations/down/20260429120000_coparent_permissions.sql .planning/snapshots/2026-04-29-pg_policies-pre-coparent.txt tests/e2e/coparent-permissions-real.spec.js tests/e2e/_helpers.js
git commit -m "feat: enforce limited co-parent permissions"
```

---

### Task 5: Push Routing and SOS Separation

**Files:**
- Create: `supabase/functions/push-notify/notificationRouting.ts`
- Create: `tests/pushNotificationRouting.test.js`
- Modify: `supabase/functions/push-notify/index.ts`

- [ ] **Step 1: Write failing routing tests**

Create `tests/pushNotificationRouting.test.js`:

```js
import { describe, expect, it } from "vitest";
import {
  canCallerSendAction,
  isEmergencyNotificationType,
  selectParentRecipientsForAction,
} from "../supabase/functions/push-notify/notificationRouting.ts";

describe("push notification routing", () => {
  const members = [
    { user_id: "mom", role: "parent", is_primary_parent: true },
    { user_id: "dad", role: "parent", is_primary_parent: false },
    { user_id: "child", role: "child", is_primary_parent: false },
  ];

  it("keeps kkuk separate from sos", () => {
    expect(isEmergencyNotificationType("kkuk", {})).toBe(false);
    expect(isEmergencyNotificationType("sos", {})).toBe(true);
  });

  it("routes sos to both parents", () => {
    expect(selectParentRecipientsForAction("sos", members)).toEqual(new Set(["mom", "dad"]));
  });

  it("routes kkuk only to the primary parent", () => {
    expect(selectParentRecipientsForAction("kkuk", members)).toEqual(new Set(["mom"]));
  });

  it("blocks co-parent control actions", () => {
    expect(canCallerSendAction("remote_listen", { role: "parent", isPrimaryParent: false })).toBe(false);
    expect(canCallerSendAction("request_location", { role: "parent", isPrimaryParent: false })).toBe(false);
    expect(canCallerSendAction("force_ring", { role: "parent", isPrimaryParent: false })).toBe(false);
    expect(canCallerSendAction("sos", { role: "child", isPrimaryParent: false })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test -- tests/pushNotificationRouting.test.js`

Expected: FAIL with missing helper import.

- [ ] **Step 3: Implement routing helper**

Create `supabase/functions/push-notify/notificationRouting.ts`:

```ts
const CONTROL_ACTIONS = new Set([
  "remote_listen",
  "remote_listen_stop",
  "request_location",
  "request_device_status",
  "force_ring",
  "force_ring_stop",
]);

const EMERGENCY_ALERT_TYPES = new Set([
  "not_arrived",
  "missed_arrival",
  "danger_zone",
  "danger_enter",
  "danger_entry",
  "danger_exit",
  "sos",
  "sos_followup",
]);

type Member = {
  user_id?: string | null;
  role?: string | null;
  is_primary_parent?: boolean;
};

export function isEmergencyNotificationType(type: string, data: Record<string, unknown> = {}) {
  if (type === "kkuk") return false;
  if (type === "sos" || type === "emergency") return true;
  if (String(data.urgent || "").toLowerCase() === "true") return true;
  if (type !== "parent_alert") return false;

  const severity = String(data.severity || "").trim().toLowerCase();
  const alertType = String(data.alertType || data.alert_type || "").trim().toLowerCase();
  return severity === "emergency"
    || severity === "critical"
    || severity === "urgent"
    || EMERGENCY_ALERT_TYPES.has(alertType);
}

export function selectParentRecipientsForAction(action: string, members: Member[]) {
  const parents = (members || []).filter((member) => (
    member.role === "parent" && typeof member.user_id === "string" && member.user_id.length > 0
  ));

  if (action === "sos") {
    return new Set(parents.map((member) => member.user_id as string));
  }

  const primary = parents.find((member) => member.is_primary_parent);
  return new Set(primary?.user_id ? [primary.user_id] : parents.map((member) => member.user_id as string));
}

export function canCallerSendAction(action: string, caller: { role?: string; isPrimaryParent?: boolean }) {
  if (CONTROL_ACTIONS.has(action)) {
    return caller.role === "parent" && caller.isPrimaryParent === true;
  }
  return true;
}
```

- [ ] **Step 4: Wire `push-notify/index.ts`**

Modify `supabase/functions/push-notify/index.ts`:

```ts
import {
  canCallerSendAction,
  isEmergencyNotificationType,
  selectParentRecipientsForAction,
} from "./notificationRouting.ts";
```

Replace the existing emergency classifier body with:

```ts
function isEmergencyNotification(type: string, data: Record<string, unknown> = {}): boolean {
  return isEmergencyNotificationType(type, data);
}
```

Inside `handleInstantNotification()`, after the existing membership check, load the caller membership with primary status:

```ts
const { data: callerMember } = await supabase
  .from("family_members")
  .select("role, families!inner(parent_id)")
  .eq("family_id", familyId)
  .eq("user_id", senderUserId)
  .maybeSingle();

const callerIsPrimaryParent = callerMember?.role === "parent"
  && callerMember?.families?.parent_id === senderUserId;

if (!canCallerSendAction(action, {
  role: callerMember?.role || callerRole,
  isPrimaryParent: callerIsPrimaryParent,
})) {
  return jsonResponse({ error: "primary_parent_required" }, 403);
}
```

Before calling `sendFcmToFamily()` for parent-targeting actions, load family parent members:

```ts
let parentRecipientIds: Set<string> | null = null;
if (action === "sos" || action === "kkuk") {
  const { data: parentMembers } = await supabase
    .from("family_members")
    .select("user_id, role, families!inner(parent_id)")
    .eq("family_id", familyId)
    .eq("role", "parent");

  parentRecipientIds = selectParentRecipientsForAction(
    action,
    (parentMembers || []).map((member) => ({
      user_id: member.user_id,
      role: member.role,
      is_primary_parent: member.families?.parent_id === member.user_id,
    })),
  );
}
```

Pass `parentRecipientIds` to parent-directed FCM calls. Keep child-native command recipient filtering unchanged.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -- tests/pushNotificationRouting.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/push-notify/index.ts supabase/functions/push-notify/notificationRouting.ts tests/pushNotificationRouting.test.js
git commit -m "fix: route sos separately from kkuk"
```

---

### Task 6: NCP SENS Send SMS Hook

**Files:**
- Create: `supabase/functions/_shared/ncpSens.ts`
- Create: `supabase/functions/send-sms/index.ts`
- Create: `tests/ncpSens.test.js`
- Modify: `supabase/config.toml`

- [ ] **Step 1: Write failing NCP helper tests**

Create `tests/ncpSens.test.js`:

```js
import { describe, expect, it } from "vitest";
import {
  buildNcpSensSmsBody,
  buildNcpSensSignatureMessage,
  normalizePhoneForNcpSens,
} from "../supabase/functions/_shared/ncpSens.ts";

describe("NCP SENS helpers", () => {
  it("normalizes Korean E.164 phone numbers to SENS SMS local recipient format", () => {
    expect(normalizePhoneForNcpSens("+821012345678")).toBe("01012345678");
    expect(normalizePhoneForNcpSens("010-1234-5678")).toBe("01012345678");
  });

  it("builds the documented signature message", () => {
    expect(buildNcpSensSignatureMessage({
      method: "POST",
      uri: "/sms/v2/services/service-id/messages",
      timestamp: "1710000000000",
      accessKey: "access-key",
    })).toBe("POST /sms/v2/services/service-id/messages\n1710000000000\naccess-key");
  });

  it("builds the SMS request body without leaking unsupported characters", () => {
    expect(buildNcpSensSmsBody({
      from: "0212345678",
      to: "+821012345678",
      otp: "123456",
    })).toEqual({
      type: "SMS",
      contentType: "COMM",
      countryCode: "82",
      from: "0212345678",
      content: "[혜니캘린더] 인증번호는 123456 입니다.",
      messages: [{ to: "01012345678" }],
    });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test -- tests/ncpSens.test.js`

Expected: FAIL with missing helper import.

- [ ] **Step 3: Implement shared NCP helper**

Create `supabase/functions/_shared/ncpSens.ts`:

```ts
type SignatureInput = {
  method: string;
  uri: string;
  timestamp: string;
  accessKey: string;
};

type SmsBodyInput = {
  from: string;
  to: string;
  otp: string;
};

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizePhoneForNcpSens(phone: string) {
  const raw = String(phone || "").trim();
  const digits = digitsOnly(raw);

  if (raw.startsWith("+82") && /^82\d{9,10}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }

  if (/^8210\d{8}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }

  if (/^010\d{8}$/.test(digits)) {
    return digits;
  }

  throw new Error("invalid_phone");
}

export function buildNcpSensSignatureMessage(input: SignatureInput) {
  return `${input.method} ${input.uri}\n${input.timestamp}\n${input.accessKey}`;
}

export async function createNcpSensSignature(input: SignatureInput & { secretKey: string }) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(buildNcpSensSignatureMessage(input)),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export function buildNcpSensSmsBody(input: SmsBodyInput) {
  return {
    type: "SMS",
    contentType: "COMM",
    countryCode: "82",
    from: digitsOnly(input.from),
    content: `[혜니캘린더] 인증번호는 ${String(input.otp || "").replace(/\D/g, "")} 입니다.`,
    messages: [{ to: normalizePhoneForNcpSens(input.to) }],
  };
}

export async function sendNcpSensOtp(input: {
  accessKey: string;
  secretKey: string;
  serviceId: string;
  from: string;
  to: string;
  otp: string;
}) {
  const method = "POST";
  const uri = `/sms/v2/services/${input.serviceId}/messages`;
  const timestamp = String(Date.now());
  const signature = await createNcpSensSignature({
    method,
    uri,
    timestamp,
    accessKey: input.accessKey,
    secretKey: input.secretKey,
  });

  const response = await fetch(`https://sens.apigw.ntruss.com${uri}`, {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-ncp-apigw-timestamp": timestamp,
      "x-ncp-iam-access-key": input.accessKey,
      "x-ncp-apigw-signature-v2": signature,
    },
    body: JSON.stringify(buildNcpSensSmsBody({
      from: input.from,
      to: input.to,
      otp: input.otp,
    })),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ncp_sens_${response.status}: ${text.slice(0, 300)}`);
  }

  return response;
}
```

- [ ] **Step 4: Implement Send SMS Edge Function**

Create `supabase/functions/send-sms/index.ts`:

```ts
import { sendNcpSensOtp } from "../_shared/ncpSens.ts";

const ACCESS_KEY = Deno.env.get("NCP_SENS_ACCESS_KEY") || "";
const SECRET_KEY = Deno.env.get("NCP_SENS_SECRET_KEY") || "";
const SERVICE_ID = Deno.env.get("NCP_SENS_SERVICE_ID") || "";
const FROM_NUMBER = Deno.env.get("NCP_SENS_FROM_NUMBER") || "";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!ACCESS_KEY || !SECRET_KEY || !SERVICE_ID || !FROM_NUMBER) {
    return jsonResponse({ error: "ncp_sens_not_configured" }, 500);
  }

  let event: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    event = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const phone = event?.user?.phone || "";
  const otp = event?.sms?.otp || "";
  if (!phone || !otp) {
    return jsonResponse({ error: "missing_phone_or_otp" }, 400);
  }

  try {
    await sendNcpSensOtp({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      serviceId: SERVICE_ID,
      from: FROM_NUMBER,
      to: phone,
      otp,
    });
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("send-sms failed:", error);
    return jsonResponse({ error: "sms_provider_failed" }, 502);
  }
});
```

- [ ] **Step 5: Update local Supabase SMS config**

Modify `supabase/config.toml`:

```toml
[auth.sms]
enable_signup = true
enable_confirmations = false
template = "Your code is {{ .Code }}"
max_frequency = "30s"
```

Production configuration after deploying `send-sms`:

- Supabase Dashboard > Authentication > Hooks > Send SMS
- Hook type: HTTP
- Hook URL: the deployed Edge Function URL for this Supabase project
- Required Edge Function secrets: `NCP_SENS_ACCESS_KEY`, `NCP_SENS_SECRET_KEY`, `NCP_SENS_SERVICE_ID`, `NCP_SENS_FROM_NUMBER`

Record the exact deployed hook URL in the verification checklist after deployment.

- [ ] **Step 6: Run focused tests**

Run: `npm run test -- tests/ncpSens.test.js tests/phoneAuth.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/ncpSens.ts supabase/functions/send-sms/index.ts tests/ncpSens.test.js supabase/config.toml
git commit -m "feat: add ncp sens sms auth hook"
```

---

### Task 7: App UI Guards and SMS Login Surface

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/lib/auth.js`
- Modify: `src/lib/phoneAuth.js`
- Use existing helper tests from Tasks 1 and 2 for phone and capability logic. Cover the `RoleSetupModal` UI through Playwright in Task 8 because it is currently local to `src/App.jsx`.

- [ ] **Step 1: Keep UI changes inside the current monolith boundary**

`RoleSetupModal` is local to `src/App.jsx`. Keep the SMS login UI inline there, use the already-added pure helper tests for unit coverage, and verify the UI through the real-services Playwright flow in Task 8.

- [ ] **Step 2: Import helpers**

Modify the top of `src/App.jsx`:

```js
import { deriveParentCapabilities } from "./lib/parentCapabilities.js";
import { requestParentPhoneOtp, verifyParentPhoneOtp } from "./lib/phoneAuth.js";
```

- [ ] **Step 3: Add capability derivation inside `App()`**

Near the existing `isParent` constant, add:

```js
const parentCapabilities = useMemo(
    () => deriveParentCapabilities(familyInfo, authUser, myRole),
    [familyInfo, authUser, myRole]
);
const isPrimaryParent = parentCapabilities.isPrimaryParent;
const isCoParent = parentCapabilities.isCoParent;
```

- [ ] **Step 4: Guard write handlers**

At the beginning of these handlers, add the exact guard:

```js
if (!parentCapabilities.canWriteSchedule) {
    showNotif("보조 보호자는 일정을 확인만 할 수 있어요.", "error");
    return;
}
```

Apply it to:

- `addEvent`
- `handleDeleteEvent`
- `updateEvField`
- `openEditEventModal`
- AI schedule save handlers that persist events
- Voice event insert paths

At the beginning of child-control handlers, add:

```js
if (!parentCapabilities.canRequestChildLocation) {
    showNotif("아이 제어는 구독한 보호자만 사용할 수 있어요.", "error");
    return false;
}
```

Apply it to:

- `requestChildLocationRefresh`
- `requestChildDeviceStatusRefresh`
- remote listen open/start paths
- force-ring tab open path
- pair-code regeneration and unpair paths

- [ ] **Step 5: Guard visible UI entries**

Replace parent-only utility action conditions for child-control actions. Example for the child tracker:

```js
isParent ? {
    key: "child-tracker",
    icon: "📍",
    label: "우리아이",
    ariaLabel: "📍 우리아이",
    palette: { bg: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", color: "#1D4ED8", shadow: "rgba(59,130,246,0.16)" },
    onClick: () => setShowChildTracker(true),
} : null
```

becomes:

```js
isParent && parentCapabilities.canRequestChildLocation ? {
    key: "child-tracker",
    icon: "📍",
    label: "우리아이",
    ariaLabel: "📍 우리아이",
    palette: { bg: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", color: "#1D4ED8", shadow: "rgba(59,130,246,0.16)" },
    onClick: () => setShowChildTracker(true),
} : null
```

Use these capability checks:

- Schedule add button: `parentCapabilities.canWriteSchedule`
- Academy/saved-place management: `parentCapabilities.canManagePlaces`
- Friend playdate settings: `parentCapabilities.canManageFamily`
- Force-ring: `parentCapabilities.canUseForceRing`
- Subscription: `parentCapabilities.canManageSubscription`
- Contacts: `parentCapabilities.canEditParentPhones`
- Remote audio: `parentCapabilities.canUseRemoteListen`
- Danger zones: `parentCapabilities.canManagePlaces`
- Pairing modal destructive controls: `parentCapabilities.canManageFamily`

Keep visible for co-parent:

- Calendar.
- Memo.
- Stickers.
- Sticker book.

- [ ] **Step 6: Add SMS login UI to `RoleSetupModal`**

Inside `RoleSetupModal`, add state:

```js
const [phoneMode, setPhoneMode] = useState(false);
const [phoneValue, setPhoneValue] = useState("");
const [otpValue, setOtpValue] = useState("");
const [otpSent, setOtpSent] = useState(false);
const [phoneError, setPhoneError] = useState("");
```

Add handlers:

```js
const handlePhoneRequest = async () => {
    setBusy(true);
    setPhoneError("");
    try {
        await requestParentPhoneOtp(supabase.auth, phoneValue);
        rememberParentPairingIntent();
        setOtpSent(true);
    } catch (error) {
        setPhoneError(error?.message || "문자 인증번호를 보내지 못했어요.");
    } finally {
        setBusy(false);
    }
};

const handlePhoneVerify = async () => {
    setBusy(true);
    setPhoneError("");
    try {
        await verifyParentPhoneOtp(supabase.auth, phoneValue, otpValue);
    } catch (error) {
        setPhoneError(error?.message || "인증번호를 확인하지 못했어요.");
        setBusy(false);
    }
};
```

Under the Kakao parent button, add a secondary button:

```jsx
<button
    type="button"
    onClick={() => setPhoneMode((value) => !value)}
    disabled={busy}
    style={{ ...makeSecondaryButtonStyle({ padding: "14px 16px" }), textAlign: "center" }}
>
    문자 인증으로 학부모 로그인
</button>
```

When `phoneMode` is true, render:

```jsx
<div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
    <input
        value={phoneValue}
        onChange={(event) => setPhoneValue(event.target.value)}
        inputMode="tel"
        placeholder="010-1234-5678"
        style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #E5E7EB", fontFamily: FF, fontWeight: 700 }}
    />
    {otpSent && (
        <input
            value={otpValue}
            onChange={(event) => setOtpValue(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="인증번호 6자리"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #E5E7EB", fontFamily: FF, fontWeight: 800, letterSpacing: 2, textAlign: "center" }}
        />
    )}
    {phoneError && <div role="alert" style={{ color: "#DC2626", fontSize: 12, fontWeight: 800 }}>{phoneError}</div>}
    <button
        type="button"
        onClick={otpSent ? handlePhoneVerify : handlePhoneRequest}
        disabled={busy}
        style={makePrimaryButtonStyle({ padding: "13px 16px", opacity: busy ? 0.65 : 1 })}
    >
        {otpSent ? "인증번호 확인" : "인증번호 받기"}
    </button>
</div>
```

- [ ] **Step 7: Separate `kkuk` and `sos` client actions**

Current `sendKkuk()` mixes love UX with SOS audit and parent-initiated location refresh. Split into:

```js
const sendKkuk = useCallback(() => {
    if (kkukCooldown || !familyId || !authUser) return;
    setKkukCooldown(true);
    setTimeout(() => setKkukCooldown(false), 5000);
    const senderLabel = isParent ? "엄마" : "아이";
    const dedupKey = crypto.randomUUID();
    const kkukPayload = { senderId: authUser.id, senderRole: isParent ? "parent" : "child", timestamp: Date.now(), dedup_key: dedupKey };
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    showNotif("💗 꾹을 보냈어요!");
    void sendInstantPush({
        action: "kkuk",
        familyId,
        senderUserId: authUser.id,
        title: "💗 꾹!",
        message: `${senderLabel}가 꾹을 보냈어요!`,
        idempotencyKey: dedupKey,
    });
    void sendBroadcastWhenReady(realtimeChannel.current, "kkuk", kkukPayload, {
        timeoutMs: 1800,
        pollMs: 60,
    }).catch((error) => console.warn("[kkuk] realtime send failed:", error));
}, [kkukCooldown, familyId, authUser, isParent, showNotif]);
```

Add a separate SOS sender for actual emergency UI only:

```js
const sendSos = useCallback(() => {
    if (!familyId || !authUser || myRole !== "child") return;
    const dedupKey = crypto.randomUUID();
    showNotif("🚨 SOS를 보냈어요.");
    void sendInstantPush({
        action: "sos",
        familyId,
        senderUserId: authUser.id,
        title: "🚨 SOS",
        message: "아이가 긴급 도움을 요청했어요.",
        idempotencyKey: dedupKey,
    });
    void supabase.from("sos_events").insert({
        family_id: familyId,
        sender_user_id: authUser.id,
        receiver_user_ids: (familyInfo?.members || [])
            .filter((member) => member.role === "parent" && member.user_id)
            .map((member) => member.user_id),
        delivery_status: { push: "requested" },
        client_request_hash: dedupKey,
    }).catch((error) => console.error("[sos] audit insert failed:", error));
}, [familyId, authUser, myRole, familyInfo, showNotif]);
```

Connect `sendSos` only to the SOS UI entry, not the normal `꾹` button.

- [ ] **Step 8: Run tests**

Run:

```bash
npm run test -- tests/parentCapabilities.test.js tests/phoneAuth.test.js tests/pushNotificationRouting.test.js
npm run build
```

Expected: all pass and Vite builds without errors.

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx src/lib/auth.js src/lib/phoneAuth.js
git commit -m "feat: add co-parent ui guards and phone login"
```

---

### Task 8: End-to-End and Connected Android Verification

**Files:**
- Modify: `tests/e2e/coparent-permissions-real.spec.js`
- Create or update: `docs/superpowers/verifications/2026-04-29-coparent-sms-auth-checklist.md`

- [ ] **Step 1: Add real-services UI assertions for co-parent restrictions**

Modify `tests/e2e/coparent-permissions-real.spec.js` after the co-parent `page.goto("/")` assertion:

```js
await expect(page.getByRole("button", { name: /스티커/ })).toBeVisible();
await expect(page.getByRole("button", { name: /메모/ })).toBeVisible();
await expect(page.getByTitle("일정 추가")).toHaveCount(0);
await expect(page.getByRole("button", { name: /구독/ })).toHaveCount(0);
await expect(page.getByRole("button", { name: /우리아이/ })).toHaveCount(0);
await expect(page.getByRole("button", { name: /학원관리/ })).toHaveCount(0);
await expect(page.getByRole("button", { name: /친구놀이/ })).toHaveCount(0);
await expect(page.getByRole("button", { name: /응급 강제 알림/ })).toHaveCount(0);
await expect(page.getByRole("button", { name: /주변소리/ })).toHaveCount(0);
await expect(page.getByRole("button", { name: /위험지역/ })).toHaveCount(0);
```

- [ ] **Step 2: Run focused real-services E2E and verify GREEN**

Run: `npx playwright test --config=playwright.real.config.js tests/e2e/coparent-permissions-real.spec.js`

Expected: PASS.

- [ ] **Step 3: Run unit and build gates**

Run:

```bash
npm run test
npm run build
npm run test:e2e
```

Expected: all pass.

- [ ] **Step 4: Run full real-services E2E**

Run:

```bash
npx playwright test --config=playwright.real.config.js
```

Expected: PASS. If the full suite fails, stop, inspect the first failure artifact, fix the cause, and rerun the failed suite before continuing.

- [ ] **Step 5: Check connected devices**

Run:

```bash
adb kill-server
adb start-server
adb devices -l
```

Expected:

- Galaxy 25 is listed and authorized.
- Quantum is listed and authorized.

If ADB still reports `cannot connect to daemon`, record the blocker and do not claim actual device E2E completion.

- [ ] **Step 6: Build and install Android app**

Run:

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
powershell -NoProfile -Command "$devices = adb devices | Select-String \"`tdevice$\" | ForEach-Object { ($_ -split \"`t\")[0] }; foreach ($device in $devices) { adb -s $device install -r app/build/outputs/apk/debug/app-debug.apk }"
```

Expected: APK installs on both devices.

- [ ] **Step 7: Manual device E2E checklist**

Create `docs/superpowers/verifications/2026-04-29-coparent-sms-auth-checklist.md`:

```md
# Co-Parent SMS Auth Connected Device Verification

Date: 2026-04-29

## Devices

- Galaxy 25: parent mode
- Quantum: child mode

## Checks

- [ ] Galaxy 25 signs in as primary parent.
- [ ] Quantum signs in as child and stays paired.
- [ ] A second parent account joins with `KID-********`.
- [ ] Co-parent sees schedule.
- [ ] Co-parent cannot add, edit, or delete schedule.
- [ ] Co-parent can send memo.
- [ ] Co-parent can send praise sticker.
- [ ] Child `꾹` does not appear as SOS on co-parent.
- [ ] Child SOS arrives on both primary parent and co-parent.
- [ ] Co-parent cannot trigger remote listen.
- [ ] Co-parent cannot trigger location refresh.
- [ ] Co-parent cannot use force-ring.
- [ ] SMS OTP login succeeds and lands on parent family setup or existing family screen.
```

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/coparent-permissions-real.spec.js docs/superpowers/verifications/2026-04-29-coparent-sms-auth-checklist.md
git commit -m "test: verify co-parent sms auth flows"
```

---

## Plan Self-Review

- Spec coverage: co-parent one-per-family, limited permissions, SOS-only co-parent emergency receipt, `kkuk` separation, NCP SENS SMS OTP, and connected-device verification are all mapped to tasks.
- Completeness scan: no `TBD`, omitted code blocks, or incomplete test descriptions remain.
- Type consistency: helper names are consistent across tests and implementation snippets.
- Risk note: `src/App.jsx` is large. Keep edits scoped to auth, capability guards, parent action visibility, and `kkuk`/`sos` handlers only.
- Deployment note: production phone auth also requires Supabase Dashboard Phone provider and Send SMS Hook configuration plus NCP SENS secrets. Local config changes do not update production dashboard settings.
