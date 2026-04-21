# Stack Research — 혜니캘린더 Production Stabilization (v1.0)

**Domain:** Brownfield fixes on React 19 + Vite + Capacitor 8 + Supabase stack
**Researched:** 2026-04-21
**Confidence:** HIGH for Issues #1, #2, #4 (Context7 + official docs). MEDIUM for Issue #3 (IETF draft expired, vendor guidance only).

> Scope: **per-fix** library/config choices for the 4 stack-level audit items. The underlying stack (React 19.2, Vite 7, Capacitor 8.2, `@supabase/supabase-js` 2.99, Deno 2) is **locked**. No replacements proposed.

---

## Issue #1 — push-notify Edge Function: ES256 JWT caller verification

### Current broken state

- `supabase/functions/push-notify/index.ts` is deployed with `--no-verify-jwt` (comment line 7) and uses the `SUPABASE_SERVICE_ROLE_KEY` for all DB work.
- The 401 `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM: ES256` observed in production comes from the **Supabase Edge Functions gateway**, not our code — the gateway layer in front of our function still tries to validate the caller's `Authorization: Bearer <ES256 JWT>` against the project's legacy HS256 secret and rejects it before the request reaches our Deno handler.
- Supabase Auth was rotated to asymmetric signing keys (ES256, kid-rotated). The legacy HS256 secret is no longer the signing key, so the gateway's pre-flight check now fails for every real user request. This matches the known bug tracked at [supabase/supabase#42244](https://github.com/supabase/supabase/issues/42244) and [#41691](https://github.com/supabase/supabase/issues/41691).

### Recommendation — `supabase.auth.getClaims(token)` in-function verification

**Approach:** Keep `--no-verify-jwt` deploy flag (we already have it). Inside the function, call `supabase.auth.getClaims(jwt)` on the bearer token. This is the **official 2026 pattern** and handles ES256 + kid rotation + JWKS caching transparently.

**Minimal code change** (replace the current direct `createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)` flow with a two-client pattern — one service-role client for DB writes, one anon client for `getClaims`):

```typescript
// push-notify/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;             // or SB_PUBLISHABLE_KEY
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);         // for getClaims
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);              // for RLS-bypassing work

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') { /* existing CORS handler */ }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse({ error: 'missing auth' }, 401);

  const { data, error } = await authClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return jsonResponse({ error: 'invalid jwt' }, 401);
  }
  const callerUserId = data.claims.sub;

  // Optional: verify callerUserId belongs to body.familyId before proceeding
  // Continue to existing handler logic using `db` for DB ops
});
```

