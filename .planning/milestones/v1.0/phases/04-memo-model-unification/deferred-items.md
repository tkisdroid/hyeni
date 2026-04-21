# Phase 4 — Deferred Items

Items discovered during Phase 4 execution that are OUT OF SCOPE for this
phase and were not fixed here. Each has a phase pointer or v1.1 bucket.

## Pre-existing test failure (unrelated to memos)

- `tests/entitlementCache.test.js:17` — `readEntitlementCache("family-1")`
  returns `null` instead of the written payload. Reproduces on the `main`
  branch without any Phase 4 changes (verified via `git stash` bisect on
  2026-04-21). Likely a test setup/localStorage mock regression. Does not
  block memo model unification because it exercises the entitlement cache,
  not memos.
- Recommended owner: triage alongside Phase 5 Stream A (GATE-01/02) or
  file as a standalone `defect` REQ if still failing post-v1.0.

## Pre-existing lint errors (React compiler strict rules)

18 errors total remain in `src/App.jsx` from the React 19 compiler strict
ruleset — all of them present BEFORE Phase 4 (verified via stash-pop
comparison). Phase 4 added zero net-new lint errors.

- `849:34` — impure function during render (pre-existing)
- `4064:5` — refs accessed during render (`dateKeyRef.current = dateKey` pattern, pre-existing)
- `4169 / 4200 / 4206` — `setState` inside effect body (Kakao SDK loader, pre-existing)
- `4727 / 4844 / 4858` — preserve-manual-memoization skips (pre-existing)
- `5298 / 5835` — `setState` inside effect (alert poll, pairing modal, pre-existing)
- `6900:30` — refs during render (`AmbientAudioRecorder channel={realtimeChannel.current}`, pre-existing)

CLAUDE.md forbids App.jsx decomposition this milestone — any cleanup must
happen in a later surgical pass.

## Out-of-scope drift items

None newly surfaced in Phase 4. Phase 1 already documented the three drift
findings inherited from `db-diff-output.txt` (RLS policy duplication on
`memos` Finding 2, untracked `CREATE TABLE memos` Finding 3, both deferred
to Phase 2/v1.1 respectively).
