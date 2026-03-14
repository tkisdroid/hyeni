# Supabase Integration Design — Kids Scheduler

## Overview

학부모-아이 일정 동기화 앱(React + Vite)에 Supabase를 추가하여 크로스 디바이스 실시간 동기화를 구현한다.

## Goals

1. 부모 폰에서 등록한 일정이 아이 폰에 실시간 반영
2. 부모는 카카오 소셜 로그인, 아이는 로그인 없이 페어링 코드로 연결
3. 오프라인 시 읽기 캐시(localStorage)로 마지막 동기화된 일정 열람 가능

## Architecture

```
Parent Device (Kakao OAuth)        Child Device (Anonymous + Pair Code)
        │                                    │
        └────────── Supabase ───────────────┘
                    ├─ Auth (Kakao / Anonymous)
                    ├─ Database (PostgreSQL)
                    └─ Realtime (postgres_changes)
```

- Parent: Kakao login → CRUD events → Supabase INSERT/UPDATE/DELETE → Realtime broadcast → Child receives
- Child: Anonymous auth → Pair code join → Subscribe to family events → Auto-reflect + localStorage cache

## Database Schema

### families

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| parent_id | uuid | NOT NULL, references auth.users(id) | Kakao-authenticated parent |
| pair_code | text | UNIQUE, NOT NULL | KID- + 8 alphanumeric chars |
| parent_name | text | | Display name |
| created_at | timestamptz | default now() | |

pair_code uses 8 chars (36^8 ≈ 2.8 trillion combinations) to resist brute-force.

### family_members

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| family_id | uuid | NOT NULL, FK → families(id) ON DELETE CASCADE | |
| user_id | uuid | NOT NULL, references auth.users(id) | |
| role | text | NOT NULL, CHECK (role IN ('parent','child')) | |
| name | text | NOT NULL | Display name |
| emoji | text | default '🐰' | Avatar emoji |
| created_at | timestamptz | default now() | |

Unique constraint: (family_id, user_id)

### events

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | Client generates UUID before INSERT |
| family_id | uuid | NOT NULL, FK → families(id) ON DELETE CASCADE | |
| date_key | text | NOT NULL | Format: "YYYY-M-D" (month is 0-indexed, matching JS Date.getMonth()) |
| title | text | NOT NULL | |
| time | text | NOT NULL | "HH:MM" |
| category | text | NOT NULL | school, sports, hobby, family, friend, other |
| emoji | text | NOT NULL | |
| color | text | NOT NULL | Hex color |
| bg | text | NOT NULL | Background hex |
| memo | text | default '' | |
| location | jsonb | | { lat, lng, address } or null |
| notif_override | jsonb | | Maps to app's notifOverride. Structure: { childEnabled, parentEnabled, minutesBefore: number[] } |
| created_by | uuid | NOT NULL, references auth.users(id) | |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | Updated via trigger on row change |

**ID strategy**: Client generates UUID via `crypto.randomUUID()` before INSERT. This replaces the current `Date.now()` pattern and eliminates client-server ID reconciliation. The same UUID is used in local state and Supabase.

### memos

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| family_id | uuid | NOT NULL, FK → families(id) ON DELETE CASCADE | |
| date_key | text | NOT NULL | Same format as events.date_key |
| content | text | default '' | |
| updated_at | timestamptz | default now() | |

Unique constraint: (family_id, date_key) — one memo per day per family.

### academies

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| family_id | uuid | NOT NULL, FK → families(id) ON DELETE CASCADE | |
| name | text | NOT NULL | |
| emoji | text | NOT NULL | |
| category | text | NOT NULL | |
| location | jsonb | | { lat, lng, address } or null |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

Note: `color` and `bg` are NOT stored in DB. The client derives them from `category` via the `CATEGORIES` constant. **Migration note**: The current `AcademyManager` stores `color`/`bg` on the object; the client code must be updated to derive these at read time instead.

### Database Trigger

```sql
-- Auto-update updated_at on events
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER memos_updated_at BEFORE UPDATE ON memos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER academies_updated_at BEFORE UPDATE ON academies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Authentication

### Parent Flow

1. Click "부모" role → Kakao OAuth via `supabase.auth.signInWithOAuth({ provider: 'kakao' })`
2. Supabase redirects to Kakao → user authorizes → redirects back to app
3. On success → check if `families` row exists for this user
4. If not → INSERT into `families` with generated pair_code + INSERT into `family_members` with role='parent'
5. Show pair_code for sharing with child

**Kakao OAuth setup prerequisites:**
- Supabase Dashboard → Authentication → Providers → Kakao 활성화
- Kakao Developer Console → 앱 설정 → 카카오 로그인 → Redirect URI에 `https://<supabase-project>.supabase.co/auth/v1/callback` 등록

### Child Flow

