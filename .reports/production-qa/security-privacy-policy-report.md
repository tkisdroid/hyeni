# Agent 10 — Security / Privacy / Policy Report

**Generated**: 2026-05-12
**Scope**: Static + code review (runtime testing out of scope — handled by Agents 06/07/11)
**App**: 혜니캘린더 (com.hyeni.calendar)
**Branch**: final/production-polish-and-real-device-qa

---

## Executive Summary

| Severity | Count |
|----------|------|
| P0       | 0    |
| P1       | 3    |
| P2       | 4    |
| P3 / Info | 3   |

**Release decision: ALLOW with P1 caveats.**

No critical (P0) vulnerabilities found. The auth/authz layer is well-defended: push-notify Edge Function verifies JWT in-function, cross-checks family membership, gates remote-listen / force-ring by primary-parent role, and validates `target_user_id` against the family before dispatch. RLS protects child_locations / families / family_members at the DB. The Android stalkerware policy posture is correct (`isMonitoringTool=child_monitoring` meta-data, persistent FGS notification on AmbientListenService, RECORD_AUDIO permission check before capture).

The three P1 findings are defense-in-depth: `android:allowBackup="true"` exposing access tokens to `adb backup`, the `feedback-email` and `ai-voice-parse` Edge Functions accepting unauthenticated requests (cost/abuse risk), and the `subscription-reconcile` Edge Function with no caller auth. None enable account takeover or cross-family data access.

---

## Findings

### [P1] android:allowBackup=true exposes user access tokens
- **Location**: `android/app/src/main/AndroidManifest.xml:33` ; written at `android/app/src/main/java/com/hyeni/calendar/LocationService.java:202-209`
- **Description**: The Android app declares `android:allowBackup="true"`. The LocationService persists the Supabase user JWT (`accessToken`), `supabaseKey`, `userId`, `familyId`, and `fcmToken` to SharedPreferences (`hyeni_location_prefs`, MODE_PRIVATE). When `allowBackup=true`, `adb backup -f x.ab -noapk com.hyeni.calendar` extracts the full app data partition off any device with USB debugging enabled, exposing the JWT.
- **Impact**: Attacker with physical access (or compromised laptop trust prompt) to a paired-child phone can extract a valid JWT for that child's Supabase session. Because the child user_id has RLS-permitted access to that family's events, memos, and child_locations, the attacker can read live location and event data.
- **Proof of concept** (conceptual — runtime out of scope):
  ```
  adb backup -f hyeni.ab -noapk com.hyeni.calendar
  dd if=hyeni.ab bs=24 skip=1 | openssl zlib -d | tar -xvf - apps/com.hyeni.calendar/sp/hyeni_location_prefs.xml
  # extract <string name="accessToken">eyJ...</string>
  ```
- **Recommendation**:
  - Either set `android:allowBackup="false"` on `<application>` (line 33).
  - Or migrate access-token storage to `EncryptedSharedPreferences` (androidx.security:security-crypto) so backup contents remain encrypted with a per-device master key.

### [P1] feedback-email Edge Function accepts unauthenticated POST + leaks operator email
- **Location**: `supabase/functions/feedback-email/index.ts:27-66` (no auth check on `Deno.serve`)
- **Description**: The function accepts any POST body and forwards the `content` field to `FEEDBACK_TO_EMAIL` (default fallback hard-coded to `tkisdroid@gmail.com` at line 9). There is no JWT verification, no signature, no rate limiting. An attacker who knows the function URL can spam the operator's inbox, embed phishing payloads in `senderName`/`senderEmail`, or potentially escalate (HTML-injection in Resend templates).
- **Impact**: Operator inbox spam / phishing reflection. Operator personal email is hard-coded in repo, exposing PII.
- **Proof of concept**:
  ```
  curl -X POST https://qzrrscryacxhprnrtpjd.supabase.co/functions/v1/feedback-email \
    -H 'Content-Type: application/json' \
    -d '{"content":"<spam payload>","senderEmail":"<phish>@<...>","senderName":"<...>"}'
  # → forwarded to tkisdroid@gmail.com
  ```
- **Recommendation**:
  1. Add `getClaims()` JWT verification at the top of `Deno.serve` (same pattern as push-notify:434-449).
  2. Remove the hard-coded `tkisdroid@gmail.com` fallback at line 9 — require `FEEDBACK_TO_EMAIL` env var or fail closed.
  3. Add rate limiting via `push_idempotency`-style table on senderUserId.

