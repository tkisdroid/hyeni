# Agent 04 — Calendar / Memo / Daily Flow Report

- Run at (UTC): 2026-05-12T17:30:00Z
- Branch: `final/production-polish-and-real-device-qa`
- Commit: `d5d183f`
- Mode: PARTIAL_VERIFIED — static + RLS / publication analysis only. Runtime evidence requires paired devices (deferred).

## Executive summary

`STATUS=PARTIAL_VERIFIED | P0=0 P1=2`

Calendar CRUD, memo replies, realtime publication coverage, and timezone handling were all reviewed statically. Two P1 findings: (1) push-notification body for event edits surfaces the wrong month to users (off-by-one because dateKey uses 0-indexed month), (2) `saveEventWithChildren` performs three sequential DB calls without a transaction — partial failure leaves `events` and `events_children` out of sync. Two P2: defense-in-depth gap on `events_children.child_id` FK (no family-scope check) and `GRANT ALL ON daily_supplies TO anon`.

No P0. No production-blocking issue. Multi-child isolation in calendar + memo flows is correct (Agent 03 already locked the use-site audit; this report confirms the realtime + isolation pieces that depend on it).

---

## A. Calendar logic (static)

### CRUD entry points

| Path | Function | Behavior |
|---|---|---|
| `src/lib/sync.js:373` | `insertEvent` | INSERT into `events`. Throws on error (no rollback hook). Used by voice path when no multi-child selection. |
| `src/lib/sync.js:379` | `updateEvent` | UPDATE on `events.id` with camelCase->snake_case mapping (`notifOverride->notif_override`, `endTime->end_time`). |
| `src/lib/sync.js:394` | `deleteEvent` | DELETE on `events.id`. RLS gates to primary parent. |
| `src/lib/sync.js:1066` | `saveEventWithChildren` | UPSERT `events` -> DELETE all `events_children` for that event_id -> INSERT new `events_children` rows. **No transaction wrapper.** |

### Optimistic update + rollback (App.jsx)

- `addEvent` (edit branch, App.jsx:4063-4106): captures previous snapshot, optimistically mutates, awaits `updateEvent`, **explicit rollback on catch** with prev event object. PASS.
- `addEvent` (insert branch, App.jsx:4127-4170): optimistic insert, await `saveEventWithChildren`. **No rollback on catch** — the failed UPSERT row stays in local UI until the next 30s poll cleans it up. PARTIAL.
- `voice add_event` (App.jsx:3894-3908): optimistic local insert; no explicit rollback on save error.
- Delete: handled by realtime DELETE callback (App.jsx:1755-1766) which removes the row from every date_key bucket. PASS.

### events vs events_children + selectedChild isolation

- `is_family_event=true` -> visible to every child member.
- `is_family_event=false` + `events_children[child_id]` -> visible only to listed children.
- Parent UI: `visibleEvents` (App.jsx:967-985) applies `filterEventMapForChild(events, selectedChild.id)`.
- Child UI: filter uses `myFamilyMemberId = pairedChildren.find(c => c.user_id === authUser?.id)?.id` — correct family_members.id (not auth uid). PASS.

### Realtime catch of M:N changes

- `events` postgres_changes binding INSERT/UPDATE/DELETE -> `onEventsChange` callback (App.jsx:1753).
- Because postgres_changes payload only contains the `events` row (not the join), `fetchEventById` (sync.js:237) re-fetches `events_children(child_id)` join on every INSERT/UPDATE. This populates fresh `child_ids` + `is_family_event` so the filter works without waiting for the next full `fetchEvents`. PASS.
- `events_children` table is also a publication member (migration `20260429000004_multichild_m4_events_children.sql:27`) but the client does **not** subscribe to it directly. This is intentional because every `events_children` write in client code is paired with an `events` UPSERT in `saveEventWithChildren`, which always fires a postgres_changes event on `events` and triggers the fetch. PASS (but tightly coupled — see issue C4).

### Date / month handling

