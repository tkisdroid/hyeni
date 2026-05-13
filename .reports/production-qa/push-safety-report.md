# Agent 06 - Push / FCM / Remote Listen / SOS / Force Ring static report

- Run-at: 2026-05-13
- Branch: final/production-polish-and-real-device-qa @ d5d183f
- Scope: static-only. Runtime push delivery NOT_VERIFIED (pairing incomplete).
- Status: **FAIL** (P0 carryforward from Agent 02 blocks release; one new P1).

## 1. Headline

- push-notify Edge Function: still PASS (Agent 10 confirmed in v0; Agent 06 re-verified gates).
- One new finding: `get_pending_notifications` SECURITY DEFINER RPC is `GRANT EXECUTE TO anon` and performs no auth check internally - anyone with a family_id UUID can read title/body/data of pending pushes. **P1 / N1**.
- All Agent 02 push-relevant P0/P1 carryforwards are still live; release stays BLOCKED.

## 2. A. Push static analysis

| Area | Source | Finding |
|---|---|---|
| Capacitor flow | `src/lib/pushNotifications.js` | Native `NativeNotification` plugin first, SW fallback, native `Notification` last. Channel-aware (`emergency` / `kkuk` / `silent` / `schedule`). |
| Native permission | `src/lib/pushNotifications.js` L194-222 | `getDeliveryHealth`, `requestPostNotifications`, `requestRecordAudio` gate native channels. |
| Instant push | `src/lib/instantPush.js` | Adds `Idempotency-Key` header + body mirror, single 800 ms retry. Token from session; absent token -> no Authorization -> push-notify 401 (fail-closed). |
| FCM token registration | `src/App.jsx` L1539-1578 | `BackgroundLocation.getFcmToken()` -> `fcm_tokens` upsert on `(user_id, fcm_token)`. RLS user_id = auth.uid(). PASS. |
| FCM token cleanup | `src/lib/auth.js` L639+ | `unpair_child` SECURITY DEFINER RPC removes `fcm_tokens` so unpaired child stops receiving pushes. PASS. |
| Channel disabled UX | `src/lib/nativeSetup.js` L12, L45 | Surfaces "alert permission open" CTA when `channelsEnabled === false`. PASS. |
| Idempotency | `supabase/functions/push-notify/index.ts` L926-949 | UUID-typed, dedup via 23505. **P0 broken** because RLS missing on the table (carryforward). |
| Pending fallback | `supabase/functions/push-notify/index.ts` L1138-1180 | Inserted regardless of recipient count (D-A04). expires_at set for remote_listen / request_location. |
| Cron 15/5/start | `supabase/functions/push-notify/index.ts` L1186-1358 | Dedup via `push_sent`. **P0 broken** because RLS drifted on that table (carryforward). |

### A.1 Concerns (new)

- **N2 [P2]** `push-notify` has no global rate limit. Force ring has 1/day or 10/day quota; instant push (kkuk, parent_alert, sos, new_event, remote_listen) has only idempotency dedup. An authenticated family member could spam pushes within their family.
- **N3 [P2]** No body-size cap on instant title/message. FCM hard-caps at 4 KB so worst-case is failed send.
- **N4 [P2]** `L493` `jsonResponse({ error: String(err) }, 500)` and `L623` `details: insertErr.message` return raw error strings. Low-risk; not stack traces.

## 3. B. push-notify additional hardening review

Re-verified Agent 10 PASS items:
- getClaims + sub-claim check (L428-451)
- Family membership gate (L863-884)
- Primary-parent gate (L887-914)
- target_user_id same-family child check in force_ring (L552-581)
- service-role cron path: only `force_ring_reminder` and `playdate_*` accept service-role overrides; auth gate still required.

No new path breaks Agent 10's conclusions.

## 4. C. Remote Listen static analysis

- `src/lib/remoteAudioCapture.js` L128-180:
  - Reads `family_subscription.remote_listen_enabled` kill switch BEFORE any mic access.
  - Inserts `remote_listen_sessions` audit row BEFORE `getUserMedia`. Even on crash a never-ended row is visible. `closeRemoteListenSessionRow` records `ended_at`, `duration_ms`, `end_reason`.
- `AmbientListenService.java`:
  - Channel `ambient_listen_fgs` created (createChannel call). Persistent foreground notification.
  - L113-157: FGS type prefers `TYPE_MICROPHONE`; falls back to `TYPE_SPECIAL_USE` then stops the service because Android 14+ mutes mic capture in SPECIAL_USE mode (no silent stream). PASS - surfaces clean failure.
  - L163-168: hard RECORD_AUDIO check before capture starts.
- Edge gate: push-notify `validateRemoteListenEntitlement` (L100-125) returns 402 `remote_listen_requires_premium` if family is not trial/active/grace; 403 `remote_listen_disabled_by_family` if kill switch off. PASS.
- Wrong family/child blocked: `getFamilyMemberIdsByRole` + targetUserId narrowing (L962-966) constrains FCM recipients to children of the family. PASS.

### C.1 Concerns

- **N5 [P2]** `remote_listen_sessions.duration_ms` is set client-side only; an attacker who skips the close-row call leaves the session "open forever". Not a security flaw but parent UX bug.

## 5. D. SOS static analysis

- `src/App.jsx` L2732-2818:
  - Server-side cooldown via `kkuk_check_cooldown` RPC (5 s).
  - Realtime broadcast + push-notify + `sos_events` insert (fire-and-forget).
  - `sos_events` immutable per RLS (Agent 02 verified anon 401).
