# Anon Probe Results — Location Tables & RPCs

Target: https://qzrrscryacxhprnrtpjd.supabase.co/rest/v1/
Auth: anon key only (no user JWT).
Date: 2026-05-13.

## SELECT (read) — anon must see 0 rows or 401/403

| Table | HTTP | Body | Verdict |
|-------|------|------|---------|
| child_locations | 200 | [] | PASS (RLS hides everything) |
| location_history | 200 | [] | PASS |
| saved_places | 200 | [] | PASS |
| academies | 200 | [] | PASS |
| danger_zones | 200 | [] | PASS |

## Direct anon INSERT — must be rejected

POST /child_locations with random uuids → HTTP 401, "42501 new row violates row-level security policy". PASS.

## RPC probes

### upsert_child_location with garbage coords + random uuids

POST /rpc/upsert_child_location
{p_user_id: zeros, p_family_id: zeros, p_lat: 999.9, p_lng: -999.9}
→ HTTP 409, 23503 violates foreign key constraint child_locations_user_id_fkey

Concern: the FK check fires before any lat/lng sanity check. If the function were called with a valid user_id/family_id pair, the row would be written with lat=999.9, lng=-999.9.

### record_location_history_rows with out-of-range coords + random uuids

POST /rpc/record_location_history_rows
{p_rows: [{user_id: zeros, family_id: zeros, lat: 91, lng: 181}]}
→ HTTP 204 (success)

The family_members lookup failed for the random uuids so the body's per-row authz check skipped the insert silently. With a valid pair the insert would proceed with lat=91/lng=181 and no range validation.

GRANT EXECUTE … TO anon (line 73 of 20260506020000_record_location_history_rows_rpc.sql) — anon can call this RPC. The authz gate is only family_members membership; the anon-key fallback in LocationService is intentionally taking advantage of this.

## Backup probe (static)

AndroidManifest.xml:33 has android:allowBackup="true" with no android:fullBackupContent or android:dataExtractionRules declared. android/app/src/main/res/xml/ contains only config.xml and file_paths.xml — no backup rules file.

adb backup com.hyeni.calendar would include hyeni_location_prefs SharedPreferences containing:
- accessToken (Supabase JWT — most sensitive)
- userId, familyId
- supabaseKey (anon — already public, low impact)
- last_uploaded_lat, last_uploaded_lng, last_uploaded_at_ms (child's last coordinates — masked: 37.5*, 126.9*)
- kakaoRestKey (Kakao backend key)

Agent 10 already flagged this. Independent confirmation: the LocationService writes those keys in onStartCommand line 202-211 and uploadLocation line 700-704.

## Kakao key exposure (static, additive to Agent 10)

.env.local declares VITE_KAKAO_APP_KEY (32 hex) and VITE_KAKAO_REST_KEY (32 hex).
Both keys are embedded literally in dist/assets/index-DxioK-gY.js (verified by grep).

VITE_KAKAO_APP_KEY → Maps JS SDK key, public by design (Kakao requires it for client-side SDK init), referrer-whitelisting is the mitigation.
VITE_KAKAO_REST_KEY → REST API key, used by LocationService.java fetchWalkingRoutePoints with Authorization: KakaoAK <key>. This key is SERVER-side (Kakao mobility/affiliate). Shipping it in a JS bundle AND a Capacitor APK with allowBackup=true means any attacker who decompiles the APK or inspects the bundle gets unlimited Kakao API spend on the project owner's quota. P1.
