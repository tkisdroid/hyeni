# OAuth Identity Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OAuth(카카오/구글)로 로그인한 사용자가 동일 인물의 기존 전화번호 가입 계정과 자동으로 연결되도록 한다 — 매칭은 전화 OTP만, 매칭 성공 시 명시 컨펌, 세션 swap은 service-role Edge Function으로 식별자(`auth.identities`)를 이전한다.

**Architecture:** Option B 확정 (`project_oauth_linking_decision.md`). OAuth callback → `OAuthBridgeScreen` 진입 → `find_user_by_phone` SECURITY DEFINER RPC로 후보 phone user 조회 → 컨펌 → phone OTP 재인증으로 phone session 활성화 → Edge Function `merge-oauth-into-phone`이 service role로 `auth.identities.user_id`를 phone user에게 이전하고 OAuth 임시 user를 `admin.deleteUser`로 정리. `user_profiles.linked_providers` JSONB 가 "이미 bridge 끝난 사용자"의 idempotent marker. 매칭 실패 시 OAuth user를 신규 부모 계정으로 이어 가입(전화 등록 + 부모 프로필 폼)으로 폴백.

**Tech Stack:** React 19, Vite 7, Supabase JS v2.58, Supabase Auth/RLS, Deno 2 Edge Functions, Vitest 4, Capacitor 8. Wanted DS 토큰 (`src/styles/tokens.css`).

---

## File Structure

- Modify `supabase/config.toml`: enable manual linking (`enable_manual_linking = true`) for local dev parity. Production은 Dashboard에서 동일 토글.
- Create `supabase/migrations/20260515000000_oauth_identity_linking.sql`: `user_profiles.linked_providers` JSONB 컬럼 추가 + `find_user_by_phone(p_phone TEXT) RETURNS UUID` RPC (SECURITY DEFINER STABLE) + `mark_linked_provider(p_user_id UUID, p_provider TEXT, p_payload JSONB)` RPC (SECURITY DEFINER, caller self-only).
- Create `supabase/migrations/down/20260515000000_oauth_identity_linking.sql`: paired rollback.
- Create `supabase/migrations/20260515000001_transfer_oauth_identity.sql`: `transfer_oauth_identity(p_oauth_user, p_phone_user, p_provider)` SECURITY DEFINER (service_role only).
- Create `supabase/migrations/down/20260515000001_transfer_oauth_identity.sql`.
- Create `supabase/functions/merge-oauth-into-phone/index.ts`: service-role Edge Function. JWT로 phone session caller 검증, `transfer_oauth_identity` 호출, `admin.deleteUser(oauth_user_id)`.
- Modify `src/lib/accountAuth.js`: `findUserByPhone`, `requestOAuthBridgeOtp`, `verifyOAuthBridgeOtp`, `mergeOAuthIntoPhoneUser`, `markProviderLinked` helper 추가. 기존 `buildAuthProfileFromUser`는 건드리지 않는다.
- Modify `src/lib/auth.js`: `getOAuthUserNeedsBridge(user)` predicate 추가 — `linked_providers` 또는 `user_metadata.linked_providers`가 빈 OAuth-only user 식별.
- Create `src/components/auth/OAuthBridgeScreen.jsx`: 5 state machine (`prompt → otp → match-confirm → linking → done`). Wanted DS 토큰. 빨강은 SOS 아님이라 안 씀 (`design_color_rules` memory 준수).
- Create `tests/oauthBridge.test.js`: Vitest — `findUserByPhone` 응답 mock, `getOAuthUserNeedsBridge` 분기, helper 함수 동작 검증.
- Modify `src/App.jsx`: `handleAuthUser` 진입 직전 `getOAuthUserNeedsBridge(user)` 체크 → 통과 시 OAuthBridgeScreen 라우팅. 기존 가입자 흐름(setupFamily, getMyFamily)는 bridge 완료 후에만 진행.
- Create `docs/superpowers/verifications/2026-05-15-oauth-bridge-verification.md`: manual E2E test checklist.

---

## Open Production Settings (코드 외부)

이 plan에 포함되지 않지만 deploy 전 반드시 적용:

- Supabase Dashboard → Auth → **Allow manual linking** 토글 ON (production 프로젝트).
- Supabase Dashboard → Edge Functions → Secrets: `SUPABASE_SERVICE_ROLE_KEY` 이미 존재(naver-auth와 공유). 추가 secret 없음.
- 배포: `supabase functions deploy merge-oauth-into-phone` — `--no-verify-jwt` **빼고** 배포 (이 함수는 JWT 검증 필수). naver-auth와 다른 부분이라 주의.
- Test 환경: 두 디바이스 install 전 staging Supabase에 동일 마이그레이션 + 함수 deploy.

---

### Task 1: Enable manual linking in local config

**Files:**
- Modify: `supabase/config.toml:172-173`

- [ ] **Step 1: Toggle enable_manual_linking**

Open `supabase/config.toml`, find line 173 (`enable_manual_linking = false`) and change to:

```toml
# Allow/disallow testing manual linking of accounts
# Production: must also be toggled in Dashboard → Auth → Allow manual linking.
# Required by docs/superpowers/plans/2026-05-15-oauth-identity-linking.md
enable_manual_linking = true
```

- [ ] **Step 2: Verify local Supabase picks up the change**

Run: `supabase stop && supabase start`
Expected: no errors. (If supabase CLI not installed locally, skip and rely on production Dashboard toggle.)

- [ ] **Step 3: Commit**

```bash
git add supabase/config.toml
git commit -m "feat(auth): enable manual identity linking for OAuth bridge"
```

---

### Task 2: DB migration — linked_providers + find_user_by_phone RPC

**Files:**
- Create: `supabase/migrations/20260515000000_oauth_identity_linking.sql`
- Create: `supabase/migrations/down/20260515000000_oauth_identity_linking.sql`

- [ ] **Step 1: Write the up migration**

