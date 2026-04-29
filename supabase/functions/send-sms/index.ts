import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { normalizePhoneForNcpSens, sendNcpSensOtp } from "../_shared/ncpSens.ts";

type SendSmsHookPayload = {
  user?: {
    phone?: unknown;
  };
  sms?: {
    otp?: unknown;
  };
};

type NcpSensConfig = {
  accessKey: string;
  secretKey: string;
  serviceId: string;
  from: string;
  hookSecrets: string[];
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function normalizeHookSecret(secret: string) {
  let normalized = String(secret || "").trim();
  const whsecIndex = normalized.indexOf("whsec_");
  if (whsecIndex >= 0) {
    normalized = normalized.slice(whsecIndex + "whsec_".length);
  } else if (normalized.includes(",")) {
    normalized = normalized.split(",").pop()?.trim() || "";
  }
  return normalized;
}

function readHookSecrets() {
  const raw = Deno.env.get("SEND_SMS_HOOK_SECRETS")
    || Deno.env.get("SEND_SMS_HOOK_SECRET")
    || "";

  return raw
    .split("|")
    .map(normalizeHookSecret)
    .filter(Boolean);
}

function readConfig(): NcpSensConfig {
  return {
    accessKey: Deno.env.get("NCP_SENS_ACCESS_KEY")?.trim() || "",
    secretKey: Deno.env.get("NCP_SENS_SECRET_KEY")?.trim() || "",
    serviceId: Deno.env.get("NCP_SENS_SERVICE_ID")?.trim() || "",
    from: Deno.env.get("NCP_SENS_FROM_NUMBER")?.trim() || "",
    hookSecrets: readHookSecrets(),
  };
}

function hasValidConfig(config: NcpSensConfig) {
  return Boolean(
    config.accessKey
      && config.secretKey
      && config.serviceId
      && config.from.replace(/\D/g, ""),
  );
}

function getPayloadText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function verifyHookPayload(payload: string, req: Request, hookSecrets: string[]) {
  if (hookSecrets.length === 0) {
    throw new Error("send_sms_hook_secret_not_configured");
  }

  const headers = Object.fromEntries(req.headers);
  let lastError: unknown = null;

  for (const secret of hookSecrets) {
    try {
      return new Webhook(secret).verify(payload, headers) as SendSmsHookPayload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("invalid_webhook_signature");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const config = readConfig();
  if (config.hookSecrets.length === 0) {
    return jsonResponse({ error: "send_sms_hook_secret_not_configured" }, 500);
  }

  let payload = "";
  try {
    payload = await req.text();
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  let event: SendSmsHookPayload;
  try {
    event = verifyHookPayload(payload, req, config.hookSecrets);
  } catch {
    return jsonResponse({ error: "invalid_webhook_signature" }, 401);
  }

  if (!hasValidConfig(config)) {
    return jsonResponse({ error: "ncp_sens_not_configured" }, 500);
  }

  const phone = getPayloadText(event?.user?.phone);
  const otp = getPayloadText(event?.sms?.otp);
  if (!phone || !otp) {
    return jsonResponse({ error: "missing_phone_or_otp" }, 400);
  }

  try {
    normalizePhoneForNcpSens(phone);
    await sendNcpSensOtp({
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      serviceId: config.serviceId,
      from: config.from,
      to: phone,
      otp,
    });
    return jsonResponse({});
  } catch (error) {
    if (error instanceof Error && (
      error.message === "invalid_phone"
        || error.message === "invalid_otp"
        || error.message === "invalid_from_number"
    )) {
      return jsonResponse({ error: "invalid_payload" }, 400);
    }

    console.error("send-sms provider failure", error);
    return jsonResponse({ error: "sms_provider_failed" }, 503, { "Retry-After": "5" });
  }
});
