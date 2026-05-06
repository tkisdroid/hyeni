#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PACKAGE_NAME = "com.hyeni.calendar";
const DEFAULT_OUT_DIR = "output";

function parseArgs(argv) {
  const out = {
    parent: "",
    child: "",
    outDir: DEFAULT_OUT_DIR,
    scenario: "current",
    requiresTwoDevices: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--parent") out.parent = argv[++i] || "";
    else if (arg === "--child") out.child = argv[++i] || "";
    else if (arg === "--out") out.outDir = argv[++i] || DEFAULT_OUT_DIR;
    else if (arg === "--scenario") out.scenario = argv[++i] || "current";
    else if (arg === "--require-two") out.requiresTwoDevices = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/android-remote-listen-matrix.mjs [--require-two] [--parent SERIAL] [--child SERIAL] [--scenario NAME] [--out DIR]

Collects Android evidence for the remote_listen matrix:
- permissions: RECORD_AUDIO, POST_NOTIFICATIONS, FOREGROUND_SERVICE_MICROPHONE, ACCESS_NETWORK_STATE
- notification channel importance, notification_policy_access, zen_mode, ringer_mode with dumpsys audio fallback
- lock/screen evidence including mDreamingLockscreen and device_state fold support
- networkConnected / validated connectivity evidence and package networking deny state
- batteryOptimization state
- AmbientListenService and recent remote_listen logs

This script does not fake a two-device test. With fewer than two Android
targets it writes a BLOCKED report that can be attached to the verification log.`);
}

function scenarioSlug(value) {
  const slug = String(value || "current")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "current";
}

function run(cmd, args = [], options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeoutMs || 20_000,
  });
  return {
    command: [cmd, ...args].join(" "),
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? String(result.error.message || result.error) : "",
  };
}

function adb(args, options) {
  return run("adb", args, options);
}

function adbShell(serial, shellArgs, options) {
  return adb(["-s", serial, "shell", ...shellArgs], options);
}

function listDevices() {
  // Keep this exact command text discoverable for the static regression test:
  // adb devices -l
  const result = adb(["devices", "-l"]);
  const devices = result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /\bdevice\b/.test(line))
    .map((line) => {
      const [serial] = line.split(/\s+/);
      const model = line.match(/\bmodel:([^\s]+)/)?.[1] || "";
      const product = line.match(/\bproduct:([^\s]+)/)?.[1] || "";
      return { serial, model, product, raw: line };
    });
  return { result, devices };
}

function contains(text, pattern) {
  return String(text || "").toLowerCase().includes(String(pattern || "").toLowerCase());
}

function readSetting(serial, namespace, key) {
  return adbShell(serial, ["settings", "get", namespace, key]).stdout.trim();
}

function parseAudioRingerMode(text) {
  const internalMatch = String(text || "").match(/Ringer mode:\s*[\r\n]+?\s*-\s*mode \(internal\)\s*=\s*([A-Z_]+)/i);
  if (internalMatch?.[1]) return internalMatch[1].toUpperCase();
  const inlineMatch = String(text || "").match(/Ringer mode:\s*([A-Z_]+)/i);
  return inlineMatch?.[1] ? inlineMatch[1].toUpperCase() : "";
}

function parseNotificationChannels(text, channelIds) {
  const source = String(text || "");
  return channelIds.map((id) => {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(new RegExp(`NotificationChannel\\{mId='${escapedId}'[^\\r\\n]*`, "i"));
    const line = match?.[0] || "";
    const importance = line.match(/mImportance=([0-9]+)/)?.[1] || "";
    const deleted = line.match(/mDeleted=([a-z]+)/i)?.[1] || "";
    const userLockedFields = line.match(/mUserLockedFields=([0-9]+)/)?.[1] || "";
    const parsedImportance = importance ? Number(importance) : null;
    const parsedDeleted = deleted ? deleted.toLowerCase() === "true" : null;
    return {
      id,
      present: Boolean(line),
      importance: parsedImportance,
      deleted: parsedDeleted,
      blocked: Boolean(line) && (parsedImportance === 0 || parsedDeleted === true),
      userLockedFields: userLockedFields ? Number(userLockedFields) : null,
    };
  });
}

function parseConnectivityValue(text, key) {
  const value = String(text || "").trim();
  const prefix = `${key}:`;
  return value.startsWith(prefix) ? value.slice(prefix.length).trim() : value;
}

function parseDeviceStatesSimple(text) {
  return String(text || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectDevice(serial, role) {
  const packageDump = adbShell(serial, ["dumpsys", "package", PACKAGE_NAME], { timeoutMs: 30_000 });
  const windowDump = adbShell(serial, ["dumpsys", "window"], { timeoutMs: 30_000 });
  const connectivityDump = adbShell(serial, ["dumpsys", "connectivity"], { timeoutMs: 30_000 });
  const deviceIdleDump = adbShell(serial, ["dumpsys", "deviceidle"], { timeoutMs: 30_000 });
  const audioDump = adbShell(serial, ["dumpsys", "audio"], { timeoutMs: 30_000 });
  const notificationDump = adbShell(serial, ["dumpsys", "notification", "--noredact"], { timeoutMs: 30_000 });
  const chain3Dump = adbShell(serial, ["cmd", "connectivity", "get-chain3-enabled"]);
  const packageNetworkingDump = adbShell(serial, ["cmd", "connectivity", "get-package-networking-enabled", PACKAGE_NAME]);
  const deviceStateDump = adbShell(serial, ["dumpsys", "device_state"], { timeoutMs: 30_000 });
  const deviceStateCurrentDump = adbShell(serial, ["cmd", "device_state", "print-state"]);
  const deviceStateSupportedDump = adbShell(serial, ["cmd", "device_state", "print-states-simple"]);
  const ambientServiceDump = adbShell(serial, ["dumpsys", "activity", "services", `${PACKAGE_NAME}/.AmbientListenService`], { timeoutMs: 30_000 });
  const recordAudioAppOp = adbShell(serial, ["appops", "get", PACKAGE_NAME, "RECORD_AUDIO"]);
  const postNotificationAppOp = adbShell(serial, ["appops", "get", PACKAGE_NAME, "POST_NOTIFICATION"]);
  const logcat = adb(["-s", serial, "logcat", "-d", "-t", "700"], { timeoutMs: 30_000 });

  const remoteLogLines = logcat.stdout
    .split(/\r?\n/)
    .filter((line) => /remote_listen|RemoteListen|AmbientListenService|FCMService/i.test(line))
    .slice(-120);

  const notificationPolicyAccess = readSetting(serial, "secure", "enabled_notification_policy_access_packages");
  const zenMode = readSetting(serial, "global", "zen_mode");
  const settingsRingerMode = readSetting(serial, "system", "mode_ringer");
  const audioRingerMode = parseAudioRingerMode(audioDump.stdout);
  const hasSettingsRingerMode = Boolean(settingsRingerMode && settingsRingerMode !== "null");
  const ringerMode = hasSettingsRingerMode ? settingsRingerMode : audioRingerMode;
  const ringerModeSource = hasSettingsRingerMode ? "settings.system.mode_ringer" : (audioRingerMode ? "dumpsys.audio" : "unavailable");
  const packageText = packageDump.stdout;
  const windowText = windowDump.stdout;
  const connectivityText = connectivityDump.stdout;
  const deviceIdleText = deviceIdleDump.stdout;
  const deviceStateText = deviceStateDump.stdout;
  const notificationText = notificationDump.stdout;
  const ambientServiceText = ambientServiceDump.stdout;

  const requestedPermissions = {
    RECORD_AUDIO: contains(packageText, "android.permission.RECORD_AUDIO"),
    POST_NOTIFICATIONS: contains(packageText, "android.permission.POST_NOTIFICATIONS"),
    FOREGROUND_SERVICE_MICROPHONE: contains(packageText, "android.permission.FOREGROUND_SERVICE_MICROPHONE"),
    ACCESS_NETWORK_STATE: contains(packageText, "android.permission.ACCESS_NETWORK_STATE"),
  };

  const grantedPermissions = {
    RECORD_AUDIO: /android\.permission\.RECORD_AUDIO:\s+granted=true/i.test(packageText),
    POST_NOTIFICATIONS: /android\.permission\.POST_NOTIFICATIONS:\s+granted=true/i.test(packageText),
    FOREGROUND_SERVICE_MICROPHONE: /android\.permission\.FOREGROUND_SERVICE_MICROPHONE:\s+granted=true/i.test(packageText),
    ACCESS_NETWORK_STATE: /android\.permission\.ACCESS_NETWORK_STATE:\s+granted=true/i.test(packageText),
  };

  const screen = {
    currentFocus: windowText.match(/mCurrentFocus=([^\r\n]+)/)?.[1]?.trim() || "",
    focusedApp: windowText.match(/mFocusedApp=([^\r\n]+)/)?.[1]?.trim() || "",
    mDreamingLockscreen: /mDreamingLockscreen=true/i.test(windowText),
    mAwake: /mAwake=true/i.test(windowText),
    mScreenOnFully: /mScreenOnFully=true/i.test(windowText),
  };
  const deviceState = {
    current: (deviceStateCurrentDump.stdout || deviceStateCurrentDump.stderr).trim(),
    supported: parseDeviceStatesSimple(deviceStateSupportedDump.stdout || deviceStateSupportedDump.stderr),
    supportedStateNames: (deviceStateText.match(/name='([^']+)'/g) || []).map((item) => item.replace(/^name='/, "").replace(/'$/, "")),
    mIsLidOpen: deviceStateText.match(/mIsLidOpen\s*=\s*([^\r\n]+)/)?.[1]?.trim() || "",
    supportsFoldStates: /fold|half|closed|opened/i.test((deviceStateText.match(/name='([^']+)'/g) || []).join("\n")),
  };

  const networkConnected = /CONNECTED|NetworkAgentInfo|VALIDATED/i.test(connectivityText);
  const networkValidated = /VALIDATED/i.test(connectivityText);
  const packageNetworking = {
    chain3Enabled: parseConnectivityValue(chain3Dump.stdout || chain3Dump.stderr, "chain") === "enabled",
    packageAllowed: parseConnectivityValue(packageNetworkingDump.stdout || packageNetworkingDump.stderr, PACKAGE_NAME) === "allow",
    rawChain3: (chain3Dump.stdout || chain3Dump.stderr).trim(),
    rawPackage: (packageNetworkingDump.stdout || packageNetworkingDump.stderr).trim(),
  };
  const batteryOptimization = {
    rawContainsPackage: contains(deviceIdleText, PACKAGE_NAME),
    probablyWhitelisted: new RegExp(`(?:except-idle|user|system).*${PACKAGE_NAME}`, "i").test(deviceIdleText),
  };

  const ambientService = {
    running: contains(ambientServiceText, "AmbientListenService") && !contains(ambientServiceText, "nothing"),
    rawTail: ambientServiceText.split(/\r?\n/).slice(-80),
  };
  const remoteListenChannels = parseNotificationChannels(notificationText, [
    "hyeni_remote_listen_v2",
    "hyeni_remote_listen",
    "ambient_listen_fgs",
  ]);

  return {
    role,
    serial,
    model: adbShell(serial, ["getprop", "ro.product.model"]).stdout.trim(),
    manufacturer: adbShell(serial, ["getprop", "ro.product.manufacturer"]).stdout.trim(),
    sdk: adbShell(serial, ["getprop", "ro.build.version.sdk"]).stdout.trim(),
    androidRelease: adbShell(serial, ["getprop", "ro.build.version.release"]).stdout.trim(),
    packageVersionName: packageText.match(/versionName=([^\s]+)/)?.[1] || "",
    lastUpdateTime: packageText.match(/lastUpdateTime=([^\r\n]+)/)?.[1]?.trim() || "",
    requestedPermissions,
    grantedPermissions,
    appOps: {
      RECORD_AUDIO: recordAudioAppOp.stdout.trim() || recordAudioAppOp.stderr.trim(),
      POST_NOTIFICATIONS: postNotificationAppOp.stdout.trim() || postNotificationAppOp.stderr.trim(),
    },
    notification_policy_access: notificationPolicyAccess,
    remoteListenChannels,
    zen_mode: zenMode,
    ringer_mode: ringerMode,
    ringer_mode_source: ringerModeSource,
    screen,
    deviceState,
    networkConnected,
    networkValidated,
    packageNetworking,
    batteryOptimization,
    ambientService,
    remote_listen_log_tail: remoteLogLines,
    commandStatus: {
      packageDump: packageDump.status,
      windowDump: windowDump.status,
      connectivityDump: connectivityDump.status,
      deviceIdleDump: deviceIdleDump.status,
      audioDump: audioDump.status,
      notificationDump: notificationDump.status,
      chain3Dump: chain3Dump.status,
      packageNetworkingDump: packageNetworkingDump.status,
      deviceStateDump: deviceStateDump.status,
      deviceStateCurrentDump: deviceStateCurrentDump.status,
      deviceStateSupportedDump: deviceStateSupportedDump.status,
      ambientServiceDump: ambientServiceDump.status,
    },
  };
}

function makeMarkdown(report) {
  const lines = [];
  lines.push("# Android Remote Listen Matrix Evidence");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Scenario: ${report.scenario}`);
  lines.push(`Requires two devices: ${report.requiresTwoDevices ? "yes" : "no"}`);
  lines.push(`Status: ${report.status}`);
  if (report.blocker) lines.push(`Blocker: ${report.blocker}`);
  lines.push("");
  lines.push("## Devices");
  for (const device of report.devices) {
    lines.push("");
    lines.push(`### ${device.role}: ${device.serial}`);
    lines.push(`- Model: ${device.manufacturer} ${device.model} / Android ${device.androidRelease} SDK ${device.sdk}`);
    lines.push(`- App: versionName ${device.packageVersionName}, updated ${device.lastUpdateTime}`);
    lines.push(`- RECORD_AUDIO: requested=${device.requestedPermissions.RECORD_AUDIO}, granted=${device.grantedPermissions.RECORD_AUDIO}, appop=${device.appOps.RECORD_AUDIO || "n/a"}`);
    lines.push(`- POST_NOTIFICATIONS: requested=${device.requestedPermissions.POST_NOTIFICATIONS}, granted=${device.grantedPermissions.POST_NOTIFICATIONS}, appop=${device.appOps.POST_NOTIFICATIONS || "n/a"}`);
    lines.push(`- FOREGROUND_SERVICE_MICROPHONE: requested=${device.requestedPermissions.FOREGROUND_SERVICE_MICROPHONE}, granted=${device.grantedPermissions.FOREGROUND_SERVICE_MICROPHONE}`);
    lines.push(`- ACCESS_NETWORK_STATE: requested=${device.requestedPermissions.ACCESS_NETWORK_STATE}, granted=${device.grantedPermissions.ACCESS_NETWORK_STATE}`);
    lines.push(`- notification_policy_access: ${device.notification_policy_access || "n/a"}`);
    lines.push(`- remote listen channels: ${device.remoteListenChannels.map((channel) => `${channel.id}=present:${channel.present},importance:${channel.importance ?? "n/a"},blocked:${channel.blocked},deleted:${channel.deleted ?? "n/a"}`).join("; ")}`);
    lines.push(`- zen_mode: ${device.zen_mode || "n/a"}`);
    lines.push(`- ringer_mode: ${device.ringer_mode || "n/a"} (${device.ringer_mode_source || "unknown"})`);
    lines.push(`- screen: awake=${device.screen.mAwake}, onFully=${device.screen.mScreenOnFully}, mDreamingLockscreen=${device.screen.mDreamingLockscreen}`);
    lines.push(`- deviceState: current=${device.deviceState.current || "n/a"}, supported=${device.deviceState.supported.join(",") || "n/a"}, names=${device.deviceState.supportedStateNames.join(",") || "n/a"}, mIsLidOpen=${device.deviceState.mIsLidOpen || "n/a"}, supportsFoldStates=${device.deviceState.supportsFoldStates}`);
    lines.push(`- networkConnected: ${device.networkConnected}, networkValidated: ${device.networkValidated}`);
    lines.push(`- packageNetworking: chain3Enabled=${device.packageNetworking.chain3Enabled}, packageAllowed=${device.packageNetworking.packageAllowed}, raw=${device.packageNetworking.rawPackage || "n/a"}`);
    lines.push(`- batteryOptimization: packageListed=${device.batteryOptimization.rawContainsPackage}, probablyWhitelisted=${device.batteryOptimization.probablyWhitelisted}`);
    lines.push(`- AmbientListenService running: ${device.ambientService.running}`);
    lines.push(`- remote_listen log lines: ${device.remote_listen_log_tail.length}`);
  }
  lines.push("");
  lines.push("## Required Manual Matrix");
  lines.push("- normal permissions");
  lines.push("- microphone permission denied");
  lines.push("- notification permission denied or remote-listen channel disabled");
  lines.push("- device locked / screen off / app background");
  lines.push("- silent mode and DND mode");
  lines.push("- foldable closed or possibly folded");
  lines.push("- unstable/offline network");
  lines.push("- battery optimization not exempted");
  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { result, devices: listedDevices } = listDevices();
  const selectedSerials = [args.parent, args.child].filter(Boolean);
  const devicesToCollect = (selectedSerials.length ? selectedSerials : listedDevices.map((d) => d.serial))
    .filter((serial, index, arr) => serial && arr.indexOf(serial) === index);

  const report = {
    generatedAt: new Date().toISOString(),
    scenario: args.scenario,
    scenarioSlug: scenarioSlug(args.scenario),
    requiresTwoDevices: args.requiresTwoDevices,
    adbDevicesCommand: result.command,
    adbDevicesStatus: result.status,
    adbDevicesRaw: result.stdout || result.stderr || result.error,
    status: "ok",
    blocker: "",
    devices: [],
  };

  if (args.requiresTwoDevices && devicesToCollect.length < 2) {
    report.status = "blocked";
    report.blocker = `remote listen parent/child matrix requires at least 2 Android targets, but ${devicesToCollect.length} is connected`;
  }

  for (const serial of devicesToCollect) {
    const role = serial === args.parent ? "parent" : (serial === args.child ? "child" : `device-${report.devices.length + 1}`);
    report.devices.push(collectDevice(serial, role));
  }

  mkdirSync(args.outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const scenarioPart = report.scenarioSlug === "current" ? "" : `-${report.scenarioSlug}`;
  const jsonPath = resolve(join(args.outDir, `remote-listen-matrix-${stamp}${scenarioPart}.json`));
  const mdPath = resolve(join(args.outDir, `remote-listen-matrix-${stamp}${scenarioPart}.md`));
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(mdPath, makeMarkdown(report), "utf8");
  console.log(JSON.stringify({ status: report.status, blocker: report.blocker, scenario: report.scenario, jsonPath, mdPath, devices: report.devices.length }, null, 2));

  if (report.status === "blocked") {
    process.exitCode = 2;
  }
}

main();
