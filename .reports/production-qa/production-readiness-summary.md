# Hyeni Calendar — Production Readiness Summary (QA Wave 4)

- **Branch**: `final/production-polish-and-real-device-qa`
- **HEAD**: `d5d183fa9d2cad168e8d8dcbc1139cede874217b`
- **Evaluated at (UTC)**: 2026-05-12T18:09:42Z
- **Aggregator**: Agent 12 Release Gate
- **Companion machine outputs**: `.reports/production-qa/release-gate.json`, `.reports/production-qa/issues.json`

---

## Executive Summary

The 11-agent QA wave found two P0 issues that directly defeat the children-safety promise of the product: anonymous (unauthenticated) clients can read and write `push_idempotency` and `push_sent` in production, enabling pre-emptive suppression of SOS, force-ring, and kkuk emergency pushes. Eighteen P1 issues compound the picture across unauthenticated Edge Functions (denial-of-wallet on OpenAI and Qonversion), an exploitable RLS gap allowing a child account to self-mutate its role to `parent`, location-RPC range-validation gaps, Kakao REST key leakage, `allowBackup=true` exposing user JWTs via `adb backup`, anon-callable `get_pending_notifications` leaking pending push metadata, and four reliability gaps (no offline queue, unbounded fetchEvents, no realtime missed-event recovery, memo_replies polling fallback missing). The pre-auth runtime is healthy on both real Android devices (Samsung SM-A556S parent + motorola razr 40 ultra child) — install, cold launch, mode select, parent auth screen, and child pair input all PASS — but OAuth handoff requires manual tester action, so end-to-end pairing, calendar sync, memo realtime, parent observation of child location, and SOS/force-ring runtime verifications are all `NOT_VERIFIED`.

---

## Release Decision

**`BLOCK`** — risk acceptance required.

Two P0 vulnerabilities on a children-safety product, eighteen P1 issues, and the headline two-device pairing/calendar/memo/location/push runtime flows unverified. The pre-auth surface (install, launch, role select, auth screen, pair-input screen) is healthy on both real devices, and the real-services Playwright suite passes 43/43 against live Supabase / Realtime / Kakao endpoints — so the platform is not broken — but the safety-critical anon RLS bypass alone is sufficient to block ship without remediation.

`RELEASE_DECISION=BLOCK | P0=2 P1=18 P2=24 P3=14 | required_fixes=20 deferred=7`

---

## 11-Agent Results

| # | Agent | Self verdict | Gate verdict | P0 | P1 | P2 | P3 | Notes |
|---|-------|--------------|--------------|----|----|----|----|-------|
| 01 | Repo / Build / Static | ALLOW_WITH_CAVEATS | **BLOCK** | 0 | 2 | 2 | 2 | Android lint 2 errors + Playwright 24/60 fail |
| 02 | Supabase DB / RLS / Realtime | BLOCK | **BLOCK** | 2 | 2 | 4 | 0 | Both P0s live here: push_idempotency + push_sent anon RLS bypass |
| 03 | Auth / Family / Multi-child | ALLOW | **BLOCK** | 0 | 2 | 2 | 0 | Child role escalation via fm_upd; pair-code rate-limit defeated by anon signup |
| 04 | Calendar / Memo / Daily Flow | ALLOW | **BLOCK** | 0 | 2 | 4 | 1 | Push month off-by-one; non-atomic events_children desync |
| 05 | Location / Geolocation / Map | ALLOW | **BLOCK** | 0 | 5 | 1 | 4 | Kakao REST key bundled; unpair misses location_history; lat/lng unvalidated; allowBackup |
| 06 | Push / FCM / Safety / Force-ring | BLOCK | **BLOCK** | (carries P0) | 1 | 5 | 0 | get_pending_notifications anon-callable with no internal auth |
| 07 | Android Two-Device Runtime | BLOCK | **BLOCK** | 0 | 0 | 0 | 0 | Pre-auth PASS on both devices; pairing/sync/push runtime NOT_VERIFIED |
| 08 | Web E2E / Real Services | ALLOW_WITH_CAVEATS | **BLOCK** | 0 | 3 | 0 | 2 | Mocked 24/60 fail (stale selectors after d5d183f + a4b5795); real-services 43/43 PASS |
| 09 | UI / Soft Brand / Visual | ALLOW | ALLOW | 0 | 0 | 3 | 2 | Strong red selectable as child accent; 320x568 wrap; splash contrast 2.54 |
| 10 | Security / Privacy / Policy | ALLOW | **BLOCK** | 0 | 3 | 4 | 2 | allowBackup JWT exposure; feedback-email / ai-voice-parse unauth |
| 11 | Performance / Reliability | BLOCK | **BLOCK** | 0 | 4 | 7 | 3 | Realtime miss-recovery gap; fetchEvents unbounded; no offline queue; memo_replies polling gap |
| **Totals (deduped)** | — | — | — | **2** | **18** | **24** | **14** | — |

