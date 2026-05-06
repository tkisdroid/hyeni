#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const DEFAULT_OUTPUT_DIR = "output";
const DEFAULT_APP_PACKAGE = "com.hyeni.calendar";
const UI_SMOKE_MARKER = "-android-ui-smoke-";

function parseArgs(argv) {
  const args = {
    outputDir: DEFAULT_OUTPUT_DIR,
    prefix: null,
    appPackage: DEFAULT_APP_PACKAGE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--output-dir") {
      if (!next) throw new Error("--output-dir requires a value");
      args.outputDir = next;
      index += 1;
    } else if (arg === "--prefix") {
      if (!next) throw new Error("--prefix requires a value");
      args.prefix = next;
      index += 1;
    } else if (arg === "--app-package") {
      if (!next) throw new Error("--app-package requires a value");
      args.appPackage = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log([
    "Usage: node scripts/summarize-android-ui-smoke.mjs [options]",
    "",
    "Options:",
    "  --output-dir <path>   Directory containing android-ui-smoke PNG/XML files. Default: output",
    "  --prefix <prefix>     Capture prefix, for example 2026-05-05T00-00-android-ui-smoke-",
    "  --app-package <pkg>   App package expected in UI XML. Default: com.hyeni.calendar",
  ].join("\n"));
}

function latestSmokePrefix(outputDir) {
  const prefixes = readdirSync(outputDir)
    .map((name) => {
      const markerIndex = name.indexOf(UI_SMOKE_MARKER);
      if (markerIndex <= 0 || !name.endsWith(".xml")) return null;
      return name.slice(0, markerIndex + UI_SMOKE_MARKER.length);
    })
    .filter(Boolean)
    .sort();

  if (prefixes.length === 0) {
    throw new Error(`Missing android UI smoke XML files in ${outputDir}`);
  }

  return prefixes.at(-1);
}

function summaryStamp(prefix) {
  if (prefix.endsWith(UI_SMOKE_MARKER)) {
    return prefix.slice(0, -UI_SMOKE_MARKER.length);
  }
  return prefix.replace(/-+$/, "");
}

function packageList(xml) {
  const packages = new Set();
  const matcher = /package="([^"]+)"/g;
  let match = matcher.exec(xml);
  while (match) {
    if (match[1]) packages.add(match[1]);
    match = matcher.exec(xml);
  }
  return [...packages].sort();
}

function fileBytes(path) {
  return existsSync(path) ? statSync(path).size : 0;
}

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function summarizeDevice({ outputDir, fileName, prefix, appPackage }) {
  const xmlPath = join(outputDir, fileName);
  const baseName = fileName.slice(0, -".xml".length);
  const screenshotPath = join(outputDir, `${baseName}.png`);
  const serial = fileName.slice(prefix.length, -".xml".length);
  const xml = readFileSync(xmlPath, "utf8");
  const packages = packageList(xml);
  const appVisible = packages.includes(appPackage);
  const blockedBySystemUi = !appVisible && packages.includes("com.android.systemui");

  let note = "App package is not visible in the UI hierarchy.";
  if (appVisible) {
    note = "App package is visible in the UI hierarchy.";
  } else if (blockedBySystemUi) {
    note = "App package is not visible because system UI appears to be covering the capture.";
  }

  return {
    serial,
    xmlPath: normalizePath(xmlPath),
    screenshotPath: existsSync(screenshotPath) ? normalizePath(screenshotPath) : null,
    xmlBytes: fileBytes(xmlPath),
    screenshotBytes: fileBytes(screenshotPath),
    packages,
    appVisible,
    blockedBySystemUi,
    note,
  };
}

function buildSummary({ outputDir, prefix, appPackage }) {
  const files = readdirSync(outputDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".xml"))
    .sort();

  if (files.length === 0) {
    throw new Error(`Missing android UI smoke XML files matching ${prefix}*.xml in ${outputDir}`);
  }

  const devices = files.map((fileName) => summarizeDevice({ outputDir, fileName, prefix, appPackage }));

  return {
    generatedAt: new Date().toISOString(),
    outputDir: normalizePath(resolve(outputDir)),
    prefix,
    appPackage,
    deviceCount: devices.length,
    appVisibleCount: devices.filter((device) => device.appVisible).length,
    systemUiBlockedCount: devices.filter((device) => device.blockedBySystemUi).length,
    devices,
  };
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function renderMarkdown(summary) {
  const rows = summary.devices.map((device) => [
    device.serial,
    device.appVisible ? "yes" : "no",
    device.blockedBySystemUi ? "yes" : "no",
    device.packages.join(", "),
    device.screenshotBytes,
    device.xmlBytes,
    device.note,
  ]);

  return [
    `# android-ui-smoke-summary ${summary.prefix}`,
    "",
    `- generatedAt: ${summary.generatedAt}`,
    `- appPackage: ${summary.appPackage}`,
    `- devices: ${summary.deviceCount}`,
    `- appVisibleCount: ${summary.appVisibleCount}`,
    `- systemUiBlockedCount: ${summary.systemUiBlockedCount}`,
    "",
    "| device | app visible | system UI blocked | visible packages | screenshot bytes | xml bytes | note |",
    "| --- | --- | --- | --- | ---: | ---: | --- |",
    ...rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`),
    "",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.outputDir, { recursive: true });

  const prefix = args.prefix || latestSmokePrefix(args.outputDir);
  const stamp = summaryStamp(prefix);
  const jsonPath = join(args.outputDir, `android-ui-smoke-summary-${stamp}.json`);
  const mdPath = join(args.outputDir, `android-ui-smoke-summary-${stamp}.md`);
  const summary = buildSummary({ outputDir: args.outputDir, prefix, appPackage: args.appPackage });

  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, renderMarkdown(summary), "utf8");

  console.log(JSON.stringify({
    jsonPath: normalizePath(jsonPath),
    mdPath: normalizePath(mdPath),
    deviceCount: summary.deviceCount,
    appVisibleCount: summary.appVisibleCount,
    systemUiBlockedCount: summary.systemUiBlockedCount,
  }, null, 2));
}

main();
