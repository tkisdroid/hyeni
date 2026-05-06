#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const OUTPUT_DIR = "output";
const HEALTHCHECK_PREFIX = "production-stabilization-healthcheck-";
const RECOVERY_PREFIX = "supabase-recovery-verification-";
const STATUS_PREFIX = "supabase-status-summary-";
const REMOTE_LISTEN_READINESS_PREFIX = "android-parent-ui-remote-listen-readiness-";
const REMOTE_LISTEN_MATRIX_PREFIX = "remote-listen-matrix-";
const MANIFEST_PATH = "support-bundle-manifest.json";
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;

function latestOutputFile(prefix, suffix) {
  const matches = readdirSync(OUTPUT_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort();
  if (matches.length === 0) {
    throw new Error(`Missing support evidence file matching ${OUTPUT_DIR}/${prefix}*${suffix}`);
  }
  return join(OUTPUT_DIR, matches.at(-1));
}

function outputStamp(path, prefix, suffix) {
  const name = basename(path);
  return name.slice(prefix.length, name.length - suffix.length);
}

const LATEST_HEALTHCHECK_JSON = latestOutputFile(HEALTHCHECK_PREFIX, ".json");
const LATEST_HEALTHCHECK_MD = latestOutputFile(HEALTHCHECK_PREFIX, ".md");
const LATEST_RECOVERY_JSON = latestOutputFile(RECOVERY_PREFIX, ".json");
const LATEST_STATUS_JSON = latestOutputFile(STATUS_PREFIX, ".json");
const LATEST_REMOTE_LISTEN_READINESS_JSON = latestOutputFile(REMOTE_LISTEN_READINESS_PREFIX, ".json");
const LATEST_REMOTE_LISTEN_MATRIX_JSON = latestOutputFile(REMOTE_LISTEN_MATRIX_PREFIX, ".json");
const LATEST_REMOTE_LISTEN_MATRIX_MD = latestOutputFile(REMOTE_LISTEN_MATRIX_PREFIX, ".md");
const STAMP = outputStamp(LATEST_HEALTHCHECK_JSON, HEALTHCHECK_PREFIX, ".json");
const BUNDLE_BASENAME = `supabase-main-timeout-support-bundle-${STAMP}`;
const STAGE_DIR = join(OUTPUT_DIR, BUNDLE_BASENAME);
const ZIP_PATH = join(OUTPUT_DIR, `${BUNDLE_BASENAME}.zip`);
const SHA_PATH = `${ZIP_PATH}.sha256`;

const SUPPORT_FILES = [
  ".planning/SUPABASE_MAIN_TIMEOUT_SUPPORT_BRIEF.md",
  ".planning/PRODUCTION_STABILIZATION_AUDIT_CURRENT.md",
  ".planning/PRODUCTION_STABILIZATION_COMPLETION_CHECKLIST.md",
  ".planning/SUPABASE_RECOVERY_VERIFICATION_RUNBOOK.md",
  "package.json",
  "scripts/production-stabilization-healthcheck.mjs",
  "scripts/supabase-recovery-verification.mjs",
  "scripts/build-supabase-support-bundle.mjs",
  LATEST_HEALTHCHECK_JSON,
  LATEST_HEALTHCHECK_MD,
  LATEST_RECOVERY_JSON,
  LATEST_STATUS_JSON,
  LATEST_REMOTE_LISTEN_READINESS_JSON,
  LATEST_REMOTE_LISTEN_MATRIX_JSON,
  LATEST_REMOTE_LISTEN_MATRIX_MD,
];

function assertInsideOutput(path) {
  const root = resolve(OUTPUT_DIR);
  const target = resolve(path);
  if (target !== root && !target.startsWith(`${root}\\`) && !target.startsWith(`${root}/`)) {
    throw new Error(`Refusing to touch path outside output: ${path}`);
  }
}

function assertNoSecrets(path) {
  const text = readFileSync(path, "utf8");
  if (JWT_PATTERN.test(text)) {
    throw new Error(`Refusing to bundle possible JWT secret in ${path}`);
  }
}

function cleanPath(path) {
  if (!existsSync(path)) return;
  assertInsideOutput(path);
  rmSync(path, { recursive: true, force: true });
}

function copySupportFiles() {
  for (const file of SUPPORT_FILES) {
    if (!existsSync(file)) {
      throw new Error(`Missing support evidence file: ${file}`);
    }
    assertNoSecrets(file);
    const target = join(STAGE_DIR, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
  }
}

function fileSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function writeManifest() {
  const fileHashes = SUPPORT_FILES.map((file) => ({
    path: file.replaceAll("\\", "/"),
    sha256: fileSha256(file),
  }));
  const manifest = {
    generatedAt: new Date().toISOString(),
    bundleBaseName: BUNDLE_BASENAME,
    sourceFileCount: SUPPORT_FILES.length,
    bundleEntryCount: SUPPORT_FILES.length + 1,
    fileHashes,
  };
  writeFileSync(join(STAGE_DIR, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function compressBundle() {
  const command = [
    "$ErrorActionPreference='Stop';",
    `Compress-Archive -Path '${STAGE_DIR.replaceAll("'", "''")}\\*' -DestinationPath '${ZIP_PATH.replaceAll("'", "''")}' -Force`,
  ].join(" ");
  const result = spawnSync("powershell", ["-NoProfile", "-Command", command], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Compress-Archive failed: ${result.stderr || result.stdout}`);
  }
}

function writeHash() {
  const hash = createHash("sha256").update(readFileSync(ZIP_PATH)).digest("hex").toUpperCase();
  writeFileSync(SHA_PATH, `${hash}  ${basename(ZIP_PATH)}\n`, "ascii");
  return hash;
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  cleanPath(STAGE_DIR);
  cleanPath(ZIP_PATH);
  cleanPath(SHA_PATH);
  copySupportFiles();
  writeManifest();
  compressBundle();
  const hash = writeHash();
  cleanPath(STAGE_DIR);
  console.log(JSON.stringify({
    zipPath: ZIP_PATH,
    sha256Path: SHA_PATH,
    manifestPath: MANIFEST_PATH,
    sha256: hash,
    sourceFileCount: SUPPORT_FILES.length,
    bundleEntryCount: SUPPORT_FILES.length + 1,
  }, null, 2));
}

main();
