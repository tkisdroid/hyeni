import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { hashHex, jsonResponse, mapProductId, mapRemoteStatus, statusToTier } from "../qonversion-webhook/shared.ts";

function readConfig() {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL") || "",
    supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    qonversionApiKey: Deno.env.get("QONVERSION_API_KEY") || "",
    qonversionApiBaseUrl: Deno.env.get("QONVERSION_API_BASE_URL") || "https://api.qonversion.io",
    qonversionApiKeyHeader: Deno.env.get("QONVERSION_API_KEY_HEADER") || "Authorization",
    qonversionApiKeyPrefix: Deno.env.get("QONVERSION_API_KEY_PREFIX") || "Bearer",
    lookbackHours: Number(Deno.env.get("QONVERSION_RECONCILE_LOOKBACK_HOURS") || "24"),
    dryRun: Deno.env.get("QONVERSION_RECONCILE_DRY_RUN") === "1",
  };
}

function buildAuthHeader(config: ReturnType<typeof readConfig>) {
  if (!config.qonversionApiKey) return null;
  if (config.qonversionApiKeyHeader.toLowerCase() === "authorization") {
    return config.qonversionApiKeyPrefix + " " + config.qonversionApiKey;
  }
  return config.qonversionApiKey;
}

function unwrapRemote(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  for (const key of ["data", "entitlements", "active_entitlements", "items", "subscription"]) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
    if (Array.isArray(value) && value.length > 0 && value[0] && typeof value[0] === "object") return value[0] as Record<string, unknown>;
  }
  return record;
}

function readIsoDate(input: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  return null;
}

function extractRemoteState(remote: Record<string, unknown>) {
  const status = mapRemoteStatus(remote);
  return {
    status,
    productId: mapProductId(remote),
    trialEndsAt: readIsoDate(remote, ["trial_ends_at", "trialEndsAt", "trial_end", "trialEnd", "expires_at", "expiresAt"]),
    currentPeriodEnd: readIsoDate(remote, ["current_period_end", "currentPeriodEnd", "period_ends_at", "periodEndsAt", "expires_at", "expiresAt", "renewal_date", "renewalDate"]),
  };
}

async function fetchRemoteEntitlement(config: ReturnType<typeof readConfig>, familyId: string) {
  if (!config.qonversionApiKey) {
    return { mock: true, familyId, raw: {}, ...extractRemoteState({ status: "free" }) } as const;
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const authHeader = buildAuthHeader(config);
  if (authHeader) headers[config.qonversionApiKeyHeader] = authHeader;

  const response = await fetch(
    config.qonversionApiBaseUrl.replace(/\/$/, "") + "/v3/users/" + encodeURIComponent(familyId) + "/entitlements",
    { headers },
  );

  if (!response.ok) {
    throw new Error("Qonversion API error " + response.status + ": " + await response.text());
  }

  const raw = await response.json();
  const remote = unwrapRemote(raw);
  return { mock: false, familyId, raw, ...extractRemoteState(remote) } as const;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(null);
  }

  if (req.method === "GET") {
    const config = readConfig();
    return jsonResponse({
      ok: true,
      service: "subscription-reconcile",
      configured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
      mock: !(config.supabaseUrl && config.supabaseServiceRoleKey),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const config = readConfig();
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return jsonResponse({
      ok: true,
      mock: true,
      reason: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  if (!config.qonversionApiKey) {
    return jsonResponse({
      ok: true,
      mock: true,
      reason: "Missing QONVERSION_API_KEY",
      checked: 0,
      reconciled: 0,
    });
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const staleBefore = new Date(Date.now() - Math.max(1, config.lookbackHours) * 60 * 60 * 1000).toISOString();
  const { data: staleRows, error: staleError } = await supabase
    .from("family_subscription")
    .select("family_id, qonversion_user_id, status, product_id, updated_at")
    .lt("updated_at", staleBefore)
    .order("updated_at", { ascending: true })
    .limit(100);

  if (staleError) {
    return jsonResponse({
      error: "Failed to load stale subscriptions",
      details: staleError.message,
    }, 500);
  }

  if (!staleRows?.length) {
    return jsonResponse({ ok: true, checked: 0, reconciled: 0, mock: false });
  }

  let checked = 0;
  let reconciled = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const row of staleRows) {
    checked += 1;
    const familyId = (row.qonversion_user_id as string) || (row.family_id as string);

    try {
      const remote = await fetchRemoteEntitlement(config, familyId);
      const nextStatus = (remote.status as string) || (row.status as string) || "expired";
      const nextProductId = (remote.productId as string) || (row.product_id as string) || "premium_monthly";

      if (config.dryRun) {
        results.push({
          familyId,
          status: nextStatus,
          tier: statusToTier(nextStatus),
          mock: remote.mock,
          dryRun: true,
        });
        continue;
      }

      const payload: Record<string, unknown> = {
        family_id: row.family_id,
        status: nextStatus,
        product_id: nextProductId,
        qonversion_user_id: familyId,
        raw_event: remote.raw || {},
        last_event_id: "reconcile:" + await hashHex(familyId + ":" + JSON.stringify(remote.raw || {})),
        last_event_at: new Date().toISOString(),
      };

      if (nextStatus === "trial") {
        payload.trial_ends_at = remote.trialEndsAt;
        payload.current_period_end = remote.currentPeriodEnd;
      } else if (nextStatus === "active" || nextStatus === "grace") {
        payload.trial_ends_at = null;
        payload.current_period_end = remote.currentPeriodEnd;
        payload.cancelled_at = null;
      } else if (nextStatus === "cancelled" || nextStatus === "expired") {
        payload.trial_ends_at = null;
        payload.cancelled_at = new Date().toISOString();
      }

      const { error: upsertError } = await supabase
        .from("family_subscription")
        .upsert(payload, { onConflict: "family_id" });

      if (upsertError) {
        results.push({ familyId, error: upsertError.message });
        continue;
      }

      reconciled += 1;
      results.push({
        familyId,
        status: nextStatus,
        tier: statusToTier(nextStatus),
        mock: remote.mock,
      });
    } catch (err) {
      results.push({
        familyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return jsonResponse({
    ok: true,
    checked,
    reconciled,
    mock: false,
    results,
  });
});
