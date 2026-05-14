# Schema & Validation — Location Tables

## child_locations
Defined in supabase/archive/_deprecated_child-locations.sql (current production schema is opaque from checkout — only the deprecated archive contains the CREATE TABLE):

    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
    family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE
    lat double precision NOT NULL
    lng double precision NOT NULL
    updated_at timestamptz NOT NULL DEFAULT now()

Realtime publication: supabase/migrations/20260427180000_child_locations_realtime.sql — ADD TABLE + REPLICA IDENTITY FULL.

RLS policies (archive shape):
- SELECT: family-scope (parent_id OR member)
- INSERT/UPDATE: user_id = auth.uid() only

Concerns:
- No CHECK constraint on lat (-90..90) or lng (-180..180). Confirmed via anon RPC test.
- No retention policy / TTL. child_locations is upserted on user_id PK, so only the latest row remains; OK by design.

## location_history
Schema reference in vibe-coding-prompt.md:342-350 (id bigserial, user_id, family_id, lat numeric, lng numeric, recorded_at timestamptz, is_estimated boolean from 20260507000000).

RLS (from .planning/research/baselines/pg-policies-20260421.csv lines 41-46):
- INSERT: user_id = auth.uid()
- SELECT: family_id IN (SELECT get_my_family_ids())

Concerns:
- No CHECK on lat/lng range.
- No retention/TTL for location_history found in any migration. Children's trail rows accumulate indefinitely.
- unpair_child RPC (20260429000010) deletes child_locations, fcm_tokens, push_subscriptions, pending_notifications, child_audio_chunks — but NOT location_history. After parent unpairs a child, the full historical trail remains in DB.

## saved_places (20260418000006_saved_places.sql)
- location jsonb NOT NULL — coords inside JSON, no structural CHECK.
- INSERT/UPDATE: parent of family + premium tier required.
- DELETE: parent only.

## danger_zones (20260317100000_danger_zones_sticker_update.sql)
- lat double precision NOT NULL, lng double precision NOT NULL — no CHECK.
- radius_m integer DEFAULT 200 — no CHECK on radius bounds (e.g., negative or huge).
- INSERT/UPDATE/DELETE: parent of family only. SELECT: any family member.

## academies
No CREATE TABLE academies in supabase/migrations/ — only in supabase/archive/_deprecated_migration.sql:59 (id uuid, family_id uuid, name text, emoji text, category text, location jsonb). Deployed schema not visible from this checkout.

## RPCs

### upsert_child_location(p_user_id, p_family_id, p_lat, p_lng)
Not present in any file under supabase/migrations/. Live test confirms it is deployed:
- anon call with random uuids → 23503 FK violation (user_id not in auth.users) → 409.
- Live anon call with out-of-range lat=999.9, lng=-999.9 → only FK blocked it. If the FK had matched (e.g., a legitimate user_id), the row would be written verbatim — no lat/lng sanity check inside the RPC.

### record_location_history_rows(p_rows jsonb) — 20260506020000 + 20260507000000
- SECURITY DEFINER, bypasses RLS.
- Per-row authz: each row's user_id-family_id pair must exist in family_members. If absent → CONTINUE (skip silently).
- No lat/lng range validation. NULLIF(...)::double precision accepts 999.9.
- EXCEPTION WHEN OTHERS THEN CONTINUE — invalid rows swallowed silently within a batch.
- GRANT EXECUTE ... TO anon, authenticated — anon can call. With a stolen (user_id, family_id) pair, anyone could append arbitrary history rows.
