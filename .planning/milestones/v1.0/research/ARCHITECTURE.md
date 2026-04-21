# Architecture Research — Remediation Order & Monolith Surface Map

**Domain:** Brownfield React 19 monolith + Capacitor Android + Supabase (Auth/Realtime/Edge Functions) + Qonversion
**Researched:** 2026-04-21
**Confidence:** HIGH (all findings verified by direct file reads on this repo)
**Scope:** The 9-item remediation list — ordering, dependencies, minimal-surface-area map, Supabase promotion workflow, memo-schema cascade.

> This document does **not** describe generic architecture. It answers four project-specific questions: (1) what order to fix the 9 audit items, (2) which line ranges inside `src/App.jsx` each fix must touch, (3) the Supabase branch → main promotion workflow for the 3 SQL-touching items, (4) what cascades when we change the memo schema.

---

## 1. The 9-Item Dependency Graph

### Legend
- `→` = "must precede" (ordering constraint)
- `⊥` = "no ordering constraint" (can parallelize)
- `↻` = "same work stream, combine in one PR to avoid churn"

### Graph

```
                    ┌───────────────────────────────────────────────┐
                    │  P0-1  Edge Function ES256 JWT                │
                    │        (supabase/functions/push-notify)       │
                    │        Unblocks: ALL background pushes        │
                    └──────────────────┬────────────────────────────┘
                                       │  (blocks everything that
                                       │   needs push-notify 200)
                                       │
            ┌──────────────────────────┼──────────────────────────────┐
            ▼                          ▼                              ▼
    ┌───────────────┐         ┌───────────────┐           ┌────────────────────┐
    │  P0-2 Realtime│         │ P0-3 Pair-code│           │  P1-4 sendInstant  │
    │  publication  │         │ TTL + 1-child │           │       Push chain   │
    │  (saved_places│         │ RLS lockdown  │           │  (App.jsx L94-154) │
    │  + fam_subscr)│         │               │           │                    │
    └──────┬────────┘         └──────┬────────┘           └──────┬─────────────┘
           │                         │                           │
           │  ┌──────────────────────┘                           │
           │  │                                                  │
           ▼  ▼                                                  │
    ┌───────────────────┐                                        │
    │ P1-5 fetchSaved-  │  ← unblocked by P0-2 (404 → 200)      │
    │ Places backoff    │                                        │
    │ (sync.js L176-191)│                                        │
    └──────┬────────────┘                                        │
           │                                                     │
           │       ┌─────────────────────────────────────────────┘
           │       │
           ▼       ▼
    ┌───────────────────┐      ┌────────────────────────────┐
    │  P1-6 Memo model  │      │  P2-7 Pre-pair UI gate     │
    │  unification      │      │  (App.jsx parent/child     │
    │  (migration + 4   │      │   landing routing)         │
    │   App.jsx sites)  │      │                            │
    └──────┬────────────┘      └────────────────────────────┘
           │                                 ⊥ (independent)
           │
           ▼
    ┌───────────────────┐      ┌────────────────────────────┐
    │ P2-8 Remote-listen│      │ P2-9 Kkuk press-hold       │
    │ audit + indicator │      │ + server cooldown + dedup  │
    │ (new table + mic  │      │                            │
    │  WebView fix)     │      │                            │
    └───────────────────┘      └────────────────────────────┘
                     ⊥ (both independent, parallel-safe)
```

### Explicit dependency rules

| Edge | Type | Why |
|------|------|-----|
| **P0-1 → P1-4** | Hard | `sendInstantPush` (App.jsx:94-154) calls the Edge Function; XHR/fetch/beacon all 401 until ES256 is accepted. Testing P1-4 changes is meaningless until P0-1 ships. |
| **P0-1 → P2-8** | Hard | P2-8 (remote-listen) fires `sendInstantPush({ action: "remote_listen" })` from `AmbientAudioRecorder` (App.jsx:2382). Same 401 blocker. |
| **P0-1 → P2-9** | Hard | Kkuk's push fallback (App.jsx:4646-4652) also goes through `sendInstantPush`. |
| **P0-2 → P1-5** | Hard | `fetchSavedPlaces` 404 loop is a symptom of the table+publication being wrong. Fixing the backoff without fixing the table would mask the real problem. After P0-2 the REST call returns 200 and the realtime sub fires — the backoff then handles only *transient* errors. |
| **P0-2 → P1-6** | Soft | Memo unification introduces a new table (or restructured `memos`). It must be added to `supabase_realtime` publication. If P0-2 establishes the publication-add pattern, P1-6 follows. Not a logical blocker but reduces risk. |
| **P0-3 ⊥ P0-1/P0-2** | Independent | Pair-code security is a pure DB/RLS change. No client dependency on push or realtime. Can ship on a separate branch in parallel. |
| **P1-4 → P1-6 client code** | Soft | P1-6 changes memo send sites (App.jsx:4051, 6346-6352, 6371-6377) that all call `sendInstantPush`. Landing P1-4 (instant-push refactor) first means fewer merge conflicts. |
| **P1-4 → P2-9** | Soft | Same file region (push plumbing). Ship P1-4 first, then P2-9 layers dedup/cooldown on top. |
| **P2-7 ⊥ everything** | Independent | Pure UI gate in the landing render branch (App.jsx:5706-5711). Touches no DB, no realtime, no push. |
| **P2-8 ⊥ P2-9** | Independent | Different features; different App.jsx regions (2367-2484 vs 4603-4657). |

