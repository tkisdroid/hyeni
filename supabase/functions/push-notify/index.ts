// ── Supabase Edge Function: push-notify ─────────────────────────────────────
// Two modes:
// 1. Cron mode (GET/POST no body): checks upcoming events, sends timed notifications
// 2. Instant mode (POST with body): sends immediate notification for new event/memo
//
// Sends via both Web Push (VAPID) and FCM (Firebase Cloud Messaging).
// Deploy: supabase functions deploy push-notify --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Auth client (anon key) — used for getClaims() to verify caller JWT (D-A01).
// The service-role client (created per-request below) is for RLS-bypassing DB work.
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

// FCM credentials
const FCM_SERVICE_ACCOUNT_JSON =
  Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")
  || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")
  || "";

const fcmServiceAccount = (() => {
  if (!FCM_SERVICE_ACCOUNT_JSON) return null;
  try {
    return JSON.parse(FCM_SERVICE_ACCOUNT_JSON) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
  } catch (err) {
    console.error("Invalid FCM_SERVICE_ACCOUNT_JSON:", err);
    return null;
  }
})();

const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID") || fcmServiceAccount?.project_id || "";
const FCM_CLIENT_EMAIL = Deno.env.get("FCM_CLIENT_EMAIL") || fcmServiceAccount?.client_email || "";
// Decode from base64 (FCM_PRIVATE_KEY_B64) or fall back to raw (FCM_PRIVATE_KEY)
const FCM_PRIVATE_KEY = (() => {
  if (fcmServiceAccount?.private_key) {
    return fcmServiceAccount.private_key.replace(/\\n/g, "\n");
  }
  const b64 = Deno.env.get("FCM_PRIVATE_KEY_B64");
  if (b64) {
    try { return new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))); }
    catch { /* fall through */ }
  }
  return (Deno.env.get("FCM_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
})();

webpush.setVapidDetails("mailto:hyeni-calendar@noreply.com", VAPID_PUBLIC, VAPID_PRIVATE);

interface PushPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  data: Record<string, unknown>;
}

const EMERGENCY_ACTIONS = new Set(["emergency", "sos"]);
const PREMIUM_REMOTE_LISTEN_STATUSES = new Set(["trial", "active", "grace"]);
const EMERGENCY_ALERT_TYPES = new Set([
  "not_arrived",
  "missed_arrival",
  "danger_zone",
  "danger_enter",
  "danger_entry",
  "danger_exit",
]);

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isEmergencyNotification(type: string, data: Record<string, unknown> = {}): boolean {
  if (EMERGENCY_ACTIONS.has(type)) return true;
  if (String(data.urgent || "").toLowerCase() === "true") return true;
  if (type !== "parent_alert") return false;

  const severity = toStringValue(data.severity).toLowerCase();
  const alertType = toStringValue(data.alertType || data.alert_type).toLowerCase();
  return severity === "emergency"
    || severity === "critical"
    || severity === "urgent"
    || EMERGENCY_ALERT_TYPES.has(alertType);
}

function hasPremiumRemoteListenStatus(value: unknown): boolean {
  return typeof value === "string" && PREMIUM_REMOTE_LISTEN_STATUSES.has(value.toLowerCase());
}

async function validateRemoteListenEntitlement(
  supabase: ReturnType<typeof createClient>,
  familyId: string,
): Promise<Response | null> {
  const { data, error } = await supabase
    .from("family_subscription")
    .select("status, remote_listen_enabled")
    .eq("family_id", familyId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("remote listen entitlement check failed:", error);
    return jsonResponse({ error: "remote_listen_entitlement_check_failed" }, 500);
  }

  if (!data || !hasPremiumRemoteListenStatus(data.status)) {
    return jsonResponse({ error: "remote_listen_requires_premium" }, 402);
  }

  if (data.remote_listen_enabled === false) {
    return jsonResponse({ error: "remote_listen_disabled_by_family" }, 403);
  }

  return null;
}

async function getNativeRecipientIds(
  supabase: ReturnType<typeof createClient>,
  familyId: string
): Promise<Set<string>> {
  if (!familyId) return new Set<string>();

  const { data, error } = await supabase
    .from("fcm_tokens")
    .select("user_id")
    .eq("family_id", familyId);

  if (error) {
    console.error("Failed to load native recipients:", error);
    return new Set<string>();
  }

  return new Set(
    (data || [])
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
  );
}

async function getFamilyMemberIdsByRole(
  supabase: ReturnType<typeof createClient>,
  familyId: string,
  role: string,
): Promise<Set<string>> {
  if (!familyId || !role) return new Set<string>();

  const { data, error } = await supabase
    .from("family_members")
    .select("user_id")
    .eq("family_id", familyId)
    .eq("role", role);

  if (error) {
    console.error(`Failed to load ${role} recipients:`, error);
    return new Set<string>();
  }

  return new Set(
    (data || [])
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
  );
}

// ── FCM OAuth2 token cache ──────────────────────────────────────────────────
let fcmAccessToken: string | null = null;
let fcmTokenExpiry = 0;

