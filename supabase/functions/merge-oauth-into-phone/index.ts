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
