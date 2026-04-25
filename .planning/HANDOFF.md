# HANDOFF — 2026-04-22 pause point

**Session paused at user request**. All work is committed and pushed to `origin/main` (HEAD = `c846d15`). No dangling local state beyond line-ending-only capacitor gradle files + 3 untracked `.reports/*.png` QA screenshots (all included in the pause commit for reproducibility).

Next session: read this file + `.planning/STATE.md` + most recent 5.5/06-*-SUMMARY.md to pick up context cleanly.

## Completed this session (2026-04-22)

1. **Phase 5.5 Memo UX Cleanup (URGENT inserted)** — ✅ VERIFIED live
   - Legacy `public.memos` textarea removal + X/Thread-style bubble UI + 2 toasts (onboarding + send-failure)
   - Commits `7c9ba2b..7699715` (8 commits), `npm run build` PASS, codex review rounds 1+2 PASS
   - User 2-device live smoke PASS on hyenicalendar.com
   - `.planning/phases/5.5-memo-ux-cleanup/05.5-01-SUMMARY.md` + `05.5-02-SUMMARY.md`

2. **Phase 6 Infrastructure & Polish** — ✅ 3/3 VERIFIED live
   - CI-01: `.github/workflows/android-apk.yml` green at `df656b9` after 5 iterative fixes (cap sync → SDK 36 → log artifact → cordova dir commit → JDK 21). APK artifact 8.97MB available for 14 days.
   - PWA-01: `vercel.json` with manifest.json carve-out → `curl -I https://hyenicalendar.com/manifest.json` returns 200.
   - IDEMP-TTL-01: Supabase migration `20260422000000_push_idempotency_ttl_cron.sql` applied via MCP, `cron.job cleanup_push_idempotency` active hourly. Commit `4c62f53`.
   - `.planning/phases/06-infrastructure-polish/06-SUMMARY.md`

3. **v1.2 Sound Around & Consent Port** — staged at `.planning/milestones/v1.2/` (ROADMAP-STAGING, REQUIREMENTS-STAGING, PROJECT-STAGING). 5 phases (9-13), 14 REQ per the approved plan `C:/Users/A/.claude/plans/hyeni-modular-chipmunk.md`. Promote on `/gsd-complete-milestone v1.1`.

4. **ai-child-monitor 401 bug** — FIXED + deployed + verified live
   - Root cause: ES256 JWT gateway rejection (supabase#42244), same pattern as push-notify which was fixed with `--no-verify-jwt` + in-function getClaims
   - Fix: added auth gate in `supabase/functions/ai-child-monitor/index.ts` + deployed via Supabase MCP with `verify_jwt=false` → version 9 ACTIVE
   - Live probe confirmed: no-auth → 401 `{"error":"missing auth"}`, bogus JWT → 401 `{"error":"invalid jwt"}`, gateway no longer blocks
   - `.planning/debug/ai-child-monitor-401.md` (status: resolved)

5. **UX decisions captured in memory**
   - KKUK vs SOS distinction feedback (never conflate — KKUK is affection, SOS is emergency, SOS auto-attaches location)
   - Codex review after every GSD step feedback
   - Codex model pinned to `gpt-5.4` (ChatGPT account default; `gpt-5.3-Codex-Spark` 400-errors on this account)
   - Zoom-map on child-card confirmed for v1.3 with walking-scale Kakao level 1-3 (surrounding buildings visible, per user /btw)

## REMAINING WORK — pick up here

### v1.1 milestone close-out (2 phases left)

**Phase 7 — Android Native Build & Submit** (REQ NATIVE-01, NATIVE-02)
- **NATIVE-01 (code half — Claude can do alone)**:
  - `src/App.jsx` add `window.addEventListener('mic-permission-denied', ...)` handler
  - On denied event, show Korean toast/modal guiding user to Android Settings → App → Permissions → Microphone
  - Test locally via DevTools `window.dispatchEvent(new CustomEvent('mic-permission-denied'))`
  - Also verify `aapt dump badging` on the CI-produced APK shows `foregroundServiceType microphone`
- **NATIVE-02 (Play Console half — user-only)**:
  - User signs in to Google Play Console
  - Internal testing track → upload AAB (download from latest GitHub Actions artifact)
  - Fill "Spyware/Stalkerware exception" family-app category declaration
  - Invite ≥1 internal tester (e.g. `energetk@naver.com`), confirm auto-install
- **CI secrets step for signed release builds (user-only)**: add 4 GitHub Secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) then the workflow auto-flips from assembleDebug to assembleRelease.

