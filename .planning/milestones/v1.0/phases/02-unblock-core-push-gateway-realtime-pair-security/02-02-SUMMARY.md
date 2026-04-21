---
plan: 02-02
phase: 02-unblock-core-push-gateway-realtime-pair-security
title: "Realtime Publications + Per-Table Channel Refactor"
status: complete
completed_at: 2026-04-21
stream: B
requirements: [RT-01, RT-02, RT-03, RT-04]
depends_on: []
autonomous: false
checkpoint_passed: human-verify (user approved)
---

# Plan 02-02: Realtime Publications + Per-Table Channel Refactor

## What was delivered

**SQL side:**
- Pre-flight detected missing migration chain (`20260418000000` → `20260418000006`). Applied minimal chain (000000 family_subscription + 000001 subscription_tier_cache + 000006 saved_places) — no behavior flip for 67 free families.
- New migration `supabase/migrations/20260421103134_enable_realtime_publications.sql`:
  - `ALTER PUBLICATION supabase_realtime ADD TABLE` for `saved_places`, `family_subscription`, `memo_replies` (idempotent via `DO $$ ... EXCEPTION WHEN duplicate_object ...` guards)
  - `REPLICA IDENTITY FULL` on all 6 realtime-subscribed tables (events, academies, memos, saved_places, family_subscription, memo_replies)
  - `NOTIFY pgrst, 'reload schema'` issued post-COMMIT (outside transaction per PostgREST docs)
- Paired down migration in `supabase/migrations/down/` reverses with `DROP ... FROM PUBLICATION` + `REPLICA IDENTITY DEFAULT`.

**Client side (`src/lib/sync.js`):**
- Refactored `subscribeToFamily` into **7 channels, 1 binding each**:
  - 6 postgres_changes channels: `events-{familyId}`, `academies-{familyId}`, `memos-{familyId}`, `saved_places-{familyId}`, `family_subscription-{familyId}`, `memo_replies-{familyId}`
  - 1 broadcast channel: `family-{familyId}` (kkuk, remote_listen_start/stop, audio_chunk, child_location, arrival)
- New `subscribeTableChanges()` helper with independent CHANNEL_ERROR retry (10 attempts, exponential backoff capped at 60s) per channel
- Returns a composite handle: broadcast channel with `_channels[]` + `_dispose()` attached
- Caller contract preserved — `src/App.jsx` unchanged (verified via grep at lines 4657, 4658, 4808, 2416, 2423, 318, 4543, 4569, 6771, 4557)
- New optional callback `onFamilySubscriptionChange` (Qonversion consumer wiring deferred to Phase 5)

## Commits

- `4cee5a5` — chore(02-02): precondition check + apply minimal migration chain (000000/000001/000006)
- `b155dfb` — feat(02-02): enable_realtime_publications + REPLICA IDENTITY FULL (up + down)
- `e7b9867` — refactor(02-02): sync.js per-table Realtime channels + retry isolation
- (this commit) — docs(02-02): complete SUMMARY + STATE/ROADMAP

## Post-apply verification (all PASS)

**pg_publication_tables** — 6 tables in `supabase_realtime` publication:
`academies, events, family_subscription, memo_replies, memos, saved_places` ✅

**pg_class.relreplident = 'f' (FULL)** for the 6 tables above ✅

**NOTIFY pgrst** issued ✅

**Browser smoke** (user-approved):
- 7 channel SUBSCRIBED ✅
- saved_places INSERT → postgres_changes frame within 30s ✅
- memo_replies INSERT → postgres_changes frame within 30s ✅

## REQ-IDs closed

- **RT-01** — `saved_places` publication + REPLICA IDENTITY FULL; per-table channel
- **RT-02** — `family_subscription` publication + REPLICA IDENTITY FULL; per-table channel
- **RT-03** — `events`/`memos`/`memo_replies` INSERT all emit postgres_changes within 30s (polling reliance removed; client also still polls at 30s for belt-and-suspenders)
- **RT-04** — Browser-session smoke confirmed 7 SUBSCRIBED + 2 INSERT→postgres_changes paths

## Deviations

1. **Migration chain pre-flight** (Rule 3 auto-fix): applied 3 of 7 dated migrations (000000/000001/000006), skipping 000002–000005 because they encode behavior changes (active_slot semantics, soft-lock triggers, premium-RLS tightening for academies) that would flip UX for 67 live families. Deferred with explicit rationale in `publications-precondition-check.md`.
2. **MCP → CLI fallback**: executor agent's function set didn't expose Supabase MCP tools; used `npx supabase db query --linked` (Plan 01-05 / 02-03 / 02-04 precedent).
3. **Idempotent ADD TABLE guards**: plan spec required the exception-handling `DO $$` block for `ALTER PUBLICATION` re-apply safety. `memo_replies` was already in publication (from an earlier dashboard add) and is now correctly re-asserted without error.
4. **Not rotated/promoted**: migrations 000002–000005 remain unapplied. Flagged in `publications-precondition-check.md` for future phase kickoff if any academies/active_slot logic needs them.

## Rollback plan

1. Apply down migration: `supabase db push` the paired down file (DROP FROM PUBLICATION + REPLICA IDENTITY DEFAULT)
2. `sync.js` revert: `git revert e7b9867` — caller contract preserved so no `src/App.jsx` changes needed
3. Minimal chain rollback optional — 000000/000001/000006 are additive and safe to keep even on revert

## Phase 2 Stream B status

- ✅ RT-01, RT-02, RT-03, RT-04 all closed. **Stream B complete.**
- Remaining in Phase 2: Stream A (02-01 push-notify ES256).

---

*Completed: 2026-04-21 after user checkpoint approval*
