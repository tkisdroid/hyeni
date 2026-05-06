import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";

describe("android UI smoke summary script", () => {
  test("summarizes package visibility without copying raw XML", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "hyeni-ui-smoke-"));
    const prefix = "2026-05-05T00-00-android-ui-smoke-";

    try {
      writeFileSync(join(outputDir, `${prefix}R5APP.xml`), [
        '<hierarchy rotation="0">',
        '  <node package="com.hyeni.calendar" text="혜니캘린더" />',
        '  <node package="android" text="" />',
        "</hierarchy>",
      ].join("\n"), "utf8");
      writeFileSync(join(outputDir, `${prefix}R5APP.png`), "png-bytes", "ascii");

      writeFileSync(join(outputDir, `${prefix}LOCKED.xml`), [
        '<hierarchy rotation="0">',
        '  <node package="com.android.systemui" text="알림" />',
        "</hierarchy>",
      ].join("\n"), "utf8");
      writeFileSync(join(outputDir, `${prefix}LOCKED.png`), "png-bytes", "ascii");

      execFileSync("node", [
        "scripts/summarize-android-ui-smoke.mjs",
        "--output-dir",
        outputDir,
        "--prefix",
        prefix,
        "--app-package",
        "com.hyeni.calendar",
      ], { encoding: "utf8" });

      const json = JSON.parse(readFileSync(join(outputDir, "android-ui-smoke-summary-2026-05-05T00-00.json"), "utf8"));
      const markdown = readFileSync(join(outputDir, "android-ui-smoke-summary-2026-05-05T00-00.md"), "utf8");

      expect(json.appPackage).toBe("com.hyeni.calendar");
      expect(json.devices).toHaveLength(2);
      expect(json.devices.find((device) => device.serial === "R5APP")).toMatchObject({
        appVisible: true,
        blockedBySystemUi: false,
        packages: ["android", "com.hyeni.calendar"],
      });
      expect(json.devices.find((device) => device.serial === "LOCKED")).toMatchObject({
        appVisible: false,
        blockedBySystemUi: true,
        packages: ["com.android.systemui"],
      });
      expect(JSON.stringify(json)).not.toContain("<hierarchy");
      expect(markdown).toContain("android-ui-smoke-summary");
      expect(markdown).toContain("LOCKED");
      expect(markdown).toContain("system UI");
      expect(markdown).not.toContain("<node");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
