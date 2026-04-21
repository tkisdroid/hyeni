# Feature Research — Reliability Bar for Parent-Child Safety Apps (2026)

**Domain:** Parent-child safety / family-location app (Korean market), BROWNFIELD stabilization
**Researched:** 2026-04-21
**Confidence:** HIGH (competitor behavior sourced from vendor docs / official policy pages; Korean regulation from Kim & Chang, KLRI, Citizen Lab; Google Play policy quoted from Play Console Help)
**Scope:** Not new-feature ideation. This maps, per existing Hyeni feature, the 2026 "production-grade" bar set by Google Family Link, Life360, Apple Find My, Microsoft Family Safety, Bark, and Qustodio — and flags where the platform (Google Play) or regulator (PIPA, COPPA, KCC) makes certain behavior mandatory.

---

## Executive Framing

For each of the six Hyeni feature classes, the bar has three tiers:

1. **Table stakes** — competitors universally do this; missing it is either a regulator/store violation or a trust-breaking gap users churn over.
2. **Differentiator** — only 1-2 competitors do this; a transparency edge that Hyeni could use but isn't mandatory.
3. **Anti-feature** — historically done by some competitors; caused bans, lawsuits, or press damage. Do NOT replicate.

**Bottom line for milestone v1.0 (REQUIREMENTS.md):** The P0-P2 fixes in PROJECT.md already align with the table-stakes bar. The main gaps to surface are (a) the **persistent-notification + consent indicator** requirement for 주위소리듣기 (P2-8) is a hard Google Play policy line, not just UX polish, and (b) **pair-code rotation** at 48h is actually more conservative than Life360 (72h), which is fine — do not relax it.

---

## Feature 1: Pair Code (페어링)

### 2026 Competitor Bar

| Vendor | Pair Code TTL | Rotation | Revocation Model |
|--------|--------------|----------|------------------|
| **Google Family Link** — family invitations | **14 days** | Per-invite | Parent can revoke at any time; invitee account locked in |
| **Google Family Link** — "parent access code" (device unlock, different primitive) | **30 minutes**, rotating every hour | Hourly | Expires automatically |
| **Life360** — circle invite code | **72 hours**, dynamic | Auto-rotates after 72h | Admin can regenerate on demand |
| **Apple Find My** — Family Sharing | No pair code; uses Apple ID invitation flow | N/A | Organizer can remove |
| **Microsoft Family Safety** | Email/phone invite link | Per-invite | Organizer can remove |

**Common security practices cited by OWASP MASTG:** authorization/pair codes should be short-lived, single-use where possible, held in transient memory, and combined with server-side revocation. Token "families" (familyId) with reuse detection — if an old code is replayed, the whole family is invalidated — is the modern pattern.

### Hyeni current state vs bar

- PROJECT.md P0-3 plans **48h TTL + manual rotation button + single-child constraint + RLS to block child self-unpair**.
- 48h is **stricter** than Life360 (72h) and much stricter than Family Link's 14-day invite. ✓ Acceptable.
- Missing today: no server-side idempotency on pair-code consumption, no audit log of who redeemed which code, no visible expiry countdown on parent UI.

### Categorization for REQUIREMENTS.md

**Table stakes (MUST ship in v1.0):**
- Pair code expires automatically in ≤ 72h (Life360 baseline). Hyeni's 48h plan meets this.
- Used pair code becomes single-use (cannot be redeemed twice).
- Parent can rotate manually at any time (P0-3 already plans this).
- Child cannot self-unpair silently — parent is notified or child cannot do it unilaterally (P0-3).
- Only the intended child can be paired; reusing a code after it's consumed fails closed.

**Differentiator (nice-to-have):**
- Visible countdown/expiry on parent UI ("이 코드는 23시간 후 만료됩니다") — trust transparency.
- Audit log row showing which anonymous child UID redeemed the code and when.

**Anti-features (do NOT add):**
- Long-lived or never-expiring codes (original Hyeni design pre-P0-3).
- Multi-use codes without an explicit "max uses" setting.
- Codes that are easy to guess (<6 chars, ascending digits). Use high-entropy alphanumeric.

---

## Feature 2: Event / Reminder Push Reliability

### 2026 Competitor Bar

