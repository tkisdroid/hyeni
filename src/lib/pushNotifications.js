// ── Push Notification Manager ────────────────────────────────────────────────
// Local scheduling + Server-side Web Push subscription management

import { supabase } from "./supabase.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

let swRegistration = null;
const scheduledTimers = new Map();

// ── Safe Notification API check (Android WebView doesn't have it) ───────────
function hasNotificationAPI() {
  return typeof window !== "undefined" && "Notification" in window;
}

function getNotifPermission() {
  if (!hasNotificationAPI()) return "unsupported";
  return Notification.permission;
}

function isNativePlatform() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

// ── Register Service Worker ─────────────────────────────────────────────────
export async function registerSW() {
  if (isNativePlatform()) return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js");
    console.log("[Push] SW registered");
    return swRegistration;
  } catch (err) {
    console.error("[Push] SW registration failed:", err);
    return null;
  }
}

// ── Request notification permission ─────────────────────────────────────────
export async function requestPermission() {
  if (isNativePlatform()) {
    const native = getNativeNotifPlugin();
    if (native?.requestPermission) {
      try {
        const result = await native.requestPermission();
        if (result?.permission) {
          return result.permission;
        }
      } catch (err) {
        console.error("[Push] Native permission request failed:", err);
      }
    }

    const health = await getNativeNotificationHealth();
    if (!health) return "prompt";
    return health.postPermissionGranted && health.notificationsEnabled ? "granted" : "denied";
  }

  if (!hasNotificationAPI()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

export function getPermissionStatus() {
  if (isNativePlatform()) return "prompt";

  return getNotifPermission();
}

// ── Web Push subscription (server-side push) ────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(userId, familyId) {
  if (isNativePlatform()) {
    console.log("[Push] Skip Web Push subscription on native platform");
    return null;
  }
  if (!swRegistration || !VAPID_PUBLIC_KEY) {
    console.warn("[Push] SW not registered or VAPID key missing");
    return null;
  }

  try {
    let subscription = await swRegistration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("[Push] New push subscription created");
    }

    const subJson = subscription.toJSON();

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          family_id: familyId,
          endpoint: subscription.endpoint,
          subscription: subJson,
        },
        { onConflict: "user_id,endpoint" }
      );

    if (error) {
      console.error("[Push] Failed to save subscription:", error);
      return null;
    }

    console.log("[Push] Subscription saved to server");
    return subscription;
  } catch (err) {
    console.error("[Push] Subscribe failed:", err);
    return null;
  }
}

export async function unsubscribeFromPush() {
  if (!swRegistration) return;
  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", subscription.endpoint);

      await subscription.unsubscribe();
      console.log("[Push] Unsubscribed from push");
    }
  } catch (err) {
    console.error("[Push] Unsubscribe failed:", err);
  }
}

// ── Native notification helper (Android Capacitor) ──────────────────────────
let nativeNotifPlugin = null;
function getNativeNotifPlugin() {
  if (nativeNotifPlugin) return nativeNotifPlugin;
  try {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.()) {
      nativeNotifPlugin = cap.registerPlugin("NativeNotification");
      return nativeNotifPlugin;
    }
  } catch { /* native not available */ }
  return null;
}

export async function getNativeNotificationHealth() {
  const native = getNativeNotifPlugin();
  if (!native) return null;

  try {
    return await native.getDeliveryHealth();
  } catch (err) {
    console.error("[Push] Native delivery health check failed:", err);
    return null;
  }
}

export async function openNativeNotificationSettings(target = "notifications") {
  const native = getNativeNotifPlugin();
  if (!native) return false;

  try {
    if (target === "battery" && native.openBatteryOptimizationSettings) {
      await native.openBatteryOptimizationSettings();
    } else if (target === "fullScreen" && native.openFullScreenIntentSettings) {
      await native.openFullScreenIntentSettings();
    } else if (target === "exactAlarm" && native.openExactAlarmSettings) {
      await native.openExactAlarmSettings();
    } else if (native.openSettings) {
      await native.openSettings();
    } else {
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Push] Failed to open native settings:", err);
    return false;
  }
}

// ── Show notification (local, works foreground + background) ────────────────
async function showNotification(title, body, tag, data) {
  const silent = !!data?.silent;

  // Try native Android notification first (heads-up + screen wake)
  const native = getNativeNotifPlugin();
  if (native) {
    try {
      const channel = data?.kkuk ? "kkuk" : (data?.urgent ? "emergency" : (silent ? "silent" : "schedule"));
      await native.show({
        title, body, channel,
        wakeScreen: !silent,
        fullScreen: !!data?.kkuk || !!data?.urgent,
        silent,
      });
      return;
    } catch (err) {
      console.error("[Push] Native notification failed, fallback:", err);
    }
  }

  if (getNotifPermission() !== "granted") return;

  if (swRegistration) {
    try {
      await swRegistration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        tag: tag || `hyeni-${Date.now()}`,
        badge: "/icon-192.png",
        vibrate: silent ? [] : [200, 100, 200],
        silent,
        requireInteraction: false,
        data: { ...data, url: "/" },
      });
      return;
    } catch (err) {
      console.error("[Push] SW notification failed, fallback:", err);
    }
  }

  if (hasNotificationAPI()) {
    try {
      new Notification(title, { body, icon: "/icon-192.png", tag, silent });
    } catch (err) {
      console.error("[Push] Notification failed:", err);
    }
  }
}

// ── Shared notification message builders ─────────────────────────────────────
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

