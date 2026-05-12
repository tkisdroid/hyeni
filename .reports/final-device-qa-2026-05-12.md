# Final Device QA Report — 2026-05-12

## Devices

- Device A, parent: `R5CY***6QE`, Samsung SM-A556S
- Device B, child: `R5CY***FNZ`, Samsung SM-S937N
- Package: `com.hyeni.calendar`
- `adb devices -l`: both devices connected as `device`

## Build Under Test

- Branch: `final/production-polish-and-real-device-qa`
- Baseline: `35d965b Improve onboarding guidance and validation`
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK install:
  - Device A: `adb -s R5CY40EE6QE install -r android/app/build/outputs/apk/debug/app-debug.apk` => `Success`
  - Device B: `adb -s R5CY521CFNZ install -r android/app/build/outputs/apk/debug/app-debug.apk` => `Success`

## Post-Fix Physical Cycles

These cycles ran after the latest app-code change and APK reinstall. Scope was the user-reported critical path: initial role entry, pair-code UI, wrong-code guidance, real pairing persistence, child foreground location service, parent child-status/tracker location display, and app-origin critical logcat scan.

### Cycle 1: `cycle3c`

- Evidence JSON: `.reports/final-device-qa/cycle3c-evidence.json`
- Pair code used: `KID-61853626`
- Checks:
  - child did not return to role gate: pass
  - no `XXXXXXXX` pair-code placeholder overlap: pass
  - wrong pair code shows guidance: pass
  - real pair persisted to `family_members.user_id`: pass
  - child `LocationService` foreground evidence: pass
  - parent tracker opened from child status surface: pass
  - app-origin critical logcat patterns: 0
- Screenshots:
  - `.reports/final-device-qa/screenshots/cycle3c-child-01-pair-input.png`
  - `.reports/final-device-qa/screenshots/cycle3c-child-03-home.png`
  - `.reports/final-device-qa/screenshots/cycle3c-parent-02-home.png`
  - `.reports/final-device-qa/screenshots/cycle3c-parent-03-tracker.png`

### Cycle 2: `cycle3d`

- Evidence JSON: `.reports/final-device-qa/cycle3d-evidence.json`
- Pair code used: `KID-DE16AAE1`
- Checks:
  - child did not return to role gate: pass
  - no `XXXXXXXX` pair-code placeholder overlap: pass
  - wrong pair code shows guidance: pass
  - real pair persisted to `family_members.user_id`: pass
  - child `LocationService` foreground evidence: pass
  - parent tracker opened from child status surface: pass
  - app-origin critical logcat patterns: 0
- Screenshots:
  - `.reports/final-device-qa/screenshots/cycle3d-child-01-pair-input.png`
  - `.reports/final-device-qa/screenshots/cycle3d-child-03-home.png`
  - `.reports/final-device-qa/screenshots/cycle3d-parent-02-home.png`
  - `.reports/final-device-qa/screenshots/cycle3d-parent-03-tracker.png`

## Broader Physical Evidence From Earlier Same-Day Runs

Before the final dwell-time fix, broader physical cycles also verified schedule default time/sync, memo/reply realtime, kkuk, remote-audio free gate, and cold-start restore. Because app code changed afterward, those earlier cycles are supporting evidence only and do not satisfy the strict final two-cycle completion rule.

Key supporting screenshots:

- `.reports/final-device-qa/screenshots/cycle1c-parent-02-schedule-synced.png`
- `.reports/final-device-qa/screenshots/cycle1c-child-02-schedule-synced.png`
- `.reports/final-device-qa/screenshots/cycle1c-parent-03-memo-reply.png`
- `.reports/final-device-qa/screenshots/cycle1c-parent-04-kkuk.png`
- `.reports/final-device-qa/screenshots/cycle1c-parent-05-remote-audio-gate.png`
- `.reports/final-device-qa/screenshots/cycle2-parent-02-schedule-synced.png`
- `.reports/final-device-qa/screenshots/cycle2-child-02-schedule-synced.png`

## Logcat Review

Sanitized logs are stored under `.reports/final-device-qa/logcat/` and are ignored by git. `cycle3c` and `cycle3d` app-origin scans found no:

- `FATAL EXCEPTION`
- React runtime error
- Capacitor bridge error
- unhandled rejection
- app-origin `ANR`
- permission crash

`cycle3b` contained a non-app `ANR` line from pid `7479` (`AppExitInfoManager`) while the Hyeni child app pid was `7157`; it was classified as system/other-app noise and the scanner was tightened to app-origin matching before `cycle3c` and `cycle3d`.

## Automated Support Gates

These passed and support the code state, but do not replace the remaining full physical-device matrix:

- `npm run lint`
- `npm run test`: `106 passed`, `722 tests`
- `npm run build`
- `npm run test:e2e`: `49 passed`, `11 skipped`
- `npx playwright test --config=playwright.real.config.js`: `43 passed`
- `npm audit --audit-level=high`: `0 vulnerabilities`
- `npx cap sync android`
- `android/.\\gradlew clean`
- `android/.\\gradlew :app:assembleDebug`
- `android/.\\gradlew :app:bundleRelease`

## Failure / Fix / Reverification History

- Pair-code overlap:
  - Root cause: hidden input placeholder `XXXXXXXX` rendered over the visual code boxes beside `KID-`.
  - Fix: removed the placeholder and kept `aria-label="페어링 코드 8자리"`.
  - Reverified: unit test, mocked E2E selector updates, physical screenshots `cycle3c` and `cycle3d`.
- Child mode bounce:
  - Root cause: anonymous-login pending/error state could fall through to role selection.
  - Fix: explicit pending/error UI and retry path.
  - Reverified: mocked E2E and physical `cycle3c`/`cycle3d`.
- Parent child-status location update:
  - Root cause: polling window was too short for slower GPS/device refresh.
  - Fix: longer refresh polling and background attempts.
  - Reverified: mocked E2E and physical parent tracker screenshots.
- Dwell duration regression:
  - Root cause: current location snapshots were appended to same-place history after a long time gap, inflating dwell duration.
  - Fix: split dwell clusters when sample gaps exceed 15 minutes.
  - Reverified: unit test and mocked E2E.

## Remaining Device QA Work

The strict `/goal` matrix is not complete. The next physical pass must run two full clean cycles without code changes across signup/login, pairing, permissions, location/realtime, notifications, schedule CRUD, places/safe/danger zones, SOS/ForceRing, remote audio, memo/stickers, subscription, settings/logout/recovery, and layout/accessibility.