There is no published SLA from Family Link / Life360 / Microsoft on push reliability — they rely on FCM/APNs. The **FCM-imposed ceiling** is the de facto industry bar:

- FCM queues offline devices for up to **4 weeks**, retries on reconnect. Inactive-device drop rate is ~**15%** at steady state and hard to drive to zero.
- Airship 2026 Mobile Push Benchmark: industry analyzes the 90th, 50th, and 10th percentiles across 681B notifications — no single "delivery %" is quoted, but Android opt-in is ~97%, iOS ~54%.
- "Deliverability" (FCM accepted + device reachable) tops out near **90%** for well-instrumented apps; 60% is the casual-sender average on mobile.
- Best-practice retry policy (per Firebase docs): exponential backoff with jitter (0.9s, 2.3s, 4.1s, 8.5s, 17.9s, 34.7s), 10s min timeout per send, **do NOT retry 400/401/403/404**, retry 500 with backoff, respect `Retry-After` on 429.
- **Idempotency is now considered baseline:** APNs `apns-collapse-id`, FCM idempotency via message ID, server-side Redis `SET NX` with TTL matching dedup window (30-day max on FCM idempotency keys). Multi-layer dedup (client + gateway + provider) is the documented pattern.

### Hyeni current state vs bar

- P0-1 fixes the 401 ES256 root cause (all pushes are currently dying; this is below any bar).
- P1-4 adds Idempotency-Key + triple-channel send (XHR/Fetch/Beacon). This matches the multi-layer dedup pattern.
- **No observability today:** no delivery receipts, no retry queue visibility, no "did this reach the device" confirmation. This is below what Life360/Family Link users would expect from the UI — both show some form of "delivered/read" indicator for at least some message types.

### Categorization for REQUIREMENTS.md

**Table stakes (MUST ship in v1.0):**
- Push Edge Function must accept and correctly sign ES256 JWT (P0-1). This is not "reliability" — it's "works at all." Currently 0%.
- Server-side idempotency key on every outgoing push with ≥ 24h dedup window (P1-4).
- Retry with exponential backoff + jitter; honor FCM error classification (no-retry vs retry-with-backoff vs retry-after).
- Delivered-to-FCM log persisted per message with message ID, target token, status, HTTP code. Minimum audit trail, even without UI.

**Differentiator (nice-to-have):**
- "전송 완료 / 받음" two-tier receipt UI in parent app (전송 완료 = FCM 200, 받음 = client ack via server round-trip).
- Metrics dashboard for parent power users: "지난 7일 전송률 94%" — rare among competitors, strong trust signal in Korea where 카카오 has conditioned users to expect read-state transparency.

**Anti-features (do NOT add):**
- Fake "100% delivered" indicator that only confirms server accepted the send — users discover the lie the first time a child doesn't get a reminder. Under-promise.
- Unbounded retry loops (the `sync.js` 404 loop described in P1-5 is exactly this anti-pattern).

---

## Feature 3: Location Sharing (위치)

### 2026 Competitor Bar — the "parent is viewing" indicator

| Vendor | Indicator when parent views live location? | Child auto-pause control? |
|--------|-------------------------------------------|---------------------------|
| **Life360** | **No in-app notification/banner.** Viewing is silent; only the OS-level status bar arrow fires (same as any GPS use). | Pause feature exists; **does push a "Location Sharing Paused" notification to all circle members** for transparency. |
| **Apple Find My / Family Sharing** | No per-view notification. OS status-bar arrow when GPS is polled. Each member must explicitly accept sharing ("Each family member receives a message that you're sharing your location and can choose to share their location with you"). | Member can turn off Share My Location; parent can lock this setting behind screen-time passcode for supervised children. |
| **Google Family Link** | No per-view indicator in-app. Children under 13 can only share with parents (forced). 13+ can stop sharing at any time. Arrival/departure alerts sent to parent. | 13+ child can stop sharing unilaterally. <13 cannot. |
| **Microsoft Family Safety** | N/A — location feature **was removed** in 2025. |

**Reality check:** no major competitor shows the child a per-view "parent is looking at you right now" indicator. The OS status-bar GPS arrow is considered sufficient transparency by industry. The transparency obligation is at the **state-change** level (sharing turned on/off/paused), not the **view event** level.

### Hyeni current state vs bar

