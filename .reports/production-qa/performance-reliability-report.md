# Agent 11 — Performance / Reliability / Offline (Hyeni Calendar)

**Status**: PARTIAL_VERIFIED (static-analysis only — runtime latency awaits paired devices)
**Branch**: `final/production-polish-and-real-device-qa` @ `d5d183f`
**Scope**: production-static performance, reliability, offline, Android lifecycle, error & monitoring readiness.

> Runtime evidence (cold-start ms, calendar scroll FPS, realtime end-to-end latency, memory growth) NOT_VERIFIED — both devices were installed but not paired during this wave. All findings below are derived from source / production build artefacts.

---

## A. Bundle / Cold start

| Metric | Value | Reference |
|---|---|---|
| Main JS (raw) | **1,220,006 B (≈1.22 MB)** | `dist/assets/index-DxioK-gY.js` |
| Main JS (gzip) | **373,545 B (≈365 KB)** | `gzip -c \| wc -c` |
| CSS | 140,971 B | `dist/assets/index-DPZybzbb.css` |
| Code splitting | **NONE** | `vite.config.js` is bare `defineConfig({ plugins:[react()] })` — no `manualChunks`, no chunk for `@supabase`/`lucide-react`/Qonversion |
| `React.lazy` / dynamic chunks | **0** | Only 5 `import()` calls site-wide, all are conditional Capacitor / OAuth bridges (not split-on-route) |
| Font preload / preconnect | **NONE** | `index.html` has no `<link rel="preconnect">` to Supabase / Kakao / FCM, no `rel="preload"` for Pretendard. Cold-paint TTFB depends entirely on a single 365 KB request. |
| Console statements left in bundle | **20 occurrences** | No `esbuild.drop` / `terser.drop_console` configured |

**Concerns**
- `lucide-react` named import (App.jsx:2 / stickerIcons.jsx:23) tree-shakes well — not the culprit.
- The 1.22 MB is dominated by `App.jsx` itself (**8,198 lines** of a single megacomponent), `@supabase/supabase-js`, `@qonversion/capacitor-plugin`, and the Capacitor runtime. None are code-split.
- Vite 7 default bundle warning fires (`>500 kB`) — Agent 01 P2 confirmed; no follow-up split applied.

**Severity** -> **P2** (cold-start slow on low-end Android but does not block ship). Move to P1 if user-perceived TTI on real device exceeds 3 s.

**Recommendations (not applied — fix PR forbidden by scope)**
1. Add `build.rollupOptions.output.manualChunks` to split `vendor-supabase`, `vendor-react`, `vendor-icons`, `vendor-qonversion`.
2. `React.lazy()` the parent-only screens (ParentEventAddView, ChildTrackerOverlay, ParentMemoPage, SubscriptionManagement, PlaceManagerScreen) — the child entry path doesn't need them.
3. `index.html`: `<link rel="preconnect">` for the Supabase project URL + `dapi.kakao.com`, and preload Pretendard if self-hosted.
4. `vite.config.js`: `esbuild: { drop: ['console','debugger'] }` for production builds (keeps `console.error`/`.warn` if needed).

---

## B. Calendar performance (static)

- **No virtualization library** anywhere (`react-window` / `react-virtual` / `@tanstack/virtual` — 0 imports).
- `events` is a `Record<dateKey, EventRow[]>`. Lookups are `events[key].forEach` (O(N) per key) — fine for one-day views.
- **Hot path leak** found: `src/App.jsx:7725` runs `Object.values(events).flat().find(...)` on every MapPicker render with the *entire* event map. For long-running families the linear scan grows unbounded. Move to a precomputed Map by id. **P2**.
- `useMemo` / `useCallback` / `React.memo` usage is sparse — 77 occurrences across 15 components for a 159-file project. The biggest re-render risk is `App.jsx` itself: the megacomponent passes inline callbacks to deep children, every state change re-renders the entire tree. **P2** (no crash, just battery / FPS).
- Re-render trigger on realtime payload: `setEvents(prev => ...)` runs `Object.keys(updated).forEach` + per-bucket filter on every `events` change — acceptable for <1000 events but degrades quadratically. **P3**.

---

## C. DB query patterns (static)

