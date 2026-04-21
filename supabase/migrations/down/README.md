# supabase/migrations/down/ — Rollback Migration Convention

Established: 2026-04-21 (Phase 1 — Migration Hygiene & Baseline, per D-03 / D-04).
Canonical source: `.planning/phases/01-migration-hygiene-baseline/01-CONTEXT.md`.

## Rule 1 — Up ↔ Down pairing (mandatory from 2026-04-21 forward)

For every new forward migration authored as:

```
supabase/migrations/YYYYMMDDHHMMSS_<name>.sql
```

the author MUST simultaneously ship a matching reverse migration at:

```
supabase/migrations/down/YYYYMMDDHHMMSS_<name>.sql
```

The **filename must match byte-for-byte** (same timestamp, same name, same
extension). The down file must reverse the up file with the exact inverse
DDL:

| Up operation | Down operation |
|--------------|----------------|
| `CREATE TABLE foo` | `DROP TABLE foo` |
| `ALTER TABLE foo ADD COLUMN bar` | `ALTER TABLE foo DROP COLUMN bar` |
| `CREATE POLICY p ON foo ...` | `DROP POLICY IF EXISTS p ON foo` |
| `ALTER PUBLICATION supabase_realtime ADD TABLE foo` | `ALTER PUBLICATION supabase_realtime DROP TABLE foo` |
| `CREATE INDEX idx_foo ON foo(bar)` | `DROP INDEX IF EXISTS idx_foo` |
| `CREATE OR REPLACE FUNCTION f()` | `DROP FUNCTION IF EXISTS f()` *(or restore prior `CREATE OR REPLACE FUNCTION f()` body)* |

Use `IF EXISTS` on every DROP in the down file so partial rollbacks do not
error out mid-script.

## Rule 2 — Transactional wrap (`BEGIN;` / `COMMIT;` / `ROLLBACK;`)

Every up and every down migration that contains **more than one DDL
statement** MUST wrap the body in:

```sql
BEGIN;

-- ... statements ...

COMMIT;
```

On exception during interactive application, issue `ROLLBACK;` to revert the
partial transaction. This is non-negotiable for:

- Any `DROP POLICY ... ; CREATE POLICY ...` sequence (there is otherwise
  a window where the table is fully open).
- Any `ALTER TABLE ... ADD COLUMN ...; UPDATE ... SET <col> = ...;` backfill
  (partial apply leaves NULLs that break subsequent statements).
- Any publication change with a companion `NOTIFY pgrst, 'reload schema';`
  (the NOTIFY must be inside the same transaction as the publication change).

Single-statement migrations (e.g., a lone `ALTER PUBLICATION ... ADD TABLE`)
do not strictly require the wrap, but wrapping them anyway is encouraged
for uniform readability.

## Rule 3 — Idempotency guards

Prefer `IF NOT EXISTS` on up operations and `IF EXISTS` on down operations
so repeated application on a Supabase branch does not error. Example:

```sql
ALTER TABLE public.memos
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
```

## Scope declaration — what this convention does NOT do

**Retroactive backfill of down files for the 15 existing up migrations
authored before 2026-04-21 is explicitly OUT OF SCOPE for Phase 1** (per
CONTEXT.md D-03). The following up-migrations currently have **no** paired
down file, and may remain unpaired until a specific rollback need arises:

- `20260313000000_push_tables.sql`
- `20260313000001_add_phone_columns.sql`
- `20260314000002_native_push_support.sql`
- `20260315135737_add_academy_schedule.sql`
- `20260315152655_memo_replies_setup.sql`
- `20260315152758_fix_memo_rls_for_child.sql`
- `20260317000000_audio_recording_tier.sql`
- `20260317100000_danger_zones_sticker_update.sql`
- `20260418000000_family_subscription.sql`
- `20260418000001_subscription_tier_cache.sql`
- `20260418000002_active_slot_columns.sql`
- `20260418000003_subscription_soft_lock.sql`
- `20260418000004_subscription_notifications.sql`
- `20260418000005_subscription_rls.sql`
- `20260418000006_saved_places.sql`

If a rollback of one of the above is ever needed, the author must write
the missing down file at that time and place it in this directory.

## Example (template for all future migrations)

**Up:** `supabase/migrations/20260422103000_example.sql`
```sql
BEGIN;
ALTER TABLE public.example ADD COLUMN IF NOT EXISTS extra_col text;
CREATE POLICY example_read ON public.example
  FOR SELECT USING (true);
COMMIT;
```

**Down:** `supabase/migrations/down/20260422103000_example.sql`
```sql
BEGIN;
DROP POLICY IF EXISTS example_read ON public.example;
ALTER TABLE public.example DROP COLUMN IF EXISTS extra_col;
COMMIT;
```

Note: DROP operations in the down file MUST appear in **reverse order** of
the up file — policies before the columns they reference, indexes before
the tables they index, etc.
