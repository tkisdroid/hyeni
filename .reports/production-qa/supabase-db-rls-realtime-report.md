# Supabase DB / Migration / RLS / Realtime — Production QA Wave 1

**Agent**: 02 Supabase DB / Migration / RLS / Realtime Agent
**Run**: 2026-05-12 (UTC)
**Project ref**: `qzrrscryacxhprnrtpjd`
**DB environment**: `production-readonly` (anon REST probe; no destructive writes)
**Static scope**: 69 up-migrations, 50 down-migrations, 8 edge functions, dist/ JS bundle, android/ src

---

## TL;DR / Release decision

**STATUS = FAIL** · **release_decision = BLOCK** · **P0 = 1** · **P1 = 2** · **P2 = 4**

Two production tables (`push_idempotency`, `push_sent`) are **fully readable and writable by the anonymous role**, despite migration code declaring otherwise. An attacker with only the published anon key (already inside every released APK and the web bundle) can:

1. Enumerate every push notification ever dispatched (323 idempotency keys + 182 send records currently exposed; both grow indefinitely).
2. Pre-claim arbitrary `Idempotency-Key` UUIDs to permanently suppress legitimate push deliveries — including emergency alerts (`sos`, `kkuk`, `not_arrived`, `danger_zone`, `force_ring_reminder`) because `push-notify` short-circuits on 23505 unique-violation.
3. Pre-insert `push_sent (event_id, notif_key)` rows for any event to suppress timed reminders (`15min` / `5min` / `start`).

This is a **safety-critical RLS bypass** on a children-safety product and is treated as a release blocker.

Two additional findings (`subscription-reconcile` JWT-less endpoint, `ai-voice-parse`/`feedback-email` cost-abuse vectors) compound the risk but are not the deciding factors.

---

## 1. Migration inventory (static)

| Metric | Value |
|---|---|
| Total up-migrations | 69 |
| Down-migrations present | 50 |
| Pre-Phase-1 (2026-04-21) up files without a down (per `down/README.md` carve-out) | 15 (OK by convention) |
| Post-Phase-1 up files without a down (convention violation) | 4 → see Finding F-007 |
| Files with explicit `DROP POLICY` (intentional re-create) | 30+ (all wrapped) |
| `DISABLE ROW LEVEL SECURITY` occurrences | 0 |
| `USING (true)` policy occurrences | 1 (`public_places` SELECT to authenticated — intentional public lookup) |
| Files mutating `supabase_realtime` publication | 7 |
| Files setting `REPLICA IDENTITY FULL` | 4 (covers 9 tables) |

Migration timestamp ordering is monotonically increasing across all 69 files; no out-of-order timestamps detected.

### Rollback discipline
- `supabase/migrations/down/README.md` codifies the up↔down pairing rule (Phase 1, 2026-04-21).
- Pre-Phase-1 files (15) are explicitly carved out and listed; OK.
- **Post-Phase-1 missing-down files (Finding F-007 / P2)**:
  - `20260423090000_daily_supplies.sql`
  - `20260424000000_join_family_as_parent_rpc.sql`
  - `20260429160000_rls_returning_visibility.sql`
  - `20260511000000_memo_replies_add_child_id.sql`
- The remaining 50 post-Phase-1 up files all have paired down files.

No destructive migrations (`DROP TABLE`, `TRUNCATE`, column type mutation with data loss) detected in any up file. The `DROP POLICY ... ; CREATE POLICY` cycles are all wrapped in `BEGIN; ... COMMIT;` per convention.

---

## 2. RLS evidence (live anon REST probe)

`evidence_path = .reports/production-qa/supabase-evidence/anon-probe-table.txt`

Verified in production with the published anon key (`role: anon`, exp 2055). For every probed table the test was:
- `GET /rest/v1/<table>?select=*` with `Range: 0-0` and `Prefer: count=exact` → reads `Content-Range` header to derive total row count visible to anon.
- `POST /rest/v1/<table>` with empty body `{}` → reads HTTP status (401 = RLS denied; 400 = RLS pass-through, body validation fail; 201 = inserted).

