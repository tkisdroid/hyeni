#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local" });

const PACKAGE_NAME = "com.hyeni.calendar";
const PREFS_PATH = `/data/user/0/${PACKAGE_NAME}/shared_prefs/hyeni_location_prefs.xml`;
const OUTPUT_DIR = "output";

function argValue(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] || fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const parentDevice = argValue("--parent", "emulator-5554");
const childDevice = argValue("--child", "R5CY40EE6QE");
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const readinessTimeoutMs = Number(argValue("--readiness-timeout-ms", "12000"));
const skipReadinessCheck = hasFlag("--skip-readiness-check");
const startChildServiceForPendingFallback = hasFlag("--start-child-service-for-pending-fallback");
const childBackgroundOnly = hasFlag("--child-background-only");

if (!supabaseUrl || !anonKey || !serviceKey) {
  throw new Error("VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are required");
}

mkdirSync(OUTPUT_DIR, { recursive: true });

function adb(device, args, options = {}) {
  try {
    return execFileSync("adb", ["-s", device, ...args], {
      encoding: options.encoding || "utf8",
      stdio: options.stdio || ["ignore", "pipe", "pipe"],
      maxBuffer: options.maxBuffer || 1024 * 1024 * 8,
    });
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    throw new Error(stderr || `adb failed: ${args[0] || "command"}`);
  }
}

function adbInput(device, args, input) {
  const result = spawnSync("adb", ["-s", device, ...args], {
    input,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `adb failed: ${args.join(" ")}`);
  }
  return result.stdout || "";
}

function readPrefs(device) {
  return adb(device, ["exec-out", "run-as", PACKAGE_NAME, "cat", PREFS_PATH], { maxBuffer: 1024 * 1024 * 16 });
}

function writePrefs(device, xml) {
  adbInput(device, ["shell", "run-as", PACKAGE_NAME, "tee", PREFS_PATH], xml);
}

function stopNativeServices(device) {
  try {
    adb(device, [
      "shell",
      "run-as",
      PACKAGE_NAME,
      "am",
      "startservice",
      "--user",
      "0",
      "-n",
      `${PACKAGE_NAME}/.LocationService`,
      "-a",
      "STOP",
    ]);
  } catch {
    // The location service may not be running yet.
  }
  for (const serviceName of [".LocationService", ".AmbientListenService", ".ForceRingService"]) {
    try {
      adb(device, ["shell", "am", "stopservice", "-n", `${PACKAGE_NAME}/${serviceName}`]);
    } catch {
      // Service may not be running.
    }
  }
}

function startLocationService(device) {
  adb(device, [
    "shell",
    "run-as",
    PACKAGE_NAME,
    "am",
    "startservice",
    "--user",
    "0",
    "-n",
    `${PACKAGE_NAME}/.LocationService`,
  ]);
}

function startLocationServiceWithContext(device, temp) {
  adb(device, [
    "shell",
    "run-as",
    PACKAGE_NAME,
    "am",
    "startservice",
    "--user",
    "0",
    "-n",
    `${PACKAGE_NAME}/.LocationService`,
    "--es",
    "userId",
    temp.childUser.id,
    "--es",
    "familyId",
    temp.familyId,
    "--es",
    "role",
    "child",
    "--es",
    "supabaseUrl",
    supabaseUrl,
    "--es",
    "supabaseKey",
    anonKey,
    "--es",
    "accessToken",
    temp.childSession.access_token,
  ]);
}

function killAppProcess(device) {
  try {
    adb(device, ["shell", "input", "keyevent", "HOME"]);
  } catch {
    // Device may already be locked or on the launcher.
  }
  try {
    adb(device, ["shell", "am", "kill", PACKAGE_NAME]);
  } catch {
    // The app process may not be running.
  }
}

async function backgroundChildApp(device) {
  adb(device, ["shell", "am", "start", "-n", `${PACKAGE_NAME}/.MainActivity`]);
  await sleep(8_000);
  try {
    adb(device, ["shell", "input", "keyevent", "HOME"]);
  } catch {
    // Device may already be on the launcher.
  }
  await sleep(1_500);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlUnescape(value) {
  return String(value ?? "")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function readStringPref(xml, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<string name="${escapedName}">([\\s\\S]*?)</string>`).exec(xml);
  return match ? xmlUnescape(match[1]) : "";
}

function readBooleanPref(xml, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<boolean name="${escapedName}" value="(true|false)"\\s*/>`).exec(xml);
  return match ? match[1] === "true" : false;
}

function setStringPref(xml, name, value) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nextEntry = `    <string name="${name}">${xmlEscape(value)}</string>`;
  const re = new RegExp(`\\s*<string name="${escapedName}">[\\s\\S]*?</string>`);
  if (re.test(xml)) return xml.replace(re, `\n${nextEntry}`);
  return xml.replace("</map>", `${nextEntry}\n</map>`);
}

function generatePairCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "KID-";
  for (let i = 0; i < 8; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function shQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function restThrow(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

function boundsCenter(bounds) {
  const match = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(bounds || "");
  if (!match) return null;
  const [, x1, y1, x2, y2] = match.map(Number);
  return { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) };
}

function dumpUi(device) {
  adb(device, ["shell", "uiautomator", "dump", "/sdcard/window.xml"]);
  return adb(device, ["shell", "cat", "/sdcard/window.xml"], { maxBuffer: 1024 * 1024 * 8 });
}

function findNodeByText(xml, text) {
  const nodeRe = /<node\b[^>]*>/g;
  let match;
  while ((match = nodeRe.exec(xml))) {
    const node = match[0];
    const textMatch = /text="([^"]*)"/.exec(node);
    const descMatch = /content-desc="([^"]*)"/.exec(node);
    const label = xmlUnescape(textMatch?.[1] || descMatch?.[1] || "");
    if (!label.includes(text)) continue;
    const bounds = /bounds="([^"]+)"/.exec(node)?.[1] || "";
    const center = boundsCenter(bounds);
    if (center) return center;
  }
  return null;
}

function tapText(device, text, { scroll = false } = {}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const xml = dumpUi(device);
    const center = findNodeByText(xml, text);
    if (center) {
      adb(device, ["shell", "input", "tap", String(center.x), String(center.y)]);
      return center;
    }
    if (!scroll) break;
    adb(device, ["shell", "input", "swipe", "520", "1750", "520", "650", "350"]);
  }
  throw new Error(`Could not find UI text: ${text}`);
}

function grantPermissionIfPossible(device, permission) {
  try {
    adb(device, ["shell", "pm", "grant", PACKAGE_NAME, permission]);
  } catch {
    // Some permissions are API-level or role dependent. Runtime dialogs are
    // handled below when Android still asks.
  }
}

function allowPermissionDialogs(device) {
  const allowTexts = [
    "While using the app",
    "Only this time",
    "Allow",
    "앱 사용 중에만 허용",
    "이번만 허용",
    "허용",
  ];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let xml = "";
    try {
      xml = dumpUi(device);
    } catch {
      return;
    }
    if (!xml.includes("permissioncontroller")) return;
    let tapped = false;
    for (const text of allowTexts) {
      const center = findNodeByText(xml, text);
      if (center) {
        adb(device, ["shell", "input", "tap", String(center.x), String(center.y)]);
        tapped = true;
        break;
      }
    }
    if (!tapped) return;
  }
}