- Hyeni already shares location while app runs; no auto-pause.
- Given Korean PIPA Article 22-2 child-notification requirements (easy-to-understand language, clear format for under-14), Hyeni should at least **show a one-time clear disclosure at pairing** that location will be continuously visible to the parent while the app is active.

### Categorization for REQUIREMENTS.md

**Table stakes (MUST ship in v1.0):**
- At initial pairing, child sees a clear, age-appropriate (PIPA-compliant) disclosure that parent can see their location while the app runs.
- Any state change (sharing turned off, app uninstalled, network lost) is visible to the parent in the UI with an honest "last seen" timestamp. No fake "live" pin on a 20-minute-stale location.
- OS foreground-service notification when location is actively being read in the background (Android 14 requires `FOREGROUND_SERVICE_LOCATION` type + persistent notification).

**Differentiator (nice-to-have):**
- "혜니 미리보기" — child app shows a lightweight banner when parent opens the live-location screen. This is **above** the Life360/Family Link bar and a genuine trust signal.
- Location-precision dial (Life360 "Bubbles" pattern): child can temporarily blur to a ~1km circle without fully pausing, with the bubble bursting if SOS fires.

**Anti-features (do NOT add):**
- Silent background location collection without any visible indicator (this is the Google Play stalkerware line; see Feature 5).
- A "stealth" or "hidden" mode. Google Play explicitly bans this even for family apps: apps "must not present themselves as a spying or secret surveillance solution" and "must not hide or cloak tracking behavior."

---

## Feature 4: SOS / Panic Button ("꾹")

### 2026 Competitor Bar

- **Life360 SOS**: silent help alert to circle + emergency contacts; countdown before fire; paid tier triggers 24/7 Emergency Dispatch. Free tier: push to circle + SMS to emergency contacts. Paid: push + SMS + live dispatch callback. **No public audit-log feature surfaced in user-facing docs.**
- **Microsoft Family Safety**: historically had an SOS alert; location features discontinued in 2025, so this is effectively unsupported.
- **Apple Find My**: no panic button primitive; uses Emergency SOS at OS level (side-button triple-press).
- **Google Family Link**: no panic button.
- **Bark / Qustodio**: content-monitoring apps, not emergency-alert apps — no SOS primitive.

**Regulatory overlay:**
- **COPPA**: push notification identifiers are "online contact information" under COPPA. For <13 users, need verifiable parental consent before sending push — but parent-originated and emergency-triggered notifications have broader latitude under the multiple-contact and safety exceptions. Still requires documented consent flow.
- **PIPA (Korea)**: <14 requires verifiable legal-representative consent (phone SMS verification is the named example). Records used for verification must be destroyed post-verification (PIPA Article 22, Children Guidelines 2022 PIPC).
- **OWASP MASTG**: security-critical actions must have server-side audit logs that cannot be tampered with by client.

### Hyeni current state vs bar

- P2-9: press-hold 500-1000ms + dedup key + server-side cooldown on receive. This matches what a debounced panic primitive should look like.
- Hyeni does NOT have 24/7 dispatch integration — **fine, this is a paid-tier Life360 differentiator, not table stakes**. Do not add.
- Hyeni does NOT currently have an SOS audit log. **This is below the OWASP + PIPA bar for a safety-critical action.**

### Categorization for REQUIREMENTS.md

**Table stakes (MUST ship in v1.0):**
- Press-and-hold arming (500-1000ms) to prevent pocket-fires — P2-9 covers this.
- Server-side dedup window (e.g., 30-60s) so a double-press or client retry doesn't send twice — P2-9 covers this.
- Server-side audit log row for every SOS trigger: sender UID, receiver UIDs, timestamp, delivery status per receiver, client request hash. Immutable (no UPDATE/DELETE RLS for non-service roles).
- Delivery receipt visible to sender: "부모에게 도달했어요 / 아직이에요" with real state, not optimistic.
- SOS messages bypass any quiet-hours / Do Not Disturb logic the app might later add.

**Differentiator (nice-to-have):**
- Countdown-to-fire with cancel (Life360 pattern). Protects against pocket-fire AND gives a child 5s to abort if they tapped in error.
- Delivery-receipt badge with per-recipient state ("엄마: 확인, 아빠: 전송중").

