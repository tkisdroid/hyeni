import { supabase } from "./supabase.js";

// ── localStorage cache keys ─────────────────────────────────────────────────
const LS_EVENTS = "hyeni-events";
const LS_ACADEMIES = "hyeni-academies";
const LS_MEMOS = "hyeni-memos";

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { /* parse failed, ignore */ return fallback; }
}
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

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
    created_by: userId,
  };
}

function rowsToEventMap(rows) {
  const map = {};
  for (const row of rows) {
    const dk = row.date_key;
    if (!map[dk]) map[dk] = [];
    map[dk].push(rowToEvent(row));
    map[dk].sort((a, b) => a.time.localeCompare(b.time));
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

export function subscribeFamily(familyId, callbacks) {
  const { onEventsChange, onAcademiesChange, onMemosChange, onMemoRepliesChange, onLocationChange, onKkuk } = callbacks;
  let retryCount = 0;
  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 2000;
  let retryTimer = null;
  let disposed = false;

  const channel = supabase
    .channel(`family-${familyId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "events",
      filter: `family_id=eq.${familyId}`,
    }, (payload) => {
      onEventsChange(payload.eventType, payload.new, payload.old);
    })
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "academies",
      filter: `family_id=eq.${familyId}`,
    }, (payload) => {
      onAcademiesChange(payload.eventType, payload.new, payload.old);
    })
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "memos",
      filter: `family_id=eq.${familyId}`,
    }, (payload) => {
      onMemosChange(payload.eventType, payload.new, payload.old);
    })
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "memo_replies",
      filter: `family_id=eq.${familyId}`,
    }, (payload) => {
      if (onMemoRepliesChange) onMemoRepliesChange(payload.new);
    })
    .on("broadcast", { event: "child_location" }, (payload) => {
      if (onLocationChange) onLocationChange(payload.payload);
    })
    .on("broadcast", { event: "kkuk" }, (payload) => {
      if (onKkuk) onKkuk(payload.payload);
    })
    .on("broadcast", { event: "remote_listen_start" }, (payload) => {
      if (callbacks.onRemoteListenStart) callbacks.onRemoteListenStart(payload.payload);
    })
    .on("broadcast", { event: "remote_listen_stop" }, (payload) => {
      if (callbacks.onRemoteListenStop) callbacks.onRemoteListenStop(payload.payload);
    })
    .on("broadcast", { event: "audio_chunk" }, (payload) => {
      if (callbacks.onAudioChunk) callbacks.onAudioChunk(payload.payload);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[Realtime] Subscribed to family:", familyId);
        retryCount = 0;
      }
      if (status === "CHANNEL_ERROR" && !disposed) {
        console.error("[Realtime] Channel error, attempting reconnect...");
        if (retryCount < MAX_RETRIES) {
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), 60000);
          retryCount++;
          console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
          retryTimer = setTimeout(() => {
            if (disposed) return;
            try { channel.subscribe(); } catch { /* ignored */ }
          }, delay);
        } else {
          console.error("[Realtime] Max retries reached. Realtime disabled until page reload.");
        }
      }
      if (status === "CLOSED") {
        console.log("[Realtime] Channel closed");
      }
    });

  // Attach dispose method so caller can clean up retry timers
  channel._dispose = () => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
  };

  return channel;
}

export function unsubscribe(channel) {
  if (!channel) return;
  if (channel._dispose) channel._dispose();
  supabase.removeChannel(channel);
}

// ── Cached reads (for offline / initial load) ───────────────────────────────

export function getCachedEvents() { return lsGet(LS_EVENTS, {}); }
export function getCachedAcademies() { return lsGet(LS_ACADEMIES, []); }
export function getCachedMemos() { return lsGet(LS_MEMOS, {}); }

// ── Cache writers (called after realtime updates) ───────────────────────────

export function cacheEvents(eventMap) { lsSet(LS_EVENTS, eventMap); }
export function cacheAcademies(list) { lsSet(LS_ACADEMIES, list); }
export function cacheMemos(memoMap) { lsSet(LS_MEMOS, memoMap); }

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