function screencap(device, name) {
  const out = adb(device, ["exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 1024 * 1024 * 16 });
  const path = join(OUTPUT_DIR, name);
  writeFileSync(path, out);
  return path;
}

function deviceSize(device) {
  const raw = adb(device, ["shell", "wm", "size"]);
  const match = /Physical size:\s*(\d+)x(\d+)/.exec(raw);
  if (!match) return { width: 1080, height: 2400 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

function tapRelative(device, xRatio, yRatio) {
  const { width, height } = deviceSize(device);
  const x = Math.round(width * xRatio);
  const y = Math.round(height * yRatio);
  adb(device, ["shell", "input", "tap", String(x), String(y)]);
  return { x, y };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeSupabaseReadiness(name, request, expectedStatuses = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readinessTimeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(request.url, {
      method: request.method || "GET",
      headers: request.headers || {},
      body: request.body,
      signal: controller.signal,
    });
    await response.text().catch(() => "");
    return {
      name,
      ok: response.ok || expectedStatuses.includes(response.status),
      status: response.status,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      error: error?.name || "Error",
      message: error?.message || String(error),
      elapsedMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function assertSupabaseReadyForSmoke(ts) {
  const probes = await Promise.all([
    probeSupabaseReadiness("auth-health", {
      url: `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/health`,
      headers: { apikey: anonKey },
    }, [200, 401, 404]),
    probeSupabaseReadiness("rest-family-members-service", {
      url: `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/family_members?select=id&limit=1`,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }, [200, 206]),
    probeSupabaseReadiness("push-notify-reachable", {
      url: `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/push-notify`,
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "request_device_status", healthcheck: true }),
    }, [200, 400, 401, 402, 403, 422]),
  ]);
  const result = {
    generatedAt: new Date().toISOString(),
    ready: probes.every((probe) => probe.ok),
    timeoutMs: readinessTimeoutMs,
    probes,
  };
  const path = join(OUTPUT_DIR, `android-parent-ui-remote-listen-readiness-${ts}.json`);
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
  if (!result.ready) {
    throw new Error(`Supabase is not ready for Android remote-listen smoke. See ${path}`);
  }
}

function remoteListenLog(device) {
  return adb(device, [
    "logcat",
    "-d",
    "-v",
    "time",
    "FCMService:V",
    "DeviceStatusReporter:V",
    "RemoteListenActivity:V",
    "AmbientListenService:V",
    "LocationService:V",
    "*:S",
  ], { maxBuffer: 1024 * 1024 * 16 });
}

async function createTempData(originalPrefsXml) {
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const parentEmail = `remote-listen-parent-${suffix}@hyeni.test`;
  const childEmail = `remote-listen-child-${suffix}@hyeni.test`;
  const password = `Smoke-${suffix}!aA1`;

  const parentUser = restThrow("create parent", await admin.auth.admin.createUser({
    email: parentEmail,
    password,
    email_confirm: true,
    app_metadata: { provider: "kakao", providers: ["kakao"] },
    user_metadata: { provider: "kakao", name: "원격듣기부모" },
  })).user;

  const childUser = restThrow("create child", await admin.auth.admin.createUser({
    email: childEmail,
    password,
    email_confirm: true,
    user_metadata: { name: "원격듣기아이" },
  })).user;

  const parentSession = restThrow("sign in parent", await anon.auth.signInWithPassword({
    email: parentEmail,
    password,
  })).session;
  const childSession = restThrow("sign in child", await anon.auth.signInWithPassword({
    email: childEmail,
    password,
  })).session;

  const family = restThrow("insert family", await admin
    .from("families")
    .insert({
      name: "remote-listen-parent-ui-smoke",
      parent_id: parentUser.id,
      pair_code: generatePairCode(),
    })
    .select("id")
    .single());

  await restThrow("insert parent member", await admin
    .from("family_members")
    .insert({ family_id: family.id, user_id: parentUser.id, role: "parent", name: "원격듣기부모" })
    .select("id")
    .single());

  await restThrow("insert child member", await admin
    .from("family_members")
    .insert({
      family_id: family.id,
      user_id: childUser.id,
      role: "child",
      name: "원격듣기아이",
      color_hex: "#F779A8",
      child_order: 1,
    })
    .select("id")
    .single());

  await restThrow("insert family subscription", await admin
    .from("family_subscription")
    .insert({
      family_id: family.id,
      status: "active",
      product_id: "premium_monthly",
      qonversion_user_id: `smoke-${suffix}`,
      current_period_end: new Date(Date.now() + 86400_000).toISOString(),
    })
    .select("family_id")
    .single());

  const fcmToken = readStringPref(originalPrefsXml, "fcmToken");
  if (!fcmToken) throw new Error("Physical child device has no fcmToken in hyeni_location_prefs");

  await restThrow("insert child fcm token", await admin
    .from("fcm_tokens")
    .upsert({
      family_id: family.id,
      user_id: childUser.id,
      fcm_token: fcmToken,
      platform: "android",
    }, { onConflict: "user_id,fcm_token" })
    .select("id")
    .single());

  return { admin, parentUser, childUser, familyId: family.id, parentSession, childSession };
}

async function cleanupTempData(temp) {
  if (!temp?.admin) return;
  if (temp.familyId) await temp.admin.from("families").delete().eq("id", temp.familyId);
  if (temp.parentUser?.id) await temp.admin.auth.admin.deleteUser(temp.parentUser.id).catch(() => {});
  if (temp.childUser?.id) await temp.admin.auth.admin.deleteUser(temp.childUser.id).catch(() => {});
}

async function main() {
  const ts = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  if (!skipReadinessCheck) {
    await assertSupabaseReadyForSmoke(ts);
  }
  const originalPrefsXml = readPrefs(childDevice);
  let temp = null;

  try {
    temp = await createTempData(originalPrefsXml);

    stopNativeServices(childDevice);
    killAppProcess(childDevice);

    let childPrefsXml = originalPrefsXml;
    childPrefsXml = setStringPref(childPrefsXml, "familyId", temp.familyId);
    childPrefsXml = setStringPref(childPrefsXml, "userId", temp.childUser.id);
    childPrefsXml = setStringPref(childPrefsXml, "role", "child");
    childPrefsXml = setStringPref(childPrefsXml, "supabaseUrl", supabaseUrl);
    childPrefsXml = setStringPref(childPrefsXml, "supabaseKey", anonKey);
    childPrefsXml = setStringPref(childPrefsXml, "accessToken", temp.childSession.access_token);
    writePrefs(childDevice, childPrefsXml);
    const writtenPrefsXml = readPrefs(childDevice);
    if (readStringPref(writtenPrefsXml, "familyId") !== temp.familyId
      || readStringPref(writtenPrefsXml, "userId") !== temp.childUser.id) {
      throw new Error("Child prefs did not retain temporary test context");
    }
    if (childBackgroundOnly) {
      await backgroundChildApp(childDevice);
      startLocationServiceWithContext(childDevice, temp);
      await sleep(1500);
      stopNativeServices(childDevice);
    } else {
      startLocationServiceWithContext(childDevice, temp);
      await sleep(1500);
      stopNativeServices(childDevice);
      killAppProcess(childDevice);
    }
    adb(childDevice, ["logcat", "-c"]);
    if (startChildServiceForPendingFallback) {
      startLocationService(childDevice);
      await sleep(7000);
    }

    adb(parentDevice, ["shell", "pm", "clear", PACKAGE_NAME]);
    for (const permission of [
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.CAMERA",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.RECORD_AUDIO",
    ]) {
      grantPermissionIfPossible(parentDevice, permission);
      grantPermissionIfPossible(childDevice, permission);
    }
    const authUrl = `hyenicalendar://auth-callback#access_token=${encodeURIComponent(temp.parentSession.access_token)}&refresh_token=${encodeURIComponent(temp.parentSession.refresh_token)}&token_type=bearer&expires_in=3600`;
    adb(parentDevice, ["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", shQuote(authUrl), "-p", PACKAGE_NAME]);
    await sleep(15_000);
    allowPermissionDialogs(parentDevice);
    await sleep(15_000);
    const loadedShot = screencap(parentDevice, `android-parent-ui-smoke-loaded-${ts}.png`);

    adb(parentDevice, ["shell", "input", "swipe", "520", "1800", "520", "650", "450"]);
    await sleep(1200);
    const scrolledShot = screencap(parentDevice, `android-parent-ui-smoke-scrolled-${ts}.png`);
    const remoteListenTap = tapText(parentDevice, "주변소리", { scroll: true });
    await sleep(2500);
    const modalShot = screencap(parentDevice, `android-parent-ui-remote-listen-modal-${ts}.png`);

    const startTap = tapText(parentDevice, "듣기 시작", { scroll: true });
    await sleep(20_000);
    const interimLogs = remoteListenLog(childDevice);
    const manualNotificationTap = /RemoteListenActivity|Remote listen foreground bridge started AmbientListenService|Native ambient audio capture started|Realtime audio chunk sent/.test(interimLogs)
      ? null
      : tapRelative(childDevice, 0.50, 0.095);
    await sleep(25_000);
    const startedShot = screencap(parentDevice, `android-parent-ui-remote-listen-started-${ts}.png`);
    const childShot = screencap(childDevice, `android-child-after-parent-ui-remote-listen-${ts}.png`);

    const logs = remoteListenLog(childDevice);
    const logPath = join(OUTPUT_DIR, `android-parent-ui-remote-listen-${ts}.log`);
    writeFileSync(logPath, logs);

    const result = {
      familyId: temp.familyId,
      childMode: childBackgroundOnly ? "backgrounded" : "killed",
      success: /RemoteListenActivity|Remote listen foreground bridge started AmbientListenService|Native ambient audio capture started|Realtime audio chunk sent/.test(logs),
      sawFcm: /Remote listen request - launching app/.test(logs),
      sawActivity: /RemoteListenActivity/.test(logs),
      sawService: /Native ambient audio capture started|Realtime audio chunk sent/.test(logs),
      taps: { remoteListenTap, startTap, manualNotificationTap },
      screenshots: { loadedShot, scrolledShot, modalShot, startedShot, childShot },
      logPath,
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
  } finally {
    try {
      stopNativeServices(childDevice);
      killAppProcess(childDevice);
      writePrefs(childDevice, originalPrefsXml);
      if (readBooleanPref(originalPrefsXml, "serviceEnabled")) {
        startLocationService(childDevice);
      }
      const restoredPrefsXml = readPrefs(childDevice);
      if (readStringPref(restoredPrefsXml, "familyId") !== readStringPref(originalPrefsXml, "familyId")
        || readStringPref(restoredPrefsXml, "userId") !== readStringPref(originalPrefsXml, "userId")) {
        adb(childDevice, ["shell", "am", "start", "-n", `${PACKAGE_NAME}/.MainActivity`]);
        await sleep(8_000);
      }
    } catch (restoreError) {
      console.error(`Failed to restore child prefs: ${restoreError?.message || restoreError}`);
    }
    await cleanupTempData(temp);
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