- Audit row on every send; receiver_user_ids tracked; delivery_status reflects both channels.
- Cooldown fails OPEN: any RPC error allows the send (intentional for emergency).

### D.1 Concerns

- **N6 [P2]** `kkuk_check_cooldown` only inspects `sos_events`. If `sos_events` insert later fails, cooldown won't trigger on retry. Acceptable since emergency must reach receiver.

## 6. E. Force Ring static analysis

- `src/lib/forceRing.js`:
  - 80-char message truncation.
  - 5 s default timeout with `withTimeout` wrapper.
  - Maps HTTP 429/423 to friendly error codes.
  - Realtime subscription on `force_ring_events:id=eq.<id>` for live status.
- `supabase/functions/push-notify/index.ts handleForceRing` (L498-690):
  - Parent role gate, quota, target validation, one-active-per-family UNIQUE partial idx, data-only FCM with TTL 600s.
- `force_ring_events` RLS - INSERT requires `initiator_user_id = auth.uid()` AND parent role; UPDATE limited to initiator or target. Immutable for delete.
- `force_ring_check_quota` SECURITY DEFINER, REVOKE FROM anon.

### E.1 Android lint carryforward (Agent 01)

- **P1** `ForceRingActivity.java`:
  - L64 `km.requestDismissKeyguard(this, null)` is API 26+; lint warning. Effective if minSdk >= 26 but the lint baseline must clear.
  - L159 `registerReceiver(stopReceiver, filter)` on pre-Tiramisu path does NOT specify `RECEIVER_NOT_EXPORTED`. L156-158 guards the modern path so the bare call only runs pre-13. Lint remains P1.

## 7. F. Edge Function anon probe

Live HTTP probes were BLOCKED by Claude Code auto-mode classifier - see `push-safety-evidence/probe-summary.txt`. Static reading instead:

| Function | Auth gate (source) | Severity |
|---|---|---|
| push-notify | in-function getClaims (L428-451) | PASS |
| ai-child-monitor | in-function getClaims (L293-316) | PASS |
| naver-auth | intentional no-verify-jwt for OAuth | PASS by design |
| send-sms | standardwebhooks signature | PASS |
| ai-voice-parse | none | **P1 carryforward (F-004)** |
| subscription-reconcile | none | **P1 carryforward (F-003)** |
| feedback-email | none | **P2 carryforward (F-008)** |
| qonversion-webhook | HMAC + ALLOW_UNSIGNED env override | **P2 carryforward (F-006)** |

No NEW Edge Function vulnerabilities discovered beyond Agent 02's set.

## 8. G. Channel-disabled / DND UX

Covered above (A). `src/lib/nativeSetup.js` maps `channelsEnabled === false` to alert-permission wizard step. `getDeliveryHealth` also exposes `dndMode`, `ringerMode`, `keyguardLocked`, `backgroundRestricted` for the remote-listen readiness UI (`src/lib/remoteListenHealth.js`).

## 9. H. Wrong family / wrong child routing

- Edge Function: family-membership gate + primary-parent gate + target_user_id validation. PASS.
- Client: `force_ring` requires `familyId` known by client; `target_user_id` optional, server validates. SOS receivers derived from client-side family_members filter, but the audit row is independently RLS-policed (INSERT requires `sender_user_id = auth.uid()`).

## 10. New findings summary

| ID | Severity | Title |
|---|---|---|
| N1 | **P1** | `get_pending_notifications(uuid)` SECURITY DEFINER, GRANTED to anon, no internal auth - anyone with a family_id UUID can read title/body/data of pending pushes via `/rest/v1/rpc/get_pending_notifications`. |
| N2 | P2 | No per-user / per-IP rate limit on `push-notify`. Idempotency dedup is the only throttle outside force_ring quota. |
| N3 | P2 | No body-size cap on title/message for instant pushes. |
| N4 | P2 | `String(err)` / `pg-error.message` returned to clients on 500 paths. |
| N5 | P2 | `remote_listen_sessions.duration_ms` set client-side only -> orphaned audit rows on client crash. |
| N6 | P2 | `kkuk_check_cooldown` only inspects `sos_events`; failed insert breaks cooldown. |

## 11. Carryforward (from Agent 01, 02, 10)

- **P0 - Agent 02 F-001/F-002**: `push_idempotency` (323 rows) and `push_sent` (182 rows) anon-readable/writable. **EMERGENCY PUSH SUPPRESSION** vector for SOS and Force Ring - an attacker who knows a family_id can pre-claim idempotency keys to silence emergency notifications. Highest blocker.
- **P1 - Agent 02 F-003**: `subscription-reconcile` no auth gate.
- **P1 - Agent 02 F-004**: `ai-voice-parse` no auth gate (OpenAI cost abuse).
- **P1 - Agent 01**: `ForceRingActivity.java` L64 NewApi + L159 missing `RECEIVER_NOT_EXPORTED` (pre-Tiramisu branch).
- **P2 - Agent 02 F-006**: `QONVERSION_ALLOW_UNSIGNED_WEBHOOKS=1` env override exists.
- **P2 - Agent 02 F-008**: `feedback-email` no auth + no rate limit.

## 12. Release decision

**BLOCK.** The Agent 02 P0 (push idempotency anon RLS bypass) directly defeats the entire push delivery stack for emergencies - every other PASS in this report is conditional on that being fixed. New P1 (N1, pending_notifications RPC anon) raises additional concern but is not standalone blocking.

## 13. Runtime evidence

NOT_VERIFIED - pairing incomplete, two-device QA blocked, anon HTTP probes denied. Must re-run when devices come online.
