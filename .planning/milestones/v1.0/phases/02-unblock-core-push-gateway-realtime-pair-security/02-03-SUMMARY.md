---
phase: 02-unblock-core-push-gateway-realtime-pair-security
plan: 03
subsystem: supabase-sql
tags: [sql, migration, pair-code, ttl, join-family-rpc, regenerate-pair-code, security-definer, stream-c]
requirements: [PAIR-01, PAIR-02]
dependency_graph:
  requires: [01-05]  # Phase 1 migration hygiene baseline (down/ dir, env metadata, git tag)
  provides:
    - "families.pair_code_expires_at (nullable timestamptz)"
    - "join_family RPC with TTL + name-suffix collision loop"
    - "regenerate_pair_code(uuid) RPC (SECURITY DEFINER, parent-only, 48h TTL)"
  affects:
    - 02-04  # RLS tightening depends on pair_code_expires_at being in place
    - 02-05  # Parent UI wires pair_code_expires_at + regenerate_pair_code RPC
tech_stack:
  added: []  # pure SQL — no new libraries
  patterns:
    - "Nullable timestamptz column for grandfathered TTL (avoids CHECK constraint)"
    - "Function-body TTL enforcement (PITFALLS §Pitfall 3.3)"
    - "SECURITY DEFINER + SET search_path = public on new RPCs"
    - "Byte-accurate down migration via pg_get_functiondef baseline capture"
    - "Supabase CLI db query --linked as MCP fallback (Phase 1 precedent)"
key_files:
  created:
    - supabase/migrations/20260421095748_pair_code_ttl_and_rotation.sql
    - supabase/migrations/down/20260421095748_pair_code_ttl_and_rotation.sql
    - .planning/phases/02-unblock-core-push-gateway-realtime-pair-security/join_family-baseline.sql
  modified: []
decisions:
  - "Branch-skipped: applied directly to prod via supabase db query --linked (same philosophy as Phase 1 Plan 01-05 MCP apply, since MCP tools weren't available in this executor agent context)"
  - "Preserved upper(trim(p_pair_code)) normalization from prod baseline (drift vs archived reference: archive used raw p_pair_code)"
  - "Suffix collision uses 'name || \" \" || counter' (space-separated) matching CONTEXT.md D-C06 alternative option"
  - "regenerate_pair_code dual-path parent check: families.parent_id OR family_members.role='parent' (covers both original-parent and second-parent scenarios from joinFamilyAsParent)"
metrics:
  duration_minutes: 7
  completed_at: "2026-04-21T10:04:18Z"
---

# Phase 2 Plan 03: Pair Code TTL + Rotation Summary

**Pair code TTL (48h) + parent-only rotation RPC + slot-squat prevention via name-suffix collision, applied to prod with byte-accurate rollback path — zero existing pair codes invalidated (all 67 families grandfathered).**

## Delivered

- **`families.pair_code_expires_at timestamptz`** column added, NULLABLE, no default, no CHECK constraint
- **`join_family(text, uuid, text)`** RPC rewritten:
  - Preserves existing 10-per-hour rate limit (pair_attempts)
  - Preserves existing `upper(trim())` pair code normalization
  - Adds TTL check: raises `'만료된 연동 코드예요. 부모님께 새 코드를 받아 주세요'` if `pair_code_expires_at IS NOT NULL AND < now()`
  - NULL expires_at short-circuits TTL gate (grandfathered codes remain infinitely valid)
  - Adds name-suffix collision loop (D-C06): if `(family_id, name, role='child')` is already claimed by a different `user_id`, suffix with `' 2'`, `' 3'`, etc. until unique
  - Preserves `ON CONFLICT (family_id, user_id) DO UPDATE SET name = EXCLUDED.name` for same-user re-pairing (device swap)
- **`regenerate_pair_code(uuid)`** RPC created:
  - SECURITY DEFINER, parent-only
  - Auth check: `auth.uid()` matches `families.parent_id` OR `family_members.role='parent'` for the target family
  - Generates `'KID-' || upper(substring(gen_random_uuid()::text, 1, 8))`
  - Sets `pair_code_expires_at = now() + interval '48 hours'`
  - Returns `(pair_code text, pair_code_expires_at timestamptz)` table
