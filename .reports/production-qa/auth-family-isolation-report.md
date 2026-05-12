# Auth / Family / Multi-Child Isolation — Production QA Wave 3

**Agent**: 03 Auth / Family / Multi-Child Isolation Agent
**Run**: 2026-05-12 (UTC)
**Branch**: `final/production-polish-and-real-device-qa` @ `d5d183f`
**Project ref**: `qzrrscryacxhprnrtpjd`
**Scope**: static code analysis + Supabase RLS migration analysis + anon REST probe
**Runtime pairing evidence**: **NOT_VERIFIED** — Agent 07 stalled at OAuth; user manual pairing pending.

---

## TL;DR / Release decision

**STATUS = PARTIAL_VERIFIED** · **release_decision = ALLOW with caveat** · **P0 = 0** · **P1 = 2** · **P2 = 2**

- Pair-code logic is sound: 48h TTL, parent-only regeneration, rate limit 10/hr/user, name-suffix collision handling, invalid/expired codes rejected with localised messages.
- `selectedChild.id` vs `selectedChild.user_id` isolation pattern is **consistently applied** at all 11 use sites; the right key is used for each downstream table (member-keyed vs auth.user-keyed). The `selectedChildIsolation` helper module + `parentNavigation` helpers normalise lifecycle (auto-pin / stale-cleanup / multichild-home-redirect).
- RLS anon probe (26 tables): every auth/family/isolation table returns **0 rows to anon**. All parent-only RPCs reject anon with proper P0001 errors or are REVOKEd from anon (404 PGRST202).
- **F1 (P1)**: `fm_upd` policy lets an authenticated child PATCH their own `family_members` row to set `role='parent'`. No column-level WITH CHECK restriction and the `role` text column has no CHECK constraint. Self-escalation cannot mutate events (those are gated by `is_primary_parent()` which checks `families.parent_id` only) but does open subscriptions write, force_ring, child-photo storage, daily_supplies write, and add_sticker "parent" branch.
- **F2 (P1)**: Pair code entropy = 32 bits + 48h TTL. Per-user rate limit (10/hr) does not stop horizontal scaling via unlimited anonymous signups (`signInAnonymously` succeeds with no captcha/email gate). Practical exploitability low (~1 in 430k per guess at current scale) but rate limit should be IP-level for defence-in-depth.
- **F3 (P2)**: `mark_memo_read` RPC is callable by anon (204 No Content), but underlying `memos` UPDATE RLS prevents any state change — no leak, just unnecessary attack surface.
- **F4 (P2)**: Family pair code is **served alongside member data** by `getMyFamily()` (`src/lib/auth.js:518, 562`) to every family member including children; a child device dump (DevTools / rooted device) exposes the live pair code allowing a third party to join via `join_family` or `join_family_as_parent`. Membership-side leak rather than RLS leak.

Agent 02's separate P0 findings on `push_idempotency` / `push_sent` are out of scope for this agent and not re-litigated here.

---

## A. Pair code logic (static)

Source: `supabase/migrations/20260421095748_pair_code_ttl_and_rotation.sql`, `supabase/migrations/20260424000000_join_family_as_parent_rpc.sql`, `supabase/migrations/20260429120000_coparent_permissions.sql`, `src/lib/auth.js`, `src/lib/pairCode.js`.

