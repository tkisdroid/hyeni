// supabase/functions/naver-auth/index.ts
//
// Phase G-2: Naver OAuth 콜백 핸들러.
// Naver 는 Supabase 빌트인 provider 가 아니므로 커스텀 Edge Function 필요.
//
// 흐름:
//   1. 클라이언트가 Naver OAuth URL 열기 → 사용자 인증
//   2. Naver → 클라이언트 redirect URL 로 code/state 전달
//   3. 클라이언트 이 함수에 POST {code, state, redirect_uri}
//   4. 함수: code → Naver token 교환
//   5. 함수: Naver 프로필 조회 (id, email, name, nickname)
//   6. 함수: Supabase admin API 로 user upsert (email 키)
//          + naver_id 를 user_metadata 에 저장
//   7. 함수: generateLink({type: 'magiclink'}) 로 일회용 토큰 생성
//   8. 함수: { hashed_token, email } 클라이언트에 반환
//   9. 클라이언트: verifyOtp({email, token, type: 'magiclink'}) 로 세션 활성화
//
// 운영 설정:
//   - Naver Developers (developers.naver.com) 애플리케이션 등록
//   - Supabase Edge Function secrets:
//       NAVER_CLIENT_ID         (필수, 클라이언트도 동일 값 사용)
//       NAVER_CLIENT_SECRET     (필수, 서버 전용)
//   - Callback URL 화이트리스트 (Naver Console):
//       https://<project>.supabase.co/functions/v1/naver-auth/callback
//       hyenicalendar://auth-callback (네이티브)
//
// 배포: supabase functions deploy naver-auth --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NAVER_CLIENT_ID = Deno.env.get("NAVER_CLIENT_ID") || "";
const NAVER_CLIENT_SECRET = Deno.env.get("NAVER_CLIENT_SECRET") || "";

const NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token";
const NAVER_PROFILE_URL = "https://openapi.naver.com/v1/nid/me";

interface NaverTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: string | number;
  error?: string;
  error_description?: string;
}