Create `supabase/migrations/20260515000000_oauth_identity_linking.sql`:

```sql
-- OAuth identity linking — adds tracking column + matching RPC for OAuth-first bridge.
--
-- Bridge flow:
--   1. Client (OAuth-only session) calls find_user_by_phone(p_phone) → returns target user_id or NULL.
--   2. Client OTP-verifies phone → signs in as target user → calls merge-oauth-into-phone Edge Function.
--   3. Edge Function moves auth.identities row and deletes the OAuth-only user.
--   4. Client calls mark_linked_provider for idempotency marker so the next OAuth login
--      skips the bridge.

BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS linked_providers jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS user_profiles_linked_providers_gin
  ON public.user_profiles USING gin (linked_providers);

-- Find an existing phone-primary user by their stored phone (E.164 +82...).
-- Returns NULL when no match.
-- SECURITY DEFINER because anon callers need to ask "does this phone have an account?"
-- without exposing the full user_profiles row (RLS prevents SELECT for anon today).
-- Reveals only existence (UUID) — not metadata.
CREATE OR REPLACE FUNCTION public.find_user_by_phone(p_phone text)
RETURNS uuid AS $$
  SELECT user_id
    FROM public.user_profiles
   WHERE phone = p_phone
   LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.find_user_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_by_phone(text) TO anon, authenticated;

-- Caller-self provider linking marker. Edge Function calls this on behalf of the
-- phone user (running with their JWT) after a successful merge.
CREATE OR REPLACE FUNCTION public.mark_linked_provider(
  p_user_id uuid,
  p_provider text,
  p_payload jsonb
)
RETURNS void AS $$
  UPDATE public.user_profiles
     SET linked_providers = linked_providers || jsonb_build_object(p_provider, p_payload),
         updated_at = now()
   WHERE user_id = p_user_id
     AND user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER VOLATILE SET search_path = public;

REVOKE ALL ON FUNCTION public.mark_linked_provider(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_linked_provider(uuid, text, jsonb) TO authenticated;

COMMIT;
```

- [ ] **Step 2: Write the down migration**