- `dateKey = ${currentYear}-${currentMonth}-${selectedDate}` with `currentMonth = today.getMonth()` (0-indexed). Consistent across insert, edit, filter, sticker, memo paths. PASS.
- `addDaysToDateKey` uses `new Date(y, m, d + days).getMonth()` (also 0-indexed). Cross-month + leap-year + year-boundary handling delegated to JS Date — correct.
- DST not relevant (Asia/Seoul has no DST since 1988).

### Per-month visibility (P1 candidate)

- **Push body off-by-one (F1):** App.jsx:4089 `message: ${messageDateKey.replace(/-/g, "/")} ${eventStartTime} ...` produces `"2026/4/13"` for May 13 2026 because `currentMonth` is 0-indexed. Saved data is correct (DB only stores the string), but user-facing notification copy shows the wrong month. P1 — copy bug, not data corruption.

### Recurrence

- Weekly repeat: loop generates N events, each its own UUID, separately inserted (App.jsx:4116-4146). No RRULE; no occurrence sharing. Simple but means edit-one-event does not propagate. Intentional per current product scope; not in scope for this audit.

---

## B. Memo / reply (static)

### Write path

- `sendMemo(familyId, dateKey, childId, content, userId, userRole, origin)` (sync.js:535) -> `insertMemoReply` -> `INSERT INTO memo_replies` returning the inserted row.
- `child_id` carries the family_members.id (multichild thread isolation).
- Optimistic UI prepends a `temp-${uuid}` row; memoCache strips temp-rows from localStorage so they never persist across reloads.

### Realtime + reconciliation

- `memo_replies` postgres_changes channel (`memo_replies-${familyId}`) subscribed to `*`.
- Broadcast `memo_reply` event also wired (sync.js:892) — second delivery path if HTTP postgres_changes is delayed.
- INSERT handler (App.jsx:1977-2012): drops self-echo (`newRow.user_id === authUser?.id`), runs `isMemoForSelectedChild` for multichild filter, then merges.
- 1-second polling reconciler (App.jsx:1210) runs only while the memo page is open — catches drops + handles cross-date thread (prev/today/next).
- 30-second fallback poll (App.jsx:2412) **does not** include `fetchMemoReplies`. Memos page closed + realtime drop = stale until page reopens. P2 — acceptable because user must open page to see them anyway.

### Read receipts

- `markMemoReplyRead` (sync.js:564) routes through `mark_memo_reply_read` RPC (SECURITY DEFINER, atomic append). Has a legacy read-modify-write fallback if RPC is missing. Idempotent.
- IntersectionObserver fires after 3s continuous visibility (App.jsx:1217+). Replaces the previous auto-on-receive mark. PASS.

### Multichild isolation

- `isMemoForSelectedChild`: policy B — `child_id === selectedChildId` -> keep, else drop. NULL -> drop (legacy rows ignored in multichild families).
- Server-side filter: `fetchMemoReplies(familyId, dateKey, childId)` does `.eq("child_id", childId)` when childId is provided. PASS.
- RLS only filters by `family_id` — relies on client-side filter for child isolation within a family. Same family co-parent could see all child threads (intentional per spec).

### Self-echo edge case (P2)

- INSERT skip on `newRow.user_id === authUser?.id` means if the same auth user is signed in on two devices (e.g., parent on phone + tablet), the second device misses the realtime notification. Mitigated by the 1-second memo-page poll. P2.

---

## C. Timezone + date edge cases

| Scenario | Behavior | Status |
|---|---|---|
| UTC storage vs Asia/Seoul display | `dateKey` is device-local (`today.getMonth()` etc.), not UTC. `created_at` columns are timestamptz (UTC). Display path always re-derives via `new Date()` (local). | PASS for ko-KR users |
| Leap year 2024-02-29 | `addDaysToDateKey` and `new Date(y, m, d + n)` handle overflow via JS Date. | PASS |
| Year boundary 12-31 -> 01-01 | Same — `new Date(2025, 11, 32)` produces 2026-01-01. | PASS |
| DST | n/a — Asia/Seoul has no DST. | PASS |
| Cross-device timezone (parent in Korea, child in US) | `dateKey` differs. Memo for `2026-05-12` on child side may not match parent's `2026-05-13`. | P3 — out of intended scope for v1.0 |
| Voice parse | AI payload sends `currentDate.month` 0-indexed; regex parse also uses `d.getMonth()`. `dateLabel` uses `evMonth + 1`. | PASS |

