# Roadmap (STAGING): 혜니캘린더 v1.2 — Sound Around & Consent Port

> **STATUS: STAGING**
> v1.1 is still the **live, active** milestone. This document is a pre-approved
> v1.2 staging roadmap that will be **promoted** to `.planning/ROADMAP.md`
> (replacing / appending to the v1.1 content per the project's milestone
> lifecycle) the moment `/gsd-complete-milestone v1.1` runs. Until then: do
> NOT execute v1.2 phases, do NOT edit the live ROADMAP/STATE, and do NOT
> treat this as the source of truth for agent dispatch.
>
> **Source plan:** `C:/Users/A/.claude/plans/hyeni-modular-chipmunk.md` (approved 2026-04-22).
> **Decisions locked:** No re-derivation permitted. Translate faithfully.

## Overview

v1.1 ("Native Deploy & Polish") delivered the Android native shell (APK CI, FGS
microphone, WebView mic-permission gate, FCM data-wake, Play internal track
submission) but intentionally **excluded the RL audio transport from E2E
scope** (v1.1 Phase 8 Success Criteria was narrowed to permission gate + banner
+ FGS + FCM wake only).

v1.2 closes the four compounding gaps that kept Phase 5 RL from working
end-to-end on real devices:

1. **Transport layer** — Supabase Realtime `broadcast` of WebM chunks is
   unsuitable for low-latency voice. Replace with **WebRTC peer-to-peer**
   (signaling stays on Supabase Realtime + table-backed backup; wake stays on
   existing FCM).
2. **getUserMedia bridge** — Verify the `WebChromeClient` permission gate
   actually reaches the JS capture loop on real devices, via a dedicated
   Capacitor plugin (`AmbientListenPlugin`) owning FGS lifecycle.
3. **Consent / legal framework** — Introduce `family_agreements` +
   pairing-time full-screen disclosure modal + sha256 signature, satisfying
   Google Play family-exception and PIPA <14 guardian-consent requirements.
4. **Parent authority model** — Formalize explicit session indicators on the
   child side (persistent notification + full-screen banner) and a
   server-side guard that rejects sessions without an active agreement.

**Primary value:** Stable, real-device RL that is simultaneously **safer**
(consent + audit), **smoother** (WebRTC direct audio), and **more intuitive**
(clear child-side indicators) than the competitor bar (FindMyKids).

**Stability over simplicity.** Every Phase default in v1.2 is fixed to the
**robust** option, not the minimal one (see "Stability-First Decisions").

> v1.1 archive (at v1.1 completion): `.planning/milestones/v1.1/ROADMAP.md`
> Approved plan reference: `C:/Users/A/.claude/plans/hyeni-modular-chipmunk.md`

## Milestone Meta

