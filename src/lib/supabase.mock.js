const DB_KEY = "hyeni-mock-db-v1";
const SESSION_KEY = "hyeni-mock-session-v1";
const MOCK_FLAG_KEY = "hyeni-mock-enabled";
const REALTIME_BUS_KEY = "hyeni-mock-realtime-v1";

const TABLES = [
  "families",
  "family_members",
  "events",
  "academies",
  "saved_places",
  "memos",
  "memo_replies",
  "child_locations",
  "location_history",
  "danger_zones",
  "parent_alerts",
  "push_subscriptions",
  "fcm_tokens",
  "stickers",
  "family_subscription",
];

let memoryDb = null;
let memorySession = null;
let memoryFlag = null;
let realtimeBus = null;
const authListeners = new Set();
const channels = new Set();
const runtimeId = randomId("runtime");

function hasWindow() {
  return typeof window !== "undefined";
}

function hasStorage() {
  return hasWindow() && !!window.localStorage;
}

function hasSessionStorage() {
  return hasWindow() && !!window.sessionStorage;
}

function safeReadJson(key, fallback) {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key, value) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures in private mode / quota issues
  }
}

function safeReadString(key) {
  if (!hasStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteString(key, value) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

function getRealtimeBus() {
  if (realtimeBus || !hasWindow() || typeof BroadcastChannel === "undefined") {
    return realtimeBus;
  }
  realtimeBus = new BroadcastChannel(REALTIME_BUS_KEY);
  realtimeBus.onmessage = (event) => {
    const message = event?.data;
    if (!message || message.runtimeId === runtimeId) return;
    if (message.type === "table_change") {
      dispatchTableChange(message.table, message.eventType, message.newRow, message.oldRow);
      return;
    }
    if (message.type === "broadcast") {
      dispatchBroadcast(message.channelName, message.event, message.payload);
    }
  };
  return realtimeBus;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix = "mock") {
  const cryptoId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return `${prefix}-${cryptoId}`;
}

function normalizeDb(input) {
  const next = {};
  for (const table of TABLES) {
    next[table] = Array.isArray(input?.[table]) ? input[table].map(clone) : [];
  }
  return next;
}

function createDefaultDb() {
  return normalizeDb({});
}

function readDb() {
  if (memoryDb) return clone(memoryDb);
  const stored = safeReadJson(DB_KEY, null);
  if (stored) {
    memoryDb = normalizeDb(stored);
    return clone(memoryDb);
  }
  memoryDb = createDefaultDb();
  safeWriteJson(DB_KEY, memoryDb);
  return clone(memoryDb);
}

function writeDb(nextDb) {
  memoryDb = normalizeDb(nextDb);
  safeWriteJson(DB_KEY, memoryDb);
  return clone(memoryDb);
}

function updateDb(mutator) {
  const working = readDb();
  mutator(working);
  return writeDb(working);
}

function readSession() {
  if (memorySession !== null) return clone(memorySession);
  let stored = null;
  if (hasSessionStorage()) {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      stored = null;
    }
  }
  memorySession = stored ? clone(stored) : null;
  return clone(memorySession);
}

function writeSession(session) {
  memorySession = session ? clone(session) : null;
  if (session && hasSessionStorage()) {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
  } else if (hasSessionStorage()) {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }
  return clone(memorySession);
}

function isMockEnabled() {
  if (memoryFlag !== null) return memoryFlag;
  const explicit = safeReadString(MOCK_FLAG_KEY);
  if (explicit === "0") {
    memoryFlag = false;
    return memoryFlag;
  }
  if (explicit === "1") {
    memoryFlag = true;
    return memoryFlag;
  }
  memoryFlag = true;
  return memoryFlag;
}

function setMockEnabled(enabled) {
  memoryFlag = !!enabled;
  safeWriteString(MOCK_FLAG_KEY, enabled ? "1" : "0");
}

function buildMockUser({
  id = randomId("user"),
  name = "부모",
  provider = "kakao",
  email = "",
  isAnonymous = false,
} = {}) {
  return {
    id,
    email,
    app_metadata: { provider },
    user_metadata: { name, provider },
    identities: [{ provider }],
    is_anonymous: isAnonymous,
    created_at: nowIso(),
  };
}

function buildSession(user) {
  return {
    access_token: randomId("access"),
    refresh_token: randomId("refresh"),
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: clone(user),
  };
}

function notifyAuth(event, session) {
  for (const listener of authListeners) {
    try {
      listener(event, clone(session));
    } catch (error) {
      console.error("[mock-supabase] auth listener error:", error);
    }
  }
}

function projectRow(row, columns) {
  if (!columns || columns === "*" || columns.includes("*")) return clone(row);
  const picked = {};
  for (const column of columns) {
    if (column in row) picked[column] = clone(row[column]);
  }
  return picked;
}

function parseColumns(selectClause) {
  if (!selectClause || selectClause === "*") return ["*"];
  return selectClause
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
    .map((column) => column.replace(/\s+/g, ""));
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const aTime = Date.parse(a);
  const bTime = Date.parse(b);
  if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return aTime - bTime;
  return String(a).localeCompare(String(b));
}

function matchFilter(row, filter) {
  if (!filter) return true;
  if (filter.type === "eq") return row?.[filter.column] === filter.value;
  if (filter.type === "in") return filter.values.includes(row?.[filter.column]);
  if (filter.type === "gte") return compareValues(row?.[filter.column], filter.value) >= 0;
  return true;
}

function parseRealtimeFilter(filter) {
  if (!filter || typeof filter !== "string") return null;
  const [column, operator, ...rest] = filter.split(".");
  if (!column || !operator || rest.length === 0) return null;
  return {
    column: column.split("=")[0],
    operator: filter.includes("=eq.") ? "eq" : operator,
    value: rest.join("."),
  };
}

function matchesRealtimeHandler(config, eventType, row) {
  if (!config) return false;
  if (config.table && config.table !== row?.__table) return false;
  if (config.event && config.event !== "*" && config.event !== eventType) return false;
  const filter = parseRealtimeFilter(config.filter);
  if (!filter) return true;
  if (filter.operator === "eq") return String(row?.[filter.column]) === String(filter.value);
  return true;
}

function dispatchTableChange(table, eventType, newRow, oldRow) {
  const payloadNew = newRow ? { ...clone(newRow), __table: table } : null;
  const payloadOld = oldRow ? { ...clone(oldRow), __table: table } : null;
  for (const channel of channels) {
    channel._emitTableChange(eventType, payloadNew, payloadOld);
  }
}

function emitTableChange(table, eventType, newRow, oldRow) {
  dispatchTableChange(table, eventType, newRow, oldRow);
  const bus = getRealtimeBus();
  bus?.postMessage({
    runtimeId,
    type: "table_change",
    table,
    eventType,
    newRow: clone(newRow),
    oldRow: clone(oldRow),
  });
}

function dispatchBroadcast(channelName, event, payload) {
  for (const channel of channels) {
    if (channel.name !== channelName) continue;
    channel._emitBroadcast(event, clone(payload));
  }
}

function emitBroadcast(channelName, event, payload) {
  dispatchBroadcast(channelName, event, payload);
  const bus = getRealtimeBus();
  bus?.postMessage({
    runtimeId,
    type: "broadcast",
    channelName,
    event,
    payload: clone(payload),
  });
}

function resolveConflictFields(table, options) {
  if (options?.onConflict) {
    return String(options.onConflict)
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);
  }
  if (table === "memos") return ["family_id", "date_key"];
  if (table === "push_subscriptions") return ["user_id", "endpoint"];
  if (table === "fcm_tokens") return ["user_id", "token"];
  if (table === "family_subscription") return ["family_id"];
  if (table === "family_members") return ["family_id", "user_id"];
  return ["id"];
}

