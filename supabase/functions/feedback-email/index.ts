import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FEEDBACK_TO_EMAIL = Deno.env.get("FEEDBACK_TO_EMAIL") || "tkisdroid@gmail.com";
const FEEDBACK_FROM_EMAIL = Deno.env.get("FEEDBACK_FROM_EMAIL") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

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

  if (!RESEND_API_KEY || !FEEDBACK_FROM_EMAIL) {
    return jsonResponse({
      ok: true,
      mock: true,
      reason: !RESEND_API_KEY
        ? "Missing RESEND_API_KEY"
        : "Missing FEEDBACK_FROM_EMAIL",
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
