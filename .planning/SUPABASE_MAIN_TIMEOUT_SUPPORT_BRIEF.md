# Supabase Main Timeout Support Brief

작성 시각: 2026-05-05 KST

## Current Status

Resolved as of 2026-05-05 KST. The brief below is retained as historical blocker evidence; no Supabase support ticket or live project restart is currently required.

Latest recovery evidence:

- `output/production-stabilization-healthcheck-2026-05-05T01-26-40-087Z.json`: `readyForAndroidSmoke=true`, `diagnosticSummary.boundary=service-ready`.
- `output/supabase-recovery-verification-2026-05-05T01-25-00-901Z.json`: local gates passed.
- `output/supabase-recovery-verification-2026-05-05T01-26-36-981Z.json`: real Supabase Playwright 39 passed.
- `output/supabase-recovery-verification-2026-05-05T01-31-21-686Z.json`: main Android remote-listen smoke passed.
- `output/supabase-recovery-verification-2026-05-05T01-33-09-348Z.json`: main Android matrix passed.

Main RLS correction:

- `supabase/migrations/20260504010000_restrict_family_insert_to_parent_auth_providers.sql` was applied to main after snapshot `output/pg-policies-families-before-20260504010000-2026-05-05T01-13-04-454Z.json`.
- `supabase migration repair 20260504010000 --status applied --linked --yes` completed; migration list shows `20260504010000 | 20260504010000`.

## Historical Summary

Hyeni Calendar production main project `qzrrscryacxhprnrtpjd` is not ready for production Android remote-listen E2E because Supabase API key/DB-dependent paths time out. Auth/REST gateway-only checks and the Realtime gateway still respond quickly, which separates this from a local network, DNS, TLS, or key mismatch issue.

Latest local healthcheck classifies the boundary as:

```text
api-key-db-dependent-path-timeout
```

Do not run production Android remote-listen smoke until `scripts/production-stabilization-healthcheck.mjs` reports `readyForAndroidSmoke=true`.

## Support Bundle

A non-secret support bundle has been prepared for operator upload:

- Path: `output/supabase-main-timeout-support-bundle-2026-05-04T23-53-09-941Z.zip`
- SHA256 sidecar: `output/supabase-main-timeout-support-bundle-2026-05-04T23-53-09-941Z.zip.sha256`
- Rebuild command: `npm run support:bundle`
- Bundle builder behavior: automatically includes the newest healthcheck, recovery runner, status summary, Android readiness, and remote-listen matrix evidence under `output/`.
- Manifest inside zip: `support-bundle-manifest.json`
- Expected manifest counts after current evidence inclusion: `sourceFileCount=15`, `bundleEntryCount=16`
- Contents:
  - `.planning/SUPABASE_MAIN_TIMEOUT_SUPPORT_BRIEF.md`
  - `.planning/PRODUCTION_STABILIZATION_AUDIT_CURRENT.md`
  - `.planning/PRODUCTION_STABILIZATION_COMPLETION_CHECKLIST.md`
  - `.planning/SUPABASE_RECOVERY_VERIFICATION_RUNBOOK.md`
  - `package.json`
  - `scripts/production-stabilization-healthcheck.mjs`
  - `scripts/supabase-recovery-verification.mjs`
  - `scripts/build-supabase-support-bundle.mjs`
  - `output/production-stabilization-healthcheck-2026-05-04T23-53-09-941Z.json`
  - `output/production-stabilization-healthcheck-2026-05-04T23-53-09-941Z.md`
  - `output/supabase-recovery-verification-2026-05-04T23-52-31-469Z.json`
  - `output/supabase-status-summary-2026-05-04T23-08-09-002Z.json`
  - `output/android-parent-ui-remote-listen-readiness-2026-05-04T22-27-05-059Z.json`
  - `output/remote-listen-matrix-2026-05-04T23-45-27-574Z-locked-screen-off-channel-ok.json`
  - `output/remote-listen-matrix-2026-05-04T23-45-27-574Z-locked-screen-off-channel-ok.md`
  - `support-bundle-manifest.json`