1. Click "아이" role → `supabase.auth.signInAnonymously()` 자동 호출
2. Enter pair_code → query `families` where pair_code matches (via RPC function with rate limiting)
3. INSERT into `family_members` with role='child', family_id from matched family
4. Subscribe to realtime events for that family_id

**Anonymous session lifecycle:**
- Supabase persists anonymous session in localStorage automatically
- If child clears browser data → new anonymous user created → can re-pair with the same pair_code
- Parent can see connected children in PairingModal; stale entries auto-clean on re-pair (UPSERT on family_id + role='child')
- Configure Supabase anonymous user expiry to 365 days (Dashboard → Auth → Settings)

### Pair Code Security

```sql
-- Rate-limited pair code lookup (Supabase Edge Function or RPC)
CREATE OR REPLACE FUNCTION join_family(p_pair_code text, p_user_id uuid, p_name text)
RETURNS uuid AS $$
DECLARE
  v_family_id uuid;
  v_attempt_count int;
BEGIN
  -- Rate limit: max 5 attempts per user per hour
  SELECT count(*) INTO v_attempt_count
  FROM pair_attempts
  WHERE user_id = p_user_id AND attempted_at > now() - interval '1 hour';

  IF v_attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many attempts. Try again later.';
  END IF;

  INSERT INTO pair_attempts (user_id) VALUES (p_user_id);

  SELECT id INTO v_family_id FROM families WHERE pair_code = p_pair_code;
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid pair code';
  END IF;

  INSERT INTO family_members (family_id, user_id, role, name)
  VALUES (v_family_id, p_user_id, 'child', p_name)
  ON CONFLICT (family_id, user_id) DO UPDATE SET name = p_name;

  RETURN v_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### pair_attempts (rate limiting table)

| Column | Type | Constraints |
|--------|------|-------------|
| id | bigint | PK, generated always as identity |
| user_id | uuid | NOT NULL |
| attempted_at | timestamptz | default now() |

Index on (user_id, attempted_at). Cleanup: records older than 24h are auto-deleted via a Supabase pg_cron job (`DELETE FROM pair_attempts WHERE attempted_at < now() - interval '24 hours'` every hour).

### Session Persistence

Supabase JS client persists sessions in localStorage automatically. On app reload, `supabase.auth.getSession()` restores the session without re-login.

## Realtime Sync

### Subscription (Child & Parent)

```js
supabase
  .channel('family-events')
  .on('postgres_changes', {
    event: '*',        // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'events',
    filter: `family_id=eq.${familyId}`
  }, (payload) => {
    if (payload.eventType === 'INSERT') {
      // Add to local state under payload.new.date_key
    } else if (payload.eventType === 'UPDATE') {
      // Replace matching event by id in local state
    } else if (payload.eventType === 'DELETE') {
      // Remove by id from local state
    }
    // Mirror updated state to localStorage
  })
  .subscribe()
```

Same pattern for `academies` and `memos` tables.

**Reconnection:** Supabase Realtime auto-reconnects on disconnect. The client library handles exponential backoff internally. On reconnect, do a full fetch to catch any missed events during downtime.

### Write Path (Parent only)

| Operation | Current Code | Supabase Code |
|-----------|-------------|---------------|
| Add event | `setEvents(prev => {...})` | `supabase.from('events').insert({...})` → Realtime propagates |
| Update event | `updateEvField(id, field, value)` | `supabase.from('events').update({[field]: value}).eq('id', id)` |
| Delete event | `deleteEvent(id)` | `supabase.from('events').delete().eq('id', id)` |
| Add academy | `setAcademies(prev => [...prev, item])` | `supabase.from('academies').insert({...})` |
| Update academy | `setList(prev => prev.map(...))` | `supabase.from('academies').update({...}).eq('id', id)` |
| Delete academy | `removeItem(idx)` | `supabase.from('academies').delete().eq('id', id)` |
| Save memo | `setMemos(prev => ({...prev, [dk]: val}))` | `supabase.from('memos').upsert({family_id, date_key, content})` |

All writes go through Supabase. Local state updates come back via Realtime subscription (no optimistic update needed since latency is typically <100ms).

### Data Transformation: Flat Rows ↔ Nested State

The app stores events as `{ [dateKey]: Event[] }`. Supabase stores flat rows.

**sync.js transformation layer:**

```js
// Supabase rows → App state
function rowsToEventMap(rows) {
  const map = {};
  for (const row of rows) {
    const dk = row.date_key;
    if (!map[dk]) map[dk] = [];
    map[dk].push({
      id: row.id,
      title: row.title,
      time: row.time,
      category: row.category,
      emoji: row.emoji,
      color: row.color,
      bg: row.bg,
      memo: row.memo,
      location: row.location,
      notifOverride: row.notif_override,  // snake_case → camelCase
    });
    map[dk].sort((a, b) => a.time.localeCompare(b.time));
  }
  return map;
}

