# Research Synthesis — 혜니캘린더 v1.0 Production Stabilization

**Project:** 혜니캘린더 v1.0 Production Stabilization (brownfield remediation)
**Domain:** Parent-child safety / family calendar on React 19 + Vite + Capacitor 8 + Supabase + FCM
**Researched:** 2026-04-21
**Confidence:** HIGH (all 4 researchers verified against official docs + direct repo reads; MEDIUM where reliant on IETF drafts or unreleased roadmap content)
**Scope:** 9 audit-driven remediation items (REQ-IDs in `REQUIREMENTS.md`) — not greenfield. Stack locked. Monolith decomposition forbidden.

---

## Executive Summary

1. **The milestone is gated by one function and one publication.** `push-notify` returning 401 for every ES256 JWT and the missing `saved_places` + `family_subscription` publication membership are the root causes behind ≥6 of 9 audit findings. Fix these plus pair-code RLS in parallel on day 1; everything else becomes verifiable only after.

2. **Brownfield safety discipline is load-bearing, not optional.** Live family `4c781fb7-…` has 2 parents, 4 children, 3 zombie rows, and `pair_code` values predating any TTL. Every DB change must (a) wrap `BEGIN/COMMIT`, (b) ship a matching `supabase/migrations/down/` file, (c) verify on Supabase branch with real-services Playwright, (d) grandfather existing data (legacy-exemption for pair codes, shadow table for `memos`, dual-sign for VAPID if rotated). Repo pre-condition — **create `supabase/migrations/down/` and reconcile loose `supabase/*.sql` vs `supabase/migrations/*.sql` drift** — must ship **before Phase 1**.

3. **Two items expand scope beyond the audit baseline.** P2-8 (remote listen) crosses Google Play's stalkerware line without a persistent Android notification + `FOREGROUND_SERVICE_MICROPHONE` FGS type — store-policy hard requirement, not UX polish — and must ship behind a **remote feature flag** (server-side kill switch without APK rebuild). P2-9 (SOS 꾹) needs an immutable `sos_events` audit log table to clear the OWASP MASTG + PIPA bar for safety-critical actions; audit covered press-hold + dedup but not the log. Neither changes the 4-phase shape; both change per-phase DoD.

4. **Architecture has one heavyweight and one "leave it alone."** P1-6 (memo unification) touches **14 distinct line regions** across `src/App.jsx` + `src/lib/sync.js` + an SQL migration — cannot share a phase, must be two-phase (new-table + dual-write now, drop legacy in v1.1). `src/App.jsx` (6877 lines) is out-of-scope for decomposition; each phase ships with a pre-computed line-range map (ARCHITECTURE.md §2.4); drive-by refactors forbidden.

5. **P0 fixes truly parallelize; P1 and P2 have conflict pairs.** P0-1 / P0-2 / P0-3 touch disjoint surfaces → three concurrent PRs on day 1. P1-4 and P2-9 both modify `sendKkuk`/`sendInstantPush` in the same App.jsx region → **must serialize**. P1-6 is solo. P2-7/P2-8/P2-9 parallelize again once P1-4 lands.

6. **Korean UX norms and store policy are the two external override constraints.** Manual read receipts (P1-6) defensible against KakaoTalk norms (notification preview does not mark read in Kakao either). Persistent notification + non-stealth design on P2-8 non-negotiable for Play Store — no competitor (Life360, Family Link, Find My, Microsoft Family Safety, Bark, Qustodio) offers remote listening, so Hyeni carries all policy risk alone.

7. **"Phase complete" semantics redefined for P1-6.** Memos consolidation ships as new-table + shadow (not cutover). P1-6 completes as **shadow-running with read-parity verified for 14 days**, not "legacy tables dropped." DoD explicitly: "`memos` VIEW retained 30d; drop scheduled for v1.1."

---

## Stack Decisions (per-fix, anchored to REQ-IDs)