async function getFcmAccessToken(): Promise<string | null> {
  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) return null;

  if (fcmAccessToken && Date.now() < fcmTokenExpiry - 60_000) {
    return fcmAccessToken;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const toBase64Url = (str: string) =>
      btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = toBase64Url(JSON.stringify({
      iss: FCM_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }));

    const signInput = `${header}.${payload}`;

    // Import RSA private key for signing
    const pemBody = FCM_PRIVATE_KEY
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s/g, "");
    const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(signInput)
    );

    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const jwt = `${header}.${payload}.${signature}`;

    // Exchange JWT for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("FCM token exchange failed:", tokenData);
      return null;
    }

    fcmAccessToken = tokenData.access_token;
    fcmTokenExpiry = Date.now() + (tokenData.expires_in || 3600) * 1000;
    return fcmAccessToken;
  } catch (err) {
    console.error("FCM auth error:", err);
    return null;
  }
}

// Return: "sent" | "expired" | "error"
async function sendFcmNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<"sent" | "expired" | "error"> {
  const accessToken = await getFcmAccessToken();
  if (!accessToken) return "error";

  try {
    const isRemoteListen = data.type === "remote_listen";
    const isLocationRefresh = data.type === "request_location";
    const stringData = Object.fromEntries(
      Object.entries({ title, body, type: data.type || "schedule", ...data }).map(([key, value]) => [key, String(value)])
    );

    const message: Record<string, unknown> = {
      message: {
        token,
        data: stringData,
        android: {
          priority: "HIGH",
          ttl: isRemoteListen ? "300s" : (isLocationRefresh ? "120s" : "120s"),
          direct_boot_ok: true,
        },
      },
    };

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`FCM send failed (${res.status}):`, errBody);
      // 404/410 or UNREGISTERED = token invalid, safe to delete
      if (res.status === 404 || res.status === 410 || errBody.includes("UNREGISTERED")) {
        return "expired";
      }
      return "error";
    }

    return "sent";
  } catch (err) {
    console.error("FCM send error:", err);
    return "error";
  }
}

