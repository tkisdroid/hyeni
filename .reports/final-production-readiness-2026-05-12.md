# Final Production Readiness Report — 2026-05-12

## Status

- Branch: `final/production-polish-and-real-device-qa`
- Commit: `678e5dd Stabilize production polish and device QA`
- Baseline: `35d965b Improve onboarding guidance and validation`
- Baseline check: `git merge-base --is-ancestor 35d965b HEAD` => pass
- Production Ready declaration: **NO**
- Release blockers: **1**
  - Device B `ZY22****TQD` is still behind Android secure keyguard. Required two-device, two-cycle real E2E could not start.

## Verification Commands

| Gate | Result |
| --- | --- |
| `npm ci` | pass |
| `npm run lint` | pass |
| `npm run test` | pass, `106 passed`, `719 tests` |
| `npm run build` | pass; Vite chunk/import warnings only |
| `npm run test:e2e` | pass, `46 passed`, `11 skipped` |
| `npx playwright test --config=playwright.real.config.js --reporter=line` | pass, `43 passed` |
| `npm audit --audit-level=high` | pass, `0 vulnerabilities` |
| `npx cap sync android` | pass; Android plugins now `@capacitor/app`, `@qonversion/capacitor-plugin` |
| `android/.\\gradlew clean` | pass |
| `android/.\\gradlew :app:assembleDebug` | pass |
| `android/.\\gradlew :app:bundleRelease` | pass |

Build artifacts:

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`, 16,550,129 bytes
- Release AAB: `android/app/build/outputs/bundle/release/app-release.aab`, 13,438,842 bytes

## Defects Fixed

- Fixed native plugin Promise assimilation: Capacitor plugin proxies exposed a synthetic `then` method, causing `BackgroundLocation.then()` app-origin logcat errors. Added non-thenable plugin wrapper and unit regression test.
- Removed `@capacitor/browser` native plugin because it auto-bound Custom Tabs at app resume and emitted `Capacitor/BrowserPlugin` errors on a device with no Custom Tabs provider. Replaced it with app-local `ExternalBrowserPlugin` using `ACTION_VIEW` only when OAuth is requested.
- Removed first-run automatic Android runtime permission requests. Sensitive permissions now stay behind explicit in-app disclosure surfaces after role selection.
- Redacted VAPID example secrets in `supabase/PUSH-SETUP.md`.
- Added parent TODAY view and stable Calendar tab separation to prevent calendar/home navigation ambiguity.
- Fixed parent single/multi-child selection defaults and calendar date tap add flow.
- Fixed stale location trail calculation so older current snapshots do not create negative dwell/incorrect same-place ranges.
- Strengthened memo thread child isolation and updated real-service E2E selectors for current onboarding.
- Added child character selection persistence through `family_members.emoji`.
- Updated parent settings icons to use the existing Lucide `StickerIcon` mapping instead of raw emoji spans.

## Design Polish

- Role gate and initial guidance are visible on first launch and keep clear parent/child copy.
- Saved place chips now have max-width/min-width/ellipsis/flex-shrink protection.
- Safety dots now include visible state labels: safe, needs attention, emergency.
- Native emoji quick reply chip icons were replaced with 3D icon rendering.
- ChildPairInput success mascot uses `cheer`.
- Child settings include an accessible animal-character radio group with 44px+ targets.
- Quick action CSS no longer depends on fragile `.hyeni-v5-action-chip > span:first-child`; it uses `.hyeni-v5-action-chip-icon`.
- Parent settings rows render mapped Lucide icons while keeping existing data strings compatible.

## Security And Policy Checks

- Client/Android source scan found no Supabase service-role key exposure in `src`, Android Java, or Android web assets.
- No app usage found for AD_ID, IMEI/MEID, subscriber ID, SIM serial, phone number APIs, BSSID/SSID, or broad contacts APIs.
- Manifest still contains sensitive permissions for location, background location, notifications, microphone, camera, exact alarm, and foreground services. These remain core to the app but require Play Console declarations and in-app disclosure consistency.
- Manifest includes `isMonitoringTool` metadata with `child_monitoring`.
- `AmbientListenService` uses microphone foreground service type and ongoing notification paths in code; full remote-audio behavior still requires unlocked two-device real E2E.
- Official policy references checked:
  - Google Play User Data / prominent disclosure: https://support.google.com/googleplay/android-developer/answer/10144311
  - Google Play `isMonitoringTool` flag: https://support.google.com/googleplay/android-developer/answer/12955211
  - Android foreground service type requirements: https://developer.android.com/about/versions/14/changes/fgs-types-required
  - Google Play Families policy: https://support.google.com/googleplay/android-developer/answer/9893335

## Google Play Submission Checklist

- Automated code/test/build gates: pass.
- Debug APK install on both physical devices: pass.
- App launch on Device A parent: pass.
- App launch request on Device B child: app process starts, but UI is blocked by Android secure keyguard.
- Two-device parent/child signup, pairing, permission, location, notification, schedule, safety, memo, subscription, settings flow: **blocked, not executed**.
- Two consecutive clean real-device cycles: **blocked, count = 0**.
- Release-blocking policy risk: **not cleared** until real-device permission/remote-audio/background-location behavior is verified end to end.

## Remaining Blocker

`ZY22****TQD` must be physically unlocked with pattern/fingerprint. After unlock, restart real-device Cycle 1 from clean app data and run two consecutive full cycles without code changes. If any defect is found, fix it and reset cycle count to 0.