interface NaverProfileResponse {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    email?: string;
    name?: string;
    nickname?: string;
    profile_image?: string;
    mobile?: string;
    mobile_e164?: string;
  };
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
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  // GET → Naver 가 redirect_uri 로 호출하는 콜백. 우리는 https 콜백 등록이
  // 강제이므로 Supabase function URL 사용. 이 핸들러는 deep link 로 다시
  // 리다이렉트 (또는 web origin 기반) 하여 클라이언트가 code/state 를 받음.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const errorParam = url.searchParams.get("error") || "";

    // state 가 base64(JSON) 형태로 target("native"|origin URL) 포함.
    let target = "hyenicalendar://auth-callback";
    let nonce = state;
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(state)));
      if (typeof decoded?.target === "string") {
        target = decoded.target;
      }
      if (typeof decoded?.nonce === "string") {
        nonce = decoded.nonce;
      }
    } catch {
      // state 가 plain string 일 수도 — fallback 으로 native deep link.
    }

    const redirectQuery = new URLSearchParams({
      provider: "naver",
    });
    if (code) redirectQuery.set("code", code);
    if (nonce) redirectQuery.set("state", nonce);
    if (errorParam) redirectQuery.set("error", errorParam);

    const targetUrl = `${target}${target.includes("?") ? "&" : "?"}${redirectQuery.toString()}`;
    const escapedTarget = targetUrl.replace(/[&<>"']/g, (c) => {
      switch (c) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "\"": return "&quot;";
        case "'": return "&#39;";
        default: return c;
      }
    });

    const html = `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><title>네이버 로그인 진행 중...</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#03C75A;color:white;text-align:center;padding:24px;}</style>
</head><body>
<div>
  <div style="font-size:18px;font-weight:700;margin-bottom:12px;">로그인 마무리 중...</div>
  <div style="font-size:13px;opacity:0.85;">앱이 자동으로 열리지 않으면 <a href="${escapedTarget}" style="color:white;text-decoration:underline;">여기를 눌러주세요</a></div>
</div>
<script>setTimeout(function(){location.replace(${JSON.stringify(targetUrl)});}, 200);</script>
</body></html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return jsonResponse({
      error: "naver_not_configured",
      message: "Naver Edge Function secrets (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET) 가 등록되지 않았어요. 운영자에게 문의해 주세요.",
    }, 503);
  }

  let body: { code?: string; state?: string; redirect_uri?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const { code, state, redirect_uri } = body;
  if (!code || !state || !redirect_uri) {
    return jsonResponse({ error: "missing_params", required: ["code", "state", "redirect_uri"] }, 400);
  }

  // 1. Naver code → access_token 교환
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: NAVER_CLIENT_ID,
    client_secret: NAVER_CLIENT_SECRET,
    code,
    state,
  });

  let tokenResp: Response;
  try {
    tokenResp = await fetch(`${NAVER_TOKEN_URL}?${tokenParams.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    console.error("naver-auth: token fetch error:", err);
    return jsonResponse({ error: "token_exchange_failed" }, 502);
  }

  if (!tokenResp.ok) {
    const text = await tokenResp.text().catch(() => "");
    console.error("naver-auth: token exchange non-OK:", tokenResp.status, text);
    return jsonResponse({ error: "token_exchange_failed", status: tokenResp.status }, 502);
  }

  const tokenData: NaverTokenResponse = await tokenResp.json();
  if (tokenData.error || !tokenData.access_token) {
    console.error("naver-auth: token exchange error payload:", tokenData);
    return jsonResponse({ error: "token_exchange_rejected", details: tokenData.error_description }, 401);
  }

  // 2. Naver 프로필 조회
  let profileResp: Response;
  try {
    profileResp = await fetch(NAVER_PROFILE_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    console.error("naver-auth: profile fetch error:", err);
    return jsonResponse({ error: "profile_fetch_failed" }, 502);
  }

  if (!profileResp.ok) {
    return jsonResponse({ error: "profile_fetch_failed", status: profileResp.status }, 502);
  }

  const profile: NaverProfileResponse = await profileResp.json();
  const naverUser = profile?.response;
  if (profile?.resultcode !== "00" || !naverUser?.id) {
    console.error("naver-auth: profile resultcode non-00:", profile);
    return jsonResponse({ error: "profile_invalid" }, 502);
  }

  // Naver 가 email 미동의 시: synthesized email 사용 (naver-{id}@hyeni.local)
  const email = naverUser.email
    || `naver-${naverUser.id}@hyeni.local`;
  const displayName = naverUser.name || naverUser.nickname || "";
  const naverId = naverUser.id;

  // 3. Supabase admin: 기존 사용자 조회 또는 생성
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // listUsers paginate 회피 — 이메일로 직접 조회 가능한 RPC 가 없어서
  // listUsers 는 1000 명 cap. 대안: user_metadata.naver_id 인덱스 + 멱등 createUser.
  // createUser 에서 email_already_exists 받으면 update 로 fallback.
  let userId: string | null = null;

  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      provider: "naver",
      naver_id: naverId,
      name: displayName,
      nickname: naverUser.nickname || null,
      avatar_url: naverUser.profile_image || null,
    },
  });

  if (createData?.user) {
    userId = createData.user.id;
  } else if (createError) {
    // 이미 존재하는 email 이면 update (naver_id 메타데이터 동기화)
    const errorMsg = String(createError.message || "").toLowerCase();
    const isAlreadyExists = errorMsg.includes("already")
      || errorMsg.includes("exists")
      || errorMsg.includes("duplicate")
      || (createError as { status?: number }).status === 422;

    if (!isAlreadyExists) {
      console.error("naver-auth: createUser failed:", createError);
      return jsonResponse({ error: "user_create_failed", details: createError.message }, 500);
    }

    // 이메일로 기존 user 찾기 (admin getUserByEmail 부재 → listUsers + filter)
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) {
      console.error("naver-auth: listUsers failed:", listError);
      return jsonResponse({ error: "user_lookup_failed" }, 500);
    }
    const existing = (list?.users || []).find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!existing) {
      return jsonResponse({ error: "user_not_found_after_conflict" }, 500);
    }
    userId = existing.id;

    // naver_id 메타데이터 sync
    await supabase.auth.admin.updateUserById(existing.id, {
      user_metadata: {
        ...(existing.user_metadata || {}),
        provider: "naver",
        naver_id: naverId,
        name: displayName || existing.user_metadata?.name || "",
      },
    });
  }

  if (!userId) {
    return jsonResponse({ error: "user_resolution_failed" }, 500);
  }

  // 4. magic link 발급 → 클라이언트에서 verifyOtp 로 세션 활성화
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: redirect_uri,
    },
  });

  if (linkError || !linkData) {
    console.error("naver-auth: generateLink failed:", linkError);
    return jsonResponse({ error: "magiclink_failed" }, 500);
  }

  // properties.hashed_token 은 verifyOtp 에 그대로 사용 가능
  // (action_link 의 token query param 과 동일)
  const hashedToken = (linkData.properties as { hashed_token?: string })?.hashed_token
    || (linkData as { hashed_token?: string }).hashed_token;

  if (!hashedToken) {
    console.error("naver-auth: missing hashed_token in linkData:", linkData);
    return jsonResponse({ error: "magiclink_token_missing" }, 500);
  }

  return jsonResponse({
    email,
    token: hashedToken,
    name: displayName,
    user_id: userId,
  });
});
