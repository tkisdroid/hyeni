#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local" });

const OUTPUT_DIR = "output";

function argValue(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] || fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const supabaseUrl = (argValue("--url") || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const anonKey = argValue("--anon-key") || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const serviceKey = argValue("--service-key") || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const timeoutMs = Number(argValue("--timeout-ms", "12000"));
const writeOutput = !hasFlag("--no-output");

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch (error) {
    return { error: error?.message || "invalid jwt" };
  }
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function redactBody(text) {
  return String(text || "")
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, "[jwt-redacted]")
    .slice(0, 180);
}

function buildDiagnosticSummary(env, probes, criticalProbeNames) {
  const failedCriticalProbes = probes
    .filter((item) => criticalProbeNames.has(item.name) && !item.ok)
    .map((item) => ({
      name: item.name,
      error: item.error || "",
      status: item.status ?? null,
      elapsedMs: item.elapsedMs ?? null,
    }));
  const passedNonCriticalProbes = probes
    .filter((item) => !criticalProbeNames.has(item.name) && item.ok)
    .map((item) => item.name);
  const criticalTimeouts = failedCriticalProbes.length > 0
    && failedCriticalProbes.every((item) => item.error === "AbortError");
  const gatewayStillResponds = passedNonCriticalProbes.includes("auth-gateway-no-key")
    || passedNonCriticalProbes.includes("rest-gateway-no-key")
    || passedNonCriticalProbes.includes("realtime-gateway");
  const keysMatch = Boolean(env.anonKeyMatchesUrl && env.serviceKeyMatchesUrl);
  const boundary = !keysMatch
    ? "environment-key-mismatch"
    : failedCriticalProbes.length === 0
      ? "service-ready"
      : keysMatch && gatewayStillResponds && criticalTimeouts
        ? "api-key-db-dependent-path-timeout"
        : "service-readiness-failed";
  const operatorAction = boundary === "service-ready"
    ? "Run the real browser and Android smoke gates."
    : boundary === "api-key-db-dependent-path-timeout"
      ? "Open a Supabase support ticket or restart the live project only with operator approval; do not run Android smoke until this healthcheck is green."
      : "Fix the reported environment or service readiness failures before running Android smoke.";

  return {
    boundary,
    keysMatch,
    failedCriticalProbes,
    passedNonCriticalProbes,
    operatorAction,
  };
}