| Field | Value |
| --- | --- |
| Milestone | v1.2 |
| Name | Sound Around & Consent Port |
| Status | STAGING (awaiting v1.1 complete) |
| Granularity | Standard (5 phases, matches config.json) |
| Phase numbering | 9 → 10 → 11 → 12 → 13 (continuing from v1.1's 6-8) |
| Execution order | **9 → 10 → 11 → 12 → 13** |
| Parallelism | Phase 9 parallel ×3, Phase 10 solo sequential, Phase 11 parallel ×3, Phase 12 solo, Phase 13 solo user-in-loop |
| REQ count | 14 (SIG-01, CONSENT-01, FLAG-01, RTC-01..04, BRIDGE-01, CONSENT-02, CONSENT-03, LEGACY-KILL-01, APK-01, APK-02, E2E-01, E2E-02) |
| Coverage | 14/14 v1.2 requirements mapped, no orphans |

## Stability-First Decisions (2026-04-22 user-confirmed, LOCKED)

Each Phase's design default is fixed to the **most stable** rather than the
**simplest** option. These were approved in the source plan and are copied
here verbatim (order preserved). No re-decision.

1. **SIG-01 is table-backed + realtime broadcast, dual-path** (broadcast-only
   rejected). Rationale: (a) signaling DB rows become part of the session
   audit chain and enable reproduction/debug, (b) DB read recovers if a
   broadcast message is dropped, (c) WebRTC ICE trickle is the final safety
   net.
2. **RTC-04 ships TURN in v1.2** (deferral to v1.3 cancelled). NAT /
   symmetric-network failures (10–20%) must be resolved in v1.2. Provider
   choice — Cloudflare Calls TURN free tier vs coturn self-host — is
   finalized in `/gsd-discuss-phase 10`.
3. **RTC-03 includes ACK + idempotent retransmit.** A single lost SDP
   offer/answer must not kill the session. Every signaling message carries
   `msg_id`; if no ACK arrives within 3s, retransmit once (duplicates are
   neutralized by `(session_id, msg_id)` UNIQUE).
4. **Child-side reconnection health check.** When WebRTC
   `iceConnectionState` transitions to `disconnected`, give it 5s grace
   before declaring `failed` → parent-side toast + audit row
   `end_reason='network_lost'`. User can manually retry.
5. **BRIDGE-01 FGS lifecycle hardening.** `AmbientListenService` runs only
   while `start()` is active. When JS `RTCPeerConnection` closes (or page
   unloads / crashes / is backgrounded-killed), a Capacitor finalizer
   automatically calls `AmbientListenPlugin.stop()` so FGS never leaks.
6. **E2E-02 is DoD-mandatory, not nice-to-have.** All four edge cases
   (network drop, app-kill wake, mic denied, consent-missing start) must
   PASS. Any single failure → Phase 13 rejected.
7. **Gradual rollout flag.** In addition to the existing
   `family_subscription.remote_listen_enabled` kill switch, add a
   server-side `public.feature_flags.remote_listen_v2_enabled` row. Deploy
   v1.2 with the flag OFF; flip to ON only after manual verification. If
   problems appear post-rollout, the v1.0 kill switch alone can still stop
   sessions without child-device reinstall.

## Phases

**Phase Numbering:**
- Integer phases (9, 10, 11, 12, 13): v1.2 new work (v1.0 used 1-5, v1.1 used
  5.5-8).
- Decimal phases (X.Y): reserved for urgent insertions via `/gsd-insert-phase`.

- [ ] **Phase 9: Signaling Schema & Consent Foundations** — `family_agreements`, `webrtc_signaling`, `feature_flags` migrations with RLS, server-side guards, and rollout flag (parallel ×3, server-only)
- [ ] **Phase 10: WebRTC Audio Pipeline** — Parent receiver + child sender + hybrid signaling (broadcast + DB backup + ACK retransmit) + TURN credential issuance (solo, sequential)
- [ ] **Phase 11: Capacitor Bridge · Consent UX · Legacy Kill** — `AmbientListenPlugin` with JS-close finalizer, pairing-time full-screen consent modal, child-side session banner hardening, removal of legacy `broadcast` audio-chunk handlers (parallel ×3)
- [ ] **Phase 12: APK Rebuild & Play Replacement Submission** — CI-driven rebuild including BRIDGE-01 and Play Console internal track upload with updated family-exception copy (solo)
- [ ] **Phase 13: Two-Device E2E Verification** — Real 2-device live session (10× consecutive pass) plus 4/4 edge-case verification (solo · user-in-loop)

## Phase Details

### Phase 9: Signaling Schema & Consent Foundations
**Goal**: The database, RLS policies, and rollout flag required to run WebRTC
sessions with legally-grounded guardian consent exist and are enforced; sessions
cannot be created without an active agreement or with the feature flag off.
**Depends on**: v1.1 complete (native shell, FCM wake, RECORD_AUDIO manifest in
place). No in-milestone dependency — three streams fully disjoint.
**Parallelism**: parallel ×3 (SIG-01 / CONSENT-01 / FLAG-01)
**Requirements**: SIG-01, CONSENT-01, FLAG-01
**Success Criteria** (what must be TRUE):
  1. A parent attempting to insert a `remote_listen_sessions` row for a family
     that has **no active `family_agreements` row** receives a Postgres
     permission/trigger error; the session is never created (CONSENT-01).
  2. A parent attempting to start a session while
     `public.feature_flags.remote_listen_v2_enabled=false` receives
     `feature_disabled` from the session-start RPC; `remote_listen_v2_enabled=true`
     allows the flow to proceed (FLAG-01).
  3. Every signaling message (`offer`, `answer`, `ice`, `bye`) inserted into
     `webrtc_signaling` is visible only to members of the owning `family_id`
     under RLS; a non-family test account sees 0 rows, and duplicate
     `(session_id, msg_id)` inserts are rejected by UNIQUE (SIG-01).
  4. All three migrations apply up **and** down cleanly against the Supabase
     branch; `pg_policies` snapshot diff for `webrtc_signaling`,
     `family_agreements`, and `feature_flags` is reviewed and committed.
**Plans**: TBD (expected ~3 atomic plans, one per REQ, all parallel-safe)
**Research required**: No — schema patterns reuse v1.0/v1.1 precedents (pg_cron TTL, family-scoped RLS).

Plans:
- [ ] 09-01: TBD — SIG-01 (`webrtc_signaling` migration + RLS + UNIQUE + publication + TTL cleanup)
- [ ] 09-02: TBD — CONSENT-01 (`family_agreements` migration + RLS + session-start pre-check trigger/RPC guard)
- [ ] 09-03: TBD — FLAG-01 (`feature_flags` migration + seed row `remote_listen_v2_enabled=false` + RPC guard)

### Phase 10: WebRTC Audio Pipeline
**Goal**: Parent and child devices establish a direct WebRTC audio session
whose signaling is resilient to individual message drops and whose NAT
traversal works on 100% of live households, with TURN credentials issued
server-side and never hardcoded.
**Depends on**: Phase 9 (session-start guard + signaling table must exist and
be enforced).
**Parallelism**: solo · sequential (shared surface: `src/lib/audio/**`, App.jsx
minimal-line replacement, Supabase edge function).
**Requirements**: RTC-01, RTC-02, RTC-03, RTC-04
**Success Criteria** (what must be TRUE):
  1. In a localhost two-tab harness, the parent receiver tab plays live audio
     from the child sender tab's microphone end-to-end, and closing the parent
     tab causes the child tab's `RTCPeerConnection` and (in device builds) FGS
     to shut down automatically via the Capacitor finalizer (RTC-01, RTC-02).
  2. Signaling survives a single-message drop injected by test fixture: SDP
     offer or answer retransmits once on ACK timeout (3s), duplicates are
     idempotently discarded via `(session_id, msg_id)` UNIQUE, and the session
     still establishes (RTC-03).
  3. TURN credentials are issued only by the `issue-turn-credential` edge
     function: unauthenticated request returns 401; authenticated parent in a
     family with an active agreement returns 200 with short-lived (≤1h)
     credentials; no TURN password appears in client source or localStorage
     (RTC-04).
  4. When WebRTC `iceConnectionState` transitions to `disconnected` mid-session,
     the 5s grace window is observed, and on timeout a parent-side toast plus
     `remote_listen_sessions.end_reason='network_lost'` are recorded (Stability
     #4, covered via RTC-01).
**Plans**: TBD (expected ~4 atomic plans, sequential in shared files)
**Research required**: Yes — `/gsd-discuss-phase 10` must decide: TURN provider
(Cloudflare Calls free tier vs coturn self-host), Opus codec bitrate (default
vs pinned 32 kbps), Android WebView WebRTC compatibility (built-in vs
`@capacitor-community/webrtc`), and ACK TTL tuning.

Plans:
- [ ] 10-01: TBD — RTC-01 parent receiver (`src/lib/audio/parentPeer.js` + ICE health-check + App.jsx minimal replacement)
- [ ] 10-02: TBD — RTC-02 child sender (`src/lib/audio/childPeer.js` + `getUserMedia` + `addTrack` + close-hook finalizer wiring)
- [ ] 10-03: TBD — RTC-03 hybrid signaling (`src/lib/audio/signaling.js` with broadcast + DB backup + `msg_id` ACK + 3s retransmit)
- [ ] 10-04: TBD — RTC-04 TURN (`supabase/functions/issue-turn-credential/index.ts` + provider wiring)

### Phase 11: Capacitor Bridge · Consent UX · Legacy Kill
**Goal**: The native plugin, the pairing-time consent experience, the child-side
session indicators, and the removal of the legacy broadcast audio-chunk path are
delivered together so the v1.0 transport cannot linger alongside the v1.2 one.
**Depends on**: Phase 10 (peers and signaling must exist for the plugin to
connect; consent modal gates the pairing flow that triggers the first session).
**Parallelism**: parallel ×3 (BRIDGE-01 / CONSENT-02+CONSENT-03 / LEGACY-KILL-01)
**Requirements**: BRIDGE-01, CONSENT-02, CONSENT-03, LEGACY-KILL-01
**Success Criteria** (what must be TRUE):
  1. Immediately after a child accepts a pair code, a full-screen disclosure
     modal appears (in PIPA + Play worded variants); submitting it creates a
     `family_agreements` row with a sha256 signature over the shown text, and
     skipping it blocks the pairing from completing (CONSENT-02).
  2. During an active listen session the child device shows a full-width red
     banner `🎤 부모님이 주변 소리를 듣고 있어요` with a 200ms vibrate AND an
     Android persistent notification `주변 소리 연결 중`; both auto-dismiss
     within 1s of session end, and neither is possible to hide or suppress
     (CONSENT-03).
  3. Searching `src/` for `remote_listen_start`, `remote_listen_stop`, and
     `audio_chunk` broadcast listeners returns 0 live call sites; the
     `push-notify` Edge Function's `action==='remote_listen'` branch emits a
     minimal wake-only data message (`session_id` + `action`); audit INSERTs into
     `remote_listen_sessions` continue from the WebRTC path; kill switch
     `family_subscription.remote_listen_enabled` remains functional
     fail-closed (LEGACY-KILL-01).
  4. On the device, JS-side `RTCPeerConnection.close()` (triggered by `unload`,
     `visibilitychange(hidden)`, or natural session end) causes
     `AmbientListenPlugin.stop()` to fire via the Capacitor finalizer;
     `adb logcat` confirms `AmbientListenService onDestroy` with no orphan
     FGS (BRIDGE-01 + Stability #5).
**Plans**: TBD (expected ~4 atomic plans, parallel-safe modulo App.jsx line
ranges already listed in the plan)
**Research required**: Partial — `/gsd-ui-phase 11` generates the consent modal
and child-banner UI-SPEC (icon, color, copy variants). `/gsd-discuss-phase 11`
is `--auto`-forbidden (legal copy).
**UI hint**: yes

Plans:
- [ ] 11-01: TBD — BRIDGE-01 (`AmbientListenPlugin.java` + `registerPlugin` + JS finalizer wiring + 1-session-only guard)
- [ ] 11-02: TBD — CONSENT-02 + CONSENT-03 (`AgreementModal.jsx` + `ChildSessionBanner.jsx` + `src/lib/consent/agreement.js` signature/commit + banner hardening in App.jsx:3988)
- [ ] 11-03: TBD — LEGACY-KILL-01 (remove broadcast handlers in `src/App.jsx` lines 319-361, 2502-2509, 4750-4810 + `src/lib/sync.js` lines 561, 700-707 + `push-notify/index.ts` lines 313, 405-406)

### Phase 12: APK Rebuild & Play Replacement Submission
**Goal**: A signed replacement AAB containing the new plugin, consent UX, and
WebRTC transport reaches the Play Console internal track so testers receive a
v1.2 build that supersedes the v1.1 baseline.
**Depends on**: Phase 11 (plugin + consent + legacy kill must be in HEAD).
**Parallelism**: solo.
**Requirements**: APK-01, APK-02
**Success Criteria** (what must be TRUE):
  1. The GitHub Actions `android-apk.yml` workflow (v1.1 Phase 6 CI-01 asset)
     runs on HEAD and produces a signed AAB/APK artifact with
     `aapt dump badging` reporting `foregroundServiceType microphone` and a
     bumped `versionCode` (APK-01).
  2. No new CI secret was added; the existing FCM `google-services.json` and
     signing keystore are reused unchanged (APK-01).
  3. The AAB uploads successfully (HTTP 200) to the Play Console internal
     testing track with the family-exception copy extended by a
     "WebRTC direct-peer audio, no third-party storage" clause (APK-02).
  4. At least one internal tester receives the auto-install; launching the app
     yields the v1.2 version string, not v1.1 (APK-02).
**Plans**: TBD (expected 2 atomic plans)
**Research required**: No — CI + Play Console flow is the v1.1 Phase 7 precedent.

Plans:
- [ ] 12-01: TBD — APK-01 CI rebuild + artifact validation
- [ ] 12-02: TBD — APK-02 Play Console internal track upload + copy update

### Phase 13: Two-Device E2E Verification
**Goal**: Real-device live verification that the entire v1.2 RL pipeline —
consent → wake → session → audio → indicator → teardown — works reliably and
fails safely in all four adversarial scenarios, with `feature_flags` flipped ON
for the test window.
**Depends on**: Phase 12 (testers must have the v1.2 build installed).
**Parallelism**: solo · user-in-loop (no Playwright; manual checklist).
**Requirements**: E2E-01, E2E-02
**Success Criteria** (what must be TRUE):
  1. With two real devices (one parent, one child) paired and
     `remote_listen_v2_enabled=true`, a parent-initiated session plays ≥30s of
     continuous, uninterrupted audio, and this succeeds **10 times
     consecutively**. A single failure in the 10-run batch fails E2E-01 and
     resets the counter (E2E-01).
  2. After any session, `remote_listen_sessions` contains exactly **one** row
     for that session with `started_at`, `ended_at`, `duration_ms`, and
     `end_reason` populated, and `family_agreements` has an active row for the
     family (E2E-01).
  3. All four E2E-02 edge cases pass, **4 of 4 required**: (a) mic denial →
     session `end_reason='permission_denied'` + parent retry-guidance toast;
     (b) child-side Wi-Fi off for ≥10s then restored → either auto
     renegotiation succeeds or `end_reason='network_lost'` is recorded plus a
     parent-side restart button; (c) child app fully killed → parent trigger
     wakes within 15s via FCM and session establishes; (d) family lacking an
     active `family_agreements` row → 403 with "먼저 페어링 동의를
     완료하세요" UI (E2E-02 + Stability #6).
  4. Session end (parent-stop button or timeout) causes the child-side red
     banner AND the persistent notification to disappear within 1s (carryover
     from CONSENT-03).
**Plans**: TBD (expected 1 atomic plan with a manual checklist + DB evidence capture)
**Research required**: No — verification only.

Plans:
- [ ] 13-01: TBD — E2E-01 10× live run + E2E-02 4/4 edge-case matrix + DB evidence capture

## Progress

**Execution Order:** 9 → 10 → 11 → 12 → 13 (Phase 9 internal parallel ×3,
Phase 11 internal parallel ×3, others solo).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. Signaling Schema & Consent Foundations | 0/3 | Staging — awaits v1.1 complete | - |
| 10. WebRTC Audio Pipeline | 0/4 | Staging — awaits Phase 9 | - |
| 11. Capacitor Bridge · Consent UX · Legacy Kill | 0/3 | Staging — awaits Phase 10 | - |
| 12. APK Rebuild & Play Replacement Submission | 0/2 | Staging — awaits Phase 11 | - |
| 13. Two-Device E2E Verification | 0/1 | Staging — awaits Phase 12 | - |

## Cross-Milestone / Out-of-Scope Flags

These items have been evaluated and intentionally excluded from v1.2. They are
recorded here so they cannot be silently re-introduced during phase discuss /
plan without revisiting this roadmap.

- **Child name-card → zoom-in live-location map** (`project_child_location_zoom_on_card_click`) —
  **Out of scope by default for v1.2.** May opportunistically land in Phase 11
  UI polish **only if** (a) UI-SPEC budget permits without disturbing consent
  / banner work and (b) it reuses existing Capacitor Geolocation + `locations`
  Realtime pipeline with zero backend change. **Default placement: v1.3.**
  Flagged as **Open Question** below.
- **FindMyKids SOS port** (`project_findmykids_sos_port_scope`) —
  **Out of scope. Belongs to v1.3 "SOS Hardening" milestone.** v1.2 must not
  touch `sos_events`, `SosOverlayActivity`, DND-bypass notification channels,
  or KKUK code paths.
- **KKUK (꾹) affection-tap** (`feedback_kkuk_vs_sos_distinction`) —
  **Out of scope. Untouched in v1.2.** KKUK ≠ SOS; they share neither
  trigger, audit table, channel, nor UI component. KKUK improvements are
  v1.4+.
- **App.jsx decomposition** — forbidden per CLAUDE.md; minimum-line
  replacement only.
- **New npm dependencies** — none permitted; WebRTC uses browser built-ins,
  Supabase uses existing `@supabase/supabase-js@2.99.1`.
- **VAPID key rotation** — locked.

## Milestone Lifecycle

Phase 13 success = v1.2 complete condition. Upon 10/10 E2E-01 plus 4/4 E2E-02
PASS, and after feature flag flip + codex review PASS:

1. `/gsd-audit-milestone` — validate 14/14 v1.2 REQ + 0 out-of-scope violations.
2. `/gsd-complete-milestone v1.2` — archive into `.planning/milestones/v1.2/`
   (this STAGING file is promoted / replaced by the final archived ROADMAP at
   that step).
3. v1.3 "SOS Hardening" milestone kickoff proposal; consider carry-over of
   child name-card zoom-in map feature (Open Question #1).

## Open Questions (resolved during Phase 9/10/11 discuss)

Carried forward verbatim from the source plan; Phase 9 and Phase 11 discuss
are **`--auto`-forbidden** (data schema + legal copy require user confirmation):

1. **TURN provider** — Cloudflare Calls free tier (1TB/mo relay cap) vs coturn
   self-host (ops + CPU overhead). Resolve in `/gsd-discuss-phase 10`.
2. **WebRTC audio codec / bitrate** — Opus default vs explicit 32 kbps (clarity
   vs mobile data thrift). Resolve in `/gsd-discuss-phase 10`.
3. **Agreement version rollout** — retroactive consent for existing live
   families vs grandfathering. Resolve in `/gsd-discuss-phase 11`.
4. **Child-banner iconography** — FindMyKids red vs hyeni brand tone. Resolve
   via `/gsd-ui-phase 11`.
5. **`@capacitor-community/webrtc` necessity** vs stock Android WebView
   WebRTC. Device-compat sample survey in `/gsd-discuss-phase 10`.
6. **FLAG-01 flip procedure** — direct SQL UPDATE vs admin-only RPC. Resolve
   in `/gsd-discuss-phase 9`.
7. **Child name-card → zoom-in live-location map placement** (cross-milestone
   flag, 2026-04-22 UX request). Stay in v1.3 **unless** Phase 11 UI-SPEC
   explicitly adopts it without expanding CONSENT-02/03 scope. Resolve in
   `/gsd-ui-phase 11` with explicit in-scope-or-out-of-scope decision
   recorded.

## GSD Execution Order (from source plan, v1.2 segment)

```bash
# Prereq: v1.1 must be complete (/gsd-complete-milestone v1.1)

# v1.2 milestone
/gsd-new-milestone                   # v1.2 "Sound Around & Consent Port" (feed this staging file)
/gsd-discuss-phase 9                 # SIG-01/CONSENT-01/FLAG-01 schema detail (table-backed confirmed; NOT --auto)
/gsd-plan-phase 9
/gsd-execute-phase 9
/gsd-discuss-phase 10                # WebRTC codec · TURN provider · ACK TTL · plugin decision
/gsd-plan-phase 10
/gsd-execute-phase 10
/gsd-ui-phase 11                     # Consent modal + child banner UI-SPEC; decide zoom-map inclusion
/gsd-discuss-phase 11                # Consent legal copy; NOT --auto
/gsd-plan-phase 11
/gsd-execute-phase 11
/gsd-plan-phase 12
/gsd-execute-phase 12
/gsd-verify-work                     # Phase 13 — user-in-loop, manual 2-device 10× + 4/4 edges
/gsd-audit-milestone
/gsd-complete-milestone v1.2
```

`.planning/config.json` is `mode=yolo`, `auto_advance=true`,
`ui_phase=true`, `verifier=true`, but **Phase 9 (schema) and Phase 11
(legal copy) must NOT be run with `--auto`** — user sign-off required.

## Per-Phase Verification (from source plan, LOCKED)

Copied verbatim from the source plan's Verification section; phase work
cannot be marked complete until its verification bullets are satisfied.

- **Phase 9** — (a) `supabase/migrations/*family_agreements*`,
  `*webrtc_signaling*`, `*feature_flags*` up+down apply successfully with
  pg_policies snapshot diff; (b) RLS unit test: non-family account sees 0 rows
  on signaling SELECT; (c) with `remote_listen_v2_enabled=false`, start
  attempt returns `feature_disabled` from the guard RPC.
- **Phase 10** — (a) `npm run test` passes `parentPeer.test.js`,
  `childPeer.test.js`, `signaling.test.js` under jsdom+RTCPeerConnection mock;
  (b) localhost two-tab audio loopback succeeds (manual); (c) TURN credential
  edge function returns 401 unauth'd and 200 auth'd.
- **Phase 11** — (a) Playwright real-config E2E `tests/e2e/consent-flow.spec.js`
  blocks start for a non-agreement family with 403; (b) legacy kill verified
  (grep for `audio_chunk`, `remote_listen_start` listeners = 0); (c)
  `AmbientListenPlugin.stop()` fires on JS unload (adb logcat confirms).
- **Phase 12** — (a) `android-apk.yml` produces a signed artifact; (b)
  `aapt dump badging` shows `foregroundServiceType microphone`; (c) Play
  Console internal upload returns 200.
- **Phase 13** — (a) two-device live session plays ≥30s without dropout, 10
  consecutive times; (b) parent-stop → child banner + FGS clear within 5s;
  (c) `remote_listen_sessions` single row has start/end/reason populated and
  `family_agreements` row exists; (d) E2E-02 4/4 PASS.
- **Milestone audit** — `/gsd-audit-milestone` verifies 14/14 REQ and 0
  out-of-scope violations.

## Codex Review Gate (per `feedback_codex_review_each_step`)

Every Phase completion (and each significant commit touching
`src/lib/audio/**`, `supabase/migrations/**`, `supabase/functions/**`, or
`android/**`) requires `/codex review` PASS before phase advance. Model:
config default `gpt-5.4` (per `feedback_codex_model`); no `-m` override.

---

*Staging draft: 2026-04-22. Source: `C:/Users/A/.claude/plans/hyeni-modular-chipmunk.md`. Promote on v1.1 complete.*
