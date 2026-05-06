#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = "output";
const DEFAULT_PARENT = "emulator-5554";
const DEFAULT_CHILD = "R5CY40EE6QE";

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValue(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] || fallback : fallback;
}

function commandName(name) {
  if (process.platform !== "win32") return name;
  if (name === "npm" || name === "npx") return `${name}.cmd`;
  return name;
}

function shouldUseShell(command) {
  return process.platform === "win32" && (command === "npm" || command === "npx" || /\.bat$/i.test(command) || /\.cmd$/i.test(command));
}

function renderPlan() {
  return [
    "# Supabase Recovery Verification Plan",
    "",
    "1. Run `node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000`.",
    "2. Continue only when the parsed result has `readyForAndroidSmoke=true`.",
    "3. Optional local gates: `npm run test`, `npm run verify`, `npm run build`, `npx cap sync android`, Android `assembleDebug`.",
    "4. Optional real browser gate: `npx playwright test --config=playwright.real.config.js`.",
    "5. Optional Android smoke: `node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE --readiness-timeout-ms 12000`.",
    "6. Optional Android matrix: `node scripts/android-remote-listen-matrix.mjs --require-two --parent emulator-5554 --child R5CY40EE6QE`.",
    "",
    "Execution flags:",
    "- `--execute-local-gates`",
    "- `--execute-real-playwright`",
    "- `--execute-android-smoke`",
    "- `--execute-android-matrix`",
    "- `--all`",
    "",
  ].join("\n");
}

function runCaptured(label, command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(commandName(command), args, {
    cwd: options.cwd || process.cwd(),
    encoding: "utf8",
    shell: shouldUseShell(command),
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return {
    label,
    command: [command, ...args].join(" "),
    cwd: options.cwd || process.cwd(),
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error?.message || "",
  };
}

function runInherited(label, command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(commandName(command), args, {
    cwd: options.cwd || process.cwd(),
    stdio: "inherit",
    shell: shouldUseShell(command),
  });
  return {
    label,
    command: [command, ...args].join(" "),
    cwd: options.cwd || process.cwd(),
    status: result.status,
    error: result.error?.message || "",
  };
}

function parseJsonFromOutput(text) {
  const generatedAtMarker = "{\n  \"generatedAt\"";
  const compactGeneratedAtMarker = "{\"generatedAt\"";
  let start = text.indexOf(generatedAtMarker);
  if (start < 0) start = text.indexOf(compactGeneratedAtMarker);
  if (start < 0) {
    const lastObjectLine = text.lastIndexOf("\n{");
    start = lastObjectLine >= 0 ? lastObjectLine + 1 : text.indexOf("{");
  }
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("healthcheck did not emit a JSON object");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function assertSuccess(step) {
  if (step.status !== 0) {
    throw new Error(`${step.label} failed with exit code ${step.status ?? "n/a"}`);
  }
}

function writeEvidence(evidence) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const stamp = evidence.startedAt.replaceAll(":", "-").replaceAll(".", "-");
  const path = join(OUTPUT_DIR, `supabase-recovery-verification-${stamp}.json`);
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`);
  return path;
}

async function main() {
  if (hasFlag("--print-plan")) {
    console.log(renderPlan());
    return;
  }

  const timeoutMs = argValue("--timeout-ms", "12000");
  const parent = argValue("--parent", DEFAULT_PARENT);
  const child = argValue("--child", DEFAULT_CHILD);
  const all = hasFlag("--all");
  const executeLocal = all || hasFlag("--execute-local-gates");
  const executeRealPlaywright = all || hasFlag("--execute-real-playwright");
  const executeAndroidSmoke = all || hasFlag("--execute-android-smoke");
  const executeAndroidMatrix = all || hasFlag("--execute-android-matrix");
  const evidence = {
    startedAt: new Date().toISOString(),
    parent,
    child,
    steps: [],
  };

  try {
    const healthcheck = runCaptured("production healthcheck", "node", [
      "scripts/production-stabilization-healthcheck.mjs",
      "--timeout-ms",
      timeoutMs,
    ]);
    evidence.steps.push({
      label: healthcheck.label,
      command: healthcheck.command,
      status: healthcheck.status,
      error: healthcheck.error,
    });

    const healthcheckJson = parseJsonFromOutput(`${healthcheck.stdout}\n${healthcheck.stderr}`);
    evidence.healthcheck = {
      readyForAndroidSmoke: healthcheckJson.readyForAndroidSmoke,
      boundary: healthcheckJson.diagnosticSummary?.boundary || "",
      output: healthcheckJson.output || null,
    };

    if (healthcheck.status !== 0 || healthcheckJson.readyForAndroidSmoke !== true) {
      throw new Error("Supabase is not ready: readyForAndroidSmoke is not true");
    }

    if (executeLocal) {
      for (const step of [
        runInherited("unit tests", "npm", ["run", "test"]),
        runInherited("verify", "npm", ["run", "verify"]),
        runInherited("build", "npm", ["run", "build"]),
        runInherited("capacitor sync", "npx", ["cap", "sync", "android"]),
        runInherited("android assembleDebug", ".\\gradlew.bat", ["assembleDebug"], { cwd: "android" }),
      ]) {
        evidence.steps.push(step);
        assertSuccess(step);
      }
    }

    if (executeRealPlaywright) {
      const step = runInherited("real Supabase Playwright", "npx", ["playwright", "test", "--config=playwright.real.config.js"]);
      evidence.steps.push(step);
      assertSuccess(step);
    }

    if (executeAndroidSmoke) {
      const step = runInherited("Android remote-listen smoke", "node", [
        "scripts/android-remote-listen-parent-ui-smoke.mjs",
        "--parent",
        parent,
        "--child",
        child,
        "--readiness-timeout-ms",
        timeoutMs,
      ]);
      evidence.steps.push(step);
      assertSuccess(step);
    }

    if (executeAndroidMatrix) {
      const step = runInherited("Android remote-listen matrix", "node", [
        "scripts/android-remote-listen-matrix.mjs",
        "--require-two",
        "--parent",
        parent,
        "--child",
        child,
      ]);
      evidence.steps.push(step);
      assertSuccess(step);
    }

    evidence.completedAt = new Date().toISOString();
    evidence.ok = true;
    const evidencePath = writeEvidence(evidence);
    console.log(`\nRecovery verification evidence: ${evidencePath}`);
  } catch (error) {
    evidence.completedAt = new Date().toISOString();
    evidence.ok = false;
    evidence.error = error?.message || String(error);
    const evidencePath = writeEvidence(evidence);
    console.error(`\nStopped: ${evidence.error}`);
    console.error(`Recovery verification evidence: ${evidencePath}`);
    process.exitCode = 1;
  }
}

main();