**Why `getClaims` beats manual `jose.jwtVerify`:**
- Supabase blog 2025-07-14 ([jwt-signing-keys announcement](https://supabase.com/blog/jwt-signing-keys)) confirms: "when using an asymmetric key it'll use the Web Crypto API to verify tokens directly. It automatically discovers and caches the public key on the edge and in memory."
- No `jose` import, no JWKS URL hardcoded, no cache TTL to get wrong.
- Handles ES256 + RS256 + HS256 (fallback network call) uniformly — future-proof if Supabase rotates algorithms again.
- Ships in `@supabase/supabase-js` ≥ 2.99 (we have 2.99.1 — **already installed, no package bump needed**).

**Confidence:** HIGH. Verified via Context7 `/supabase/supabase` docs (`guides/functions/auth.mdx` has the exact pattern), Supabase official announcement blog, and `getClaims` reference page.

### Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| **`djwt` with ES256** | Deno `djwt` did not historically support ES256 with kid rotation + JWKS out of the box. Requires manual JWKS fetch + caching + kid-to-key mapping. Error-prone. |
| **`jose` (`jsr:@panva/jose@6`) + `createRemoteJWKSet`** | Works, but it's strictly worse than `getClaims` in this project: one more dep, manual cache policy, no automatic issuer validation. Reserve for non-Supabase JWT issuers. |
| **Flip Supabase dashboard `verify_jwt=true` for this function** | Per Supabase docs ([signing-keys.mdx](https://supabase.com/docs/guides/auth/signing-keys)): *"The verify_jwt flag is incompatible with the new JWT Signing Keys."* Still broken for ES256 rotations — this is the bug we are routing around. Confirmed by [issue #42244](https://github.com/supabase/supabase/issues/42244). |
| **Manual `Authorization` strip + bypass all auth** | Current state. Unacceptable: anyone with the function URL can send pushes to any family. Security regression. |

### What NOT to use

| Avoid | Why |
|-------|-----|
| `djwt` for ES256 verification | Limited ES256/JWKS ergonomics; `getClaims` is the supported path. |
| Hardcoded `SUPABASE_JWT_SECRET` HS256 verification | Legacy path; Supabase Auth no longer signs with HS256 after the rotation we already performed. |
| Dashboard `verify_jwt=true` on the function | Known incompatible with asymmetric signing keys (Supabase docs + open issues). |

---

## Issue #2 — Realtime `saved_places` + `family_subscription` postgres_changes subscription rejected

### Current broken state

- WebSocket frames show server rejection on these two tables.
- Suspected cause 1: tables not in `supabase_realtime` publication.
- Suspected cause 2 (observed): one bad filter in a multi-binding channel kills the whole channel — other tables on the same channel also stop receiving events.

### Recommendation — Part A: Add tables to the publication

**Migration SQL** (add to `supabase/` as a new `.sql` migration file, applied to Supabase branch first per project constraints):

```sql
-- Enable Realtime on saved_places + family_subscription
-- Prereq: tables exist, RLS policies allow the intended reader role SELECT.
alter publication supabase_realtime add table public.saved_places;
alter publication supabase_realtime add table public.family_subscription;

-- Required when filtering on non-PK columns (we filter on family_id):
alter table public.saved_places replica identity full;
alter table public.family_subscription replica identity full;
```

**Verification query** (must run before closing the phase):

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('saved_places', 'family_subscription');
-- Expect 2 rows.
```

**Why `replica identity full`:** Postgres only publishes PK columns in the WAL for UPDATE events by default. Our filters (`family_id=eq.<uuid>`) are on non-PK columns, so the Realtime server can't evaluate the filter without full-row replica identity. Missing this causes silent filter mismatches even when the publication entry is correct. (Verified via Context7 `/supabase/supabase` — `guides/realtime/postgres-changes.mdx`.)

### Recommendation — Part B: One channel per table (subscription isolation)

**Observed behavior:** Supabase Realtime's `postgres_changes` bindings on a single channel share a single "ok/error" handshake frame. If the server rejects ONE binding (table not in publication, RLS blocks SELECT, schema mismatch), the **whole channel** transitions to `CHANNEL_ERROR` and no other bindings on it fire. This is consistent with reports in [supabase-js#1917](https://github.com/supabase/supabase-js/issues/1917) ("mismatch between server and client bindings") and [#1473](https://github.com/supabase/supabase-js/issues/1473).

**Pattern to adopt** (update `src/App.jsx` / `src/lib/sync.js` subscription code):

```javascript
// One channel PER table. Each has its own lifecycle + error handler.
// Names are stable + scoped so re-mounts don't stack orphan subscriptions.
function subscribeToSavedPlaces(familyId, onChange) {
    const ch = supabase
        .channel(`saved_places:${familyId}`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'saved_places', filter: `family_id=eq.${familyId}` },
            (payload) => onChange(payload))
        .subscribe((status, err) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('[realtime] saved_places', status, err);
                // Fall back to polling for this resource only — don't starve other channels.
            }
        });
    return () => supabase.removeChannel(ch);
}

function subscribeToFamilySubscription(familyId, onChange) {
    const ch = supabase
        .channel(`family_subscription:${familyId}`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'family_subscription', filter: `family_id=eq.${familyId}` },
            (payload) => onChange(payload))
        .subscribe((status, err) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('[realtime] family_subscription', status, err);
            }
        });
    return () => supabase.removeChannel(ch);
}
```

**Rules:**
- Never colocate bindings for different tables on the same channel in this project.
- Channel name must include `familyId` — global channel names cause server-side binding collision across users.
- Watch for [`TooManyChannels`](https://supabase.com/docs/guides/troubleshooting/realtime-too-many-channels-error) — Supabase hosted limit is project-plan dependent; our per-user channel count stays <10 in practice.

**Confidence:** HIGH for Part A (publication + replica identity are documented requirements). MEDIUM-HIGH for Part B (isolation behavior is well-documented in issues but not stated as strict API contract in docs; conservative pattern agrees with [Supabase concepts docs](https://supabase.com/docs/guides/realtime/concepts)).

### Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| **One channel, multiple `.on()` bindings** | Official docs technically allow this, but observed failure mode in production (one bad binding = whole channel dies) makes it fragile. We need per-table resilience for a safety app. |
| **Polling instead of Realtime for these tables** | `saved_places` + `family_subscription` update rarely; polling is plausible. But we already have a Realtime channel for memos/events, and adding two more channels is cheaper than adding polling loops. Keep polling as fallback inside the `CHANNEL_ERROR` handler only. |
| **`replica identity default`** | Filter-on-family-id won't reliably fire for UPDATEs. Confirmed via Realtime troubleshooting threads. |

### What NOT to use

| Avoid | Why |
|-------|-----|
| Broadcast channels for DB-change notifications | Fragile dual-write pattern. `postgres_changes` is the right primitive for WAL-sourced change events. |
| `select *` on RLS-protected tables without grant | Realtime runs SELECT on behalf of the authenticated role; missing `grant select` silently breaks the subscription with a confusing server rejection. |

---

## Issue #3 — Web Push / FCM idempotency for triple-fire XHR→Fetch→Beacon

### Current broken state

- `sendInstantPush()` in `src/App.jsx:94-154` retries via XHR, then Fetch, then `navigator.sendBeacon` on failure.
- Each method can succeed server-side even if the client gives up (network teardown after server ack). Result: 2-3 push sends per user action, observed in audit.
- No dedup key on the Edge Function side, so the function happily sends N×notifications for N×retries.

### Recommendation — Client-side Idempotency-Key + server-side dedup table

**Client change** — generate one key per logical push, send with every retry attempt:

```javascript
async function sendInstantPush({ action, familyId, senderUserId, title, message }) {
    if (!familyId) return;
    const idempotencyKey = crypto.randomUUID();                 // one key per user action
    const payload = JSON.stringify({ action, familyId, senderUserId, title, message });
    const url = PUSH_FUNCTION_URL;
    if (!url) return;
    const session = await getSession().catch(() => null);
    const token = session?.access_token || '';

    const headers = {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,                       // ← new
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    // XHR → fetch → beacon retry ladder — all three send the SAME Idempotency-Key
    // Server guarantees at-most-once actual push send per key.
    // ... existing retry logic, just pass `headers` ...
}
```

**Beacon caveat:** `navigator.sendBeacon` cannot set custom headers — it only supports `Content-Type` via Blob. Solution: stuff the idempotency key into the JSON body as well so the server can dedup beacon fallbacks.

```javascript
const payload = JSON.stringify({ action, familyId, senderUserId, title, message, idempotencyKey });
// ... XHR + fetch read header; beacon path relies on body field
```

**Server change** — a small dedup table:

```sql
create table if not exists public.push_idempotency (
    key uuid primary key,
    created_at timestamptz not null default now(),
    first_sent_at timestamptz,
    family_id uuid,
    action text
);

-- Auto-cleanup after 24h (pg_cron or scheduled Edge Function)
create index on public.push_idempotency (created_at);
```

**Edge Function guard** (add to top of `handleInstantNotification`):

```typescript
const idempotencyKey = req.headers.get('Idempotency-Key') || (body?.idempotencyKey as string);
if (!idempotencyKey) {
    // Allow legacy clients briefly; log for migration visibility.
    console.warn('push-notify: missing Idempotency-Key', { action: body.action });
} else {
    const { error: insertErr } = await db.from('push_idempotency').insert({
        key: idempotencyKey,
        family_id: body.familyId,
        action: body.action,
    });
    if (insertErr?.code === '23505') {                          // unique_violation = retry
        return jsonResponse({ status: 'duplicate', key: idempotencyKey }, 200);
    }
    if (insertErr) {
        // Fail-open on DB error — better to send twice than not at all for a safety app.
        console.error('push-notify: idempotency insert failed, fail-open', insertErr);
    }
}
// ... existing send logic; at end, update first_sent_at
```

**TTL cleanup** (monthly Supabase cron or handled inside the function on each call):

```sql
delete from public.push_idempotency where created_at < now() - interval '24 hours';
```

### Why this pattern

- Follows the still-active [IETF `draft-ietf-httpapi-idempotency-key-header`](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) header convention (note: draft expired 2025-10-15 but the convention is adopted by Stripe, Square, MDN etc. — it remains the de-facto standard).
- UUIDv4 per user action — MDN + IETF draft both recommend "a UUID or similar random identifier."
- PK unique violation = cheapest possible dedup (single DB call, atomic). No Redis or KV needed.
- Fail-open on DB error for a **safety app** — false-double-notification is better than false-negative silence.
- 24h TTL matches Stripe's recommendation and prevents table bloat.

**Confidence:** MEDIUM. Pattern is industry-standard and the spec reference is clear, but the IETF draft itself expired, so "the standard" is vendor consensus rather than ratified RFC. Implementation verified against [MDN Idempotency-Key reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Idempotency-Key) + [Stripe idempotent requests docs](https://docs.stripe.com/api/idempotent_requests).

### Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| **Drop retry ladder; use fetch only with `keepalive: true`** | Modern `fetch({ keepalive: true })` handles page-unload cases that needed beacon in 2019-era code. Cleaner, but doesn't solve the core double-send problem if user taps twice. Still need idempotency. Worth doing AS WELL, but as a P1-4 follow-up, not in-scope for this STACK recommendation. |
| **Server-side short-window dedup by `(familyId, action, senderUserId, timestamp minute)`** | Fuzzy dedup window. Can drop legitimate back-to-back distinct events. Inferior to explicit client-supplied key. |
| **Redis/Upstash for idempotency** | Overkill for our scale. Adds a dependency. Postgres unique-constraint dedup is sub-millisecond for our write volume. |
| **Query param `?idempotency_key=` instead of header** | Header is the standard; using param pollutes URLs in logs. Only acceptable on the beacon fallback, and we already route that through the JSON body. |

### What NOT to use

| Avoid | Why |
|-------|-----|
| `Date.now()` as idempotency key | Collisions across tabs/devices within the same millisecond. Use `crypto.randomUUID()`. |
| Storing idempotency keys in-memory only (Edge Function) | Deno Deploy isolates are ephemeral and per-region — a retry may hit a fresh worker with empty Map. Must be backed by Postgres. |

---

## Issue #4 — Capacitor 8 FCM plugin + data-only `remote_listen` handling

### Current state — already correct

Audit of `android/app/src/main/java/com/hyeni/calendar/`:
- **`MyFirebaseMessagingService.java`** extends `com.google.firebase.messaging.FirebaseMessagingService`.
- Docstring (line 37-41): *"Works even when the app process is completely dead — Android starts this service automatically when an FCM message arrives."*
- This is **exactly the pattern Capacitor docs recommend** for data-only delivery with app killed — verified against [capacitorjs.com/docs/apis/push-notifications](https://capacitorjs.com/docs/apis/push-notifications):
  > "This plugin does support data-only notifications, but will NOT call `pushNotificationReceived` if the app has been killed. To handle this scenario, you will need to create a service that extends `FirebaseMessagingService`."

### Recommendation — Keep current architecture; no plugin change

**Do NOT:**
- Swap `@capacitor/push-notifications` for `@capacitor-firebase/messaging` (Capawesome). Both have the same fundamental limitation on data-only + killed-app (verified via npm + GitHub discussions). The native `FirebaseMessagingService` approach is what actually solves it, and we already have it.
- Add `capacitor-community/fcm`. The maintenance badge reads "maintenance: yes/2025" but the repo has not published a Capacitor-8-verified release at time of research (MEDIUM confidence). Our existing custom service gives us full control without that dependency.

**DO verify** in Phase P0/P1-4:
1. `AndroidManifest.xml` declares `MyFirebaseMessagingService` with the correct intent filter:
   ```xml
   <service android:name=".MyFirebaseMessagingService" android:exported="false">
       <intent-filter>
           <action android:name="com.google.firebase.MESSAGING_EVENT" />
       </intent-filter>
   </service>
   ```
2. FCM v1 send from the Edge Function sets `android.priority: "HIGH"` (already in `push-notify/index.ts:182`) — required for `direct_boot_ok` + doze-mode delivery.
3. Message body is **data-only** (no `notification:` key) for `remote_listen` — FCM delivers `notification:` payloads to system tray directly and bypasses our service in some states. Current code at `push-notify/index.ts:177-187` is already data-only, confirmed by `android.direct_boot_ok: true` and no `notification` field. ✓
4. `@capacitor/push-notifications@8.x` stays installed because we still need it for **token acquisition** + foreground UI plumbing. The native service handles the background/killed-app delivery. Two plugins can't both register the service — confirm we only declare ours, not the plugin's default service.

### Version matrix to lock

| Package | Version | Notes |
|---------|---------|-------|
| `@capacitor/core` | `^8.2.0` | Installed. Leave. |
| `@capacitor/android` | `^8.2.0` | Installed. Leave. |
| `@capacitor/push-notifications` | `^8.x` | **Install if not present** — project's package.json as audited does not show it, but Android manifest likely depends on it for token flow. VERIFY before adding. |
| `com.google.firebase:firebase-messaging` | 24.x via Firebase BoM 34+ | Android Gradle — lock BoM version in `android/app/build.gradle`. Controls `FirebaseMessagingService` API stability. |

**Check first:** look at `android/app/build.gradle` + `package.json` before adding any Capacitor push plugin — may already be pulled transitively.

### FCM v1 deprecation notes

- **Legacy FCM HTTP API was sunset July 2024** — our Edge Function already uses `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send` (push-notify/index.ts:190). ✓
- **Server key auth was removed** with the v1 cutover. Our function uses OAuth2 service account JWT → access token (push-notify/index.ts:89-159). ✓
- **`android.priority: "HIGH"`** is the replacement for the old `priority: "high"` root-level field. Already correct. ✓
- Do NOT revive any `priority: "high"` root field or `content_available: true` iOS flag (we don't target iOS).

### Confidence

HIGH on "keep the current setup" — verified via Context7 `/capawesome-team/capacitor-firebase` messaging docs + Capacitor official docs + code review of `MyFirebaseMessagingService.java`. The architecture decision was already made correctly; this milestone just needs to verify nothing regressed.

### Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| **`@capacitor-firebase/messaging` (Capawesome)** | Same data-only-on-killed-app limitation. Swap would be disruption for no benefit. |
| **`capacitor-community/fcm`** | Unclear Capacitor 8 status; we don't need it since we have a native service. |
| **Remove `MyFirebaseMessagingService.java`, rely on plugin** | Would break `remote_listen` when app is killed — the core failure mode of Issue #4. |
| **Use FCM topic subscriptions instead of tokens** | Different routing model, does not improve killed-app delivery. |

### What NOT to use

| Avoid | Why |
|-------|-----|
| Legacy FCM HTTP API endpoint `fcm.googleapis.com/fcm/send` | Sunset July 2024. |
| Server Key auth (`Authorization: key=...`) | Removed with FCM v1. |
| `notification:` payload for `remote_listen` | Bypasses `onMessageReceived` in background on Android. Data-only is mandatory for our use case. |
| Running two FCM services (plugin default + ours) in `AndroidManifest.xml` | Only one registered service receives messages; double-registration is a silent drop. |

---

## Stack Patterns by Variant

**If the production gateway 401 on Issue #1 persists AFTER deploying the `getClaims` fix:**
- Root cause is that the gateway is rejecting the token BEFORE our function runs, regardless of `--no-verify-jwt`. Workaround: document that we already deploy with `--no-verify-jwt`; if new gateway rejections appear, file a fresh Supabase support ticket referencing [issue #42244](https://github.com/supabase/supabase/issues/42244) and verify via `supabase functions deploy push-notify --no-verify-jwt --use-api` (recent CLI flag to ensure the deploy flag sticks, per [cli#4059](https://github.com/supabase/cli/issues/4059)).

**If Issue #2 subscriptions still CHANNEL_ERROR after publication + replica identity fix:**
- Check `grant select on public.saved_places to authenticated;` — Realtime evaluates RLS under the authenticated role and needs column-level SELECT grants in addition to RLS policies.
- Run `select relrowsecurity from pg_class where relname = 'saved_places';` — if RLS was dropped and re-added, policies may be stale.

**If Issue #3 idempotency key dedup table grows unbounded:**
- Add pg_cron job: `select cron.schedule('push-idempotency-cleanup', '0 */6 * * *', $$delete from public.push_idempotency where created_at < now() - interval '24 hours'$$);` — requires pg_cron extension (available on Supabase Pro+).

**If Issue #4 `remote_listen` still drops on Xiaomi/MIUI/OnePlus devices:**
- Vendor battery-optimization whitelists are out of scope. Document in-app: "배터리 최적화 예외에 '혜니캘린더'를 추가해주세요" for affected devices. No code change fixes MIUI aggressive killing.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@supabase/supabase-js@2.99.1` | Supabase Auth ES256 via `getClaims` | `getClaims()` added in 2.47+; 2.99 is well past cutoff. No upgrade needed. |
| `@capacitor/push-notifications@8.x` | `@capacitor/core@8.2.0`, `@capacitor/android@8.2.0` | Major version must match Capacitor major. Verify install before using. |
| Firebase BoM 34.x | `compileSdk 35` (Android 15) | Check `android/app/build.gradle` — our BoM must be ≥ 33.0.0 for FCM v1 server-send flow to match SDK expectations on the client. |
| Deno 2 (Edge Runtime) | `npm:@supabase/supabase-js@2` via `npm:` specifier | Already in use. |

---

## Installation / Migration Summary

**No new npm packages required.** All recommendations use existing deps:
- `@supabase/supabase-js@2.99.1` for `getClaims` (Issue #1)
- Native `FirebaseMessagingService` already present (Issue #4)
- Client-side `crypto.randomUUID()` — browser-native (Issue #3)

**SQL migrations required:**

```bash
# Apply to Supabase branch (per project constraint), verify on real-services Playwright, then promote to main.
# 1. Publication + replica identity for Realtime (Issue #2)
# 2. push_idempotency table (Issue #3)
```

**Config changes required:**
- `push-notify/index.ts` refactor — add `getClaims` auth gate + idempotency table check.
- `src/App.jsx` (`sendInstantPush`) — add `Idempotency-Key` header + body-embedded key.
- `src/App.jsx` / `src/lib/sync.js` — split one-channel-per-table for Realtime subscriptions.

---

## Sources

### Context7 (HIGH confidence — authoritative, current docs)
- **`/supabase/supabase`** — `guides/functions/auth.mdx` (getClaims ES256 example), `guides/auth/signing-keys.mdx` (JWKS + asymmetric keys), `guides/realtime/postgres-changes.mdx` (publication requirements), `guides/auth/jwts.mdx` (JWKS endpoint spec)
- **`/capawesome-team/capacitor-firebase`** — `packages/messaging/README.md` (plugin capabilities, Android data-only limitations)

### Official Docs (HIGH confidence)
- [Supabase Functions Auth guide](https://supabase.com/docs/guides/functions/auth) — `getClaims` as recommended verification pattern
- [Supabase JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys) — ES256 migration, JWKS, incompatibility of `verify_jwt=true` with asymmetric keys
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — `alter publication supabase_realtime add table …` + replica identity
- [Supabase Realtime Concepts](https://supabase.com/docs/guides/realtime/concepts) — channel semantics
- [Capacitor Push Notifications API](https://capacitorjs.com/docs/apis/push-notifications) — v8 docs, killed-app data-only limitation
- [MDN Idempotency-Key](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Idempotency-Key) — header semantics + UUID recommendation
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests) — industry reference for 24h TTL + server storage
- [IETF draft-ietf-httpapi-idempotency-key-header](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) — header spec (draft expired 2025-10-15, de-facto standard)

### GitHub Issues / Discussions (MEDIUM confidence — corroborate symptoms)
- [supabase#42244](https://github.com/supabase/supabase/issues/42244) — "Edge Functions: Invalid JWT error with ES256 after rotating from HS256"
- [supabase#41691](https://github.com/supabase/supabase/issues/41691) — "Edge function gateway rejects valid ES256 JWT on branch environments"
- [supabase/supabase-js#1917](https://github.com/supabase/supabase-js/issues/1917) — "CHANNEL_ERROR: mismatch between server and client bindings for postgres changes"
- [supabase/supabase-js#1473](https://github.com/supabase/supabase-js/issues/1473) — `channel.subscribe()` CHANNEL_ERROR root causes
- [supabase/cli#4059](https://github.com/supabase/cli/issues/4059) — `--no-verify-jwt` flag persistence bug
- [Supabase blog 2025-07-14](https://supabase.com/blog/jwt-signing-keys) — `getClaims()` announcement: *"faster alternative to getUser()"*, "Web Crypto API to verify tokens directly"

---

*Stack research for: 혜니캘린더 v1.0 production stabilization (4 stack-level fixes)*
*Researched: 2026-04-21*
*All recommendations verified against 2026-current official documentation via Context7 + targeted WebFetch, not training-data recollection.*
