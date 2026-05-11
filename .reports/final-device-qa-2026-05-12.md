# Final Device QA Report — 2026-05-12

## Devices

- Device A, parent: `R5CY****6QE`, Samsung SM-A556S, Android target app `com.hyeni.calendar`
- Device B, child: `ZY22****TQD`, Motorola razr 40 ultra, Android target app `com.hyeni.calendar`
- `adb devices -l`: both devices connected as `device`

## Build Under Test

- Branch: `final/production-polish-and-real-device-qa`
- Commit: `COMMIT_SHA_PENDING`
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK install:
  - Device A: `adb -s R5CY40EE6QE install -r ...app-debug.apk` => `Success`
  - Device B: `adb -s ZY22H9VTQD install -r ...app-debug.apk` => `Success`

## Evidence Paths

Screenshots and UI dumps:

- `.reports/final-device-qa/screenshots/final-parent-after-external-browser.png`
- `.reports/final-device-qa/screenshots/final-parent-after-external-browser.xml`
- `.reports/final-device-qa/screenshots/final-child-locked-after-external-browser.png`
- `.reports/final-device-qa/screenshots/final-child-locked-after-external-browser.xml`
- Earlier blocker/evolution captures are also retained under `.reports/final-device-qa/screenshots/`.

Logcat:

- `.reports/final-device-qa/logcat/final-parent-after-external-browser-raw.log`
- `.reports/final-device-qa/logcat/final-parent-after-external-browser-filtered.log`
- `.reports/final-device-qa/logcat/final-child-after-external-browser-raw.log`
- `.reports/final-device-qa/logcat/final-child-after-external-browser-filtered.log`

## Cycle Status

Cycle count: **0**

Reason: Device B remained on secure Android keyguard:

```text
isKeyguardShowing=true
mDreamingLockscreen=true
mCurrentFocus=Window{... NotificationShade}
```

Because the goal requires real interaction on both physical devices, no parent/child end-to-end cycle was marked as started or passed.

## Device Actions Completed

- Installed latest debug APK on both devices.
- Cleared app data on both devices:
  - `adb -s <serial> shell pm clear com.hyeni.calendar`
- Cleared logcat on both devices:
  - `adb -s <serial> logcat -c`
- Launched app with `monkey -p com.hyeni.calendar ...`.
- Captured screenshots, UI XML, raw logcat, and filtered logcat.
- Device A showed role selection screen with parent/child guidance and disabled Next state.
- Device B started the app process but stayed blocked by keyguard.

## Logcat Review

Resolved during this session:

- `BackgroundLocation.then() is not implemented on android` no longer appears after non-thenable native plugin wrapper.
- `Capacitor/BrowserPlugin: Error binding to custom tabs service` no longer appears after removing `@capacitor/browser` and replacing it with local `ExternalBrowserPlugin`.

Current filtered logs:

- Device A: no app-origin fatal exception, React runtime error, unhandled rejection, `BackgroundLocation.then`, duplicate plugin registration, BrowserPlugin error, Supabase/RLS unexpected error, or ANR found.
- Device A includes `FCM token sync skipped: push context not ready yet`; classified as expected pre-auth startup state, not a crash.
- Device B includes Motorola `SafeInvoker` system/vendor errors and repeated native health logs with `keyguardLocked=true`; classified as device/vendor/keyguard noise, not app-origin crash evidence.

## Required Real-Device E2E Matrix

The following required flows are **not passed** because Device B is locked:

- A. onboarding/signup/role branching
- B. pairing
- C. permissions/safety setup
- D. location/realtime sync
- E. push/schedule notifications
- F. schedule CRUD
- G. places/safe/danger zones
- H. SOS/ForceRing/safety signals
- I. remote audio / microphone consent / FGS notification
- J. memo/sticker/communication
- K. subscription/premium gates
- L. settings/logout/recovery
- M. accessibility/layout on actual devices

## Automated Support Gates

These passed and support the code state, but do not replace physical-device QA:

- `npm run lint`
- `npm run test`: `106 passed`, `719 tests`
- `npm run build`
- `npm run test:e2e`: `46 passed`, `11 skipped`
- `npx playwright test --config=playwright.real.config.js --reporter=line`: `43 passed`
- `npm audit --audit-level=high`: `0 vulnerabilities`
- `npx cap sync android`: pass
- `android/.\\gradlew clean`: pass
- `android/.\\gradlew :app:assembleDebug`: pass
- `android/.\\gradlew :app:bundleRelease`: pass

## Failure / Fix / Reverification History

- Found app-origin `BackgroundLocation.then()` logcat error on physical-device launch.
  - Root cause: Capacitor plugin proxy was Promise-assimilated through a synthetic `then` property.
  - Fix: wrapped native plugin proxy so `then` is undefined; added unit test.
  - Reverified: automated gates passed; physical logcat no longer contains `BackgroundLocation.then`.
- Found `Capacitor/BrowserPlugin` error on Device B with no Custom Tabs service.
  - Root cause: `@capacitor/browser` binds Custom Tabs on resume even before OAuth usage.
  - Fix: removed dependency and replaced OAuth open/close path with local `ExternalBrowserPlugin`.
  - Reverified: `npx cap sync android` now reports only 2 Capacitor plugins; physical logcat no longer contains BrowserPlugin error.

## Next Required Step

Physically unlock Device B `ZY22****TQD`, then rerun from clean app data:

1. Cycle 1 full parent/child E2E.
2. Cycle 2 full parent/child E2E.
3. No code changes between Cycle 1 and Cycle 2.

Until those two cycles pass, this build is not certified for Google Play submission.