| Table | Anon SELECT rows | Anon INSERT | Verdict |
|---|---|---|---|
| families | */0 | 401 | RLS OK |
| family_members | */0 | 401 | RLS OK |
| events | */0 | 401 | RLS OK |
| events_children | */0 | 401 | RLS OK |
| child_locations | */0 | 401 | RLS OK |
| location_history | */0 | 401 | RLS OK |
| saved_places | */0 | 401 | RLS OK |
| academies | */0 | 401 | RLS OK |
| danger_zones | */0 | 401 | RLS OK |
| memos | */0 | 401 | RLS OK |
| memo_replies | */0 | 401 | RLS OK |
| remote_listen_sessions | */0 | 401 | RLS OK |
| sos_events | */0 | 401 | RLS OK |
| force_ring_events | */0 | 401 | RLS OK |
| pending_notifications | */0 | 401 | RLS OK |
| fcm_tokens | */0 | 401 | RLS OK |
| family_subscription | */0 | 401 | RLS OK |
| subscriptions | */0 | 401 | RLS OK |
| user_profiles | */0 | 401 | RLS OK |
| public_places | */0 | 401 | RLS OK (read-only public) |
| friend_playdate_sessions | */0 | 401 | RLS OK |
| emergency_audio_chunks | */0 | 401 | RLS OK |
| push_subscriptions | */0 | 401 | RLS OK |
| **push_idempotency** | **0-322/323** | **201 (anon INSERT/DELETE confirmed)** | **FAIL — full read/write to anon** |
| **push_sent** | **0-181/182** | **201 (anon INSERT confirmed)** | **FAIL — full read/write to anon despite `USING (false)` policy in code** |
| daily_supplies | (404 — table absent on this project) | n/a | Migration not yet applied or table renamed |

Sample exposed schemas (UUIDs redacted to `[REDACTED-FAMILY-UUID]` / `[REDACTED-EVENT-UUID]`):

```
push_idempotency row:
  { key: <uuid>, created_at: 2026-05-11T..., first_sent_at: 2026-05-11T...,
    family_id: [REDACTED-FAMILY-UUID], action: "new_memo" | "request_location" | ... }

push_sent row:
  { id: <uuid>, event_id: [REDACTED-EVENT-UUID], notif_key: "start-2026-2-13",
    sent_at: 2026-03-13T... }
```

### Why `push_sent` is the smoking gun

`supabase/migrations/20260313000000_push_tables.sql:28-32`:
```sql
ALTER TABLE push_sent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_sent_service_only" ON push_sent;
CREATE POLICY "push_sent_service_only" ON push_sent
  FOR SELECT USING (false);
```

Migration says RLS is enabled with a `USING (false)` SELECT policy and no other policies — so anon should see 0 rows and never insert. Live probe sees 182 rows and **accepted anon INSERT** (201) of `{"event_id":"qa-probe-event","notif_key":"qa-probe"}`. This means the production database state has drifted from the migration code in one of three ways:

1. `ALTER TABLE push_sent DISABLE ROW LEVEL SECURITY` was applied out-of-band (most likely).
2. A `GRANT INSERT/SELECT ON public.push_sent TO anon` was applied out-of-band.
3. The `push_sent_service_only` policy was dropped without a corresponding migration.

The same root cause likely explains `push_idempotency` — the `20260421103838_push_idempotency_table.sql` migration creates the table but **never** runs `ENABLE ROW LEVEL SECURITY` and **never** defines a policy (correctly identified as a code-level gap on its own, Finding F-002), so the table inherits the default "RLS off" state. The migration text already documents this gap obliquely in `20260422000000_push_idempotency_ttl_cron.sql:12`:
> "(cron function is `SECURITY DEFINER` so it can DELETE regardless of RLS state on push_idempotency)"
implying the author was aware no RLS exists.

The QA probe row was cleaned up at end of test:
```
DELETE /rest/v1/push_idempotency?key=eq.00000000-0000-0000-0000-000000000000 → 204
DELETE /rest/v1/push_sent?event_id=eq.qa-probe-event → 204
```
Both deletions succeeded as anon (further confirms unrestricted DELETE).

---

## 3. Realtime publication evidence (static)

From `20260421103134_enable_realtime_publications.sql` and successors:

