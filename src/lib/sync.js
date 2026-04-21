import { supabase } from "./supabase.js";

// ── localStorage cache keys ─────────────────────────────────────────────────
const LS_EVENTS = "hyeni-events";
const LS_ACADEMIES = "hyeni-academies";
const LS_MEMOS = "hyeni-memos";
const LS_SAVED_PLACES = "hyeni-saved-places";

// ── Circuit breaker + exponential backoff (Phase 3 P1-5, D-B01/B02/B05) ─────
// Module-scoped registry. One BreakerState per named caller (keyed by
// function name). fetchSavedPlaces is the first + only subscriber this
// phase; fetchAcademies / fetchEvents stay on their existing polling
// until a future phase opts them in.
//
// State machine:
//   CLOSED        — normal operation. Every call passes through.
//                   recordSuccess() resets counters.
//                   recordFailure() increments; at 3 consecutive within
//                   60s, transitions to OPEN.
//   OPEN          — every call short-circuits with { error: 'circuit_open' }.
//                   openUntil tracks wall-clock wake time (5 min default).
//                   The next call AFTER openUntil transitions back to
//                   CLOSED via isOpen()=false on the probe attempt.
//
// Design notes:
//  - 429 (rate limit) bypasses the breaker: it is a deliberate server
//    signal, not a degraded-resource signal. Caller should honor
//    Retry-After and re-queue instead of tripping cooldown.
//  - No internal retry inside fetchSavedPlaces — the polling caller owns
//    retry timing via backoffDelay() so UI state + interval spacing stay
//    coherent.
const breakers = new Map();

function getBreaker(name) {
  if (!breakers.has(name)) {
    breakers.set(name, { failures: 0, firstFailureAt: 0, openUntil: 0 });
  }
  return breakers.get(name);
}

function recordSuccess(name) {
  const b = getBreaker(name);
  b.failures = 0;
  b.firstFailureAt = 0;
  b.openUntil = 0;
}

function recordFailure(name) {
  const b = getBreaker(name);
  const now = Date.now();
  // Fresh chain if first ever OR prior failure older than 60s.
  if (b.failures === 0 || now - b.firstFailureAt > 60_000) {
    b.failures = 1;
    b.firstFailureAt = now;
  } else {
    b.failures += 1;
  }
  if (b.failures >= 3) {
    b.openUntil = now + 5 * 60_000; // 5-minute cooldown per D-B02
    b.failures = 0;
    b.firstFailureAt = 0;
  }
}

function isOpen(name) {
  return getBreaker(name).openUntil > Date.now();
}

// Exponential backoff with ±20% jitter. attempt=0 → ~2s, 1 → ~4s, ...,
// capped at 60s per D-B01.
export function backoffDelay(attempt) {
  const base = Math.min(2000 * Math.pow(2, Math.max(0, attempt)), 60_000);
  const jitter = base * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}

// Consumed by the polling caller to coordinate UI banner timing + next
// tick calculation. Shape: { open: bool, openUntilMs: number,
// failures: number, firstFailureAt: number }.
export function getBreakerState(name) {
  const b = getBreaker(name);
  return {
    open: b.openUntil > Date.now(),
    openUntilMs: b.openUntil,
    failures: b.failures,
    firstFailureAt: b.firstFailureAt,
  };
}

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (error) { void error; return fallback; }
}
function lsSet(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (error) {
    void error;
  }
}

// ── Data transformation: DB rows ↔ App state ────────────────────────────────

const CATEGORIES = {
  school: { color: "#A78BFA", bg: "#EDE9FE" },
  sports: { color: "#34D399", bg: "#D1FAE5" },
  hobby:  { color: "#F59E0B", bg: "#FEF3C7" },
  family: { color: "#F87171", bg: "#FEE2E2" },
  friend: { color: "#60A5FA", bg: "#DBEAFE" },
  other:  { color: "#EC4899", bg: "#FCE7F3" },
};

function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    time: row.time,
    category: row.category,
    emoji: row.emoji,
    color: row.color,
    bg: row.bg,
    memo: row.memo || "",
    location: row.location,
    notifOverride: row.notif_override,
    endTime: row.end_time || null,
  };
}

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
    memo: ev.memo || "",
    location: ev.location || null,
    notif_override: ev.notifOverride || null,
    end_time: ev.endTime || null,
    created_by: userId,
  };
}

