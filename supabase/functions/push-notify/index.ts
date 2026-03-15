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
  data: Record<string, string>,
  isUrgent: boolean
): Promise<"sent" | "expired" | "error"> {
  const accessToken = await getFcmAccessToken();
  if (!accessToken) return "error";

  try {
    const stringData = Object.fromEntries(
      Object.entries({ title, body, type: data.type || "schedule", ...data }).map(([key, value]) => [key, String(value)])
    );

    const message: Record<string, unknown> = {
      message: {
        token,
        // Data-only message: Android always routes this through
        // MyFirebaseMessagingService, even when the app process is dead.
        data: stringData,
        android: {
          priority: "HIGH",
          ttl: "120s",
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
  type: string
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

  const isUrgent = type === "kkuk" || type === "parent_alert" || type === "new_memo";
  let sent = 0;
  const expiredIds: string[] = [];

  for (const t of tokens) {
    if (t.user_id === senderUserId) continue;
    const result = await sendFcmNotification(
      t.fcm_token,
      title,
      body,
      { type, familyId, ...(isUrgent ? { urgent: "true" } : {}) },
      isUrgent
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
        "Access-Control-Allow-Methods": "POST, GET",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

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

    if (body?.action === "new_event" || body?.action === "new_memo" || body?.action === "kkuk" || body?.action === "parent_alert") {
      return await handleInstantNotification(supabase, body);
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
  body: Record<string, unknown>
) {
  const familyId = body.familyId as string;
  const senderUserId = body.senderUserId as string;
  const title = body.title as string || "새 알림";
  const message = body.message as string || "";

  if (!familyId) return jsonResponse({ error: "familyId required" }, 400);

  // ── Web Push (VAPID) ────────────────────────────────────────────────
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, subscription, user_id")
    .eq("family_id", familyId);

  const payload: PushPayload = {
    title,
    body: message,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { type: body.action as string, familyId },
  };

  let webSent = 0;
  const expiredIds: string[] = [];

  if (subs?.length) {
    for (const sub of subs) {
      if (sub.user_id === senderUserId) continue;
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
    body.action as string
  );

  // Also queue for Android native polling (fallback)
  const { error: pendingErr } = await supabase.from("pending_notifications").insert({
    family_id: familyId,
    title,
    body: message,
  });

  if (pendingErr) {
    console.error("Failed to queue pending notification:", pendingErr);
  }

  return jsonResponse({ webSent, fcmSent, total: (subs?.length || 0) });
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
        data: { eventId: event.id, type: window.key },
      };

      // ── Web Push ──────────────────────────────────────────────────
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, subscription")
        .eq("family_id", event.family_id);

      const expiredIds: string[] = [];

      if (subs?.length) {
        for (const sub of subs) {
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
        window.key
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
    },
  });
}