| REQ-ID | Decision | One-line rationale |
|---|---|---|
| **PUSH-01** | `supabase.auth.getClaims(jwt)` inside `push-notify`, keep `--no-verify-jwt` deploy flag | Official 2026 Supabase pattern; ES256 + kid rotation + JWKS caching transparent; ships in `@supabase/supabase-js@2.99.1` already — no bump |
| **PUSH-01** (web push) | **Do NOT rotate VAPID keys** during redeploy; snapshot before any env-var change | Rotation 403s every existing `push_subscriptions` (RFC 8292 §2.3); dual-sign for 30d if rotation unavoidable |
| **PUSH-01** (FCM) | Keep current FCM v1 service-account JWT path; add `FCM_PRIVATE_KEY` PEM-block log scrubber | Legacy FCM sunset 2024-07; `android.priority:"HIGH"` + data-only at `push-notify/index.ts:182` already correct |
| **PUSH-02** | `Idempotency-Key: crypto.randomUUID()` header + body-embedded mirror (beacon cannot set custom headers) + `push_idempotency(key uuid PK, created_at)` dedup table, 24h TTL | De-facto standard (Stripe/MDN/IETF); unique-violation insert is cheapest dedup; fail-open on DB error for safety app |
| **RT-01 / RT-02** | `ALTER PUBLICATION supabase_realtime ADD TABLE …` **+** `REPLICA IDENTITY FULL` **+** `NOTIFY pgrst, 'reload schema'` — in that order | Replica identity mandatory — filters are on `family_id` (non-PK); without it Realtime silently drops UPDATEs |
| **RT-03** | **One channel per table** (`saved_places:${familyId}`, `family_subscription:${familyId}`) — never colocate bindings | Multi-binding failure mode: one bad binding kills all bindings on the channel (supabase-js #1917, #1473) |
| **PAIR-01** | Add `pair_code_expires_at timestamptz` as **new nullable column**; TTL enforced in `join_family` RPC **body**, not CHECK constraint; existing codes grandfathered `expires_at = NULL` | CHECK constraints fail load-bearing existing data; function-level checks fail only new operations |
| **PAIR-03** | `family_members` DELETE policy denies child role; parent-initiated unpair RPC only | Wrap `DROP POLICY + CREATE POLICY` in `BEGIN/COMMIT` so no gap exists |
| **MEMO-01** | Keep `memo_replies` (richer); add `origin text` column (`'original'\|'reply'\|'legacy_memo'`); shadow-copy `memos` → `memos_legacy_20260421` before any migration; keep `memos` as VIEW for 30d | Safe two-phase consolidation; preserves rollback path |
| **RES-01** | Exponential backoff (2s→4s→8s, max 5min) + circuit breaker (3 consecutive failures → 5min cooldown) inside `fetchSavedPlaces` | Closes the observed infinite retry loop |
| **RL-01** | New `remote_listen_sessions` table (additive migration; rollback = `DROP TABLE`) | Required by PIPA Article 22 + Play Store family-exception policy |
| **RL-02 / RL-03** | **Persistent non-dismissable Android notification** + `FOREGROUND_SERVICE_MICROPHONE` FGS type + remove WebView `PermissionRequest.grant()` auto-approval | Play Store stalkerware hard line (answer 14745000); Android 14 FGS-type requirement; honor-legacy-consent for existing users |
| **KKUK-01/02/03** | press-hold 500–1000ms + dedup key (`sha1(senderId + floor(ts/1000))`) + server-side cooldown RPC (5s/sender) | OWASP MASTG requirement for safety-critical actions |
| **(new scope)** | **`sos_events` immutable audit log** (insert-only RLS; no UPDATE/DELETE for non-service roles) | Expansion beyond audit baseline; required by PIPA/OWASP; roadmapper must insert as explicit scope |

No new npm packages required.

---

## Feature Bar / Regulatory — items that change REQUIREMENTS.md scope

**Scope additions to flag in roadmap:**

1. **P2-8 must include persistent notification + `FOREGROUND_SERVICE_MICROPHONE` FGS type + remote kill-switch flag.** RL-02 currently says "지속 표시 인디케이터" — not specific enough. Without native `setOngoing(true)` + FGS-type, Hyeni is classified stalkerware (automatic Play ban). No mainstream competitor offers remote listen — Hyeni alone carries policy risk.
2. **P2-9 must include `sos_events` immutable audit log.** Current KKUK REQs cover mechanics but not audit. OWASP MASTG + PIPA require it.
3. **P0-3 (Pair Code) strictly exceeds competitor bar — do not relax.** 48h TTL beats Life360 (72h); Family Link invite is 14d. Retain 48h + manual parent rotation. Do NOT auto-rotate (severs legitimate pairings).
4. **P1-6 (Manual read receipts) defensible against Kakao norms** — KakaoTalk's "1" also does not fire on notification-preview. Frame as "tapped inside app = read."

**Items NOT to add (anti-features, verified):**
- Stealth/hidden/covert remote-listen mode → Play Store ban
- Server-side audio persistence → PIPA retention + breach blast radius
- 24/7 emergency dispatch (Life360 paid parity) → contractual/liability out of scope
- Silent SOS with no visible indicator → removes user verification
- Long-lived or multi-use pair codes

---

## Architecture — Dependency Graph & Phase Ordering

```
P0-1 (ES256 gateway)   ──hard──►  P1-4 (sendInstantPush refactor)
                       ──hard──►  P2-8 (remote_listen push trigger)
                       ──hard──►  P2-9 (꾹 push fallback)

P0-2 (publications)    ──hard──►  P1-5 (fetchSavedPlaces backoff)
                       ──soft──►  P1-6 (memo_threads publication add)

P0-3 (pair RLS)        ⊥ P0-1, P0-2   (fully independent)

P1-4 (push chain)      ──soft──►  P1-6 (shared send sites)
                       ──soft──►  P2-9 (same file region — MUST serialize)

P2-7 ⊥ P2-8 ⊥ P2-9     (different App.jsx regions, parallel-safe)
```

**Parallelizable clusters:**
- **Cluster A (day 1):** P0-1 ‖ P0-2 ‖ P0-3 — disjoint surfaces
- **Cluster B (day 2):** P1-4 ‖ P1-5 — different files
- **Cluster C (day 5):** P2-7 ‖ P2-8 ‖ P2-9 — different App.jsx regions

**Non-parallelizable:**
- **P1-4 + P2-9** — same App.jsx region (L4603–4657); land P1-4 first, then P2-9
- **P1-6 solo** — 14 regions + SQL + sync.js; cannot share phase

**Surface area per phase** (from ARCHITECTURE.md §2.4):

| Phase | Files | Minimum touch zones |
|-------|-------|---------------------|
| P0-1 | `supabase/functions/push-notify/index.ts` | auth path (L266–299); no App.jsx changes |
| P0-2 | New migration `YYYYMMDD_realtime_publications.sql` | `ALTER PUBLICATION ... ADD TABLE` + `REPLICA IDENTITY FULL`; zero client changes |
| P0-3 | New migration + `src/App.jsx` L850–916, L1148–1215 | Column adds + RPC tightening + TTL countdown UI |
| P1-4 | `src/App.jsx` L94–154 only | Rewrite `sendInstantPush`; add `Idempotency-Key` |
| P1-5 | `src/lib/sync.js` L176–191 (+ L548–573 polling caller) | Backoff + circuit breaker inside `fetchSavedPlaces` |
| P1-6 | Migration + `src/lib/sync.js` L157–312 + `src/App.jsx` L3888–3890, 4011–4031, 4043–4062, 4433–4447, 4493–4501, 6341–6381, 1954–2078 | **14 line regions** — heaviest phase |
| P2-7 | `src/App.jsx` L421–485, L798–845, L1148–1215, L5706–5711, L5687–5692 | Pre-pair UI gate early-return |
| P2-8 | Migration + `src/App.jsx` L2367–2484 + Android `RemoteListenService.java` | `remote_listen_sessions` + persistent indicator + mic-permission fix |
| P2-9 | `src/App.jsx` L4603–4657, L6142–6151, L4482–4492 (+ `sos_events` migration) | Press-hold + dedup + cooldown RPC + audit log |

**Supabase branch → main workflow** (applies to P0-2, P0-3, P1-6, P2-8, P2-9):
1. `supabase branches create phase-<name>`
2. Author migration + matching `down/` file (**repo pre-condition: create `down/`**)
3. Seed test family
4. Playwright real-services on branch
5. `supabase db push` to main
6. 5-min prod smoke + Edge Function log watch
7. Delete branch

---

## Pitfalls Ranked by Phase Impact

### P0-1 (push-notify ES256)
- **Gateway-not-function 401** — `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM` emitted by Supabase gateway **before** function runs. Use `getClaims` inside function + keep `--no-verify-jwt`. Do NOT toggle dashboard `verify_jwt=true`.
- **VAPID mismatch on redeploy** — snapshot env vars; dual-sign if rotation required.
- **FCM private key leakage** — add PEM-block log scrubber.

### P0-2 (Realtime publications)
- **Forgotten `REPLICA IDENTITY FULL`** — UPDATE filters on `family_id` silently drop without it.
- **`NOTIFY pgrst, 'reload schema'`** must fire or PostgREST keeps 404-ing REST.
- **Existing WS clients won't auto-rejoin** — bump `realtimeSchemaVersion` global to force client resubscribe.

### P0-3 (Pair code + RLS)
- **DROP+CREATE POLICY in separate transactions leaves no-policy gap** — wrap `BEGIN/COMMIT`.
- **Existing pair codes breaking on CHECK constraint** — use nullable `expires_at` + RPC-level check. Grandfather existing.
- **Child-self-unpair race window** — land DELETE-deny before public release.
- Snapshot `pg_policies` pre-migration.

### P1-6 (Memo consolidation)
- **`memos` missing `created_at`/`user_id`** (42703) — naïve `INSERT ... SELECT` fails. Snapshot `memos_legacy_20260421` first.
- **NULL user_id rows become undeletable** under `memo_replies` DELETE policy. Add `origin` column; exempt legacy in RLS.
- **Dropping legacy in same PR = irrecoverable** — two-phase: ship new-table+shadow in v1.0, drop in v1.1 after 30d parity.

### P2-8 (Remote listen)
- **WebView mic auto-grant removal breaks existing users** — honor-legacy-consent: if `hasGrantedAmbientListen` in localStorage, `.grant()` once post-upgrade.
- **Capacitor `androidScheme` change wipes localStorage** — pin scheme; CI lint. **Remote feature flag mandatory.**
- **Play Store stalkerware classification** if persistent notification or non-stealth indicator missing.

### P2-9 (꾹 SOS)
- **`push-notify` body-trusted `senderUserId`** (index.ts:306-313) — exploitable; must derive from verified JWT claim via P0-1.
- **Server-side cooldown** in Edge Function or DB trigger, not client-side only.

### Repo-wide pre-condition
- **Two SQL directories (`supabase/*.sql` loose + `supabase/migrations/*.sql`) with drift** — `memos` missing columns is a symptom. Before Phase 1: `supabase db diff` against prod, archive loose files, create `supabase/migrations/down/`, write reconciliation "schema reality" migration.

---

## Implications for Roadmap

### Pre-Phase 0 (ships BEFORE any remediation)

**Rationale:** Existing migration discipline insufficient for live-data changes. Without these, every downstream phase carries unnecessary rollback risk.

**Deliverables:**
- Create `supabase/migrations/down/` directory with README declaring convention
- Archive `supabase/*.sql` loose files → `supabase/archive/_deprecated_*.sql`
- Run `supabase db diff` against prod; author reconciliation migration for drift (esp. `memos` missing columns)
- Establish `BEGIN; ... COMMIT;` wrap convention
- Snapshot `pg_policies` + env vars (VAPID, FCM) to `.planning/research/`
- Tag current `push-notify` deploy as `push-notify-baseline-20260421`

**No REQ-ID — infrastructure work. 2–4 hours.**

### Phase 1: Unblock Core — Push Gateway, Realtime, Pair Security (parallel ×3)

**Rationale:** P0-1 / P0-2 / P0-3 have zero file overlap and unblock everything downstream.

**Streams:**
- **A:** P0-1 — `push-notify` ES256 via `getClaims` → **PUSH-01**
- **B:** P0-2 — `saved_places` + `family_subscription` publications + replica identity → **RT-01, RT-02, RT-03, RT-04**
- **C:** P0-3 — pair code TTL + single-child INSERT + child self-unpair DELETE deny + zombie cleanup → **PAIR-01, PAIR-02, PAIR-03, PAIR-04**

**Exit criteria:** Supabase-branch-verified with Playwright real-services; curl with valid ES256 JWT returns 2xx; Realtime WS frames show `postgres_changes` on both new tables; child JWT DELETE on `family_members` returns 403; existing pair codes still redeem; 5-min prod smoke clean.

### Phase 2: Client-Side Push & Fetch Hygiene (parallel ×2)

**Streams:**
- **A:** P1-4 — `sendInstantPush` single-path + `Idempotency-Key` + body-mirror for beacon + `push_idempotency` dedup table → **PUSH-02, PUSH-03, PUSH-04**
- **B:** P1-5 — `fetchSavedPlaces` backoff + circuit breaker → **RES-01, RES-02**

**Exit:** Same `Idempotency-Key` sent twice in 30s → exactly 1 FCM + Web Push delivery; saved_places log stops flooding.

### Phase 3: Memo Model Unification (solo)

**Deliverables:** Migration (`memos_legacy_20260421` snapshot + `origin` column + publication add + `memos` VIEW); client rewrites; data row-count + attribution parity → **MEMO-01, MEMO-02, MEMO-03**.

**Exit (phase complete = shadow-running, not cutover):** Every pre-migration `memos` row appears in consolidated view; `memos` VIEW retained 30d; drop scheduled as v1.1; Playwright covers parent→child memo + child reply + mutual read receipt.

### Phase 4: UX & Safety Hardening (parallel ×3)

**Streams:**
- **A:** P2-7 — pre-pair UI gate → **GATE-01, GATE-02**
- **B:** P2-8 — `remote_listen_sessions` + persistent Android notification + `FOREGROUND_SERVICE_MICROPHONE` FGS + WebView honor-legacy-consent + **remote feature flag** → **RL-01, RL-02, RL-03, RL-04**
- **C:** P2-9 — press-hold 500–1000ms + dedup key + server-side cooldown + **`sos_events` immutable audit log (new scope REQ)** → **KKUK-01, KKUK-02, KKUK-03 + SOS-01 (new)**

**Exit:** Unpaired child sees only pair-input; remote-listen session produces audit row before stream; persistent notification visible; feature-flag kill switch verified; accidental-tap SOS rate <1%; server rejects burst-send ≤5s.

---

## Research Flags for Phase Planning

**Needs `/gsd-research-phase` during planning:**
- **Phase 1 / Stream A (P0-1):** VAPID key continuity across branch → main; OEM-specific FCM `direct_boot_ok` on Samsung/Xiaomi/LG.
- **Phase 1 / Stream C (P0-3):** `join_family` RPC baseline recovery — lives in loose `supabase/*.sql`, not `migrations/`.
- **Phase 4 / Stream B (P2-8):** Android `FOREGROUND_SERVICE_MICROPHONE` manifest specifics + Play Store submission copy.
- **Phase 4 / Stream C (P2-9):** `sos_events` audit log schema + retention + PIPA compliance checklist.

**Standard patterns (skip research-phase):**
- Phase 1 / Stream B (P0-2) — 4 lines of documented SQL
- Phase 2 both streams — idempotency / backoff are industry standard
- Phase 3 (P1-6) — standard shadow + dual-write pattern
- Phase 4 / Stream A (P2-7) — pure React early-return branch

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | **HIGH** | `getClaims`, publication + replica identity, FCM v1 verified via Context7 + official docs. MEDIUM on idempotency spec. |
| Features | **HIGH** | Competitor behavior from vendor support pages; Korean regulation from Kim & Chang + KLRI + Citizen Lab; Play policy quoted verbatim. |
| Architecture | **HIGH** | Line-range maps verified by direct reads at 6 offsets + targeted greps. Dependency graph derived from actual callsite evidence. |
| Pitfalls | **HIGH** | Root causes validated against maintainer-acknowledged GitHub issues + Supabase docs on `verify_jwt=true` incompatibility. |

**Overall confidence:** **HIGH.** Sufficient to commit to the 4-phase structure with no further discovery before Phase 1. Pre-Phase 0 hygiene is the only new-scope addition the planner must surface.

### Gaps / Open Questions for Phase Planning

1. **`sos_events` scope for v1.0?** Recommend include (OWASP/PIPA strong).
2. **Remote feature-flag mechanism for P2-8** — decide column in `family_subscription` vs new `runtime_flags` table vs server-sent session flags at Phase 4 kickoff.
3. **Is `@capacitor/push-notifications@8.x` installed?** Check `package.json` at Phase 1 / Stream A kickoff.
4. **Production VAPID keys backup location?** Pre-Phase 0 deliverable: back up to sealed location.
5. **Zombie child cleanup (PAIR-04)** — assigned to Phase 1 / Stream C with P0-3.
6. **P1-6 30-day shadow vs v1.1 ownership** — product-owner ack that `memos` stays as VIEW until next milestone.
7. **Play Store pre-submission copy for P2-8** — listing/description/screenshots must match family-exception carve-out language.

---

## Sources

**Primary (HIGH):** Supabase docs (Functions Auth, JWT Signing Keys, Realtime, Postgres Changes, DB Migrations); Capacitor Push/Storage v8; Firebase FCM HTTP v1; Google Play Spyware/Stalkerware policy (14745000, 10065487, 13392821); Android PermissionRequest + FGS types; MDN Idempotency-Key + Stripe; PostgreSQL ALTER TABLE locks; RFC 8292 + 9749 (VAPID); PIPC Children Guidelines 2022 (Kim & Chang); PIPA (KLRI); OWASP MASTG.

**Secondary (HIGH — maintainer-acknowledged):** supabase#42244, #41691; discussions #40448, #35147; supabase-js #1917, #1473; cli #4059; ionic-team/capacitor #7548; Supabase JWT Signing Keys blog 2025-07-14.

**Repo-internal (HIGH — direct read):** `supabase/functions/push-notify/index.ts`; migrations `20260315152655_memo_replies_setup.sql`, `20260418000005_subscription_rls.sql`, `20260418000006_saved_places.sql`, `20260418000000_family_subscription.sql`; `src/App.jsx` (6 offsets + targeted greps); `src/lib/sync.js`; `src/lib/pushNotifications.js`; `supabase/config.toml`; `playwright.real.config.js`.

---

*Research completed: 2026-04-21 — Ready for roadmap.*
