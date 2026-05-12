import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// QA P1 (Agent 10): operator email moved to env var. No hardcoded fallback to
// avoid leaking personal addresses in source / git history. Both
// FEEDBACK_TO_EMAIL (legacy) and FEEDBACK_OPERATOR_EMAIL (new canonical) are
// honored to keep deployment migration smooth.
const FEEDBACK_TO_EMAIL =
  Deno.env.get("FEEDBACK_OPERATOR_EMAIL") ||
  Deno.env.get("FEEDBACK_TO_EMAIL") ||
  "";
const FEEDBACK_FROM_EMAIL = Deno.env.get("FEEDBACK_FROM_EMAIL") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

function sanitizeLine(value: unknown) {
  return String(value || "").replace(/\r?\n/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // QA P1 (Agent 10): JWT verification before sending email to prevent anon
  // abuse / spam through Resend on the operator's quota. Requires
  // Authorization: Bearer <user-jwt>.
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "auth_required" }, 401);
  }
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse({ error: "auth_required" }, 401);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[feedback-email] missing env: SUPABASE_URL/SUPABASE_ANON_KEY");
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user?.id) {
    return jsonResponse({ error: "auth_required" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const content = String(payload.content || "").trim();
  if (!content) {
    return jsonResponse({ error: "content is required" }, 400);
  }

  const normalizedPayload = {
    familyId: sanitizeLine(payload.familyId),
    senderUserId: sanitizeLine(payload.senderUserId),
    senderRole: sanitizeLine(payload.senderRole),
    senderName: sanitizeLine(payload.senderName),
    senderEmail: sanitizeLine(payload.senderEmail),
    content,
    appOrigin: sanitizeLine(payload.appOrigin),
  };

  if (!RESEND_API_KEY || !FEEDBACK_FROM_EMAIL || !FEEDBACK_TO_EMAIL) {
    return jsonResponse({
      ok: true,
      mock: true,
      reason: !RESEND_API_KEY
        ? "Missing RESEND_API_KEY"
        : !FEEDBACK_FROM_EMAIL
          ? "Missing FEEDBACK_FROM_EMAIL"
          : "Missing FEEDBACK_OPERATOR_EMAIL/FEEDBACK_TO_EMAIL",
      received: normalizedPayload,
    });
  }

  const textBody = [
    "[혜니캘린더] 기능 제안",
    "",
    normalizedPayload.content,
    "",
    `senderName: ${normalizedPayload.senderName || "unknown"}`,
    `senderEmail: ${normalizedPayload.senderEmail || "unknown"}`,
    `senderRole: ${normalizedPayload.senderRole || "unknown"}`,
    `senderUserId: ${normalizedPayload.senderUserId || "unknown"}`,
    `familyId: ${normalizedPayload.familyId || "unknown"}`,
    `origin: ${normalizedPayload.appOrigin || "unknown"}`,
  ].join("\n");

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FEEDBACK_FROM_EMAIL,
      to: [FEEDBACK_TO_EMAIL],
      subject: "[혜니캘린더] 기능 제안",
      text: textBody,
      reply_to: normalizedPayload.senderEmail || undefined,
    }),
  });

  if (!resendResponse.ok) {
    const details = await resendResponse.text();
    return jsonResponse({
      error: "Failed to send feedback email",
      details,
    }, 502);
  }

  const result = await resendResponse.json().catch(() => ({}));
  return jsonResponse({
    ok: true,
    emailId: result?.id || null,
  });
});