// App event → Supabase row
function eventToRow(ev, familyId, dateKey, userId) {
  return {
    id: ev.id,
    family_id: familyId,
    date_key: dateKey,
    title: ev.title,
    time: ev.time,
    category: ev.category,
    emoji: ev.emoji,
    color: ev.color,
    bg: ev.bg,
    memo: ev.memo || '',
    location: ev.location,
    notif_override: ev.notifOverride,  // camelCase → snake_case
    created_by: userId,
  };
}
```

### Read Cache (Offline)

- Every time events are fetched or received via Realtime, mirror to localStorage
- On app load: show localStorage data immediately, then fetch fresh from Supabase
- If fetch fails (offline): continue showing cached data with a "오프라인 모드" indicator

## Row Level Security (RLS)

All tables have RLS enabled.

### families

```sql
-- SELECT: family member or parent
CREATE POLICY "families_select" ON families FOR SELECT USING (
  parent_id = auth.uid()
  OR id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- INSERT: any authenticated user can create a family
CREATE POLICY "families_insert" ON families FOR INSERT WITH CHECK (
  parent_id = auth.uid()
);

-- UPDATE: parent only
CREATE POLICY "families_update" ON families FOR UPDATE USING (
  parent_id = auth.uid()
);

-- DELETE: parent only
CREATE POLICY "families_delete" ON families FOR DELETE USING (
  parent_id = auth.uid()
);
```

### family_members

```sql
-- SELECT: same family
CREATE POLICY "members_select" ON family_members FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- INSERT: via join_family RPC only (SECURITY DEFINER bypasses RLS)
-- Direct INSERT blocked by RLS; only the RPC function can insert
CREATE POLICY "members_insert" ON family_members FOR INSERT WITH CHECK (false);

-- DELETE: parent of the family only
CREATE POLICY "members_delete" ON family_members FOR DELETE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
```

### events

```sql
-- SELECT: family member
CREATE POLICY "events_select" ON events FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- INSERT: parent only, created_by must match
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  AND created_by = auth.uid()
);

-- UPDATE/DELETE: parent of the family (can modify any event in family)
CREATE POLICY "events_update" ON events FOR UPDATE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "events_delete" ON events FOR DELETE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
```

### memos

```sql
CREATE POLICY "memos_select" ON memos FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "memos_insert" ON memos FOR INSERT WITH CHECK (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "memos_update" ON memos FOR UPDATE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "memos_delete" ON memos FOR DELETE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
```

### academies

```sql
CREATE POLICY "academies_select" ON academies FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "academies_insert" ON academies FOR INSERT WITH CHECK (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "academies_update" ON academies FOR UPDATE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
CREATE POLICY "academies_delete" ON academies FOR DELETE USING (
  family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
);
```

## File Structure

```
src/
  App.jsx              ← UI logic (existing, modified to call sync functions)
  lib/
    supabase.js        ← createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    auth.js            ← kakaoLogin(), anonymousLogin(), joinFamily(pairCode), getFamily(), logout()
    sync.js            ← fetchEvents(), subscribeFamily(), insertEvent(), updateEvent(), deleteEvent()
                         upsertMemo(), fetchAcademies(), insertAcademy(), updateAcademy(), deleteAcademy()
                         rowsToEventMap(), eventToRow() transformations
                         localStorage mirror on every fetch/realtime update
```

## Environment Variables

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_KAKAO_APP_KEY=d9917812629a13b6fe351fa025be439c   (existing)
```

## Migration from Current Architecture

### What changes

| Current | After Supabase |
|---------|---------------|
| localStorage only | Supabase DB + localStorage read cache |
| BroadcastChannel (same browser) | Supabase Realtime (cross-device) |
| `Date.now()` for event IDs | `crypto.randomUUID()` (UUID) |
| `randCode()` local only | pair_code in families table (8 chars) |
| No auth | Kakao OAuth (parent) + Anonymous (child) |
| Role in localStorage | Role from family_members table |
| Events as nested `{dateKey: Event[]}` only | Flat DB rows + transform layer |
| No memos sync | memos table synced |
| UPDATE/DELETE local only | Full CRUD via Supabase |

### What stays the same

- All UI components (calendar, timetable, route overlay, map, academy manager)
- Kakao Maps integration
- Geofencing, advance notifications, emergency checks (all client-side timers)
- Voice input NLP parser
- Offline read via localStorage cache
- `globalNotif` settings remain device-local (not synced)

### Existing data migration

On first authenticated login, if localStorage contains events/academies from the old system:
1. Upload them to Supabase (bulk INSERT)
2. Clear old localStorage keys
3. Switch to new sync-based flow

This is a one-time migration that runs only if old `kids-sched-events` localStorage key exists AND user has a valid family_id.

## Out of Scope

- Push notifications (Web Push / FCM) — future enhancement
- Multiple children per family — schema supports it, UI currently handles single child
- Chat between parent and child
- Image/file attachments on events
- Conflict resolution (last-write-wins via updated_at is sufficient for this use case)
- App.jsx refactoring into smaller files — separate effort
