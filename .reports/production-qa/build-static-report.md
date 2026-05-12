# Agent 01 — Repo / Build / Static Report

**App**: 혜니캘린더 (com.hyeni.calendar)
**Branch**: `final/production-polish-and-real-device-qa`
**HEAD**: `d5d183fa9d2cad168e8d8dcbc1139cede874217b`
**Run**: 2026-05-12 (Wave 0 Production QA, Windows 11)

## TL;DR

- **Status**: FAIL (2 P1 issues, 0 P0)
- **Release decision**: ALLOW_WITH_CAVEATS — APK builds, unit tests green, no secret leaks, 0 vulnerabilities. But Android lint produced 2 errors and 24 Playwright e2e tests are failing.
- **APK**: `android/app/build/outputs/apk/debug/app-debug.apk` — 16.58 MB, built clean.

## Command results

| # | Command | Exit | Duration | Result |
|---|---------|------|----------|--------|
| 1 | git status --short | 0 | — | Working tree clean for source files; only untracked screenshots from prior QA cycles. |
| 2 | git rev-parse HEAD | 0 | — | `d5d183fa` |
| 3 | node --version | 0 | — | v24.13.1 |
| 4 | npm --version | 0 | — | 11.13.0 |
| 5 | npm ci | 0 | 11.5 s | 362 packages installed, 0 vulnerabilities |
| 6 | npm run lint (eslint) | 0 | 15.9 s | Clean |
| 7 | npm run test (vitest) | 0 | 20.9 s | **108 files, 729 tests, all passed** |
| 8 | npm run build (vite) | 0 | 9.8 s | Built; bundle warning (P2-01) |
| 9 | npm run verify (test + e2e) | **1** | 419.6 s | **e2e: 25 passed, 24 failed, 11 skipped** (P1-02) |
| 10 | npx cap sync android | 0 | 7.0 s | Synced dist to android/app/src/main/assets/public |
| 11 | gradlew assembleDebug | 0 | 25.7 s | **APK built** |
| 12 | gradlew test | 0 | 28.1 s | Unit tests pass |
| 13 | gradlew :app:lintDebug | **1** | 42.7 s | **2 errors, 54 warnings** (P1-01) |
| 14 | npm audit --production | 0 | 1.6 s | **0 vulnerabilities** |

## Artifacts