// ── Schedule local notifications for today's events ─────────────────────────
export function scheduleNotifications(events, notifSettings, role) {
  for (const [, timerId] of scheduledTimers) {
    clearTimeout(timerId);
  }
  scheduledTimers.clear();

  if (!role) return; // 역할이 확정되기 전엔 스케줄하지 않음
  // 네이티브 앱에서는 AlarmManager(scheduleNativeAlarms)만 사용 → 이중알림 방지
  if (isNativePlatform()) return;
  if (getNotifPermission() !== "granted") return;

  const isParentRole = role === "parent";
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const todayEvents = events[todayKey] || [];

  for (const ev of todayEvents) {
    const [h, m] = ev.time.split(":").map(Number);
    const eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    const settings = ev.notifOverride || notifSettings;
    const minutesList = settings.minutesBefore || [15, 5];

    // Skip if this role's notifications are disabled
    if (isParentRole && !settings.parentEnabled) continue;
    if (!isParentRole && !settings.childEnabled) continue;

    // 부모: 15분 전에만, 아이: 전체 minutesList
    const effectiveMins = isParentRole ? minutesList.filter(mins => mins >= 15) : minutesList;

    for (const mins of effectiveMins) {
      const fireTime = eventTime.getTime() - mins * 60000;
      const delay = fireTime - now.getTime();

      if (delay > 0 && delay < 24 * 60 * 60000) {
        const timerKey = `${ev.id}-${mins}`;
        const body = isParentRole
          ? parentNotifMsg(ev.emoji, ev.title, mins, ev.time)
          : childNotifMsg(ev.emoji, ev.title, mins);

        const timerId = setTimeout(() => {
          showNotification(
            `${ev.emoji} ${ev.title}`,
            body,
            `hyeni-${ev.id}-${mins}`,
            { eventId: ev.id }
          );
          scheduledTimers.delete(timerKey);
        }, delay);

        scheduledTimers.set(timerKey, timerId);
      }
    }

    // 시작 알림: 부모 + 아이 모두 (소리 울림)
    const startDelay = eventTime.getTime() - now.getTime();
    if (startDelay > 0 && startDelay < 24 * 60 * 60000) {
      const startKey = `${ev.id}-start`;
      const startBody = isParentRole
        ? parentStartMsg(ev.emoji, ev.title)
        : childStartMsg(ev.emoji, ev.title);
      const timerId = setTimeout(() => {
        showNotification(
          `${ev.emoji} ${ev.title}`,
          startBody,
          `hyeni-${ev.id}-start`,
          { eventId: ev.id }
        );
        scheduledTimers.delete(startKey);
      }, startDelay);
      scheduledTimers.set(startKey, timerId);
    }
  }

  console.log(`[Push] ${scheduledTimers.size} local notifications scheduled (role: ${role})`);
}

// ── Arrival / Emergency notifications ───────────────────────────────────────
export function showArrivalNotification(ev, arrivalMsg, role) {
  const isParentRole = role === "parent";
  showNotification(
    isParentRole ? `✅ ${ev.emoji} 도착 알림` : `🎉 ${ev.emoji} ${ev.title} 도착!`,
    isParentRole ? `혜니가 ${ev.title}에 잘 도착했어요 (${arrivalMsg})` : arrivalMsg,
    `hyeni-arrival-${ev.id}`,
    { eventId: ev.id }
  );
}

export function showEmergencyNotification(ev) {
  showNotification(
    `🚨 긴급! ${ev.emoji} ${ev.title}`,
    `${ev.time} 시작인데 아직 미도착!`,
    `hyeni-emergency-${ev.id}`,
    { eventId: ev.id, urgent: true, kkuk: false }
  );
}

export function showKkukNotification(senderLabel) {
  showNotification(
    "💗 꾹!",
    `${senderLabel}가 꾹을 보냈어요!`,
    `hyeni-kkuk-${Date.now()}`,
    { kkuk: true, urgent: true }
  );
}

// ── Build alarm payloads from today's events ────────────────────────────────
function buildAlarmPayloads(events, notifSettings, role, arrivedEventIds = new Set()) {
  const isParentRole = role === "parent";
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const todayEvents = events[todayKey] || [];
  const notifications = [];

  for (const ev of todayEvents) {
    // 이미 도착한 이벤트는 알림 스킵
    if (arrivedEventIds.has(ev.id)) continue;

    const [h, m] = ev.time.split(":").map(Number);
    const eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    const settings = ev.notifOverride || notifSettings;
    const minutesList = settings.minutesBefore || [15, 5];

    if (isParentRole && !settings.parentEnabled) continue;
    if (!isParentRole && !settings.childEnabled) continue;

    // 부모: 15분 전에만, 아이: 전체 minutesList
    const effectiveMins = isParentRole ? minutesList.filter(mins => mins >= 15) : minutesList;

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

    // 시작 알림: 부모 + 아이 모두
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

// ── Native AlarmManager scheduling (persistent, works when app is killed) ───
export async function scheduleNativeAlarms(events, notifSettings, role, arrivedEventIds = new Set()) {
  const native = getNativeNotifPlugin();
  if (!native) return;
  if (!role) return; // 역할이 확정되기 전엔 스케줄하지 않음

  const notifications = buildAlarmPayloads(events, notifSettings, role, arrivedEventIds);

  try {
    const result = await native.replaceScheduledNotifications({ notifications });
    console.log(`[Push] ${result.scheduled} native alarms scheduled`);
  } catch (err) {
    console.error("[Push] Native alarm scheduling failed:", err);
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────────────
export async function clearAllScheduled() {
  for (const [, timerId] of scheduledTimers) {
    clearTimeout(timerId);
  }
  scheduledTimers.clear();

  // Also cancel native alarms
  const native = getNativeNotifPlugin();
  if (native) {
    try { await native.cancelScheduledNotifications(); } catch { /* cancel failed, ignore */ }
  }
}
