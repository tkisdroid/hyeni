// ── NotificationManager ─────────────────────────────────────────────────────
// Deep module: encapsulates ALL notification scheduling behind a simple interface.
// Internally delegates to buildAlarmPayloads logic and either JS timers (web)
// or native AlarmManager (Android Capacitor).

// ── Notification message builders (duplicated from pushNotifications to avoid
//    coupling — the manager owns its own message format) ─────────────────────
function childNotifMsg(emoji, title, mins) {
  if (mins === 15) return `🐰 ${emoji} ${title} 가기 15분 전이야! 준비물 챙겼니? 🎒`;
  if (mins === 5) return `🏃 ${emoji} ${title} 곧 시작이야! 출발~ 화이팅! 💪`;
  const label = mins >= 60 ? `${mins / 60}시간` : `${mins}분`;
  return `🐰 ${emoji} ${title} ${label} 후에 시작해요!`;
}

function parentNotifMsg(emoji, title, mins, time) {
  const label = mins >= 60 ? `${mins / 60}시간` : `${mins}분`;
  return `${emoji} ${title} ${label} 전 알림 — ${time} 시작`;
}

function childStartMsg(emoji, title) {
  return `🏃 ${emoji} ${title} 지금 시작이야! 화이팅! 💪`;
}

function parentStartMsg(emoji, title) {
  return `${emoji} ${title} 지금 시작 시간이에요`;
}

// ── Build alarm payloads from today's events ────────────────────────────────
function buildAlarmPayloads(events, notifSettings, role, arrivedEventIds = new Set()) {
  const isParentRole = role === "parent";
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const todayEvents = events[todayKey] || [];
  const notifications = [];

  for (const ev of todayEvents) {
    if (arrivedEventIds.has(ev.id)) continue;

    const [h, m] = ev.time.split(":").map(Number);
    const eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    const settings = ev.notifOverride || notifSettings;
    const minutesList = settings.minutesBefore || [15, 5];

    if (isParentRole && !settings.parentEnabled) continue;
    if (!isParentRole && !settings.childEnabled) continue;

    // Parent: only >= 15min before, Child: all minutesList
    const effectiveMins = isParentRole
      ? minutesList.filter((mins) => mins >= 15)
      : minutesList;

    for (const mins of effectiveMins) {
      const fireAt = eventTime.getTime() - mins * 60000;
      if (fireAt <= now.getTime()) continue;

      notifications.push({
        id: `${ev.id}-${mins}`,
        at: fireAt,
        title: `${ev.emoji} ${ev.title}`,
        body: isParentRole
          ? parentNotifMsg(ev.emoji, ev.title, mins, ev.time)
          : childNotifMsg(ev.emoji, ev.title, mins),
        channel: "schedule",
        wakeScreen: true,
        fullScreen: false,
      });
    }

    // Start notification: both parent and child
    const startAt = eventTime.getTime();
    if (startAt > now.getTime()) {
      notifications.push({
        id: `${ev.id}-start`,
        at: startAt,
        title: `${ev.emoji} ${ev.title}`,
        body: isParentRole
          ? parentStartMsg(ev.emoji, ev.title)
          : childStartMsg(ev.emoji, ev.title),
        channel: "schedule",
        wakeScreen: true,
        fullScreen: false,
      });
    }
  }

  return notifications;
}

// ── Native plugin accessor ──────────────────────────────────────────────────
function getNativeNotifPlugin() {
  try {
    const cap = typeof window !== "undefined" ? window.Capacitor : undefined;
    if (cap?.isNativePlatform?.()) {
      return cap.registerPlugin("NativeNotification");
    }
  } catch {
    /* native not available */
  }
  return null;
}

// ── NotificationManager class ───────────────────────────────────────────────
export class NotificationManager {
  /**
   * @param {Object} options
   * @param {'parent'|'child'} options.role
   * @param {boolean} options.isNative - true for Android Capacitor, false for web
   */
  constructor({ role, isNative }) {
    this._role = role;
    this._isNative = isNative;
    this._timers = new Map();
  }

  /**
   * Sync all notifications for today's events.
   * On web: sets JS timers. On native: delegates to AlarmManager.
   *
   * @param {Object} events - keyed by todayKey
   * @param {Object} notifSettings
   * @param {Set} [arrivedEventIds=new Set()]
   * @returns {Object|Promise<Object>} { scheduled: number }
   */
  sync(events, notifSettings, arrivedEventIds = new Set()) {
    const payloads = buildAlarmPayloads(events, notifSettings, this._role, arrivedEventIds);

    if (this._isNative) {
      return this._syncNative(payloads);
    }
    return this._syncWeb(payloads);
  }

  /**
   * Cancel all scheduled notifications.
   * @returns {void|Promise<void>}
   */
  cancelAll() {
    // Clear JS timers
    for (const [, timerId] of this._timers) {
      clearTimeout(timerId);
    }
    this._timers.clear();

    // Cancel native alarms if on native platform
    if (this._isNative) {
      const native = getNativeNotifPlugin();
      if (native) {
        return native.cancelScheduledNotifications().catch(() => {
          /* cancel failed, ignore */
        });
      }
    }
  }

  // ── Private: Web (JS timers) ────────────────────────────────────────────
  _syncWeb(payloads) {
    // Clear previous timers
    for (const [, timerId] of this._timers) {
      clearTimeout(timerId);
    }
    this._timers.clear();

    const now = Date.now();

    for (const payload of payloads) {
      const delay = payload.at - now;
      if (delay > 0) {
        const timerId = setTimeout(() => {
          this._timers.delete(payload.id);
        }, delay);
        this._timers.set(payload.id, timerId);
      }
    }

    return { scheduled: this._timers.size };
  }

  // ── Private: Native (AlarmManager) ──────────────────────────────────────
  async _syncNative(payloads) {
    const native = getNativeNotifPlugin();
    if (!native) {
      return { scheduled: 0 };
    }

    try {
      const result = await native.replaceScheduledNotifications({ notifications: payloads });
      return { scheduled: result.scheduled };
    } catch (err) {
      console.error("[NotificationManager] Native alarm scheduling failed:", err);
      return { scheduled: 0 };
    }
  }
}
