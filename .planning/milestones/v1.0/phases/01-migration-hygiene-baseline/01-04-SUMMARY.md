---
phase: 01-migration-hygiene-baseline
plan: 04
subsystem: infra
tags: [baseline, snapshot, pg-policies, vapid, fcm, git-tag, rollback-anchor, supabase, edge-function]

# Dependency graph
requires:
  - phase: 01-migration-hygiene-baseline (plans 01-01, 01-02)
    provides: archived loose SQL + down/ convention — this plan adds the *data* counterpart (snapshot of what prod currently looks like) to complement the *process* counterpart (how to roll back safely)
provides:
  - Full prod `pg_policies` snapshot (60 rows / 22 tables) as CSV + ordered DDL rendering
  - Public env-metadata.md with VAPID public key, FCM project_id, Supabase anon key (zero secrets)
  - README.md manifest with commit policy (Allowed vs Forbidden) and pre-commit grep recipes
  - Annotated git tag `push-notify-baseline-20260421` on main (local; push pending orchestrator checkpoint approval)
affects: [phase-02-unblock-core, phase-02-stream-a-push-notify, phase-02-stream-c-pair-03-rls, v1.1-vapid-rotation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rollback-anchor triad: schema snapshot (pg_policies CSV) + deployment snapshot (env-metadata) + commit anchor (git tag)"
    - "Pre-commit secret scan recipes co-located with artifacts (README.md §Pre-commit secret scan)"
    - "`supabase db query --linked --output csv` as read-only dump path for system views (works where `db dump` refuses pg_catalog views)"

key-files:
  created:
    - .planning/research/baselines/pg-policies-20260421.csv
    - .planning/research/baselines/pg-policies-20260421.sql
    - .planning/research/baselines/env-metadata.md
    - .planning/research/baselines/README.md
  modified: []

key-decisions:
  - "Used `supabase db query --linked --output csv` instead of psql (psql not installed on Windows host) — produced clean CSV with no credential leakage"
  - "Included both legacy anon JWT and new-format `sb_publishable_*` anon key in env-metadata.md — both are client-bundled / public by design"
  - "VAPID keypair NOT rotated; only public half recorded (RFC 8292 §3.2 + SUMMARY.md Stack Decisions)"
  - "Git tag created LOCALLY; push deferred to orchestrator after human checkpoint approval (per plan 01-04 task-4 gate + sequential-executor directive)"

patterns-established:
  - "Baseline file naming: `<artifact>-YYYYMMDD.<ext>` — append new, never overwrite (rotation → `YYYYMMDDb` suffix)"
  - "Single JWT allowed in baselines: the public anon JWT (verify via base64url-decode → role=anon)"
  - "Any `DO NOT COMMIT` sentinel counts as a forbidden-field declaration — 12 sentinels in env-metadata.md cover VAPID private, FCM service-account, service-role keys, Kakao/Qonversion secrets, etc."

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-04-21
---

# Phase 01 Plan 04: Baseline Snapshots & Rollback Tag Summary

**Captured prod `pg_policies` (60 rows/22 tables) + public env metadata + annotated git tag `push-notify-baseline-20260421` as triad rollback anchor for Phase 2 Stream A/C.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-21T06:27:45Z
- **Completed:** 2026-04-21T06:36:12Z
- **Tasks:** 4 auto + 1 checkpoint (git tag push deferred to orchestrator)
- **Files created:** 4

## Accomplishments

- **pg_policies snapshot** — 60 policies across 22 tables (academies, memos, memo_replies, families, family_members, push_subscriptions, fcm_tokens, events, saved_places, parent_alerts, child_locations, danger_zones, objects, point_wallets, point_transactions, emergency_audio_chunks, fcm_tokens, pair_attempts, referral_codes, referral_completions, user_feedback, location_history) dumped via `supabase db query --linked --output csv`. Both CSV (93 lines including multi-line qual clauses) and human-readable ordered DDL rendering (125 logical policies).
- **env-metadata.md** — 12 `[DO NOT COMMIT]` sentinels covering every forbidden field per D-09. Publics captured: Supabase project ref `qzrrscryacxhprnrtpjd`, URL, anon JWT (role=anon verified by payload decode), publishable key `sb_publishable_e3ENu…`, FCM project `hyeni-calendar` / sender ID `304298309837`, VAPID public key `BAGsx-_DBl…Mus` (71 chars base64url), VAPID subject `mailto:hyeni-calendar@noreply.com`.
- **README.md manifest** — Allowed/Forbidden commit policy, pre-commit grep recipes, tag reference, rotation convention.
- **Annotated git tag `push-notify-baseline-20260421`** — created LOCALLY on main HEAD `bc66f38`. Annotated (objecttype=tag), message: "Edge Function state before v1.0 remediation (Phase 1 — Migration Hygiene & Baseline). Rollback anchor for Phase 2 Stream A (PUSH-01 ES256 redeploy). Baseline artifacts: .planning/research/baselines/." **Push to origin intentionally deferred to orchestrator human-verify checkpoint.**

## Task Commits

Each task was committed atomically:

1. **Task 1: Dump prod pg_policies to CSV + SQL** — `069e376` (chore)
2. **Task 2: Author env-metadata.md (public only)** — `169282b` (docs)
3. **Task 3: Author baselines README.md manifest** — `bf0205f` (docs)
3a. **Task 3 redact (checkpoint CHECK 3)** — `5f21ff9` (docs) — removed live family UUID from README
3b. **Task 3 grep-hardening (checkpoint CHECK 1)** — `bc66f38` (docs) — rewrote postgres-URI line to avoid false-positive match on single-line greedy regex
4. **Task 4 (partial — LOCAL TAG ONLY):** annotated tag `push-notify-baseline-20260421` pointing at `bc66f38`. **Push NOT executed.** Orchestrator will drive user confirmation + `git push origin push-notify-baseline-20260421` after reviewing this summary.

**Plan metadata commit:** pending (will be created by orchestrator once the tag is pushed or replaced).

## Files Created/Modified

- `.planning/research/baselines/pg-policies-20260421.csv` — 93 lines; prod RLS policy dump, ORDER BY schemaname, tablename, policyname; columns schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check.
- `.planning/research/baselines/pg-policies-20260421.sql` — 499 lines; 60 `CREATE POLICY …` DDL blocks with header comment marking capture date and provenance.
- `.planning/research/baselines/env-metadata.md` — 77 lines; public env snapshot with 12 DO-NOT-COMMIT sentinels; passes all 5 checkpoint greps.
- `.planning/research/baselines/README.md` — 78 lines; Allowed/Forbidden manifest + pre-commit grep recipes + tag convention.

## Decisions Made

- **`supabase db query` over `supabase db dump`** — `pg_policies` is a catalog view, not a table; `db dump --table pg_policies` would refuse. `db query --output csv` works cleanly and produces exactly the format the plan's verify command expects (header row starts with `schemaname`).
- **Both legacy + new-format anon keys captured** — Supabase's 2025 auth migration added `sb_publishable_*` keys alongside legacy `eyJ` anon JWTs. Phase 2 Stream A needs to verify BOTH stay unrotated; documenting both avoids future ambiguity.
- **Git tag created locally, push NOT executed** — sequential executor directive + plan §checkpoint. Annotated tag is trivially deletable (`git tag -d`) if the user flags a secret leak; pushed tags are much harder to revoke. The 60-second eye-check is worth the autonomy break.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Live family UUID appeared in README.md forbidden-list example**
- **Found during:** Pre-checkpoint grep (CHECK 3)
- **Issue:** README.md lines 39 and 56 echoed the literal prod family UUID `4c781fb7-…` as part of "never commit this UUID" documentation. Plan §checkpoint CHECK 3 explicitly requires zero matches.
- **Fix:** Replaced both occurrences with generic references pointing back to `STATE.md` / `CLAUDE.md` (which legitimately carry the literal).
- **Files modified:** `.planning/research/baselines/README.md`
- **Verification:** `grep -rnE '4c781fb7-677a-45d9-8fd2-74d0083fe9b4' .planning/research/baselines/` → no matches.
- **Committed in:** `5f21ff9`

**2. [Rule 3 — Blocking] Greedy single-line regex false-match in README postgres-URI example**
- **Found during:** Pre-checkpoint final-verify block (CHECK 1 tighter variant)
- **Issue:** The plan's final-verify regex `postgres(ql)?://[^:]+:[^@]+@` is single-line greedy; having both the string `postgres://` AND `@host:port` on the same physical line (even as documentation) causes the regex to match across them. Blocks the `! grep -qE …` guard.
- **Fix:** Rewrote the Forbidden list line describing Postgres URIs to not contain an actual `postgres://…@` construct — only the verbal description remains.
- **Files modified:** `.planning/research/baselines/README.md`
- **Verification:** `! grep -rqE 'VAPID_PRIVATE_KEY *[:=]|SERVICE_ROLE_KEY *[:=]|FCM_PRIVATE_KEY *[:=]|postgres(ql)?://[^:]+:[^@]+@' .planning/research/baselines/` → exit 1 (no matches), PASS.
- **Committed in:** `bc66f38`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking-regex).
**Impact on plan:** Both fixes were needed to pass the plan's own verify gates. Zero scope creep; both touched only README.md documentation.

