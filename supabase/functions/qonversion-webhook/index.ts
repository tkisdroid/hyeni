import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  extractDate,
  extractEventId,
  extractEventType,
  extractFamilyId,
  getDefaultTrialEndsAt,
  hashHex,
  jsonResponse,
  mapProductId,
  mapRemoteStatus,
  statusToTier,
  verifyHmacSignature,
} from "./shared.ts";

function readConfig() {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL") || "",
    supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    webhookSecret: Deno.env.get("QONVERSION_WEBHOOK_SECRET") || Deno.env.get("QONVERSION_WEBHOOK_SIGNING_SECRET") || "",
    signatureHeader: Deno.env.get("QONVERSION_WEBHOOK_SIGNATURE_HEADER") || "x-qonversion-signature",
    allowUnsigned: Deno.env.get("QONVERSION_ALLOW_UNSIGNED_WEBHOOKS") === "1",
  };
}

function parseBody(rawBody: string): Record<string, unknown> {
  try {
    const value = JSON.parse(rawBody);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function unwrapPayload(body: Record<string, unknown>): Record<string, unknown> {
  for (const key of ["data", "payload", "event", "subscription", "entitlement", "webhook"]) {
    const value = body[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return body;
}

function buildPatch(familyId: string, payload: Record<string, unknown>) {
  const status = mapRemoteStatus(payload);
  const productId = mapProductId(payload);
  const patch: Record<string, unknown> = {
    family_id: familyId,
    qonversion_user_id: familyId,
    product_id: productId,
    raw_event: payload,
    last_event_at: new Date().toISOString(),
  };

  if (status) {
    patch.status = status;
    if (status === "trial") {
      patch.trial_ends_at = extractDate(payload, ["trial_ends_at", "trialEndsAt", "trial_end", "trialEnd"]) || getDefaultTrialEndsAt();
      const currentPeriodEnd = extractDate(payload, ["current_period_end", "currentPeriodEnd", "period_ends_at", "periodEndsAt", "expires_at", "expiresAt"]);
      if (currentPeriodEnd) patch.current_period_end = currentPeriodEnd;
    } else if (status === "active" || status === "grace") {
      patch.trial_ends_at = null;
      const currentPeriodEnd = extractDate(payload, ["current_period_end", "currentPeriodEnd", "period_ends_at", "periodEndsAt", "expires_at", "expiresAt"]);
      if (currentPeriodEnd) patch.current_period_end = currentPeriodEnd;
      patch.cancelled_at = null;
    } else if (status === "cancelled" || status === "expired") {
      patch.trial_ends_at = null;
      patch.cancelled_at = new Date().toISOString();
    }
  }

  return patch;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(null);
  }

  if (req.method === "GET") {
    const config = readConfig();
    return jsonResponse({
      ok: true,
      service: "qonversion-webhook",
      configured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
      mock: !(config.supabaseUrl && config.supabaseServiceRoleKey),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const rawBody = await req.text();
  const payload = unwrapPayload(parseBody(rawBody));
  const config = readConfig();

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return jsonResponse({
      ok: true,
      mock: true,
      reason: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      received: payload,
    });
  }

  const signature = req.headers.get(config.signatureHeader) || req.headers.get(config.signatureHeader.toLowerCase()) || req.headers.get("x-qonversion-signature") || "";

  if (config.webhookSecret) {
    const verified = await verifyHmacSignature(rawBody, signature, config.webhookSecret);
    if (!verified) return jsonResponse({ error: "Invalid webhook signature" }, 401);
  } else if (!config.allowUnsigned && signature) {
    return jsonResponse({ error: "Webhook secret is not configured" }, 503);
  }

  const familyId = extractFamilyId(payload);
  if (!familyId) {
    return jsonResponse({ error: "family id not found in webhook payload" }, 400);
  }

  const eventId = extractEventId(payload, await hashHex(rawBody));
  const eventType = extractEventType(payload) || "unknown";
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: eventInsertError } = await supabase.from("subscription_webhook_events").insert({
    event_id: eventId,
    family_id: familyId,
    event_type: eventType,
    status: mapRemoteStatus(payload),
    payload,
    received_at: new Date().toISOString(),
  });

  if (eventInsertError) {
    if (eventInsertError.code === "23505") {
      return jsonResponse({ ok: true, duplicate: true, eventId });
    }
    return jsonResponse({
      error: "Failed to persist webhook event",
      details: eventInsertError.message,
    }, 500);
  }

  const patch = buildPatch(familyId, payload);
  if (!patch.status) {
    return jsonResponse({ ok: true, eventId, ignored: true });
  }

  const { error: upsertError } = await supabase
    .from("family_subscription")
    .upsert({ ...patch, last_event_id: eventId }, { onConflict: "family_id" });

  if (upsertError) {
    return jsonResponse({
      error: "Failed to update family_subscription",
      details: upsertError.message,
    }, 500);
  }

  return jsonResponse({
    ok: true,
    eventId,
    familyId,
    status: patch.status,
    tier: statusToTier(patch.status as string),
  });
});