| File | Concern | Severity |
|---|---|---|
| `src/lib/sync.js:217 fetchEvents` | `.select("*, events_children(child_id)").eq("family_id",…)` — **no date pagination, no LIMIT**. A 5-year-old family pulls every row on every visibility wake-up. | **P1** |
| `src/lib/sync.js:251 fetchAcademies` | `.select("*")` — minor but unbounded. | P3 |
| `src/lib/sync.js:273 fetchMemos` | `.select("*")` (deprecated table per comment, kept read-only for 30d). | P3 |
| `src/lib/sync.js:299 fetchSavedPlaces` | `.select("*")` — circuit-breaker wrapped, OK. | P3 |
| `src/lib/sync.js:352 fetchDailySupplies` | already projects `date_key, content` only. | OK |
| `src/lib/sync.js:1022 fetchDangerZones` | `.select("*")` — OK (small table). | OK |
| `src/lib/childSubscriptions.js:56` | `.select("*")` — unverified scope. | P3 |
| Sticker / alerts paths | Use RPCs (`get_parent_alerts`, `get_stickers_for_date`) — fine. | OK |
| `fetchLocationHistoryForDate` | already projects `user_id, lat, lng, recorded_at` + `gte/lt` time bounds + `.in(user_id,…)` — good. | OK |

**No N+1 query patterns detected** in the read paths. The events join uses Postgres-side embed (`events_children(child_id)`) which executes server-side.

`fetchEvents` no-pagination is the single P1 — at >2,000 rows, mobile JSON parse + network egress will dominate cold-start.

---

## D. Realtime / Reconnect / Polling fallback

- **CHANNEL_ERROR + exponential backoff** — PASS (Agent 04 already verified). `subscribeTableChanges` (sync.js:726) retries 10x with `Math.min(2000 * 2^retryCount, 60000)` capped at 60 s, plus `_dispose()` cleanup tied to component unmount. Verified at sync.js:744-771 and 910-932.
- **Missed-event recovery on reconnect** — **NOT IMPLEMENTED**. When the per-table channel transitions `CHANNEL_ERROR -> SUBSCRIBED` after a retry, the code does not trigger a fresh `fetchEvents/fetchMemos/fetchSavedPlaces` to fill the gap. Realtime is treated as a streaming primitive only. The 30-s polling fallback partially closes the gap for **events / memos / savedPlaces only** (App.jsx:2413-2443). **P1**.
- **Polling fallback completeness** — only 3 of 9 subscribed tables are polled:
  - polled: `events`, `memos`, `saved_places`
  - NOT polled: `memo_replies` (already flagged by Agent 04 P2), `academies`, `daily_supplies`, `child_locations`, `family_members`, `family_subscription`, `danger_zones`. If realtime drops past `MAX_RETRIES=10`, these tables stay stale until page reload. **P1** for `memo_replies` (active conversation surface), **P2** for the others.
- **Subscriber cleanup on unmount** — PASS. `subscribeFamily` returns the broadcast channel with `_dispose` + `_channels` attached; App.jsx:2091 calls `unsubscribe(realtimeChannel.current)` from the cleanup function; sync.js:951 tears down all 10 channels + their retry timers.

---

## E. Memory leak patterns

| Location | Pattern | Verdict |
|---|---|---|
| `App.jsx:825-828` (appMoodNowMs) | `setInterval(60_000)` + `clearInterval` cleanup | OK |
| `App.jsx:1509-1511` (bg-location poll) | `setInterval(2000)` + cleanup | OK |
| `App.jsx:2377` (publishChildDeviceStatus) | `setInterval(30_000)` + cleanup | OK |
| `App.jsx:2413-2443` (30 s polling fallback) | + cleanup | OK |
| `App.jsx:3351-3454` (geofence) | `setInterval(10_000)` + clears `iv` and **all `departureTimers`** on unmount | OK (explicit comment) |
| `App.jsx:3490` (advance notif) | `setInterval(30_000)` + cleanup | OK |
| `App.jsx:3672` (parent alerts) | `setInterval(60_000)` + cleanup | OK |
| `useNowMs.js:7` | `setInterval` + cleanup | OK |
| `addEventListener` x 30 sites | every site has matching `removeEventListener` in its cleanup | OK |
| `ChildTrackerOverlay.jsx:443` | `el.addEventListener("click", …)` on a DOM element re-created inside `useEffect`; old elements are detached via `setMap(null)` so the DOM ref is released to GC. Closure captures `setSelectedEvent` — stable identity. | OK (acceptable) |
| Refs (`departureTimers`, `sosAutoTimersRef`, `academyFocusAlertedRef`, `generalAlertPopupSeenRef`) | populated by realtime / interval handlers; only `departureTimers` is explicitly drained on unmount; the others are `Set` accumulators that grow over a session. | **P3** — bounded by per-family event count. |