**Anti-features (do NOT add):**
- Tying SOS to 24/7 dispatch integration in v1.0 — regulatory, contractual, and liability implications (KCC and emergency-services interactions in Korea are not something Hyeni can casually take on).
- "Silent SOS" modes that don't visibly indicate an alert was sent — removes the user's ability to verify the system worked.

---

## Feature 5: Ambient Audio / Remote Listening (주위소리듣기) — HIGHEST RISK

### 2026 Competitor Bar — NOTE: mainstream family apps do NOT offer this

- **Life360**: no ambient-audio feature.
- **Google Family Link**: no ambient-audio feature.
- **Apple Find My**: no ambient-audio feature.
- **Microsoft Family Safety**: no ambient-audio feature.
- **Bark / Qustodio**: content-scanning only, not live audio. No ambient-listen feature.

**Who does offer it?** AirDroid Parental Control, mSpy, iKeyMonitor, FamiSafe, Watcher, Kroha, FamiGuard. **These apps are predominantly sideloaded or live under intense Google Play scrutiny.** A 2025 arxiv survey (Surveillance Disguised as Protection, arxiv:2504.16087) found the sideloaded parental-control category is where remote-mic features cluster — precisely because store policies push them out.

### Google Play policy — the hard line

From Google Play's Spyware / Stalkerware policy (Play Console Help, answer 14745000) and the September 2020 Developer Program Policy announcement (answer 10065487):

> **"Stalkerware apps purporting to aid spying or provide a secret surveillance solution, such as stealth audio recording, dash cams, or nanny cameras, will also be illegal."**

The family-exception carve-out requires ALL of:
1. App is "exclusively designed and marketed for parents to track their children" (not spouse-monitoring, not generic employee monitoring).
2. App "must not present themselves as a spying or secret surveillance solution."
3. App "must not hide or cloak tracking behavior or attempt to mislead users."
4. App "must present users with a persistent notification at all times when the app is running and a unique icon that clearly identifies the app."

For microphone-capture specifically, Android 14+ adds:
- **`FOREGROUND_SERVICE_MICROPHONE` type is mandatory** — must be declared in manifest.
- **RECORD_AUDIO is a `while-in-use` runtime permission** — cannot be initiated from pure background without user-visible trigger.
- Apps capturing from mic in background must always show persistent notification (Play Console, answer 13392821).

### Korean regulatory overlay

- **PIPA for <14**: legal-representative verified consent required for collection of personal information. Ambient audio from a minor's surroundings recorded from a mic is unambiguously personal information, and often captures third-party voices (classroom, friends) with no consent basis.
- **Citizen Lab's analysis of Korean child-monitoring apps** (2017, 2019 updates) specifically flagged insecure data handling and surveillance overreach by KCC-funded Smart Sheriff and telco Clean Mobile Plus / KT Kidsafe — a precedent that Korean privacy-civil-society scrutiny of this feature class is high and historically damaging.

### Hyeni current state vs bar

- P2-8 plans: session indicator + `remote_listen_sessions` audit log + remove WebView auto-mic-approval. **This is the minimum viable compliance set.** Without these, Hyeni is in direct violation of Google Play's stalkerware policy and PIPA child-data handling.
- WebView auto-mic-approval (current behavior per P2-8) is the single most dangerous item in the codebase from a store-review standpoint. It auto-grants mic permission with no user prompt — exactly the "hide or cloak tracking behavior" prohibition.

### Categorization for REQUIREMENTS.md — ALL TABLE STAKES, NON-NEGOTIABLE

**Table stakes (MUST ship in v1.0 or the feature must be disabled):**
- Persistent Android notification while session is active, with app icon, non-dismissable (`setOngoing(true)`), declaring `FOREGROUND_SERVICE_MICROPHONE`.
- On-device visible indicator to the child for the full duration of any listen session (banner + sound tone at session start is strongly recommended).
- Server-side audit log in `remote_listen_sessions`: who initiated, who was listened to, start timestamp, end timestamp, duration, IP, client version. Immutable to non-service roles.
- Explicit parental-consent record at initial pairing that this feature exists and will be used. For <14 Korean users, this consent must be from the legal representative with verification (PIPA Article 22).
- Remove WebView auto-mic-approval (explicit in P2-8).
- Child-side kill switch: child can end any session immediately.
- Session hard cap (e.g., 60s max per fire) to prevent continuous covert recording.