> Mismatch note: Agents 03, 04, 05, 08, 09, 10 each self-classified as `ALLOW` or `ALLOW_WITH_CAVEATS`, but the release gate applies a strict rule (P1 ≥ 1 → BLOCK) and carries the P0s from Agent 02 across all push/safety dependents. The gate decision overrides per-agent self-verdicts.

---

## Issues — Counts and Short Summary

### P0 — 2 (both BLOCKING)

| ID | Source | Summary |
|----|--------|---------|
| QA-001 | Agent 02 | `push_idempotency` anon RLS bypass — 323 rows visible; migration never enabled RLS. Enables emergency push suppression. |
| QA-002 | Agent 02 | `push_sent` anon RLS bypass — prod state drifted from migration; 182 rows visible; same suppression vector + family-activity enumeration. |

### P1 — 18 (all BLOCKING for v1.0 release)

| ID | Source | Summary | File:Line |
|----|--------|---------|-----------|
| QA-003 | 01 | Android lint NewApi + RECEIVER_EXPORTED | `android/app/src/main/java/com/hyeni/calendar/ForceRingActivity.java:64,159` |
| QA-004 | 01+08 | Playwright critical-flows 24/60 fail (UI-vs-test drift) | `tests/e2e/critical-flows.spec.js` |
| QA-005 | 02+10 | `subscription-reconcile` Edge Function no JWT check | `supabase/functions/subscription-reconcile/index.ts:81-122` |
| QA-006 | 02+10 | `ai-voice-parse` Edge Function no JWT check (OpenAI gpt-4o abuse) | `supabase/functions/ai-voice-parse/index.ts:11-198` |
| QA-007 | 10 | `feedback-email` Edge Function unauth + leaks operator inbox | `supabase/functions/feedback-email/index.ts:9,27-66` |
| QA-008 | 03 | Child can PATCH own family_members row to role=parent | `supabase/migrations/20260506010000_family_members_fm_upd_policy.sql:25-29` |
| QA-009 | 03 | Pair-code per-user rate limit defeated by anonymous signups | `supabase/migrations/20260421095748_pair_code_ttl_and_rotation.sql:35-43` |
| QA-010 | 04 | Push body shows wrong month (0-indexed) on edit_event | `src/App.jsx:4089` |
| QA-011 | 04 | `saveEventWithChildren` non-atomic — partial failure invisibles event | `src/lib/sync.js:1080-1093` |
| QA-012 | 05+10 | Kakao REST key bundled in dist + cached in SharedPreferences | `dist/assets/index-*.js + LocationService.java:209` |
| QA-013 | 05 | `unpair_child` does not purge `location_history` | `supabase/migrations/20260429000010_unpair_child_rpc.sql` |
| QA-014 | 05 | `upsert_child_location` accepts out-of-range lat/lng | upsert_child_location RPC body |
| QA-015 | 05 | `record_location_history_rows` GRANTed to anon, no validation | `supabase/migrations/20260506020000_record_location_history.sql:73` |
| QA-016 | 05+10 | `android:allowBackup=true` exposes JWT + coords + supabaseKey via adb backup | `android/app/src/main/AndroidManifest.xml:33` |
| QA-017 | 06 | `get_pending_notifications` anon-callable with no internal auth | `supabase/migrations/20260314000002_native_push_support.sql:44-60,95` |
| QA-018 | 11 | Realtime CHANNEL_ERROR -> SUBSCRIBED reconnect does not re-fetch missed events | `src/lib/sync.js + src/App.jsx:2412-2443` |
| QA-019 | 11 | `fetchEvents` no `.range()` / date filter — unbounded payload | `src/lib/sync.js:217` |
| QA-020 | 11 | No offline detection nor mutation queue | `src/lib/sync.js + src/App.jsx` |