### Parallelizable pairs (can assign concurrently)

| Pair | Reason it's safe |
|------|------------------|
| **P0-1 ‖ P0-2 ‖ P0-3** | Three distinct surfaces: Edge Function TS / SQL publication+table / SQL RLS. No file overlap. |
| **P1-4 ‖ P1-5** (after P0-1 & P0-2) | Different files: App.jsx push caller vs sync.js fetch. |
| **P2-7 ‖ P2-8 ‖ P2-9** | Three distinct App.jsx regions; pre-pair gate, remote-listen modal, kkuk button. |

### Non-parallelizable (same-file conflict risk)

- **P1-4 and P2-9 together** — both modify `sendKkuk` logic and push call sites. Land P1-4, merge, then P2-9 on a fresh branch.
- **P1-6 and any other App.jsx change to memo sites** — the 4 memo callsites (4020-4031 load, 4051 visibility flush, 6341 send, 6371 reply) all change in P1-6. Don't parallelize anything that touches memos.

---

## 2. Component Boundary Map Inside `src/App.jsx` (6877 lines)

Verified by direct reads at offsets 1, 2000, 4000, 6000, 6700, plus targeted greps on function signatures. The monolith has **de-facto sections** delineated by `// ─────` comment banners. Each section below gives you the minimum surface you must touch for a given phase.

### 2.1 Top-level module utilities — **lines 1-393**

| Lines | Block | What it owns |
|-------|-------|--------------|
| 1-27 | Imports + constants | `PUSH_FUNCTION_URL`, `AI_PARSE_URL`, etc. |
| 29-47 | `normalizePairCodeInput` | Pair-code parsing (P0-3 touches this if UX changes) |
| 49-74 | `readNotifSettings` / `writeNotifSettings` | LocalStorage for notif prefs |
| 76-91 | `getNativeSetupAction` | Android permission health decision tree |
| **94-154** | **`sendInstantPush`** | **XHR → fetch → beacon chain. P1-4 target.** |
| 156-186 | Remote-audio constants + `stopRemoteAudioCapture` | P2-8 touches |
| 188-238 | `sendFeedbackSuggestion` | Independent |
| 240-263 | `effectiveChildLocation` / `effectiveChildPositions` | Premium tier gating |
| 265-346 | `blobToBase64`, `waitForRealtimeChannelReady`, `startRemoteAudioCapture` | P2-8 target (audio plumbing) |
| 349-380 | Native location service bridges | Independent |
| 382-392 | `rememberParentPairingIntent` / `clearParentPairingIntent` | P2-7 relevant |

### 2.2 Presentational components — **lines 394-3842**

