// ── 혜니캘린더 Service Worker ─────────────────────────────────────────────────
// Handles server-side Web Push notifications (VAPID)
// Local setTimeout-based scheduling removed — unreliable when SW is suspended.
// All timed notifications are handled by server-side cron (push-notify Edge Function)
// and Android native LocationService polling.

const APP_ICON = "/icon-192.png";

// Install: activate immediately
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Server-side Web Push event ──────────────────────────────────────────────
// Fired by the push server even when the browser tab is closed
self.addEventListener("push", (e) => {
  if (!e.data) return;

  let payload;
  try {
    payload = e.data.json();
  } catch {
    payload = { title: "혜니캘린더", body: e.data.text() };
  }

  const { title, body, data } = payload;
  if (data?.type === "remote_listen") return;
  const isUrgent = data?.urgent === true || data?.urgent === "true";

  e.waitUntil(
    self.registration.showNotification(title || "혜니캘린더", {
      body: body || "",
      icon: APP_ICON,
      badge: APP_ICON,
      vibrate: isUrgent ? [300, 100, 300, 100, 500] : [200, 100, 200],
      tag: data?.pushId || (data?.eventId ? `hyeni-${data.eventId}-${data.type}` : `hyeni-${Date.now()}`),
      requireInteraction: isUrgent,
      renotify: true,
      data: { url: "/", ...data },
    })
  );
});

// ── Cancel all notifications (from main thread) ─────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "CANCEL_ALL") {
    self.registration.getNotifications().then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }
});

// ── Notification click: focus or open the app ───────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      return self.clients.openWindow("/");
    })
  );
});