### P2 — 24 (non-blocking; ship-then-fix; tracked in `issues.json`)

Bundle 1.22 MB; 54 Android lint warnings; Realtime publication coverage NOT_VERIFIED for 3 tables; QONVERSION_ALLOW_UNSIGNED_WEBHOOKS env override; 4 missing down/ migrations; CORS `*`; `mark_memo_read` anon-callable; `getMyFamily` leaks pair_code to children; 30s polling omits memo_replies; events_children INSERT no family-scope check on child_id; daily_supplies GRANT ALL TO anon; self-user INSERT skip drops memos on multi-device same-user; ShutdownReceiver wrong table path; push-notify no rate limit / no body-size cap / raw error strings; remote_listen audit row open on crash; kkuk cooldown depends on sos_events insert; strong red selectable as child accent; 320x568 role-card wrap; splash contrast 2.54; release minifyEnabled=false; no Sentry; error boundary stack-trace leak.

### P3 — 14 (cosmetic / operational debt)

27 console.log in src/; Gradle 9.0 deprecation warnings; cross-timezone dateKey mismatch; no DB-level lat/lng CHECK on 5 tables; location_history no TTL; danger_zones.radius_m no CHECK; ACCESS_BACKGROUND_LOCATION no rationale UI; 11 Playwright tests test.fixme'd; Vite dynamic/static import duplication; chevron contrast 2.88 decorative; font-weight 400 chevron; google-services.json key tracked (acceptable by design); familyId logged; set-accumulator refs no day-rollover prune.

---

## Required Fixes Before Release

20 P0+P1 items must be resolved before ship. File-level fix hints follow; full `fix_hint` text lives in `issues.json` and `release-gate.json` `required_fixes_before_release`.