async function probe(name, request, expectedStatuses = []) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request.url, {
      method: request.method || "GET",
      headers: request.headers || {},
      body: request.body,
      signal: controller.signal,
    });
    const body = await response.text().catch(() => "");
    const statusOk = response.ok || expectedStatuses.includes(response.status);
    return {
      name,
      ok: statusOk,
      reachable: true,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      body: redactBody(body),
    };
  } catch (error) {
    return {
      name,
      ok: false,
      reachable: false,
      error: error?.name || "Error",
      message: error?.message || String(error),
      elapsedMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const urlRef = projectRefFromUrl(supabaseUrl);
  const anonPayload = decodeJwtPayload(anonKey);
  const servicePayload = decodeJwtPayload(serviceKey);
  const env = {
    supabaseUrl,
    projectRef: urlRef,
    hasAnonKey: Boolean(anonKey),
    hasServiceRoleKey: Boolean(serviceKey),
    anonKeyMatchesUrl: Boolean(anonKey && anonPayload.ref === urlRef),
    serviceKeyMatchesUrl: Boolean(serviceKey && servicePayload.ref === urlRef),
    anonRole: anonPayload.role || "",
    serviceRole: servicePayload.role || "",
    timeoutMs,
  };

  const probes = [];
  if (!supabaseUrl || !anonKey || !serviceKey) {
    probes.push({
      name: "env",
      ok: false,
      reachable: false,
      message: "VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required",
    });
  } else {
    probes.push(await probe("auth-gateway-no-key", {
      url: `${supabaseUrl}/auth/v1/health`,
    }, [401]));

    probes.push(await probe("rest-gateway-no-key", {
      url: `${supabaseUrl}/rest/v1/family_members?select=id&limit=1`,
    }, [401]));

    probes.push(await probe("auth-health", {
      url: `${supabaseUrl}/auth/v1/health`,
      headers: { apikey: anonKey },
    }, [200, 401, 404]));

    probes.push(await probe("rest-family-members-service", {
      url: `${supabaseUrl}/rest/v1/family_members?select=id&limit=1`,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }, [200, 206]));

    probes.push(await probe("push-notify-reachable", {
      url: `${supabaseUrl}/functions/v1/push-notify`,
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "request_device_status", healthcheck: true }),
    }, [200, 400, 401, 402, 403, 422]));

    probes.push(await probe("realtime-gateway", {
      url: `${supabaseUrl}/realtime/v1/api/tenants/realtime-dev/health`,
      headers: { apikey: anonKey },
    }, [200, 401, 403, 404]));
  }

  const criticalProbeNames = new Set(["auth-health", "rest-family-members-service", "push-notify-reachable"]);
  const criticalOk = env.anonKeyMatchesUrl
    && env.serviceKeyMatchesUrl
    && probes.filter((item) => criticalProbeNames.has(item.name)).every((item) => item.ok);
  const diagnosticSummary = buildDiagnosticSummary(env, probes, criticalProbeNames);
  const result = {
    generatedAt: new Date().toISOString(),
    env,
    probes,
    diagnosticSummary,
    readyForAndroidSmoke: criticalOk,
    nextAction: criticalOk
      ? "Run scripts/android-remote-listen-parent-ui-smoke.mjs with the connected parent and child devices."
      : "Do not run Android remote-listen E2E yet; fix Supabase API reachability or environment secrets first.",
  };

  if (writeOutput) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const stamp = result.generatedAt.replaceAll(":", "-").replaceAll(".", "-");
    const jsonPath = join(OUTPUT_DIR, `production-stabilization-healthcheck-${stamp}.json`);
    const mdPath = join(OUTPUT_DIR, `production-stabilization-healthcheck-${stamp}.md`);
    writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    writeFileSync(mdPath, renderMarkdown(result));
    result.output = { jsonPath, mdPath };
  }

  console.log(JSON.stringify(result, null, 2));
  if (!criticalOk) process.exitCode = 1;
}

function renderMarkdown(result) {
  const lines = [
    "# Production Stabilization Healthcheck",
    "",
    `Generated: ${result.generatedAt}`,
    `Project ref: ${result.env.projectRef || "(missing)"}`,
    `Ready for Android smoke: ${result.readyForAndroidSmoke ? "yes" : "no"}`,
    "",
    "## Environment",
    "",
    `- URL present: ${Boolean(result.env.supabaseUrl)}`,
    `- anon key present: ${result.env.hasAnonKey}`,
    `- service role key present: ${result.env.hasServiceRoleKey}`,
    `- anon key matches URL ref: ${result.env.anonKeyMatchesUrl}`,
    `- service key matches URL ref: ${result.env.serviceKeyMatchesUrl}`,
    "",
    "## Probes",
    "",
  ];
  for (const probe of result.probes) {
    lines.push(`- ${probe.name}: ${probe.ok ? "ok" : "fail"}; status=${probe.status ?? "n/a"}; error=${probe.error || ""}; elapsedMs=${probe.elapsedMs ?? "n/a"}`);
  }
  lines.push(
    "",
    "## Diagnostic Summary",
    "",
    `- boundary: ${result.diagnosticSummary.boundary}`,
    `- keys match: ${result.diagnosticSummary.keysMatch}`,
    `- failed critical probes: ${result.diagnosticSummary.failedCriticalProbes.map((item) => item.name).join(", ") || "none"}`,
    `- passed non-critical probes: ${result.diagnosticSummary.passedNonCriticalProbes.join(", ") || "none"}`,
    `- operator action: ${result.diagnosticSummary.operatorAction}`,
  );
  lines.push("", "## Next Action", "", result.nextAction, "");
  return `${lines.join("\n")}`;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
