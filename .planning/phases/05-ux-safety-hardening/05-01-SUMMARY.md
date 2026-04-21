---
phase: 05-ux-safety-hardening
plan: 01
subsystem: safety-surfaces
tags: [supabase, rls, realtime, press-hold, audit-log, feature-flag, foreground-service, stalkerware-compliance, pipa, owasp-mastg]

# Dependency graph
requires:
  - phase: 02-unblock-core-push-gateway-realtime-pair-security
    plan: 04
    provides: "family_members parent-only DELETE RLS (PAIR-03) — SOS-01 receiver_user_ids enumeration and remote_listen_sessions family-scope RLS both depend on stable family_members row semantics"
  - phase: 03-client-push-fetch-hygiene
    plan: 03
    provides: "sendInstantPush Idempotency-Key hygiene (PUSH-02) — kkuk push path can now be layered with dedup_key + server cooldown without double-dispatch"
provides:
  - "public.remote_listen_sessions audit table (id, family_id, initiator_user_id, child_user_id, started_at, ended_at, duration_ms, end_reason) — family-scoped SELECT + INSERT + owner-only UPDATE RLS"
  - "public.family_subscription.remote_listen_enabled boolean DEFAULT true — remote kill switch, probed before every startRemoteAudioCapture"
  - "public.sos_events immutable audit table (id, family_id, sender_user_id, receiver_user_ids[], triggered_at, delivery_status jsonb, client_request_hash) — insert-only RLS, UPDATE/DELETE policies intentionally absent"
  - "public.kkuk_check_cooldown(uuid) RETURNS boolean SECURITY DEFINER RPC — 5 s per-sender throttle from sos_events"
  - "src/App.jsx GATE-01/02 pre-pair early-return (L5858 region) — unpaired child never mounts main UI tree"
  - "src/App.jsx start/stopRemoteAudioCapture audit-logging + feature-flag + RL-04 beforeunload/pagehide cleanup"
  - "src/App.jsx listeningSession state + top-fixed red banner + navigator.vibrate(200) indicator (RL-02)"
  - "src/App.jsx sendKkuk server-cooldown RPC call + crypto.randomUUID dedup_key + sos_events audit insert"
  - "src/App.jsx onKkuk receiver-side LRU Map dedup (60 s window)"
  - "src/App.jsx kkuk button press-hold [500, 2000] ms gate (onMouseDown/Up/onTouchStart/End ref)"
  - "android/app/src/main/java/com/hyeni/calendar/MainActivity.java — WebChromeClient.onPermissionRequest gated on RECORD_AUDIO runtime grant (no more unconditional .grant())"
  - "android/app/src/main/java/com/hyeni/calendar/AmbientListenService.java (NEW) — microphone-type FGS stub with ongoing CATEGORY_SERVICE notification"
  - "android/app/src/main/AndroidManifest.xml — FOREGROUND_SERVICE_MICROPHONE permission + <service foregroundServiceType=microphone exported=false /> declaration"
affects: [v1.1-native-deploy]

# Tech tracking
tech-stack:
  added:
    - "crypto.randomUUID() dedup_key primitive (KKUK-02) with string-concat fallback for environments lacking crypto.randomUUID"
    - "NotificationCompat foreground service channel (IMPORTANCE_LOW, CATEGORY_SERVICE, VISIBILITY_PUBLIC) — Play Store stalkerware-compliance pattern"
  patterns:
    - "Fail-open server cooldown: kkuk_check_cooldown RPC error or throw → client sends anyway. Never let a degraded DB block an emergency signal."
    - "Audit-row-before-capture: remote_listen_sessions row opens BEFORE navigator.mediaDevices.getUserMedia so even a mic-denial or crash inside getUserMedia leaves a closable row."
    - "Fire-and-forget append audit: sos_events + remote_listen_sessions UPDATE errors are logged but never block the user-visible action."
    - "Window-global session id handoff (window._remoteListenSessionId + _remoteListenStartedAt) between module-level capture functions and the React component's beforeunload cleanup — avoids plumbing additional React state through Capacitor-bridged FGS plans in v1.1."