**Differentiator (nice-to-have):**
- Post-session notification to both parent and child logging that a session occurred ("오늘 14:22 부모가 2분간 주위소리듣기를 사용했습니다").
- Consent re-prompt at session initiation for children above a certain age.

**Anti-features (do NOT add — these are lawsuit/ban vectors):**
- **Any covert, hidden, or stealth mode.** The moment a session can run without the child knowing, Hyeni is stalkerware under Google Play policy. App ban is automatic on detection.
- Audio storage server-side. Make sessions streaming-only; persisting audio raises PIPA retention obligations and increases breach blast radius. If you must record, require parental consent per-recording and auto-delete within a short window.
- Triggering a session via a non-user-visible path (no "silent" remote wake-up without notification).
- Marketing copy that describes it as "몰래 듣기" or "stealth listening." This alone has caused Play Store rejections in the stalkerware thread linked above.
- **Seriously consider whether this feature should exist at all.** None of the top 5 mainstream competitors (Life360, Family Link, Find My, Microsoft Family Safety, Bark) offer it. The absence is not an oversight — it is a deliberate policy and liability choice. This should be a Key Decision in PROJECT.md with explicit risk acceptance by the product owner.

---

## Feature 6: Memo / Chat

### 2026 Competitor Bar

- **KakaoTalk** sets the Korean user expectation: "1" marker next to a sent message, disappears when read. Count is automatic (based on message open), per-recipient in group chats. Notification-panel preview can be read without triggering the read state — Korean users know and exploit this ("읽씹" — read-and-ignore). The read receipt is **implicit / automatic**, not user-toggleable.
- **Life360 chat, Family Link chat, Find My iMessage integration**: all rely on platform-native messengers (iMessage/SMS) or simple in-app threads. None of the family-safety-specific competitors has a chat experience that rivals KakaoTalk's social weight.
- **Bark, Qustodio**: no parent-to-child chat — these are one-way monitoring tools.

**Threaded vs single-doc:** modern chat is overwhelmingly threaded (per message). Document-style memo is an anti-pattern for conversational use but fine for "parent's note to child today." Hyeni today has a hybrid (`memos` + `memo_replies`) that P1-6 is consolidating to `memo_replies` (threaded).

### Hyeni current state vs bar

- P1-6 plans: single data model (`memo_replies`) + manual read receipt.
- **Manual read receipt is a deliberate deviation from the KakaoTalk norm.** Korean users' default expectation is automatic. Manual "I read it" button will feel non-native unless the UX justifies it.
- Rationale for manual (defensible): the app is closed most of the time; a notification-panel preview should NOT mark messages as read (this matches KakaoTalk behavior exactly — 카카오 read-state does not fire from notification preview). A manual "읽음" tap is therefore consistent with how 카카오 actually behaves, if framed as "tapped inside app = read."

### Categorization for REQUIREMENTS.md

**Table stakes (MUST ship in v1.0):**
- Single canonical memo model — P1-6 consolidation to `memo_replies`. Current dual-schema drift (memos table missing `created_at`, `user_id` per P0-2) is below any bar; it is outright broken.
- Read state is sent per-recipient (parent sends to child → child's read state is tracked separately from parent's view of "did child read it").
- Read receipt updates are real-time via the same realtime channel the rest of the app uses (once P0-2 restores `family_subscription` and `saved_places` publications).
- Messages persist through app restart (basic, but the dual-schema bug means this should be explicitly verified).

**Differentiator (nice-to-have):**
- Two-tier state: 전송됨 (queued to FCM) → 받음 (client acked) → 읽음 (child opened thread). Three states matches KakaoTalk's single "1" but adds transport honesty.
- Typing indicator (KakaoTalk has it) — low implementation cost via Supabase Realtime broadcast, high social-presence value.

**Anti-features (do NOT add):**
- Auto-read-on-notification-preview. Breaks Korean user expectations and prevents the "glance at notification, decide to respond later" flow that is culturally load-bearing.
- Server-side message edit/delete that silently rewrites history on the recipient side with no "edited" / "deleted" marker. This has been a recurring source of cross-platform trust complaints; KakaoTalk shows a deletion marker for this reason.
- Allowing the child to silently delete their reply on the parent's side. Safety apps must preserve the audit trail — memo threads are legally and emotionally significant.