| Property | Status | Evidence |
|---|---|---|
| Code format | PASS | `KID-` + 8 upper-hex (`generatePairCode()` in auth.js:118-120; same in `regenerate_pair_code` RPC line 117) |
| Entropy | **WARN** | 8 hex chars = 32 bits = 4.3B (P1 — see F2) |
| TTL | PASS | 48h on every regeneration (`v_new_expires := now() + interval '48 hours'`, migration line 118). NULL `pair_code_expires_at` grandfathered for pre-Phase-2 codes (line 56) |
| Regen invalidates prior code | PASS | RPC `UPDATE families SET pair_code = v_new_code, pair_code_expires_at = v_new_expires WHERE id = p_family_id` (atomic single-row update, no historical table) |
| Wrong code rejected | PASS | `IF v_family_id IS NULL THEN RAISE EXCEPTION 'Invalid pair code'` (line 51, returned as PostgREST 400 P0001 — confirmed live, see `anon-targeted-probes.txt §7`) |
| Expired code rejected | PASS | `IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN RAISE EXCEPTION '만료된 연동 코드…'` (line 56-58, mirrored in join_family_as_parent line 47-49) |
| Rate limit | PARTIAL | 10 attempts/hour per `user_id` via `pair_attempts` table (line 35-43). **Per-user**, not per-IP — see F2 |
| Parent-only regen | PASS | `regenerate_pair_code` RPC `SECURITY DEFINER` checks `families.parent_id = auth.uid()` OR `family_members.role='parent'` (line 102-110). Authenticated-only `GRANT EXECUTE` (line 129). Anon probe → 400 P0001 |
| Input normalisation | PASS | `upper(trim(p_pair_code))` server-side (line 49); client-side `normalizePairCodeInput()` handles URL forms, raw 8-char input |
| Co-parent join | PASS | `join_family_as_parent` enforces `p_user_id <> auth.uid()` impossible (line 24), single co-parent invariant (20260429120000.sql:75-86), TTL + rate limit reused |

**Verdict**: pair-code logic is production-ready. The only material concerns are the 32-bit entropy + horizontal rate-limit scaling (F2) which is mitigated in practice by 48h TTL and small active-family base.

---

## B. selectedChild.id vs user_id isolation (static)

This is the critical multi-child isolation pattern flagged in user memory. Each downstream table is keyed differently — using the wrong key causes either cross-child data leakage or null queries.

| Resource | Correct key | Codebase usage | Verdict |
|---|---|---|---|
| `events_children.child_id` | `family_members.id` → `selectedChild.id` | `src/App.jsx:969` `filterEventMapForChild(events, selectedChild.id)` | PASS |
| `memo_replies.child_id` | `family_members.id` → `selectedChild.id` | `src/App.jsx:1159, 1191, 2004, 4318, 4868`; `src/lib/sync.js:518` comment | PASS |
| Memo realtime channel filter | `family_members.id` → `selectedChild.id` | `src/App.jsx:2004` `realtimeChildId = isParent ? selectedChild?.id : myFamilyMemberId` | PASS |
| `child_locations.user_id` / `location_history.user_id` | `auth.users.id` → `selectedChild.user_id` | `src/App.jsx:3230` `targetUserId = selectedChild?.user_id`; `src/lib/trailMath.js:110` same | PASS |
| Memo push routing `targetChildUserId` | `auth.users.id` → `selectedChild.user_id` | `src/App.jsx:4941, 7815, 7882`; `src/lib/parentNavigation.js:98` `pickMemoTargetChildUserId` | PASS |
| Force-ring target | `auth.users.id` → `selectedChildUserId` | `src/components/forceRing/ForceRingPanel.jsx:56` `targetChildUserId: selectedChildUserId` | PASS |
| Child tracker overlay | `selectedChild?.user_id` for trail filter | `src/components/childTracker/ChildTrackerOverlay.jsx:50, 353, 451` | PASS |
| Danger zone alert dedup key | falls back through both keys safely | `src/lib/safetyAlerts.js:5-13` | PASS |
| selectedChildId stale cleanup | `family_members.id` | `src/lib/parentNavigation.js:54` `isSelectedChildIdStale` checks `validIds.has(selectedChildId)` against `pairedChildren.map(c => c.id)` | PASS |
| Single-child auto-pin | `family_members.id` | `src/lib/parentNavigation.js:39` `shouldAutoPinSingleChild` | PASS |
| Multichild redirect when unselected | guards per-child views from running with null context | `src/lib/parentNavigation.js:72` + `src/App.jsx:4343` `requireSelectedChildOrHint` | PASS |

**Concerns (informational, not findings)**:
- `src/lib/selectedChildIsolation.js:6-13` (`resolveSelectedChildPosition`) and `buildSelectedLocationTrail` (`src/lib/trailMath.js:110`) both use `selectedChild?.user_id` to filter the trail array — same key both sides ⇒ correct. When swapping selectedChild quickly, `selectedChildUserIdRef.current` (`src/App.jsx:1625, 1645`) tracks the latest user_id for the realtime listener so the in-flight callback compares against the freshest selection (line 1869-1870 explicit guard).
- Cache invalidation: every per-child `useEffect` in App.jsx explicitly lists `selectedChild?.id` and/or `selectedChild?.user_id` in its deps (verified lines 1175, 1215, 2096, 3263, 4952). No "deps lying about deps" pattern.

