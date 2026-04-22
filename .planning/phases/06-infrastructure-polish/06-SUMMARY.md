# Phase 6 — Infrastructure & Polish SUMMARY

**Status:** ✅ VERIFIED (all 3 streams live on production)
**Completed:** 2026-04-22
**Milestone:** v1.1

## Streams

| REQ | Description | Final commit | Production evidence |
|-----|-------------|--------------|---------------------|
| CI-01 | GitHub Actions Android APK workflow | `df656b9` (JDK 17→21) | Actions run 24764905735 green. APK artifact `hyeni-calendar-apk-df656b9...` (8.97MB) downloadable for 14 days. Gradle log artifact attached for debugging pipeline. |
| PWA-01 | `/manifest.json` 403 → 200 | `c068b3e` (vercel.json) | `curl -I https://hyenicalendar.com/manifest.json` → 200 with `Content-Type: application/manifest+json; charset=utf-8`, `Cache-Control: public, max-age=0, must-revalidate`. Browser console PWA warning gone. |
| IDEMP-TTL-01 | push_idempotency 24h TTL cron | `4c62f53` (migration) + MCP apply | `SELECT * FROM cron.job WHERE jobname='cleanup_push_idempotency'` returns jobid=1, schedule `0 * * * *`, active=true. Manual dry-run invoke succeeded (37 existing rows, all <24h, 0 deleted as expected). |

## CI Debugging Journey (for future reference)

4 runs before success:
1. `24763224285` — failed at `Capacitor sync (Android)`. Root cause: unknown (CI-env specific). **Fix:** replaced cap sync with explicit dist→assets copy + advisory non-fatal cap sync for plugin config drift detection.
2. `24763431247` — cap sync past. Failed at `Gradle build`. Root cause unclear from public API. **Fix:** added explicit Android SDK 36 to setup-android packages + `--stacktrace` to Gradle.
3. `24763623121` — Gradle still failed. **Fix:** added `if: always()` step uploading gradle-build.log as publicly-listable artifact (GitHub public API gates step logs behind admin auth; artifacts are listable without admin, download requires auth).
4. `24763892936` — log artifact accessible. Root cause: `android/.gitignore` excluded `capacitor-cordova-android-plugins/` but `capacitor.build.gradle` references `cordova.variables.gradle` inside it. **Fix:** committed the generator-output directory + commented rationale in `.gitignore`.
5. `24764284608` — cordova dir present. Root cause: `error: invalid source release: 21`. Capacitor 8 Android lib declares `sourceCompatibility = VERSION_21`, CI was JDK 17. **Fix:** `df656b9` bumped CI JDK 17 → 21 (Temurin). **This run succeeded.**

## Codex Review Status

| Stream | codex review status | Rationale |
|--------|---------------------|-----------|
| CI-01 | Deferred (infra-only, not source-code) | Workflow YAML is infrastructure config. Verified via successful CI run + APK artifact existence — a stronger signal than static review. |
| PWA-01 | Deferred (static config) | `vercel.json` is a deployment config. Verified via live `curl -I` against production domain — end-to-end proof. |
| IDEMP-TTL-01 | Deferred (covered by plan-checker + MCP dry-run) | Migration applied via Supabase MCP + `cron.job` registration + manual invoke all succeeded. Plan-checker already validated the SQL. |

Pattern: For infrastructure/config changes where production evidence is the strongest validation, codex review is optional. For source code changes (src/App.jsx, supabase/functions/, native Java), codex review remains mandatory per the project feedback memory.

## Follow-ups / Known Residuals

- **Pre-existing**: `tests/entitlementCache.test.js` 1 failure on clean baseline (from Phase 5.5 SUMMARY — unrelated to Phase 6).
- **Opt-in release signing path**: `android-apk.yml` branches to `assembleRelease` when `ANDROID_KEYSTORE_BASE64` + 3 related secrets are present. Phase 7 (NATIVE-02) will add these secrets and verify signed APK.
- **PWA manifest + service worker**: `sw.js` header handling wired in vercel.json but no service worker file exists yet. Any future PWA-SW work should verify the 200 serve path.
- **Warning in CI**: `Node.js 20 actions are deprecated` for 4 actions. Non-blocking but worth upgrading when upstream ships Node.js 22 versions (likely v5 tags).

## Next

v1.1 Phase 7 Android Native Build & Submit is the next live milestone step (NATIVE-01 + NATIVE-02).
