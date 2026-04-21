# Phase 2: Unblock Core - Discussion Log

> **Audit trail only.** Decisions captured in CONTEXT.md.

**Date:** 2026-04-21
**Phase:** 02-unblock-core-push-gateway-realtime-pair-security
**Mode:** `--auto` (YOLO — all decisions sourced from research outputs; single-pass, no interactive questions)

---

## Stream A — PUSH-01 (ES256 Fix)

| Option | Description | Selected |
|---|---|---|
| `supabase.auth.getClaims(jwt)` | Official 2026 pattern; `@supabase/supabase-js@2.99.1` includes it | ✓ |
| Deno `jose` library | 3rd-party JWT verifier | |
| Dashboard verify_jwt = true | Platform-side verification | |

**Rationale**: STACK.md §Issue #1 verified via Context7 + 2025-07-14 official blog. No new deps. Handles kid rotation transparently.

**Related decisions**:
- Keep `--no-verify-jwt` deploy flag (gateway still broken per supabase#42244/#41691)
- VAPID rotation FORBIDDEN (PITFALLS.md — existing push_subscriptions would 403)
- FCM v1 service-account JWT path unchanged
- Client-side `sendInstantPush` changes reserved for Phase 3 P1-4

---

## Stream B — RT-01..04 (Realtime Publications)

| Option | Description | Selected |
|---|---|---|
| `ALTER PUBLICATION ADD TABLE` + `REPLICA IDENTITY FULL` + `NOTIFY pgrst` + client reconnect | PITFALLS.md 4-step | ✓ |
| Recreate publication from scratch | Nuclear option, breaks existing subscribers | |

**Rationale**: `family_id` is non-PK filter on `saved_places` / `family_subscription` / `memo_replies`. Without `REPLICA IDENTITY FULL` the Realtime stream silently drops UPDATEs.

| Channel Strategy | Description | Selected |
|---|---|---|
| Per-table channels (`events-{familyId}`, `memos-{familyId}`, ...) | STACK.md §Issue #2 — prevents cross-binding cascade failure | ✓ |
| Keep monolithic `family-{familyId}` channel | Current state, proven failure mode (supabase-js #1917) | |

---

## Stream C — PAIR-01..04 (Pair Security)

| Option | Description | Selected |
|---|---|---|
| Nullable `pair_code_expires_at timestamptz` column | Grandfathers existing codes, TTL only on new generation | ✓ |
| CHECK constraint on pair_code | Rejects existing codes, breaks live family | |
| Separate TTL table | Adds join overhead | |

| RLS for child self-DELETE | Description | Selected |
|---|---|---|
| DROP + CREATE POLICY with `EXISTS parent` check wrapped in BEGIN/COMMIT | PITFALLS.md — prevents no-policy gap | ✓ |
| Revoke DELETE grant from anon role | Too coarse — breaks other tables | |

| "아이" Name Collision Handling | Description | Selected |
|---|---|---|
| Auto-suffix `"아이 2"`, `"아이 3"` on duplicate | Non-destructive, parent can rename | ✓ |
| Refuse new pair if `"아이"` exists | Breaks device-swap scenarios | |
| Overwrite existing | Current behavior, loses device attribution | |

---

## Claude's Discretion

- Migration filenames (`YYYYMMDDHHMMSS_*`)
- Exact UI styling of TTL countdown + zombie cleanup list (minimal change to existing PairingModal + settings section)
- `pg_get_functiondef` extraction format for `join_family` RPC baseline

---

## Deferred Ideas

- `push_idempotency` TTL cron job → Phase 3 P1-4
- Per-child rename UI → future polish
- Edge Function blue/green → Supabase-level limitation
- Realtime publication change live-detect on client → Phase 4/5 revisit