function rowsToEventMap(rows) {
  const map = {};
  for (const row of rows) {
    const dk = row.date_key;
    if (!map[dk]) map[dk] = [];
    map[dk].push(rowToEvent(row));
    map[dk].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }
  return map;
}

function rowToAcademy(row) {
  const cat = CATEGORIES[row.category] || CATEGORIES.other;
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    category: row.category,
    color: cat.color,
    bg: cat.bg,
    location: row.location,
    schedule: row.schedule,
  };
}

function academyToRow(ac, familyId) {
  return {
    id: ac.id,
    family_id: familyId,
    name: ac.name,
    emoji: ac.emoji,
    category: ac.category,
    location: ac.location || null,
    schedule: ac.schedule || null,
  };
}

function rowToSavedPlace(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function savedPlaceToRow(place, familyId) {
  return {
    id: place.id,
    family_id: familyId,
    name: place.name,
    location: place.location || null,
  };
}

// ── Fetch all data for a family ─────────────────────────────────────────────

export async function fetchEvents(familyId) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("family_id", familyId);

  if (error) {
    console.error("[sync] fetchEvents error:", error);
    return lsGet(LS_EVENTS, {});
  }

  const map = rowsToEventMap(data || []);
  lsSet(LS_EVENTS, map);
  return map;
}

export async function fetchAcademies(familyId) {
  const { data, error } = await supabase
    .from("academies")
    .select("*")
    .eq("family_id", familyId);

  if (error) {
    console.error("[sync] fetchAcademies error:", error);
    return lsGet(LS_ACADEMIES, []);
  }

  const list = (data || []).map(rowToAcademy);
  lsSet(LS_ACADEMIES, list);
  return list;
}

export async function fetchMemos(familyId) {
  const { data, error } = await supabase
    .from("memos")
    .select("*")
    .eq("family_id", familyId);

  if (error) {
    console.error("[sync] fetchMemos error:", error);
    return lsGet(LS_MEMOS, {});
  }

  const map = {};
  for (const row of (data || [])) {
    map[row.date_key] = row.content;
  }
  lsSet(LS_MEMOS, map);
  return map;
}

// RES-01 / RES-02: circuit-breaker wrapped read. Preserves the legacy
// "return cached list on transient failure" contract but augments it with:
//   · short-circuit when breaker is OPEN (no network call, no log)
//   · recordFailure on network error or non-2xx (429 bypasses per D-B01)
//   · recordSuccess on 2xx so the banner can clear promptly
// Callers that need to distinguish "breaker open" vs "data" can pass
// {meta:true} to get {list, breaker} back instead of a bare list.
export async function fetchSavedPlaces(familyId, opts = {}) {
  const BREAKER_KEY = "fetchSavedPlaces";

  if (isOpen(BREAKER_KEY)) {
    const cached = lsGet(LS_SAVED_PLACES, []);
    if (opts.meta) return { list: cached, breaker: getBreakerState(BREAKER_KEY) };
    return cached;
  }

  const { data, error } = await supabase
    .from("saved_places")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at");

  if (error) {
    // HTTP 429 (rate limit) is a deliberate server signal — do NOT
    // contribute to breaker failure count. supabase-js surfaces the
    // PostgREST code on error.code / error.status; accept either shape.
    const code = String(error.code || error.status || "");
    const isRateLimit = code === "429" || code.includes("429");
    if (!isRateLimit) {
      recordFailure(BREAKER_KEY);
    }
    const state = getBreakerState(BREAKER_KEY);
    // Single consolidated log per failure (no spam). Format designed
    // to be grep-able: "[sync] fetchSavedPlaces degraded".
    console.warn(
      `[sync] fetchSavedPlaces degraded (failures: ${state.failures}, open: ${state.open})`,
      error.message || error
    );
    const cached = lsGet(LS_SAVED_PLACES, []);
    if (opts.meta) return { list: cached, breaker: state };
    return cached;
  }

  recordSuccess(BREAKER_KEY);
  const list = (data || []).map(rowToSavedPlace);
  lsSet(LS_SAVED_PLACES, list);
  if (opts.meta) return { list, breaker: getBreakerState(BREAKER_KEY) };
  return list;
}