- Paired down migration embeds the prod-captured pre-Phase-2 `join_family` definition byte-exactly

## Pre-Phase-2 join_family baseline (authoritative rollback reference)

Extracted from prod via `SELECT pg_get_functiondef('public.join_family(text,uuid,text)'::regprocedure);` on 2026-04-21 09:57 UTC. Full text preserved at `.planning/phases/02-unblock-core-push-gateway-realtime-pair-security/join_family-baseline.sql`.

Drift vs archived `supabase/archive/_deprecated_fix-sync-final.sql:248-276`:
1. Production uses `upper(trim(p_pair_code))` in WHERE clause (archive used raw `p_pair_code`)
2. Production has `SET search_path TO 'public'` on the function (archive had no explicit search_path)
3. Production uses `DO UPDATE SET name = EXCLUDED.name` (archive used `DO UPDATE SET name = p_name`)

All three are safe refinements (no behavioral regression). The authoritative rollback anchor is the prod-captured definition embedded in the down migration.

## Post-apply MCP verification

### Column added (NULLABLE, grandfathered rows)

```
column_name: pair_code_expires_at
data_type: timestamp with time zone
is_nullable: YES
```

Row counts on prod `families` table immediately post-apply:

```
total_families: 67
grandfathered_null: 67   (100% — no pair code invalidated)
has_ttl: 0
```

### Both RPCs SECURITY DEFINER

```
proname: join_family          prosecdef: true
proname: regenerate_pair_code prosecdef: true
```

### join_family body markers

`pg_get_functiondef('public.join_family(text,uuid,text)'::regprocedure)` output contains:
- `pair_code_expires_at` (TTL column read)
- `만료된 연동 코드예요. 부모님께 새 코드를 받아 주세요` (Korean TTL exception)
- `WHILE v_existing_user IS NOT NULL AND v_existing_user <> p_user_id LOOP` (suffix collision loop)
- `upper(trim(p_pair_code))` (baseline normalization preserved)

## Behavior smoke results (MCP execute_sql via `supabase db query --linked`)

All 5 smokes run against prod with test data cleaned up inside the same transaction block.

| # | Smoke | Captured detail | Verdict |
|---|-------|-----------------|---------|
| 1 | Column + prosecdef + body markers | `is_nullable=YES`, both RPCs `prosecdef=true`, body contains TTL markers | **PASS** |
| 2 | TTL exception on expired code | `만료된 연동 코드예요. 부모님께 새 코드를 받아 주세요` | **PASS** |
| 3 | Grandfathered NULL skips TTL gate | `TTL gate skipped on NULL; control flow reached FK insert step` (exception is `family_members_user_id_fkey`, NOT the Korean TTL exception) | **PASS** |
| 4 | Name-suffix collision (`아이` + `아이` from two distinct users) | `아이\|아이 2` | **PASS** |
| 5 | regenerate_pair_code rejects non-parent (service-role caller) | `부모 계정만 연동 코드를 재생성할 수 있어요` | **PASS** |

Post-smoke cleanup verification:
```
leftover_p2_families: 0
leftover_p2_members: 0
recent_test_auth_users: 0
```

## Deviations from Plan

### Applied Rule 3 — CHECK regex false-positive in verification gate

**Found during:** Task 1 verification gate run.
**Issue:** The plan's verification regex `grep -qiE "CHECK\s*\("` false-matched on a code comment `-- Parent-only caller check (D-C03)` (the words `check (D-C03)` match `check\s*\(`).
**Fix:** Rephrased the comment to `-- Parent-only caller verification per D-C03` — preserves intent, passes the gate. No SQL logic changed.
**Files modified:** `supabase/migrations/20260421095748_pair_code_ttl_and_rotation.sql` (one line comment rephrasing).

### MCP direct-apply → Supabase CLI `db query --linked`

