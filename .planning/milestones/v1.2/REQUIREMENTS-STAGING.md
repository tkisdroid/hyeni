# Requirements (STAGING): 혜니캘린더 v1.2 — Sound Around & Consent Port

> **STATUS: STAGING.** This file will be promoted to `.planning/REQUIREMENTS.md`
> (as the v1.2 Active section) on `/gsd-complete-milestone v1.1`. Until then,
> the live REQUIREMENTS.md remains the v1.1 surface.
>
> **Source plan (authoritative):** `C:/Users/A/.claude/plans/hyeni-modular-chipmunk.md`
>
> Section labels in the "Plan ref" column point back into that plan so every
> REQ retains its original derivation context (no re-decisions here).

## REQ Count

**14 v1.2 REQs**, grouped into five categories mapped 1:1 onto Phases 9–13.

| Category | Prefix | Count | REQ IDs |
| --- | --- | --- | --- |
| Signaling & Consent Foundations (Phase 9) | SIG / CONSENT / FLAG | 3 | SIG-01, CONSENT-01, FLAG-01 |
| WebRTC Audio Pipeline (Phase 10) | RTC | 4 | RTC-01, RTC-02, RTC-03, RTC-04 |
| Bridge · Consent UX · Legacy Kill (Phase 11) | BRIDGE / CONSENT / LEGACY-KILL | 4 | BRIDGE-01, CONSENT-02, CONSENT-03, LEGACY-KILL-01 |
| APK Rebuild & Play Submission (Phase 12) | APK | 2 | APK-01, APK-02 |
| Two-Device E2E Verification (Phase 13) | E2E | 2 | E2E-01, E2E-02 |
| **Total** | — | **14** | — |

Coverage: 14/14 REQs mapped → exactly one Phase each, no orphans, no
duplicates.

## Active (v1.2)

### Phase 9 — Signaling Schema & Consent Foundations

#### SIG-01 — WebRTC signaling table, RLS, idempotent messages

- **Goal:** Create the `webrtc_signaling` append-only table that backs
  Stability-First Decision #1 (table-backed + realtime broadcast dual-path),
  letting signaling survive a dropped broadcast message and giving every
  session a replayable audit trail.
- **Spec:**
  - New migration: `supabase/migrations/NNNNNN_webrtc_signaling.sql` + `down/`.
  - Columns: `id` (pk), `session_id` (FK → `remote_listen_sessions.id`),
    `from_user_id`, `to_user_id`, `kind ENUM('offer','answer','ice','bye')`,
    `msg_id uuid`, `payload jsonb`, `created_at`, `acked_at`.
  - Indexes: `UNIQUE(session_id, msg_id)` for idempotent retransmit dedup.
  - RLS: SELECT/INSERT restricted to members of `session_id`'s owning
    `family_id`; DELETE restricted to service role; append-only (no UPDATE).
  - Added to Supabase Realtime publication (named channel
    `signaling:<session_id>` is subscribed client-side in RTC-03).
  - TTL cleanup: pg_cron job prunes rows >5 min past session end, reusing the
    v1.1 Phase 6 IDEMP-TTL-01 pattern.
- **Verification:** migration up+down applies clean, `pg_policies` diff
  reviewed, non-family account SELECT returns 0 rows, duplicate
  `(session_id, msg_id)` INSERT is rejected.
- **Out of scope:** audio payload transport (that is RTC-03, over this table +
  broadcast).
- **Plan ref:** `hyeni-modular-chipmunk.md` → "Phase 9 — Signaling Schema &
  Consent Foundations" → SIG-01 bullet.

#### CONSENT-01 — `family_agreements` table + session-start guard

- **Goal:** Make a signed, versioned guardian agreement a hard prerequisite
  for any `remote_listen_sessions` row, satisfying PIPA <14 and Google Play
  family-exception.
