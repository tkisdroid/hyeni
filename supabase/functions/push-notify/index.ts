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
  if (claimsErr || !claimsData?.claims?.sub) {
    console.warn("push-notify: invalid jwt", claimsErr?.message);
    return jsonResponse({ error: "invalid jwt" }, 401);
  }
  const callerUserId = claimsData.claims.sub as string;
  const callerRole = (claimsData.claims.role as string) || "authenticated";

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

    if (body?.action === "new_event" || body?.action === "new_memo" || body?.action === "kkuk" || body?.action === "parent_alert" || body?.action === "remote_listen" || body?.action === "request_location" || body?.action === "emergency" || body?.action === "sos") {
      return await handleInstantNotification(supabase, body, callerUserId, callerRole, req);
    }

    // ── Cron mode: check upcoming events ─────────────────────────────────
    return await handleCronNotification(supabase);
  } catch (err) {
    console.error("push-notify error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

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
  const isLocationRefresh = action === "request_location";
  const isChildNativeCommand = isRemoteListen || isLocationRefresh;

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
  const childNativeRecipientIds = isChildNativeCommand
    ? await getFamilyMemberIdsByRole(supabase, familyId, "child")
    : null;
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
      ...(isLocationRefresh ? { targetRole: "child" } : {}),
      ...(isChildNativeCommand && body.requestId !== undefined && body.requestId !== null
        ? { requestId: String(body.requestId) }
        : {}),
      ...(isLocationRefresh && body.reason !== undefined && body.reason !== null
        ? { reason: String(body.reason) }
        : {}),
      ...(isLocationRefresh && body.requestedAt !== undefined && body.requestedAt !== null
        ? { requestedAt: String(body.requestedAt) }
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