// ── CRUD: Events ────────────────────────────────────────────────────────────

export async function insertEvent(ev, familyId, dateKey, userId) {
  const row = eventToRow(ev, familyId, dateKey, userId);
  const { error } = await supabase.from("events").insert(row);
  if (error) throw error;
}

export async function updateEvent(eventId, fields) {
  // Convert camelCase fields to snake_case where needed
  const dbFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === "notifOverride") dbFields.notif_override = v;
    else if (k === "endTime") dbFields.end_time = v;
    else dbFields[k] = v;
  }
  const { error } = await supabase
    .from("events")
    .update(dbFields)
    .eq("id", eventId);
  if (error) throw error;
}

export async function deleteEvent(eventId) {
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId);
  if (error) throw error;
}

// ── CRUD: Academies ─────────────────────────────────────────────────────────

export async function insertAcademy(ac, familyId) {
  const row = academyToRow(ac, familyId);
  const { error } = await supabase.from("academies").insert(row);
  if (error) throw error;
}

export async function updateAcademy(academyId, fields) {
  const { error } = await supabase
    .from("academies")
    .update(fields)
    .eq("id", academyId);
  if (error) throw error;
}

export async function deleteAcademy(academyId) {
  const { error } = await supabase
    .from("academies")
    .delete()
    .eq("id", academyId);
  if (error) throw error;
}

export async function insertSavedPlace(place, familyId) {
  const row = savedPlaceToRow(place, familyId);
  const { error } = await supabase.from("saved_places").insert(row);
  if (error) throw error;
}

export async function updateSavedPlace(placeId, fields) {
  const { error } = await supabase
    .from("saved_places")
    .update(fields)
    .eq("id", placeId);
  if (error) throw error;
}

export async function deleteSavedPlace(placeId) {
  const { error } = await supabase
    .from("saved_places")
    .delete()
    .eq("id", placeId);
  if (error) throw error;
}

// ── CRUD: Memos ─────────────────────────────────────────────────────────────

export async function upsertMemo(familyId, dateKey, content) {
  const { error } = await supabase
    .from("memos")
    .upsert(
      { family_id: familyId, date_key: dateKey, content },
      { onConflict: "family_id,date_key" }
    );
  if (error) throw error;
}

// ── Memo Replies ────────────────────────────────────────────────────────────