### [P1] ai-voice-parse Edge Function unauthenticated — OpenAI cost abuse
- **Location**: `supabase/functions/ai-voice-parse/index.ts:11-198` (no auth check anywhere)
- **Description**: This function proxies user input (text + optional image) to OpenAI's chat completions endpoint using the project's `OPENAI_API_KEY`. There is no caller authentication. An external attacker can hit this endpoint and burn the project's OpenAI budget — `gpt-4o` and `gpt-4o-mini` with images. Each malicious call ≈ $0.01–$0.05; thousands of calls per hour quickly drain credit.
- **Impact**: Financial DoS (uncontrolled OpenAI spend) + potential prompt-injection probing.
- **Proof of concept**:
  ```
  curl -X POST https://qzrrscryacxhprnrtpjd.supabase.co/functions/v1/ai-voice-parse \
    -H 'Content-Type: application/json' \
    -d '{"text":"random query","currentDate":{"year":2026,"month":4,"day":12}}'
  # → consumes OPENAI_API_KEY budget; no auth required
  ```
- **Recommendation**:
  1. Adopt the push-notify JWT-verification pattern (in-function `getClaims()`).
  2. Require `familyId` in body and cross-check `family_members.user_id == sub`.
  3. Add per-family rate limit (e.g. 50 calls/day) — track in a Postgres table.

### [P2] subscription-reconcile Edge Function unauthenticated
- **Location**: `supabase/functions/subscription-reconcile/index.ts:81-122`
- **Description**: No auth gate. The function only reads stale rows and calls Qonversion, so direct write-amplification is bounded. But an attacker can trigger reconciliation runs to (a) fingerprint billing state, (b) burn Qonversion API quota, (c) inject crafted `qonversion_user_id` if any is later derived from request body (currently safe — only reads DB).
- **Impact**: Low — Qonversion API quota drain + observability noise.
- **Recommendation**: Add service-role-only check or HMAC signature header. Restrict to `role === "service_role"` (cron) only.

### [P2] Release builds have minifyEnabled false — code shipped unobfuscated
- **Location**: `android/app/build.gradle:38-44`
- **Description**: Release builds disable ProGuard/R8 minification. ProGuard config file is referenced but not applied. Java classes (`AmbientListenService`, `LocationService`, `ForceRingService`, `LocationPlugin`, etc.) and string literals (channel IDs, action constants, Supabase URL templates) ship in clear in the APK. Combined with the public Kakao keys, an attacker can read the full client-side logic.
- **Impact**: Reverse engineering is easier — attackers can map endpoints, find race-condition timings, replay request hashes. Not a vulnerability by itself but weakens defense in depth.
- **Recommendation**: Set `minifyEnabled true` and `shrinkResources true` on the release variant. Validate the existing `proguard-rules.pro` against Capacitor + Firebase reflection requirements.

### [P2] Kakao REST + APP keys ship in JS bundle without site restriction verified
- **Location**: `dist/assets/index-DxioK-gY.js` (bundled from `VITE_KAKAO_APP_KEY`, `VITE_KAKAO_REST_KEY` in `.env.local` lines 6-7). Strings present in bundle: `d99178...***...439c` (APP), `d50235...***...9f10` (REST — masked).
- **Description**: Kakao keys are bundled in the JS as `import.meta.env.VITE_*`. These are designed to be public IF Kakao Console restricts the keys by site domain or Android package name + SHA-1. **Cannot verify the restriction from static analysis alone** — review the Kakao Developers console.
- **Impact**: If the Kakao keys are not restricted by domain/package, third parties can use the keys for their own Kakao Maps / Local API quota and your account gets billed.
- **Recommendation**: In Kakao Developers console (developers.kakao.com → 내 애플리케이션 → 앱 설정 → 플랫폼), restrict the Web platform to your production domain and the Android platform to `com.hyeni.calendar` + production SHA-1 fingerprint only.

### [P2] CORS allows wildcard origin on all Edge Functions
- **Location**: `supabase/functions/push-notify/index.ts:413-419`, `feedback-email/index.ts:3`, `ai-voice-parse/index.ts:5-9`, `ai-child-monitor/index.ts:8-13`, `qonversion-webhook` (jsonResponse), `subscription-reconcile`
- **Description**: `Access-Control-Allow-Origin: *` is set globally. For functions that verify JWT in-function (push-notify, ai-child-monitor) this is acceptable since CSRF is mitigated by Bearer auth, but for the unauthenticated endpoints (ai-voice-parse, feedback-email) it allows any browser origin to invoke them.
- **Recommendation**: Restrict allowed origins to known production domains for unauthenticated endpoints. Defense-in-depth.

### [P3 / Info] google-services.json checked into git
- **Location**: `android/app/google-services.json:18` (`current_key` field, Firebase API key)
- **Description**: Firebase Web/Android API key is in the repo. This is **acceptable** — Firebase API keys are designed to be public; access is gated by package + SHA-1 restrictions in Firebase Console.
- **Recommendation** (info-level): Verify in Firebase Console → Project Settings → App check / API key restrictions that the key is restricted to `com.hyeni.calendar` package + your production keystore SHA-1.