function ensureRowDefaults(table, row) {
  const next = clone(row) || {};
  const timestamp = nowIso();
  if (!next.id && !["family_members", "child_locations", "fcm_tokens"].includes(table)) {
    next.id = randomId(table.slice(0, 3));
  }
  if (table === "families") {
    next.pair_code ||= `KID-${randomId("pair").replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
    next.parent_name ||= "부모";
    next.parent_id ||= null;
    next.mom_phone ||= "";
    next.dad_phone ||= "";
    next.user_tier ||= "free";
    next.subscription_tier ||= next.user_tier === "premium" ? "premium" : "free";
    next.created_at ||= timestamp;
  }
  if (table === "family_members") {
    next.name ||= next.role === "parent" ? "부모" : "아이";
    next.emoji ||= next.role === "parent" ? "👨‍👩‍👧" : "🐰";
    next.created_at ||= timestamp;
  }
  if (table === "events") {
    next.created_at ||= timestamp;
    next.updated_at ||= timestamp;
  }
  if (table === "academies") {
    next.created_at ||= timestamp;
    next.updated_at ||= timestamp;
  }
  if (table === "saved_places") {
    next.created_at ||= timestamp;
    next.updated_at ||= timestamp;
  }
  if (table === "memos") {
    next.read_by ||= [];
    next.updated_at ||= timestamp;
  }
  if (table === "memo_replies") {
    next.id ||= randomId("reply");
    next.created_at ||= timestamp;
  }
  if (table === "child_locations") {
    next.updated_at ||= timestamp;
  }
  if (table === "location_history") {
    next.id ||= randomId("trail");
    next.recorded_at ||= timestamp;
  }
  if (table === "danger_zones") {
    next.created_at ||= timestamp;
    next.zone_type ||= "custom";
    next.radius_m ||= 200;
  }
  if (table === "parent_alerts") {
    next.id ||= randomId("alert");
    next.created_at ||= timestamp;
    next.read ??= false;
  }
  if (table === "push_subscriptions") {
    next.created_at ||= timestamp;
    next.updated_at ||= timestamp;
  }
  if (table === "fcm_tokens") {
    next.created_at ||= timestamp;
    next.updated_at ||= timestamp;
  }
  if (table === "stickers") {
    next.id ||= randomId("sticker");
    next.created_at ||= timestamp;
  }
  if (table === "family_subscription") {
    next.status ||= "expired";
    next.product_id ||= "premium_monthly";
    next.qonversion_user_id ||= next.family_id;
    next.updated_at ||= timestamp;
  }
  return next;
}

function updateFamilyTierFromSubscription(db, familyId) {
  const family = db.families.find((row) => row.id === familyId);
  if (!family) return;
  const subscription = db.family_subscription.find((row) => row.family_id === familyId);
  const premiumStatuses = new Set(["trial", "active", "grace"]);
  const tier = premiumStatuses.has(subscription?.status) ? "premium" : "free";
  family.subscription_tier = tier;
  family.user_tier = tier;
}

function getFamilyByPairCode(db, pairCode) {
  return db.families.find(
    (family) => String(family.pair_code || "").toUpperCase() === String(pairCode || "").toUpperCase()
  );
}

class MockQueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.action = "select";
    this.filters = [];
    this.limitValue = null;
    this.orderBy = null;
    this.singleMode = null;
    this.selectColumns = ["*"];
    this.returning = false;
    this.payload = null;
    this.options = {};
  }

  select(columns = "*") {
    this.selectColumns = parseColumns(columns);
    if (this.action !== "select") {
      this.returning = true;
      return this;
    }
    this.action = "select";
    return this;
  }

  insert(value) {
    this.action = "insert";
    this.payload = Array.isArray(value) ? value.map(clone) : [clone(value)];
    return this;
  }

  upsert(value, options = {}) {
    this.action = "upsert";
    this.payload = Array.isArray(value) ? value.map(clone) : [clone(value)];
    this.options = options;
    return this;
  }

  update(value) {
    this.action = "update";
    this.payload = clone(value);
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: "in", column, values: Array.isArray(values) ? values : [] });
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  order(column, options = {}) {
    this.orderBy = { column, ascending: options.ascending !== false };
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  async execute() {
    try {
      const result = this.client._executeQuery(this);
      return result;
    } catch (error) {
      return { data: null, error };
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

class MockRealtimeChannel {
  constructor(name) {
    this.name = name;
    this.handlers = [];
    this.statusCallback = null;
    this.state = "closed";
  }

  on(type, config, callback) {
    this.handlers.push({ type, config, callback });
    return this;
  }

  subscribe(statusCallback) {
    this.statusCallback = statusCallback;
    this.state = "joined";
    getRealtimeBus();
    channels.add(this);
    queueMicrotask(() => {
      try {
        this.statusCallback?.("SUBSCRIBED");
      } catch (error) {
        console.error("[mock-supabase] channel subscribe callback error:", error);
      }
    });
    return this;
  }

  send(message) {
    if (message?.type === "broadcast" && message?.event) {
      emitBroadcast(this.name, message.event, message.payload || {});
    }
    return Promise.resolve({ status: "ok" });
  }

  _emitTableChange(eventType, newRow, oldRow) {
    for (const handler of this.handlers) {
      if (handler.type !== "postgres_changes") continue;
      const row = newRow || oldRow;
      if (!matchesRealtimeHandler(handler.config, eventType, row || {})) continue;
      try {
        handler.callback({
          eventType,
          new: newRow ? clone(newRow) : {},
          old: oldRow ? clone(oldRow) : {},
        });
      } catch (error) {
        console.error("[mock-supabase] postgres handler error:", error);
      }
    }
  }

  _emitBroadcast(event, payload) {
    for (const handler of this.handlers) {
      if (handler.type !== "broadcast") continue;
      if (handler.config?.event !== event) continue;
      try {
        handler.callback({ event, payload: clone(payload) });
      } catch (error) {
        console.error("[mock-supabase] broadcast handler error:", error);
      }
    }
  }
}

class MockSupabaseClient {
  constructor() {
    this.auth = {
      signInWithOAuth: async ({ provider }) => {
        const displayName = provider === "kakao" ? "혜니 부모" : "테스트 사용자";
        const user = buildMockUser({
          name: displayName,
          provider: provider || "oauth",
          email: provider === "kakao" ? "parent@hyeni.mock" : "",
          isAnonymous: false,
        });
        const session = buildSession(user);
        writeSession(session);
        notifyAuth("SIGNED_IN", session);
        return {
          data: { provider, url: hasWindow() ? window.location.href : "", session: clone(session) },
          error: null,
        };
      },
      signInAnonymously: async () => {
        const user = buildMockUser({
          name: "아이",
          provider: "anonymous",
          email: "",
          isAnonymous: true,
        });
        const session = buildSession(user);
        writeSession(session);
        notifyAuth("SIGNED_IN", session);
        return { data: { user: clone(user), session: clone(session) }, error: null };
      },
      getSession: async () => ({ data: { session: readSession() }, error: null }),
      getUser: async () => ({ data: { user: readSession()?.user || null }, error: null }),
      setSession: async ({ access_token, refresh_token }) => {
        const existing = readSession();
        const session =
          existing ||
          buildSession(
            buildMockUser({
              name: "혜니 부모",
              provider: "kakao",
              email: "parent@hyeni.mock",
            })
          );
        session.access_token = access_token || session.access_token;
        session.refresh_token = refresh_token || session.refresh_token;
        writeSession(session);
        notifyAuth("SIGNED_IN", session);
        return { data: { session: clone(session) }, error: null };
      },
      exchangeCodeForSession: async () => {
        const session = buildSession(
          buildMockUser({
            name: "혜니 부모",
            provider: "kakao",
            email: "parent@hyeni.mock",
          })
        );
        writeSession(session);
        notifyAuth("SIGNED_IN", session);
        return { data: { session: clone(session) }, error: null };
      },
      signOut: async () => {
        writeSession(null);
        notifyAuth("SIGNED_OUT", null);
        return { error: null };
      },
      onAuthStateChange: (callback) => {
        authListeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => authListeners.delete(callback),
            },
          },
        };
      },
    };
  }

  from(table) {
    return new MockQueryBuilder(this, table);
  }

  channel(name) {
    return new MockRealtimeChannel(name);
  }

  removeChannel(channel) {
    channels.delete(channel);
    channel.state = "closed";
    try {
      channel.statusCallback?.("CLOSED");
    } catch {
      // ignore callback failures during cleanup
    }
  }

  async rpc(name, args = {}) {
    try {
      const result = this._executeRpc(name, args);
      return { data: clone(result), error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  _executeQuery(builder) {
    const db = readDb();
    const tableRows = db[builder.table];
    if (!Array.isArray(tableRows)) {
      throw new Error(`Unknown mock table: ${builder.table}`);
    }

    if (builder.action === "select") {
      let rows = tableRows.filter((row) => builder.filters.every((filter) => matchFilter(row, filter)));
      if (builder.orderBy) {
        const { column, ascending } = builder.orderBy;
        rows = rows.slice().sort((a, b) => {
          const compared = compareValues(a?.[column], b?.[column]);
          return ascending ? compared : compared * -1;
        });
      }
      if (typeof builder.limitValue === "number") rows = rows.slice(0, builder.limitValue);
      const projected = rows.map((row) => projectRow(row, builder.selectColumns));
      if (builder.singleMode === "single") {
        if (projected.length !== 1) {
          return { data: null, error: new Error("Expected a single row") };
        }
        return { data: projected[0], error: null };
      }
      if (builder.singleMode === "maybeSingle") {
        if (projected.length > 1) {
          return { data: null, error: new Error("Expected zero or one row") };
        }
        return { data: projected[0] || null, error: null };
      }
      return { data: projected, error: null };
    }

    if (builder.action === "insert") {
      const inserted = [];
      updateDb((nextDb) => {
        for (const rawRow of builder.payload || []) {
          const row = ensureRowDefaults(builder.table, rawRow);
          nextDb[builder.table].push(row);
          inserted.push(clone(row));
          if (builder.table === "family_subscription") {
            updateFamilyTierFromSubscription(nextDb, row.family_id);
          }
          emitTableChange(builder.table, "INSERT", row, null);
        }
      });
      return this._formatMutationResponse(inserted, builder);
    }

    if (builder.action === "upsert") {
      const touched = [];
      updateDb((nextDb) => {
        const conflictFields = resolveConflictFields(builder.table, builder.options);
        for (const rawRow of builder.payload || []) {
          const row = ensureRowDefaults(builder.table, rawRow);
          const existingIndex = nextDb[builder.table].findIndex((candidate) =>
            conflictFields.every((field) => String(candidate?.[field]) === String(row?.[field]))
          );

          if (existingIndex >= 0) {
            const oldRow = clone(nextDb[builder.table][existingIndex]);
            const updatedRow = {
              ...nextDb[builder.table][existingIndex],
              ...row,
              updated_at: nowIso(),
            };
            nextDb[builder.table][existingIndex] = updatedRow;
            touched.push(clone(updatedRow));
            if (builder.table === "family_subscription") {
              updateFamilyTierFromSubscription(nextDb, updatedRow.family_id);
            }
            emitTableChange(builder.table, "UPDATE", updatedRow, oldRow);
          } else {
            nextDb[builder.table].push(row);
            touched.push(clone(row));
            if (builder.table === "family_subscription") {
              updateFamilyTierFromSubscription(nextDb, row.family_id);
            }
            emitTableChange(builder.table, "INSERT", row, null);
          }
        }
      });
      return this._formatMutationResponse(touched, builder);
    }

    if (builder.action === "update") {
      const updated = [];
      updateDb((nextDb) => {
        nextDb[builder.table] = nextDb[builder.table].map((row) => {
          if (!builder.filters.every((filter) => matchFilter(row, filter))) return row;
          const oldRow = clone(row);
          const nextRow = {
            ...row,
            ...clone(builder.payload),
            updated_at: nowIso(),
          };
          updated.push(clone(nextRow));
          if (builder.table === "family_subscription") {
            updateFamilyTierFromSubscription(nextDb, nextRow.family_id);
          }
          emitTableChange(builder.table, "UPDATE", nextRow, oldRow);
          return nextRow;
        });
      });
      return this._formatMutationResponse(updated, builder);
    }

    if (builder.action === "delete") {
      const deleted = [];
      updateDb((nextDb) => {
        nextDb[builder.table] = nextDb[builder.table].filter((row) => {
          if (!builder.filters.every((filter) => matchFilter(row, filter))) return true;
          deleted.push(clone(row));
          emitTableChange(builder.table, "DELETE", null, row);
          return false;
        });
      });
      return this._formatMutationResponse(deleted, builder);
    }

    throw new Error(`Unsupported mock action: ${builder.action}`);
  }

  _formatMutationResponse(rows, builder) {
    const projected = builder.returning ? rows.map((row) => projectRow(row, builder.selectColumns)) : null;
    if (builder.singleMode === "single") {
      return { data: projected?.[0] || null, error: projected?.length === 1 ? null : new Error("Expected a single row") };
    }
    if (builder.singleMode === "maybeSingle") {
      return { data: projected?.[0] || null, error: projected && projected.length > 1 ? new Error("Expected zero or one row") : null };
    }
    return { data: projected, error: null };
  }

  _executeRpc(name, args) {
    const db = readDb();

    if (name === "join_family") {
      const family = getFamilyByPairCode(db, args.p_pair_code);
      if (!family) throw new Error("연동 코드를 찾을 수 없습니다");
      const children = db.family_members.filter(
        (member) => member.family_id === family.id && member.role === "child"
      );
      const existingMember = db.family_members.find(
        (member) => member.family_id === family.id && member.user_id === args.p_user_id
      );
      const isPremium = family.subscription_tier === "premium" || family.user_tier === "premium";
      if (!existingMember && children.length >= 1 && !isPremium) {
        throw new Error("프리미엄 구독이 있어야 두 번째 아이를 연동할 수 있어요");
      }
      updateDb((nextDb) => {
        const index = nextDb.family_members.findIndex(
          (member) => member.family_id === family.id && member.user_id === args.p_user_id
        );
        const row = ensureRowDefaults("family_members", {
          family_id: family.id,
          user_id: args.p_user_id,
          role: "child",
          name: args.p_name || "아이",
          emoji: "🐰",
        });
        if (index >= 0) {
          const oldRow = clone(nextDb.family_members[index]);
          nextDb.family_members[index] = { ...nextDb.family_members[index], ...row };
          emitTableChange("family_members", "UPDATE", nextDb.family_members[index], oldRow);
        } else {
          nextDb.family_members.push(row);
          emitTableChange("family_members", "INSERT", row, null);
        }
      });
      return family.id;
    }

    if (name === "mark_memo_read") {
      updateDb((nextDb) => {
        const memo = nextDb.memos.find(
          (row) => row.family_id === args.p_family_id && row.date_key === args.p_date_key
        );
        if (!memo) return;
        const readBy = Array.isArray(memo.read_by) ? memo.read_by : [];
        if (!readBy.includes(args.p_user_id)) {
          const oldRow = clone(memo);
          memo.read_by = [...readBy, args.p_user_id];
          memo.updated_at = nowIso();
          emitTableChange("memos", "UPDATE", memo, oldRow);
        }
      });
      return true;
    }

    if (name === "upsert_child_location") {
      const updatedAt = nowIso();
      updateDb((nextDb) => {
        const index = nextDb.child_locations.findIndex(
          (row) => row.family_id === args.p_family_id && row.user_id === args.p_user_id
        );
        const row = ensureRowDefaults("child_locations", {
          family_id: args.p_family_id,
          user_id: args.p_user_id,
          lat: args.p_lat,
          lng: args.p_lng,
          updated_at: updatedAt,
        });
        if (index >= 0) {
          const oldRow = clone(nextDb.child_locations[index]);
          nextDb.child_locations[index] = { ...nextDb.child_locations[index], ...row };
          emitTableChange("child_locations", "UPDATE", nextDb.child_locations[index], oldRow);
        } else {
          nextDb.child_locations.push(row);
          emitTableChange("child_locations", "INSERT", row, null);
        }

        const historyRow = ensureRowDefaults("location_history", {
          family_id: args.p_family_id,
          user_id: args.p_user_id,
          lat: args.p_lat,
          lng: args.p_lng,
          recorded_at: updatedAt,
        });
        nextDb.location_history.push(historyRow);
        emitTableChange("location_history", "INSERT", historyRow, null);
      });
      emitBroadcast(`family-${args.p_family_id}`, "child_location", {
        user_id: args.p_user_id,
        lat: args.p_lat,
        lng: args.p_lng,
        updated_at: updatedAt,
      });
      return true;
    }

    if (name === "add_sticker") {
      const sticker = ensureRowDefaults("stickers", {
        user_id: args.p_user_id,
        family_id: args.p_family_id,
        event_id: args.p_event_id,
        date_key: args.p_date_key,
        sticker_type: args.p_sticker_type,
        emoji: args.p_emoji,
        title: args.p_title,
      });
      updateDb((nextDb) => {
        nextDb.stickers.push(sticker);
      });
      emitTableChange("stickers", "INSERT", sticker, null);
      return true;
    }

    if (name === "get_stickers_for_date") {
      return db.stickers
        .filter((row) => row.family_id === args.p_family_id && row.date_key === args.p_date_key)
        .sort((a, b) => compareValues(a.created_at, b.created_at));
    }

    if (name === "get_sticker_summary") {
      const summary = db.stickers
        .filter((row) => row.family_id === args.p_family_id)
        .reduce((acc, row) => {
          const key = row.sticker_type || "etc";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
      return [
        {
          praise_count: summary.praise || 0,
          early_count: summary.early || 0,
          late_count: summary.late || 0,
          total_count: Object.values(summary).reduce((sum, count) => sum + count, 0),
        },
      ];
    }

    if (name === "get_parent_alerts") {
      const limit = Number(args.p_limit || 20);
      return db.parent_alerts
        .filter((row) => row.family_id === args.p_family_id)
        .sort((a, b) => compareValues(b.created_at, a.created_at))
        .slice(0, limit);
    }

    if (name === "mark_alert_read") {
      updateDb((nextDb) => {
        const alert = nextDb.parent_alerts.find((row) => row.id === args.p_alert_id);
        if (!alert) return;
        const oldRow = clone(alert);
        alert.read = true;
        alert.updated_at = nowIso();
        emitTableChange("parent_alerts", "UPDATE", alert, oldRow);
      });
      return true;
    }

    if (name === "insert_parent_alert") {
      const alert = ensureRowDefaults("parent_alerts", {
        family_id: args.p_family_id,
        alert_type: args.p_alert_type,
        title: args.p_title,
        message: args.p_message,
        severity: args.p_severity || "info",
        read: false,
      });
      updateDb((nextDb) => {
        nextDb.parent_alerts.unshift(alert);
      });
      emitTableChange("parent_alerts", "INSERT", alert, null);
      return alert.id;
    }

    if (name === "rename_family_member") {
      updateDb((nextDb) => {
        const member = nextDb.family_members.find(
          (row) => row.family_id === args.p_family_id && row.user_id === args.p_user_id
        );
        if (!member) return;
        const oldRow = clone(member);
        member.name = args.p_new_name || member.name;
        emitTableChange("family_members", "UPDATE", member, oldRow);
      });
      return true;
    }

    throw new Error(`Unsupported mock RPC: ${name}`);
  }
}

const client = new MockSupabaseClient();

function resetMockDb() {
  writeDb(createDefaultDb());
  writeSession(null);
}

function setCurrentSession(session) {
  writeSession(session);
  notifyAuth(session ? "SIGNED_IN" : "SIGNED_OUT", session || null);
}

function upsertFamilySubscription(row) {
  updateDb((db) => {
    const existingIndex = db.family_subscription.findIndex(
      (item) => item.family_id === row.family_id
    );
    const nextRow = ensureRowDefaults("family_subscription", row);
    if (existingIndex >= 0) {
      const oldRow = clone(db.family_subscription[existingIndex]);
      db.family_subscription[existingIndex] = {
        ...db.family_subscription[existingIndex],
        ...nextRow,
        updated_at: nowIso(),
      };
      updateFamilyTierFromSubscription(db, row.family_id);
      emitTableChange("family_subscription", "UPDATE", db.family_subscription[existingIndex], oldRow);
    } else {
      db.family_subscription.push(nextRow);
      updateFamilyTierFromSubscription(db, row.family_id);
      emitTableChange("family_subscription", "INSERT", nextRow, null);
    }
  });
}

function getFamilySubscription(familyId) {
  return readDb().family_subscription.find((row) => row.family_id === familyId) || null;
}

export const supabase = client;

supabase.__mock = {
  enabled: true,
  isEnabled: isMockEnabled,
  setEnabled: setMockEnabled,
  readDb,
  writeDb,
  reset: resetMockDb,
  setSession: setCurrentSession,
  getSession: readSession,
  upsertFamilySubscription,
  getFamilySubscription,
};

export { isMockEnabled };