No clear `setInterval` / `setTimeout` / `addEventListener` leak. Largest residual risk is `App.jsx` itself being one 8,198-line component holding the whole calendar tree in closure scope. Move on.

---

## F. Offline / Network failure

| Area | Status |
|---|---|
| `navigator.onLine` listener / online-offline events | **NONE** (`grep` returns 0 matches) — app does not surface offline UI. |
| `@capacitor/network` plugin | not installed (`package.json` checked). |
| Cached reads | `getCachedEvents` / `getCachedAcademies` / `getCachedMemos` / `getCachedSavedPlaces` (sync.js:968-972) backed by `localStorage` — fetches *fall through* to cache only when `error` is returned from supabase-js, not when the user is truly offline (the request just times out). |
| Optimistic update + rollback | **PRESENT** for: voice events (App.jsx:3894 + 3918 catch), event edit (4064 + 4095), event delete (4178 + path verified), memo replies (path uses RPC + try/catch). |
| Offline mutation queue | **NONE** — failed inserts are rolled back and the user is told "저장이 잠시 멈췄어요. 한 번 더 해볼까요?". No background retry. **P1** for kids who add events on the school bus. |
| Service worker (PWA) | `public/sw.js` handles Web Push only — **no offline cache strategy** (`fetch` event is not intercepted). |
| Circuit breaker | `fetchSavedPlaces` opts into a 3-failure / 5-min cooldown (sync.js:34-90) — well-designed but only one consumer. Other reads have no breaker. |

**Severity** -> **P1** (kids on subway / school yard). Add a Capacitor `Network` listener + a `pending_mutations` localStorage queue with retry-on-online.

---

## G. Android background / killed / reboot (static)

| Surface | File | Verdict |
|---|---|---|
| `BOOT_COMPLETED` receiver | `BootReceiver.java` + `AndroidManifest.xml:151-157` (`BOOT_COMPLETED` + `LOCKED_BOOT_COMPLETED`) | PASS — restarts `LocationService` as a foreground service for child role only when permission still granted. |
| `LocationService` background loop | 2,049-line foreground service with WakeLock (6 h with 5 h renewal), Fused location callback, OkHttp uploader, 15-s notification poll, 30-s event check, 50-min token refresh. | Solid. |
| `ServiceKeepAlive` | 96 lines — exists, presumably AlarmManager-driven respawn. | PASS (not deep-dived). |
| `ShutdownReceiver` | 100 lines — handles `ACTION_SHUTDOWN` so the service can flush. | PASS. |
| Capacitor `appStateChange` listener | **NOT REGISTERED** in `src/App.jsx`. Only `backButton` + `appUrlOpen` are listened to (App.jsx:1415, 2892). Backgrounding/foregrounding signals reach the JS layer only via `document.visibilitychange` (which Capacitor maps from the activity). | OK for now — `visibilitychange` covers the same lifecycle on Capacitor 8, but consider explicit `App.addListener('appStateChange', ...)` for paused/resumed analytics. **P3**. |
| LocationService dead-restart after foreground resume | App.jsx:1699-1712 — calls `BackgroundLocation.isRunning()` after `visibilitychange === "visible"` and restarts the service if not running. | PASS. |
| Killed-state push fallback | FCM via `MyFirebaseMessagingService` + `NotificationHelper` (per Agent 04 + 06 reports). | Outside this agent's scope. |
| Battery optimization (Doze) guidance | Permission wizard (`ChildPermissionWizard`) shows "배터리 최적화 제외" step — verified via Agent 05/02 evidence. | PASS. |

**No background false-success patterns found in the JS layer.** Native side is mature.

---

## H. Error Boundary

`src/main.jsx:15-51` defines a top-level `<ErrorBoundary>` that wraps `<App />`.

**Issue**: line 38-41 renders the full `error.stack` + `componentStack` inside a `<details>` block visible to end users — **stack-trace leak** on any crash. While not a security CVE (no PII in JS stack), this is an info-leak that could expose internal module names / paths in a kids-facing app. **P2** (cosmetic + minor information disclosure).

- Async errors: try/catch blocks are present in most async handlers (sync.js has 9 try blocks, App.jsx handlers wrap supabase calls). No global `window.addEventListener('error', …)` or `unhandledrejection` handler — silent promise rejections may surface only in the console. **P2**.

---

## I. Monitoring / Logging readiness

