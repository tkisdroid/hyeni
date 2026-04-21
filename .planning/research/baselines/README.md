# .planning/research/baselines/

Rollback anchors captured **before** any Phase 2+ work touches live data.

## Files in this directory (as of 2026-04-21)

| File | Captured | Purpose |
|------|----------|---------|
| `pg-policies-20260421.csv` | Phase 1, Plan 04 | Full-fidelity snapshot of prod `pg_policies` (60 rows across 22 tables) — rollback target for Phase 2 Stream C (PAIR-03 RLS changes). |
| `pg-policies-20260421.sql` | Phase 1, Plan 04 | Human-readable ORDER-BY rendering of the same data — use for `diff` / grep / review. |
| `env-metadata.md` | Phase 1, Plan 04 | PUBLIC environment metadata (VAPID public key + subject, FCM project_id, Supabase anon URL/key). Rollback anchor for Phase 2 Stream A (PUSH-01 ES256 redeploy). |
| `README.md` | Phase 1, Plan 04 | This file. |

## Git tag anchor

Phase 1 Plan 04 also creates the annotated git tag `push-notify-baseline-20260421`
on the current `main` HEAD (after the human checkpoint confirms zero secret leakage).
That tag is the canonical rollback target for Phase 2 Stream A. To verify:

```bash
git show push-notify-baseline-20260421
git ls-remote --tags origin push-notify-baseline-20260421
```

## Commit policy — what is allowed here

**Allowed**
- DDL dumps (RLS policies, schema, indexes) — on-disk schema, not secrets.
- Public environment identifiers (project refs, anon keys, VAPID public keys, FCM project_ids).
- Dashboard URL pointers ("see Supabase Dashboard → …").
- Annotated snapshots of observable system state.

**Forbidden — NEVER commit**
- `SUPABASE_SERVICE_ROLE_KEY` (legacy JWT with `role=service_role` or new-format `sb_secret_*`)
- `VAPID_PRIVATE_KEY` (or any ECDSA P-256 private key / PEM block)
- `FCM_SERVICE_ACCOUNT_JSON` / `FCM_PRIVATE_KEY`
- `KAKAO_CLIENT_SECRET`, `QONVERSION_API_KEY`, or any OAuth / IAP server-side secret
- Postgres connection strings containing passwords (`postgresql://user:password@host:5432/db`)
- Production family IDs, user IDs, or any PII (the live prod family UUID is documented in STATE.md / CLAUDE.md only — never mirror it into this directory)
- Any value stored in Supabase Edge Function secrets or Vercel env vars marked "secret"
- `SUPABASE_ACCESS_TOKEN` (`sbp_*`) — personal access token, not project-scoped

If you are uncertain whether a value is public, err on the side of recording only
the KEY NAME under the Forbidden list and omitting the value entirely.

## Pre-commit secret scan (run before any `git add` in this directory)

```bash
# No JWTs or PEM blocks
grep -rE 'eyJ[A-Za-z0-9_-]{100,}|-----BEGIN' .planning/research/baselines/
# No assignment-style private keys
grep -rE '^(VAPID_PRIVATE_KEY|SUPABASE_SERVICE_ROLE_KEY|FCM_PRIVATE_KEY) *[:=]' .planning/research/baselines/
# No postgres creds
grep -rE 'postgres(ql)?://[^:]+:[^@]+@' .planning/research/baselines/
# No live family UUID (see STATE.md for the literal value to grep for)
# grep -r '<prod-family-uuid-from-STATE.md>' .planning/research/baselines/
# No Supabase access tokens
grep -rE 'sbp_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9]{5,}' .planning/research/baselines/
```

The only JWT that should match is the **public anon key** in `env-metadata.md`
(decoded payload `role=anon`). All other grep commands should return zero matches.

## Adding new baselines later

Future baselines follow the same naming convention: `<artifact-name>-YYYYMMDD.<ext>`.
Every new baseline file MUST be appended to the table above with capture date and
purpose. If a baseline is ever ROTATED (e.g., the VAPID keypair is regenerated
in v1.1), the old file MUST remain — history is immutable — and a new dated file
is added alongside with a new corresponding git tag
(`push-notify-baseline-YYYYMMDDb` or similar).

## Why this directory exists

See `.planning/phases/01-migration-hygiene-baseline/01-CONTEXT.md` §D-08, §D-09,
§D-10 for the original decision record, and `.planning/research/SUMMARY.md`
§"Implications for Roadmap" §Pre-Phase 0 for the source spec.
