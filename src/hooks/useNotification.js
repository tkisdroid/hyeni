import { useState, useEffect } from "react";
import { getSession } from "../lib/auth.js";
import { registerSW, getPermissionStatus, scheduleNotifications, scheduleNativeAlarms, clearAllScheduled, subscribeToPush, unsubscribeFromPush, getNativeNotificationHealth } from "../lib/pushNotifications.js";
import { supabase } from "../lib/supabase.js";
import { SUPABASE_URL, SUPABASE_KEY } from "../lib/utils.js";

export default function useNotification({ isNativeApp, authUser, familyId, events, globalNotif, myRole, arrivedSet }) {
    const [pushPermission, setPushPermission] = useState(() => getPermissionStatus());
    const [nativeNotifHealth, setNativeNotifHealth] = useState(null);
    const [bgLocationGranted, setBgLocationGranted] = useState(true); // assume granted until checked

    // ── Register Service Worker for push notifications (웹 전용, 네이티브 앱 제외) ──
    useEffect(() => {
        if (isNativeApp) return; // Android APK → FCM 사용, SW 불필요
        registerSW();
    }, [isNativeApp]);

    // ── Native notification health (Android Capacitor) ─────────────────────────
    useEffect(() => {
        if (!isNativeApp) return;
        let cancelled = false;

        const refresh = async () => {
            const health = await getNativeNotificationHealth();
            if (!health || cancelled) return;
            setNativeNotifHealth(health);
            setPushPermission(
                health.postPermissionGranted && health.notificationsEnabled ? "granted" : "denied"
            );
        };

        refresh();

        // Check background location permission (child mode)
        const checkBgLoc = async () => {
            try {
                const { Capacitor, registerPlugin } = await import("@capacitor/core");
                if (!Capacitor.isNativePlatform()) return;
                const BgLoc = registerPlugin("BackgroundLocation");
                const result = await BgLoc.checkBackgroundLocationPermission();
                setBgLocationGranted(
                    result.backgroundLocation === true && result.locationServicesEnabled !== false
                );
            } catch { /* web mode */ }
        };
        checkBgLoc();

        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                refresh();
                checkBgLoc();
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [isNativeApp]);

    // ── Subscribe to server-side Web Push when permission + family are ready ────
    // 네이티브 앱(Android)에서는 FCM을 사용하므로 Web Push 구독 안 함 (이중 알림 방지)
    useEffect(() => {
        if (isNativeApp) {
            // Android: 기존 Web Push 구독 해제 + SW 해제 (이중 알림 완전 차단)
            unsubscribeFromPush().catch(() => {});
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => {
                    regs.forEach(r => r.unregister());
                });
            }
            // DB에서도 이 기기의 push_subscriptions 삭제
            if (authUser?.id) {
                supabase.from("push_subscriptions").delete().eq("user_id", authUser.id).then(() => {});
            }
            return;
        }
        if (pushPermission === "granted" && authUser?.id && familyId) {
            subscribeToPush(authUser.id, familyId);
        }
    }, [pushPermission, authUser, familyId, isNativeApp]);

    // ── Register FCM token (Android only) ───────────────────────────────────────
    useEffect(() => {
        if (!authUser?.id || !familyId) return;
        let cancelled = false;

        (async () => {
            try {
                const { Capacitor, registerPlugin } = await import("@capacitor/core");
                if (!Capacitor.isNativePlatform()) return;

                const BackgroundLocation = registerPlugin("BackgroundLocation");
                const session = await getSession();

                await BackgroundLocation.setPushContext({
                    userId: authUser.id,
                    familyId,
                    supabaseUrl: SUPABASE_URL,
                    supabaseKey: SUPABASE_KEY,
                    accessToken: session?.access_token || "",
                });

                const { token } = await BackgroundLocation.getFcmToken();
                if (!token || cancelled) return;

                const { error } = await supabase.from("fcm_tokens").upsert(
                    { user_id: authUser.id, family_id: familyId, fcm_token: token, updated_at: new Date().toISOString() },
                    { onConflict: "user_id,fcm_token" }
                );
                if (error) {
                    console.error("[FCM] Token registration failed:", error);
                    return;
                }
                console.log("[FCM] Token registered:", token.substring(0, 20) + "...");
            } catch (e) {
                console.warn("[FCM] Token registration skipped:", e.message);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [authUser, familyId]);

    // ── Push notification scheduling ────────────────────────────────────────────
    useEffect(() => {
        if (pushPermission === "granted") {
            scheduleNotifications(events, globalNotif, myRole);
        }
        // Always schedule native AlarmManager alarms (persistent, works when app killed)
        // arrivedSet으로 이미 도착한 이벤트의 알림 제외
        scheduleNativeAlarms(events, globalNotif, myRole, arrivedSet);
        return () => clearAllScheduled();
    }, [events, globalNotif, pushPermission, myRole, arrivedSet]);

    return {
        pushPermission, setPushPermission,
        nativeNotifHealth, setNativeNotifHealth,
        bgLocationGranted, setBgLocationGranted,
    };
}