## Auth / External Service Gates

None. All data came from:
- `supabase db query --linked` (used pre-existing `SUPABASE_ACCESS_TOKEN` from `.env.local`)
- `android/app/google-services.json` (committed repo file — FCM project_id/sender ID)
- `supabase/PUSH-SETUP.md` line 27 (committed repo file — VAPID public key)
- `supabase/functions/push-notify/index.ts` line 52 (committed repo file — VAPID subject)

No dashboard interaction needed; no new env vars; no new OAuth flows.

## Issues Encountered

- **psql not installed on host (Windows).** Plan §action offered `psql` as primary path. Fallback to `supabase db query --linked --output csv` worked cleanly and is actually more auditable (JSON/CSV typed output, not freeform `\copy`).
- **Windows bash heredoc/newline quoting collapsed the multi-line SQL rendering query** when passed inline via `-c`. Worked around by writing the query to a temp `.sql` file and using `--file`. Temp file deleted post-dump (not committed).
- **CSV column `roles` is Postgres array literal** (`{public}`) — harmless, but something to note if future tooling parses the CSV it needs to handle `{}` wrapping.

## Checkpoint Verification Results

All 5 checkpoint greps from plan §checkpoint ran cleanly immediately before tag creation:

1. **Forbidden assignments / postgres creds:** 6 matches, all in `[DO NOT COMMIT]` or Forbidden-list sentinel contexts; zero in assignment position.
2. **Long JWTs (≥100 char):** 1 match — the public anon JWT in env-metadata.md. Payload decode: `{iss:supabase, ref:qzrrscryacxhprnrtpjd, role:anon, iat:1773233943, exp:2088809943}` — confirmed `role=anon`, not `service_role`.
3. **Live family UUID:** 0 matches.
4. **DO NOT COMMIT markers in env-metadata.md:** 12 (plan requires ≥4).
5. **pg-policies CSV line count:** 93 (plan requires ≥5).