## Project

- Supabase project ref: `qzrrscryacxhprnrtpjd`
- Region observed from Supabase CLI: `ap-northeast-2`
- Production URL in app env: `https://qzrrscryacxhprnrtpjd.supabase.co`
- Live production data exists. Any restart, support action, or destructive DB operation requires operator approval.

## Latest Reproduction

Command:

```bash
node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000
```

Evidence files:

- `output/production-stabilization-healthcheck-2026-05-04T23-53-09-941Z.json`
- `output/production-stabilization-healthcheck-2026-05-04T23-53-09-941Z.md`
- `output/supabase-recovery-verification-2026-05-04T23-52-31-469Z.json`

Observed result:

- `readyForAndroidSmoke=false`
- `diagnosticSummary.boundary=api-key-db-dependent-path-timeout`
- keys match project ref:
  - anon key ref matches URL: `true`
  - service role key ref matches URL: `true`
- non-critical probes responding:
  - `auth-gateway-no-key`: HTTP 401 in 94ms
  - `rest-gateway-no-key`: HTTP 401 in 41ms
  - `realtime-gateway`: HTTP 403 in 2261ms
- critical probes timing out:
  - `auth-health`: `AbortError` after 12013ms
  - `rest-family-members-service`: `AbortError` after 12001ms
  - `push-notify-reachable`: `AbortError` after 12013ms

## Additional Evidence

Supabase DB network restrictions:

```bash
npx supabase network-restrictions get --project-ref qzrrscryacxhprnrtpjd -o json --experimental
```

Observed:

- DB Allowed IPv4 CIDRs: `0.0.0.0/0`
- DB Allowed IPv6 CIDRs: `::/0`
- restrictions applied: `true`

Postgres pooler TCP reachability:

```powershell
Test-NetConnection aws-1-ap-northeast-2.pooler.supabase.com -Port 6543
```

Observed:

- `TcpTestSucceeded=True`

Supabase inspect queries:

```bash
npx supabase inspect db blocking --linked -o json
npx supabase inspect db long-running-queries --linked -o json
```

Observed:

```text
failed to connect to postgres: failed to connect to `host=aws-1-ap-northeast-2.pooler.supabase.com user=postgres.qzrrscryacxhprnrtpjd database=postgres`: failed to receive message (timeout: context deadline exceeded)
```

Management metadata:

- `npx supabase projects list -o json` reports main project status `ACTIVE_HEALTHY`.
- `npx supabase functions list --project-ref qzrrscryacxhprnrtpjd -o json` reports `push-notify` active and recently deployed.
- Latest `npx supabase functions list --project-ref qzrrscryacxhprnrtpjd -o json` read succeeded and reports `push-notify` as `ACTIVE`, `verify_jwt=false`, `version=61`, `updated_at=1777933644544`.
- Latest experimental `npx supabase network-bans get --project-ref qzrrscryacxhprnrtpjd -o json --experimental` did not return ban data; it failed with `unexpected list bans status 522: error code: 522`.
- Latest experimental `npx supabase ssl-enforcement get --project-ref qzrrscryacxhprnrtpjd -o json --experimental` failed with HTTP 500 body `{"message":"failed to read ssl config status","errorEventId":"d8ad675f42174d86bd2df55e7c04cd4a"}`.

Official Supabase status API:

- Source endpoints:
  - `https://status.supabase.com/api/v2/status.json`
  - `https://status.supabase.com/api/v2/summary.json`
  - `https://status.supabase.com/api/v2/incidents/unresolved.json`
- Evidence file: `output/supabase-status-summary-2026-05-04T23-08-09-002Z.json`
- `status.indicator=none`, `status.description=All Systems Operational`
- `unresolvedIncidentCount=0`
- Relevant components report `operational`: API Gateway, ap-northeast-2, Auth, Connection Pooler, Database, Edge Functions, Management API, Realtime, Storage.
- This reinforces that the blocker is not currently explained by a published global incident.

## Known Good Comparison