| Table | In `supabase_realtime` | `REPLICA IDENTITY FULL` |
|---|---|---|
| events | (assumed pre-Phase-1 baseline) | yes (20260421103134) |
| memos | (assumed pre-Phase-1 baseline) | yes (20260421103134) |
| memo_replies | yes (20260421103134) | yes (20260421103134) |
| academies | (assumed pre-Phase-1 baseline) | yes (20260421103134) |
| saved_places | yes (20260421103134) | yes (20260421103134) |
| family_subscription | yes (20260421103134) | yes (20260421103134) |
| child_locations | yes (20260427180000) | yes (20260427180000) |
| family_members | yes (20260429000011) | yes (20260429000011) |
| force_ring_events | yes (20260427041200) | (replica identity not explicitly set — could be DEFAULT) |
| friend_playdate_sessions | yes (20260428000000) | (not explicitly set in migration) |
| subscriptions | yes (20260429000003) | (not explicitly set in migration) |
| events_children | yes (20260429000004) | (not explicitly set in migration) |
| daily_supplies | yes (20260423090000) | yes |
| pending_notifications | NOT FOUND in any `ALTER PUBLICATION` | n/a |
| location_history | NOT FOUND in any `ALTER PUBLICATION` | n/a |
| remote_listen_sessions | NOT FOUND in any `ALTER PUBLICATION` | n/a |
| sos_events | NOT FOUND in any `ALTER PUBLICATION` | n/a |

`pending_notifications` not being in the publication is **as designed** — the Android client polls it as a fallback queue (see `push-notify/index.ts:1138`). The other three (`location_history`, `remote_listen_sessions`, `sos_events`) are audit / immutable-log tables that the client does not subscribe to via postgres_changes; static-only ambiguity → see Finding F-005 (P2).

`REPLICA IDENTITY` is explicitly `FULL` on every table the migration code declares as realtime-subscribed with `family_id` filtering. Tables added later (`force_ring_events`, `subscriptions`, `events_children`, `friend_playdate_sessions`) do not have explicit `REPLICA IDENTITY FULL` in their migrations. If client subscribes with a non-PK filter (e.g., `family_id=eq.X`), updates would silently drop on these tables. Live verification of subscription filters requires runtime probe — out of static scope.

---

## 4. Edge function audit

| Function | JWT check | Service role usage | CORS | Notable concerns |
|---|---|---|---|---|
| push-notify | Y in-function `getClaims()` (D-A01); service_role bypass allowed for cron | Server-only; created per request from `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` | `*` (mobile webview justified) | SEC-01 family-membership cross-check present (lines 870-884); co-parent gate via `canCallerSendAction` (lines 894-914); `force_ring` parent-role check + target-child same-family check (lines 507-581) — strong |
| ai-voice-parse | N NONE — accepts any caller | Does not touch Supabase service role | `*` | OpenAI key fan-out abuse vector; rate-limit absent; image mode invokes gpt-4o (cost) — Finding F-004 (P1) |
| ai-child-monitor | Y `getClaims()` with `sub` required | Does not write to Supabase | `*` | No family-membership check — but no DB writes/reads so leak surface limited to OpenAI cost via free abuse path |
| qonversion-webhook | HMAC via `verifyHmacSignature` (Y) — but `QONVERSION_ALLOW_UNSIGNED_WEBHOOKS=1` env override exists | Server-only | implicit (jsonResponse) | If `allowUnsigned=1` is ever set in prod, every webhook would pass without signature; cannot verify env value via anon — Finding F-006 (P2 NOT_VERIFIED) |
| subscription-reconcile | N NONE — accepts any caller | Server-only | implicit | **Finding F-003 (P1)** — anyone can POST and trigger reconcile across all stale subscriptions, fanning out Qonversion API calls and DB upserts |
| send-sms | Y standardwebhooks `Webhook(secret).verify` (Supabase Auth SMS hook) | n/a | implicit | OK; safe |
| naver-auth | N (deployed `--no-verify-jwt` intentionally for OAuth bootstrap) | Server-only (admin API) | `*` | OAuth code is single-use against Naver; abuse vector limited; OK |
| feedback-email | N NONE | n/a | `*` | No rate limit, no auth — Resend cost abuse + admin inbox spam; Finding F-008 (P2) |

