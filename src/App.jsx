import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { kakaoLogin, anonymousLogin, getSession, setupFamily, joinFamily, joinFamilyAsParent, getMyFamily, unpairChild, regeneratePairCode, saveParentPhones, onAuthChange, logout, generateUUID } from "./lib/auth.js";
import { fetchEvents, fetchAcademies, fetchMemos, fetchSavedPlaces, insertEvent, updateEvent, deleteEvent as dbDeleteEvent, insertAcademy, updateAcademy, deleteAcademy as dbDeleteAcademy, insertSavedPlace, updateSavedPlace, deleteSavedPlace, upsertMemo, subscribeFamily, unsubscribe, getCachedEvents, getCachedAcademies, getCachedMemos, getCachedSavedPlaces, cacheEvents, cacheAcademies, cacheMemos, cacheSavedPlaces, saveChildLocation, fetchChildLocations, saveLocationHistory, fetchTodayLocationHistory, addSticker, fetchStickersForDate, fetchStickerSummary, fetchDangerZones, saveDangerZone, deleteDangerZone, fetchParentAlerts, markAlertRead, fetchMemoReplies, sendMemo, markMemoReplyRead } from "./lib/sync.js";
import { registerSW, requestPermission, getPermissionStatus, scheduleNotifications, scheduleNativeAlarms, showArrivalNotification, showEmergencyNotification, showKkukNotification, clearAllScheduled, subscribeToPush, unsubscribeFromPush, getNativeNotificationHealth, openNativeNotificationSettings, DEFAULT_NOTIFICATION_SETTINGS, NOTIFICATION_MINUTE_OPTIONS, normalizeNotifSettings } from "./lib/pushNotifications.js";
import { supabase } from "./lib/supabase.js";
import { FEATURES } from "./lib/features.js";
import { useEntitlement } from "./lib/entitlement.js";
import { identify as identifySubscriptionUser, purchase as purchaseSubscription } from "./lib/qonversion.js";
import { sendBroadcastWhenReady } from "./lib/realtime.js";
import { PRICING } from "./lib/paywallCopy.js";
import { TrialInvitePrompt } from "./components/paywall/TrialInvitePrompt.jsx";
import { FeatureLockOverlay } from "./components/paywall/FeatureLockOverlay.jsx";
import { TrialEndingBanner } from "./components/paywall/TrialEndingBanner.jsx";
import { AutoRenewalDisclosure } from "./components/paywall/AutoRenewalDisclosure.jsx";
import { SubscriptionManagement } from "./components/settings/SubscriptionManagement.jsx";
import "./App.css";

function normalizeKakaoAppKey(value) {
    return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

const KAKAO_APP_KEY = normalizeKakaoAppKey(import.meta.env.VITE_KAKAO_APP_KEY);
const KAKAO_REST_KEY = normalizeKakaoAppKey(import.meta.env.VITE_KAKAO_REST_KEY);
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const KAKAO_WALKING_DIRECTIONS_URL = "https://apis-navi.kakaomobility.com/affiliate/walking/v1/directions";
const OSM_FOOT_DIRECTIONS_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";
const ROUTE_REQUEST_TIMEOUT_MS = 12_000;
const PARENT_PAIRING_INTENT_KEY = "kids-app:parent-pairing-intent";
const PUSH_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/push-notify` : "";
const AI_PARSE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-voice-parse` : "";
const AI_MONITOR_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-child-monitor` : "";
const FEEDBACK_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/feedback-email` : "";
const FEEDBACK_RECIPIENT = "tkisdroid@gmail.com";
const NOTIF_SETTINGS_STORAGE_PREFIX = "hyeni-notif-settings-v1";

function normalizePairCodeInput(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return "";

    const directMatch = raw.match(/KID-[A-Z0-9]{8}/i);
    if (directMatch) return directMatch[0].toUpperCase();

    try {
        const parsed = new URL(raw);
        const paramCode = parsed.searchParams.get("pairCode") || parsed.searchParams.get("code");
        if (paramCode) return normalizePairCodeInput(paramCode);
    } catch {
        // ignore URL parsing failures
    }

    const shortMatch = raw.match(/\b[A-Z0-9]{8}\b/i);
    if (shortMatch) return `KID-${shortMatch[0].toUpperCase()}`;
    return "";
}

function getNotifSettingsStorageKey(userId, role) {
    return `${NOTIF_SETTINGS_STORAGE_PREFIX}:${userId || "anonymous"}:${role || "unknown"}`;
}

function readNotifSettings(userId, role) {
    if (typeof window === "undefined" || !role) return normalizeNotifSettings(DEFAULT_NOTIFICATION_SETTINGS);
    try {
        const raw = localStorage.getItem(getNotifSettingsStorageKey(userId, role));
        if (!raw) return normalizeNotifSettings(DEFAULT_NOTIFICATION_SETTINGS);
        return normalizeNotifSettings(JSON.parse(raw), DEFAULT_NOTIFICATION_SETTINGS);
    } catch {
        return normalizeNotifSettings(DEFAULT_NOTIFICATION_SETTINGS);
    }
}

function writeNotifSettings(userId, role, settings) {
    if (typeof window === "undefined" || !role) return;
    try {
        localStorage.setItem(
            getNotifSettingsStorageKey(userId, role),
            JSON.stringify(normalizeNotifSettings(settings, DEFAULT_NOTIFICATION_SETTINGS)),
        );
    } catch {
        // ignore storage failures
    }
}

function getNativeSetupAction(health) {
    if (!health) return null;
    if (!health.postPermissionGranted || !health.notificationsEnabled || !health.channelsEnabled) {
        return { target: "notifications", label: "알림 권한 열기" };
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

// Send instant push notification via Edge Function (Phase 3 P1-4, D-A01/A02).
//
// Single-call Idempotency-Key pattern replaces the previous XHR→Fetch→Beacon
// triple-dispatch (which sent every push 3× and spammed the logs). Pattern:
//   1. Mint one crypto.randomUUID() per user action.
//   2. One fetch() POST carrying the UUID in both the Idempotency-Key header
//      AND body.idempotency_key (mirror). Beacon can't set headers → the body
//      mirror lets any offline/unload-path sender dedupe the same way.
//   3. On 2xx → done. On network error / 5xx → single retry after 800ms with
//      the SAME UUID so the server dedups it via push_idempotency. On final
//      failure log once; no fallback chain.
function createPushIdempotencyKey(preferredKey = "") {
    const key = typeof preferredKey === "string" ? preferredKey.trim() : "";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
        return key;
    }
    return crypto.randomUUID();
}

async function sendInstantPush({ action, familyId, senderUserId, title, message, idempotencyKey: preferredIdempotencyKey, ...extraData }) {
    if (!familyId) return;
    const url = PUSH_FUNCTION_URL;
    if (!url) return;
    const idempotencyKey = createPushIdempotencyKey(preferredIdempotencyKey);
    const payload = JSON.stringify({
        action, familyId, senderUserId, title, message,
        ...extraData,
        idempotency_key: idempotencyKey,
    });
    const session = await getSession().catch(() => null);
    const token = session?.access_token || "";

    const attempt = async () => {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey,
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            },
            body: payload,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response;
    };

    try {
        await attempt();
        return;
    } catch (err) {
        // One retry, 800ms delay, same UUID — server dedup handles it.
        try {
            await new Promise((resolve) => setTimeout(resolve, 800));
            await attempt();
            return;
        } catch (err2) {
            console.warn(`[Push] send ${idempotencyKey} failed: ${err2.message || err.message}`);
        }
    }
}

const REMOTE_AUDIO_CHUNK_MS = 1000;
const REMOTE_AUDIO_DEFAULT_DURATION_SEC = 60;
const TRIAL_INVITE_SHOWN_KEY = "hyeni-trial-invite-shown";
const REMOTE_AUDIO_MIME_TYPES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
];
const REMOTE_AUDIO_LEVEL_BARS = [12, 18, 24, 20, 16];
const CHILD_MARKER_COLORS = ["#F779A8", "#60A5FA", "#F59E0B", "#34D399"];
const CHILD_TRACKER_ZOOM_LEVEL = 2;
const CHILD_TRACKER_WALK_RADIUS_M = 30;
const CHILD_TRACKER_DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 };
const APP_BRAND_LOGO_SRC = "/icon-192.png";

function getRemoteAudioMimeType() {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
    return REMOTE_AUDIO_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

// Phase 5 · RL-01 / RL-04: close the current remote_listen_sessions row (if any)
// with ended_at / duration_ms / end_reason. Safe to call when no row exists — it
// silently no-ops. Uses window._remoteListenSessionId set by startRemoteAudioCapture.
async function closeRemoteListenSessionRow(endReason) {
    const sessionId = window._remoteListenSessionId;
    if (!sessionId) return;
    window._remoteListenSessionId = null; // single-shot close
    const startedAtEpoch = window._remoteListenStartedAt || Date.now();
    const durationMs = Math.max(0, Date.now() - startedAtEpoch);
    window._remoteListenStartedAt = null;
    try {
        await supabase.from("remote_listen_sessions")
            .update({
                ended_at: new Date().toISOString(),
                duration_ms: durationMs,
                end_reason: endReason || "unspecified",
            })
            .eq("id", sessionId);
    } catch (err) {
        console.error("[RL-01] failed to close session row:", err);
    }
}

function stopRemoteAudioCapture(endReason, options = {}) {
    if (window._remoteRecorderStopTimer) {
        clearTimeout(window._remoteRecorderStopTimer);
        window._remoteRecorderStopTimer = null;
    }
    if (window._remoteRecorder?.state === "recording") {
        try { window._remoteRecorder.stop(); } catch { /* ignore */ }
    }
    if (window._remoteStream) {
        try { window._remoteStream.getTracks().forEach(track => track.stop()); } catch { /* ignore */ }
    }
    window._remoteRecorder = null;
    window._remoteStream = null;
    if (!options.skipNative) {
        void stopNativeRemoteAudioCapture(endReason);
    }
    // Phase 5 RL-01: close the session audit row. Fire-and-forget; errors logged.
    void closeRemoteListenSessionRow(endReason);
}

async function sendFeedbackSuggestion({ content, familyId, user, role }) {
    const trimmed = content.trim();
    if (!trimmed) throw new Error("제안 내용을 입력해 주세요");

    const payload = {
        familyId: familyId || null,
        senderUserId: user?.id || null,
        senderRole: role || null,
        senderName: user?.user_metadata?.name || user?.email || "익명 사용자",
        senderEmail: user?.email || "",
        content: trimmed,
        appOrigin: typeof window !== "undefined" ? window.location.origin : "",
    };

    if (FEEDBACK_FUNCTION_URL) {
        const session = await getSession().catch(() => null);
        const token = session?.access_token || "";
        const response = await fetch(FEEDBACK_FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body?.error || "제안 전송에 실패했어요");
        }
        return { mode: body?.mock ? "mock" : "edge" };
    }

    if (typeof window !== "undefined") {
        const params = new URLSearchParams({
            subject: "[혜니캘린더] 기능 제안",
            body: [
                trimmed,
                "",
                `role: ${role || "unknown"}`,
                `familyId: ${familyId || "none"}`,
                `sender: ${user?.user_metadata?.name || user?.email || "anonymous"}`,
                `origin: ${window.location.origin}`,
            ].join("\n"),
        });
        window.location.assign(`mailto:${FEEDBACK_RECIPIENT}?${params.toString()}`);
        return { mode: "mailto" };
    }

    throw new Error("제안 전송 경로가 준비되지 않았어요");
}

function effectiveChildLocation(location, entitlement) {
    if (!location) return null;
    if (entitlement?.canUse?.(FEATURES.REALTIME_LOCATION)) {
        return { ...location, isDelayed: false };
    }
    const updatedAtMs = new Date(location.updatedAt || location.updated_at || 0).getTime();
    if (!updatedAtMs || Number.isNaN(updatedAtMs)) return null;
    if (Date.now() - updatedAtMs < 5 * 60 * 1000) {
        return null;
    }
    return {
        ...location,
        updatedAt: location.updatedAt || location.updated_at,
        updated_at: location.updated_at || location.updatedAt,
        isDelayed: true,
    };
}

function effectiveChildPositions(positions, entitlement) {
    if (!Array.isArray(positions)) return [];
    return positions
        .map((position) => effectiveChildLocation(position, entitlement))
        .filter(Boolean);
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = typeof reader.result === "string" ? reader.result.split(",")[1] : "";
            if (!result) {
                reject(new Error("Failed to encode audio chunk"));
                return;
            }
            resolve(result);
        };
        reader.onerror = () => reject(reader.error || new Error("FileReader error"));
        reader.readAsDataURL(blob);
    });
}

async function waitForRealtimeChannelReady(channel, timeoutMs = 20000) {
    if (!channel) throw new Error("Realtime channel unavailable");
    if (channel.state === "joined") return;

    await new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
            if (channel.state === "joined") {
                clearInterval(timer);
                resolve();
                return;
            }
            if (Date.now() - startedAt >= timeoutMs) {
                clearInterval(timer);
                reject(new Error("Realtime channel join timeout"));
            }
        }, 300);
    });
}

function isMissingNativePluginError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return message.includes("not implemented")
        || message.includes("not available")
        || message.includes("plugin") && message.includes("ambientlisten");
}

async function startNativeRemoteAudioCapture(durationSec, options = {}) {
    try {
        const { Capacitor, registerPlugin } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return false;
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            throw new Error("Supabase config unavailable");
        }

        const AmbientListen = registerPlugin("AmbientListen");
        const session = await getSession().catch(() => null);
        await AmbientListen.start({
            userId: options.childUserId || "",
            familyId: options.familyId || "",
            initiatorUserId: options.initiatorUserId || "",
            requestId: options.requestId || "",
            supabaseUrl: SUPABASE_URL,
            supabaseKey: SUPABASE_KEY,
            accessToken: session?.access_token || "",
            durationSec: Math.max(5, durationSec || REMOTE_AUDIO_DEFAULT_DURATION_SEC),
        });
        console.log("[Audio] Native ambient listen service started");
        return true;
    } catch (error) {
        if (isMissingNativePluginError(error)) {
            console.warn("[Audio] Native ambient listen plugin unavailable, falling back to WebView recorder:", error?.message || error);
            return false;
        }
        throw error;
    }
}

async function stopNativeRemoteAudioCapture(endReason) {
    try {
        const { Capacitor, registerPlugin } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return false;
        const AmbientListen = registerPlugin("AmbientListen");
        await AmbientListen.stop({ reason: endReason || "stopped" });
        return true;
    } catch (error) {
        if (!isMissingNativePluginError(error)) {
            console.warn("[Audio] Native ambient listen stop skipped:", error?.message || error);
        }
        return false;
    }
}

async function startRemoteAudioCapture(channel, durationSec = REMOTE_AUDIO_DEFAULT_DURATION_SEC, options = {}) {
    if (!channel) throw new Error("Realtime channel unavailable");

    const { familyId, initiatorUserId = null, childUserId = null, requestId = "" } = options;

    // Phase 5 D-B07: consult the remote_listen_enabled kill switch before
    // starting. If the flag is FALSE for this family, refuse to start and throw
    // — the child will never acquire getUserMedia and the parent receives
    // nothing. Flag is nullable / default true; only a hard FALSE disables.
    if (familyId) {
        try {
            const { data: flagRow } = await supabase
                .from("family_subscription")
                .select("remote_listen_enabled")
                .eq("family_id", familyId)
                .maybeSingle();
            if (flagRow && flagRow.remote_listen_enabled === false) {
                throw new Error("remote_listen_disabled_by_family");
            }
        } catch (err) {
            if (err?.message === "remote_listen_disabled_by_family") throw err;
            // Fetch errors are non-fatal — default behaviour is allowed.
            console.warn("[RL flag] lookup failed, defaulting to enabled:", err);
        }
    }

    await waitForRealtimeChannelReady(channel);
    stopRemoteAudioCapture("restart", { skipNative: true });
    await stopNativeRemoteAudioCapture("restart");
    const maxDurationMs = Math.max(5, durationSec || REMOTE_AUDIO_DEFAULT_DURATION_SEC) * 1000;

    // Phase 5 RL-01: open an audit row BEFORE the microphone capture begins, so
    // even a crash inside getUserMedia() leaves a started/never-ended row that
    // the beforeunload fallback can close on next boot.
    window._remoteListenSessionId = null;
    window._remoteListenStartedAt = Date.now();
    if (familyId) {
        try {
            const { data: sessionRow } = await supabase
                .from("remote_listen_sessions")
                .insert({
                    family_id: familyId,
                    initiator_user_id: initiatorUserId,
                    child_user_id: childUserId,
                    started_at: new Date().toISOString(),
                })
                .select("id")
                .single();
            if (sessionRow?.id) window._remoteListenSessionId = sessionRow.id;
        } catch (err) {
            console.error("[RL-01] failed to open session row:", err);
        }
    }

    const nativeStarted = await startNativeRemoteAudioCapture(durationSec, {
        familyId,
        initiatorUserId,
        childUserId,
        requestId,
    });
    if (nativeStarted) {
        window._remoteRecorderStopTimer = setTimeout(() => stopRemoteAudioCapture("timeout"), maxDurationMs);
        return true;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        void closeRemoteListenSessionRow("capture_unavailable");
        throw new Error("Audio capture unavailable");
    }
    if (typeof MediaRecorder === "undefined") {
        void closeRemoteListenSessionRow("recorder_unavailable");
        throw new Error("MediaRecorder unavailable");
    }

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (micErr) {
        // Mic denied / unavailable → close the session row we just opened.
        void closeRemoteListenSessionRow("permission_denied");
        throw micErr;
    }
    const mimeType = getRemoteAudioMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    recorder.ondataavailable = async (event) => {
        if (!event.data?.size) return;
        try {
            const base64 = await blobToBase64(event.data);
            channel.send({
                type: "broadcast",
                event: "audio_chunk",
                payload: {
                    data: base64,
                    mimeType: event.data.type || mimeType || "audio/webm",
                    durationMs: REMOTE_AUDIO_CHUNK_MS,
                    requestId,
                    source: "web-mediarecorder",
                }
            });
        } catch (error) {
            console.error("[Audio] Failed to encode/send chunk:", error);
        }
    };

    recorder.onstop = () => {
        if (window._remoteStream === stream) {
            try { stream.getTracks().forEach(track => track.stop()); } catch { /* ignore */ }
            window._remoteStream = null;
        }
        if (window._remoteRecorder === recorder) {
            window._remoteRecorder = null;
        }
    };

    recorder.start(REMOTE_AUDIO_CHUNK_MS);
    window._remoteRecorder = recorder;
    window._remoteStream = stream;
    window._remoteRecorderStopTimer = setTimeout(() => stopRemoteAudioCapture("timeout"), maxDurationMs);
    return true;
}

// Native background location (Capacitor plugin)
async function startNativeLocationService(userId, familyId, accessToken, role) {
    try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
            const { registerPlugin } = await import("@capacitor/core");
            const BackgroundLocation = registerPlugin("BackgroundLocation");
            await BackgroundLocation.startService({
                userId, familyId,
                supabaseUrl: SUPABASE_URL,
                supabaseKey: SUPABASE_KEY,
                accessToken: accessToken || "",
                role: role || "child"
            });
            console.log("[Native] Background location service started");
            return true;
        }
    } catch (e) {
        console.log("[Native] Not available (web mode):", e.message);
    }
    return false;
}

async function requestNativeCurrentLocation(userId, familyId, accessToken, role) {
    try {
        const { Capacitor, registerPlugin } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
            const BackgroundLocation = registerPlugin("BackgroundLocation");
            await BackgroundLocation.requestCurrentLocation({
                userId, familyId,
                supabaseUrl: SUPABASE_URL,
                supabaseKey: SUPABASE_KEY,
                accessToken: accessToken || "",
                role: role || "child"
            });
            console.log("[Native] Immediate child location refresh requested");
            return true;
        }
    } catch (e) {
        console.log("[Native] Immediate location refresh unavailable:", e.message);
    }
    return false;
}

async function stopNativeLocationService() {
    try {
        const { Capacitor, registerPlugin } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
            const BackgroundLocation = registerPlugin("BackgroundLocation");
            await BackgroundLocation.stopService();
            console.log("[Native] Background location service stopped");
        }
    } catch { /* web mode */ }
}

function rememberParentPairingIntent() {
    if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PARENT_PAIRING_INTENT_KEY, "1");
    }
}

function clearParentPairingIntent() {
    if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PARENT_PAIRING_INTENT_KEY);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mascot
// ─────────────────────────────────────────────────────────────────────────────
const BunnyMascot = ({ size = 80 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <ellipse cx="33" cy="22" rx="9" ry="18" fill="#FFD6E8" />
        <ellipse cx="67" cy="22" rx="9" ry="18" fill="#FFD6E8" />
        <ellipse cx="33" cy="22" rx="5" ry="13" fill="#FFB3D1" />
        <ellipse cx="67" cy="22" rx="5" ry="13" fill="#FFB3D1" />
        <ellipse cx="50" cy="65" rx="26" ry="22" fill="#FFF0F7" />
        <circle cx="50" cy="48" r="24" fill="#FFF0F7" />
        <path d="M38 44 Q40 41 42 44" stroke="#FF7BAC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M58 44 Q60 41 62 44" stroke="#FF7BAC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="50" cy="51" rx="3" ry="2" fill="#FFB3D1" />
        <path d="M45 54 Q50 58 55 54" stroke="#FF7BAC" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="37" cy="52" r="5" fill="#FFB3D1" opacity="0.5" />
        <circle cx="63" cy="52" r="5" fill="#FFB3D1" opacity="0.5" />
        <ellipse cx="28" cy="68" rx="7" ry="10" fill="#FFF0F7" transform="rotate(-20 28 68)" />
        <ellipse cx="72" cy="68" rx="7" ry="10" fill="#FFF0F7" transform="rotate(20 72 68)" />
    </svg>
);

const AppBrandLogo = ({ size = 80, radius = 24, shadow = true }) => (
    <img
        src={APP_BRAND_LOGO_SRC}
        alt="혜니캘린더 로고"
        style={{
            width: size,
            height: size,
            borderRadius: radius,
            objectFit: "cover",
            display: "block",
            boxShadow: shadow ? "0 10px 28px rgba(232,121,160,0.20)" : "none",
        }}
    />
);

// ─────────────────────────────────────────────────────────────────────────────
// Parent Setup Screen (extracted component – hooks must be at top level)
// ─────────────────────────────────────────────────────────────────────────────
const FF = "'Pretendard Variable','Pretendard','Noto Sans KR','Apple SD Gothic Neo',sans-serif";

const DESIGN = Object.freeze({
    colors: {
        brand: "#E65C92",
        brandDark: "#C4447A",
        pink: "#F779A8",
        pinkDeep: "#E65C92",
        pinkText: "#B0477A",
        pinkSoft: "#FFF5FA",
        pinkLine: "#FFE4EF",
        pinkLineStrong: "#FFD4E7",
        pale: "#FFFAF5",
        cream: "#FCF1EB",
        parent: "#3B82F6",
        parentDeep: "#2563EB",
        parentPale: "#EFF6FF",
        ink: "#38252D",
        inkSoft: "#75525C",
        muted: "#9B7C85",
        line: "#F3E9EC",
        lineStrong: "#EFE9F1",
        success: "#059669",
        successPale: "#ECFDF5",
        warning: "#D97706",
        warningPale: "#FFFBEB",
        danger: "#DC2626",
        dangerPale: "#FEF2F2",
        surface: "#FFFFFF",
    },
    gradients: {
        shell: "radial-gradient(240px 160px at 10% 0%, rgba(255,200,220,0.80) 0%, transparent 60%), radial-gradient(240px 200px at 100% 100%, rgba(255,225,180,0.60) 0%, transparent 60%), #FFFAF5",
        page: "radial-gradient(1400px 800px at 10% -10%, #FFDEEC 0%, transparent 55%), radial-gradient(1400px 800px at 90% 110%, #FFEBBE 0%, transparent 55%), radial-gradient(1200px 700px at 50% 50%, #D0E0FA 0%, transparent 60%), linear-gradient(180deg, #FCF1EB 0%, #F5EBF3 100%)",
        primary: "linear-gradient(135deg,#F779A8 0%,#E65C92 100%)",
        hero: "linear-gradient(135deg,#FFC2D9 0%,#FF9EBF 100%)",
        parent: "linear-gradient(135deg,#60A5FA 0%,#3B82F6 100%)",
        child: "linear-gradient(135deg,#F779A8 0%,#FF6B9D 100%)",
        warm: "linear-gradient(135deg,#FFFFFF 0%,#FFF5FA 100%)",
        onboard: "radial-gradient(500px 400px at 50% 0%, #FFDCEC 0%, transparent 60%), radial-gradient(400px 300px at 100% 100%, #FFEBC2 0%, transparent 60%), radial-gradient(400px 350px at 0% 80%, #D0E4FA 0%, transparent 60%), linear-gradient(180deg, #FFF8F2 0%, #F6E9F0 100%)",
        map: "radial-gradient(200px 200px at 30% 30%, #FFE4EF 0%, transparent 60%), radial-gradient(300px 220px at 70% 60%, #E0F0FE 0%, transparent 60%), radial-gradient(200px 180px at 50% 90%, #FFEBBE 0%, transparent 60%), linear-gradient(180deg, #FDF5F0 0%, #F0E8F3 100%)",
        danger: "linear-gradient(135deg,#EF4444,#B91C1C)",
    },
    radius: {
        sm: 12,
        md: 16,
        lg: 20,
        xl: 24,
        hero: 32,
        sheet: "32px 32px 0 0",
    },
    shadow: {
        soft: "0 4px 12px rgba(180,120,150,0.10)",
        card: "0 4px 12px rgba(180,120,150,0.10)",
        elevated: "0 12px 32px rgba(247,121,168,0.30)",
        sheet: "0 -16px 40px rgba(180,120,150,0.20)",
        focus: "0 0 0 4px rgba(247,121,168,0.16)",
    },
});

const modalBackdropStyle = {
    background: "rgba(31,41,55,0.38)",
    backdropFilter: "blur(12px)",
};

const makeCardStyle = (overrides = {}) => ({
    background: DESIGN.colors.surface,
    borderRadius: DESIGN.radius.xl,
    border: `2px solid rgba(255,228,239,0.8)`,
    boxShadow: DESIGN.shadow.card,
    ...overrides,
});

const makeSheetStyle = (overrides = {}) => ({
    background: DESIGN.colors.surface,
    borderRadius: DESIGN.radius.sheet,
    border: `1px solid ${DESIGN.colors.pinkLine}`,
    boxShadow: DESIGN.shadow.sheet,
    ...overrides,
});

const makeInputStyle = (overrides = {}) => ({
    width: "100%",
    padding: "12px 14px",
    border: `1.5px solid ${DESIGN.colors.line}`,
    borderRadius: DESIGN.radius.md,
    fontSize: 15,
    color: DESIGN.colors.ink,
    background: DESIGN.colors.surface,
    fontFamily: FF,
    outline: "none",
    boxSizing: "border-box",
    ...overrides,
});

const makePrimaryButtonStyle = (overrides = {}) => ({
    width: "100%",
    minHeight: 48,
    padding: "14px 16px",
    background: DESIGN.gradients.primary,
    color: "white",
    border: "none",
    borderRadius: DESIGN.radius.lg,
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: FF,
    boxShadow: "0 12px 26px rgba(190,24,93,0.22)",
    ...overrides,
});

const makeSecondaryButtonStyle = (overrides = {}) => ({
    width: "100%",
    minHeight: 44,
    padding: "12px 14px",
    background: DESIGN.colors.surface,
    color: DESIGN.colors.muted,
    border: `1.5px solid ${DESIGN.colors.line}`,
    borderRadius: DESIGN.radius.lg,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: FF,
    ...overrides,
});

function ParentSetupScreen({ onCreateFamily, onJoinAsParent }) {
    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState("");
    const [mode, setMode] = useState(null); // null | "create" | "join"
    const [busy, setBusy] = useState(false);
    const normalizedJoinCode = normalizePairCodeInput(joinCode) || normalizePairCodeInput(`KID-${joinCode}`);
    const canJoin = !busy && !!normalizedJoinCode;

    const handleJoinCodeChange = (event) => {
        setJoinError("");
        const rawValue = event.target.value;
        const normalized = normalizePairCodeInput(rawValue);
        if (normalized) {
            setJoinCode(normalized);
            return;
        }

        const cleaned = rawValue.toUpperCase().replace(/[^A-Z0-9-]/g, "");
        if (cleaned.startsWith("KID-")) {
            setJoinCode(cleaned.slice(0, 12));
            return;
        }

        const compact = cleaned.replace(/-/g, "");
        if ("KID".startsWith(compact)) {
            setJoinCode(compact);
            return;
        }
        if (compact.startsWith("KID")) {
            setJoinCode(`KID-${compact.slice(3, 11)}`);
            return;
        }

        setJoinCode(compact.slice(0, 8));
    };

    const handleCreateClick = async () => {
        setBusy(true);
        try {
            await onCreateFamily();
        } finally {
            setBusy(false);
        }
    };

    const handleJoinClick = async () => {
        if (!normalizedJoinCode) {
            setJoinError("KID-로 시작하는 8자리 연동코드를 입력해 주세요");
            return;
        }

        setBusy(true);
        setJoinError("");
        try {
            await onJoinAsParent(normalizedJoinCode);
        } catch (err) {
            const rawMessage = err?.message || "";
            const message = rawMessage.includes("Invalid pair code") || rawMessage.includes("연동 코드를 찾지 못했습니다")
                ? "연동코드를 찾지 못했어요. 코드를 다시 확인해 주세요"
                : rawMessage.includes("Too many")
                    ? "시도 횟수가 많아요. 1시간 후 다시 시도해 주세요"
                    : rawMessage || "합류에 실패했어요. 연동코드를 확인해 주세요";
            setJoinError(message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="hyeni-app-shell" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: DESIGN.gradients.shell, fontFamily: FF, padding: 20 }}>
            <div style={makeCardStyle({ padding: "32px 24px", maxWidth: 380, width: "100%", textAlign: "center" })}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                    <AppBrandLogo size={76} radius={22} />
                </div>
                <div style={{ fontSize: 21, fontWeight: 900, color: "#BE185D", marginBottom: 6, letterSpacing: -0.4 }}>가족 연결을 시작해요</div>
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 26, lineHeight: 1.55, fontWeight: 600 }}>
                    새 가족을 만들거나<br/>이미 받은 연동코드로 합류하세요
                </div>

                {!mode && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <button onClick={() => setMode("create")}
                            style={{ ...makePrimaryButtonStyle({ padding: "16px 18px" }), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <span>새 가족 만들기</span>
                            <span aria-hidden="true">→</span>
                        </button>
                        <button onClick={() => setMode("join")}
                            style={{ ...makeSecondaryButtonStyle({ padding: "16px 18px", background: DESIGN.colors.parentPale, color: DESIGN.colors.parentDeep, border: "1.5px solid #BFDBFE" }), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <span>기존 가족에 합류</span>
                            <span aria-hidden="true">→</span>
                        </button>
                    </div>
                )}

                {mode === "create" && (
                    <div>
                        <div style={{ fontSize: 14, color: "#374151", marginBottom: 16, fontWeight: 600 }}>
                            새 가족을 만들면 연동코드가 생성됩니다.<br/>이 코드로 배우자와 아이가 합류할 수 있어요.
                        </div>
                        <button disabled={busy} onClick={handleCreateClick}
                            style={{ padding: "14px 32px", background: "#BE185D", color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer", fontFamily: FF, opacity: busy ? 0.6 : 1, boxShadow: busy ? "none" : "0 10px 22px rgba(190,24,93,0.18)" }}>
                            {busy ? "생성 중..." : "가족 만들기"}
                        </button>
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, cursor: "pointer", fontFamily: FF }}>← 뒤로</button>
                        </div>
                    </div>
                )}

                {mode === "join" && (
                    <div>
                        <div style={{ fontSize: 14, color: "#374151", marginBottom: 12, fontWeight: 600 }}>
                            배우자에게 받은 연동코드를 입력하세요
                        </div>
                        <div style={{ marginBottom: joinError ? 8 : 12 }}>
                            <input value={joinCode} onChange={handleJoinCodeChange}
                                placeholder="KID-804DF582 또는 804DF582"
                                style={{ width: "100%", padding: "11px 14px", border: `2px solid ${joinError ? "#FCA5A5" : "#E5E7EB"}`, borderRadius: 12, fontSize: 16, fontWeight: 800, fontFamily: "monospace", textAlign: "center", letterSpacing: 1, boxSizing: "border-box", outline: "none", color: "#111827", background: "white" }} />
                        </div>
                        {joinError && <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 700, marginBottom: 12 }}>{joinError}</div>}
                        <button disabled={!canJoin} onClick={handleJoinClick}
                            style={{ padding: "14px 32px", background: "#2563EB", color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: canJoin ? "pointer" : "default", fontFamily: FF, opacity: canJoin ? 1 : 0.6, boxShadow: canJoin ? "0 10px 22px rgba(37,99,235,0.18)" : "none" }}>
                            {busy ? "합류 중..." : "합류하기"}
                        </button>
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, cursor: "pointer", fontFamily: FF }}>← 뒤로</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
    { id: "school", label: "학원", emoji: "📚", color: "#A78BFA", bg: "#EDE9FE" },
    { id: "sports", label: "운동", emoji: "⚽", color: "#34D399", bg: "#D1FAE5" },
    { id: "hobby", label: "취미", emoji: "🎨", color: "#F59E0B", bg: "#FEF3C7" },
    { id: "family", label: "가족", emoji: "👨‍👩‍👧", color: "#F87171", bg: "#FEE2E2" },
    { id: "friend", label: "친구", emoji: "👫", color: "#60A5FA", bg: "#DBEAFE" },
    { id: "other", label: "기타", emoji: "🌟", color: "#EC4899", bg: "#FCE7F3" },
];

const ACADEMY_PRESETS = [
    { label: "영어학원", emoji: "🔤", category: "school" },
    { label: "수학학원", emoji: "🔢", category: "school" },
    { label: "피아노", emoji: "🎹", category: "school" },
    { label: "태권도", emoji: "🥋", category: "sports" },
    { label: "축구교실", emoji: "⚽", category: "sports" },
    { label: "수영", emoji: "🏊", category: "sports" },
    { label: "미술학원", emoji: "🎨", category: "hobby" },
    { label: "코딩학원", emoji: "💻", category: "school" },
    { label: "무용", emoji: "💃", category: "hobby" },
    { label: "독서논술", emoji: "📖", category: "school" },
];

const SCHEDULE_PRESETS = [
    { label: "피아노", emoji: "🎹", category: "school" },
    { label: "태권도", emoji: "🥋", category: "sports" },
    { label: "연기학원", emoji: "🎭", category: "hobby" },
    { label: "중국어", emoji: "🇨🇳", category: "school" },
    { label: "방과후 영어", emoji: "🔤", category: "school" },
    { label: "방과후 과학실험", emoji: "🔬", category: "school" },
    { label: "방과후 3D펜", emoji: "🖊️", category: "hobby" },
];

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS_KO = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
// HTML escape to prevent XSS in Kakao CustomOverlay template literals
function escHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

const ARRIVAL_R = 50; // metres (geo-fence radius)
const DEPARTURE_TIMEOUT_MS = 90_000; // 90초 outside = departure alert (GPS 지터 오알림 방지)
const DEFAULT_NOTIF = normalizeNotifSettings(DEFAULT_NOTIFICATION_SETTINGS);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function haversineM(la1, lo1, la2, lo2) {
    const R = 6371000, p1 = la1 * Math.PI / 180, p2 = la2 * Math.PI / 180;
    const dp = (la2 - la1) * Math.PI / 180, dl = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRoutePosition(position) {
    if (!position) return null;
    const lat = Number(position.lat);
    const lng = Number(position.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
}

function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function compactRoutePoints(points) {
    const compacted = [];
    points.forEach((point) => {
        const normalized = toRoutePosition(point);
        if (!normalized) return;
        const prev = compacted[compacted.length - 1];
        if (prev && Math.abs(prev.lat - normalized.lat) < 0.0000001 && Math.abs(prev.lng - normalized.lng) < 0.0000001) return;
        compacted.push(normalized);
    });
    return compacted;
}

function sumRouteDistance(points) {
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
        total += haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    }
    return total;
}

function createHttpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function parseKakaoWalkingRoute(data) {
    const route = data?.routes?.[0];
    if (!route || route.result_code !== 0) {
        throw new Error(route?.result_message || "Kakao walking route failed");
    }

    const points = [];
    const sections = Array.isArray(route.sections) ? route.sections : [];
    sections.forEach((section) => {
        const roads = Array.isArray(section?.roads) ? section.roads : [];
        roads.forEach((road) => {
            const vertexes = Array.isArray(road?.vertexes) ? road.vertexes : [];
            for (let i = 0; i + 1 < vertexes.length; i += 2) {
                points.push({ lng: vertexes[i], lat: vertexes[i + 1] });
            }
        });
    });

    const compacted = compactRoutePoints(points);
    if (compacted.length < 2) throw new Error("Kakao walking route has no path");

    const distance = finiteNumber(route.summary?.distance)
        ?? sections.reduce((sum, section) => sum + (finiteNumber(section?.distance) ?? 0), 0)
        ?? sumRouteDistance(compacted);
    const duration = finiteNumber(route.summary?.duration)
        ?? sections.reduce((sum, section) => sum + (finiteNumber(section?.duration) ?? 0), 0);

    return {
        provider: "kakao",
        points: compacted,
        distance,
        duration: duration || null,
    };
}

function parseOsmFootRoute(data) {
    if (data?.code !== "Ok") throw new Error(data?.message || "OSM foot route failed");
    const route = data?.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!Array.isArray(coordinates)) throw new Error("OSM foot route has no geometry");

    const points = compactRoutePoints(coordinates.map(([lng, lat]) => ({ lat, lng })));
    if (points.length < 2) throw new Error("OSM foot route has no path");

    return {
        provider: "osm-foot",
        points,
        distance: finiteNumber(route.distance) ?? sumRouteDistance(points),
        duration: finiteNumber(route.duration),
    };
}

let kakaoWalkingDirectionsDisabled = false;

async function fetchKakaoWalkingRoute(start, destination, signal) {
    if (!KAKAO_REST_KEY || kakaoWalkingDirectionsDisabled) {
        throw new Error("Kakao walking route unavailable");
    }

    const params = new URLSearchParams({
        origin: `${start.lng},${start.lat}`,
        destination: `${destination.lng},${destination.lat}`,
        waypoints: "",
        radius: "5000",
        priority: "MAIN_STREET",
        summary: "false",
    });

    const response = await fetch(`${KAKAO_WALKING_DIRECTIONS_URL}?${params.toString()}`, {
        method: "GET",
        headers: {
            accept: "application/json",
            service: "hyeni-calendar",
            Authorization: `KakaoAK ${KAKAO_REST_KEY}`,
        },
        signal,
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            kakaoWalkingDirectionsDisabled = true;
        }
        throw createHttpError(`Kakao walking route HTTP ${response.status}`, response.status);
    }

    return parseKakaoWalkingRoute(await response.json());
}

async function fetchOsmFootRoute(start, destination, signal) {
    const coords = `${start.lng},${start.lat};${destination.lng},${destination.lat}`;
    const params = new URLSearchParams({
        overview: "full",
        geometries: "geojson",
        steps: "false",
    });
    const response = await fetch(`${OSM_FOOT_DIRECTIONS_URL}/${coords}?${params.toString()}`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal,
    });
    if (!response.ok) throw createHttpError(`OSM foot route HTTP ${response.status}`, response.status);
    return parseOsmFootRoute(await response.json());
}

async function fetchWalkingRoute(start, destination, signal) {
    const startCoord = toRoutePosition(start);
    const destinationCoord = toRoutePosition(destination);
    if (!startCoord || !destinationCoord) throw new Error("invalid route coordinates");

    try {
        return await fetchKakaoWalkingRoute(startCoord, destinationCoord, signal);
    } catch (error) {
        if (signal?.aborted) throw error;
        return fetchOsmFootRoute(startCoord, destinationCoord, signal);
    }
}

function formatLatLngLabel(position) {
    if (!Number.isFinite(position?.lat) || !Number.isFinite(position?.lng)) return "";
    return `좌표 ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
}

function getPositionLocationKey(position) {
    if (position?.user_id) return `user:${position.user_id}`;
    if (!Number.isFinite(position?.lat) || !Number.isFinite(position?.lng)) return "";
    return `coord:${position.lat.toFixed(6)},${position.lng.toFixed(6)}`;
}

function extractNeighborhoodLabel(label, source = {}) {
    const directLabel = [
        source?.region_3depth_h_name,
        source?.region_3depth_name,
        source?.region_2depth_name,
    ].find(value => String(value || "").trim());
    if (directLabel) return String(directLabel).trim();

    const text = String(label || "").trim();
    if (!text || text.startsWith("좌표")) return "";

    const tokens = text
        .split(/\s+/)
        .map(part => part.replace(/[(),]/g, "").trim())
        .filter(Boolean);
    const neighborhood = tokens.find(part => /(동|읍|면|리)$/.test(part));
    if (neighborhood) return neighborhood;

    return tokens.find(part => /(구|군|시)$/.test(part)) || "";
}

function formatCompactPlaceName(value) {
    return String(value || "")
        .replace(/([가-힣])(\d+차)/g, "$1 $2")
        .replace(/\s*\d+\s*동(?=\s|$)/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function buildCompactAddressLabel(resultItem) {
    const road = resultItem?.road_address || null;
    const lot = resultItem?.address || null;
    const neighborhood = extractNeighborhoodLabel("", lot)
        || extractNeighborhoodLabel("", road)
        || extractNeighborhoodLabel(lot?.address_name)
        || extractNeighborhoodLabel(road?.address_name);
    const buildingName = formatCompactPlaceName(road?.building_name);

    if (neighborhood && buildingName) return `${neighborhood} ${buildingName}`;
    if (neighborhood && road?.road_name) return `${neighborhood} ${formatCompactPlaceName(road.road_name)}`;
    if (neighborhood) return neighborhood;
    return formatCompactPlaceName(road?.address_name || lot?.address_name || "");
}

function isDetailedKoreanAddress(label, source = {}) {
    const text = String(label || "").trim();
    if (!text) return false;
    return Boolean(
        source?.road_name
        || source?.building_name
        || source?.main_building_no
        || source?.main_address_no
        || /\d/.test(text)
    );
}

function extractPreciseAddressFromKakao(resultItem, fallbackPosition) {
    const road = resultItem?.road_address || null;
    const lot = resultItem?.address || null;
    const roadLabel = road?.address_name || "";
    const neighborhood = extractNeighborhoodLabel("", lot) || extractNeighborhoodLabel("", road) || extractNeighborhoodLabel(lot?.address_name) || extractNeighborhoodLabel(roadLabel);
    const shortLabel = buildCompactAddressLabel(resultItem);
    if (roadLabel && isDetailedKoreanAddress(roadLabel, road)) {
        return {
            label: [roadLabel, road?.building_name].filter(Boolean).join(" · "),
            shortLabel,
            precise: true,
            neighborhood,
        };
    }

    const lotLabel = lot?.address_name || "";
    if (lotLabel && isDetailedKoreanAddress(lotLabel, lot)) {
        return { label: lotLabel, shortLabel, precise: true, neighborhood };
    }

    return {
        label: formatLatLngLabel(fallbackPosition) || "정확한 위치 확인 중",
        shortLabel,
        precise: false,
        neighborhood,
    };
}

const getDIM = (y, m) => new Date(y, m + 1, 0).getDate();
const getFD = (y, m) => new Date(y, m, 1).getDay();
const fmtT = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// Kakao Maps
let kakaoReady = null; // shared promise
function loadKakaoMap(appKey) {
    const normalizedKey = normalizeKakaoAppKey(appKey);
    if (kakaoReady) return kakaoReady;
    kakaoReady = new Promise((res, rej) => {
        if (window.kakao?.maps?.LatLng) { res(); return; }
        if (!normalizedKey) {
            kakaoReady = null;
            rej(new Error("missing Kakao app key"));
            return;
        }
        const s = document.createElement("script");
        let settled = false;
        const finish = (callback) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            callback();
        };
        const timer = setTimeout(() => {
            s.remove();
            kakaoReady = null;
            finish(() => rej(new Error("Kakao 지도 SDK 로딩 시간이 초과됐어요")));
        }, 10000);
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(normalizedKey)}&autoload=false&libraries=services`;
        s.onload = () => {
            if (!window.kakao?.maps?.load) {
                kakaoReady = null;
                finish(() => rej(new Error("Kakao 지도 SDK가 초기화되지 않았어요")));
                return;
            }
            try {
                window.kakao.maps.load(() => {
                    console.log("[KakaoMap] SDK ready");
                    finish(res);
                });
            } catch (error) {
                kakaoReady = null;
                finish(() => rej(error));
            }
        };
        s.onerror = () => {
            kakaoReady = null;
            finish(() => rej(new Error("Kakao 지도 SDK 스크립트를 불러오지 못했어요")));
        };
        document.head.appendChild(s);
    });
    return kakaoReady;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kakao Static Map (thumbnail)
// ─────────────────────────────────────────────────────────────────────────────
function KakaoStaticMap({ lat, lng, width = "100%", height = 120 }) {
    const ref = useRef();
    useEffect(() => {
        if (!window.kakao?.maps || !ref.current) return;
        new window.kakao.maps.StaticMap(ref.current, {
            center: new window.kakao.maps.LatLng(lat, lng),
            level: 3,
            marker: { position: new window.kakao.maps.LatLng(lat, lng) }
        });
    }, [lat, lng]);
    return <div ref={ref} style={{ width, height, borderRadius: 14, overflow: "hidden" }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Map Zoom Controls (아이용 큰 버튼)
// ─────────────────────────────────────────────────────────────────────────────
function MapZoomControls({ mapObj, style }) {
    const zoom = (delta) => {
        if (!mapObj?.current) return;
        const lv = mapObj.current.getLevel();
        mapObj.current.setLevel(lv + delta, { animate: true });
    };
    const btnSt = { width: 48, height: 48, borderRadius: 14, border: "none", fontSize: 24, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px rgba(0,0,0,0.15)", fontFamily: FF };
    return (
        <div style={{ position: "absolute", bottom: 16, left: 12, display: "flex", flexDirection: "column", gap: 8, zIndex: 10, ...style }}>
            <button onClick={() => zoom(-1)} style={{ ...btnSt, background: "white", color: "#E879A0" }}>+</button>
            <button onClick={() => zoom(1)} style={{ ...btnSt, background: "white", color: "#9CA3AF" }}>−</button>
        </div>
    );
}

function toLatLngPoint(point) {
    if (!point) return null;
    const lat = Number(point.lat ?? point.location?.lat);
    const lng = Number(point.lng ?? point.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

function clampPercent(value, min = 8, max = 92) {
    return Math.max(min, Math.min(max, value));
}

function projectFallbackMapPoint(point, center) {
    const p = toLatLngPoint(point);
    const c = toLatLngPoint(center) || { lat: 37.5665, lng: 126.9780 };
    if (!p) return null;
    const latOffset = (c.lat - p.lat) * 8500;
    const lngOffset = (p.lng - c.lng) * 6500;
    return {
        left: clampPercent(50 + lngOffset),
        top: clampPercent(50 + latOffset),
    };
}

function FallbackMapCanvas({
    center,
    children = [],
    eventPlaces = [],
    savedPlaces = [],
    routePoints = [],
    selectedKey = "",
    onSelect,
    title = "위치 지도",
    subtitle = "",
    height = "100%",
    showRadius = false,
}) {
    const normalizedCenter = toLatLngPoint(center) || { lat: 37.5665, lng: 126.9780 };
    const hasSdkKey = Boolean(KAKAO_APP_KEY);
    const childMarkers = children
        .map((child, index) => {
            const point = toLatLngPoint(child);
            const pos = projectFallbackMapPoint(point, normalizedCenter);
            if (!point || !pos) return null;
            return {
                key: child.key || child.trackerKey || child.user_id || child.id || `child-${index}`,
                type: "child",
                pos,
                emoji: child.emoji || "🧒",
                label: child.name || "아이",
                color: child.color || CHILD_MARKER_COLORS[index % CHILD_MARKER_COLORS.length],
            };
        })
        .filter(Boolean);
    const eventMarkers = eventPlaces
        .map((place, index) => {
            const point = toLatLngPoint(place.location || place);
            const pos = projectFallbackMapPoint(point, normalizedCenter);
            if (!point || !pos) return null;
            return {
                key: place.key || place.id || `event-${index}`,
                type: "event",
                pos,
                emoji: place.emoji || place.nextEvent?.emoji || "📍",
                label: place.title || place.nextEvent?.title || "일정 장소",
                color: place.color || place.nextEvent?.color || DESIGN.colors.pink,
            };
        })
        .filter(Boolean);
    const savedMarkers = savedPlaces
        .map((place, index) => {
            const point = toLatLngPoint(place.location || place);
            const pos = projectFallbackMapPoint(point, normalizedCenter);
            if (!point || !pos) return null;
            return {
                key: place.key || place.id || `saved-${index}`,
                type: "saved",
                pos,
                emoji: place.emoji || "⭐",
                label: place.name || place.title || "저장 장소",
                color: DESIGN.colors.brand,
            };
        })
        .filter(Boolean);
    const route = routePoints
        .map(point => projectFallbackMapPoint(point, normalizedCenter))
        .filter(Boolean);
    const allMarkers = [...eventMarkers, ...savedMarkers, ...childMarkers];
    const sdkFailed = /실패|초과|오류|등록/i.test(subtitle || "");
    const sdkBadge = sdkFailed ? "간이 지도" : hasSdkKey ? "SDK 대기" : "지도키 필요";

    return (
        <div
            data-testid="hyeni-fallback-map"
            style={{
                position: "relative",
                width: "100%",
                height,
                minHeight: typeof height === "number" ? height : undefined,
                overflow: "hidden",
                background: "linear-gradient(145deg,#EFF6FF 0%,#FFF9FC 52%,#FFF8F2 100%)",
                fontFamily: FF,
            }}
        >
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                <path d="M-5 74 C20 62 28 44 54 44 C73 44 83 31 105 25" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" opacity="0.92" />
                <path d="M-5 74 C20 62 28 44 54 44 C73 44 83 31 105 25" fill="none" stroke="#FED7AA" strokeWidth="2" strokeLinecap="round" opacity="0.9" strokeDasharray="2 4" />
                <path d="M14 -5 C23 19 40 29 38 52 C36 72 49 84 72 105" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" opacity="0.86" />
                <path d="M14 -5 C23 19 40 29 38 52 C36 72 49 84 72 105" fill="none" stroke="#BFDBFE" strokeWidth="2" strokeLinecap="round" opacity="0.9" strokeDasharray="2 4" />
                <path d="M-5 20 C21 22 29 12 48 17 C68 22 77 45 105 48" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" opacity="0.76" />
                <path d="M4 92 L96 8" stroke="#FFFFFF" strokeWidth="2" opacity="0.45" strokeDasharray="1 5" />
                {route.length >= 2 && (
                    <polyline
                        points={route.map(point => `${point.left},${point.top}`).join(" ")}
                        fill="none"
                        stroke={DESIGN.colors.parent}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.95"
                    />
                )}
            </svg>

            {showRadius && childMarkers[0] && (
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        left: `${childMarkers[0].pos.left}%`,
                        top: `${childMarkers[0].pos.top}%`,
                        width: 180,
                        height: 180,
                        borderRadius: "50%",
                        transform: "translate(-50%, -50%)",
                        background: "rgba(37,99,235,0.10)",
                        border: "2px dashed rgba(37,99,235,0.34)",
                    }}
                />
            )}

            <div style={{ position: "absolute", left: 14, top: 14, right: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, zIndex: 3 }}>
                <div style={{ minWidth: 0, padding: "9px 12px", borderRadius: 16, background: "rgba(255,255,255,0.90)", border: `1px solid ${DESIGN.colors.pinkLine}`, boxShadow: "0 8px 22px rgba(31,41,55,0.08)" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: DESIGN.colors.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: DESIGN.colors.muted, marginTop: 2 }}>{subtitle || (hasSdkKey ? "지도 SDK 연결 중" : "간이 지도 모드")}</div>
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 999, background: sdkFailed ? "#FFF7ED" : hasSdkKey ? "#EFF6FF" : "#FFFBEB", color: sdkFailed ? "#C2410C" : hasSdkKey ? DESIGN.colors.parentDeep : "#92400E", fontSize: 10, fontWeight: 900, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(31,41,55,0.08)" }}>
                    {sdkBadge}
                </div>
            </div>

            {allMarkers.map(marker => {
                const isSelected = selectedKey === marker.key || selectedKey === `${marker.type}:${marker.key}`;
                const isChild = marker.type === "child";
                return (
                    <button
                        key={`${marker.type}-${marker.key}`}
                        type="button"
                        onClick={() => onSelect?.(marker)}
                        style={{
                            position: "absolute",
                            left: `${marker.pos.left}%`,
                            top: `${marker.pos.top}%`,
                            transform: "translate(-50%, -100%)",
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: onSelect ? "pointer" : "default",
                            zIndex: isChild ? 5 : 4,
                            fontFamily: FF,
                        }}
                    >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", filter: isSelected ? `drop-shadow(0 8px 16px ${marker.color}55)` : "drop-shadow(0 4px 10px rgba(31,41,55,0.18))" }}>
                            <div style={{
                                minWidth: isChild ? 42 : 34,
                                height: isChild ? 42 : 34,
                                padding: isChild ? "0 8px" : "0 7px",
                                borderRadius: isChild ? 16 : 14,
                                background: marker.color,
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "3px solid white",
                                fontSize: isChild ? 18 : 15,
                                fontWeight: 900,
                                boxShadow: isSelected ? `0 0 0 7px ${marker.color}24` : `0 0 0 4px ${marker.color}18`,
                            }}>
                                {marker.emoji}
                            </div>
                            <div style={{
                                marginTop: 5,
                                maxWidth: 116,
                                padding: "5px 9px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.94)",
                                color: marker.color,
                                border: `1px solid ${marker.color}33`,
                                fontSize: 10,
                                fontWeight: 900,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}>
                                {marker.label}
                            </div>
                        </div>
                    </button>
                );
            })}

            {allMarkers.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: DESIGN.colors.muted, fontSize: 13, fontWeight: 800 }}>
                    표시할 위치가 아직 없습니다.
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Map Picker (Kakao Maps)
// ─────────────────────────────────────────────────────────────────────────────
function MapPicker({ initial, currentPos, title = "📍 장소 설정", onConfirm, onClose }) {
    const defaultCenter = initial || currentPos || { lat: 37.5665, lng: 126.9780 };
    const hasPreloadedKakao = typeof window !== "undefined" && !!window.kakao?.maps?.LatLng;
    const mapRef = useRef(), mapObj = useRef(), markerRef = useRef();
    const [pos, setPos] = useState(defaultCenter);
    const [address, setAddress] = useState(initial?.address || "");
    const [loading, setLoading] = useState(() => (hasPreloadedKakao ? false : !!KAKAO_APP_KEY));
    const [err, setErr] = useState(() => (hasPreloadedKakao || KAKAO_APP_KEY ? "" : "카카오 앱 키가 설정되지 않았어요. (.env 파일 확인)"));
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searchMessage, setSearchMessage] = useState("");

    const reverseGeocode = useCallback((lat, lng) => {
        const gc = new window.kakao.maps.services.Geocoder();
        gc.coord2Address(lng, lat, (result, status) => {
            if (status === window.kakao.maps.services.Status.OK && result[0]) {
                setAddress(result[0].road_address?.address_name || result[0].address?.address_name || "");
            }
        });
    }, []);

    useEffect(() => {
        const initMap = () => {
            if (!mapRef.current || !window.kakao?.maps?.LatLng) return;
            const center = new window.kakao.maps.LatLng(defaultCenter.lat, defaultCenter.lng);
            if (mapObj.current && markerRef.current) {
                mapObj.current.setCenter(center);
                markerRef.current.setPosition(center);
                setPos({ lat: defaultCenter.lat, lng: defaultCenter.lng });
                if (!initial?.address) reverseGeocode(center.getLat(), center.getLng());
                return;
            }
            mapObj.current = new window.kakao.maps.Map(mapRef.current, { center, level: 3 });
            markerRef.current = new window.kakao.maps.Marker({ position: center, map: mapObj.current, draggable: true });

            window.kakao.maps.event.addListener(markerRef.current, "dragend", () => {
                const latlng = markerRef.current.getPosition();
                setPos({ lat: latlng.getLat(), lng: latlng.getLng() });
                reverseGeocode(latlng.getLat(), latlng.getLng());
            });
            window.kakao.maps.event.addListener(mapObj.current, "click", (mouseEvent) => {
                const latlng = mouseEvent.latLng;
                markerRef.current.setPosition(latlng);
                setPos({ lat: latlng.getLat(), lng: latlng.getLng() });
                reverseGeocode(latlng.getLat(), latlng.getLng());
            });

            if (!initial?.address) reverseGeocode(center.getLat(), center.getLng());
        };

        if (window.kakao?.maps?.LatLng) {
            initMap();
            return;
        }

        if (!KAKAO_APP_KEY) return;
        loadKakaoMap(KAKAO_APP_KEY).then(() => {
            setErr("");
            setLoading(false);
            initMap();
        }).catch((e) => { setErr(`지도 로딩 실패: ${e.message}\n\n1. 카카오 개발자 콘솔에서 앱 키 확인\n2. 플랫폼 → Web → ${window.location.origin} 등록 확인`); setLoading(false); });
    }, [defaultCenter.lat, defaultCenter.lng, initial?.address, reverseGeocode]);

    const doSearch = () => {
        const keyword = query.trim();
        setSearchMessage("");
        if (!keyword) {
            setSearchMessage("검색할 학원 이름이나 주소를 입력해 주세요.");
            return;
        }
        if (!window.kakao?.maps?.services?.Places) {
            setResults([]);
            setSearchMessage("장소 검색을 사용하려면 카카오 지도 앱 키가 필요해요.");
            return;
        }
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(keyword, (data, status) => {
            if (status === window.kakao.maps.services.Status.OK) {
                const nextResults = data.slice(0, 8);
                setResults(nextResults);
                setSearchMessage(nextResults.length ? "" : "검색 결과가 없어요. 다른 이름이나 주소로 다시 검색해 주세요.");
            } else {
                setResults([]);
                setSearchMessage("검색 결과가 없어요. 다른 이름이나 주소로 다시 검색해 주세요.");
            }
        });
    };

    const pickResult = (place) => {
        const lat = parseFloat(place.y), lng = parseFloat(place.x);
        const latlng = new window.kakao.maps.LatLng(lat, lng);
        mapObj.current.setCenter(latlng);
        mapObj.current.setLevel(3);
        markerRef.current.setPosition(latlng);
        setPos({ lat, lng });
        setAddress(place.road_address_name || place.address_name);
        setResults([]);
        setQuery("");
        setSearchMessage("");
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", background: "white", fontFamily: FF }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: FF }}>← 닫기</button>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#374151" }}>{title}</div>
            </div>
            <div style={{ padding: "12px 16px", background: "#FAFAFA", position: "relative", zIndex: 40 }}>
                <div style={{ display: "flex", gap: 8 }}>
                    <input value={query} onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
                        placeholder="🔍 학원 이름이나 주소 검색..."
                        style={{ flex: 1, padding: "12px 16px", border: "2px solid #F9A8D4", borderRadius: 16, fontSize: 14, fontFamily: FF, outline: "none", boxSizing: "border-box" }} />
                    <button onClick={doSearch} style={{ padding: "10px 16px", background: "#E879A0", color: "white", border: "none", borderRadius: 16, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF, flexShrink: 0 }}>검색</button>
                </div>
                {results.length > 0 && (
                    <div style={{ position: "absolute", left: 16, right: 16, top: "100%", background: "white", borderRadius: "0 0 16px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 60, maxHeight: 240, overflowY: "auto" }}>
                        {results.map((r, i) => (
                            <div key={i} onClick={() => pickResult(r)}
                                style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #F3F4F6", fontSize: 13, lineHeight: 1.5 }}
                                onMouseEnter={e => e.currentTarget.style.background = "#FFF0F7"}
                                onMouseLeave={e => e.currentTarget.style.background = "white"}>
                                <div style={{ fontWeight: 700, color: "#374151" }}>{r.place_name}</div>
                                <div style={{ color: "#9CA3AF", fontSize: 12 }}>{r.road_address_name || r.address_name}</div>
                            </div>
                        ))}
                    </div>
                )}
                {searchMessage && (
                    <div role="status" style={{ marginTop: 8, color: "#BE185D", fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
                        {searchMessage}
                    </div>
                )}
            </div>
            <div style={{ flex: 1, position: "relative" }}>
                {loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF0F7", zIndex: 10, fontSize: 15, fontWeight: 700, color: "#E879A0", fontFamily: FF }}>🗺️ 지도 불러오는 중...</div>}
                {err && (
                    <FallbackMapCanvas
                        center={pos}
                        children={pos ? [{ ...pos, name: "선택 위치", emoji: "📍", color: DESIGN.colors.pink }] : []}
                        title="장소 선택"
                        subtitle={KAKAO_APP_KEY ? "Kakao 지도 연결 실패" : "Kakao 지도 키가 없어 현재 좌표로 설정"}
                        showRadius
                    />
                )}
                <div ref={mapRef} style={{ width: "100%", height: "100%", display: err ? "none" : "block" }} />
                {!err && <MapZoomControls mapObj={mapObj} />}
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid #F3F4F6", fontFamily: FF }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 4 }}>선택된 장소</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 14, minHeight: 20 }}>{address || "지도를 클릭하거나 검색하세요"}</div>
                <button onClick={() => { if (pos) onConfirm({ lat: pos.lat, lng: pos.lng, address }); }}
                    style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 18, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                    📍 이 장소로 설정하기
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Banner
// ─────────────────────────────────────────────────────────────────────────────
function AlertBanner({ alerts, onDismiss }) {
    if (!alerts.length) return null;
    const BG = { parent: DESIGN.gradients.parent, child: DESIGN.gradients.primary, friend: "linear-gradient(135deg,#059669,#10B981)", emergency: DESIGN.gradients.danger, sync: "linear-gradient(135deg,#0369A1,#0EA5E9)" };
    const ICON = { parent: "👨‍👩‍👧", child: "🐰", friend: "👫", emergency: "🚨", sync: "📅" };
    const LABEL = { parent: "부모님 알림", child: "아이 알림", friend: "친구 알림", emergency: "⚠️ 긴급 미도착", sync: "📅 일정 동기화" };
    return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 350, display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px", pointerEvents: "none" }}>
            {alerts.map(a => (
                <div key={a.id} style={{ background: BG[a.type] || BG.parent, color: "white", borderRadius: 20, padding: "14px 18px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12, animation: "slideDownFull 0.4s ease", pointerEvents: "all", fontFamily: FF }}>
                    <div style={{ fontSize: 26 }}>{ICON[a.type] || "🔔"}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 1 }}>{LABEL[a.type] || "알림"}</div>
                        <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>{a.msg}</div>
                    </div>
                    <button onClick={() => onDismiss(a.id)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, padding: "6px 10px", color: "white", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>확인</button>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Emergency Modal
// ─────────────────────────────────────────────────────────────────────────────
function EmergencyBanner({ emergencies, onDismiss }) {
    if (!emergencies.length) return null;
    const em = emergencies[0];
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", fontFamily: FF }}>
            <div style={{ background: "white", borderRadius: 28, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(220,38,38,0.4)", animation: "emergencyPulse 0.6s ease" }}>
                <div style={{ height: 8, borderRadius: 8, background: "linear-gradient(90deg,#EF4444,#DC2626,#EF4444)", backgroundSize: "200% 100%", animation: "shimmer 1s linear infinite", marginBottom: 20 }} />
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 56, marginBottom: 8, animation: "shake 0.5s ease infinite" }}>🚨</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#DC2626" }}>긴급 알림</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginTop: 4 }}>학부모님, 확인이 필요해요!</div>
                </div>
                <div style={{ background: "#FEF2F2", border: "2px solid #FECACA", borderRadius: 18, padding: "16px 18px", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 28 }}>{em.emoji}</div>
                        <div><div style={{ fontWeight: 800, fontSize: 16, color: "#1F2937" }}>{em.title}</div><div style={{ fontSize: 13, color: "#6B7280" }}>예정: ⏰ {em.time}</div></div>
                    </div>
                    <div style={{ background: "#DC2626", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ color: "white", fontWeight: 800, fontSize: 14 }}>⚠️ 5분 후 시작인데 아직 미도착!</div>
                        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 3 }}>{em.location}</div>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => onDismiss(em.id, "contact")} style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg,#DC2626,#B91C1C)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FF }}>📞 아이에게 전화</button>
                    <button onClick={() => onDismiss(em.id, "ok")} style={{ flex: 1, padding: "14px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 16, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>확인했어요</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Role Setup Modal  (first launch)
// ─────────────────────────────────────────────────────────────────────────────
function RoleSetupModal({ onSelect, loading }) {
    const [busy, setBusy] = useState(false);
    const isReturning = (() => {
        try { return !!localStorage.getItem("hyeni-has-visited"); } catch { return false; }
    })();

    // Mark as visited on first render
    useEffect(() => {
        try { localStorage.setItem("hyeni-has-visited", "1"); } catch { /* intentionally empty */ }
    }, []);

    const handleParent = async () => {
        setBusy(true);
        rememberParentPairingIntent();
        try { await kakaoLogin(); } catch (e) { clearParentPairingIntent(); console.error(e); setBusy(false); }
        // After OAuth redirect, auth listener in main component handles the rest
    };

    const handleChild = () => { onSelect("child"); };

    return (
        <div className="hyeni-app-shell" style={{ position: "fixed", inset: 0, zIndex: 500, background: DESIGN.gradients.shell, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 24px", fontFamily: FF, overflowY: "auto" }}>
            <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <AppBrandLogo size={96} radius={26} />
                <div style={{ fontSize: 31, fontWeight: 900, color: "#BE185D", marginTop: 20, marginBottom: 4, letterSpacing: -0.8, textAlign: "center" }}>
                    혜니캘린더
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", marginBottom: 20, letterSpacing: 1.8 }}>HYENI CALENDAR</div>
                <div style={{ borderRadius: 999, padding: "7px 12px", background: "rgba(255,255,255,0.86)", border: "1px solid rgba(244,114,182,0.20)", color: "#BE185D", fontSize: 12, fontWeight: 800, marginBottom: 22 }}>
                    {loading ? "로딩 중..." : isReturning ? "다시 오셨군요" : "처음 사용하시나요?"}
                </div>
                <div style={{ fontSize: 15, color: "#475569", marginBottom: 30, textAlign: "center", lineHeight: 1.55, fontWeight: 600 }}>
                    사용할 역할을 선택해 주세요
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                    <button onClick={handleParent} disabled={busy}
                        style={{ padding: "18px", background: "white", color: "#1E3A8A", border: "1.5px solid #DBEAFE", borderRadius: DESIGN.radius.lg, cursor: busy ? "wait" : "pointer", fontFamily: FF, textAlign: "left", boxShadow: "0 14px 34px rgba(37,99,235,0.12)", opacity: busy ? 0.7 : 1, display: "flex", alignItems: "center", gap: 14 }}>
                        <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 16, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>👨‍👩‍👧</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 18, fontWeight: 900 }}>{busy ? "카카오 로그인 중..." : "학부모"}</span>
                            <span style={{ display: "block", fontSize: 13, color: "#64748B", marginTop: 4, lineHeight: 1.45, fontWeight: 600 }}>카카오 계정으로 로그인하여 아이 일정을 관리해요</span>
                        </span>
                        <span aria-hidden="true" style={{ color: "#2563EB", fontSize: 20, fontWeight: 900, flexShrink: 0 }}>→</span>
                    </button>
                    <button onClick={handleChild}
                        style={{ padding: "18px", background: DESIGN.gradients.primary, color: "white", border: "none", borderRadius: DESIGN.radius.lg, cursor: "pointer", fontFamily: FF, textAlign: "left", boxShadow: "0 16px 34px rgba(190,24,93,0.22)", display: "flex", alignItems: "center", gap: 14 }}>
                        <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 16, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🐰</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 18, fontWeight: 900 }}>아이</span>
                            <span style={{ display: "block", fontSize: 13, opacity: 0.86, marginTop: 4, lineHeight: 1.45, fontWeight: 600 }}>부모님 코드로 연결하고 내 일정을 확인해요</span>
                        </span>
                        <span aria-hidden="true" style={{ fontSize: 20, fontWeight: 900, flexShrink: 0 }}>→</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pair Code Section (shows code prominently or in collapsible after pairing)
// ─────────────────────────────────────────────────────────────────────────────
function PairCodeSection({ pairCode, childrenCount, maxChildren, lockedMessage = "", pairCodeExpiresAt = null, onRegenerate = null }) {
    const [showCode, setShowCode] = useState(childrenCount === 0);
    const canAddMore = childrenCount < maxChildren;
    // Phase 2 PAIR-01 UI: Korean-locale pair_code TTL formatter (inline, no external helper — monolith policy).
    // Returns {text, expired} when expiresAt is a Date/string; null when grandfathered (pairCodeExpiresAt === null).
    const ttlLabel = (() => {
        if (!pairCodeExpiresAt) return null;
        const d = pairCodeExpiresAt instanceof Date ? pairCodeExpiresAt : new Date(pairCodeExpiresAt);
        const ms = d.getTime() - Date.now();
        if (ms <= 0) return { text: "만료됨 — 새로고침이 필요해요", expired: true };
        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return { text: hours >= 1 ? `만료까지 ${hours}시간 ${minutes}분` : `만료까지 ${Math.max(minutes, 1)}분`, expired: false };
    })();
    const handleRegenerate = async () => {
        if (!onRegenerate) return;
        if (!window.confirm("연동 코드를 새로 만들면 기존 코드는 바로 무효가 돼요. 계속할까요?")) return;
        try { await onRegenerate(); } catch (err) { console.error("[regenerate]", err); alert("새 코드 생성에 실패했어요: " + (err?.message || err)); }
    };
    const ttlLine = ttlLabel ? (
        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 10, color: ttlLabel.expired ? "#DC2626" : "#047857" }}>
            ⏱️ {ttlLabel.text}
        </div>
    ) : null;
    const regenerateBtn = onRegenerate ? (
        <button type="button" onClick={handleRegenerate}
            style={{ marginTop: 10, width: "100%", padding: "10px", background: "white", color: "#059669", border: "1.5px solid #86EFAC", borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
            🔄 새로고침 (새 연동 코드)
        </button>
    ) : null;

    if (childrenCount === 0) {
        return (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 6 }}>📋 아이에게 공유할 연동 코드</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: "#059669", letterSpacing: 2, flex: 1, fontFamily: "monospace" }}>{pairCode}</div>
                    <button onClick={() => navigator.clipboard?.writeText(pairCode)}
                        style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>복사</button>
                </div>
                <div style={{ marginTop: 14, borderRadius: 18, background: "white", padding: "14px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pairCode)}`}
                        alt="연동 QR 코드"
                        width="160"
                        height="160"
                        style={{ width: 160, height: 160, borderRadius: 16, background: "white", padding: 8 }}
                    />
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#047857", textAlign: "center", lineHeight: 1.6 }}>
                        아이 기기에서 QR을 스캔하면<br />즉시 연동돼요
                    </div>
                </div>
                {ttlLine}
                {regenerateBtn}
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>아이 기기에서 이 코드를 입력하면 자동 연결돼요</div>
            </div>
        );
    }

    return (
        <div style={{ background: showCode ? "#F0FDF4" : "#F9FAFB", border: showCode ? "1.5px solid #86EFAC" : "1.5px solid #E5E7EB", borderRadius: 16, padding: "12px 16px", marginBottom: 20 }}>
            <button onClick={() => setShowCode(v => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0, fontFamily: FF }}>
                <span style={{ fontSize: 14 }}>{showCode ? "🔓" : "🔑"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", flex: 1, textAlign: "left" }}>연동 코드 확인</span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{showCode ? "접기" : "펼치기"}</span>
            </button>
            {showCode && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontWeight: 900, fontSize: 22, color: "#059669", letterSpacing: 2, flex: 1, fontFamily: "monospace" }}>{pairCode}</div>
                        <button onClick={() => navigator.clipboard?.writeText(pairCode)}
                            style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>복사</button>
                    </div>
                    <div style={{ marginTop: 14, borderRadius: 18, background: "white", padding: "14px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pairCode)}`}
                            alt="연동 QR 코드"
                            width="160"
                            height="160"
                            style={{ width: 160, height: 160, borderRadius: 16, background: "white", padding: 8 }}
                        />
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#047857", textAlign: "center", lineHeight: 1.6 }}>
                            아이 기기에서 QR을 스캔하면<br />즉시 연동돼요
                        </div>
                    </div>
                    {ttlLine}
                    {regenerateBtn}
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>
                        {canAddMore
                            ? "추가 아이 기기에서 이 코드를 입력하면 연결돼요"
                            : (lockedMessage || "최대 연동 수에 도달했어요. 기존 연동을 해제하면 새로 추가할 수 있어요")}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pairing Modal
// ─────────────────────────────────────────────────────────────────────────────
function PairingModal({ myRole, pairCode, pairedMembers, familyId: _familyId, onUnpair, onRename, onClose, maxChildren = 2, lockedMessage = "", pairCodeExpiresAt = null, onRegenerate = null }) {
    const isParent = myRole === "parent";
    const children = pairedMembers?.filter(m => m.role === "child") || [];
    const parent = pairedMembers?.find(m => m.role === "parent") || null;
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={makeSheetStyle({ padding: "28px 24px 40px", width: "100%", maxWidth: 460, maxHeight: "80vh", overflowY: "auto" })}>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#374151" }}>🔗 {isParent ? "아이 연동 관리" : "부모님 연동"}</div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>닫기</button>
                </div>

                {/* Pair code display (parent) */}
                {isParent && (
                    pairCode ? (
                        <PairCodeSection
                            pairCode={pairCode}
                            childrenCount={children.length}
                            maxChildren={maxChildren}
                            lockedMessage={lockedMessage}
                            pairCodeExpiresAt={pairCodeExpiresAt}
                            onRegenerate={isParent ? onRegenerate : null}
                        />
                    ) : children.length === 0 ? (
                        <div style={{ background: "#FEF3C7", border: "1.5px solid #FCD34D", borderRadius: 16, padding: "16px", marginBottom: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>카카오 로그인이 필요해요</div>
                            <div style={{ fontSize: 12, color: "#A16207", lineHeight: 1.6 }}>로그인하면 연동 코드가 생성되고<br/>아이 기기와 연결할 수 있어요</div>
                        </div>
                    ) : null
                )}

                {/* Connected children (parent view) */}
                {isParent && children.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 10 }}>연동된 아이 ({children.length}/{maxChildren})</div>
                        {children.map((child, i) => (
                            <div key={child.user_id || i} style={{ background: "#F0FDF4", borderRadius: 16, padding: "14px 16px", marginBottom: 8, border: "1.5px solid #BBF7D0" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ fontSize: 28 }}>{child.emoji || "🐰"}</div>
                                    <div style={{ flex: 1 }}>
                                        {editingId === child.user_id ? (
                                            <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0, maxWidth: "100%" }}>
                                                <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                                                    style={{ width: 80, minWidth: 0, padding: "6px 8px", border: "2px solid #6EE7B7", borderRadius: 10, fontSize: 14, fontWeight: 800, fontFamily: FF, outline: "none", boxSizing: "border-box" }}
                                                    maxLength={10} />
                                                <button onClick={() => { if (editName.trim() && onRename) { onRename(child.user_id, editName.trim()); } setEditingId(null); }}
                                                    style={{ padding: "6px 10px", borderRadius: 10, background: "#059669", color: "white", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>저장</button>
                                            </div>
                                        ) : (
                                            <div onClick={() => { setEditingId(child.user_id); setEditName(child.name); }} style={{ cursor: "pointer" }}>
                                                <div style={{ fontWeight: 800, fontSize: 15, color: "#065F46" }}>{child.name} <span style={{ fontSize: 11, color: "#9CA3AF" }}>✏️</span></div>
                                            </div>
                                        )}
                                        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>📱 기기 {i + 1}</div>
                                    </div>
                                    <button onClick={() => { if (window.confirm(`${child.name} 연동을 해제할까요?`)) onUnpair(child.user_id); }}
                                        style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>
                                        해제
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Child view: show parent */}
                {!isParent && parent && (
                    <div style={{ background: "#D1FAE5", border: "2px solid #6EE7B7", borderRadius: 20, padding: "20px", marginBottom: 20, textAlign: "center" }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>👨‍👩‍👧</div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: "#065F46" }}>연동 완료</div>
                        <div style={{ fontSize: 14, color: "#047857", marginTop: 4 }}>{parent.name} (부모님)</div>
                    </div>
                )}

                {/* Empty state */}
                {isParent && children.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF", fontSize: 14 }}>
                        아직 연결된 아이가 없어요
                    </div>
                )}
                {!isParent && !parent && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF", fontSize: 14 }}>
                        부모님과 아직 연동되지 않았어요
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Child Pair Input (full-screen overlay for first-time child pairing)
// ─────────────────────────────────────────────────────────────────────────────
function QrPairScanner({ onDetected, onClose }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const frameRef = useRef(0);
    const detectorRef = useRef(null);
    const handledRef = useRef(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const stopScanner = () => {
            handledRef.current = true;
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = 0;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
        };

        const scanFrame = async () => {
            if (!active || handledRef.current || !videoRef.current || !detectorRef.current) return;
            try {
                const codes = await detectorRef.current.detect(videoRef.current);
                const rawValue = codes.find((code) => typeof code.rawValue === "string")?.rawValue;
                if (rawValue) {
                    handledRef.current = true;
                    await onDetected(rawValue);
                    stopScanner();
                    return;
                }
            } catch {
                // ignore intermittent detector failures
            }
            frameRef.current = requestAnimationFrame(scanFrame);
        };

        const startScanner = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setError("이 기기에서는 카메라를 사용할 수 없어요. 코드를 직접 입력해 주세요.");
                setLoading(false);
                return;
            }

            if (typeof window.BarcodeDetector !== "function") {
                setError("이 기기에서는 QR 스캔을 지원하지 않아요. 코드를 직접 입력해 주세요.");
                setLoading(false);
                return;
            }

            try {
                detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
                if (!active) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                }
                setLoading(false);
                frameRef.current = requestAnimationFrame(scanFrame);
            } catch (scannerError) {
                console.error("[qr-scan] start failed:", scannerError);
                setError("카메라를 열 수 없어요. 권한을 확인한 뒤 다시 시도해 주세요.");
                setLoading(false);
            }
        };

        startScanner();

        return () => {
            active = false;
            stopScanner();
        };
    }, [onDetected]);

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 650, background: "rgba(15,23,42,0.92)", display: "flex", flexDirection: "column", fontFamily: FF }}>
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, color: "white", fontFamily: FF }}>← 닫기</button>
                <div style={{ fontWeight: 800, fontSize: 16, color: "white" }}>📷 QR 코드 스캔</div>
            </div>
            <div style={{ flex: 1, padding: "20px 20px 28px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 18 }}>
                <div style={{ width: "100%", maxWidth: 360, aspectRatio: "3 / 4", borderRadius: 28, overflow: "hidden", background: "#0F172A", position: "relative", boxShadow: "0 24px 60px rgba(0,0,0,0.32)" }}>
                    <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "absolute", inset: "18% 12%", borderRadius: 24, border: "3px solid rgba(255,255,255,0.92)", boxShadow: "0 0 0 999px rgba(15,23,42,0.35)" }} />
                    {loading && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.72)", color: "white", fontWeight: 700 }}>
                            카메라 준비 중...
                        </div>
                    )}
                </div>
                <div style={{ maxWidth: 340, textAlign: "center", color: "white" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>부모님 화면의 QR 코드를 비춰 주세요</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}>
                        QR을 인식하면 코드 입력 없이 바로 연동을 시작해요
                    </div>
                    {error && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "#FCA5A5" }}>{error}</div>}
                </div>
            </div>
        </div>
    );
}

function ChildPairInput({ userId, onPaired }) {
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [showScanner, setShowScanner] = useState(false);

    const handleJoin = async (rawCode = code, source = "manual") => {
        const raw = String(rawCode || "").trim();
        const fullCode = normalizePairCodeInput(raw) || normalizePairCodeInput(`KID-${raw}`);
        if (!fullCode) {
            setError(source === "scan" ? "유효한 QR 코드를 찾지 못했어요" : "코드를 정확히 입력해 주세요");
            return false;
        }

        setCode(fullCode.replace("KID-", ""));
        setBusy(true); setError("");
        try {
            const result = await joinFamily(fullCode, userId, "아이");
            console.log("[ChildPairInput] joinFamily result:", result);
            await onPaired();
            return true;
        } catch (err) {
            console.error("[ChildPairInput] error:", err);
            if (err?.message?.includes("프리미엄")) {
                setError(err.message);
            } else if (err?.message?.includes("만료된 연동 코드")) {
                setError("만료된 연동 코드예요. 부모님께 새 코드를 받아 주세요");
            } else {
                setError(err.message?.includes("Too many") ? "시도 횟수 초과. 1시간 후 다시 시도해 주세요" : "잘못된 코드예요. 부모님께 확인해 주세요");
            }
            return false;
        } finally { setBusy(false); }
    };

    return (
        <div className="hyeni-app-shell" style={{ position: "fixed", inset: 0, zIndex: 500, background: DESIGN.gradients.shell, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FF }}>
            <AppBrandLogo size={78} radius={24} />
            <div style={{ fontSize: 24, fontWeight: 900, color: "#E879A0", marginTop: 16, marginBottom: 8 }}>부모님과 연결하기</div>
            <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, textAlign: "center", lineHeight: 1.6 }}>부모님 앱에 있는<br />연동 코드에서 KID- 뒤의 코드를 입력해 주세요</div>
            <div style={{ position: "relative", width: "100%", maxWidth: 320, marginBottom: 8 }}>
                <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 20, fontFamily: "monospace", fontWeight: 700, color: "#E879A0", pointerEvents: "none", zIndex: 1 }}>KID-</div>
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    placeholder="XXXXXXXX" maxLength={8}
                    style={{ width: "100%", padding: "16px 16px 16px 76px", border: "2px solid #F3E8F0", borderRadius: 20, fontSize: 20, fontFamily: "monospace", outline: "none", boxSizing: "border-box", letterSpacing: 3, fontWeight: 700, color: "#374151", background: "white", boxShadow: "0 2px 8px rgba(232,121,160,0.1)" }} />
            </div>
            {error && <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 700, marginBottom: 8 }}>{error}</div>}
            <button onClick={() => { void handleJoin(); }} disabled={busy}
                style={{ ...makePrimaryButtonStyle({ maxWidth: 320, padding: "16px", fontSize: 16, marginTop: 8, opacity: busy ? 0.7 : 1 }), cursor: busy ? "wait" : "pointer" }}>
                {busy ? "연결 중..." : "🔗 연결하기"}
            </button>
            <button
                type="button"
                onClick={() => { if (!busy) setShowScanner(true); }}
                disabled={busy}
                style={{ ...makeSecondaryButtonStyle({ maxWidth: 320, padding: "14px", color: DESIGN.colors.parentDeep, border: "1.5px solid #BFDBFE", background: DESIGN.colors.parentPale, fontSize: 15, marginTop: 10 }), cursor: busy ? "wait" : "pointer" }}
            >
                📷 QR로 연결하기
            </button>
            {showScanner && (
                <QrPairScanner
                    onClose={() => setShowScanner(false)}
                    onDetected={async (rawValue) => {
                        const joined = await handleJoin(rawValue, "scan");
                        if (joined) setShowScanner(false);
                    }}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Academy Manager
// ─────────────────────────────────────────────────────────────────────────────
function AcademyManager({ academies, onSave, onClose, currentPos }) {
    const [list, setList] = useState(academies);
    const [showForm, setShowForm] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [editIdx, setEditIdx] = useState(null);
    const [form, setForm] = useState({ name: "", category: "school", emoji: "📚", location: null, schedule: null });
    const DAYS_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

    const openNew = (preset = null) => {
        setForm(preset ? { name: preset.label, category: preset.category, emoji: preset.emoji, location: null, schedule: null } : { name: "", category: "school", emoji: "📚", location: null, schedule: null });
        setEditIdx(null); setShowForm(true);
    };
    const openEdit = (idx) => { setForm({ ...list[idx], schedule: list[idx].schedule || null }); setEditIdx(idx); setShowForm(true); };
    const saveForm = () => {
        if (!form.name.trim()) return;
        const cat = CATEGORIES.find(c => c.id === form.category);
        const item = { ...form, color: cat.color, bg: cat.bg };
        if (editIdx !== null) { const nl = [...list]; nl[editIdx] = item; setList(nl); }
        else setList(p => [...p, item]);
        setShowForm(false);
    };
    const removeItem = (idx) => setList(p => p.filter((_, i) => i !== idx));

    if (showMap) return (
        <MapPicker initial={form.location} currentPos={currentPos} title="📍 학원 위치 설정"
            onClose={() => setShowMap(false)}
            onConfirm={loc => { setForm(p => ({ ...p, location: loc })); setShowMap(false); }} />
    );

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "white", display: "flex", flexDirection: "column", fontFamily: FF }}>
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => { onSave(list); onClose(); }} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: FF }}>← 저장</button>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#374151" }}>🏫 학원 목록 관리</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

                {/* Quick presets */}
                {!showForm && (
                    <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 10 }}>빠른 추가</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                            {ACADEMY_PRESETS.filter(p => !list.some(a => a.name === p.label)).map(p => (
                                <button key={p.label} onClick={() => openNew(p)}
                                    style={{ padding: "8px 14px", borderRadius: 16, border: "2px dashed #E5E7EB", background: "#FAFAFA", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#6B7280" }}>
                                    {p.emoji} {p.label}
                                </button>
                            ))}
                            <button onClick={() => openNew()}
                                style={{ padding: "8px 14px", borderRadius: 16, border: "2px dashed #F9A8D4", background: "#FFF0F7", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#E879A0" }}>
                                + 직접 입력
                            </button>
                        </div>
                    </>
                )}

                {/* Form */}
                {showForm && (
                    <div style={{ background: "#FAFAFA", borderRadius: 20, padding: "18px", marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#374151", marginBottom: 14 }}>{editIdx !== null ? "✏️ 학원 수정" : "➕ 학원 추가"}</div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>학원 이름</label>
                            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예) 영어학원, 수학왕..."
                                style={{ width: "100%", padding: "12px 14px", border: "2px solid #F3F4F6", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>카테고리</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {CATEGORIES.map(cat => (
                                    <button key={cat.id} onClick={() => setForm(p => ({ ...p, category: cat.id, emoji: cat.emoji }))}
                                        style={{ padding: "7px 12px", borderRadius: 14, border: `2px solid ${form.category === cat.id ? cat.color : "#E5E7EB"}`, background: form.category === cat.id ? cat.color : "white", color: form.category === cat.id ? "white" : cat.color, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FF }}>
                                        {cat.emoji} {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>📍 위치 (GPS)</label>
                            {form.location ? (
                                <div style={{ background: "#FFF0F7", borderRadius: 14, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 13, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {form.location.address}</div>
                                    <button onClick={() => setShowMap(true)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid #E879A0", color: "#E879A0", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowMap(true)}
                                    style={{ width: "100%", padding: "12px", border: "2px dashed #F9A8D4", borderRadius: 14, background: "#FFF0F7", color: "#E879A0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                                    🗺️ 지도에서 위치 선택
                                </button>
                            )}
                        </div>
                        {/* Schedule (days + time) */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>📅 요일 & 시간</label>
                            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                {DAYS_LABEL.map((d, i) => {
                                    const active = form.schedule?.days?.includes(i);
                                    return (
                                        <button key={i} onClick={() => {
                                            const days = form.schedule?.days || [];
                                            const newDays = active ? days.filter(x => x !== i) : [...days, i].sort();
                                            setForm(p => ({ ...p, schedule: { ...(p.schedule || { startTime: "15:00", endTime: "16:00" }), days: newDays } }));
                                        }}
                                            style={{ flex: 1, padding: "8px 0", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FF, border: active ? "2px solid #E879A0" : "2px solid #F3F4F6", background: active ? "#FFF0F7" : "#FAFAFA", color: active ? "#E879A0" : i === 0 ? "#F87171" : i === 6 ? "#60A5FA" : "#6B7280", transition: "all 0.15s" }}>
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                            {form.schedule?.days?.length > 0 && (
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input type="time" value={form.schedule?.startTime || "15:00"} onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, startTime: e.target.value } }))}
                                        style={{ flex: 1, padding: "10px 12px", border: "2px solid #F3F4F6", borderRadius: 12, fontSize: 15, fontFamily: FF, outline: "none" }} />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF" }}>~</span>
                                    <input type="time" value={form.schedule?.endTime || "16:00"} onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, endTime: e.target.value } }))}
                                        style={{ flex: 1, padding: "10px 12px", border: "2px solid #F3F4F6", borderRadius: 12, fontSize: 15, fontFamily: FF, outline: "none" }} />
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveForm} style={{ flex: 1, padding: "13px", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>저장</button>
                            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "13px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 16, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>취소</button>
                        </div>
                    </div>
                )}

                {/* Registered academies list */}
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 10 }}>등록된 학원 ({list.length})</div>
                {list.length === 0 && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#D1D5DB" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🏫</div>
                        <div style={{ fontSize: 14 }}>등록된 학원이 없어요</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>위에서 추가해 보세요!</div>
                    </div>
                )}
                {list.map((a, i) => (
                    <div key={i} style={{ background: a.bg || "#F9FAFB", borderRadius: 18, padding: "14px 16px", marginBottom: 10, borderLeft: `4px solid ${a.color || "#E5E7EB"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontSize: 26 }}>{a.emoji}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: "#1F2937" }}>{a.name}</div>
                                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{CATEGORIES.find(c => c.id === a.category)?.label}</div>
                                {a.location && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>📍 {a.location.address?.split(" ").slice(0, 3).join(" ")}</div>}
                                {!a.location && <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 2 }}>📍 위치 미등록</div>}
                                {a.schedule?.days?.length > 0 && <div style={{ fontSize: 11, color: "#E879A0", fontWeight: 700, marginTop: 3 }}>📅 {a.schedule.days.map(d => DAYS_LABEL[d]).join(", ")} {a.schedule.startTime}~{a.schedule.endTime}</div>}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => openEdit(i)} style={{ background: "rgba(255,255,255,0.8)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, fontFamily: FF }}>✏️</button>
                                <button onClick={() => removeItem(i)} style={{ background: "rgba(255,255,255,0.8)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "#EF4444", fontFamily: FF }}>✕</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RouteOverlay({ ev, childPos, mapReady, mapLoadError = "", onClose, isChildMode = false }) {
    const mapRef = useRef();
    const mapInst = useRef();
    const myMarkerRef = useRef(null);
    const polylineRef = useRef(null);
    const shadowPolyRef = useRef(null);
    const startOverlayRef = useRef(null);      // "출발" label overlay
    const arrowOverlaysRef = useRef([]);        // direction arrow overlays
    const routePathRef = useRef(null); // cached route coords for re-render
    const [routeInfo, setRouteInfo] = useState(null);
    const [livePos, setLivePos] = useState(childPos); // real-time GPS tracking
    const [isTracking, setIsTracking] = useState(false);
    const [gpsError, setGpsError] = useState(() => typeof navigator !== "undefined" && !navigator.geolocation);   // GPS failure flag
    const [centered, setCentered] = useState(true);
    const [mapType, setMapType] = useState("roadmap"); // "hybrid" or "roadmap"
    const [guidanceStarted, setGuidanceStarted] = useState(false);
    const [heading, setHeading] = useState(null); // device compass heading in degrees
    const watchIdRef = useRef(null);
    const routeInitDoneRef = useRef(false);
    const routeRequestRef = useRef(null);

    // Compute live distance/time
    const currentPos = livePos || childPos;
    const liveDist = currentPos && ev.location
        ? haversineM(currentPos.lat, currentPos.lng, ev.location.lat, ev.location.lng)
        : null;
    const displayDist = routeInfo?.distance ?? liveDist;
    const displayMin = routeInfo?.duration != null
        ? Math.max(1, Math.round(routeInfo.duration / 60))
        : displayDist != null ? Math.max(1, Math.round(displayDist / 67)) : null;
    const distLabel = displayDist != null
        ? displayDist >= 1000 ? `${(displayDist / 1000).toFixed(1)}km` : `${Math.round(displayDist)}m`
        : null;
    const timeLabel = displayMin != null
        ? displayMin >= 60
            ? `${Math.floor(displayMin / 60)}시간 ${displayMin % 60 > 0 ? `${displayMin % 60}분` : ""}`
            : `${displayMin}분`
        : null;

    // Start real-time GPS tracking
    useEffect(() => {
        if (!navigator.geolocation) return;
        // 즉시 현재 위치 획득 (watch 첫 응답 전 빈 상태 방지)
        navigator.geolocation.getCurrentPosition(
            (pos) => { setLivePos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsError(false); },
            () => { setGpsError(true); },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
        );
        const wid = navigator.geolocation.watchPosition(
            (pos) => {
                const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setLivePos(newPos);
                setGpsError(false);
            },
            () => { setGpsError(true); },
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
        );
        watchIdRef.current = wid;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsTracking(true);
        return () => {
            navigator.geolocation.clearWatch(wid);
            setIsTracking(false);
        };
    }, []);

    // Compass heading via DeviceOrientationEvent
    useEffect(() => {
        let handler;
        const startListening = () => {
            handler = (e) => {
                // iOS provides webkitCompassHeading, Android uses alpha
                const h = e.webkitCompassHeading != null
                    ? e.webkitCompassHeading
                    : (e.alpha != null ? (360 - e.alpha) : null);
                if (h != null) setHeading(h);
            };
            window.addEventListener("deviceorientation", handler, true);
        };
        // iOS 13+ requires permission request
        if (typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission()
                .then(state => { if (state === "granted") startListening(); })
                .catch(() => {});
        } else {
            startListening();
        }
        return () => {
            if (handler) window.removeEventListener("deviceorientation", handler, true);
        };
    }, []);

    // Update my-marker + start overlay position in real-time
    useEffect(() => {
        if (!livePos || !mapInst.current || !myMarkerRef.current) return;
        const newLL = new window.kakao.maps.LatLng(livePos.lat, livePos.lng);
        myMarkerRef.current.setPosition(newLL);
        if (startOverlayRef.current) startOverlayRef.current.setPosition(newLL);
        if (centered) mapInst.current.panTo(newLL);
    }, [livePos, centered]);

    // Re-fetch route when position changes significantly (>50m)
    const createWalkingArrows = useCallback((map, path, color) => {
        const arrows = [];
        if (!path || path.length < 4) return arrows;
        const interval = Math.max(4, Math.floor(path.length / 8));
        for (let i = interval; i < path.length - 2; i += interval) {
            const p1 = path[i - 1];
            const p2 = path[i + 1];
            const lat1 = p1.getLat() * Math.PI / 180;
            const lat2 = p2.getLat() * Math.PI / 180;
            const dLng = (p2.getLng() - p1.getLng()) * Math.PI / 180;
            const y = Math.sin(dLng) * Math.cos(lat2);
            const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
            const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
            const arrowSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="white" stroke="${color}" stroke-width="2"/><path d="M14 7 L19 17 L14 14 L9 17 Z" fill="${color}" transform="rotate(${bearing}, 14, 14)"/></svg>`)}`;
            const overlay = new window.kakao.maps.CustomOverlay({
                map, position: path[i], yAnchor: 0.5, zIndex: 3,
                content: `<img src="${arrowSvg}" width="26" height="26" style="display:block;pointer-events:none" />`
            });
            arrows.push(overlay);
        }
        return arrows;
    }, []);

    const clearRouteDrawing = useCallback(() => {
        if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
        if (shadowPolyRef.current) { shadowPolyRef.current.setMap(null); shadowPolyRef.current = null; }
        arrowOverlaysRef.current.forEach(o => o.setMap(null));
        arrowOverlaysRef.current = [];
    }, []);

    const fitRouteBounds = useCallback((path, startLL, destLL, padding = 80) => {
        if (!mapInst.current || !path?.length) return;
        const bounds = new window.kakao.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        if (startLL) bounds.extend(startLL);
        if (destLL) bounds.extend(destLL);
        mapInst.current.setBounds(bounds, padding);
    }, []);

    const drawRoutePath = useCallback((path, { dashed = false, fit = false, startLL = null, destLL = null } = {}) => {
        if (!mapInst.current || !path?.length) return;
        clearRouteDrawing();
        routePathRef.current = path;

        shadowPolyRef.current = new window.kakao.maps.Polyline({
            map: mapInst.current,
            path,
            strokeWeight: dashed ? 10 : 14,
            strokeColor: "#FFFFFF",
            strokeOpacity: 0.9,
            strokeStyle: "solid"
        });

        polylineRef.current = new window.kakao.maps.Polyline({
            map: mapInst.current,
            path,
            strokeWeight: dashed ? 6 : 8,
            strokeColor: "#4285F4",
            strokeOpacity: dashed ? 0.8 : 0.95,
            strokeStyle: dashed ? "shortdash" : "solid"
        });

        if (!dashed) {
            arrowOverlaysRef.current = createWalkingArrows(mapInst.current, path, "#4285F4");
        }
        if (fit) fitRouteBounds(path, startLL, destLL);
    }, [clearRouteDrawing, createWalkingArrows, fitRouteBounds]);

    const drawDirectRoute = useCallback((start, destination, { fit = false } = {}) => {
        if (!mapInst.current || !start || !destination) return;
        const startLL = new window.kakao.maps.LatLng(start.lat, start.lng);
        const destLL = new window.kakao.maps.LatLng(destination.lat, destination.lng);
        drawRoutePath([startLL, destLL], { dashed: true, fit, startLL, destLL });
        setRouteInfo({
            distance: haversineM(start.lat, start.lng, destination.lat, destination.lng),
            duration: null,
            loading: false,
            error: true
        });
    }, [drawRoutePath]);

    const drawWalkingRoute = useCallback(async (start, destination, { fit = false, signal } = {}) => {
        if (!mapInst.current || !start || !destination) return;
        const startLL = new window.kakao.maps.LatLng(start.lat, start.lng);
        const destLL = new window.kakao.maps.LatLng(destination.lat, destination.lng);

        setRouteInfo((prev) => ({
            distance: prev?.distance ?? null,
            duration: prev?.duration ?? null,
            loading: true,
            error: false,
        }));

        try {
            const route = await fetchWalkingRoute(start, destination, signal);
            if (signal?.aborted) return;
            const path = route.points.map((point) => new window.kakao.maps.LatLng(point.lat, point.lng));
            drawRoutePath(path, { fit, startLL, destLL });
            setRouteInfo({
                distance: route.distance ?? sumRouteDistance(route.points),
                duration: route.duration ?? null,
                loading: false,
                error: false,
                provider: route.provider,
            });
        } catch (error) {
            if (signal?.aborted) return;
            console.warn("[Guidance] Walking route failed:", error);
            drawDirectRoute(start, destination, { fit });
        }
    }, [drawDirectRoute, drawRoutePath]);

    const requestWalkingRoute = useCallback((start, destination, { fit = false } = {}) => {
        if (!start || !destination) return;
        if (routeRequestRef.current) routeRequestRef.current.abort();

        const controller = new AbortController();
        routeRequestRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), ROUTE_REQUEST_TIMEOUT_MS);

        drawWalkingRoute(start, destination, { fit, signal: controller.signal })
            .finally(() => {
                clearTimeout(timeoutId);
                if (routeRequestRef.current === controller) routeRequestRef.current = null;
            });
    }, [drawWalkingRoute]);

    useEffect(() => {
        return () => {
            if (routeRequestRef.current) routeRequestRef.current.abort();
        };
    }, []);

    const lastRoutePosRef = useRef(null);
    useEffect(() => {
        if (!livePos || !ev.location || !mapInst.current) return;
        if (lastRoutePosRef.current) {
            const moved = haversineM(livePos.lat, livePos.lng, lastRoutePosRef.current.lat, lastRoutePosRef.current.lng);
            if (moved < 50) return;
        }
        const startPos = { ...livePos };
        const destination = ev.location;
        lastRoutePosRef.current = startPos;
        requestWalkingRoute(startPos, destination);
    }, [livePos, ev.location, requestWalkingRoute]);

    // Initialize map + route
    useEffect(() => {
        if (!mapReady || !mapRef.current || !ev.location) return;

        const destLL = new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng);

        // 지도 + 목적지 마커는 한 번만 생성
        if (!mapInst.current) {
            mapInst.current = new window.kakao.maps.Map(mapRef.current, {
                center: destLL, level: 4,
                mapTypeId: window.kakao.maps.MapTypeId.ROADMAP
            });
            // 도착지 마커 — 깃발 + 이름
            new window.kakao.maps.CustomOverlay({
                map: mapInst.current, position: destLL, yAnchor: 1.4, zIndex: 5,
                content: `<div style="display:flex;flex-direction:column;align-items:center">
                    <div style="background:${ev.color};color:white;padding:8px 14px;border-radius:16px;font-size:14px;font-weight:900;box-shadow:0 4px 16px rgba(0,0,0,0.25);font-family:'Noto Sans KR',sans-serif;border:2px solid white">🏁 ${escHtml(ev.title)}</div>
                    <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid ${ev.color}"></div>
                </div>`
            });
        }

        // 위치가 아직 없거나 이미 초기화 완료면 경로 계산 건너뜀
        if (!currentPos || routeInitDoneRef.current) return;
        routeInitDoneRef.current = true;

        const startPos = currentPos;
        const myLL = new window.kakao.maps.LatLng(startPos.lat, startPos.lng);

        // ── 내 위치 마커 (이동 가능) — 토끼 + 펄스 링 ──
        const bunnySvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="92" viewBox="-4 -10 64 92">
          <!-- outer pulse ring -->
          <circle cx="28" cy="36" r="30" fill="none" stroke="rgba(236,72,153,0.4)" stroke-width="3"><animate attributeName="r" values="28;34;28" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.8s" repeatCount="indefinite"/></circle>
          <!-- inner pulse ring -->
          <circle cx="28" cy="36" r="24" fill="rgba(244,114,182,0.12)" stroke="none"><animate attributeName="r" values="22;26;22" dur="2s" repeatCount="indefinite"/></circle>
          <!-- left ear -->
          <ellipse cx="16" cy="12" rx="7" ry="16" fill="#F9A8D4" stroke="#EC4899" stroke-width="1.5"/>
          <ellipse cx="16" cy="12" rx="4" ry="12" fill="#FBCFE8"/>
          <!-- right ear -->
          <ellipse cx="40" cy="12" rx="7" ry="16" fill="#F9A8D4" stroke="#EC4899" stroke-width="1.5"/>
          <ellipse cx="40" cy="12" rx="4" ry="12" fill="#FBCFE8"/>
          <!-- head -->
          <circle cx="28" cy="36" r="20" fill="#FBCFE8" stroke="#EC4899" stroke-width="2.5"/>
          <!-- blush -->
          <ellipse cx="14" cy="40" rx="5" ry="3" fill="#F9A8D4" opacity="0.5"/>
          <ellipse cx="42" cy="40" rx="5" ry="3" fill="#F9A8D4" opacity="0.5"/>
          <!-- eyes -->
          <circle cx="20" cy="33" r="3.5" fill="#1F2937"/><circle cx="21.2" cy="31.5" r="1.2" fill="white"/>
          <circle cx="36" cy="33" r="3.5" fill="#1F2937"/><circle cx="37.2" cy="31.5" r="1.2" fill="white"/>
          <!-- nose -->
          <ellipse cx="28" cy="40" rx="3" ry="2.2" fill="#EC4899"/>
          <!-- mouth -->
          <path d="M24 43 Q28 47 32 43" stroke="#EC4899" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <!-- label: 내 위치 -->
          <rect x="6" y="62" width="44" height="16" rx="8" fill="#EC4899" stroke="white" stroke-width="1.5"/>
          <text x="28" y="74" text-anchor="middle" font-size="10" font-weight="900" fill="white" font-family="sans-serif">내 위치</text>
        </svg>`)}`;
        const myOverlay = new window.kakao.maps.CustomOverlay({
            map: mapInst.current, position: myLL, yAnchor: 0.85, zIndex: 10,
            content: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 12px rgba(236,72,153,0.5))">
                <img src="${bunnySvg}" width="60" height="86" style="display:block" />
            </div>`
        });
        myMarkerRef.current = myOverlay;

        // ── "출발" 라벨 오버레이 (내 위치 위에) ──
        const startOv = new window.kakao.maps.CustomOverlay({
            map: mapInst.current, position: myLL, yAnchor: 2.6, zIndex: 9,
            content: `<div style="background:linear-gradient(135deg,#10B981,#059669);color:white;padding:6px 14px;border-radius:12px;font-size:13px;font-weight:900;box-shadow:0 3px 12px rgba(16,185,129,0.4);font-family:'Noto Sans KR',sans-serif;border:2px solid white">🚶 출발</div>`
        });
        startOverlayRef.current = startOv;

         
        lastRoutePosRef.current = { ...startPos };
        requestWalkingRoute(startPos, ev.location, { fit: true });
    }, [mapReady, ev, currentPos, requestWalkingRoute]);

    const recenterMap = () => {
        if (!mapInst.current || !currentPos) return;
        setCentered(true);
        const latlng = new window.kakao.maps.LatLng(currentPos.lat, currentPos.lng);
        mapInst.current.setLevel(1, { animate: true });
        mapInst.current.panTo(latlng);
    };

    const toggleMapType = () => {
        if (!mapInst.current) return;
        const next = mapType === "hybrid" ? "roadmap" : "hybrid";
        setMapType(next);
        mapInst.current.setMapTypeId(
            next === "hybrid" ? window.kakao.maps.MapTypeId.HYBRID : window.kakao.maps.MapTypeId.ROADMAP
        );
    };

    const fitFullRoute = () => {
        if (!mapInst.current || !currentPos || !ev.location) return;
        setCentered(false);
        if (!routePathRef.current) {
            drawDirectRoute(currentPos, ev.location, { fit: true });
            return;
        }
        const bounds = new window.kakao.maps.LatLngBounds();
        bounds.extend(new window.kakao.maps.LatLng(currentPos.lat, currentPos.lng));
        bounds.extend(new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng));
        if (routePathRef.current) routePathRef.current.forEach(p => bounds.extend(p));
        mapInst.current.setBounds(bounds, 60);
    };

    const startInAppGuidance = () => {
        setGuidanceStarted(true);
        fitFullRoute();
    };

    // Cleanup overlays on unmount
    useEffect(() => {
        return () => {
            arrowOverlaysRef.current.forEach(o => o.setMap(null));
            arrowOverlaysRef.current = [];
            if (startOverlayRef.current) { startOverlayRef.current.setMap(null); startOverlayRef.current = null; }
            if (myMarkerRef.current) { myMarkerRef.current.setMap(null); myMarkerRef.current = null; }
        };
    }, []);

    // Arrived check
    const arrived = liveDist != null && liveDist < 100;

    // Child-friendly bunny encouragement messages
    const bunnyEncouragement = (() => {
        if (!isChildMode || liveDist == null) return null;
        if (arrived) return { emoji: "🎉", msg: "도착이야! 잘했어! 🐰💕" };
        if (liveDist < 200) return { emoji: "🐰", msg: "거의 다 왔어! 조금만 더!" };
        if (liveDist < 500) return { emoji: "🏃", msg: "잘 가고 있어! 화이팅~!" };
        if (displayMin != null && displayMin <= 5) return { emoji: "🐰", msg: "금방 도착해! 힘내!" };
        return { emoji: "🐰", msg: "천천히 안전하게 가자~!" };
    })();

    const sheetCardStyle = {
        background: "rgba(255,255,255,0.92)",
        borderRadius: 26,
        padding: "14px 14px 16px",
        boxShadow: "0 18px 48px rgba(15, 23, 42, 0.16)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.8)",
    };
    const fallbackMapSubtitle = mapLoadError || (KAKAO_APP_KEY ? "Kakao 지도 연결 중" : "Kakao 지도 키가 없어 간이 지도 표시");

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: DESIGN.gradients.map, display: "flex", flexDirection: "column", fontFamily: FF }}>
            {/* Navigation Header */}
            <div style={{ padding: "12px 16px", paddingTop: "max(12px, env(safe-area-inset-top))", background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, zIndex: 2 }}>
                <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, width: 40, height: 40, cursor: "pointer", fontWeight: 800, fontSize: 18, fontFamily: FF, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", flexShrink: 0 }}>←</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.emoji} {ev.title}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                        ⏰ {ev.time} {ev.location?.address ? `· 📍 ${ev.location.address.split(" ").slice(0, 3).join(" ")}` : ""}
                    </div>
                </div>
                {isTracking && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#3B82F6", background: "#DBEAFE", padding: "4px 8px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6", animation: "pulse 1.5s infinite" }} />
                        GPS
                    </div>
                )}
            </div>

            {/* Route info bar */}
            {!routeInfo?.loading && distLabel && (
                <div style={{
                    margin: "0 16px", marginTop: 10, background: arrived ? "#D1FAE5" : "white",
                    borderRadius: 20, padding: "14px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    display: "flex", alignItems: "center", gap: 14, zIndex: 2
                }}>
                    <div style={{ width: 48, height: 48, borderRadius: 16, background: arrived ? "#ECFDF5" : ev.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                        {arrived ? "🎉" : "🚶"}
                    </div>
                    <div style={{ flex: 1 }}>
                        {arrived ? (
                            <>
                                <div style={{ fontWeight: 900, fontSize: 18, color: "#059669" }}>{isChildMode ? "도착이야! 잘했어! 🐰" : "도착했어요!"}</div>
                                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{isChildMode ? "목적지에 잘 도착했어! 💕" : "목적지 근처에 있어요"}</div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontWeight: 900, fontSize: 20, color: ev.color }}>{distLabel}</div>
                                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                                    {routeInfo?.error ? `예상 직선거리 · 도보 약 ${timeLabel}` : `도보 약 ${timeLabel}`}
                                </div>
                                {bunnyEncouragement && (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#E879A0", marginTop: 4 }}>
                                        {bunnyEncouragement.emoji} {bunnyEncouragement.msg}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {!arrived && displayMin != null && !routeInfo?.error && (
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>도착 예정</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#374151", marginTop: 2 }}>
                                {(() => {
                                    const now = new Date();
                                    const eta = new Date(now.getTime() + displayMin * 60000);
                                    return `${String(eta.getHours()).padStart(2, "0")}:${String(eta.getMinutes()).padStart(2, "0")}`;
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {routeInfo?.loading && (
                <div style={{ margin: "0 16px", marginTop: 10, background: "white", borderRadius: 20, padding: "14px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", textAlign: "center", zIndex: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280" }}>🔍 경로 검색 중...</div>
                </div>
            )}

            {/* Map */}
            <div style={{ flex: 1, margin: "10px 16px", borderRadius: 24, overflow: "hidden", boxShadow: "0 4px 20px rgba(247,121,168,0.10)", position: "relative", minHeight: 0, border: "2px solid rgba(255,228,239,0.8)" }}>
                {!mapReady && (
                    <FallbackMapCanvas
                        center={currentPos || ev.location}
                        children={currentPos ? [{ ...currentPos, name: "내 위치", emoji: isChildMode ? "🐰" : "👨‍👩‍👧", color: DESIGN.colors.pink }] : []}
                        eventPlaces={ev.location ? [{ key: ev.id || "destination", title: ev.title, emoji: ev.emoji || "📍", color: ev.color || DESIGN.colors.pink, location: ev.location }] : []}
                        routePoints={currentPos && ev.location ? [currentPos, ev.location] : []}
                        title={ev.title || "경로"}
                        subtitle={fallbackMapSubtitle}
                        showRadius={Boolean(currentPos)}
                    />
                )}
                <div ref={mapRef} style={{ width: "100%", height: "100%", display: mapReady ? "block" : "none" }} />
                {mapReady && <MapZoomControls mapObj={mapInst} />}

                {/* GPS 위치 찾는 중 / 오류 오버레이 */}
                {!currentPos && (
                    <div style={{
                        position: "absolute", inset: 0, zIndex: 20,
                        background: "rgba(255,255,255,0.75)", backdropFilter: "blur(4px)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12
                    }}>
                        {gpsError ? (
                            <>
                                <div style={{ fontSize: 40 }}>📍</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#EF4444", fontFamily: FF }}>
                                    위치를 찾을 수 없어요
                                </div>
                                <div style={{ fontSize: 12, color: "#6B7280", fontFamily: FF, textAlign: "center", lineHeight: 1.5 }}>
                                    GPS가 꺼져 있거나<br />위치 권한이 필요해요
                                </div>
                                <button onClick={() => {
                                    setGpsError(false);
                                    navigator.geolocation?.getCurrentPosition(
                                        (pos) => { setLivePos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsError(false); },
                                        () => { setGpsError(true); },
                                        { enableHighAccuracy: true, timeout: 10000 }
                                    );
                                }} style={{
                                    marginTop: 4, padding: "10px 24px", borderRadius: 14,
                                    background: "linear-gradient(135deg, #4285F4, #1A73E8)", border: "none",
                                    color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer",
                                    fontFamily: FF, boxShadow: "0 4px 12px rgba(66,133,244,0.3)"
                                }}>
                                    다시 찾기
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: 40, animation: "pulse 1.5s infinite" }}>📍</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#4285F4", fontFamily: FF }}>
                                    내 위치를 찾고 있어요...
                                </div>
                                <div style={{ fontSize: 12, color: "#9CA3AF", fontFamily: FF }}>
                                    GPS 신호를 기다리는 중
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Heading compass indicator (top-right) */}
                {mapReady && heading != null && (
                    <div style={{ position: "absolute", left: 14, top: 14, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: "50%", background: "white",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
                            position: "relative"
                        }}>
                            <div style={{ position: "absolute", top: 3, fontSize: 8, fontWeight: 800, color: "#EF4444", fontFamily: FF }}>N</div>
                            <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: `rotate(${heading}deg)`, transition: "transform 0.3s ease-out" }}>
                                <polygon points="16,4 12,20 16,17 20,20" fill="#EC4899" stroke="#BE185D" strokeWidth="1" />
                                <polygon points="16,28 12,20 16,17 20,20" fill="#D1D5DB" stroke="#9CA3AF" strokeWidth="0.5" />
                            </svg>
                        </div>
                        <div style={{ fontSize: 8, fontWeight: 700, color: "#6B7280", marginTop: 2, fontFamily: FF }}>
                            {Math.round(heading)}°
                        </div>
                    </div>
                )}

                {/* Map overlay buttons */}
                {mapReady && <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", gap: 8, zIndex: 5 }}>
                    <button onClick={toggleMapType} title="지도 타입"
                        style={{ width: 44, height: 44, borderRadius: 14, background: "white", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#6B7280", fontFamily: FF }}>
                        {mapType === "hybrid" ? "🛣️" : "🛰️"}
                    </button>
                    <button onClick={recenterMap} title="내 위치"
                        style={{
                            minWidth: 56, height: 56, borderRadius: 16, padding: "0 16px",
                            background: centered ? "linear-gradient(135deg, #EC4899, #F472B6)" : "white",
                            border: centered ? "none" : "2px solid #F9A8D4",
                            cursor: "pointer", boxShadow: centered ? "0 4px 14px rgba(236,72,153,0.4)" : "0 2px 8px rgba(0,0,0,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                            fontSize: 14, fontWeight: 800, color: centered ? "white" : "#EC4899", fontFamily: FF,
                            transition: "all 0.2s ease"
                        }}>
                        🐰 내 위치
                    </button>
                    <button onClick={fitFullRoute} title="전체 경로"
                        style={{ width: 44, height: 44, borderRadius: 14, background: "white", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#6B7280" }}>
                        🗺️
                    </button>
                </div>}
            </div>

            {/* Bottom route sheet */}
            <div style={{ padding: "0 16px max(28px, calc(28px + env(safe-area-inset-bottom)))", flexShrink: 0 }}>
                <div style={sheetCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 0.2 }}>{isChildMode ? "🐰 길찾기" : "ROUTE"}</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginTop: 2 }}>
                                {arrived
                                    ? (isChildMode ? "도착! 잘했어! 💕" : "도착 완료")
                                    : (guidanceStarted ? "길안내를 시작했어요" : "안전하게 가자")}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <div style={{ padding: "7px 10px", borderRadius: 999, background: arrived ? "#DCFCE7" : ev.bg, color: arrived ? "#166534" : ev.color, fontSize: 11, fontWeight: 800 }}>
                                {arrived ? "근처 도착" : distLabel || "경로 확인"}
                            </div>
                            {displayMin != null && !routeInfo?.error && (
                                <div style={{ padding: "7px 10px", borderRadius: 999, background: "#EEF2FF", color: "#4338CA", fontSize: 11, fontWeight: 800 }}>
                                    도보 {timeLabel}
                                </div>
                            )}
                            {routeInfo?.error && (
                                <div style={{ padding: "7px 10px", borderRadius: 999, background: "#DBEAFE", color: "#1D4ED8", fontSize: 11, fontWeight: 800 }}>
                                    위치 확인
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            onClick={guidanceStarted ? fitFullRoute : startInAppGuidance}
                            disabled={!currentPos || !ev.location}
                            style={{ flex: 1, padding: "15px 14px", borderRadius: 18, border: "none", cursor: currentPos && ev.location ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 800, fontFamily: FF, color: "white", background: currentPos && ev.location ? "linear-gradient(135deg, #EC4899, #BE185D)" : "#D1D5DB", boxShadow: currentPos && ev.location ? "0 12px 24px rgba(236,72,153,0.26)" : "none" }}
                        >
                            {guidanceStarted ? "전체 경로 보기" : "길안내 시작"}
                        </button>
                        <button
                            onClick={onClose}
                            style={{ padding: "15px 16px", borderRadius: 18, border: "1px solid #E5E7EB", cursor: "pointer", fontSize: 14, fontWeight: 800, fontFamily: FF, color: "#4B5563", background: "#FFFFFF" }}
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Memo Section — X/Thread-style chat bubble UI (05.5-UI-SPEC.md)
// ─────────────────────────────────────────────────────────────────────────────

/* UI-SPEC §4e — relative timestamp helper */
function getRelativeTime(createdAt) {
    const now = Date.now();
    const ts = new Date(createdAt).getTime();
    const diffMs = now - ts;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "방금";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const d = new Date(createdAt);
    const nowDate = new Date();
    const timePart = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    if (d.getFullYear() !== nowDate.getFullYear()) {
        return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${timePart}`;
    }
    const yesterday = new Date(nowDate); yesterday.setDate(nowDate.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `어제 ${timePart}`;
    return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${timePart}`;
}

/* UI-SPEC §4a — date separator label helper */
function getDateSeparatorLabel(createdAt) {
    const d = new Date(createdAt);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "오늘";
    if (d.toDateString() === yesterday.toDateString()) return "어제";
    return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
}

/* UI-SPEC §4b — single-pass group builder: separators + bubbles in correct order */
/* Codex P2 fix: use LOCAL calendar day for grouping/separators — created_at is a UTC ISO
   string, and slicing the first 10 chars returns the UTC date. For users in KST (UTC+9)
   that misgroups 00:00-09:00 local-time messages as the previous UTC day and can render
   duplicate "오늘" separators. localDayKey() derives YYYY-MM-DD in the user's locale. */
function localDayKey(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function buildMessageItems(replies) {
    if (!replies || replies.length === 0) return [];
    const items = [];
    let prevDateKey = null;

    // First, figure out group membership for all replies
    const groupIds = new Array(replies.length).fill(0);
    for (let i = 0; i < replies.length; i++) {
        const r = replies[i];
        const prev = i > 0 ? replies[i - 1] : null;
        const dk = localDayKey(r.created_at);
        const prevDk = prev ? localDayKey(prev.created_at) : null;
        const sameGroup = prev &&
            prev.user_id === r.user_id &&
            dk === prevDk &&
            (new Date(r.created_at).getTime() - new Date(prev.created_at).getTime()) <= 180000;
        groupIds[i] = sameGroup ? groupIds[i - 1] : i;
    }

    for (let i = 0; i < replies.length; i++) {
        const r = replies[i];
        const dk = localDayKey(r.created_at);

        // Emit date separator on date change
        if (dk !== prevDateKey) {
            items.push({ type: "separator", label: getDateSeparatorLabel(r.created_at), key: `sep-${dk}-${i}` });
            prevDateKey = dk;
        }

        const gid = groupIds[i];
        const isFirstInGroup = groupIds[i - 1] !== gid || i === 0;
        const isLastInGroup = i === replies.length - 1 || groupIds[i + 1] !== gid;

        items.push({ type: "bubble", r, isFirstInGroup, isLastInGroup, key: r.id });
    }
    return items;
}

function MemoSection({ replies, onReplySubmit, readBy, myUserId, isParentMode, onReplyRef }) {
    /* UI-SPEC §5 — composer state */
    const [inputText, setInputText] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    /* UI-SPEC §7 — send-failure toast state (Option A: onReplySubmit returns Promise) */
    const [showSendFailureToast, setShowSendFailureToast] = useState(false);
    const [lastFailedText, setLastFailedText] = useState(null);
    const sendFailureTimerRef = useRef(null);

    /* UI-SPEC §6 — one-time onboarding toast */
    const [showOnboardingToast, setShowOnboardingToast] = useState(false);
    const onboardingTimerRef = useRef(null);

    /* UI-SPEC §4f — known-IDs set to detect new bubbles for animation */
    const seenIdsRef = useRef(new Set());

    /* UI-SPEC §Interaction — container ref for scroll-to-bottom */
    const containerRef = useRef(null);
    const prevRepliesLenRef = useRef(0);

    /* UI-SPEC §4f — prefers-reduced-motion */
    const prefersReducedMotion = useMemo(() =>
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []);

    /* UI-SPEC §5 — mobile detection for Enter key handling */
    const isMobile = typeof navigator !== "undefined" &&
        (/Android|iPhone|iPad/i.test(navigator.userAgent) ||
         (typeof window !== "undefined" && window.Capacitor !== undefined));

    /* UI-SPEC §6 — onboarding toast: show once on first mount */
    useEffect(() => {
        if (!localStorage.getItem("memoOnboardingV2Seen")) {
            setShowOnboardingToast(true);
            localStorage.setItem("memoOnboardingV2Seen", "1");
            onboardingTimerRef.current = setTimeout(() => setShowOnboardingToast(false), 4000);
        }
        return () => {
            if (onboardingTimerRef.current) clearTimeout(onboardingTimerRef.current);
        };
    }, []);

    /* UI-SPEC §Interaction §Scroll-to-Bottom — scroll on new message */
    useEffect(() => {
        const newLen = (replies || []).length;
        if (newLen > prevRepliesLenRef.current && containerRef.current) {
            containerRef.current.scrollIntoView({
                behavior: prefersReducedMotion ? "instant" : "smooth",
                block: "end"
            });
        }
        prevRepliesLenRef.current = newLen;
    }, [replies, prefersReducedMotion]);

    const othersRead = (readBy || []).filter(id => id !== myUserId).length > 0;
    const hasMessages = (replies && replies.length > 0);

    /* UI-SPEC §5 — handleSend with error catch for send-failure toast */
    const handleSend = (textOverride) => {
        const text = typeof textOverride === "string" ? textOverride : inputText.trim();
        if (!text) return;
        if (typeof textOverride !== "string") setInputText("");
        const result = onReplySubmit ? onReplySubmit(text) : null;
        if (result && typeof result.catch === "function") {
            result.catch(err => {
                console.error("[MemoSection] send failed", err);
                /* UI-SPEC §7 — show send-failure toast and keep text for retry */
                setLastFailedText(text);
                setShowSendFailureToast(true);
                if (sendFailureTimerRef.current) clearTimeout(sendFailureTimerRef.current);
                sendFailureTimerRef.current = setTimeout(() => setShowSendFailureToast(false), 5000);
            });
        }
    };

    /* UI-SPEC §7 — retry handler */
    const handleRetry = () => {
        setShowSendFailureToast(false);
        if (lastFailedText) handleSend(lastFailedText);
    };

    /* UI-SPEC §4b — build grouped message items */
    const messageItems = buildMessageItems(replies || []);

    return (
        <>
        {/* UI-SPEC §4f — keyframe animation style tag (idempotent) */}
        <style id="memo-bubble-anim">{`
            @keyframes bubbleIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
            @media (prefers-reduced-motion: reduce) { .memo-bubble-animate { animation: none !important; } }
        `}</style>

        {/* UI-SPEC §1 — MemoSection container */}
        <div ref={containerRef} style={{ marginTop: 18, background: "white", borderRadius: 20, padding: 0, border: "1.5px solid #E5E7EB", overflow: "hidden" }}>

            {/* UI-SPEC §2 — Header bar */}
            <div style={{ padding: "12px 16px", background: "#FAFAFA", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {/* UI-SPEC §2 — section title: fontSize 14, fontWeight 700 (corrected from 800) */}
                <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>💬 오늘의 메모</div>
                {/* UI-SPEC §2 — conditional ✓ 읽음 badge */}
                {hasMessages && othersRead && (
                    <div style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>✓ 읽음</div>
                )}
            </div>

            {/* UI-SPEC §4 — Chat bubble area */}
            <div
                role="log"
                aria-live="polite"
                aria-label="메모 대화"
                style={{ padding: "12px 16px", minHeight: 60 }}
            >
                {/* UI-SPEC §4g — empty state when no messages */}
                {!hasMessages ? (
                    <div style={{ textAlign: "center", padding: "24px 16px", color: "#D1D5DB" }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>💗</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF" }}>아직 주고받은 메시지가 없어요</div>
                        <div style={{ fontSize: 13 }}>
                            {isParentMode ? "아이에게 첫 메시지를 남겨보세요 💗" : "부모님께 오늘 하루를 전해봐~ 🐰"}
                        </div>
                    </div>
                ) : (
                    messageItems.map(item => {
                        if (item.type === "separator") {
                            /* UI-SPEC §4a — date separator pill */
                            return (
                                <div
                                    key={item.key}
                                    role="separator"
                                    aria-label={item.label}
                                    style={{ display: "flex", alignItems: "center", margin: "8px 0" }}
                                >
                                    <hr style={{ flex: 1, border: "none", borderTop: "1px solid #E5E7EB", margin: 0 }} />
                                    <span style={{ padding: "3px 12px", borderRadius: 99, background: "#F3F4F6", fontSize: 10, color: "#9CA3AF", fontWeight: 700, margin: "0 8px", whiteSpace: "nowrap" }}>
                                        {item.label}
                                    </span>
                                    <hr style={{ flex: 1, border: "none", borderTop: "1px solid #E5E7EB", margin: 0 }} />
                                </div>
                            );
                        }

                        /* UI-SPEC §4b — bubble item */
                        const { r, isFirstInGroup, isLastInGroup } = item;
                        const isLegacy = r.origin === "legacy_memo" || r.user_role === "legacy";
                        const isMe = !isLegacy && r.user_id === myUserId;

                        /* UI-SPEC §4c — avatar colors per role */
                        const avatarBg = isLegacy ? "#FEF3C7" : (r.user_role === "parent" ? "#DBEAFE" : "#FCE7F3");
                        const avatarGlyph = isLegacy ? "👶" : (r.user_role === "parent" ? "👩" : "🐰");

                        /* UI-SPEC §4d — bubble colors and border-radius */
                        const bubbleBg = isLegacy ? "#FEF3C7" : (isMe ? "#E879A0" : "#F3F4F6");
                        const bubbleColor = isLegacy ? "#92400E" : (isMe ? "#FFFFFF" : "#374151");
                        const bubbleRadius = isLegacy ? "12px" : (isMe ? "16px 4px 16px 16px" : "4px 16px 16px 16px");

                        /* UI-SPEC §4f — animation for new bubbles */
                        const isNew = !seenIdsRef.current.has(r.id);
                        if (isNew) seenIdsRef.current.add(r.id);
                        const animStyle = isNew && !prefersReducedMotion
                            ? { animation: "bubbleIn 150ms ease-out forwards" }
                            : {};

                        /* UI-SPEC §Accessibility — aria-label for bubble */
                        const senderLabel = isMe ? "나" : isLegacy ? "예전 메모" : (r.user_role === "parent" ? "부모님" : "아이");
                        const relTime = getRelativeTime(r.created_at);
                        const bubbleAriaLabel = `${senderLabel} ${relTime}에 보낸 메시지: ${r.content}`;

                        return (
                            <div
                                key={r.id}
                                role="article"
                                aria-label={bubbleAriaLabel}
                                data-memo-reply-id={r.id}
                                ref={el => { if (el && !isLegacy && onReplyRef) onReplyRef(el, r.id); }}
                                className={isNew && !prefersReducedMotion ? "memo-bubble-animate" : ""}
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    /* UI-SPEC §4b — marginBottom: 12px last of group, 4px middle */
                                    marginBottom: isLastInGroup ? 12 : 4,
                                    flexDirection: isMe ? "row-reverse" : "row",
                                    alignItems: "flex-start",
                                    ...animStyle
                                }}
                            >
                                {/* UI-SPEC §4c — avatar on first bubble, spacer on subsequent */}
                                {isFirstInGroup ? (
                                    <div style={{ width: 28, height: 28, borderRadius: 14, background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                                        {avatarGlyph}
                                    </div>
                                ) : (
                                    <div style={{ width: 28, flexShrink: 0 }} aria-hidden="true" />
                                )}

                                <div style={{ maxWidth: "75%" }}>
                                    {/* UI-SPEC §4d — legacy "예전 메모" label */}
                                    {isLegacy && (
                                        <div style={{ fontSize: 10, color: "#92400E", marginBottom: 3, fontWeight: 700 }}>예전 메모</div>
                                    )}

                                    {/* UI-SPEC §4d — bubble body */}
                                    <div style={{
                                        background: bubbleBg,
                                        color: bubbleColor,
                                        borderRadius: bubbleRadius,
                                        padding: "10px 14px",
                                        fontSize: 14,
                                        lineHeight: 1.45,
                                        fontFamily: FF,
                                        wordBreak: "break-word",
                                        overflowWrap: "break-word",
                                        border: isLegacy ? "1px dashed #FBBF24" : "none"
                                    }}>
                                        {r.content}
                                    </div>

                                    {/* UI-SPEC §4e — timestamp on last bubble of group only */}
                                    {isLastInGroup && (
                                        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4, textAlign: isMe ? "right" : "left" }}>
                                            {relTime}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* UI-SPEC §5 — Composer bar */}
            <div style={{
                padding: "10px 12px",
                paddingBottom: "max(10px, env(safe-area-inset-bottom))",
                borderTop: "1px solid #F3F4F6",
                display: "flex",
                gap: 8,
                alignItems: "center",
                background: "#FAFAFA"
            }}>
                {/* UI-SPEC §5 — composer input: fontSize 16 prevents iOS auto-zoom */}
                <input
                    type="text"
                    aria-label={isParentMode ? "메모 입력" : "답글 입력"}
                    aria-required="false"
                    autoComplete="off"
                    autoCorrect="on"
                    spellCheck="true"
                    placeholder={isParentMode ? "메시지를 입력하세요..." : "답글을 남겨봐~ 🐰"}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={e => {
                        /* UI-SPEC §5 — desktop Enter=send, mobile Enter=newline */
                        if (e.key === "Enter" && !isMobile) { e.preventDefault(); handleSend(); }
                    }}
                    style={{
                        flex: 1,
                        /* UI-SPEC §5 — focus border swap #E5E7EB → #E879A0 */
                        border: `1.5px solid ${isFocused ? "#E879A0" : "#E5E7EB"}`,
                        borderRadius: 22,
                        padding: "11px 16px",
                        fontSize: 16,
                        fontFamily: FF,
                        outline: "none",
                        background: "white",
                        boxSizing: "border-box",
                        color: "#374151"
                    }}
                />
                {/* UI-SPEC §5 — send button: 44x44 touch target */}
                <button
                    type="button"
                    aria-label="메시지 보내기"
                    onClick={() => handleSend()}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        /* UI-SPEC §5 — active gradient vs. inactive grey */
                        background: inputText.trim()
                            ? "linear-gradient(135deg,#E879A0,#BE185D)"
                            : "#E5E7EB",
                        color: "white",
                        border: "none",
                        cursor: inputText.trim() ? "pointer" : "default",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        flexShrink: 0,
                        transition: "background 0.2s ease"
                    }}>
                    ↑
                </button>
            </div>
        </div>

        {/* UI-SPEC §6 — one-time onboarding toast */}
        {showOnboardingToast && (
            <div
                role="status"
                aria-live="polite"
                aria-label="메모 화면이 새로워졌어요"
                style={{
                    position: "fixed",
                    bottom: "max(80px, calc(80px + env(safe-area-inset-bottom)))",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#E879A0",
                    color: "#FFFFFF",
                    borderRadius: 24,
                    padding: "12px 20px",
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: FF,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 20px rgba(232,121,160,0.35)",
                    whiteSpace: "nowrap",
                    zIndex: 9999,
                    animation: prefersReducedMotion ? "none" : "toastIn 200ms ease-out forwards"
                }}
            >
                메모 화면이 새로워졌어요 ✨
                <button
                    type="button"
                    aria-label="메모 안내 숨김"
                    onClick={() => { setShowOnboardingToast(false); if (onboardingTimerRef.current) clearTimeout(onboardingTimerRef.current); }}
                    style={{ background: "transparent", border: "none", color: "white", fontSize: 16, cursor: "pointer", padding: "0 0 0 4px", lineHeight: 1, minWidth: 24, minHeight: 24 }}
                >
                    ×
                </button>
            </div>
        )}

        {/* UI-SPEC §7 — send-failure toast */}
        {showSendFailureToast && (
            <div
                role="alert"
                aria-live="assertive"
                aria-label="메시지 전송 실패"
                style={{
                    position: "fixed",
                    bottom: "max(80px, calc(80px + env(safe-area-inset-bottom)))",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#FEE2E2",
                    color: "#991B1B",
                    borderRadius: 24,
                    padding: "12px 20px",
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: FF,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 16px rgba(153,27,27,0.15)",
                    whiteSpace: "nowrap",
                    zIndex: 9999
                }}
            >
                메시지 전송에 실패했어요. 다시 시도해 주세요.
                <button
                    type="button"
                    aria-label="메시지 전송 다시 시도"
                    onClick={handleRetry}
                    style={{ background: "transparent", border: "1px solid #991B1B", borderRadius: 12, color: "#991B1B", fontSize: 12, fontWeight: 700, padding: "3px 10px", cursor: "pointer", marginLeft: 8 }}
                >
                    다시 시도
                </button>
                <button
                    type="button"
                    aria-label="전송 실패 숨김"
                    onClick={() => { setShowSendFailureToast(false); if (sendFailureTimerRef.current) clearTimeout(sendFailureTimerRef.current); }}
                    style={{ background: "transparent", border: "none", color: "#991B1B", fontSize: 16, cursor: "pointer", padding: "0 0 0 4px", lineHeight: 1, minWidth: 24, minHeight: 24 }}
                >
                    ×
                </button>
            </div>
        )}
        </>
    );
}

function ParentMemoPage({ replies, onReplySubmit, myUserId, onClose, partnerName, onReplyRef }) {
    const [inputText, setInputText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState("");
    const today = new Date();
    const dateLabel = `오늘 · ${DAYS_KO[today.getDay()]}요일`;
    const title = "오늘의 메모";
    const subtitle = partnerName ? `${partnerName}와 실시간 공유중` : "실시간 공유중";
    const messages = Array.isArray(replies) ? replies : [];

    const handleSend = () => {
        const text = inputText.trim();
        if (!text || isSending) return;
        setIsSending(true);
        setSendError("");
        const result = onReplySubmit ? onReplySubmit(text) : null;
        Promise.resolve(result)
            .then(() => setInputText(""))
            .catch(err => {
                console.error("[ParentMemoPage] send failed", err);
                setSendError("전송에 실패했어요. 다시 시도해 주세요.");
            })
            .finally(() => setIsSending(false));
    };

    const setPreset = (text) => {
        setInputText(text);
        setSendError("");
    };

    return (
        <main className="hyeni-memo-page" aria-label="오늘의 메모 페이지">
            <div className="hyeni-memo-phone">
                <div className="hyeni-memo-status">
                    <span>9:41</span>
                    <span aria-hidden="true">▮▮ ▰</span>
                </div>
                <header className="hyeni-memo-header">
                    <button type="button" className="hyeni-memo-back" onClick={onClose} aria-label="메모 닫기">‹</button>
                    <div className="hyeni-memo-title-block">
                        <h1>{title}</h1>
                        <p><span aria-hidden="true" />{subtitle}</p>
                    </div>
                    <button type="button" className="hyeni-memo-voice" aria-label="음성 메모">♬</button>
                </header>

                <section className="hyeni-memo-thread" aria-label="오늘의 메모 대화">
                    <div className="hyeni-memo-date-row">
                        <span />
                        <strong>{dateLabel}</strong>
                        <span />
                    </div>

                    {messages.length === 0 ? (
                        <div className="hyeni-memo-empty">
                            <div>💌</div>
                            <strong>오늘 남긴 메모가 없어요</strong>
                            <p>아이와 공유할 준비물, 칭찬, 확인할 일을 남겨보세요.</p>
                        </div>
                    ) : (
                        messages.map((message) => {
                            const isMine = message.user_id === myUserId;
                            const sender = message.user_role === "parent" ? "엄마" : (partnerName || "아이");
                            const time = getRelativeTime(message.created_at);
                            return (
                                <article
                                    key={message.id}
                                    className={`hyeni-memo-message ${isMine ? "mine" : "theirs"}`}
                                    ref={el => { if (el && onReplyRef && message.id && !String(message.id).startsWith("temp-")) onReplyRef(el, message.id); }}
                                    aria-label={`${sender} ${time} 메모: ${message.content}`}
                                >
                                    {!isMine && <div className="hyeni-memo-avatar" aria-hidden="true">👧</div>}
                                    <div className="hyeni-memo-message-body">
                                        <div className="hyeni-memo-sender">
                                            <strong>{isMine ? "나" : sender}</strong>
                                            <span>{time}</span>
                                        </div>
                                        <div className="hyeni-memo-bubble">{message.content}</div>
                                        {isMine && <div className="hyeni-memo-read">읽음 ✓</div>}
                                    </div>
                                    {isMine && <div className="hyeni-memo-avatar small" aria-hidden="true">🐰</div>}
                                </article>
                            );
                        })
                    )}

                    <div className="hyeni-memo-sticker-card">
                        <span aria-hidden="true">⭐</span>
                        <div>
                            <strong>스티커 칭찬을 남겨보세요!</strong>
                            <p>짧은 응원도 아이에게 바로 보여요.</p>
                        </div>
                    </div>

                    <div className="hyeni-memo-quick-row" aria-label="빠른 메모">
                        <button type="button" onClick={() => setPreset("꾹 인사 보낼게 👋")}>👋 꾹 인사</button>
                        <button type="button" onClick={() => setPreset("지금 어디야?")}>📍 어디야?</button>
                        <button type="button" onClick={() => setPreset("스티커 칭찬을 보냈어요 ⭐")}>⭐ 스티커</button>
                    </div>
                </section>

                <footer className="hyeni-memo-composer">
                    {sendError && <div className="hyeni-memo-error" role="alert">{sendError}</div>}
                    <div className="hyeni-memo-input-shell">
                        <input
                            type="text"
                            aria-label="메모 입력"
                            placeholder="메시지를 입력하세요..."
                            value={inputText}
                            onChange={event => {
                                setInputText(event.target.value);
                                if (sendError) setSendError("");
                            }}
                            onKeyDown={event => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                        <button
                            type="button"
                            aria-label="메시지 보내기"
                            onClick={handleSend}
                            disabled={!inputText.trim() || isSending}
                        >
                            ↑
                        </button>
                    </div>
                </footer>
            </div>
        </main>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day Timetable (kid-friendly)
// ─────────────────────────────────────────────────────────────────────────────
function DayTimetable({ events, dateLabel, isToday = false, isFuture = false, childPos, mapReady: _mapReady, arrivedSet, firedEmergencies, onRoute, onDelete, onEditLoc, stickers, memoReplies, onReplySubmit, memoReadBy, myUserId, isParentMode, onReplyRef }) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    if (events.length === 0) return (
        <div style={{ fontFamily: FF }}>
            <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>{isParentMode ? "🌙" : "🎉"}</div>
                <div style={{ fontSize: isParentMode ? 16 : 18, fontWeight: 800, color: isParentMode ? "#D1D5DB" : "#F9A8D4" }}>{isParentMode ? "아직 일정이 없어요" : "오늘은 자유시간이야!"}</div>
                <div style={{ fontSize: isParentMode ? 13 : 14, color: "#E5E7EB", marginTop: 4 }}>{isParentMode ? "위에서 추가해 보세요!" : "신나게 놀자~ 🐰"}</div>
            </div>
            <MemoSection replies={memoReplies} onReplySubmit={onReplySubmit} readBy={memoReadBy} myUserId={myUserId} isParentMode={isParentMode} onReplyRef={onReplyRef} />
        </div>
    );

    return (
        <div style={{ fontFamily: FF }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#374151" }}>{dateLabel}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{events.length}개 일정</div>
                </div>
                {childPos
                    ? <div style={{ fontSize: 11, fontWeight: 700, color: "#34D399", background: "#D1FAE5", padding: "5px 12px", borderRadius: 12 }}>💕 엄마가 항상 함께하고 있어요</div>
                    : <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", background: "#F3F4F6", padding: "5px 12px", borderRadius: 12 }}>위치 없음</div>}
            </div>

            {/* Timeline */}
            <div style={{ position: "relative", paddingLeft: 28 }}>
                {/* Vertical line */}
                <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 3, background: "linear-gradient(to bottom, #E879A0, #F9A8D4, #60A5FA)", borderRadius: 4 }} />

                {events.map((ev, i) => {
                    const [h, m] = ev.time.split(":").map(Number);
                    const evMin = h * 60 + m;
                    const endMin = ev.endTime ? (() => { const [eh, em] = ev.endTime.split(":").map(Number); return eh * 60 + em; })() : evMin + 60;
                    const isPast = isToday ? nowMin > endMin : !isFuture;  // 오늘이면 시간비교, 과거 날짜면 전부 past
                    const isCurrent = isToday && nowMin >= evMin - 10 && nowMin <= endMin;  // 오늘만 "지금!" 표시
                    const arrived = arrivedSet.has(ev.id);
                    const emergency = ev.location && !arrived && firedEmergencies.has(ev.id);
                    const friendlyTime = isParentMode ? ev.time : `${h >= 12 ? "오후" : "오전"} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")}`;
                    const friendlyEndTime = ev.endTime ? (isParentMode ? ev.endTime : (() => { const [eh, em] = ev.endTime.split(":").map(Number); return `${eh >= 12 ? "오후" : "오전"} ${eh > 12 ? eh - 12 : eh === 0 ? 12 : eh}:${String(em).padStart(2, "0")}`; })()) : null;

                    const dist = childPos && ev.location
                        ? haversineM(childPos.lat, childPos.lng, ev.location.lat, ev.location.lng)
                        : null;
                    const distLabel = dist !== null
                        ? dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${Math.round(dist)}m`
                        : null;

                    return (
                        <div key={ev.id} style={{ position: "relative", marginBottom: i < events.length - 1 ? 16 : 0 }}>
                            {/* Dot on timeline */}
                            <div style={{
                                position: "absolute", left: -22, top: 14, width: 14, height: 14, borderRadius: "50%",
                                background: isCurrent ? ev.color : arrived ? "#059669" : isPast ? "#D1D5DB" : "white",
                                border: `3px solid ${isCurrent ? ev.color : arrived ? "#059669" : isPast ? "#D1D5DB" : ev.color}`,
                                boxShadow: isCurrent ? `0 0 0 4px ${ev.color}33` : "none",
                                zIndex: 2
                            }} />

                            {/* Event card */}
                            <div
                                onClick={() => ev.location ? onRoute(ev) : null}
                                style={{
                                    background: isCurrent ? `linear-gradient(135deg,${ev.bg},white)` : "white",
                                    borderRadius: 20, padding: "14px 16px",
                                    border: isCurrent ? `2px solid ${ev.color}` : "2px solid #F3F4F6",
                                    cursor: ev.location ? "pointer" : "default",
                                    transition: "all 0.2s",
                                    opacity: isPast && !isCurrent ? 0.6 : 1,
                                    position: "relative"
                                }}>

                                {/* Time badge */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <div style={{
                                        background: isCurrent ? ev.color : ev.bg,
                                        color: isCurrent ? "white" : ev.color,
                                        padding: isParentMode ? "4px 12px" : "6px 14px", borderRadius: 12, fontSize: isParentMode ? 13 : 15, fontWeight: 800
                                    }}>
                                        {friendlyTime}{friendlyEndTime ? ` ~ ${friendlyEndTime}` : ""}
                                    </div>
                                    {isCurrent && (isParentMode
                                        ? <span style={{ fontSize: 11, fontWeight: 700, color: ev.color, animation: "pulse 1.5s infinite" }}>지금!</span>
                                        : <span style={{ fontSize: 13, fontWeight: 800, color: "white", background: ev.color, padding: "3px 10px", borderRadius: 10, animation: "pulse 1.5s infinite" }}>지금 갈 시간! 🏃</span>
                                    )}
                                    {isFuture && !isCurrent && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: DESIGN.colors.parentDeep, background: DESIGN.colors.parentPale, padding: "2px 8px", borderRadius: 8 }}>예정</span>
                                    )}
                                    {arrived && <span style={{ fontSize: isParentMode ? 11 : 13, fontWeight: 700, color: "#059669" }}>✅ 도착</span>}
                                    {emergency && isParentMode && <span style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", animation: "pulse 1s infinite" }}>🚨 미도착</span>}
                                </div>

                                {/* Content */}
                                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                    <div style={{ width: isParentMode ? 44 : 50, height: isParentMode ? 44 : 50, borderRadius: isParentMode ? 14 : 16, background: ev.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isParentMode ? 24 : 28, flexShrink: 0 }}>{ev.emoji}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: isParentMode ? 16 : 18, fontWeight: 800, color: "#1F2937" }}>{ev.title}</div>
                                        {ev.location && (
                                            <div style={{ fontSize: isParentMode ? 12 : 13, color: "#6B7280", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                                <span>📍</span>
                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.location.address}</span>
                                            </div>
                                        )}
                                        {ev.memo && <div style={{ fontSize: isParentMode ? 11 : 12, color: "#9CA3AF", marginTop: 2 }}>📝 {ev.memo}</div>}
                                    </div>
                                </div>

                                {/* Distance + action row */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                                    {ev.location && distLabel && (
                                        <div style={{ fontSize: isParentMode ? 11 : 13, fontWeight: 700, color: ev.color, background: ev.bg, padding: isParentMode ? "4px 10px" : "6px 12px", borderRadius: 10, display: "flex", alignItems: "center", gap: 4 }}>
                                            🚶 {distLabel}
                                        </div>
                                    )}
                                    {ev.location && (
                                        <button onClick={(e) => { e.stopPropagation(); onRoute(ev); }}
                                            style={{ fontSize: isParentMode ? 12 : 14, fontWeight: 800, color: "white", background: `linear-gradient(135deg, ${ev.color}, ${ev.color}cc)`, padding: isParentMode ? "6px 14px" : "8px 16px", borderRadius: isParentMode ? 12 : 14, border: "none", cursor: "pointer", fontFamily: FF, boxShadow: `0 2px 8px ${ev.color}44`, display: "flex", alignItems: "center", gap: 4 }}>
                                            🧭 길찾기
                                        </button>
                                    )}
                                    {!ev.location && isParentMode && (
                                        <button onClick={(e) => { e.stopPropagation(); onEditLoc(ev.id); }}
                                            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 10, background: "#FFF0F7", border: "1.5px dashed #F9A8D4", color: "#E879A0", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>
                                            📍 장소 추가
                                        </button>
                                    )}
                                </div>

                                {/* Delete button - parent only */}
                                {isParentMode && (
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }}
                                        style={{ position: "absolute", right: 10, top: 10, background: "rgba(0,0,0,0.04)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 12, color: "#D1D5DB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FF }}>✕</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Stickers earned today */}
            {stickers && stickers.length > 0 && (
                <div style={{ marginTop: 16, background: "linear-gradient(135deg, #FEF3C7, #FDE68A22)", borderRadius: 20, padding: 14, border: "2px solid #FCD34D" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", marginBottom: 8 }}>🏆 오늘 받은 칭찬스티커</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {stickers.map((s, i) => (
                            <div key={s.id || i} style={{
                                background: "white", borderRadius: 12, padding: "6px 10px",
                                display: "flex", alignItems: "center", gap: 4,
                                border: "1.5px solid #FCD34D", boxShadow: "0 2px 4px rgba(252,211,77,0.2)",
                            }}>
                                <span style={{ fontSize: 16 }}>{s.emoji}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Memo */}
            <MemoSection
                replies={memoReplies}
                onReplySubmit={onReplySubmit}
                readBy={memoReadBy}
                myUserId={myUserId}
                isParentMode={isParentMode}
                onReplyRef={onReplyRef}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticker Book Modal
// ─────────────────────────────────────────────────────────────────────────────
function StickerBookModal({ stickers, summary, dateLabel, onClose, isParentMode, onGiveSticker }) {
    const earlyCount = summary?.early_count || 0;
    const onTimeCount = summary?.on_time_count || 0;
    const lateCount = summary?.late_count || 0;
    const [showGive, setShowGive] = useState(false);
    const [giveMsg, setGiveMsg] = useState("");
    const PRAISE = [
        { emoji: "🌟", title: "최고예요!" }, { emoji: "👏", title: "잘했어!" },
        { emoji: "💪", title: "대단해!" }, { emoji: "🎯", title: "정확해요!" },
        { emoji: "🌈", title: "멋져요!" }, { emoji: "💕", title: "사랑해!" },
        { emoji: "🏆", title: "챔피언!" }, { emoji: "✨", title: "빛나는 하루!" },
    ];

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={makeSheetStyle({ width: "100%", maxWidth: 460, maxHeight: "85vh", display: "flex", flexDirection: "column" })}>
                {/* 헤더 + 요약 (고정) */}
                <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 28 }}>🏆</span>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 900, color: "#374151" }}>칭찬 스티커북</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{dateLabel}</div>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF, fontSize: 13 }}>닫기</button>
                    </div>

                    {/* 요약 카운트 — 한 줄 컴팩트 */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                        {[
                            { emoji: "🌟", count: earlyCount, label: "일찍", bg: "#FEF3C7", color: "#F59E0B" },
                            { emoji: "⭐", count: onTimeCount, label: "정시", bg: DESIGN.colors.parentPale, color: DESIGN.colors.parentDeep },
                            { emoji: "😢", count: lateCount, label: "아쉬워", bg: "#F3F4F6", color: "#9CA3AF" },
                            { emoji: "💕", count: stickers.filter(s => s.sticker_type === "praise").length, label: "칭찬", bg: "#FFF0F5", color: "#EC4899" },
                        ].map((item, i) => (
                            <div key={i} style={{ flex: 1, background: item.bg, borderRadius: 12, padding: "8px 4px", textAlign: "center" }}>
                                <div style={{ fontSize: 16 }}>{item.emoji} <span style={{ fontWeight: 900, color: item.color }}>{item.count}</span></div>
                                <div style={{ fontSize: 9, color: item.color, fontWeight: 700, marginTop: 2 }}>{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 스티커 목록 (스크롤 영역) */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", minHeight: 0 }}>
                    {stickers.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px 0", color: "#D1D5DB" }}>
                            <div style={{ fontSize: 32, marginBottom: 6 }}>🌙</div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>아직 스티커가 없어요</div>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
                            {stickers.map((s, i) => (
                                <div key={s.id || i} style={{
                                    background: s.sticker_type === "early" ? "#FEF3C7" : s.sticker_type === "late" ? "#F3F4F6" : s.sticker_type === "praise" ? "#FFF0F5" : DESIGN.colors.parentPale,
                                    borderRadius: 14, padding: "8px 6px", textAlign: "center",
                                    border: `1.5px solid ${s.sticker_type === "early" ? "#FCD34D" : s.sticker_type === "late" ? "#D1D5DB" : s.sticker_type === "praise" ? "#F9A8D4" : "#C4B5FD"}`,
                                    opacity: s.sticker_type === "late" ? 0.6 : 1,
                                }}>
                                    <div style={{ fontSize: 22 }}>{s.emoji}</div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: "#374151", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 하단 고정: 칭찬 주기 + 닫기 */}
                <div style={{ padding: "12px 20px 20px", flexShrink: 0 }}>
                    {isParentMode && onGiveSticker && !showGive && (
                        <button onClick={() => setShowGive(true)}
                            style={{ width: "100%", padding: "13px", marginBottom: 8, borderRadius: 16, border: "2px dashed #FCD34D", background: "linear-gradient(135deg, #FFFBEB, #FEF3C7)", cursor: "pointer", fontSize: 14, fontWeight: 900, color: "#F59E0B", fontFamily: FF }}>
                            🌟 칭찬스티커 주기
                        </button>
                    )}
                    {isParentMode && onGiveSticker && showGive && (
                        <div style={{ background: "#FFFBEB", borderRadius: 16, padding: 12, border: "2px solid #FCD34D", marginBottom: 8 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                                {PRAISE.map((ps, i) => (
                                    <button key={i} onClick={async () => {
                                        await onGiveSticker(ps.emoji, giveMsg.trim() || ps.title);
                                        setShowGive(false); setGiveMsg("");
                                    }}
                                        style={{ background: "white", border: "1.5px solid #FCD34D", borderRadius: 12, padding: "8px 2px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontFamily: FF }}>
                                        <span style={{ fontSize: 20 }}>{ps.emoji}</span>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: "#92400E" }}>{ps.title}</span>
                                    </button>
                                ))}
                            </div>
                            <input value={giveMsg} onChange={e => setGiveMsg(e.target.value)} placeholder="직접 메시지 (선택)"
                                style={{ width: "100%", marginTop: 8, padding: "7px 10px", borderRadius: 10, border: "1.5px solid #FCD34D", fontSize: 12, fontFamily: FF, boxSizing: "border-box", outline: "none" }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Recorder (ambient sound for safety)
// ─────────────────────────────────────────────────────────────────────────────
// Remote Ambient Audio Listener (Parent sends command → Child records → streams back)
function AmbientAudioRecorder({ channel, familyId: recFamilyId, senderUserId, onClose }) {
    const [status, setStatus] = useState("idle"); // idle, waiting, listening
    const [duration, setDuration] = useState(0);
    const [errorMessage, setErrorMessage] = useState("");
    const [, setAudioChunks] = useState([]);
    const timerRef = useRef(null);
    const playbackRef = useRef(Promise.resolve());
    const audioContextRef = useRef(null);
    const nextPlayAtRef = useRef(0);
    const remoteAudioCurrentRequestIdRef = useRef(null);
    const remoteAudioSeenChunksRef = useRef(new Set());
    const startInFlightRef = useRef(false);
    const playbackGenerationRef = useRef(0);
    const activeSourcesRef = useRef(new Set());
    const activeAudioElementsRef = useRef(new Set());

    const stopActivePlayback = useCallback(() => {
        playbackGenerationRef.current += 1;
        nextPlayAtRef.current = 0;
        for (const source of activeSourcesRef.current) {
            try { source.stop(0); } catch { /* source may already be stopped */ }
        }
        activeSourcesRef.current.clear();
        for (const audio of activeAudioElementsRef.current) {
            try {
                audio.pause();
                audio.src = "";
                audio.load?.();
            } catch { /* ignore stopped fallback audio */ }
        }
        activeAudioElementsRef.current.clear();
        playbackRef.current = Promise.resolve();
    }, []);

    const startListening = async () => {
        if (startInFlightRef.current || status !== "idle") return;
        setErrorMessage("");
        if (!recFamilyId || !senderUserId) {
            setErrorMessage("가족 연결 정보가 없어 주변음성듣기를 시작할 수 없어요.");
            return;
        }
        startInFlightRef.current = true;
        stopActivePlayback();
        const durationSec = REMOTE_AUDIO_DEFAULT_DURATION_SEC;
        const requestId = generateUUID();
        remoteAudioCurrentRequestIdRef.current = requestId;
        remoteAudioSeenChunksRef.current.clear();
        try {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (AudioContextCtor && !audioContextRef.current) {
                audioContextRef.current = new AudioContextCtor();
            }
            audioContextRef.current?.resume?.();
            nextPlayAtRef.current = audioContextRef.current?.currentTime || 0;
        } catch (error) {
            console.warn("[Audio] AudioContext unlock failed:", error?.message || error);
        }
        setStatus("waiting");
        setDuration(0);
        setAudioChunks([]);
        // 1. Broadcast for when child app is already open
        const startPayload = {
            duration: durationSec,
            durationSec,
            initiatorUserId: senderUserId,
            initiator_user_id: senderUserId,
            requestId,
            targetRole: "child",
        };
        // 2. FCM push to wake up child app if closed
        let pushPromise = Promise.resolve();
        try {
            pushPromise = sendInstantPush({
                action: "remote_listen",
                familyId: recFamilyId,
                senderUserId,
                title: "",
                message: "",
                durationSec,
                requestId,
                targetRole: "child",
                idempotencyKey: requestId,
            });
            const realtimeSent = await sendBroadcastWhenReady(
                channel,
                "remote_listen_start",
                startPayload,
                { timeoutMs: 1800, pollMs: 60 }
            );
            if (!realtimeSent) {
                setErrorMessage("실시간 채널 연결 대기 중입니다. 아이 기기에는 깨우기 알림을 보냈어요.");
            }
        } catch (error) {
            console.warn("[Audio] remote_listen_start broadcast failed:", error?.message || error);
            setErrorMessage("실시간 채널 연결 대기 중입니다. 아이 기기에는 깨우기 알림을 보냈어요.");
        } finally {
            await pushPromise.catch((error) => {
                console.warn("[Audio] remote listen push failed:", error?.message || error);
            });
            startInFlightRef.current = false;
        }
        timerRef.current = setTimeout(() => stopListening(), (durationSec + 5) * 1000);
    };

    const stopListening = () => {
        startInFlightRef.current = false;
        if (channel) channel.send({ type: "broadcast", event: "remote_listen_stop", payload: {} });
        setErrorMessage("");
        setStatus("idle");
        stopActivePlayback();
        remoteAudioCurrentRequestIdRef.current = null;
        remoteAudioSeenChunksRef.current.clear();
        if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch { /* ignore */ }
            audioContextRef.current = null;
        }
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    // Play received audio chunk
    const playChunk = useCallback((base64, mimeType) => {
        const playbackGeneration = playbackGenerationRef.current;
        playbackRef.current = playbackRef.current
            .catch(() => {})
            .then(async () => {
                try {
                    if (playbackGeneration !== playbackGenerationRef.current) return;
                    const binary = atob(base64);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    const audioContext = audioContextRef.current;
                    if (audioContext && audioContext.state !== "closed") {
                        try {
                            if (playbackGeneration !== playbackGenerationRef.current) return;
                            if (audioContext.state === "suspended") {
                                await audioContext.resume();
                            }
                            const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
                            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                            if (playbackGeneration !== playbackGenerationRef.current) return;
                            const source = audioContext.createBufferSource();
                            const startAt = Math.max(audioContext.currentTime + 0.02, nextPlayAtRef.current || 0);
                            nextPlayAtRef.current = startAt + audioBuffer.duration;
                            source.buffer = audioBuffer;
                            source.connect(audioContext.destination);
                            activeSourcesRef.current.add(source);
                            source.onended = () => activeSourcesRef.current.delete(source);
                            source.start(startAt);
                            return;
                        } catch (webAudioError) {
                            console.warn("[Audio] WebAudio playback fallback:", webAudioError?.message || webAudioError);
                        }
                    }
                    const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    activeAudioElementsRef.current.add(audio);
                    await new Promise((resolve, reject) => {
                        const cleanup = () => {
                            activeAudioElementsRef.current.delete(audio);
                            audio.onended = null;
                            audio.onerror = null;
                            URL.revokeObjectURL(url);
                        };
                        audio.onended = () => { cleanup(); resolve(); };
                        audio.onerror = () => { cleanup(); reject(new Error("audio playback failed")); };
                        if (playbackGeneration !== playbackGenerationRef.current) {
                            cleanup();
                            resolve();
                            return;
                        }
                        const playPromise = audio.play();
                        if (playPromise?.catch) {
                            playPromise.catch((error) => {
                                cleanup();
                                reject(error);
                            });
                        }
                    });
                } catch (e) {
                    console.log("[Audio] chunk play error:", e.message);
                }
            });
    }, []);

    // Listen for audio chunks via custom event from Realtime
    useEffect(() => {
        const handleChunk = (e) => {
            if (status === "idle") return;
            const detail = e.detail || {};
            const currentRequestId = remoteAudioCurrentRequestIdRef.current;
            if (detail.requestId && currentRequestId && detail.requestId !== currentRequestId) return;
            const sequence = Number.isFinite(Number(detail.sequenceNumber)) ? Number(detail.sequenceNumber) : "";
            const fallbackSource = detail.source || detail.mimeType || "audio";
            const chunkKey = [
                detail.requestId || currentRequestId || "legacy",
                detail.childUserId || "",
                sequence === "" ? fallbackSource : "seq",
                sequence === "" ? String(detail.data || "").slice(0, 96) : sequence,
            ].join(":");
            if (remoteAudioSeenChunksRef.current.has(chunkKey)) return;
            remoteAudioSeenChunksRef.current.add(chunkKey);
            if (remoteAudioSeenChunksRef.current.size > 180) {
                remoteAudioSeenChunksRef.current = new Set(Array.from(remoteAudioSeenChunksRef.current).slice(-120));
            }
            setStatus("listening");
            const chunkMs = Number(detail?.durationMs) || REMOTE_AUDIO_CHUNK_MS;
            setDuration(d => d + Math.max(1, Math.round(chunkMs / 1000)));
            setAudioChunks(prev => [...prev, detail]);
            playChunk(detail.data, detail.mimeType);
        };
        window.addEventListener("remote-audio-chunk", handleChunk);
        return () => window.removeEventListener("remote-audio-chunk", handleChunk);
    }, [status, playChunk]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            stopActivePlayback();
            if (audioContextRef.current) {
                try { audioContextRef.current.close(); } catch { /* ignore */ }
                audioContextRef.current = null;
            }
        };
    }, [stopActivePlayback]);

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget && status === "idle") onClose(); }}>
            <div style={makeCardStyle({ padding: "24px 20px", width: "90%", maxWidth: 360, textAlign: "center" })}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{status === "listening" ? "🔊" : status === "waiting" ? "📡" : "🎤"}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#374151", marginBottom: 8 }}>
                    {status === "listening" ? "아이 주변 소리 듣는 중..." : status === "waiting" ? "아이 기기 연결 중..." : "주변 소리 듣기"}
                </div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
                    {status === "idle" ? "프리미엄 회원은 아이 기기의 마이크를 1분간 원격으로 켜서 주변 소리를 들을 수 있어요" : status === "waiting" ? "연결 대기 중" : `${duration}초 수신 중`}
                </div>
                {status === "listening" && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 3 }}>
                            {REMOTE_AUDIO_LEVEL_BARS.map((height, i) => <div key={i} style={{ width: 4, height, background: "#DC2626", borderRadius: 2, animation: "pulse 0.5s infinite", animationDelay: `${i * 0.1}s` }} />)}
                        </div>
                    </div>
                )}
                {status === "waiting" && (
                    <div style={{ marginBottom: 16, fontSize: 12, color: "#F59E0B", fontWeight: 700 }}>아이 기기를 깨우고 연결 중입니다. 몇 초 걸릴 수 있어요.</div>
                )}
                {errorMessage && (
                    <div role="alert" style={{ marginBottom: 16, fontSize: 12, color: "#B91C1C", fontWeight: 800, lineHeight: 1.45 }}>
                        {errorMessage}
                    </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                    {status === "idle" && (
                        <button onClick={startListening}
                            style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg, #DC2626, #B91C1C)", color: "white", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            🎙️ 듣기 시작
                        </button>
                    )}
                    {(status === "listening" || status === "waiting") && (
                        <button onClick={stopListening}
                            style={{ flex: 1, padding: "14px", background: "#374151", color: "white", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            ⏹️ 중지
                        </button>
                    )}
                    <button onClick={() => { stopListening(); onClose(); }}
                        style={{ padding: "14px 20px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                        닫기
                    </button>
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 12 }}>최대 1분 · 프리미엄 전용 · 아이의 안전을 위해 사용해주세요</div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Location Map View (interactive map + card list)
// ─────────────────────────────────────────────────────────────────────────────
function hasPlaceLocation(location) {
    return !!(location?.lat && location?.lng);
}

function getPlaceLocationKey(location) {
    if (!hasPlaceLocation(location)) return "";
    const addressKey = typeof location.address === "string" ? location.address.trim().toLowerCase() : "";
    const lat = Number(location.lat);
    const lng = Number(location.lng);
    if (addressKey) return `addr:${addressKey}`;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return `coord:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    }
    return "";
}

function buildSavedPlaceItems(savedPlaces) {
    const byKey = new Map();

    (savedPlaces || []).forEach((place) => {
        if (!hasPlaceLocation(place?.location)) return;
        const key = getPlaceLocationKey(place.location) || `saved:${place.id}`;
        if (!key || byKey.has(key)) return;
        byKey.set(key, place);
    });

    return Array.from(byKey.values());
}

function eventDateValue(dateKey, time) {
    if (typeof dateKey !== "string" || typeof time !== "string") return Number.POSITIVE_INFINITY;
    const [year, month, day] = dateKey.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    if ([year, month, day, hours, minutes].some((value) => Number.isNaN(value))) {
        return Number.POSITIVE_INFINITY;
    }
    return new Date(year, month, day, hours, minutes).getTime();
}

function buildEventPlaceItems(events, excludedKeys = new Set(), arrivedSet = new Set()) {
    const groups = new Map();

    Object.entries(events || {}).forEach(([dateKey, dayEvents]) => {
        (dayEvents || []).forEach((event) => {
            if (!hasPlaceLocation(event?.location)) return;
            const locationKey = getPlaceLocationKey(event.location);
            if (!locationKey || excludedKeys.has(locationKey)) return;

            const eventWithDate = { ...event, dateKey };
            const existing = groups.get(locationKey);
            if (existing) {
                existing.events.push(eventWithDate);
                return;
            }

            groups.set(locationKey, {
                key: locationKey,
                location: event.location,
                events: [eventWithDate],
            });
        });
    });

    return Array.from(groups.values())
        .map((group) => {
            const sortedEvents = [...group.events].sort(
                (left, right) => eventDateValue(left.dateKey, left.time) - eventDateValue(right.dateKey, right.time)
            );
            const arrivedCount = sortedEvents.filter((event) => arrivedSet.has(event.id)).length;
            const titleSet = Array.from(new Set(sortedEvents.map((event) => event.title).filter(Boolean)));
            const nextEvent = sortedEvents[0] || null;

            return {
                key: group.key,
                location: group.location,
                events: sortedEvents,
                nextEvent,
                eventCount: sortedEvents.length,
                arrivedCount,
                title: titleSet.length === 1
                    ? titleSet[0]
                    : group.location?.address?.split(" ").slice(-2).join(" ") || "일정 장소",
            };
        })
        .sort(
            (left, right) =>
                eventDateValue(left.nextEvent?.dateKey, left.nextEvent?.time)
                - eventDateValue(right.nextEvent?.dateKey, right.nextEvent?.time)
        );
}

function LocationMapView({
    events,
    childPos,
    mapReady,
    arrivedSet,
    locationHint = "",
    savedPlaces = [],
    isParentMode = false,
    savedPlacesLocked = false,
    onAddSavedPlace,
}) {
    const mapRef = useRef();
    const mapObj = useRef();
    const markersRef = useRef([]);
    const myMarkerRef = useRef();
    const [selected, setSelected] = useState(null);

    const savedPlaceItems = useMemo(() => buildSavedPlaceItems(savedPlaces), [savedPlaces]);
    const savedPlaceKeys = useMemo(
        () => new Set(savedPlaceItems.map((place) => getPlaceLocationKey(place.location)).filter(Boolean)),
        [savedPlaceItems]
    );
    const eventPlaceItems = useMemo(
        () => buildEventPlaceItems(events, savedPlaceKeys, arrivedSet),
        [arrivedSet, events, savedPlaceKeys]
    );
    const center = childPos || (eventPlaceItems[0]?.location) || (savedPlaceItems[0]?.location) || { lat: 37.5665, lng: 126.9780 };
    const distLabel = (meters) => (meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`);

    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        if (!mapObj.current) {
            mapObj.current = new window.kakao.maps.Map(mapRef.current, {
                center: new window.kakao.maps.LatLng(center.lat, center.lng),
                level: 5
            });
        } else {
            mapObj.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
        }
        mapObj.current.relayout();

        // Clear old markers
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        if (myMarkerRef.current) { myMarkerRef.current.setMap(null); myMarkerRef.current = null; }

        // My location marker (blue dot)
        if (childPos) {
            const myOverlay = new window.kakao.maps.CustomOverlay({
                position: new window.kakao.maps.LatLng(childPos.lat, childPos.lng),
                content: '<div style="width:18px;height:18px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.5)"></div>',
                yAnchor: 0.5, xAnchor: 0.5
            });
            myOverlay.setMap(mapObj.current);
            myMarkerRef.current = myOverlay;
        }

        // Event location markers
        const bounds = new window.kakao.maps.LatLngBounds();
        let boundCount = 0;
        if (childPos) {
            bounds.extend(new window.kakao.maps.LatLng(childPos.lat, childPos.lng));
            boundCount += 1;
        }

        eventPlaceItems.forEach((place) => {
            const pos = new window.kakao.maps.LatLng(place.location.lat, place.location.lng);
            bounds.extend(pos);
            boundCount += 1;

            const nextEvent = place.nextEvent;
            const arrived = place.arrivedCount > 0 && place.arrivedCount === place.eventCount;
            const overlay = new window.kakao.maps.CustomOverlay({
                position: pos,
                content: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" data-marker-key="event:${place.key}">
                    <div style="background:${arrived ? '#059669' : nextEvent?.color || '#E879A0'};color:white;padding:6px 10px;border-radius:14px;font-size:12px;font-weight:800;box-shadow:0 3px 12px rgba(0,0,0,0.2);white-space:nowrap;font-family:'Noto Sans KR',sans-serif">
                        ${escHtml(nextEvent?.emoji || '📍')} ${escHtml(place.title)}${place.eventCount > 1 ? ` · ${place.eventCount}` : ''}${arrived ? ' ✅' : ''}
                    </div>
                    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${arrived ? '#059669' : nextEvent?.color || '#E879A0'}"></div>
                </div>`,
                yAnchor: 1.3, xAnchor: 0.5
            });
            overlay.setMap(mapObj.current);
            markersRef.current.push(overlay);
        });

        savedPlaceItems.forEach((place) => {
            const pos = new window.kakao.maps.LatLng(place.location.lat, place.location.lng);
            bounds.extend(pos);
            boundCount += 1;

            const overlay = new window.kakao.maps.CustomOverlay({
                position: pos,
                content: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" data-marker-key="saved:${place.id}">
                    <div style="background:#BE185D;color:white;padding:6px 10px;border-radius:14px;font-size:12px;font-weight:800;box-shadow:0 3px 12px rgba(190,24,93,0.25);white-space:nowrap;font-family:'Noto Sans KR',sans-serif">
                        📍 ${escHtml(place.name)}
                    </div>
                    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #BE185D"></div>
                </div>`,
                yAnchor: 1.3,
                xAnchor: 0.5,
            });
            overlay.setMap(mapObj.current);
            markersRef.current.push(overlay);
        });

        if (boundCount > 0) {
            mapObj.current.setBounds(bounds, 60);
        }
    }, [mapReady, childPos, eventPlaceItems, savedPlaceItems, center.lat, center.lng]);

    // Handle click on overlay via map container click delegation
    useEffect(() => {
        const mapEl = mapRef.current;
        if (!mapEl) return;
        const handler = (e) => {
            const target = e.target.closest('[data-marker-key]');
            if (target) {
                const id = target.dataset.markerKey;
                setSelected(prev => prev === id ? null : id);
            }
        };
        mapEl.addEventListener('click', handler);
        return () => mapEl.removeEventListener('click', handler);
    }, []);

    const selectedEventPlace = selected?.startsWith("event:") ? eventPlaceItems.find((place) => `event:${place.key}` === selected) : null;
    const selectedPlace = selected?.startsWith("saved:") ? savedPlaceItems.find(place => `saved:${place.id}` === selected) : null;
    const focusLocation = (key, location) => {
        setSelected(key);
        if (mapObj.current && location?.lat && location?.lng) {
            mapObj.current.setCenter(new window.kakao.maps.LatLng(location.lat, location.lng));
            mapObj.current.setLevel(3);
        }
    };

    return (
        <div style={{ width: "100%", maxWidth: 420, marginBottom: 0 }}>
            {/* Map */}
            <div style={{ width: "100%", height: 300, borderRadius: 24, overflow: "hidden", boxShadow: "0 4px 12px rgba(180,120,150,0.10)", marginBottom: 14, position: "relative", background: DESIGN.gradients.map, border: "2px solid rgba(255,228,239,0.8)" }}>
                {!mapReady && (
                    <FallbackMapCanvas
                        center={center}
                        children={childPos ? [{ ...childPos, name: "내 위치", emoji: "🐰", color: DESIGN.colors.pink }] : []}
                        eventPlaces={eventPlaceItems.map(place => ({ ...place, key: `event:${place.key}` }))}
                        savedPlaces={savedPlaceItems.map(place => ({ ...place, key: `saved:${place.id}` }))}
                        selectedKey={selected || ""}
                        onSelect={(marker) => setSelected(marker.key)}
                        title="아이 위치 · 안전"
                        subtitle={KAKAO_APP_KEY ? "Kakao 지도 연결 중" : "Kakao 지도 키가 없어 간이 지도 표시"}
                        showRadius={Boolean(childPos)}
                    />
                )}
                <div ref={mapRef} style={{ width: "100%", height: "100%", display: mapReady ? "block" : "none" }} />
                {mapReady && <MapZoomControls mapObj={mapObj} />}
                {childPos && (
                    <div style={{ position: "absolute", top: 12, left: 12, background: "white", borderRadius: 999, padding: "8px 14px", fontSize: 11, fontWeight: 800, color: DESIGN.colors.ink, boxShadow: "0 6px 20px rgba(180,120,150,0.15)", fontFamily: FF, display: mapReady ? "flex" : "none", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 0 3px rgba(16,185,129,0.25)" }} /> 실시간
                    </div>
                )}
                <div style={{ position: "absolute", top: 12, right: 12, background: "white", borderRadius: 999, padding: "8px 12px", fontSize: 11, fontWeight: 800, color: DESIGN.colors.inkSoft, boxShadow: "0 6px 20px rgba(180,120,150,0.15)", fontFamily: FF, display: mapReady ? "block" : "none" }}>
                    📍 {eventPlaceItems.length + savedPlaceItems.length}개 장소
                </div>
                {isParentMode && (
                    <button
                        type="button"
                        aria-label="📍 장소 추가"
                        onClick={onAddSavedPlace}
                        style={{
                            position: "absolute",
                            right: 14,
                            bottom: 14,
                            width: 52,
                            height: 52,
                            borderRadius: 18,
                            border: "none",
                            background: "linear-gradient(135deg,#F472B6,#DB2777)",
                            color: "white",
                            fontSize: 28,
                            fontWeight: 900,
                            cursor: "pointer",
                            boxShadow: "0 12px 24px rgba(219,39,119,0.24)",
                            fontFamily: FF,
                        }}
                    >
                        +
                    </button>
                )}
            </div>

            {/* Selected card */}
            {selectedEventPlace && (
                <div style={{ background: selectedEventPlace.nextEvent?.bg || "#FDF2F8", borderRadius: 20, padding: 16, marginBottom: 12, borderLeft: `4px solid ${selectedEventPlace.nextEvent?.color || "#DB2777"}`, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ fontSize: 28 }}>{selectedEventPlace.nextEvent?.emoji || "📍"}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: "#1F2937", fontFamily: FF }}>{selectedEventPlace.title}</div>
                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, fontFamily: FF }}>
                                일정 {selectedEventPlace.eventCount}개
                                {selectedEventPlace.nextEvent ? ` · 다음 ${selectedEventPlace.nextEvent.time}` : ""}
                            </div>
                            <div style={{ fontSize: 12, color: selectedEventPlace.nextEvent?.color || "#BE185D", marginTop: 3, fontWeight: 600, fontFamily: FF }}>📍 {selectedEventPlace.location.address}</div>
                            {selectedEventPlace.events.slice(0, 2).map((event) => (
                                <div key={event.id} style={{ fontSize: 11, color: "#6B7280", marginTop: 4, fontFamily: FF }}>
                                    • {event.time}{event.endTime ? ` ~ ${event.endTime}` : ""} {event.title}
                                </div>
                            ))}
                            {selectedEventPlace.eventCount > 2 && (
                                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4, fontFamily: FF }}>
                                    외 {selectedEventPlace.eventCount - 2}개 일정
                                </div>
                            )}
                        </div>
                        {selectedEventPlace.arrivedCount > 0
                            ? <span style={{ fontSize: 12, padding: "6px 12px", borderRadius: 12, background: "#D1FAE5", color: "#065F46", fontWeight: 700, fontFamily: FF }}>✅ {selectedEventPlace.arrivedCount}개 도착</span>
                            : <span style={{ fontSize: 12, padding: "6px 12px", borderRadius: 12, background: "#FEF3C7", color: "#92400E", fontWeight: 700, fontFamily: FF }}>대기</span>}
                    </div>
                </div>
            )}
            {selectedPlace && (
                <div style={{ background: "#FFF0F7", borderRadius: 20, padding: 16, marginBottom: 12, borderLeft: "4px solid #BE185D", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ fontSize: 28 }}>📍</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: "#1F2937", fontFamily: FF }}>{selectedPlace.name}</div>
                            <div style={{ fontSize: 12, color: "#BE185D", marginTop: 3, fontWeight: 600, fontFamily: FF }}>{selectedPlace.location.address}</div>
                            {childPos && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4, fontFamily: FF }}>현재 위치에서 {distLabel(haversineM(childPos.lat, childPos.lng, selectedPlace.location.lat, selectedPlace.location.lng))}</div>}
                        </div>
                        <span style={{ fontSize: 12, padding: "6px 12px", borderRadius: 12, background: "#FCE7F3", color: "#9D174D", fontWeight: 700, fontFamily: FF }}>저장됨</span>
                    </div>
                </div>
            )}

            {/* Card list */}
            <div style={{ background: "white", borderRadius: 24, boxShadow: "0 8px 32px rgba(232,121,160,0.12)", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#374151", fontFamily: FF }}>📍 등록된 장소</div>
                    {isParentMode && (
                        <button
                            type="button"
                            aria-label="📍 자주 가는 장소 추가"
                            onClick={onAddSavedPlace}
                            style={{ border: "none", borderRadius: 14, padding: "8px 12px", background: "linear-gradient(135deg,#F472B6,#DB2777)", color: "white", fontWeight: 800, cursor: "pointer", fontFamily: FF, fontSize: 12 }}
                        >
                            + 자주 가는 장소
                        </button>
                    )}
                </div>
                {isParentMode && savedPlacesLocked && (
                    <div style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 14, padding: "10px 12px", fontSize: 12, fontWeight: 700, marginBottom: 12, fontFamily: FF }}>
                        유료계정은 자주가는 장소를 무제한 등록할 수 있어요
                    </div>
                )}
                {!childPos && locationHint && (
                    <div style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 14, padding: "10px 12px", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                        {locationHint}
                    </div>
                )}
                {savedPlaceItems.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#BE185D", marginBottom: 8, fontFamily: FF }}>자주 가는 장소</div>
                        {savedPlaceItems.map((place) => (
                            <div
                                key={place.id}
                                onClick={() => focusLocation(`saved:${place.id}`, place.location)}
                                style={{
                                    display: "flex", gap: 10, alignItems: "center", padding: "12px", borderRadius: 16, marginBottom: 8, cursor: "pointer", fontFamily: FF,
                                    background: selected === `saved:${place.id}` ? "#FFF0F7" : "#FDF2F8", borderLeft: "3px solid #DB2777",
                                    transition: "all 0.15s",
                                }}
                            >
                                <div style={{ fontSize: 22 }}>📍</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1F2937" }}>{place.name}</div>
                                    <div style={{ fontSize: 11, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {place.location.address}</div>
                                </div>
                                {childPos && <div style={{ fontSize: 11, color: "#BE185D", fontWeight: 700, flexShrink: 0 }}>{distLabel(haversineM(childPos.lat, childPos.lng, place.location.lat, place.location.lng))}</div>}
                            </div>
                        ))}
                    </div>
                )}
                {eventPlaceItems.length > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7280", marginBottom: 8, fontFamily: FF }}>일정 장소</div>
                )}
                {eventPlaceItems.length === 0 && savedPlaceItems.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#D1D5DB", fontFamily: FF }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🗺️</div>
                        <div style={{ fontSize: 14 }}>등록된 장소가 없어요</div>
                    </div>
                ) : eventPlaceItems.map((place) => (
                    <div key={place.key}
                        onClick={() => {
                            focusLocation(`event:${place.key}`, place.location);
                        }}
                        style={{
                            display: "flex", gap: 10, alignItems: "center", padding: "12px", borderRadius: 16, marginBottom: 8, cursor: "pointer", fontFamily: FF,
                            background: selected === `event:${place.key}` ? (place.nextEvent?.bg || "#FDF2F8") : "#F9FAFB", borderLeft: `3px solid ${place.nextEvent?.color || "#DB2777"}`,
                            transition: "all 0.15s"
                        }}>
                        <div style={{ fontSize: 22 }}>{place.nextEvent?.emoji || "📍"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#1F2937" }}>{place.title}</div>
                            <div style={{ fontSize: 11, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {place.location.address}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, flexShrink: 0 }}>
                            {place.eventCount}개 일정
                            {place.nextEvent ? ` · ${place.nextEvent.time}` : ""}
                        </div>
                        {place.arrivedCount > 0 ? <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>✅</span> : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Child Tracker Overlay (학부모용 - 아이 실시간 위치)
// ─────────────────────────────────────────────────────────────────────────────
// AI Schedule Modal — 음성/이미지/텍스트로 일정 자동 등록
// ─────────────────────────────────────────────────────────────────────────────
function AiScheduleModal({ academies, currentDate, familyId, authUser, events, onSave, onClose, startVoiceFn, onNavigateDate }) {
    const [inputText, setInputText] = useState("");
    const [imageData, setImageData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [voiceListening, setVoiceListening] = useState(false);
    const [results, setResults] = useState(null);
    const [savedIds, setSavedIds] = useState(new Set());
    const fileInputRef = useRef(null);

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith("image/")) {
                e.preventDefault();
                const file = item.getAsFile();
                const reader = new FileReader();
                reader.onload = () => setImageData(reader.result);
                reader.readAsDataURL(file);
                return;
            }
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setImageData(reader.result);
        reader.readAsDataURL(file);
    };

    // Voice input using Web Speech API
    const startVoiceInput = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            // Fallback: use the parent's startVoice function
            if (startVoiceFn) { onClose(); startVoiceFn(); }
            return;
        }
        const recognition = new SR();
        recognition.lang = "ko-KR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        setVoiceListening(true);
        recognition.onresult = (e) => {
            const transcript = e.results[0]?.[0]?.transcript || "";
            setInputText(prev => prev ? prev + "\n" + transcript : transcript);
            setVoiceListening(false);
        };
        recognition.onerror = () => setVoiceListening(false);
        recognition.onend = () => setVoiceListening(false);
        recognition.start();
    };

    const analyze = async (text, image) => {
        const t = text || inputText.trim();
        const img = image || imageData;
        if (!t && !img) return;
        setLoading(true);
        setResults(null);
        try {
            const session = await getSession();
            const token = session?.access_token || SUPABASE_KEY;
            const url = `${SUPABASE_URL}/functions/v1/ai-voice-parse`;
            const todayEvs = (events || []).map(e => ({ id: e.id, title: e.title, time: e.time, memo: e.memo || "" }));
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": SUPABASE_KEY },
                body: JSON.stringify({
                    text: t || "이미지에서 일정을 추출해주세요",
                    image: img || undefined,
                    mode: "paste",
                    academies: academies.map(a => ({ name: a.name, category: a.category })),
                    todayEvents: todayEvs,
                    currentDate,
                }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data.action === "add_events" && data.events?.length > 0) {
                setResults(data);
            } else if (data.action === "add_event") {
                setResults({ action: "add_events", events: [data] });
            } else {
                setResults({ action: "unknown", message: data.message || "일정을 찾지 못했어요" });
            }
        } catch (err) {
            console.error("[AiSchedule]", err);
            setResults({ action: "unknown", message: "AI 분석 실패: " + err.message });
        } finally { setLoading(false); }
    };

    const CATS = { school: { emoji: "📚", color: "#A78BFA", bg: "#EDE9FE" }, sports: { emoji: "⚽", color: "#34D399", bg: "#D1FAE5" }, hobby: { emoji: "🎨", color: "#F59E0B", bg: "#FEF3C7" }, family: { emoji: "👨‍👩‍👧", color: "#F87171", bg: "#FEE2E2" }, friend: { emoji: "👫", color: "#60A5FA", bg: "#DBEAFE" }, other: { emoji: "📌", color: "#EC4899", bg: "#FCE7F3" } };

    const saveOne = async (ev, idx) => {
        if (savedIds.has(idx)) return;
        const cat = CATS[ev.category] || CATS.other;
        const matchedAcademy = ev.academyName ? academies.find(a => a.name === ev.academyName) : null;
        const safeTime = (ev.time && ev.time !== "null") ? ev.time : "09:00";
        const safeMemo = (ev.memo && ev.memo !== "null") ? ev.memo : "";
        const newEv = {
            id: generateUUID(), title: ev.title, time: safeTime,
            category: ev.category || "other", emoji: matchedAcademy?.emoji || cat.emoji,
            color: cat.color, bg: cat.bg, memo: safeMemo,
            location: matchedAcademy?.location || null, notifOverride: null,
        };
        const dk = `${ev.year ?? currentDate.year}-${ev.month ?? currentDate.month}-${ev.day ?? currentDate.day}`;
        onSave(newEv, dk);
        if (familyId && authUser) {
            try {
                await insertEvent(newEv, familyId, dk, authUser.id);
                const m = (ev.month ?? currentDate.month) + 1;
                const d = ev.day ?? currentDate.day;
                sendInstantPush({
                    action: "new_event", familyId, senderUserId: authUser.id,
                    title: `🤖 새 일정: ${newEv.emoji} ${ev.title}`,
                    message: `${m}월 ${d}일 ${newEv.time}에 "${ev.title}" 일정이 추가됐어요 (AI)`,
                });
            } catch (err) { console.error("[AiSchedule] save error:", err); }
        }
        setSavedIds(prev => new Set([...prev, idx]));
    };

    const saveAll = async () => {
        if (!results?.events) return;
        for (let i = 0; i < results.events.length; i++) {
            if (!savedIds.has(i)) await saveOne(results.events[i], i);
        }
        // 저장 후 모달 닫기 + 첫 번째 일정의 날짜로 이동
        const first = results.events[0];
        if (first && onNavigateDate) {
            onNavigateDate(first.year ?? currentDate.year, first.month ?? currentDate.month, first.day ?? currentDate.day);
        }
        onClose();
    };

    const btnSt = { width: 64, height: 64, borderRadius: 20, border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontFamily: FF, fontWeight: 700, fontSize: 10 };

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={makeSheetStyle({ padding: "24px 20px 32px", width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto" })}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#374151" }}>🤖 AI로 일정입력</div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>닫기</button>
                </div>

                {/* 3가지 입력 방식 버튼 */}
                {!results && !loading && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 }}>
                        <button onClick={startVoiceInput}
                            style={{ ...btnSt, background: voiceListening ? "#E879A0" : "linear-gradient(135deg,#F9A8D4,#E879A0)", color: "white", boxShadow: "0 4px 12px rgba(232,121,160,0.3)", animation: voiceListening ? "pulse 1s infinite" : "none" }}>
                            <span style={{ fontSize: 24 }}>🎤</span>
                            {voiceListening ? "듣는 중..." : "음성"}
                        </button>
                        <button onClick={() => fileInputRef.current?.click()}
                            style={{ ...btnSt, background: "linear-gradient(135deg,#93C5FD,#3B82F6)", color: "white", boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}>
                            <span style={{ fontSize: 24 }}>📷</span>
                            이미지
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} style={{ display: "none" }} />
                        <button onClick={() => document.getElementById("ai-text-input")?.focus()}
                            style={{ ...btnSt, background: DESIGN.gradients.primary, color: "white", boxShadow: "0 4px 12px rgba(190,24,93,0.22)" }}>
                            <span style={{ fontSize: 24 }}>✏️</span>
                            텍스트
                        </button>
                    </div>
                )}

                {/* 텍스트 입력 */}
                <textarea id="ai-text-input"
                    value={inputText} onChange={e => setInputText(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="카톡 공지, 알림장 등을 붙여넣거나 직접 입력하세요..."
                    style={{ width: "100%", minHeight: 80, padding: 12, borderRadius: 14, border: "2px solid #E5E7EB", fontSize: 14, fontFamily: FF, resize: "none", boxSizing: "border-box", outline: "none" }}
                />

                {/* 이미지 미리보기 */}
                {imageData && (
                    <div style={{ marginTop: 8, position: "relative", display: "inline-block" }}>
                        <img src={imageData} alt="첨부 이미지" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 12, border: "2px solid #E5E7EB" }} />
                        <button onClick={() => setImageData(null)} style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", background: "#EF4444", color: "white", border: "none", fontSize: 12, cursor: "pointer", fontWeight: 800 }}>✕</button>
                    </div>
                )}

                {/* 분석 버튼 */}
                <button onClick={() => analyze()} disabled={loading || (!inputText.trim() && !imageData)}
                    style={{ width: "100%", marginTop: 10, padding: "14px 16px", borderRadius: 16, border: "none", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: FF, color: "white", background: loading ? "#9CA3AF" : DESIGN.gradients.primary, boxShadow: loading ? "none" : "0 4px 16px rgba(190,24,93,0.22)" }}>
                    {loading ? "🔍 AI가 분석하고 있어요..." : "✅ 다 입력했어요^^"}
                </button>

                {/* Results */}
                {results && results.action === "add_events" && results.events?.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>📋 추출된 일정 ({results.events.length}건)</div>
                            <button onClick={saveAll} style={{ padding: "6px 14px", borderRadius: 12, background: "#059669", color: "white", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>모두 등록</button>
                        </div>
                        {results.events.map((ev, i) => {
                            const cat = CATS[ev.category] || CATS.other;
                            const saved = savedIds.has(i);
                            const m = ev.month != null ? ev.month + 1 : (currentDate.month + 1);
                            const d = ev.day ?? currentDate.day;
                            return (
                                <div key={i} style={{ background: saved ? "#F0FDF4" : cat.bg, borderRadius: 16, padding: "12px 14px", marginBottom: 8, border: saved ? "2px solid #6EE7B7" : `1.5px solid #E5E7EB`, opacity: saved ? 0.7 : 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 24 }}>{cat.emoji}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 800, fontSize: 14, color: "#1F2937" }}>{ev.title}</div>
                                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                                                {m}월 {d}일 {(ev.time && ev.time !== "null") ? ev.time : "시간 미정"}
                                                {ev.memo && ev.memo !== "null" && ` · ${ev.memo}`}
                                            </div>
                                        </div>
                                        <button onClick={async () => {
                                            await saveOne(ev, i);
                                            if (onNavigateDate) onNavigateDate(ev.year ?? currentDate.year, ev.month ?? currentDate.month, ev.day ?? currentDate.day);
                                            onClose();
                                        }} disabled={saved}
                                            style={{ padding: "6px 12px", borderRadius: 10, background: saved ? "#D1FAE5" : cat.color, color: saved ? "#065F46" : "white", border: "none", fontSize: 11, fontWeight: 800, cursor: saved ? "default" : "pointer", fontFamily: FF, flexShrink: 0 }}>
                                            {saved ? "✓" : "등록"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {results && results.action === "unknown" && (
                    <div style={{ marginTop: 16, textAlign: "center", padding: 20, background: "#FEF3C7", borderRadius: 16 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🤔</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>{results.message}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Danger Zone Manager — 위험지역 설정 및 관리
// ─────────────────────────────────────────────────────────────────────────────
function DangerZoneManager({ zones, familyId: _familyId, mapReady, onAdd, onDelete, onClose }) {
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState("");
    const [newRadius, setNewRadius] = useState(200);
    const [newType, setNewType] = useState("custom");
    const [selectedLoc, setSelectedLoc] = useState(null);
    const mapRef = useRef();
    const mapInst = useRef();
    const circleRef = useRef(null);
    const newRadiusRef = useRef(newRadius);

    const ZONE_TYPES = [
        { id: "construction", label: "🚧 공사장", color: "#F59E0B" },
        { id: "entertainment", label: "🎰 유흥가", color: "#EF4444" },
        { id: "water", label: "🌊 수변지역", color: "#3B82F6" },
        { id: "custom", label: "📍 직접 설정", color: "#6B7280" },
    ];

    const zoneColor = (type) => ZONE_TYPES.find(z => z.id === type)?.color || "#6B7280";

    useEffect(() => {
        newRadiusRef.current = newRadius;
    }, [newRadius]);

    // Map for adding new zone
    useEffect(() => {
        if (!showAdd || !mapReady || !mapRef.current || mapInst.current) return;
        const center = new window.kakao.maps.LatLng(37.5665, 126.9780);
        const map = new window.kakao.maps.Map(mapRef.current, { center, level: 5 });
        mapInst.current = map;

        window.kakao.maps.event.addListener(map, "click", (e) => {
            const lat = e.latLng.getLat();
            const lng = e.latLng.getLng();
            setSelectedLoc({ lat, lng });
            if (circleRef.current) circleRef.current.setMap(null);
            circleRef.current = new window.kakao.maps.Circle({
                map, center: e.latLng, radius: newRadiusRef.current,
                strokeWeight: 3, strokeColor: "#EF4444", strokeOpacity: 0.8,
                fillColor: "#EF4444", fillOpacity: 0.15
            });
        });
    }, [showAdd, mapReady]);

    // Update circle radius
    useEffect(() => {
        if (circleRef.current && selectedLoc) {
            circleRef.current.setRadius(newRadius);
        }
    }, [newRadius, selectedLoc]);

    const handleAdd = async () => {
        if (!newName.trim() || !selectedLoc) return;
        try {
            await onAdd({ name: newName.trim(), lat: selectedLoc.lat, lng: selectedLoc.lng, radius_m: newRadius, zone_type: newType });
            setShowAdd(false);
            setNewName("");
            setSelectedLoc(null);
            if (circleRef.current) { circleRef.current.setMap(null); circleRef.current = null; }
            mapInst.current = null;
        } catch (err) { console.error("[DangerZone] add error:", err); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={makeSheetStyle({ padding: "24px 20px 32px", width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto" })}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#374151" }}>⚠️ 위험지역 관리</div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>닫기</button>
                </div>

                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>아이가 설정한 지역에 접근하면 알림을 받습니다.</div>

                {/* Zone list */}
                {zones.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#D1D5DB" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🛡️</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>설정된 위험지역이 없어요</div>
                    </div>
                ) : zones.map(z => (
                    <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#FEF2F2", borderRadius: 16, marginBottom: 8, border: "1.5px solid #FECACA" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: zoneColor(z.zone_type), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "white", fontWeight: 800, flexShrink: 0 }}>
                            {z.zone_type === "construction" ? "🚧" : z.zone_type === "entertainment" ? "🎰" : z.zone_type === "water" ? "🌊" : "⚠️"}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "#1F2937" }}>{z.name}</div>
                            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>반경 {z.radius_m}m</div>
                        </div>
                        <button onClick={() => { if (window.confirm(`"${z.name}" 위험지역을 삭제할까요?`)) onDelete(z.id); }}
                            style={{ padding: "6px 10px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>삭제</button>
                    </div>
                ))}

                {/* Add new zone */}
                {!showAdd ? (
                    <button onClick={() => setShowAdd(true)}
                        style={{ width: "100%", marginTop: 12, padding: "14px", borderRadius: 16, border: "2px dashed #D1D5DB", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#6B7280", fontFamily: FF }}>
                        + 위험지역 추가
                    </button>
                ) : (
                    <div style={{ marginTop: 12, background: "#F9FAFB", borderRadius: 20, padding: 16, border: "1.5px solid #E5E7EB" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#374151", marginBottom: 12 }}>새 위험지역 추가</div>

                        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="지역 이름 (예: 공사장 앞)"
                            style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "2px solid #E5E7EB", fontSize: 14, fontWeight: 700, fontFamily: FF, boxSizing: "border-box", marginBottom: 10 }} />

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                            {ZONE_TYPES.map(zt => (
                                <button key={zt.id} onClick={() => setNewType(zt.id)}
                                    style={{ padding: "6px 12px", borderRadius: 10, border: newType === zt.id ? `2px solid ${zt.color}` : "1.5px solid #E5E7EB", background: newType === zt.id ? zt.color + "15" : "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: newType === zt.id ? zt.color : "#6B7280" }}>
                                    {zt.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>반경: {newRadius}m</div>
                        <input type="range" min={50} max={500} step={50} value={newRadius} onChange={e => setNewRadius(Number(e.target.value))}
                            style={{ width: "100%", marginBottom: 12 }} />

                        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>지도를 클릭해서 위치를 선택하세요</div>
                        <div ref={mapRef} style={{ width: "100%", height: 200, borderRadius: 16, overflow: "hidden", border: "2px solid #E5E7EB", marginBottom: 12 }} />

                        {selectedLoc && <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginBottom: 8 }}>✓ 위치 선택됨 ({selectedLoc.lat.toFixed(4)}, {selectedLoc.lng.toFixed(4)})</div>}

                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={handleAdd} disabled={!newName.trim() || !selectedLoc}
                                style={{ flex: 1, padding: "12px", borderRadius: 14, border: "none", background: !newName.trim() || !selectedLoc ? "#D1D5DB" : "#EF4444", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                                ⚠️ 위험지역 등록
                            </button>
                            <button onClick={() => { setShowAdd(false); mapInst.current = null; }}
                                style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid #E5E7EB", background: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#6B7280" }}>취소</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Phone Settings Modal (parent)
// ─────────────────────────────────────────────────────────────────────────────
function PhoneSettingsModal({ phones, onSave, onClose }) {
    const [mom, setMom] = useState(phones.mom || "");
    const [dad, setDad] = useState(phones.dad || "");
    const inputSt = makeInputStyle({ padding: "14px 16px", fontSize: 16, letterSpacing: 1 });
    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
            <div style={makeCardStyle({ padding: "28px 24px", width: "100%", maxWidth: 360 })} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#374151", textAlign: "center", marginBottom: 20 }}>📞 비상 연락처 설정</div>
                <div style={{ fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 20 }}>아이 화면에서 바로 전화할 수 있어요</div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E879A0", marginBottom: 6 }}>👩 엄마 전화번호</div>
                    <input value={mom} onChange={e => setMom(e.target.value)} placeholder="010-0000-0000" type="tel" style={inputSt}
                        onFocus={e => { e.target.style.borderColor = "#E879A0"; }} onBlur={e => { e.target.style.borderColor = "#F3F4F6"; }} />
                </div>

                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6", marginBottom: 6 }}>👨 아빠 전화번호</div>
                    <input value={dad} onChange={e => setDad(e.target.value)} placeholder="010-0000-0000" type="tel" style={inputSt}
                        onFocus={e => { e.target.style.borderColor = "#3B82F6"; }} onBlur={e => { e.target.style.borderColor = "#F3F4F6"; }} />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "#F3F4F6", color: "#6B7280", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>취소</button>
                    <button onClick={() => onSave({ mom: mom.trim(), dad: dad.trim() })} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>저장</button>
                </div>
            </div>
        </div>
    );
}

function SavedPlaceManager({ places, onSave, onClose, currentPos }) {
    const [list, setList] = useState(places);
    const [showForm, setShowForm] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [editIdx, setEditIdx] = useState(null);
    const [form, setForm] = useState({ name: "", location: null });

    const openNew = () => {
        setForm({ name: "", location: null });
        setEditIdx(null);
        setShowForm(true);
    };
    const openEdit = (idx) => {
        setForm({ ...list[idx] });
        setEditIdx(idx);
        setShowForm(true);
    };
    const saveForm = () => {
        if (!form.name.trim() || !form.location?.address) return;
        const item = { ...form, id: form.id || generateUUID(), name: form.name.trim() };
        if (editIdx !== null) {
            const nextList = [...list];
            nextList[editIdx] = item;
            setList(nextList);
        } else {
            setList((prev) => [...prev, item]);
        }
        setShowForm(false);
    };
    const removeItem = (idx) => setList((prev) => prev.filter((_, index) => index !== idx));

    if (showMap) return (
        <MapPicker
            initial={form.location}
            currentPos={currentPos}
            title="📍 자주 가는 장소 설정"
            onClose={() => setShowMap(false)}
            onConfirm={(loc) => {
                setForm((prev) => ({
                    ...prev,
                    location: loc,
                    name: prev.name.trim() ? prev.name : (loc.address || "").split(" ").slice(-1)[0] || "자주 가는 장소",
                }));
                setShowMap(false);
            }}
        />
    );

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "white", display: "flex", flexDirection: "column", fontFamily: FF }}>
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => { onSave(list); onClose(); }} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: FF }}>← 저장</button>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#374151" }}>📍 자주 가는 장소</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                {!showForm && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 10 }}>빠른 추가</div>
                        <button
                            onClick={openNew}
                            style={{ padding: "10px 14px", borderRadius: 16, border: "2px dashed #F9A8D4", background: "#FFF0F7", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#E879A0" }}
                        >
                            + 장소 직접 추가
                        </button>
                    </div>
                )}

                {showForm && (
                    <div style={{ background: "#FAFAFA", borderRadius: 20, padding: 18, marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#374151", marginBottom: 14 }}>{editIdx !== null ? "✏️ 장소 수정" : "➕ 장소 추가"}</div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>장소 이름</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="예) 할머니 집, 피아노 학원, 도서관"
                                style={{ width: "100%", padding: "12px 14px", border: "2px solid #F3F4F6", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", boxSizing: "border-box" }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>📍 위치</label>
                            {form.location ? (
                                <div style={{ background: "#FFF0F7", borderRadius: 14, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 13, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {form.location.address}</div>
                                    <button onClick={() => setShowMap(true)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid #E879A0", color: "#E879A0", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowMap(true)} style={{ width: "100%", padding: 12, border: "2px dashed #F9A8D4", borderRadius: 14, background: "#FFF0F7", color: "#E879A0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                                    🗺️ 지도에서 장소 선택
                                </button>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveForm} style={{ flex: 1, padding: 13, background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>저장</button>
                            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: 13, background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 16, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>취소</button>
                        </div>
                    </div>
                )}

                <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 10 }}>등록된 장소 ({list.length})</div>
                {list.length === 0 && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#D1D5DB" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
                        <div style={{ fontSize: 14 }}>등록된 장소가 없어요</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>자주 가는 장소를 저장해 두면 일정 입력이 빨라져요</div>
                    </div>
                )}
                {list.map((place, index) => (
                    <div key={place.id || index} style={{ background: "#FFF7FB", borderRadius: 18, padding: "14px 16px", marginBottom: 10, borderLeft: "4px solid #F472B6" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontSize: 24 }}>📍</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: "#1F2937" }}>{place.name}</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.location?.address || "위치 미등록"}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => openEdit(index)} style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, fontFamily: FF }}>✏️</button>
                                <button onClick={() => removeItem(index)} style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "#EF4444", fontFamily: FF }}>✕</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function NotificationSettingsModal({ settings, isParentMode, onSave, onClose }) {
    const roleKey = isParentMode ? "parentEnabled" : "childEnabled";
    const [draft, setDraft] = useState(() => normalizeNotifSettings(settings, DEFAULT_NOTIF));
    const enabled = draft[roleKey];

    const toggleMinute = (minute) => {
        setDraft((prev) => {
            const current = normalizeNotifSettings(prev, DEFAULT_NOTIF);
            const hasMinute = current.minutesBefore.includes(minute);
            const nextMinutes = hasMinute
                ? current.minutesBefore.filter((value) => value !== minute)
                : [...current.minutesBefore, minute];

            return normalizeNotifSettings(
                {
                    ...current,
                    minutesBefore: nextMinutes.length ? nextMinutes : current.minutesBefore,
                },
                DEFAULT_NOTIF,
            );
        });
    };

    const roleLabel = isParentMode ? "부모님" : "아이";
    const selectedSummary = draft.minutesBefore
        .map((minute) => `${minute}분 전`)
        .join(", ");

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 650, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
            <div style={{ background: "white", borderRadius: 28, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(15,23,42,0.22)" }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937", textAlign: "center", marginBottom: 8 }}>🔔 일정 알림 설정</div>
                <div style={{ fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 1.5, marginBottom: 20 }}>
                    {roleLabel} 기기에서 받을 일정 알림 시간을 고를 수 있어요.
                    <br />
                    같은 시간은 한 번만 저장돼서 중복 알림을 막아요.
                </div>

                <div style={{ padding: 14, borderRadius: 18, background: "#F9FAFB", border: "1px solid #E5E7EB", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>{roleLabel} 일정 알림 받기</div>
                            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>
                                현재 선택: {selectedSummary}
                            </div>
                        </div>
                        <button
                            type="button"
                            aria-pressed={enabled}
                            aria-label={`${roleLabel} 일정 알림 받기`}
                            onClick={() => setDraft((prev) => normalizeNotifSettings({ ...prev, [roleKey]: !prev[roleKey] }, DEFAULT_NOTIF))}
                            style={{
                                padding: "9px 14px",
                                borderRadius: 12,
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 800,
                                fontSize: 12,
                                fontFamily: FF,
                                background: enabled ? "linear-gradient(135deg,#34D399,#059669)" : "#E5E7EB",
                                color: enabled ? "white" : "#6B7280",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {enabled ? "켜짐" : "꺼짐"}
                        </button>
                    </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 10 }}>언제 미리 알려드릴까요?</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 20 }}>
                    {NOTIFICATION_MINUTE_OPTIONS.map((minute) => {
                        const selected = draft.minutesBefore.includes(minute);
                        return (
                            <button
                                key={minute}
                                type="button"
                                aria-pressed={selected}
                                aria-label={`${minute}분 전 알림`}
                                onClick={() => toggleMinute(minute)}
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: 14,
                                    border: selected ? `2px solid ${DESIGN.colors.brand}` : "1.5px solid #E5E7EB",
                                    background: selected ? DESIGN.colors.pinkSoft : "white",
                                    color: selected ? DESIGN.colors.brand : "#4B5563",
                                    cursor: "pointer",
                                    fontWeight: 800,
                                    fontSize: 13,
                                    fontFamily: FF,
                                    boxShadow: selected ? "0 8px 18px rgba(124,58,237,0.12)" : "none",
                                }}
                            >
                                {minute}분 전
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "#F3F4F6", color: "#6B7280", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>취소</button>
                    <button onClick={() => onSave(normalizeNotifSettings(draft, DEFAULT_NOTIF))} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: DESIGN.gradients.primary, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>저장</button>
                </div>
            </div>
        </div>
    );
}

function FeedbackModal({ open, value, onChange, busy, onSend, onClose }) {
    if (!open) return null;

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, zIndex: 655, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16, fontFamily: FF }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div style={makeSheetStyle({ padding: "28px 22px 34px", width: "100%", maxWidth: 420 })}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937" }}>💌 피드백 보내기</div>
                        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6, lineHeight: 1.6 }}>필요한 기능이 있으면 제안해 주세요</div>
                    </div>
                    <button onClick={onClose} style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: "#F3F4F6", color: "#6B7280", fontWeight: 700, cursor: "pointer", fontFamily: FF }}>닫기</button>
                </div>

                <textarea
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="예) 형제자매별 위치 알림 시간을 따로 설정하고 싶어요"
                    style={{ width: "100%", minHeight: 170, resize: "vertical", padding: "16px 18px", borderRadius: 20, border: "2px solid #F3E8F0", outline: "none", fontSize: 15, lineHeight: 1.6, fontFamily: FF, color: "#374151", background: "#FFF9FC", boxSizing: "border-box" }}
                />
                <div style={{ marginTop: 12, fontSize: 11, color: "#9CA3AF", lineHeight: 1.6 }}>
                    제안은 {FEEDBACK_RECIPIENT}으로 전달됩니다.
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button
                        type="button"
                        onClick={onSend}
                        disabled={busy || !value.trim()}
                        style={{ flex: 1, padding: "15px", borderRadius: 16, border: "none", background: busy || !value.trim() ? "#FBCFE8" : "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", fontWeight: 800, fontSize: 14, cursor: busy || !value.trim() ? "not-allowed" : "pointer", fontFamily: FF }}
                    >
                        {busy ? "보내는 중..." : "제안 보내기"}
                    </button>
                    <button type="button" onClick={onClose} style={{ padding: "15px 16px", borderRadius: 16, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Child Call Card (child view quick action)
// ─────────────────────────────────────────────────────────────────────────────
function ChildCallCard({ phones = {} }) {
    const cleanNumber = (num) => (num || "").replace(/[^0-9+]/g, "");
    const targets = [
        phones.mom && phones.mom.length >= 8 ? { key: "mom", label: "엄마", emoji: "👩", number: cleanNumber(phones.mom), color: "#BE185D", bg: "#FFF0F7" } : null,
        phones.dad && phones.dad.length >= 8 ? { key: "dad", label: "아빠", emoji: "👨", number: cleanNumber(phones.dad), color: "#1D4ED8", bg: "#EFF6FF" } : null,
    ].filter(Boolean);
    const hasTargets = targets.length > 0;

    return (
        <div
            aria-label={hasTargets ? "전화연결" : "등록된 전화번호 없음"}
            style={{
                minHeight: 132,
                padding: "14px",
                borderRadius: DESIGN.radius.xl,
                border: "1px solid #BBF7D0",
                background: hasTargets ? "linear-gradient(135deg,#ECFDF5,#D1FAE5)" : "#F9FAFB",
                color: hasTargets ? "#047857" : "#9CA3AF",
                boxShadow: hasTargets ? "0 12px 26px rgba(5,150,105,0.16)" : "none",
                fontFamily: FF,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 14, background: "rgba(255,255,255,0.86)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.7)" }}>📞</div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.15, color: hasTargets ? "#065F46" : "#9CA3AF" }}>전화연결</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: hasTargets ? "#059669" : "#9CA3AF", marginTop: 3 }}>
                            {hasTargets ? "엄마 · 아빠" : "연락처 없음"}
                        </div>
                    </div>
                </div>
                {hasTargets && (
                    <div style={{ padding: "5px 9px", borderRadius: 999, background: "rgba(255,255,255,0.72)", color: "#047857", fontSize: 10, fontWeight: 900, whiteSpace: "nowrap" }}>
                        바로 연결
                    </div>
                )}
            </div>
            {hasTargets ? (
                <div style={{ display: "grid", gridTemplateColumns: targets.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 10, width: "100%" }}>
                    {targets.map(target => (
                        <a
                            key={target.key}
                            href={`tel:${target.number}`}
                            aria-label={`${target.label}에게 전화`}
                            style={{
                                minHeight: 58,
                                padding: "10px 12px",
                                borderRadius: 18,
                                background: target.bg,
                                color: target.color,
                                textDecoration: "none",
                                fontSize: 15,
                                fontWeight: 900,
                                boxShadow: "0 8px 18px rgba(15,23,42,0.08), inset 0 0 0 1px rgba(255,255,255,0.9)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 7,
                                minWidth: 0,
                                boxSizing: "border-box",
                            }}
                        >
                            <span aria-hidden="true" style={{ fontSize: 21, lineHeight: 1 }}>{target.emoji}</span>
                            <span style={{ lineHeight: 1.1, wordBreak: "keep-all" }}>{target.label}</span>
                        </a>
                    ))}
                </div>
            ) : (
                <div style={{ minHeight: 58, borderRadius: 18, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13, fontWeight: 900 }}>
                    연락처 없음
                </div>
            )}
        </div>
    );
}

function ChildTrackerOverlay({ childPos, allChildPositions = [], events, mapReady, arrivedSet, onClose, locationTrail = [], locationHint = "", refreshRequestedAt = null, onRefreshLocation }) {
    const mapRef = useRef();
    const mapObj = useRef();
    const myMarkerRef = useRef();
    const childMarkersRef = useRef([]);
    const walkRadiusCircleRef = useRef(null);
    const trailPolyRef = useRef(null);
    const expectedPolyRef = useRef(null);
    const eventMarkersRef = useRef([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedChildId, setSelectedChildId] = useState(null);

    const childLocations = useMemo(() => {
        const source = allChildPositions.length > 0
            ? allChildPositions
            : (childPos ? [{ user_id: "default", name: "우리 아이", emoji: "🐰", lat: childPos.lat, lng: childPos.lng, updatedAt: childPos.updatedAt }] : []);
        return source
            .filter(child => Number.isFinite(Number(child?.lat)) && Number.isFinite(Number(child?.lng)))
            .map((child, i) => ({
                ...child,
                lat: Number(child.lat),
                lng: Number(child.lng),
                name: child.name || "우리 아이",
                emoji: child.emoji || "🐰",
                trackerKey: child.user_id || child.id || `child-${i}`,
            }));
    }, [allChildPositions, childPos]);

    const selectedChild = childLocations.find(child => child.trackerKey === selectedChildId) || childLocations[0] || null;
    const center = selectedChild || CHILD_TRACKER_DEFAULT_CENTER;
    const selectedUpdatedAt = selectedChild?.updatedAt || selectedChild?.updated_at || null;
    const selectedUpdatedMs = selectedUpdatedAt ? new Date(selectedUpdatedAt).getTime() : 0;
    const selectedLocationAgeMs = selectedUpdatedMs ? Date.now() - selectedUpdatedMs : null;
    const selectedLocationFresh = selectedLocationAgeMs != null && selectedLocationAgeMs <= 90_000;
    const selectedLocationLabel = !selectedChild
        ? "위치 수신 중"
        : selectedLocationFresh ? "방금 확인" : "마지막 저장 위치";
    const refreshPending = refreshRequestedAt && (!selectedUpdatedMs || selectedUpdatedMs < refreshRequestedAt);

    const focusChildLocation = useCallback((child, level = CHILD_TRACKER_ZOOM_LEVEL) => {
        if (!mapObj.current || !child || !Number.isFinite(child.lat) || !Number.isFinite(child.lng)) return;
        const target = new window.kakao.maps.LatLng(child.lat, child.lng);
        try {
            mapObj.current.setLevel(level, { animate: true });
        } catch {
            mapObj.current.setLevel(level);
        }
        if (typeof mapObj.current.panTo === "function") {
            mapObj.current.panTo(target);
        } else {
            mapObj.current.setCenter(target);
        }
    }, []);

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const todayLocEvents = useMemo(
        () => (events[todayKey] || []).filter(e => e.location).sort((a, b) => a.time.localeCompare(b.time)),
        [events, todayKey]
    );
    const nextEvent = todayLocEvents.find(e => {
        const [h, m] = e.time.split(":").map(Number);
        return h * 60 + m > nowMin;
    });
    const activeChildLocation = selectedChild || childPos;
    const distToNext = activeChildLocation && nextEvent?.location
        ? haversineM(activeChildLocation.lat, activeChildLocation.lng, nextEvent.location.lat, nextEvent.location.lng)
        : null;

    // 오늘 총 이동거리 (실제 이동경로 합산)
    const totalDistM = locationTrail.reduce((sum, pt, i) => {
        if (i === 0) return 0;
        return sum + haversineM(locationTrail[i - 1].lat, locationTrail[i - 1].lng, pt.lat, pt.lng);
    }, 0);

    // Effect 1: 지도 초기화 (최초 1회)
    useEffect(() => {
        if (!mapReady || !mapRef.current || mapObj.current) return;
        mapObj.current = new window.kakao.maps.Map(mapRef.current, {
            center: new window.kakao.maps.LatLng(center.lat, center.lng),
            level: CHILD_TRACKER_ZOOM_LEVEL
        });
    }, [mapReady, center.lat, center.lng]);

    // Effect 2: 아이 현재위치 마커 (다중 아이 지원)
    useEffect(() => {
        if (!mapObj.current) return;
        // 기존 마커 제거
        childMarkersRef.current.forEach(m => m.setMap(null));
        childMarkersRef.current = [];
        if (myMarkerRef.current) { myMarkerRef.current.setMap(null); myMarkerRef.current = null; }
        if (walkRadiusCircleRef.current) { walkRadiusCircleRef.current.setMap(null); walkRadiusCircleRef.current = null; }

        if (!childLocations.length) return;

        childLocations.forEach((child, i) => {
            const color = CHILD_MARKER_COLORS[i % CHILD_MARKER_COLORS.length];
            const isActive = child.trackerKey === selectedChild?.trackerKey;
            const ll = new window.kakao.maps.LatLng(child.lat, child.lng);
            const updatedLabel = child.updatedAt ? (() => { const d = new Date(child.updatedAt); return `${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`; })() : "";
            const overlay = new window.kakao.maps.CustomOverlay({
                position: ll,
                content: `<div style="display:flex;flex-direction:column;align-items:center">
                    <div style="width:${isActive ? 34 : 28}px;height:${isActive ? 34 : 28}px;background:${color};border:${isActive ? 5 : 4}px solid white;border-radius:50%;box-shadow:0 0 0 ${isActive ? 12 : 8}px ${color}33,0 3px 12px ${color}66;display:flex;align-items:center;justify-content:center;font-size:${isActive ? 16 : 14}px">${escHtml(child.emoji)}</div>
                    <div style="margin-top:4px;background:${color};color:white;padding:${isActive ? "5px 14px" : "4px 12px"};border-radius:10px;font-size:11px;font-weight:800;font-family:'Noto Sans KR',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.2);white-space:nowrap">${escHtml(child.name)}${updatedLabel ? ` · ${updatedLabel}` : ""}</div>
                </div>`,
                yAnchor: 1.8, xAnchor: 0.5, zIndex: isActive ? 20 : 10
            });
            overlay.setMap(mapObj.current);
            childMarkersRef.current.push(overlay);
        });

        if (selectedChild && window.kakao.maps.Circle) {
            walkRadiusCircleRef.current = new window.kakao.maps.Circle({
                center: new window.kakao.maps.LatLng(selectedChild.lat, selectedChild.lng),
                radius: CHILD_TRACKER_WALK_RADIUS_M,
                strokeWeight: 2,
                strokeColor: "#2563EB",
                strokeOpacity: 0.72,
                strokeStyle: "solid",
                fillColor: "#3B82F6",
                fillOpacity: 0.12,
            });
            walkRadiusCircleRef.current.setMap(mapObj.current);
        }

        focusChildLocation(selectedChild || childLocations[0]);
    }, [childLocations, selectedChild, focusChildLocation]);

    // Effect 3: 이동경로 + 예상경로 + 일정 마커 (locationTrail/events 변경 시 재드로우)
    useEffect(() => {
        if (!mapObj.current) return;

        // 기존 폴리라인/마커 제거
        if (trailPolyRef.current) { trailPolyRef.current.setMap(null); trailPolyRef.current = null; }
        if (expectedPolyRef.current) { expectedPolyRef.current.setMap(null); expectedPolyRef.current = null; }
        eventMarkersRef.current.forEach(m => m.setMap(null));
        eventMarkersRef.current = [];

        // 실제 이동경로 (파란 실선)
        if (locationTrail.length >= 2) {
            const path = locationTrail.map(pt => new window.kakao.maps.LatLng(pt.lat, pt.lng));
            trailPolyRef.current = new window.kakao.maps.Polyline({
                map: mapObj.current, path,
                strokeWeight: 5, strokeColor: "#3B82F6",
                strokeOpacity: 0.8, strokeStyle: "solid"
            });
        }

        // 예상 이동경로: 오늘 일정 장소들을 시간순으로 연결 (회색 점선)
        if (todayLocEvents.length >= 2) {
            const path = todayLocEvents.map(e => new window.kakao.maps.LatLng(e.location.lat, e.location.lng));
            expectedPolyRef.current = new window.kakao.maps.Polyline({
                map: mapObj.current, path,
                strokeWeight: 3, strokeColor: "#9CA3AF",
                strokeOpacity: 0.7, strokeStyle: "shortdash"
            });
        }

        // 일정 마커 (클릭 가능)
        todayLocEvents.forEach(ev => {
            const arrived = arrivedSet.has(ev.id);
            const bg = arrived ? "#059669" : ev.color;
            const el = document.createElement("div");
            el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer";
            const timeLabel = ev.endTime ? `${ev.time}~${ev.endTime}` : ev.time;
            el.innerHTML = `<div style="background:${bg};color:white;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.18);white-space:nowrap;font-family:'Noto Sans KR',sans-serif">${escHtml(ev.emoji)} ${escHtml(ev.title)}<span style="font-weight:600;opacity:0.85;margin-left:4px">${escHtml(timeLabel)}</span>${arrived ? " ✅" : ""}</div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg}"></div>`;
            el.addEventListener("click", () => setSelectedEvent(prev => prev?.id === ev.id ? null : ev));
            const overlay = new window.kakao.maps.CustomOverlay({
                position: new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng),
                content: el, yAnchor: 1.3, xAnchor: 0.5
            });
            overlay.setMap(mapObj.current);
            eventMarkersRef.current.push(overlay);
        });
    }, [locationTrail, todayLocEvents, arrivedSet]);

    const distLabel = (m) => m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: DESIGN.gradients.map, display: "flex", flexDirection: "column", fontFamily: FF }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: 14, padding: "10px 16px", cursor: "pointer", fontWeight: 800, fontSize: 14, fontFamily: FF, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>← 돌아가기</button>
                <div style={{ fontSize: 16, fontWeight: 800, color: DESIGN.colors.ink, flex: 1 }}>아이 위치 · 안전</div>
                {onRefreshLocation && (
                    <button
                        type="button"
                        onClick={onRefreshLocation}
                        title="현재 위치 다시 확인"
                        aria-label="현재 위치 다시 확인"
                        style={{ width: 42, height: 42, borderRadius: 14, border: "none", background: "white", color: DESIGN.colors.pinkText, fontSize: 18, fontWeight: 900, cursor: "pointer", fontFamily: FF, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", flexShrink: 0 }}
                    >
                        ↻
                    </button>
                )}
                {/* 범례 */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 20, height: 3, background: "#3B82F6", borderRadius: 2 }} />
                        <span style={{ fontSize: 10, color: "#6B7280" }}>이동</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 20, height: 3, background: "#9CA3AF", borderRadius: 2, borderTop: "2px dashed #9CA3AF" }} />
                        <span style={{ fontSize: 10, color: "#6B7280" }}>예상</span>
                    </div>
                </div>
            </div>

            {/* Map */}
            <div style={{ flex: 1, margin: "0 16px", borderRadius: 24, overflow: "hidden", boxShadow: "0 4px 20px rgba(247,121,168,0.10)", position: "relative", minHeight: 0, border: "2px solid rgba(255,228,239,0.8)" }}>
                {!mapReady && (
                    <FallbackMapCanvas
                        center={center}
                        children={childLocations.map((child, index) => ({ ...child, key: child.trackerKey, color: CHILD_MARKER_COLORS[index % CHILD_MARKER_COLORS.length] }))}
                        eventPlaces={todayLocEvents.map((event) => ({ key: event.id, title: event.title, emoji: event.emoji, color: event.color, location: event.location }))}
                        routePoints={locationTrail.length >= 2 ? locationTrail : (selectedChild && nextEvent?.location ? [selectedChild, nextEvent.location] : [])}
                        selectedKey={selectedChild?.trackerKey || ""}
                        onSelect={(marker) => {
                            if (marker.type === "child") setSelectedChildId(marker.key);
                            if (marker.type === "event") {
                                const event = todayLocEvents.find(item => item.id === marker.key);
                                if (event) setSelectedEvent(event);
                            }
                        }}
                        title="아이 위치 · 안전"
                        subtitle={KAKAO_APP_KEY ? "Kakao 지도 연결 중" : "Kakao 지도 키가 없어 간이 지도 표시"}
                        showRadius={Boolean(selectedChild)}
                    />
                )}
                <div ref={mapRef} style={{ width: "100%", height: "100%", display: mapReady ? "block" : "none" }} />
                {mapReady && <MapZoomControls mapObj={mapObj} />}
                {selectedChild && (
                    <>
                        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, background: "rgba(255,255,255,0.94)", borderRadius: 999, padding: "8px 14px", boxShadow: "0 6px 20px rgba(180,120,150,0.15)", border: "1px solid rgba(255,228,239,0.8)", maxWidth: "calc(100% - 92px)", display: mapReady ? "block" : "none" }}>
                            <div style={{ fontSize: 12, fontWeight: 900, color: DESIGN.colors.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedChild.name} · {refreshPending ? "현재 위치 확인 중" : selectedLocationLabel}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: DESIGN.colors.muted, marginTop: 2 }}>도보 확인 반경 {CHILD_TRACKER_WALK_RADIUS_M}m</div>
                        </div>
                        <button
                            type="button"
                            aria-label={`${selectedChild.name} 위치로 이동`}
                            title={`${selectedChild.name} 위치로 이동`}
                            onClick={() => focusChildLocation(selectedChild)}
                            style={{ position: "absolute", top: 12, right: 12, zIndex: 10, width: 48, height: 48, borderRadius: 16, border: "none", background: DESIGN.gradients.primary, color: "white", fontSize: 22, fontWeight: 900, cursor: "pointer", boxShadow: "0 6px 16px rgba(247,121,168,0.35)", display: mapReady ? "flex" : "none", alignItems: "center", justifyContent: "center", fontFamily: FF }}
                        >
                            🎯
                        </button>
                    </>
                )}
                {!childLocations.length && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)", zIndex: 5 }}>
                        <div style={{ textAlign: "center", padding: 24 }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#374151", marginBottom: 6 }}>아이 위치를 불러오는 중...</div>
                            <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>아이 기기에서 위치 권한이<br />허용되어 있는지 확인해 주세요</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom info */}
            <div style={{ padding: "12px 16px 16px", flexShrink: 0 }}>
                {/* 클릭한 장소 상세 */}
                {selectedEvent && (
                    <div style={{ background: "white", borderRadius: 16, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: selectedEvent.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{selectedEvent.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937" }}>{selectedEvent.title}</div>
                            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>⏰ {selectedEvent.time} · 📍 {selectedEvent.location.address?.split(" ").slice(0, 3).join(" ")}</div>
                            {arrivedSet.has(selectedEvent.id) && <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 2 }}>✅ 도착 완료</div>}
                            {activeChildLocation && <div style={{ fontSize: 11, color: selectedEvent.color, fontWeight: 700, marginTop: 2 }}>현재위치에서 {distLabel(haversineM(activeChildLocation.lat, activeChildLocation.lng, selectedEvent.location.lat, selectedEvent.location.lng))}</div>}
                        </div>
                        <button onClick={() => setSelectedEvent(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF", padding: "0 4px" }}>×</button>
                    </div>
                )}

                {childLocations.length > 0 ? (
                    <div style={{ background: "white", borderRadius: 20, padding: "14px 18px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                        {/* 아이별 위치 상태 */}
                        {childLocations.map((child, i) => {
                            const color = CHILD_MARKER_COLORS[i % CHILD_MARKER_COLORS.length];
                            const isActive = selectedChild?.trackerKey === child.trackerKey;
                            const updatedAt = child.updatedAt || child.updated_at;
                            return (
                                <button
                                    key={child.trackerKey}
                                    type="button"
                                    onClick={() => {
                                        setSelectedChildId(child.trackerKey);
                                        focusChildLocation(child);
                                    }}
                                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 10px", background: isActive ? `${color}18` : `${color}10`, borderRadius: 14, border: isActive ? `2px solid ${color}` : "2px solid transparent", cursor: "pointer", textAlign: "left", fontFamily: FF, boxShadow: isActive ? `0 4px 14px ${color}22` : "none" }}
                                >
                                    <div style={{ width: 36, height: 36, borderRadius: 12, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "white", flexShrink: 0 }}>{child.emoji}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{child.name}</div>
                                        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>
                                            {updatedAt ? `${new Date(updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ${selectedChild?.trackerKey === child.trackerKey && refreshPending ? "확인 중" : "업데이트"}` : "위치 수신 중..."}
                                        </div>
                                        <div style={{ fontSize: 10, color: "#64748B", marginTop: 1 }}>
                                            {child.lat.toFixed(5)}, {child.lng.toFixed(5)}
                                        </div>
                                    </div>
                                    <div style={{ minWidth: 50, borderRadius: 999, padding: "5px 8px", background: isActive ? color : "white", color: isActive ? "white" : color, fontSize: 10, fontWeight: 900, textAlign: "center", boxShadow: isActive ? "none" : "0 1px 6px rgba(0,0,0,0.06)" }}>
                                        {isActive ? `${child.name} 실시간` : "보기"}
                                    </div>
                                </button>
                            );
                        })}
                        {/* 오늘 총 이동거리 */}
                        {totalDistM > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <div style={{ background: "#EFF6FF", borderRadius: 12, padding: "6px 12px", textAlign: "center" }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: "#3B82F6" }}>{distLabel(totalDistM)}</span>
                                    <span style={{ fontSize: 10, color: "#93C5FD", marginLeft: 6 }}>오늘 이동</span>
                                </div>
                            </div>
                        )}
                        {nextEvent && (
                            <div style={{ background: nextEvent.bg, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ fontSize: 22 }}>{nextEvent.emoji}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937" }}>다음 일정: {nextEvent.title}</div>
                                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>⏰ {nextEvent.time} · 📍 {nextEvent.location.address?.split(" ").slice(0, 2).join(" ")}</div>
                                </div>
                                {distToNext !== null && (
                                    <div style={{ fontSize: 12, fontWeight: 800, color: nextEvent.color, flexShrink: 0 }}>
                                        {distLabel(distToNext)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ background: "white", borderRadius: 20, padding: "20px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF" }}>{locationHint || "아이 기기에서 위치 권한을 허용해 주세요"}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function KidsScheduler() {
    const today = new Date();
    const roleStorage = typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : (typeof window !== "undefined" ? window.localStorage : null);

    // ── Auth & family state (Supabase) ──────────────────────────────────────────
    const [authUser, setAuthUser] = useState(null);       // supabase auth user
    const [familyInfo, setFamilyInfo] = useState(null);   // { familyId, pairCode, myRole, myName, members }
    const [authLoading, setAuthLoading] = useState(true);
    const [myRole, setMyRole] = useState(() => {
        try { return roleStorage?.getItem("hyeni-my-role") || null; } catch { return null; }
    });           // "parent" | "child" | null (role selection)
    const [showPairing, setShowPairing] = useState(false);
    const [showTrialInvite, setShowTrialInvite] = useState(false);
    const [featureLock, setFeatureLock] = useState({ open: false, feature: null, title: "", body: "" });
    const [showDisclosure, setShowDisclosure] = useState(false);
    const [pendingProduct, setPendingProduct] = useState(null);
    const [showRemoteAudio, setShowRemoteAudio] = useState(false);
    const [showSubscriptionSettings, setShowSubscriptionSettings] = useState(false);
    const [showMicPermissionHelp, setShowMicPermissionHelp] = useState(false);
    // Phase 5 RL-02: child-side persistent listening indicator. Holds the
    // start timestamp (number) when an ambient listen session is active, or
    // null when idle. Rendered as a fixed-top red banner the child cannot
    // miss — stays until onRemoteListenStop fires or the child leaves.
    const [listeningSession, setListeningSession] = useState(null);

    // Persist myRole to localStorage for session continuity
    useEffect(() => {
        try {
            if (myRole) roleStorage?.setItem("hyeni-my-role", myRole);
            else roleStorage?.removeItem("hyeni-my-role");
        } catch { /* ignored */ }
    }, [myRole, roleStorage]);

    const isParent = familyInfo?.myRole === "parent" || myRole === "parent";
    const isNativeApp = typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
    const familyId = familyInfo?.familyId;
    const entitlement = useEntitlement(familyId);
    const pairCode = familyInfo?.pairCode || "";
    const pairedChildren = familyInfo?.members?.filter(m => m.role === "child") || [];
    const _pairedDevice = pairedChildren[0] || null; // 첫 번째 아이 (하위호환)

    // ── Academy, calendar, memo state ───────────────────────────────────────────
    const [academies, setAcademies] = useState(() => getCachedAcademies());
    const [savedPlaces, setSavedPlaces] = useState(() => getCachedSavedPlaces());
    const [showAcademyMgr, setShowAcademyMgr] = useState(false);
    const [showSavedPlaceMgr, setShowSavedPlaceMgr] = useState(false);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState(today.getDate());
    const [events, setEvents] = useState(() => getCachedEvents());
    const [memos, setMemos] = useState(() => getCachedMemos());
    const [memoReplies, setMemoReplies] = useState([]);
    const [memoReadBy, setMemoReadBy] = useState([]);
    const [globalNotif, setGlobalNotifState] = useState(DEFAULT_NOTIF);
    const [parentPhones, setParentPhones] = useState({ mom: "", dad: "" });
    const [showPhoneSettings, setShowPhoneSettings] = useState(false);
    const [showParentSetup, setShowParentSetup] = useState(false);
    const [showNotifSettings, setShowNotifSettings] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackDraft, setFeedbackDraft] = useState("");
    const [feedbackBusy, setFeedbackBusy] = useState(false);

    // ── UI state ───────────────────────────────────────────────────────────────
    const [showAddModal, setShowAddModal] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [showChildTracker, setShowChildTracker] = useState(false);
    const [locationRefreshRequestedAt, setLocationRefreshRequestedAt] = useState(null);
    const [_listening, setListening] = useState(false);
    const [notification, setNotification] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [emergencies, setEmergencies] = useState([]);
    const [bounce, setBounce] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [mapLoadError, setMapLoadError] = useState("");
    const [activeView, setActiveView] = useState("calendar");
    const [editingLocForEvent, setEditingLocForEvent] = useState(null);
    const [showKkukReceived, setShowKkukReceived] = useState(null); // { from: "엄마"|"아이", timestamp }
    const [kkukCooldown, setKkukCooldown] = useState(false);
    const [showParentMemoPage, setShowParentMemoPage] = useState(false);
    // RES-02: sync degradation banner state. null = healthy; "transient" =
    // 1+ consecutive failure, retrying soon; "circuit_open" = breaker open,
    // 5-min cooldown active.
    const [syncDegraded, setSyncDegraded] = useState(null);

    // ── Arrival tracking ───────────────────────────────────────────────────────
    const [arrivedSet, setArrivedSet] = useState(new Set());
    const [firedNotifs, setFiredNotifs] = useState(new Set());
    const [firedEmergencies, setFiredEmergencies] = useState(new Set());
    const [firedExactStatuses, setFiredExactStatuses] = useState(new Set());
    const [childPos, setChildPos] = useState(null);
    const [childLocationInfo, setChildLocationInfo] = useState({ label: "", shortLabel: "", precise: false, neighborhood: "", updatedAt: null });
    const [childLocationLabels, setChildLocationLabels] = useState({});
    const [allChildPositions, setAllChildPositions] = useState([]); // [{user_id, name, emoji, lat, lng, updatedAt}]
    const [locationTrail, setLocationTrail] = useState([]); // 오늘 아이 이동경로
    const [pushPermission, setPushPermission] = useState(() => getPermissionStatus());
    const [nativeNotifHealth, setNativeNotifHealth] = useState(null);
    // ── Stickers ────────────────────────────────────────────────────────────────
    const [stickers, setStickers] = useState([]);
    const [stickerSummary, setStickerSummary] = useState(null);
    const [showStickerBook, setShowStickerBook] = useState(false);
    const [showAiSchedule, setShowAiSchedule] = useState(false);
    const [bgLocationGranted, setBgLocationGranted] = useState(true); // assume granted until checked
    const [showDangerZones, setShowDangerZones] = useState(false);
    const [dangerZones, setDangerZones] = useState([]);
    const [firedDangerAlerts, setFiredDangerAlerts] = useState(new Set());
    // ── Departure detection ─────────────────────────────────────────────────────
    const departureTimers = useRef({}); // { eventId: { timer, leftAt } }
    const [departedAlerts, setDepartedAlerts] = useState(new Set());
    // ── Audio recording ─────────────────────────────────────────────────────────


    // ── Voice ──────────────────────────────────────────────────────────────────
    const [voicePreview, setVoicePreview] = useState(null);
    const [routeEvent, setRouteEvent] = useState(null);

    // ── AI Alerts (parent only) ──────────────────────────────────────────────
    const [parentAlerts, setParentAlerts] = useState([]);
    const [showAlertPanel, setShowAlertPanel] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(() => {
        try { return localStorage.getItem("hyeni-ai-enabled") !== "false"; } catch { return true; }
    });

    // ── Refs ────────────────────────────────────────────────────────────────────
    const realtimeChannel = useRef(null);
    const dateKeyRef = useRef("");
    const lastGeocodePosRef = useRef(null);
    const parentCalendarRef = useRef(null);
    const displayChildPositions = useMemo(
        () => effectiveChildPositions(allChildPositions, entitlement),
        [allChildPositions, entitlement]
    );
    const displayChildLocationKey = useMemo(
        () => displayChildPositions.map(pos => `${pos.user_id || "child"}:${pos.lat}:${pos.lng}:${pos.updatedAt || ""}`).join("|"),
        [displayChildPositions]
    );
    const displayChildPos = useMemo(
        () => effectiveChildLocation(childPos, entitlement) || (displayChildPositions.length > 0 ? displayChildPositions[0] : null),
        [childPos, displayChildPositions, entitlement]
    );
    const locationGateHint = isParent && !displayChildPos && allChildPositions.length > 0 && !entitlement.canUse(FEATURES.REALTIME_LOCATION)
        ? "무료 플랜에서는 5분 지난 위치만 표시돼요. 실시간 위치는 프리미엄에서 사용할 수 있어요."
        : "";

    const openFeatureLock = useCallback((feature, title = "", body = "") => {
        setFeatureLock({ open: true, feature, title, body });
    }, []);

    const closeFeatureLock = useCallback(() => {
        setFeatureLock({ open: false, feature: null, title: "", body: "" });
    }, []);

    const maybeOpenTrialInvite = useCallback(() => {
        if (myRole !== "parent" || entitlement.tier !== "free") return;
        try {
            if (localStorage.getItem(TRIAL_INVITE_SHOWN_KEY)) return;
            localStorage.setItem(TRIAL_INVITE_SHOWN_KEY, "1");
        } catch {
            // ignore storage failures
        }
        setShowTrialInvite(true);
    }, [entitlement.tier, myRole]);

    const handleOpenSavedPlaceMgr = useCallback(() => {
        if (!isParent) return;
        if (!entitlement.canUse(FEATURES.SAVED_PLACES)) {
            openFeatureLock(FEATURES.SAVED_PLACES);
            return;
        }
        setShowSavedPlaceMgr(true);
    }, [entitlement, isParent, openFeatureLock]);

    // ── Add form ───────────────────────────────────────────────────────────────
    const [newTitle, setNewTitle] = useState("");
    const [newTime, setNewTime] = useState("09:00");
    const [newEndTime, setNewEndTime] = useState("");
    const [newCategory, setNewCategory] = useState("school");
    const [newMemo, setNewMemo] = useState("");
    const [newLocation, setNewLocation] = useState(null);
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [weeklyRepeat, setWeeklyRepeat] = useState(false);
    const [repeatWeeks, setRepeatWeeks] = useState(4);

    // 프리셋별 마지막 시간/위치를 기존 이벤트에서 찾기
    const findLastEventByTitle = (title) => {
        let found = null;
        for (const evs of Object.values(events)) {
            for (const e of evs) {
                if (e.title === title) found = e;
            }
        }
        return found;
    };

    const notifTimer = useRef(null);
    // Phase 5 · KKUK-02 — receiver-side LRU dedup. Keys are payload.dedup_key
    // UUIDs; values are Date.now() timestamps. Pruned on each new event to
    // anything older than 60s. Backs onKkuk's duplicate-suppression branch.
    const recentKkukKeys = useRef(new Map());
    // Phase 5 · KKUK-01 — press-hold timing. A hold sends once after 500ms
    // without waiting for release; the synthetic click is suppressed afterward.
    const kkukHoldStart = useRef(0);
    const kkukHoldTimerRef = useRef(null);
    const kkukSentFromPressRef = useRef(false);
    const dateKey = `${currentYear}-${currentMonth}-${selectedDate}`;
    dateKeyRef.current = dateKey;

    // ── Load memo replies when viewing a date ────────────────────────────────
    // Phase 4 · MEMO-02: auto-read-on-view REMOVED. The user had to glance at
    // the date for a memo to be marked read — that is just as bad as the push
    // preview auto-mark we removed elsewhere. Read receipts now come from the
    // 3-second IntersectionObserver (registerMemoReplyNode below), which
    // fires markMemoReplyRead ONLY after the reply bubble was visible in the
    // viewport for 3 continuous seconds. public.memos.read_by is still read
    // for legacy UI (top-of-card "✓ 읽음" badge) until v1.1 cleans it up.
    const currentMemo = memos[dateKey] || "";
    const hasMemo = currentMemo.length > 0;
    useEffect(() => {
        if (!familyId || !dateKey) return;
        fetchMemoReplies(familyId, dateKey).then(setMemoReplies).catch(() => {});
        // Legacy memos.read_by fetch retained for the card-level badge only.
        // Removal scheduled for v1.1 MEMO-CLEANUP-01.
        supabase.from("memos").select("read_by").eq("family_id", familyId).eq("date_key", dateKey).maybeSingle()
            .then(({ data }) => setMemoReadBy(data?.read_by || []));
    }, [familyId, dateKey, hasMemo, authUser?.id]);

    // ── MEMO-02: 3-second viewport read observer ─────────────────────────────
    // One observer instance, module-lifetime. Each reply bubble passes its
    // DOM node in via ref={el => registerMemoReplyNode(el, r.id)}. On
    // entry.isIntersecting (≥50% visible) we schedule a 3-second timer; if
    // the bubble stays intersecting for the full 3s, we call
    // markMemoReplyRead and remember the id in markedIdsRef so we never
    // re-fire for the same reply in this session. If the bubble leaves
    // before 3s, the pending timer is cleared.
    //
    // Observer is created inside useEffect (not during render) to satisfy
    // the react-hooks/refs rule. The registerMemoReplyNode callback reads
    // ref values lazily — only inside the IntersectionObserver callback
    // which fires asynchronously long after render completes.
    const markedIdsRef = useRef(new Set());
    const pendingTimersRef = useRef(new Map());
    const nodeToIdRef = useRef(new WeakMap());
    const pendingNodesRef = useRef([]); // nodes queued before observer init
    const replyObserverRef = useRef(null);
    // Dedicated auth-id ref for the observer's closure. Kept separate from
    // the app-wide `authUserRef` so the react-hooks/immutability rule
    // doesn't flag the (pre-existing, correct) `authUserRef.current = ...`
    // mutation further down. We re-sync this ref whenever authUser changes,
    // before the observer ever fires a timer.
    const memoReadAuthIdRef = useRef(null);
    useEffect(() => { memoReadAuthIdRef.current = authUser?.id || null; }, [authUser?.id]);

    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") return; // SSR / old browser guard
        const obs = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const id = nodeToIdRef.current.get(entry.target);
                if (!id) continue;
                if (entry.isIntersecting) {
                    if (markedIdsRef.current.has(id)) continue;
                    if (pendingTimersRef.current.has(id)) continue;
                    const uid = memoReadAuthIdRef.current;
                    if (!uid) continue;
                    const timer = setTimeout(() => {
                        pendingTimersRef.current.delete(id);
                        if (markedIdsRef.current.has(id)) return;
                        markedIdsRef.current.add(id);
                        markMemoReplyRead(id, uid).catch(() => {});
                    }, 3000);
                    pendingTimersRef.current.set(id, timer);
                } else {
                    const timer = pendingTimersRef.current.get(id);
                    if (timer) { clearTimeout(timer); pendingTimersRef.current.delete(id); }
                }
            }
        }, { threshold: 0.5 });
        replyObserverRef.current = obs;
        // Capture the refs into locals — the hooks/exhaustive-deps rule
        // wants cleanup to use a stable snapshot, not live ref reads.
        const timersMap = pendingTimersRef.current;
        // Flush any nodes registered before the observer was ready.
        for (const el of pendingNodesRef.current) {
            try { obs.observe(el); } catch { /* ignore */ }
        }
        pendingNodesRef.current = [];
        return () => {
            // Clear all pending read-receipt timers and disconnect the observer.
            for (const t of timersMap.values()) clearTimeout(t);
            timersMap.clear();
            try { obs.disconnect(); } catch { /* ignore */ }
            replyObserverRef.current = null;
        };
    }, []);

    const registerMemoReplyNode = useCallback((el, id) => {
        if (!el || !id) return;
        // Idempotent: if this node was already registered under this id, skip.
        if (nodeToIdRef.current.get(el) === id) return;
        nodeToIdRef.current.set(el, id);
        const obs = replyObserverRef.current;
        if (obs) {
            try { obs.observe(el); } catch { /* ignore double-observe */ }
        } else {
            pendingNodesRef.current.push(el);
        }
    }, []);

    // ── Load Kakao Maps SDK on mount ────────────────────────────────────────────
    useEffect(() => {
        if (window.kakao?.maps?.LatLng) {
            setMapReady(true);
            setMapLoadError("");
            return;
        }
        if (!KAKAO_APP_KEY) {
            setMapLoadError("Kakao 지도 키가 없어 간이 지도로 표시해요");
            return;
        }
        loadKakaoMap(KAKAO_APP_KEY)
            .then(() => {
                setMapReady(true);
                setMapLoadError("");
            })
            .catch((error) => {
                console.warn("[KakaoMap] SDK load failed:", error?.message || error);
                setMapReady(false);
                setMapLoadError("Kakao 지도 연결 실패 — 간이 지도로 경로를 표시해요");
            });
    }, []);


    // ── Sync parent phones from familyInfo ─────────────────────────────────────
    useEffect(() => {
        if (familyInfo?.phones) {
            setParentPhones(familyInfo.phones);
        }
    }, [familyInfo]);

    useEffect(() => {
        if (!myRole) return;
        setGlobalNotifState(readNotifSettings(authUser?.id, myRole));
    }, [authUser?.id, myRole]);

    const setGlobalNotif = useCallback((nextValue) => {
        setGlobalNotifState((prev) => {
            const resolved = normalizeNotifSettings(
                typeof nextValue === "function" ? nextValue(prev) : nextValue,
                DEFAULT_NOTIF,
            );
            writeNotifSettings(authUser?.id, myRole, resolved);
            return resolved;
        });
    }, [authUser?.id, myRole]);

    const handleNativeAuthCallback = useCallback(async (url) => {
        if (!url || !url.startsWith("hyenicalendar://auth-callback")) {
            return false;
        }

        const fragment = url.includes("#")
            ? url.split("#")[1]
            : (url.split("?")[1] || "");
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const code = params.get("code");

        try {
            if (accessToken && refreshToken) {
                await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                return true;
            }

            if (code) {
                await supabase.auth.exchangeCodeForSession(code);
                return true;
            }
        } catch (err) {
            console.error("[Auth] Native OAuth callback handling failed:", err);
        }

        return false;
    }, []);

    // ── Deep link handler (카카오 OAuth 콜백 → 앱 복귀) ──────────────────────
    useEffect(() => {
        if (!isNativeApp) return;
        let handle;
        (async () => {
            try {
                const [{ App: CapApp }, { Browser }] = await Promise.all([
                    import("@capacitor/app"),
                    import("@capacitor/browser"),
                ]);
                const closeBrowserSafely = async () => {
                    try { await Browser.close(); } catch (e) { void e; }
                };
                const launch = await CapApp.getLaunchUrl();
                if (launch?.url) {
                    const handled = await handleNativeAuthCallback(launch.url);
                    if (handled) await closeBrowserSafely();
                }

                handle = await CapApp.addListener("appUrlOpen", async (event) => {
                    const handled = await handleNativeAuthCallback(event.url);
                    if (handled) await closeBrowserSafely();
                });
            } catch (error) {
                void error;
            }
        })();
        return () => { if (handle) handle.remove(); };
    }, [handleNativeAuthCallback, isNativeApp]);

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
                setBgLocationGranted(result.backgroundLocation === true);
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
                    role: myRole || "",
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
    }, [authUser, familyId, myRole]);

    // ── Shared auth handler (used by both init and onAuthChange) ────────────────
    const handleAuthUser = useCallback(async (user) => {
        setAuthUser(user);

        let fam = null;
        try {
            fam = await getMyFamily(user.id);
        } catch (err) {
            console.error("[getMyFamily]", err);
        }

        if (fam) {
            setFamilyInfo(fam);
            setMyRole(fam.myRole);
            return;
        }

        // Kakao user with no family → show parent setup choice (don't auto-create)
        const isKakao = user.app_metadata?.provider === "kakao"
            || user.identities?.some(i => i.provider === "kakao")
            || user.user_metadata?.provider === "kakao";
        if (isKakao) {
            setMyRole("parent");
            setShowParentSetup(true); // Show "새 가족 만들기 / 기존 가족 합류" choice
        }
    }, []);

    // ── Auth: check session on mount ────────────────────────────────────────────
    const authInitDone = useRef(false);
    const authUserRef = useRef(null);
    const myRoleRef = useRef(myRole);
    const familyInfoRef = useRef(familyInfo);
    // Keep refs in sync with state (avoids stale closure in visibility handler)
    useEffect(() => { authUserRef.current = authUser; }, [authUser]);
    useEffect(() => { myRoleRef.current = myRole; }, [myRole]);
    useEffect(() => { familyInfoRef.current = familyInfo; }, [familyInfo]);

    useEffect(() => {
        const init = async () => {
            try {
                const session = await getSession();
                if (session?.user) {
                    await handleAuthUser(session.user);
                }
            } catch (err) {
                console.error("[auth init] error:", err);
            }
            authInitDone.current = true;
            setAuthLoading(false);
        };

        // Safety timeout: never hang on loading screen
        const safetyTimer = setTimeout(() => {
            if (!authInitDone.current) {
                authInitDone.current = true;
                setAuthLoading(false);
            }
        }, 5000);

        init();

        const sub = onAuthChange(async (session, event) => {
            // Skip if init() hasn't finished yet (avoid double-run on mount)
            if (!authInitDone.current) return;
            if (session?.user) {
                await handleAuthUser(session.user);
            } else if (event === "SIGNED_OUT") {
                // Only reset role on explicit sign-out, not on token refresh failures
                setAuthUser(null);
                setFamilyInfo(null);
                setMyRole(null);
            }
        });

        // Re-check session when app comes back from background
        const handleVisibility = async () => {
            if (document.visibilityState === "visible" && authInitDone.current) {
                try {
                    const session = await getSession();
                    if (session?.user) {
                        if (!authUserRef.current || !myRoleRef.current) {
                            await handleAuthUser(session.user);
                        }
                        // Update native service token + ensure service is running
                        if (session.access_token) {
                            try {
                                const { Capacitor, registerPlugin } = await import("@capacitor/core");
                                if (Capacitor.isNativePlatform()) {
                                    const BackgroundLocation = registerPlugin("BackgroundLocation");
                                    // Check if service is still running, restart if dead
                                    const { running } = await BackgroundLocation.isRunning();
                                    const curRole = myRoleRef.current;
                                    const curFamilyId = familyInfoRef.current?.familyId;
                                    if (!running && curRole === "child" && curFamilyId) {
                                        console.log("[Resume] LocationService was dead, restarting...");
                                        await BackgroundLocation.startService({
                                            userId: session.user.id, familyId: curFamilyId,
                                            supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY,
                                            accessToken: session.access_token
                                        });
                                    } else {
                                        await BackgroundLocation.updateToken({ accessToken: session.access_token });
                                    }
                                }
                            } catch { /* ignored */ }
                        }
                    }
                } catch { /* ignored */ }
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            sub?.unsubscribe();
            clearTimeout(safetyTimer);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [handleAuthUser]);

    useEffect(() => {
        if (!familyId) return;
        identifySubscriptionUser(familyId).catch((error) => {
            console.warn("[subscription] identify failed:", error);
        });
    }, [familyId, authUser?.id, isParent]);

    // ── Fetch data + subscribe when familyId is available ───────────────────────
    useEffect(() => {
        if (!familyId) return;

        // Fetch fresh data from Supabase
        fetchEvents(familyId).then(map => setEvents(map));
        fetchAcademies(familyId).then(list => setAcademies(list));
        fetchMemos(familyId).then(map => setMemos(map));
        fetchSavedPlaces(familyId, { meta: true }).then(({ list, breaker }) => {
            setSavedPlaces(list);
            // RES-02: surface degraded state on initial load.
            if (breaker.open) setSyncDegraded("circuit_open");
            else if (breaker.failures > 0) setSyncDegraded("transient");
            else setSyncDegraded(null);
        });

        // Subscribe to realtime changes
        realtimeChannel.current = subscribeFamily(familyId, {
            onEventsChange: (type, newRow, oldRow) => {
                setEvents(prev => {
                    const updated = { ...prev };
                    if (type === "INSERT" && newRow) {
                        const dk = newRow.date_key;
                        const ev = { id: newRow.id, title: newRow.title, time: newRow.time, endTime: newRow.end_time || null, category: newRow.category, emoji: newRow.emoji, color: newRow.color, bg: newRow.bg, memo: newRow.memo || "", location: newRow.location, notifOverride: newRow.notif_override };
                        updated[dk] = [...(updated[dk] || []), ev].sort((a, b) => a.time.localeCompare(b.time));
                        // Deduplicate by id
                        updated[dk] = updated[dk].filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i);
                    } else if (type === "UPDATE" && newRow) {
                        const dk = newRow.date_key;
                        const ev = { id: newRow.id, title: newRow.title, time: newRow.time, endTime: newRow.end_time || null, category: newRow.category, emoji: newRow.emoji, color: newRow.color, bg: newRow.bg, memo: newRow.memo || "", location: newRow.location, notifOverride: newRow.notif_override };
                        // Remove from old date_key if changed, add to new
                        Object.keys(updated).forEach(k => { updated[k] = (updated[k] || []).filter(e => e.id !== newRow.id); if (updated[k].length === 0) delete updated[k]; });
                        updated[dk] = [...(updated[dk] || []), ev].sort((a, b) => a.time.localeCompare(b.time));
                    } else if (type === "DELETE" && oldRow) {
                        Object.keys(updated).forEach(k => { updated[k] = (updated[k] || []).filter(e => e.id !== oldRow.id); if (updated[k].length === 0) delete updated[k]; });
                    }
                    cacheEvents(updated);
                    return updated;
                });
            },
            onAcademiesChange: (type, newRow, oldRow) => {
                const CAT_COLORS = { school: { color: "#A78BFA", bg: "#EDE9FE" }, sports: { color: "#34D399", bg: "#D1FAE5" }, hobby: { color: "#F59E0B", bg: "#FEF3C7" }, family: { color: "#F87171", bg: "#FEE2E2" }, friend: { color: "#60A5FA", bg: "#DBEAFE" }, other: { color: "#EC4899", bg: "#FCE7F3" } };
                setAcademies(prev => {
                    let updated = [...prev];
                    if (type === "INSERT" && newRow) {
                        const cat = CAT_COLORS[newRow.category] || CAT_COLORS.other;
                        const ac = { id: newRow.id, name: newRow.name, emoji: newRow.emoji, category: newRow.category, color: cat.color, bg: cat.bg, location: newRow.location, schedule: newRow.schedule || null };
                        if (!updated.find(a => a.id === ac.id)) updated.push(ac);
                    } else if (type === "UPDATE" && newRow) {
                        const cat = CAT_COLORS[newRow.category] || CAT_COLORS.other;
                        updated = updated.map(a => a.id === newRow.id ? { ...a, name: newRow.name, emoji: newRow.emoji, category: newRow.category, color: cat.color, bg: cat.bg, location: newRow.location, schedule: newRow.schedule || null } : a);
                    } else if (type === "DELETE" && oldRow) {
                        updated = updated.filter(a => a.id !== oldRow.id);
                    }
                    cacheAcademies(updated);
                    return updated;
                });
            },
            onMemosChange: (type, newRow, _oldRow) => {
                if (type === "DELETE") {
                    fetchMemos(familyId).then(map => setMemos(map));
                    return;
                }
                if (!newRow?.date_key) return;
                // MEMO-FIX-02: skip guard removed — textarea write-path gone, memos state
                // is read-only UI; stale state on current date is inconsequential.
                // updated_by column does not exist in schema, so Option A was not viable.
                setMemos(prev => {
                    const updated = { ...prev };
                    updated[newRow.date_key] = newRow.content || "";
                    cacheMemos(updated);
                    return updated;
                });
            },
            onSavedPlacesChange: (type, newRow, oldRow) => {
                setSavedPlaces(prev => {
                    let updated = [...prev];
                    if (type === "INSERT" && newRow) {
                        const place = {
                            id: newRow.id,
                            name: newRow.name,
                            location: newRow.location || null,
                            createdAt: newRow.created_at || null,
                            updatedAt: newRow.updated_at || null,
                        };
                        if (!updated.some(entry => entry.id === place.id)) updated.push(place);
                    } else if (type === "UPDATE" && newRow) {
                        updated = updated.map(place => place.id === newRow.id
                            ? {
                                ...place,
                                name: newRow.name,
                                location: newRow.location || null,
                                updatedAt: newRow.updated_at || place.updatedAt || null,
                            }
                            : place);
                    } else if (type === "DELETE" && oldRow) {
                        updated = updated.filter(place => place.id !== oldRow.id);
                    }
                    cacheSavedPlaces(updated);
                    return updated;
                });
            },
            onLocationChange: (payload) => {
                const updatedAt = payload?.updatedAt || payload?.updated_at || new Date().toISOString();
                const nextPosition = {
                    ...payload,
                    updatedAt,
                };
                setChildPos(nextPosition);
                const updatedMs = new Date(updatedAt).getTime();
                if (Number.isFinite(updatedMs)) {
                    setLocationRefreshRequestedAt(prev => (prev && updatedMs >= prev ? null : prev));
                }
                const childUserId = payload?.user_id || payload?.userId;
                if (childUserId) {
                    setAllChildPositions(prev => {
                        const member = familyInfoRef.current?.members?.find(m => m.user_id === childUserId);
                        const nextChild = {
                            user_id: childUserId,
                            name: member?.name || payload?.name || "Child",
                            emoji: member?.emoji || payload?.emoji || "",
                            lat: payload.lat,
                            lng: payload.lng,
                            updatedAt,
                        };
                        const found = prev.some(item => item.user_id === childUserId);
                        return found
                            ? prev.map(item => item.user_id === childUserId ? { ...item, ...nextChild } : item)
                            : [...prev, nextChild];
                    });
                }
            },
            onLocationRefreshRequest: async (payload) => {
                if (isParent || !authUser?.id || !familyId) return;
                const targetUserId = payload?.targetUserId || payload?.target_user_id || null;
                if (targetUserId && targetUserId !== authUser.id) return;

                try {
                    const session = await getSession();
                    await requestNativeCurrentLocation(authUser.id, familyId, session?.access_token || "", myRoleRef.current || "child");
                } catch (error) {
                    console.warn("[GPS] Native refresh request failed:", error);
                }

                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const updatedAt = new Date().toISOString();
                        const nextPosition = {
                            user_id: authUser.id,
                            userId: authUser.id,
                            family_id: familyId,
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
                            updatedAt,
                            updated_at: updatedAt,
                            source: "web-refresh",
                        };
                        setChildPos(nextPosition);
                        if (realtimeChannel.current?.state === "joined") {
                            realtimeChannel.current.send({
                                type: "broadcast",
                                event: "child_location",
                                payload: nextPosition,
                            });
                        }
                        saveChildLocation(authUser.id, familyId, nextPosition.lat, nextPosition.lng);
                        saveLocationHistory(authUser.id, familyId, nextPosition.lat, nextPosition.lng);
                    },
                    (error) => console.warn("[GPS] Web refresh location failed:", error),
                    { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
                );
            },
            onKkuk: (payload) => {
                // Received '꾹' from the other party
                if (payload.senderId === authUser?.id) return; // self echo

                // Phase 5 · KKUK-02: LRU dedup. Legacy payloads without
                // dedup_key fall through to the normal path so old senders
                // still work during staged rollout. Prune entries older than
                // 60 s on every receive.
                if (payload.dedup_key) {
                    const now = Date.now();
                    for (const [k, t] of recentKkukKeys.current) {
                        if (now - t > 60_000) recentKkukKeys.current.delete(k);
                    }
                    if (recentKkukKeys.current.has(payload.dedup_key)) {
                        // Same 꾹 seen within 60 s — suppress UI + vibrate.
                        return;
                    }
                    recentKkukKeys.current.set(payload.dedup_key, now);
                }

                const senderLabel = payload.senderRole === "parent" ? "엄마" : "아이";
                setShowKkukReceived({ from: senderLabel, timestamp: Date.now() });
                // Vibrate if supported
                if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
                // Native notification (wakes screen on Android)
                showKkukNotification(senderLabel, payload.dedup_key);
            },
            onMemoRepliesChange: (newRow) => {
                if (!newRow) return;
                if (newRow.user_id === authUser?.id) return;
                if (newRow.date_key !== dateKeyRef.current) return;
                setMemoReplies(prev => {
                    if (prev.some(r => r.id === newRow.id)) return prev;
                    return [...prev, { id: newRow.id, user_id: newRow.user_id, user_role: newRow.user_role, content: newRow.content, created_at: newRow.created_at }];
                });
            },
            // Child: remote listen - parent requests mic recording
            onRemoteListenStart: async (payload) => {
                if (isParent) return; // only child responds
                console.log("[Audio] Remote listen request received");
                // Phase 5 RL-02: show persistent child-side indicator + vibrate
                // immediately so the child knows the mic is active even if
                // capture setup takes a second. Buzz once (not the kkuk cadence).
                setListeningSession(Date.now());
                if (navigator.vibrate) { try { navigator.vibrate(200); } catch { /* ignore */ } }
                try {
                    await startRemoteAudioCapture(
                        realtimeChannel.current,
                        payload?.durationSec || payload?.duration || REMOTE_AUDIO_DEFAULT_DURATION_SEC,
                        {
                            familyId,
                            initiatorUserId: payload?.initiatorUserId || payload?.initiator_user_id || payload?.initiatorId || null,
                            childUserId: authUser?.id || null,
                            requestId: payload?.requestId || payload?.request_id || "",
                        }
                    );
                } catch (e) {
                    console.error("[Audio] Remote recording failed:", e);
                    // Start failed → clear the indicator so the child isn't shown a stale banner.
                    setListeningSession(null);
                }
            },
            onRemoteListenStop: () => {
                setListeningSession(null);
                stopRemoteAudioCapture("user_stopped");
            },
            onAudioChunk: (payload) => {
                // Parent receives audio chunk - handled by AmbientAudioRecorder component
                if (!isParent) return;
                // Dispatch custom event for the recorder component to pick up
                window.dispatchEvent(new CustomEvent("remote-audio-chunk", { detail: payload }));
            }
        });

        return () => { unsubscribe(realtimeChannel.current); };
    }, [familyId, authUser?.id, isParent]);

    // ── Child: check if launched via FCM remote_listen ──
    useEffect(() => {
        if (isParent || !familyId) return;
        const checkFlag = () => {
            if (window.__REMOTE_LISTEN_REQUESTED && realtimeChannel.current) {
                window.__REMOTE_LISTEN_REQUESTED = false;
                console.log("[Audio] Auto-starting remote listen from FCM launch");
                (async () => {
                    // Phase 5 RL-02: identical indicator+vibrate treatment as
                    // the realtime onRemoteListenStart path.
                    setListeningSession(Date.now());
                    if (navigator.vibrate) { try { navigator.vibrate(200); } catch { /* ignore */ } }
                    try {
                        await startRemoteAudioCapture(
                            realtimeChannel.current,
                            REMOTE_AUDIO_DEFAULT_DURATION_SEC,
                            { familyId, initiatorUserId: null, childUserId: authUser?.id || null, requestId: "" }
                        );
                    } catch (e) {
                        console.error("[Audio] Auto remote recording failed:", e);
                        setListeningSession(null);
                    }
                })();
            }
        };
        // Keep polling for a short window because FCM → app launch → WebView boot timing varies.
        checkFlag();
        const interval = setInterval(checkFlag, 1000);
        const timer = setTimeout(() => clearInterval(interval), 30000);
        return () => {
            clearInterval(interval);
            clearTimeout(timer);
        };
    }, [isParent, familyId, authUser?.id]);

    // ── Phase 5 RL-04: cleanup on unload / backgrounding ───────────────────────
    // If the child tab/page closes while a remote listen session is active, we
    // still need to close the audit row (end_reason='page_unload') and stop the
    // stream tracks. beforeunload is best-effort on mobile — we also listen to
    // pagehide (mobile Safari / bfcache) and a synchronous visibility watcher.
    useEffect(() => {
        if (isParent) return;
        const handleUnload = () => {
            try {
                if (window._remoteRecorder || window._remoteStream || window._remoteListenSessionId) {
                    stopRemoteAudioCapture("page_unload");
                }
            } catch { /* ignore */ }
        };
        window.addEventListener("beforeunload", handleUnload);
        window.addEventListener("pagehide", handleUnload);
        return () => {
            window.removeEventListener("beforeunload", handleUnload);
            window.removeEventListener("pagehide", handleUnload);
        };
    }, [isParent]);

    // ── Polling fallback: refetch every 30s in case Realtime misses changes ──
    useEffect(() => {
        if (!familyId) return;
        const poll = setInterval(() => {
            fetchEvents(familyId).then(map => setEvents(prev => {
                // Only update if data actually changed
                const prevJson = JSON.stringify(prev);
                const newJson = JSON.stringify(map);
                if (prevJson !== newJson) { cacheEvents(map); return map; }
                return prev;
            }));
            fetchMemos(familyId).then(map => setMemos(prev => {
                const prevJson = JSON.stringify(prev);
                const newJson = JSON.stringify(map);
                if (prevJson !== newJson) { cacheMemos(map); return map; }
                return prev;
            }));
            fetchSavedPlaces(familyId, { meta: true }).then(({ list, breaker }) => {
                setSavedPlaces(prev => {
                    const prevJson = JSON.stringify(prev);
                    const newJson = JSON.stringify(list);
                    if (prevJson !== newJson) { cacheSavedPlaces(list); return list; }
                    return prev;
                });
                // RES-02: drive banner state from breaker telemetry.
                if (breaker.open) setSyncDegraded("circuit_open");
                else if (breaker.failures > 0) setSyncDegraded("transient");
                else setSyncDegraded(null);
            });
        }, 30000);
        return () => clearInterval(poll);
    }, [familyId]);

    // ── 꾹 (emergency ping) ────────────────────────────────────────────────────
    const showNotif = useCallback((msg, type = "success") => {
        setNotification({ msg, type });
        if (notifTimer.current) clearTimeout(notifTimer.current);
        notifTimer.current = setTimeout(() => setNotification(null), 3500);
    }, []);

    const requestChildLocationRefresh = useCallback(async (reason = "parent_lookup") => {
        if (myRole !== "parent" || !familyId) return false;
        const requestedAt = Date.now();
        setLocationRefreshRequestedAt(requestedAt);

        const requestId = generateUUID();
        const payload = {
            requestId,
            familyId,
            requesterId: authUser?.id || null,
            targetRole: "child",
            reason,
            requestedAt: new Date(requestedAt).toISOString(),
        };

        const pushPromise = sendInstantPush({
            action: "request_location",
            familyId,
            senderUserId: authUser?.id || "",
            title: "",
            message: "",
            ...payload,
            idempotencyKey: requestId,
        });

        try {
            const sent = await sendBroadcastWhenReady(
                realtimeChannel.current,
                "location_refresh_request",
                payload,
                { timeoutMs: 1800, pollMs: 60 }
            );
            if (!sent) {
                console.warn("[GPS] location_refresh_request was not sent; showing saved location.");
            }
            await pushPromise;
            return sent;
        } catch (error) {
            console.error("[GPS] location_refresh_request failed:", error);
            await pushPromise;
            return false;
        }
    }, [authUser?.id, familyId, myRole]);

    useEffect(() => {
        if (myRole !== "parent" || !familyId || !showChildTracker) return;
        requestChildLocationRefresh("tracker_open");
    }, [familyId, myRole, requestChildLocationRefresh, showChildTracker]);

    const openMicPermissionHelp = useCallback(() => {
        setListeningSession(null);
        stopRemoteAudioCapture("permission_denied");
        setShowMicPermissionHelp(true);
        showNotif("🎤 마이크 권한이 필요해요. 설정에서 마이크를 허용해 주세요.", "error");
    }, [setListeningSession, setShowMicPermissionHelp, showNotif]);

    const openAppPermissionSettings = useCallback(async () => {
        try {
            const { Capacitor, registerPlugin } = await import("@capacitor/core");
            if (!Capacitor.isNativePlatform()) return;
            const BgLoc = registerPlugin("BackgroundLocation");
            if (typeof BgLoc.openAppLocationSettings === "function") {
                await BgLoc.openAppLocationSettings();
            }
        } catch (error) {
            console.error("[mic-permission] open settings failed:", error);
        }
    }, []);

    useEffect(() => {
        if (isParent) return;
        window.addEventListener("mic-permission-denied", openMicPermissionHelp);
        return () => window.removeEventListener("mic-permission-denied", openMicPermissionHelp);
    }, [isParent, openMicPermissionHelp]);

    const handleSendFeedback = useCallback(async () => {
        if (!feedbackDraft.trim() || feedbackBusy) return;
        setFeedbackBusy(true);
        try {
            const result = await sendFeedbackSuggestion({
                content: feedbackDraft,
                familyId,
                user: authUser,
                role: myRole,
            });
            setShowFeedbackModal(false);
            setFeedbackDraft("");
            showNotif(result.mode === "mailto" ? "📮 메일 앱으로 제안 작성을 이어갈게요!" : "📮 제안이 전달됐어요!");
        } catch (error) {
            console.error("[feedback] send failed:", error);
            showNotif(error?.message || "제안을 보내지 못했어요. 다시 시도해 주세요", "error");
        } finally {
            setFeedbackBusy(false);
        }
    }, [authUser, familyId, feedbackBusy, feedbackDraft, myRole, showNotif]);

    const sendKkuk = useCallback(() => {
        if (kkukCooldown || !familyId || !authUser) return;
        setKkukCooldown(true);
        setTimeout(() => setKkukCooldown(false), 5000); // 5s client-side UX cooldown

        const senderRole = isParent ? "parent" : "child";
        const senderLabel = isParent ? "엄마" : "아이";
        // Phase 5 KKUK-02: dedup_key travels with every 꾹 so receivers can
        // LRU-dedupe + so the sos_events row links to the exact broadcast.
        const dedupKey = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
            ? crypto.randomUUID()
            : `${authUser.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        const kkukPayload = { senderId: authUser.id, senderRole, timestamp: Date.now(), dedup_key: dedupKey };

        // Local UX feedback fires immediately — kkukCooldown above already
        // prevents rapid re-taps. The server-side RPC below can still veto
        // the send, in which case we silently drop without user-facing noise.
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        showNotif("💗 꾹을 보냈어요!");

        void (async () => {
            // Phase 5 KKUK-03: server-side 5s cooldown via RPC. The RPC
            // inspects sos_events for any row from this sender within 5 s and
            // returns FALSE if one exists. On FALSE we silently drop; on any
            // RPC error we FAIL OPEN (send anyway) so a degraded DB can't
            // block emergencies.
            try {
                const { data: cooldownOk, error: rpcErr } = await supabase
                    .rpc("kkuk_check_cooldown", { p_sender: authUser.id });
                if (rpcErr) {
                    console.warn("[kkuk] cooldown RPC errored, failing open:", rpcErr);
                } else if (cooldownOk === false) {
                    console.log("[kkuk] server cooldown rejected this send");
                    return;
                }
            } catch (rpcThrown) {
                console.warn("[kkuk] cooldown RPC threw, failing open:", rpcThrown);
            }

            let realtimeSent = false;
            // 1. Realtime broadcast (instant, if other party has app open)
            try {
                const channel = realtimeChannel.current;

                if (channel?.state === "joined" && typeof channel.send === "function") {
                    await channel.send({
                        type: "broadcast",
                        event: "kkuk",
                        payload: kkukPayload,
                    });
                    realtimeSent = true;
                }

                if (!realtimeSent) {
                    realtimeSent = await sendBroadcastWhenReady(channel, "kkuk", kkukPayload, {
                        timeoutMs: 1800,
                        pollMs: 60,
                    });
                }

                if (!realtimeSent) {
                    console.warn("[kkuk] realtime channel was not ready. Falling back to push delivery.");
                }
            } catch (error) {
                console.error("[kkuk] realtime send failed:", error);
            }

            // 2. Push notification + pending_notifications (works when app is closed)
            let pushSent = false;
            try {
                await sendInstantPush({
                    action: "kkuk",
                    familyId,
                    senderUserId: authUser.id,
                    title: "💗 꾹!",
                    message: `${senderLabel}가 꾹을 보냈어요!`,
                    idempotencyKey: dedupKey,
                });
                pushSent = true;
            } catch (e) {
                console.error("[kkuk] push failed:", e);
            }

            // Phase 5 · SOS-01: immutable audit row. Fire-and-forget — failure
            // to log must NOT block the emergency signal. receiver_user_ids
            // lists the OPPOSITE-role members of the current family so
            // auditors can see who was paged. delivery_status captures the
            // two delivery channels.
            try {
                const oppositeRole = isParent ? "child" : "parent";
                const receiverIds = (familyInfo?.members || [])
                    .filter(m => m.role === oppositeRole && m.user_id && m.user_id !== authUser.id)
                    .map(m => m.user_id);
                await supabase.from("sos_events").insert({
                    family_id: familyId,
                    sender_user_id: authUser.id,
                    receiver_user_ids: receiverIds,
                    delivery_status: {
                        realtime: realtimeSent ? "sent" : "failed",
                        push: pushSent ? "sent" : "failed",
                    },
                    client_request_hash: dedupKey,
                });
            } catch (auditErr) {
                console.error("[kkuk] sos_events audit insert failed:", auditErr);
            }
        })();
    }, [familyId, authUser, isParent, kkukCooldown, showNotif, familyInfo]);

    const clearKkukHoldTimer = useCallback(() => {
        if (kkukHoldTimerRef.current) {
            clearTimeout(kkukHoldTimerRef.current);
            kkukHoldTimerRef.current = null;
        }
    }, []);

    const beginKkukPress = useCallback(() => {
        if (kkukCooldown || !familyId || !authUser) return;
        kkukHoldStart.current = Date.now();
        kkukSentFromPressRef.current = false;
        clearKkukHoldTimer();
        kkukHoldTimerRef.current = setTimeout(() => {
            if (!kkukHoldStart.current || kkukSentFromPressRef.current) return;
            kkukSentFromPressRef.current = true;
            sendKkuk();
        }, 500);
    }, [authUser, clearKkukHoldTimer, familyId, kkukCooldown, sendKkuk]);

    const endKkukPress = useCallback((event) => {
        const start = kkukHoldStart.current;
        const alreadySent = kkukSentFromPressRef.current;
        kkukHoldStart.current = 0;
        clearKkukHoldTimer();
        if (!start) return;

        const held = Date.now() - start;
        if (alreadySent) {
            event?.preventDefault?.();
            return;
        }
        if (held >= 500) {
            kkukSentFromPressRef.current = true;
            event?.preventDefault?.();
            sendKkuk();
        }
    }, [clearKkukHoldTimer, sendKkuk]);

    const cancelKkukPress = useCallback(() => {
        kkukHoldStart.current = 0;
        clearKkukHoldTimer();
    }, [clearKkukHoldTimer]);

    const handleKkukClick = useCallback(() => {
        if (kkukSentFromPressRef.current) {
            kkukSentFromPressRef.current = false;
            return;
        }
        sendKkuk();
    }, [sendKkuk]);

    useEffect(() => clearKkukHoldTimer, [clearKkukHoldTimer]);

    // ── Android 뒤로가기 버튼 처리 ───────────────────────────────────────────────
    const backStateRef = useRef({});
    useEffect(() => {
        backStateRef.current = {
            routeEvent, showChildTracker, showMapPicker, showAddModal,
            showAcademyMgr, showSavedPlaceMgr, showPhoneSettings, showNotifSettings, showFeedbackModal, showParentSetup, showMicPermissionHelp, editingLocForEvent,
            voicePreview, activeView, showPairing, showAlertPanel,
        };
    });
    useEffect(() => {
        let handle;
        (async () => {
            try {
                const { App: CapApp } = await import("@capacitor/app");
                handle = await CapApp.addListener("backButton", () => {
                    const s = backStateRef.current;
                    if (s.routeEvent)          { setRouteEvent(null);           return; }
                    if (s.showChildTracker)    { setShowChildTracker(false);    return; }
                    if (s.showMapPicker)       { setShowMapPicker(false);       return; }
                    if (s.showAddModal)        { setShowAddModal(false);        return; }
                    if (s.showAcademyMgr)      { setShowAcademyMgr(false);      return; }
                    if (s.showSavedPlaceMgr)   { setShowSavedPlaceMgr(false);   return; }
                    if (s.showAlertPanel)      { setShowAlertPanel(false);      return; }
                    if (s.showPhoneSettings)   { setShowPhoneSettings(false);   return; }
                    if (s.showNotifSettings)   { setShowNotifSettings(false);   return; }
                    if (s.showMicPermissionHelp) { setShowMicPermissionHelp(false); return; }
                    if (s.showFeedbackModal)   { setShowFeedbackModal(false);   return; }
                    if (s.showParentSetup)     { setShowParentSetup(false);     return; }
                    if (s.editingLocForEvent)  { setEditingLocForEvent(null);   return; }
                    if (s.voicePreview)        { setVoicePreview(null);         return; }
                    if (s.activeView !== "calendar") { setActiveView("calendar"); return; }
                    if (s.showPairing)         { setShowPairing(false);         return; }
                    // 닫을 화면 없으면 앱 최소화 (종료 X)
                    CapApp.minimizeApp();
                });
            } catch (_e) { /* 웹 환경에서는 무시 */ }
        })();
        return () => { handle?.remove?.(); };
    }, []);

    // ── Helpers ────────────────────────────────────────────────────────────────
    const startTrial = useCallback(async (productId = PRICING.monthlyProductId) => {
        if (myRole === "child") {
            showNotif("아이 기기에서는 직접 구독을 시작할 수 없어요.", "error");
            return;
        }
        if (!familyId) {
            showNotif("가족 연결 후 다시 시도해 주세요.", "error");
            return;
        }

        setPendingProduct(productId);
        setShowDisclosure(true);
    }, [familyId, myRole, showNotif]);

    const confirmStartTrial = useCallback(async () => {
        if (!pendingProduct || !familyId) {
            setShowDisclosure(false);
            return;
        }
        try {
            const purchaseResult = await purchaseSubscription(pendingProduct, { familyId });
            await entitlement.refresh();
            const purchaseStatus = purchaseResult?.entitlement?.status || purchaseResult?.status || "";
            showNotif(
                purchaseStatus === "trial"
                    ? "무료 체험이 시작됐어요! 프리미엄 기능이 열렸습니다."
                    : "프리미엄 기능이 활성화됐어요."
            );
            closeFeatureLock();
            setShowTrialInvite(false);
            setShowSubscriptionSettings(false);
        } catch (error) {
            console.error("[subscription] start trial failed:", error);
            showNotif(error?.message || "구독 시작에 실패했어요", "error");
        } finally {
            setPendingProduct(null);
            setShowDisclosure(false);
        }
    }, [closeFeatureLock, entitlement, familyId, pendingProduct, showNotif]);

    const nativeSetupAction = getNativeSetupAction(nativeNotifHealth);

    const addAlert = useCallback((msg, type = "parent") => {
        const id = Date.now() + Math.random();
        setAlerts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 9000);
    }, []);

    // ── GPS watch (child: native service + web fallback) ──────────────────────
    useEffect(() => {
        if (myRole !== "child" || !authUser?.id || !familyId) return;
        let wid = null;
        let iv = null;
        let lastHistorySave = 0;
        let lastSave = 0;

        const applyPosition = (p) => {
            const newPos = {
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
                updatedAt: new Date().toISOString(),
            };
            setChildPos(newPos);
            if (realtimeChannel.current && realtimeChannel.current.state === "joined") {
                realtimeChannel.current.send({ type: "broadcast", event: "child_location", payload: newPos });
            }
            const now = Date.now();
            if (now - lastSave >= 10000) {
                lastSave = now;
                saveChildLocation(authUser.id, familyId, newPos.lat, newPos.lng);
            }
            if (now - lastHistorySave >= 60000) {
                lastHistorySave = now;
                saveLocationHistory(authUser.id, familyId, newPos.lat, newPos.lng);
            }
        };

        // Try to start native background service (APK only)
        getSession().then(session => {
            const token = session?.access_token || "";
            startNativeLocationService(authUser.id, familyId, token, myRole).then(started => {
                if (started) {
                    console.log("[GPS] Native service running, web GPS as supplement");
                }
            });
        });

        // Web GPS as supplement (updates UI in real-time when app is visible)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                applyPosition,
                () => {},
                { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
            );
            wid = navigator.geolocation.watchPosition(
                applyPosition,
                (err) => {
                    if (err.code === 1) showNotif("📍 위치 권한이 꺼져 있어요. 설정에서 켜주세요!", "error");
                    else if (err.code === 2) showNotif("📍 위치를 찾을 수 없어요. GPS를 확인해주세요", "error");
                    else showNotif("📍 위치 추적 오류가 발생했어요", "error");
                },
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
            );
        }

        return () => {
            if (wid !== null) navigator.geolocation.clearWatch(wid);
            if (iv) clearInterval(iv);
        };
    }, [myRole, authUser?.id, familyId, showNotif]);

    // ── Resolve the current child coordinate to a precise label ───────────────
    useEffect(() => {
        if ((myRole !== "child" && myRole !== "parent") || !childPos) return;

        const fallback = {
            label: formatLatLngLabel(childPos) || "정확한 위치 확인 중",
            shortLabel: "",
            precise: false,
            neighborhood: "",
            updatedAt: childPos.updatedAt || new Date().toISOString(),
        };

        if (!mapReady || !window.kakao?.maps?.services?.Geocoder) {
            return;
        }

        if (lastGeocodePosRef.current) {
            const moved = haversineM(childPos.lat, childPos.lng, lastGeocodePosRef.current.lat, lastGeocodePosRef.current.lng);
            if (moved < 20 && childLocationInfo.label) return;
        }
        lastGeocodePosRef.current = { lat: childPos.lat, lng: childPos.lng };

        let cancelled = false;
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.coord2Address(childPos.lng, childPos.lat, (result, status) => {
            if (cancelled) return;
            if (status === window.kakao.maps.services.Status.OK && result?.[0]) {
                const resolved = extractPreciseAddressFromKakao(result[0], childPos);
                setChildLocationInfo({
                    ...resolved,
                    updatedAt: childPos.updatedAt || new Date().toISOString(),
                });
                const key = getPositionLocationKey(childPos);
                if (key) {
                    setChildLocationLabels(prev => ({
                        ...prev,
                        [key]: { ...resolved, updatedAt: childPos.updatedAt || new Date().toISOString() },
                    }));
                }
                return;
            }
            setChildLocationInfo(fallback);
        });

        return () => {
            cancelled = true;
        };
    }, [myRole, childPos, mapReady, childLocationInfo.label]);

    useEffect(() => {
        if (myRole !== "parent" || !mapReady || !window.kakao?.maps?.services?.Geocoder || displayChildPositions.length === 0) return;
        let cancelled = false;
        const geocoder = new window.kakao.maps.services.Geocoder();

        displayChildPositions.forEach(position => {
            const key = getPositionLocationKey(position);
            if (!key || childLocationLabels[key]?.label) return;

            geocoder.coord2Address(position.lng, position.lat, (result, status) => {
                if (cancelled) return;
                if (status !== window.kakao.maps.services.Status.OK || !result?.[0]) return;

                const resolved = extractPreciseAddressFromKakao(result[0], position);
                setChildLocationLabels(prev => ({
                    ...prev,
                    [key]: {
                        ...resolved,
                        updatedAt: position.updatedAt || new Date().toISOString(),
                    },
                }));
            });
        });

        return () => {
            cancelled = true;
        };
    }, [myRole, mapReady, displayChildLocationKey, childLocationLabels]);

    // ── Parent: fetch child's last known location from DB ─────────────────────
    useEffect(() => {
        if (myRole !== "parent" || !familyId) return;
        let cancelled = false;
        const children = familyInfo?.members?.filter(m => m.role === "child") || [];
        const load = () => {
            fetchChildLocations(familyId).then(locs => {
                if (cancelled || !locs.length) return;
                const latest = locs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
                setChildPos({ lat: latest.lat, lng: latest.lng, updatedAt: latest.updated_at });
                const latestMs = new Date(latest.updated_at).getTime();
                if (Number.isFinite(latestMs)) {
                    setLocationRefreshRequestedAt(prev => (prev && latestMs >= prev ? null : prev));
                }
                const positions = locs.map(loc => {
                    const member = children.find(c => c.user_id === loc.user_id);
                    return { user_id: loc.user_id, name: member?.name || "아이", emoji: member?.emoji || "🐰", lat: loc.lat, lng: loc.lng, updatedAt: loc.updated_at };
                });
                setAllChildPositions(positions);
            }).catch(err => console.error("[fetchChildLocations] failed:", err));
        };
        load();
        const iv = setInterval(load, 10000);
        return () => { cancelled = true; clearInterval(iv); };
    }, [myRole, familyId, familyInfo]);

    // ── Parent: fetch today's location trail ─────────────────────────────────────
    useEffect(() => {
        if (myRole !== "parent" || !familyId || !showChildTracker) return;
        let cancelled = false;
        const load = () => {
            fetchTodayLocationHistory(familyId).then(rows => {
                if (!cancelled) setLocationTrail(rows);
            });
        };
        load();
        const iv = setInterval(load, 30000);
        return () => { cancelled = true; clearInterval(iv); };
    }, [myRole, familyId, showChildTracker]);

    // ── Load stickers for selected date ─────────────────────────────────────────
    useEffect(() => {
        if (!familyId) return;
        fetchStickersForDate(familyId, dateKey).then(s => setStickers(s));
    }, [familyId, dateKey]);

    // ── Load danger zones ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!familyId) return;
        fetchDangerZones(familyId).then(z => setDangerZones(z));
    }, [familyId]);

    // ── Danger zone proximity detection (재진입 시 재알림 지원) ─────────────────
    useEffect(() => {
        if (!childPos || !dangerZones.length || !isParent) return;
        dangerZones.forEach(zone => {
            const dist = haversineM(childPos.lat, childPos.lng, zone.lat, zone.lng);
            const isInside = dist < zone.radius_m;
            const wasFired = firedDangerAlerts.has(zone.id);

            if (isInside && !wasFired) {
                // 진입 → 알림
                setFiredDangerAlerts(prev => new Set([...prev, zone.id]));
                const childName = familyInfo?.members?.find(m => m.role === "child")?.name || "아이";
                addAlert(`⚠️ ${childName}이(가) 위험지역 '${zone.name}' 근처에 있어요! (${Math.round(dist)}m)`, "parent");
                sendInstantPush({
                    action: "parent_alert", familyId, senderUserId: authUser?.id,
                    severity: "emergency",
                    alertType: "danger_zone",
                    title: `⚠️ 위험지역 접근 알림`,
                    message: `${childName}이(가) '${zone.name}' 근처(${Math.round(dist)}m)에 있어요!`,
                });
            } else if (!isInside && wasFired && dist > zone.radius_m * 1.5) {
                // 충분히 벗어남 → 알림 플래그 초기화 (재진입 시 다시 알림)
                setFiredDangerAlerts(prev => { const n = new Set(prev); n.delete(zone.id); return n; });
            }
        });
    }, [childPos, dangerZones, firedDangerAlerts, isParent, familyInfo, familyId, authUser, addAlert]);

    // ── Geofencing: arrival + departure detection ───────────────────────────────
    useEffect(() => {
        if (!childPos) return;
        const iv = setInterval(() => {
            const now = new Date();
            const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
            (events[key] || []).forEach(ev => {
                if (!ev.location) return;
                const dist = haversineM(childPos.lat, childPos.lng, ev.location.lat, ev.location.lng);
                const inside = dist <= ARRIVAL_R;

                // ── Arrival detection (only 30min before ~ event time) ──
                if (inside && !arrivedSet.has(ev.id)) {
                    const [h, m] = ev.time.split(":").map(Number);
                    const evTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
                    const diff = Math.round((now.getTime() - evTime) / 60000);
                    // Only check arrival from 30min before to 10min after event time
                    if (diff < -30 || diff > 10) return;
                    const isEarly = diff <= -10;                     // 10분+ 일찍
                    const isOnTime = diff > -10 && diff <= 0;        // 정시~10분전
                    const isLate = diff > 0;                         // 늦음
                    const msg = isEarly ? `${Math.abs(diff)}분 일찍 도착` : isOnTime ? "정시 도착" : `${diff}분 늦게 도착`;

                    setArrivedSet(prev => new Set([...prev, ev.id]));

                    // Role-based arrival messages
                    if (!isParent && globalNotif.childEnabled) {
                        addAlert(`🎉 ${ev.title}에 도착했어요! (${msg})`, "child");
                        showNotif(`🎉 ${ev.title}에 잘 도착했어! ${isEarly ? "일찍 왔네~ 대단해! 🌟" : isOnTime ? "딱 맞춰 왔구나! ⭐" : "조금 늦었지만 괜찮아! 💪"}`, "child");
                    }
                    if (!isParent) {
                        showArrivalNotification(ev, msg, myRole);
                    }

                    // Award sticker based on arrival timing
                    if (authUser && familyId) {
                        if (isEarly || isOnTime) {
                            const stickerType = isEarly ? "early" : "on_time";
                            const stickerEmoji = isEarly ? "🌟" : "⭐";
                            addSticker(authUser.id, familyId, String(ev.id), key, stickerType, stickerEmoji, ev.title);
                            showNotif(`${stickerEmoji} 칭찬스티커를 받았어요! ${isEarly ? "일찍 도착 보너스!" : "시간 잘 지켰어요!"}`, "child");
                        } else if (isLate) {
                            addSticker(authUser.id, familyId, String(ev.id), key, "late", "😢", ev.title);
                            showNotif("😢 아쉽게 칭찬스티커를 못받았어요...", "child");
                        }
                        setTimeout(() => fetchStickersForDate(familyId, key).then(s => setStickers(s)), 1000);
                    }

                    // Clear departure timer if any
                    if (departureTimers.current[ev.id]) {
                        clearTimeout(departureTimers.current[ev.id].timer);
                        delete departureTimers.current[ev.id];
                    }
                }

                // ── Departure detection (left 50m zone after arriving) ──
                if (!inside && arrivedSet.has(ev.id) && !departedAlerts.has(ev.id)) {
                    // Child left the zone — start countdown
                    if (!departureTimers.current[ev.id]) {
                        departureTimers.current[ev.id] = {
                            leftAt: Date.now(),
                            timer: setTimeout(() => {
                                // Still outside after DEPARTURE_TIMEOUT (1.5 min)?
                                setDepartedAlerts(prev => new Set([...prev, ev.id]));
                                if (isParent) addAlert(`🚨 긴급! 혜니가 ${ev.title} 장소를 벗어났어요!`, "emergency");
                                sendInstantPush({
                                    action: "parent_alert",
                                    familyId, senderUserId: authUser?.id,
                                    severity: "emergency",
                                    alertType: "danger_exit",
                                    title: `🚨 이탈 알림`,
                                    message: `혜니가 ${ev.title} 장소에서 벗어났어요! 확인해주세요.`,
                                });
                                delete departureTimers.current[ev.id];
                            }, DEPARTURE_TIMEOUT_MS),
                        };
                    }
                } else if (inside && departureTimers.current[ev.id]) {
                    // Came back — cancel departure timer
                    clearTimeout(departureTimers.current[ev.id].timer);
                    delete departureTimers.current[ev.id];
                }
            });
        }, 10000); // check every 10s
        return () => clearInterval(iv);
    }, [childPos, events, arrivedSet, globalNotif, addAlert, familyId, authUser, departedAlerts, isParent, myRole, showNotif]);

    // ── Advance notifications (friendly messages) ─────────────────────────────
    useEffect(() => {
        const systemNotificationsActive = pushPermission === "granted";
        if (systemNotificationsActive) return;

        const friendlyChildMsg = (ev, mins) => {
            if (mins === 15) return `🐰 ${ev.emoji} ${ev.title} 가기 15분 전이야! 준비물 챙겼니? 🎒`;
            if (mins === 5) return `🏃 ${ev.emoji} ${ev.title} 곧 시작이야! 출발~ 화이팅! 💪`;
            if (mins >= 60) return `🐰 ${ev.emoji} ${ev.title} ${mins / 60}시간 후에 시작해요!`;
            return `🐰 ${ev.emoji} ${ev.title} ${mins}분 후에 시작해요!`;
        };
        const check = () => {
            if (!myRole) return; // 역할 확정 전에는 실행하지 않음
            const now = new Date(); const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
            const nowMs = now.getTime();
            (events[key] || []).forEach(ev => {
                const [h, m] = ev.time.split(":").map(Number);
                const evMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
                const eff = normalizeNotifSettings(ev.notifOverride, globalNotif);
                eff.minutesBefore.forEach(mins => {
                    const fireKey = `${ev.id}-${mins}`;
                    const fireAt = evMs - mins * 60000;
                    const shouldFireNow = nowMs >= fireAt && nowMs < fireAt + 60_000;
                    if (shouldFireNow && !firedNotifs.has(fireKey)) {
                        setFiredNotifs(prev => new Set([...prev, fireKey]));
                        const label = mins >= 60 ? `${mins / 60}시간` : `${mins}분`;
                        if (!isParent && eff.childEnabled) { showNotif(friendlyChildMsg(ev, mins), "child"); setBounce(true); setTimeout(() => setBounce(false), 800); }
                        if (isParent && eff.parentEnabled) addAlert(`${ev.emoji} ${ev.title} ${label} 전 알림 — ${ev.time} 시작`, "parent");
                    }
                });
            });
        };
        check(); const id = setInterval(check, 30000); return () => clearInterval(id);
    }, [events, globalNotif, firedNotifs, showNotif, addAlert, isParent, myRole, pushPermission]);

    // ── Exact-time parent status (arrived or not arrived) ─────────────────────
    useEffect(() => {
        const systemNotificationsActive = pushPermission === "granted";
        const check = () => {
            if (!myRole) return;
            const now = new Date();
            const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
            const nowMs = now.getTime();

            (events[key] || []).forEach(ev => {
                if (!ev.location || firedExactStatuses.has(ev.id)) return;
                const [h, m] = ev.time.split(":").map(Number);
                const eventTimeMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
                const isExactMinuteWindow = nowMs >= eventTimeMs && nowMs < eventTimeMs + 60_000;
                if (!isExactMinuteWindow) return;

                setFiredExactStatuses(prev => new Set([...prev, ev.id]));

                const arrived = arrivedSet.has(ev.id);
                if (arrived) {
                    if (myRole === "child" && familyId && authUser?.id) {
                        sendInstantPush({
                            action: "parent_alert",
                            familyId,
                            senderUserId: authUser.id,
                            severity: "info",
                            alertType: "arrived",
                            title: `✅ ${ev.emoji} 도착 확인`,
                            message: `${ev.emoji} ${ev.title}에 잘 도착했어요! (${ev.time})`,
                        });
                    }

                    if (isParent && globalNotif.parentEnabled) {
                        addAlert(`✅ 혜니가 ${ev.title}에 잘 도착했어요 (${ev.time})`, "parent");
                        if (!systemNotificationsActive) {
                            showArrivalNotification(ev, "도착 확인", myRole);
                        }
                    }
                    return;
                }

                if (myRole === "child" && familyId && authUser?.id) {
                    sendInstantPush({
                        action: "parent_alert",
                        familyId,
                        senderUserId: authUser.id,
                        severity: "emergency",
                        alertType: "not_arrived",
                        title: `🚨 미도착 긴급 알림`,
                        message: `${ev.emoji} ${ev.title} 시작 시간인데 아직 도착하지 않았어요! (${ev.time})`,
                    });
                }

                if (isParent) {
                    setFiredEmergencies(prev => new Set([...prev, ev.id]));
                }

                if (isParent && globalNotif.parentEnabled) {
                    const shortAddr = (ev.location.address || "").split(" ").slice(0, 4).join(" ");
                    setEmergencies(prev => {
                        if (prev.some(item => item.eventId === ev.id)) return prev;
                        return [...prev, { id: Date.now() + Math.random(), emoji: ev.emoji, title: ev.title, time: ev.time, location: shortAddr, eventId: ev.id }];
                    });
                    addAlert(`🚨 긴급! ${ev.emoji} ${ev.title} 시간인데 아직 미도착!`, "emergency");
                    if (!systemNotificationsActive) {
                        showEmergencyNotification(ev);
                    }
                }
            });
        };

        check();
        const id = setInterval(check, 30_000);
        return () => clearInterval(id);
    }, [events, arrivedSet, firedExactStatuses, familyId, authUser?.id, isParent, myRole, globalNotif, addAlert, pushPermission]);

    // ── Push notification scheduling ────────────────────────────────────────────
    useEffect(() => {
        if (isNativeApp) {
            scheduleNativeAlarms(events, globalNotif, myRole);
        } else if (pushPermission === "granted") {
            scheduleNotifications(events, globalNotif, myRole);
        }
        return () => clearAllScheduled();
    }, [events, globalNotif, pushPermission, myRole, isNativeApp]);

    // ── Voice NLP parser ───────────────────────────────────────────────────────
    // ── AI Voice: parse text via Edge Function, fallback to regex ────────────
    const aiParseVoice = async (text) => {
        if (!AI_PARSE_URL) return null;
        try {
            const session = await getSession();
            const token = session?.access_token || "";
            const todayKey = dateKey;
            const todayEvs = (events[todayKey] || []).map(e => ({ id: e.id, title: e.title, time: e.time, memo: e.memo || "" }));

            const resp = await fetch(AI_PARSE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "apikey": SUPABASE_KEY,
                },
                body: JSON.stringify({
                    text,
                    academies: academies.map(a => ({ name: a.name, category: a.category })),
                    todayEvents: todayEvs,
                    currentDate: { year: currentYear, month: currentMonth, day: selectedDate },
                }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (err) {
            console.warn("[AI] parse failed, using regex fallback:", err.message);
            return null;
        }
    };

    const parseVoiceInputRegex = (text) => {
        let remaining = text.trim();
        // Check for navigation intent first
        if (/길\s*(알려|안내|찾|보여)|다음\s*일정.*길|네비|내비|길찾기/.test(remaining)) {
            return { action: "navigate" };
        }
        let matchedAcademy = null;
        for (const ac of academies) {
            if (remaining.includes(ac.name)) { matchedAcademy = ac; remaining = remaining.replace(ac.name, "").trim(); break; }
        }
        let hour = null, minute = 0;
        const pmM = remaining.match(/오후\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
        const amM = remaining.match(/오전\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
        const pM = remaining.match(/(\d{1,2})시(?:\s*(\d{1,2})분|반)?/);
        const cM = remaining.match(/(\d{1,2}):(\d{2})/);
        if (pmM) { hour = parseInt(pmM[1]); minute = parseInt(pmM[2] || "0"); if (hour < 12) hour += 12; remaining = remaining.replace(pmM[0], "").trim(); }
        else if (amM) { hour = parseInt(amM[1]); minute = parseInt(amM[2] || "0"); if (hour === 12) hour = 0; remaining = remaining.replace(amM[0], "").trim(); }
        else if (cM) { hour = parseInt(cM[1]); minute = parseInt(cM[2]); remaining = remaining.replace(cM[0], "").trim(); }
        else if (pM) { hour = parseInt(pM[1]); const mp = pM[2]; minute = mp === "반" ? 30 : parseInt(mp || "0"); if (hour < 7) hour += 12; remaining = remaining.replace(pM[0], "").trim(); }
        const now = new Date();
        let tY = currentYear, tM = currentMonth, tD = selectedDate;
        const datePs = [
            { re: /내일/, fn: () => { const d = new Date(now); d.setDate(d.getDate() + 1); return d; } },
            { re: /모레/, fn: () => { const d = new Date(now); d.setDate(d.getDate() + 2); return d; } },
            { re: /오늘/, fn: () => new Date(now) },
            { re: /다음\s*주\s*(월|화|수|목|금|토|일)요일/, fn: (m) => { const dm = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }; const d = new Date(now); d.setDate(d.getDate() + (dm[m[1]] - d.getDay() + 7) % 7 + 7); return d; } },
            { re: /(월|화|수|목|금|토|일)요일/, fn: (m) => { const dm = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }; const d = new Date(now); let df = (dm[m[1]] - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + df); return d; } },
            { re: /(\d{1,2})월\s*(\d{1,2})일/, fn: (m) => new Date(now.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2])) },
        ];
        for (const { re, fn } of datePs) {
            const m = remaining.match(re); if (m) { const d = fn(m); tY = d.getFullYear(); tM = d.getMonth(); tD = d.getDate(); remaining = remaining.replace(m[0], "").trim(); break; }
        }
        let guessedCat = matchedAcademy?.category || "other";
        if (!matchedAcademy) {
            const kws = { school: ["학원", "영어", "수학", "피아노", "바이올린", "코딩", "논술", "한자", "미술"], sports: ["태권도", "축구", "수영", "농구", "야구", "배드민턴", "체육"], hobby: ["취미", "그림", "독서", "댄스", "발레"], family: ["가족", "엄마", "아빠", "할머니", "여행"], friend: ["친구", "생일", "파티", "약속"] };
            for (const [cat, ks] of Object.entries(kws)) { if (ks.some(k => remaining.includes(k))) { guessedCat = cat; break; } }
        }
        const stopW = ["에", "을", "를", "이", "가", "은", "는", "추가", "일정", "저장", "등록", "해줘", "해", "좀", "가요", "갈게"];
        let title = matchedAcademy ? matchedAcademy.name : remaining;
        if (!matchedAcademy) stopW.forEach(w => { title = title.replace(new RegExp(w + "$"), "").trim(); });
        title = title.replace(/\s+/g, " ").trim() || text;
        const timeStr = hour !== null ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` : fmtT(now);
        return { action: "add_event", title, time: timeStr, category: guessedCat, year: tY, month: tM, day: tD, academyName: matchedAcademy?.name || null };
    };

    // ── AI: Fetch parent alerts ─────────────────────────────────────────────
    const loadParentAlerts = useCallback(async () => {
        if (!familyId || myRole !== "parent") return;
        try {
            const alerts = await fetchParentAlerts(familyId);
            setParentAlerts(alerts);
        } catch (err) { console.error("[alerts]", err); }
    }, [familyId, myRole]);

    useEffect(() => { loadParentAlerts(); }, [loadParentAlerts]);

    // Poll alerts every 60 seconds for parents
    useEffect(() => {
        if (!familyId || myRole !== "parent") return;
        const interval = setInterval(loadParentAlerts, 60000);
        return () => clearInterval(interval);
    }, [familyId, myRole, loadParentAlerts]);

    // ── AI: Analyze memo sentiment ───────────────────────────────────────────
    const analyzeMemoSentiment = async (memoText, eventTitle) => {
        if (!entitlement.canUse(FEATURES.AI_ANALYSIS)) return;
        if (!aiEnabled || !AI_MONITOR_URL || !familyId || !memoText.trim()) return;
        try {
            const session = await getSession();
            const token = session?.access_token || "";
            const resp = await fetch(AI_MONITOR_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "apikey": SUPABASE_KEY,
                },
                body: JSON.stringify({
                    familyId,
                    analysisType: "memo_sentiment",
                    memoText,
                    eventTitle: eventTitle || "",
                    childName: familyInfo?.members?.find(m => m.role === "child")?.name || "아이",
                }),
            });
            if (!resp.ok) return;
            const result = await resp.json();
            if (result.action === "alert") {
                // Store alert in DB
                const { error } = await supabase.rpc("insert_parent_alert", {
                    p_family_id: familyId,
                    p_alert_type: "memo_" + (result.category || "emotional"),
                    p_title: "🤖 AI: " + result.title,
                    p_message: result.message,
                    p_severity: result.severity || "info",
                });
                if (!error) loadParentAlerts();
            }
        } catch (err) { console.warn("[AI memo analysis]", err.message); }
    };

    // ── AI settings toggle ───────────────────────────────────────────────────
    const toggleAiEnabled = (val) => {
        setAiEnabled(val);
        try { localStorage.setItem("hyeni-ai-enabled", val ? "true" : "false"); } catch { /* ignored */ }
    };

    const openAiSchedule = () => {
        if (!entitlement.canUse(FEATURES.AI_ANALYSIS)) {
            openFeatureLock(FEATURES.AI_ANALYSIS);
            return;
        }
        setShowAiSchedule(true);
    };

    // ── Process AI/regex result → create event or add memo ────────────────────
    const handleVoiceResult = async (parsed, rawText) => {
        if (!parsed || parsed.action === "unknown") {
            showNotif(parsed?.message || "음성을 이해하지 못했어요", "error");
            return;
        }

        // "다음일정까지 길 알려줘" — navigate to next event
        if (parsed.action === "navigate") {
            const todayEvs = (events[dateKey] || []).sort((a, b) => a.time.localeCompare(b.time));
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const nextEv = todayEvs.find(ev => {
                const [h, m] = ev.time.split(":").map(Number);
                return (h * 60 + m) >= nowMin && ev.location;
            }) || todayEvs.find(ev => ev.location);

            if (!nextEv || !nextEv.location) {
                showNotif("길 안내할 일정이 없어요 (위치가 설정된 일정이 필요해요)", "error");
                return;
            }
            setRouteEvent(nextEv);
            showNotif(`🗺️ "${nextEv.title}" 길찾기를 시작할게요!`);
            return;
        }

        if (parsed.action === "add_memo") {
            // Find target event and append memo
            const targetId = parsed.targetEventId;
            const memoText = parsed.memoText || "";
            if (!targetId || !memoText) { showNotif("어떤 일정에 메모할지 모르겠어요", "error"); return; }

            // Find event in today's events
            const todayEvs = events[dateKey] || [];
            const target = todayEvs.find(e => e.id === targetId);
            if (!target) { showNotif("해당 일정을 찾지 못했어요", "error"); return; }

            const newMemoVal = target.memo ? target.memo + "\n" + memoText : memoText;
            setEvents(prev => {
                const updated = { ...prev };
                updated[dateKey] = (updated[dateKey] || []).map(e =>
                    e.id === targetId ? { ...e, memo: newMemoVal } : e
                );
                return updated;
            });

            if (familyId && authUser) {
                try {
                    // Phase 5.5 MEMO-FIX-01: voice add_memo previously dual-wrote to
                    // events.memo AND legacy public.memos. The public.memos write is
                    // the same dead-end table whose UI we removed. Voice memos remain
                    // persistent via events.memo (events table is live and displayed).
                    await updateEvent(targetId, { memo: newMemoVal });
                } catch (err) { console.error("[voiceMemo] save error:", err); }
            }

            showNotif(`✏️ "${target.title}" 메모에 추가했어요: ${memoText}`);
            setBounce(true); setTimeout(() => setBounce(false), 800);
            return;
        }

        // action === "add_event"
        const matchedAcademy = parsed.academyName
            ? academies.find(a => a.name === parsed.academyName) : null;
        const catId = parsed.category || "other";
        const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES.find(c => c.id === "other");
        const evYear = parsed.year ?? currentYear;
        const evMonth = parsed.month ?? currentMonth;
        const evDay = parsed.day ?? selectedDate;
        const dk = `${evYear}-${evMonth}-${evDay}`;
        const timeStr = parsed.time || fmtT(new Date());

        const ev = {
            id: generateUUID(), title: parsed.title, time: timeStr,
            category: catId, emoji: matchedAcademy?.emoji || cat.emoji,
            color: cat.color, bg: cat.bg, memo: parsed.memo || "",
            location: matchedAcademy?.location || null, notifOverride: null,
        };

        setEvents(prev => ({ ...prev, [dk]: [...(prev[dk] || []), ev].sort((a, b) => a.time.localeCompare(b.time)) }));
        const dateLabel = `${evMonth + 1}월 ${evDay}일`;
        setVoicePreview({ ev, dateKey: dk, dateLabel, rawText, academyMatched: !!matchedAcademy, aiParsed: true });
        showNotif(!isParent ? "🐰 알겠어! 일정 추가했어!" : `${ev.emoji} ${parsed.title} 추가 완료`);
        setBounce(true); setTimeout(() => setBounce(false), 800);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setTimeout(() => setVoicePreview(null), 8000);

        if (familyId && authUser) {
            try {
                await insertEvent(ev, familyId, dk, authUser.id);
                maybeOpenTrialInvite();
                sendInstantPush({
                    action: "new_event", familyId, senderUserId: authUser.id,
                    title: `🤖 새 일정: ${ev.emoji} ${parsed.title}`,
                    message: `${dateLabel} ${ev.time}에 "${parsed.title}" 일정이 추가됐어요 (AI 음성)`,
                });
            } catch (err) {
                console.error("[voiceEvent] Supabase error:", err);
                // Rollback
                setEvents(prev => {
                    const updated = { ...prev };
                    updated[dk] = (updated[dk] || []).filter(e => e.id !== ev.id);
                    if (updated[dk].length === 0) delete updated[dk];
                    return updated;
                });
                showNotif("서버 저장 실패", "error");
            }
        }
    };

    const undoVoiceEvent = () => {
        if (!voicePreview) return;
        setEvents(prev => ({ ...prev, [voicePreview.dateKey]: (prev[voicePreview.dateKey] || []).filter(e => e.id !== voicePreview.ev.id) }));
        if (familyId && voicePreview.ev?.id) {
            dbDeleteEvent(voicePreview.ev.id).catch(() => {});
        }
        setVoicePreview(null); showNotif("↩ 일정을 취소했어요");
    };

    const startVoice = async () => {
        let transcript = null;

        // Try native Capacitor SpeechRecognition first (Android WebView)
        try {
            const { Capacitor, registerPlugin } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const SpeechRecognition = registerPlugin("SpeechRecognition");
                setListening(true);
                try {
                    const result = await SpeechRecognition.start({ language: "ko-KR" });
                    setListening(false);
                    transcript = result?.transcript || null;
                } catch (err) {
                    setListening(false);
                    showNotif(err?.message || "음성 인식 실패", "error");
                    return;
                }
                if (!transcript) { showNotif("음성을 인식하지 못했어요", "error"); return; }
            }
        } catch { /* not native */ }

        // Fallback: Web Speech API (Chrome browser)
        if (!transcript) {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                if (isIOS) {
                    showNotif("아이폰 Safari에서는 음성인식이 지원되지 않아요. 텍스트로 입력해주세요!", "error");
                } else {
                    showNotif("음성인식을 지원하지 않아요 (Chrome 브라우저를 사용해주세요)", "error");
                }
                return;
            }
            transcript = await new Promise((resolve) => {
                const rec = new SR(); rec.lang = "ko-KR"; rec.interimResults = false;
                rec.onresult = (e) => { setListening(false); resolve(e.results[0][0].transcript); };
                rec.onerror = () => { setListening(false); resolve(null); };
                rec.onend = () => setListening(false);
                rec.start(); setListening(true);
            });
            if (!transcript) { showNotif("음성 인식 실패", "error"); return; }
        }

        // Try AI parsing first (if enabled), fall back to regex
        let parsed;
        if (aiEnabled) {
            showNotif("🤖 AI 분석 중...");
            parsed = await aiParseVoice(transcript);
        }
        if (!parsed || parsed.error) {
            parsed = parseVoiceInputRegex(transcript);
        }

        await handleVoiceResult(parsed, transcript);
    };

    // ── dateKey helper: add N days to a dateKey string ─────────────────────────
    const addDaysToDateKey = (dk, days) => {
        const [y, m, d] = dk.split("-").map(Number);
        const date = new Date(y, m, d + days);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    };

    // ── Add event (manual) ─────────────────────────────────────────────────────
    const addEvent = async () => {
        const title = newTitle.trim() || (selectedPreset ? selectedPreset.label : "");
        if (!title) { showNotif("일정 이름을 입력해 줘요! 🐰", "error"); return; }
        const cat = CATEGORIES.find(c => c.id === newCategory);
        const emoji = selectedPreset ? selectedPreset.emoji : cat.emoji;

        const totalWeeks = weeklyRepeat ? repeatWeeks : 1;
        const allEvents = [];
        for (let w = 0; w < totalWeeks; w++) {
            const dk = w === 0 ? dateKey : addDaysToDateKey(dateKey, w * 7);
            allEvents.push({ ev: { id: generateUUID(), title, time: newTime, endTime: newEndTime || null, category: newCategory, emoji, color: cat.color, bg: cat.bg, memo: newMemo.trim(), location: newLocation, notifOverride: null }, dateKey: dk });
        }

        // Optimistic local update
        setEvents(prev => {
            const updated = { ...prev };
            for (const { ev, dateKey: dk } of allEvents) {
                updated[dk] = [...(updated[dk] || []), ev].sort((a, b) => a.time.localeCompare(b.time));
            }
            return updated;
        });
        setNewTitle(""); setNewTime("09:00"); setNewEndTime(""); setNewCategory("school"); setNewMemo(""); setNewLocation(null); setSelectedPreset(null); setWeeklyRepeat(false); setRepeatWeeks(4);
        setShowAddModal(false);
        showNotif(weeklyRepeat ? `✨ ${totalWeeks}주 반복 일정이 추가됐어요!` : "✨ 일정이 추가됐어요!");
        setBounce(true); setTimeout(() => setBounce(false), 800);

        // Persist to Supabase (Realtime will sync to other device)
        if (familyId && authUser) {
            try {
                for (const { ev, dateKey: dk } of allEvents) {
                    await insertEvent(ev, familyId, dk, authUser.id);
                }
                maybeOpenTrialInvite();
                sendInstantPush({
                    action: "new_event",
                    familyId,
                    senderUserId: authUser.id,
                    title: `📅 새 일정: ${emoji} ${title}`,
                    message: weeklyRepeat
                        ? `${dateKey.replace(/-/g, "/")}부터 매주 ${totalWeeks}주간 "${title}" 일정이 추가됐어요`
                        : `${dateKey.replace(/-/g, "/")} ${newTime}에 "${title}" 일정이 추가됐어요`,
                });
            } catch (err) {
                console.error("[addEvent] Supabase error:", err);
                setEvents(prev => {
                    const updated = { ...prev };
                    for (const { ev, dateKey: dk } of allEvents) {
                        updated[dk] = (updated[dk] || []).filter(e => e.id !== ev.id);
                        if (updated[dk].length === 0) delete updated[dk];
                    }
                    return updated;
                });
                showNotif("서버 저장에 실패했어요. 다시 시도해주세요", "error");
            }
        }
    };

    const handleDeleteEvent = async (id) => {
        setEvents(prev => ({ ...prev, [dateKey]: (prev[dateKey] || []).filter(e => e.id !== id) }));
        showNotif("🗑️ 일정을 지웠어요");
        if (familyId) {
            try { await dbDeleteEvent(id); } catch (err) { console.error("[deleteEvent]", err); }
        }
    };

    const updateEvField = async (id, field, value) => {
        setEvents(prev => { const out = {}; Object.entries(prev).forEach(([k, evs]) => { out[k] = evs.map(e => e.id === id ? { ...e, [field]: value } : e); }); return out; });
        if (familyId) {
            try { await updateEvent(id, { [field]: value }); } catch (err) { console.error("[updateEvField]", err); }
        }
    };

    const prevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); };
    const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); };
    const getDays = getDIM(currentYear, currentMonth);
    const firstDay = getFD(currentYear, currentMonth);
    const getEvs = (d) => events[`${currentYear}-${currentMonth}-${d}`] || [];
    const selectedEvs = events[dateKey] || [];

    // CSS helpers
    const contentMaxWidth = isParent ? 720 : 460;
    const inputSt = makeInputStyle();
    const labelSt = { fontSize: 12, fontWeight: 800, color: DESIGN.colors.muted, marginBottom: 6, display: "block" };
    const cardSt = makeCardStyle({ width: "100%", maxWidth: contentMaxWidth, padding: 20, marginBottom: 14 });
    const primBtn = makePrimaryButtonStyle({ marginTop: 16 });
    const secBtn = makeSecondaryButtonStyle({ marginTop: 8, background: "#F8FAFC" });
    const todayDateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const todayEvents = events[todayDateKey] || [];
    const todayDateLabel = today.toLocaleDateString("ko-KR", { weekday: "long", month: "long", day: "numeric" });
    const nowMinutes = today.getHours() * 60 + today.getMinutes();
    const nextTodayEvent = todayEvents.find((event) => {
        const [hour, minute] = String(event.time || "00:00").split(":").map(Number);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return true;
        return (hour * 60 + minute) >= nowMinutes;
    }) || todayEvents[0] || null;
    const childHeroRemaining = todayEvents.filter((event) => {
        const [hour, minute] = String(event.time || "00:00").split(":").map(Number);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return true;
        return (hour * 60 + minute) >= nowMinutes;
    }).length;
    const childHeroMessage = (() => {
        const hour = today.getHours();
        if (hour < 6) return { line1: "푹 쉬어도", line2: "괜찮아" };
        if (hour < 10) return { line1: "좋은 아침이야", line2: "오늘도 네 편이야" };
        if (hour < 12) return { line1: "천천히 해도", line2: "잘하고 있어" };
        if (hour < 14) return { line1: "점심 맛있게", line2: "챙겨 먹자" };
        if (hour < 17) return { line1: "조금만 더", line2: "힘내보자" };
        if (hour < 20) return { line1: "오늘 하루도", line2: "수고했어" };
        if (hour < 22) return { line1: "편안한 저녁", line2: "보내자" };
        return { line1: "좋은 꿈 꿀", line2: "준비하자" };
    })();
    const childNextScheduleLabel = nextTodayEvent
        ? `다음 일정 ${nextTodayEvent.time ? `${nextTodayEvent.time} · ` : ""}${nextTodayEvent.title}`
        : "다음 일정 없음";
    const heroChildrenText = pairedChildren.length > 0
        ? pairedChildren.map(child => child.name || "아이").join(" · ")
        : (familyInfo?.myName || "가족");
    const parentHeroChildrenText = pairedChildren.length > 2
        ? `${pairedChildren[0]?.name || "아이"} 외 ${pairedChildren.length - 1}명`
        : pairedChildren.length === 2
            ? `${pairedChildren[0]?.name || "아이"}와 ${pairedChildren[1]?.name || "아이"}`
            : heroChildrenText;
    const heroTitle = isParent ? "오늘의 가족" : "오늘은 뭐해?";
    const childCurrentLocationLabel = childPos
        ? (childLocationInfo.label || formatLatLngLabel(childPos) || "정확한 위치 확인 중")
        : "GPS 위치 확인 중";
    const childCurrentLocationMeta = childPos
        ? [
            childLocationInfo.precise ? "도로명 기준" : "좌표 기준",
            childPos.updatedAt ? `${getRelativeTime(childPos.updatedAt)} 업데이트` : "",
        ].filter(Boolean).join(" · ")
        : "위치 권한을 허용하면 현재 위치를 바로 확인해요";
    const heroLine = isParent
        ? (displayChildPos ? "· 실시간 추적중" : "· 위치 연결 대기")
        : "오늘의 안전 체크";
    const heroSubLine = isParent
        ? (displayChildPos ? "아이 위치가 연결되어 있어요" : "아이 위치를 기다리고 있어요")
        : (nextTodayEvent ? `다음 일정 · ${nextTodayEvent.title}` : "오늘 일정 확인");
    const getEventStartMinutes = (event) => {
        const [hour, minute] = String(event?.time || "00:00").split(":").map(Number);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.POSITIVE_INFINITY;
        return hour * 60 + minute;
    };
    const getEventEndMinutes = (event) => {
        if (!event?.endTime) return getEventStartMinutes(event) + 60;
        const [hour, minute] = String(event.endTime).split(":").map(Number);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return getEventStartMinutes(event) + 60;
        return hour * 60 + minute;
    };
    const formatDashboardTime = (event) => event?.endTime ? `${event.time} – ${event.endTime}` : event?.time || "";
    const formatDashboardFutureOffset = (minutesUntilStart) => {
        const totalMinutes = Math.max(1, Math.ceil(minutesUntilStart));
        if (totalMinutes < 60) return `${totalMinutes}분 뒤`;
        if (totalMinutes < 1440) {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return minutes > 0 ? `${hours}시간 ${minutes}분 뒤` : `${hours}시간 뒤`;
        }
        return `${Math.max(1, Math.floor(totalMinutes / 1440))}일 뒤`;
    };
    const todayEventsSorted = [...todayEvents].sort((left, right) => getEventStartMinutes(left) - getEventStartMinutes(right));
    const remainingTodayCount = todayEventsSorted.filter(event => getEventEndMinutes(event) >= nowMinutes).length;
    const nextTodayEventMinutes = nextTodayEvent ? getEventStartMinutes(nextTodayEvent) : null;
    const heroInsightText = nextTodayEvent && Number.isFinite(nextTodayEventMinutes)
        ? nextTodayEventMinutes > nowMinutes
            ? `다음 일정 ${formatDashboardFutureOffset(nextTodayEventMinutes - nowMinutes)}`
            : "지금 진행 중인 일정"
        : "오늘 일정 확인";
    const getDashboardEventElementId = (eventId) => `hyeni-dashboard-event-${String(eventId || "").replace(/[^A-Za-z0-9_-]/g, "-")}`;
    const handleHeroInsightClick = () => {
        setActiveView("calendar");
        setCurrentYear(today.getFullYear());
        setCurrentMonth(today.getMonth());
        setSelectedDate(today.getDate());

        if (!nextTodayEvent) {
            setShowAddModal(true);
            return;
        }

        window.requestAnimationFrame(() => {
            const target = document.getElementById(getDashboardEventElementId(nextTodayEvent.id));
            if (target instanceof HTMLElement) {
                target.scrollIntoView({ behavior: "auto", block: "center" });
                target.focus({ preventScroll: true });
            }
        });

        showNotif(`${nextTodayEvent.title} 일정을 아래에서 확인해요`);
    };
    const handleParentCalendarTabClick = () => {
        setShowParentMemoPage(false);
        setActiveView("parentCalendar");
        setCurrentYear(today.getFullYear());
        setCurrentMonth(today.getMonth());
        setSelectedDate(today.getDate());
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "auto" });
        });
    };
    const handleParentTodayTabClick = () => {
        setShowParentMemoPage(false);
        setActiveView("calendar");
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "auto" });
        });
    };
    const handleParentMapTabClick = () => {
        setShowParentMemoPage(false);
        setActiveView("maplist");
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "auto" });
        });
    };
    const handleParentMemoOpen = () => {
        setShowParentMemoPage(true);
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "auto" });
        });
    };
    const handleParentFamilyTabClick = () => {
        setShowParentMemoPage(false);
        setShowPairing(true);
    };
    const renderParentBottomTabbar = (activeTab = "today", extraClassName = "") => (
        <nav className={`hyeni-v5-tabbar${extraClassName ? ` ${extraClassName}` : ""}`} aria-label="부모 메인 탭">
            <button type="button" className={activeTab === "today" ? "active" : undefined} onClick={handleParentTodayTabClick} style={{ fontFamily: FF }}>
                <span aria-hidden="true">🏠</span>오늘
            </button>
            <button type="button" className={activeTab === "calendar" ? "active" : undefined} onClick={handleParentCalendarTabClick} style={{ fontFamily: FF }}>
                <span aria-hidden="true">📅</span>캘린더
            </button>
            <button type="button" className={activeTab === "maplist" ? "active" : undefined} onClick={handleParentMapTabClick} style={{ fontFamily: FF }}>
                <span aria-hidden="true">📍</span>위치
            </button>
            <button
                type="button"
                className={activeTab === "memo" ? "active" : undefined}
                onClick={handleParentMemoOpen}
                style={{ fontFamily: FF }}
            >
                <span aria-hidden="true">💬</span>메모
            </button>
            <button type="button" className={activeTab === "family" ? "active" : undefined} onClick={handleParentFamilyTabClick} style={{ fontFamily: FF }}>
                <span aria-hidden="true">👨‍👩‍👧</span>가족
            </button>
        </nav>
    );
    const dashboardChildren = (pairedChildren.length > 0 ? pairedChildren : [{ user_id: "pending-child", name: "아이", emoji: "👧" }]).slice(0, 2);
    const getDashboardChildPosition = (child, index) => {
        const matched = displayChildPositions.find(pos => pos.user_id && pos.user_id === child.user_id);
        if (matched) return matched;
        if (index === 0) return displayChildPos;
        return null;
    };
    const getDashboardChildLocationLabel = (child, index) => {
        const pos = getDashboardChildPosition(child, index);
        if (!pos) return "위치 대기";
        const resolvedLocation = childLocationLabels[getPositionLocationKey(pos)];
        if (resolvedLocation?.shortLabel || resolvedLocation?.label) {
            return resolvedLocation.shortLabel || buildCompactAddressLabel({ road_address: { address_name: resolvedLocation.label } }) || resolvedLocation.label;
        }
        if (index === 0) {
            const primaryLocation = childLocationInfo.shortLabel || childLocationInfo.neighborhood || extractNeighborhoodLabel(childLocationInfo.label);
            if (primaryLocation) return primaryLocation;
        }
        return extractNeighborhoodLabel(pos.label, pos) || "주소 확인 중";
    };
    const getDashboardEventDistance = (event) => {
        if (!displayChildPos || !event?.location) return "";
        const dist = haversineM(displayChildPos.lat, displayChildPos.lng, event.location.lat, event.location.lng);
        return dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${Math.round(dist)}m`;
    };
    const getDashboardEventDate = (event, timeValue) => {
        const eventDateKey = event?.dateKey || event?.date_key || dateKey;
        const [year, month, day] = String(eventDateKey || "").split("-").map(Number);
        const [hour, minute] = String(timeValue || "00:00").split(":").map(Number);
        if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
        return new Date(year, month, day, hour, minute);
    };
    const getDashboardEventWindow = (event) => {
        const startDate = getDashboardEventDate(event, event?.time);
        if (!startDate) return null;
        const endDate = event?.endTime
            ? getDashboardEventDate(event, event.endTime)
            : new Date(startDate.getTime() + 60 * 60_000);
        if (!endDate) return { startDate, endDate: new Date(startDate.getTime() + 60 * 60_000) };
        if (endDate.getTime() < startDate.getTime()) endDate.setDate(endDate.getDate() + 1);
        return { startDate, endDate };
    };
    const getDashboardEventStatus = (event) => {
        const start = getEventStartMinutes(event);
        const end = getEventEndMinutes(event);
        if (event?.location && !arrivedSet.has(event.id) && firedEmergencies.has(event.id)) return { label: "미도착", tone: "danger", current: false, past: false };
        if (arrivedSet.has(event.id)) return { label: "도착 ✓", tone: "good", current: false, past: false };
        const eventWindow = getDashboardEventWindow(event);
        if (eventWindow) {
            const nowTime = today.getTime();
            const startTime = eventWindow.startDate.getTime();
            const endTime = eventWindow.endDate.getTime();
            if (nowTime >= startTime && nowTime <= endTime) return { label: "진행중", tone: "now", current: true, past: false };
            if (startTime > nowTime) return { label: formatDashboardFutureOffset((startTime - nowTime) / 60_000), tone: "next", current: false, past: false };
            return { label: "완료", tone: "done", current: false, past: true };
        }
        if (nowMinutes >= start && nowMinutes <= end) return { label: "진행중", tone: "now", current: true, past: false };
        if (start > nowMinutes) return { label: formatDashboardFutureOffset(start - nowMinutes), tone: "next", current: false, past: false };
        return { label: "완료", tone: "done", current: false, past: true };
    };
    const selectedEventsSorted = [...selectedEvs].sort((left, right) => getEventStartMinutes(left) - getEventStartMinutes(right));
    const selectedCalendarDate = new Date(currentYear, currentMonth, selectedDate);
    const selectedCalendarDateLabel = `${currentMonth + 1}월 ${selectedDate}일 ${DAYS_KO[selectedCalendarDate.getDay()]}요일`;
    const renderParentCalendarGrid = (keyPrefix = "parent") => (
        <div className="hyeni-v5-calendar-card">
            <div className="hyeni-v5-calendar-card-head">
                <div>
                    <div className="hyeni-v5-calendar-year">{currentYear}</div>
                    <div className="hyeni-v5-calendar-month">{MONTHS_KO[currentMonth]}</div>
                </div>
                <div className="hyeni-v5-calendar-nav">
                    <button type="button" onClick={prevMonth} aria-label="이전 달">‹</button>
                    <button type="button" onClick={nextMonth} aria-label="다음 달">›</button>
                </div>
            </div>
            <div className="hyeni-v5-calendar-weekdays">
                {DAYS_KO.map((d, i) => (
                    <div key={d} className={i === 0 ? "sun" : i === 6 ? "sat" : undefined}>{d}</div>
                ))}
            </div>
            <div className="hyeni-v5-calendar-grid">
                {Array(firstDay).fill(null).map((_, i) => <div key={`${keyPrefix}-empty-${i}`} className="hyeni-v5-calendar-empty-cell" />)}
                {Array(getDays).fill(null).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                    const isSel = day === selectedDate;
                    const isSun = (firstDay + i) % 7 === 0;
                    const isSat = (firstDay + i) % 7 === 6;
                    const dayEvs = getEvs(day);
                    const highlightedCell = isSel || isToday;
                    return (
                        <button
                            key={`${keyPrefix}-${day}`}
                            type="button"
                            onClick={() => setSelectedDate(day)}
                            className={`hyeni-v5-calendar-day${isToday ? " today" : ""}${isSel ? " selected" : ""}${isSun ? " sun" : ""}${isSat ? " sat" : ""}`}
                            aria-label={`${currentMonth + 1}월 ${day}일${dayEvs.length ? ` 일정 ${dayEvs.length}개` : ""}`}
                            style={{ fontFamily: FF }}
                        >
                            <span>{day}</span>
                            {dayEvs.length > 0 && (
                                <span className="hyeni-v5-calendar-dots">
                                    {dayEvs.slice(0, 3).map(e => (
                                        <span key={e.id} style={{ background: highlightedCell ? "rgba(255,255,255,0.9)" : e.color }} />
                                    ))}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
    const renderParentScheduleCard = (event) => {
        const status = getDashboardEventStatus(event);
        const distanceLabel = getDashboardEventDistance(event);
        const statusStyle = status.tone === "good"
            ? { background: DESIGN.colors.successPale, color: DESIGN.colors.success }
            : status.tone === "danger"
                ? { background: DESIGN.colors.dangerPale, color: DESIGN.colors.danger }
                : status.tone === "done"
                    ? { background: "#F3F4F6", color: DESIGN.colors.muted }
                    : null;
        const whoLabel = pairedChildren[0]?.name || "아이";
        return (
            <div
                key={event.id}
                id={getDashboardEventElementId(event.id)}
                role={event.location ? "button" : "group"}
                tabIndex={event.location ? 0 : -1}
                onClick={() => { if (event.location) setRouteEvent(event); }}
                onKeyDown={(keyboardEvent) => {
                    if (!event.location) return;
                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                        keyboardEvent.preventDefault();
                        setRouteEvent(event);
                    }
                }}
                className={`hyeni-v5-event-card${status.current ? " is-current" : ""}${status.past ? " is-past" : ""}`}
                style={{ "--event-color": event.color || DESIGN.colors.pink, "--event-bg": event.bg || DESIGN.colors.pinkSoft, fontFamily: FF }}
            >
                <div className="hyeni-v5-event-icon">{event.emoji || "📌"}</div>
                <div className="hyeni-v5-event-body">
                    <div className="hyeni-v5-event-title">
                        <span className="hyeni-v5-event-title-text">{event.title}</span>
                        <span className="hyeni-v5-event-who">{whoLabel}</span>
                    </div>
                    <div className="hyeni-v5-event-meta">
                        <span className="hyeni-v5-event-time">{formatDashboardTime(event)}</span>
                        <span className="hyeni-v5-event-location">
                            {event.location?.address ? ` · ${event.location.address}` : " · 장소 미지정"}
                        </span>
                    </div>
                    <div className="hyeni-v5-event-chips">
                        {distanceLabel && <span className="hyeni-v5-chip distance">📍 {distanceLabel}</span>}
                        {event.memo && <span className="hyeni-v5-chip memo">📝 메모</span>}
                    </div>
                </div>
                <div className="hyeni-v5-event-tag" style={statusStyle || undefined}>{status.label}</div>
                <button
                    type="button"
                    className="hyeni-v5-event-delete"
                    aria-label={`${event.title} 일정 삭제`}
                    onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        handleDeleteEvent(event.id);
                    }}
                >
                    ×
                </button>
            </div>
        );
    };
    const latestMemoReply = memoReplies?.length ? memoReplies[memoReplies.length - 1] : null;
    const memoPreviewText = latestMemoReply?.content || currentMemo || "새 메모 없음";
    const memoPreviewMeta = latestMemoReply
        ? `${latestMemoReply.user_role === "parent" ? "부모" : "아이"} · ${getRelativeTime(latestMemoReply.created_at)}`
        : "";
    const handleMemoReplySubmit = useCallback((content) => {
        if (!familyId || !authUser) return Promise.resolve();
        const origin = (memoReplies && memoReplies.length > 0) ? "reply" : "original";
        const optimisticReply = {
            id: "temp-" + Date.now(),
            user_id: authUser.id,
            user_role: myRole,
            content,
            created_at: new Date().toISOString(),
            origin,
            read_by: [],
        };
        setMemoReplies(prev => [...(prev || []), optimisticReply]);
        const sendPromise = sendMemo(familyId, dateKey, content, authUser.id, myRole, origin)
            .then(() => {
                if (myRole === "child" && aiEnabled) {
                    try { analyzeMemoSentiment(content, ""); } catch (_) { /* ignore */ }
                }
                return fetchMemoReplies(familyId, dateKey).then(setMemoReplies);
            })
            .catch(err => { console.error("[reply]", err); throw err; });
        sendInstantPush({
            action: "new_memo",
            familyId,
            senderUserId: authUser.id,
            title: `💬 ${myRole === "parent" ? "부모님" : "아이"}이 답글을 남겼어요`,
            message: content.length > 50 ? content.substring(0, 50) + "..." : content,
        });
        return sendPromise;
    }, [familyId, authUser, memoReplies, myRole, dateKey, aiEnabled]);

    const TABS = [["calendar", "📅 달력"], ["maplist", "📍 장소"]];
    const quickPanelTone = isParent
        ? { bg: "rgba(255,255,255,0.88)", border: DESIGN.colors.pinkLine, color: DESIGN.colors.brand }
        : { bg: "rgba(255,255,255,0.88)", border: "#FED7AA", color: "#C2410C" };
    const quickModeActions = TABS.map(([view, label]) => {
        const [icon, text] = label.split(" ");
        return {
            key: view,
            icon,
            label: text,
            ariaLabel: label,
            active: activeView === view,
            onClick: () => setActiveView(view),
        };
    });
    const quickUtilityActions = [
        activeView !== "calendar" ? {
            key: "home",
            icon: "🏠",
            label: "홈",
            ariaLabel: "🏠 홈",
            palette: { bg: "linear-gradient(135deg,#FFF0F7,#FCE7F3)", color: "#BE185D", shadow: "rgba(232,121,160,0.16)" },
            onClick: () => setActiveView("calendar"),
        } : null,
        isParent ? {
            key: "child-tracker",
            icon: "📍",
            label: "우리아이",
            ariaLabel: "📍 우리아이",
            palette: { bg: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", color: "#1D4ED8", shadow: "rgba(59,130,246,0.16)" },
            onClick: () => setShowChildTracker(true),
        } : null,
        isParent ? {
            key: "academy",
            icon: "🏫",
            label: "학원관리",
            ariaLabel: "🏫 학원관리",
            palette: { bg: "linear-gradient(135deg,#FEF3C7,#FDE68A)", color: "#92400E", shadow: "rgba(245,158,11,0.18)" },
            onClick: () => {
                if (academies.length === 0 && !entitlement.canUse(FEATURES.ACADEMY_SCHEDULE)) {
                    openFeatureLock(FEATURES.ACADEMY_SCHEDULE);
                    return;
                }
                setShowAcademyMgr(true);
            },
        } : null,
        {
            key: "stickers",
            icon: "🏆",
            label: "스티커",
            ariaLabel: "🏆 스티커",
            palette: { bg: "linear-gradient(135deg,#FEF3C7,#FDE68A)", color: "#92400E", shadow: "rgba(251,191,36,0.16)" },
            onClick: () => {
                setShowStickerBook(true);
                if (familyId) {
                    fetchStickersForDate(familyId, dateKey).then(s => setStickers(s));
                    fetchStickerSummary(familyId).then(s => setStickerSummary(s?.[0] || null));
                }
            },
        },
        {
            key: "notifications",
            icon: "🔔",
            label: "일정알림",
            ariaLabel: "🔔 일정알림",
            palette: { bg: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", color: DESIGN.colors.parentDeep, shadow: "rgba(37,99,235,0.16)" },
            onClick: () => setShowNotifSettings(true),
        },
        isParent ? {
            key: "subscription",
            icon: "💎",
            label: "구독",
            ariaLabel: "💎 구독",
            palette: { bg: "linear-gradient(135deg,#FFF0F7,#FCE7F3)", color: DESIGN.colors.brand, shadow: "rgba(190,24,93,0.14)" },
            onClick: () => setShowSubscriptionSettings(true),
        } : null,
        isParent ? {
            key: "contacts",
            icon: "📞",
            label: "연락처",
            ariaLabel: "📞 연락처",
            palette: { bg: "linear-gradient(135deg,#FDF2F8,#FCE7F3)", color: "#BE185D", shadow: "rgba(236,72,153,0.15)" },
            onClick: () => setShowPhoneSettings(true),
        } : null,
        isParent ? {
            key: "remote-audio",
            icon: "🎙️",
            label: "주변소리",
            ariaLabel: "🎙️ 주변소리",
            palette: { bg: "linear-gradient(135deg,#FEF2F2,#FEE2E2)", color: "#DC2626", shadow: "rgba(239,68,68,0.15)" },
            onClick: () => {
                if (!entitlement.canUse(FEATURES.REMOTE_AUDIO)) {
                    openFeatureLock(
                        FEATURES.REMOTE_AUDIO,
                        "",
                        "주변 소리 듣기는 프리미엄 회원만 사용할 수 있어요. 프리미엄을 시작하면 아이 기기 주변 소리를 최대 1분 동안 확인할 수 있어요."
                    );
                    return;
                }
                setShowRemoteAudio(true);
            },
        } : null,
        isParent ? {
            key: "danger-zones",
            icon: "⚠️",
            label: "위험지역",
            ariaLabel: "⚠️ 위험지역",
            palette: { bg: "linear-gradient(135deg,#FFF1F2,#FFE4E6)", color: "#E11D48", shadow: "rgba(244,63,94,0.15)" },
            onClick: () => setShowDangerZones(true),
        } : null,
        isParent ? {
            key: "feedback",
            icon: "💌",
            label: "피드백",
            ariaLabel: "💌 피드백 보내기",
            palette: { bg: "linear-gradient(135deg,#FDF2F8,#FCE7F3)", color: "#BE185D", shadow: "rgba(244,114,182,0.16)" },
            onClick: () => setShowFeedbackModal(true),
        } : null,
    ].filter(Boolean);
    const quickUtilityColumns = isParent ? "repeat(4, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))";
    const renderQuickAction = (action, type = "utility") => {
        const isMode = type === "mode";
        return (
            <button
                key={action.key}
                type="button"
                aria-label={action.ariaLabel}
                onClick={action.onClick}
                style={{
                    border: isMode ? "none" : `1px solid ${DESIGN.colors.pinkLine}`,
                    cursor: "pointer",
                    fontFamily: FF,
                    borderRadius: isMode ? DESIGN.radius.lg : DESIGN.radius.xl,
                    minHeight: isMode ? 68 : (isParent ? 82 : 88),
                    padding: isMode ? "12px 10px" : (isParent ? "12px 6px 10px" : "14px 8px 12px"),
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: isMode ? 4 : 6,
                    textAlign: "center",
                    whiteSpace: "normal",
                    lineHeight: 1.18,
                    background: isMode
                        ? (action.active ? DESIGN.gradients.primary : "rgba(255,255,255,0.88)")
                        : action.palette.bg,
                    color: isMode ? (action.active ? "white" : DESIGN.colors.muted) : action.palette.color,
                    boxShadow: isMode
                        ? (action.active ? "0 10px 20px rgba(232,121,160,0.22)" : "inset 0 0 0 1px rgba(226,232,240,0.85)")
                        : `0 10px 22px ${action.palette.shadow}`,
                }}
            >
                <span aria-hidden="true" style={{ fontSize: isMode ? (isParent ? 18 : 20) : (isParent ? 20 : 22), lineHeight: 1 }}>
                    {action.icon}
                </span>
                <span style={{ fontSize: isMode ? 12 : (isParent ? 11 : 12), fontWeight: action.active ? 800 : 700, letterSpacing: -0.2, wordBreak: "keep-all" }}>
                    {action.label}
                </span>
            </button>
        );
    };

    // ── Handle child role selection (anonymous login + pair code input) ────────
    const handleChildSelect = async () => {
        try {
            const user = await anonymousLogin();
            setAuthUser(user);
            setMyRole("child");
            // ChildPairInput overlay will show automatically (myRole=child + !familyId)
        } catch (err) {
            console.error("[child login]", err);
        }
    };

    // ── Handle parent setup: create new family or join existing ────────────────
    const handleCreateFamily = async () => {
        if (!authUser) return;
        try {
            await setupFamily(authUser.id, authUser.user_metadata?.name || "부모");
            const fam = await getMyFamily(authUser.id);
            if (fam) {
                setFamilyInfo(fam);
                setMyRole(fam.myRole);
                setShowParentSetup(false);
                setShowPairing(true);
                showNotif("가족이 생성되었어요! 아래 연동코드를 공유해 주세요 🎉");
            }
        } catch (err) {
            console.error("[createFamily]", err);
            showNotif("가족 생성 실패: " + (err.message || ""), "error");
        }
    };

    const handleJoinAsParent = async (code) => {
        const normalizedCode = normalizePairCodeInput(code);
        if (!authUser) throw new Error("로그인 후 다시 시도해 주세요");
        if (!normalizedCode) throw new Error("연동 코드를 정확히 입력해주세요");

        try {
            await joinFamilyAsParent(normalizedCode, authUser.id, authUser.user_metadata?.name || "부모");
            const fam = await getMyFamily(authUser.id);
            if (!fam) throw new Error("합류 후 가족 정보를 불러오지 못했어요. 앱을 새로고침해 주세요.");
            setFamilyInfo(fam);
            setMyRole(fam.myRole);
            setShowParentSetup(false);
            showNotif("가족에 합류했어요! 🎉");
        } catch (err) {
            console.error("[joinAsParent]", err);
            showNotif("합류 실패: 코드를 확인해주세요", "error");
            throw err;
        }
    };

    useEffect(() => {
        // Show pairing modal if parent is logged in but no other family members exist
        if (familyInfo?.myRole === "parent" && familyInfo?.members?.length === 1) {
            setShowPairing(true);
        }
    }, [familyInfo]);

    // ── Render ─────────────────────────────────────────────────────────────────
    if (authLoading) return (
        <div className="hyeni-app-shell" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: DESIGN.gradients.shell, fontFamily: FF }}>
            <div style={{ textAlign: "center" }}>
                <AppBrandLogo size={84} radius={26} />
                <div style={{ fontSize: 20, fontWeight: 900, color: "#E879A0", marginTop: 16 }}>혜니캘린더</div>
                <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 8 }}>로딩 중...</div>
            </div>
        </div>
    );

    // Auth guard: if role exists but no session, force re-login
    if (!myRole || (!authUser && !authLoading)) return <RoleSetupModal onSelect={r => { if (r === "child") handleChildSelect(); }} loading={authLoading} />;

    // ── Parent first login: choose "새 가족 만들기" or "기존 가족 합류" ────────
    if (showParentSetup && !familyInfo) return (
        <ParentSetupScreen onCreateFamily={handleCreateFamily} onJoinAsParent={handleJoinAsParent} />
    );

    // ── Phase 5 · GATE-01 / GATE-02 ────────────────────────────────────────────
    // Pre-pair UI gate for child sessions. While the child is anonymously
    // signed in but has not yet joined a family (familyInfo is null — either
    // first-run, or just unpaired by parent), the ONLY screen we render is
    // ChildPairInput. This prevents memo / 꾹 / schedule UI from mounting (and
    // therefore prevents realtime subscribes, polling, and accidental data
    // writes) until pairing completes. GATE-02: if familyInfo later becomes
    // null (e.g. parent unpairs the child), this same early-return naturally
    // returns us to the gate screen on the next render.
    if (myRole === "child" && authUser && !familyInfo) return (
        <ChildPairInput userId={authUser.id} onPaired={async () => {
            try {
                const fam = await getMyFamily(authUser.id);
                if (fam) {
                    setFamilyInfo(fam);
                    setMyRole(fam.myRole || "child");
                    showNotif("🎉 부모님과 연동됐어요!", "success");
                } else {
                    showNotif("연동은 됐지만 정보 로딩에 실패했어요. 앱을 다시 열어주세요", "error");
                }
            } catch (err) {
                console.error("[onPaired] getMyFamily failed:", err);
                showNotif("연동 완료! 앱을 다시 열어주세요", "success");
                setTimeout(() => window.location.reload(), 1500);
            }
        }} />
    );

    if (showAcademyMgr) return (
        <AcademyManager academies={academies} currentPos={childPos}
            onSave={async (newList) => {
                // Diff old vs new to determine DB operations
                const oldMap = new Map(academies.filter(a => a.id).map(a => [a.id, a]));
                const newMap = new Map(newList.filter(a => a.id).map(a => [a.id, a]));
                const createdItems = newList.filter(a => !a.id || !oldMap.has(a.id));

                if (createdItems.length > 0 && !entitlement.canUse(FEATURES.ACADEMY_SCHEDULE)) {
                    openFeatureLock(FEATURES.ACADEMY_SCHEDULE);
                    return;
                }

                // Deleted: in old but not in new
                for (const [id] of oldMap) {
                    if (!newMap.has(id)) {
                        try { await dbDeleteAcademy(id); } catch (e) { console.error("[academy] delete error:", e); }
                    }
                }

                // New items (no id) → generate UUID and insert
                const finalList = [];
                for (const a of newList) {
                    if (!a.id) {
                        const ac = { ...a, id: generateUUID() };
                        finalList.push(ac);
                        if (familyId) {
                            try { await insertAcademy(ac, familyId); } catch (e) { console.error("[academy] insert error:", e); }
                        }
                    } else if (!oldMap.has(a.id)) {
                        // Has id but wasn't in old list (shouldn't happen, but handle)
                        finalList.push(a);
                        if (familyId) {
                            try { await insertAcademy(a, familyId); } catch (e) { console.error("[academy] insert error:", e); }
                        }
                    } else {
                        // Existing item — check for updates
                        finalList.push(a);
                        const old = oldMap.get(a.id);
                        const changed = old && (old.name !== a.name || old.emoji !== a.emoji || old.category !== a.category || JSON.stringify(old.location) !== JSON.stringify(a.location) || JSON.stringify(old.schedule) !== JSON.stringify(a.schedule));
                        if (changed) {
                            try { await updateAcademy(a.id, { name: a.name, emoji: a.emoji, category: a.category, location: a.location || null, schedule: a.schedule || null }); } catch (e) { console.error("[academy] update error:", e); }
                            // 기존 일정도 업데이트 (장소, 이름, 시간, 이모지)
                            if (familyId) {
                                const cat = CATEGORIES.find(c => c.id === a.category);
                                setEvents(prev => {
                                    const updated = { ...prev };
                                    for (const [dk, dayEvs] of Object.entries(updated)) {
                                        const [y, m, d] = dk.split("-").map(Number);
                                        const evDate = new Date(y, m, d);
                                        // 미래 일정만 업데이트 (오늘 포함)
                                        if (evDate.setHours(0,0,0,0) < new Date().setHours(0,0,0,0)) continue;
                                        updated[dk] = dayEvs.map(ev => {
                                            if (ev.title === old.name || ev.title === a.name) {
                                                const newTime = a.schedule?.startTime || ev.time;
                                                const newEndTime = a.schedule?.endTime || ev.endTime;
                                                const updatedEv = { ...ev, title: a.name, emoji: a.emoji, location: a.location || ev.location, time: newTime, endTime: newEndTime, color: cat?.color || ev.color, bg: cat?.bg || ev.bg };
                                                updateEvent(ev.id, { title: a.name, emoji: a.emoji, location: a.location || null, time: newTime, end_time: newEndTime }).catch(e => console.error("[academy-event-update]", e));
                                                return updatedEv;
                                            }
                                            return ev;
                                        });
                                    }
                                    return updated;
                                });
                            }
                        }
                    }
                }

                // Auto-generate events for academies with schedule (4 weeks ahead)
                if (familyId && authUser) {
                    const today = new Date();
                    const newEvents = {};
                    for (const ac of finalList) {
                        if (!ac.schedule?.days?.length || !ac.schedule.startTime) continue;
                        const cat = CATEGORIES.find(c => c.id === ac.category);
                        for (let d = 0; d < 28; d++) {
                            const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
                            if (!ac.schedule.days.includes(date.getDay())) continue;
                            const dk = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                            const existing = events[dk] || [];
                            const alreadyExists = existing.some(e => e.title === ac.name && e.time === ac.schedule.startTime);
                            if (alreadyExists) continue;
                            const ev = { id: generateUUID(), title: ac.name, time: ac.schedule.startTime, endTime: ac.schedule.endTime || null, category: ac.category, emoji: ac.emoji, color: cat?.color || "#A78BFA", bg: cat?.bg || "#EDE9FE", memo: "", location: ac.location || null, notifOverride: null };
                            if (!newEvents[dk]) newEvents[dk] = [];
                            newEvents[dk].push(ev);
                            try { await insertEvent(ev, familyId, dk, authUser.id); } catch (e) { console.error("[academy-event]", e); }
                        }
                    }
                    if (Object.keys(newEvents).length > 0) {
                        setEvents(prev => {
                            const updated = { ...prev };
                            for (const [dk, evs] of Object.entries(newEvents)) {
                                updated[dk] = [...(updated[dk] || []), ...evs].sort((a, b) => a.time.localeCompare(b.time));
                            }
                            return updated;
                        });
                    }
                }

                setAcademies(finalList);
                cacheAcademies(finalList);
                showNotif("🏫 학원 목록이 저장됐어요!");
            }}
            onClose={() => setShowAcademyMgr(false)} />
    );

    if (showSavedPlaceMgr) return (
        <SavedPlaceManager
            places={savedPlaces}
            currentPos={displayChildPos || childPos}
            onSave={async (nextList) => {
                if (!entitlement.canUse(FEATURES.SAVED_PLACES)) {
                    setShowSavedPlaceMgr(false);
                    openFeatureLock(FEATURES.SAVED_PLACES);
                    return;
                }

                const normalizedNext = nextList.map((place) => ({
                    ...place,
                    id: place.id || generateUUID(),
                    name: place.name.trim(),
                }));
                const previousList = savedPlaces;
                const previousMap = new Map(previousList.map((place) => [place.id, place]));
                const nextMap = new Map(normalizedNext.map((place) => [place.id, place]));

                setSavedPlaces(normalizedNext);
                cacheSavedPlaces(normalizedNext);
                setShowSavedPlaceMgr(false);

                try {
                    for (const [id] of previousMap) {
                        if (!nextMap.has(id)) {
                            await deleteSavedPlace(id);
                        }
                    }

                    for (const place of normalizedNext) {
                        const previous = previousMap.get(place.id);
                        if (!previous) {
                            await insertSavedPlace(place, familyId);
                            continue;
                        }

                        const changed = previous.name !== place.name
                            || JSON.stringify(previous.location) !== JSON.stringify(place.location);
                        if (changed) {
                            await updateSavedPlace(place.id, {
                                name: place.name,
                                location: place.location || null,
                            });
                        }
                    }

                    maybeOpenTrialInvite();
                    showNotif("📍 자주 가는 장소가 저장됐어요!");
                } catch (error) {
                    console.error("[saved-place] save error:", error);
                    setSavedPlaces(previousList);
                    cacheSavedPlaces(previousList);
                    showNotif("장소 저장에 실패했어요. 다시 시도해주세요", "error");
                }
            }}
            onClose={() => setShowSavedPlaceMgr(false)}
        />
    );

    if (showParentMemoPage && isParent) return (
        <div className="hyeni-app-shell hyeni-parent-memo-shell" style={{ minHeight: "100dvh", background: DESIGN.gradients.shell, fontFamily: FF, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 22px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 104px)", position: "relative", overflowX: "hidden", overflowY: "auto", width: "100%", boxSizing: "border-box" }}>
            {notification && (
                <div style={{
                    position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
                    background: notification.type === "error" ? "#FEE2E2" : notification.type === "child" ? DESIGN.colors.pinkSoft : notification.type === "parent" ? "#DBEAFE" : "#D1FAE5",
                    color: notification.type === "error" ? "#DC2626" : notification.type === "child" ? DESIGN.colors.brand : notification.type === "parent" ? "#1D4ED8" : "#065F46",
                    borderRadius: 20, padding: "12px 20px", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 250, maxWidth: "calc(100vw - 32px)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                    {notification.msg}
                </div>
            )}
            <ParentMemoPage
                replies={memoReplies}
                onReplySubmit={handleMemoReplySubmit}
                myUserId={authUser?.id}
                partnerName={pairedChildren[0]?.name || "아이"}
                onClose={() => setShowParentMemoPage(false)}
                onReplyRef={registerMemoReplyNode}
            />
            {renderParentBottomTabbar("memo", "hyeni-v5-tabbar-fixed")}
        </div>
    );

    return (
        <div className="hyeni-app-shell" style={{ minHeight: "100dvh", background: isParent ? "linear-gradient(180deg,#FDFAFB 0%,#F6F0F3 100%)" : DESIGN.gradients.shell, fontFamily: FF, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)", position: "relative", overflowX: "hidden", overflowY: "auto", width: "100%", boxSizing: "border-box" }}>
            <style>{`
        *,*::before,*::after{box-sizing:border-box}
        html,body,#root{margin:0;padding:0;width:100%;min-height:100vh}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-16px)}70%{transform:translateY(-8px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}
        @keyframes slideDown{from{transform:translateX(-50%) translateY(-20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        @keyframes slideDownFull{from{transform:translateY(-30px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes slideUpCard{from{transform:translateX(-50%) translateY(40px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        @keyframes shrinkBar{from{width:100%}to{width:0%}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes emergencyPulse{0%{transform:scale(0.9);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes shake{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
        @media(hover:hover){button:hover{filter:brightness(0.99)}}
        button:active{transform:scale(0.98)!important}
        input:focus,textarea:focus{border-color:#E879A0!important;box-shadow:0 0 0 4px rgba(232,121,160,0.12)}
        ::-webkit-scrollbar{display:none}
        *{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
      `}</style>


            {/* Toast */}
            {notification && (
                <div style={{
                    position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
                    background: notification.type === "error" ? "#FEE2E2" : notification.type === "child" ? DESIGN.colors.pinkSoft : notification.type === "parent" ? "#DBEAFE" : "#D1FAE5",
                    color: notification.type === "error" ? "#DC2626" : notification.type === "child" ? DESIGN.colors.brand : notification.type === "parent" ? "#1D4ED8" : "#065F46",
                    borderRadius: 20, padding: "12px 20px", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 250, maxWidth: "calc(100vw - 32px)", textAlign: "center", animation: "slideDown 0.3s ease", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                    {notification.msg}
                </div>
            )}

            {/* RES-02: sync degradation banner. Single small pill at top under the
                notification toast. Replaces the console [sync] spam. */}
            {syncDegraded && (
                <div style={{
                    position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)",
                    background: syncDegraded === "circuit_open" ? "#FED7AA" : "#FEF3C7",
                    color: syncDegraded === "circuit_open" ? "#9A3412" : "#92400E",
                    borderRadius: 16, padding: "8px 14px", fontWeight: 600, fontSize: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", zIndex: 240, maxWidth: "calc(100vw - 32px)", textAlign: "center", animation: "slideDown 0.3s ease", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                    {syncDegraded === "circuit_open"
                        ? "일시적으로 연결이 불안정해요 — 5분 뒤 자동 재시도"
                        : "일부 기능을 일시적으로 불러오지 못했어요 — 잠시 뒤 자동 재시도합니다"}
                </div>
            )}

            {/* AI Alert Panel (parent only) */}
            {showAlertPanel && isParent && (
                <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 500, fontFamily: FF, paddingTop: 60 }}
                    onClick={e => { if (e.target === e.currentTarget) setShowAlertPanel(false); }}>
                    <div style={makeCardStyle({ width: "92%", maxWidth: 420, maxHeight: "75vh", overflow: "hidden" })}>
                        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 900, color: "#1F2937" }}>🤖 AI 알림</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>아이 활동 분석 리포트</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, color: aiEnabled ? "#10B981" : "#9CA3AF" }}>
                                    <input type="checkbox" checked={aiEnabled} onChange={e => toggleAiEnabled(e.target.checked)}
                                        style={{ width: 14, height: 14, accentColor: "#10B981" }} />
                                    AI {aiEnabled ? "ON" : "OFF"}
                                </label>
                                <button onClick={() => setShowAlertPanel(false)}
                                    style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>×</button>
                            </div>
                        </div>
                        <div style={{ overflowY: "auto", maxHeight: "calc(75vh - 80px)", padding: "12px 16px" }}>
                            {!aiEnabled && (
                                <div style={{ textAlign: "center", padding: "30px 20px", color: "#9CA3AF" }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>AI 기능이 꺼져 있어요</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>위 토글을 켜면 아이 활동을 AI가 분석합니다</div>
                                </div>
                            )}
                            {aiEnabled && parentAlerts.length === 0 && (
                                <div style={{ textAlign: "center", padding: "30px 20px", color: "#9CA3AF" }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>아직 알림이 없어요</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>아이가 일정 장소에 도착/출발하면 AI가 알려드려요</div>
                                </div>
                            )}
                            {aiEnabled && parentAlerts.map(alert => {
                                const severityColors = {
                                    urgent: { bg: "#FEE2E2", border: "#EF4444", icon: "🚨" },
                                    warning: { bg: "#FEF3C7", border: "#F59E0B", icon: "⚠️" },
                                    info: { bg: "#DBEAFE", border: "#3B82F6", icon: "ℹ️" },
                                };
                                const sc = severityColors[alert.severity] || severityColors.info;
                                const timeAgo = (() => {
                                    const diff = Date.now() - new Date(alert.created_at).getTime();
                                    const m = Math.floor(diff / 60000);
                                    if (m < 1) return "방금";
                                    if (m < 60) return `${m}분 전`;
                                    const h = Math.floor(m / 60);
                                    if (h < 24) return `${h}시간 전`;
                                    return `${Math.floor(h / 24)}일 전`;
                                })();
                                return (
                                    <div key={alert.id}
                                        onClick={async () => { if (!alert.read) { await markAlertRead(alert.id); setParentAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, read: true } : a)); } }}
                                        style={{ background: alert.read ? "#F9FAFB" : sc.bg, borderLeft: `4px solid ${sc.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10, cursor: "pointer", opacity: alert.read ? 0.7 : 1 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937" }}>
                                                {alert.title.startsWith("🤖") ? "" : sc.icon + " "}{alert.title}
                                            </div>
                                            <div style={{ fontSize: 10, color: "#9CA3AF" }}>{timeAgo}</div>
                                        </div>
                                        <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5 }}>{alert.message}</div>
                                        {!alert.read && <div style={{ fontSize: 9, color: sc.border, fontWeight: 700, marginTop: 4 }}>탭하여 읽음 표시</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Voice preview card */}
            {voicePreview && (
                <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 260, width: "calc(100% - 32px)", maxWidth: 400, animation: "slideUpCard 0.35s cubic-bezier(.34,1.56,.64,1)" }}>
                    <div style={{ background: "white", borderRadius: 24, boxShadow: "0 12px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
                        <div style={{ height: 4, background: "#10B981", animation: "shrinkBar 8s linear forwards" }} />
                        <div style={{ padding: "16px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#10B981", background: "#D1FAE5", padding: "4px 10px", borderRadius: 8 }}>{voicePreview.aiParsed ? "🤖 AI 저장 완료" : "🎤 음성 저장 완료"}</div>
                                {voicePreview.academyMatched && <div style={{ fontSize: 11, fontWeight: 700, color: DESIGN.colors.parentDeep, background: DESIGN.colors.parentPale, padding: "4px 10px", borderRadius: 8 }}>🏫 학원 자동 매칭</div>}
                                <div style={{ fontSize: 11, color: "#9CA3AF", flex: 1, textAlign: "right" }}>8초 후 닫힘</div>
                            </div>
                            <div style={{ background: voicePreview.ev.bg, borderRadius: 16, padding: "12px 14px", borderLeft: `4px solid ${voicePreview.ev.color}`, marginBottom: 12 }}>
                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <div style={{ fontSize: 26 }}>{voicePreview.ev.emoji}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 800, fontSize: 15, color: "#1F2937" }}>{voicePreview.ev.title}</div>
                                        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>📅 {voicePreview.dateLabel} &nbsp;⏰ {voicePreview.ev.time}</div>
                                        {voicePreview.ev.location && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>📍 {voicePreview.ev.location.address?.split(" ").slice(0, 3).join(" ")}</div>}
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 12, padding: "6px 10px", background: "#F9FAFB", borderRadius: 8 }}>🎙 인식: "{voicePreview.rawText}"</div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => { setVoicePreview(null); setCurrentYear(parseInt(voicePreview.dateKey.split("-")[0])); setCurrentMonth(parseInt(voicePreview.dateKey.split("-")[1])); setSelectedDate(parseInt(voicePreview.dateKey.split("-")[2])); setActiveView("calendar"); }}
                                    style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#10B981,#059669)", color: "white", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>✅ 달력에서 보기</button>
                                <button onClick={() => { setVoicePreview(null); setNewTitle(voicePreview.ev.title); setNewTime(voicePreview.ev.time); setNewEndTime(voicePreview.ev.endTime || ""); setNewCategory(voicePreview.ev.category); setNewLocation(voicePreview.ev.location); setEvents(prev => ({ ...prev, [voicePreview.dateKey]: (prev[voicePreview.dateKey] || []).filter(e => e.id !== voicePreview.ev.id) })); setShowAddModal(true); }}
                                    style={{ flex: 1, padding: "11px", background: DESIGN.colors.parentPale, color: DESIGN.colors.parentDeep, border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>✏️ 수정</button>
                                <button onClick={undoVoiceEvent} style={{ padding: "11px 14px", background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>↩</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AlertBanner alerts={alerts} onDismiss={id => setAlerts(p => p.filter(a => a.id !== id))} />
            <EmergencyBanner emergencies={emergencies} onDismiss={(id, action) => { setEmergencies(p => p.filter(e => e.id !== id)); if (action === "contact") showNotif("📞 전화 앱을 열어주세요", "child"); }} />

            {/* ── Background location permission banner (child mode) ── */}
            {isNativeApp && !isParent && !bgLocationGranted && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth, marginBottom: 8, padding: "14px 14px", borderRadius: 18, background: "linear-gradient(135deg, #FEF2F2, #FEE2E2)", border: "1.5px solid #FECACA", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(239,68,68,0.12)" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📍</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#DC2626" }}>위치 권한을 "항상 허용"으로 바꿔주세요</div>
                        <div style={{ fontSize: 11, color: "#991B1B", marginTop: 3, lineHeight: 1.45 }}>
                            앱을 꺼도 위치가 부모님께 전달돼요
                        </div>
                    </div>
                    <button onClick={async () => {
                        try {
                            const { Capacitor, registerPlugin } = await import("@capacitor/core");
                            if (Capacitor.isNativePlatform()) {
                                const BgLoc = registerPlugin("BackgroundLocation");
                                await BgLoc.openAppLocationSettings();
                            }
                        } catch (error) {
                            void error;
                        }
                    }} style={{ padding: "9px 13px", borderRadius: 12, background: "#DC2626", color: "white", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: FF, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(220,38,38,0.2)" }}>
                        설정 열기
                    </button>
                </div>
            )}

            {/* ── Push notification permission banner ── */}
            {isNativeApp && !isParent && nativeSetupAction && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth, marginBottom: 8, padding: "12px 14px", borderRadius: 18, background: "linear-gradient(135deg, #FFF7ED, #FEF3C7)", border: "1px solid #FCD34D", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(245,158,11,0.12)" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🔔</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#9A3412" }}>앱이 꺼져도 알림이 바로 보이도록 설정이 더 필요해요</div>
                        <div style={{ fontSize: 11, color: "#7C2D12", marginTop: 3, lineHeight: 1.45 }}>
                            알림 권한, 전체화면 알림, 배터리 예외, 정확한 알림 중 일부가 아직 꺼져 있어요.
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await openNativeNotificationSettings(nativeSetupAction.target);
                        }}
                        style={{ padding: "9px 13px", borderRadius: 12, background: "#EA580C", color: "white", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: FF, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(234,88,12,0.2)" }}
                    >
                        {nativeSetupAction.label}
                    </button>
                </div>
            )}
            {!isNativeApp && pushPermission !== "granted" && pushPermission !== "unsupported" && pushPermission !== "denied" && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth, marginBottom: 8, padding: "10px 14px", borderRadius: 14, background: "linear-gradient(135deg, #DBEAFE, #EFF6FF)", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>🔔</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>푸시 알림을 켜주세요!</div>
                        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>일정 시작 전 알림을 받을 수 있어요</div>
                    </div>
                    <button onClick={async () => {
                        const result = await requestPermission();
                        setPushPermission(result);
                        if (result === "granted") {
                            showNotif("푸시 알림이 켜졌어요!");
                        } else if (result === "denied") {
                            showNotif("알림이 차단되었어요. 브라우저 설정에서 허용해주세요.", "error");
                        }
                    }}
                        style={{ padding: "8px 14px", borderRadius: 10, background: "#3B82F6", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF, whiteSpace: "nowrap" }}>
                        허용하기
                    </button>
                </div>
            )}
            {!isNativeApp && pushPermission === "denied" && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth, marginBottom: 8, padding: "8px 14px", borderRadius: 14, background: "#FEF3C7", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🔕</span>
                    <div style={{ fontSize: 11, color: "#92400E", fontWeight: 600 }}>푸시 알림이 차단됨 — 브라우저 설정에서 이 사이트의 알림을 허용해주세요</div>
                </div>
            )}

            <TrialEndingBanner
                trialDaysLeft={entitlement.trialDaysLeft}
                isTrial={entitlement.isTrial}
                isChild={!isParent}
                onContinue={() => startTrial(PRICING.monthlyProductId)}
            />

            {/* ── Header Row 1: Logo + 꾹 + 로그아웃 ── */}
            <div style={{ width: "100%", maxWidth: contentMaxWidth, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "10px 12px", background: "rgba(255,255,255,0.88)", border: `1px solid ${DESIGN.colors.pinkLine}`, borderRadius: DESIGN.radius.xl, boxShadow: DESIGN.shadow.soft }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 auto" }}>
                    <div style={{ animation: bounce ? "bounce 0.4s ease" : "float 3s ease-in-out infinite", cursor: "pointer", flexShrink: 0 }} onClick={() => { setBounce(true); setTimeout(() => setBounce(false), 800); showNotif("안녕! 나는 혜니야 💗"); }}>
                        <AppBrandLogo size={isParent ? 38 : 44} radius={isParent ? 12 : 14} shadow={false} />
                    </div>
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                        <div onClick={() => setActiveView("calendar")} style={{ fontSize: isParent ? 16 : 18, fontWeight: 900, color: DESIGN.colors.pinkText, whiteSpace: "nowrap", cursor: "pointer" }}>혜니캘린더</div>
                        {isParent && (
                            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
                                <span onClick={() => { if (window.confirm("역할을 다시 선택할까요?")) { setMyRole(null); setFamilyInfo(null); } }}
                                    style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, fontWeight: 700, cursor: "pointer", background: "#DBEAFE", color: "#1D4ED8", whiteSpace: "nowrap", flexShrink: 0 }}>
                                    학부모 모드
                                </span>
                                <button onClick={() => setShowPairing(true)}
                                    style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 5, border: "none", cursor: "pointer", fontFamily: FF, background: pairedChildren.length > 0 ? "#D1FAE5" : "#FEF3C7", color: pairedChildren.length > 0 ? "#065F46" : "#92400E", whiteSpace: "nowrap" }}>
                                    {pairedChildren.length > 0 ? `🔗 연동 (${pairedChildren.length}명)` : "🔗 연동하기"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                    {isParent && (
                        <button onClick={() => { setShowAlertPanel(true); loadParentAlerts(); }}
                            style={{ position: "relative", fontSize: 18, padding: "6px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: "#F3F4F6", lineHeight: 1 }}>
                            🔔
                            {parentAlerts.filter(a => !a.read).length > 0 && (
                                <span style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "#EF4444", color: "white", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {Math.min(parentAlerts.filter(a => !a.read).length, 9)}
                                </span>
                            )}
                        </button>
                    )}
                    {/* Phase 5 KKUK-01: tap sends immediately; hold sends once
                         after 500ms without waiting for release. Cooldown is
                         still driven by kkukCooldown state + server RPC. */}
                    <button
                        disabled={kkukCooldown}
                        onClick={handleKkukClick}
                        onMouseDown={beginKkukPress}
                        onMouseUp={endKkukPress}
                        onMouseLeave={cancelKkukPress}
                        onTouchStart={beginKkukPress}
                        onTouchEnd={endKkukPress}
                        onTouchCancel={cancelKkukPress}
                        style={{
                            fontSize: isParent ? 13 : 15, padding: isParent ? "8px 14px" : "10px 18px", borderRadius: 16, border: "none", cursor: kkukCooldown ? "default" : "pointer",
                            fontWeight: 900, fontFamily: FF, whiteSpace: "nowrap",
                            background: kkukCooldown ? "#E5E7EB" : "linear-gradient(135deg, #FF6B9D, #FF4081)",
                            color: "white", boxShadow: kkukCooldown ? "none" : "0 3px 12px rgba(255,64,129,0.4)",
                            transition: "all 0.2s", transform: kkukCooldown ? "scale(0.95)" : "scale(1)",
                            userSelect: "none",
                            WebkitTouchCallout: "none",
                        }}
                        title="꾹 보내기"
                        aria-label="💗 꾹">
                        💗 꾹
                    </button>
                    {isParent && (
                        <button onClick={async () => {
                            if (!window.confirm("로그아웃 하시겠어요?")) return;
                            try {
                                await stopNativeLocationService();
                                await unsubscribeFromPush();
                                await logout();
                                setMyRole(null);
                                setFamilyInfo(null);
                                setAuthUser(null);
                                setEvents({});
                                setAcademies([]);
                                setMemos({});
                                setParentPhones({ mom: "", dad: "" });
                                showNotif("로그아웃 되었어요");
                            } catch (err) {
                                console.error("[logout]", err);
                                showNotif("로그아웃 실패");
                            }
                        }}
                            style={{ fontSize: 10, padding: "6px 8px", borderRadius: 8, background: "#F3F4F6", color: "#9CA3AF", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: FF, whiteSpace: "nowrap" }}>
                            로그아웃
                        </button>
                    )}
                </div>
            </div>

            {activeView === "calendar" && (
                <section
                    aria-label={heroTitle}
                    className={isParent ? "hyeni-v1-parent-hero" : undefined}
                    style={{
                        width: "100%",
                        maxWidth: contentMaxWidth,
                        background: isParent
                            ? "transparent"
                            : DESIGN.gradients.hero,
                        padding: isParent ? "14px 2px 18px" : "20px 22px 24px",
                        borderRadius: isParent ? 0 : DESIGN.radius.hero,
                        color: isParent ? "#1F1A22" : "white",
                        position: "relative",
                        overflow: "hidden",
                        marginBottom: isParent ? 0 : 18,
                        boxShadow: isParent
                            ? "none"
                            : DESIGN.shadow.elevated,
                        minHeight: isParent ? "auto" : 246,
                    }}
                >
                    {!isParent && <div
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            top: -30,
                            right: -30,
                            width: 160,
                            height: 160,
                            borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)",
                        }}
                    />}
                    {!isParent && <div
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            right: 16,
                            bottom: -20,
                            width: 100,
                            height: 100,
                            borderRadius: 28,
                            transform: "rotate(-8deg)",
                            boxShadow: "0 8px 24px rgba(196,68,122,0.45), 0 0 0 5px rgba(255,255,255,0.4)",
                            overflow: "hidden",
                            background: "rgba(255,255,255,0.18)",
                        }}
                    >
                        <AppBrandLogo size={100} radius={28} shadow={false} />
                    </div>}
                    <div style={{ position: "relative", zIndex: 1, maxWidth: isParent ? "100%" : 270 }}>
                        <div style={{ fontSize: isParent ? 13 : 11, fontWeight: isParent ? 600 : 800, color: isParent ? "#6B5F73" : undefined, opacity: isParent ? 1 : 0.9, marginBottom: isParent ? 4 : 7, display: "flex", alignItems: "center", gap: 6 }}>
                            {todayDateLabel}
                        </div>
                        {isParent ? (
                            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.2, color: "#1F1A22", textShadow: "none" }}>
                                {parentHeroChildrenText},<br />
                                오늘 일정 <span className="hyeni-v1-hero-count">{todayEvents.length}개</span>
                            </h1>
                        ) : (
                            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1.15, maxWidth: 250, textShadow: "none" }}>
                                {childHeroMessage.line1}
                                <br />
                                {childHeroMessage.line2}
                            </h1>
                        )}
                        {!isParent && <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, opacity: 0.92 }}>
                            {heroLine}
                        </div>}
                        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 7, maxWidth: 270 }}>
                            {isParent ? (
                                <button
                                    type="button"
                                    onClick={handleHeroInsightClick}
                                    className="hyeni-v1-hero-action"
                                    style={{
                                        padding: "6px 11px",
                                        borderRadius: 999,
                                        background: "#FFFFFF",
                                        color: "#C4447A",
                                        border: "1px solid rgba(231,219,228,0.70)",
                                        boxShadow: "0 2px 8px rgba(232,121,160,0.10)",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        lineHeight: 1.25,
                                        wordBreak: "keep-all",
                                        overflowWrap: "anywhere",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 7,
                                        cursor: "pointer",
                                        fontFamily: FF,
                                    }}
                                >
                                    <span aria-hidden="true">🏃</span>
                                    {heroInsightText}
                                    <span aria-hidden="true" style={{ opacity: 0.72 }}>›</span>
                                </button>
                            ) : (
                                <span style={{
                                    padding: "7px 10px",
                                    borderRadius: 999,
                                    background: "#FFF7ED",
                                    color: "#9A3412",
                                    border: "1.5px solid #FDBA74",
                                    boxShadow: "0 5px 14px rgba(251,146,60,0.18)",
                                    fontSize: 11,
                                    fontWeight: 900,
                                    lineHeight: 1.25,
                                    wordBreak: "keep-all",
                                    overflowWrap: "anywhere",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 7,
                                }}>
                                    {childNextScheduleLabel}
                                </span>
                            )}
                            {!isParent && (
                                <span style={{
                                    padding: "7px 10px",
                                    borderRadius: 999,
                                    background: "#ECFDF5",
                                    color: "#047857",
                                    border: "1.5px solid #86EFAC",
                                    boxShadow: "0 5px 14px rgba(16,185,129,0.18)",
                                    fontSize: 11,
                                    fontWeight: 900,
                                    lineHeight: 1.25,
                                    wordBreak: "keep-all",
                                    whiteSpace: "nowrap",
                                }}>
                                    남은 일정 {childHeroRemaining}개
                                </span>
                            )}
                        </div>
                        {!isParent && (
                            <div style={{
                                marginTop: 10,
                                padding: "10px 12px",
                                borderRadius: 18,
                                background: "rgba(255,255,255,0.20)",
                                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
                                maxWidth: 270,
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.9, marginBottom: 4 }}>
                                    지금 나는 어디에 있나요?
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.35, wordBreak: "keep-all", overflowWrap: "anywhere" }}>
                                    {childCurrentLocationLabel}
                                </div>
                                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.82, lineHeight: 1.4, marginTop: 4 }}>
                                    {childCurrentLocationMeta}
                                </div>
                            </div>
                        )}
                        {!isParent && nextTodayEvent?.location && (
                            <button
                                type="button"
                                onClick={() => setRouteEvent(nextTodayEvent)}
                                style={{
                                    marginTop: 14,
                                    border: "none",
                                    borderRadius: 18,
                                    padding: "10px 14px",
                                    background: "rgba(255,255,255,0.94)",
                                    color: DESIGN.colors.pinkText,
                                    fontSize: 12,
                                    fontWeight: 900,
                                    cursor: "pointer",
                                    boxShadow: "0 6px 16px rgba(196,68,122,0.18)",
                                    fontFamily: FF,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    maxWidth: "100%",
                                }}
                            >
                                길 안내 보기
                            </button>
                        )}
                    </div>
                </section>
            )}

            {/* ── Header Row 2: Quick action buttons ── */}
            {!isParent && <div style={{ width: "100%", maxWidth: contentMaxWidth, marginBottom: 12 }}>
                <div
                    style={{
                        background: quickPanelTone.bg,
                        borderRadius: DESIGN.radius.xl,
                        border: `1px solid ${quickPanelTone.border}`,
                        boxShadow: DESIGN.shadow.card,
                        padding: 12,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 900, color: quickPanelTone.color }}>
                                빠른 실행
                            </div>
                            <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>
                                스크롤 없이 주요 기능을 바로 열 수 있어요
                            </div>
                        </div>
                        <div
                            style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.84)",
                                color: quickPanelTone.color,
                                fontSize: 10,
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.62)",
                            }}
                        >
                            {isParent ? "학부모 모드" : "아이 모드"}
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 8 }}>
                        {quickModeActions.map((action) => renderQuickAction(action, "mode"))}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {!isParent && <ChildCallCard phones={parentPhones} />}
                        <div style={{ display: "grid", gridTemplateColumns: quickUtilityColumns, gap: 8 }}>
                            {quickUtilityActions.map((action) => renderQuickAction(action))}
                        </div>
                    </div>
                </div>
            </div>}

            {/* ── CALENDAR VIEW ── */}
            {activeView === "calendar" && (isParent ? (
                <div className="hyeni-v5-parent-main" aria-label="부모 메인">
                    <div className="hyeni-v5-section-head">
                        <span>아이 현황</span>
                        <span className="hyeni-v5-section-meta hyeni-v1-live-meta">
                            {displayChildPos ? "실시간" : "위치 대기"}
                            {displayChildPos && <span aria-hidden="true">●</span>}
                        </span>
                    </div>
                    <div className="hyeni-v5-kids-grid">
                        {dashboardChildren.map((child, index) => {
                            const childLocationLabel = getDashboardChildLocationLabel(child, index);
                            return (
                                <button
                                    key={child.user_id || child.id || index}
                                    type="button"
                                    onClick={() => setShowChildTracker(true)}
                                    className="hyeni-v5-kid-card"
                                    style={{ cursor: "pointer", fontFamily: FF }}
                                >
                                    <span className={`hyeni-v5-kid-avatar ${index % 2 === 1 ? "blue" : ""}`}>
                                        {child.emoji || (index % 2 === 1 ? "🦊" : "🐰")}
                                        {getDashboardChildPosition(child, index) && <span className="live" />}
                                    </span>
                                    <span className="hyeni-v5-kid-info">
                                        <span className="hyeni-v5-kid-name">{child.name || "아이"}</span>
                                        <span className="hyeni-v5-kid-loc">
                                            <span aria-hidden="true">{getDashboardChildPosition(child, index) ? "📍" : "🕘"}</span>
                                            <span>{childLocationLabel}</span>
                                        </span>
                                        <span className="hyeni-v5-kid-next">
                                            {nextTodayEvent ? `다음 일정 · ${nextTodayEvent.time}` : "오늘 일정 없음"}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        className="hyeni-v5-memo-mini"
                        style={{ width: "100%", fontFamily: FF }}
                        onClick={handleParentMemoOpen}
                    >
                        <span className="hyeni-v5-memo-icon">💌</span>
                        <span className="hyeni-v5-memo-body">
                            <span className="hyeni-v5-memo-label">오늘의 메모</span>
                            <span className="hyeni-v5-memo-text">{memoPreviewText}</span>
                            {memoPreviewMeta && <span className="hyeni-v5-memo-meta">{memoPreviewMeta}</span>}
                        </span>
                        <span className="hyeni-v5-memo-count">{memoReplies?.length || 0}</span>
                    </button>

                    <div className="hyeni-v5-section-head">
                        <span>관리 바로가기</span>
                        <span className="hyeni-v5-section-meta">필요한 기능만 빠르게</span>
                    </div>
                    <div className="hyeni-v5-action-rail" aria-label="관리 바로가기">
                        {quickUtilityActions.map(action => (
                            <button
                                key={action.key}
                                type="button"
                                onClick={action.onClick}
                                className="hyeni-v5-action-chip"
                                style={{ color: action.palette?.color || DESIGN.colors.ink, fontFamily: FF }}
                                aria-label={action.ariaLabel}
                            >
                                <span aria-hidden="true">{action.icon}</span>
                                <span>{action.label}</span>
                            </button>
                        ))}
                    </div>

                    <section ref={parentCalendarRef} id="parent-calendar-section" aria-label="캘린더">
                        <div className="hyeni-v5-section-head">
                            <span>캘린더</span>
                            <span className="hyeni-v5-section-meta">{currentYear}년 {currentMonth + 1}월</span>
                        </div>
                        {renderParentCalendarGrid("parent-main")}
                    </section>

                    <div className="hyeni-v5-add-row">
                        <button type="button" className="hyeni-v5-ai-button" onClick={openAiSchedule} style={{ fontFamily: FF }}>
                            🤖 AI로 일정입력
                        </button>
                        <button type="button" className="hyeni-v5-plus-button" onClick={() => setShowAddModal(true)} style={{ fontFamily: FF }} aria-label="+" title="일정 추가">
                            +
                        </button>
                    </div>

                    <div className="hyeni-v5-section-head">
                        <span>{selectedDate === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear() ? "오늘의 일정" : "선택한 날짜 일정"}</span>
                        <span className="hyeni-v5-section-meta hyeni-v5-date-count">
                            <span>{selectedCalendarDateLabel}</span>
                            <span aria-hidden="true">·</span>
                            <strong className="hyeni-v5-count-accent">{selectedEventsSorted.length}개</strong>
                        </span>
                    </div>
                    <div className="hyeni-v5-event-list hyeni-v1-home-event-list">
                        {selectedEventsSorted.length > 0 ? selectedEventsSorted.slice(0, 5).map(renderParentScheduleCard) : (
                            <div className="hyeni-v5-empty">
                                선택한 날짜에 등록된 일정이 없어요. 아래 + 버튼으로 일정을 추가해 주세요.
                            </div>
                        )}
                    </div>

                    {renderParentBottomTabbar("today", "hyeni-v5-tabbar-fixed")}

                </div>
            ) : <>
                <div style={{ ...cardSt, padding: "18px 14px 16px", borderRadius: DESIGN.radius.xl }}>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14, padding: "0 6px" }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: DESIGN.colors.pinkText }}>
                                {currentYear}
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: DESIGN.colors.ink, lineHeight: 1 }}>
                                {MONTHS_KO[currentMonth]}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={prevMonth} aria-label="이전 달" style={{ width: 36, height: 36, borderRadius: "50%", background: "white", border: "none", fontSize: 18, cursor: "pointer", color: DESIGN.colors.pinkText, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(247,121,168,0.15)", fontWeight: 800 }}>‹</button>
                            <button onClick={nextMonth} aria-label="다음 달" style={{ width: 36, height: 36, borderRadius: "50%", background: "white", border: "none", fontSize: 18, cursor: "pointer", color: DESIGN.colors.pinkText, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(247,121,168,0.15)", fontWeight: 800 }}>›</button>
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "0 2px 6px", fontSize: 10, fontWeight: 800, textAlign: "center", color: DESIGN.colors.pinkText }}>
                        {DAYS_KO.map((d, i) => <div key={d} style={{ padding: "4px 0", color: i === 0 ? "#F87171" : i === 6 ? DESIGN.colors.parent : DESIGN.colors.pinkText }}>{d}</div>)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, padding: "12px 8px", background: "white", borderRadius: DESIGN.radius.xl, boxShadow: "0 6px 20px rgba(180,120,150,0.10)", border: "2px solid rgba(255,228,239,0.8)" }}>
                        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} style={{ minHeight: 44 }} />)}
                        {Array(getDays).fill(null).map((_, i) => {
                            const day = i + 1;
                            const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                            const isSel = day === selectedDate;
                            const isSun = (firstDay + i) % 7 === 0;
                            const isSat = (firstDay + i) % 7 === 6;
                            const dayEvs = getEvs(day);
                            const activeCell = isSel || isToday;
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => setSelectedDate(day)}
                                    style={{
                                        minHeight: 44,
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 2,
                                        borderRadius: 12,
                                        cursor: "pointer",
                                        transition: "all 0.15s",
                                        background: activeCell ? DESIGN.gradients.primary : "transparent",
                                        border: "none",
                                        color: activeCell ? "white" : isSun ? "#F87171" : isSat ? DESIGN.colors.parent : DESIGN.colors.ink,
                                        fontFamily: FF,
                                    }}
                                >
                                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{day}</span>
                                    {dayEvs.length > 0 && (
                                        <span style={{ display: "flex", gap: 2, marginTop: 1 }}>
                                            {dayEvs.slice(0, 3).map(e => (
                                                <span key={e.id} style={{ width: 4, height: 4, borderRadius: "50%", background: activeCell ? "rgba(255,255,255,0.9)" : e.color }} />
                                            ))}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Academy quick pick */}
                {academies.length > 0 && (
                    <div style={{ width: "100%", maxWidth: contentMaxWidth, marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, paddingLeft: 4 }}>🏫 학원 빠른 추가</div>
                        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                            {academies.map((ac, i) => (
                                <button key={i} onClick={() => {
                                    const cat = CATEGORIES.find(c => c.id === ac.category);
                                    const _ev = { id: Date.now(), title: ac.name, time: "15:00", category: ac.category, emoji: ac.emoji || cat.emoji, color: ac.color || cat.color, bg: ac.bg || cat.bg, memo: "", location: ac.location || null, notifOverride: null };
                                    setNewTitle(ac.name); setNewCategory(ac.category); setNewLocation(ac.location || null);
                                    setShowAddModal(true);
                                }}
                                    style={{ flexShrink: 0, padding: "9px 14px", borderRadius: 16, border: `2px solid ${ac.color || "#E5E7EB"}`, background: ac.bg || "white", color: ac.color || "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span>{ac.emoji}</span><span>{ac.name}</span>
                                    {ac.location && <span style={{ fontSize: 10, opacity: 0.7 }}>📍</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 배너 — 추후 광고 배치용 */}
                <div style={{ width: "100%", maxWidth: contentMaxWidth, background: "linear-gradient(135deg, #FFF0F7, #FCE7F3)", borderRadius: 20, padding: "14px 18px", marginBottom: 14, textAlign: "center", fontSize: 13, fontWeight: 600, color: "#BE185D", fontFamily: FF, border: "1.5px solid #FBCFE8" }}>
                    혜니캘린더는 아이와 함께 만들어갑니다
                </div>

                {/* AI 일정입력 + 수동 추가 */}
                <div style={{ width: "100%", maxWidth: contentMaxWidth, display: "flex", gap: 8, marginBottom: 14 }}>
                    <button onClick={openAiSchedule}
                        style={{
                            flex: 1, padding: "10px 16px", height: 44, color: "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: FF,
                            background: DESIGN.gradients.parent, boxShadow: "0 3px 12px rgba(37,99,235,0.22)"
                        }}>
                        🤖 AI로 일정입력
                    </button>
                    <button onClick={() => setShowAddModal(true)}
                        style={{ minWidth: isParent ? 44 : 56, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#F9A8D4,#E879A0)", color: "white", border: "none", fontSize: isParent ? 22 : 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 12px rgba(232,121,160,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FF, gap: 2, padding: isParent ? 0 : "0 12px" }}>{isParent ? "+" : "✏️ 추가"}</button>
                </div>

                {/* Day Timetable */}
                <div style={{ ...cardSt, marginBottom: 0 }}>
                    <DayTimetable
                        events={selectedEvs}
                        dateLabel={`${currentMonth + 1}월 ${selectedDate}일`}
                        isToday={currentYear === new Date().getFullYear() && currentMonth === new Date().getMonth() && selectedDate === new Date().getDate()}
                        isFuture={new Date(currentYear, currentMonth, selectedDate).setHours(0,0,0,0) > new Date().setHours(0,0,0,0)}
                        childPos={displayChildPos}
                        mapReady={mapReady}
                        stickers={stickers}
                        arrivedSet={arrivedSet}
                        firedEmergencies={firedEmergencies}
                        onRoute={ev => setRouteEvent(ev)}
                        onDelete={handleDeleteEvent}
                        onEditLoc={id => { setEditingLocForEvent(id); setShowMapPicker(true); }}
                        isParentMode={isParent}
                        memoReplies={memoReplies}
                        onReplySubmit={content => {
                            if (!familyId || !authUser) return Promise.resolve();
                            // Phase 4 · MEMO-01: write ONLY to memo_replies.
                            // The legacy `public.memos` upsert-placeholder "💬"
                            // trick is gone — the unified chat surface has no
                            // "top-of-day" concept any more, every message is
                            // a memo_reply with origin='reply'. public.memos
                            // is read-mostly this milestone (DROP in v1.1).
                            const origin = (memoReplies && memoReplies.length > 0) ? "reply" : "original";
                            // Optimistic update — render immediately, the server echo replaces it.
                            const optimisticReply = { id: "temp-" + Date.now(), user_id: authUser.id, user_role: myRole, content, created_at: new Date().toISOString(), origin, read_by: [] };
                            setMemoReplies(prev => [...(prev || []), optimisticReply]);
                            // UI-SPEC §7 Option A: return the Promise so MemoSection can .catch() for send-failure toast.
                            // console.error is preserved inside .catch at the call site (MemoSection handleSend).
                            const sendPromise = sendMemo(familyId, dateKey, content, authUser.id, myRole, origin)
                                .then(() => {
                                    // Codex P1 + P2 (round 2) fix: preserve child memo sentiment
                                    // analysis and run it INDEPENDENTLY of the refresh request.
                                    // Legacy onMemoSend was the only prior caller. Child-sent
                                    // replies are the typed-memo equivalent in the unified chat.
                                    // Decoupled from fetchMemoReplies so a refresh network
                                    // failure cannot suppress the safety analysis on a memo that
                                    // is already persisted server-side (sendMemo resolved).
                                    // Fire-and-forget: analyzeMemoSentiment handles entitlement,
                                    // AI flag, and network errors internally.
                                    if (myRole === "child" && aiEnabled) {
                                        try { analyzeMemoSentiment(content, ""); } catch (_) { /* ignore */ }
                                    }
                                    return fetchMemoReplies(familyId, dateKey).then(setMemoReplies);
                                })
                                .catch(err => { console.error("[reply]", err); throw err; });
                            sendInstantPush({
                                action: "new_memo",
                                familyId,
                                senderUserId: authUser.id,
                                title: `💬 ${myRole === "parent" ? "부모님" : "아이"}이 답글을 남겼어요`,
                                message: content.length > 50 ? content.substring(0, 50) + "..." : content,
                            });
                            return sendPromise;
                        }}
                        memoReadBy={memoReadBy}
                        myUserId={authUser?.id}
                        onReplyRef={registerMemoReplyNode}
                    />
                </div>
            </>)}

            {/* ── PARENT CALENDAR PAGE ── */}
            {activeView === "parentCalendar" && isParent && (
                <section className="hyeni-v5-calendar-page" aria-label="부모 캘린더">
                    <div className="hyeni-v5-page-head">
                        <div>
                            <div className="hyeni-v5-page-kicker">일정 한눈에 보기</div>
                            <h2>캘린더</h2>
                        </div>
                        <button
                            type="button"
                            className="hyeni-v5-page-add"
                            onClick={() => setShowAddModal(true)}
                            style={{ fontFamily: FF }}
                            aria-label="+"
                        >
                            +
                        </button>
                    </div>

                    {renderParentCalendarGrid("parent-page")}

                    <div className="hyeni-v5-calendar-list-head">
                        <div>
                            <span>일정 리스트</span>
                            <strong>{selectedCalendarDateLabel}</strong>
                        </div>
                        <span className="hyeni-v5-section-meta hyeni-v5-date-count">
                            <strong className="hyeni-v5-count-accent">{selectedEventsSorted.length}개</strong>
                            <span>일정</span>
                        </span>
                    </div>

                    <div className="hyeni-v5-event-list hyeni-v5-timeline-list">
                        {selectedEventsSorted.length > 0 ? selectedEventsSorted.map(renderParentScheduleCard) : (
                            <div className="hyeni-v5-empty">
                                선택한 날짜에 등록된 일정이 없어요. 오른쪽 위 + 버튼으로 일정을 추가해 주세요.
                            </div>
                        )}
                    </div>

                    {renderParentBottomTabbar("calendar", "hyeni-v5-tabbar-fixed")}
                </section>
            )}

            {/* ── MAP LIST VIEW ── */}
            {activeView === "maplist" && (
                <div className={isParent ? "hyeni-v5-maplist-with-tabbar" : undefined}>
                    <LocationMapView
                        events={events} childPos={displayChildPos} mapReady={mapReady}
                        arrivedSet={arrivedSet}
                        locationHint={locationGateHint}
                        savedPlaces={savedPlaces}
                        isParentMode={isParent}
                        savedPlacesLocked={!entitlement.canUse(FEATURES.SAVED_PLACES)}
                        onAddSavedPlace={handleOpenSavedPlaceMgr}
                    />
                    {isParent && renderParentBottomTabbar("maplist", "hyeni-v5-tabbar-fixed")}
                </div>
            )}

            {/* ── ADD MODAL ── */}
            {showAddModal && (
                <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }} onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
                    <div style={makeSheetStyle({ padding: "24px 20px 36px", width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" })}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#374151", marginBottom: 4 }}>✨ 새 일정 추가</div>
                        {isParent && pairedChildren.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", borderRadius: 10, padding: "6px 12px", marginBottom: 14, display: "inline-block" }}>📡 저장 시 {pairedChildren.map(c => c.name).join(", ")}에게 자동 전송</div>}

                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>⚡ 빠른 선택</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {SCHEDULE_PRESETS.map(p => {
                                    const active = selectedPreset?.label === p.label;
                                    return (
                                        <button key={p.label} onClick={() => {
                                            setSelectedPreset(p);
                                            setNewCategory(p.category);
                                            const last = findLastEventByTitle(p.label);
                                            if (last) { setNewTime(last.time); if (last.location) setNewLocation(last.location); }
                                        }}
                                            style={{ padding: "6px 12px", borderRadius: 16, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, border: active ? "2px solid #E879A0" : "2px solid #F3F4F6", background: active ? "#FFF0F7" : "#F9FAFB", color: active ? "#E879A0" : "#6B7280", transition: "all 0.15s" }}>
                                            {p.emoji} {p.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>📌 일정 이름 {selectedPreset && <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>(비워두면 "{selectedPreset.label}")</span>}</label>
                            <input style={inputSt} placeholder={selectedPreset ? `${selectedPreset.emoji} ${selectedPreset.label}` : "예) 영어 학원, 태권도..."} value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>⏰ 시간 {selectedPreset && findLastEventByTitle(selectedPreset.label) && <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>(지난번 시간)</span>}</label>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ padding: "12px 14px", border: "2px solid #F3F4F6", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", flex: 1 }} />
                                <div style={{ display: "flex", gap: 4 }}>
                                    <button onClick={() => { const [h, m] = newTime.split(":").map(Number); const nh = m > 0 ? h : Math.max(0, h - 1); const nm = m > 0 ? 0 : 30; setNewTime(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`); }}
                                        style={{ width: 36, height: 36, borderRadius: 10, border: "2px solid #F3F4F6", background: "#FAFAFA", cursor: "pointer", fontWeight: 800, fontSize: 16, fontFamily: FF, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                                    <button onClick={() => { const [h, m] = newTime.split(":").map(Number); const nm = m >= 30 ? 0 : 30; const nh = m >= 30 ? Math.min(23, h + 1) : h; setNewTime(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`); }}
                                        style={{ width: 36, height: 36, borderRadius: 10, border: "2px solid #F3F4F6", background: "#FAFAFA", cursor: "pointer", fontWeight: 800, fontSize: 16, fontFamily: FF, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                                </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {["13:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "18:00"].map(t => (
                                    <button key={t} onClick={() => setNewTime(t)}
                                        style={{ padding: "5px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FF, border: newTime === t ? "2px solid #E879A0" : "1.5px solid #F3F4F6", background: newTime === t ? "#FFF0F7" : "#FAFAFA", color: newTime === t ? "#E879A0" : "#9CA3AF", transition: "all 0.15s" }}>
                                        {parseInt(t) > 12 ? `오후 ${parseInt(t) - 12}` : `오전 ${parseInt(t)}`}:{t.split(":")[1]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>🏁 종료시간 <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>(선택)</span></label>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)}
                                    style={{ padding: "12px 14px", border: `2px solid ${newEndTime ? "#E879A0" : "#F3F4F6"}`, borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", flex: 1 }} />
                                {newEndTime && (
                                    <button onClick={() => setNewEndTime("")}
                                        style={{ padding: "6px 12px", borderRadius: 12, border: "none", background: "#F3F4F6", color: "#9CA3AF", cursor: "pointer", fontSize: 13, fontFamily: FF }}>삭제</button>
                                )}
                            </div>
                            {newEndTime && (
                                <div style={{ fontSize: 11, color: "#E879A0", marginTop: 4, fontWeight: 600 }}>⏱ {newTime} ~ {newEndTime}</div>
                            )}
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>🏷️ 종류 {selectedPreset && <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>(자동 매칭됨)</span>}</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {CATEGORIES.map(cat => <button key={cat.id} onClick={() => setNewCategory(cat.id)} style={{ padding: "8px 14px", borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF, background: newCategory === cat.id ? cat.color : cat.bg, color: newCategory === cat.id ? "white" : cat.color, border: `2px solid ${cat.color}` }}>{cat.emoji} {cat.label}</button>)}
                            </div>
                        </div>
                        {(isParent || savedPlaces.length > 0 || newLocation) && (
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                                    <label style={{ ...labelSt, marginBottom: 0 }}>
                                        📍 학원/장소 위치 {newLocation && <span style={{ fontSize: 11, color: "#059669", fontWeight: 500 }}>(다음에도 자동 적용)</span>}
                                    </label>
                                    {isParent && (
                                        <button
                                            type="button"
                                            aria-label="📍 자주 가는 장소 추가"
                                            onClick={handleOpenSavedPlaceMgr}
                                            style={{
                                                border: "none",
                                                borderRadius: 12,
                                                padding: "7px 10px",
                                                background: "linear-gradient(135deg,#F472B6,#DB2777)",
                                                color: "white",
                                                fontSize: 11,
                                                fontWeight: 800,
                                                cursor: "pointer",
                                                fontFamily: FF,
                                                flexShrink: 0,
                                            }}
                                        >
                                            + 자주 가는 장소
                                        </button>
                                    )}
                                </div>
                                {isParent && !entitlement.canUse(FEATURES.SAVED_PLACES) && (
                                    <div style={{ fontSize: 11, color: "#BE185D", marginBottom: 10, fontWeight: 700, fontFamily: FF }}>
                                        유료계정은 자주가는 장소를 무제한 등록할 수 있어요
                                    </div>
                                )}
                                {savedPlaces.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                                        {savedPlaces.map((place) => {
                                            const active = newLocation?.address === place.location?.address;
                                            return (
                                                <button
                                                    key={place.id}
                                                    type="button"
                                                    onClick={() => setNewLocation(place.location)}
                                                    style={{
                                                        padding: "8px 12px",
                                                        borderRadius: 16,
                                                        border: active ? "2px solid #DB2777" : "1.5px solid #FBCFE8",
                                                        background: active ? "#FFF0F7" : "#FFF7FB",
                                                        color: active ? "#BE185D" : "#9D174D",
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        cursor: "pointer",
                                                        fontFamily: FF,
                                                    }}
                                                >
                                                    📍 {place.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {newLocation ? (
                                    <div style={{ background: "#FFF0F7", borderRadius: 14, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                        <div style={{ fontSize: 13, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {newLocation.address}</div>
                                        {isParent ? (
                                            <button onClick={() => { setEditingLocForEvent(null); setShowMapPicker(true); }} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid #E879A0", color: "#E879A0", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                        ) : (
                                            <button onClick={() => setNewLocation(null)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid #D1D5DB", color: "#6B7280", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>지우기</button>
                                        )}
                                    </div>
                                ) : isParent ? (
                                    <button onClick={() => { setEditingLocForEvent(null); setShowMapPicker(true); }} style={{ width: "100%", padding: "12px 14px", border: "2px dashed #F9A8D4", borderRadius: 14, background: "#FFF0F7", color: "#E879A0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>🗺️ 지도에서 장소 선택</button>
                                ) : (
                                    <div style={{ background: "#FFF7ED", color: "#C2410C", borderRadius: 14, padding: "10px 12px", fontSize: 12, fontWeight: 700, fontFamily: FF }}>
                                        부모님이 등록한 장소를 선택하면 일정에 바로 연결돼요
                                    </div>
                                )}
                            </div>
                        )}
                        <div style={{ marginBottom: 14 }}><label style={labelSt}>📝 메모 (선택)</label><input style={inputSt} placeholder="준비물, 장소 등..." value={newMemo} onChange={e => setNewMemo(e.target.value)} /></div>
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                <label style={{ ...labelSt, marginBottom: 0, flex: 1 }}>🔁 매주 같은 날에 반복</label>
                                <div onClick={() => setWeeklyRepeat(p => !p)} style={{ width: 52, height: 30, borderRadius: 15, background: weeklyRepeat ? "#E879A0" : "#E5E7EB", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                                    <div style={{ width: 24, height: 24, borderRadius: 12, background: "white", position: "absolute", top: 3, left: weeklyRepeat ? 25 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                                </div>
                            </div>
                            {weeklyRepeat && (
                                <>
                                    <div style={{ display: "flex", gap: 6, animation: "kkukFadeIn 0.2s ease", marginBottom: 8 }}>
                                        {[{ w: 4, label: "📅 1개월" }, { w: 8, label: "📅 2개월" }, { w: 12, label: "📅 3개월" }].map(({ w, label }) => (
                                            <button key={w} onClick={() => setRepeatWeeks(w)}
                                                style={{ flex: 1, padding: "8px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, border: repeatWeeks === w ? "2px solid #E879A0" : "2px solid #F3F4F6", background: repeatWeeks === w ? "#FFF0F7" : "#F9FAFB", color: repeatWeeks === w ? "#E879A0" : "#6B7280", transition: "all 0.15s" }}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, textAlign: "center" }}>
                                        {(() => { const [y, m, d] = dateKey.split("-").map(Number); const end = new Date(y, m, d + (repeatWeeks - 1) * 7); return `${m + 1}/${d} ~ ${end.getMonth() + 1}/${end.getDate()} 매주 ${["일","월","화","수","목","금","토"][new Date(y, m, d).getDay()]}요일`; })()}
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={addEvent} style={primBtn}>{weeklyRepeat ? `🐰 앞으로 ${repeatWeeks === 4 ? "1개월" : repeatWeeks === 8 ? "2개월" : "3개월"}간 매주 추가!` : "🐰 일정 추가하기!"}</button>
                        <button onClick={() => { setShowAddModal(false); setNewTitle(""); setNewEndTime(""); setNewLocation(null); setSelectedPreset(null); setWeeklyRepeat(false); setRepeatWeeks(4); }} style={secBtn}>취소</button>
                    </div>
                </div>
            )}

            {/* Route Overlay */}
            {routeEvent && (
                <RouteOverlay ev={routeEvent} childPos={displayChildPos} mapReady={mapReady} mapLoadError={mapLoadError} isChildMode={!isParent} onClose={() => setRouteEvent(null)} />
            )}

            {/* Map Picker */}
            {showMapPicker && (
                <MapPicker
                    initial={editingLocForEvent ? Object.values(events).flat().find(e => e.id === editingLocForEvent)?.location : newLocation}
                    currentPos={childPos}
                    onClose={() => setShowMapPicker(false)}
                    onConfirm={loc => { if (editingLocForEvent) updateEvField(editingLocForEvent, "location", loc); else setNewLocation(loc); setShowMapPicker(false); }} />
            )}

            {/* Pairing Modal (only when family exists) */}
            {showPairing && familyId && (
                <PairingModal myRole={familyInfo?.myRole || myRole} pairCode={pairCode} pairedMembers={familyInfo?.members}
                    familyId={familyId}
                    maxChildren={entitlement.canUse(FEATURES.MULTI_CHILD) ? 2 : 1}
                    lockedMessage={!entitlement.canUse(FEATURES.MULTI_CHILD) ? "두 번째 아이를 추가하려면 프리미엄을 시작해 주세요" : ""}
                    pairCodeExpiresAt={familyInfo?.pairCodeExpiresAt || null}
                    onRegenerate={async () => {
                        try {
                            await regeneratePairCode(familyId);
                            const fam = await getMyFamily(authUser.id);
                            if (fam) setFamilyInfo(fam);
                            showNotif("새 연동 코드가 생성됐어요");
                        } catch (err) {
                            console.error("[regenerate]", err);
                            showNotif("새 코드 생성 실패: " + (err?.message || err), "error");
                            throw err; // let PairCodeSection's alert fire too
                        }
                    }}
                    onUnpair={async (childUserId) => {
                        try {
                            await unpairChild(familyId, childUserId);
                            const fam = await getMyFamily(authUser.id);
                            if (fam) setFamilyInfo(fam);
                            showNotif("연동이 해제됐어요");
                        } catch (err) { console.error("[unpair]", err); showNotif("해제 실패", "error"); }
                    }}
                    onRename={async (userId, newName) => {
                        try {
                            const { error } = await supabase.rpc("rename_family_member", { p_family_id: familyId, p_user_id: userId, p_new_name: newName });
                            if (error) throw error;
                            const fam = await getMyFamily(authUser.id);
                            if (fam) setFamilyInfo(fam);
                            showNotif(`이름이 "${newName}"으로 변경됐어요`);
                        } catch (err) { console.error("[rename]", err); showNotif("이름 변경 실패: " + (err.message || err), "error"); }
                    }}
                    onClose={() => setShowPairing(false)} />
            )}

            {/* Phase 5 GATE-01/02: ChildPairInput overlay removed — pre-pair
                UI gate now preempts this entire render tree at line ~5857 via
                early-return, so an unpaired child never reaches this point. */}

            <TrialInvitePrompt
                open={showTrialInvite}
                isChild={!isParent}
                onStart={() => startTrial(PRICING.monthlyProductId)}
                onDismiss={() => setShowTrialInvite(false)}
            />

            <FeatureLockOverlay
                open={featureLock.open}
                feature={featureLock.feature}
                customTitle={featureLock.title}
                customBody={featureLock.body}
                isChild={!isParent}
                onStart={() => startTrial(PRICING.monthlyProductId)}
                onClose={closeFeatureLock}
            />

            <AutoRenewalDisclosure
                open={showDisclosure}
                onConfirm={confirmStartTrial}
                onClose={() => {
                    setShowDisclosure(false);
                    setPendingProduct(null);
                }}
            />

            {showSubscriptionSettings && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 650,
                        background: "rgba(15,23,42,0.45)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        padding: 20,
                    }}
                    onClick={(event) => {
                        if (event.target === event.currentTarget) setShowSubscriptionSettings(false);
                    }}
                >
                    <div style={{ width: "100%", maxWidth: 460 }}>
                        <SubscriptionManagement
                            entitlement={entitlement}
                            role={myRole}
                            onRefresh={entitlement.refresh}
                            onStartTrial={startTrial}
                        />
                        <button
                            type="button"
                            onClick={() => setShowSubscriptionSettings(false)}
                            style={{
                                width: "100%",
                                marginTop: 10,
                                padding: "12px 14px",
                                borderRadius: 16,
                                border: "none",
                                background: "white",
                                color: "#6B7280",
                                fontWeight: 700,
                                cursor: "pointer",
                                boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                            }}
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}

            {showNotifSettings && (
                <NotificationSettingsModal
                    settings={globalNotif}
                    isParentMode={isParent}
                    onSave={(nextSettings) => {
                        setGlobalNotif(nextSettings);
                        setShowNotifSettings(false);
                        showNotif("🔔 일정 알림 설정이 저장됐어요!");
                    }}
                    onClose={() => setShowNotifSettings(false)}
                />
            )}

            {showRemoteAudio && isParent && entitlement.canUse(FEATURES.REMOTE_AUDIO) && (
                <AmbientAudioRecorder
                    channel={realtimeChannel.current}
                    familyId={familyId}
                    senderUserId={authUser?.id}
                    onClose={() => setShowRemoteAudio(false)}
                />
            )}

            {showMicPermissionHelp && !isParent && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="mic-permission-title"
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 900,
                        background: "rgba(15,23,42,0.46)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        padding: 20,
                    }}
                    onClick={(event) => {
                        if (event.target === event.currentTarget) setShowMicPermissionHelp(false);
                    }}
                >
                    <div style={{ width: "100%", maxWidth: 420, background: "white", borderRadius: 24, padding: "22px 20px 20px", boxShadow: "0 16px 42px rgba(15,23,42,0.24)", fontFamily: FF }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 46, height: 46, borderRadius: 16, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🎤</div>
                            <div>
                                <div id="mic-permission-title" style={{ fontSize: 18, fontWeight: 900, color: "#991B1B" }}>마이크 권한이 필요해요</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#EF4444", marginTop: 2 }}>주위 소리 듣기 연결이 중단됐어요</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#4B5563", fontWeight: 600, marginBottom: 14 }}>
                            아이 기기에서 마이크 권한을 허용해야 부모님과 주위 소리 듣기 세션을 안전하게 연결할 수 있어요.
                        </div>
                        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 16, padding: "12px 14px", color: "#7F1D1D", fontSize: 12, lineHeight: 1.55, fontWeight: 800, marginBottom: 16 }}>
                            Android 설정 &gt; 앱 &gt; 혜니캘린더 &gt; 권한 &gt; 마이크 &gt; 허용
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            {isNativeApp && (
                                <button
                                    type="button"
                                    onClick={openAppPermissionSettings}
                                    style={{ flex: 1, padding: "13px 14px", borderRadius: 14, border: "none", background: "#DC2626", color: "white", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: FF }}
                                >
                                    설정 열기
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowMicPermissionHelp(false)}
                                style={{ flex: 1, padding: "13px 14px", borderRadius: 14, border: "none", background: "#F3F4F6", color: "#4B5563", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: FF }}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Child Tracker (학부모 전용) ── */}
            {showChildTracker && <ChildTrackerOverlay
                childPos={displayChildPos} allChildPositions={displayChildPositions}
                events={events} mapReady={mapReady}
                arrivedSet={arrivedSet} onClose={() => setShowChildTracker(false)}
                locationTrail={locationTrail}
                locationHint={locationGateHint}
                refreshRequestedAt={locationRefreshRequestedAt}
                onRefreshLocation={() => requestChildLocationRefresh("manual_refresh")}
            />}

            {/* ── Phone Settings Modal (학부모 전용) ── */}
            {showPhoneSettings && <PhoneSettingsModal
                phones={parentPhones}
                onSave={async (phones) => {
                    setParentPhones(phones);
                    setShowPhoneSettings(false);
                    showNotif("📞 연락처가 저장됐어요!");
                    if (familyId) {
                        try {
                            await saveParentPhones(familyId, phones.mom, phones.dad);
                        } catch (err) {
                            console.error("[savePhones]", err);
                        }
                    }
                }}
                onClose={() => setShowPhoneSettings(false)}
            />}

            <FeedbackModal
                open={showFeedbackModal}
                value={feedbackDraft}
                onChange={setFeedbackDraft}
                busy={feedbackBusy}
                onSend={handleSendFeedback}
                onClose={() => setShowFeedbackModal(false)}
            />

            {/* ── Sticker Book Modal ── */}
            {showStickerBook && <StickerBookModal
                stickers={stickers}
                summary={stickerSummary}
                dateLabel={`${currentMonth + 1}월 ${selectedDate}일`}
                isParentMode={isParent}
                onGiveSticker={isParent ? async (emoji, title) => {
                    const childMember = familyInfo?.members?.find(m => m.role === "child");
                    if (!childMember || !familyId) return;
                    await addSticker(childMember.user_id, familyId, `praise-${Date.now()}`, dateKey, "praise", emoji, title);
                    showNotif(`${emoji} 칭찬스티커를 보냈어요!`);
                    sendInstantPush({
                        action: "new_event", familyId, senderUserId: authUser?.id,
                        title: `${emoji} 칭찬스티커!`,
                        message: `부모님이 칭찬스티커를 보냈어요! "${title}"`,
                    });
                    setTimeout(() => fetchStickersForDate(familyId, dateKey).then(s => setStickers(s)), 500);
                } : null}
                onClose={() => setShowStickerBook(false)}
            />}

            {/* ── AI Schedule Modal (학부모 전용) ── */}
            {showAiSchedule && <AiScheduleModal
                academies={academies}
                currentDate={{ year: currentYear, month: currentMonth, day: selectedDate }}
                familyId={familyId}
                authUser={authUser}
                events={events[dateKey] || []}
                startVoiceFn={startVoice}
                onSave={(newEv, dk) => {
                    setEvents(prev => ({ ...prev, [dk]: [...(prev[dk] || []), newEv].sort((a, b) => a.time.localeCompare(b.time)) }));
                    showNotif(`${newEv.emoji} ${newEv.title} 등록 완료!`);
                }}
                onNavigateDate={(y, m, d) => { setCurrentYear(y); setCurrentMonth(m); setSelectedDate(d); }}
                onClose={() => setShowAiSchedule(false)}
            />}

            {/* ── Danger Zone Manager (학부모 전용) ── */}
            {showDangerZones && <DangerZoneManager
                zones={dangerZones}
                familyId={familyId}
                mapReady={mapReady}
                onAdd={async (zone) => {
                    if (dangerZones.length >= 1 && !entitlement.canUse(FEATURES.MULTI_GEOFENCE)) {
                        openFeatureLock(FEATURES.MULTI_GEOFENCE);
                        throw new Error("프리미엄 구독이 필요합니다");
                    }
                    const saved = await saveDangerZone(familyId, zone);
                    setDangerZones(prev => [...prev, saved]);
                    showNotif(`⚠️ 위험지역 '${zone.name}' 등록 완료`);
                    return saved;
                }}
                onDelete={async (id) => {
                    await deleteDangerZone(id);
                    setDangerZones(prev => prev.filter(z => z.id !== id));
                    setFiredDangerAlerts(prev => { const n = new Set(prev); n.delete(id); return n; });
                    showNotif("위험지역이 삭제됐어요");
                }}
                onClose={() => setShowDangerZones(false)}
            />}

            {/* ── Phase 5 RL-02: child-side persistent listening indicator ── */}
            {listeningSession && !isParent && (
                <div
                    role="status"
                    aria-live="assertive"
                    style={{
                        position: "fixed",
                        top: 0, left: 0, right: 0,
                        zIndex: 10000,
                        padding: "14px 16px",
                        background: "linear-gradient(135deg, #DC2626, #B91C1C)",
                        color: "white",
                        fontFamily: FF,
                        fontWeight: 900,
                        fontSize: 14,
                        lineHeight: 1.4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        boxShadow: "0 4px 12px rgba(220,38,38,0.35)",
                        textAlign: "center",
                    }}>
                    <span style={{ fontSize: 18 }}>🎤</span>
                    <span>부모님이 주위 소리를 듣고 있어요 · 세션이 끝나면 자동으로 사라져요</span>
                </div>
            )}

            {/* ── 꾹 수신 전체화면 오버레이 ── */}
            {showKkukReceived && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999,
                    background: "linear-gradient(135deg, #FFF0F5, #FFE4EC, #FFF0F7)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    fontFamily: FF, animation: "kkukFadeIn 0.3s ease"
                }}
                    onClick={() => setShowKkukReceived(null)}>
                    <style>{`
                        @keyframes kkukFadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
                        @keyframes kkukPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
                        @keyframes kkukFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
                    `}</style>
                    <div style={{ animation: "kkukPulse 1.2s ease-in-out infinite", marginBottom: 20 }}>
                        <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
                            <ellipse cx="33" cy="22" rx="9" ry="18" fill="#FFD6E8" />
                            <ellipse cx="67" cy="22" rx="9" ry="18" fill="#FFD6E8" />
                            <ellipse cx="33" cy="22" rx="5" ry="13" fill="#FFB3D1" />
                            <ellipse cx="67" cy="22" rx="5" ry="13" fill="#FFB3D1" />
                            <ellipse cx="50" cy="65" rx="26" ry="22" fill="#FFF0F7" />
                            <circle cx="50" cy="48" r="24" fill="#FFF0F7" />
                            <path d="M38 44 Q40 41 42 44" stroke="#FF7BAC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                            <path d="M58 44 Q60 41 62 44" stroke="#FF7BAC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                            <ellipse cx="50" cy="51" rx="3" ry="2" fill="#FFB3D1" />
                            <path d="M45 54 Q50 58 55 54" stroke="#FF7BAC" strokeWidth="2" strokeLinecap="round" fill="none" />
                            <circle cx="37" cy="52" r="5" fill="#FFB3D1" opacity="0.5" />
                            <circle cx="63" cy="52" r="5" fill="#FFB3D1" opacity="0.5" />
                        </svg>
                    </div>
                    <div style={{ fontSize: 56, marginBottom: 16, animation: "kkukFloat 2s ease-in-out infinite" }}>💗</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#E879A0", marginBottom: 8, textAlign: "center" }}>
                        꾹!
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#BE185D", marginBottom: 32, textAlign: "center" }}>
                        {showKkukReceived.from}가 꾹을 보냈어요
                    </div>
                    <div style={{
                        fontSize: 14, color: "#9CA3AF", padding: "12px 24px",
                        background: "rgba(255,255,255,0.6)", borderRadius: 20, fontWeight: 600,
                    }}>
                        화면을 터치하면 닫혀요
                    </div>
                </div>
            )}

        </div>
    );
}