Create `supabase/migrations/down/20260515000000_oauth_identity_linking.sql`:

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.mark_linked_provider(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.find_user_by_phone(text);
DROP INDEX IF EXISTS user_profiles_linked_providers_gin;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS linked_providers;
COMMIT;
```

- [ ] **Step 3: Apply migration and verify**

Run: `supabase db reset` (local) OR `supabase db push` (staging).

Then in SQL editor:

```sql
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='user_profiles' AND column_name='linked_providers';
-- Expected: linked_providers | jsonb | '{}'::jsonb

SELECT public.find_user_by_phone('+8200000000000');
-- Expected: NULL (no match), no error.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260515000000_oauth_identity_linking.sql supabase/migrations/down/20260515000000_oauth_identity_linking.sql
git commit -m "feat(auth): add linked_providers + find_user_by_phone RPC for OAuth bridge"
```

---

### Task 3: DB function — transfer_oauth_identity (service-role only)

**Files:**
- Create: `supabase/migrations/20260515000001_transfer_oauth_identity.sql`
- Create: `supabase/migrations/down/20260515000001_transfer_oauth_identity.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260515000001_transfer_oauth_identity.sql`:

```sql
-- Service-role only helper. Moves an auth.identities row from one user to another.
-- Called by the merge-oauth-into-phone Edge Function (which is the only caller
-- with service_role privileges). NEVER grant to authenticated/anon.

BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_oauth_identity(
  p_oauth_user uuid,
  p_phone_user uuid,
  p_provider text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_identity_count int;
BEGIN
  -- Defensive: only the configured provider; never accept 'phone' or 'email'
  IF p_provider NOT IN ('kakao', 'google') THEN
    RAISE EXCEPTION 'unsupported_provider: %', p_provider;
  END IF;

  -- Confirm the oauth user has exactly one identity row for this provider
  SELECT count(*) INTO v_identity_count
    FROM auth.identities
   WHERE user_id = p_oauth_user AND provider = p_provider;
  IF v_identity_count <> 1 THEN
    RAISE EXCEPTION 'oauth_identity_count_unexpected: %', v_identity_count;
  END IF;

  -- Confirm the phone user does NOT already own this provider
  SELECT count(*) INTO v_identity_count
    FROM auth.identities
   WHERE user_id = p_phone_user AND provider = p_provider;
  IF v_identity_count <> 0 THEN
    RAISE EXCEPTION 'phone_user_already_has_provider: %', p_provider;
  END IF;

  -- Perform the transfer
  UPDATE auth.identities
     SET user_id = p_phone_user,
         updated_at = now()
   WHERE user_id = p_oauth_user
     AND provider = p_provider;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_oauth_identity(uuid, uuid, text) FROM PUBLIC;
-- service_role only. authenticated/anon 절대 금지.
GRANT EXECUTE ON FUNCTION public.transfer_oauth_identity(uuid, uuid, text) TO service_role;

COMMIT;
```

- [ ] **Step 2: Write the down migration**

Create `supabase/migrations/down/20260515000001_transfer_oauth_identity.sql`:

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.transfer_oauth_identity(uuid, uuid, text);
COMMIT;
```

- [ ] **Step 3: Apply and verify grants**

Run: `supabase db push` (or `supabase db reset` locally).

In SQL editor (anon role):

```sql
SET ROLE anon;
SELECT public.transfer_oauth_identity('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'kakao');
-- Expected: ERROR: permission denied for function transfer_oauth_identity
RESET ROLE;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260515000001_transfer_oauth_identity.sql supabase/migrations/down/20260515000001_transfer_oauth_identity.sql
git commit -m "feat(auth): add transfer_oauth_identity SECURITY DEFINER fn for Edge Function"
```

---

### Task 4: Edge Function — merge-oauth-into-phone (skeleton + JWT verification)

**Files:**
- Create: `supabase/functions/merge-oauth-into-phone/index.ts`

- [ ] **Step 1: Write the function skeleton with JWT verification**

Create `supabase/functions/merge-oauth-into-phone/index.ts`:

```ts
// supabase/functions/merge-oauth-into-phone/index.ts
//
// OAuth → phone user identity transfer. Called by the client AFTER the user has
// re-authenticated as the phone user via OTP. The caller's JWT (phone session) is
// the trust anchor: we move the OAuth identity row to that user_id, then delete
// the orphaned OAuth user.
//
// Input (JSON):
//   { oauth_user_id: string, provider: 'kakao'|'google' }
//
// Output (JSON):
//   { ok: true, linked: true, provider } on success
//   { ok: false, error: string } on failure (4xx/5xx)
//
// Deploy:
//   supabase functions deploy merge-oauth-into-phone
//   (DO NOT pass --no-verify-jwt — we rely on JWT verification.)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_PROVIDERS = new Set(["kakao", "google"]);

interface MergeRequest {
  oauth_user_id?: string;
  provider?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  // 1. JWT 검증 — supabase-js 로 caller 의 user_id 확인
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ ok: false, error: "missing_jwt" }, 401);

  const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller, error: callerError } = await callerClient.auth.getUser(jwt);
  if (callerError || !caller?.user?.id) {
    return jsonResponse({ ok: false, error: "invalid_jwt" }, 401);
  }
  const phoneUserId = caller.user.id;

  // 2. 입력 파싱
  let body: MergeRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const { oauth_user_id: oauthUserId, provider } = body;
  if (!oauthUserId || typeof oauthUserId !== "string") {
    return jsonResponse({ ok: false, error: "missing_oauth_user_id" }, 400);
  }
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return jsonResponse({ ok: false, error: "unsupported_provider" }, 400);
  }
  if (oauthUserId === phoneUserId) {
    return jsonResponse({ ok: false, error: "same_user" }, 400);
  }

  // 3. (Task 5 에서 채움) — identity 이전 + oauth user 삭제
  return jsonResponse({ ok: false, error: "not_implemented" }, 500);
});
```

- [ ] **Step 2: Deploy and verify it rejects bad input**

Run: `supabase functions deploy merge-oauth-into-phone` (against staging).
Expected: success.

Test with curl:

```bash
curl -i -X POST "https://<project>.supabase.co/functions/v1/merge-oauth-into-phone" \
  -H "Authorization: Bearer invalid" \
  -H "Content-Type: application/json" \
  -d "{}"
```
Expected: 401 `{"ok":false,"error":"invalid_jwt"}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/merge-oauth-into-phone/index.ts
git commit -m "feat(auth): scaffold merge-oauth-into-phone Edge Function with JWT verification"
```

---

### Task 5: Edge Function — identity transfer + oauth user deletion

**Files:**
- Modify: `supabase/functions/merge-oauth-into-phone/index.ts:99-103`

- [ ] **Step 1: Replace the "not_implemented" branch with the merge logic**

In `supabase/functions/merge-oauth-into-phone/index.ts`, replace the comment `// 3. (Task 5 에서 채움) — identity 이전 + oauth user 삭제` and the next `return` line with:

```ts
  // 3. Service-role admin client (separate instance — bypasses RLS, no JWT context)
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3a. OAuth user 존재 + 해당 provider identity 보유 확인
  const { data: oauthUser, error: oauthError } = await admin.auth.admin.getUserById(oauthUserId);
  if (oauthError || !oauthUser?.user) {
    return jsonResponse({ ok: false, error: "oauth_user_not_found" }, 404);
  }
  const oauthIdentity = (oauthUser.user.identities || []).find((i) => i.provider === provider);
  if (!oauthIdentity) {
    return jsonResponse({ ok: false, error: "oauth_identity_missing" }, 409);
  }

  // 3b. Phone user 가 이미 같은 provider identity 를 가지고 있으면 중단
  const { data: phoneUser, error: phoneUserError } = await admin.auth.admin.getUserById(phoneUserId);
  if (phoneUserError || !phoneUser?.user) {
    return jsonResponse({ ok: false, error: "phone_user_not_found" }, 404);
  }
  const conflictingIdentity = (phoneUser.user.identities || []).find((i) => i.provider === provider);
  if (conflictingIdentity) {
    return jsonResponse({ ok: false, error: "phone_user_already_linked" }, 409);
  }

  // 3c. auth.identities row 의 user_id 를 phone_user 로 이전
  // SECURITY DEFINER RPC (transfer_oauth_identity) 가 보호된 auth schema 에 접근.
  const { error: transferError } = await admin.rpc("transfer_oauth_identity", {
    p_oauth_user: oauthUserId,
    p_phone_user: phoneUserId,
    p_provider: provider,
  });
  if (transferError) {
    return jsonResponse({ ok: false, error: "transfer_failed", detail: transferError.message }, 500);
  }

  // 3d. OAuth-only user 삭제 (이미 identity 가 옮겨졌으므로 고아 row)
  const { error: deleteError } = await admin.auth.admin.deleteUser(oauthUserId);
  if (deleteError) {
    // identity 는 이미 옮겨졌으므로 사용자 영향은 없음. 단, 고아 user row 가 남음.
    console.error("[merge-oauth-into-phone] deleteUser failed:", deleteError.message);
  }

  return jsonResponse({ ok: true, linked: true, provider });
```

- [ ] **Step 2: Deploy and verify with bogus oauth_user_id**

Run: `supabase functions deploy merge-oauth-into-phone`

Test with a real phone-user JWT (Dashboard → Auth → copy access token of any phone user):

```bash
curl -i -X POST "https://<project>.supabase.co/functions/v1/merge-oauth-into-phone" \
  -H "Authorization: Bearer <phone-user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"oauth_user_id":"00000000-0000-0000-0000-000000000000","provider":"kakao"}'
```
Expected: 404 `{"ok":false,"error":"oauth_user_not_found"}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/merge-oauth-into-phone/index.ts
git commit -m "feat(auth): implement OAuth→phone identity transfer in Edge Function"
```

---

### Task 6: Frontend helpers in accountAuth.js

**Files:**
- Modify: `src/lib/accountAuth.js` (append at end of file)
- Create: `tests/oauthBridge.test.js`

- [ ] **Step 1: Write failing tests for the new helpers**

Create `tests/oauthBridge.test.js`:

```js
import { describe, expect, it, vi } from "vitest";
import {
  findUserByPhone,
  requestOAuthBridgeOtp,
  verifyOAuthBridgeOtp,
  mergeOAuthIntoPhoneUser,
  markProviderLinked,
} from "../src/lib/accountAuth.js";

function makeClient(overrides = {}) {
  return {
    rpc: vi.fn(async (name) => {
      if (overrides.rpc?.[name]) return overrides.rpc[name];
      return { data: null, error: null };
    }),
    auth: {
      signInWithOtp: vi.fn(async () => overrides.signInWithOtp ?? { data: {}, error: null }),
      verifyOtp: vi.fn(async () => overrides.verifyOtp ?? { data: { user: { id: "phone-uid" }, session: { access_token: "tok" } }, error: null }),
    },
    functions: {
      invoke: vi.fn(async () => overrides.invoke ?? { data: { ok: true, linked: true, provider: "kakao" }, error: null }),
    },
  };
}

describe("findUserByPhone", () => {
  it("returns the user_id when RPC finds a match", async () => {
    const client = makeClient({ rpc: { find_user_by_phone: { data: "user-abc", error: null } } });
    await expect(findUserByPhone("010-1234-5678", client)).resolves.toBe("user-abc");
    expect(client.rpc).toHaveBeenCalledWith("find_user_by_phone", { p_phone: "+821012345678" });
  });
  it("returns null when no match", async () => {
    const client = makeClient({ rpc: { find_user_by_phone: { data: null, error: null } } });
    await expect(findUserByPhone("010-1234-5678", client)).resolves.toBeNull();
  });
  it("throws on invalid phone", async () => {
    const client = makeClient();
    await expect(findUserByPhone("nope", client)).rejects.toThrow();
  });
});

describe("requestOAuthBridgeOtp", () => {
  it("sends SMS OTP without creating a user (shouldCreateUser:false)", async () => {
    const client = makeClient();
    await requestOAuthBridgeOtp("010-1234-5678", client);
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: "+821012345678",
      options: { channel: "sms", shouldCreateUser: false },
    });
  });
});

describe("verifyOAuthBridgeOtp", () => {
  it("verifies SMS OTP and returns the phone user id", async () => {
    const client = makeClient();
    const result = await verifyOAuthBridgeOtp("010-1234-5678", "123456", client);
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      phone: "+821012345678",
      token: "123456",
      type: "sms",
    });
    expect(result.userId).toBe("phone-uid");
  });
  it("rejects non-6-digit tokens", async () => {
    const client = makeClient();
    await expect(verifyOAuthBridgeOtp("010-1234-5678", "12", client)).rejects.toThrow();
  });
});

describe("mergeOAuthIntoPhoneUser", () => {
  it("invokes the Edge Function with provider + oauth_user_id", async () => {
    const client = makeClient();
    const result = await mergeOAuthIntoPhoneUser({ oauthUserId: "oauth-uid", provider: "kakao" }, client);
    expect(client.functions.invoke).toHaveBeenCalledWith("merge-oauth-into-phone", {
      body: { oauth_user_id: "oauth-uid", provider: "kakao" },
    });
    expect(result.ok).toBe(true);
  });
  it("throws when Edge Function returns ok:false", async () => {
    const client = makeClient({ invoke: { data: { ok: false, error: "phone_user_already_linked" }, error: null } });
    await expect(mergeOAuthIntoPhoneUser({ oauthUserId: "oauth-uid", provider: "kakao" }, client))
      .rejects.toThrow(/phone_user_already_linked/);
  });
});

describe("markProviderLinked", () => {
  it("calls the mark_linked_provider RPC with the payload", async () => {
    const client = makeClient();
    await markProviderLinked({ userId: "phone-uid", provider: "kakao", payload: { providerId: "kakao-123" } }, client);
    expect(client.rpc).toHaveBeenCalledWith("mark_linked_provider", {
      p_user_id: "phone-uid",
      p_provider: "kakao",
      p_payload: { providerId: "kakao-123" },
    });
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run tests/oauthBridge.test.js`
Expected: 5+ failures, errors like `findUserByPhone is not a function`.

- [ ] **Step 3: Implement the helpers**

Append to `src/lib/accountAuth.js`:

```js
// ── OAuth → phone identity bridge helpers (2026-05-15) ──────────────────────
// 사용: OAuth(카카오/구글)로 로그인한 사용자가 동일인의 기존 전화 가입 계정과
// 연결해야 할 때. App.jsx 의 OAuthBridgeScreen 에서 사용한다.

export async function findUserByPhone(phone, client = supabase) {
  const phoneAuth = normalizePhoneForAuth(phone); // throws if invalid
  const { data, error } = await client.rpc("find_user_by_phone", { p_phone: phoneAuth });
  if (error) throw error;
  return data || null;
}

export async function requestOAuthBridgeOtp(phone, client = supabase) {
  const phoneAuth = normalizePhoneForAuth(phone);
  // shouldCreateUser:false — 매칭이 안 되면 새 user 만들지 않고 명시적 실패.
  // 신규 가입 분기는 OAuthBridgeScreen 이 별도 흐름으로 분기시킨다.
  const { error } = await client.auth.signInWithOtp({
    phone: phoneAuth,
    options: { channel: "sms", shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function verifyOAuthBridgeOtp(phone, token, client = supabase) {
  const phoneAuth = normalizePhoneForAuth(phone);
  const normalizedToken = String(token || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(normalizedToken)) {
    throw new Error("인증번호 6자리를 입력해 주세요");
  }
  const { data, error } = await client.auth.verifyOtp({
    phone: phoneAuth,
    token: normalizedToken,
    type: "sms",
  });
  if (error) throw error;
  if (!data?.user?.id) throw new Error("인증 후 사용자 정보를 확인하지 못했어요");
  return { userId: data.user.id, session: data.session };
}

export async function mergeOAuthIntoPhoneUser({ oauthUserId, provider }, client = supabase) {
  if (!oauthUserId) throw new Error("oauth_user_id 가 필요해요");
  if (provider !== "kakao" && provider !== "google") {
    throw new Error("지원하지 않는 provider 예요");
  }
  const { data, error } = await client.functions.invoke("merge-oauth-into-phone", {
    body: { oauth_user_id: oauthUserId, provider },
  });
  if (error) throw error;
  if (!data?.ok) {
    const detail = data?.error || "unknown_error";
    throw new Error(`OAuth 연결에 실패했어요 (${detail})`);
  }
  return data;
}

export async function markProviderLinked({ userId, provider, payload }, client = supabase) {
  if (!userId || !provider) throw new Error("userId/provider required");
  const { error } = await client.rpc("mark_linked_provider", {
    p_user_id: userId,
    p_provider: provider,
    p_payload: payload || {},
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run tests/oauthBridge.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/accountAuth.js tests/oauthBridge.test.js
git commit -m "feat(auth): add OAuth bridge helpers (findUserByPhone, OTP, merge, markLinked)"
```

---

### Task 7: Predicate — getOAuthUserNeedsBridge

**Files:**
- Modify: `src/lib/auth.js` (append)
- Modify: `tests/oauthBridge.test.js` (append)

- [ ] **Step 1: Add tests for the predicate**

Append to `tests/oauthBridge.test.js`:

```js
import { getOAuthUserNeedsBridge } from "../src/lib/auth.js";

describe("getOAuthUserNeedsBridge", () => {
  function makeUser({ provider, hasPhone = false, linkedProviders = null } = {}) {
    return {
      id: "u1",
      phone: hasPhone ? "01012345678" : null,
      app_metadata: { provider },
      user_metadata: linkedProviders ? { linked_providers: linkedProviders } : {},
      identities: provider ? [{ provider }] : [],
    };
  }
  it("returns true for fresh OAuth kakao user with no phone and no linked marker", () => {
    expect(getOAuthUserNeedsBridge(makeUser({ provider: "kakao" }))).toBe(true);
  });
  it("returns true for google", () => {
    expect(getOAuthUserNeedsBridge(makeUser({ provider: "google" }))).toBe(true);
  });
  it("returns false when phone is already attached (post-bridge)", () => {
    expect(getOAuthUserNeedsBridge(makeUser({ provider: "kakao", hasPhone: true }))).toBe(false);
  });
  it("returns false when linked_providers marker present", () => {
    expect(getOAuthUserNeedsBridge(makeUser({ provider: "kakao", linkedProviders: { kakao: { providerId: "x" } } }))).toBe(false);
  });
  it("returns false for phone-primary users", () => {
    expect(getOAuthUserNeedsBridge(makeUser({ provider: "phone", hasPhone: true }))).toBe(false);
  });
  it("returns false for anonymous users", () => {
    expect(getOAuthUserNeedsBridge({ id: "anon", app_metadata: {}, user_metadata: {}, identities: [] })).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npx vitest run tests/oauthBridge.test.js`
Expected: 6 new failures, "getOAuthUserNeedsBridge is not a function".

- [ ] **Step 3: Implement the predicate**

Append to `src/lib/auth.js`:

```js
// ── OAuth → phone bridge predicate ──────────────────────────────────────────
// OAuth-first 진입 사용자가 아직 phone user 와 연결되지 않은 상태인지 식별한다.
// App.jsx 의 handleAuthUser 가 이 결과로 OAuthBridgeScreen 라우팅 여부 결정.
//
// True 조건: (1) provider 가 kakao/google, (2) auth.users.phone 비어 있음
// (전화 식별 미보유), (3) linked_providers 마커 없음 (이미 bridge 끝난 적
// 없음). 셋 다 참이어야 bridge 필요.
export function getOAuthUserNeedsBridge(user) {
  if (!user) return false;
  const provider = user?.app_metadata?.provider
    || user?.identities?.find?.((i) => i?.provider)?.provider
    || "";
  if (provider !== "kakao" && provider !== "google") return false;
  if (user?.phone) return false; // 이미 전화 연결됨
  const linked = user?.user_metadata?.linked_providers || {};
  if (linked && Object.keys(linked).length > 0) return false;
  return true;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx vitest run tests/oauthBridge.test.js`
Expected: all tests pass (both helper tests and predicate tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.js tests/oauthBridge.test.js
git commit -m "feat(auth): add getOAuthUserNeedsBridge predicate for App routing"
```

---

### Task 8: OAuthBridgeScreen component (UI)

**Files:**
- Create: `src/components/auth/OAuthBridgeScreen.jsx`

- [ ] **Step 1: Implement the component**

Create `src/components/auth/OAuthBridgeScreen.jsx`:

```jsx
import { useState, useCallback, useMemo } from "react";
import {
  findUserByPhone,
  requestOAuthBridgeOtp,
  verifyOAuthBridgeOtp,
  mergeOAuthIntoPhoneUser,
  markProviderLinked,
  getUserDisplayName,
  normalizePhoneForStorage,
} from "../../lib/accountAuth.js";
import { logout } from "../../lib/auth.js";
import { AppBrandLogo } from "./AppBrandLogo.jsx";

// 5-state machine. OAuth 사용자가 진입했을 때만 mount 된다. onLinked 콜백은
// bridge 완료 후 호출 — App.jsx 가 새 phone session 으로 handleAuthUser 를
// 다시 실행한다.
//
// states:
//   prompt        — "처음이세요? / 이미 가입했어요"
//   otp           — 전화번호 + OTP 입력
//   match-confirm — 매칭된 phone user 이름 표시 + 연결 컨펌
//   linking       — Edge Function 호출 중 (스피너)
//   done          — 성공 메시지 후 onLinked
const PROMPT = "prompt";
const OTP = "otp";
const MATCH_CONFIRM = "match-confirm";
const LINKING = "linking";
const DONE = "done";

export function OAuthBridgeScreen({ oauthUser, onLinked, onSignupNew }) {
  const provider = oauthUser?.app_metadata?.provider || "kakao";
  const providerLabel = provider === "google" ? "구글" : "카카오";
  const oauthDisplayName = getUserDisplayName(oauthUser) || providerLabel;

  const [state, setState] = useState(PROMPT);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [matchedUserId, setMatchedUserId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setOtpSent(false);
    setOtpToken("");
    setMatchedUserId(null);
    setError("");
  }, []);

  const handleSendOtp = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const candidateUserId = await findUserByPhone(phone);
      if (!candidateUserId) {
        setError(`이 전화번호로 가입된 계정이 없어요. 새로 가입하려면 아래 "새로 가입할게요" 를 눌러주세요.`);
        return;
      }
      await requestOAuthBridgeOtp(phone);
      setMatchedUserId(candidateUserId);
      setOtpSent(true);
    } catch (err) {
      setError(err?.message || "전화번호 인증 요청에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }, [phone]);

  const handleVerifyOtp = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const { userId } = await verifyOAuthBridgeOtp(phone, otpToken);
      if (userId !== matchedUserId) {
        setError("인증된 사용자 정보가 어긋났어요. 다시 시도해 주세요.");
        return;
      }
      setState(MATCH_CONFIRM);
    } catch (err) {
      setError(err?.message || "인증번호 확인에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }, [phone, otpToken, matchedUserId]);

  const handleConfirmLink = useCallback(async () => {
    setError("");
    setBusy(true);
    setState(LINKING);
    try {
      const result = await mergeOAuthIntoPhoneUser({
        oauthUserId: oauthUser.id,
        provider,
      });
      await markProviderLinked({
        userId: matchedUserId,
        provider,
        payload: { linkedAt: new Date().toISOString() },
      });
      setState(DONE);
      onLinked?.({ userId: matchedUserId, provider, mergeResult: result });
    } catch (err) {
      setError(err?.message || "연결에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setState(MATCH_CONFIRM);
    } finally {
      setBusy(false);
    }
  }, [oauthUser?.id, provider, matchedUserId, onLinked]);

  const handleCancel = useCallback(async () => {
    try { await logout(); } catch { /* logout 실패해도 진행 */ }
    reset();
    setState(PROMPT);
  }, [reset]);

  const headline = useMemo(() => {
    if (state === PROMPT) return `${providerLabel}로 처음 오셨나요?`;
    if (state === OTP) return otpSent ? "인증번호를 입력해 주세요" : "전화번호를 입력해 주세요";
    if (state === MATCH_CONFIRM) return `이 ${providerLabel}을(를) 연결할까요?`;
    if (state === LINKING) return "연결 중이에요";
    if (state === DONE) return "연결이 완료됐어요";
    return "";
  }, [state, otpSent, providerLabel]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10" style={{ background: "var(--bg-base)" }}>
      <AppBrandLogo />
      <div className="w-full max-w-sm mt-6 card p-6" style={{ background: "var(--bg-surface)" }}>
        <h1 className="text-xl font-bold mb-2" style={{ color: "var(--fg-primary)" }}>{headline}</h1>

        {state === PROMPT && (
          <>
            <p className="text-sm mb-6" style={{ color: "var(--fg-secondary)" }}>
              혜니캘린더에 이미 가입한 적이 있다면 전화번호로 본인 확인 후 {providerLabel} 계정을 연결할 수 있어요.
            </p>
            <button type="button" className="btn-primary w-full mb-3" onClick={() => setState(OTP)}>
              이미 가입했어요 — 연결할게요
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => onSignupNew?.(oauthUser)}>
              새로 가입할게요
            </button>
            <button type="button" className="text-sm mt-4 underline" style={{ color: "var(--fg-secondary)" }} onClick={handleCancel}>
              취소하고 로그아웃
            </button>
          </>
        )}

        {state === OTP && (
          <>
            {!otpSent ? (
              <>
                <label className="text-sm block mb-1" style={{ color: "var(--fg-secondary)" }}>전화번호</label>
                <input
                  className="input w-full mb-3"
                  type="tel"
                  inputMode="numeric"
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                />
                <button type="button" className="btn-primary w-full" disabled={busy || !phone} onClick={handleSendOtp}>
                  {busy ? "확인 중..." : "인증번호 받기"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm mb-3" style={{ color: "var(--fg-secondary)" }}>
                  {normalizePhoneForStorage(phone)} 로 보낸 6자리 인증번호를 입력해 주세요.
                </p>
                <input
                  className="input w-full mb-3"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value)}
                  autoFocus
                />
                <button type="button" className="btn-primary w-full mb-2" disabled={busy || otpToken.length !== 6} onClick={handleVerifyOtp}>
                  {busy ? "확인 중..." : "인증 확인"}
                </button>
                <button type="button" className="btn-secondary w-full" disabled={busy} onClick={reset}>
                  전화번호 다시 입력
                </button>
              </>
            )}
          </>
        )}

        {state === MATCH_CONFIRM && (
          <>
            <p className="text-sm mb-6" style={{ color: "var(--fg-secondary)" }}>
              이 {providerLabel} 계정({oauthDisplayName})을 입력하신 전화번호의 기존 계정에 연결할게요.
              한 번 연결되면 다음부터는 {providerLabel} 버튼만 눌러도 같은 계정으로 들어와요.
            </p>
            <button type="button" className="btn-primary w-full mb-2" disabled={busy} onClick={handleConfirmLink}>
              {busy ? "연결 중..." : `${providerLabel} 연결하기`}
            </button>
            <button type="button" className="btn-secondary w-full" disabled={busy} onClick={handleCancel}>
              취소
            </button>
          </>
        )}

        {state === LINKING && (
          <p className="text-sm" style={{ color: "var(--fg-secondary)" }}>잠시만 기다려 주세요...</p>
        )}

        {state === DONE && (
          <p className="text-sm" style={{ color: "var(--fg-secondary)" }}>
            잠시 후 홈으로 이동해요.
          </p>
        )}

        {error && (
          <p className="text-sm mt-4" style={{ color: "var(--accent-warn, #b45309)" }}>{error}</p>
        )}
      </div>
    </div>
  );
}

export default OAuthBridgeScreen;
```

- [ ] **Step 2: Smoke check — file imports resolve**

Run: `npm run build`
Expected: build succeeds (no `Cannot find` errors for OAuthBridgeScreen).

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/OAuthBridgeScreen.jsx
git commit -m "feat(auth): add OAuthBridgeScreen (5-state machine for phone↔OAuth merge)"
```

---

### Task 9: App.jsx routing — invoke bridge before handleAuthUser

**Files:**
- Modify: `src/App.jsx:3` (import)
- Modify: `src/App.jsx` (new useState near other auth state)
- Modify: `src/App.jsx:1591` (handleAuthUser top)
- Modify: `src/App.jsx` (new render gate above SplashScreen branch)

- [ ] **Step 1: Add the import**

In `src/App.jsx` line 3, add `getOAuthUserNeedsBridge` to the import list:

```js
import { anonymousLogin, getSession, joinFamilyAsParent, getMyFamily, unpairChild, regeneratePairCode, saveParentPhones, updateMyProfile, onAuthChange, logout, generateUUID, getParentNameFromUser, getParentPhoneFromUser, getParentGenderFromUser, getOAuthUserNeedsBridge } from "./lib/auth.js";
```

Add OAuthBridgeScreen import near the other auth component imports (after `import { ParentSignupScreen } from "./components/auth/ParentSignupScreen.jsx";`):

```js
import { OAuthBridgeScreen } from "./components/auth/OAuthBridgeScreen.jsx";
```

- [ ] **Step 2: Add state**

Near where `setShowParentSetup` is declared (search `useState(false)` for the parent setup flag), add:

```js
const [oauthBridge, setOauthBridge] = useState(null); // null | { user, provider }
```

- [ ] **Step 3: Gate handleAuthUser on the bridge predicate**

In `src/App.jsx`, replace the function body of `handleAuthUser` (starts at line 1591). Find:

```js
    const handleAuthUser = useCallback(async (user) => {
        setAuthUser(user);
        const provider = getAuthProvider(user);
```

Replace those three lines with:

```js
    const handleAuthUser = useCallback(async (user) => {
        // OAuth-first 사용자 — phone 연결 전에는 정상 진입 차단.
        if (getOAuthUserNeedsBridge(user)) {
            const oauthProvider = user?.app_metadata?.provider
              || user?.identities?.find?.((i) => i?.provider)?.provider
              || "kakao";
            setOauthBridge({ user, provider: oauthProvider });
            return;
        }
        setOauthBridge(null);
        setAuthUser(user);
        const provider = getAuthProvider(user);
```

Update the dependency array of the `useCallback` at the end of `handleAuthUser` (around line 1628) to include `setOauthBridge`:

```js
    }, [setAuthUser, setFamilyInfo, setMyRole, setShowParentSetup, setOauthBridge]);
```

- [ ] **Step 4: Render OAuthBridgeScreen at top of the auth-gated tree**

Find the line where the SplashScreen is rendered conditionally (search for `<SplashScreen`). Immediately ABOVE that conditional block, insert:

```jsx
        if (oauthBridge) {
            return (
                <OAuthBridgeScreen
                    oauthUser={oauthBridge.user}
                    onLinked={async () => {
                        // Edge Function 끝나면 client session 은 이미 phone user.
                        // 새 session 으로 handleAuthUser 재실행.
                        const session = await getSession();
                        setOauthBridge(null);
                        if (session?.user) {
                            await handleAuthUser(session.user);
                        }
                    }}
                    onSignupNew={async () => {
                        // 신규 가입 분기 — 현재 OAuth user 그대로 ParentSetup 으로 진행.
                        setOauthBridge(null);
                        setAuthUser(oauthBridge.user);
                        setMyRole("parent");
                        setShowParentSetup(true);
                    }}
                />
            );
        }
```

- [ ] **Step 5: Build the app**

Run: `npm run build`
Expected: build succeeds, no missing import errors, no TypeScript/JSX errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(auth): route OAuth-only users through OAuthBridgeScreen before app entry"
```

---

### Task 10: Manual end-to-end verification + ship

**Files:**
- Create: `docs/superpowers/verifications/2026-05-15-oauth-bridge-verification.md`

- [ ] **Step 1: Apply migrations + deploy Edge Function to staging**

Run:

```bash
supabase db push
supabase functions deploy merge-oauth-into-phone
```

Expected: both succeed. Verify in Dashboard:
- `user_profiles.linked_providers` column exists.
- `public.find_user_by_phone`, `public.mark_linked_provider`, `public.transfer_oauth_identity` functions present.
- Edge Function `merge-oauth-into-phone` deployed and shows logs.

In Dashboard → Auth → Settings, toggle **Allow manual linking** ON.

- [ ] **Step 2: Write the verification checklist**

Create `docs/superpowers/verifications/2026-05-15-oauth-bridge-verification.md`:

```markdown
# OAuth Bridge — Manual Verification Checklist (2026-05-15)

Test environment: staging Supabase + Android devices R5CY521CFNZ + ZY22H9VTQD.

## Scenario A — Phone-first user adds Kakao (happy path)

1. [ ] App → "전화번호로 가입" 으로 새 부모 계정 만들기. login_id=`testparent01`, phone=`010-1111-2222`.
2. [ ] Family setup 완료.
3. [ ] Logout.
4. [ ] "카카오로 계속하기" 클릭 → Kakao 로그인.
5. [ ] OAuthBridgeScreen 진입 확인. "이미 가입했어요" → 전화번호 `010-1111-2222` 입력 → OTP 수신 → 입력 → MATCH_CONFIRM 화면 표시.
6. [ ] "카카오 연결하기" 클릭 → linking → done → 홈 진입.
7. [ ] `user_profiles.linked_providers` 에서 row 확인: `{"kakao": {"linkedAt": "..."}}`.
8. [ ] `auth.identities` 에서 kakao identity 의 user_id 가 phone user_id 와 같은지 확인.
9. [ ] 다시 logout 후 카카오 로그인 → OAuthBridgeScreen 안 뜨고 바로 홈 진입.

## Scenario B — Phone-first user adds Google

1-9. [ ] Scenario A 와 동일하되 Google 사용.

## Scenario C — Mismatched phone (no existing account)

1. [ ] Logout.
2. [ ] 새 Kakao 계정으로 로그인 (가입 안 된 카카오).
3. [ ] OAuthBridgeScreen → "이미 가입했어요" → 가입 안 된 전화번호 `010-9999-9999` 입력.
4. [ ] 에러 메시지: "이 전화번호로 가입된 계정이 없어요..." 표시 확인.
5. [ ] "새로 가입할게요" 클릭 → ParentSetup 진입.

## Scenario D — 잘못된 OTP 입력

1. [ ] OAuthBridgeScreen → 가입된 전화번호 입력 → OTP 받기 → 틀린 6자리 입력.
2. [ ] 에러 메시지 표시 확인. "전화번호 다시 입력" 또는 OTP 재입력 가능 확인.

## Scenario E — Edge Function 실패 (network 끊기)

1. [ ] OAuthBridgeScreen → match-confirm 상태까지 진행.
2. [ ] 비행기 모드 ON → "카카오 연결하기" 클릭.
3. [ ] 에러 메시지 표시 + 상태 MATCH_CONFIRM 유지 (LINKING 에 멈춰 있지 않음) 확인.

## Scenario F — 이미 linking 끝난 user 의 second OAuth 로그인

1. [ ] Scenario A 완료 상태.
2. [ ] Logout → 카카오 로그인.
3. [ ] OAuthBridgeScreen 안 뜨고 바로 홈 진입 확인 (`getOAuthUserNeedsBridge` false).

## DB sanity

- [ ] orphan oauth user (`auth.users` 에 phone null + email null + 0 family memberships) 없음.
- [ ] `auth.identities.user_id` 가 모두 `auth.users.id` 와 매핑됨.
- [ ] `user_profiles.linked_providers` JSONB 가 모든 OAuth-linked 사용자에게 존재.

## Logs

- [ ] Edge Function logs: 위 시나리오마다 200/4xx/5xx 적절히 응답.
- [ ] Browser console: error 없음.
```

- [ ] **Step 3: Walk through every scenario** on both Android devices and check off each box. If any critical scenario (A, B, C, F) fails, do NOT mark the plan complete — create a follow-up task instead.

- [ ] **Step 4: Commit + ship**

```bash
git add docs/superpowers/verifications/2026-05-15-oauth-bridge-verification.md
git commit -m "docs(auth): OAuth bridge manual verification checklist (passing scenarios A-F)"
```

Then follow `workflow_auto_ship` memory: push + 두 디바이스(R5CY521CFNZ, ZY22H9VTQD) install.

---

## Post-launch follow-ups (NOT in this plan)

- Path 1 (forward direction): 설정 → "다른 로그인 추가" 에서 `supabase.auth.linkIdentity({provider:'kakao'})` 사용. 이번 plan 의 helper 는 `mergeOAuthIntoPhoneUser` 만 다루므로 Settings UI 는 별도 plan.
- Naver provider 도 bridge 흐름에 포함시키려면 OAuthBridgeScreen 분기 + Edge Function `ALLOWED_PROVIDERS` + `transfer_oauth_identity` provider 화이트리스트 확장 필요.
- `merge-oauth-into-phone` 의 oauth user 삭제 실패 (Step 3d console.error) 가 누적되면 dead row 가 쌓임 — 주기적 cleanup cron 검토.
- Race condition: 동일 OAuth callback 이 두 탭에서 동시 진행될 때 `transfer_oauth_identity` 가 두 번 호출되면 두 번째는 `oauth_identity_count_unexpected: 0` 으로 안전하게 실패. 사용자 메시지 친근화 검토.

---

## Self-Review

**Spec coverage (memory `project_oauth_linking_decision.md`):**
- DB migration → Task 2, 3 ✓
- Edge Function `merge-oauth-user` → Task 4, 5 ✓
- 신규 React 화면 `OAuthBridgeScreen.jsx` → Task 8 ✓
- `src/lib/accountAuth.js` helpers → Task 6 ✓
- `src/App.jsx` listener routing → Task 9 ✓
- 테스트 시나리오 5종 → Task 10 (Scenario A-F covers all 5) ✓
- Session swap 결정 (Edge Function) → Tasks 4-5 ✓
- UX 컨펌 화면 → Task 8 state MATCH_CONFIRM ✓
- 매칭 신호 phone-only → Task 2 `find_user_by_phone(p_phone)` only ✓

**Placeholder scan:** No "TODO", "TBD", "appropriate error handling", "similar to Task N" — all code blocks complete.

**Type consistency:** `findUserByPhone`, `requestOAuthBridgeOtp`, `verifyOAuthBridgeOtp`, `mergeOAuthIntoPhoneUser`, `markProviderLinked`, `getOAuthUserNeedsBridge`, `transfer_oauth_identity`, `mark_linked_provider`, `find_user_by_phone` — used consistently across DB / Edge Function / JS helpers / tests / component.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-05-15-oauth-identity-linking.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.