---

## D. Realtime publication audit

Migration `20260421103134_enable_realtime_publications.sql` enables `saved_places`, `family_subscription`, `memo_replies`. Other tables added via dedicated migrations.

| Table | In publication? | REPLICA IDENTITY | Client subscribes? |
|---|---|---|---|
| `events` | Yes (pre-Phase-2) | FULL | Yes (`events-${familyId}`) |
| `events_children` | Yes (M4) | DEFAULT | **No direct subscribe** — relies on coupled `events` UPSERT in saveEventWithChildren |
| `memos` | Yes | FULL | Yes |
| `memo_replies` | Yes | FULL | Yes |
| `academies` | Yes | FULL | Yes |
| `saved_places` | Yes | FULL | Yes |
| `family_subscription` | Yes | FULL | Yes |
| `daily_supplies` | Yes | FULL | Yes |
| `child_locations` | Yes | FULL | Yes |
| `family_members` | Yes (20260429000011) | (separate migration) | Yes |

**REPLICA IDENTITY observation:** `events_children` has DEFAULT replica identity. Combined with the fact that the client never subscribes directly to it, this is functional but fragile — if anyone wires up a direct `events_children` subscription later with a non-PK filter, UPDATE events will silently drop. Logged as C4.

**Reconnect logic:** `subscribeTableChanges` (sync.js:726) has per-channel CHANNEL_ERROR / TIMED_OUT retry with exponential backoff (2s base, 60s cap, 10 attempts). Each channel has independent counter so one bad binding doesn't kill the rest. Broadcast channel has its own retry path. PASS.

**Polling fallback:** 30-second polling (App.jsx:2412) covers `events`, `memos`, `saved_places`. Does NOT cover `memo_replies`, `family_subscription`, `daily_supplies`, `academies`, `child_locations`, `family_members`. memo_replies has its own 1-second poll while memo page open. Others depend purely on realtime — acceptable risk because retry logic is robust.

---

## E. Korean + emoji handling

- All text columns are `text` (UTF-8). Native unicode + 4-byte emoji safe.
- `koreanParticle.js` exists (Korean particle handling) — unrelated to storage.
- Event title / memo content / date label paths preserve content verbatim via JSON.

PASS.

---

## F. events_children isolation (extending Agent 03)

- 11 selectedChild.id sites + 13 selectedChild.user_id sites already audited by Agent 03 -> PASS.
- RLS on `events_children` (M5): SELECT requires event_id in events with family_id in caller families. INSERT/UPDATE/DELETE requires is_primary_parent. **However the policy does not validate that `child_id` belongs to the same family.** A misbehaving client (or compromised token) could insert `(event_id, child_id)` where child_id is a family_members.id from a different family. Practical attack requires (a) primary parent role + (b) knowledge of foreign family_members.id (UUID). Logged as F4 — P2 (defense-in-depth).

---

## Issues

| ID | Severity | Area | Title |
|---|---|---|---|
| F1 | P1 | calendar.notif | Push body shows wrong month (off-by-one) on edit event |
| F2 | P1 | calendar.transaction | `saveEventWithChildren` is non-atomic; partial failure desyncs `events_children` |
| F3 | P2 | memo.realtime | 30s polling fallback omits memo_replies + family_subscription + daily_supplies |
| F4 | P2 | events_children.rls | `events_children.child_id` INSERT lacks family-scope check |
| F5 | P2 | daily_supplies.grant | `GRANT ALL ON daily_supplies TO anon` is broader than RLS requires |
| F6 | P2 | memo.realtime | Self-user INSERT skip drops memos for multi-device same-user (e.g. co-parent on phone + tablet) |
| F7 | P3 | calendar.timezone | Cross-timezone parent/child sees dateKey mismatch (Asia/Seoul only design) |