key-files:
  created:
    - "supabase/migrations/20260421113053_phase5_safety_tables_and_rpc.sql"
    - "supabase/migrations/down/20260421113053_phase5_safety_tables_and_rpc.sql"
    - "android/app/src/main/java/com/hyeni/calendar/AmbientListenService.java"
    - ".planning/phases/05-ux-safety-hardening/05-01-SUMMARY.md"
  modified:
    - "src/App.jsx"
    - "android/app/src/main/java/com/hyeni/calendar/MainActivity.java"
    - "android/app/src/main/AndroidManifest.xml"

key-decisions:
  - "Fail-open server cooldown (KKUK-03): RPC error or exception → client sends anyway with warn-level log. Hard-veto only when RPC explicitly returns FALSE. Rationale: emergency signalling must never be DB-fragile."
  - "Audit-row-before-capture ordering (RL-01 / RL-04): remote_listen_sessions INSERT happens BEFORE navigator.mediaDevices.getUserMedia() so a permission-denied or crash during mic acquisition still leaves a row that beforeunload/pagehide or a later manual stop can close with end_reason='permission_denied' / 'page_unload' / 'timeout'."
  - "LRU dedup on receive, not on server (KKUK-02): receiver-side Map < 60 s > pruned each receive. Keeps server schema tiny and dedup latency ≤ wall-clock; acceptable because sos_events already has the auditable record."
  - "receiver_user_ids = opposite-role family members (SOS-01): parent-senders page children and vice versa. We exclude the sender's own user_id defensively even though family-scope RLS prevents self-rows."
  - "Android Play Store compliance authored-only (D-B06): AmbientListenService.java + AndroidManifest.xml service declaration + FOREGROUND_SERVICE_MICROPHONE permission committed, but Capacitor bridge wiring + Gradle APK rebuild + Play internal-track submission explicitly DEFERRED to v1.1 native-deploy. This phase's deliverable is the policy-compliant source surface, not a shipping APK."
  - "WebView honor-legacy-consent via OS-permission check (RL-03): onPermissionRequest now gates on ContextCompat.checkSelfPermission(RECORD_AUDIO) instead of unconditional .grant(). Users who previously granted RECORD_AUDIO at first launch continue to have the WebView request forwarded; users who revoked or never granted get .deny() + a 'mic-permission-denied' DOM event for future JS consent UI. localStorage-flag approach was rejected because onPermissionRequest runs synchronously on the UI thread and cannot await the JS bridge."
  - "Feature flag default TRUE (D-B07): family_subscription.remote_listen_enabled defaults TRUE so migration apply is a pure no-op for existing 67 families. Only a hard FALSE disables remote listen."
  - "GATE-01/02 via early-return, not overlay: the old ChildPairInput at L6820 was rendered as an overlay on top of the main UI tree, which still mounted memos/kkuk/realtime hooks for unpaired children. The new early-return at L5858 prevents the entire tree from rendering so no accidental subscribes, fetches, or writes can fire pre-pair."

# Metrics
duration: "~10 min (single-agent combined plan+execute)"
tasks_completed: 6
completed: 2026-04-21
---

# Phase 5 Plan 01: UX & Safety Hardening Summary

**One-liner:** Combined plan+execute Phase 5 — pre-pair UI gate early-return, remote-listen audit + FGS-microphone spec + kill switch, 꾹 press-hold + dedup_key + server cooldown + immutable sos_events audit log; 10 REQs closed in one pass.

## Performance

| Metric | Value |
|--------|-------|
| Start | 2026-04-21T11:30:49Z |
| Duration | ~10 min |
| Tasks completed | 6 / 6 |
| Atomic commits | 6 |
| Files created | 4 |
| Files modified | 3 |
| Build status | ✅ `npx vite build` clean (pre-existing warnings only) |
| Test status | ⚠ 19/20 vitest pass (1 pre-existing failure in tests/entitlementCache.test.js — unrelated to Phase 5; stub localStorage harness issue on HEAD~) |

## Accomplishments