**Phase 8 — End-to-End Verification** (REQ NATIVE-03)
- User-in-loop 2-device live smoke on real Android devices (parent + child with NEW APK installed)
- Scope per 2026-04-22 user `/btw`: verify KKUK + memo + RL permission gate + banner + FGS + FCM wake ALL work in the same session (not just RL — earlier KKUK/memo regression report means we must re-confirm all 3)
- Criteria scaled down from original roadmap per session discussion: audio-chunk streaming is v1.2 scope, not v1.1. v1.1 Phase 8 verifies the native shell (permission + notification + wake), leaves audio quality to v1.2.
- Success → `/gsd-audit-milestone` → `/gsd-complete-milestone v1.1` which promotes `.planning/milestones/v1.2/*-STAGING.md` → live roadmap/requirements/project docs.

### v1.2 Sound Around & Consent Port (Phase 9-13) — begin AFTER v1.1 closes

Approved plan: `C:/Users/A/.claude/plans/hyeni-modular-chipmunk.md`. Staged at `.planning/milestones/v1.2/`. Summary of the 14 REQ + Stability-First decisions already in the staging files. First actual execute-step will be **Phase 9 Plan**.

### v1.3 SOS Hardening milestone (findmykids-grade parity) — scoped only

Distinct from KKUK. Must include:
- `SosOverlayActivity` (full-screen, `showWhenLocked=true`, `turnScreenOn=true`, `excludeFromRecents=true`)
- Auto-attached live location (sent to parent alongside the alert, via `getCurrentPosition({maximumAge:0, timeout:5000})`)
- DND-bypass notification channel
- Distinct large red emergency button (separate UI + semantics from KKUK affection tap)
- `sos_events` audit log extension (location column)
- **Zoom-map on child name-card** — BUNDLE HERE (not v1.2). Walking scale: Kakao map level 1-3 (surrounding buildings visible). Shared zoom-map component reused by SOS auto-location view for consistency.
- Memory: `project_findmykids_sos_port_scope.md` + `project_child_location_zoom_on_card_click.md` + `feedback_kkuk_vs_sos_distinction.md`

### Unblocked by user action (when you're ready)

- Phase 7 user half: Play Console submission, Android keystore secrets in GitHub
- Phase 8: 2-device live smoke on real Android devices with new APK

### Backlog / not yet scheduled

- `tests/entitlementCache.test.js` pre-existing failure (unrelated to this session) — open ticket for triage
- CI deprecation warning: Node.js 20 actions (actions/checkout@v4 etc.) will sunset; bump to major v5 when released
- `memos` table legacy rows — still present with `origin='legacy_memo'`; currently rendered as amber "예전 메모" bubbles. Drop migration after 30-day shadow expiry (2026-05-21) in v1.2 or later.

## Key pointers for next session

- STATE cursor: v1.1 Phase 7 Ready to plan (`.planning/STATE.md`)
- Live roadmap: `.planning/ROADMAP.md` shows Phase 5.5 ✅ + Phase 6 ✅
- Staged roadmap for v1.2: `.planning/milestones/v1.2/ROADMAP-STAGING.md`
- Memory index: `C:/Users/A/.claude/projects/c--Users-A-Desktop-hyeni/memory/MEMORY.md` (6 entries)
- Most recent commits on `main`:
  - `c846d15` docs(debug): ai-child-monitor 401 RESOLVED
  - `310da4f` fix(ai-child-monitor): in-function JWT verification
  - `3275c49` docs(06): Phase 6 VERIFIED + advance cursor
  - `4c62f53` feat(06-03): push_idempotency TTL cron
  - `c068b3e` fix(06-02): vercel.json manifest carve-out
  - `f8ccf8a` ci(06-01): Android APK build workflow
- Supabase edge function versions: `push-notify` v34, `ai-child-monitor` v9 (both `--no-verify-jwt` with in-function getClaims)
- Production project id: `qzrrscryacxhprnrtpjd` (hyeni calendar, ap-northeast-2)

## Resume with

```
/gsd-progress
```

Or jump directly into Phase 7 NATIVE-01 code half (does not require user-in-loop):

```
/gsd-plan-phase 7
```
