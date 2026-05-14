# Agent 05 - Location / Geolocation / Map / Trail

Branch: final/production-polish-and-real-device-qa @ d5d183f
Date: 2026-05-13
Status: PARTIAL_VERIFIED - static analysis + anon-probe complete; runtime device verification NOT_VERIFIED (devices not paired this session)

## Executive summary

Static analysis surfaced 4 new P1 issues plus confirmation of the Agent 10 P1 around allowBackup. No new P0s found. Two P1s are credential/privacy exposure (Kakao REST key in client bundle; location_history not purged on unpair). RLS isolation is intact for all 5 probed location tables - anon cannot read or write.

Runtime checks deferred to next QA cycle once parent + child devices are re-paired.

## A. Permission matrix
See location-evidence/permission-matrix.md. All 5 required permissions declared. Capacitor BackgroundLocation plugin requests FINE first, then ACCESS_BACKGROUND_LOCATION on Android 10+. LocationService gates startForeground on FINE granted (line 243). Web GPS error code 1 surfaces the correct Korean toast.

## B. Capacitor Geolocation plugin
No @capacitor/geolocation import in src/. The app uses:
1. Native plugin BackgroundLocation (src/lib/nativeLocationService.js -> android/app/src/main/java/com/hyeni/calendar/LocationPlugin.java).
2. Web fallback navigator.geolocation getCurrentPosition / watchPosition (App.jsx:1908, 3088, 3093; RouteOverlay.jsx:99, 104, 591).

Both call sites use enableHighAccuracy: true, timeout: 10000-15000ms, maximumAge: 0-3000ms. Errors handled with user-visible toast on App.jsx:3096-3098.

## C. LocationService.java (Android native)
- Foreground service starts cleanly on SDK 34+ (line 255-260, FOREGROUND_SERVICE_TYPE_LOCATION).
- Notification channel hyeni_location_v4 created in createNotificationChannels.
- Permission gate at line 243 - stopSelf when ACCESS_FINE_LOCATION not granted.
- JWT/session caching: SharedPreferences hyeni_location_prefs stores accessToken (line 207) and refreshes from prefs every 50 min (line 114, 410-417). No additional MAC/encryption layer.
- Location strategy: HIGH_ACCURACY @ 5s when moving, BALANCED_POWER @ 30s when stationary (line 81-87), adaptive switch in updateStationaryState. Kalman filter applied (line 419-451). 50m accuracy reject threshold (line 92).
- Three-tier upload retry: user JWT -> refreshed JWT -> anon key fallback (line 642-688). Successful upload persists lat/lng/timestamp to SharedPreferences for ShutdownReceiver replay (line 700-704). Coordinates masked: 37.5*, 126.9*.
- Wake lock 6h with 5h renewal (line 100-102). Battery exemption requested at start (line 324).

## D. DB schema and validation
See location-evidence/schema-and-validation.md.

Tables touched: child_locations, location_history, saved_places, danger_zones, academies.

Findings:
- No CHECK constraints on lat/lng range for any of the five tables.
- saved_places.location and academies.location are jsonb (no structural lat/lng validation).
- danger_zones.radius_m has no CHECK on bounds.
- location_history has no retention/TTL; unpair_child does not purge it.
- upsert_child_location RPC (deployed, not in repo migrations) lacks lat/lng sanity check.

## E. Coordinate validation client-side
- saveLocationHistoryRows (src/lib/sync.js:616-631) filters out rows where lat/lng are not finite numbers via Number.isFinite - only NaN/Infinity gated, no range check.
- effectiveChildLocation (src/lib/effectiveLocation.js) is the freemium gate; it does not validate lat/lng, only filters for display.
- LocationService.handleLocation (line 597-602) rejects fixes with accuracy > 50m but accepts any lat/lng value the OS returns.

## F. Logcat/console coordinate exposure
- LocationService.java logs accuracy in meters and stationary booleans - not raw coordinates. handleLocation line 625-626 is Log.d not Log.i.
- saveChildLocation / saveLocationHistory (sync.js:603, 613) only console.error on failure with the Postgres error object (no coords).
- App.jsx:1904 onLocationRefreshRequest console.warn does not include coords.
- No grep hits for console.* writing raw lat/lng/latitude/longitude/coords values.

VERDICT: no obvious coord leakage to logcat/console.

## G. Kakao Maps
- src/lib/kakaoMap.js loads SDK with the public APP key (referrer-restricted by Kakao). Acceptable as designed.
- VITE_KAKAO_REST_KEY is the backend key. Embedded literally in dist/assets/index-DxioK-gY.js (grep confirms 32-hex value present). Also passed to native LocationService via plugin args (LocationPlugin.java:88, LocationService.java:199) and persisted to SharedPreferences (line 209), where allowBackup=true exposes it.