Ten v1 REQs closed in a single combined plan+execute:

- **GATE-01** · Pre-pair UI gate: unpaired child renders only ChildPairInput.
- **GATE-02** · On unpair (familyInfo → null), early-return naturally returns child to gate.
- **RL-01** · remote_listen_sessions table + family-scoped RLS + INSERT-before-capture / UPDATE-on-stop lifecycle.
- **RL-02** · Child-side persistent top-fixed red banner + navigator.vibrate(200) for entire session.
- **RL-03** · Android WebChromeClient no longer auto-grants mic; RECORD_AUDIO runtime grant gate + JS 'mic-permission-denied' event on deny.
- **RL-04** · beforeunload + pagehide cleanup handlers close the audit row with end_reason='page_unload'; 30s MediaRecorder timeout closes with 'timeout'.
- **KKUK-01** · Press-hold gate on kkuk button; 500–2000 ms window via refs.
- **KKUK-02** · crypto.randomUUID dedup_key in payload + 60s LRU Map on receiver.
- **KKUK-03** · kkuk_check_cooldown(sender) SECURITY DEFINER RPC; client calls before broadcast, fail-open on RPC error.
- **SOS-01** · sos_events immutable audit table (insert-only RLS, UPDATE/DELETE absent); every sendKkuk appends row with dedup_key as client_request_hash, delivery_status per channel.

## Task Commits

| Task | Hash | Subject |
|------|------|---------|
| 1 — SQL migration | `6e8baf1` | feat(05-01): phase 5 safety surface migration (RL + SOS + cooldown RPC) |
| 2 — GATE-01/02 | `55efb6f` | feat(05-02): pre-pair UI gate early-return for child sessions |
| 3 — RL-01..04 | `2fe1240` | feat(05-03): remote listen accountability (session log, indicator, cleanup, kill switch) |
| 4 — Android native | `791b739` | feat(05-04): android native — remove webview mic auto-grant + FGS-microphone service spec |
| 5 — KKUK + SOS | `6eb8684` | feat(05-05): kkuk press-hold + dedup + server cooldown + sos audit log |
| 6 — Docs | *(this commit)* | docs(05-06): phase 5 summary + state + roadmap + requirements |

## Files Created/Modified

**Created (4):**
- `supabase/migrations/20260421113053_phase5_safety_tables_and_rpc.sql` (up)
- `supabase/migrations/down/20260421113053_phase5_safety_tables_and_rpc.sql` (paired down)
- `android/app/src/main/java/com/hyeni/calendar/AmbientListenService.java`
- `.planning/phases/05-ux-safety-hardening/05-01-SUMMARY.md`

**Modified (3):**
- `src/App.jsx` — module-level startRemoteAudioCapture/stopRemoteAudioCapture refactor, closeRemoteListenSessionRow helper, listeningSession state + indicator render, GATE-01/02 early-return, onKkuk LRU dedup, sendKkuk cooldown RPC + dedup_key + sos_events insert, kkuk button press-hold rewrite, beforeunload/pagehide handlers
- `android/app/src/main/java/com/hyeni/calendar/MainActivity.java` — WebChromeClient.onPermissionRequest gated on hasRecordAudioPermissionGranted(); deny path dispatches mic-permission-denied event
- `android/app/src/main/AndroidManifest.xml` — FOREGROUND_SERVICE_MICROPHONE permission + AmbientListenService declaration (microphone type, not exported)

## Decisions Made

See frontmatter `key-decisions`. Abbreviated:

1. Fail-open server cooldown (KKUK-03) — emergency signal > DB fragility.
2. Audit-row-before-capture ordering (RL-01 / RL-04) — ensure every capture attempt is traceable.
3. LRU dedup on receiver, not server (KKUK-02) — schema simplicity, sos_events already provides audit record.
4. Android native author-only (D-B06) — Play Store compliance artefacts committed, APK build/submission deferred to v1.1 native-deploy.
5. WebView honor-legacy-consent via OS-permission check (RL-03) — synchronous UI-thread callback precludes localStorage flag approach.
6. Feature flag default TRUE — zero-impact migration apply.
7. GATE-01/02 via early-return — eliminates accidental pre-pair subscribes/fetches/writes.