### [P3 / Info] familyId UUID logged via console.log
- **Location**: `src/lib/sync.js:746,912,920,926,930` and similar
- **Description**: `console.log("[Realtime] Subscribed to family-${familyId}")` etc. — familyId UUID printed to console in production. In WebView console, only same-app access can read these. Not exploitable, but defensive logging hygiene.
- **Recommendation**: Strip console logs from production via vite build's `esbuild.drop: ['console']` config, or use a logger wrapper that no-ops in production.

### [P3 / Info] No source maps shipped (verified) — positive observation
- **Location**: `dist/` (no `*.map` files), `vite.config.js` (default — source maps disabled in build)
- **Description**: Production build does not include source maps. Source code is minified-bundled.

---

## Positive Observations

1. **JWT-in-function verification on push-notify** (`push-notify/index.ts:428-451`) — the gateway is deployed with `--no-verify-jwt` (workaround for supabase#42244) but the function itself calls `getClaims()` and rejects missing-sub non-service-role tokens. Service-role calls (cron) are explicitly distinguished.

2. **Family-membership cross-check on every push action** (`push-notify/index.ts:870-884`) — even with a verified JWT, the function checks `family_members.user_id == sub` against the requested `family_id` before dispatching, closing the IDOR vector noted as "SEC-01" in the code itself.

3. **Primary-parent gate on dangerous control actions** (`push-notify/index.ts:894-914`) — remote_listen, request_location, force_ring etc. are restricted to `families.parent_id === user_id`. Co-parents cannot trigger remote control.

4. **target_user_id validation against family roster on force_ring** (`push-notify/index.ts:555-567`) — explicit `eq("family_id", familyId).eq("role", "child").eq("user_id", requestedTargetUserId)` check before dispatch. Closes cross-family IDOR.

5. **Idempotency keys + push_idempotency table** prevent replay (`push-notify/index.ts:926-949`).

6. **Force_ring quota enforcement** via `force_ring_check_quota` RPC (lines 535-547) — free=1/day, premium=10/day.

7. **Force_ring_stop authorization** (`push-notify/index.ts:707-709`) — only the initiator can stop their own event.

8. **Force_ring_reminder restricted to service_role** (`push-notify/index.ts:753-755`).

9. **AmbientListenService persistent FGS notification with Korean disclosure** (`AmbientListenService.java:526-537`) — `setOngoing(true)`, `VISIBILITY_PUBLIC`, Korean text "주변 소리 연결 중". Required for Play stalkerware policy.

10. **RECORD_AUDIO runtime permission check before capture starts** (`AmbientListenService.java:163-167`) + the service stops itself cleanly if permission missing.

11. **Native FGS type chain** (`AmbientListenService.java:128-157`) — tries TYPE_MICROPHONE first (required for actual audio on Android 14+), falls back to TYPE_SPECIAL_USE only as belt-and-suspenders, then stops itself rather than streaming silent audio.

12. **isMonitoringTool=child_monitoring meta-data** declared on `<application>` (line 41-42) — correctly signals Play Console for parental monitoring policy.

13. **Wake lock with timeout** (`AmbientListenService.java:498-507`) — `wakeLock.acquire(Math.max(5, durationSec + 5) * 1000L)` prevents indefinite holds.

14. **Naver OAuth state CSRF protection** (`src/lib/auth.js:253-266`) — nonce stored in sessionStorage, verified server-side.

15. **Qonversion webhook HMAC signature verification** (`qonversion-webhook/index.ts:109-114`) — secret-based signature required (unless `QONVERSION_ALLOW_UNSIGNED_WEBHOOKS=1` explicitly set).

16. **send-sms webhook signature verification** (`send-sms/index.ts:118-121`) — required, no bypass flag.

17. **child_locations RLS** (`supabase/archive/_deprecated_child-locations.sql:14-25` — schema still in effect):
    - SELECT: only same-family members (`auth.uid()` ∈ family)
    - INSERT/UPDATE: only the child themselves (`user_id = auth.uid()`)

18. **unpair_child SECURITY DEFINER RPC** (`src/lib/auth.js:644-668`) — server-side cascade cleanup of `fcm_tokens`, `push_subscriptions`, `child_locations`, `pending_notifications`, `child_audio_chunks` on unpair. Prevents stale data leaking to unpaired devices.

19. **logout cache clearing** (`src/lib/auth.js:344-353`) — clears child photo cache, family info cache, entitlement cache on `signOut()` to prevent next-session leakage.

20. **No service_role JWT in client bundle** (verified via grep — bundle contains only the anon JWT with `"role":"anon"`).

21. **No source maps in production dist/**.

22. **.env / firebase-adminsdk-*.json properly gitignored**, no history of these files in git log.

23. **Capacitor `allowNavigation` restricted** to `*.supabase.co` and `*.kakao.com` — prevents redirection abuse via deep links.

24. **No client-side `localStorage.setItem('role', ...)` authoritative role assignment** — `hyeni-last-role` is purely a UX hint for the role-setup modal; actual role enforcement is via Supabase `family_members.role` + RLS.

---

## Permission Inventory

Source: `android/app/src/main/AndroidManifest.xml`

| Permission | Justification | Guard site |
|-----------|---------------|------------|
| INTERNET | Supabase/FCM/Kakao network | n/a (normal) |
| ACCESS_NETWORK_STATE | Connectivity awareness | n/a (normal) |
| ACCESS_FINE_LOCATION | Child location tracking | LocationService.java:243 |
| ACCESS_COARSE_LOCATION | Fallback location | covered by fine check |
| ACCESS_BACKGROUND_LOCATION | Background tracking | LocationPlugin.java:71-76 |
| FOREGROUND_SERVICE_LOCATION | Android 14+ FGS type | LocationService.java:255-260 |
| FOREGROUND_SERVICE_MICROPHONE | Android 14+ FGS type (RL) | AmbientListenService.java:130-150 |
| FOREGROUND_SERVICE_SPECIAL_USE | Force ring + ambient fallback | ForceRingService.java + AmbientListenService.java |
| POST_NOTIFICATIONS | Push delivery | pushNotifications.js:219 |
| RECEIVE_BOOT_COMPLETED | Restart on boot | BootReceiver.java |
| WAKE_LOCK | Keep CPU on during capture | AmbientListenService.java:498-507 (timed) |
| **RECORD_AUDIO** | Remote listen capture | AmbientListenService.java:163-167 |
| CAMERA | QR pairing (WebView getUserMedia) | OS-gated |
| USE_FULL_SCREEN_INTENT | ForceRing fullscreen alert | ForceRingService.java |
| SYSTEM_ALERT_WINDOW | Declared (review usage) | NOTE — broad permission |
| REQUEST_IGNORE_BATTERY_OPTIMIZATIONS | Reliable background tracking | LocationService.java:269 |
| SCHEDULE_EXACT_ALARM | Time-precise notifications | within app limits |
| MODIFY_AUDIO_SETTINGS | ForceRing alarm volume | ForceRingService.java |
| VIBRATE | Notification haptic | n/a (normal) |

## Foreground Service Audit (Play stalkerware policy)

| Service | FGS type | Persistent notification | Visibility |
|---------|---------|------------------------|-----------|
| LocationService | location | YES (`hyeni_location_v4`) | PUBLIC |
| AmbientListenService | microphone (primary) / specialUse (fallback) | YES (`ambient_listen_fgs`, ongoing=true) | PUBLIC, PRIORITY_LOW, Korean disclosure copy |
| ForceRingService | specialUse | YES | parent emergency alert |
| MyFirebaseMessagingService | (not FGS) | n/a | n/a |

---

## Recommendations (Proactive)

1. Set `android:allowBackup="false"` OR adopt `EncryptedSharedPreferences` for the access token (fixes P1 #1).
2. Add JWT verification to `feedback-email`, `ai-voice-parse`, `subscription-reconcile` (fixes P1 #2, P1 #3, P2).
3. Enable `minifyEnabled true` for release builds.
4. Verify Kakao keys are domain/package restricted in Kakao Developers console.
5. Add `esbuild.drop: ['console']` to `vite.config.js` to strip console.log from production.
6. Restrict Edge Function CORS allowlist to production domains for unauthenticated endpoints.
7. Confirm Firebase API key is restricted by package + SHA-1 in Firebase Console.
8. Consider periodic JWT rotation in LocationService — current pattern stores the token in SharedPreferences and refreshes every 50 min (LocationService.java:114) but verify unpair flow clears it.

---

## Methodology

- AndroidManifest permission enumeration → grep for runtime permission checks across `src/lib/` and `android/app/src/main/java/com/hyeni/calendar/`
- Edge Function auth surface review for all 7 functions in `supabase/functions/`
- Secret scan via grep across `dist/`, `src/`, `public/`, `android/app/src/main/` for `service_role`, `FCM_PRIVATE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, JWT pattern `eyJ`, hex-32 patterns
- Git history check (`git ls-files`, `git log --all --full-history -p -- .env`)
- Capacitor config + Vite config review for source maps + navigation allowlist
- RLS policy review for `child_locations`, `family_members`, `families`
- Token leakage check across all console.log/console.warn calls in `src/`