This is in addition to the Agent 10 allowBackup finding - Kakao REST key shipping in client bundle is independent and broader-impact: any user who downloads the public web bundle can extract it without any device access.

## H. Trail / history display
- locationTrailDisplay.js + trailMath.js provide client-side polyline rendering.
- LocationService builds history rows via Kakao walking-route API or linear interpolation fallback (line 753-861), batched as record_location_history_rows.
- No daily-summary RPC observed for the trail; the parent UI fetches by day window via fetchLocationHistoryForDate (sync.js:637).

## I. saved_places / academies / danger_zones CRUD
- saved_places: parent-only writes, premium-tier gate. RLS verified via migration 20260418000006_saved_places.sql.
- danger_zones: parent-only writes. RLS scoped to family (20260317100000).
- academies: deployed schema not in repo migrations - cannot statically verify CRUD policy from this checkout. Recommend a follow-up pg_policies dump.

## J. Anon probe results
Five SELECTs: all returned 200 with empty array (RLS hides correctly).
Direct anon INSERT into child_locations -> 401 with the expected RLS violation message.
upsert_child_location anon RPC blocked by FK only (no lat/lng check).
record_location_history_rows anon RPC succeeded with garbage uuids (204) - would write if uuids were real.

## K. Runtime evidence
NOT_VERIFIED - child and parent devices observed in cycle1 screenshots but pairing was not completed in the prior agent sessions. Pending runtime tests:
- Parent map shows child marker after pairing.
- Child trail (day view) populates after a walking session.
- Permission revoke + relaunch behavior on real device.
- Background-only location upload while app is force-stopped.

## Issues

| # | Severity | Title | Location | Evidence |
|---|----------|-------|----------|----------|
| L-001 | P1 | Kakao REST key shipped in client bundle and Capacitor APK | .env.local, dist/assets/index-DxioK-gY.js, LocationService.java:199 | grep of 32-hex key in dist .js confirms; APK SharedPreferences exposes via adb backup |
| L-002 | P1 | unpair_child RPC does not delete location_history | supabase/migrations/20260429000010_unpair_child_rpc.sql | RPC purges child_locations + 4 other tables but location_history persists after unpair |
| L-003 | P1 | upsert_child_location RPC has no lat/lng range check | deployed (not in repo); confirmed via anon probe accepting 999.9 | If credential or family_id pair leaks, attacker can write garbage marker positions |
| L-004 | P1 | record_location_history_rows granted to anon with no lat/lng check | supabase/migrations/20260506020000:73 + 20260507000000 | GRANT EXECUTE TO anon. With known user_id+family_id pair, anon can append arbitrary trail rows |
| L-005 | P1 | (Confirms Agent 10) allowBackup=true with no backup rules exposes JWT + last coords | AndroidManifest.xml:33; no res/xml/backup_rules.xml | adb backup recovers hyeni_location_prefs containing accessToken, last_uploaded_lat/lng (37.5*, 126.9*), kakaoRestKey |
| L-006 | P2 | ShutdownReceiver posts to /rest/v1/locations (non-existent table) | android ShutdownReceiver.java:79 | Endpoint path uses locations not child_locations; final-before-shutdown beacon silently 404s |
| L-007 | P3 | No lat/lng CHECK on child_locations/location_history/saved_places/danger_zones/academies | archive/_deprecated_child-locations.sql; 20260317100000:27-28 | DB-level safety net missing |
| L-008 | P3 | location_history has no retention/TTL | none in supabase/migrations/ | Unbounded growth; privacy/storage cost |
| L-009 | P3 | danger_zones.radius_m has no CHECK on bounds | 20260317100000:29 | Negative or pathological radius accepted |
| L-010 | P3 | ACCESS_BACKGROUND_LOCATION requested without rationale UI on Android 10+ | LocationPlugin.java:74 | Android 11+ silently denies if no rationale. UX, not security |

## Release decision

ALLOW with conditions. No P0 newly discovered. P1 set is concentrated around DB hardening and the long-standing allowBackup/Kakao key exposure. Recommend addressing L-001 (Kakao key rotation + remove from bundle) and L-002 (extend unpair_child) before public store rollout; L-003/L-004 can ship with a follow-up migration adding CHECK constraints; L-005 should be tackled alongside Agent 10 remediation.

Blocking only if leadership treats Kakao API spend abuse (L-001) or child-trail retention after unpair (L-002) as launch-blocking.
