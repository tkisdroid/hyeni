import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const envPath = resolve(projectRoot, ".env");

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const envFromFile = parseEnv(readFileSync(envPath, "utf8"));

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...envFromFile,
  ...process.env,
};

let activeChild = null;

function spawnNpm(args) {
  activeChild = spawn(
    npmCommand,
    args,
    {
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    },
  );
  return activeChild;
}

function exitWith(code, signal) {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (activeChild && !activeChild.killed) {
      activeChild.kill(signal);
      return;
    }
    process.exit(0);
  });
}

const build = spawnNpm(["run", "build"]);
build.on("exit", (code, signal) => {
  if (code || signal) {
    exitWith(code, signal);
    return;
  }

  const preview = spawnNpm(["run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]);
  preview.on("exit", exitWith);
});