// Data-only FCM (force_ring 전용) — TTL/action 커스텀 가능, notification 없음
async function sendFcmDataOnly(
  token: string,
  payload: { data: Record<string, string>; android: { ttl: string } },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accessToken = await getFcmAccessToken();
  if (!accessToken) return { success: false, error: "fcm_auth_failed" };

  const message = {
    message: {
      token,
      data: Object.fromEntries(
        Object.entries(payload.data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: "HIGH",
        ttl: payload.android.ttl,
        direct_boot_ok: true,
      },
    },
  };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );
    if (!res.ok) {
      const errBody = await res.text();
      return { success: false, error: `fcm_${res.status}: ${errBody.slice(0, 200)}` };
    }
    const json = await res.json();
    return { success: true, messageId: json.name };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Send FCM to all family members (exclude sender)
async function sendFcmToFamily(
  supabase: ReturnType<typeof createClient>,
  familyId: string,
  senderUserId: string | null,
  title: string,
  body: string,
  type: string,
  extraData: Record<string, string> = {},
  recipientUserIds: Set<string> | null = null,
): Promise<number> {
  const { data: tokens, error: tokenErr } = await supabase
    .from("fcm_tokens")
    .select("id, user_id, fcm_token")
    .eq("family_id", familyId);

  if (tokenErr) {
    console.error("Failed to load fcm_tokens:", tokenErr);
    return 0;
  }

  if (!tokens?.length) return 0;

  let sent = 0;
  const expiredIds: string[] = [];

  for (const t of tokens) {
    if (t.user_id === senderUserId) continue;
    if (recipientUserIds && !recipientUserIds.has(t.user_id)) continue;
    const pushData: Record<string, string> = {
      type,
      familyId,
      senderUserId: senderUserId || "",
      ...extraData,
    };
    pushData.urgent = isEmergencyNotification(type, pushData) ? "true" : "false";
    const result = await sendFcmNotification(
      t.fcm_token,
      title,
      body,
      pushData
    );
    if (result === "sent") {
      sent++;
    } else if (result === "expired") {
      expiredIds.push(t.id);
    }
    // "error" = transient failure, keep the token
  }

  if (expiredIds.length > 0) {
    await supabase.from("fcm_tokens").delete().in("id", expiredIds);
  }

  return sent;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info, Idempotency-Key",
      },
    });
  }

  // ── Auth gate: verify caller JWT in-function (D-A01) ────────────────
  // Gateway is deployed with --no-verify-jwt (D-A02) to route around
  // supabase#42244 (ES256 gateway rejection). In-function getClaims()
  // handles ES256 + kid rotation + JWKS caching via Web Crypto API.
  // Cron callers: use service-role JWT which carries claims.role === "service_role";
  // we accept that path unconditionally (same privilege level as the function already has).
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse({ error: "missing auth" }, 401);
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    console.warn("push-notify: invalid jwt", claimsErr?.message);
    return jsonResponse({ error: "invalid jwt" }, 401);
  }
  // Supabase service_role JWT는 sub 클레임 없이 role: 'service_role'만 가짐.
  // cron이 force_ring_reminder 같은 system action을 호출하려면 이 path를 허용해야 함.
  // 일반 user JWT는 반드시 sub 보유.
  const claimsSub = (claimsData.claims as { sub?: string }).sub;
  const claimsRole = (claimsData.claims as { role?: string }).role || "authenticated";
  const isServiceRole = claimsRole === "service_role";
  if (!claimsSub && !isServiceRole) {
    console.warn("push-notify: jwt missing sub claim and not service_role");
    return jsonResponse({ error: "invalid jwt" }, 401);
  }
  const callerUserId = claimsSub || "";  // service_role 호출자는 빈 문자열
  const callerRole = claimsRole;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Check for instant notification request ───────────────────────────
    let body: Record<string, unknown> | null = null;
    if (req.method === "POST") {
      try {
        const text = await req.text();
        if (text.trim()) body = JSON.parse(text);
      } catch { /* not JSON, proceed as cron */ }
    }

    if (body?.action === "playdate_started") {
      return await handlePlaydateStarted(supabase, body, callerUserId, callerRole);
    }

    if (body?.action === "playdate_ended") {
      return await handlePlaydateEnded(supabase, body, callerUserId, callerRole);
    }

    if (body?.action === "force_ring") {
      return await handleForceRing(body, callerUserId, supabase);
    }

    if (body?.action === "force_ring_stop") {
      return await handleForceRingStop(body, callerUserId, supabase);
    }

    if (body?.action === "force_ring_reminder") {
      return await handleForceRingReminder(callerRole, supabase);
    }

    if (body?.action === "new_event" || body?.action === "new_memo" || body?.action === "kkuk" || body?.action === "parent_alert" || body?.action === "remote_listen" || body?.action === "remote_listen_stop" || body?.action === "request_location" || body?.action === "request_device_status" || body?.action === "emergency" || body?.action === "sos") {
      return await handleInstantNotification(supabase, body, callerUserId, callerRole, req);
    }

    // ── Cron mode: check upcoming events ─────────────────────────────────
    return await handleCronNotification(supabase);
  } catch (err) {
    console.error("push-notify error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

// ── force_ring (강제 소리 울리기) — 부모→아이 응급 알람 ──────────────────
async function handleForceRing(
  body: Record<string, unknown>,
  callerUserId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const familyId = body.family_id as string | undefined;
  if (!familyId) return jsonResponse({ error: "missing_family_id" }, 400);

  // 1. 부모 권한 확인 (RLS와 별개로 명시적 게이트)
  const { data: membership, error: memErr } = await supabase
    .from("family_members")
    .select("role, name")
    .eq("user_id", callerUserId)
    .eq("family_id", familyId)
    .maybeSingle();
  if (memErr || !membership || membership.role !== "parent") {
    return jsonResponse({ error: "force_ring_requires_parent" }, 403);
  }

  // 2. client_request_hash 중복 요청 dedup (race condition 1차 방어)
  const clientHash = (body.client_request_hash as string) || null;
  if (clientHash) {
    const { data: existing } = await supabase
      .from("force_ring_events")
      .select("id, delivered_at")
      .eq("client_request_hash", clientHash)
      .maybeSingle();
    if (existing) {
      return jsonResponse({
        event_id: existing.id,
        delivered: !!existing.delivered_at,
        deduplicated: true,
      });
    }
  }

  // 3. quota check (free 1/day, premium 10/day)
  const { data: quota, error: quotaErr } = await supabase.rpc(
    "force_ring_check_quota",
    { p_family_id: familyId },
  );
  if (quotaErr) return jsonResponse({ error: "quota_check_failed" }, 500);
  if (!quota?.allowed) {
    return jsonResponse({
      error: "force_ring_quota_exceeded",
      quota: quota?.quota,
      used: quota?.used,
      tier: quota?.tier,
    }, 429);
  }

  // 4. target child 결정 (가장 먼저 가입한 child)
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
  const targetUserId = children[0].user_id as string;

  // 5. event INSERT (UNIQUE partial idx가 동시 active 방지)
  const message = ((body.message as string) || "").slice(0, 80);
  const { data: event, error: insertErr } = await supabase
    .from("force_ring_events")
    .insert({
      family_id: familyId,
      initiator_user_id: callerUserId,
      target_user_id: targetUserId,
      message: message || null,
      client_request_hash: clientHash,
    })
    .select("id")
    .single();

  if (insertErr) {
    if ((insertErr as { code?: string }).code === "23505") {
      const { data: active } = await supabase
        .from("force_ring_events")
        .select("id")
        .eq("family_id", familyId)
        .is("stopped_at", null)
        .maybeSingle();
      return jsonResponse({
        error: "force_ring_already_active",
        active_event_id: active?.id,
      }, 423);
    }
    return jsonResponse({ error: "insert_failed", details: insertErr.message }, 500);
  }

  // 6. FCM 토큰 조회 (target child의 android 기기)
  const { data: tokens } = await supabase
    .from("fcm_tokens")
    .select("fcm_token, platform")
    .eq("user_id", targetUserId)
    .eq("platform", "android");

  if (!tokens?.length) {
    await supabase.from("force_ring_events")
      .update({
        stopped_at: new Date().toISOString(),
        stop_reason: "delivery_failed",
        delivery_status: { reason: "no_fcm_tokens" },
      })
      .eq("id", event.id);
    return jsonResponse({
      event_id: event.id,
      delivered: false,
      error: "no_fcm_tokens",
    });
  }

  // 7. data-only FCM 발송 (high priority, ttl=600s, direct_boot_ok)
  const initiatorName = (membership.name as string) || "부모님";
  const fcmPayload = {
    data: {
      action: "force_ring",
      event_id: event.id,
      message,
      initiator_name: initiatorName,
    },
    android: { ttl: "600s" },
  };

  const fcmResults = await Promise.all(
    tokens.map((t) => sendFcmDataOnly(t.fcm_token as string, fcmPayload)),
  );
  const anySuccess = fcmResults.some((r) => r.success);

  // 8. 결과 마킹: delivered_at OR stopped_at(delivery_failed)
  if (anySuccess) {
    await supabase.from("force_ring_events")
      .update({
        delivered_at: new Date().toISOString(),
        delivery_status: { fcm: fcmResults },
      })
      .eq("id", event.id);
  } else {
    await supabase.from("force_ring_events")
      .update({
        stopped_at: new Date().toISOString(),
        stop_reason: "delivery_failed",
        delivery_status: { fcm: fcmResults },
      })
      .eq("id", event.id);
  }

  return jsonResponse({
    event_id: event.id,
    delivered: anySuccess,
    quota_remaining: Math.max(0, quota.quota - quota.used - (anySuccess ? 1 : 0)),
  });
}

// ── force_ring_stop — 부모가 직접 정지 ─────────────────────────────────
async function handleForceRingStop(
  body: Record<string, unknown>,
  callerUserId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const eventId = body.event_id as string | undefined;
  if (!eventId) return jsonResponse({ error: "missing_event_id" }, 400);

  const { data: event, error: selectErr } = await supabase
    .from("force_ring_events")
    .select("id, initiator_user_id, target_user_id, family_id, stopped_at")
    .eq("id", eventId)
    .maybeSingle();
  if (selectErr || !event) return jsonResponse({ error: "event_not_found" }, 404);
  if (event.initiator_user_id !== callerUserId) {
    return jsonResponse({ error: "not_initiator" }, 403);
  }
  if (event.stopped_at) {
    // 이미 정지됨 — idempotent 응답
    return jsonResponse({ stopped: true, already: true });
  }

  // stopped_at IS NULL 가드로 race condition 방지 (autostop과 동시성)
  const { error: updateErr } = await supabase
    .from("force_ring_events")
    .update({
      stopped_at: new Date().toISOString(),
      stop_reason: "parent_stop",
    })
    .eq("id", eventId)
    .is("stopped_at", null);
  if (updateErr) return jsonResponse({ error: "update_failed" }, 500);

  // target child에게 force_ring_stop 데이터 전송 (벨소리 즉시 정지)
  const { data: tokens } = await supabase
    .from("fcm_tokens")
    .select("fcm_token")
    .eq("user_id", event.target_user_id as string)
    .eq("platform", "android");

  if (tokens?.length) {
    await Promise.all(
      tokens.map((t) =>
        sendFcmDataOnly(t.fcm_token as string, {
          data: { action: "force_ring_stop", event_id: eventId },
          android: { ttl: "60s" },
        }),
      ),
    );
  }

  return jsonResponse({ stopped: true });
}

// ── force_ring_reminder — pg_cron이 1분마다 호출하는 5분-경과 알림 ─────
async function handleForceRingReminder(
  callerRole: string,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  // service_role JWT만 허용 (cron이 service_role key 헤더로 호출)
  if (callerRole !== "service_role") {
    return jsonResponse({ error: "service_role_required" }, 401);
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  // 5~15분 사이 발생, 전달 성공, 미응답, 미정지, 리마인더 미발송 candidates
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

  if (selErr) return jsonResponse({ error: "select_failed", details: selErr.message }, 500);
  if (!candidates?.length) return jsonResponse({ reminded_count: 0 });

  let remindedCount = 0;
  for (const event of candidates) {
    const initiatorId = event.initiator_user_id as string;
    const eventId = event.id as string;

    const { data: tokens } = await supabase
      .from("fcm_tokens")
      .select("fcm_token, platform")
      .eq("user_id", initiatorId);

    const { data: webSubs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", initiatorId);

    const reminderTitle = "응급 신호 5분 경과";
    const reminderBody = "아이 응답이 없습니다. 직접 통화나 119를 고려하세요";
    const reminderData = { action: "force_ring_reminder", event_id: eventId };
    const webPayload = {
      title: reminderTitle,
      body: reminderBody,
      icon: "/icon.png",
      badge: "/icon.png",
      data: reminderData,
    };

    if (tokens?.length) {
      await Promise.all(
        tokens
          .filter((t) => t.platform === "android")
          .map((t) =>
            sendFcmNotification(t.fcm_token as string, reminderTitle, reminderBody, reminderData),
          ),
      );
    }
    if (webSubs?.length) {
      await Promise.all(
        webSubs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              (sub as { subscription: unknown }).subscription as never,
              JSON.stringify(webPayload),
            );
          } catch (err) {
            console.warn(`force_ring_reminder webpush failed (event ${eventId}):`, err);
          }
        }),
      );
    }

    await supabase
      .from("force_ring_events")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", eventId);
    remindedCount++;
  }

  return jsonResponse({ reminded_count: remindedCount });
}

