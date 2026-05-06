# Supabase Recovery Verification Runbook

작성 시각: 2026-05-05 KST

## Purpose

Use this runbook only after Supabase support or the operator has taken an approved action for production main project `qzrrscryacxhprnrtpjd`.

Do not treat a green unit test run as production stabilization completion. The goal remains incomplete until real Supabase, browser, and Android evidence cover the blocked requirements.

## Stop Conditions

Stop immediately and do not run Android production smoke if any of these are true:

- `node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000` returns non-zero.
- The healthcheck output has `readyForAndroidSmoke=false`.
- Auth/REST/Function critical probes still show `AbortError`.
- The operator has not approved live production verification after support/restart action.

## Step 1: Main Supabase Readiness

Preferred gated runner:

```bash
npm run verify:recovery -- --timeout-ms 12000
```

This runner records `output/supabase-recovery-verification-*.json` and stops before any browser or Android smoke when `readyForAndroidSmoke` is not `true`.

Manual healthcheck:

```bash
node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000
```

Required result:

```text
readyForAndroidSmoke=true
```

Keep the generated JSON/Markdown files under `output/` as evidence.

## Step 2: Local Automated Gates

Preferred gated runner:

```bash
npm run verify:recovery -- --timeout-ms 12000 --execute-local-gates
```

Manual commands:

```bash
npm run test
npm run verify
npm run build
npx cap sync android
```

Then from `android/`:

```powershell
.\gradlew.bat assembleDebug
```

Required result:

- Vitest: zero failures.
- Mocked Playwright: zero unexpected failures.
- Vite build: exit 0.
- Capacitor sync: exit 0.
- Android debug build: `BUILD SUCCESSFUL`.

## Step 3: Real Supabase Browser Gate

Preferred gated runner:

```bash
npm run verify:recovery -- --timeout-ms 12000 --execute-real-playwright
```

Manual command:

```bash
npx playwright test --config=playwright.real.config.js
```

Required result:

- No unexpected failures against main or an approved production-equivalent branch.
- Capture any Playwright screenshots, traces, or output files as evidence.

## Step 4: Android Main Smoke

Use connected parent and child devices:

Preferred gated runner:

```bash
npm run verify:recovery -- --timeout-ms 12000 --execute-android-smoke --parent emulator-5554 --child R5CY40EE6QE
```

Manual command:

```bash
node scripts/android-remote-listen-parent-ui-smoke.mjs --parent emulator-5554 --child R5CY40EE6QE --readiness-timeout-ms 12000
```

Required result:

- Readiness preflight passes.
- Parent UI sends the request to the selected child only.
- Child receives FCM or approved fallback path.
- Foreground bridge and persistent microphone notification are visible when Android policy requires them.
- Audio chunks or equivalent remote-listen success evidence are recorded.

## Step 5: Android State Matrix

Preferred gated runner:

```bash
npm run verify:recovery -- --timeout-ms 12000 --execute-android-matrix --parent emulator-5554 --child R5CY40EE6QE
```

Manual command:

```bash
node scripts/android-remote-listen-matrix.mjs --require-two --parent emulator-5554 --child R5CY40EE6QE
```

Required coverage:

- Normal permission state.
- Microphone permission denied.
- Notification permission denied.
- Device locked and screen off.
- App background during a main real session.
- DND, silent, and vibration states.
- Battery optimization or background restriction evidence.
- App network denied or real offline state.
- Remote-listen notification channel disabled state.
- Fold/closed state only if connected hardware supports it.

## Step 6: Main Data Isolation Evidence

Prepare child A and child B test data.

For child A, then child B, verify:

- Home, today, location, calendar day trail, profile, theme, avatar, and remote-listen use only the selected child.
- Profile/theme save writes DB and updates UI without stale state.
- Location realtime updates do not leak between children.
- Calendar day trail date bounds do not mix children or dates.

Record DB query evidence and UI screenshots.

## Completion Rule

Only mark the goal complete after all of these are true:

1. Main healthcheck returns `readyForAndroidSmoke=true`.
2. `npm run test`, `npm run verify`, build, sync, and Android build pass after recovery.
3. Real Supabase Playwright passes.
4. Main Android remote-listen smoke passes.
5. Android state matrix covers the required states or documents hardware-impossible cases.
6. Main RLS/Realtime/Storage/profile-image and selected-child isolation evidence is captured.