- **Spec:**
  - New migration: `supabase/migrations/NNNNNN_family_agreements.sql` + `down/`.
  - Columns: `family_id`, `legal_rep_user_id`, `agreed_at`,
    `agreement_version`, `signature_sha256` (sha256 over shown disclosure
    text), `remote_listen_enabled` (per-agreement override).
  - RLS: family-scoped SELECT; INSERT restricted to the family's legal rep
    only; DELETE blocked (compliance audit trail).
  - Guard: `remote_listen_sessions` INSERT must pre-check an active
    `family_agreements` row (implemented via trigger OR RPC guard — finalized
    in `/gsd-discuss-phase 9`).
- **Verification:** start attempt without an agreement row fails at DB level
  (not client-side only); guard test covered in Phase 11 Playwright
  `consent-flow.spec.js`.
- **Out of scope:** the UX that writes the row (that is CONSENT-02).
- **Plan ref:** `hyeni-modular-chipmunk.md` → Phase 9 → CONSENT-01 bullet.

#### FLAG-01 — `feature_flags` table + `remote_listen_v2_enabled` gate

- **Goal:** Stability-First Decision #7: let v1.2 ship to devices with RL v2
  OFF, then flip server-side after manual verification, without
  child-device reinstall.
- **Spec:**
  - New migration: `supabase/migrations/NNNNNN_feature_flags.sql` + `down/`.
  - Columns: `key` (pk), `enabled bool`, `updated_at`.
  - Seed row: `('remote_listen_v2_enabled', false, now())` at migration time.
  - Session-start RPC (from CONSENT-01) additionally checks this flag; when
    off, returns `feature_disabled`.
  - Flip procedure (direct SQL UPDATE vs admin RPC) → resolved in
    `/gsd-discuss-phase 9` (Open Question #6).
- **Verification:** with flag=false, start returns `feature_disabled`;
  flipping to true unblocks; v1.0 kill switch
  `family_subscription.remote_listen_enabled` still overrides (fail-closed).
- **Out of scope:** generalized feature-flag UI; this is RL-only for v1.2.
- **Plan ref:** `hyeni-modular-chipmunk.md` → Phase 9 → FLAG-01 bullet.

### Phase 10 — WebRTC Audio Pipeline

#### RTC-01 — Parent receiver module

- **Goal:** Replace the legacy `broadcast`-based audio playback with a
  `RTCPeerConnection` whose `ontrack` feeds a hidden `HTMLAudioElement`,
  plus ICE-state health-check per Stability-First Decision #4.
- **Spec:**
  - New module: `src/lib/audio/parentPeer.js`.
  - `App.jsx` lines 2500–2520 (legacy broadcast call site) replaced with a
    minimal call into `parentPeer.js` — **App.jsx decomposition remains
    forbidden**, only line-range substitution.
  - `iceConnectionState` listener: `disconnected` → 5s grace → `failed` →
    parent toast + audit row `end_reason='network_lost'`.
  - `RTCPeerConnection.close()` is idempotent and exposed for session-end
    cleanup.
- **Verification:** unit test in jsdom with `RTCPeerConnection` mock;
  localhost two-tab loopback plays audio end-to-end.
- **Out of scope:** child sender (RTC-02), signaling (RTC-03), TURN (RTC-04).
- **Plan ref:** Phase 10 → RTC-01 bullet.

#### RTC-02 — Child sender module

- **Goal:** Replace MediaRecorder+broadcast emit loop with
  `getUserMedia({audio:true})` → `addTrack` → WebRTC peer, plus
  Capacitor-driven FGS finalizer per Stability-First Decision #5.
- **Spec:**
  - New module: `src/lib/audio/childPeer.js`.
  - `App.jsx` lines 4750–4782 (legacy sender callback) replaced with a
    minimal call into `childPeer.js` — minimum-line replacement only.
  - `MainActivity.java:167–186` `__REMOTE_LISTEN_REQUESTED` flag **retained**
    to preserve the FCM-wake trigger path built in v1.1.
  - On `RTCPeerConnection.close()` (natural end OR page unload OR visibility
    hidden OR crash), a Capacitor finalizer invokes
    `AmbientListenPlugin.stop()` (provided by BRIDGE-01) so FGS never leaks.
- **Verification:** unit test in jsdom; device-side `adb logcat` confirms
  `AmbientListenService onDestroy` on JS close.
- **Out of scope:** the native plugin itself (BRIDGE-01).
- **Plan ref:** Phase 10 → RTC-02 bullet.

#### RTC-03 — Hybrid signaling (broadcast + DB backup + ACK/retransmit)

- **Goal:** Stability-First Decision #3: no single dropped SDP/ICE/BYE kills
  a session.
- **Spec:**
  - New module: `src/lib/audio/signaling.js`.
  - Dual transport: primary `supabase.channel('signaling:' + sessionId)` +
    secondary `webrtc_signaling` INSERT/SELECT; send on both simultaneously;
    receive dedups by `msg_id`.
  - Event kinds: `offer`, `answer`, `ice`, `bye`, `ack`.
  - Each outbound carries `msg_id uuid`; 3s without matching `ack` →
    retransmit **exactly once**; duplicates are idempotent under the
    `(session_id, msg_id)` UNIQUE from SIG-01.
  - Final failure after retransmit → parent-side "연결 실패 — 다시 시도"
    toast.
  - Session end → channel unsubscribe; row cleanup handled by SIG-01's TTL
    cron.
- **Verification:** unit test injects a single-message drop; session still
  establishes via retransmit; duplicates are silently dedupped.
- **Out of scope:** payload audio (that lives on the WebRTC data path, not
  here).
- **Plan ref:** Phase 10 → RTC-03 bullet.

#### RTC-04 — STUN + TURN with server-issued short-lived credentials

- **Goal:** Stability-First Decision #2: ship TURN in v1.2 (not deferred to
  v1.3) to close the 10–20% NAT/symmetric-network failure tail.