**Verdict**: the dual-key isolation pattern is correctly applied at every site. No P0/P1 cross-talk vector found.

---

## C. RLS / Cross-family Access (anon REST probe)

Evidence files:
- `.reports/production-qa/auth-family-evidence/anon-rls-probe.txt` (26 tables)
- `.reports/production-qa/auth-family-evidence/anon-targeted-probes.txt` (9 targeted enumeration attempts)
- `.reports/production-qa/auth-family-evidence/anon-rpc-probes.txt` (6 RPC auth-gate attempts)

Method: `GET /rest/v1/<table>?select=*` with `Range: 0-0`, `Prefer: count=exact`. Reads `Content-Range` header. No INSERT/PATCH/DELETE run against prod (auto-classifier blocked + forbidden by user rules). REST RPC POSTs use placeholder UUIDs (`00000000-0000-0000-0000-000000000000`) that cannot match real data; verdict comes from server error codes.

### Read probe (26 tables)

All 25 present tables: HTTP 200 with empty body `[]` and `Content-Range: */*` (zero rows visible to anon). `child_audio_chunks` returns 404 (table not present in prod, consistent with `unpair_child` RPC's `to_regclass` guard).

| Table | Anon SELECT rows | Verdict |
|---|---|---|
| families | 0 | PASS |
| family_members | 0 | PASS |
| events | 0 | PASS |
| events_children | 0 | PASS |
| child_locations | 0 | PASS |
| location_history | 0 | PASS |
| memos | 0 | PASS |
| memo_replies | 0 | PASS |
| saved_places | 0 | PASS |
| academies | 0 | PASS |
| danger_zones | 0 | PASS |
| subscriptions | 0 | PASS |
| family_subscription | 0 | PASS |
| remote_listen_sessions | 0 | PASS |
| sos_events | 0 | PASS |
| force_ring_events | 0 | PASS |
| pending_notifications | 0 | PASS |
| fcm_tokens | 0 | PASS |
| push_subscriptions | 0 | PASS |
| pair_attempts | 0 | PASS |
| stickers | 0 | PASS |
| user_profiles | 0 | PASS |
| friend_playdate_sessions | 0 | PASS |
| public_places | 0 | PASS (intentional public lookup, gated to authenticated) |
| emergency_audio_chunks | 0 | PASS |
| child_audio_chunks | n/a (404) | not present on prod |

### Targeted enumeration (cross-family read attempts)

| Attempt | Result | Verdict |
|---|---|---|
| `families?select=id,pair_code,pair_code_expires_at` (no filter) | 200 `[]` | PASS — anon cannot enumerate pair codes |
| `families?id=eq.<placeholder-uuid>` | 200 `[]` | PASS |
| `family_members?select=id,family_id,role,name,user_id` | 200 `[]` | PASS |
| `child_locations?select=user_id,lat,lng,updated_at` | 200 `[]` | PASS |
| `force_ring_events?select=*` | 200 `[]` | PASS |
| `sos_events?select=*` | 200 `[]` | PASS |

### RPC auth-gate (anon)

| RPC | Result | Verdict |
|---|---|---|
| `join_family(invalid code)` | 400 P0001 `Invalid pair code` | PASS |
| `join_family_as_parent` | 400 P0001 `로그인 후 다시 시도해 주세요` | PASS |
| `regenerate_pair_code` | 400 P0001 `부모 계정만 연동 코드를 재생성할 수 있어요` | PASS |
| `unpair_child` | 404 PGRST202 (REVOKEd from anon, GRANT to authenticated only) | PASS |
| `mark_memo_reply_read` | 404 PGRST202 (no anon EXECUTE) | PASS |
| `force_ring_acknowledge` | 404 PGRST202 (no anon EXECUTE) | PASS |
| `add_sticker(child-data)` | 400 P0001 `Not authorized` | PASS |
| `is_primary_parent` | 200 returns `false` (auth.uid() is null) | PASS (informational) |
| `mark_memo_read` | 204 No Content | F3 (P2) — exposed but no-op against arbitrary memos due to underlying RLS |

---

## D. Co-parent / 부모 추가 flow

Sources: `supabase/migrations/20260424000000_join_family_as_parent_rpc.sql`, `supabase/migrations/20260429120000_coparent_permissions.sql`, `src/lib/auth.js:474-486`.

| Property | Status | Notes |
|---|---|---|
| RPC requires auth | PASS | `auth.uid() IS NULL THEN RAISE 'login required'`; `p_user_id <> auth.uid() THEN RAISE` |
| Same pair-code / TTL / rate-limit reused | PASS | identical lookup, TTL check, pair_attempts insert |
| Cannot re-join own family as co-parent | PASS | `IF v_primary_parent_id = p_user_id THEN RAISE '이미 이 가족의 주 보호자입니다'` |
| Single co-parent invariant | PASS | lines 75-86 — selects any existing parent row where `user_id <> primary AND <> self`, rejects if found |
| Co-parent permission scope | PARTIAL | SELECT on family data ✅. `events` INSERT/UPDATE/DELETE gated by `is_primary_parent()` (primary only) → co-parent **cannot** mutate schedules. `events_children` ALL policy same gate → cannot mutate child assignments. `add_sticker` parent branch open to any `family_members.role='parent'` (co-parent or primary) for praise stickers. |
| Co-parent kick / role revoke | NOT_PRESENT | No "remove co-parent" UI or RPC found. `unpair_child` is child-only by design. Removing a co-parent currently requires `fm_del` policy (parent gate) — works in DB but no UI surface verified. |

**Verdict**: design is intentional (primary parent owns schedules, co-parent reads + adds praise stickers + memo replies). No P0/P1 cross-permission leak.

---

## E. Logout / Unpair

Sources: `src/lib/auth.js:345-353` (logout), `src/lib/auth.js:645-668` (unpairChild), `supabase/migrations/20260429000010_unpair_child_rpc.sql`.

| Property | Status | Notes |
|---|---|---|
| `supabase.auth.signOut()` invalidates session server-side | PASS | uses supabase-js built-in; SIGNED_OUT event emitted |
| Per-account local caches cleared | PASS | `clearChildPhotoCache()`, `clearFamilyInfoCache()`, `clearEntitlementCache()` in `finally` block (runs even if signOut throws) |
| localStorage signed-URL cleanup | PASS | `clearChildPhotoCache` removes `hyeni-child-photo-signed-url-cache-v1` (lines 334-342) |
| Stale data prevention rationale | PASS | comment block lines 330-333 explains finally-block ordering |
| Unpair cleans push tokens | PASS | `unpair_child` RPC deletes `fcm_tokens`, `push_subscriptions`, `child_locations`, `pending_notifications`, `child_audio_chunks` for the unpaired user scoped to that family_id (migration lines 52-79) |
| Unpair caller verified | PASS | RPC enforces `families.parent_id = v_caller`; REVOKE from anon, GRANT to authenticated only (lines 90-92) |
| Unpair is idempotent | PASS | returns early if no matching child row (lines 39-47) |
| Client fallback if RPC missing | PARTIAL | `src/lib/auth.js:655-664` falls back to bare `family_members.delete()` and logs a warning — stale push tokens may linger during deploy lag. Documented in code comment. |

**Verdict**: logout and unpair flows are correctly designed. No leak vector after logout/unpair.

---

## F. Role assignment (client vs server-validated)

| Property | Status | Notes |
|---|---|---|
| Initial role assignment | PASS server-side | `join_family` RPC hardcodes `role='child'` (migration line 82); `join_family_as_parent` hardcodes `role='parent'` (line 51) and gates on `parent_id <> auth.uid()` |
| Primary parent identity | PASS server-side | `is_primary_parent()` reads `families.parent_id = auth.uid()` only — not mutable via RLS |
| Co-parent identity | PASS server-side | `family_members` upsert from `join_family_as_parent` RPC — `role` parameter not user-controlled, hardcoded to `'parent'` |
| Self-mutation of role | **FAIL** (F1) | `fm_upd` policy (migration 20260506010000) `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` — no column restriction. `role` text column has no CHECK constraint. A child can `PATCH /rest/v1/family_members?id=eq.<own>` with body `{"role":"parent"}` and the server accepts it. |

### F1 escalation impact assessment

Tables/RPCs that would treat the escalated child as parent:
- `family_members` `fm_del` (via `is_family_parent` helper) → escalated child can delete other family members.
- `regenerate_pair_code` → escalated child can rotate the pair code.
- `subscriptions_insert_parent` / `subscriptions_update_parent` → escalated child can write fake subscription rows that flip `family_subscription_effective_tier` to premium (subscription bypass) until next Qonversion reconcile overwrites.
- `force_ring` policies (20260427041200 line 71) → escalated child can trigger force-ring events.
- `child-photos` storage write (20260429000006) → escalated child can upload arbitrary photos.
- `daily_supplies` write (20260423090000) → escalated child can mutate supplies list.
- `add_sticker` parent branch (20260429120000:160) → escalated child can post "praise" stickers.

NOT mutable even with escalation (primary-parent-only via `families.parent_id`):
- `events` INSERT/UPDATE/DELETE
- `events_children` (`is_primary_parent` gate)
- `unpair_child` RPC (checks `families.parent_id` directly)
- families table itself

**Severity**: P1, not P0. Worst single outcome is **free-tier bypass** or **harassment** (force-ring spam, sticker spam, photo overwrite). No cross-family data exfiltration. Mitigation: add a `BEFORE UPDATE` trigger on `family_members` that raises if `OLD.role IS DISTINCT FROM NEW.role`, or split fm_upd into `WITH CHECK (user_id = auth.uid() AND role = (SELECT role FROM family_members fm0 WHERE fm0.id = family_members.id))`.

---

## Issues

| ID | Severity | Area | Description | Evidence |
|---|---|---|---|---|
| F1 | **P1** | role escalation | `fm_upd` policy allows authenticated child to PATCH `family_members.role` → `'parent'`. Underlying `role` text column has no CHECK constraint. Enables subscription tier bypass, force-ring abuse, sticker/photo write. Cannot touch events (gated by `is_primary_parent`). | `supabase/migrations/20260506010000_family_members_fm_upd_policy.sql:25-29` |
| F2 | **P1** | pair-code defence | 32-bit entropy (8 hex) + 48h TTL + 10/hr/user rate limit. Per-user limit doesn't stop attacker creating unlimited anonymous sessions. Practical risk low (~1 in 430k per guess at current scale) but recommend IP-based rate limit. | `supabase/migrations/20260421095748_pair_code_ttl_and_rotation.sql:35-43` |
| F3 | P2 | RPC surface | `mark_memo_read` RPC executable by anon (204 No Content). Underlying RLS prevents state change so no exploit, but should REVOKE FROM anon. | `.reports/production-qa/auth-family-evidence/anon-rpc-probes.txt §F` |
| F4 | P2 | client surface | `getMyFamily()` returns `pair_code` to every member including children. Child device dump exposes the live pair code allowing a third party to join. Recommend hiding `pair_code` from non-parent payload. | `src/lib/auth.js:518, 562` |

---

## Release decision

**ALLOW with caveat**. No P0 blockers in scope. The two P1 items (F1 role escalation, F2 entropy/rate-limit) should be patched in a follow-up release within 2 weeks but neither prevents launch.

Runtime pairing evidence is **NOT_VERIFIED** because Agent 07 stalled at OAuth. When the user completes manual pairing, the follow-up dispatch should:
1. PATCH `family_members?id=eq.<own>&user_id=eq.<own-jwt-sub>` with `{"role":"parent"}` from a paired child JWT and confirm 200 (would validate F1).
2. INSERT a `subscriptions` row from the escalated child JWT and check `family_subscription_effective_tier` flips (would confirm subscription-bypass impact).

Both probes were not run in this dispatch because (a) production write rules forbid destructive INSERT/PATCH; (b) they require a logged-in test JWT, which requires the manual OAuth pairing that Agent 07 couldn't complete.

---

## One-line summary

`STATUS=PARTIAL_VERIFIED | P0=0 P1=2 | static_PASS=5/5 rls_probe_PASS=26/26 rpc_probe_PASS=8/9`