// ── Instant notification (when parent/child creates event or memo) ─────────
async function handleInstantNotification(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  callerUserId: string,
  callerRole: string,
  req: Request,
) {
  const familyId = body.familyId as string;
  // senderUserId is derived from verified JWT claim (callerUserId).
  // Body-supplied body.senderUserId is IGNORED for authenticated callers —
  // closes the spoofing vector (PITFALLS §"security mistakes" row 1 / P2-9).
  // For service-role cron callers, we allow body.senderUserId as a trusted
  // override since cron acts on behalf of a system actor (no end-user JWT).
  const senderUserId: string = callerRole === "service_role"
    ? ((body.senderUserId as string) || callerUserId)
    : callerUserId;
  const action = body.action as string;
  const title = body.title as string || "새 알림";
  const message = body.message as string || "";
  const isRemoteListen = action === "remote_listen";
  const isRemoteListenStop = action === "remote_listen_stop";
  const isLocationRefresh = action === "request_location";
  const isDeviceStatusRefresh = action === "request_device_status";
  const isChildNativeCommand = isRemoteListen || isRemoteListenStop || isLocationRefresh || isDeviceStatusRefresh;

  if (!familyId) return jsonResponse({ error: "familyId required" }, 400);

  // ── Sender-family membership check (SEC-01, v1.0 re-audit) ─────────
  // Gate surfaced during live verification: JWT-verified callerUserId is trusted
  // (Phase 2 PUSH-01), but the Edge Function previously did not cross-check
  // that the caller belongs to body.familyId. Anyone who knew a family_id UUID
  // could trigger pushes to that family. Service-role cron path bypasses this
  // check (needed for scheduled notifications where the DB schedules on behalf
  // of users).
  if (callerRole !== "service_role") {
    const { data: memberRow, error: memberErr } = await supabase
      .from("family_members")
      .select("user_id")
      .eq("family_id", familyId)
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (memberErr) {
      console.error("push-notify membership check failed:", memberErr);
      return jsonResponse({ error: "membership check failed" }, 500);
    }
    if (!memberRow) {
      return jsonResponse({ error: "not a family member" }, 403);
    }
  }

  if (isRemoteListen) {
    const remoteListenGate = await validateRemoteListenEntitlement(supabase, familyId);
    if (remoteListenGate) return remoteListenGate;
  }

  // ── Idempotency check (Phase 3 D-A03) ───────────────────────────────
  // Header preferred; body mirror supported because navigator.sendBeacon
  // cannot set custom headers. UUID format is enforced by the FK type
  // (push_idempotency.key uuid) — invalid values fail the insert cleanly.
  // No key = backward-compatible (legacy callers keep working).
  const headerKey = req.headers.get("Idempotency-Key");
  const bodyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : null;
  const idempotencyKey = (headerKey && headerKey.trim()) || bodyKey;

  if (idempotencyKey) {
    const { error: idemErr } = await supabase
      .from("push_idempotency")
      .insert({ key: idempotencyKey, family_id: familyId, action, first_sent_at: new Date().toISOString() })
      .select("key")
      .maybeSingle();

    if (idemErr) {
      // Postgres unique violation → duplicate request; short-circuit with 200.
      // 22P02 = invalid_text_representation (e.g., non-UUID) → treat as bad request.
      if ((idemErr as { code?: string }).code === "23505") {
        return jsonResponse({ duplicate: true, key: idempotencyKey }, 200);
      }
      if ((idemErr as { code?: string }).code === "22P02") {
        return jsonResponse({ error: "idempotency_key must be uuid" }, 400);
      }
      // Any other error: log and proceed without dedup (best-effort).
      console.warn("push_idempotency insert failed (proceeding without dedup):", idemErr);
    }
  }

  const pushId = idempotencyKey || crypto.randomUUID();
  const severity = toStringValue(body.severity);
  const alertType = toStringValue(body.alertType || body.alert_type);
  const urgencyProbe: Record<string, unknown> = { severity, alertType, urgent: body.urgent };
  const urgent = isEmergencyNotification(action, urgencyProbe);

  const nativeRecipientIds = await getNativeRecipientIds(supabase, familyId);
  let childNativeRecipientIds = isChildNativeCommand
    ? await getFamilyMemberIdsByRole(supabase, familyId, "child")
    : null;
  const targetUserId = typeof body.targetUserId === "string" && body.targetUserId
    ? body.targetUserId
    : null;
  if (childNativeRecipientIds && targetUserId) {
    childNativeRecipientIds = new Set([...childNativeRecipientIds].filter((userId) => userId === targetUserId));
  }
  const fcmExtraData: Record<string, string> = {
    pushId,
    urgent: urgent ? "true" : "false",
  };
  if (severity) fcmExtraData.severity = severity;
  if (alertType) fcmExtraData.alertType = alertType;
  if (isChildNativeCommand) {
    fcmExtraData.targetRole = "child";
    if (body.requestId !== undefined && body.requestId !== null) {
      fcmExtraData.requestId = String(body.requestId);
    }
    if (body.reason !== undefined && body.reason !== null) {
      fcmExtraData.reason = String(body.reason);
    }
    if (body.requestedAt !== undefined && body.requestedAt !== null) {
      fcmExtraData.requestedAt = String(body.requestedAt);
    }
    if (targetUserId) {
      fcmExtraData.targetUserId = targetUserId;
    }
    if (body.requesterUserId !== undefined && body.requesterUserId !== null) {
      fcmExtraData.requesterUserId = String(body.requesterUserId);
    }
  }
  if (isRemoteListen) {
    if (body.durationSec !== undefined && body.durationSec !== null) {
      fcmExtraData.durationSec = String(body.durationSec);
    }
  }

  // ── Web Push (VAPID) ────────────────────────────────────────────────
  const { data: subs } = isChildNativeCommand
    ? { data: [] as Array<{ id: string; endpoint: string; subscription: unknown; user_id: string }> }
    : await supabase
        .from("push_subscriptions")
        .select("id, endpoint, subscription, user_id")
        .eq("family_id", familyId);

  const payload: PushPayload = {
    title,
    body: message,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      type: action,
      familyId,
      pushId,
      urgent,
      ...(severity ? { severity } : {}),
      ...(alertType ? { alertType } : {}),
    },
  };

  let webSent = 0;
  const expiredIds: string[] = [];

  if (subs?.length) {
    for (const sub of subs) {
      if (sub.user_id === senderUserId) continue;
      if (sub.user_id && nativeRecipientIds.has(sub.user_id)) continue;
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
        webSent++;
      } catch (err: unknown) {
        const pushErr = err as { statusCode?: number };
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          expiredIds.push(sub.id);
        } else {
          console.error(`Push failed for ${sub.endpoint}:`, err);
        }
      }
    }

    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }
  }

  // ── FCM (Android native) ───────────────────────────────────────────
  const fcmSent = await sendFcmToFamily(
    supabase,
    familyId,
    senderUserId,
    title,
    message,
    action,
    fcmExtraData,
    childNativeRecipientIds,
  );

  // ── PUSH-03 / PUSH-04 (D-A04): always record pending_notifications with
  // observability payload, even when zero recipients. Previously we skipped
  // insertion in that case, losing the trail entirely.
  const totalRecipients = isChildNativeCommand
    ? (childNativeRecipientIds?.size || 0)
    : (subs?.length || 0);
  const deliveryStatus: Record<string, unknown> = {
    webSent,
    fcmSent,
    recipients: totalRecipients,
  };
  if (webSent === 0 && fcmSent === 0) {
    deliveryStatus.note = "no subscribers";
  }

  // Also queue for Android native polling fallback. For remote_listen and
  // request_location the child LocationService consumes this row as a native
  // command instead of showing a normal notification.
  const { error: pendingErr } = await supabase.from("pending_notifications").insert({
    family_id: familyId,
    title,
    body: message,
    data: {
      senderUserId: senderUserId || "",
      familyId,
      type: action,
      action,
      pushId,
      urgent,
      ...(isRemoteListen ? { targetRole: "child" } : {}),
      ...(isRemoteListenStop ? { targetRole: "child" } : {}),
      ...(isLocationRefresh ? { targetRole: "child" } : {}),
      ...(isDeviceStatusRefresh ? { targetRole: "child" } : {}),
      ...(targetUserId ? { targetUserId } : {}),
      ...(isChildNativeCommand && body.requestId !== undefined && body.requestId !== null
        ? { requestId: String(body.requestId) }
        : {}),
      ...(isChildNativeCommand && body.reason !== undefined && body.reason !== null
        ? { reason: String(body.reason) }
        : {}),
      ...(isChildNativeCommand && body.requestedAt !== undefined && body.requestedAt !== null
        ? { requestedAt: String(body.requestedAt) }
        : {}),
      ...(isChildNativeCommand && body.requesterUserId !== undefined && body.requesterUserId !== null
        ? { requesterUserId: String(body.requesterUserId) }
        : {}),
      ...(isRemoteListen && body.durationSec !== undefined && body.durationSec !== null
        ? { durationSec: String(body.durationSec) }
        : {}),
      ...(severity ? { severity } : {}),
      ...(alertType ? { alertType } : {}),
    },
    delivery_status: deliveryStatus,
    idempotency_key: idempotencyKey || null,
    ...(isRemoteListen ? { expires_at: new Date(Date.now() + 5 * 60_000).toISOString() } : {}),
    ...(isLocationRefresh ? { expires_at: new Date(Date.now() + 2 * 60_000).toISOString() } : {}),
  });

  if (pendingErr) {
    console.error("Failed to queue pending notification:", pendingErr);
  }

  return jsonResponse({ webSent, fcmSent, total: totalRecipients, key: idempotencyKey || null });
}