| Tool | Status |
|---|---|
| Sentry / Datadog / Bugsnag / Rollbar | **NOT INSTALLED** (`package.json` has zero monitoring deps). |
| Custom analytics endpoint | Only `feedback` (sendFeedbackSuggestion) — for support tickets, not telemetry. |
| `console.log` count in `src/` | **27** (Agent 01 confirmed); 20 survive in production bundle (no `drop_console` in vite config). |
| Sensitive data in logs | Agent 10 N1/N4 PASS — token / location masking is in place at the log call sites. FCM token at App.jsx:1569 logs only first 20 chars + ellipsis. |

**Severity** -> **P2** (no crash visibility in the wild; "it works on my device" is the only signal). For a paid family-safety app, blind production is risky.

---

## J. DB EXPLAIN (deferred)

Not executed — Agent 11 has no production DB credentials, and the supabase service-role key in `env` is for staging-only QA per Agent 10. Skipped per scope ("선택").

---

## Issues

| ID | Severity | Area | Description |
|---|---|---|---|
| AGENT11-P1-001 | **P1** | Realtime missed-event recovery | After CHANNEL_ERROR/TIMED_OUT reconnect, `subscribeTableChanges` re-subscribes but does NOT trigger a re-fetch. Combined with the polling fallback covering only 3 of 9 tables, this leaves `memo_replies`, `academies`, `daily_supplies`, `child_locations`, `family_members`, `family_subscription`, `danger_zones` stale until page reload after a long network outage. |
| AGENT11-P1-002 | **P1** | DB pagination | `fetchEvents` has no `.range()` / date filter. Long-running family pulls every events row every visibility wake-up — degrades to multi-MB JSON over the years. |
| AGENT11-P1-003 | **P1** | Offline / queue | No `navigator.onLine` detection, no Capacitor Network plugin, no offline mutation queue. Optimistic insert fails -> rollback + toast; the user must retry manually. |
| AGENT11-P1-004 | **P1** | Polling fallback gap (memo_replies) | Confirms Agent 04 P2. Active conversations stay broken if realtime is degraded. |
| AGENT11-P2-005 | **P2** | Bundle size | 1.22 MB / 365 KB gzip > Vite 500 kB warn; no manualChunks; no `React.lazy`. Cold start on low-end Android may exceed 3 s TTI. |
| AGENT11-P2-006 | **P2** | Monitoring | No Sentry / equivalent. Production crashes are invisible. |
| AGENT11-P2-007 | **P2** | Error boundary stack-trace leak | `src/main.jsx:38-41` renders `error.stack` + `componentStack` inside a `<details>` visible to end users. |
| AGENT11-P2-008 | **P2** | Console statements survive in prod | 20 `console.log` occurrences remain in `dist/assets/index-DxioK-gY.js` — no `esbuild.drop` configured. |
| AGENT11-P2-009 | **P2** | App.jsx 8,198-line megacomponent | Re-renders the entire tree on every state change; no `React.memo` on heavy children. Battery/FPS risk. |
| AGENT11-P2-010 | **P2** | MapPicker hot scan | `Object.values(events).flat().find(...)` on every render (App.jsx:7725). |
| AGENT11-P2-011 | **P2** | Global async error handler | No `window.addEventListener('error', …)` / `unhandledrejection`. Silent rejections only land in console. |
| AGENT11-P3-012 | **P3** | `appStateChange` not subscribed | Only `visibilitychange` used. Functional but not Capacitor-idiomatic. |
| AGENT11-P3-013 | **P3** | Set-accumulator refs unbounded per session | `academyFocusAlertedRef`, `firedNotifs`, `firedExactStatuses`, `firedEmergencies`, `arrivedSet`, `departedAlerts` — accumulate IDs over a session. Bounded by event count, but no day-rollover prune. |
| AGENT11-P3-014 | **P3** | Index.html font/network preconnect | No `<link rel="preconnect">` for Supabase / Kakao / Pretendard. |

---

## Release decision

**BLOCK at production-grade SLA**.

Two P1 findings — DB pagination on `fetchEvents` and missing offline mutation queue — are not acceptable for a kids-safety app on the school commute. The realtime missed-event recovery gap is the third P1.

If the team accepts a "soft-launch / new families only" gate (where `fetchEvents` payload stays small for <=90 days), the P1s degrade to P2 and the release becomes **ALLOW with monitoring caveats**: install Sentry first so the first 100 families' crashes are visible.

---

**Runtime evidence**: NOT_VERIFIED — awaits paired devices. Re-run cold-start TTI, calendar scroll FPS, realtime end-to-end latency, and 24-h memory growth once devices are paired.
