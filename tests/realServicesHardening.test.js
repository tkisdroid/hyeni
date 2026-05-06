import { describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const familyInsertMigrationPath = "supabase/migrations/20260504010000_restrict_family_insert_to_parent_auth_providers.sql";
const familyInsertDownPath = "supabase/migrations/down/20260504010000_restrict_family_insert_to_parent_auth_providers.sql";
const productionFeatureInventoryPath = ".planning/PRODUCTION_FEATURE_INVENTORY_CURRENT.md";

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

describe("real services hardening", () => {
  test("families insert RLS only allows first-party parent auth providers", () => {
    const migration = readIfExists(familyInsertMigrationPath);
    const down = readIfExists(familyInsertDownPath);

    expect(existsSync(familyInsertMigrationPath)).toBe(true);
    expect(existsSync(familyInsertDownPath)).toBe(true);
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain("DROP POLICY IF EXISTS fam_ins ON public.families;");
    expect(migration).toContain("CREATE POLICY fam_ins");
    expect(migration).toContain("FOR INSERT");
    expect(migration).toContain("parent_id = (SELECT auth.uid())");
    expect(migration).toContain("auth.jwt()");
    expect(migration).toContain("'kakao'");
    expect(migration).toContain("'phone'");
    expect(migration).not.toContain("'email'");
    expect(migration).toContain("COMMIT;");

    expect(down).toContain("DROP POLICY IF EXISTS fam_ins ON public.families;");
    expect(down).toContain("parent_id = auth.uid()");
  });

  test("real Playwright server uses production preview assets for performance budgets", () => {
    const script = readFileSync("scripts/dev-playwright-real.mjs", "utf8");

    expect(script).toContain('"build"');
    expect(script).toContain('"preview"');
    expect(script).toContain("...envFromFile,\n  ...process.env");
    expect(script).not.toContain('["run", "dev"');
  });

  test("Android remote-listen smoke keeps explicit branch env over .env.local", () => {
    const script = readFileSync("scripts/android-remote-listen-parent-ui-smoke.mjs", "utf8");

    expect(script).toContain('loadEnv({ path: ".env" })');
    expect(script).toContain('loadEnv({ path: ".env.local" })');
    expect(script).not.toContain('loadEnv({ path: ".env.local", override: true })');
  });

  test("Android remote-listen smoke fails before touching devices when Supabase is not ready", () => {
    const script = readFileSync("scripts/android-remote-listen-parent-ui-smoke.mjs", "utf8");

    expect(script).toContain("assertSupabaseReadyForSmoke");
    expect(script).toContain("android-parent-ui-remote-listen-readiness");
    expect(script).toContain("--skip-readiness-check");
    expect(script).toContain("--readiness-timeout-ms");
    expect(script).toContain("auth-health");
    expect(script).toContain("rest-family-members-service");
    expect(script).toContain("push-notify-reachable");
    expect(script.indexOf("await assertSupabaseReadyForSmoke(ts)")).toBeLessThan(script.indexOf("const originalPrefsXml = readPrefs(childDevice)"));
  });

  test("Android remote-listen smoke taps parent controls by visible text", () => {
    const script = readFileSync("scripts/android-remote-listen-parent-ui-smoke.mjs", "utf8");

    expect(script).toContain('tapText(parentDevice, "주변소리", { scroll: true })');
    expect(script).toContain('tapText(parentDevice, "듣기 시작", { scroll: true })');
    expect(script).not.toContain("remoteListenTap = tapRelative(parentDevice");
    expect(script).not.toContain("startTap = tapRelative(parentDevice");
  });

  test("Android remote-listen smoke can explicitly exercise pending fallback", () => {
    const script = readFileSync("scripts/android-remote-listen-parent-ui-smoke.mjs", "utf8");

    expect(script).toContain("--start-child-service-for-pending-fallback");
    expect(script).toContain("startChildServiceForPendingFallback");
    expect(script).toContain("startLocationService(childDevice)");
  });

  test("Android remote-listen smoke syncs temporary child prefs into the native process", () => {
    const script = readFileSync("scripts/android-remote-listen-parent-ui-smoke.mjs", "utf8");

    expect(script).toContain("function startLocationServiceWithContext");
    expect(script).toContain('"--es",\n    "familyId"');
    expect(script).toContain('"--es",\n    "userId"');
    expect(script).toContain('"--es",\n    "accessToken"');
    const syncIndex = script.indexOf("startLocationServiceWithContext(childDevice, temp)");
    expect(syncIndex).toBeGreaterThan(script.indexOf("Child prefs did not retain temporary test context"));
    expect(script.indexOf("stopNativeServices(childDevice);", syncIndex)).toBeGreaterThan(syncIndex);
    expect(script.indexOf("killAppProcess(childDevice);", syncIndex)).toBeGreaterThan(syncIndex);
  });

  test("Android remote-listen smoke can exercise a manually opened child app in background", () => {
    const script = readFileSync("scripts/android-remote-listen-parent-ui-smoke.mjs", "utf8");

    expect(script).toContain("--child-background-only");
    expect(script).toContain("childBackgroundOnly");
    expect(script).toContain("async function backgroundChildApp");
    expect(script).toContain("await backgroundChildApp(childDevice)");
    expect(script).toContain('childMode: childBackgroundOnly ? "backgrounded" : "killed"');
    const backgroundIndex = script.indexOf("await backgroundChildApp(childDevice)");
    expect(script.indexOf("startLocationServiceWithContext(childDevice, temp);", backgroundIndex)).toBeGreaterThan(backgroundIndex);
  });

  test("production stabilization healthcheck gates Android smoke on real service readiness", () => {
    const script = readFileSync("scripts/production-stabilization-healthcheck.mjs", "utf8");

    expect(script).toContain("readyForAndroidSmoke");
    expect(script).toContain("auth-gateway-no-key");
    expect(script).toContain("rest-gateway-no-key");
    expect(script).toContain("auth-health");
    expect(script).toContain("rest-family-members-service");
    expect(script).toContain("push-notify-reachable");
    expect(script).toContain("realtime-gateway");
    expect(script).toContain("criticalProbeNames");
    expect(script).toContain("anonKeyMatchesUrl");
    expect(script).toContain("serviceKeyMatchesUrl");
    expect(script).toContain("diagnosticSummary");
    expect(script).toContain("failedCriticalProbes");
    expect(script).toContain("service-ready");
    expect(script).toContain("api-key-db-dependent-path-timeout");
    expect(script).toContain("operatorAction");
    expect(script).toContain("process.exitCode = 1");
    expect(script).not.toContain("console.log(anonKey");
    expect(script).not.toContain("console.log(serviceKey");
  });

  test("recovery verification runner prints the gated post-support sequence", () => {
    const scriptPath = "scripts/supabase-recovery-verification.mjs";

    expect(existsSync(scriptPath)).toBe(true);

    const output = execFileSync("node", [scriptPath, "--print-plan"], {
      encoding: "utf8",
    });
    const script = readFileSync(scriptPath, "utf8");

    expect(output).toContain("production-stabilization-healthcheck.mjs");
    expect(output).toContain("readyForAndroidSmoke=true");
    expect(output).toContain("npm run verify");
    expect(output).toContain("playwright.real.config.js");
    expect(output).toContain("android-remote-listen-parent-ui-smoke.mjs");
    expect(output).toContain("android-remote-listen-matrix.mjs");
    expect(script).toContain("function shouldUseShell");
    expect(script).toContain("shell: shouldUseShell(command)");
    expect(script).toContain('command === "npm" || command === "npx"');
    expect(script).toContain('"{\\n  \\"generatedAt\\""');
    expect(script).toContain('lastIndexOf("\\n{")');
  });

  test("package scripts expose recovery verification runner", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));

    expect(pkg.scripts["verify:recovery"]).toBe("node scripts/supabase-recovery-verification.mjs");
    expect(pkg.scripts["support:bundle"]).toBe("node scripts/build-supabase-support-bundle.mjs");
  });

  test("support bundle builder has an allowlist and secret guard", () => {
    const scriptPath = "scripts/build-supabase-support-bundle.mjs";

    expect(existsSync(scriptPath)).toBe(true);

    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("SUPPORT_FILES");
    expect(script).toContain("support-bundle-manifest.json");
    expect(script).toContain("fileHashes");
    expect(script).toContain("sourceFileCount");
    expect(script).toContain("bundleEntryCount");
    expect(script).toContain("SUPABASE_MAIN_TIMEOUT_SUPPORT_BRIEF.md");
    expect(script).toContain("SUPABASE_RECOVERY_VERIFICATION_RUNBOOK.md");
    expect(script).toContain("supabase-recovery-verification.mjs");
    expect(script).toContain("scripts/build-supabase-support-bundle.mjs");
    expect(script).toContain("function latestOutputFile");
    expect(script).toContain("production-stabilization-healthcheck-");
    expect(script).toContain("supabase-recovery-verification-");
    expect(script).toContain("android-parent-ui-remote-listen-readiness-");
    expect(script).toContain("remote-listen-matrix-");
    expect(script).toContain("assertNoSecrets");
    expect(script).toContain("JWT_PATTERN");
    expect(script).toContain("Compress-Archive");
    expect(script).toContain('createHash("sha256")');
    expect(script).not.toContain("Get-FileHash");

    const supportBrief = readFileSync(".planning/SUPABASE_MAIN_TIMEOUT_SUPPORT_BRIEF.md", "utf8");
    expect(supportBrief).not.toContain("Current SHA256");
    expect(supportBrief).toContain("sourceFileCount=15");
    expect(supportBrief).toContain("bundleEntryCount=16");
    expect(supportBrief).toContain("remote-listen-matrix-2026-05-04T23-45-27-574Z-locked-screen-off-channel-ok.md");
  });

  test("production feature inventory maps core goal requirements to evidence", () => {
    const inventory = readIfExists(productionFeatureInventoryPath);

    expect(existsSync(productionFeatureInventoryPath)).toBe(true);
    expect(inventory).toContain("기능별 인벤토리");
    expect(inventory).toContain("다자녀 선택/홈 대시보드");
    expect(inventory).toContain("캘린더 하루 이동경로 요약");
    expect(inventory).toContain("주위소리 듣기 부모 UI");
    expect(inventory).toContain("주위소리 듣기 자녀 Android");
    expect(inventory).toContain("프로필 이름/색상/사진 저장");
    expect(inventory).toContain("테마/아이콘/시각 상태");
    expect(inventory).toContain("DB/RLS/Realtime 인벤토리");
    expect(inventory).toContain("기능별 위험 목록");
    expect(inventory).toContain("검증 계획");
  });
});