| Lines | Component | Role in 9-item list |
|-------|-----------|---------------------|
| 397-414 | `BunnyMascot` | — |
| **421-485** | **`ParentSetupScreen`** | **P2-7 (parent side of pre-pair gate is already here; child side needs adding)** |
| 491-532 | Constants (`CATEGORIES`, `ACADEMY_PRESETS`, `SCHEDULE_PRESETS`) | — |
| 538-567 | Math/date helpers (`haversineM`, `loadKakaoMap`) | — |
| 571-600 | `KakaoStaticMap`, `MapZoomControls` | — |
| 605-735 | `MapPicker` | — |
| 740-793 | `AlertBanner`, `EmergencyBanner` | — |
| **798-845** | **`RoleSetupModal`** | **P2-7 touches — this is the "child/parent" first screen** |
| **850-916** | **`PairCodeSection`** | **P0-3 touches (TTL display, rotation button)** |
| **921-1013** | **`PairingModal`** | **P0-3 touches (unpair button RLS protection, TTL/refresh UX)** |
| 1018-1146 | `QrPairScanner` | P0-3 peripheral (pair-code UX) |
| **1148-1215** | **`ChildPairInput`** | **P0-3 + P2-7 — child-side entry point. Add TTL/single-child messaging. Add "not paired → only this screen" gate.** |
| 1220-1375 | `AcademyManager` | — |
| 1380-1949 | `RouteOverlay` | — |
| **1954-2078** | **`MemoSection`** | **P1-6 target — chat UI, reply render, read receipt badge** |
| **2083-2257** | **`DayTimetable`** | **P1-6 touches — hosts `<MemoSection>`, passes memo props down** |
| 2262-2361 | `StickerBookModal` | — |
| **2367-2484** | **`AmbientAudioRecorder`** | **P2-8 target — the "listen start" button, timer, auto-stop, audio chunk playback. `sendInstantPush({ action: "remote_listen" })` call at 2382.** |
| 2489-2578 | Saved place helpers (`hasPlaceLocation`, `buildSavedPlaceItems`, etc.) | P1-5 peripheral |
| 2580-2882 | `LocationMapView` | P1-5 consumes savedPlaces state |
| 2889-3127 | `AiScheduleModal` | — |
| 3132-3270 | `DangerZoneManager` | — |
| 3276-3305 | `PhoneSettingsModal` | — |
| **3307-3432** | **`SavedPlaceManager`** | **P1-5 peripheral — this is the parent-side CRUD UI** |
| 3434-3540 | `NotificationSettingsModal` | — |
| 3542-3582 | `FeedbackModal` | — |
| 3587-3614 | `ChildCallButtons` | — |
| 3616-3839 | `ChildTrackerOverlay` | — |

### 2.3 The big root component: `KidsScheduler` — **lines 3844-6877**

This is the monolith's brain. All state, all effects, all handlers live here. The render tree at the end maps routes (`activeView`) to the modal components above. Minimum surface map:

| Lines | Block | Affected phases |
|-------|-------|-----------------|
| 3844-3950 | **State declarations** — `authUser`, `familyInfo`, `myRole`, `showPairing`, `showParentSetup`, `memos`, `memoReplies`, `memoReadBy`, `savedPlaces`, `childPos`, `kkukCooldown`, `showKkukReceived`, etc. | P1-6, P2-7, P2-9 read here |
| 3951-3988 | Refs + derived values (`realtimeChannel`, `dateKeyRef`, `displayChildPositions`) | — |
| 3989-4010 | Add-event form state | — |
| **4011-4031** | **Memo load + `markMemoRead` effect** | **P1-6 target — the `memos` → `memo_replies` → `read_by` triangle** |
| 4033-4041 | Kakao Maps SDK load | — |
| **4043-4062** | **Memo visibility-flush push** (`memoDirty` → `upsertMemo` → `sendInstantPush`) | **P1-4 touches, P1-6 rewrites** |
| 4064-4074 | Phone sync, notif settings effect | — |
| 4087-4140 | Native OAuth deep-link handler | — |
| 4143-4146 | SW registration | — |
| 4149-4188 | Native notification health | — |
| 4192-4210 | Web Push subscription effect (web only) | — |
| 4213-4253 | FCM token registration (Android) | — |
| 4256-4280 | `handleAuthUser` | P2-7 — determines whether to show `ParentSetupScreen` |
| 4282-4379 | Auth init + `onAuthChange` | — |
| **4382-4522** | **`useEffect(subscribeFamily)`** — subscribes to family realtime, handles 7 callbacks: events, academies, memos, saved_places, memo_replies, kkuk, remote_listen (start/stop) + audio_chunk | **P0-2 makes `onSavedPlacesChange` work; P1-6 rewrites `onMemosChange`; P2-8 extends `onRemoteListenStart`** |
| 4525-4546 | FCM remote-listen auto-start flag polling | P2-8 |
| 4548-4573 | **30s polling fallback** — calls `fetchEvents`, `fetchMemos`, `fetchSavedPlaces` every 30s | **P1-5 target — sibling call pattern sits right here** |
| **4603-4657** | **`sendKkuk` callback** — the kkuk send handler (realtime broadcast + push fallback) | **P2-9 target — add press-hold trigger, dedup key** |
| 4661-4696 | Android back-button handler | — |
| 4699-4737 | `startTrial` / `confirmStartTrial` | — |
| 4740-5050 | Event CRUD handlers (add/edit/delete event, location lookup, location history) | Multiple `sendInstantPush` sites (4860, 4937, 5013, 5030) — P1-4 beneficiary |
| 5300-5450 | Academy/saved-place/phone CRUD | — |
| 5640-5686 | `handleChildSelect`, `handleCreateFamily`, `handleJoinAsParent` | P2-7 — add gate around child flow |
| 5687-5692 | **"show pairing if alone"** effect | **P2-7 touches — parent gate** |
| **5706-5711** | **`RoleSetupModal` render + `ParentSetupScreen` render** | **P2-7 main target — the early-return branches before the main shell render** |
| 5713-5900 | Modal render branches (`showAcademyMgr`, `showSavedPlaceMgr`, etc.) | — |
| 6000-6225 | Header, quick actions, kkuk button, logout | P2-9 touches kkuk button at 6142-6151 |
| 6225-6350 | Calendar grid + date selector | — |
| 6297-6381 | **`<DayTimetable>` render with memo props** (`onMemoSend`, `onReplySubmit`, `memoReadBy`) | **P1-6 target — the 3 callbacks at 6341, 6360, 6371** |
| 6397-6500 | Add-event modal JSX | — |
| 6589-6800 | Sticker book, AI schedule, danger zones, kkuk overlay | P2-9 touches at 6829-6873 (the kkuk received overlay) |
| 6875-6877 | Component close | — |