export async function fetchMemoReplies(familyId, dateKey) {
  const { data, error } = await supabase
    .from("memo_replies")
    .select("id, user_id, user_role, content, created_at")
    .eq("family_id", familyId)
    .eq("date_key", dateKey)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function insertMemoReply(familyId, dateKey, userId, userRole, content) {
  const { error } = await supabase
    .from("memo_replies")
    .insert({ family_id: familyId, date_key: dateKey, user_id: userId, user_role: userRole, content });
  if (error) throw error;
}

// ── Memo Read Status ────────────────────────────────────────────────────────

export async function markMemoRead(familyId, dateKey, userId) {
  // Atomic: use RPC to append userId only if not already present
  const { error } = await supabase.rpc("mark_memo_read", {
    p_family_id: familyId,
    p_date_key: dateKey,
    p_user_id: userId,
  });
  if (error) console.error("[markMemoRead]", error);
}

// ── Child location (DB-persisted) ───────────────────────────────────────────

export async function saveChildLocation(userId, familyId, lat, lng) {
  // Use SECURITY DEFINER RPC — works even if auth token is expired
  const { error } = await supabase.rpc("upsert_child_location", {
    p_user_id: userId,
    p_family_id: familyId,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) console.error("[saveChildLocation]", error);
}

export async function saveLocationHistory(userId, familyId, lat, lng) {
  const { error } = await supabase
    .from("location_history")
    .insert({ user_id: userId, family_id: familyId, lat, lng });
  if (error) console.error("[saveLocationHistory]", error);
}

export async function fetchTodayLocationHistory(familyId) {
  const { data: members } = await supabase
    .from("family_members")
    .select("user_id")
    .eq("family_id", familyId)
    .eq("role", "child");
  const childUserIds = (members || []).map(m => m.user_id);
  if (!childUserIds.length) return [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("location_history")
    .select("lat, lng, recorded_at")
    .eq("family_id", familyId)
    .in("user_id", childUserIds)
    .gte("recorded_at", todayStart.toISOString())
    .order("recorded_at", { ascending: true });

  if (error) { console.error("[fetchTodayLocationHistory]", error); return []; }
  return data || [];
}

export async function fetchChildLocations(familyId) {
  // Step 1: get user_ids that are role='child' in this family
  const { data: members } = await supabase
    .from("family_members")
    .select("user_id")
    .eq("family_id", familyId)
    .eq("role", "child");
  const childUserIds = (members || []).map(m => m.user_id);
  if (!childUserIds.length) return [];

  // Step 2: fetch their locations
  const { data, error } = await supabase
    .from("child_locations")
    .select("user_id, lat, lng, updated_at")
    .eq("family_id", familyId)
    .in("user_id", childUserIds);
  if (error) { console.error("[fetchChildLocations]", error); return []; }
  return data || [];
}

// ── Realtime subscription ───────────────────────────────────────────────────
//
// Phase 2 Stream B refactor (D-B02, STACK.md §Issue #2 Part B):
// Per-table channel pattern prevents the "one bad binding kills all bindings"
// failure mode from supabase-js#1917. Previously all postgres_changes bindings
// and all broadcast bindings were colocated on a single `family-${familyId}`
// channel — a single CHANNEL_ERROR (e.g. missing publication membership for
// saved_places before Phase 2 Task 2) took down every subscription.
//
// Channel layout:
//   family-{familyId}              — broadcast only (kkuk, child_location,
//                                    remote_listen_start/stop, audio_chunk)
//                                    per D-B06 — kept under exact pre-existing
//                                    name so client senders + Edge Functions
//                                    keep working without edits. THIS channel
//                                    is what callers receive and use for .send().
//   events-{familyId}              — postgres_changes: events        (RT-03)
//   academies-{familyId}           — postgres_changes: academies
//   memos-{familyId}               — postgres_changes: memos         (RT-03)
//   saved_places-{familyId}        — postgres_changes: saved_places  (RT-01)
//   family_subscription-{familyId} — postgres_changes: family_subscription (RT-02)
//   memo_replies-{familyId}        — postgres_changes: memo_replies  (RT-03)
//
// Each channel has independent CHANNEL_ERROR retry with its own counter —
// one broken binding never affects the others.
//
// Caller contract preserved: subscribeFamily returns the broadcast channel
// directly (same shape as before — .send(), .state, .subscribe() all work),
// with _dispose() + _channels attached so unsubscribe() can tear down all
// 7 channels in one call.

function subscribeTableChanges(channelName, tableName, familyId, eventSpec, handler) {
  // eventSpec: "*" for all events, or "INSERT"/"UPDATE"/"DELETE"
  let retryCount = 0;
  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 2000;
  let retryTimer = null;
  let disposed = false;

  const ch = supabase
    .channel(channelName)
    .on("postgres_changes", {
      event: eventSpec,
      schema: "public",
      table: tableName,
      filter: `family_id=eq.${familyId}`,
    }, (payload) => {
      if (handler) handler(payload.eventType, payload.new, payload.old);
    })
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log(`[Realtime] Subscribed to ${channelName}`);
        retryCount = 0;
      }
      if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !disposed) {
        console.error(`[Realtime] ${channelName} ${status}`, err);
        if (retryCount < MAX_RETRIES) {
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), 60000);
          retryCount++;
          console.log(`[Realtime] ${channelName} reconnecting in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
          retryTimer = setTimeout(() => {
            if (disposed) return;
            try { ch.subscribe(); } catch { /* ignored */ }
          }, delay);
        } else {
          console.error(`[Realtime] ${channelName} max retries reached; disabled until page reload.`);
        }
      }
      if (status === "CLOSED") {
        console.log(`[Realtime] ${channelName} closed`);
      }
    });

  ch._dispose = () => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
  };
  return ch;
}

export function subscribeFamily(familyId, callbacks) {
  const {
    onEventsChange,
    onAcademiesChange,
    onMemosChange,
    onMemoRepliesChange,
    onSavedPlacesChange,
    onFamilySubscriptionChange,   // NEW — RT-02 consumer wiring is out of Phase 2
                                  // scope (Qonversion integration is a later phase);
                                  // the channel must subscribe regardless so the
                                  // postgres_changes path is exercised end-to-end.
    onLocationChange,
    onKkuk,
    onRemoteListenStart,
    onRemoteListenStop,
    onAudioChunk,
  } = callbacks;

  // ── Per-table postgres_changes channels (D-B02) ──────────────────────────
  const eventsCh = subscribeTableChanges(
    `events-${familyId}`, "events", familyId, "*",
    onEventsChange
  );

  const academiesCh = subscribeTableChanges(
    `academies-${familyId}`, "academies", familyId, "*",
    onAcademiesChange
  );

  const memosCh = subscribeTableChanges(
    `memos-${familyId}`, "memos", familyId, "*",
    onMemosChange
  );

  const savedPlacesCh = subscribeTableChanges(
    `saved_places-${familyId}`, "saved_places", familyId, "*",
    onSavedPlacesChange
  );

  const familySubCh = subscribeTableChanges(
    `family_subscription-${familyId}`, "family_subscription", familyId, "*",
    onFamilySubscriptionChange  // undefined handler is fine — events simply drop
  );

  const memoRepliesCh = subscribeTableChanges(
    `memo_replies-${familyId}`, "memo_replies", familyId, "INSERT",
    onMemoRepliesChange
      ? (_eventType, newRow) => onMemoRepliesChange(newRow)
      : null
  );

  // ── Broadcast-only channel (D-B06) ───────────────────────────────────────
  // Kept under the exact pre-existing name `family-{familyId}` so kkuk/location/
  // remote_listen senders in App.jsx + the push-notify Edge Function keep
  // working without caller-side edits. Callers receive THIS channel back —
  // .send() + .state + .subscribe() all route through it unchanged.
  let broadcastRetryCount = 0;
  const BROADCAST_MAX_RETRIES = 10;
  const BROADCAST_BASE_DELAY_MS = 2000;
  let broadcastRetryTimer = null;
  let broadcastDisposed = false;

  const broadcastCh = supabase
    .channel(`family-${familyId}`)
    .on("broadcast", { event: "child_location" }, (payload) => {
      if (onLocationChange) onLocationChange(payload.payload);
    })
    .on("broadcast", { event: "kkuk" }, (payload) => {
      if (onKkuk) onKkuk(payload.payload);
    })
    .on("broadcast", { event: "remote_listen_start" }, (payload) => {
      if (onRemoteListenStart) onRemoteListenStart(payload.payload);
    })
    .on("broadcast", { event: "remote_listen_stop" }, (payload) => {
      if (onRemoteListenStop) onRemoteListenStop(payload.payload);
    })
    .on("broadcast", { event: "audio_chunk" }, (payload) => {
      if (onAudioChunk) onAudioChunk(payload.payload);
    })
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log(`[Realtime] Subscribed to family-${familyId} (broadcast)`);
        broadcastRetryCount = 0;
      }
      if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !broadcastDisposed) {
        console.error(`[Realtime] family-${familyId} ${status}`, err);
        if (broadcastRetryCount < BROADCAST_MAX_RETRIES) {
          const delay = Math.min(BROADCAST_BASE_DELAY_MS * Math.pow(2, broadcastRetryCount), 60000);
          broadcastRetryCount++;
          console.log(`[Realtime] family-${familyId} reconnecting in ${delay}ms (attempt ${broadcastRetryCount}/${BROADCAST_MAX_RETRIES})`);
          broadcastRetryTimer = setTimeout(() => {
            if (broadcastDisposed) return;
            try { broadcastCh.subscribe(); } catch { /* ignored */ }
          }, delay);
        } else {
          console.error(`[Realtime] family-${familyId} max retries reached; broadcast disabled until page reload.`);
        }
      }
      if (status === "CLOSED") {
        console.log(`[Realtime] family-${familyId} closed`);
      }
    });

  // All postgres_changes channels + the broadcast channel form the composite
  // subscription. Stored on the broadcast channel itself so a single handle
  // (the broadcast channel — callers already use it as a channel for .send()
  // and .state checks) carries the full cleanup responsibility.
  const postgresChannels = [eventsCh, academiesCh, memosCh, savedPlacesCh, familySubCh, memoRepliesCh];
  broadcastCh._channels = postgresChannels;
  broadcastCh._dispose = () => {
    broadcastDisposed = true;
    if (broadcastRetryTimer) clearTimeout(broadcastRetryTimer);
    postgresChannels.forEach((ch) => {
      try { ch._dispose?.(); } catch { /* ignored */ }
    });
  };

  return broadcastCh;
}

export function unsubscribe(channel) {
  if (!channel) return;
  // Stop any retry timers (both composite and any standalone per-table channels
  // that might somehow be passed in — belt-and-suspenders).
  if (channel._dispose) channel._dispose();
  // If this is a composite handle, remove the per-table postgres_changes channels
  // in addition to the broadcast channel itself.
  if (Array.isArray(channel._channels)) {
    channel._channels.forEach((ch) => {
      try { supabase.removeChannel(ch); } catch { /* ignored */ }
    });
  }
  try { supabase.removeChannel(channel); } catch { /* ignored */ }
}

// ── Cached reads (for offline / initial load) ───────────────────────────────

export function getCachedEvents() { return lsGet(LS_EVENTS, {}); }
export function getCachedAcademies() { return lsGet(LS_ACADEMIES, []); }
export function getCachedMemos() { return lsGet(LS_MEMOS, {}); }
export function getCachedSavedPlaces() { return lsGet(LS_SAVED_PLACES, []); }

// ── Cache writers (called after realtime updates) ───────────────────────────

export function cacheEvents(eventMap) { lsSet(LS_EVENTS, eventMap); }
export function cacheAcademies(list) { lsSet(LS_ACADEMIES, list); }
export function cacheMemos(memoMap) { lsSet(LS_MEMOS, memoMap); }
export function cacheSavedPlaces(list) { lsSet(LS_SAVED_PLACES, list); }

// ── Stickers ────────────────────────────────────────────────────────────────

export async function addSticker(userId, familyId, eventId, dateKey, stickerType, emoji, title) {
  const { error } = await supabase.rpc("add_sticker", {
    p_user_id: userId, p_family_id: familyId, p_event_id: eventId,
    p_date_key: dateKey, p_sticker_type: stickerType, p_emoji: emoji, p_title: title,
  });
  if (error) console.error("[addSticker]", error);
}

export async function fetchStickersForDate(familyId, dateKey) {
  const { data, error } = await supabase.rpc("get_stickers_for_date", {
    p_family_id: familyId, p_date_key: dateKey,
  });
  if (error) { console.error("[fetchStickers]", error); return []; }
  return data || [];
}

export async function fetchStickerSummary(familyId) {
  const { data, error } = await supabase.rpc("get_sticker_summary", {
    p_family_id: familyId,
  });
  if (error) { console.error("[fetchStickerSummary]", error); return []; }
  return data || [];
}

// ── Danger Zones ─────────────────────────────────────────────────────────────

export async function fetchDangerZones(familyId) {
  const { data, error } = await supabase
    .from("danger_zones")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at");
  if (error) { console.error("[fetchDangerZones]", error); return []; }
  return data || [];
}

export async function saveDangerZone(familyId, zone) {
  const { data, error } = await supabase
    .from("danger_zones")
    .insert({ family_id: familyId, name: zone.name, lat: zone.lat, lng: zone.lng, radius_m: zone.radius_m || 200, zone_type: zone.zone_type || "custom" })
    .select()
    .single();
  if (error) { console.error("[saveDangerZone]", error); throw error; }
  return data;
}

export async function deleteDangerZone(id) {
  const { error } = await supabase.from("danger_zones").delete().eq("id", id);
  if (error) { console.error("[deleteDangerZone]", error); throw error; }
}

// ── Parent Alerts (AI monitoring) ────────────────────────────────────────────

export async function fetchParentAlerts(familyId, limit = 20) {
  const { data, error } = await supabase.rpc("get_parent_alerts", {
    p_family_id: familyId, p_limit: limit,
  });
  if (error) { console.error("[fetchParentAlerts]", error); return []; }
  return data || [];
}

export async function markAlertRead(alertId) {
  const { error } = await supabase.rpc("mark_alert_read", {
    p_alert_id: alertId,
  });
  if (error) console.error("[markAlertRead]", error);
}
