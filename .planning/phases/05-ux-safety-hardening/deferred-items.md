# Phase 5 — Deferred Items

Items discovered during Phase 5 execution that are out-of-scope for v1.0 safety
hardening and explicitly handed off to v1.1 (native-deploy) or logged as
pre-existing technical debt.

## v1.1 native-deploy ticket

1. **AmbientListenService Capacitor bridge wiring.**
   Source at `android/app/src/main/java/com/hyeni/calendar/AmbientListenService.java`
   is authored but not invoked from JS. Owner: v1.1. Scope: register a
   Capacitor plugin, expose `AmbientListen.start()` / `AmbientListen.stop()`,
   wire it inside `startRemoteAudioCapture` and `stopRemoteAudioCapture`.

2. **Android Gradle rebuild + Play internal-track submission.**
   Manifest + service source committed this phase; APK not rebuilt on this
   Windows dev host. Owner: v1.1 native-deploy.

3. **JS consent UI for `mic-permission-denied` DOM event.**
   MainActivity dispatches the event when the WebView mic PermissionRequest
   is denied. No listener is currently wired. Owner: v1.1.

4. **Google Play stalkerware self-certification form.**
   P2-8 remote listen sits under Play Store's family-exception policy; the
   form + screenshots + declaration are drafted out-of-scope for this phase
   because they require the v1.1 APK to be buildable first.

## Pre-existing — NOT introduced by Phase 5

1. **`tests/entitlementCache.test.js > reads back a cached value before ttl expires`** fails on HEAD~ (before Phase 5 edits). Confirmed via `git stash && npx vitest run`. Localstorage stub/harness issue unrelated to any Phase 5 surface. Should be picked up in a v1.x test-harness cleanup ticket.