**Checkpoint passed with 2 redactions required (both auto-fixed and documented above).** Zero secret values leaked; single JWT present is the public anon key by design.

## Self-Check: PASSED

All 5 baseline artifacts + 5 task commits + local annotated tag verified on disk:

- FOUND `.planning/research/baselines/pg-policies-20260421.csv`
- FOUND `.planning/research/baselines/pg-policies-20260421.sql`
- FOUND `.planning/research/baselines/env-metadata.md`
- FOUND `.planning/research/baselines/README.md`
- FOUND `.planning/phases/01-migration-hygiene-baseline/01-04-SUMMARY.md`
- FOUND commit `069e376` (Task 1 — pg_policies dump)
- FOUND commit `169282b` (Task 2 — env-metadata.md)
- FOUND commit `bf0205f` (Task 3 — README.md)
- FOUND commit `5f21ff9` (Rule 1 redact live family UUID)
- FOUND commit `bc66f38` (Rule 3 grep-harden postgres URI line)
- FOUND annotated tag `push-notify-baseline-20260421` → `bc66f38` (objecttype=tag)
- EXPECTED-ABSENT tag on origin (push deferred to orchestrator checkpoint)

## Next Phase Readiness

- **Phase 2 Stream A (PUSH-01)** — has rollback anchor: `push-notify-baseline-20260421` tag + `env-metadata.md` public-VAPID snapshot. Redeploy can now verify VAPID key continuity before/after without risk of silent rotation.
- **Phase 2 Stream C (PAIR-03)** — has rollback anchor: `pg-policies-20260421.{csv,sql}` for pre-change RLS state. Any policy diff can be generated as `diff <new-dump> pg-policies-20260421.csv`.
- **Plan 01-03 (reconciliation migration)** — not blocked; can proceed in parallel (independent file tree).
- **Plan 01-05 (branch + Playwright regression)** — will consume the artifacts here: tag for rollback reference, pg_policies CSV as pre-promotion diff baseline.

## Open items for orchestrator

1. **Push the git tag.** Local tag `push-notify-baseline-20260421` → `bc66f38` is annotated and ready. After user confirms zero-secret status:
   ```bash
   git push origin push-notify-baseline-20260421
   git ls-remote --tags origin push-notify-baseline-20260421   # verify
   ```
2. **Final metadata commit** — `gsd-sdk query commit "docs(01-04): complete baseline-snapshots plan" .planning/phases/01-migration-hygiene-baseline/01-04-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md` (or equivalent).
3. **STATE.md / ROADMAP.md** — orchestrator-driven per sequential-mode directive; I have not touched either file (the pending `M .planning/STATE.md` in working tree pre-existed this execution).

---
*Phase: 01-migration-hygiene-baseline*
*Plan: 04 (baseline-snapshots)*
*Completed: 2026-04-21T06:36:12Z*