With-data preview branch `cryodcviqyyxxovclqou`:

- Auth/REST reachable.
- `push-notify` deployed with VAPID guard.
- Branch remote-listen pending fallback Android E2E passed:
  - `output/android-parent-ui-remote-listen-2026-05-04T22-23-15-139Z.log`
  - result: `success=true`, `sawActivity=true`, `sawService=true`

The branch does not have production-equivalent FCM/VAPID secrets, so it cannot fully replace main production FCM path verification.

## Impact

The following explicit production stabilization requirements remain blocked:

- main Supabase RLS/DB-level isolation verification
- main real-service Playwright suite
- main Android parent/child remote-listen E2E
- main FCM remote-listen delivery path
- main Storage/profile image failure-mode verification
- production location upload/realtime validation

## Requested Operator Action

Choose one approved production action:

1. Open a Supabase support ticket with this brief and the latest healthcheck files.
2. Approve a live project restart if Supabase dashboard/support recommends it.
3. Provide access to project logs or dashboard diagnostics that can show why key-authenticated Auth/REST/Function requests and pooler queries time out while gateway-only probes respond.

After action, rerun:

```bash
node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000
```

Proceed only if:

```text
readyForAndroidSmoke=true
```

## Copy-Ready Support Ticket

Title:

```text
Production project qzrrscryacxhprnrtpjd: key-authenticated Auth/REST/Function and pooler queries time out while gateway-only probes respond
```

Body:

```text
Project ref: qzrrscryacxhprnrtpjd
Region: ap-northeast-2
Production URL: https://qzrrscryacxhprnrtpjd.supabase.co

We are blocked from production Android E2E verification because Supabase API key/DB-dependent paths time out.

Latest local healthcheck:
- Command: node scripts/production-stabilization-healthcheck.mjs --timeout-ms 12000
- Evidence files:
  - output/production-stabilization-healthcheck-2026-05-04T23-53-09-941Z.json
  - output/production-stabilization-healthcheck-2026-05-04T23-53-09-941Z.md
  - output/supabase-recovery-verification-2026-05-04T23-52-31-469Z.json
- readyForAndroidSmoke=false
- diagnosticSummary.boundary=api-key-db-dependent-path-timeout
- anon/service JWT refs match qzrrscryacxhprnrtpjd

Responding quickly:
- auth-gateway-no-key: HTTP 401 in 94ms
- rest-gateway-no-key: HTTP 401 in 41ms
- realtime-gateway: HTTP 403 in 2261ms

Timing out:
- auth-health with anon apikey: AbortError after 12013ms
- REST family_members probe with service role key: AbortError after 12001ms
- push-notify Edge Function with anon apikey/JWT: AbortError after 12013ms

Postgres pooler evidence:
- Test-NetConnection aws-1-ap-northeast-2.pooler.supabase.com -Port 6543 => TcpTestSucceeded=True
- supabase inspect db blocking --linked -o json => failed to receive message (timeout: context deadline exceeded)
- supabase inspect db long-running-queries --linked -o json => failed to receive message (timeout: context deadline exceeded)

Management API evidence:
- projects list reports ACTIVE_HEALTHY
- functions list succeeds; push-notify is ACTIVE, verify_jwt=false, version=61
- network restrictions allow 0.0.0.0/0 and ::/0
- network-bans get failed with status 522
- ssl-enforcement get failed with HTTP 500 and errorEventId d8ad675f42174d86bd2df55e7c04cd4a

Official status page evidence:
- status.indicator=none / All Systems Operational
- unresolved incidents: 0
- API Gateway, ap-northeast-2, Auth, Connection Pooler, Database, Edge Functions, Management API, Realtime and Storage all report operational

Known-good comparison:
- Preview branch cryodcviqyyxxovclqou has reachable Auth/REST and branch Android pending fallback E2E passed.

Please investigate why key-authenticated Auth/REST/Function paths and pooler queries time out while gateway-only probes respond. We need either the underlying service restored or guidance on whether a live project restart is required.
```
