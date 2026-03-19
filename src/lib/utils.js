import { getSession } from "./auth.js";

export const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_APP_KEY;
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const PARENT_PAIRING_INTENT_KEY = "kids-app:parent-pairing-intent";
export const PUSH_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/push-notify` : "";
export const AI_PARSE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-voice-parse` : "";
export const AI_MONITOR_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-child-monitor` : "";

export const FF = "'Noto Sans KR','Apple SD Gothic Neo',sans-serif";

export const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
export const MONTHS_KO = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

export const ARRIVAL_R = 100; // metres (geo-fence radius, 실내 GPS 오차 보정)
export const DEPARTURE_TIMEOUT_MS = 90_000; // 90초 outside = departure alert (GPS 지터 오알림 방지)
export const DEFAULT_NOTIF = { childEnabled: true, parentEnabled: true, minutesBefore: [15, 5] };

export function getNativeSetupAction(health) {
    if (!health) return null;
    if (!health.postPermissionGranted) {
        return { target: "notifications", label: "알림 권한 허용" };
    }
    if (!health.notificationsEnabled || !health.channelsEnabled) {
        return { target: "notifications", label: "알림 설정 열기" };
    }
    if (!health.fullScreenIntentAllowed) {
        return { target: "fullScreen", label: "전체화면 알림 허용" };
    }
    if (!health.batteryOptimizationsIgnored) {
        return { target: "battery", label: "배터리 예외 허용" };
    }
    if (!health.exactAlarmAllowed) {
        return { target: "exactAlarm", label: "정확한 알림 허용" };
    }
    return null;
}

// Send instant push notification via Edge Function
export async function sendInstantPush({ action, familyId, senderUserId, title, message }) {
    if (!familyId) return;
    const payload = JSON.stringify({ action, familyId, senderUserId, title, message });
    const url = PUSH_FUNCTION_URL;
    if (!url) return;
    const session = await getSession().catch(() => null);
    const token = session?.access_token || "";

    // Method 1: XMLHttpRequest with auth headers
    try {
        await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", url, true);
            xhr.setRequestHeader("Content-Type", "application/json");
            if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            xhr.timeout = 10000;
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log("[Push] sent via XHR:", action, xhr.status);
                    resolve();
                    return;
                }
                reject(new Error(`XHR ${xhr.status}: ${xhr.responseText || "push failed"}`));
            };
            xhr.onerror = () => reject(new Error("XHR error"));
            xhr.ontimeout = () => reject(new Error("XHR timeout"));
            xhr.send(payload);
        });
        return;
    } catch (e) {
        console.log("[Push] XHR failed:", e.message);
        // Method 2: fetch with auth headers
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: payload,
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            console.log("[Push] sent via fetch:", action);
            return;
        } catch (e2) {
            console.log("[Push] fetch failed:", e2.message);
        }
    }

    // Method 3: best-effort beacon fallback for app background/unload
    try {
        if (navigator.sendBeacon) {
            const sent = navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
            console.log("[Push] beacon fallback:", action, sent ? "queued" : "failed");
        }
    } catch (e) {
        console.log("[Push] all methods failed:", e.message);
    }
}

export function rememberParentPairingIntent() {
    if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PARENT_PAIRING_INTENT_KEY, "1");
    }
}

export function clearParentPairingIntent() {
    if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PARENT_PAIRING_INTENT_KEY);
    }
}

// HTML escape to prevent XSS in Kakao CustomOverlay template literals
export function escHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

export function haversineM(la1, lo1, la2, lo2) {
    const R = 6371000, p1 = la1 * Math.PI / 180, p2 = la2 * Math.PI / 180;
    const dp = (la2 - la1) * Math.PI / 180, dl = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const getDIM = (y, m) => new Date(y, m + 1, 0).getDate();
export const getFD = (y, m) => new Date(y, m, 1).getDay();
export const fmtT = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
