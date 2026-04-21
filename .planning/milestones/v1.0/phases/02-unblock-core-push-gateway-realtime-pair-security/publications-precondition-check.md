# Phase 2-02 Task 1 — Publications Precondition Check

**Date:** 2026-04-21
**Tool:** `npx supabase db query --linked` (MCP Supabase tools unavailable in executor agent; CLI fallback per Plan 02-03 / 02-04 precedent)
**Project:** `qzrrscryacxhprnrtpjd`

## Step 1 — schema_migrations membership

```sql
SELECT version FROM supabase_migrations.schema_migrations
 WHERE version IN ('20260418000000','20260418000001','20260418000002','20260418000003',
                   '20260418000004','20260418000005','20260418000006','20260315152655');
```

| Version | File | Status |
|---------|------|--------|
| 20260315152655 | memo_replies_setup.sql | **APPLIED** |
| 20260418000000 | family_subscription.sql | NOT_APPLIED |
| 20260418000001 | subscription_tier_cache.sql | NOT_APPLIED |
| 20260418000002 | active_slot_columns.sql | NOT_APPLIED |
| 20260418000003 | subscription_soft_lock.sql | NOT_APPLIED |
| 20260418000004 | subscription_notifications.sql | NOT_APPLIED |
| 20260418000005 | subscription_rls.sql | NOT_APPLIED |
| 20260418000006 | saved_places.sql | NOT_APPLIED |

## Step 2 — target tables existence

```sql
SELECT tablename FROM pg_tables
 WHERE schemaname='public'
   AND tablename IN ('saved_places','family_subscription','memo_replies');
```

Result: only `memo_replies` present. `saved_places` and `family_subscription` missing.

## Step 3 — function dependency probe

```sql
SELECT proname FROM pg_proc
 WHERE proname IN ('family_subscription_effective_tier','get_my_family_ids');
```

Result: only `get_my_family_ids` present. `family_subscription_effective_tier` missing.

Confirmation that `CREATE POLICY` eagerly validates function references:
```
ERROR: 42883: function nonexistent_function_xyz(uuid) does not exist
```
(Verified on live db via `CREATE POLICY ... WITH CHECK (nonexistent_function_xyz(...))` — fails at creation, not at INSERT-time.)

## Step 4 — subscription-chain column probe

```sql
SELECT table_name, column_name FROM information_schema.columns
 WHERE table_schema='public'
   AND ((table_name='families' AND column_name IN ('subscription_tier','user_tier'))
     OR (table_name='family_members' AND column_name='active_slot')
     OR (table_name='danger_zones' AND column_name='active_slot')
     OR (table_name='academies' AND column_name='notifications_suppressed'));
```

Result: only `families.user_tier` present. Entire 20260418000001..05 chain unapplied.

## Step 5 — families.user_tier distribution

```sql
SELECT user_tier, COUNT(*) FROM families GROUP BY user_tier;
```

| user_tier | count |
|-----------|-------|
| free | 67 |

All 67 families are `free`. No premium tier conflicts.

## Deviation from plan — Rule 3 auto-fix (blocking)

**Plan assumption** (Task 1 Steps 3-4): apply `20260418000000_family_subscription.sql` and `20260418000006_saved_places.sql` standalone. Plan author assumed 20260418000001-05 chain was already applied.

**Reality:** full 20260418000001..05 chain absent on production. Migration `20260418000006_saved_places.sql` references `family_subscription_effective_tier()` in its `sp_insert_parent` policy. Postgres eagerly validates the function reference at `CREATE POLICY` time (empirically confirmed above) — so 000006 will fail without 000001 applied.

**Minimal chain required to satisfy Plan 02-02 (publication + REPLICA IDENTITY on 3 tables):**
- `20260418000000_family_subscription.sql` — creates `family_subscription` table; policies reference only `family_members`/`families`, no external functions. Safe.
- `20260418000001_subscription_tier_cache.sql` — defines `family_subscription_effective_tier()` function (prerequisite for 000006). Adds `families.subscription_tier` column with DEFAULT 'free' + CHECK (free/premium). Triggers fire only on `UPDATE OF user_tier/subscription_tier` — no behavioral change until a row is actually updated. Safe for 67 all-free families.
- `20260418000006_saved_places.sql` — creates `saved_places` table + RLS policies.

**NOT applied (out of Phase 2 Stream B scope — explicit behavior changes):**
- `000002` active_slot columns — adds columns + indexes to `family_members`/`danger_zones`. Low-risk but unnecessary for Stream B.
- `000003` soft_lock triggers — recompute active_slot when subscription flips; behavioral.
- `000004` academies notifications_suppressed — flips on subscription state; behavioral.
- `000005` subscription RLS tightening — **breaks existing academies INSERT for non-premium families**. Major behavior change. Would require its own plan + verification.

These five migrations are deferred to a future subscription-activation plan (Phase 2/3 Qonversion work, outside this plan's boundary).

## Rationale — why 000001 is Rule 3 and not Rule 4

- Plan 02-02 explicit scope: "publication + REPLICA IDENTITY + per-table channel refactor". Tables must exist for publication ADD.
- Plan Task 1 Step 3/4 explicitly directs apply of 000000 + 000006 via MCP.
- 000006 cannot be applied without 000001 (hard Postgres error at CREATE POLICY).
- 000001 is minimum required to close the gap; 000002-05 are NOT.
- Data impact on 67 all-free families: zero (all rows backfill to `subscription_tier='free'`).
- Triggers in 000001 fire only on UPDATE — no immediate behavior change.

Classified as Rule 3 (blocking) not Rule 4 (architectural) because:
- It does not introduce new abstractions, tables, or service layers.
- It is the minimum unblock to complete the task the plan explicitly authored.
- The 5 skipped migrations (000002-05) WOULD be Rule 4 — and are correctly deferred.

## Result

Applied chain: **20260418000000 → 20260418000001 → 20260418000006** (plus plan-authored `enable_realtime_publications` migration in Task 2).

Applied via `npx supabase db query --linked --file <path>` (per file) — each returned `[]` (success, 0 rows).

Registered in `supabase_migrations.schema_migrations`:

```
version
20260418000000
20260418000001
20260418000006
```

Post-apply verification:

```sql
SELECT tablename FROM pg_tables WHERE schemaname='public'
 AND tablename IN ('saved_places','family_subscription','memo_replies');
```

| tablename |
|-----------|
| family_subscription |
| memo_replies |
| saved_places |

```sql
SELECT proname FROM pg_proc WHERE proname='family_subscription_effective_tier';
```

| proname |
|---------|
| family_subscription_effective_tier |

All three target tables present. Ready for Task 2 (publication ADD + REPLICA IDENTITY FULL).

See `02-02-SUMMARY.md` for post-Task-2 verification (pg_publication_tables + pg_class relreplident).