| Artifact | Path | Size |
|---|---|---|
| Vite dist bundle | `dist/` | 5.31 MB |
| Android debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` | 16.58 MB |
| Lint full report | `.reports/production-qa/build-logs/13b-lint-results-full.txt` | 29 KB |
| Per-stage logs | `.reports/production-qa/build-logs/*.log` | — |

## Secret scan

Scanned: `dist/`, `src/`, `android/app/`, packaged APK.

| Pattern | Result |
|---|---|
| `service_role`, `SUPABASE_SERVICE_ROLE_KEY` | Not found |
| `FCM_SERVER_KEY`, `firebase-private-key` | Not found |
| `BEGIN PRIVATE KEY`, `BEGIN RSA PRIVATE` | Not found |
| `KAKAO_SECRET`, `NAVER_CLIENT_SECRET`, `QONVERSION_SECRET` | Not found |
| `FIREBASE_API_KEY`, `GOOGLE_API_KEY=` | Not found |
| `eyJ...` JWT | **1 unique JWT found, decoded to `role: anon`** (Supabase public anon key — safe in client) |

No secret leaks.

## Vulnerabilities (npm audit --production)

| Severity | Count |
|---|---|
| critical | 0 |
| high | 0 |
| moderate | 0 |
| low | 0 |
| info | 0 |

## Issues

### P1-01 — Android lint: 2 errors in ForceRingActivity.java

`android/gradlew.bat :app:lintDebug` FAILED.

1. **ForceRingActivity.java:64** — `Call requires API level 26 (current min is 24): android.app.KeyguardManager#requestDismissKeyguard [NewApi]`
2. **ForceRingActivity.java:159** — `stopReceiver is missing RECEIVER_EXPORTED or RECEIVER_NOT_EXPORTED flag for unprotected broadcasts registered for com.hyeni.calendar.FORCE_RING_STOP [UnspecifiedRegisterReceiverFlag]` (required on Android 14+).

APK still builds (assembleDebug PASS). These manifest at runtime: first will throw `NoSuchMethodError` on API < 26 devices; second will fail Android 14 receiver-registration on target SDK 34+.

Evidence: `.reports/production-qa/build-logs/13b-lint-results-full.txt`

### P1-02 — Playwright e2e: 24 of 60 critical-flow tests failing

`npm run verify` failed at e2e stage. Unit tests pass 729/729; Playwright reports:

- **25 passed**
- **24 failed**
- **11 skipped**

First failure: `parent mode covers emergency, location, scheduling, AI, notifications, remote audio, and kkuk` — `expect img[name="혜니"] to be visible` timed out. Many failures cluster around parent-mode dashboard, calendar tab, map refresh, redesign v1 assertions, and child-mode pairing.

Top failing specs (file: `tests/e2e/critical-flows.spec.js`):
- L717 — parent mode coverage
- L821 — parent bottom nav stable calendar
- L854 — parent calendar single-child schedule
- L881 — parent child tracker push fallback
- L909 — parent dashboard device health pre-broadcast
- L942 — parent dashboard manual refresh
- L958 — parent dashboard device refresh per child
- L979 — parent map refresh polling
- L1002 — parent child status GPS polling
- L1029 — parent child tracker dwell duration
- L1054 / L1098 — calendar empty/event date tap to schedule add sheet
- L1134 / L1189 — sheet drag-to-close
- L1249 — place manager bottom nav
- L1283 — calendar event dots
- L1333 — calendar selected-day status labels
- L1357 — parent route guidance via child location
- L1415 — parent remote listen failure reasons
- L1459 — pairing remote-listen advisory states
- L1497 — dashboard redesign v1 calendar/timeline
- L1597 — parent home redesign v1 hero/today
- L1679 — parent memo tab bottom nav
- L1792 — child mode pairing gate + kkuk

Evidence: `.reports/production-qa/build-logs/09-npm-verify.log`

### P2-01 — Main JS bundle 1.22 MB (374 KB gzip) exceeds Vite 500 KB chunk warning

`dist/assets/index-DxioK-gY.js` is a single 1.22 MB chunk. Vite emits chunk-size warning. Recommend `manualChunks` split (kakao maps SDK, supabase client, qonversion plugin).

Evidence: `.reports/production-qa/build-logs/08-npm-build.log`

### P2-02 — Android lint: 54 warnings

Notable concerns:
- **BatteryLife** — `NotificationPlugin.java:251` uses `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (Play Store content policy concern if not justified).
- **UnusedAttribute** — `AndroidManifest.xml` declares `turnScreenOn` / `showWhenLocked` (API 27+) while minSdk=24.
- **InlinedApi** — `Settings.ACTION_APP_NOTIFICATION_SETTINGS` / `Settings.EXTRA_APP_PACKAGE` referenced at API 26+.

Evidence: `.reports/production-qa/build-logs/13b-lint-results-full.txt`

### P3-01 — 27 `console.log()` calls in production src/

| File | Count |
|---|---|
| `src/App.jsx` | 6 |
| `src/lib/pushNotifications.js` | 7 |
| `src/lib/sync.js` | 6 |
| `src/lib/nativeLocationService.js` | 5 |
| `src/components/childMode/ChildPairInput.jsx` | 1 |
| `src/lib/kakaoMap.js` | 1 |
| `src/lib/remoteAudioCapture.js` | 1 |

No secrets in scanned strings; log spam only.

### P3-02 — Gradle deprecation warnings (incompatible with Gradle 9.0)

Both `assembleDebug` and `test` warn: `Deprecated Gradle features were used in this build, making it incompatible with Gradle 9.0.` Non-blocking on current Gradle 8.14.3.

## Severity counts

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 2 |
| P2 | 2 |
| P3 | 2 |

## Release decision: ALLOW_WITH_CAVEATS

- **No P0 blockers**: APK builds, unit tests pass, no secret leaks, no vulnerabilities.
- **Caveats**: P1-01 lint errors should be patched before Play Store upload (NewApi crashes on older devices; UnspecifiedRegisterReceiverFlag fails on Android 14+ targets). P1-02 e2e regressions block automated regression coverage — handoff item for the web/UI QA agent.