### 2.4 Minimum surface per phase (copy-paste table)

| Phase | Files | Minimum touch zones |
|-------|-------|---------------------|
| **P0-1** | `supabase/functions/push-notify/index.ts` | JWT header parse (lines 266-299) OR toggle `verify_jwt=false` in `config.toml` and let the function accept anon. No App.jsx changes. |
| **P0-2** | New migration `YYYYMMDD_realtime_publications.sql` | `ALTER PUBLICATION supabase_realtime ADD TABLE saved_places; ALTER PUBLICATION supabase_realtime ADD TABLE family_subscription;` (+ REPLICA IDENTITY FULL). No client changes. |
| **P0-3** | New migration `YYYYMMDD_pair_code_security.sql` + `src/App.jsx` L850-916, L1148-1215 | Migration: add `pair_code_expires_at`, `pair_code_used_at`, tighten `join_family` RPC, add "max 1 child per family" constraint, block self-unpair RLS. UI: show TTL countdown in `PairCodeSection`, disable join after expiry in `ChildPairInput`. |
| **P1-4** | `src/App.jsx` L94-154 only | Rewrite `sendInstantPush` body. No other file. Add idempotency-key + single-path (kill XHR→fetch→beacon triple-send). |
| **P1-5** | `src/lib/sync.js` L176-191 + possibly L548-573 (polling caller) | Add exponential backoff + circuit breaker inside `fetchSavedPlaces`. Pattern can extend to other fetch* functions later. |
| **P1-6** | Migration `YYYYMMDD_memo_unification.sql` + `src/lib/sync.js` L157-312 + `src/App.jsx` L3888-3890 (state), L4011-4031 (load), L4043-4062 (flush), L4433-4447 (realtime memo handler), L4493-4501 (realtime reply handler), L6341-6381 (send + reply JSX), L1954-2078 (`MemoSection`) | This is the heaviest phase. |
| **P2-7** | `src/App.jsx` L421-485, L798-845, L1148-1215, L5706-5711, L5687-5692 | Add `showChildPairGate` early-return branch before the main shell render. Make `ChildPairInput` a full-screen gate for `myRole=="child" && !familyId`. |
| **P2-8** | Migration `YYYYMMDD_remote_listen_audit.sql` + `src/App.jsx` L2367-2484 + Android `RemoteListenService.java` | New table `remote_listen_sessions(id, family_id, parent_user_id, child_user_id, started_at, ended_at, duration_sec, consent_shown)`. Insert on session start. Add an always-visible indicator in `AmbientAudioRecorder`. Remove WebView auto-grant of mic from Android. |
| **P2-9** | `src/App.jsx` L4603-4657 (sendKkuk), L6142-6151 (kkuk button JSX), L4482-4492 (onKkuk receiver) | Add `onTouchStart`/`onTouchEnd`-based press-hold (500-1000ms). Compute `dedupKey = sha1(senderId + floor(ts/1000))`. Server-side RPC for cooldown (new migration optional if client-only cooldown is acceptable). |

---

## 3. Supabase Branch → Main Promotion Workflow