**Original plan:** Use `mcp__claude_ai_Supabase__apply_migration` / `mcp__claude_ai_Supabase__execute_sql` (Phase 1 01-05 precedent).
**Applied:** `npx supabase db query --linked --file <migration.sql>` for both the apply step and all 5 verification/smoke queries.
**Rationale:** MCP tools (`mcp__claude_ai_Supabase__*`) are not exposed to this executor agent's function set. The Supabase CLI path is functionally equivalent (same REST over PgBouncer endpoint, same service-role credentials from `SUPABASE_ACCESS_TOKEN`) and already validated by Phase 1 Plan 01-03 as a fallback. No SQL content changed. The on-disk migration file retains the `BEGIN; ... COMMIT;` wrapper for CLI replay compatibility.
**Evidence:** CLI JSON output boundaries captured inline above.

### Smoke 3 implementation variant

**Original plan:** Use a real auth.users user_id for `p_user_id` to exercise the full happy path.
**Applied:** Used `gen_random_uuid()` for `p_user_id` (triggers FK violation on `family_members_user_id_fkey`).
**Rationale:** The goal of Smoke 3 is to prove the TTL gate skips on NULL `pair_code_expires_at`. Exercising control flow past the gate (to the FK violation) is sufficient proof. Using a real `auth.users` row would have created/updated a live `family_members` entry for a real user account — unacceptable side effect on production data.
**Outcome:** Smoke 3 captured exception `family_members_user_id_fkey` (expected for fake uuid) instead of `만료된` (what would fire if TTL gate misbehaved). Pass condition met without touching real user data.

## Known Stubs

None. All deliverables are functional, not placeholders.

## Out-of-scope flags

**threat_flag** scan: no new security surface introduced beyond the plan's `<threat_model>` register (T-02-16 through T-02-22 are covered). The new `regenerate_pair_code` RPC is the only new callable surface; its SECURITY DEFINER + parent-only authz was verified in Smoke 5.

## REQ-ID Status

- **PAIR-01** (pair code TTL + parent rotation) — **SQL side complete**. UI wiring pending in Plan 02-05 (TTL countdown display + "새로고침" button → `regenerate_pair_code` RPC call).
- **PAIR-02** (slot-squat prevention) — **Complete**. New anon session requesting the same name as an existing child in the family gets a numeric suffix (`아이 2`, `아이 3`, etc.) instead of overwriting.

## Ready-for

- **Plan 02-04** (Stream C Wave 2 — RLS tightening for `family_members` DELETE → PAIR-03). Depends on this plan only for sequencing discipline (column + RPC exist so RLS changes land on a complete schema).
- **Plan 02-05** (Stream C Wave 2 — Parent UI for PAIR-01 TTL countdown + regenerate + PAIR-04 zombie cleanup). Depends on this plan for the column and `regenerate_pair_code` RPC.

## Rollback

If behavior issues surface post-deploy:
1. Apply `supabase/migrations/down/20260421095748_pair_code_ttl_and_rotation.sql` via `supabase db query --linked --file <that file>` — single transaction, restores byte-accurate pre-Phase-2 `join_family`, drops `regenerate_pair_code`, drops `pair_code_expires_at` column. Data loss: any non-NULL `pair_code_expires_at` values; pair codes themselves remain valid (parent can rotate manually if needed).
2. No client code referenced these changes yet (Plan 02-05 not run), so no client-side rollback needed.

## Self-Check: PASSED

Files on disk (verified with `ls`):
- FOUND: `supabase/migrations/20260421095748_pair_code_ttl_and_rotation.sql`
- FOUND: `supabase/migrations/down/20260421095748_pair_code_ttl_and_rotation.sql`
- FOUND: `.planning/phases/02-unblock-core-push-gateway-realtime-pair-security/join_family-baseline.sql`

Commit hash:
- FOUND: `ad71377` (feat(02-03): apply pair_code TTL + rotation migration (PAIR-01, PAIR-02))

Production state:
- FOUND: `families.pair_code_expires_at` column (data_type `timestamp with time zone`, is_nullable `YES`)
- FOUND: `pg_proc.join_family` with `prosecdef=true` and body containing TTL + suffix markers
- FOUND: `pg_proc.regenerate_pair_code` with `prosecdef=true`
- FOUND: 0 leftover `KID-P2*` test families (all smokes cleaned up)