- **Spec:**
  - STUN: `stun:stun.l.google.com:19302` default.
  - TURN: provider resolved in `/gsd-discuss-phase 10` (Cloudflare Calls free
    tier vs coturn self-host).
  - New edge function:
    `supabase/functions/issue-turn-credential/index.ts`. Verifies the
    Supabase JWT + active `family_agreements` row + `feature_flags.remote_listen_v2_enabled`
    and returns a short-lived (≤1h) TURN credential.
  - Client **never** embeds the TURN password; it fetches fresh credentials
    at session start.
- **Verification:** 401 unauth'd; 200 auth'd; credential TTL observed; no
  TURN password visible in bundled JS or localStorage.
- **Out of scope:** TURN server provisioning (ops task, tracked in the
  discuss phase).
- **Plan ref:** Phase 10 → RTC-04 bullet.

### Phase 11 — Capacitor Bridge · Consent UX · Legacy Kill

#### BRIDGE-01 — `AmbientListenPlugin` Capacitor plugin with finalizer

- **Goal:** Give JS a clean `start(sessionId)` / `stop()` interface to the
  existing `AmbientListenService`, with FGS lifecycle hardened per
  Stability-First Decision #5 so FGS cannot outlive the JS session.
- **Spec:**
  - New native class: `android/app/src/main/java/com/hyeni/calendar/AmbientListenPlugin.java`.
  - `start(sessionId)` → `startForegroundService(AmbientListenService.class)`
    with a session-id extra and a 1-session-only guard (second concurrent
    `start` rejected).
  - `stop()` → `stopService(AmbientListenService.class)`.
  - `MainActivity.java:33` — add `registerPlugin(AmbientListenPlugin.class)`.
  - JS-side hooks in `childPeer.js`: `onDestroy` / `unload` /
    `visibilitychange(hidden)` all invoke `stop()`.
- **Verification:** `adb logcat` shows `AmbientListenService onDestroy`
  within 1s of JS close across all three close paths.
- **Out of scope:** new audio-processing in native — the plugin is a
  lifecycle shim only.