---

## Feature Dependencies

```
[Pair Code (P0-3)]
    └──enables──> [Location Sharing (existing)]
    └──enables──> [Event Push (P0-1, P1-4)]
    └──enables──> [Memo (P1-6)]
    └──enables──> [SOS / 꾹 (P2-9)]
    └──enables──> [Remote Listen (P2-8)]

[Push Edge Function ES256 (P0-1)]
    └──required-by──> [Event Push (P1-4)]
    └──required-by──> [SOS delivery (P2-9)]
    └──required-by──> [Memo background delivery (P1-6)]
    └──required-by──> [Remote Listen session start (P2-8)]

[Realtime publications restored (P0-2)]
    └──required-by──> [Memo read-state propagation (P1-6)]
    └──required-by──> [SOS overlay (existing)]
    └──required-by──> [Saved places sync (existing)]

[Audit logs]
    └──required-by──> [SOS (P2-9) — PIPA/OWASP]
    └──required-by──> [Remote Listen (P2-8) — Play Policy + PIPA]
```

### Dependency Notes

- **P0-1 (push ES256) blocks all event-push and SOS reliability work.** This is the one-change-fixes-half-the-app node in PROJECT.md.
- **P0-3 (pair-code hardening) blocks trust on every other feature.** No point making SOS delivery observable if an attacker can join the family with an old code.
- **P0-2 (realtime publications) unblocks read-receipt UX for P1-6.** Without `family_subscription` in the realtime publication, manual read-receipt taps never propagate.
- **P2-8 (remote-listen indicators) is a blocker for Google Play compliance, not just UX.** Ship it or remove the feature.

---

## Milestone v1.0 Definition (for REQUIREMENTS.md scoping)

### Must Ship (blocks v1.0 release)

- [x] **P0-1** Push ES256 support — *Reliability floor: pushes work at all.*
- [x] **P0-2** Realtime publications for `saved_places` + `family_subscription` — *Unblocks read-receipt and sync UX.*
- [x] **P0-3** Pair code TTL/rotation, single-child constraint, child-unpair RLS — *Table stakes for family-app security (Life360 72h baseline; Hyeni 48h exceeds).*
- [x] **P1-4** Idempotency-Key + retry backoff — *Matches FCM best-practice retry policy.*
- [x] **P1-5** Saved-places 404 backoff + circuit breaker — *Closes infinite retry anti-pattern.*
- [x] **P1-6** Single memo model + manual read receipts — *Korean chat user expectation + schema-drift fix.*
- [x] **P2-7** Child pre-pairing UI guard — *PIPA Article 22-2 child-facing disclosure alignment.*
- [x] **P2-8** Remote-listen indicator + audit log + remove WebView auto-mic-approval — **NON-NEGOTIABLE for Play Store compliance.**
- [x] **P2-9** SOS press-hold + dedup + cooldown + audit log — *OWASP MASTG requirement for safety-critical actions.*

### Add After v1.0 (v1.1 or later)

- Two-tier push receipt UX (전송됨 / 받음 / 읽음) in parent UI.
- Delivery metrics dashboard for power users.
- Pair-code expiry countdown in parent UI.
- SOS countdown-to-fire with cancel.
- Location-precision dial ("bubbles" pattern).
- Post-session notification for remote-listen.

### Defer / Out of Scope

- 24/7 emergency dispatch integration (Life360 paid-tier parity). Regulatory complexity, not core to Hyeni's value prop.
- Ghost Mode / stealth location anti-features — both anti-pattern and Play Store risk.
- Audio recording persistence server-side.
- Chat typing indicator (nice, not urgent).

---

## Feature Prioritization Matrix (BROWNFIELD — reliability, not newness)

