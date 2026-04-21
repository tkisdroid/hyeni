# Pitfalls Research — Live-Data Remediation Risks

**Domain:** Supabase + Capacitor 8 (Android) + Firebase FCM + Web Push, operating on live family data (2 parents, 4 children, active events/memos/locations) in family `4c781fb7-677a-45d9-8fd2-74d0083fe9b4`.
**Researched:** 2026-04-21
**Confidence:** HIGH (root causes validated against Supabase docs, official GitHub issues, and the repo's own migration files); MEDIUM where dependent on unreleased roadmap content.

> **Scope note.** This file is NOT a generic "Supabase pitfalls" catalog. It is scoped to the **nine specific remediation items** in `PROJECT.md` §Active and the **eight specific risk categories** handed to this researcher. Every pitfall below is tied to at least one of the P0-1 … P2-9 phases and to a concrete code path or migration already present in this repo.

## Critical Pitfalls

### Pitfall 1: Deploying the ES256 JWT fix with a verifier that silently accepts HS256 (or vice versa)

**What goes wrong:**
`push-notify` currently dies on `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM: ES256` because Supabase migrated project JWTs to asymmetric ES256 signing keys (new default 2025-05-01, full cutover 2025-10-01). The instinct is "add a jose verifier and be done." But the exact failure mode reported upstream is the **inverse**: engineers wire up jose, the gateway still wraps the function with the platform's legacy `verify_jwt` flag, and the gateway itself rejects the ES256 JWT *before* the function body runs — so adding code changes nothing. The second failure mode is the opposite: someone "fixes" it by disabling `verify_jwt` without adding in-function verification, and the function now runs unauthenticated — any anon caller can enqueue push to any `familyId`, billing the project and spamming every device.

**Why it happens:**
- The repo deploys with `--no-verify-jwt` today (see comment at `supabase/functions/push-notify/index.ts:7`). That is *correct* for this function (it is called by pg cron and by trusted clients), but it makes the developer think "JWT is irrelevant here" and mask the actual bug: **the function uses the service-role key internally, not the caller JWT**. The 401 is not from the function — it is from Supabase's gateway rejecting the ES256 JWT the client sent in `Authorization:` before the function code runs. See GitHub issue supabase/supabase#42244 ("Edge function gateway rejects valid ES256 JWT on branch environments") and #41691.
- Supabase published [`JWT Signing Keys` guide](https://supabase.com/docs/guides/auth/signing-keys) explicitly warning that `verify_jwt` flag is incompatible with the new JWT Signing Keys.

**Warning signs (how to detect early):**
- Error body literally contains `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM: ES256` — this is a **gateway** response, not a function response. If curl returns that with `server: supabase-edge-functions` in headers, your function body never executed.
- Function logs are *empty* for failed requests (gateway rejected, function never invoked).
- `supabase.auth.getUser(token)` inside the function succeeds on the same token that the gateway rejected → confirms gateway path vs. function path mismatch.

**Prevention (concrete actions during planning):**
1. Set the function's explicit config to `verify_jwt = false` in `supabase/config.toml` (already implied by deploy flag) **and** require in-function verification using `jose` with the JWKS endpoint `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
2. Gate sensitive fields (familyId sender identity) on verified `auth.uid()`, never on the request body. Current code at `index.ts:306-313` reads `senderUserId` directly from body — exploitable. Phase P1-4 must add body→JWT consistency check.
3. Deploy ONLY via CLI (`supabase functions deploy push-notify --no-verify-jwt`). **Never edit in Dashboard** — Dashboard editor has no version history or rollback (Supabase GitHub discussion #40448 confirms this is a permanent constraint; code is overwritten on save).
4. Ship behind a feature flag environment var `PUSH_NOTIFY_ALGO` that lets you flip between verifiers if the new path breaks.

**Phase mapping:** **P0-1 (primary).** Secondary impact on P1-4 (idempotency — same function).

**Rollback plan:**
Keep the currently-deployed 401-ing version tagged in git as `push-notify-baseline-20260421`. If the new deploy breaks more than it fixes (e.g., FCM stops delivering), run `git checkout push-notify-baseline-20260421 -- supabase/functions/push-notify/index.ts && supabase functions deploy push-notify --no-verify-jwt`. Supabase redeploy is near-atomic at the edge runtime (seconds). Realtime/DB state is unaffected by this redeploy; only push delivery flips.

---

### Pitfall 2: `ALTER PUBLICATION supabase_realtime ADD TABLE` with active WebSocket subscribers

**What goes wrong:**
P0-2 requires adding `saved_places` and `family_subscription` to the `supabase_realtime` publication so clients receive `postgres_changes`. The naive SQL is `ALTER PUBLICATION supabase_realtime ADD TABLE saved_places;`. When executed against a live project with open WebSocket connections, three concrete failures are reported upstream:

1. **Silent non-subscription.** If the client opened the channel *before* the publication change, its postgres_changes subscription for the new table stays dormant until reconnect — users see "it's deployed but nothing ships" (Supabase discussion #35147).
2. **Filter-column blindness on non-PK columns.** If any of the new subscriptions filter on a non-PK column (e.g., `family_id`), Realtime will drop the change silently unless you also run `ALTER TABLE saved_places REPLICA IDENTITY FULL`. The filter-enabled row event is generated server-side from the replica identity; `DEFAULT` only includes the PK, so `family_id` filters never match.
3. **Cascade subscribe failures.** If `saved_places` is added while its RLS `SELECT` policy is broken (e.g., the `family_subscription_effective_tier()` function call fails or returns null for a family without a subscription row), Realtime quietly drops the change for that client rather than erroring — feels like "it works for some families and not others."

**Why it happens:**
- Supabase Realtime respects RLS for every emitted change. The `sp_select_family` policy in `20260418000006_saved_places.sql` uses `family_id IN (SELECT get_my_family_ids())`. If `get_my_family_ids()` is missing for a family, the client gets nothing — and debugging looks like a subscription bug, not an RLS bug.
- `REPLICA IDENTITY DEFAULT` is easy to forget; `family_subscription` in particular lists policy conditions that read `family_subscription_effective_tier(saved_places.family_id)` during INSERT — so a broken function on that path breaks *writes*, not just reads.

**Warning signs:**
- Dashboard → Database → Publications shows `saved_places` listed, but `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='saved_places';` returns nothing → replication catalog not refreshed; reconnect replication worker.
- Realtime WebSocket frame logs show `phx_reply` with `{status: "ok"}` to the channel join but zero `postgres_changes` events despite DB writes — classic RLS-blocks-emission symptom.
- `sync.js` continues to 404 on REST despite the table existing → the Supabase PostgREST schema cache didn't reload (run `NOTIFY pgrst, 'reload schema'`).

**Prevention:**
1. Migration must be: `ALTER PUBLICATION ... ADD TABLE`, then `ALTER TABLE ... REPLICA IDENTITY FULL`, then `NOTIFY pgrst, 'reload schema';` in that order.
2. Test subscription on the preview branch BEFORE main promotion: open a Playwright test that INSERTs and asserts the realtime callback fires with the correct `family_id` filter.
3. For RLS-gated tables, seed a `family_subscription` row for the live family `4c781fb7-…` with an explicit free tier BEFORE policies that depend on `family_subscription_effective_tier()` become read-path dependencies.
4. Advise clients to reconnect (close and reopen the WS) at next app foreground after migration — OR bump a `realtimeSchemaVersion` global that triggers client-side resubscribe.

**Phase mapping:** **P0-2 (primary).** Secondary on P1-5 (sync.js 404 is a downstream symptom of the same schema-drift; fixing publication without fixing PostgREST cache leaves fetchSavedPlaces 404-ing).

**Rollback:**
`ALTER PUBLICATION supabase_realtime DROP TABLE saved_places;` is instantaneous and safe. Publication drop does not delete rows, does not affect PostgREST, and takes no strong locks. Keep a one-line rollback SQL checked into `supabase/migrations/down/` for every publication change.

---

### Pitfall 3: RLS policy tightening under active sessions — the "join_family RPC worked yesterday, returns 403 today" failure

**What goes wrong:**
P0-3 requires **tightening** three policies on live data:
- `pair_code` rotation + TTL (new check constraint on `families.pair_code`).
- Single-child constraint on `family_members` (new INSERT policy, see `20260418000005_subscription_rls.sql:1-14` which already soft-locks to premium for the 2nd child).
- Child self-unpair block (new DELETE policy on `family_members`).

Tightening RLS on a table with live sessions has **three specific failure modes**:

1. **Existing open sessions keep the old policy cached for up to 60s** (PG-level plan cache on prepared statements that reference the policy). For that window, some writes pass the old policy, some the new — non-deterministic partial failures.
2. **`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on a table that already had RLS** is a no-op, but a sequence of `DROP POLICY ... CREATE POLICY` is two separate transactions in the default migration style; between the DROP and the CREATE, the table has **no policy at all**, so either (a) everything is allowed if RLS was disabled, or (b) everything is denied if RLS was enabled (the default-deny behavior). Playwright tests passing in a fresh DB will miss this race entirely.
3. **The new `family_members` INSERT policy** (soft-lock 2nd child via premium) depends on `family_subscription_effective_tier()`. In the live family `4c781fb7-…` there are **4 children** already. The constraint is on INSERT only (existing rows are grandfathered), but if any migration or support action re-inserts one of those rows (e.g., an admin "re-link" flow), it will fail the new policy. This is the "existing data is implicitly broken against new policy" trap.

**Why it happens:**
- Postgres policy changes require `ACCESS EXCLUSIVE` lock briefly (for DROP/CREATE POLICY metadata), which blocks all reads and writes on that table until the migration commits. On a busy table like `family_members` this can cascade into connection-pool exhaustion during the pause.
- Developers test RLS against a freshly-seeded preview branch that has no prior rows violating the new rule. Live data might, especially when the repo has 4 children for a 1-child rule.
- DROP-then-CREATE POLICY pattern (used throughout this repo — see every migration file) is not transactionally grouped in the existing migration style.

**Warning signs:**
- Client errors of the form `new row violates row-level security policy` on an action that worked pre-migration.
- Sudden spike in anonymous `select auth.uid()` in `pg_stat_activity` — clients retrying failed writes.
- `pair_code` rotation migration emits a CHECK violation on the families row containing `4c781fb7-…` at migration run time → existing pair code format doesn't match new constraint.

**Prevention:**
1. **Wrap DROP POLICY + CREATE POLICY in a single transaction** (`BEGIN; DROP POLICY ...; CREATE POLICY ...; COMMIT;`) so no gap exists where the table has no policy. Every migration in `supabase/migrations/2026041800000X_*` currently does NOT wrap in BEGIN/COMMIT — this is a repo-wide technical debt that P0-3 must fix before any further RLS tightening.
2. **Audit live data against new policy BEFORE migrating.** Query `SELECT * FROM family_members` and simulate the new INSERT/DELETE policies against each row. Document what fails and decide: grandfather, migrate, or block.
3. For the pair_code TTL: keep the existing pair_code format; add `pair_code_expires_at timestamptz NOT NULL DEFAULT now() + interval '48 hours'` as a separate column; let the TTL be enforced in the `join_family` RPC body, not a CHECK constraint. Constraints on existing columns can fail load-bearing data; function-level checks fail *new operations* cleanly.
4. Set `lock_timeout = '2s'` at the start of every migration so a stuck migration aborts instead of locking the table indefinitely.

**Phase mapping:** **P0-3 (primary).** Secondary on P2-7 (pairing UI depends on pair_code validity; if pair_code constraint breaks at migration time, P2-7 UI will show "잘못된 코드" for all codes until a support rotation).

**Rollback:**
All three P0-3 RLS changes are reversible with inverse migrations (`DROP POLICY new_name; CREATE POLICY old_name ...`). Critical: **before running P0-3 SQL, store the current policy defs** via `SELECT * FROM pg_policies WHERE tablename IN ('family_members','families');` saved to `.planning/research/rls-snapshot-pre-P0-3.sql`. Rollback is "apply snapshot." Data-layer rollback is not needed because P0-3 tightens rules, does not alter row data.

---

### Pitfall 4: Pair code rotation severing the 2-parent + 4-child active pairing

**What goes wrong:**
The live family has 2 parents and 4 children actively paired. The `pair_code` on `families.pair_code` was issued when the first parent signed up (likely with no TTL). P0-3 wants to add a TTL + rotation. The failure mode is: migration rotates ALL pair_codes to a new format, but **existing paired children don't use pair_code after pairing** — so they keep working. BUT the onboarding flow for a *new* child (child 5 if one is added, or a re-paired child after re-install) requires the parent to show the pair_code to the child. If the TTL expired and rotation is silent, the parent sees the last-known code in the UI, the child enters it, and `join_family` RPC rejects with "잘못된 코드" — the parent blames the app, not the expired code. The user-observable is "pairing just stopped working."

Second failure mode: if rotation is implemented as "generate new code on every parent login," existing children who haven't opened the app get orphaned *without the family intending it*.

**Why it happens:**
- Pair codes conflate three concepts: **first-time pairing** (one-shot), **share with a new device** (reusable within family), and **rotation for security** (invalidate after compromise). Rotating code without distinguishing breaks legitimate multi-device flows.
- The live family's 3 "zombie" child rows (PROJECT.md line 59) suggest children got re-paired at some point — any aggressive rotation will generate more zombies.

**Warning signs:**
- `join_family` RPC 400 rate climbing from near-zero on the day of P0-3 deploy.
- Support tickets "페어 코드가 안 돼요" (pair code doesn't work) matching the deploy timestamp.
- Pair code column values in DB that look like old-format (e.g., 6-digit numeric) next to new-format (e.g., 8-char alphanumeric) after migration — format drift.

**Prevention:**
1. **Rotation must be opt-in (parent button), not automatic.** Reuse the existing pair_code for established families; add TTL only to codes issued *after* the migration (nullable `issued_at` column, TTL only applies where non-null).
2. Add a parent UI: "This code was created on [date]. Rotate?" — informed consent before severing.
3. Add a child-side error: "This pairing code has expired. Ask your parent to rotate the code." (distinct from "wrong code" error) so parents know to act.
4. Before deploying, INSERT a support-override path (server-side function for admin to regenerate) so human support can fix any stranded family within minutes.
5. Data migration: for all existing pair_codes, set `issued_at = now() - interval '10 years'` AND `expires_at = NULL` so they are treated as "legacy, no TTL" — tightening applies only to new codes.

**Phase mapping:** **P0-3 (primary).** Secondary on P2-7 (child onboarding UI gate must handle the expired-vs-invalid distinction).

**Rollback:**
Keep old pair_code values in a shadow column `pair_code_legacy` for 30 days. If rotation breaks a family, restore from `pair_code_legacy`. Schema-level rollback is a single `UPDATE families SET pair_code = pair_code_legacy WHERE … ;`.

---

### Pitfall 5: `memos` → `memo_replies` consolidation losing data or breaking RLS mid-migration

**What goes wrong:**
P1-6 consolidates `memos` + `memo_replies` into a single model. The repo's own audit (PROJECT.md:63) notes: **`memos` table is missing `created_at` and `user_id` columns** (error `42703`). This means the two tables have divergent schemas; a naive `INSERT INTO memo_replies SELECT * FROM memos` will fail at column mapping. A less naive script that backfills `user_id = family_id` or similar will silently mis-attribute authorship — parents reading "their" memo history will see their child's memo attributed to themselves (safety-app trust violation).

Second failure: dropping `memos` before verifying the consolidated model is correct leaves no return path. `memos` deprecation must be gated behind a `CREATE VIEW memos AS SELECT … FROM memo_replies` or similar shim until confidence is established.

Third failure: RLS policy on `memo_replies` (see `20260315152655_memo_replies_setup.sql:21-23`) only allows DELETE by `user_id = auth.uid()`. Existing `memos` rows with NULL user_id become **undeletable by anyone except service role** once migrated.

**Why it happens:**
- The `memos` table predates current schema conventions and has schema drift. Migrations that assume uniformity across historical rows silently produce invariant-violating rows.
- `memo_replies` policies were written assuming fresh data; they don't handle the "legacy memo with NULL user_id" case.

**Warning signs:**
- Any migration script that reads `memos.created_at` will error with `42703` — this is the current state; CI will catch it immediately.
- Row count drift: `COUNT(*) FROM memos` pre-migration ≠ `COUNT(*) FROM memo_replies WHERE origin='legacy'` post-migration.
- Parent UI shows memos with their own avatar that they didn't send.

**Prevention:**
1. **Snapshot `memos` to `memos_legacy_20260421` before any consolidation.** Never DROP the original.
2. Add a `source` / `origin` column to `memo_replies` (`'original' | 'reply' | 'legacy_memo'`) so the UI can distinguish and so legacy rows can be filtered out.
3. For rows with NULL `user_id`, backfill with a known "system" UUID AND record the mapping in an audit column — never silently attribute.
4. Keep `memos` as a view for at least 30 days post-consolidation so client rollback is possible.
5. Run read-parity test: for each memo the UI renders pre-migration, assert same content post-migration.

**Phase mapping:** **P1-6 (primary).**

**Rollback:**
`DROP VIEW memos; ALTER TABLE memos_legacy_20260421 RENAME TO memos;` + revert `memo_replies` inserts with `origin='legacy_memo'`. Having the snapshot makes rollback trivial; without it, rollback is impossible.

---

### Pitfall 6: Web Push VAPID keys on restart — the "did we keep the same keys?" trap

**What goes wrong:**
P0-1 redeploys `push-notify`. If the redeploy is done via a *new* Supabase project, a branch promotion, or an env-var wipe, the VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY the function uses may not match the public key that every existing `push_subscriptions` row was created with. When this happens, `webpush.sendNotification()` throws 403 for every existing subscription — the function appears deployed but silently drops every web push. Per [RFC 8292 §2.3](https://datatracker.ietf.org/doc/html/rfc8292), a push service rejects a PushVerification signed with a VAPID key that doesn't match the subscription's applicationServerKey. RFC 9749 notes this is a **403**, and the only recovery is to force clients to `unsubscribe()` and re-`subscribe()` with the new public key — which requires clients to open the app.

Second failure mode: web-push library version drift. The function currently pins `npm:web-push@3.6.7`. If redeploy resolves a newer major version (if pin is relaxed), VAPID detail format changes have been known between majors.

**Why it happens:**
- VAPID keys are project-level env vars in Supabase. Branch promotion copies functions but NOT env vars by default. The new environment starts with *no* VAPID keys → function code calls `webpush.setVapidDetails(...)` with undefined → throws at module load → cold start failures.
- Engineers rotate VAPID keys "for hygiene" during a fix, breaking every existing subscription.

**Warning signs:**
- `push-notify` deploys cleanly but function logs show `MissingVapidDetailsError` or `InvalidVapidDetailsError` at init.
- Every web push returns `statusCode === 403` and the function's `expiredIds` list grows to include everything (but these are NOT expired — they just can't be authenticated).
- Browser-side, service worker receives no events, but `pushManager.getSubscription()` returns a valid subscription — proves subscription exists, just can't receive.

**Prevention:**
1. **Snapshot current VAPID keys** before any redeploy. Verify env vars in the target project match.
2. If VAPID keys must change, migrate subscriptions in two phases: (a) deploy function that accepts dual-signing (sign every push with both old and new keys — web-push library supports this by serializing two pushes per subscription), (b) push clients a self-resubscribe trigger via non-push channel (realtime broadcast) when the app is foreground, (c) after 30 days, delete subscriptions that haven't re-subscribed.
3. Add a deploy-time smoke test: after deploy, call a test endpoint in `push-notify` that sends to ONE known good subscription; if it 403s, abort promotion.
4. Hardcode web-push version at the exact pin and include a CI test that imports the module.

**Phase mapping:** **P0-1 (primary).**

**Rollback:**
VAPID keys must be stored in two locations before any redeploy: Supabase project env, and a sealed secret in the repo's deploy-time vault (or `~/.ssh/hyeni-vapid-backup.env` for small teams). Rollback is "restore env vars, redeploy previous function version."

---

### Pitfall 7: FCM HTTP v1 migration — private key leakage and token rate limit

**What goes wrong:**
The function already uses HTTP v1 (`fcm.googleapis.com/v1/projects/.../messages:send` at line 190). Legacy FCM API shut down 2024-07-22, so any team shipping FCM in 2026 is on v1 by default. BUT there are three v1-specific failure modes relevant here:

1. **Service account private key exposure.** Line 49 shows `FCM_PRIVATE_KEY` read from raw env var. If this is leaked (logs, error messages, Sentry breadcrumbs), the attacker can send FCM to ALL your devices. Legacy server keys rotated easily; v1 private keys are long-lived (Google service account credentials).
2. **600k tokens / minute rate limit.** At current family count this is far below, but the `push-notify` cron path (line 386) iterates every event × every family × every notification window. At scale, the `for (const t of tokens)` awaited loop at line 243-257 is **serial** — one slow FCM response blocks all others, but doesn't protect against burst limits.
3. **Token lifecycle skew.** v1 fails with HTTP 404 for unregistered tokens (line 205 handles this correctly) BUT there's also `UNREGISTERED` in the response body for some error classes — the current substring match (`errBody.includes("UNREGISTERED")` at line 205) is correct but fragile if Google changes error format.

**Why it happens:**
- Service account JSON is copy-pasted into env vars; the `private_key` field starts with `-----BEGIN PRIVATE KEY-----` and is sometimes logged whole during debugging.
- Migrations often land before rate-limit handling; at current scale it's invisible.

**Warning signs:**
- Sentry/logs contain strings matching `-----BEGIN PRIVATE KEY-----` → IMMEDIATE credential rotation required.
- FCM returns `429 QUOTA_EXCEEDED` or `UNAVAILABLE` in `res.text()` → hit rate limit; need backoff.
- FCM returns `INVALID_ARGUMENT` with note about `data` field → data payload has non-string values (current code at line 174 coerces to string, good).

**Prevention:**
1. Use `FCM_SERVICE_ACCOUNT_JSON` (line 20) rather than splitting fields — reduces the chance of logging the private_key in isolation.
2. Add a Sentry/log scrubber that redacts `-----BEGIN.*-----END.*-----` patterns before any log ships.
3. Add per-call backoff for 429 — current code at line 208 returns "error" but doesn't retry; build an exponential backoff wrapper.
4. Rotate the FCM service account key annually AND on any suspected leak. Keep a `FCM_PRIVATE_KEY_ROTATED_AT` env var so you know age.

**Phase mapping:** **P0-1 (primary). P1-4 secondary (idempotency key reduces duplicate FCM calls, indirectly protecting rate limit).**

**Rollback:**
FCM keys rotate in Google Cloud Console; rotation is instant. If a new key is deployed and breaks, redeploy old key env var. Old key remains valid until explicitly revoked.

---

### Pitfall 8: WebView auto-grant microphone removal locking existing users out of 주위소리듣기

**What goes wrong:**
P2-8 removes WebView's auto-grant for the microphone (currently `PermissionRequest.grant()` called unconditionally on microphone requests). The new code will call `onPermissionRequest` with an explicit Android prompt. The failure mode: **existing users have the Android-level microphone permission granted already** (for the prior auto-grant behavior to work, the app manifest already requested `RECORD_AUDIO`, and users have granted it). The change from auto-grant to prompt means:

1. Existing users get a prompt they never saw before — confusing. "Why is the app asking for the microphone *again*?"
2. If a user has "Deny" muscle memory and taps Deny, 주위소리듣기 is now permanently broken for them unless they dig into Android settings. On Android 11+, a second deny → "don't ask again" behavior.
3. App upgrade flow: existing users who upgrade keep Android-level permission, but the WebView's per-origin grant is persisted separately inside WebView. If the WebView grant was auto-granted before (meaning there's no persisted user decision), removing auto-grant may reset WebView state to "ask every time" which feels broken.

**Why it happens:**
- WebView permissions and Android permissions are two separate layers. Auto-grant in `onPermissionRequest` skipped the WebView layer entirely; removing it exposes the layer that was never asked before.
- Capacitor's Android scheme (`android:scheme="https"` vs `http`) also affects persisted permission grants (Capacitor issue #7548). If anyone changes the scheme during this work, the WebView treats it as a new origin and all prior WebView state evaporates — including permissions **and localStorage/IndexedDB**.

**Warning signs:**
- Users report "주위소리듣기 안 돼요" after upgrade.
- `adb logcat` shows `PermissionRequest denied` for `RESOURCE_AUDIO_CAPTURE` with no visible prompt in the WebView → prompt was auto-dismissed because activity lifecycle interrupted.
- `localStorage` empty for users who had data before upgrade → androidScheme changed.

**Prevention:**
1. **Do not change `androidScheme` in `capacitor.config.ts`** during this work. Verify it is still `https` (or whatever it currently is). Add a test to CI that pins the scheme.
2. Implement the prompt with a **pre-prompt rationale screen** inside the web app: "To let your parent listen, we need microphone access. Tap Allow on the next screen." This reduces the deny rate.
3. For users who already granted Android-level permission AND whose app was working (determinable by a `hasGrantedAmbientListen` boolean in localStorage), skip the new prompt and call `.grant()` the first time post-upgrade only — then switch to prompt-on-request behavior. This is the "honor legacy consent" pattern.
4. Add `remote_listen_sessions` audit logging BEFORE removing auto-grant, so you can measure the feature's usage to quantify breakage risk.

**Phase mapping:** **P2-8 (primary).**

**Rollback:**
Reintroduce auto-grant in a hotfix build via `PermissionRequest.grant()`. This is a native code change and requires APK rebuild + Play Store internal test track promotion — rollback is NOT instant (hours to days, depending on Play Console review). For this reason, P2-8 must be gated behind a **remote feature flag** (read from `family_subscription` or a new `runtime_flags` table) so you can disable the new behavior server-side without rebuild.

---

### Pitfall 9: Capacitor APK upgrade losing localStorage / IndexedDB (push subscription, pair state)

**What goes wrong:**
P0-1, P0-2, P0-3 all require at least one new APK build (push subscription may need to recreate, and the app needs updated schema expectations). Capacitor has documented behavior that **localStorage and IndexedDB can be cleared on upgrade under specific conditions** (Capacitor GitHub issue #7548):
- If `androidScheme` changes between versions → full origin change → storage wiped.
- If user device is low on storage → Android system may clear WebView storage.
- If `cleartext` config flag changes → some devices treat as new origin.

In this project, localStorage holds: push subscription endpoint, pair state (`joined_family_id`), realtime session tokens, UI preferences. Losing localStorage means:
- User appears logged out (though Supabase auth token is typically in IndexedDB and may survive).
- Pair state lost → user re-enters pair code, potentially creating a duplicate `family_members` row (the "zombie child" problem).
- Push subscription endpoint lost → service worker re-subscribes with a NEW endpoint; old endpoint remains in `push_subscriptions` table, receiving pushes that go nowhere.

**Why it happens:**
- Capacitor maps web localStorage to WebView storage, which Android manages semi-autonomously.
- Any Capacitor major version bump (5→6 is known to clear) loses data.
- Updating `capacitor.config.ts` during P2-8 (permission work may touch Android config) inadvertently changes scheme.

**Warning signs:**
- After upgrade, users see onboarding flow again.
- `push_subscriptions` table grows ~2x overnight after a release (each device re-subscribed without cleaning up old sub).
- `family_members` row count jumps per user by 1 per upgrade.

**Prevention:**
1. **Do not bump Capacitor major version** during this milestone. Current is 8; stay on 8.
2. Pin `androidScheme` and add a CI lint that fails the build if `capacitor.config.ts` scheme/hostname changes.
3. Migrate ALL critical state to Capacitor Preferences API (native KV store, persists across WebView clears) — not localStorage. This is a P2-level hardening but for push subscription it's worth doing now as part of P0-1.
4. On app start, reconcile `push_subscriptions` rows by calling `pushManager.getSubscription()` and DELETE any rows in DB whose endpoint doesn't match the current subscription. Makes orphaned subs self-heal.
5. `family_members` INSERT policy should have a partial unique index on `(family_id, user_id)` so re-joining doesn't create a duplicate row — only updates timestamps.

**Phase mapping:** **P0-1, P0-2, P2-7, P2-8 (all phases that ship an APK).**

**Rollback:**
Once data is lost client-side, server-side rollback doesn't restore it. Rollback must be preventive (don't ship the build that clears state). If a release ships and clears storage, the fix is forward-only: a subsequent release that recovers state from server (re-fetch subscription, re-query family_id, etc.).

---

### Pitfall 10: Migration files not idempotent — re-running breaks production

**What goes wrong:**
The repo's migration files use `DROP POLICY IF EXISTS ... CREATE POLICY ...` pattern (see every file in `supabase/migrations/`). Idempotent for RLS. **But the SQL files in `supabase/` (non-migrations) use un-guarded CREATEs** (e.g., `add-phone-columns.sql`, `fix-sync-final.sql`). If any of these are re-applied during remediation — which is tempting when scrambling to fix issues — they will fail on duplicate-key or duplicate-column errors, leaving the DB in a half-applied state.

Second issue: the repo has TWO directories of SQL (`supabase/*.sql` and `supabase/migrations/*.sql`). It's unclear which is the source of truth. Live production may have had non-migrations-folder files applied ad-hoc, creating schema drift vs. the migrations history — the `memos` missing-column issue (PROJECT.md:63) is a symptom of this.

**Why it happens:**
- Early-stage project kept loose `.sql` files before adopting the migrations directory structure. Both were applied over time; no single record of "what's actually in prod."
- Migration tools (`supabase db push`) only know about `supabase/migrations/`. The loose files were applied manually via SQL Editor.

**Warning signs:**
- `supabase db diff` shows drift between migration history and actual schema.
- Any `42701` (duplicate column) or `42P07` (duplicate table) error in migration logs.
- `memos` table lacks columns listed in the audit → loose SQL was run in some envs but not others.

**Prevention:**
1. **Before any P0 migration runs**, take a `pg_dump --schema-only` of production and a `supabase db diff` against the migrations folder. Reconcile drift into the migrations history (write a "schema reality" migration that brings history in line with production).
2. Delete or archive `supabase/*.sql` loose files (rename to `supabase/archive/_deprecated_*.sql`) to prevent accidental re-application. Document that `supabase/migrations/` is canonical.
3. Every new migration must be idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP ... IF EXISTS; CREATE ...`) AND wrapped in `BEGIN; ... COMMIT;`.
4. Apply migrations to Supabase branch first (user already plans this, PROJECT.md:77) and compare `pg_dump` output before and after — ensure no surprise changes.

**Phase mapping:** **P0-2 (primary — SQL schema additions). Also P0-3, P1-6.**

**Rollback:**
For each migration, author a corresponding down-migration file in `supabase/migrations/down/` that reverses it. `supabase db push --dry-run` lets you validate before applying. The repo currently has **no `down/` directory** — creating one is a pre-condition for P0-2.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `--no-verify-jwt` on push-notify without in-function verification | Fastest unblock of 401 errors | Anyone can POST to push-notify and flood devices; FCM rate-limit burn | Never in production with user input; acceptable for cron-only functions |
| Ad-hoc SQL in `supabase/*.sql` instead of `supabase/migrations/` | Quick fix during incident | Schema drift, irreproducible prod | Never; always promote fixes to migrations/ within 24h |
| Rotating pair_code for all families at once | "Security hygiene" tick mark | Severs legitimate pairings; support volume spike | Never without per-family opt-in |
| Dropping `memos` table after assumed-successful consolidation | "Clean schema" | Irrecoverable data loss | Only after 30 days of shadow mode with no parity diffs |
| WebView auto-grant microphone | No prompt → smoother UX | Security review failure; Play Store scrutiny; users unaware of recording | Never in a safety app handling minors |
| Service role key in client or non-Edge-Function contexts | "Just works" bypassing RLS | Full DB exposure if leaked | Never — use Edge Functions with session-scoped JWTs |
| localStorage for pair state | Trivial to write | Lost on upgrade, scheme change, or OS storage cleanup | MVP only; P2 must migrate to Capacitor Preferences |
| Skipping `REPLICA IDENTITY FULL` on filtered Realtime tables | Faster migration | Silently no events — invisible bug | Never if the filter is not the PK |
| Single `for (const t of tokens)` FCM send loop (serial) | Simpler code | 429 under burst; slow fan-out | OK at current ~6 tokens/family; must parallelize if >50 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Edge Functions | Assuming `verify_jwt=true` protects when caller uses service-role JWT | Explicit in-function verification with `jose` + JWKS endpoint; never trust Authorization alone |
| Supabase Realtime | `ALTER PUBLICATION` without `REPLICA IDENTITY FULL` for filtered subscriptions | Run both, plus `NOTIFY pgrst, 'reload schema'`, plus advise clients to reconnect |
| Supabase RLS | Testing on fresh preview DB that has no prior violating rows | Audit live data against new policy; grandfather existing rows via origin/source column |
| FCM HTTP v1 | Logging `FCM_SERVICE_ACCOUNT_JSON` during debugging | Redact in logger; use `FCM_SERVICE_ACCOUNT_JSON` env var whole, never split to per-field envs |
| Web Push / VAPID | Rotating keys without dual-signing transition | Sign with old+new keys for 30 days; force client resubscribe via non-push channel |
| Capacitor Android | Bumping major version or changing `androidScheme` | Pin both; lint CI; keep critical state in Capacitor Preferences, not localStorage |
| Android WebView Permissions | Auto-granting microphone/camera in WebChromeClient | Call `PermissionRequest.grant()` only after explicit user confirmation via in-app rationale screen |
| Kakao OAuth + Supabase | Conflating Kakao user ID with Supabase `auth.uid()` in RLS | Always join through `families.parent_id = auth.uid()`, never Kakao-ID-based |
| Supabase branch → main | Assuming env vars copy to branch | Verify VAPID, FCM, SERVICE_ROLE in branch explicitly; test a push before promotion |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Serial FCM token loop in `sendFcmToFamily` | Slow push on large families | `Promise.all` with concurrency limit (p-limit 5) | ~20+ tokens/family; current max ~6 |
| 30s polling in sync.js | Wasted battery, server CPU | Move to realtime-only; polling as fallback only | At ~1k concurrent users, 30s polling = 33 qps — fine; at 10k = 333 qps — noticeable |
| `push_subscriptions` grows unbounded as expired rows accumulate | Slow `SELECT` at push time, increasing p50 latency | DELETE on 410/404 (already done at line 353); add periodic cleanup of rows not seen in 90 days | At ~100k orphaned rows per project |
| RLS policies with subqueries (`family_id IN (SELECT get_my_family_ids())`) | Every row check runs the subquery; slow at scale | Ensure `get_my_family_ids()` is `STABLE` and indexed; consider JWT claim-based check | Breaks noticeably at >10k family_members rows |
| Publication change during peak hours | WAL lag spike, replica falls behind | Apply publication/replica identity changes during off-peak (Korean early AM, 2-4 AM KST) | Any time WAL generation > replica bandwidth |
| `fetchSavedPlaces` retry-without-backoff loop (P1-5 target) | Log flood, CPU burn in background tab | Exponential backoff + circuit breaker | Breaking now (audit finding) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `push-notify` accepts `senderUserId` from request body (index.ts:307) | Attacker spoofs sender, bypasses "don't notify sender" filter; spams any family | Verify JWT in function; derive senderUserId from verified claim, not body |
| Pair code rotation logged in plaintext | Log access = ability to pair new device to existing family | Never log pair_code; hash in audit trail |
| Child anonymous JWT has same privileges as paired child via JWT claim | Lost-phone pairing means attacker keeps access until child user row deleted | Child self-unpair RLS block (P0-3) + parent-initiated remote-unpair RPC |
| `remote_listen_sessions` without consent logging | Legal/privacy exposure in minors-audio-recording domain | Insert audit row BEFORE streaming, including initiator, timestamp, duration |
| FCM private key in raw env var (not service account JSON) | Accidental log exposure of just the private key field | Use `FCM_SERVICE_ACCOUNT_JSON` whole, log scrubber for PEM blocks |
| RLS DELETE policy missing on `family_members` (until P0-3) | Child can self-unpair = severs parental visibility while child stays active | Deny DELETE for children; allow only parent-initiated |
| `pair_code` has no TTL (until P0-3) | Leaked code from a year ago still grants entry | TTL + rotation, enforced in RPC not CHECK constraint |
| Service role key exposure | Full DB bypass including `families`, `events`, location data | Never in client; rotate immediately on suspicion; confine to Edge Functions |
| `saved_places` RLS `sp_insert_parent` depends on `family_subscription_effective_tier(saved_places.family_id)` — if function throws, fails open? | Depends on PG behavior; verify | Add explicit test: function returning NULL → policy denies |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent permission prompt change (P2-8) — "why is it asking now?" | Confusion, deny rate ↑ | Pre-prompt rationale screen with app-branded explanation |
| Pair code expires mid-onboarding | Parent reads code aloud, child enters, "잘못된 코드" — parent blames app | Distinct "expired" error string; parent UI shows code age |
| Upgrade clears localStorage → user sees onboarding again | Appears app forgot them | Capacitor Preferences for critical state; server-side recovery on first launch |
| Push notification sent to sender's own device (filter bug) | Annoyance; trust loss | Derive senderUserId from JWT; filter server-side (P0-1) |
| 꾹 press-hold too short (accidental trigger) | Users pocket-press SOS; alarm fatigue for parent | 500-1000ms press-hold + haptic feedback (P2-9) |
| "주위소리듣기" starts without clear indicator to child | Child doesn't know they're being listened to → trust/ethics violation | Persistent, loud visual indicator + optional sound cue (P2-8) |
| Realtime reconnect after migration doesn't auto-rejoin subscriptions | User misses events until manual reload | Client-side version check + forced resubscribe on bump |
| Support can't help a family whose pair rotation broke | Tickets pile up, no tools | Admin-only RPC to regenerate pair_code + restore from `pair_code_legacy` |

## "Looks Done But Isn't" Checklist

- [ ] **push-notify deployed without 401:** Also verify — function actually sends Web Push (not just FCM); VAPID env vars present in target env; test push reaches a real subscription post-deploy.
- [ ] **saved_places/family_subscription in publication:** Also verify — `REPLICA IDENTITY FULL` set on each; PostgREST schema cache reloaded; a client opening a fresh WS actually receives INSERT events for the test family.
- [ ] **pair_code TTL deployed:** Also verify — existing live pair codes still work (legacy exemption); rotation is parent-opt-in UI, not migration-time auto-rotate; expired-code error string is distinct from wrong-code.
- [ ] **Child self-unpair blocked:** Also verify — test with the 4 live children (in a safe branch) that DELETE on `family_members` with child JWT returns 403; parent-initiated unpair still works.
- [ ] **sendInstantPush idempotency:** Also verify — same key sent twice in 30s results in one delivered push, not two; counter metric recorded for duplicate suppressions.
- [ ] **fetchSavedPlaces backoff:** Also verify — 404 stops retrying after N attempts; circuit breaker resets after M minutes; logs no longer flood.
- [ ] **Memos consolidated:** Also verify — parity check: every `memos` row appears in consolidated view with correct author attribution; legacy rows tagged with `origin='legacy'`; `memos` table preserved as shadow for 30 days.
- [ ] **Child pre-pair UI gate:** Also verify — anonymous child who hasn't entered a code sees ONE screen (pair code input), NOT the empty calendar/memo UI.
- [ ] **remote_listen audit + permission prompt:** Also verify — audit row inserted before stream starts; user-visible indicator while active; users upgrading from auto-grant version don't see feature broken.
- [ ] **꾹 press-hold + cooldown:** Also verify — accidental-tap SOS rate dropped in dogfood; server-side cooldown prevents burst-send from same sender.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| push-notify 401 returns after deploy | LOW | `git checkout push-notify-baseline-20260421 -- supabase/functions/push-notify/index.ts; supabase functions deploy push-notify --no-verify-jwt` |
| Publication change breaks Realtime for some clients | LOW | `ALTER PUBLICATION ... DROP TABLE` rolls back; advise clients to reconnect |
| RLS tightening locks out a family | MEDIUM | Apply pre-migration `pg_policies` snapshot SQL; requires ops access |
| Pair code rotation severs a family | MEDIUM | `UPDATE families SET pair_code = pair_code_legacy WHERE id = '...';` — requires the shadow column |
| memos consolidation corrupts attribution | HIGH | Restore from `memos_legacy_20260421` snapshot; rerun consolidation with fixed mapping |
| VAPID keys mismatch → all web push 403 | HIGH | Restore previous VAPID env vars; if keys actually rotated, 30-day dual-sign window; worst case, force resubscribe via in-app notice |
| FCM service account leaked | HIGH | Revoke key in Google Cloud Console (instant); rotate key; redeploy; audit `push_sent` for abuse |
| WebView permission regression breaks ambient listen | HIGH | Requires APK rebuild + Play internal test → hours/days. Mitigate via remote feature flag that skips new prompt path. |
| Capacitor upgrade clears localStorage | HIGH (irrecoverable client-side) | Forward-only: next release re-fetches state from server on first launch |
| SQL migration leaves schema half-applied | HIGH | Restore from Supabase daily backup (point-in-time recovery if on Pro) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. ES256 JWT verifier mis-configured | **P0-1** | curl with forged JWT returns 401; curl with valid ES256 JWT succeeds; function logs show jose verification path |
| 2. Publication + Realtime subscribe silent failure | **P0-2** | Playwright E2E: subscribe, INSERT, assert callback fires with correct filter in <2s |
| 3. RLS tightening partial-apply | **P0-3** | DROP+CREATE wrapped in BEGIN/COMMIT; `pg_policies` snapshot saved; no gap where table has no policy |
| 4. Pair code rotation severs live family | **P0-3** | Existing codes still work post-migration; new codes have TTL; rotation is parent-initiated |
| 5. memos→memo_replies data loss | **P1-6** | Row count parity; attribution parity; shadow table kept 30d |
| 6. VAPID key mismatch | **P0-1** | Pre-deploy env var check; post-deploy test push to known subscription |
| 7. FCM private key / rate limit | **P0-1, P1-4** | Log scrubber deployed; idempotency key added; monitoring for 429 |
| 8. WebView permission regression | **P2-8** | Honor-legacy-consent path; rationale screen; remote feature flag |
| 9. Capacitor storage wipe on upgrade | **P0-1, P0-2, P2-7, P2-8** (every APK ship) | Scheme pinned in CI; critical state in Capacitor Preferences; server-side state recovery on first launch |
| 10. Migration idempotency / schema drift | **P0-2** (first DB change in milestone) | `supabase db diff` run before and after; `BEGIN/COMMIT` wrap; `down/` directory seeded |

## Sources

### Official documentation (HIGH confidence)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — JWT Signing Keys (2025 asymmetric migration)](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase — New API Keys and Asymmetric Authentication](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys)
- [Supabase — Subscribing to Database Changes (postgres_changes)](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Supabase — Realtime Concepts / Architecture](https://supabase.com/docs/guides/realtime/concepts)
- [Supabase — Edge Functions Deploy to Production](https://supabase.com/docs/guides/functions/deploy)
- [Supabase — Edge Function 401 error response troubleshooting](https://supabase.com/docs/guides/troubleshooting/edge-function-401-error-response)
- [Supabase — Slow ALTER TABLE on Large Table](https://supabase.com/docs/guides/troubleshooting/slow-execution-of-alter-table-on-large-table-when-changing-column-type)
- [Supabase — Database Migrations guide](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase — Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Firebase — Migrate from legacy FCM APIs to HTTP v1](https://firebase.google.com/docs/cloud-messaging/migrate-v1)
- [Android Developers — PermissionRequest API reference](https://developer.android.com/reference/android/webkit/PermissionRequest)
- [Capacitor — Updating to 5.0 (androidScheme warning)](https://capacitorjs.com/docs/v5/updating/5-0)
- [Capacitor — Storage guide (persistence caveats)](https://capacitorjs.com/docs/guides/storage)
- [RFC 8292 — VAPID for Web Push](https://datatracker.ietf.org/doc/html/rfc8292)
- [RFC 9749 — VAPID in JMAP Web Push (key rotation semantics)](https://datatracker.ietf.org/doc/rfc9749/)
- [PostgreSQL — ALTER TABLE lock levels (current)](https://www.postgresql.org/docs/current/sql-altertable.html)

### GitHub issues / discussions (HIGH confidence — maintainer-acknowledged)
- [supabase/supabase#42244 — Edge Functions: Invalid JWT error with ES256 after rotating from HS256](https://github.com/supabase/supabase/issues/42244)
- [supabase/supabase#41691 — Edge function gateway rejects valid ES256 JWT on branch environments](https://github.com/supabase/supabase/issues/41691)
- [supabase discussions #40448 — Restore/recover Edge Function to previous deploy state (no built-in rollback)](https://github.com/orgs/supabase/discussions/40448)
- [supabase discussions #35147 — Realtime Postgres Changes Not Received Despite Correct Setup](https://github.com/orgs/supabase/discussions/35147)
- [supabase discussions #29884 — Postgres CDC Realtime filter issues (REPLICA IDENTITY FULL requirement)](https://github.com/orgs/supabase/discussions/29884)
- [supabase discussions #29289 — Asymmetric Keys support 2025](https://github.com/orgs/supabase/discussions/29289)
- [ionic-team/capacitor#7548 — Capacitor 6 migration clears localStorage](https://github.com/ionic-team/capacitor/issues/7548)
- [react-native-webview#2136 — WebView camera/microphone security-related issue](https://github.com/react-native-webview/react-native-webview/issues/2136)

### Technical writeups and incident precedents (MEDIUM confidence — peer-review level)
- [Cybertec — ALTER TABLE ADD COLUMN done right in PostgreSQL](https://www.cybertec-postgresql.com/en/postgresql-alter-table-add-column-done-right/)
- [Mickel Samuel — Which ALTER TABLE Operations Lock Your PostgreSQL Table](https://dev.to/mickelsamuel/which-alter-table-operations-lock-your-postgresql-table-1082)
- [Indrek — How to Safely Alter a Busy Table in Postgres](https://blog.indrek.io/articles/how-to-safely-alter-a-busy-table-in-postgres/)
- [Sinan Can Soysal — Fixing JWSError JWSInvalidSignature in Supabase Edge Functions](https://medium.com/@sinancsoysal/fixing-jwserror-jwsinvalidsignature-in-self-hosted-supabase-edge-functions-d4799caf4c9f)
- [Customer.io — FCM Deprecation: Your Guide to Navigating the Change](https://customer.io/learn/mobile-marketing/fcm-deprecation)
- [OneSignal — What to know about the FCM Deprecation](https://onesignal.com/blog/what-you-should-know-about-the-fcm-deprecation-announcement/)
- [Cybernews — iOS family safety app leaks 320,000 users' whereabouts (family-app data-leak incident precedent)](https://cybernews.com/security/ios-gps-tracker-app-leaks-location-data/)
- [Cybernews — Parental control app KidSecurity data leak](https://cybernews.com/security/parental-control-app-kidsecurity-data-leak/)

### Repo-internal evidence (HIGH confidence — direct read)
- `supabase/functions/push-notify/index.ts` lines 7, 49, 174, 205, 243, 307, 353 (cited above)
- `supabase/migrations/20260418000006_saved_places.sql` (RLS policies with `family_subscription_effective_tier()` dependency)
- `supabase/migrations/20260418000005_subscription_rls.sql` (soft-lock for 2nd child; directly relevant to P0-3 constraint on a family with 4 children)
- `supabase/migrations/20260315152655_memo_replies_setup.sql` (DELETE policy on `user_id = auth.uid()`; legacy NULL user_id rows undeletable)
- `.planning/PROJECT.md` lines 59-64 (audit findings: live family `4c781fb7-…`, memos schema drift)

---
*Pitfalls research for: live-data remediation on Supabase + Capacitor 8 + FCM + Web Push*
*Researched: 2026-04-21*
