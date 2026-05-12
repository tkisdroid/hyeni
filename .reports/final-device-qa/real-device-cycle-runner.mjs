import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

const PACKAGE_NAME = "com.hyeni.calendar";
const PARENT_SERIAL = process.env.HYENI_PARENT_SERIAL || "R5CY40EE6QE";
const CHILD_SERIAL = process.env.HYENI_CHILD_SERIAL || "R5CY521CFNZ";
const PARENT_PORT = Number(process.env.HYENI_PARENT_CDP_PORT || 9222);
const CHILD_PORT = Number(process.env.HYENI_CHILD_CDP_PORT || 9223);
const cycle = process.argv.find((arg) => arg.startsWith("--cycle="))?.split("=")[1] || "manual";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase env is missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rootDir = process.cwd();
const screenshotDir = join(rootDir, ".reports", "final-device-qa", "screenshots");
const logDir = join(rootDir, ".reports", "final-device-qa", "logcat");
mkdirSync(screenshotDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

function adb(serial, args, options = {}) {
  return execFileSync("adb", ["-s", serial, ...args], {
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer ?? 1024 * 1024 * 16,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

function safeAdb(serial, args) {
  try {
    return adb(serial, args).trim();
  } catch {
    return "";
  }
}

function startAndForward(serial, port) {
  adb(serial, ["shell", "am", "force-stop", PACKAGE_NAME]);
  adb(serial, ["shell", "am", "start", "-n", `${PACKAGE_NAME}/.MainActivity`]);
  const deadline = Date.now() + 15000;
  let pid = "";
  while (Date.now() < deadline && !pid) {
    pid = safeAdb(serial, ["shell", "pidof", PACKAGE_NAME]);
    if (!pid) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
  }
  if (!pid) throw new Error(`No app pid for ${serial}`);
  try { adb(serial, ["forward", "--remove", `tcp:${port}`]); } catch { /* ignore */ }
  adb(serial, ["forward", `tcp:${port}`, `localabstract:webview_devtools_remote_${pid}`]);
  return pid;
}

function screencap(serial, name) {
  const png = adb(serial, ["exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 1024 * 1024 * 32 });
  const path = join(screenshotDir, `${cycle}-${name}.png`);
  writeFileSync(path, png);
  return path;
}

function getJson(port, path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on("error", reject);
  });
}

async function cdpEval(port, expression) {
  const tabs = await getJson(port, "/json");
  const tab = tabs.find((item) => item.type === "page" && item.webSocketDebuggerUrl) || tabs[0];
  if (!tab?.webSocketDebuggerUrl) throw new Error(`No WebView target on port ${port}`);
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  let nextId = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const onMessage = (payload) => {
        const message = JSON.parse(payload);
        if (message.id !== id) return;
        ws.off("message", onMessage);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      };
      ws.on("message", onMessage);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  await send("Runtime.enable");
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  ws.close();
  if (result?.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "CDP evaluation failed");
  }
  return result?.result?.value;
}

async function pageSnapshot(port) {
  const raw = await cdpEval(port, `JSON.stringify({
    text: document.body?.innerText || "",
    buttons: [...document.querySelectorAll("button")].map((button) => button.innerText || button.getAttribute("aria-label") || "").filter(Boolean),
    inputs: [...document.querySelectorAll("input")].map((input) => ({ label: input.getAttribute("aria-label") || "", placeholder: input.getAttribute("placeholder") || "", value: input.value || "" }))
  })`);
  return JSON.parse(raw);
}

async function waitFor(port, predicate, timeoutMs = 20000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await pageSnapshot(port);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for UI condition. Last text: ${(last?.text || "").slice(0, 500)}`);
}

async function clickText(port, text) {
  return cdpEval(port, `(() => {
    const needle = ${JSON.stringify(text)};
    const candidates = [...document.querySelectorAll("button,[role='button'],a")];
    const labels = (el) => [el.getAttribute("aria-label") || "", el.innerText || ""]
      .map((value) => value.replace(/\\s+/g, " ").trim())
      .filter(Boolean);
    const target = candidates.find((el) => labels(el).some((value) => value === needle))
      || candidates.find((el) => labels(el).some((value) => value.includes(needle)));
    if (!target) return false;
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
    return true;
  })()`);
}

async function setPairCode(port, value) {
  return cdpEval(port, `(() => {
    const input = document.querySelector('input[aria-label="페어링 코드 8자리"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
}

async function grantChildPermissions() {
  const permissions = [
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_BACKGROUND_LOCATION",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECORD_AUDIO",
  ];
  for (const permission of permissions) {
    try { adb(CHILD_SERIAL, ["shell", "pm", "grant", PACKAGE_NAME, permission]); } catch { /* runtime/runtime-policy dependent */ }
  }
  safeAdb(CHILD_SERIAL, ["shell", "appops", "set", PACKAGE_NAME, "RUN_ANY_IN_BACKGROUND", "allow"]);
  safeAdb(CHILD_SERIAL, ["shell", "appops", "set", PACKAGE_NAME, "START_FOREGROUND", "allow"]);
}

function randomPairCode() {
  return `KID-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

async function createFixture() {
  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const email = `device-parent-${cycle}-${suffix}@hyeni.test`;
  const password = `Hyeni-${crypto.randomBytes(8).toString("hex")}!1`;
  const parent = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "실기기부모", full_name: "실기기부모", provider: "kakao" },
    app_metadata: { provider: "kakao", providers: ["kakao"] },
  });
  if (parent.error) throw parent.error;

  const signed = await anon.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;

  const pairCode = randomPairCode();
  const family = await admin.from("families").insert({
    parent_id: parent.data.user.id,
    pair_code: pairCode,
    planned_child_count: 1,
    parent_name: "실기기부모",
    name: `실기기네-${cycle}`,
    mom_phone: "+821012345678",
  }).select("id, pair_code").single();
  if (family.error) throw family.error;

  const parentMember = await admin.from("family_members").insert({
    family_id: family.data.id,
    user_id: parent.data.user.id,
    role: "parent",
    name: "실기기부모",
  }).select("id").single();
  if (parentMember.error) throw parentMember.error;

  const childMember = await admin.from("family_members").insert({
    family_id: family.data.id,
    user_id: null,
    role: "child",
    name: "혜니",
    child_order: 1,
    color_hex: "#F779A8",
  }).select("id").single();
  if (childMember.error) throw childMember.error;

  return {
    parentUserId: parent.data.user.id,
    familyId: family.data.id,
    childMemberId: childMember.data.id,
    pairCode,
    parentSession: {
      ...signed.data.session,
      user: {
        ...signed.data.session.user,
        app_metadata: { provider: "kakao", providers: ["kakao"] },
        identities: [{ provider: "kakao", id: parent.data.user.id }],
      },
    },
  };
}

async function injectParentSession(session) {
  const key = `sb-${projectRef}-auth-token`;
  await cdpEval(PARENT_PORT, `(() => {
    localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(session))});
    localStorage.setItem("hyeni-my-role", "parent");
    sessionStorage.setItem("hyeni-my-role", "parent");
    location.reload();
    return true;
  })()`);
}

function pullSanitizedLog(serial, name) {
  const raw = adb(serial, ["logcat", "-d", "-v", "time"], { maxBuffer: 1024 * 1024 * 32 });
  const sanitized = raw
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[JWT_REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/access_token=[^\s&]+/g, "access_token=[REDACTED]")
    .replace(/refresh_token=[^\s&]+/g, "refresh_token=[REDACTED]");
  const path = join(logDir, `${cycle}-${name}-sanitized.log`);
  writeFileSync(path, sanitized);
  return path;
}

function hasAppOriginCriticalLog(raw, appPid) {
  const critical = /FATAL EXCEPTION|React runtime error|Capacitor bridge error|unhandled rejection|\bANR\b|permission crash/i;
  const pidToken = appPid ? `(${String(appPid).padStart(5, " ")})` : "";
  return raw.split(/\r?\n/).some((line) => {
    if (!critical.test(line)) return false;
    return (pidToken && line.includes(pidToken)) || line.includes(PACKAGE_NAME);
  });
}

async function main() {
  adb(PARENT_SERIAL, ["shell", "pm", "clear", PACKAGE_NAME]);
  adb(CHILD_SERIAL, ["shell", "pm", "clear", PACKAGE_NAME]);
  adb(PARENT_SERIAL, ["logcat", "-c"]);
  adb(CHILD_SERIAL, ["logcat", "-c"]);

  const fixture = await createFixture();
  const parentPid = startAndForward(PARENT_SERIAL, PARENT_PORT);
  const childPid = startAndForward(CHILD_SERIAL, CHILD_PORT);
  const evidence = {
    cycle,
    devices: {
      parent: `${PARENT_SERIAL.slice(0, 4)}***${PARENT_SERIAL.slice(-3)}`,
      child: `${CHILD_SERIAL.slice(0, 4)}***${CHILD_SERIAL.slice(-3)}`,
    },
    parentPid,
    childPid,
    familyIdPrefix: fixture.familyId.slice(0, 8),
    pairCode: fixture.pairCode,
    screenshots: {},
    checks: {},
  };

  evidence.screenshots.parentRoleGate = screencap(PARENT_SERIAL, "parent-00-role-gate");
  evidence.screenshots.childRoleGate = screencap(CHILD_SERIAL, "child-00-role-gate");

  await injectParentSession(fixture.parentSession);
  await waitFor(PARENT_PORT, (snap) => snap.text.includes("학부모 모드") || snap.text.includes("아이 현황"), 25000);
  evidence.screenshots.parentBeforePair = screencap(PARENT_SERIAL, "parent-01-before-pair");

  await clickText(CHILD_PORT, "자녀로 시작");
  await clickText(CHILD_PORT, "다음");
  const pairInputSnap = await waitFor(CHILD_PORT, (snap) => snap.text.includes("부모님과") && snap.inputs.some((input) => input.label === "페어링 코드 8자리"), 25000);
  evidence.checks.childDidNotReturnToRoleGate = !pairInputSnap.text.includes("누구로 시작할까요?");
  evidence.checks.noPairPlaceholderOverlap = pairInputSnap.inputs.every((input) => input.label !== "페어링 코드 8자리" || input.placeholder === "");
  evidence.screenshots.childPairInput = screencap(CHILD_SERIAL, "child-01-pair-input");

  await setPairCode(CHILD_PORT, "BAD12345");
  await clickText(CHILD_PORT, "연결하기");
  await waitFor(CHILD_PORT, (snap) => snap.text.includes("잘못된 코드"), 15000);
  evidence.checks.wrongPairCodeShowsGuidance = true;

  await setPairCode(CHILD_PORT, fixture.pairCode.replace("KID-", ""));
  await clickText(CHILD_PORT, "연결하기");
  await waitFor(CHILD_PORT, (snap) => snap.text.includes("연결됐어요") || snap.text.includes("위치") || snap.text.includes("권한"), 30000);
  evidence.screenshots.childPairedOrPermission = screencap(CHILD_SERIAL, "child-02-paired-permission");

  await grantChildPermissions();
  for (const label of ["허용", "다음", "시작", "완료", "홈"]) {
    await clickText(CHILD_PORT, label).catch(() => false);
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  await cdpEval(CHILD_PORT, "location.reload(); true");
  await waitFor(CHILD_PORT, (snap) => snap.text.includes("혜니") && !snap.text.includes("누구로 시작할까요?"), 30000);
  evidence.screenshots.childHome = screencap(CHILD_SERIAL, "child-03-home");

  await cdpEval(PARENT_PORT, "location.reload(); true");
  await waitFor(PARENT_PORT, (snap) => snap.text.includes("혜니") && !snap.text.includes("누구로 시작할까요?"), 30000);
  evidence.screenshots.parentHome = screencap(PARENT_SERIAL, "parent-02-home");

  const childService = safeAdb(CHILD_SERIAL, ["shell", "dumpsys", "activity", "services", PACKAGE_NAME]);
  evidence.checks.childLocationServiceForeground = /LocationService/.test(childService) && /isForeground=true|foregroundId=9001/.test(childService);

  await clickText(PARENT_PORT, "혜니").catch(() => false);
  await clickText(PARENT_PORT, "우리아이").catch(() => false);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const trackerSnap = await pageSnapshot(PARENT_PORT);
  evidence.checks.parentTrackerOpened = trackerSnap.text.includes("현재 위치") || trackerSnap.text.includes("실시간") || trackerSnap.text.includes("마지막 저장 위치");
  evidence.screenshots.parentTracker = screencap(PARENT_SERIAL, "parent-03-tracker");

  const childMember = await admin
    .from("family_members")
    .select("id, user_id, role, name")
    .eq("id", fixture.childMemberId)
    .single();
  if (childMember.error) throw childMember.error;
  evidence.checks.childPairPersistedInDb = !!childMember.data?.user_id;

  evidence.logs = {
    parent: pullSanitizedLog(PARENT_SERIAL, "parent"),
    child: pullSanitizedLog(CHILD_SERIAL, "child"),
  };

  const parentCritical = hasAppOriginCriticalLog(
    adb(PARENT_SERIAL, ["logcat", "-d", "-v", "time"], { maxBuffer: 1024 * 1024 * 8 }),
    parentPid
  );
  const childCritical = hasAppOriginCriticalLog(
    adb(CHILD_SERIAL, ["logcat", "-d", "-v", "time"], { maxBuffer: 1024 * 1024 * 8 }),
    childPid
  );
  evidence.checks.noAppCriticalLogPattern = !parentCritical && !childCritical;

  const path = join(rootDir, ".reports", "final-device-qa", `${cycle}-evidence.json`);
  writeFileSync(path, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({
    cycle: evidence.cycle,
    familyIdPrefix: evidence.familyIdPrefix,
    pairCode: evidence.pairCode,
    checks: evidence.checks,
    evidencePath: path,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