| ID | Severity | File | One-line fix |
|----|----------|------|--------------|
| QA-001 | P0 | new migration `_lock_down_push_idempotency.sql` | `ALTER TABLE push_idempotency ENABLE ROW LEVEL SECURITY; CREATE POLICY service_only USING (false); REVOKE ALL FROM anon, authenticated`. Add CI anon-probe assertion. |
| QA-002 | P0 | new migration `_re_lock_push_sent.sql` | Idempotent re-apply of RLS + service-only policy on `push_sent`; assert via anon probe pre-deploy. |
| QA-003 | P1 | `android/app/src/main/java/com/hyeni/calendar/ForceRingActivity.java:64,159` | Guard `requestDismissKeyguard` with `Build.VERSION.SDK_INT >= O`; use `ContextCompat.registerReceiver(..., RECEIVER_NOT_EXPORTED)`. |
| QA-004 | P1 | `tests/e2e/critical-flows.spec.js` | Replace `getByText('긴급 알림')` with `getByRole('heading',{name:'긴급 알림'})`; drop `getByText('학부모 모드')` assertion. |
| QA-005 | P1 | `supabase/functions/subscription-reconcile/index.ts:81-122` | Add `getClaims()` verify-jwt gate; require service_role for cron triggers. |
| QA-006 | P1 | `supabase/functions/ai-voice-parse/index.ts:11-198` | Add `getClaims()` JWT check + per-family rate limit; restrict CORS. |
| QA-007 | P1 | `supabase/functions/feedback-email/index.ts:9,27-66` | Add JWT + per-user rate limit; remove hardcoded operator fallback. |
| QA-008 | P1 | `supabase/migrations/20260506010000_family_members_fm_upd_policy.sql:25-29` | Add BEFORE UPDATE trigger raising on role change; add `CHECK role IN ('parent','child')`. |
| QA-009 | P1 | `supabase/migrations/20260421095748_pair_code_ttl_and_rotation.sql:35-43` | IP-based rate limit via Edge Function wrapper; OR 12-char code; OR captcha on anon signup. |
| QA-010 | P1 | `src/App.jsx:4089` | Split messageDateKey by `-`; render `${m+1}월 ${d}일`. |
| QA-011 | P1 | `src/lib/sync.js:1080-1093` | Wrap events upsert + events_children delete + insert in SECURITY DEFINER RPC. Fallback: is_family_event=true on empty child_ids. |
| QA-012 | P1 | `dist/assets/index-*.js + LocationService.java:209` | Move Kakao REST key server-side (Edge Function proxy); strip SharedPreferences cache. |
| QA-013 | P1 | `supabase/migrations/20260429000010_unpair_child_rpc.sql` | Add `DELETE FROM location_history WHERE user_id = p_child_user_id AND family_id = ...`. |
| QA-014 | P1 | upsert_child_location RPC body + child_locations table | `CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)` + RAISE EXCEPTION in RPC. |
| QA-015 | P1 | `supabase/migrations/20260506020000_record_location_history.sql:73` | `REVOKE EXECUTE FROM anon`; add range assertion. |
| QA-016 | P1 | `android/app/src/main/AndroidManifest.xml:33` | `android:allowBackup="false"` or migrate to EncryptedSharedPreferences + backup_rules.xml. |
| QA-017 | P1 | `supabase/migrations/20260314000002_native_push_support.sql:44-60` | Add `IF NOT EXISTS (SELECT 1 FROM family_members WHERE family_id = p_family_id AND user_id = auth.uid()) THEN RETURN; END IF;`. |
| QA-018 | P1 | `src/lib/sync.js + src/App.jsx:2412-2443` | On Realtime resubscribe, trigger window-scoped re-fetch; add 6 missing tables to 30s polling. |
| QA-019 | P1 | `src/lib/sync.js:217` | Add date filter (`-90d`...`+180d`) and `.range(0, 499)`; explicit column list. |
| QA-020 | P1 | new `src/lib/offlineQueue.js` + `src/lib/sync.js` | `@capacitor/network` listener; IndexedDB queue with idempotency keys; replay on reconnect. |

---

## Manual Follow-Up (Pairing-Required Runtime Tests)

The following runtime evidence is `NOT_VERIFIED` because OAuth handoff and family-create + pair-code entry require manual tester action with production-touching credentials. Once a tester completes pairing on devices `R5CY40EE6QE` (parent) + `ZY22H9VTQD` (child), re-dispatch a follow-up agent to capture the remaining evidence:

1. **Pairing flow runtime**: parent OAuth (Kakao / Naver / Google or email/password) -> 가족 만들기 -> 6-digit pair code -> child enters code -> paired home on both devices. Screenshots 06–11 per Agent 07's manual_steps list.
2. **Calendar/memo cross-device realtime sync**: parent inserts event with single-child link -> child observes via Realtime within 2s; same for memos + memo_replies.
3. **Location parent <-> child**: child device emits coordinates -> parent map shows pin within 30s; verify Kalman + stationary detection on actual movement; verify no raw coords leak to logcat.
4. **Push / safety end-to-end**: parent triggers SOS / force-ring / kkuk / instant push -> child receives + audit row inserted; verify cooldown gates retries; verify force-ring full-screen intent over lockscreen.
5. **Remote listen persistent FGS notification**: parent starts remote listen -> child shows persistent notification (Korean disclosure copy) -> entitlement gate verified for premium family.
6. **Realtime publication coverage** (`location_history`, `remote_listen_sessions`, `sos_events`): manual SQL `SELECT pubname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'` on production.
7. **Kakao console restrictions** for bundled REST_KEY + APP_KEY: verify domain/package restriction with screenshot evidence (server-side configuration check, not a code change).
8. **QONVERSION_ALLOW_UNSIGNED_WEBHOOKS production env state**: verify Supabase Functions env vars.

