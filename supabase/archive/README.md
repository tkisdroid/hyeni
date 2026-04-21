# supabase/archive/

These SQL files are **DEPRECATED** and are **no longer applied by any tooling**.
They predate migration discipline and existed as ad-hoc patches run manually
against production before `supabase/migrations/YYYYMMDDHHMMSS_*.sql` became
the canonical source.

**Canonical schema source:** `supabase/migrations/`
**Do not run these files.** They are retained for `git log` / `grep` archaeology only.

Archived: 2026-04-21 (Phase 1 — Migration Hygiene & Baseline, per D-01/D-02).

Note on file count: CONTEXT.md D-01 listed 11 filename entries, one being the
`fix-rls*.sql` glob which expanded to 2 matching files (`fix-rls.sql` and
`fix-rls-v2.sql`), so the archive contains 12 files total. Glob expansion
handled per D-17 (executor discretion on archive layout).

## File summaries

| File | One-line summary |
|------|------------------|
| `_deprecated_add-phone-columns.sql` | Adds `mom_phone` and `dad_phone` text columns to the `families` table. |
| `_deprecated_add-write-policies.sql` | Declares INSERT/UPDATE/DELETE RLS policies for families, family_members, events, memos. |
| `_deprecated_child-locations.sql` | Creates `child_locations` table (one row per child, latest lat/lng) with RLS. |
| `_deprecated_fix-all-rls.sql` | Drops every `public` schema policy and recreates the full RLS set from scratch. |
| `_deprecated_fix-rls.sql` | Breaks infinite recursion in `family_members` SELECT policy (first attempt). |
| `_deprecated_fix-rls-v2.sql` | Second-pass circular-reference fix: `family_members` never references `families`. |
| `_deprecated_fix-sync-final.sql` | Idempotent RLS + realtime-publication reset plus `get_my_family_ids()` SECURITY DEFINER helper. |
| `_deprecated_migration.sql` | Original bootstrap: creates `families`, `family_members`, `events`, `memos`, `academies` tables. |
| `_deprecated_parent-pairing-fix.sql` | Baseline `join_family` RPC + SELECT policies for Kakao parent pairing flow (BEGIN/COMMIT wrapped). |
| `_deprecated_patch-existing-db.sql` | Incremental RLS patch for projects where `migration.sql` already ran. |
| `_deprecated_push-tables.sql` | Creates `push_subscriptions` and related tables, plus `update_updated_at()` trigger. |
| `_deprecated_stickers-and-geofence.sql` | Creates `stickers` table (with indexes, RLS, RPCs, grants) and geofence-related schema. |

## Why these are archived, not deleted

1. `git log --follow` must still reach them for audit reconstruction.
2. Phase 2 / Stream C (P0-3 pair code) may need to copy the existing
   `join_family` RPC baseline from `_deprecated_parent-pairing-fix.sql`
   into a tracked migration — per SUMMARY.md §Research Flags.
3. Regulatory / compliance traceability — PIPA retention requires
   provenance for any SQL that touched live family data.