| Feature Fix | User/Regulatory Value | Implementation Cost | Priority |
|-------------|----------------------|---------------------|----------|
| P0-1 Push ES256 | HIGH (pushes are 100% broken) | LOW (single edge-function fix) | **P0** |
| P0-2 Realtime publications | HIGH (read-receipts + sync broken) | LOW (SQL publication change) | **P0** |
| P0-3 Pair-code hardening | HIGH (open family-join attack surface) | MEDIUM (RLS + TTL logic) | **P0** |
| P1-4 Idempotency + retry | HIGH (duplicate cost + dedup) | MEDIUM | **P1** |
| P1-5 Saved-places backoff | MEDIUM (log/traffic hygiene) | LOW | **P1** |
| P1-6 Memo model unify | HIGH (schema drift is breaking reads) | MEDIUM | **P1** |
| P2-7 Child pre-pair UI guard | MEDIUM (UX + PIPA disclosure) | LOW | **P2** |
| P2-8 Remote-listen indicators | **CRITICAL** (Play Store compliance) | MEDIUM | **P2 but promote if review pressure** |
| P2-9 SOS hardening | HIGH (safety-critical + OWASP) | MEDIUM | **P2** |

**Priority key:**
- P0: blocks v1.0 release; user-facing reliability or open-security-hole
- P1: quality/trust-breaking bugs
- P2: compliance + edge-case robustness (with P2-8 being compliance-critical despite P2 number)

---

## Competitor Feature Comparison Summary

| Feature | Life360 | Family Link | Find My | Bark/Qustodio | **Hyeni v1.0 target** |
|---------|---------|-------------|---------|---------------|----------------------|
| Pair code TTL | 72h | 14d (invite) / 30min (access) | N/A (Apple ID) | Email invite | **48h + manual rotate** ✓ exceeds bar |
| Push retry/dedup | FCM/APNs stdlib | FCM stdlib | APNs stdlib | FCM | **Idempotency-Key + backoff** ✓ meets bar |
| Per-view location indicator | No | No | No (OS arrow only) | N/A | **Consider adding (differentiator)** |
| Location-pause notification | **Yes** (transparency) | N/A (force-share <13) | No | N/A | **Add pause + notify (table stake)** |
| SOS primitive | Yes, silent + dispatch (paid) | No | OS-level only | No | **Press-hold + dedup + audit** ✓ meets non-paid bar |
| Remote listen | **No** | **No** | **No** | **No** | **Yes, with indicators + audit (high risk)** |
| Chat read receipt | Basic | N/A | Platform (iMessage) | N/A | **Manual, KakaoTalk-aligned** ✓ |
| Audit log on safety actions | Not surfaced | Not surfaced | No | No | **Yes (PIPA + OWASP)** — differentiator |

**Reading of the matrix:** Hyeni's existing scope is ambitious relative to mainstream competitors — particularly the remote-listen and manual-read-receipt features. The v1.0 milestone is not about catching up on missing features; it is about ensuring the ambitious features Hyeni *already has* meet the reliability, auditability, and transparency bar that each feature category has settled into by 2026. The P0-P2 list in PROJECT.md is well-scoped for this.

---

## Sources