## Deviations from Plan

### Rule 2 (missing-critical additions)

**1. [Rule 2 — Security] Owner-only UPDATE policy on remote_listen_sessions**
- **Found during:** Task 1 SQL drafting
- **Issue:** Plan only specified SELECT + INSERT RLS policies. But the client must `UPDATE ended_at / duration_ms / end_reason` when a session stops — without an UPDATE policy authenticated UPDATEs fail silently (or loudly), leaving dangling open rows.
- **Fix:** Added `rls_remote_listen_update_owner` policy restricting UPDATE to rows where `initiator_user_id = auth.uid() OR child_user_id = auth.uid()` within the same family. Service_role still bypasses for out-of-band cleanup.
- **Files modified:** `supabase/migrations/20260421113053_phase5_safety_tables_and_rpc.sql` (up + down)
- **Commit:** `6e8baf1`

**2. [Rule 2 — Safety] beforeunload AND pagehide listener (mobile Safari / bfcache)**
- **Found during:** Task 3 implementation
- **Issue:** Plan called for `beforeunload` only. Mobile Safari and Firefox-on-Android frequently skip `beforeunload` when pages enter bfcache; `pagehide` fires reliably in both cases.
- **Fix:** Listener attached to both events with the same `stopRemoteAudioCapture('page_unload')` handler.
- **Files modified:** `src/App.jsx`
- **Commit:** `2fe1240`

**3. [Rule 2 — Robustness] kkuk button onTouchCancel cleanup + e.preventDefault on touchend**
- **Found during:** Task 5 implementation
- **Issue:** Plan example did not handle `touchcancel` (swipe-off-button), which leaves `kkukHoldStart` ref non-zero until next mousedown — causing a stale calculation on the next valid press. Also, Android WebViews sometimes double-fire click after touchend, which would then ALSO fire sendKkuk via the no-op click handler.
- **Fix:** Added `onTouchCancel={() => { kkukHoldStart.current = 0; }}` and `e.preventDefault()` in onTouchEnd to suppress synthesized click.
- **Files modified:** `src/App.jsx`
- **Commit:** `6eb8684`

### Rule 3 (blocking-issue fixes)

**4. [Rule 3 — Consistency] stopRemoteAudioCapture("timeout") argument for max-duration timer**
- **Found during:** Task 3 implementation
- **Issue:** The existing `setTimeout(() => stopRemoteAudioCapture(), maxDurationMs)` call now passes no argument into the refactored `stopRemoteAudioCapture(endReason)`, which would then write `end_reason='unspecified'` even when the reason is plainly "timeout".
- **Fix:** Updated callsite to pass `"timeout"` explicitly.
- **Files modified:** `src/App.jsx`
- **Commit:** `2fe1240`

## Authentication Gates

None. Supabase MCP-equivalent path (`npx supabase db query --linked`) was pre-authenticated via `.env.local` (SUPABASE_ACCESS_TOKEN), mirroring the Phase 2 / 4 execution pattern documented in STATE.md.

## Issues Encountered

- `bash` command-line length limit on Windows when piping the full migration SQL via `supabase db query "$(cat ...)"` — resolved by using `--file` flag (CLI documents it; verified via `--help`).
- One pre-existing failing vitest case (`tests/entitlementCache.test.js`) confirmed present on HEAD~ before Phase 5 edits; logged as a Deferred Item.

## Known Stubs

**AmbientListenService integration is stubbed.** The Java class is authored, the manifest declares it, and the microphone FGS permission is requested, but there is no Capacitor bridge wiring in JS to actually `startService()` / `stopService()` for this class. Per CONTEXT D-B06, the actual wiring and APK rebuild are DEFERRED to v1.1 native-deploy. On the current v1.0 APK, remote listen continues to use the WebView MediaRecorder path from `startRemoteAudioCapture` — which Play Store's family-exception review may or may not accept before v1.1 ships the FGS.

