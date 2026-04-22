---
slug: ai-child-monitor-401
status: diagnosed_fix_staged
trigger: `qzrrscryacxhprnrtpjd.supabase.co/functions/v1/ai-child-monitor` edge function returns HTTP 401 when called from the child session. Originally surfaced as Evidence J in kkuk-memo-send-noop debug session on 2026-04-22. Unrelated to the memo UX bug (out of that session's scope), deferred as separate investigation per user request.
created: 2026-04-22
updated: 2026-04-22
---

# Debug Session: ai-child-monitor-401

## Symptoms

- **Expected**: When a child sends a memo via memo_replies (Phase 5.5 send path), `analyzeMemoSentiment(content, "")` is called in a fire-and-forget manner. The edge function validates the JWT + checks entitlement + calls the AI_MONITOR_URL backend and returns either `{action: "alert"}` or `{action: "noop"}`.
- **Actual**: `POST https://qzrrscryacxhprnrtpjd.supabase.co/functions/v1/ai-child-monitor` returns **401 Unauthorized** from the child session. Console log captured in the kkuk-memo-send-noop debug session (2026-04-22). Silent — no parent alert generated when expected.
- **Error messages**: `Failed to load resource: the server responded with a status of 401 ()` on the child browser.
- **Timeline**: Unknown. Feature has been live since v1.0 (AI_MONITOR_URL introduced for parent-alert flow). First noticed 2026-04-22 during Phase 5.5 debug.
- **Reproduction**: Child signs into hyenicalendar.com → sends a memo → DevTools Network tab shows ai-child-monitor 401.

## Relevant project context

- Caller: `src/App.jsx` `analyzeMemoSentiment(memoText, eventTitle)` at approx line 5811. After Phase 5.5-01 Plan fix, it is now called from `onReplySubmit` success path (src/App.jsx:~7068) for `myRole === "child" && aiEnabled`.
- Request shape:
  - `POST AI_MONITOR_URL`
  - headers: `Authorization: Bearer ${token}` (from `getSession().access_token`), `apikey: SUPABASE_KEY`, `Content-Type: application/json`
  - body: `{ familyId, analysisType: "memo_sentiment", memoText, eventTitle, childName }`
- Edge function name: `ai-child-monitor`. Should live at `supabase/functions/ai-child-monitor/index.ts`.
- Auth expectation: caller includes a valid Supabase JWT. If edge function expects JWT or anon, mismatched auth header leads to 401.

## Scope guardrails

- Do NOT modify KKUK / SOS / RL / memo_replies flows.
- Stay read-only in this round; produce root-cause report before proposing fix.
- Supabase edge functions are deployed via `npx supabase functions deploy`; re-deploy only on user confirmation.
- Live production family_id=4c781fb7-677a-45d9-8fd2-74d0083fe9b4 — do NOT insert test data.

## Current Focus

- **hypothesis**: The edge function was deployed with `--verify-jwt` enabled (Supabase default), but the child anonymous session's JWT fails verification in this specific function's verify step (perhaps role/claim mismatch vs push-notify edge function which was explicitly deployed `--no-verify-jwt` per CLAUDE.md). Two sub-hypotheses:
  - H1a: `ai-child-monitor` deployed with verify-jwt ON but the anonymous user's JWT is missing a required claim (e.g. `role: authenticated` not yet issued for anon sessions).
  - H1b: The edge function manually re-verifies the JWT against an outdated JWT secret / audience and rejects the anon user.
- **test**:
  1. List deployed edge functions via Supabase MCP; confirm `ai-child-monitor` exists + inspect its deployed code.
  2. Check whether the function file in `supabase/functions/ai-child-monitor/` matches deployed version.
  3. Read the function's authentication logic; determine what claims it expects.
  4. Reproduce the 401 via MCP `execute_sql` or a direct HTTPS call with a captured child-session token to see the exact body returned (some 401 responses include WWW-Authenticate detail).
- **expecting**: Edge function either requires `user_role: parent` or requires a verified family-membership row; child sessions may not satisfy either.
- **next_action**: Spawn gsd-debugger to (a) inspect `supabase/functions/ai-child-monitor/` source, (b) check deployed function metadata via Supabase MCP `get_edge_function`, (c) query `auth.users` for the child session JWT shape (without writing), (d) read the App.jsx caller to confirm request headers.
- **reasoning_checkpoint**: (none yet)
- **tdd_checkpoint**: n/a (production bug)

## Evidence

- timestamp: 2026-04-22
  checked: supabase/functions/ai-child-monitor/index.ts — full source read
  found: Function uses `Deno.serve`. NO internal JWT verification logic whatsoever. No getClaims(), no jose, no Authorization header check. It reads the POST body directly (line 297) and calls OpenAI. The ONLY auth protection it would have is Supabase's platform-level `--verify-jwt` gateway flag.
  implication: If deployed with `--verify-jwt` (the Supabase default), the gateway rejects ES256 JWTs from child anonymous sessions BEFORE the function code runs — exactly as documented in PITFALLS.md §Pitfall 1.

- timestamp: 2026-04-22
  checked: supabase/functions/push-notify/index.ts line 7 comment + phase 02 planning docs
  found: push-notify is explicitly deployed with `--no-verify-jwt` flag (D-A02 gateway workaround for supabase#42244 — ES256 JWT rejection by Supabase gateway). push-notify does its own in-function getClaims() verification. ai-child-monitor has no such deployment flag and no in-function verification.
  implication: ai-child-monitor was deployed with the default `--verify-jwt=true`. The Supabase gateway rejects the child anonymous ES256 JWT before the function body runs. This matches the 401 exactly.

- timestamp: 2026-04-22
  checked: All planning docs, CLAUDE.md, package.json, any deploy scripts for ai-child-monitor
  found: Zero references to `--no-verify-jwt` for ai-child-monitor anywhere. The function was never deployed with the gateway workaround flag.
  implication: ai-child-monitor is the only caller-facing function deployed with `--verify-jwt` on a project using ES256 JWT signing — the exact combination that causes gateway 401 per supabase#42244.

- timestamp: 2026-04-22
  checked: src/App.jsx lines 5825-5845 (analyzeMemoSentiment) vs lines 104-145 (sendInstantPush)
  found: analyzeMemoSentiment sends `Authorization: Bearer ${token}` + `apikey` header with token from `getSession().access_token`. sendInstantPush sends the same token pattern but to push-notify which has `--no-verify-jwt` so the gateway passes it through. The auth-header construction is identical — the difference is purely the deployment flag on the receiving function.
  implication: The caller is correct. The problem is server-side deployment configuration only.

- timestamp: 2026-04-22
  checked: PITFALLS.md §Pitfall 1 (research/PITFALLS.md lines 14-26)
  found: Explicitly documents: "engineers wire up jose, the gateway still wraps the function with the platform's legacy verify_jwt flag, and the gateway itself rejects the ES256 JWT before the function body runs". The fix is `--no-verify-jwt` on deploy + in-function verification.
  implication: This is a known-documented pitfall for this exact project. ai-child-monitor was never hardened to match push-notify's deploy pattern.

- timestamp: 2026-04-22
  checked: CORS OPTIONS handler in ai-child-monitor/index.ts lines 272-274
  found: OPTIONS is handled correctly — returns 200 "ok" with CORS_HEADERS. CORS preflight is NOT the source of the 401. The 401 happens on the POST itself at the gateway level before any function code runs.
  implication: No CORS issue. Gateway rejects the POST with 401.

## Eliminated hypotheses

- hypothesis: H1b — function manually re-verifies JWT against outdated secret and rejects anon user
  evidence: ai-child-monitor/index.ts has NO JWT verification code at all (no getClaims, no jose, no Authorization header read). Manual re-verification is impossible.
  timestamp: 2026-04-22

- hypothesis: Caller sends wrong token / missing auth header
  evidence: analyzeMemoSentiment and sendInstantPush construct auth headers identically from getSession().access_token. push-notify succeeds with the same token pattern. The token itself is valid.
  timestamp: 2026-04-22

- hypothesis: CORS preflight returns 401
  evidence: OPTIONS handler returns 200 with correct CORS headers. 401 is on the POST, not OPTIONS.
  timestamp: 2026-04-22

## Resolution

root_cause: `ai-child-monitor` was deployed with Supabase's default `--verify-jwt` (gateway-level JWT verification ON). The project's JWTs use ES256 asymmetric signing (migrated 2025). The Supabase edge gateway rejects ES256 JWTs with 401 before the function body runs (supabase#42244). The child anonymous session sends a valid ES256 JWT but the gateway cannot verify it, returning 401. This is the same bug push-notify had, which was fixed by deploying with `--no-verify-jwt` + adding in-function getClaims() verification (D-A02).

fix: Two-part fix required:
  1. Add in-function JWT verification to ai-child-monitor/index.ts (read Authorization header, call getClaims(), reject if invalid — mirror push-notify lines 280-298 pattern).
  2. Redeploy: `npx supabase functions deploy ai-child-monitor --no-verify-jwt --project-ref qzrrscryacxhprnrtpjd`

verification: (pending — not yet applied)
files_changed: []