Only **3 of the 9 items** touch SQL:
- **P0-2** (realtime publication + DDL confirm on `saved_places`/`family_subscription`)
- **P0-3** (pair_code TTL + RLS + unique constraint)
- **P1-6** (memo schema unification)
- *(optional)* P2-8 adds a new table `remote_listen_sessions`

All four follow the same workflow. The constitution constraint: **production has live family data and anon key is public** — we cannot just `db push` to main.

### 3.1 Workflow (reusable template)

```
┌──────────────────────────────────────────────────────────────────┐
│                    Per-PR Supabase Promotion                      │
├──────────────────────────────────────────────────────────────────┤
│  STEP 1  Create branch                                           │
│    $ supabase branches create phase-P0-2-realtime-pub            │
│    • Provisions isolated Postgres + anon/service keys            │
│    • Copies migrations/ schema automatically                     │
│                                                                   │
│  STEP 2  Author migration                                        │
│    • New file: supabase/migrations/YYYYMMDDHHMMSS_<name>.sql     │
│    • MUST be idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS   │
│    • MUST include a rollback.sql or inline comment with revert   │
│    • Apply locally: supabase db push --branch phase-P0-2         │
│                                                                   │
│  STEP 3  Seed test data on branch                                │
│    • Run scripts/seed-family.sql (or equivalent)                 │
│    • Creates 1 parent, 1 child, 1 family row                     │
│    • Mirrors prod shape without copying prod data                │
│                                                                   │
│  STEP 4  Verify on branch                                        │
│    a) Playwright real-services:                                  │
│       $ SUPABASE_URL=<branch-url> \                              │
│         SUPABASE_ANON_KEY=<branch-anon> \                        │
│         npx playwright test --config=playwright.real.config.js   │
│    b) For P0-2 specifically: open DevTools WS, confirm          │
│       postgres_changes frames include saved_places table.        │
│    c) For P0-3: manually verify                                  │
│       - Expired code rejection                                   │
│       - Second child join rejected                               │
│       - Child cannot unpair self                                 │
│    d) For P1-6: run data-migration script against seeded data,   │
│       verify row counts match (memos + memo_replies → unified). │
│                                                                   │
│  STEP 5  Promote to main                                         │
│    Option A — CLI:                                               │
│      $ git checkout main && git merge phase-P0-2                 │
│      $ supabase db push  # applies to prod                       │
│    Option B — Dashboard:                                         │
│      "Merge branch" → review diff → confirm                      │
│    • Production data is NOT reset                                │
│    • Migration runs forward-only                                 │
│                                                                   │
│  STEP 6  Verify on prod (within 5 min)                           │
│    • Re-run smoke subset of Playwright real-services against    │
│      production with a throwaway test family                     │
│    • Monitor Edge Function logs for 5 min                        │
│    • If broken: run rollback.sql immediately                     │
│                                                                   │
│  STEP 7  Delete branch                                           │
│    $ supabase branches delete phase-P0-2-realtime-pub            │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Rollback discipline per SQL item

| Item | Forward migration is safe? | Rollback strategy |
|------|---------------------------|-------------------|
| **P0-2** | Yes — `ALTER PUBLICATION ADD TABLE` is additive, replica identity can be lowered. | `ALTER PUBLICATION supabase_realtime DROP TABLE saved_places;` Zero data loss. |
| **P0-3** | Adds columns (safe) + tightens RLS (safe — overly restrictive). Risk: breaking existing pair_codes if `expires_at` is set retroactively to past. **Mitigation:** set `expires_at = now() + interval '30 days'` for all existing rows in the same migration. | Drop the new columns + restore the previous RLS policy from `supabase/add-write-policies.sql`. |
| **P1-6** | Destructive if the unification deletes the old `memos` or `memo_replies` table. | **MUST be two-phase:** phase A — create new `memo_threads` / `memo_entries` table, dual-write from app, backfill. Phase B (next milestone) — drop old tables. Rollback in phase A is just dropping the new table. |
| **P2-8** (optional) | Purely additive (new table). | `DROP TABLE remote_listen_sessions;` |

### 3.3 Why the migration folder matters for P0-3 specifically

The `pair_code` generation + `join_family` RPC live in legacy `supabase/*.sql` files, **not** in `supabase/migrations/`. The 2026-04-18 wave onwards uses `migrations/`. P0-3 must:

1. Copy the existing `join_family` RPC definition into a new migration (captures current behavior as baseline).
2. Layer TTL/single-child checks on top in the same file.
3. Avoid the "two sources of truth" problem by moving the pair-code functions under version control.

Without this, a future `supabase db reset` on a branch would be missing the pair-code RPC entirely.

---

## 4. Memo Schema Change (P1-6) — Cascade Map

P1-6 is the most cross-cutting change in the milestone. Here's every code path that touches memos and must be audited when the schema changes.

### 4.1 Current memo data model

```
┌──────────────────────────────────────────────────────────────────┐
│  memos  (flat per-date content — audit says may be missing       │
│          created_at / user_id columns → 42703 error)             │
│  ├─ family_id  uuid                                              │
│  ├─ date_key   text                                              │
│  ├─ content    text                                              │
│  └─ read_by    text[]     ← mark_memo_read RPC appends here      │
│                                                                   │
│  memo_replies  (already rich — chat-style)                       │
│  ├─ id         uuid                                              │
│  ├─ family_id  uuid                                              │
│  ├─ date_key   text                                              │
│  ├─ user_id    uuid                                              │
│  ├─ user_role  text                                              │
│  ├─ content    text                                              │
│  └─ created_at timestamptz                                       │
└──────────────────────────────────────────────────────────────────┘
```

**Recommendation in PROJECT.md:** keep `memo_replies` (it's the richer schema), deprecate `memos` to just `memo_threads(family_id, date_key, read_by[])` acting as a read-receipt ledger.

### 4.2 What cascades when memo schema changes

```
                 ┌────────────────────────────────────────┐
                 │   supabase/migrations/<unification>.sql│
                 │   - create memo_threads OR rename      │
                 │   - move read_by[] to threads          │
                 │   - update RLS to match                │
                 │   - ALTER PUBLICATION supabase_realtime│
                 │     ADD TABLE memo_threads             │
                 │   - DROP PUBLICATION membership of old │
                 │     memos table (if deprecated)        │
                 └────────────────┬───────────────────────┘
                                  │
          ┌───────────────────────┼────────────────────────┐
          ▼                       ▼                        ▼
  ┌───────────────┐     ┌───────────────────┐    ┌─────────────────┐
  │ RLS policies  │     │ Realtime          │    │ Stored funcs    │
  │               │     │ publications      │    │                 │
  │ memos         │     │ - events          │    │ mark_memo_read  │
  │   select/insert     │ - memos ← CHANGE  │    │  (RPC — rewrite │
  │   /update/delete    │ - academies       │    │   to target new │
  │ memo_replies  │     │ - memo_replies    │    │   table)        │
  │   select/insert     │ - saved_places ←P0-2   │                 │
  │   /delete     │     │ + memo_threads    │    │ get_memos_for_  │
  │ → REWRITE     │     │ ← NEW             │    │  family (if any)│
  └───────────────┘     └───────────────────┘    └─────────────────┘
          │                       │                        │
          └───────────────────────┼────────────────────────┘
                                  ▼
                 ┌────────────────────────────────────────┐
                 │         src/lib/sync.js                │
                 │                                        │
                 │  Functions to rewrite:                 │
                 │  - fetchMemos           (L157-174)    │
                 │  - upsertMemo           (L272-280)    │
                 │  - fetchMemoReplies     (L284-293)    │
                 │  - insertMemoReply      (L295-300)    │
                 │  - markMemoRead         (L304-312)    │
                 │                                        │
                 │  Realtime callbacks in subscribeFamily │
                 │  (L414-420 memos, L430-437 replies):   │
                 │  - rename table filter                 │
                 │  - merge event streams or split        │
                 └────────────────┬───────────────────────┘
                                  │
                                  ▼
                 ┌────────────────────────────────────────┐
                 │            src/App.jsx                 │
                 │                                        │
                 │  State:                                │
                 │   L3888: memos map                     │
                 │   L3889: memoReplies array             │
                 │   L3890: memoReadBy array              │
                 │                                        │
                 │  Load effect:                          │
                 │   L4021-4031: fetchMemoReplies +       │
                 │   markMemoRead + read_by query         │
                 │                                        │
                 │  Visibility flush:                     │
                 │   L4043-4062: upsertMemo +             │
                 │   sendInstantPush on pagehide          │
                 │                                        │
                 │  Realtime handlers:                    │
                 │   L4433-4447: onMemosChange            │
                 │   L4493-4501: onMemoRepliesChange      │
                 │                                        │
                 │  Send sites:                           │
                 │   L6341-6358: onMemoSend (explicit)    │
                 │   L6360-6378: onReplySubmit            │
                 │                                        │
                 │  Component props:                      │
                 │   MemoSection (L1954-2078):            │
                 │     replies, readBy, myUserId,         │
                 │     onReplySubmit, onMemoSend          │
                 │   DayTimetable (L2083, 2244-2254):     │
                 │     passes props through               │
                 └────────────────────────────────────────┘
```

### 4.3 Every file that must be touched for P1-6 (enumerated)

| # | File | Lines | What changes |
|---|------|-------|--------------|
| 1 | `supabase/migrations/YYYY_memo_unify.sql` (new) | — | Create unified table, backfill, RLS, publication |
| 2 | `src/lib/sync.js` | 157-174 | `fetchMemos` now returns `{ content, replies[], readBy[] }` per date_key |
| 3 | `src/lib/sync.js` | 272-280 | `upsertMemo` targets new table |
| 4 | `src/lib/sync.js` | 284-312 | `fetchMemoReplies` / `insertMemoReply` / `markMemoRead` revise table names |
| 5 | `src/lib/sync.js` | 414-437 | `subscribeFamily` memo + replies callbacks: change `table` filter; possibly merge into one handler |
| 6 | `src/App.jsx` | 3888-3890 | Possibly collapse `memos` + `memoReplies` + `memoReadBy` into one state object |
| 7 | `src/App.jsx` | 4011-4031 | Load effect: single fetch returns all three |
| 8 | `src/App.jsx` | 4043-4062 | Visibility flush: still calls `upsertMemo` but with new shape |
| 9 | `src/App.jsx` | 4433-4447 | `onMemosChange`: may be obsolete if unified with replies |
| 10 | `src/App.jsx` | 4493-4501 | `onMemoRepliesChange`: table filter rename |
| 11 | `src/App.jsx` | 6341-6378 | Send + reply callbacks |
| 12 | `src/App.jsx` | 1954-2078 | `MemoSection` props: if shape changes, component signature changes |
| 13 | `src/App.jsx` | 2083, 2244-2254 | `DayTimetable` prop forwarding |
| 14 | `tests/e2e/*-real.spec.js` | — | Add memo-flow coverage against new schema |

**Count:** 1 SQL file + 2 source files + 14 distinct line regions. This is the largest surface of any P1/P2 item and should be the **last** phase in its batch.

---

## 5. Recommended Phase Ordering (final)

Based on the dependency graph and surface-area reality, here's the recommended ordering — **this is the answer to Question 1**.

### Phase 1 (day 1, parallel ✕3) — **Unblock everything**
```
Parallel stream A:  P0-1  (Edge Function ES256)
Parallel stream B:  P0-2  (Realtime publication)
Parallel stream C:  P0-3  (Pair-code security)
```
**Exit criterion:** All three Supabase-branch-verified, merged to main, production smoke-tested.

### Phase 2 (day 2, parallel ✕2) — **Client-side push & fetch hygiene**
```
Parallel stream A:  P1-4  (sendInstantPush chain cleanup)
Parallel stream B:  P1-5  (fetchSavedPlaces backoff)
```
**Exit criterion:** Playwright real-services shows no 401 from push, no 404-retry-loop, kkuk latency < 1s.

### Phase 3 (day 3-4, solo) — **Memo unification**
```
Solo:  P1-6  (schema + 14 line regions)
```
**Exit criterion:** Single memo data model in DB; E2E covers "parent sends memo → child replies → both see read receipt". Old `memos` table deprecated but not dropped (drop in v1.1).

### Phase 4 (day 5, parallel ✕3) — **UX polish**
```
Parallel stream A:  P2-7  (pre-pair UI gate)
Parallel stream B:  P2-8  (remote-listen audit + indicator)
Parallel stream C:  P2-9  (kkuk press-hold + dedup)
```
**Exit criterion:** All 9 items validated in PROJECT.md; milestone-complete.

### Why this ordering (vs alternatives)

| Alternative | Why rejected |
|-------------|--------------|
| P0-1 → P0-2 → P0-3 serial | Wastes a day. They have zero file overlap. |
| P1-4 before P0-1 | `sendInstantPush` refactor cannot be E2E-verified against a 401 function. |
| P1-5 before P0-2 | The 404 is caused by the publication gap. Adding a backoff first gives a false sense of completion. |
| P1-6 before P0-2 | Adding a new table + publication without the P0-2 precedent means we learn the publication-promote workflow twice. |
| P2-9 bundled with P1-4 | Same file region; creates merge conflicts unnecessarily. |
| P2-7 first | Only protects new users; existing users already paired. Not a blocker for safety-critical P0/P1 work. |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: "While we're in App.jsx, let's also refactor X"

**What people do:** Each phase touches App.jsx, so an engineer notices nearby cruft and adds "small" refactors.
**Why wrong:** The 6877-line monolith is intentionally out-of-scope (per PROJECT.md). Drive-by refactors expand PR diff, slow review, increase merge conflicts between parallel streams.
**Do instead:** Log drive-by observations in `PITFALLS.md` or a `TODO.md`. Touch only the line ranges listed in section 2.4 for the current phase.

### Anti-Pattern 2: "The realtime subscription works in dev, ship it"

**What people do:** Realtime subscribes successfully in local Supabase (because local auto-adds tables to the publication) but fails silently in production.
**Why wrong:** The production `supabase_realtime` publication is manually curated. Local parity ≠ prod parity.
**Do instead:** Always verify in Supabase branch, which starts with the production publication set.

### Anti-Pattern 3: "Just use `db push --force` to skip safety checks"

**What people do:** Bypass branch verification when migration is "obviously safe".
**Why wrong:** Live family data; anon key is public; RLS regressions are data-leakage class bugs. P0-3 literally exists because an RLS hole was exploited.
**Do instead:** Every SQL change goes through the 7-step workflow in section 3.1, no exceptions.

### Anti-Pattern 4: "Delete the old `memos` table in the same PR as P1-6"

**What people do:** Unify schema and drop legacy in one shot.
**Why wrong:** If unification bug surfaces 30 min after prod deploy, rollback requires recreating legacy data.
**Do instead:** Two-phase: new table + dual-write + backfill (P1-6 this milestone) → drop legacy (v1.1 next milestone, after 14-day observation).

---

## Integration Points

### Realtime publication membership (verified from `supabase/migration.sql`, `fix-all-rls.sql`, `fix-sync-final.sql`)

| Table | In `supabase_realtime`? | Used by subscribeFamily? | Status |
|-------|------------------------|--------------------------|--------|
| events | Yes | Yes | OK |
| memos | Yes | Yes | OK (but schema drift — P1-6) |
| academies | Yes | Yes | OK |
| memo_replies | Unclear — no explicit ADD found in migrations/ | Yes | Likely added via dashboard; verify in P0-2 |
| **saved_places** | **No** | **Yes** | **Broken — P0-2** |
| **family_subscription** | **No** | Subscribed indirectly via entitlement hooks | **Broken — P0-2** |

### Edge Functions currently deployed (from `src/App.jsx` constants L22-25)

| Function | URL constant | Affected by |
|----------|--------------|-------------|
| `push-notify` | `PUSH_FUNCTION_URL` | P0-1 |
| `ai-voice-parse` | `AI_PARSE_URL` | — |
| `ai-child-monitor` | `AI_MONITOR_URL` | — |
| `feedback-email` | `FEEDBACK_FUNCTION_URL` | — |

Only `push-notify` is in-scope for this milestone.

---

## Sources

- `C:\Users\A\Desktop\hyeni\hyeni\.planning\PROJECT.md` — milestone scope, constraints, 9 REQ-IDs, decision log
- `C:\Users\A\Desktop\hyeni\hyeni\src\App.jsx` — direct reads at offsets 1, 200, 2000, 2367, 3844, 4000, 4380, 4600, 5600, 6000, 6340, 6700; grep of all function declarations
- `C:\Users\A\Desktop\hyeni\hyeni\src\lib\sync.js` — full file read (575 lines)
- `C:\Users\A\Desktop\hyeni\hyeni\src\lib\pushNotifications.js` — full file read (486 lines)
- `C:\Users\A\Desktop\hyeni\hyeni\supabase\functions\push-notify\index.ts` — full file read (537 lines)
- `C:\Users\A\Desktop\hyeni\hyeni\supabase\config.toml` — config (auth JWT, realtime, edge_runtime)
- `C:\Users\A\Desktop\hyeni\hyeni\supabase\migrations\20260315152655_memo_replies_setup.sql`
- `C:\Users\A\Desktop\hyeni\hyeni\supabase\migrations\20260418000006_saved_places.sql`
- `C:\Users\A\Desktop\hyeni\hyeni\supabase\migrations\20260418000000_family_subscription.sql`
- Grep results for `ALTER PUBLICATION supabase_realtime` across `supabase/` (3 legacy SQL files, no migrations/ file)
- `C:\Users\A\Desktop\hyeni\hyeni\playwright.real.config.js` — real-services E2E harness

---

*Architecture research for: brownfield remediation ordering + monolith surface mapping*
*Researched: 2026-04-21*