// ── Cron notification (time-based, 15min/5min before + at start) ──────────
async function handleCronNotification(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth();
  const day = kst.getUTCDate();
  const dateKey = `${year}-${month}-${day}`;
  const nowMinutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();

  const { data: events, error: evErr } = await supabase
    .from("events")
    .select("id, family_id, title, time, emoji, category, location")
    .eq("date_key", dateKey);

  if (evErr) {
    console.error("Failed to fetch events:", evErr);
    return jsonResponse({ error: "Failed to fetch events" }, 500);
  }

  if (!events?.length) {
    return jsonResponse({ sent: 0, checked: 0, message: "No events today" });
  }

  let totalWebSent = 0;
  let totalFcmSent = 0;
  const nativeRecipientCache = new Map<string, Set<string>>();
  const notifWindows = [
    { key: "15min", minsBefore: 15, title: "🐰 준비 시간!" },
    { key: "5min", minsBefore: 5, title: "🏃 출발!" },
    { key: "start", minsBefore: 0, title: "⏰ 시작!" },
  ];

  for (const event of events) {
    const [h, m] = event.time.split(":").map(Number);
    const eventMinutes = h * 60 + m;

    for (const window of notifWindows) {
      const targetMinutes = eventMinutes - window.minsBefore;
      const diff = nowMinutes - targetMinutes;

      if (diff < -1 || diff > 1) continue;

      const sentKey = `${window.key}-${dateKey}`;
      const pushId = `${event.id}-${sentKey}`;
      const { data: existing } = await supabase
        .from("push_sent")
        .select("id")
        .eq("event_id", event.id)
        .eq("notif_key", sentKey)
        .maybeSingle();

      if (existing) continue;

      const emoji = event.emoji || "📅";
      const bodyMap: Record<string, string> = {
        "15min": `${emoji} ${event.title} 가기 15분 전이야! 준비물 챙겼니? 🎒 (${event.time})`,
        "5min": `${emoji} ${event.title} 곧 시작이야! 출발~ 🏃 (${event.time})`,
        "start": `${emoji} ${event.title} 시작 시간이야! 화이팅! 💪 (${event.time})`,
      };

      const payload: PushPayload = {
        title: window.title,
        body: bodyMap[window.key],
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { eventId: event.id, type: window.key, pushId, urgent: false },
      };

      // ── Web Push ──────────────────────────────────────────────────
      let nativeRecipientIds = nativeRecipientCache.get(event.family_id);
      if (!nativeRecipientIds) {
        nativeRecipientIds = await getNativeRecipientIds(supabase, event.family_id);
        nativeRecipientCache.set(event.family_id, nativeRecipientIds);
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, subscription, user_id")
        .eq("family_id", event.family_id);

      const expiredIds: string[] = [];

      if (subs?.length) {
        for (const sub of subs) {
          if (sub.user_id && nativeRecipientIds.has(sub.user_id)) continue;
          try {
            await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
            totalWebSent++;
          } catch (err: unknown) {
            const pushErr = err as { statusCode?: number };
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              expiredIds.push(sub.id);
            } else {
              console.error(`Push failed for ${sub.endpoint}:`, err);
            }
          }
        }

        if (expiredIds.length > 0) {
          await supabase.from("push_subscriptions").delete().in("id", expiredIds);
        }
      }

      // ── FCM ───────────────────────────────────────────────────────
      const fcmSent = await sendFcmToFamily(
        supabase,
        event.family_id,
        null,
        payload.title,
        bodyMap[window.key],
        window.key,
        { eventId: String(event.id), pushId, urgent: "false" },
      );
      totalFcmSent += fcmSent;

      await supabase.from("push_sent").insert({
        event_id: event.id,
        notif_key: sentKey,
      });

      // Also queue for Android native polling (fallback)
      const { error: pendingErr } = await supabase.from("pending_notifications").insert({
        family_id: event.family_id,
        title: payload.title,
        body: payload.body,
        data: { eventId: event.id, type: window.key, pushId, urgent: false },
      });

      if (pendingErr) {
        console.error("Failed to queue pending notification:", pendingErr);
      }
    }
  }

  return jsonResponse({
    webSent: totalWebSent,
    fcmSent: totalFcmSent,
    checked: events.length,
    dateKey,
    time: `${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Friend playdate handlers
// ─────────────────────────────────────────────────────────────────────────────

// Resolve the FCM tokens for a single user (the family parent). Returns [].
async function fetchFcmTokensForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string | null | undefined,
): Promise<{ id: string; fcm_token: string }[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("fcm_tokens")
    .select("id, fcm_token")
    .eq("user_id", userId);
  if (error) {
    console.error("playdate: fcm_tokens lookup failed:", error);
    return [];
  }
  return (data ?? []) as { id: string; fcm_token: string }[];
}

async function handlePlaydateStarted(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  callerUserId: string,
  callerRole: string,
) {
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  if (!sessionId) {
    return jsonResponse({ error: "session_id_required" }, 400);
  }

  const { data: session, error: sessionErr } = await supabase
    .from("friend_playdate_sessions")
    .select("id, public_place_id, family_a_id, family_b_id, child_a_id, child_b_id, initiator_user_id, started_at, stopped_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    return jsonResponse({ error: "session_not_found" }, 404);
  }

  // Authz: only the two children on the session may trigger the start
  // notification. service_role bypasses this for cron / admin calls.
  const isService = callerRole === "service_role";
  if (!isService && callerUserId !== session.child_a_id && callerUserId !== session.child_b_id) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const [placeRes, familyARes, familyBRes, childARes, childBRes] = await Promise.all([
    supabase.from("public_places").select("name").eq("id", session.public_place_id).maybeSingle(),
    supabase.from("families").select("mom_phone, dad_phone, parent_id").eq("id", session.family_a_id).maybeSingle(),
    supabase.from("families").select("mom_phone, dad_phone, parent_id").eq("id", session.family_b_id).maybeSingle(),
    supabase.from("family_members").select("name").eq("user_id", session.child_a_id).maybeSingle(),
    supabase.from("family_members").select("name").eq("user_id", session.child_b_id).maybeSingle(),
  ]);

  const placeName = placeRes.data?.name ?? "안전장소";
  const childAName = childARes.data?.name ?? "아이";
  const childBName = childBRes.data?.name ?? "친구";
  const familyAPhones = [familyARes.data?.mom_phone, familyARes.data?.dad_phone].filter(Boolean) as string[];
  const familyBPhones = [familyBRes.data?.mom_phone, familyBRes.data?.dad_phone].filter(Boolean) as string[];

  const [tokensA, tokensB] = await Promise.all([
    fetchFcmTokensForUser(supabase, familyARes.data?.parent_id),
    fetchFcmTokensForUser(supabase, familyBRes.data?.parent_id),
  ]);

  const dataA: Record<string, string> = {
    type: "playdate_started",
    action: "playdate_started",
    session_id: session.id,
    place_name: placeName,
    my_child_name: childAName,
    friend_child_name: childBName,
    friend_family_phones: JSON.stringify(familyBPhones),
  };
  const dataB: Record<string, string> = {
    type: "playdate_started",
    action: "playdate_started",
    session_id: session.id,
    place_name: placeName,
    my_child_name: childBName,
    friend_child_name: childAName,
    friend_family_phones: JSON.stringify(familyAPhones),
  };

  const titleA = "친구놀이 시작";
  const bodyA = `${childAName}가 ${placeName}에서 ${childBName}와 놀고 있어요`;
  const titleB = "친구놀이 시작";
  const bodyB = `${childBName}가 ${placeName}에서 ${childAName}와 놀고 있어요`;

  const expiredIds: string[] = [];
  let sentCount = 0;
  for (const t of tokensA) {
    const result = await sendFcmNotification(t.fcm_token, titleA, bodyA, dataA);
    if (result === "sent") sentCount++;
    else if (result === "expired") expiredIds.push(t.id);
  }
  for (const t of tokensB) {
    const result = await sendFcmNotification(t.fcm_token, titleB, bodyB, dataB);
    if (result === "sent") sentCount++;
    else if (result === "expired") expiredIds.push(t.id);
  }
  if (expiredIds.length > 0) {
    await supabase.from("fcm_tokens").delete().in("id", expiredIds);
  }

  return jsonResponse({
    delivered: sentCount > 0,
    sent_count: sentCount,
    fcm_count: tokensA.length + tokensB.length,
  });
}

async function handlePlaydateEnded(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  callerUserId: string,
  callerRole: string,
) {
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  if (!sessionId) {
    return jsonResponse({ error: "session_id_required" }, 400);
  }

  const { data: session, error: sessionErr } = await supabase
    .from("friend_playdate_sessions")
    .select("id, public_place_id, family_a_id, family_b_id, child_a_id, child_b_id, stopped_at, stop_reason")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    return jsonResponse({ error: "session_not_found" }, 404);
  }

  // 종료 푸시는 stopped_at이 set된 후에만 발송. 미설정시 422.
  if (!session.stopped_at) {
    return jsonResponse({ error: "session_not_stopped" }, 422);
  }

  // Authz: child_a/child_b 또는 service_role (cron auto_geofence_exit).
  const isService = callerRole === "service_role";
  if (!isService && callerUserId !== session.child_a_id && callerUserId !== session.child_b_id) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const [placeRes, familyARes, familyBRes] = await Promise.all([
    supabase.from("public_places").select("name").eq("id", session.public_place_id).maybeSingle(),
    supabase.from("families").select("parent_id").eq("id", session.family_a_id).maybeSingle(),
    supabase.from("families").select("parent_id").eq("id", session.family_b_id).maybeSingle(),
  ]);

  const placeName = placeRes.data?.name ?? "안전장소";
  const stopReason = (session.stop_reason as string) ?? "child_end";

  const [tokensA, tokensB] = await Promise.all([
    fetchFcmTokensForUser(supabase, familyARes.data?.parent_id),
    fetchFcmTokensForUser(supabase, familyBRes.data?.parent_id),
  ]);

  const data: Record<string, string> = {
    type: "playdate_ended",
    action: "playdate_ended",
    session_id: session.id,
    stop_reason: stopReason,
    place_name: placeName,
  };

  const title = "친구놀이 종료";
  const body_ = `${placeName} 친구놀이가 종료됐어요`;

  const expiredIds: string[] = [];
  let sentCount = 0;
  for (const t of [...tokensA, ...tokensB]) {
    const result = await sendFcmNotification(t.fcm_token, title, body_, data);
    if (result === "sent") sentCount++;
    else if (result === "expired") expiredIds.push(t.id);
  }
  if (expiredIds.length > 0) {
    await supabase.from("fcm_tokens").delete().in("id", expiredIds);
  }

  return jsonResponse({
    delivered: sentCount > 0,
    sent_count: sentCount,
    fcm_count: tokensA.length + tokensB.length,
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info, Idempotency-Key",
    },
  });
}