- **Plan ref:** Phase 11 → BRIDGE-01 bullet.

#### CONSENT-02 — Pairing-time full-screen agreement modal + signature commit

- **Goal:** Make PIPA+Play-compliant consent a mandatory gate on the pairing
  flow, with a cryptographic signature of the exact shown disclosure text.
- **Spec:**
  - New components: `src/components/consent/AgreementModal.jsx`.
  - New helper: `src/lib/consent/agreement.js` — generates
    `signature_sha256` over the shown disclosure text and commits the
    `family_agreements` row (via CONSENT-01's guard).
  - Trigger: immediately after the child accepts a valid pair code; the
    pairing is **not** finalized until the modal is submitted.
  - Copy: two variants (PIPA wording + Play family-exception wording) —
    legal copy locked in `/gsd-discuss-phase 11` (no `--auto`).
  - UI-SPEC produced by `/gsd-ui-phase 11` — pattern reference FindMyKids
    `AgreementFragment`.
- **Verification:** Playwright real-config `consent-flow.spec.js` confirms
  skipping the modal blocks pairing finalization and blocks session-start
  RPC with 403.
- **Out of scope:** in-session indicators (CONSENT-03); retroactive consent
  rollout for existing live families (Open Question #3).
- **Plan ref:** Phase 11 → CONSENT-02 bullet.
- **UI hint:** yes

#### CONSENT-03 — Child-side session-in-progress indicator hardening

- **Goal:** Every active listen session is simultaneously visible through a
  full-width red in-app banner AND an Android persistent notification, with
  no dev-mode or user-mode toggle to hide either.
- **Spec:**
  - New component: `src/components/consent/ChildSessionBanner.jsx`.
  - `App.jsx:3988` `listeningSession` state drives the banner: full-width
    red bar + 200ms vibrate + copy "🎤 부모님이 주변 소리를 듣고 있어요".
  - Simultaneously, `AmbientListenService` posts a persistent notification
    titled "주변 소리 연결 중" (non-dismissable while FGS is alive).
  - Session end tears down both indicators within 1s.
- **Verification:** device test: both indicators appear on session start;
  both disappear within 1s of session end; neither can be hidden via app
  settings.
- **Out of scope:** UX polish / animation variants (may be scheduled
  opportunistically in Phase 11 UI polish).
- **Plan ref:** Phase 11 → CONSENT-03 bullet.
- **UI hint:** yes

#### LEGACY-KILL-01 — Remove v1.0 broadcast audio transport

- **Goal:** Eliminate the dual-transport risk window by removing the v1.0
  `broadcast`-based audio chunk path from the client, lib, and edge
  function. Audit and kill-switch surfaces stay.
- **Spec — removals:**
  - `src/App.jsx`: delete the broadcast handlers at lines 319–361,
    2502–2509, 4750–4810 (replaced by RTC-01 / RTC-02 call sites).
  - `src/lib/sync.js`: delete the audio-chunk broadcast listener at lines
    561 and 700–707.
  - `supabase/functions/push-notify/index.ts`: at lines 313 and 405–406,
    shrink the `action === 'remote_listen'` branch to a minimal data-wake
    message (`session_id` + `action` only). Keep the wake path.
- **Spec — retentions:**
  - `remote_listen_sessions` audit row INSERT continues — now fed from the
    WebRTC path.
  - `family_subscription.remote_listen_enabled` kill switch stays
    fail-closed.
- **Verification:** grep for `audio_chunk`, `remote_listen_start`,
  `remote_listen_stop` broadcast listeners returns 0 live call sites;
  SEC-01 (push-notify sender ∈ family) regression check.
- **Out of scope:** dropping the broadcast channel entirely — it is reused
  for signaling (RTC-03); only the audio-chunk handlers are removed.
- **Plan ref:** Phase 11 → LEGACY-KILL-01 bullet.

### Phase 12 — APK Rebuild & Play Replacement Submission

#### APK-01 — Signed AAB/APK rebuild via v1.1 CI

- **Goal:** Produce a v1.2 signed Android artifact via the v1.1 Phase 6
  `android-apk.yml` workflow, containing all v1.2 native + web changes
  (notably BRIDGE-01).
- **Spec:**
  - No edits to `.github/workflows/android-apk.yml` (v1.1 Phase 6 asset).
  - No new CI secrets; existing FCM `google-services.json` and signing
    keystore reused.
  - Bumped `versionCode` (and human-visible `versionName`) for v1.2.
  - `aapt dump badging` must report `foregroundServiceType microphone`.
- **Verification:** artifact downloads from Actions; `aapt dump badging`
  output committed to phase evidence; no new dep appears in `package.json`.
- **Out of scope:** iOS (project is Android-only per v1.0 stack lock).
- **Plan ref:** Phase 12 → APK-01 bullet.

#### APK-02 — Play Console internal track upload with updated copy

- **Goal:** Push the v1.2 artifact into Google Play internal testing so the
  same testers from v1.1 receive it as a superseding build.
- **Spec:**
  - Upload AAB to the existing internal testing track (v1.1 Phase 7
    precedent).
  - Family-exception copy extended with a clause: "WebRTC direct-peer
    audio, no third-party storage."
  - Tester list unchanged from v1.1.
- **Verification:** Play Console upload returns 200; at least one tester
  receives auto-install; launching shows v1.2 version string.
- **Out of scope:** promotion to production / closed / open tracks.
- **Plan ref:** Phase 12 → APK-02 bullet.

### Phase 13 — Two-Device E2E Verification

#### E2E-01 — 10× consecutive live-session pass, 2 real devices

- **Goal:** Stability-First Decision #6: no probabilistic flakiness tolerated
  — 10 consecutive clean runs or nothing.
- **Spec — scenario (each run):**
  - Parent device + child device, paired, `remote_listen_v2_enabled=true`,
    `family_agreements` row active.
  - Parent triggers session → FCM wake → child banner + FGS notification
    appear → 30s+ continuous audio plays on parent device → parent stops →
    banner + FGS disappear within 1s → `remote_listen_sessions` single row
    with `started_at`, `ended_at`, `duration_ms`, `end_reason='user_stopped'`.
- **Pass bar:** **10 of 10 consecutive.** A single failure fails E2E-01 and
  resets the counter.
- **Verification:** manual checklist (no Playwright); DB evidence captured
  in phase summary.
- **Out of scope:** Play-track-install verification (shared with APK-02 from
  Phase 12).
- **Plan ref:** Phase 13 → E2E-01 bullet.

#### E2E-02 — Four edge cases, all mandatory

- **Goal:** Stability-First Decision #6 made explicit: **4 of 4 required**
  for Phase 13 PASS. Any single failure rejects the milestone.
- **Spec — cases:**
  - (a) **Mic denied** on child device → session
    `end_reason='permission_denied'` + parent-side retry-guidance toast.
  - (b) **Child Wi-Fi off for 10s then restored** mid-session → WebRTC
    auto-renegotiation succeeds **OR** `end_reason='network_lost'`
    recorded + parent-side "다시 시도" button appears.
  - (c) **Child app fully killed** (force-stop) → parent trigger wakes the
    child within 15s via FCM data-message and session establishes.
  - (d) **No active `family_agreements` row** → session-start RPC returns
    403 with "먼저 페어링 동의를 완료하세요" UI on the parent side.
- **Verification:** manual; each of the 4 cases yields the expected DB row
  and the expected UI signal, documented in phase summary.
- **Out of scope:** adversarial testing beyond these 4 (additional edge
  cases may be filed as v1.3+ REQs).
- **Plan ref:** Phase 13 → E2E-02 bullet.

## Out of Scope (v1.2)

These are intentionally **excluded** from v1.2 and tracked for future
milestones. They must not silently re-enter scope during phase discuss /
plan.

- **SOS port from FindMyKids** → v1.3 "SOS Hardening" milestone
  (`project_findmykids_sos_port_scope`, `feedback_kkuk_vs_sos_distinction`).
  v1.2 must not touch `sos_events`, `SosOverlayActivity`, DND-bypass
  channels, or KKUK code paths.
- **KKUK (꾹) affection-tap** — untouched in v1.2. Improvements scheduled
  v1.4+ (`feedback_kkuk_vs_sos_distinction`).
- **Child name-card → zoom-in live-location map** — may opportunistically
  land in Phase 11 UI polish (UI-SPEC decision); otherwise **v1.3**
  (`project_child_location_zoom_on_card_click`). Flagged as Open Question
  #7 in ROADMAP-STAGING.md.
- **App.jsx decomposition / TypeScript migration** — forbidden for v1.2 per
  CLAUDE.md.
- **New npm dependencies** — none permitted.
- **VAPID key rotation** — locked.
- **Observability dashboard (OBS-01..03)** — deferred to a later milestone.

## Traceability (v1.2)

| REQ | Phase | Status | Plan-file Section |
|-----|-------|--------|-------------------|
| SIG-01 | Phase 9 | Staging (not started) | Phase 9 → SIG-01 |
| CONSENT-01 | Phase 9 | Staging (not started) | Phase 9 → CONSENT-01 |
| FLAG-01 | Phase 9 | Staging (not started) | Phase 9 → FLAG-01 |
| RTC-01 | Phase 10 | Staging (not started) | Phase 10 → RTC-01 |
| RTC-02 | Phase 10 | Staging (not started) | Phase 10 → RTC-02 |
| RTC-03 | Phase 10 | Staging (not started) | Phase 10 → RTC-03 |
| RTC-04 | Phase 10 | Staging (not started) | Phase 10 → RTC-04 |
| BRIDGE-01 | Phase 11 | Staging (not started) | Phase 11 → BRIDGE-01 |
| CONSENT-02 | Phase 11 | Staging (not started) | Phase 11 → CONSENT-02 |
| CONSENT-03 | Phase 11 | Staging (not started) | Phase 11 → CONSENT-03 |
| LEGACY-KILL-01 | Phase 11 | Staging (not started) | Phase 11 → LEGACY-KILL-01 |
| APK-01 | Phase 12 | Staging (not started) | Phase 12 → APK-01 |
| APK-02 | Phase 12 | Staging (not started) | Phase 12 → APK-02 |
| E2E-01 | Phase 13 | Staging (not started) | Phase 13 → E2E-01 |
| E2E-02 | Phase 13 | Staging (not started) | Phase 13 → E2E-02 |

Coverage: **14/14** mapped, **0** orphans, **0** duplicates.

## Constraint / Policy Check (from source plan, LOCKED)

- ✓ `src/App.jsx` line-range substitution only; decomposition forbidden
  (CLAUDE.md).
- ✓ 0 new npm deps (Supabase JS already at `@supabase/supabase-js@2.99.1`;
  WebRTC = browser built-ins).
- ✓ VAPID keys unchanged.
- ✓ Supabase MCP direct migration apply pattern retained.
- ✓ Google Play stalkerware policy: FGS + persistent notification + consent
  framework = reinforced, not loosened.
- ✓ PIPA <14: `family_agreements.legal_rep_user_id` required + versioning.
- ✓ SEC-01 (push-notify sender ∈ family): regression-check in Phase 11.
- ✓ Supabase Realtime per-table subscription cap: per-session signaling
  channel is distinct from existing family channel.
- ✓ Codex review per `feedback_codex_review_each_step`, model `gpt-5.4`
  per `feedback_codex_model`, on every phase completion and on any commit
  touching `src/lib/audio/**`, `supabase/migrations/**`,
  `supabase/functions/**`, or `android/**`.

---

*Staging draft: 2026-04-22. Source: `C:/Users/A/.claude/plans/hyeni-modular-chipmunk.md`. Promote on v1.1 complete.*
