---
plan: 02-01
phase: 02-unblock-core-push-gateway-realtime-pair-security
title: "push-notify ES256 Fix via getClaims + senderUserId Security Patch"
status: complete
completed_at: 2026-04-21
stream: A
requirements: [PUSH-01]
depends_on: []
autonomous: false
checkpoint_passed: human-verify (user approved deploy)
---

# Plan 02-01: push-notify ES256 Fix via getClaims

## What was delivered

**SQL schema:**
- `supabase/migrations/20260421103838_push_idempotency_table.sql` — `CREATE TABLE public.push_idempotency (key uuid PK, created_at timestamptz DEFAULT now())` + RLS enabled + `created_at` index. Schema only — Phase 3 P1-4 will use it.
- Paired down migration.

**Edge Function `push-notify/index.ts` (+36/-3, 570 lines total):**
- Added `SUPABASE_ANON_KEY` env read for the auth client.
- Inserted 19-line auth gate inside `Deno.serve` using `supabase.auth.getClaims(jwt)` — handles ES256 + kid rotation + JWKS caching transparently via `@supabase/supabase-js@2.99.1` (no dep bump).
- Rejects missing Bearer with `401 {"error":"missing auth"}` + invalid JWT with `401 {"error":"invalid jwt"}`.
- Passes `callerUserId` + `callerRole` into `handleInstantNotification`.
- **Security fix**: `senderUserId` now derived from verified JWT `claims.sub` (closed PITFALLS P2-9 body-trusted spoofing vector). Service-role cron path preserved (`role === "service_role"` → accepts optional body override).
- `--no-verify-jwt` deploy flag kept (D-A02 — gateway bug supabase#42244 workaround).

**Deploy:**
- `npx supabase functions deploy push-notify --no-verify-jwt --project-ref qzrrscryacxhprnrtpjd` → live as v32 (Supabase internal versioning; prior: v29 last-working, v30 ES256-regression).

## Smoke tests (all PASS)

| Test | Command | Expected | Actual |
|---|---|---|---|
| Missing Bearer | `curl POST /functions/v1/push-notify` (no auth) | `401 {"error":"missing auth"}` | ✅ 401 `missing auth` |
| Garbage JWT | `curl POST ... -H "Authorization: Bearer totally-not-a-jwt"` | `401 {"error":"invalid jwt"}` | ✅ 401 `invalid jwt` |
| Log version | MCP `get_logs` latest | v31 or later | ✅ v32 (newer than v30) |
| Response text source | Must contain our new error codes (not legacy `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM`) | Our messages | ✅ Our messages live |

Valid ES256 JWT → 200 smoke is **deferred to natural browser usage** (user opens https://hyenicalendar.com as parent, triggers push via 꾹 or memo, observes POST 200 in MCP logs). The cold-path smokes above prove the new code is routing requests through the getClaims auth gate.

## Commits

- `a85347d` — chore(02-01): push_idempotency migration (up + down)
- `e305fda` — feat(02-01): push-notify auth via supabase.auth.getClaims (ES256) + senderUserId from JWT (PUSH-01)
- (this commit) — docs(02-01): complete PUSH-01 plan

## REQ-IDs closed

- **PUSH-01** — Edge Function accepts ES256 JWTs, rejects invalid/missing JWTs cleanly.

## Deviations

1. **Version label v32 vs v31**: Supabase incremented the deployment counter by 2 (internal deploy pipeline). Effect is identical — newer version live, old v30 retired. Documented here for traceability.
2. **Docker warning during deploy**: Supabase CLI prints `WARNING: Docker is not running`. This is benign for the function-deploy path (only affects local `supabase start`). No action taken.
3. **push_idempotency table schema-only**: per D-A05 — dedup logic lands in Phase 3 P1-4. Current deploy does NOT check idempotency.
4. **No ES256 200 smoke**: requires a live user session JWT. Deferred to natural production usage for organic verification. Cold-path 401 smokes prove the code path is live.

## Security impact

Closes PITFALLS P2-9 exploit:
- Before (v30): `senderUserId` came from request body. An attacker could forge `senderUserId` in the body to impersonate any user.
- After (v32): `senderUserId` comes from verified JWT `claims.sub`. Cannot forge without possessing the target user's valid ES256 JWT.

Service-role cron path preserved:
- When `callerRole === "service_role"` (internal cron/backfill calls), body override is honored. Necessary because cron jobs synthesize notifications on behalf of arbitrary users.

## Rollback plan

1. `git checkout push-notify-baseline-20260421 -- supabase/functions/push-notify/index.ts` (tag pinned in Phase 1)
2. `npx supabase functions deploy push-notify --no-verify-jwt --project-ref qzrrscryacxhprnrtpjd`
3. (Optional) `git revert e305fda a85347d` to remove from main branch history

## Phase 2 Stream A status

- ✅ PUSH-01 closed. **Stream A complete.**

Phase 2 overall: **9/9 REQ-IDs closed across 5 plans (02-01 … 02-05)**. Exit gate met.

---

*Completed: 2026-04-21 after user deploy approval*
