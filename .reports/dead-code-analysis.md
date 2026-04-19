# Dead Code Analysis — hyeni

Generated: 2026-04-19

## Tooling status

| Tool | Status | Notes |
|---|---|---|
| `depcheck` | ran | JSON output captured |
| `knip` | **failed** | Cannot load `vite.config.js` — `@rollup/rollup-win32-x64-msvc` missing from `node_modules`. `node_modules` appears to have been installed under Linux/WSL (only `rollup-linux-x64-gnu` / `-musl` bindings present). Fix: `rm -rf node_modules package-lock.json && npm i` on Windows. |
| `ts-prune` | **skipped** | Project is JavaScript; no TypeScript in `src/`. |

Without `knip`, unused-export analysis inside files is not available. Findings below cover **unused files** (grep-verified) and **unused dependencies** (depcheck).

---

## Findings

### SAFE — confirmed zero references

| Item | Kind | Evidence |
|---|---|---|
| `src/components/paywall/InlineLockBadge.jsx` | Unused component | Only self-reference in declaration; no importers in `src/`, `tests/`, `scripts/`, `docs/`, `index.html`. |
| `check_db.js` | Orphan one-off script | Not referenced from `package.json` scripts, `src/`, `tests/`, or `scripts/`. Looks like a duplicate of `check_db.mjs`. |
| `check_db.mjs` | Orphan one-off script | Not referenced anywhere. |
| `check_dups.mjs` | Orphan one-off script | Not referenced anywhere. Comment suggests debug probe. |
| `test_auth.mjs` | Orphan one-off script | Not referenced anywhere. Ad-hoc Supabase auth probe. |

### CAUTION — depcheck says unused devDependencies (likely false positives)

| Package | Reality | Recommendation |
|---|---|---|
| `@capacitor/android` | Used by Capacitor CLI via `npx cap sync android` and Gradle. | **Keep** — depcheck can't see native-build consumers. |
| `@capacitor/cli` | Invoked via `npx cap …`. | **Keep**. |
| `@testing-library/react` | Not currently imported in any test. | Review — if no RTL tests planned, candidate for removal; otherwise keep. |
| `@types/react` | Project has no `.ts`/`.tsx` files. | Candidate for removal unless editor tooling depends on it. |
| `@types/react-dom` | Same. | Same as above. |

### DANGER — do not touch

| Item | Why |
|---|---|
| `vite.config.js`, `vitest.config.js`, `playwright.config.js`, `playwright.real.config.js` | Config entry points, loaded by tooling. |
| `src/main.jsx`, `src/App.jsx` | App entry. |
| `src/lib/supabase.js` (8 refs), `features.js` (5), `paywallCopy.js` (6), `qonversion.js` (4), `entitlement.js` (3) | Heavily used. |
| `supabase/functions/**` | Deno Edge Functions — depcheck reports `jsr:@supabase` / `npm:@supabase` imports as "missing". These are Deno-native import specifiers; ignore. |

### depcheck "missing" imports — all false positives

All entries under `missing` in depcheck's JSON are Supabase Edge Function Deno imports (`jsr:@supabase`, `npm:@supabase`, `npm:web-push@3.6.7`). Deno resolves these at function-deploy time, not via `node_modules`. Safe to ignore.

---

## Proposed deletions (SAFE tier only)

1. `src/components/paywall/InlineLockBadge.jsx` — unused component
2. `check_db.js`
3. `check_db.mjs`
4. `check_dups.mjs`
5. `test_auth.mjs`

Total: **5 files**. No code inside `src/lib/`, `tests/`, or `scripts/` proposed for deletion.

### Per-deletion verification plan

Before each deletion:
1. `npm run test` (vitest) — must pass.
2. `npm run build` (vite) — must produce a successful build.

Between deletions, re-run the above. If either fails, revert.

E2E (`npm run test:e2e`) is Playwright-based and may touch external services; run once at the end unless a deletion plausibly affects a user-facing route.

---

## Blocker before deletions

Rollup Windows bindings are missing. `npm run build` and `npm run test` may fail on Windows until `node_modules` is rebuilt. **This is the prerequisite, not a deletion.**

Recommended sequence:
1. Resolve Rollup issue: `rm -rf node_modules package-lock.json && npm i` (from a Windows shell).
2. Run the full test suite once to establish a green baseline.
3. Apply the 5 deletions above one by one, verifying after each.

---

## Scope check (Golden Principle #9)

5 files proposed for deletion → exceeds the 3-file HARD-GATE threshold. Per the rule, `/plan` should precede execution. This report serves as the plan input; user approval required before any deletion.