**mic-permission-denied JS consent UI not present.** MainActivity now dispatches a `mic-permission-denied` DOM event when the WebView PermissionRequest is denied, but no JS listener is wired in App.jsx to show a consent dialog. v1.1 native-deploy owns that listener.

## User Setup Required

None for migration apply. The `family_subscription.remote_listen_enabled` kill switch defaults TRUE so every existing family keeps current behaviour.

For kill-switch-off testing in a Supabase branch:
```sql
UPDATE public.family_subscription SET remote_listen_enabled = false WHERE family_id = '<branch-test-family>';
-- Verify: client receives `remote_listen_disabled_by_family` error on attempted start; no stream, no audit row.
```

## Threat Flags

None introduced by this phase — all new surfaces either tighten existing ones (WebView mic auto-grant removed, kkuk now gated by server cooldown + sos_events append) or add net-new audit trails (remote_listen_sessions, sos_events). Both new tables have defensive RLS:

- `remote_listen_sessions` — family-scoped SELECT + INSERT + owner-scoped UPDATE; no DELETE policy (service_role only).
- `sos_events` — family-scoped SELECT + insert-only (sender_user_id = auth.uid()); no UPDATE, no DELETE — service_role bypass only.

## Phase 5 DoD — v1.1 Native-Deploy Caveat

**What shipped this phase:**
- All SQL objects (live, applied to main branch of `qzrrscryacxhprnrtpjd`).
- All JS changes (GATE-01/02, RL-01/02/04, KKUK-01/02/03, SOS-01) built cleanly with `npx vite build`.
- Android source-level Play Store compliance artefacts: MainActivity mic gate, AmbientListenService.java, manifest declarations, FOREGROUND_SERVICE_MICROPHONE permission.

**What is deferred to v1.1 native-deploy (not blocking v1.0 DoD):**
- Capacitor plugin/bridge method to invoke `AmbientListenService` from JS.
- Android Gradle rebuild + APK signing + Play internal-track submission.
- JS listener for `mic-permission-denied` DOM event → in-app consent UI.
- Play Store stalkerware family-exception self-certification form.

Per CLAUDE.md milestone rules + CONTEXT §D-B06, this caveat is expected and documented; it does not block Phase 5 completion because the Phase 5 scope is explicitly "v1.0 safety hardening with the native-deploy ticket trailing."

## Next Phase Readiness

Phase 5 is the final phase of v1.0 Production Stabilization. No successor phase in this milestone. The v1.1 native-deploy ticket inherits:

- `AmbientListenService.java` authored and awaiting Capacitor wiring.
- `mic-permission-denied` DOM event hook awaiting JS listener.
- Play Store family-exception submission.
- Remote listen APK smoke test (device + emulator).

## Self-Check: PASSED

- Files created verified via filesystem:
  - `supabase/migrations/20260421113053_phase5_safety_tables_and_rpc.sql` ✅
  - `supabase/migrations/down/20260421113053_phase5_safety_tables_and_rpc.sql` ✅
  - `android/app/src/main/java/com/hyeni/calendar/AmbientListenService.java` ✅
  - `.planning/phases/05-ux-safety-hardening/05-01-SUMMARY.md` ✅ (this file)
- Commits verified via `git log --oneline`:
  - `6e8baf1` ✅ feat(05-01)
  - `55efb6f` ✅ feat(05-02)
  - `2fe1240` ✅ feat(05-03)
  - `791b739` ✅ feat(05-04)
  - `6eb8684` ✅ feat(05-05)
- SQL objects verified via `supabase db query --linked`:
  - `public.remote_listen_sessions` exists ✅
  - `public.sos_events` exists ✅
  - `public.family_subscription.remote_listen_enabled` column exists ✅
  - `public.kkuk_check_cooldown` RPC callable (returns TRUE for empty sos_events on synthetic UUID) ✅
  - RLS enabled on both new tables; 3 policies on remote_listen_sessions (SELECT/INSERT/UPDATE-owner), 2 on sos_events (SELECT/INSERT) ✅
- Build verified: `npx vite build` clean (pre-existing warnings only). ✅