**Competitor — Pairing:**
- [Join or leave a family on Google — Google Play Help](https://support.google.com/googleplay/answer/6317858?hl=en) — 14-day family invite expiry
- [Get parent access code — Family Link](https://familylink.google.com/parent_access/code) — 30-min rotating access code
- [Add a New Member to My Circle — Life360](https://support.life360.com/hc/en-us/articles/23053409850647-Add-a-New-Member-to-My-Circle) — 72h dynamic invite
- [Life360 invite code expiry — Oreate AI](https://www.oreateai.com/blog/understanding-life360-verification-codes-what-you-need-to-know/20425e56f727bcacd132485b714e1cf8)

**Competitor — Push reliability:**
- [Best practices when sending FCM messages at scale](https://firebase.google.com/docs/cloud-messaging/scale-fcm) — retry policy, error-class handling
- [Understanding FCM Message Delivery on Android (Firebase blog)](https://firebase.blog/posts/2024/07/understand-fcm-delivery-rates/) — 15% inactive-device drop rate baseline
- [Airship Mobile App Push Notification Benchmarks 2026](https://www.airship.com/resources/mobile-app-push-notification-benchmarks-2026/)
- [Idempotent notification requests — OneSignal docs](https://documentation.onesignal.com/reference/idempotent-notification-requests)
- [Notification Reliability: Delivery Guarantees, Deduplication — WittyCoder](https://wittycoder.in/courses/notification-system/notification-reliability)

**Competitor — Location transparency:**
- [See a Circle Member's Location — Life360](https://support.life360.com/hc/en-us/articles/23053527071255-See-a-Circle-Member-s-Location)
- [Does Life360 Tell You When Someone Checks Your Location?](https://www.imobie.com/location-change/does-life360-tell-you-when-someone-checks.htm) — silent-view confirmation
- [Share My Location — Life360](https://support.life360.com/hc/en-us/articles/23053695148823-Share-My-Location) — pause-sharing transparency
- [Find My and location sharing — Apple Support](https://support.apple.com/guide/personal-safety/find-my-and-location-sharing-ips05ede4573/web)
- [Monitor Location with Family Link — Google Guidebooks](https://guidebooks.google.com/family-link/supervision/monitor-location?hl=en)
- [Life360 Bubbles — TechCrunch](https://techcrunch.com/2020/10/12/family-tracking-app-life360-launches-bubbles-a-location-sharing-feature-inspired-by-teens-on-tiktok/) — precision-dial pattern

**Competitor — SOS:**
- [SOS Alerts — Life360](https://support.life360.com/hc/en-us/articles/23053474049687-SOS-Alerts)
- [SOS with 24/7 Emergency Dispatch — Life360](https://support.life360.com/hc/en-us/articles/23053510925847-SOS-with-24-7-Emergency-Dispatch)

**Competitor — Remote audio (policy-critical):**
- [Understanding Google Play's Spyware policy — Play Console Help](https://support.google.com/googleplay/android-developer/answer/14745000?hl=en) — family-exception carve-out requirements
- [Developer Program Policy: September 16, 2020 announcement](https://support.google.com/googleplay/android-developer/answer/10065487?hl=en) — stealth recording prohibition
- [App rejected for violating Stalkerware policy — Play Console thread](https://support.google.com/googleplay/android-developer/thread/222265549) — real-world rejection evidence
- [Foreground service types — Android Developers](https://developer.android.com/develop/background-work/services/fgs/service-types) — `FOREGROUND_SERVICE_MICROPHONE` Android 14 requirement
- [Understanding foreground service and full-screen intent requirements](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en) — persistent-notification requirement
- [Surveillance Disguised as Protection — arxiv 2504.16087](https://arxiv.org/html/2504.16087v1) — sideloaded-vs-store parental-app comparative analysis

**Regulatory — Korea:**
- [PIPC Guidelines for Protection of Personal Information of Children and Adolescents — Kim & Chang](https://www.kimchang.com/en/insights/detail.kc?sch_section=4&idx=25476) — 2022 child-data guidelines
- [Personal Information Protection Act — KLRI English text](https://elaw.klri.re.kr/eng_service/lawView.do?hseq=53044&lang=ENG) — Article 22 and 22-2
- [Korea Media and Communications Commission (KCC)](https://www.kmcc.go.kr/user/ehpMain.do)
- [Safer Without: Analysis of South Korean Child Monitoring & Filtering Apps — Citizen Lab](https://citizenlab.ca/2017/09/safer-without-korean-child-monitoring-filtering-apps/) — historical Korean parental-app scrutiny
- [Still Safer Without — Citizen Lab](https://citizenlab.ca/research/still-safer-without-kt-olleh-kidsafe-clean-mobile-plus/) — KT Kidsafe / Clean Mobile Plus follow-up

**Regulatory — US:**
- [Complying with COPPA: FAQs — FTC](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [How to implement COPPA-compliant push notifications in kids apps — SuperAwesome](https://www.superawesome.com/blog/how-to-implement-coppa-compliant-push-notifications-in-kid-directed-apps/)

**Security / OWASP:**
- [OWASP Mobile Application Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mobile_Application_Security_Cheat_Sheet.html)
- [OWASP MASTG — Authentication and Session Management](https://github.com/OWASP/owasp-mastg/blob/master/Document/0x04e-Testing-Authentication-and-Session-Management.md)

**Korean chat UX norm:**
- [KakaoTalk Etiquette — 읽씹 pattern](https://kj.nomardy.com/kakaotalk-etiquette/)
- [Advanced KakaoTalk paranoia tips](http://waegukin.com/advanced-kakaotalk-paranoia-tips.html) — notification-preview vs read-state

---
*Feature research for: parent-child safety app reliability bar (Korean market, 2026)*
*Researched: 2026-04-21*
