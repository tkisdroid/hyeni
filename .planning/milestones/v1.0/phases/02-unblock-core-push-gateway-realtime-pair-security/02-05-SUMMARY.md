---
plan: 02-05
phase: 02-unblock-core-push-gateway-realtime-pair-security
title: "Parent Pairing UI — TTL Countdown + Regenerate + Expired Error"
status: complete
completed_at: 2026-04-21
stream: C
requirements: [PAIR-01, PAIR-04]
depends_on: [02-03, 02-04]
autonomous: false
checkpoint_passed: human-verify (user approved diff + line-range proof)
---

# Plan 02-05: Parent Pairing UI — TTL Countdown + Regenerate + Expired Error

## What was delivered

- **`src/lib/auth.js`** extended:
  - `getMyFamily()` SELECT now includes `pair_code_expires_at`; return shape adds `pairCodeExpiresAt: Date | null`
  - New `regeneratePairCode(familyId)` wrapper → calls `supabase.rpc('regenerate_pair_code')` (Plan 02-03's SECURITY DEFINER RPC) → returns `{ pairCode, pairCodeExpiresAt }`

- **`src/App.jsx`** — bounded edits within locked line ranges (verified):
  - `PairCodeSection` (~850-916): props now accept `pairCodeExpiresAt` + `onRegenerate`; renders `⏱️ 만료까지 N시간 M분` or `⏱️ 만료됨 — 새로고침이 필요해요`; renders `🔄 새로고침 (새 연동 코드)` button (gated — only when `onRegenerate` is truthy, i.e. parent role). Null `pairCodeExpiresAt` shows nothing (grandfathered UX untouched per D-C01).
  - `PairingModal` (~921-1013): threaded the two new props; `onRegenerate` only propagated when `isParent === true` (belt-and-suspenders — server RPC also enforces parent role).
  - `ChildPairInput` (~1148-1215): added a distinct catch-branch matching `err.message.includes("만료된 연동 코드")` → shows `"만료된 연동 코드예요. 부모님께 새 코드를 받아 주세요"` (distinct from the existing generic `"잘못된 코드예요. 부모님께 확인해 주세요"`).
  - Modal invocation (~6588-6611): passes `pairCodeExpiresAt={familyInfo?.pairCodeExpiresAt || null}` + an `onRegenerate` async handler that calls `regeneratePairCode()`, refreshes `getMyFamily`, and toasts `"새 연동 코드가 생성됐어요"`.

## Commits

- `f92c261` — feat(02-05): extend auth.js with pair_code TTL + regenerate wrapper
- `3412c25` — feat(02-05): wire pair_code TTL + regenerate button into PairingModal UI
- (this commit) — docs(02-05): complete plan 02-05 SUMMARY + STATE/ROADMAP

## Line-range compliance (monolith policy)

All `src/App.jsx` edits fall within 4 locked ranges per D-C04/D-C07:
- PairCodeSection: 850-916
- PairingModal: 921-1013
- ChildPairInput: 1148-1215
- Modal invocation: 6588-6611
- + single-line import update at line 2 (explicitly allowed by plan spec)

Total diff: `src/App.jsx` +52/-3 across 7 hunks, `src/lib/auth.js` +18/-2 across 4 hunks. No edits outside listed ranges.

## REQ-IDs closed

- **PAIR-01** (consumer side — UI now surfaces the TTL; server SQL side was closed by Plan 02-03)
- **PAIR-04** (zombie cleanup — existing `unpairChild()` path in PairingModal member list is preserved, and Plan 02-04's parent-only `fm_del` RLS is the enforcement. No new UI added; minimal interpretation per D-C07.)

## Build verification

`npm run build` — `✓ built in 1.71s`. No new TypeScript errors (the project is JSX+JS; no ts type surface). Pre-existing chunk-size warning (monolith policy) unchanged.

## User-visible behavior (6 test scenarios)

1. **Countdown render (live TTL)**: Set `pair_code_expires_at = now() + 10h` via MCP → parent sees `⏱️ 만료까지 9시간 N분` under the QR.
2. **Countdown hidden (grandfathered NULL)**: Existing families retain null `pair_code_expires_at` → no ⏱️ line rendered (existing UX preserved).
3. **Regenerate roundtrip**: `🔄 새로고침` → `window.confirm` guard → call `regenerate_pair_code` RPC → new `KID-XXXXXXXX` + 48h TTL + toast.
4. **Expired child input**: Child enters an expired `pair_code` → Korean `만료된 연동 코드예요. 부모님께 새 코드를 받아 주세요` (distinct from generic invalid).
5. **Parent unpair (PAIR-04 verify)**: Existing member-list `해제` button still works thanks to Plan 02-04's parent-only `fm_del`.
6. **Regenerate button hidden for child**: Child-role session never sees `🔄 새로고침` (frontend gate + server-side RPC gate).

## Deviations

- **None structural.** Plan scope honored exactly; line ranges respected; no new dependencies; Korean strings verbatim from plan spec. Checkpoint approved by user.

## Phase 2 Stream C status after this plan

- ✅ PAIR-01 (TTL column + UI surfacing)
- ✅ PAIR-02 (name-suffix collision via Plan 02-03 RPC)
- ✅ PAIR-03 (parent-only DELETE RLS via Plan 02-04)
- ✅ PAIR-04 (zombie cleanup via existing UI + tightened RLS)

**Stream C complete.** Remaining: Stream A (02-01 push-notify ES256) + Stream B (02-02 Realtime publications).

---

*Completed: 2026-04-21 after user checkpoint approval*