---

## Evidence Index

Per-agent reports, JSON results, and raw evidence directories:

| Agent | Report | Machine | Evidence dir |
|-------|--------|---------|--------------|
| 01 | `.reports/production-qa/build-static-report.md` | `agent01.json` | `.reports/production-qa/build-logs/` |
| 02 | `.reports/production-qa/supabase-db-rls-realtime-report.md` | `agent02.json` | `.reports/production-qa/supabase-evidence/` |
| 03 | `.reports/production-qa/auth-family-isolation-report.md` | `agent03.json` | `.reports/production-qa/auth-family-evidence/` |
| 04 | `.reports/production-qa/calendar-memo-flow-report.md` | `agent04.json` | static analysis only |
| 05 | `.reports/production-qa/location-geolocation-report.md` | `agent05.json` | `.reports/production-qa/location-evidence/` |
| 06 | `.reports/production-qa/push-safety-report.md` | `agent06.json` | `.reports/production-qa/push-safety-evidence/` |
| 07 | `.reports/production-qa/android-two-device/pairing-evidence.md` | `agent07.json` | `.reports/production-qa/android-two-device/` |
| 08 | `.reports/production-qa/web-e2e-report.md` | `agent08.json` | `.reports/production-qa/e2e-results/` |
| 09 | `.reports/production-qa/visual-regression-report.md` | `agent09.json` | `.reports/production-qa/visual-diff/` |
| 10 | `.reports/production-qa/security-privacy-policy-report.md` | `agent10.json` | `.reports/production-qa/security-evidence/` |
| 11 | `.reports/production-qa/performance-reliability-report.md` | `agent11.json` | `.reports/production-qa/performance-evidence/` |

### Two-Device Gate Status

- **Parent**: `R5CY40EE6QE` — samsung SM-A556S — Android 16 / SDK 36 — online — install PASS
- **Child**: `ZY22H9VTQD` — motorola razr 40 ultra — Android 15 / SDK 35 — online — install PASS
- **Same APK on both**: confirmed via `parent-device-info.json` + `child-device-info.json` (app-debug.apk built at HEAD `d5d183f`).
- **Parent logcat**: `.reports/production-qa/android-two-device/parent-logcat.log` (1,129,306 bytes) — 0 FATAL, 0 ANR.
- **Child logcat**: `.reports/production-qa/android-two-device/child-logcat.log` (753,259 bytes) — 0 FATAL, 0 ANR.
- **Pre-auth flow PASS** on both devices: launch -> mode select -> role toggle -> next -> (parent: auth screen, child: pair input).
- **Pairing / calendar / memo / location / push runtime**: `NOT_VERIFIED` (deferred to manual tester).

---

## Closing Note

The platform is structurally sound — clean lint, 729 unit tests green, 43/43 real-services E2E PASS against production Supabase + Realtime + Kakao, both real Android devices launch cleanly through pre-auth. The blocking issues are concentrated in two recoverable areas:

1. Three SQL migrations + three Edge Function auth gates + one AndroidManifest line resolve 9 of the 20 P0/P1 items.
2. The other 11 P1 items are well-bounded source edits with concrete file:line targets.

After those fixes plus a follow-up runtime QA pass once pairing is completed manually on the two-device rig, the gate is expected to clear.

End of report.