### F1 — Off-by-one month in push body (P1)

- File: `src/App.jsx:4089`
- Code: ``message: `${messageDateKey.replace(/-/g, "/")} ${eventStartTime} "${title}"로 수정됐어요` ``
- `messageDateKey` uses 0-indexed month, so May (calendar month 5) renders as `2026/4/13`. Notification recipients will read this as April.
- Recommended fix: derive a display string `${y}/${m+1}/${d}` from split tokens, or replace with `${y}년 ${m+1}월 ${d}일`.

### F2 — Non-atomic event upsert (P1)

- File: `src/lib/sync.js:1080-1093`
- `saveEventWithChildren` does (1) upsert events, (2) delete events_children for event_id, (3) insert new events_children rows. Each is a separate REST call. If step 3 fails (network/RLS), the event row is updated but children links are wiped — event becomes "no-children" and disappears from every child's filter (since `is_family_event=false` and `child_ids=[]`).
- Recommended fix: wrap in SECURITY DEFINER RPC (single transaction) or always set `is_family_event=true` as a safety fallback when childIds.length === 0 + intent was child-targeted. Document the retry policy.

### F3 — Realtime fallback gap (P2)

- File: `src/App.jsx:2412`
- 30-second poll covers events + memos + saved_places. memo_replies relies on memo-page-open 1s poll only. Background tabs / closed memo page with realtime drop = stale replies until page reopens.
- Recommended fix: add a quiet `fetchMemoRepliesForDateKeys` to the 30s poll for the current dateKey window. Low cost.

### F4 — events_children family-scope hole (P2)

- File: `supabase/migrations/20260429000005_multichild_m5_rls_policies.sql:42-51` + `20260429120000_coparent_permissions.sql:116-130`
- INSERT policy checks `event_id IN (events of caller's family)` but not `child_id IN (family_members of caller's family)`.
- Recommended fix: extend WITH CHECK to include `child_id IN (SELECT id FROM family_members WHERE family_id = events.family_id WHERE event_id = events.id)`. Defense-in-depth, no known attack vector at current UX.

### F5 — GRANT ALL TO anon on daily_supplies (P2)

- File: `supabase/migrations/20260423090000_daily_supplies.sql:79`
- RLS blocks but the grant is unnecessarily broad. Pattern inconsistent with other tables (which use `GRANT ... TO authenticated`).
- Recommended fix: `REVOKE ALL ON daily_supplies FROM anon; GRANT SELECT, INSERT, UPDATE ON daily_supplies TO authenticated;`

### F6 — Multi-device same-user memo skip (P2)

- File: `src/App.jsx:2000`
- Self-echo check is too aggressive — assumes one device per user. Co-parent scenario: parent A on phone sends memo, parent A on tablet never sees it via realtime (only via 1s memo-page poll).
- Recommended fix: track sender device id in the broadcast event and skip only when sender device == current device; OR remove self-skip and rely on the `prev.some(r => r.id === newRow.id)` dedup already present at line 2009.

### F7 — Cross-timezone dateKey mismatch (P3)

- Design intent: Asia/Seoul. Documented limitation. No fix this milestone.

---

## Anon probe summary (read-only)

No new anon probes in this agent — Agent 03 already certified all relevant tables PASS for anon read. Pulled `memo_replies` from Agent 03's table: anon_can_read=false, PASS.

---

## Runtime evidence

`NOT_VERIFIED` — paired-device evidence required for INSERT/UPDATE round-trip latency, optimistic rollback observability, and reconciliation timing. Static analysis is high-confidence because all paths are reviewed.

---

## Release decision

**ALLOW.** No P0. F1 (notification copy) and F2 (non-atomic write) are P1 but low blast radius:
- F1 is a string formatting bug that mislabels month in a notification — embarrassing but not data-corrupting; users can verify in-app.
- F2 requires a specific failure pattern (events upsert succeeds, events_children writes fail) which is rare. 30s polling will eventually surface the broken state (event with no children) so it self-heals once the user retries.

Recommend fixing both F1 and F2 before the next minor release, but not blocking v1.0.
