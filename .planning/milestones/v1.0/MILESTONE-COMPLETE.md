# Milestone v1.0 — Production Stabilization: COMPLETE

**Completed:** 2026-04-21
**Status:** tech_debt (28/28 REQs closed · 0 out-of-scope violations · 4 v1.1 deferrals accepted)
**Audit:** see `v1.0-MILESTONE-AUDIT.md` in this directory

## Phases Delivered (5/5)

| # | Phase | REQs | Key artifacts |
|---|---|---|---|
| 1 | Migration Hygiene & Baseline | 0 (infra) | archive/, down/, reconciliation migration, pg_policies snapshot, git tag `push-notify-baseline-20260421` (origin) |
| 2 | Unblock Core | 9 (PUSH-01, RT-01..04, PAIR-01..04) | push-notify v32 (ES256 getClaims + JWT senderUserId), realtime publications + REPLICA IDENTITY FULL × 6, per-table sync channels, pair_code TTL + regenerate RPC, parent-only fm_del RLS |
| 3 | Client Push & Fetch Hygiene | 5 (PUSH-02..04, RES-01..02) | sendInstantPush single-call + Idempotency-Key, push-notify v33 dedup, pending_notifications.delivery_status, fetchSavedPlaces circuit breaker + backoff, syncDegraded banner |
| 4 | Memo Model Unification | 3 (MEMO-01..03) | memos_legacy_20260421 snapshot, memo_replies.origin/read_by, legacy ingested, IntersectionObserver 3s read, auto-read removed (shadow-running; memos TABLE retained for v1.1 DROP) |
| 5 | UX & Safety Hardening | 10 (GATE-01/02, RL-01..04, KKUK-01..03, SOS-01) | pre-pair gate, remote_listen_sessions + indicator + feature flag, Android FGS authored (deploy v1.1), kkuk press-hold + dedup_key + server cooldown + sos_events immutable audit log |

## v1.1 Inheritance (mandatory pickups)

1. **native-deploy** (P0): Android APK rebuild + Play internal-track submission for FGS-microphone service + Capacitor bridge wiring for `mic-permission-denied` event
2. **MEMO-CLEANUP-01**: Drop `public.memos` table + remove legacy client paths (gated on 30-day shadow parity ≥ 2026-05-21)
3. **push_idempotency TTL cron**: 24h retention job
4. **Supabase migrations 000002..000005**: Apply if academies/active_slot features need them (behavior-change review required)

## v1.1 Observability + Polish (v2 section of REQUIREMENTS.md)

- OBS-01..03: Sentry/Log Drain, push delivery dashboard, family activity metrics
- REFACTOR-01..02: src/App.jsx decomposition + TypeScript roadmap
- UX-01..03: Pair QR redesign, role-switch UX, auto zombie cleanup

## Human Verification Outstanding (natural-usage observable)

1. ES256 JWT authenticated POST → push-notify 200 (real browser session)
2. PairingModal TTL countdown + regenerate roundtrip + toast
3. Expired pair code error branch in ChildPairInput
4. Parent unpair click (PAIR-04 end-to-end path)
5. 7 realtime channels stable under long session
6. kkuk press-hold 500–1000ms timing in browser
7. Remote listen indicator visible on child during session
8. Android FGS persistent notification (pending v1.1 native-deploy)

## Milestone Metrics

- 60+ atomic commits across all phases
- 5 phases verified (4 passed + 1 tech_debt audit)
- 0 src/App.jsx line-range violations
- 0 VAPID rotations (existing push_subscriptions preserved)
- 0 data losses (live prod `4c781fb7-…` family intact)
- Every DB migration has paired down file
- Rollback anchors intact: git tag + pg_policies baseline + env-metadata

---

Milestone v1.0 archived to `.planning/milestones/v1.0/`. Active `.planning/` cleaned to v1.1 start state.