### Service-role key leakage check

| Scope | Pattern searched | Result |
|---|---|---|
| `dist/assets/*.js` | `service_role`, JWT with `role:service_role` payload | **None** — only the anon JWT is present (expected) |
| `src/` | `service_role`, JWT prefix | None |
| `public/` | same | None |
| `android/app/src/` | `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, raw secrets (OpenAI, Resend, NCP, FCM, VAPID) | None |

PASS on service-role leak. Anon key in dist bundle is expected (client identity).

---

## 5. Findings (severity-sorted)

### F-001 (P0) — `push_idempotency` and `push_sent` are anon-readable and anon-writable in production

- **Tables**: `public.push_idempotency`, `public.push_sent`
- **Live evidence**: see Section 2 table + `.reports/production-qa/supabase-evidence/anon-probe-table.txt`
- **What anon can do**: SELECT all rows, INSERT new rows, DELETE existing rows. Confirmed with HTTP 201/204 against the published anon key.
- **Impact**:
  1. **Emergency push suppression** (safety-critical). `push-notify` short-circuits with `duplicate: true` when an idempotency-key INSERT raises 23505. An attacker who pre-inserts arbitrary `Idempotency-Key` UUIDs claims the dedup slot. Since client-side callers send a `crypto.randomUUID()` key per call (not deterministic), a wholesale enumeration attack is hard — but an attacker who can MITM or guess key generation timing can suppress specific deliveries. More directly: an attacker can DELETE the entire `push_idempotency` table on a rolling basis, **erasing the dedup history** so legitimate retries send duplicate notifications to users.
  2. **Timed reminder suppression**. `push-notify` cron mode checks `push_sent (event_id, notif_key)` for duplicates before sending. An attacker who INSERTs `(<event_id>, '15min-<date_key>')` for every event suppresses every `15min`/`5min`/`start` reminder for that event family. `event_id`s leak via the same table (182 already visible). This is an effective **availability attack against the timed-notification subsystem**.
  3. **Family activity reconnaissance**. `push_idempotency.family_id` + `action` columns are exposed for 323 rows — attacker can enumerate active families and their action types (`new_memo`, `request_location`, etc.), inferring family usage patterns and presence schedules.
- **Root cause hypothesis**:
  - `push_idempotency` migration (`20260421103838_push_idempotency_table.sql`) creates the table but never calls `ENABLE ROW LEVEL SECURITY` and never defines a policy. Postgres default leaves RLS off → anon fully open.
  - `push_sent` migration (`20260313000000_push_tables.sql:28-32`) does enable RLS and defines `USING (false)`, but production state has drifted (RLS likely disabled out-of-band or a permissive policy was added). Pure code review would have rated this PASS; the live probe is what caught the drift.
- **Fix direction** (do not apply — report only):
  - Author migration to:
    ```sql
    ALTER TABLE public.push_idempotency ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.push_idempotency FROM anon, authenticated;
    -- service_role still works because it bypasses RLS
    ```
  - For `push_sent`: investigate drift, re-`ENABLE ROW LEVEL SECURITY`, re-`CREATE POLICY ... USING (false)`, and confirm `REVOKE INSERT, DELETE ON public.push_sent FROM anon, authenticated`.
  - Add a CI/CD test that runs anon REST against every table and asserts `Content-Range: */0` for non-public tables.

### F-002 (P0 → folded into F-001) — `push_idempotency` migration never enables RLS

Already covered by F-001's root cause. Listed separately so the migration author can fix the source file even if the prod drift is addressed by an out-of-band patch.

### F-003 (P1) — `subscription-reconcile` Edge Function lacks JWT verification

- **File**: `supabase/functions/subscription-reconcile/index.ts`
- **Evidence**: No `auth.getClaims`, no shared-secret header, no `verify` step. The function reads `SUPABASE_SERVICE_ROLE_KEY`, opens a service-role client, and fans out to `family_subscription` + Qonversion API.
- **Impact**: Anyone who can reach the function URL can trigger reconciliation of up to 100 stale subscriptions per call, generating Qonversion API costs and DB write traffic. Cannot directly elevate privilege because Qonversion remote remains source of truth, but it is a low-effort denial-of-wallet vector.
- **Fix direction**: gate on `claimsRole === "service_role"` or a shared `RECONCILE_TRIGGER_SECRET` header, mirroring `handleForceRingReminder` in `push-notify/index.ts:753`.

### F-004 (P1) — `ai-voice-parse` accepts unauthenticated callers

- **File**: `supabase/functions/ai-voice-parse/index.ts`
- **Evidence**: No JWT verification. Body is parsed and forwarded directly to OpenAI `chat/completions`. Image mode escalates to `gpt-4o` (most expensive model).
- **Impact**: Trivial denial-of-wallet on the OpenAI API key. Also a free abuse channel for OpenAI image inference (data exfil via image content prompts unrelated to the product).
- **Fix direction**: copy the `getClaims()` block from `ai-child-monitor/index.ts:293-316`. Add a per-`sub` rate limit (e.g., 60 calls / hour) using a tiny dedicated table or Supabase Storage object.

### F-005 (P2 NOT_VERIFIED) — Realtime publication coverage for audit/safety tables

- **Tables**: `location_history`, `remote_listen_sessions`, `sos_events`
- **Evidence**: No `ALTER PUBLICATION supabase_realtime ADD TABLE ...` for these three.
- **Impact**: If any UI relies on realtime to surface live SOS events to a parent dashboard, those will silently never fire. Static-only scope cannot tell whether the client subscribes to these. Marked NOT_VERIFIED pending agent 01 / 04 evidence.

### F-006 (P2 NOT_VERIFIED) — `QONVERSION_ALLOW_UNSIGNED_WEBHOOKS` env override

- **File**: `supabase/functions/qonversion-webhook/index.ts:23`
- **Evidence**: code path that explicitly disables signature verification if `QONVERSION_ALLOW_UNSIGNED_WEBHOOKS=1`. Anon probe cannot read function env vars. The default is OFF (good), but a production accident would silently open the webhook.
- **Fix direction**: remove the override entirely, or gate it behind `Deno.env.get("DENO_DEPLOYMENT_ID") === undefined` (local dev only).

### F-007 (P2) — Four post-Phase-1 migrations missing paired `down/` files

- Files (already listed in Section 1).
- **Impact**: Convention violation (per `down/README.md` Rule 1). Rolling back any of these requires writing the down file by hand under time pressure. None of them is destructive (all `CREATE`/`ALTER` additive), so the risk is operational debt, not data loss.

### F-008 (P2) — `feedback-email` is open relay to admin inbox

- **File**: `supabase/functions/feedback-email/index.ts`
- **Evidence**: No JWT check, no rate limit, no captcha, `CORS *`. Hard-coded `FEEDBACK_TO_EMAIL` default is `tkisdroid@gmail.com`.
- **Impact**: Spam vector + Resend API cost abuse.
- **Fix direction**: gate on JWT + per-`sub` daily quota.

---

## 6. Decision summary

`release_decision = BLOCK` on the strength of F-001 alone. The product is a children-safety app where suppression of emergency push delivery is a P0 issue regardless of how indirect the path is.

Recommended unblock sequence (smallest set that flips the verdict to ALLOW):
1. Author and apply a hotfix migration:
   - `ALTER TABLE public.push_idempotency ENABLE ROW LEVEL SECURITY;` + `REVOKE ALL FROM anon, authenticated;` + paired down.
   - Investigate `push_sent` drift; re-enable RLS + `USING (false)` SELECT; `REVOKE INSERT, DELETE FROM anon, authenticated`; paired down.
2. Re-run the anon REST probe (Section 2 commands) and confirm `Content-Range: */0` for both tables and `INSERT_anon=401` for both.
3. Optional but strongly recommended before next major release: gate `subscription-reconcile` and `ai-voice-parse` per Findings F-003, F-004.

---

## 7. Evidence files

- `.reports/production-qa/supabase-evidence/anon-probe-table.txt` — anon REST probe across 25 tables (counts + INSERT status)
- `.reports/production-qa/agent02.json` — machine-readable summary
