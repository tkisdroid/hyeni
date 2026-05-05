import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { kakaoLogin, anonymousLogin, getSession, setupFamily, joinFamily, joinFamilyAsParent, getMyFamily, unpairChild, regeneratePairCode, saveParentPhones, onAuthChange, logout, generateUUID, getParentNameFromUser, getParentPhoneFromUser, getParentGenderFromUser } from "./lib/auth.js";
import { getAuthProvider, requestPhoneSignupCode, signInWithLoginId, syncAuthProfile, verifyPhoneSignupCode } from "./lib/accountAuth.js";
import { deriveParentCapabilities } from "./lib/parentCapabilities.js";
import { dispatchBack, useBackHandler } from "./lib/backHandler.js";
import { BirthdatePicker } from "./components/birthdate/BirthdatePicker.jsx";
import { PairingWizard } from "./components/multichild/PairingWizard/PairingWizard.jsx";
import { ColorPicker } from "./components/multichild/PairingWizard/ColorPicker.jsx";
import { HomeTab } from "./components/multichild/HomeDashboard/HomeTab.jsx";
import { TodayMultiChildView } from "./components/multichild/HomeDashboard/TodayMultiChildView.jsx";
import { ChildAvatar } from "./components/multichild/HomeDashboard/ChildAvatar.jsx";
import { ChildPermissionWizard } from "./components/onboarding/ChildPermissionWizard.jsx";
import { SplashScreen } from "./components/auth/SplashScreen.jsx";
import { ChildEntryTransition } from "./components/auth/ChildEntryTransition.jsx";
import { HyeniMascot } from "./components/auth/HyeniMascot.jsx";
import { useChildren } from "./lib/childrenContext.js";
import { ChildSelector } from "./components/multichild/EventModal/ChildSelector.jsx";
import { EventSheet } from "./components/multichild/EventModal/EventSheet.jsx";
import { ChildDetailScreen } from "./components/multichild/ChildDetail/ChildDetailScreen.jsx";
import { ChildHero } from "./components/childMode/ChildHero.jsx";
import { ChildSettingsScreen } from "./components/childMode/ChildSettingsScreen.jsx";
import { SendStickerSheet } from "./components/childMode/SendStickerSheet.jsx";
import { MemoBubble } from "./components/childMode/MemoBubble.jsx";
import { ParentSettingsScreen } from "./components/settings/ParentSettingsScreen.jsx";
import { PlaceManagerScreen } from "./components/settings/PlaceManagerScreen.jsx";
// CreatePlaydateSheet — Phase 5 wire 대기 (현재는 import 보류)
import { saveEventWithChildren } from "./lib/sync.js";
import { fetchEvents, fetchEventById, fetchAcademies, fetchMemos, fetchSavedPlaces, insertEvent, updateEvent, deleteEvent as dbDeleteEvent, insertAcademy, updateAcademy, deleteAcademy as dbDeleteAcademy, insertSavedPlace, updateSavedPlace, deleteSavedPlace, upsertMemo, subscribeFamily, unsubscribe, getCachedEvents, getCachedAcademies, getCachedMemos, getCachedSavedPlaces, cacheEvents, cacheAcademies, cacheMemos, cacheSavedPlaces, saveChildLocation, fetchChildLocations, saveLocationHistory, fetchTodayLocationHistory, fetchLocationHistoryForDate, addSticker, fetchStickersForDate, fetchStickerSummary, fetchDangerZones, saveDangerZone, deleteDangerZone, fetchParentAlerts, markAlertRead, fetchMemoReplies, fetchMemoRepliesForDateKeys, sendMemo, markMemoReplyRead } from "./lib/sync.js";
import { registerSW, requestPermission, getPermissionStatus, scheduleNotifications, scheduleNativeAlarms, showArrivalNotification, showEmergencyNotification, showKkukNotification, clearAllScheduled, subscribeToPush, unsubscribeFromPush, getNativeNotificationHealth, openNativeNotificationSettings, requestNativePermission, DEFAULT_NOTIFICATION_SETTINGS, normalizeNotifSettings } from "./lib/pushNotifications.js";
import { supabase } from "./lib/supabase.js";
import { applyThemeColor, initThemeFromCache } from "./lib/theme.js";
import { FEATURES } from "./lib/features.js";
import { useEntitlement } from "./lib/entitlement.js";
import { identify as identifySubscriptionUser, purchase as purchaseSubscription } from "./lib/qonversion.js";
import { sendBroadcastWhenReady } from "./lib/realtime.js";
import { getChildMemoQuickReplies, getMemoPreview, getParentMemoQuickReplies } from "./lib/memoDisplay.js";
import { buildHomeRouteEvent, findHomeSavedPlace } from "./lib/navigationTargets.js";
import { LOCATION_TRAIL_GRADIENT_STOPS, buildLocationDaySummary, getStayDisplayParts } from "./lib/locationTrailDisplay.js";
import {
    LOCATION_TRAIL_JITTER_M,
    LOCATION_TRAIL_DWELL_RADIUS_M,
    LOCATION_TRAIL_DWELL_MIN_MS,
    haversineM,
    toRoutePosition,
    finiteNumber,
    compactRoutePoints,
    sumRouteDistance,
    normalizeLocationTrailPoint,
    compactLocationTrailPoints,
    buildSelectedLocationTrail,
    formatTrailClock,
    formatTrailDuration,
    clampTrailProgress,
    hexToRgb,
    rgbToHex,
    interpolateTrailColor,
    getTrailTimeBounds,
    getTrailProgress,
    getTrailHourKey,
    getTrailHourLabel,
    buildTrailHourSegments,
    buildTrailGradientSegments,
    averageTrailPoint,
    buildTrailDwellPlaces,
} from "./lib/trailMath.js";
import {
    formatLatLngLabel,
    getPositionLocationKey,
    extractNeighborhoodLabel,
    formatCompactPlaceName,
    buildCompactAddressLabel,
    buildReadablePlaceName,
    isDetailedKoreanAddress,
    extractPreciseAddressFromKakao,
    hasPlaceLocation,
    getPlaceLocationKey,
    buildSavedPlaceItems,
    buildSchedulePlaceOptions,
    buildEventPlaceItems,
    eventDateValue,
} from "./lib/placeFormat.js";
import { createHttpError, parseKakaoWalkingRoute, parseOsmFootRoute } from "./lib/routeParsers.js";
import {
    getMemoTime,
    getRelativeTime,
    getDateSeparatorLabel,
    localDayKey,
    memoDateKeyFromParts,
    buildMemoThreadDateKeys,
    buildMessageItems,
} from "./lib/memoTime.js";
import { readMemoRepliesCache, writeMemoRepliesCache } from "./lib/memoCache.js";
import {
    DESIGN,
    FF,
    modalBackdropStyle,
    makeCardStyle,
    makeSheetStyle,
    makeInputStyle,
    makePrimaryButtonStyle,
    makeSecondaryButtonStyle,
} from "./lib/styleHelpers.js";
import { AppConfirmDialog } from "./components/dialogs/AppConfirmDialog.jsx";
import { AlertBanner } from "./components/banners/AlertBanner.jsx";
import { EmergencyBanner } from "./components/banners/EmergencyBanner.jsx";
import { AppBrandLogo } from "./components/auth/AppBrandLogo.jsx";
import { ParentSetupScreen } from "./components/auth/ParentSetupScreen.jsx";
import { normalizePairCodeInput } from "./lib/pairCode.js";
import { RoleSetupModal } from "./components/auth/RoleSetupModal.jsx";
import { ParentAuthScreen } from "./components/auth/ParentAuthScreen.jsx";
import { ParentSignupScreen } from "./components/auth/ParentSignupScreen.jsx";
import { rememberParentPairingIntent, clearParentPairingIntent } from "./lib/parentPairingIntent.js";
import { buildSelectedChildCommandPayload, filterEventMapForChild, resolveSelectedChildPosition } from "./lib/selectedChildIsolation.js";
import { formatDeviceDuration } from "./lib/deviceFormat.js";
import { PRICING } from "./lib/paywallCopy.js";
import { TrialInvitePrompt } from "./components/paywall/TrialInvitePrompt.jsx";
import { FeatureLockOverlay } from "./components/paywall/FeatureLockOverlay.jsx";
import { TrialEndingBanner } from "./components/paywall/TrialEndingBanner.jsx";
import { AutoRenewalDisclosure } from "./components/paywall/AutoRenewalDisclosure.jsx";
import { SubscriptionManagement } from "./components/settings/SubscriptionManagement.jsx";
import FriendPlaydatePanel from "./components/friendPlaydate/FriendPlaydatePanel.jsx";
import FriendPlaydateChildPanel from "./components/friendPlaydate/FriendPlaydateChildPanel.jsx";
import ActivePlaydateBanner from "./components/friendPlaydate/ActivePlaydateBanner.jsx";
import { upsertPublicPlace } from "./lib/friendPlaydate.js";
import { ForceRingPanel } from "./components/forceRing/ForceRingPanel.jsx";
import AcademyCard from "./components/place-management/AcademyCard.jsx";
import DangerCard from "./components/place-management/DangerCard.jsx";
import SavedPlacesSection from "./components/place-management/SavedPlacesSection.jsx";
import { getDeviceLabelFromUA } from "./lib/deviceInfo.js";
import { normalizeKakaoAppKey, KAKAO_APP_KEY, loadKakaoMap } from "./lib/kakaoMap.js";
import { CHILD_MARKER_COLORS } from "./lib/markerColors.js";
import { MapZoomControls } from "./components/map/MapZoomControls.jsx";
import { FallbackMapCanvas } from "./components/map/FallbackMapCanvas.jsx";
import { MapPicker } from "./components/map/MapPicker.jsx";
import { CATEGORIES, ACADEMY_PRESETS } from "./lib/scheduleCategories.js";
import { AcademyManager } from "./components/place-management/AcademyManager.jsx";
import { LocationMapView } from "./components/map/LocationMapView.jsx";
import { ChildTrackerOverlay } from "./components/childTracker/ChildTrackerOverlay.jsx";
import { MemoSection } from "./components/memo/MemoSection.jsx";
import { PairingModal } from "./components/pairing/PairingModal.jsx";
import { summarizeRemoteListenHealth, resolveChildRemoteListenHealth } from "./lib/remoteListenHealth.js";
import { sendInstantPush } from "./lib/instantPush.js";
import { escHtml } from "./lib/htmlEscape.js";
import "./App.css";

const KAKAO_REST_KEY = normalizeKakaoAppKey(import.meta.env.VITE_KAKAO_REST_KEY);
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const KAKAO_WALKING_DIRECTIONS_URL = "https://apis-navi.kakaomobility.com/affiliate/walking/v1/directions";
const OSM_FOOT_DIRECTIONS_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";
const ROUTE_REQUEST_TIMEOUT_MS = 12_000;
// PARENT_PAIRING_INTENT_KEY moved to ./lib/parentPairingIntent.js
const PUSH_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/push-notify` : "";
const AI_PARSE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-voice-parse` : "";
const AI_MONITOR_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-child-monitor` : "";
const FEEDBACK_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/feedback-email` : "";
const FEEDBACK_RECIPIENT = "tkisdroid@gmail.com";
const REMOTE_LISTEN_CHANNEL_ID = "hyeni_remote_listen_v2";

// normalizePairCodeInput moved to ./lib/pairCode.js — imported at top.

function getNativeSetupAction(health) {
    if (!health) return null;
    if (!health.recordAudioGranted) {
        return { target: "appDetails", label: "마이크 권한 허용" };
    }
    if (!health.postPermissionGranted || !health.notificationsEnabled || !health.channelsEnabled) {
        return { target: "notifications", label: "알림 권한 열기" };
    }
    if (health.remoteListenChannelEnabled === false) {
        return { target: "remoteListenChannel", label: "연결 알림 켜기", channelId: REMOTE_LISTEN_CHANNEL_ID };
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

const CHILD_SAFETY_SETUP_STEPS = Object.freeze([
    {
        id: "microphone",
        title: "마이크 권한",
        description: "부모님이 요청했을 때 주변 소리 연결을 시작할 수 있어요.",
        target: "appDetails",
        actionLabel: "권한 열기",
        isReady: (health) => health?.recordAudioGranted === true,
    },
    {
        id: "notifications",
        title: "알림 권한",
        description: "앱이 닫혀 있어도 연결 요청을 받을 수 있어요.",
        target: "notifications",
        actionLabel: "알림 켜기",
        isReady: (health) => !!health && health.postPermissionGranted === true && health.notificationsEnabled === true && health.channelsEnabled === true,
    },
    {
        id: "remoteListenChannel",
        title: "연결 알림",
        description: "자동 실행이 막혀도 아이 기기에 연결 알림이 남아요.",
        target: "remoteListenChannel",
        channelId: REMOTE_LISTEN_CHANNEL_ID,
        actionLabel: "채널 열기",
        isReady: (health) => health?.remoteListenChannelEnabled !== false,
    },
    {
        id: "fullScreen",
        title: "전체화면 알림",
        description: "잠금 화면에서도 연결 화면을 자동으로 띄울 확률을 높여요.",
        target: "fullScreen",
        actionLabel: "허용하기",
        isReady: (health) => health?.fullScreenIntentAllowed === true,
    },
    {
        id: "battery",
        title: "배터리 예외",
        description: "절전 모드가 위치 서비스와 연결 요청을 끊지 않게 해요.",
        target: "battery",
        actionLabel: "예외 허용",
        isReady: (health) => health?.batteryOptimizationsIgnored === true,
    },
    {
        id: "backgroundLocation",
        title: "위치 항상 허용",
        description: "앱이 화면 밖에 있어도 위치와 안전 상태를 계속 보낼 수 있어요.",
        target: "appLocation",
        actionLabel: "위치 권한",
        isReady: (_health, bgLocationGranted) => bgLocationGranted === true,
    },
    {
        id: "locationService",
        title: "위치 서비스",
        description: "백그라운드 유지와 FCM fallback을 담당하는 서비스예요.",
        target: "locationService",
        actionLabel: "다시 시작",
        isReady: (health) => health?.locationServiceRunning === true,
    },
]);

function getChildSafetySetupSteps(health, bgLocationGranted) {
    return CHILD_SAFETY_SETUP_STEPS.map((step) => ({
        ...step,
        ready: step.isReady(health, bgLocationGranted),
    }));
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
// createPushIdempotencyKey / sendInstantPush moved to ./lib/instantPush.js — imported at top.


const REMOTE_AUDIO_CHUNK_MS = 1000;
const REMOTE_AUDIO_DEFAULT_DURATION_SEC = 60;
const REMOTE_AUDIO_WAITING_HELP_MS = 25_000;
const TRIAL_INVITE_SHOWN_KEY = "hyeni-trial-invite-shown";
const REMOTE_AUDIO_MIME_TYPES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
];
const REMOTE_AUDIO_LEVEL_BARS = [12, 18, 24, 20, 16];
// CHILD_TRACKER_* constants moved to ./components/childTracker/ChildTrackerOverlay.jsx (B7).
// APP_BRAND_LOGO_SRC moved to ./components/auth/AppBrandLogo.jsx
const PROFILE_THEME_RPC_MISSING_MESSAGE = "테마 색상 저장 서버 함수가 아직 반영되지 않았어요. 서버 migration 적용 후 다시 저장해 주세요.";
const AI_SCHEDULE_BUTTON_LABEL = `${String.fromCodePoint(0x1F916)} AI` + "로 일정입력";

function isMissingProfileThemeRpcError(error) {
    const message = String(error?.message || error?.details || error?.hint || "");
    return error?.code === "PGRST202"
        || message.includes("set_family_member_profile_by_id")
        || message.includes("Could not find the function");
}

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

// Freemium location gate.
//   premium (REALTIME_LOCATION): always show, isDelayed=false.
//   free: show the most recent fix tagged isDelayed=true so the UI can
//         render a "5분 지연" badge / fuzzed marker. The previous logic
//         returned null whenever the fix was less than 5 min old, which
//         meant a free parent whose child's GPS updates every 30s
//         **never** saw a position at all (each fresh fix reset the gate).
//         The honest gate is "free users see a delayed/marked position",
//         not "free users see nothing while fixes are continuous".
function effectiveChildLocation(location, entitlement) {
    if (!location) return null;
    if (entitlement?.canUse?.(FEATURES.REALTIME_LOCATION)) {
        return { ...location, isDelayed: false };
    }
    const updatedAtMs = new Date(location.updatedAt || location.updated_at || 0).getTime();
    if (!updatedAtMs || Number.isNaN(updatedAtMs)) return null;
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

// Moved to ./lib/deviceFormat.js so HomeDashboard's per-child cards can
// share the exact same label format. Imported at top of file.

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

// rememberParentPairingIntent / clearParentPairingIntent moved to ./lib/parentPairingIntent.js — imported at top.

// AppBrandLogo moved to ./components/auth/AppBrandLogo.jsx — imported at top.

// ─────────────────────────────────────────────────────────────────────────────
// Parent Setup Screen (extracted component – hooks must be at top level)
// ─────────────────────────────────────────────────────────────────────────────
// DESIGN / FF / modalBackdropStyle / make*Style moved to ./lib/styleHelpers.js — imported at top.

// ParentSetupScreen moved to ./components/auth/ParentSetupScreen.jsx — imported at top.

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

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
// escHtml moved to ./lib/htmlEscape.js — imported at top.

const ARRIVAL_R = 50; // metres (geo-fence radius)
const DEPARTURE_TIMEOUT_MS = 90_000; // 90초 outside = departure alert (GPS 지터 오알림 방지)
const DEFAULT_NOTIF = normalizeNotifSettings(DEFAULT_NOTIFICATION_SETTINGS);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const LOCATION_HISTORY_MIN_DISTANCE_M = 15;
const LOCATION_HISTORY_MAX_AGE_MS = 5 * 60_000;

// Trail math helpers moved to ./lib/trailMath.js — imported at top.

// createHttpError / parseKakaoWalkingRoute / parseOsmFootRoute moved to ./lib/routeParsers.js — imported at top.

// Time-based latch: a single 401/403 from Kakao does not permanently
// disable walking routes for the rest of the session. After KAKAO_WALKING_
// COOLDOWN_MS we let the next caller probe the API again — recovers
// automatically from transient quota glitches / brief deploys without
// requiring a reload.
const KAKAO_WALKING_COOLDOWN_MS = 5 * 60 * 1000;
let kakaoWalkingDirectionsDisabledUntil = 0;

async function fetchKakaoWalkingRoute(start, destination, signal) {
    if (!KAKAO_REST_KEY || Date.now() < kakaoWalkingDirectionsDisabledUntil) {
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
            kakaoWalkingDirectionsDisabledUntil = Date.now() + KAKAO_WALKING_COOLDOWN_MS;
        }
        throw createHttpError(`Kakao walking route HTTP ${response.status}`, response.status);
    }

    // Successful probe — clear the latch so subsequent calls take the
    // happy path immediately.
    kakaoWalkingDirectionsDisabledUntil = 0;
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

    // Kakao-only. The OSM (OSRM) fallback used to fire on Kakao failure but
    // routed children through an open-data road-graph that did not match the
    // walking-distance heuristics the in-app guidance card surfaces, so a
    // failed Kakao request silently re-routed to OSM and the parent saw a
    // distance that disagreed with the displayed straight-line. The caller
    // (requestWalkingRoute) catches the throw and falls back to
    // drawDirectRoute (in-app straight-line + 예상 직선거리 label).
    return await fetchKakaoWalkingRoute(startCoord, destinationCoord, signal);
}

// Place / address formatters moved to ./lib/placeFormat.js — imported at top.

const getDIM = (y, m) => new Date(y, m + 1, 0).getDate();
const getFD = (y, m) => new Date(y, m, 1).getDay();
const fmtT = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

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
// Alert Banner
// ─────────────────────────────────────────────────────────────────────────────
// AlertBanner moved to ./components/banners/AlertBanner.jsx
// EmergencyBanner moved to ./components/banners/EmergencyBanner.jsx
// — both imported at top.

// AppConfirmDialog moved to ./components/dialogs/AppConfirmDialog.jsx — imported at top.

// RoleSetupModal / ParentAuthScreen / ParentSignupScreen moved to ./components/auth/ — imported at top.

// ─────────────────────────────────────────────────────────────────────────────
// Pair Code Section (shows code prominently or in collapsible after pairing)
// ─────────────────────────────────────────────────────────────────────────────
// PairCodeSection / ChildRemoteListenReadiness / PairingModal moved to ./components/pairing/PairingModal.jsx (B9).
// REMOTE_LISTEN_HEALTH_STEPS / summarizeRemoteListenHealth / resolveChildRemoteListenHealth moved to ./lib/remoteListenHealth.js (B9).


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
                    {error && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "var(--status-cautionary-strong)" }}>{error}</div>}
                </div>
            </div>
        </div>
    );
}

function ChildPairInput({ userId, onPaired }) {
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    // "" → idle, "connecting" → joinFamily RPC in flight, "loading" → RPC succeeded,
    // onPaired (getMyFamily + setFamilyInfo + permission prompt) still resolving.
    const [phase, setPhase] = useState("");
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
        setBusy(true); setError(""); setPhase("connecting");
        try {
            const result = await joinFamily(fullCode, userId, "아이");
            console.log("[ChildPairInput] joinFamily result:", result);
            // Show success screen IMMEDIATELY so the user knows the code worked,
            // even if onPaired (getMyFamily + permission prompt) takes a few seconds.
            setPhase("loading");
            await onPaired();
            return true;
        } catch (err) {
            console.error("[ChildPairInput] error:", err);
            setPhase("");
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

    if (phase === "loading") {
        return (
            <div className="hyeni-app-shell" style={{ position: "fixed", inset: 0, zIndex: 500, background: DESIGN.gradients.shell, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FF, textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 18 }}>🎉</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "var(--theme-accent-text)", marginBottom: 10 }}>연결됐어요!</div>
                <div style={{ fontSize: 14, color: "var(--fg-secondary)", lineHeight: 1.55 }}>
                    가족 정보를 불러오는 중이에요...<br />위치 권한을 묻는 창이 뜨면 허용해 주세요.
                </div>
            </div>
        );
    }

    return (
        <div className="hyeni-app-shell" style={{ position: "fixed", inset: 0, zIndex: 500, background: DESIGN.gradients.shell, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FF }}>
            <AppBrandLogo size={78} radius={24} />
            <div style={{ fontSize: 24, fontWeight: 900, color: "var(--theme-accent-text)", marginTop: 16, marginBottom: 8 }}>부모님과 연결하기</div>
            <div style={{ fontSize: 14, color: "var(--fg-secondary)", marginBottom: 28, textAlign: "center", lineHeight: 1.6 }}>부모님 앱에 있는<br />연동 코드에서 KID- 뒤의 코드를 입력해 주세요</div>
            <div style={{ position: "relative", width: "100%", maxWidth: 320, marginBottom: 8 }}>
                <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 20, fontFamily: "monospace", fontWeight: 700, color: "var(--theme-accent-text)", pointerEvents: "none", zIndex: 1 }}>KID-</div>
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    placeholder="XXXXXXXX" maxLength={8}
                    style={{ width: "100%", padding: "16px 16px 16px 76px", border: "2px solid var(--theme-accent-line)", borderRadius: 20, fontSize: 20, fontFamily: "monospace", outline: "none", boxSizing: "border-box", letterSpacing: 3, fontWeight: 700, color: "var(--fg-primary)", background: "white", boxShadow: "var(--hyeni-theme-shadow-soft)" }} />
            </div>
            {error && <div style={{ fontSize: 13, color: "var(--status-cautionary-strong)", fontWeight: 700, marginBottom: 8 }}>{error}</div>}
            <button onClick={() => { void handleJoin(); }} disabled={busy}
                style={{ ...makePrimaryButtonStyle({ maxWidth: 320, padding: "16px", fontSize: 16, marginTop: 8, opacity: busy ? 0.7 : 1 }), cursor: busy ? "wait" : "pointer" }}>
                {busy ? "연결 중..." : "🔗 연결하기"}
            </button>
            <button
                type="button"
                onClick={() => { if (!busy) setShowScanner(true); }}
                disabled={busy}
                style={{ ...makeSecondaryButtonStyle({ maxWidth: 320, padding: "14px", color: "var(--theme-accent-text)", border: "1.5px solid var(--theme-accent-line)", background: "var(--theme-accent-soft)", fontSize: 15, marginTop: 10 }), cursor: busy ? "wait" : "pointer" }}
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

function RouteOverlay({ ev, childPos, childProfile = null, mapReady, mapLoadError = "", onClose, isChildMode = false }) {
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
    const suppressViewportEventRef = useRef(false);

    // Compute live distance/time
    const currentPos = livePos || childPos;
    const currentMarkerColor = childProfile?.color_hex || childPos?.color_hex || childPos?.color || "var(--theme-accent)";
    const currentMarkerEmoji = childProfile?.emoji || childPos?.emoji || "👧";
    const currentMarkerLabel = isChildMode ? "내 위치" : `${childProfile?.name || "아이"} 위치`;
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

    const markProgrammaticViewportChange = useCallback(() => {
        suppressViewportEventRef.current = true;
        window.setTimeout(() => {
            suppressViewportEventRef.current = false;
        }, 500);
    }, []);

    const handleManualViewportChange = useCallback(() => {
        if (suppressViewportEventRef.current) return;
        setCentered(false);
    }, []);

    const fitRouteBounds = useCallback((path, startLL, destLL, padding = 80) => {
        if (!mapInst.current || !path?.length) return;
        const bounds = new window.kakao.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        if (startLL) bounds.extend(startLL);
        if (destLL) bounds.extend(destLL);
        markProgrammaticViewportChange();
        mapInst.current.setBounds(bounds, padding);
    }, [markProgrammaticViewportChange]);

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
            // Surface the failure mode (Kakao 401/quota vs network vs parse)
            // so a parent who only sees the straight-line fallback can see
            // *why* in chrome://inspect when filing a bug report.
            console.warn("[Guidance] Walking route failed; using direct line:", {
                message: error?.message || String(error),
                status: error?.status || error?.statusCode || null,
                start,
                destination,
            });
            drawDirectRoute(start, destination, { fit });
            // Settle loading=false + error=true so the "🔍 경로 검색 중..."
            // overlay disappears and the route card switches to the
            // "예상 직선거리 · 도보 약 …" label (rendered when
            // routeInfo.error is truthy).
            setRouteInfo((prev) => ({
                distance: prev?.distance ?? null,
                duration: prev?.duration ?? null,
                loading: false,
                error: true,
                provider: "in_app_direct",
            }));
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

    useEffect(() => {
        const mapEl = mapRef.current;
        if (!mapEl) return;
        const markManual = () => setCentered(false);
        mapEl.addEventListener("pointerdown", markManual, { passive: true });
        mapEl.addEventListener("touchstart", markManual, { passive: true });
        mapEl.addEventListener("wheel", markManual, { passive: true });
        return () => {
            mapEl.removeEventListener("pointerdown", markManual);
            mapEl.removeEventListener("touchstart", markManual);
            mapEl.removeEventListener("wheel", markManual);
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
                    <div style="background:${ev.color};color:white;padding:8px 14px;border-radius:16px;font-size:14px;font-weight:900;box-shadow:0 4px 16px rgba(0,0,0,0.25);font-family:'Pretendard Variable','Pretendard',system-ui,sans-serif;border:2px solid white">🏁 ${escHtml(ev.title)}</div>
                    <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid ${ev.color}"></div>
                </div>`
            });
        }

        // 위치가 아직 없거나 이미 초기화 완료면 경로 계산 건너뜀
        if (!currentPos || routeInitDoneRef.current) return;
        routeInitDoneRef.current = true;

        const startPos = currentPos;
        const myLL = new window.kakao.maps.LatLng(startPos.lat, startPos.lng);

        // ── 내 위치 마커 (이동 가능) — 기존 아이 이모티콘 + 선택 테마색 ──
        const myOverlay = new window.kakao.maps.CustomOverlay({
            map: mapInst.current, position: myLL, yAnchor: 0.85, zIndex: 10,
            content: `<div style="display:flex;flex-direction:column;align-items:center;font-family:'Pretendard Variable','Pretendard',system-ui,sans-serif">
                <div style="width:56px;height:56px;border-radius:20px;background:#fff;border:3px solid ${currentMarkerColor};box-shadow:0 0 0 8px color-mix(in srgb, ${currentMarkerColor} 18%, transparent),0 7px 18px rgba(15,23,42,0.22);display:flex;align-items:center;justify-content:center;font-size:28px;line-height:1">${escHtml(currentMarkerEmoji)}</div>
                <div style="margin-top:5px;background:${currentMarkerColor};color:white;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:900;box-shadow:0 4px 12px rgba(15,23,42,0.18);white-space:nowrap">${escHtml(currentMarkerLabel)}</div>
            </div>`
        });
        myMarkerRef.current = myOverlay;

        // ── "출발" 라벨 오버레이 (내 위치 위에) ──
        const startOv = new window.kakao.maps.CustomOverlay({
            map: mapInst.current, position: myLL, yAnchor: 2.6, zIndex: 9,
            content: `<div style="background:linear-gradient(135deg,var(--status-positive),#059669);color:white;padding:6px 14px;border-radius:12px;font-size:13px;font-weight:900;box-shadow:0 3px 12px rgba(16,185,129,0.4);font-family:'Pretendard Variable','Pretendard',system-ui,sans-serif;border:2px solid white">🚶 출발</div>`
        });
        startOverlayRef.current = startOv;

         
        lastRoutePosRef.current = { ...startPos };
        requestWalkingRoute(startPos, ev.location, { fit: true });
    }, [mapReady, ev, currentPos, currentMarkerColor, currentMarkerEmoji, currentMarkerLabel, requestWalkingRoute]);

    const recenterMap = () => {
        if (!mapInst.current || !currentPos) return;
        setCentered(true);
        const latlng = new window.kakao.maps.LatLng(currentPos.lat, currentPos.lng);
        markProgrammaticViewportChange();
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
                <button onClick={onClose} style={{ background: "var(--bg-muted)", border: "none", borderRadius: 12, width: 40, height: 40, cursor: "pointer", fontWeight: 800, fontSize: 18, fontFamily: FF, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-secondary)", flexShrink: 0 }}>←</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--fg-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.emoji} {ev.title}</div>
                    <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 1 }}>
                        ⏰ {ev.time} {ev.location?.address ? `· 📍 ${ev.location.address.split(" ").slice(0, 3).join(" ")}` : ""}
                    </div>
                </div>
                {isTracking && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--theme-accent-text)", background: "var(--theme-accent-soft)", padding: "4px 8px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--theme-accent)", animation: "pulse 1.5s infinite" }} />
                        GPS
                    </div>
                )}
            </div>

            {/* Route info bar */}
            {!routeInfo?.loading && distLabel && (
                <div style={{
                    margin: "0 16px", marginTop: 10, background: arrived ? "var(--status-positive-subtle)" : "white",
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
                                <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>{isChildMode ? "목적지에 잘 도착했어! 💕" : "목적지 근처에 있어요"}</div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontWeight: 900, fontSize: 20, color: ev.color }}>{distLabel}</div>
                                <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>
                                    {routeInfo?.error ? `예상 직선거리 · 도보 약 ${timeLabel}` : `도보 약 ${timeLabel}`}
                                </div>
                                {bunnyEncouragement && (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--theme-accent-text)", marginTop: 4 }}>
                                        {bunnyEncouragement.emoji} {bunnyEncouragement.msg}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {!arrived && displayMin != null && !routeInfo?.error && (
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: "var(--fg-tertiary)", fontWeight: 600 }}>도착 예정</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--fg-primary)", marginTop: 2 }}>
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-secondary)" }}>🔍 경로 검색 중...</div>
                </div>
            )}

            {/* Map */}
            <div style={{ flex: 1, margin: "10px 16px", borderRadius: 24, overflow: "hidden", boxShadow: "var(--hyeni-theme-shadow-soft)", position: "relative", minHeight: 0, border: "2px solid var(--theme-accent-line)" }}>
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
                {mapReady && <MapZoomControls mapObj={mapInst} onManualZoom={() => setCentered(false)} />}

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
                                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--status-cautionary-strong)", fontFamily: FF }}>
                                    위치를 찾을 수 없어요
                                </div>
                                <div style={{ fontSize: 12, color: "var(--fg-secondary)", fontFamily: FF, textAlign: "center", lineHeight: 1.5 }}>
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
                                <div style={{ fontSize: 12, color: "var(--fg-tertiary)", fontFamily: FF }}>
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
                            <div style={{ position: "absolute", top: 3, fontSize: 8, fontWeight: 800, color: "var(--status-negative)", fontFamily: FF }}>N</div>
                            <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: `rotate(${heading}deg)`, transition: "transform 0.3s ease-out" }}>
                                <polygon points="16,4 12,20 16,17 20,20" fill="var(--theme-accent)" stroke="var(--theme-accent-text)" strokeWidth="1" />
                                <polygon points="16,28 12,20 16,17 20,20" fill="#D1D5DB" stroke="#9CA3AF" strokeWidth="0.5" />
                            </svg>
                        </div>
                        <div style={{ fontSize: 8, fontWeight: 700, color: "var(--fg-secondary)", marginTop: 2, fontFamily: FF }}>
                            {Math.round(heading)}°
                        </div>
                    </div>
                )}

                {/* Map overlay buttons */}
                {mapReady && <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", gap: 8, zIndex: 5 }}>
                    <button onClick={toggleMapType} title="지도 타입"
                        style={{ width: 44, height: 44, borderRadius: 14, background: "white", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "var(--fg-secondary)", fontFamily: FF }}>
                        {mapType === "hybrid" ? "🛣️" : "🛰️"}
                    </button>
                    <button onClick={recenterMap} title="내 위치"
                        style={{
                            minWidth: 56, height: 56, borderRadius: 16, padding: "0 16px",
                            background: centered ? "var(--hyeni-theme-gradient)" : "white",
                            border: centered ? "none" : "2px solid var(--theme-accent-line)",
                            cursor: "pointer", boxShadow: centered ? "var(--hyeni-theme-shadow-soft)" : "0 2px 8px rgba(0,0,0,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                            fontSize: 14, fontWeight: 800, color: centered ? "white" : "var(--theme-accent-text)", fontFamily: FF,
                            transition: "all 0.2s ease"
                        }}>
                        🐰 내 위치
                    </button>
                    <button onClick={fitFullRoute} title="전체 경로"
                        style={{ width: 44, height: 44, borderRadius: 14, background: "white", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--fg-secondary)" }}>
                        🗺️
                    </button>
                </div>}
            </div>

            {/* Bottom route sheet */}
            <div style={{ padding: "0 16px max(28px, calc(28px + env(safe-area-inset-bottom)))", flexShrink: 0 }}>
                <div style={sheetCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--fg-tertiary)", letterSpacing: 0.2 }}>{isChildMode ? "🐰 길찾기" : "ROUTE"}</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--fg-primary)", marginTop: 2 }}>
                                {arrived
                                    ? (isChildMode ? "도착! 잘했어! 💕" : "도착 완료")
                                    : (guidanceStarted ? "길안내를 시작했어요" : "안전하게 가자")}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <div style={{ padding: "7px 10px", borderRadius: 999, background: arrived ? "var(--status-positive-subtle)" : ev.bg, color: arrived ? "#166534" : ev.color, fontSize: 11, fontWeight: 800 }}>
                                {arrived ? "근처 도착" : distLabel || "경로 확인"}
                            </div>
                            {displayMin != null && !routeInfo?.error && (
                                <div style={{ padding: "7px 10px", borderRadius: 999, background: "var(--theme-accent-soft)", color: "var(--theme-accent-text)", fontSize: 11, fontWeight: 800 }}>
                                    도보 {timeLabel}
                                </div>
                            )}
                            {routeInfo?.error && (
                                <div style={{ padding: "7px 10px", borderRadius: 999, background: "var(--bg-subtle)", color: "var(--theme-accent-text)", fontSize: 11, fontWeight: 800 }}>
                                    위치 확인
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            onClick={guidanceStarted ? fitFullRoute : startInAppGuidance}
                            disabled={!currentPos || !ev.location}
                            style={{ flex: 1, padding: "15px 14px", borderRadius: 18, border: "none", cursor: currentPos && ev.location ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 800, fontFamily: FF, color: "white", background: currentPos && ev.location ? "var(--hyeni-theme-gradient)" : "#D1D5DB", boxShadow: currentPos && ev.location ? "var(--hyeni-theme-shadow-soft)" : "none" }}
                        >
                            {guidanceStarted ? "전체 경로 보기" : "길안내 시작"}
                        </button>
                        <button
                            onClick={onClose}
                            style={{ padding: "15px 16px", borderRadius: 18, border: "1px solid #E5E7EB", cursor: "pointer", fontSize: 14, fontWeight: 800, fontFamily: FF, color: "var(--fg-secondary)", background: "#FFFFFF" }}
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

/* Memo timestamp — relative within 1h, absolute time after that */
// Memo time/group helpers moved to ./lib/memoTime.js
// Memo replies cache moved to ./lib/memoCache.js
// — both imported at top.

// MemoSection moved to ./components/memo/MemoSection.jsx — imported at top.


function ParentMemoPage({ replies, onReplySubmit, myUserId, onClose, partnerName, onReplyRef, mode = "parent", quickReplies, emptyCopy, stickerCopy }) {
    const [inputText, setInputText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState("");
    const [lastFailedText, setLastFailedText] = useState("");
    const [showOnboardingToast, setShowOnboardingToast] = useState(false);
    const threadRef = useRef(null);
    const onboardingTimerRef = useRef(null);
    const today = new Date();
    const dateLabel = `오늘 · ${DAYS_KO[today.getDay()]}요일`;
    const title = "오늘의 메모";
    const subtitle = mode === "child"
        ? "부모님과 도란도란 이야기중"
        : (partnerName ? `${partnerName}와 실시간 공유중` : "가족 연동 후 공유돼요");
    const messages = Array.isArray(replies) ? replies : [];
    const quickItems = Array.isArray(quickReplies) && quickReplies.length > 0
        ? quickReplies
        : getParentMemoQuickReplies();
    const emptyTitle = emptyCopy?.title || "아이에게 첫 메시지를 남겨보세요";
    const emptyDescription = emptyCopy?.description || "아이와 공유할 준비물, 칭찬, 확인할 일을 남겨보세요.";
    const stickerTitle = stickerCopy?.title || "스티커 칭찬을 남겨보세요!";
    const stickerDescription = stickerCopy?.description || "짧은 응원도 아이에게 바로 보여요.";
    const messageItems = buildMessageItems(messages);

    const handleSend = (textOverride) => {
        const text = typeof textOverride === "string" ? textOverride.trim() : inputText.trim();
        if (!text || isSending) return;
        setIsSending(true);
        setSendError("");
        const result = onReplySubmit ? onReplySubmit(text) : null;
        Promise.resolve(result)
            .then(() => {
                setInputText("");
                setLastFailedText("");
            })
            .catch(err => {
                console.error("[ParentMemoPage] send failed", err);
                setLastFailedText(text);
                setSendError("메시지 전송에 실패했어요. 다시 시도해 주세요.");
            })
            .finally(() => setIsSending(false));
    };

    const handleRetry = () => {
        if (!lastFailedText) return;
        handleSend(lastFailedText);
    };

    const setPreset = (text) => {
        setInputText(text);
        setSendError("");
    };

    // Keep newest message in view when the thread becomes scrollable
    useEffect(() => {
        const el = threadRef.current;
        if (!el) return;
        // Defer one frame so the just-rendered bubble is laid out first
        const id = window.requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
        return () => window.cancelAnimationFrame(id);
    }, [messages.length]);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        if (!window.localStorage.getItem("memoOnboardingV2Seen")) {
            setShowOnboardingToast(true);
            window.localStorage.setItem("memoOnboardingV2Seen", "1");
            onboardingTimerRef.current = window.setTimeout(() => setShowOnboardingToast(false), 6000);
        }
        return () => {
            if (onboardingTimerRef.current) window.clearTimeout(onboardingTimerRef.current);
        };
    }, []);

    return (
        <main className="hyeni-memo-page" aria-label="오늘의 메모 페이지">
            <div className="hyeni-memo-phone">
                <header className="hyeni-memo-header">
                    <button type="button" className="hyeni-memo-back" onClick={onClose} aria-label="메모 닫기">×</button>
                    <div className="hyeni-memo-title-block">
                        <h1>{title}</h1>
                        <p><span aria-hidden="true" />{subtitle}</p>
                    </div>
                </header>

                <section className="hyeni-memo-thread" aria-label="오늘의 메모 대화" ref={threadRef}>
                    {messages.length === 0 && <div className="hyeni-memo-date-row" role="separator" aria-label={dateLabel}>
                        <span />
                        <strong>{dateLabel}</strong>
                        <span />
                    </div>}

                    {messages.length === 0 ? (
                        <div className="hyeni-memo-empty">
                            <div>💗</div>
                            <strong>{emptyTitle}</strong>
                            <p>{emptyDescription}</p>
                        </div>
                    ) : (
                        messageItems.map((item) => {
                            if (item.type === "separator") {
                                return (
                                    <div className="hyeni-memo-date-row" role="separator" aria-label={item.label} key={item.key}>
                                        <span />
                                        <strong>{item.label}</strong>
                                        <span />
                                    </div>
                                );
                            }
                            const message = item.r;
                            const isMine = message.user_id === myUserId;
                            const sender = message.user_role === "parent"
                                ? (mode === "child" ? (partnerName || "부모님") : "엄마")
                                : (mode === "child" ? "아이" : (partnerName || "아이"));
                            const theirAvatar = mode === "child" && message.user_role === "parent" ? "💗" : "👧";
                            const myAvatar = mode === "child" ? "🌈" : "🐰";
                            const time = getMemoTime(message.created_at);
                            const replyRefAttach = el => { if (el && onReplyRef && message.id && !String(message.id).startsWith("temp-")) onReplyRef(el, message.id); };

                            // Phase 3 §4.4 — 자녀 메모 페이지는 iMessage 풍 좌/우 bubble 사용.
                            if (mode === "child") {
                                const from = message.user_role === "parent" ? "parent" : "child";
                                const stamp = isMine ? `${time} · 읽음 ✓` : `${sender} · ${time}`;
                                return (
                                    <div
                                        key={message.id}
                                        ref={replyRefAttach}
                                        aria-label={`${sender} ${time} 메모: ${message.content}`}
                                    >
                                        <MemoBubble from={from} stamp={stamp}>{message.content}</MemoBubble>
                                    </div>
                                );
                            }

                            return (
                                <article
                                    key={message.id}
                                    className={`hyeni-memo-message ${isMine ? "mine" : "theirs"}`}
                                    ref={replyRefAttach}
                                    aria-label={`${sender} ${time} 메모: ${message.content}`}
                                >
                                    {!isMine && <div className="hyeni-memo-avatar" aria-hidden="true">{theirAvatar}</div>}
                                    <div className="hyeni-memo-message-body">
                                        <div className="hyeni-memo-sender">
                                            <strong>{isMine ? "나" : sender}</strong>
                                            <span>{time}</span>
                                        </div>
                                        <div className="hyeni-memo-bubble">{message.content}</div>
                                        {isMine && <div className="hyeni-memo-read">읽음 ✓</div>}
                                    </div>
                                    {isMine && <div className="hyeni-memo-avatar small" aria-hidden="true">{myAvatar}</div>}
                                </article>
                            );
                        })
                    )}

                    <div className="hyeni-memo-sticker-card">
                        <span aria-hidden="true">⭐</span>
                        <div>
                            <strong>{stickerTitle}</strong>
                            <p>{stickerDescription}</p>
                        </div>
                    </div>

                    <div className="hyeni-memo-quick-row" aria-label="빠른 메모">
                        {quickItems.map(item => (
                            <button key={item.text} type="button" onClick={() => setPreset(item.text)}>
                                {item.icon} {item.label}
                            </button>
                        ))}
                    </div>
                </section>

                <footer className="hyeni-memo-composer">
                    {sendError && (
                        <div className="hyeni-memo-error" role="alert">
                            {sendError}
                            <button type="button" onClick={handleRetry} disabled={isSending}>
                                다시 시도
                            </button>
                        </div>
                    )}
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
            {showOnboardingToast && (
                <div
                    role="status"
                    aria-live="polite"
                    aria-label="메모 화면이 새로워졌어요"
                    className="hyeni-memo-onboarding-toast"
                >
                    메모 화면이 새로워졌어요 ✨
                    <button
                        type="button"
                        aria-label="메모 안내 숨김"
                        onClick={() => {
                            setShowOnboardingToast(false);
                            if (onboardingTimerRef.current) window.clearTimeout(onboardingTimerRef.current);
                        }}
                    >
                        ×
                    </button>
                </div>
            )}
        </main>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day Timetable (kid-friendly)
// ─────────────────────────────────────────────────────────────────────────────
function DayTimetable({ events, dateLabel, isToday = false, isFuture = false, childPos, mapReady: _mapReady, arrivedSet, firedEmergencies, onRoute, onDelete, onEditLoc, stickers, memoReplies, onReplySubmit, memoReadBy, myUserId, isParentMode, onReplyRef, showInlineMemo = true }) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    if (events.length === 0) return (
        <div style={{ fontFamily: FF }}>
            <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>{isParentMode ? "🌙" : "🎉"}</div>
                <div style={{ fontSize: isParentMode ? 16 : 18, fontWeight: 800, color: isParentMode ? "var(--fg-tertiary)" : "var(--theme-accent-text)" }}>{isParentMode ? "아직 일정이 없어요" : "오늘은 자유시간이야!"}</div>
                <div style={{ fontSize: isParentMode ? 13 : 14, color: "var(--fg-tertiary)", marginTop: 4 }}>{isParentMode ? "위에서 추가해 보세요!" : "신나게 놀자~ 🐰"}</div>
            </div>
            {showInlineMemo && <MemoSection replies={memoReplies} onReplySubmit={onReplySubmit} readBy={memoReadBy} myUserId={myUserId} isParentMode={isParentMode} onReplyRef={onReplyRef} />}
        </div>
    );

    return (
        <div style={{ fontFamily: FF }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "var(--fg-primary)" }}>{dateLabel}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 2 }}>{events.length}개 일정</div>
                </div>
                {childPos
                    ? <div style={{ fontSize: 11, fontWeight: 700, color: "var(--theme-accent-text)", background: "var(--theme-accent-soft)", padding: "5px 12px", borderRadius: 12 }}>💕 엄마가 항상 함께하고 있어요</div>
                    : <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-tertiary)", background: "var(--bg-muted)", padding: "5px 12px", borderRadius: 12 }}>위치 없음</div>}
            </div>

            {/* Timeline */}
            <div style={{ position: "relative", paddingLeft: 28 }}>
                {/* Vertical line */}
                <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 3, background: "linear-gradient(to bottom, var(--theme-accent), var(--theme-accent-soft), var(--fg-tertiary))", borderRadius: 4 }} />

                {events.map((ev, i) => {
                    if (typeof ev.time !== "string") return null;
                    const [h, m] = ev.time.split(":").map(Number);
                    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
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
                                    border: isCurrent ? `2px solid ${ev.color}` : "2px solid var(--bg-muted)",
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
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--theme-accent-text)", background: "var(--theme-accent-soft)", padding: "2px 8px", borderRadius: 8 }}>예정</span>
                                    )}
                                    {arrived && <span style={{ fontSize: isParentMode ? 11 : 13, fontWeight: 700, color: "#059669" }}>✅ 도착</span>}
                                    {emergency && isParentMode && <span style={{ fontSize: 11, fontWeight: 800, color: "var(--status-negative-strong)", animation: "pulse 1s infinite" }}>🚨 미도착</span>}
                                </div>

                                {/* Content */}
                                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                    <div style={{ width: isParentMode ? 44 : 50, height: isParentMode ? 44 : 50, borderRadius: isParentMode ? 14 : 16, background: ev.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isParentMode ? 24 : 28, flexShrink: 0 }}>{ev.emoji}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: isParentMode ? 16 : 18, fontWeight: 800, color: "var(--fg-primary)" }}>{ev.title}</div>
                                        {ev.location && (
                                            <div style={{ fontSize: isParentMode ? 12 : 13, color: "var(--fg-secondary)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                                <span>📍</span>
                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.location.address}</span>
                                            </div>
                                        )}
                                        {ev.memo && <div style={{ fontSize: isParentMode ? 11 : 12, color: "var(--fg-tertiary)", marginTop: 2 }}>📝 {ev.memo}</div>}
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
                                            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 10, background: "var(--theme-accent-soft)", border: "1.5px dashed var(--theme-accent-line)", color: "var(--theme-accent-text)", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>
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
                <div style={{ marginTop: 16, background: "linear-gradient(135deg, var(--status-cautionary-subtle), #FDE68A22)", borderRadius: 20, padding: 14, border: "2px solid #FCD34D" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--status-cautionary)", marginBottom: 8 }}>🏆 오늘 받은 칭찬스티커</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {stickers.map((s, i) => (
                            <div key={s.id || i} style={{
                                background: "white", borderRadius: 12, padding: "6px 10px",
                                display: "flex", alignItems: "center", gap: 4,
                                border: "1.5px solid #FCD34D", boxShadow: "0 2px 4px rgba(252,211,77,0.2)",
                            }}>
                                <span style={{ fontSize: 16 }}>{s.emoji}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-primary)" }}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Memo */}
            {showInlineMemo && (
                <MemoSection
                    replies={memoReplies}
                    onReplySubmit={onReplySubmit}
                    readBy={memoReadBy}
                    myUserId={myUserId}
                    isParentMode={isParentMode}
                    onReplyRef={onReplyRef}
                />
            )}
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
                                <div style={{ fontSize: 17, fontWeight: 900, color: "var(--fg-primary)" }}>칭찬 스티커북</div>
                                <div style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>{dateLabel}</div>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: "var(--bg-muted)", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF, fontSize: 13 }}>닫기</button>
                    </div>

                    {/* 요약 카운트 — 한 줄 컴팩트 */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                        {[
                            { emoji: "🌟", count: earlyCount, label: "일찍", bg: "var(--status-cautionary-subtle)", color: "var(--status-cautionary)" },
                            { emoji: "⭐", count: onTimeCount, label: "정시", bg: DESIGN.colors.parentPale, color: DESIGN.colors.parentDeep },
                            { emoji: "😢", count: lateCount, label: "아쉬워", bg: "var(--bg-muted)", color: "var(--fg-tertiary)" },
                            { emoji: "💕", count: stickers.filter(s => s.sticker_type === "praise").length, label: "칭찬", bg: "var(--theme-accent-soft)", color: "var(--theme-accent-text)" },
                        ].map((item, i) => (
                            <div key={i} style={{ flex: 1, background: item.bg, borderRadius: 12, padding: "8px 4px", textAlign: "center" }}>
                                <div style={{ fontSize: 16 }}>{item.emoji} <span style={{ fontWeight: 900, color: item.color }}>{item.count}</span></div>
                                <div style={{ fontSize: 11, color: item.color, fontWeight: 700, marginTop: 2 }}>{item.label}</div>
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
                                    background: s.sticker_type === "early" ? "var(--status-cautionary-subtle)" : s.sticker_type === "late" ? "var(--bg-muted)" : s.sticker_type === "praise" ? "var(--theme-accent-soft)" : DESIGN.colors.parentPale,
                                    borderRadius: 14, padding: "8px 6px", textAlign: "center",
                                    border: `1.5px solid ${s.sticker_type === "early" ? "#FCD34D" : s.sticker_type === "late" ? "#D1D5DB" : s.sticker_type === "praise" ? "var(--theme-accent-line)" : "#C4B5FD"}`,
                                    opacity: s.sticker_type === "late" ? 0.6 : 1,
                                }}>
                                    <div style={{ fontSize: 22 }}>{s.emoji}</div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-primary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 하단 고정: 칭찬 주기 + 닫기 */}
                <div style={{ padding: "12px 20px 20px", flexShrink: 0 }}>
                    {isParentMode && onGiveSticker && !showGive && (
                        <button onClick={() => setShowGive(true)}
                            style={{ width: "100%", padding: "13px", marginBottom: 8, borderRadius: 16, border: "2px dashed #FCD34D", background: "linear-gradient(135deg, var(--status-cautionary-subtle), var(--status-cautionary-subtle))", cursor: "pointer", fontSize: 14, fontWeight: 900, color: "var(--status-cautionary)", fontFamily: FF }}>
                            🌟 칭찬스티커 주기
                        </button>
                    )}
                    {isParentMode && onGiveSticker && showGive && (
                        <div style={{ background: "var(--status-cautionary-subtle)", borderRadius: 16, padding: 12, border: "2px solid #FCD34D", marginBottom: 8 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                                {PRAISE.map((ps, i) => (
                                    <button key={i} onClick={async () => {
                                        await onGiveSticker(ps.emoji, giveMsg.trim() || ps.title);
                                        setShowGive(false); setGiveMsg("");
                                    }}
                                        style={{ background: "white", border: "1.5px solid #FCD34D", borderRadius: 12, padding: "8px 2px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontFamily: FF }}>
                                        <span style={{ fontSize: 20 }}>{ps.emoji}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--status-cautionary-strong)" }}>{ps.title}</span>
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
function AmbientAudioRecorder({ channel, familyId: recFamilyId, senderUserId, onClose, pairedChildren = [], targetChildUserId = null, childDeviceStatusMap = {} }) {
    const [status, setStatus] = useState("idle"); // idle, pushing, auto_waking_child, waiting_for_child_notification, listening, failed
    const [duration, setDuration] = useState(0);
    const [errorMessage, setErrorMessage] = useState("");
    const [, setAudioChunks] = useState([]);
    const timerRef = useRef(null);
    const playbackRef = useRef(Promise.resolve());
    const audioContextRef = useRef(null);
    const nextPlayAtRef = useRef(0);
    const remoteAudioCurrentRequestIdRef = useRef(null);
    const remoteAudioCurrentTargetUserIdRef = useRef(null);
    const remoteAudioSeenChunksRef = useRef(new Set());
    const startInFlightRef = useRef(false);
    const playbackGenerationRef = useRef(0);
    const activeSourcesRef = useRef(new Set());
    const activeAudioElementsRef = useRef(new Set());
    const remoteAudioWaitingHintTimerRef = useRef(null);
    const remoteListenDiagnostics = useMemo(() => {
        const children = (Array.isArray(pairedChildren) ? pairedChildren : [])
            .filter((c) => c?.role === "child" && c?.user_id);
        const targets = targetChildUserId
            ? children.filter((c) => c.user_id === targetChildUserId)
            : children;
        return targets.flatMap((child) => {
            const summary = summarizeRemoteListenHealth(resolveChildRemoteListenHealth(child, childDeviceStatusMap));
            if (summary.ready && summary.advisory.length === 0) return [];
            if (!summary.hasReport) {
                return [{
                    childName: child.name || "아이",
                    severity: "advisory",
                    label: "아이 기기 상태 미보고",
                    detail: "자녀 앱이 아직 권한/기기 상태를 보고하지 않았지만 연결은 시도할 수 있어요.",
                }];
            }
            return [...summary.blockers, ...summary.advisory].map((item) => ({
                childName: child.name || "아이",
                severity: item.severity || "advisory",
                label: item.label,
                detail: item.detail,
            }));
        });
    }, [pairedChildren, targetChildUserId, childDeviceStatusMap]);

    const clearRemoteAudioWaitingHint = useCallback(() => {
        if (remoteAudioWaitingHintTimerRef.current) {
            clearTimeout(remoteAudioWaitingHintTimerRef.current);
            remoteAudioWaitingHintTimerRef.current = null;
        }
    }, []);

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
        if (startInFlightRef.current || (status !== "idle" && status !== "failed")) return;
        setErrorMessage("");
        if (!recFamilyId || !senderUserId) {
            setErrorMessage("가족 연결 정보가 없어 주변음성듣기를 시작할 수 없어요.");
            setStatus("failed");
            return;
        }
        // Pre-flight on the published device_health snapshot so we can warn
        // before sending an FCM that the child can't act on. We do NOT block —
        // the child's snapshot may be stale, and force-stopping a parent who
        // accepts the risk is worse UX. Show the missing items, then continue.
        const preflightChildren = (Array.isArray(pairedChildren) ? pairedChildren : [])
            .filter((c) => c?.role === "child" && c?.user_id);
        const targetCandidates = targetChildUserId
            ? preflightChildren.filter((c) => c.user_id === targetChildUserId)
            : preflightChildren;
        if (targetCandidates.length > 0) {
            const blockedNames = [];
            for (const c of targetCandidates) {
                const summary = summarizeRemoteListenHealth(resolveChildRemoteListenHealth(c, childDeviceStatusMap));
                if (summary.blockers.length > 0) {
                    const detail = summary.blockers.map((s) => s.label).join(", ");
                    blockedNames.push(`${c.name || "아이"} (${detail})`);
                }
            }
            if (blockedNames.length > 0) {
                setErrorMessage(
                    "아이 기기 설정 확인 필요: " + blockedNames.join(" / ") +
                    ". 권한이나 네트워크가 복구되면 다시 연결을 시도할 수 있어요."
                );
            }
        }
        startInFlightRef.current = true;
        stopActivePlayback();
        const durationSec = REMOTE_AUDIO_DEFAULT_DURATION_SEC;
        const requestId = generateUUID();
        const targetPayload = buildSelectedChildCommandPayload({ selectedChild: { user_id: targetChildUserId } });
        remoteAudioCurrentRequestIdRef.current = requestId;
        remoteAudioCurrentTargetUserIdRef.current = targetPayload.targetUserId || null;
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
        setStatus("pushing");
        setDuration(0);
        setAudioChunks([]);
        clearRemoteAudioWaitingHint();
        remoteAudioWaitingHintTimerRef.current = setTimeout(() => {
            setStatus(prev => (prev === "listening" || prev === "idle" ? prev : "waiting_for_child_notification"));
            setErrorMessage(prev => prev || "연결까지 시간이 오래 걸리고 있어요. 아이 기기 화면을 깨우거나 알림을 확인해 주세요.");
        }, REMOTE_AUDIO_WAITING_HELP_MS);
        // 1. Broadcast for when child app is already open
        const startPayload = {
            duration: durationSec,
            durationSec,
            initiatorUserId: senderUserId,
            initiator_user_id: senderUserId,
            requestId,
            targetRole: "child",
            ...targetPayload,
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
                ...targetPayload,
                idempotencyKey: requestId,
            });
            setStatus("auto_waking_child");
            const realtimeSent = await sendBroadcastWhenReady(
                channel,
                "remote_listen_start",
                startPayload,
                { timeoutMs: 4000, pollMs: 80 }
            );
            if (!realtimeSent) {
                // Channel wasn't joined yet on parent side. Stay in "auto_waking_child"
                // so the user sees "연결 시도 중" instead of the alarming "OS blocked"
                // copy — the child app may still wake up via the FCM push and the
                // first audio chunk will flip status to "listening" naturally.
            }
        } catch (error) {
            console.warn("[Audio] remote_listen_start broadcast failed:", error?.message || error);
            // Same rationale as above — keep optimistic state.
        } finally {
            await pushPromise.catch((error) => {
                console.warn("[Audio] remote listen push failed:", error?.message || error);
                setStatus(prev => (prev === "listening" ? prev : "failed"));
                setErrorMessage("연결 요청 전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
            });
            startInFlightRef.current = false;
        }
        timerRef.current = setTimeout(() => stopListening(), (durationSec + 5) * 1000);
    };

    const stopListening = () => {
        startInFlightRef.current = false;
        clearRemoteAudioWaitingHint();
        const requestId = remoteAudioCurrentRequestIdRef.current;
        const stopTargetPayload = buildSelectedChildCommandPayload({
            selectedChild: { user_id: remoteAudioCurrentTargetUserIdRef.current || targetChildUserId || null },
        });
        const targetUserId = remoteAudioCurrentTargetUserIdRef.current || targetChildUserId || null;
        if (channel) channel.send({ type: "broadcast", event: "remote_listen_stop", payload: { requestId, ...stopTargetPayload } });
        if (recFamilyId && senderUserId && requestId) {
            void sendInstantPush({
                action: "remote_listen_stop",
                familyId: recFamilyId,
                senderUserId,
                title: "",
                message: "",
                requestId,
                targetRole: "child",
                targetUserId,
                idempotencyKey: `${requestId}:stop`,
            });
        }
        setErrorMessage("");
        setStatus("idle");
        stopActivePlayback();
        remoteAudioCurrentRequestIdRef.current = null;
        remoteAudioCurrentTargetUserIdRef.current = null;
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
            clearRemoteAudioWaitingHint();
            setErrorMessage("");
            setStatus("listening");
            const chunkMs = Number(detail?.durationMs) || REMOTE_AUDIO_CHUNK_MS;
            setDuration(d => d + Math.max(1, Math.round(chunkMs / 1000)));
            setAudioChunks(prev => [...prev, detail]);
            playChunk(detail.data, detail.mimeType);
        };
        window.addEventListener("remote-audio-chunk", handleChunk);
        return () => window.removeEventListener("remote-audio-chunk", handleChunk);
    }, [status, playChunk, clearRemoteAudioWaitingHint]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            clearRemoteAudioWaitingHint();
            stopActivePlayback();
            if (audioContextRef.current) {
                try { audioContextRef.current.close(); } catch { /* ignore */ }
                audioContextRef.current = null;
            }
        };
    }, [stopActivePlayback, clearRemoteAudioWaitingHint]);

    const isConnecting = status === "pushing" || status === "auto_waking_child" || status === "waiting_for_child_notification";
    const canStartListening = status === "idle" || status === "failed";
    const showRemoteListenDiagnostics = status !== "listening" && remoteListenDiagnostics.length > 0;
    const statusCopy = {
        idle: { icon: "🎤", title: "주변 소리 듣기", description: "프리미엄 회원은 아이 기기의 마이크를 1분간 원격으로 켜서 주변 소리를 들을 수 있어요", hint: "" },
        pushing: { icon: "📡", title: "연결 요청 전송 중", description: "아이 기기에 FCM 요청을 보내고 있어요", hint: "잠시만 기다려 주세요." },
        auto_waking_child: { icon: "📲", title: "아이 기기 자동 연결 시도 중", description: "전체화면 연결 화면을 자동으로 띄우고 있어요", hint: "기기 상태에 따라 몇 초 걸릴 수 있어요." },
        waiting_for_child_notification: { icon: "🔔", title: "아이 기기 응답 대기 중", description: "아이 기기에 알림이 도착했어요. 화면을 깨우면 즉시 연결됩니다", hint: "1분 이상 응답이 없으면 잠금화면 알림이나 배터리 제한 설정을 확인해 주세요." },
        listening: { icon: "🔊", title: "아이 주변 소리 듣는 중...", description: `${duration}초 수신 중`, hint: "" },
        failed: { icon: "⚠️", title: "연결 요청 실패", description: "네트워크 또는 권한 상태를 확인한 뒤 다시 시도해 주세요", hint: "" },
    }[status] || { icon: "🎤", title: "주변 소리 듣기", description: "", hint: "" };

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget && status === "idle") onClose(); }}>
            <div style={makeCardStyle({ padding: "24px 20px", width: "90%", maxWidth: 360, textAlign: "center" })}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{statusCopy.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--fg-primary)", marginBottom: 8 }}>
                    {statusCopy.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginBottom: 16 }}>
                    {statusCopy.description}
                </div>
                {status === "listening" && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 3 }}>
                            {REMOTE_AUDIO_LEVEL_BARS.map((height, i) => <div key={i} style={{ width: 4, height, background: "var(--status-cautionary-strong)", borderRadius: 2, animation: "pulse 0.5s infinite", animationDelay: `${i * 0.1}s` }} />)}
                        </div>
                    </div>
                )}
                {isConnecting && statusCopy.hint && (
                    <div style={{ marginBottom: 16, fontSize: 12, color: "var(--status-cautionary)", fontWeight: 700, lineHeight: 1.45 }}>{statusCopy.hint}</div>
                )}
                {errorMessage && (
                    <div role="alert" style={{ marginBottom: 16, fontSize: 12, color: "var(--status-cautionary-strong)", fontWeight: 800, lineHeight: 1.45 }}>
                        {errorMessage}
                    </div>
                )}
                {showRemoteListenDiagnostics && (
                    <div
                        aria-label="아이 기기 원격 듣기 진단"
                        style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 7, textAlign: "left" }}
                    >
                        {remoteListenDiagnostics.map((item, idx) => (
                            <div
                                key={`${item.childName}-${item.label}-${idx}`}
                                style={{
                                    borderRadius: 12,
                                    background: item.severity === "blocker" ? "var(--status-cautionary-subtle)" : "var(--bg-muted)",
                                    border: item.severity === "blocker" ? "1px solid #FCD34D" : "1px solid var(--line-soft)",
                                    padding: "8px 10px",
                                }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 900, color: item.severity === "blocker" ? "var(--status-cautionary-strong)" : "var(--fg-primary)" }}>
                                    {item.childName} · {item.severity === "blocker" ? "설정 필요" : "참고"} · {item.label}
                                </div>
                                <div style={{ marginTop: 2, fontSize: 11, fontWeight: 700, color: item.severity === "blocker" ? "#8A5A00" : "var(--fg-secondary)", lineHeight: 1.35 }}>
                                    {item.detail}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                    {canStartListening && (
                        <button onClick={startListening}
                            style={{ flex: 1, padding: "14px", background: DESIGN.gradients.primary, color: "white", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            {status === "failed" ? "다시 시도" : "🎙️ 듣기 시작"}
                        </button>
                    )}
                    {(status === "listening" || isConnecting) && (
                        <button onClick={stopListening}
                            style={{ flex: 1, padding: "14px", background: "#374151", color: "white", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            ⏹️ 중지
                        </button>
                    )}
                    <button onClick={() => { stopListening(); onClose(); }}
                        style={{ padding: "14px 20px", background: "var(--bg-muted)", color: "var(--fg-secondary)", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                        닫기
                    </button>
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 12 }}>최대 1분 · 프리미엄 전용 · 아이의 안전을 위해 사용해주세요</div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Location Map View (interactive map + card list)
// ─────────────────────────────────────────────────────────────────────────────
// hasPlaceLocation / getPlaceLocationKey / buildSavedPlaceItems / buildSchedulePlaceOptions /
// eventDateValue / buildEventPlaceItems moved to ./lib/placeFormat.js — imported at top.

// LocationMapView moved to ./components/map/LocationMapView.jsx — imported at top.


// ─────────────────────────────────────────────────────────────────────────────
// Child Tracker Overlay (학부모용 - 아이 실시간 위치)
// ─────────────────────────────────────────────────────────────────────────────
// AI Schedule Modal — 음성/이미지/텍스트로 일정 자동 등록
// ─────────────────────────────────────────────────────────────────────────────
function AiScheduleModal({ academies, currentDate, familyId, authUser, events, eventSelection, onSave, onClose, startVoiceFn, onNavigateDate }) {
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
            setResults({ action: "unknown", message: "일정 정리 실패: " + err.message });
        } finally { setLoading(false); }
    };

    const CATS = { school: { emoji: "📚", color: "#A78BFA", bg: "#EDE9FE" }, sports: { emoji: "⚽", color: "#34D399", bg: "var(--status-positive-subtle)" }, hobby: { emoji: "🎨", color: "var(--status-cautionary)", bg: "var(--status-cautionary-subtle)" }, family: { emoji: "👨‍👩‍👧", color: "#F87171", bg: "var(--status-negative-subtle)" }, friend: { emoji: "👫", color: "#60A5FA", bg: "var(--bg-subtle)" }, other: { emoji: "📌", color: "#EC4899", bg: "#FCE7F3" } };

    const saveOne = async (ev, idx) => {
        if (savedIds.has(idx)) return;
        const cat = CATS[ev.category] || CATS.other;
        const matchedAcademy = ev.academyName ? academies.find(a => a.name === ev.academyName) : null;
        const safeTime = (ev.time && ev.time !== "null") ? ev.time : "09:00";
        const safeMemo = (ev.memo && ev.memo !== "null") ? ev.memo : "";
        const normalizedSelection = {
            familyAll: !!eventSelection?.familyAll,
            childIds: Array.isArray(eventSelection?.childIds) ? eventSelection.childIds.filter(Boolean) : [],
        };
        const scopedEventFields = {
            is_family_event: !!normalizedSelection.familyAll,
            child_ids: normalizedSelection.familyAll ? [] : [...normalizedSelection.childIds],
        };
        const newEv = {
            id: generateUUID(), title: ev.title, time: safeTime,
            category: ev.category || "other", emoji: matchedAcademy?.emoji || cat.emoji,
            color: cat.color, bg: cat.bg, memo: safeMemo,
            location: matchedAcademy?.location || null, notifOverride: null,
            ...scopedEventFields,
        };
        const dk = `${ev.year ?? currentDate.year}-${ev.month ?? currentDate.month}-${ev.day ?? currentDate.day}`;
        onSave(newEv, dk);
        if (familyId && authUser) {
            try {
                if (normalizedSelection.familyAll || normalizedSelection.childIds.length > 0) {
                    await saveEventWithChildren({ ...newEv, dateKey: dk, familyId, userId: authUser.id }, normalizedSelection);
                } else {
                    await insertEvent(newEv, familyId, dk, authUser.id);
                }
                const m = (ev.month ?? currentDate.month) + 1;
                const d = ev.day ?? currentDate.day;
                sendInstantPush({
                    action: "new_event", familyId, senderUserId: authUser.id,
                    title: `새 일정: ${newEv.emoji} ${ev.title}`,
                    message: `${m}월 ${d}일 ${newEv.time}에 "${ev.title}" 일정이 추가됐어요`,
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
                    <div style={{ fontSize: 18, fontWeight: 900, color: "var(--fg-primary)" }}>일정 빠른 입력</div>
                    <button onClick={onClose} style={{ background: "var(--bg-muted)", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>닫기</button>
                </div>

                {/* 3가지 입력 방식 버튼 */}
                {!results && !loading && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 }}>
                        <button onClick={startVoiceInput}
                            style={{ ...btnSt, background: voiceListening ? "var(--theme-accent)" : "var(--hyeni-theme-gradient)", color: "white", boxShadow: "var(--hyeni-theme-shadow-soft)", animation: voiceListening ? "pulse 1s infinite" : "none" }}>
                            <span style={{ fontSize: 24 }}>🎤</span>
                            {voiceListening ? "듣는 중..." : "말하기"}
                        </button>
                        <button onClick={() => fileInputRef.current?.click()}
                            style={{ ...btnSt, background: "var(--hyeni-theme-gradient)", color: "white", boxShadow: "var(--hyeni-theme-shadow-soft)" }}>
                            <span style={{ fontSize: 24 }}>📷</span>
                            이미지
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} style={{ display: "none" }} />
                        <button onClick={() => document.getElementById("ai-text-input")?.focus()}
                            style={{ ...btnSt, background: DESIGN.gradients.primary, color: "white", boxShadow: "var(--hyeni-theme-shadow-soft)" }}>
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
                        <button onClick={() => setImageData(null)} aria-label="이미지 제거" style={{ position: "absolute", top: -10, right: -10, width: 32, height: 32, borderRadius: "50%", background: "var(--status-negative)", color: "var(--fg-on-primary)", border: "none", fontSize: 14, cursor: "pointer", fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                )}

                {/* 분석 버튼 */}
                <button onClick={() => analyze()} disabled={loading || (!inputText.trim() && !imageData)}
                    style={{ width: "100%", marginTop: 10, padding: "14px 16px", borderRadius: 16, border: "none", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: FF, color: "white", background: loading ? "#9CA3AF" : "var(--hyeni-theme-gradient)", boxShadow: loading ? "none" : "var(--hyeni-theme-shadow-soft)" }}>
                    {loading ? "🔍 일정을 정리하고 있어요..." : "✅ 다 입력했어요^^"}
                </button>

                {/* Results */}
                {results && results.action === "add_events" && results.events?.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg-primary)" }}>📋 정리된 일정 ({results.events.length}건)</div>
                            <button onClick={saveAll} style={{ padding: "6px 14px", borderRadius: 12, background: "#059669", color: "white", border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>모두 등록</button>
                        </div>
                        {results.events.map((ev, i) => {
                            const cat = CATS[ev.category] || CATS.other;
                            const saved = savedIds.has(i);
                            const m = ev.month != null ? ev.month + 1 : (currentDate.month + 1);
                            const d = ev.day ?? currentDate.day;
                            return (
                                <div key={i} style={{ background: saved ? "var(--status-positive-subtle)" : "var(--theme-accent-soft)", borderRadius: 16, padding: "12px 14px", marginBottom: 8, border: saved ? "2px solid var(--status-positive)" : "1.5px solid var(--theme-accent-line)", opacity: saved ? 0.7 : 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 24 }}>{cat.emoji}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--fg-primary)" }}>{ev.title}</div>
                                            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>
                                                {m}월 {d}일 {(ev.time && ev.time !== "null") ? ev.time : "시간 미정"}
                                                {ev.memo && ev.memo !== "null" && ` · ${ev.memo}`}
                                            </div>
                                        </div>
                                        <button onClick={async () => {
                                            await saveOne(ev, i);
                                            if (onNavigateDate) onNavigateDate(ev.year ?? currentDate.year, ev.month ?? currentDate.month, ev.day ?? currentDate.day);
                                            onClose();
                                        }} disabled={saved}
                                            style={{ padding: "6px 12px", borderRadius: 10, background: saved ? "var(--status-positive-subtle)" : "var(--hyeni-theme-gradient)", color: saved ? "var(--status-positive-strong)" : "white", border: "none", fontSize: 11, fontWeight: 800, cursor: saved ? "default" : "pointer", fontFamily: FF, flexShrink: 0 }}>
                                            {saved ? "✓" : "등록"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {results && results.action === "unknown" && (
                    <div style={{ marginTop: 16, textAlign: "center", padding: 20, background: "var(--status-cautionary-subtle)", borderRadius: 16 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🤔</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--status-cautionary-strong)" }}>{results.message}</div>
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
        { id: "construction", label: "🚧 공사장", color: "var(--status-cautionary)" },
        { id: "entertainment", label: "🎰 유흥가", color: "var(--status-negative)" },
        { id: "water", label: "🌊 수변지역", color: "#3B82F6" },
        { id: "custom", label: "📍 직접 설정", color: "var(--fg-secondary)" },
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
                strokeWeight: 3, strokeColor: "var(--status-negative)", strokeOpacity: 0.8,
                fillColor: "var(--status-negative)", fillOpacity: 0.15
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
                    <div style={{ fontSize: 18, fontWeight: 900, color: "var(--fg-primary)" }}>⚠️ 위험지역 관리</div>
                    <button onClick={onClose} style={{ background: "var(--bg-muted)", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>닫기</button>
                </div>

                <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 16 }}>아이가 설정한 지역에 접근하면 알림을 받습니다.</div>

                {/* Zone list */}
                {zones.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#D1D5DB" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🛡️</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>설정된 위험지역이 없어요</div>
                    </div>
                ) : zones.map(z => (
                    <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--status-negative-subtle)", borderRadius: 16, marginBottom: 8, border: "1.5px solid var(--status-negative-subtle)" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: zoneColor(z.zone_type), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "white", fontWeight: 800, flexShrink: 0 }}>
                            {z.zone_type === "construction" ? "🚧" : z.zone_type === "entertainment" ? "🎰" : z.zone_type === "water" ? "🌊" : "⚠️"}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--fg-primary)" }}>{z.name}</div>
                            <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>반경 {z.radius_m}m</div>
                        </div>
                        <button onClick={() => { if (window.confirm(`"${z.name}" 위험지역을 삭제할까요?`)) onDelete(z.id); }}
                            style={{ padding: "6px 10px", borderRadius: 10, background: "var(--status-negative-subtle)", color: "var(--status-negative)", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>삭제</button>
                    </div>
                ))}

                {/* Add new zone */}
                {!showAdd ? (
                    <button onClick={() => setShowAdd(true)}
                        style={{ width: "100%", marginTop: 12, padding: "14px", borderRadius: 16, border: "2px dashed #D1D5DB", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "var(--fg-secondary)", fontFamily: FF }}>
                        + 위험지역 추가
                    </button>
                ) : (
                    <div style={{ marginTop: 12, background: "var(--bg-subtle)", borderRadius: 20, padding: 16, border: "1.5px solid #E5E7EB" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg-primary)", marginBottom: 12 }}>새 위험지역 추가</div>

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

                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6 }}>반경: {newRadius}m</div>
                        <input type="range" min={50} max={500} step={50} value={newRadius} onChange={e => setNewRadius(Number(e.target.value))}
                            style={{ width: "100%", marginBottom: 12 }} />

                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6 }}>지도를 클릭해서 위치를 선택하세요</div>
                        <div ref={mapRef} style={{ width: "100%", height: 200, borderRadius: 16, overflow: "hidden", border: "2px solid #E5E7EB", marginBottom: 12 }} />

                        {selectedLoc && <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginBottom: 8 }}>✓ 위치 선택됨 ({selectedLoc.lat.toFixed(4)}, {selectedLoc.lng.toFixed(4)})</div>}

                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={handleAdd} disabled={!newName.trim() || !selectedLoc}
                                style={{ flex: 1, padding: "12px", borderRadius: 14, border: "none", background: !newName.trim() || !selectedLoc ? "#D1D5DB" : "var(--status-negative)", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                                ⚠️ 위험지역 등록
                            </button>
                            <button onClick={() => { setShowAdd(false); mapInst.current = null; }}
                                style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid #E5E7EB", background: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "var(--fg-secondary)" }}>취소</button>
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
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--fg-primary)", textAlign: "center", marginBottom: 20 }}>📞 비상 연락처 설정</div>
                <div style={{ fontSize: 13, color: "var(--fg-secondary)", textAlign: "center", marginBottom: 20 }}>아이 화면에서 바로 전화할 수 있어요</div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--theme-accent-text)", marginBottom: 6 }}>👩 엄마 전화번호</div>
                    <input value={mom} onChange={e => setMom(e.target.value)} placeholder="010-0000-0000" type="tel" style={inputSt}
                        onFocus={e => { e.target.style.borderColor = "var(--theme-accent)"; }} onBlur={e => { e.target.style.borderColor = "var(--bg-muted)"; }} />
                </div>

                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6", marginBottom: 6 }}>👨 아빠 전화번호</div>
                    <input value={dad} onChange={e => setDad(e.target.value)} placeholder="010-0000-0000" type="tel" style={inputSt}
                        onFocus={e => { e.target.style.borderColor = "#3B82F6"; }} onBlur={e => { e.target.style.borderColor = "var(--bg-muted)"; }} />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "var(--bg-muted)", color: "var(--fg-secondary)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>취소</button>
                    <button onClick={() => onSave({ mom: mom.trim(), dad: dad.trim() })} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "var(--hyeni-theme-gradient)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF, boxShadow: "var(--hyeni-theme-shadow-soft)" }}>저장</button>
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
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", borderBottom: "1px solid var(--bg-muted)", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => { onSave(list); onClose(); }} style={{ background: "var(--bg-muted)", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: FF }}>← 저장</button>
                <div style={{ fontWeight: 800, fontSize: 17, color: "var(--fg-primary)" }}>📍 자주 가는 장소</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}>
                {!showForm && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-tertiary)", marginBottom: 10 }}>빠른 추가</div>
                        <button
                            onClick={openNew}
                            style={{ padding: "10px 14px", borderRadius: 16, border: "2px dashed var(--theme-accent-line)", background: "var(--theme-accent-soft)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "var(--theme-accent-text)" }}
                        >
                            + 장소 직접 추가
                        </button>
                    </div>
                )}

                {showForm && (
                    <div style={{ background: "#FAFAFA", borderRadius: 20, padding: 18, marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg-primary)", marginBottom: 14 }}>{editIdx !== null ? "✏️ 장소 수정" : "➕ 장소 추가"}</div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>장소 이름</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="예) 할머니 집, 피아노 학원, 도서관"
                                style={{ width: "100%", padding: "12px 14px", border: "2px solid var(--bg-muted)", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", boxSizing: "border-box" }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-secondary)", marginBottom: 6, display: "block" }}>📍 위치</label>
                            {form.location ? (
                                <div style={{ background: "var(--theme-accent-soft)", borderRadius: 14, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 13, color: "var(--fg-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {form.location.address}</div>
                                    <button onClick={() => setShowMap(true)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid var(--theme-accent)", color: "var(--theme-accent-text)", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowMap(true)} style={{ width: "100%", padding: 12, border: "2px dashed var(--theme-accent-line)", borderRadius: 14, background: "var(--theme-accent-soft)", color: "var(--theme-accent-text)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                                    🗺️ 지도에서 장소 선택
                                </button>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveForm} style={{ flex: 1, padding: 13, background: "var(--hyeni-theme-gradient)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>저장</button>
                            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: 13, background: "var(--bg-muted)", color: "var(--fg-secondary)", border: "none", borderRadius: 16, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>취소</button>
                        </div>
                    </div>
                )}

                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-tertiary)", marginBottom: 10 }}>등록된 장소 ({list.length})</div>
                {list.length === 0 && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#D1D5DB" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
                        <div style={{ fontSize: 14 }}>등록된 장소가 없어요</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>자주 가는 장소를 저장해 두면 일정 입력이 빨라져요</div>
                    </div>
                )}
                {list.map((place, index) => (
                    <div key={place.id || index} style={{ background: "var(--hyeni-surface-warm)", borderRadius: 18, padding: "14px 16px", marginBottom: 10, borderLeft: "4px solid var(--theme-accent)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontSize: 24 }}>📍</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: "var(--fg-primary)" }}>{place.name}</div>
                                <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.location?.address || "위치 미등록"}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => openEdit(index)} style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, fontFamily: FF }}>✏️</button>
                                <button onClick={() => removeItem(index)} style={{ background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "var(--status-negative)", fontFamily: FF }}>✕</button>
                            </div>
                        </div>
                    </div>
                ))}
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
                        <div style={{ fontSize: 20, fontWeight: 900, color: "var(--fg-primary)" }}>💌 피드백 보내기</div>
                        <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 6, lineHeight: 1.6 }}>필요한 기능이 있으면 제안해 주세요</div>
                    </div>
                    <button onClick={onClose} style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: "var(--bg-muted)", color: "var(--fg-secondary)", fontWeight: 700, cursor: "pointer", fontFamily: FF }}>닫기</button>
                </div>

                <textarea
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="예) 형제자매별 위치 알림 시간을 따로 설정하고 싶어요"
                    style={{ width: "100%", minHeight: 170, resize: "vertical", padding: "16px 18px", borderRadius: 20, border: "2px solid var(--theme-accent-line)", outline: "none", fontSize: 15, lineHeight: 1.6, fontFamily: FF, color: "var(--fg-primary)", background: "var(--hyeni-surface-warm)", boxSizing: "border-box" }}
                />
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--fg-tertiary)", lineHeight: 1.6 }}>
                    제안은 {FEEDBACK_RECIPIENT}으로 전달됩니다.
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button
                        type="button"
                        onClick={onSend}
                        disabled={busy || !value.trim()}
                        style={{ flex: 1, padding: "15px", borderRadius: 16, border: "none", background: busy || !value.trim() ? "var(--theme-accent-soft)" : "var(--hyeni-theme-gradient)", color: busy || !value.trim() ? "var(--theme-accent-text)" : "white", fontWeight: 800, fontSize: 14, cursor: busy || !value.trim() ? "not-allowed" : "pointer", fontFamily: FF, boxShadow: busy || !value.trim() ? "none" : "var(--hyeni-theme-shadow-soft)" }}
                    >
                        {busy ? "보내는 중..." : "제안 보내기"}
                    </button>
                    <button type="button" onClick={onClose} style={{ padding: "15px 16px", borderRadius: 16, border: "1px solid #E5E7EB", background: "var(--bg-subtle)", color: "var(--fg-secondary)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>
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
        phones.mom && phones.mom.length >= 8 ? { key: "mom", label: "엄마", emoji: "👩", number: cleanNumber(phones.mom), color: "var(--theme-accent-text)", bg: "var(--theme-accent-soft)" } : null,
        phones.dad && phones.dad.length >= 8 ? { key: "dad", label: "아빠", emoji: "👨", number: cleanNumber(phones.dad), color: "var(--theme-accent-text)", bg: "var(--theme-accent-soft)" } : null,
    ].filter(Boolean);
    const hasTargets = targets.length > 0;

    return (
        <div
            aria-label={hasTargets ? "전화연결" : "등록된 전화번호 없음"}
            style={{
                minHeight: 132,
                padding: "14px",
                borderRadius: DESIGN.radius.xl,
                border: "1px solid var(--theme-accent-line)",
                background: hasTargets ? "linear-gradient(135deg,var(--theme-accent-soft),var(--hyeni-surface-warm))" : "var(--bg-subtle)",
                color: hasTargets ? "var(--theme-accent-text)" : "#9CA3AF",
                boxShadow: hasTargets ? "var(--hyeni-theme-shadow-soft)" : "none",
                fontFamily: FF,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 14, background: "rgba(255,255,255,0.86)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.7)" }}>☎</div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.15, color: hasTargets ? "var(--theme-accent-text)" : "#9CA3AF" }}>전화연결</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: hasTargets ? "var(--fg-secondary)" : "#9CA3AF", marginTop: 3 }}>
                            {hasTargets ? "엄마 · 아빠" : "연락처 없음"}
                        </div>
                    </div>
                </div>
                {hasTargets && (
                    <div style={{ padding: "5px 9px", borderRadius: 999, background: "rgba(255,255,255,0.72)", color: "var(--theme-accent-text)", fontSize: 10, fontWeight: 900, whiteSpace: "nowrap" }}>
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
                <div style={{ minHeight: 58, borderRadius: 18, background: "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-tertiary)", fontSize: 13, fontWeight: 900 }}>
                    연락처 없음
                </div>
            )}
        </div>
    );
}

// ChildTrackerOverlay moved to ./components/childTracker/ChildTrackerOverlay.jsx — imported at top.


// ─────────────────────────────────────────────────────────────────────────────
// 다중 자녀: 자녀별 기기 안전 카드 (배터리 / 마지막 접속)
// ─────────────────────────────────────────────────────────────────────────────
function ChildDeviceCard({ child, status }) {
    const color = child?.color_hex || "#9CA3AF";
    const battery = Number.isFinite(Number(status?.batteryLevel))
        ? Math.max(0, Math.min(100, Number(status.batteryLevel)))
        : null;
    const updatedAt = status?.updatedAt || status?.updated_at || null;
    const minutesAgo = updatedAt
        ? Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000))
        : null;
    const screenLabel = formatDeviceDuration(Number(status?.screenOnMs || 0));
    const recentApp = status?.recentApp || "사용기록 권한 필요";
    return (
        <div style={{
            padding: 14,
            borderRadius: 14,
            background: "white",
            border: `1.5px solid ${color}30`,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <div style={{ fontSize: 14, fontWeight: 800 }}>{child?.name || "아이"}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 8 }}>
                배터리: {battery == null ? "—" : `${battery}%`} · 마지막 접속: {minutesAgo == null ? "—" : `${minutesAgo}분 전`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                <div style={{ background: "var(--bg-subtle)", borderRadius: 10, padding: "6px 8px" }}>
                    <div style={{ fontSize: 10.5, color: "var(--fg-secondary)", fontWeight: 700 }}>화면 켜짐 시간</div>
                    <div style={{ fontSize: 13, color: "var(--fg-primary)", fontWeight: 900, marginTop: 2 }}>⏱️ {screenLabel}</div>
                </div>
                <div style={{ background: "var(--bg-subtle)", borderRadius: 10, padding: "6px 8px", minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, color: "var(--fg-secondary)", fontWeight: 700 }}>가장 많이 실행한 앱</div>
                    <div style={{ fontSize: 12.5, color: "var(--fg-primary)", fontWeight: 800, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📱 {recentApp}</div>
                </div>
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
    const [showChildEntry, setShowChildEntry] = useState(false);  // Phase 1 §3.4 자녀 첫 인사 transition
    const [showPairing, setShowPairing] = useState(false);
    const [showTrialInvite, setShowTrialInvite] = useState(false);
    const [featureLock, setFeatureLock] = useState({ open: false, feature: null, title: "", body: "" });
    const [showDisclosure, setShowDisclosure] = useState(false);
    const [pendingProduct, setPendingProduct] = useState(null);
    const [showRemoteAudio, setShowRemoteAudio] = useState(false);
    const [showSubscriptionSettings, setShowSubscriptionSettings] = useState(false);
    const [showMicPermissionHelp, setShowMicPermissionHelp] = useState(false);
    // Child onboarding wizard: shown by default when native setup is incomplete
    // and the user hasn't dismissed it; collapses automatically when every step
    // turns ready, and re-appears if a permission later flips back to false.
    const [permissionWizardDismissed, setPermissionWizardDismissed] = useState(false);
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
    const parentCapabilities = useMemo(
        () => deriveParentCapabilities(familyInfo, authUser, myRole),
        [familyInfo, authUser, myRole],
    );
    const isPrimaryParent = parentCapabilities.isPrimaryParent;
    const isCoParent = parentCapabilities.isCoParent;
    void isPrimaryParent;
    void isCoParent;
    const isNativeApp = typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
    const familyId = familyInfo?.familyId;
    const entitlement = useEntitlement(familyId);
    const pairCode = familyInfo?.pairCode || "";
    const childrenContext = useChildren(familyInfo);
    const pairedChildren = childrenContext.list;
    const _pairedDevice = isParent
      ? null
      : (pairedChildren.find((c) => c.user_id === authUser?.id) || pairedChildren[0] || null);
    const isMultiChild = childrenContext.isMultiChild;
    const globalNotif = DEFAULT_NOTIF;

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
    const [memoThreadReplies, setMemoThreadReplies] = useState([]);
    const [memoReadBy, setMemoReadBy] = useState([]);
    const [parentPhones, setParentPhones] = useState({ mom: "", dad: "" });
    const [showPhoneSettings, setShowPhoneSettings] = useState(false);
    const [showParentSetup, setShowParentSetup] = useState(false);
    const [showCreateWizard, setShowCreateWizard] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackDraft, setFeedbackDraft] = useState("");
    const [feedbackBusy, setFeedbackBusy] = useState(false);

    // ── UI state ───────────────────────────────────────────────────────────────
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingEventId, setEditingEventId] = useState(null);
    const [eventChildSelection, setEventChildSelection] = useState({ childIds: [], familyAll: false });
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [showChildTracker, setShowChildTracker] = useState(false);
    const [locationRefreshRequestedAt, setLocationRefreshRequestedAt] = useState(null);
    const [_listening, setListening] = useState(false);
    const [notification, setNotification] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [emergencies, setEmergencies] = useState([]);
    const [bounce, setBounce] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [mapLoadError, setMapLoadError] = useState("");
    const [activeView, setActiveView] = useState(() => {
      const childCount = familyInfo?.members?.filter(m => m.role === "child")?.length || 0;
      return (isParent && childCount >= 2) ? "home" : "calendar";
    });
    // Per-child UI selection. For 2+ child families, all non-home tabs operate
    // within a single selected child's context. For 1-child families, this is
    // auto-set so existing single-child UX is preserved.
    const [selectedChildId, setSelectedChildId] = useState(null);
    // Phase 2 — 자녀 상세 overlay (Life360식). null이면 닫힘.
    const [childDetailId, setChildDetailId] = useState(null);
    // Phase 3 — 자녀 모드 설정 / 스티커 보내기 / 마스코트 표시 토글
    const [showChildSettings, setShowChildSettings] = useState(false);
    const [showSendStickerSheet, setShowSendStickerSheet] = useState(false);
    // Phase 4 — 부모 운영 화면 통합 진입점
    const [showParentSettings, setShowParentSettings] = useState(false);
    const [showPlaceManager, setShowPlaceManager] = useState(false);
    const [childShowMascot, setChildShowMascot] = useState(() => {
        if (typeof window === "undefined") return true;
        const stored = window.localStorage.getItem("hyeni-child-show-mascot");
        return stored === null ? true : stored !== "false";
    });
    const [childSendingSticker, setChildSendingSticker] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem("hyeni-child-show-mascot", String(childShowMascot));
    }, [childShowMascot]);
    // Multi-child explanatory banner shown when a parent taps a non-home tab
    // before picking a child. The banner is also raised by the force-redirect
    // useEffect below so deep-link / other entry paths surface the same hint.
    const [multiChildHint, setMultiChildHint] = useState(null);
    useEffect(() => {
      if (!multiChildHint) return undefined;
      const t = setTimeout(() => setMultiChildHint(null), 6000);
      return () => clearTimeout(t);
    }, [multiChildHint]);
    // Single-child families pin selectedChildId automatically so existing
    // single-child rendering paths see a non-null value with no UX delta.
    // Multi-child families clear it whenever the chosen child disappears.
    useEffect(() => {
      if (!isParent) return;
      const validIds = new Set(pairedChildren.map((c) => c.id));
      if (selectedChildId && !validIds.has(selectedChildId)) {
        setSelectedChildId(null);
        return;
      }
      if (pairedChildren.length === 1 && !selectedChildId) {
        setSelectedChildId(pairedChildren[0].id);
      }
    }, [isParent, pairedChildren, selectedChildId]);
    // Force-route multi-child parents back to home whenever no child is
    // selected — every per-child tab needs a context. "오늘" (activeView ===
    // "calendar") is exempt: it has its own multi-child aggregate view that
    // groups events under each child and lets the parent dive in by tap.
    useEffect(() => {
      if (isParent && isMultiChild && !selectedChildId
          && activeView !== "home" && activeView !== "calendar") {
        setActiveView("home");
        setMultiChildHint("상세 기능은 아이별로 확인할 수 있어요. 위에서 아이를 먼저 선택해주세요.");
      }
    }, [isParent, isMultiChild, selectedChildId, activeView]);
    const selectedChild = selectedChildId
      ? pairedChildren.find((c) => c.id === selectedChildId)
      : null;
    const activeThemeColor = useMemo(() => {
      if (isParent) {
        return selectedChild?.color_hex
          || pairedChildren?.find((member) => member?.role === "child")?.color_hex
          || null;
      }
      const me = pairedChildren.find((member) => member.user_id === authUser?.id);
      return me?.color_hex || null;
    }, [authUser?.id, isParent, pairedChildren, selectedChild?.color_hex]);

    // Theme accent — picks the child color whose perspective the user is in,
    // so the entire app reflects the selected child's identity color.
    //   parent: selectedChild.color_hex (or first child if none picked)
    //   child : own row's color_hex from pairedChildren
    // Falls back to cached → default warm-pink on first launch.
    useEffect(() => {
      if (activeThemeColor) applyThemeColor(activeThemeColor);
      else initThemeFromCache();
    }, [activeThemeColor]);

    const [editingLocForEvent, setEditingLocForEvent] = useState(null);
    const [showKkukReceived, setShowKkukReceived] = useState(null); // { from: "엄마"|"아이", emoji, timestamp }
    const [kkukCooldown, setKkukCooldown] = useState(false);
    const [showParentMemoPage, setShowParentMemoPage] = useState(false);
    const [showChildMemoPage, setShowChildMemoPage] = useState(false);
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
    const [selectedDateLocationTrail, setSelectedDateLocationTrail] = useState([]);
    const [selectedDateTrailLoading, setSelectedDateTrailLoading] = useState(false);
    const [selectedDateTrailError, setSelectedDateTrailError] = useState("");
    const [pushPermission, setPushPermission] = useState(() => getPermissionStatus());
    const [pushDeniedDismissed, setPushDeniedDismissed] = useState(() => {
        try { return sessionStorage.getItem("hyeni-push-denied-dismissed") === "1"; } catch (e) { return false; }
    });
    const [showSettingsSheet, setShowSettingsSheet] = useState(false);
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
    const [childDeviceStatusMap, setChildDeviceStatusMap] = useState({});
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
    const screenSessionStartedAtRef = useRef(Date.now());
    const screenSessionVisibleMsRef = useRef(0);
    const lastVisibleAtRef = useRef(typeof document !== "undefined" && document.visibilityState === "visible" ? Date.now() : null);
    const publishChildDeviceStatusRef = useRef(async () => {});
    const academyFocusAlertedRef = useRef(new Set());
    const childPosRef = useRef(null);
    const sosAutoTimersRef = useRef([]);
    const parentBootstrapRefreshKeyRef = useRef("");
    const displayChildPositions = useMemo(() => {
        const positions = effectiveChildPositions(allChildPositions, entitlement);
        // Stable render order: align positions with pairedChildren
        // (already sorted by child_order). Without this, marker draw
        // order — and therefore the perceived color/zIndex pairing —
        // shifts every time Supabase returns rows in a different sequence.
        const byUserId = new Map();
        positions.forEach((p) => {
            const id = p?.user_id;
            if (id) byUserId.set(id, p);
        });
        const ordered = [];
        pairedChildren.forEach((child) => {
            const hit = byUserId.get(child?.user_id);
            if (hit) ordered.push(hit);
        });
        // Defensive: append any positions whose user_id isn't in pairedChildren
        // (e.g. former child whose membership row was just removed).
        const seen = new Set(ordered.map((p) => p.user_id));
        positions.forEach((p) => {
            if (p?.user_id && !seen.has(p.user_id)) ordered.push(p);
        });
        return ordered;
    }, [allChildPositions, entitlement, pairedChildren]);
    const displayChildLocationKey = useMemo(
        () => displayChildPositions.map(pos => `${pos.user_id || "child"}:${pos.lat}:${pos.lng}:${pos.updatedAt || ""}`).join("|"),
        [displayChildPositions]
    );
    const displayChildPos = useMemo(
        () => {
            const effectiveCurrent = effectiveChildLocation(childPos, entitlement);
            return resolveSelectedChildPosition({
                childPos: effectiveCurrent,
                allChildPositions: displayChildPositions,
                selectedChild,
            });
        },
        [childPos, displayChildPositions, entitlement, selectedChild]
    );
    const routeChildProfile = selectedChild
        || (displayChildPos?.user_id ? pairedChildren.find(child => child.user_id === displayChildPos.user_id) : null)
        || pairedChildren[0]
        || null;
    // ── 다중 자녀 프라이버시 (원칙 5): 자녀 기기는 자기 데이터만 본다 ─────────────────
    // events 는 { [dateKey]: Event[] } 형태의 맵. 학부모는 그대로 두고,
    // 자녀 모드일 때만 가족 전체 일정 OR 본인이 포함된 일정으로 좁힌다.
    // child_ids는 events_children.child_id (= family_members.id)이므로
    // auth.uid()가 아닌 본인의 family_members.id로 비교한다.
    const myFamilyMemberId = useMemo(() => {
        if (isParent) return null;
        return pairedChildren.find((c) => c.user_id === authUser?.id)?.id ?? null;
    }, [pairedChildren, isParent, authUser?.id]);
    const visibleEvents = useMemo(() => {
        if (isParent) {
            return selectedChild?.id ? filterEventMapForChild(events, selectedChild.id) : events;
        }
        const myId = myFamilyMemberId;
        if (!events || typeof events !== "object") return events;
        if (Array.isArray(events)) {
            return events.filter((e) => e?.is_family_event || (myId && (e?.child_ids || []).includes(myId)));
        }
        const filtered = {};
        for (const dk of Object.keys(events)) {
            const list = Array.isArray(events[dk]) ? events[dk] : [];
            filtered[dk] = list.filter((e) => e?.is_family_event || (myId && (e?.child_ids || []).includes(myId)));
        }
        return filtered;
    }, [events, isParent, myFamilyMemberId, selectedChild?.id]);
    const ownPosition = useMemo(() => {
        if (isParent) return null;
        const myId = authUser?.id;
        return allChildPositions.find((p) => p.user_id === myId) || null;
    }, [allChildPositions, isParent, authUser?.id]);
    useEffect(() => { childPosRef.current = childPos; }, [childPos]);
    // Hint surface for the freemium location gate.
    //   Case A — no child position at all + free tier: legacy "5분 지난 위치만"
    //     message (still useful on cold start before the first fix arrives).
    //   Case B — child position present + free tier (M1 now always returns
    //     the latest fix tagged isDelayed=true): inform the parent why the
    //     marker isn't real-time, with an upgrade nudge.
    const locationGateHint = isParent && !entitlement.canUse(FEATURES.REALTIME_LOCATION)
        ? (!displayChildPos && allChildPositions.length > 0
            ? "무료 플랜에서는 위치 표시가 잠시 지연돼요. 실시간 위치는 프리미엄에서 사용할 수 있어요."
            : displayChildPos?.isDelayed
                ? "무료 플랜이라 위치가 잠시 지연되어 표시돼요. 실시간으로 보려면 프리미엄으로 업그레이드해 주세요."
                : "")
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

    const openAcademyManagement = useCallback(() => {
        if (!isParent) return;
        if (!parentCapabilities.canManagePlaces) return;
        if (academies.length === 0 && !entitlement.canUse(FEATURES.ACADEMY_SCHEDULE)) {
            openFeatureLock(FEATURES.ACADEMY_SCHEDULE);
            return;
        }
        setShowSavedPlaceMgr(false);
        setShowDangerZones(false);
        setShowAcademyMgr(true);
    }, [academies.length, entitlement, isParent, openFeatureLock, parentCapabilities.canManagePlaces]);

    const handleOpenSavedPlaceMgr = useCallback(() => {
        openAcademyManagement();
    }, [openAcademyManagement]);

    // Playdate context: bypass the academy-schedule entitlement gate. The user
    // came here to register a 친구 만남 안전 장소, not to manage academies, so
    // showing them the ACADEMY_SCHEDULE paywall is wrong-feature messaging.
    // NOTE: the SAVED_PLACES paywall inside AcademyManager still blocks
    // free-tier users at the create step. Fully enabling free-tier playdate
    // place creation requires a dedicated insert path (is_playdate_safe=true
    // + public_place_id at INSERT time per FP-D10 RLS). Tracked as follow-up.
    const handleOpenPlaydatePlaceMgr = useCallback(() => {
        if (!isParent) return;
        if (!parentCapabilities.canManagePlaces) return;
        setShowAcademyMgr(true);
    }, [isParent, parentCapabilities.canManagePlaces]);

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
    const memoThreadDateKeys = useMemo(
        () => buildMemoThreadDateKeys(currentYear, currentMonth, selectedDate),
        [currentYear, currentMonth, selectedDate]
    );

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
        const cached = readMemoRepliesCache(familyId, dateKey);
        setMemoReplies(cached);
        let cancelled = false;
        fetchMemoReplies(familyId, dateKey)
            .then((rows) => { if (!cancelled) setMemoReplies(rows); })
            .catch(() => {});
        // Legacy memos.read_by fetch retained for the card-level badge only.
        // Removal scheduled for v1.1 MEMO-CLEANUP-01.
        supabase.from("memos").select("read_by").eq("family_id", familyId).eq("date_key", dateKey).maybeSingle()
            .then(({ data }) => setMemoReadBy(data?.read_by || []));
        return () => { cancelled = true; };
    }, [familyId, dateKey, hasMemo, authUser?.id]);

    useEffect(() => {
        if (!familyId || !dateKey) return;
        writeMemoRepliesCache(familyId, dateKey, memoReplies || []);
    }, [familyId, dateKey, memoReplies]);

    useEffect(() => {
        const memoPageOpen = showParentMemoPage || showChildMemoPage;
        if (!memoPageOpen) {
            setMemoThreadReplies([]);
            return;
        }
        if (!familyId || !dateKey) return;

        let cancelled = false;
        const reconcileMemoReplies = () => {
            fetchMemoRepliesForDateKeys(familyId, memoThreadDateKeys)
                .then((rows) => {
                    if (cancelled || dateKeyRef.current !== dateKey) return;
                    const dbRows = Array.isArray(rows) ? rows : [];
                    setMemoThreadReplies(prev => {
                        const pending = (prev || []).filter(reply => {
                            const id = String(reply?.id || "");
                            if (!id.startsWith("temp-")) return false;
                            return !dbRows.some(row => row.user_id === reply.user_id && row.content === reply.content);
                        });
                        return pending.length > 0 ? [...dbRows, ...pending] : dbRows;
                    });
                })
                .catch((err) => console.warn("[memo] realtime reconcile failed:", err));
        };

        reconcileMemoReplies();
        const timer = window.setInterval(reconcileMemoReplies, 1000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [familyId, dateKey, memoThreadDateKeys, showParentMemoPage, showChildMemoPage]);

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

    useEffect(() => () => {
        sosAutoTimersRef.current.forEach(timerId => clearTimeout(timerId));
        sosAutoTimersRef.current = [];
    }, []);

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
        if (!familyInfo?.phones) return;
        // Legacy data: pre-fix, every signing-up parent's phone landed in mom_phone
        // regardless of gender. If the current user is the primary parent and chose
        // "아빠" at signup, swap the slots once so the contact card matches identity.
        const gender = getParentGenderFromUser(authUser);
        const isPrimary = authUser?.id && familyInfo?.primaryParentId === authUser.id;
        if (
            isPrimary &&
            gender === "dad" &&
            familyInfo.phones.mom &&
            !familyInfo.phones.dad &&
            familyInfo.familyId
        ) {
            const swapped = { mom: "", dad: familyInfo.phones.mom };
            setParentPhones(swapped);
            saveParentPhones(familyInfo.familyId, swapped.mom, swapped.dad)
                .then(() => {
                    setFamilyInfo((prev) => prev ? { ...prev, phones: swapped } : prev);
                })
                .catch((err) => {
                    console.warn("[parent-phone-migration] swap failed:", err?.message || err);
                    setParentPhones(familyInfo.phones);
                });
            return;
        }
        setParentPhones(familyInfo.phones);
    }, [familyInfo, authUser]);

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

    const refreshNativeReadiness = useCallback(async () => {
        if (!isNativeApp) return;
        const health = await getNativeNotificationHealth();
        if (health) {
            setNativeNotifHealth(health);
            setPushPermission(
                health.postPermissionGranted && health.notificationsEnabled ? "granted" : "denied"
            );
        }
        try {
            const { Capacitor, registerPlugin } = await import("@capacitor/core");
            if (!Capacitor.isNativePlatform()) return;
            const BgLoc = registerPlugin("BackgroundLocation");
            const result = await BgLoc.checkBackgroundLocationPermission();
            setBgLocationGranted(result.backgroundLocation === true);
        } catch {
            // web mode or native plugin unavailable
        }
    }, [isNativeApp]);

    // ── Native notification health (Android Capacitor) ─────────────────────────
    useEffect(() => {
        if (!isNativeApp) return;
        let cancelled = false;

        const refresh = async () => {
            if (cancelled) return;
            await refreshNativeReadiness();
        };
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                refresh();
            }
        };

        refresh();
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [isNativeApp, refreshNativeReadiness]);

    // ── Child: poll background-location grant while the banner is showing ─────
    // ACCESS_BACKGROUND_LOCATION on Android 11+ can't be requested via a
    // dialog — the OS forces the user into the app's location-settings page.
    // When they pick "항상 허용" and return, visibilitychange usually fires,
    // but some OEM transitions skip it (or fire too early). A short 2s poll
    // closes the gap so the banner disappears the moment the OS grant lands,
    // making it feel like the app advanced "right away" after the user's tap.
    useEffect(() => {
        if (!isNativeApp || isParent || bgLocationGranted) return;
        const id = setInterval(() => { void refreshNativeReadiness(); }, 2000);
        return () => clearInterval(id);
    }, [isNativeApp, isParent, bgLocationGranted, refreshNativeReadiness]);

    // ── Subscribe to server-side Web Push when permission + family are ready ────
    // 네이티브 앱(Android)에서는 FCM을 사용하므로 Web Push 구독 안 함 (이중 알림 방지)
    useEffect(() => {
        if (isNativeApp) {
            // Android: this device's Web Push subscription (if any was registered
            // before going native) is removed by unsubscribeFromPush — that helper
            // does an endpoint-scoped DELETE on push_subscriptions. We deliberately
            // do NOT broaden to .eq("user_id", ...) because the same auth user may
            // have an active web tab on another device whose subscription must
            // survive. Stale rows whose SW was unregistered without this hook
            // running are pruned server-side: the push-notify Edge Function deletes
            // any push_subscriptions row that returns 404/410 on send.
            unsubscribeFromPush().catch(() => {});
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => {
                    regs.forEach(r => r.unregister());
                });
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
        const provider = getAuthProvider(user);
        const isKakao = provider === "kakao"
            || user.app_metadata?.provider === "kakao"
            || user.identities?.some(i => i.provider === "kakao")
            || user.user_metadata?.provider === "kakao";
        const isPhoneParent = provider === "phone"
            || !!user.phone
            || user.user_metadata?.auth_provider === "phone";

        if (isKakao || isPhoneParent) {
            syncAuthProfile(user).catch((err) => {
                console.warn("[syncAuthProfile]", err?.message || err);
            });
        }

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

        // Parent account with no family → show parent setup choice (don't auto-create)
        // Covers Kakao/phone (prod) and email/dev signups whose stored role is "parent".
        const storedRole = (typeof window !== "undefined" && (window.localStorage?.getItem("hyeni-my-role") || window.sessionStorage?.getItem("hyeni-my-role"))) || null;
        if (isKakao || isPhoneParent || storedRole === "parent") {
            setMyRole("parent");
            setShowParentSetup(true); // Show "새 가족 만들기 / 기존 가족 합류" choice
        }
    }, []);

    // ── Auth: check session on mount ────────────────────────────────────────────
    const authInitDone = useRef(false);
    const authUserRef = useRef(null);
    const myRoleRef = useRef(myRole);
    const familyInfoRef = useRef(familyInfo);
    const selectedChildUserIdRef = useRef(selectedChild?.user_id || null);
    // Keep refs in sync with state (avoids stale closure in visibility handler)
    useEffect(() => { authUserRef.current = authUser; }, [authUser]);
    useEffect(() => { myRoleRef.current = myRole; }, [myRole]);
    useEffect(() => { familyInfoRef.current = familyInfo; }, [familyInfo]);
    useEffect(() => { selectedChildUserIdRef.current = selectedChild?.user_id || null; }, [selectedChild?.user_id]);

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
            onEventsChange: async (type, newRow, oldRow) => {
                // DELETE has no row id from join — handle synchronously.
                if (type === "DELETE" && oldRow) {
                    setEvents(prev => {
                        const updated = { ...prev };
                        Object.keys(updated).forEach(k => {
                            updated[k] = (updated[k] || []).filter(e => e.id !== oldRow.id);
                            if (updated[k].length === 0) delete updated[k];
                        });
                        cacheEvents(updated);
                        return updated;
                    });
                    return;
                }

                if (!newRow?.id) return;

                // INSERT/UPDATE — postgres_changes only carries the events row,
                // not the events_children join. Re-fetch to populate child_ids
                // and is_family_event so the multi-child visibility filter
                // works without waiting for the next full fetchEvents.
                const fetched = await fetchEventById(newRow.id);
                if (!fetched) return;
                const { dateKey: dk, event: ev } = fetched;

                setEvents(prev => {
                    const updated = { ...prev };
                    if (type === "UPDATE") {
                        // Remove the row from any previous date_key bucket in case it moved.
                        Object.keys(updated).forEach(k => {
                            updated[k] = (updated[k] || []).filter(e => e.id !== ev.id);
                            if (updated[k].length === 0) delete updated[k];
                        });
                    }
                    updated[dk] = [...(updated[dk] || []).filter(e => e.id !== ev.id), ev]
                        .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
                    cacheEvents(updated);
                    return updated;
                });
            },
            onAcademiesChange: (type, newRow, oldRow) => {
                const CAT_COLORS = { school: { color: "#A78BFA", bg: "#EDE9FE" }, sports: { color: "#34D399", bg: "var(--status-positive-subtle)" }, hobby: { color: "var(--status-cautionary)", bg: "var(--status-cautionary-subtle)" }, family: { color: "#F87171", bg: "var(--status-negative-subtle)" }, friend: { color: "#60A5FA", bg: "var(--bg-subtle)" }, other: { color: "#EC4899", bg: "#FCE7F3" } };
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
                const childUserId = payload?.user_id || payload?.userId;
                const selectedChildUserId = selectedChildUserIdRef.current;
                if (!isParent || !selectedChildUserId || (childUserId && childUserId === selectedChildUserId)) {
                    setChildPos(nextPosition);
                }
                const updatedMs = new Date(updatedAt).getTime();
                if (Number.isFinite(updatedMs)) {
                    setLocationRefreshRequestedAt(prev => (prev && updatedMs >= prev ? null : prev));
                }
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
                const members = familyInfoRef.current?.members || [];
                const senderChildEmoji = payload.senderRole === "child"
                    ? members.find(member => member.user_id === payload.senderId)?.emoji
                    : members.find(member => member.role === "child" && member.user_id === authUser?.id)?.emoji;
                const senderEmoji = payload.senderEmoji || senderChildEmoji || (payload.senderRole === "parent" ? "👨‍👩‍👧" : "👧");
                setShowKkukReceived({ from: senderLabel, emoji: senderEmoji, timestamp: Date.now() });
                // Vibrate if supported
                if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
                // Native notification (wakes screen on Android)
                showKkukNotification(senderLabel, payload.dedup_key);
            },
            onMemoRepliesChange: (newRow, eventType = "INSERT", oldRow) => {
                // DELETE: oldRow only — drop from local state if present.
                if (eventType === "DELETE") {
                    if (!oldRow?.id) return;
                    setMemoReplies(prev => prev.filter(r => r.id !== oldRow.id));
                    return;
                }
                if (!newRow) return;
                if (newRow.date_key !== dateKeyRef.current) return;

                // UPDATE: read receipts (read_by) on a reply we are already
                // showing. Merge the new read_by so the sender's "읽음 ✓"
                // badge updates without a manual reload. Do not skip on
                // newRow.user_id === self — the UPDATE may be triggered by
                // any reader (including us), and the merge is idempotent.
                if (eventType === "UPDATE") {
                    setMemoReplies(prev => prev.map(r =>
                        r.id === newRow.id ? { ...r, read_by: newRow.read_by ?? r.read_by } : r
                    ));
                    return;
                }

                // INSERT: ignore self-echo so optimistic state isn't doubled.
                if (newRow.user_id === authUser?.id) return;
                setMemoReplies(prev => {
                    if (prev.some(r => r.id === newRow.id)) return prev;
                    return [...prev, { id: newRow.id, user_id: newRow.user_id, user_role: newRow.user_role, content: newRow.content, created_at: newRow.created_at, read_by: newRow.read_by ?? [] }];
                });
            },
            onFamilyMembersChange: async () => {
                // Pairing/unpair signal. Refetch full family info so members list,
                // child counts, color/photo derivations all update without
                // requiring a manual reload.
                if (!authUser?.id) return;
                try {
                    const fam = await getMyFamily(authUser.id);
                    if (fam) setFamilyInfo(fam);
                    else setFamilyInfo(null);  // child unpaired by parent
                } catch (err) {
                    console.warn("[onFamilyMembersChange] refetch failed:", err);
                }
            },
            // Child: remote listen - parent requests mic recording
            onRemoteListenStart: async (payload) => {
                if (isParent) return; // only child responds
                const targetUserId = payload?.targetUserId || payload?.target_user_id || null;
                if (targetUserId && targetUserId !== authUser?.id) return;
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
            onRemoteListenStop: (payload) => {
                const targetUserId = payload?.targetUserId || payload?.target_user_id || null;
                if (targetUserId && targetUserId !== authUser?.id) return;
                setListeningSession(null);
                stopRemoteAudioCapture("user_stopped");
            },
            onAudioChunk: (payload) => {
                // Parent receives audio chunk - handled by AmbientAudioRecorder component
                if (!isParent) return;
                // Dispatch custom event for the recorder component to pick up
                window.dispatchEvent(new CustomEvent("remote-audio-chunk", { detail: payload }));
            },
            onChildDeviceStatus: (payload) => {
                if (!isParent || !payload) return;
                const childUserId = payload.user_id || payload.userId;
                if (!childUserId) return;
                setChildDeviceStatusMap(prev => ({
                    ...prev,
                    [childUserId]: {
                        ...(prev[childUserId] || {}),
                        ...payload,
                        updatedAt: payload.updatedAt || payload.updated_at || new Date().toISOString(),
                    }
                }));
            },
            onChildDeviceStatusRequest: (payload) => {
                if (isParent || !authUser?.id) return;
                const targetUserId = payload?.targetUserId || payload?.target_user_id || null;
                if (targetUserId && targetUserId !== authUser.id) return;
                void publishChildDeviceStatusRef.current();
            },
        });

        return () => { unsubscribe(realtimeChannel.current); };
    }, [familyId, authUser?.id, isParent]);

    // ── Child: check if launched via FCM remote_listen ──
    useEffect(() => {
        if (isParent || !familyId) return;
        const checkFlag = () => {
            if (window.__REMOTE_LISTEN_REQUESTED && realtimeChannel.current) {
                const launchRequestId = window.__REMOTE_LISTEN_REQUEST_ID || "";
                window.__REMOTE_LISTEN_REQUESTED = false;
                window.__REMOTE_LISTEN_REQUEST_ID = "";
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
                            { familyId, initiatorUserId: null, childUserId: authUser?.id || null, requestId: launchRequestId }
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

    // ── Child: persist UA-derived device_label to family_members ──────────────
    // Broadcasts are ephemeral — if a parent isn't actively listening when a
    // child publishes, the label evaporates and the management card falls back
    // to "기기 1". A column on family_members survives reloads and is read by
    // getMyFamily, so once-per-mount self-row UPDATE makes the label sticky.
    // RLS fm_upd policy already allows user_id = auth.uid() to update its own row.
    useEffect(() => {
        if (isParent || !familyId || !authUser?.id) return;
        const label = getDeviceLabelFromUA();
        if (!label) return;
        let cancelled = false;
        (async () => {
            try {
                const { error } = await supabase
                    .from("family_members")
                    .update({ device_label: label })
                    .eq("user_id", authUser.id);
                if (cancelled) return;
                if (error) console.warn("[DeviceLabel] persist failed:", error.message || error);
            } catch (e) {
                if (cancelled) return;
                console.warn("[DeviceLabel] persist error:", e?.message || e);
            }
        })();
        return () => { cancelled = true; };
    }, [isParent, familyId, authUser?.id]);

    // ── Child: persist native permission snapshot for parent pre-flight ───────
    // The parent app can't know whether a child's USE_FULL_SCREEN_INTENT /
    // battery / DND / mic / channel are all green until the child reports.
    // Without this snapshot the parent presses 주변소리 듣기, the FCM lands but
    // a missing 권한 silently blocks the wake — exactly the symptom the user
    // reported. Publish on every health/bg-location change; values rarely
    // change so re-emits stay cheap. RLS fm_upd permits self-row write.
    useEffect(() => {
        if (!isNativeApp || isParent || !familyId || !authUser?.id) return;
        if (!nativeNotifHealth) return;
        const snapshot = {
            recordAudio: nativeNotifHealth.recordAudioGranted === true,
            postNotif: nativeNotifHealth.postPermissionGranted === true && nativeNotifHealth.notificationsEnabled === true,
            fullScreen: nativeNotifHealth.fullScreenIntentAllowed === true,
            battery: nativeNotifHealth.batteryOptimizationsIgnored === true,
            powerSaveMode: nativeNotifHealth.powerSaveMode === true,
            backgroundRestricted: nativeNotifHealth.backgroundRestricted === true,
            channelOk: nativeNotifHealth.remoteListenChannelEnabled !== false,
            locationOk: bgLocationGranted === true,
            dndMode: nativeNotifHealth.dndMode || "unknown",
            dndAccess: nativeNotifHealth.dndAccess === true,
            ringerMode: nativeNotifHealth.ringerMode || "unknown",
            networkConnected: nativeNotifHealth.networkConnected !== false,
            networkValidated: nativeNotifHealth.networkValidated !== false,
            screenInteractive: typeof nativeNotifHealth.screenInteractive === "boolean" ? nativeNotifHealth.screenInteractive : null,
            keyguardLocked: nativeNotifHealth.keyguardLocked === true,
            foldState: nativeNotifHealth.foldState || "not_foldable_or_unknown",
            screenWidthDp: nativeNotifHealth.screenWidthDp ?? null,
            screenHeightDp: nativeNotifHealth.screenHeightDp ?? null,
            smallestScreenWidthDp: nativeNotifHealth.smallestScreenWidthDp ?? null,
            lastReportedAt: new Date().toISOString(),
        };
        let cancelled = false;
        (async () => {
            try {
                const { error } = await supabase
                    .from("family_members")
                    .update({ device_health: snapshot })
                    .eq("user_id", authUser.id);
                if (cancelled) return;
                if (error) console.warn("[DeviceHealth] persist failed:", error.message || error);
            } catch (e) {
                if (cancelled) return;
                console.warn("[DeviceHealth] persist error:", e?.message || e);
            }
        })();
        return () => { cancelled = true; };
    }, [isNativeApp, isParent, familyId, authUser?.id, nativeNotifHealth, bgLocationGranted]);

    // ── Child device safety status broadcast (battery/screen/app-state) ───────
    useEffect(() => {
        if (isParent || !familyId || !authUser?.id) return;

        const getBatterySnapshot = async () => {
            const baseSnapshot = { batteryLevel: null, isCharging: null, recentAppPackage: "", usagePermission: "unavailable", screenInteractive: null };
            try {
                const { Capacitor, registerPlugin } = await import("@capacitor/core");
                if (Capacitor?.isNativePlatform?.()) {
                    const BgLoc = registerPlugin("BackgroundLocation");
                    const native = await BgLoc.getDeviceUsageSnapshot();
                    if (native && typeof native === "object") {
                        return {
                            ...baseSnapshot,
                            ...native,
                            batteryLevel: Number.isFinite(Number(native.batteryLevel)) ? Number(native.batteryLevel) : null,
                            isCharging: typeof native.isCharging === "boolean" ? native.isCharging : null,
                        };
                    }
                }
            } catch {
                // fall through to web battery api
            }
            try {
                const battery = await navigator?.getBattery?.();
                if (!battery) return baseSnapshot;
                return {
                    batteryLevel: Math.round((battery.level || 0) * 100),
                    isCharging: !!battery.charging,
                    recentAppPackage: "",
                    usagePermission: "unavailable",
                    screenInteractive: null,
                };
            } catch {
                return baseSnapshot;
            }
        };

        const buildPayload = async () => {
            const now = Date.now();
            let visibleMs = screenSessionVisibleMsRef.current;
            if (lastVisibleAtRef.current) {
                visibleMs += Math.max(0, now - lastVisibleAtRef.current);
            }
            const { batteryLevel, isCharging, recentAppPackage, usagePermission, screenInteractive } = await getBatterySnapshot();
            const netInfo = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
            const nativeRemoteListenHealth = nativeNotifHealth ? {
                recordAudio: nativeNotifHealth.recordAudioGranted === true,
                postNotif: nativeNotifHealth.postPermissionGranted === true && nativeNotifHealth.notificationsEnabled === true,
                fullScreen: nativeNotifHealth.fullScreenIntentAllowed === true,
                battery: nativeNotifHealth.batteryOptimizationsIgnored === true,
                powerSaveMode: nativeNotifHealth.powerSaveMode === true,
                backgroundRestricted: nativeNotifHealth.backgroundRestricted === true,
                channelOk: nativeNotifHealth.remoteListenChannelEnabled !== false,
                locationOk: bgLocationGranted === true,
                recordAudioGranted: nativeNotifHealth.recordAudioGranted === true,
                postPermissionGranted: nativeNotifHealth.postPermissionGranted === true,
                notificationsEnabled: nativeNotifHealth.notificationsEnabled === true,
                fullScreenIntentAllowed: nativeNotifHealth.fullScreenIntentAllowed === true,
                batteryOptimizationsIgnored: nativeNotifHealth.batteryOptimizationsIgnored === true,
                exactAlarmAllowed: nativeNotifHealth.exactAlarmAllowed === true,
                remoteListenChannelEnabled: nativeNotifHealth.remoteListenChannelEnabled !== false,
                locationServiceRunning: nativeNotifHealth.locationServiceRunning === true,
                dndMode: nativeNotifHealth.dndMode || "unknown",
                dndAccess: nativeNotifHealth.dndAccess === true,
                ringerMode: nativeNotifHealth.ringerMode || "unknown",
                networkConnected: nativeNotifHealth.networkConnected !== false,
                networkValidated: nativeNotifHealth.networkValidated !== false,
                keyguardLocked: nativeNotifHealth.keyguardLocked === true,
                foldState: nativeNotifHealth.foldState || "not_foldable_or_unknown",
                screenWidthDp: nativeNotifHealth.screenWidthDp ?? null,
                screenHeightDp: nativeNotifHealth.screenHeightDp ?? null,
                smallestScreenWidthDp: nativeNotifHealth.smallestScreenWidthDp ?? null,
                sdkInt: nativeNotifHealth.sdkInt ?? null,
                manufacturer: nativeNotifHealth.manufacturer || "",
                model: nativeNotifHealth.model || "",
            } : {};
            return {
                family_id: familyId,
                user_id: authUser.id,
                updatedAt: new Date(now).toISOString(),
                batteryLevel,
                isCharging,
                connectionType: netInfo?.effectiveType || netInfo?.type || "unknown",
                appState: typeof document !== "undefined" ? document.visibilityState : "visible",
                screenInteractive: typeof screenInteractive === "boolean" ? screenInteractive : (typeof document !== "undefined" ? document.visibilityState === "visible" : null),
                screenOnMs: visibleMs,
                sessionStartedAt: new Date(screenSessionStartedAtRef.current).toISOString(),
                recentApp: recentAppPackage || "혜니캘린더 (앱 외 사용기록은 OS 권한 필요)",
                usagePermission,
                ...nativeRemoteListenHealth,
                deviceLabel: getDeviceLabelFromUA(),
                source: "webview-session",
            };
        };

        const publish = async () => {
            const channel = realtimeChannel.current;
            if (!channel || channel.state !== "joined") return;
            const payload = await buildPayload();
            try {
                channel.send({ type: "broadcast", event: "child_device_status", payload });
            } catch (error) {
                console.warn("[DeviceStatus] broadcast failed:", error?.message || error);
            }
        };
        publishChildDeviceStatusRef.current = publish;

        const onVisibilityChange = () => {
            const now = Date.now();
            if (document.visibilityState === "visible") {
                lastVisibleAtRef.current = now;
            } else if (lastVisibleAtRef.current) {
                screenSessionVisibleMsRef.current += Math.max(0, now - lastVisibleAtRef.current);
                lastVisibleAtRef.current = null;
            }
            void publish();
        };

        void publish();
        const timer = setInterval(() => { void publish(); }, 60_000);
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", onVisibilityChange);
        }
        return () => {
            clearInterval(timer);
            if (typeof document !== "undefined") {
                document.removeEventListener("visibilitychange", onVisibilityChange);
            }
            publishChildDeviceStatusRef.current = async () => {};
        };
    }, [isParent, familyId, authUser?.id, nativeNotifHealth, bgLocationGranted]);

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
    const openConfirmDialog = useCallback((options = {}) => {
        setConfirmDialog({
            title: options.title || "확인",
            message: options.message || "계속 진행할까요?",
            confirmLabel: options.confirmLabel || "확인",
            cancelLabel: options.cancelLabel || "취소",
            tone: options.tone || "default",
            icon: options.icon || "",
            onConfirm: typeof options.onConfirm === "function" ? options.onConfirm : null,
        });
    }, []);
    const closeConfirmDialog = useCallback(() => {
        setConfirmDialog(null);
    }, []);
    const handleConfirmDialogConfirm = useCallback(async () => {
        const action = confirmDialog?.onConfirm;
        setConfirmDialog(null);
        if (!action) return;
        try {
            await action();
        } catch (err) {
            console.error("[confirm-dialog]", err);
        }
    }, [confirmDialog]);

    const requestChildLocationRefresh = useCallback(async (reason = "parent_lookup") => {
        if (myRole !== "parent" || !familyId) return false;
        if (!parentCapabilities.canRequestChildLocation) {
            showNotif("아이 제어는 구독한 보호자만 사용할 수 있어요.", "error");
            return false;
        }
        const requestedAt = Date.now();
        setLocationRefreshRequestedAt(requestedAt);

        const requestId = generateUUID();
        const targetPayload = buildSelectedChildCommandPayload({ selectedChild });
        const targetUserId = targetPayload.targetUserId || null;
        const payload = {
            requestId,
            familyId,
            requesterId: authUser?.id || null,
            targetRole: "child",
            reason,
            requestedAt: new Date(requestedAt).toISOString(),
            ...targetPayload,
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

        const refreshLocationTrail = async () => {
            if (!showChildTracker) return;
            try {
                const rows = await fetchTodayLocationHistory(familyId, targetUserId);
                setLocationTrail(Array.isArray(rows) ? rows : []);
            } catch (err) {
                console.warn("[GPS] location trail refresh failed:", err);
            }
        };

        const applyFetchedLocations = (locs) => {
            if (!locs?.length) return false;
                const scopedLocations = targetUserId
                    ? locs.filter((loc) => loc?.user_id === targetUserId)
                    : locs;
                if (!scopedLocations.length) return false;
                const latest = scopedLocations.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
                setChildPos({ user_id: latest.user_id, userId: latest.user_id, lat: latest.lat, lng: latest.lng, updatedAt: latest.updated_at, updated_at: latest.updated_at });
                const members = familyInfoRef.current?.members?.filter((m) => m.role === "child") || [];
                const positions = locs.map((loc) => {
                    const member = members.find((c) => c.user_id === loc.user_id);
                    return {
                        user_id: loc.user_id,
                        name: member?.name || "아이",
                        emoji: member?.emoji || "🐰",
                        photo_url: member?.photo_url || null,
                        lat: loc.lat,
                        lng: loc.lng,
                        updatedAt: loc.updated_at,
                    };
                });
                setAllChildPositions(positions);
            const latestMs = new Date(latest.updated_at).getTime();
            if (Number.isFinite(latestMs) && latestMs >= requestedAt) {
                setLocationRefreshRequestedAt(prev => (prev === requestedAt || (prev && latestMs >= prev) ? null : prev));
                return true;
            }
            return false;
        };

        const fetchLatestLocations = () => fetchChildLocations(familyId)
            .then(applyFetchedLocations)
            .catch((err) => console.warn("[GPS] immediate refetch failed:", err));

        // Surface last-known DB position immediately so the UI updates the moment
        // the parent taps refresh, instead of waiting for the child's broadcast.
        // Then poll briefly because the child may save the fresh GPS fix a few
        // seconds after the request push/broadcast is delivered.
        const fetchPromise = fetchLatestLocations();

        const pollFreshLocation = async () => {
            for (let attempt = 0; attempt < 8; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 1200));
                const isFresh = await fetchLatestLocations();
                await refreshLocationTrail();
                if (isFresh) return true;
            }
            return false;
        };

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
            await Promise.all([pushPromise, fetchPromise]);
            void pollFreshLocation();
            return sent;
        } catch (error) {
            console.error("[GPS] location_refresh_request failed:", error);
            await pushPromise;
            await fetchPromise.catch(() => {});
            void pollFreshLocation();
            return false;
        }
    }, [authUser?.id, familyId, myRole, selectedChild, showChildTracker, parentCapabilities.canRequestChildLocation, showNotif]);

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
        if (kkukCooldown || !authUser) return;
        if (!familyId) {
            showNotif("가족 연동 후 사용할 수 있어요");
            return;
        }
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
        if (senderRole === "child") {
            const senderMember = familyInfo?.members?.find(member => member.user_id === authUser.id);
            kkukPayload.senderEmoji = senderMember?.emoji || "👧";
        }

        // Local UX feedback fires immediately — kkukCooldown above already
        // prevents rapid re-taps. The server-side RPC below can still veto
        // the send, in which case we silently drop without user-facing noise.
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        showNotif("💗 꾹을 보냈어요!");

        if (isParent) {
            const startedAt = Date.now();
            void requestChildLocationRefresh();
            const t1 = setTimeout(() => { void requestChildLocationRefresh(); }, 2 * 60_000);
            const t2 = setTimeout(() => {
                const lastUpdate = new Date(childPosRef.current?.updatedAt || childPosRef.current?.updated_at || 0).getTime();
                if (!Number.isFinite(lastUpdate) || lastUpdate < startedAt) {
                    addAlert("🚨 SOS 후 5분 경과: 아이 위치 갱신이 아직 없어요. 즉시 확인해 주세요.", "emergency");
                    sendInstantPush({
                        action: "parent_alert",
                        familyId,
                        senderUserId: authUser.id,
                        severity: "critical",
                        alertType: "sos_followup",
                        title: "🚨 SOS 자동 후속 알림",
                        message: "SOS 후 위치 갱신이 없어 추가 확인이 필요해요.",
                    });
                }
            }, 5 * 60_000);
            sosAutoTimersRef.current.push(t1, t2);
            if (sosAutoTimersRef.current.length > 20) {
                const stale = sosAutoTimersRef.current.splice(0, sosAutoTimersRef.current.length - 20);
                stale.forEach(timerId => clearTimeout(timerId));
            }
        }

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
            showParentMemoPage, showChildMemoPage,
            showAcademyMgr, showSavedPlaceMgr, showPhoneSettings, showFeedbackModal, showParentSetup, showMicPermissionHelp, editingLocForEvent,
            voicePreview, activeView, showPairing, showAlertPanel,
        };
    });
    useEffect(() => {
        let handle;
        (async () => {
            try {
                const { App: CapApp } = await import("@capacitor/app");
                handle = await CapApp.addListener("backButton", () => {
                    // Screen-local handlers (e.g. PairingWizard step-back, ParentAuthScreen
                    // codeSent → form → mode-switch) get first crack via the registered stack.
                    if (dispatchBack()) return;
                    const s = backStateRef.current;
                    if (s.routeEvent)          { setRouteEvent(null);           return; }
                    if (s.showChildTracker)    { setShowChildTracker(false);    return; }
                    if (s.showMapPicker)       { setShowMapPicker(false);       return; }
                    if (s.showAddModal)        { setShowAddModal(false);        return; }
                    if (s.showParentMemoPage)  { setShowParentMemoPage(false);  return; }
                    if (s.showChildMemoPage)   { setShowChildMemoPage(false);   return; }
                    if (s.showAcademyMgr)      { setShowAcademyMgr(false);      return; }
                    if (s.showSavedPlaceMgr)   { setShowSavedPlaceMgr(false);   return; }
                    if (s.showAlertPanel)      { setShowAlertPanel(false);      return; }
                    if (s.showPhoneSettings)   { setShowPhoneSettings(false);   return; }
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
    const childSafetySetupSteps = getChildSafetySetupSteps(nativeNotifHealth, bgLocationGranted);
    const childSafetySetupBlocked = isNativeApp
        && !isParent
        && !!familyId
        && !!nativeNotifHealth
        && childSafetySetupSteps.some(step => !step.ready);
    // When every step turns ready, clear the dismissal flag so a future
    // permission revoke (user disables mic in Settings, etc) re-opens the
    // wizard instead of staying silently dismissed forever.
    useEffect(() => {
        if (!childSafetySetupBlocked && permissionWizardDismissed) {
            setPermissionWizardDismissed(false);
        }
    }, [childSafetySetupBlocked, permissionWizardDismissed]);

    const openChildSafetySetupStep = useCallback(async (step) => {
        if (!step) return;
        try {
            // 1) Try in-app permission prompt first for OS-level RUNTIME permissions.
            //    Falls through to Settings only if the system already marked
            //    the permission "don't ask again" or the plugin is unavailable.
            if (step.id === "microphone") {
                const res = await requestNativePermission("microphone");
                if (res?.granted || res?.requested) {
                    setTimeout(() => { void refreshNativeReadiness(); }, 1200);
                    return;
                }
                await openNativeNotificationSettings({ target: "appDetails" });
            } else if (step.id === "notifications") {
                const res = await requestNativePermission("notifications");
                if (res?.granted || res?.requested) {
                    setTimeout(() => { void refreshNativeReadiness(); }, 1200);
                    return;
                }
                await openNativeNotificationSettings(step);
            } else if (step.target === "appLocation") {
                const { Capacitor, registerPlugin } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const BgLoc = registerPlugin("BackgroundLocation");
                    await BgLoc.openAppLocationSettings();
                }
            } else if (step.target === "locationService") {
                const session = await getSession().catch(() => null);
                await startNativeLocationService(
                    authUser?.id,
                    familyId,
                    session?.access_token || "",
                    myRole || "child"
                );
            } else {
                await openNativeNotificationSettings(step);
            }
            setTimeout(() => { void refreshNativeReadiness(); }, 900);
        } catch (error) {
            console.warn("[child-safety-setup] open step failed:", error?.message || error);
            showNotif("설정을 열지 못했어요. Android 앱 설정에서 직접 허용해주세요.", "error");
        }
    }, [authUser?.id, familyId, myRole, refreshNativeReadiness, showNotif]);

    // 일괄 허용: 미허용 단계를 순차적으로 처리한다. OS 시스템 다이얼로그는
    // 현재 액티비티에서만 한 번에 한 개 표시 가능하므로 직렬로 진행하고,
    // 각 단계 사이에 잠깐의 텀(1.5s)을 두어 health 갱신이 반영되도록 한다.
    const runAllChildSafetySteps = useCallback(async () => {
        for (const step of childSafetySetupSteps) {
            if (step.ready) continue;
            await openChildSafetySetupStep(step);
            await new Promise(r => setTimeout(r, 1500));
        }
        setTimeout(() => { void refreshNativeReadiness(); }, 800);
    }, [childSafetySetupSteps, openChildSafetySetupStep, refreshNativeReadiness]);

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
        let lastHistoryPoint = null;
        let lastSave = 0;

        const applyPosition = (p) => {
            const newPos = {
                user_id: authUser.id,
                userId: authUser.id,
                family_id: familyId,
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
                updatedAt: new Date().toISOString(),
            };
            newPos.updated_at = newPos.updatedAt;
            setChildPos(newPos);
            if (realtimeChannel.current && realtimeChannel.current.state === "joined") {
                realtimeChannel.current.send({ type: "broadcast", event: "child_location", payload: newPos });
            }
            const now = Date.now();
            if (now - lastSave >= 10000) {
                lastSave = now;
                saveChildLocation(authUser.id, familyId, newPos.lat, newPos.lng);
            }
            const historyMovedM = lastHistoryPoint
                ? haversineM(newPos.lat, newPos.lng, lastHistoryPoint.lat, lastHistoryPoint.lng)
                : Infinity;
            if (!lastHistoryPoint || historyMovedM >= LOCATION_HISTORY_MIN_DISTANCE_M || now - lastHistorySave >= LOCATION_HISTORY_MAX_AGE_MS) {
                lastHistorySave = now;
                lastHistoryPoint = { lat: newPos.lat, lng: newPos.lng };
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
                setChildPos({ user_id: latest.user_id, userId: latest.user_id, lat: latest.lat, lng: latest.lng, updatedAt: latest.updated_at, updated_at: latest.updated_at });
                const latestMs = new Date(latest.updated_at).getTime();
                if (Number.isFinite(latestMs)) {
                    setLocationRefreshRequestedAt(prev => (prev && latestMs >= prev ? null : prev));
                }
                const positions = locs.map(loc => {
                    const member = children.find(c => c.user_id === loc.user_id);
                    return { user_id: loc.user_id, name: member?.name || "아이", emoji: member?.emoji || "🐰", photo_url: member?.photo_url || null, lat: loc.lat, lng: loc.lng, updatedAt: loc.updated_at };
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
                if (!cancelled) setLocationTrail(Array.isArray(rows) ? rows : []);
            }).catch(err => console.error("[fetchTodayLocationHistory] failed:", err));
        };
        load();
        const iv = setInterval(load, 30000);
        return () => { cancelled = true; clearInterval(iv); };
    }, [myRole, familyId, showChildTracker]);

    // ── Parent: selected calendar date movement summary ───────────────────────
    useEffect(() => {
        const targetUserId = selectedChild?.user_id || null;
        if (myRole !== "parent" || !familyId || !targetUserId) {
            setSelectedDateLocationTrail([]);
            setSelectedDateTrailLoading(false);
            setSelectedDateTrailError("");
            return undefined;
        }

        let cancelled = false;
        setSelectedDateTrailLoading(true);
        setSelectedDateTrailError("");
        fetchLocationHistoryForDate(familyId, targetUserId, { year: currentYear, month: currentMonth, day: selectedDate })
            .then(rows => {
                if (cancelled) return;
                setSelectedDateLocationTrail(Array.isArray(rows) ? rows : []);
            })
            .catch(err => {
                if (cancelled) return;
                console.error("[fetchLocationHistoryForDate] failed:", err);
                setSelectedDateLocationTrail([]);
                setSelectedDateTrailError("이동기록을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.");
            })
            .finally(() => {
                if (!cancelled) setSelectedDateTrailLoading(false);
            });

        return () => { cancelled = true; };
    }, [myRole, familyId, selectedChild?.user_id, currentYear, currentMonth, selectedDate]);

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
                const childName = selectedChild?.name || familyInfo?.members?.find(m => m.role === "child")?.name || "아이";
                addAlert(`⚠️ ${childName}님이 위험지역 '${zone.name}' 근처에 있어요! (${Math.round(dist)}m)`, "parent");
                sendInstantPush({
                    action: "parent_alert", familyId, senderUserId: authUser?.id,
                    severity: "emergency",
                    alertType: "danger_zone",
                    title: `⚠️ 위험지역 접근 알림`,
                    message: `${childName}님이 '${zone.name}' 근처(${Math.round(dist)}m)에 있어요!`,
                });
            } else if (!isInside && wasFired && dist > zone.radius_m * 1.5) {
                // 충분히 벗어남 → 알림 플래그 초기화 (재진입 시 다시 알림)
                setFiredDangerAlerts(prev => { const n = new Set(prev); n.delete(zone.id); return n; });
            }
        });
    }, [childPos, dangerZones, firedDangerAlerts, isParent, familyInfo, familyId, authUser, addAlert, selectedChild?.name]);

    // ── Academy focus guard mode (parent) ─────────────────────────────────────
    useEffect(() => {
        if (!isParent) return;
        const focusChild = selectedChild || pairedChildren[0] || null;
        const childId = focusChild?.user_id;
        if (!childId) return;
        const status = childDeviceStatusMap[childId];
        if (!status) return;

        const now = new Date();
        const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const todaySchoolEvents = (visibleEvents[key] || []).filter(ev => {
            if (ev.category !== "school") return false;
            const [sh, sm] = String(ev.time || "00:00").split(":").map(Number);
            const [eh, em] = String(ev.endTime || ev.time || "00:00").split(":").map(Number);
            const startMin = sh * 60 + sm;
            const endMin = Number.isFinite(eh) && Number.isFinite(em) ? (eh * 60 + em) : startMin + 60;
            return nowMin >= startMin && nowMin <= endMin;
        });
        if (todaySchoolEvents.length === 0) return;

        const isPotentialDistraction = status.appState === "visible" && Number(status.screenOnMs || 0) >= 15 * 60 * 1000;
        if (!isPotentialDistraction) return;

        todaySchoolEvents.forEach(ev => {
            const guardKey = `${childId}:${key}:${ev.id || ev.title}`;
            if (academyFocusAlertedRef.current.has(guardKey)) return;
            academyFocusAlertedRef.current.add(guardKey);
            const childName = focusChild?.name || "아이";
            addAlert(`📵 ${childName}의 ${ev.title} 시간대에 화면 사용이 길어요. 집중모드를 확인해 주세요.`, "parent");
            sendInstantPush({
                action: "parent_alert",
                familyId,
                senderUserId: authUser?.id,
                severity: "warning",
                alertType: "academy_focus",
                title: "📵 학원 시간대 보호모드 알림",
                message: `${childName}의 ${ev.title} 시간대 화면 사용이 길어요.`,
            });
        });
    }, [isParent, pairedChildren, selectedChild, childDeviceStatusMap, visibleEvents, familyId, authUser?.id, addAlert]);

    // ── Geofencing: arrival + departure detection ───────────────────────────────
    useEffect(() => {
        if (!childPos) return;
        const iv = setInterval(() => {
            // Anchor the arrival/departure clock to the child's GPS fix time
            // (server-stamped via upsert_child_location RPC), NOT the device's
            // local now(). Using parent local time misclassifies early/on-time/
            // late when parent + child clocks drift, and writes the wrong day
            // key when the child is in a different timezone.
            const fixIso = childPos?.updatedAt || childPos?.updated_at;
            const fixTime = fixIso ? new Date(fixIso) : new Date();
            const refMs = Number.isFinite(fixTime.getTime()) ? fixTime.getTime() : Date.now();
            const ref = new Date(refMs);
            const key = `${ref.getFullYear()}-${ref.getMonth()}-${ref.getDate()}`;
            (events[key] || []).forEach(ev => {
                if (!ev.location) return;
                const dist = haversineM(childPos.lat, childPos.lng, ev.location.lat, ev.location.lng);
                const inside = dist <= ARRIVAL_R;

                // ── Arrival detection (only 30min before ~ event time) ──
                if (inside && !arrivedSet.has(ev.id)) {
                    if (typeof ev.time !== "string") return;
                    const [h, m] = ev.time.split(":").map(Number);
                    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
                    const evTime = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), h, m).getTime();
                    const diff = Math.round((refMs - evTime) / 60000);
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
                            leftAt: refMs,
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
        return () => {
            clearInterval(iv);
            // Cancel all pending departure setTimeout callbacks. Without this,
            // a timer scheduled when the user is on the home screen can still
            // fire setDepartedAlerts / sendInstantPush after the screen
            // unmounts (logout, family switch, child unpair).
            const timers = departureTimers.current;
            for (const id of Object.keys(timers)) {
                try { clearTimeout(timers[id].timer); } catch { /* ignore */ }
                delete timers[id];
            }
        };
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
                if (typeof ev.time !== "string") return;
                const [h, m] = ev.time.split(":").map(Number);
                if (!Number.isFinite(h) || !Number.isFinite(m)) return;
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
                if (typeof ev.time !== "string") return;
                const [h, m] = ev.time.split(":").map(Number);
                if (!Number.isFinite(h) || !Number.isFinite(m)) return;
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
                    p_title: "활동 리포트: " + result.title,
                    p_message: result.message,
                    p_severity: result.severity || "info",
                });
                if (!error) loadParentAlerts();
            }
        } catch (err) { console.warn("[AI memo analysis]", err.message); }
    };

    // ── Activity analysis settings toggle ───────────────────────────────────
    const toggleAiEnabled = (val) => {
        setAiEnabled(val);
        try { localStorage.setItem("hyeni-ai-enabled", val ? "true" : "false"); } catch { /* ignored */ }
    };

    const getDefaultEventChildSelection = () => {
        const childId = isParent
            ? (selectedChildId || (pairedChildren.length === 1 ? pairedChildren[0]?.id : null))
            : myFamilyMemberId;
        return childId ? { childIds: [childId], familyAll: false } : { childIds: [], familyAll: false };
    };

    const getEffectiveEventChildSelection = (selection = eventChildSelection) => {
        if (selection?.familyAll || (Array.isArray(selection?.childIds) && selection.childIds.length > 0)) {
            return {
                childIds: Array.isArray(selection.childIds) ? selection.childIds.filter(Boolean) : [],
                familyAll: !!selection.familyAll,
            };
        }
        return getDefaultEventChildSelection();
    };

    const getEventScopeFromSelection = (selection) => ({
        is_family_event: !!selection?.familyAll,
        child_ids: selection?.familyAll ? [] : [...(selection?.childIds || [])],
    });

    const openAiSchedule = () => {
        if (isParent && !parentCapabilities.canWriteSchedule) {
            showNotif("보조 보호자는 일정을 확인만 할 수 있어요.", "error");
            return;
        }
        if (!entitlement.canUse(FEATURES.AI_ANALYSIS)) {
            openFeatureLock(FEATURES.AI_ANALYSIS);
            return;
        }
        const nextSelection = getEffectiveEventChildSelection();
        if (isParent && !nextSelection.familyAll && nextSelection.childIds.length === 0) {
            showNotif("일정을 받을 아이를 먼저 선택해 주세요.", "error");
            return;
        }
        setEventChildSelection(nextSelection);
        setShowAiSchedule(true);
    };

    // ── Process structured/regex result → create event or add memo ───────────
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
                if (typeof ev.time !== "string") return false;
                const [h, m] = ev.time.split(":").map(Number);
                if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
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
            if (isParent && !parentCapabilities.canWriteSchedule) {
                showNotif("보조 보호자는 일정을 확인만 할 수 있어요.", "error");
                return;
            }
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
        if (isParent && !parentCapabilities.canWriteSchedule) {
            showNotif("보조 보호자는 일정을 확인만 할 수 있어요.", "error");
            return;
        }
        const matchedAcademy = parsed.academyName
            ? academies.find(a => a.name === parsed.academyName) : null;
        const catId = parsed.category || "other";
        const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES.find(c => c.id === "other");
        const evYear = parsed.year ?? currentYear;
        const evMonth = parsed.month ?? currentMonth;
        const evDay = parsed.day ?? selectedDate;
        const dk = `${evYear}-${evMonth}-${evDay}`;
        const timeStr = parsed.time || fmtT(new Date());
        const voiceEventSelection = getEffectiveEventChildSelection();
        if (isParent && !voiceEventSelection.familyAll && voiceEventSelection.childIds.length === 0) {
            showNotif("일정을 받을 아이를 먼저 선택해 주세요.", "error");
            return;
        }
        const voiceEventScope = getEventScopeFromSelection(voiceEventSelection);

        const ev = {
            id: generateUUID(), title: parsed.title, time: timeStr,
            category: catId, emoji: matchedAcademy?.emoji || cat.emoji,
            color: cat.color, bg: cat.bg, memo: parsed.memo || "",
            location: matchedAcademy?.location || null, notifOverride: null,
            ...voiceEventScope,
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
                if (voiceEventSelection.familyAll || voiceEventSelection.childIds.length > 0) {
                    await saveEventWithChildren({ ...ev, dateKey: dk, familyId, userId: authUser.id }, voiceEventSelection);
                } else {
                    await insertEvent(ev, familyId, dk, authUser.id);
                }
                maybeOpenTrialInvite();
                sendInstantPush({
                    action: "new_event", familyId, senderUserId: authUser.id,
                    title: `새 일정: ${ev.emoji} ${parsed.title}`,
                    message: `${dateLabel} ${ev.time}에 "${parsed.title}" 일정이 추가됐어요`,
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

        // Try structured parsing first (if enabled), fall back to regex
        let parsed;
        if (aiEnabled) {
            showNotif("일정을 정리하고 있어요...");
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

    // ── Open edit modal: pre-populate fields with existing event ───────────────
    const openEditEventModal = (event) => {
        if (!event) return;
        if (isParent && !parentCapabilities.canWriteSchedule) {
            showNotif("보조 보호자는 일정을 확인만 할 수 있어요.", "error");
            return;
        }
        setEditingEventId(event.id);
        setNewTitle(event.title || "");
        setNewTime(event.time || "09:00");
        setNewEndTime(event.endTime || "");
        setNewCategory(event.category || "school");
        setNewMemo(event.memo || "");
        setNewLocation(event.location || null);
        setSelectedPreset(null);
        setWeeklyRepeat(false);
        setRepeatWeeks(4);
        setShowAddModal(true);
    };

    // ── Add or update event (manual) ───────────────────────────────────────────
    const addEvent = async () => {
        if (isParent && !parentCapabilities.canWriteSchedule) {
            showNotif("보조 보호자는 일정을 확인만 할 수 있어요.", "error");
            return;
        }
        const title = newTitle.trim() || (selectedPreset ? selectedPreset.label : "");
        if (!title) { showNotif("일정 이름을 입력해 줘요! 🐰", "error"); return; }
        const cat = CATEGORIES.find(c => c.id === newCategory);
        const emoji = selectedPreset ? selectedPreset.emoji : cat.emoji;

        // Edit mode: update single existing event in place.
        if (editingEventId) {
            const patch = {
                title,
                time: newTime,
                endTime: newEndTime || null,
                category: newCategory,
                emoji,
                color: cat.color,
                bg: cat.bg,
                memo: newMemo.trim(),
                location: newLocation,
            };
            // Synchronous scan: capture dateKey + previous snapshot for revert.
            let foundDateKey = null;
            let previousEvent = null;
            for (const dk of Object.keys(events)) {
                const found = (events[dk] || []).find(e => e.id === editingEventId);
                if (found) {
                    foundDateKey = dk;
                    previousEvent = found;
                    break;
                }
            }
            // Optimistic update.
            setEvents(prev => {
                if (!foundDateKey) return prev;
                const updated = { ...prev };
                const next = (updated[foundDateKey] || []).map(e =>
                    e.id === editingEventId ? { ...e, ...patch } : e
                );
                updated[foundDateKey] = next.sort((a, b) => a.time.localeCompare(b.time));
                return updated;
            });
            const targetId = editingEventId;
            const messageDateKey = foundDateKey || dateKey;
            setEditingEventId(null);
            setNewTitle(""); setNewTime("09:00"); setNewEndTime(""); setNewCategory("school"); setNewMemo(""); setNewLocation(null); setSelectedPreset(null); setWeeklyRepeat(false); setRepeatWeeks(4);
            setShowAddModal(false);
            showNotif("✅ 일정이 수정됐어요!");

            if (familyId && authUser) {
                try {
                    await updateEvent(targetId, patch);
                    sendInstantPush({
                        action: "edit_event",
                        familyId,
                        senderUserId: authUser.id,
                        title: `✏️ 일정 수정: ${emoji} ${title}`,
                        message: `${messageDateKey.replace(/-/g, "/")} ${newTime} "${title}"로 수정됐어요`,
                    });
                } catch (err) {
                    console.error("[updateEvent] Supabase error:", err);
                    // Revert optimistic update with previous snapshot.
                    if (foundDateKey && previousEvent) {
                        setEvents(prev => {
                            const reverted = { ...prev };
                            const next = (reverted[foundDateKey] || []).map(e =>
                                e.id === targetId ? previousEvent : e
                            );
                            reverted[foundDateKey] = next.sort((a, b) => a.time.localeCompare(b.time));
                            return reverted;
                        });
                    }
                    showNotif("서버 저장에 실패했어요. 다시 시도해주세요", "error");
                }
            }
            return;
        }

        const totalWeeks = weeklyRepeat ? repeatWeeks : 1;
        const allEvents = [];
        const optimisticEventScope = {
            is_family_event: !!eventChildSelection.familyAll,
            child_ids: eventChildSelection.familyAll ? [] : [...(eventChildSelection.childIds || [])],
        };
        for (let w = 0; w < totalWeeks; w++) {
            const dk = w === 0 ? dateKey : addDaysToDateKey(dateKey, w * 7);
            allEvents.push({ ev: { id: generateUUID(), title, time: newTime, endTime: newEndTime || null, category: newCategory, emoji, color: cat.color, bg: cat.bg, memo: newMemo.trim(), location: newLocation, notifOverride: null, ...optimisticEventScope }, dateKey: dk });
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
                    await saveEventWithChildren({ ...ev, dateKey: dk, familyId, userId: authUser.id }, eventChildSelection);
                }
                setEventChildSelection({ childIds: [], familyAll: false });
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
        if (isParent && !parentCapabilities.canWriteSchedule) {
            showNotif("보조 보호자는 일정을 확인만 할 수 있어요.", "error");
            return;
        }
        setEvents(prev => ({ ...prev, [dateKey]: (prev[dateKey] || []).filter(e => e.id !== id) }));
        showNotif("🗑️ 일정을 지웠어요");
        if (familyId) {
            try { await dbDeleteEvent(id); } catch (err) { console.error("[deleteEvent]", err); }
        }
    };

    const updateEvField = async (id, field, value) => {
        if (isParent && !parentCapabilities.canWriteSchedule) {
            showNotif("보조 보호자는 일정을 확인만 할 수 있어요.", "error");
            return;
        }
        setEvents(prev => { const out = {}; Object.entries(prev).forEach(([k, evs]) => { out[k] = evs.map(e => e.id === id ? { ...e, [field]: value } : e); }); return out; });
        if (familyId) {
            try { await updateEvent(id, { [field]: value }); } catch (err) { console.error("[updateEvField]", err); }
        }
    };

    const prevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); };
    const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); };
    const getDays = getDIM(currentYear, currentMonth);
    const firstDay = getFD(currentYear, currentMonth);
    const getEvs = (d) => visibleEvents[`${currentYear}-${currentMonth}-${d}`] || [];
    const selectedEvs = visibleEvents[dateKey] || [];

    // CSS helpers
    const contentMaxWidth = isParent ? 720 : 460;
    const inputSt = makeInputStyle();
    const labelSt = { fontSize: 12, fontWeight: 800, color: DESIGN.colors.muted, marginBottom: 6, display: "block" };
    const cardSt = makeCardStyle({ width: "100%", maxWidth: contentMaxWidth, padding: 20, marginBottom: 14 });
    const primBtn = makePrimaryButtonStyle({ marginTop: 16 });
    const secBtn = makeSecondaryButtonStyle({ marginTop: 8, background: "var(--bg-subtle)" });
    const todayDateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const todayEvents = visibleEvents[todayDateKey] || [];
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
    const homeSavedPlace = findHomeSavedPlace(savedPlaces);
    const homeRouteEvent = buildHomeRouteEvent(homeSavedPlace);
    const selectedChildDisplayName = isParent && selectedChild?.name ? selectedChild.name : "";
    const heroChildrenText = selectedChildDisplayName
        ? selectedChildDisplayName
        : pairedChildren.length > 0
        ? pairedChildren.map(child => child.name || "아이").join(" · ")
        : (familyInfo?.myName || "가족");
    const parentHeroChildrenText = selectedChildDisplayName
        ? selectedChildDisplayName
        : pairedChildren.length > 2
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
            // Surface the freemium delay so a parent doesn't mistake a stale
            // marker for a real-time fix. Set by effectiveChildLocation when
            // the family lacks REALTIME_LOCATION entitlement.
            childPos.isDelayed ? "지연 표시 (프리미엄 시 실시간)" : "",
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
    const handleHomeRouteClick = () => {
        if (!homeRouteEvent) {
            showNotif("집 위치가 아직 없어요. 부모님 모드에서 자주 가는 장소에 '집'을 등록해 주세요.", "error");
            return;
        }
        setRouteEvent(homeRouteEvent);
    };
    const schedulePlaceOptions = useMemo(
        () => buildSchedulePlaceOptions(academies, savedPlaces),
        [academies, savedPlaces]
    );
    const closeParentManagementPanels = useCallback(() => {
        setShowAcademyMgr(false);
        setShowSavedPlaceMgr(false);
        setShowDangerZones(false);
    }, []);
    const handleParentCalendarTabClick = () => {
        closeParentManagementPanels();
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
        closeParentManagementPanels();
        setShowParentMemoPage(false);
        setActiveView("calendar");
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "auto" });
        });
    };
    const handleParentMapTabClick = () => {
        setShowParentMemoPage(false);
        setShowSavedPlaceMgr(false);
        setShowDangerZones(false);
        openAcademyManagement();
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "auto" });
        });
    };
    const handleParentMemoOpen = () => {
        closeParentManagementPanels();
        setCurrentYear(today.getFullYear());
        setCurrentMonth(today.getMonth());
        setSelectedDate(today.getDate());
        setShowParentMemoPage(true);
        // Immediate refetch: Realtime may have missed INSERTs while the app was
        // backgrounded (FCM arrived but WebSocket was disconnected). Use today's
        // key directly because setSelectedDate above hasn't propagated yet.
        if (familyId) {
            const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
            fetchMemoReplies(familyId, todayKey)
                .then(setMemoReplies)
                .catch((err) => console.warn("[memo] open refetch failed:", err));
        }
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "auto" });
        });
    };
    const handleChildMemoOpen = () => {
        setCurrentYear(today.getFullYear());
        setCurrentMonth(today.getMonth());
        setSelectedDate(today.getDate());
        setShowChildMemoPage(true);
        if (familyId) {
            const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
            fetchMemoReplies(familyId, todayKey)
                .then(setMemoReplies)
                .catch((err) => console.warn("[memo] open refetch failed:", err));
        }
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "auto" });
        });
    };
    const handleParentFamilyTabClick = () => {
        closeParentManagementPanels();
        setShowParentMemoPage(false);
        if (familyId) setShowPairing(true);
        else setShowParentSetup(true);
    };
    const handleParentHomeTabClick = () => {
        closeParentManagementPanels();
        setShowParentMemoPage(false);
        setActiveView("home");
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "auto" });
        });
    };
    // Tab guards for multi-child parents: per-child tabs (today / 일정 / 장소 /
    // 메모) need a chosen child first. Family tab is intentionally exempt so
    // the parent can manage pairings before any child is selected.
    const requireSelectedChildOrHint = (action, label) => () => {
        if (isParent && isMultiChild && !selectedChildId) {
            setMultiChildHint(`${label}은 아이별로 확인할 수 있어요. 홈에서 아이를 먼저 선택해 주세요.`);
            return;
        }
        action?.();
    };
    const homeChildLocationLabels = useMemo(() => {
        const labels = {};
        displayChildPositions.forEach((pos) => {
            if (!pos?.user_id) return;
            const locationKey = getPositionLocationKey(pos);
            const resolved = childLocationLabels[locationKey] || {};
            const label = resolved.label
                || resolved.shortLabel
                || extractNeighborhoodLabel(pos.label, pos)
                || formatLatLngLabel(pos)
                || "";
            if (!label) return;
            labels[pos.user_id] = {
                ...resolved,
                label,
                shortLabel: resolved.shortLabel || extractNeighborhoodLabel(label, pos) || label,
            };
        });
        return labels;
    }, [childLocationLabels, displayChildPositions]);
    const parentBottomTabCount = (isMultiChild ? 1 : 0)
        + 2
        + (parentCapabilities.canManagePlaces ? 1 : 0)
        + 2;
    const renderParentBottomTabbar = (activeTab = "today", extraClassName = "") => (
        <nav
            className={`hyeni-v5-tabbar${extraClassName ? ` ${extraClassName}` : ""}`}
            aria-label="부모 메인 탭"
            style={{ gridTemplateColumns: `repeat(${parentBottomTabCount}, minmax(0, 1fr))` }}
        >
            {isMultiChild && (
              <button
                type="button"
                onClick={handleParentHomeTabClick}
                aria-pressed={activeTab === "home"}
                className={activeTab === "home" ? "active" : undefined}
                style={{ fontFamily: FF }}
              >
                <span aria-hidden="true">🏡</span>홈
              </button>
            )}
            <button type="button" className={activeTab === "today" ? "active" : undefined} onClick={handleParentTodayTabClick} style={{ fontFamily: FF }}>
                <span aria-hidden="true">☀️</span>오늘
            </button>
            <button type="button" className={activeTab === "calendar" ? "active" : undefined} onClick={requireSelectedChildOrHint(handleParentCalendarTabClick, "일정 보기")} style={{ fontFamily: FF }}>
                <span aria-hidden="true">📅</span>일정
            </button>
            {parentCapabilities.canManagePlaces && (
                <button type="button" className={activeTab === "maplist" ? "active" : undefined} onClick={requireSelectedChildOrHint(handleParentMapTabClick, "장소 관리")} style={{ fontFamily: FF }}>
                    <span aria-hidden="true">📍</span>장소관리
                </button>
            )}
            <button
                type="button"
                className={activeTab === "memo" ? "active" : undefined}
                onClick={requireSelectedChildOrHint(handleParentMemoOpen, "메모")}
                style={{ fontFamily: FF }}
            >
                <span aria-hidden="true">💬</span>메모
            </button>
            <button type="button" className={activeTab === "family" ? "active" : undefined} onClick={handleParentFamilyTabClick} style={{ fontFamily: FF }}>
                <span aria-hidden="true">👨‍👩‍👧</span>가족
            </button>
        </nav>
    );
    // Multi-child families: once a child is picked from Home, every per-child
    // surface (status card, device safety, location, walking trail) operates
    // ONLY on that child. Without this narrowing the calendar/device sections
    // kept iterating both children even after selection, so the parent saw
    // mixed data ("아이1과 아이2가 뒤섞여서 직선만 표시").
    const dashboardChildren = (() => {
        if (isParent && isMultiChild && selectedChild) return [selectedChild];
        if (pairedChildren.length > 0) return pairedChildren.slice(0, 2);
        return [{ user_id: "pending-child", name: "아이", emoji: "👧" }];
    })();
    const primaryChildUserId = dashboardChildren[0]?.user_id || null;
    const pairedChildIds = pairedChildren.map(child => child.user_id).filter(Boolean);
    const pairedChildIdsKey = pairedChildIds.join(",");
    const dashboardDeviceStatusEntry = dashboardChildren
        .map(child => ({ child, status: child?.user_id ? childDeviceStatusMap[child.user_id] : null }))
        .filter(entry => entry.status)
        .reduce((latest, entry) => {
            if (!latest) return entry;
            const entryTime = Date.parse(entry.status?.updatedAt || entry.status?.updated_at || "");
            const latestTime = Date.parse(latest.status?.updatedAt || latest.status?.updated_at || "");
            return (Number.isFinite(entryTime) ? entryTime : 0) > (Number.isFinite(latestTime) ? latestTime : 0)
                ? entry
                : latest;
        }, null);
    const primaryChildDeviceStatus = dashboardDeviceStatusEntry?.status || null;
    const primaryDeviceChildName = dashboardDeviceStatusEntry?.child?.name || dashboardChildren[0]?.name || "아이";
    const primaryDeviceBatteryLabel = Number.isFinite(Number(primaryChildDeviceStatus?.batteryLevel))
        ? `${Math.max(0, Math.min(100, Number(primaryChildDeviceStatus.batteryLevel)))}%`
        : "확인 중";
    const primaryDeviceChargingLabel = primaryChildDeviceStatus?.isCharging == null
        ? "확인 중"
        : (primaryChildDeviceStatus.isCharging ? "충전 중" : "미충전");
    const primaryDeviceConnectionLabel = primaryChildDeviceStatus?.connectionType || "확인 중";
    const primaryDeviceScreenLabel = formatDeviceDuration(Number(primaryChildDeviceStatus?.screenOnMs || 0));
    const primaryDeviceUpdatedLabel = primaryChildDeviceStatus?.updatedAt
        ? getRelativeTime(primaryChildDeviceStatus.updatedAt)
        : "곧 업데이트돼요";
    const primaryDeviceSafetyLabel = (() => {
        const battery = Number(primaryChildDeviceStatus?.batteryLevel);
        const screenMs = Number(primaryChildDeviceStatus?.screenOnMs || 0);
        if (Number.isFinite(battery) && battery <= 15) return "주의 필요";
        if (screenMs >= 3 * 60 * 60 * 1000) return "장시간 사용";
        return "양호";
    })();
    const requestChildDeviceStatusRefresh = useCallback(async (reason = "device_status_refresh") => {
        if (!familyId || pairedChildIds.length === 0) return false;
        if (!parentCapabilities.canRequestChildLocation) {
            showNotif("아이 제어는 구독한 보호자만 사용할 수 있어요.", "error");
            return false;
        }

        const results = await Promise.all(pairedChildIds.map(async (targetUserId) => {
            const requestId = generateUUID();
            const requestedAt = new Date().toISOString();
            const payload = {
                targetUserId,
                requestId,
                requestedAt,
                requesterUserId: authUser?.id || null,
                reason,
            };

            const broadcastPromise = sendBroadcastWhenReady(
                realtimeChannel.current,
                "child_device_status_request",
                payload,
                { timeoutMs: 1800, pollMs: 60 }
            ).then((sent) => {
                if (!sent) console.warn("[DeviceStatus] realtime request was not sent; falling back to push.");
                return sent;
            }).catch((error) => {
                console.warn("[DeviceStatus] realtime refresh request failed:", error?.message || error);
                return false;
            });

            const pushPromise = sendInstantPush({
                action: "request_device_status",
                familyId,
                senderUserId: authUser?.id || "",
                title: "",
                message: "",
                targetRole: "child",
                reason,
                ...payload,
                idempotencyKey: requestId,
            }).catch(error => {
                console.warn("[DeviceStatus] FCM refresh request failed:", error?.message || error);
                return false;
            });

            const [broadcastSent, pushSent] = await Promise.all([broadcastPromise, pushPromise]);
            return Boolean(broadcastSent || pushSent);
        }));
        return results.some(Boolean);
    }, [authUser?.id, familyId, pairedChildIdsKey, parentCapabilities.canRequestChildLocation, showNotif]);

    const handleParentDeviceRefreshClick = useCallback(() => {
        void requestChildLocationRefresh("device_status_manual_refresh");
        void requestChildDeviceStatusRefresh("device_status_manual_refresh");
    }, [requestChildDeviceStatusRefresh, requestChildLocationRefresh]);

    useEffect(() => {
        if (myRole !== "parent" || !familyId || !authUser?.id || !pairedChildIdsKey) return;
        const refreshKey = `${familyId}:${authUser.id}:${pairedChildIdsKey}`;
        if (parentBootstrapRefreshKeyRef.current === refreshKey) return;
        parentBootstrapRefreshKeyRef.current = refreshKey;
        void requestChildLocationRefresh("parent_dashboard_bootstrap");
        void requestChildDeviceStatusRefresh("parent_dashboard_bootstrap");
    }, [authUser?.id, familyId, myRole, pairedChildIdsKey, requestChildDeviceStatusRefresh, requestChildLocationRefresh]);
    const getDashboardChildPosition = (child, index) => {
        const matched = displayChildPositions.find(pos => pos.user_id && pos.user_id === child.user_id);
        if (matched) return matched;
        if (index === 0) return displayChildPos;
        return null;
    };
    const getDashboardChildLocationLabel = (child, index) => {
        const pos = getDashboardChildPosition(child, index);
        if (!pos) return "연결 준비 중";
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
    const selectedDateMovementSummary = useMemo(
        () => buildLocationDaySummary(selectedDateLocationTrail, {
            childUserId: selectedChild?.user_id || null,
            child: selectedChild,
            savedPlaces,
            academies,
        }),
        [academies, savedPlaces, selectedChild, selectedDateLocationTrail]
    );
    const renderSelectedDateMovementSummary = () => {
        const childName = selectedChild?.name || "선택한 아이";
        const hasEnoughRoute = selectedDateMovementSummary.pointCount >= 2;
        return (
            <section
                className="hyeni-v5-movement-summary"
                aria-label="선택한 날짜 이동경로 요약"
            >
                <div className="hyeni-v5-movement-summary__head">
                    <div>
                        <span className="hyeni-v5-movement-summary__kicker">{selectedCalendarDateLabel}</span>
                        <h3>{childName} 하루 이동경로</h3>
                    </div>
                    <span className="hyeni-v5-movement-summary__count">
                        이동 기록 {selectedDateMovementSummary.pointCount}개
                    </span>
                </div>

                {selectedDateTrailLoading ? (
                    <div className="hyeni-v5-movement-summary__empty">이동기록을 불러오는 중이에요.</div>
                ) : selectedDateTrailError ? (
                    <div className="hyeni-v5-movement-summary__empty is-error">{selectedDateTrailError}</div>
                ) : !selectedDateMovementSummary.hasData ? (
                    <div className="hyeni-v5-movement-summary__empty">
                        선택한 날짜에 {childName} 위치 기록이 없어요. 아이 기기의 위치 권한, 네트워크, 배터리 제한 상태를 확인해 주세요.
                    </div>
                ) : (
                    <>
                        <div className="hyeni-v5-movement-summary__stats">
                            <div>
                                <span>첫 기록</span>
                                <strong>{selectedDateMovementSummary.firstTimeLabel || "시간 미상"}</strong>
                            </div>
                            <div>
                                <span>마지막 기록</span>
                                <strong>{selectedDateMovementSummary.lastTimeLabel || "시간 미상"}</strong>
                            </div>
                            <div>
                                <span>이동 거리</span>
                                <strong>{hasEnoughRoute ? selectedDateMovementSummary.distanceLabel : "데이터 부족"}</strong>
                            </div>
                            <div>
                                <span>기록 시간</span>
                                <strong>{hasEnoughRoute ? selectedDateMovementSummary.durationLabel : "데이터 부족"}</strong>
                            </div>
                        </div>

                        {selectedDateMovementSummary.dwellPlaces.length > 0 && (
                            <div className="hyeni-v5-movement-summary__dwells" aria-label="오래 머문 위치">
                                {selectedDateMovementSummary.dwellPlaces.slice(0, 3).map((place) => (
                                    <span key={place.id}>
                                        {place.placeLabel || "머문 위치"} · {place.durationLabel} · {place.timeLabel}
                                    </span>
                                ))}
                            </div>
                        )}

                        <ol className="hyeni-v5-movement-summary__timeline">
                            {selectedDateMovementSummary.timeline.slice(0, 6).map((point) => (
                                <li key={point.id}>
                                    <span>{point.timeLabel || "시간 미상"}</span>
                                    <strong>{point.placeLabel || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}</strong>
                                </li>
                            ))}
                        </ol>
                    </>
                )}
            </section>
        );
    };
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
                    const visibleEvs = dayEvs.slice(0, 2);
                    const overflow = dayEvs.length - visibleEvs.length;
                    return (
                        <button
                            key={`${keyPrefix}-${day}`}
                            type="button"
                            onClick={() => setSelectedDate(day)}
                            className={`cal-day${isToday ? " is-today" : ""}${isSel ? " is-selected" : ""}${isSun ? " is-sun" : ""}${isSat ? " is-sat" : ""}`}
                            aria-label={`${currentMonth + 1}월 ${day}일${dayEvs.length ? ` 일정 ${dayEvs.length}개` : ""}`}
                            style={{ fontFamily: FF }}
                        >
                            <span className="cal-day-num">{day}</span>
                            {dayEvs.length > 0 && (
                                <span className="cal-chips">
                                    {visibleEvs.map((e) => {
                                        const cat = CATEGORIES.find((c) => c.id === e.category);
                                        const childLabel = `${cat?.emoji || "🌟"} ${e.time || ""}`.trim();
                                        return (
                                            <span
                                                key={e.id}
                                                className="cal-chip"
                                                data-family={e.is_family_event ? "true" : undefined}
                                                data-mode={isParent ? "parent" : "child"}
                                                style={{ "--rail": e.color || "var(--theme-accent)" }}
                                                title={e.title}
                                            >
                                                {isParent ? e.title : childLabel}
                                            </span>
                                        );
                                    })}
                                    {overflow > 0 && (
                                        <span className="cal-chip-overflow">+{overflow}</span>
                                    )}
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
                    ? { background: "var(--bg-muted)", color: DESIGN.colors.muted }
                    : null;
        const whoLabel = selectedChild?.name || pairedChildren[0]?.name || "아이";
        return (
            <div
                key={event.id}
                id={getDashboardEventElementId(event.id)}
                role="button"
                tabIndex={0}
                onClick={() => openEditEventModal(event)}
                onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                        keyboardEvent.preventDefault();
                        openEditEventModal(event);
                    }
                }}
                className={`hyeni-v5-event-card${status.current ? " is-current" : ""}${status.past ? " is-past" : ""}`}
                style={{ "--event-color": event.color || "var(--theme-accent)", "--event-bg": event.bg || "var(--theme-accent-soft)", fontFamily: FF, cursor: "pointer" }}
                aria-label={`${event.title} 편집`}
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
                        <span className="hyeni-v5-chip" style={{ background: "var(--status-cautionary-subtle)", color: "var(--status-cautionary-strong)", border: "1px solid #FED7AA" }}>✏️ 수정</span>
                    </div>
                </div>
                <div className="hyeni-v5-event-tag" style={statusStyle || undefined}>{status.label}</div>
                {event.location && (
                    <button
                        type="button"
                        aria-label={`${event.title} 경로 보기`}
                        title="경로 보기"
                        onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            setRouteEvent(event);
                        }}
                        style={{
                            position: "absolute", top: 8, right: 38,
                            width: 28, height: 28, borderRadius: "50%",
                            border: "1px solid var(--bg-subtle)", background: "var(--bg-subtle)",
                            color: "#1D4ED8", fontSize: 13, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            zIndex: 1,
                        }}
                    >
                        🗺️
                    </button>
                )}
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
    const memoPreview = getMemoPreview({
        memoReplies,
        currentMemo,
        formatRelativeTime: getRelativeTime,
    });
    const memoPreviewText = memoPreview.text;
    const memoPreviewMeta = memoPreview.meta;
    const memoPreviewCount = memoPreview.count;
    const handleMemoReplySubmit = useCallback((content) => {
        if (!familyId || !authUser) return Promise.resolve();
        const origin = (memoReplies && memoReplies.length > 0) ? "reply" : "original";
        const optimisticId = "temp-" + Date.now();
        const optimisticReply = {
            id: optimisticId,
            family_id: familyId,
            date_key: dateKey,
            user_id: authUser.id,
            user_role: myRole,
            content,
            created_at: new Date().toISOString(),
            origin,
            read_by: [],
        };
        const memoPageOpen = showParentMemoPage || showChildMemoPage;
        setMemoReplies(prev => [...(prev || []), optimisticReply]);
        if (memoPageOpen) {
            setMemoThreadReplies(prev => [...(prev || []), optimisticReply]);
        }
        const sendPromise = sendMemo(familyId, dateKey, content, authUser.id, myRole, origin)
            .then((insertedReply) => {
                const channel = realtimeChannel.current;
                if (insertedReply && channel?.send) {
                    const broadcastReply = () => {
                        try {
                            return Promise.resolve(channel.send({
                                type: "broadcast",
                                event: "memo_reply",
                                payload: insertedReply,
                            })).catch((error) => {
                                console.warn("[memo_reply broadcast]", error?.message || error);
                            });
                        } catch (error) {
                            console.warn("[memo_reply broadcast]", error?.message || error);
                            return Promise.resolve();
                        }
                    };
                    broadcastReply();
                    if (channel.state !== "joined") {
                        window.setTimeout(broadcastReply, 500);
                    }
                }
                if (myRole === "child" && aiEnabled) {
                    try {
                        analyzeMemoSentiment(content, "");
                    } catch (_) { /* ignore */ }
                }
                return fetchMemoReplies(familyId, dateKey)
                    .then((rows) => {
                        setMemoReplies(rows);
                        if (!memoPageOpen) return rows;
                        return fetchMemoRepliesForDateKeys(familyId, memoThreadDateKeys)
                            .then((threadRows) => {
                                setMemoThreadReplies(threadRows);
                                return rows;
                            })
                            .catch((err) => {
                                console.warn("[memo] thread refresh after send failed:", err);
                                return rows;
                            });
                    });
            })
            .catch(err => {
                setMemoReplies(prev => (prev || []).filter(r => r.id !== optimisticId));
                setMemoThreadReplies(prev => (prev || []).filter(r => r.id !== optimisticId));
                console.error("[reply]", err);
                throw err;
            });
        const senderDisplayName = familyInfo?.myName || (myRole === "parent" ? "부모님" : "아이");
        sendInstantPush({
            action: "new_memo",
            familyId,
            senderUserId: authUser.id,
            title: `💬 ${senderDisplayName}의 새 메모`,
            message: content.length > 50 ? content.substring(0, 50) + "..." : content,
        });
        return sendPromise;
    }, [familyId, authUser, memoReplies, myRole, dateKey, aiEnabled, familyInfo?.myName, memoThreadDateKeys, showParentMemoPage, showChildMemoPage]);

    const TABS = isParent
        ? [["calendar", "○ 달력"], ["maplist", "□ 장소관리"]]
        : [["calendar", "○ 달력"], ["maplist", "⌖ 장소"]];
    const quickPanelTone = { bg: "rgba(255,255,255,0.88)", border: "var(--theme-accent-line)", color: "var(--theme-accent-text)" };
    const quickThemePalette = { bg: "linear-gradient(135deg,var(--theme-accent-soft),var(--hyeni-surface-warm))", color: "var(--theme-accent-text)", shadow: "var(--hyeni-theme-shadow-soft)" };
    const quickDangerPalette = { bg: "linear-gradient(135deg,var(--status-negative-subtle),rgba(255,255,255,0.92))", color: "var(--status-negative-strong)", shadow: "rgba(229,34,34,0.14)" };
    const quickModeActions = TABS.map(([view, label]) => {
        const [icon, text] = label.split(" ");
        return {
            key: view,
            icon,
            label: text,
            ariaLabel: view === "calendar" ? "📅 달력" : "📍 장소",
            active: activeView === view,
            onClick: () => {
                if (isParent && view === "maplist") {
                    openAcademyManagement();
                    return;
                }
                setActiveView(view);
            },
        };
    });
    const quickUtilityActions = [
        activeView !== "calendar" ? {
            key: "home",
            icon: "⌂",
            label: "홈",
            ariaLabel: "홈",
            palette: quickThemePalette,
            onClick: () => setActiveView("calendar"),
        } : null,
        isParent && parentCapabilities.canRequestChildLocation ? {
            key: "child-tracker",
            icon: "⌖",
            label: "우리아이",
            ariaLabel: "📍 우리아이",
            palette: quickThemePalette,
            onClick: () => setShowChildTracker(true),
        } : null,
        isParent && parentCapabilities.canManagePlaces ? {
            key: "academy",
            icon: "□",
            label: "장소관리",
            ariaLabel: "📍 장소관리",
            palette: quickThemePalette,
            onClick: openAcademyManagement,
        } : null,
        isParent && parentCapabilities.canManageFamily ? {
            key: "friend-playdate",
            icon: "◇",
            label: "친구놀이",
            ariaLabel: "친구놀이 관리",
            palette: quickThemePalette,
            onClick: () => {
                setShowParentMemoPage(false);
                setActiveView("friendPlaydateSettings");
                window.requestAnimationFrame(() => {
                    window.scrollTo({ top: 0, behavior: "auto" });
                });
            },
        } : null,
        isParent && parentCapabilities.canUseForceRing ? {
            key: "force-ring",
            icon: "!",
            label: "응급알림",
            ariaLabel: "응급 강제 알림",
            palette: quickDangerPalette,
            onClick: () => {
                setShowParentMemoPage(false);
                setActiveView("forceRing");
                window.requestAnimationFrame(() => {
                    window.scrollTo({ top: 0, behavior: "auto" });
                });
            },
        } : null,
        {
            key: "stickers",
            icon: "★",
            label: isParent ? "스티커" : "스티커북",
            ariaLabel: isParent ? "🏆 스티커" : "스티커북",
            description: isParent ? "" : "오늘 받은 칭찬 보기",
            palette: quickThemePalette,
            onClick: () => {
                setShowStickerBook(true);
                if (familyId) {
                    fetchStickersForDate(familyId, dateKey).then(s => setStickers(s));
                    fetchStickerSummary(familyId).then(s => setStickerSummary(s?.[0] || null));
                }
            },
        },
        isParent && parentCapabilities.canManageSubscription ? {
            key: "subscription",
            icon: "◆",
            label: "구독",
            ariaLabel: "💎 구독",
            palette: quickThemePalette,
            onClick: () => setShowSubscriptionSettings(true),
        } : null,
        isParent && parentCapabilities.canEditParentPhones ? {
            key: "contacts",
            icon: "☎",
            label: "연락처",
            ariaLabel: "📞 연락처",
            palette: quickThemePalette,
            onClick: () => setShowPhoneSettings(true),
        } : null,
        isParent && parentCapabilities.canUseRemoteListen ? {
            key: "remote-audio",
            icon: "◉",
            label: "주변소리",
            ariaLabel: "🎙️ 주변소리",
            palette: quickThemePalette,
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
            key: "feedback",
            icon: "✉",
            label: "피드백",
            ariaLabel: "💌 피드백 보내기",
            palette: quickThemePalette,
            onClick: () => setShowFeedbackModal(true),
        } : null,
    ].filter(Boolean);
    const quickUtilityColumns = isParent ? "repeat(4, minmax(0, 1fr))" : "1fr";
    const renderQuickAction = (action, type = "utility") => {
        const isMode = type === "mode";
        const isChildStickerShortcut = !isParent && !isMode && action.key === "stickers";
        const actionShadow = String(action.palette?.shadow || "rgba(31,41,55,0.08)");
        const actionBoxShadow = actionShadow.startsWith("var(") ? actionShadow : `0 10px 22px ${actionShadow}`;
        return (
            <button
                key={action.key}
                type="button"
                aria-label={action.ariaLabel}
                onClick={action.onClick}
                style={{
                    border: isMode ? "none" : "1px solid var(--theme-accent-line)",
                    cursor: "pointer",
                    fontFamily: FF,
                    borderRadius: isMode ? DESIGN.radius.lg : DESIGN.radius.xl,
                    minHeight: isMode ? 68 : (isChildStickerShortcut ? 74 : (isParent ? 82 : 88)),
                    padding: isMode ? "12px 10px" : (isChildStickerShortcut ? "14px 16px" : (isParent ? "12px 6px 10px" : "14px 8px 12px")),
                    display: "flex",
                    flexDirection: isChildStickerShortcut ? "row" : "column",
                    alignItems: "center",
                    justifyContent: isChildStickerShortcut ? "flex-start" : "center",
                    gap: isChildStickerShortcut ? 12 : (isMode ? 4 : 6),
                    textAlign: isChildStickerShortcut ? "left" : "center",
                    whiteSpace: "normal",
                    lineHeight: 1.18,
                    background: isMode
                        ? (action.active ? DESIGN.gradients.primary : "rgba(255,255,255,0.88)")
                        : action.palette.bg,
                    color: isMode ? (action.active ? "white" : DESIGN.colors.muted) : action.palette.color,
                    boxShadow: isMode
                        ? (action.active ? "var(--hyeni-theme-shadow-soft)" : "inset 0 0 0 1px rgba(226,232,240,0.85)")
                        : actionBoxShadow,
                }}
            >
                <span aria-hidden="true" style={{
                    fontSize: isMode ? (isParent ? 18 : 20) : (isChildStickerShortcut ? 28 : (isParent ? 20 : 22)),
                    lineHeight: 1,
                    width: isChildStickerShortcut ? 46 : "auto",
                    height: isChildStickerShortcut ? 46 : "auto",
                    borderRadius: isChildStickerShortcut ? 18 : 0,
                    background: isChildStickerShortcut ? "rgba(255,255,255,0.74)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}>
                    {action.icon}
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: isChildStickerShortcut ? "flex-start" : "center", gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: isMode ? 12 : (isParent ? 11 : 13), fontWeight: action.active ? 800 : 800, letterSpacing: 0, wordBreak: "keep-all" }}>
                        {action.label}
                    </span>
                    {action.description && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--theme-accent-text)", lineHeight: 1.25, wordBreak: "keep-all" }}>
                            {action.description}
                        </span>
                    )}
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
            await setupFamily(authUser.id, getParentNameFromUser(authUser), {
                parentPhone: getParentPhoneFromUser(authUser),
                parentGender: getParentGenderFromUser(authUser),
            });
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
            await joinFamilyAsParent(normalizedCode, authUser.id, getParentNameFromUser(authUser));
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
    // Phase 1 §3.4 — 자녀 카드 클릭 시 800ms 인사 transition 우선 표시
    if (showChildEntry) return (
        <ChildEntryTransition onComplete={() => {
            setShowChildEntry(false);
            handleChildSelect();
        }} />
    );

    // Phase 1 §3.1 — Splash + 세션 복원 로딩
    if (authLoading) return <SplashScreen AppBrandLogo={AppBrandLogo} />;

    // Auth guard: if role exists but no session, force re-login
    if (!myRole || (!authUser && !authLoading)) return <RoleSetupModal onSelect={r => { if (r === "child") setShowChildEntry(true); }} />;

    // ── Parent first login: choose "새 가족 만들기" or "기존 가족 합류" ────────
    // "새 가족 만들기" → PairingWizard (multi-child setup wizard)
    // "기존 가족 합류" → existing handleJoinAsParent flow (preserved)
    if (showParentSetup && !familyInfo) {
        if (showCreateWizard && authUser) return (
            <PairingWizard
                userId={authUser.id}
                parentName={getParentNameFromUser(authUser)}
                parentPhone={getParentPhoneFromUser(authUser)}
                parentGender={getParentGenderFromUser(authUser)}
                onCancel={() => setShowCreateWizard(false)}
                onComplete={async () => {
                    try {
                        const fam = await getMyFamily(authUser.id);
                        if (fam) setFamilyInfo(fam);
                    } catch (err) {
                        console.error("[PairingWizard onComplete] getMyFamily failed:", err);
                    }
                    setShowCreateWizard(false);
                    setShowParentSetup(false);
                }}
            />
        );
        return (
            <ParentSetupScreen onCreateFamily={() => setShowCreateWizard(true)} onJoinAsParent={handleJoinAsParent} />
        );
    }

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
        <AcademyManager
            academies={academies}
            savedPlaces={savedPlaces}
            dangerZones={dangerZones}
            savedPlacesLocked={!parentCapabilities.canManagePlaces || !entitlement.canUse(FEATURES.SAVED_PLACES)}
            dangerZonesLocked={!parentCapabilities.canManagePlaces}
            currentPos={childPos}
            onSave={async (newList) => {
                if (!parentCapabilities.canManagePlaces) {
                    showNotif("보조 보호자는 학원·장소를 수정할 수 없어요.", "error");
                    return false;
                }
                // Diff old vs new to determine DB operations
                const oldMap = new Map(academies.filter(a => a.id).map(a => [a.id, a]));
                const newMap = new Map(newList.filter(a => a.id).map(a => [a.id, a]));
                const createdItems = newList.filter(a => !a.id || !oldMap.has(a.id));

                if (createdItems.length > 0 && !entitlement.canUse(FEATURES.ACADEMY_SCHEDULE)) {
                    openFeatureLock(FEATURES.ACADEMY_SCHEDULE);
                    return false;
                }

                const isFutureOrTodayDateKey = (dk) => {
                    const [y, m, d] = String(dk).split("-").map(Number);
                    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
                    const evDate = new Date(y, m, d);
                    return evDate.setHours(0, 0, 0, 0) >= new Date().setHours(0, 0, 0, 0);
                };
                const isManagedAcademyEvent = (ev, academy) => {
                    if (!ev || !academy?.schedule?.startTime) return false;
                    return ev.title === academy.name
                        && ev.category === academy.category
                        && ev.time === academy.schedule.startTime;
                };

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
                        }
                    }
                }

                // Reconcile repeating academy events (remove stale + add missing)
                if (familyId && authUser) {
                    const academyOpsDeleteIds = new Set();
                    const academyOpsInsert = [];
                    const oldAcademies = Array.from(oldMap.values());
                    const futureEventEntries = [];
                    for (const [dk, dayEvents] of Object.entries(events || {})) {
                        if (!isFutureOrTodayDateKey(dk)) continue;
                        for (const ev of dayEvents || []) futureEventEntries.push({ dk, ev });
                    }

                    // 1) Remove future repeating events tied to deleted/changed academies.
                    for (const oldAc of oldAcademies) {
                        const nextAc = oldAc?.id ? finalList.find(item => item.id === oldAc.id) : null;
                        const scheduleChanged = !nextAc || JSON.stringify(oldAc.schedule || null) !== JSON.stringify(nextAc.schedule || null);
                        const coreChanged = !nextAc
                            || oldAc.name !== nextAc.name
                            || oldAc.category !== nextAc.category
                            || oldAc.emoji !== nextAc.emoji
                            || JSON.stringify(oldAc.location || null) !== JSON.stringify(nextAc.location || null);
                        if (!scheduleChanged && !coreChanged) continue;
                        for (const { ev } of futureEventEntries) {
                            if (isManagedAcademyEvent(ev, oldAc)) academyOpsDeleteIds.add(ev.id);
                        }
                    }

                    // 2) Add future events from current academy repeat settings.
                    const desiredEventKeys = new Set();
                    for (const ac of finalList) {
                        if (!ac.schedule?.days?.length || !ac.schedule.startTime) continue;
                        const cat = CATEGORIES.find(c => c.id === ac.category);
                        const repeatWeeks = Math.max(1, Number(ac.schedule.repeatWeeks || 4));
                        const totalDays = repeatWeeks * 7;
                        const startDate = new Date();
                        for (let offset = 0; offset < totalDays; offset++) {
                            const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + offset);
                            if (!ac.schedule.days.includes(date.getDay())) continue;
                            const dk = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                            const expectedKey = `${dk}|${ac.name}|${ac.schedule.startTime}|${ac.category}`;
                            desiredEventKeys.add(expectedKey);
                            const exists = (events[dk] || []).some(ev =>
                                ev.title === ac.name
                                && ev.time === ac.schedule.startTime
                                && ev.category === ac.category
                                && !academyOpsDeleteIds.has(ev.id)
                            );
                            if (exists) continue;
                            academyOpsInsert.push({
                                dk,
                                ev: {
                                    id: generateUUID(),
                                    title: ac.name,
                                    time: ac.schedule.startTime,
                                    endTime: ac.schedule.endTime || null,
                                    category: ac.category,
                                    emoji: ac.emoji,
                                    color: cat?.color || "#A78BFA",
                                    bg: cat?.bg || "#EDE9FE",
                                    memo: "",
                                    location: ac.location || null,
                                    notifOverride: null
                                }
                            });
                        }
                    }

                    // 3) Remove outdated repeat events that are no longer part of any schedule.
                    for (const { dk, ev } of futureEventEntries) {
                        const evKey = `${dk}|${ev.title}|${ev.time}|${ev.category}`;
                        if (!desiredEventKeys.has(evKey)) {
                            const oldAc = oldAcademies.find(ac => isManagedAcademyEvent(ev, ac));
                            if (oldAc) academyOpsDeleteIds.add(ev.id);
                        }
                    }

                    if (academyOpsDeleteIds.size > 0 || academyOpsInsert.length > 0) {
                        setEvents(prev => {
                            const updated = {};
                            for (const [dk, dayEvents] of Object.entries(prev || {})) {
                                const filtered = (dayEvents || []).filter(ev => !academyOpsDeleteIds.has(ev.id));
                                if (filtered.length > 0) {
                                    updated[dk] = filtered;
                                }
                            }
                            for (const { dk, ev } of academyOpsInsert) {
                                if (!updated[dk]) updated[dk] = [];
                                updated[dk] = [...updated[dk], ev].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
                            }
                            return updated;
                        });
                    }

                    for (const eventId of academyOpsDeleteIds) {
                        try { await dbDeleteEvent(eventId); } catch (e) { console.error("[academy-event-delete]", e); }
                    }
                    for (const { dk, ev } of academyOpsInsert) {
                        try { await insertEvent(ev, familyId, dk, authUser.id); } catch (e) { console.error("[academy-event]", e); }
                    }
                }

                setAcademies(finalList);
                cacheAcademies(finalList);
                showNotif("🏫 학원 목록이 저장됐어요!");
                return true;
            }}
            onSavedPlacesLocked={() => {
                if (!parentCapabilities.canManagePlaces) {
                    showNotif("보조 보호자는 학원·장소를 수정할 수 없어요.", "error");
                    return;
                }
                openFeatureLock(FEATURES.SAVED_PLACES);
            }}
            onSavedPlacesSave={async (nextList) => {
                if (!parentCapabilities.canManagePlaces) {
                    showNotif("보조 보호자는 학원·장소를 수정할 수 없어요.", "error");
                    return false;
                }
                if (!entitlement.canUse(FEATURES.SAVED_PLACES)) {
                    openFeatureLock(FEATURES.SAVED_PLACES);
                    return false;
                }

                const normalizedNext = [];
                for (const place of nextList) {
                    const normalizedPlace = {
                        ...place,
                        id: place.id || generateUUID(),
                        name: place.name.trim(),
                        is_playdate_safe: !!place.is_playdate_safe,
                        public_place_id: place.public_place_id || null,
                    };
                    if (
                        normalizedPlace.is_playdate_safe
                        && !normalizedPlace.public_place_id
                        && normalizedPlace.location?.lat != null
                        && normalizedPlace.location?.lng != null
                    ) {
                        try {
                            normalizedPlace.public_place_id = await upsertPublicPlace({
                                kakaoPlaceId: normalizedPlace.location?.kakao_place_id || null,
                                name: normalizedPlace.name,
                                lat: normalizedPlace.location.lat,
                                lng: normalizedPlace.location.lng,
                            });
                        } catch (error) {
                            console.error("[saved-place] safe place public mapping failed:", error);
                            showNotif("안전장소 등록에 실패했어요. 카카오 장소 검색으로 위치를 선택해 주세요", "error");
                            return false;
                        }
                    }
                    normalizedNext.push(normalizedPlace);
                }
                const previousList = savedPlaces;
                const previousMap = new Map(previousList.map((place) => [place.id, place]));
                const nextMap = new Map(normalizedNext.map((place) => [place.id, place]));

                setSavedPlaces(normalizedNext);
                cacheSavedPlaces(normalizedNext);

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
                            || JSON.stringify(previous.location) !== JSON.stringify(place.location)
                            || !!previous.is_playdate_safe !== !!place.is_playdate_safe
                            || (previous.public_place_id || null) !== (place.public_place_id || null);
                        if (changed) {
                            await updateSavedPlace(place.id, {
                                name: place.name,
                                location: place.location || null,
                                is_playdate_safe: !!place.is_playdate_safe,
                                public_place_id: place.public_place_id || null,
                            });
                        }
                    }

                    maybeOpenTrialInvite();
                    showNotif("📍 자주 가는 장소가 저장됐어요!");
                    return true;
                } catch (error) {
                    console.error("[saved-place] save error:", error);
                    setSavedPlaces(previousList);
                    cacheSavedPlaces(previousList);
                    showNotif("장소 저장에 실패했어요. 다시 시도해주세요", "error");
                    return false;
                }
            }}
            onDangerZonesLocked={() => {
                showNotif("보조 보호자는 조심할 곳을 수정할 수 없어요.", "error");
            }}
            onDangerZoneAdd={async (zone) => {
                if (!parentCapabilities.canManagePlaces) {
                    showNotif("보조 보호자는 조심할 곳을 수정할 수 없어요.", "error");
                    throw new Error("co-parent danger zone blocked");
                }
                if (dangerZones.length >= 1 && !entitlement.canUse(FEATURES.MULTI_GEOFENCE)) {
                    openFeatureLock(FEATURES.MULTI_GEOFENCE);
                    throw new Error("프리미엄 구독이 필요합니다");
                }
                const saved = await saveDangerZone(familyId, zone);
                setDangerZones(prev => [...prev, saved]);
                showNotif(`⚠️ 조심할 곳 '${zone.name}' 등록 완료`);
                return saved;
            }}
            onDangerZoneDelete={async (id) => {
                if (!parentCapabilities.canManagePlaces) {
                    showNotif("보조 보호자는 조심할 곳을 수정할 수 없어요.", "error");
                    return;
                }
                await deleteDangerZone(id);
                setDangerZones(prev => prev.filter(z => z.id !== id));
                setFiredDangerAlerts(prev => { const n = new Set(prev); n.delete(id); return n; });
                showNotif("조심할 곳이 삭제됐어요");
            }}
            onClose={() => setShowAcademyMgr(false)} />
    );

    if (showSavedPlaceMgr) return (
        <>
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
            {isParent && (
                <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 260, pointerEvents: "none" }}>
                    <div style={{ pointerEvents: "auto" }}>
                        {renderParentBottomTabbar("maplist", "hyeni-v5-tabbar-fixed")}
                    </div>
                </div>
            )}
        </>
    );

    if (childSafetySetupBlocked && !permissionWizardDismissed) return (
        <ChildPermissionWizard
            steps={childSafetySetupSteps}
            onAction={openChildSafetySetupStep}
            onAllowAll={runAllChildSafetySteps}
            onDismiss={() => setPermissionWizardDismissed(true)}
        />
    );

    if (showParentMemoPage && isParent) return (
        <div className="hyeni-app-shell hyeni-parent-memo-shell" style={{ height: "100dvh", background: DESIGN.gradients.shell, fontFamily: FF, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 22px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 104px)", position: "relative", overflowX: "hidden", overflowY: "hidden", width: "100%", boxSizing: "border-box" }}>
            {notification && (
                <div style={{
                    position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
                    background: notification.type === "error" ? "var(--status-cautionary-subtle)" : notification.type === "child" ? "var(--theme-accent-soft)" : notification.type === "parent" ? "var(--bg-subtle)" : "var(--status-positive-subtle)",
                    color: notification.type === "error" ? "var(--status-cautionary-strong)" : notification.type === "child" ? "var(--theme-accent-text)" : notification.type === "parent" ? "#1D4ED8" : "#065F46",
                    borderRadius: 20, padding: "12px 20px", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 250, maxWidth: "calc(100vw - 32px)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none"
                }}>
                    {notification.msg}
                </div>
            )}
            <ParentMemoPage
                replies={memoThreadReplies}
                onReplySubmit={handleMemoReplySubmit}
                myUserId={authUser?.id}
                partnerName={selectedChild?.name || pairedChildren[0]?.name || "아이"}
                onClose={() => setShowParentMemoPage(false)}
                onReplyRef={registerMemoReplyNode}
            />
            {renderParentBottomTabbar("memo", "hyeni-v5-tabbar-fixed")}
        </div>
    );

    if (showChildMemoPage && !isParent) return (
        <div className="hyeni-app-shell hyeni-child-memo-shell" style={{ height: "100dvh", background: DESIGN.gradients.shell, fontFamily: FF, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 22px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)", position: "relative", overflowX: "hidden", overflowY: "hidden", width: "100%", boxSizing: "border-box" }}>
            {notification && (
                <div style={{
                    position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
                    background: notification.type === "error" ? "var(--status-cautionary-subtle)" : notification.type === "child" ? "var(--theme-accent-soft)" : notification.type === "parent" ? "var(--bg-subtle)" : "var(--status-positive-subtle)",
                    color: notification.type === "error" ? "var(--status-cautionary-strong)" : notification.type === "child" ? "var(--theme-accent-text)" : notification.type === "parent" ? "#1D4ED8" : "#065F46",
                    borderRadius: 20, padding: "12px 20px", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 250, maxWidth: "calc(100vw - 32px)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none"
                }}>
                    {notification.msg}
                </div>
            )}
            <ParentMemoPage
                replies={memoThreadReplies}
                onReplySubmit={handleMemoReplySubmit}
                myUserId={authUser?.id}
                partnerName="부모님"
                onClose={() => setShowChildMemoPage(false)}
                onReplyRef={registerMemoReplyNode}
                mode="child"
                quickReplies={getChildMemoQuickReplies()}
                emptyCopy={{
                    title: "부모님과 나눈 메모가 아직 없어요",
                    description: "도착 소식이나 하고 싶은 말을 짧게 남겨보세요.",
                }}
                stickerCopy={{
                    title: "칭찬 스티커도 함께 보여요!",
                    description: "부모님이 보낸 응원을 여기서 확인할 수 있어요.",
                }}
            />
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
        input:focus,textarea:focus{border-color:var(--theme-accent)!important;box-shadow:0 0 0 4px var(--theme-accent-soft)}
        ::-webkit-scrollbar{display:none}
        *{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
      `}</style>


            {/* Toast */}
            {notification && (
                <div style={{
                    position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
                    background: notification.type === "error" ? "var(--status-cautionary-subtle)" : notification.type === "child" ? "var(--theme-accent-soft)" : notification.type === "parent" ? "var(--bg-subtle)" : "var(--status-positive-subtle)",
                    color: notification.type === "error" ? "var(--status-cautionary-strong)" : notification.type === "child" ? "var(--theme-accent-text)" : notification.type === "parent" ? "#1D4ED8" : "#065F46",
                    borderRadius: 20, padding: "12px 20px", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 250, maxWidth: "calc(100vw - 32px)", textAlign: "center", animation: "slideDown 0.3s ease", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none"
                }}>
                    {notification.msg}
                </div>
            )}

            {/* RES-02: sync degradation banner. Single small pill at top under the
                notification toast. Replaces the console [sync] spam. */}
            {syncDegraded && (
                <div style={{
                    position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)",
                    background: syncDegraded === "circuit_open" ? "#FED7AA" : "var(--status-cautionary-subtle)",
                    color: syncDegraded === "circuit_open" ? "var(--status-cautionary-strong)" : "var(--status-cautionary-strong)",
                    borderRadius: 16, padding: "8px 14px", fontWeight: 600, fontSize: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", zIndex: 240, maxWidth: "calc(100vw - 32px)", textAlign: "center", animation: "slideDown 0.3s ease", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                    {syncDegraded === "circuit_open"
                        ? "일시적으로 연결이 불안정해요 — 5분 뒤 자동 재시도"
                        : "일부 기능을 일시적으로 불러오지 못했어요 — 잠시 뒤 자동 재시도합니다"}
                </div>
            )}

            {/* Settings sheet (parent only) — bottom sheet with subscription / logout */}
            {showSettingsSheet && isParent && (
                <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 500, fontFamily: FF }}
                    onClick={e => { if (e.target === e.currentTarget) setShowSettingsSheet(false); }}>
                    <div style={makeCardStyle({ width: "100%", maxWidth: 480, maxHeight: "70vh", overflow: "hidden", borderRadius: "20px 20px 0 0", paddingBottom: "env(safe-area-inset-bottom, 0px)" })}>
                        <div style={{ padding: "18px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 17, fontWeight: 900, color: "var(--fg-primary)" }}>설정</div>
                            <button onClick={() => setShowSettingsSheet(false)}
                                aria-label="닫기"
                                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fg-tertiary)" }}>×</button>
                        </div>
                        <div style={{ padding: "8px 12px 16px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
                            <button type="button"
                                onClick={() => { setShowSettingsSheet(false); setShowSubscriptionSettings(true); }}
                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 12px", background: "transparent", border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: FF }}>
                                <span style={{ fontSize: 22, width: 28, textAlign: "center" }}>💎</span>
                                <span style={{ flex: 1 }}>
                                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--fg-primary)" }}>구독 관리</span>
                                    <span style={{ display: "block", fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>플랜 확인 · 결제 정보</span>
                                </span>
                                <span aria-hidden="true" style={{ color: "var(--fg-tertiary)" }}>›</span>
                            </button>
                            <button type="button"
                                onClick={() => { setShowSettingsSheet(false); setShowAlertPanel(true); loadParentAlerts(); }}
                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 12px", background: "transparent", border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: FF }}>
                                <span style={{ fontSize: 22, width: 28, textAlign: "center" }}>🔔</span>
                                <span style={{ flex: 1 }}>
                                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--fg-primary)" }}>알림</span>
                                    <span style={{ display: "block", fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>활동 알림 · 분석 ON/OFF</span>
                                </span>
                                <span aria-hidden="true" style={{ color: "var(--fg-tertiary)" }}>›</span>
                            </button>
                            <div style={{ height: 1, background: "var(--bg-muted)", margin: "8px 4px" }} />
                            <button type="button"
                                onClick={() => {
                                    setShowSettingsSheet(false);
                                    setConfirmDialog({
                                        title: "로그아웃 하시겠어요?",
                                        message: "현재 기기에서 계정이 로그아웃돼요. 다음에 다시 로그인하면 가족 정보가 복구돼요.",
                                        confirmLabel: "로그아웃",
                                        cancelLabel: "취소",
                                        tone: "danger",
                                        icon: "👋",
                                        onConfirm: async () => {
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
                                        },
                                    });
                                }}
                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 12px", background: "transparent", border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: FF }}>
                                <span style={{ fontSize: 22, width: 28, textAlign: "center" }}>👋</span>
                                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--status-negative-strong, #B91C1C)" }}>로그아웃</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Activity alert panel (parent only) */}
            {showAlertPanel && isParent && (
                <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 500, fontFamily: FF }}
                    onClick={e => { if (e.target === e.currentTarget) setShowAlertPanel(false); }}>
                    <div style={makeCardStyle({ width: "100%", maxWidth: 480, height: "82vh", maxHeight: "82vh", overflow: "hidden", borderRadius: "20px 20px 0 0", paddingBottom: "env(safe-area-inset-bottom, 0px)" })}>
                        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--bg-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 900, color: "var(--fg-primary)" }}>활동 알림</div>
                                <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 2 }}>아이 활동 리포트</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, color: aiEnabled ? "var(--status-positive)" : "#9CA3AF" }}>
                                    <input type="checkbox" checked={aiEnabled} onChange={e => toggleAiEnabled(e.target.checked)}
                                        style={{ width: 14, height: 14, accentColor: "var(--status-positive)" }} />
                                    분석 {aiEnabled ? "ON" : "OFF"}
                                </label>
                                <button onClick={() => setShowAlertPanel(false)}
                                    style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fg-tertiary)" }}>×</button>
                            </div>
                        </div>
                        <div style={{ overflowY: "auto", maxHeight: "calc(75vh - 80px)", padding: "12px 16px" }}>
                            {!aiEnabled && (
                                <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--fg-tertiary)" }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>활동 분석이 꺼져 있어요</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>위 토글을 켜면 아이 활동을 정리해 알려드려요</div>
                                </div>
                            )}
                            {aiEnabled && parentAlerts.length === 0 && (
                                <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--fg-tertiary)" }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>아직 알림이 없어요</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>아이가 일정 장소에 도착/출발하면 정리해 알려드려요</div>
                                </div>
                            )}
                            {aiEnabled && parentAlerts.map(alert => {
                                const severityColors = {
                                    urgent: { bg: "var(--status-negative-subtle)", border: "var(--status-negative)", icon: "🚨" },
                                    warning: { bg: "var(--status-cautionary-subtle)", border: "var(--status-cautionary)", icon: "⚠️" },
                                    info: { bg: "var(--bg-subtle)", border: "var(--theme-accent)", icon: "ℹ️" },
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
                                const alertTitle = String(alert.title || "").replace(/^🤖\s*(AI:\s*)?/i, "").trim() || "활동 알림";
                                return (
                                    <div key={alert.id}
                                        onClick={async () => { if (!alert.read) { await markAlertRead(alert.id); setParentAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, read: true } : a)); } }}
                                        style={{ background: alert.read ? "var(--bg-subtle)" : sc.bg, borderLeft: `4px solid ${sc.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10, cursor: "pointer", opacity: alert.read ? 0.7 : 1 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--fg-primary)" }}>
                                                {sc.icon} {alertTitle}
                                            </div>
                                            <div style={{ fontSize: 10, color: "var(--fg-tertiary)" }}>{timeAgo}</div>
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--fg-secondary)", lineHeight: 1.5 }}>{alert.message}</div>
                                        {!alert.read && <div style={{ fontSize: 11, color: sc.border, fontWeight: 700, marginTop: 4 }}>탭하여 읽음 표시</div>}
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
                        <div style={{ height: 4, background: "var(--status-positive)", animation: "shrinkBar 8s linear forwards" }} />
                        <div style={{ padding: "16px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--status-positive)", background: "var(--status-positive-subtle)", padding: "4px 10px", borderRadius: 8 }}>{voicePreview.aiParsed ? "일정 저장 완료" : "음성 저장 완료"}</div>
                                {voicePreview.academyMatched && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--theme-accent-text)", background: "var(--theme-accent-soft)", padding: "4px 10px", borderRadius: 8 }}>🏫 학원 자동 매칭</div>}
                                <div style={{ fontSize: 11, color: "var(--fg-tertiary)", flex: 1, textAlign: "right" }}>8초 후 닫힘</div>
                            </div>
                            <div style={{ background: voicePreview.ev.bg, borderRadius: 16, padding: "12px 14px", borderLeft: `4px solid ${voicePreview.ev.color}`, marginBottom: 12 }}>
                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <div style={{ fontSize: 26 }}>{voicePreview.ev.emoji}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--fg-primary)" }}>{voicePreview.ev.title}</div>
                                        <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>📅 {voicePreview.dateLabel} &nbsp;⏰ {voicePreview.ev.time}</div>
                                        {voicePreview.ev.location && <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginTop: 2 }}>📍 {voicePreview.ev.location.address?.split(" ").slice(0, 3).join(" ")}</div>}
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--fg-tertiary)", marginBottom: 12, padding: "6px 10px", background: "var(--bg-subtle)", borderRadius: 8 }}>🎙 인식: "{voicePreview.rawText}"</div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => { setVoicePreview(null); setCurrentYear(parseInt(voicePreview.dateKey.split("-")[0])); setCurrentMonth(parseInt(voicePreview.dateKey.split("-")[1])); setSelectedDate(parseInt(voicePreview.dateKey.split("-")[2])); setActiveView("calendar"); }}
                                    style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,var(--status-positive),#059669)", color: "white", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>✅ 달력에서 보기</button>
                                <button onClick={() => { setVoicePreview(null); setNewTitle(voicePreview.ev.title); setNewTime(voicePreview.ev.time); setNewEndTime(voicePreview.ev.endTime || ""); setNewCategory(voicePreview.ev.category); setNewLocation(voicePreview.ev.location); setEvents(prev => ({ ...prev, [voicePreview.dateKey]: (prev[voicePreview.dateKey] || []).filter(e => e.id !== voicePreview.ev.id) })); setShowAddModal(true); }}
                                    style={{ flex: 1, padding: "11px", background: "var(--theme-accent-soft)", color: "var(--theme-accent-text)", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>✏️ 수정</button>
                                <button onClick={undoVoiceEvent} style={{ padding: "11px 14px", background: "var(--bg-muted)", color: "var(--fg-secondary)", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>↩</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AlertBanner alerts={alerts} onDismiss={id => setAlerts(p => p.filter(a => a.id !== id))} />
            <EmergencyBanner emergencies={emergencies} onDismiss={(id, action) => { setEmergencies(p => p.filter(e => e.id !== id)); if (action === "contact") showNotif("📞 전화 앱을 열어주세요", "child"); }} />

            {/* ── Background location permission banner (child mode) ── */}
            {isNativeApp && !isParent && !bgLocationGranted && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth, marginBottom: 8, padding: "14px 14px", borderRadius: 18, background: "linear-gradient(135deg, var(--status-cautionary-subtle), var(--status-cautionary-subtle))", border: "1.5px solid #FDE68A", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(217,119,6,0.12)" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📍</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--status-cautionary-strong)" }}>위치 권한을 "항상 허용"으로 바꿔주세요</div>
                        <div style={{ fontSize: 11, color: "var(--status-cautionary-strong)", marginTop: 3, lineHeight: 1.45 }}>
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
                    }} style={{ padding: "9px 13px", borderRadius: 12, background: "var(--status-cautionary-strong)", color: "white", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: FF, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(217,119,6,0.2)" }}>
                        설정 열기
                    </button>
                </div>
            )}

            {/* ── Push notification permission banner ── */}
            {isNativeApp && !isParent && nativeSetupAction && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth, marginBottom: 8, padding: "12px 14px", borderRadius: 18, background: "linear-gradient(135deg, var(--status-cautionary-subtle), var(--status-cautionary-subtle))", border: "1px solid #FCD34D", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(245,158,11,0.12)" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🔔</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--status-cautionary-strong)" }}>앱이 꺼져도 알림이 바로 보이도록 설정이 더 필요해요</div>
                        <div style={{ fontSize: 11, color: "#7C2D12", marginTop: 3, lineHeight: 1.45 }}>
                            알림 권한, 전체화면 알림, 배터리 예외, 정확한 알림 중 일부가 아직 꺼져 있어요.
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await openNativeNotificationSettings(nativeSetupAction);
                        }}
                        style={{ padding: "9px 13px", borderRadius: 12, background: "#EA580C", color: "white", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: FF, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(234,88,12,0.2)" }}
                    >
                        {nativeSetupAction.label}
                    </button>
                </div>
            )}
            {!isNativeApp && pushPermission !== "granted" && pushPermission !== "unsupported" && pushPermission !== "denied" && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth, marginBottom: 8, padding: "10px 14px", borderRadius: 16, background: "var(--bg-base)", border: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🔔</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-primary)" }}>푸시 알림을 켜주세요</div>
                        <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>일정 시작 전 알림을 받을 수 있어요</div>
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
                        style={{ padding: "8px 14px", borderRadius: 12, background: "var(--hyeni-theme-gradient)", color: "var(--fg-on-primary)", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF, whiteSpace: "nowrap", boxShadow: "var(--hyeni-theme-shadow-soft)" }}>
                        허용하기
                    </button>
                </div>
            )}
            {!isNativeApp && pushPermission === "denied" && !pushDeniedDismissed && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth, marginBottom: 8, padding: "8px 12px", borderRadius: 14, background: "var(--bg-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🔕</span>
                    <div style={{ flex: 1, fontSize: 11, color: "var(--fg-secondary)", fontWeight: 500 }}>알림이 꺼져있어요. 브라우저 설정에서 켤 수 있어요</div>
                    <button onClick={() => { try { sessionStorage.setItem("hyeni-push-denied-dismissed", "1"); } catch (e) {} setPushDeniedDismissed(true); }}
                        aria-label="배너 닫기"
                        style={{ padding: "4px 8px", border: "none", background: "transparent", color: "var(--fg-tertiary)", cursor: "pointer", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>×</button>
                </div>
            )}

            <TrialEndingBanner
                trialDaysLeft={entitlement.trialDaysLeft}
                isTrial={entitlement.isTrial}
                isChild={!isParent}
                onContinue={() => startTrial(PRICING.monthlyProductId)}
            />

            {/* ── Header Row 1: Logo + 꾹 + 로그아웃 ── */}
            <div style={{ width: "100%", maxWidth: contentMaxWidth, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "10px 12px", background: "rgba(255,255,255,0.88)", border: "1px solid var(--theme-accent-line)", borderRadius: DESIGN.radius.xl, boxShadow: DESIGN.shadow.soft }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 auto" }}>
                    <div style={{ animation: bounce ? "bounce 0.4s ease" : "float 3s ease-in-out infinite", cursor: "pointer", flexShrink: 0 }} onClick={() => { setBounce(true); setTimeout(() => setBounce(false), 800); showNotif("안녕! 나는 혜니야 💗"); }}>
                        <AppBrandLogo size={isParent ? 38 : 44} radius={isParent ? 12 : 14} shadow={false} />
                    </div>
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                        <div onClick={() => setActiveView("calendar")} style={{ fontSize: isParent ? 16 : 18, fontWeight: 900, color: "var(--theme-accent-text)", whiteSpace: "nowrap", cursor: "pointer" }}>혜니캘린더</div>
                        {isParent && (
                            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
                                <span onClick={() => { if (window.confirm("역할을 다시 선택할까요?")) { setMyRole(null); setFamilyInfo(null); } }}
                                    style={{ fontSize: 10, padding: "3px 7px", borderRadius: 6, fontWeight: 700, cursor: "pointer", background: "var(--bg-subtle)", color: "var(--fg-secondary)", whiteSpace: "nowrap", flexShrink: 0 }}>
                                    학부모 모드
                                </span>
                                <button onClick={() => {
                                    if (familyId) setShowPairing(true);
                                    else setShowParentSetup(true);
                                }}
                                    style={{ fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 5, border: "none", cursor: "pointer", fontFamily: FF, background: pairedChildren.length > 0 ? "var(--status-positive-subtle)" : "var(--status-cautionary-subtle)", color: pairedChildren.length > 0 ? "#065F46" : "var(--status-cautionary-strong)", whiteSpace: "nowrap" }}>
                                    {pairedChildren.length > 0 ? `🔗 연동 (${pairedChildren.length}명)` : (familyId ? "🔗 연동하기" : "👨‍👩‍👧 가족 만들기")}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                    {isParent && (
                        <button onClick={() => { setShowAlertPanel(true); loadParentAlerts(); }}
                            style={{ position: "relative", fontSize: 18, padding: "6px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: "var(--bg-muted)", lineHeight: 1 }}>
                            🔔
                            {parentAlerts.filter(a => !a.read).length > 0 && (
                                <span style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "var(--status-negative)", color: "white", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                            background: kkukCooldown ? "var(--bg-muted)" : "var(--hyeni-theme-gradient)",
                            color: "var(--fg-on-primary)", boxShadow: kkukCooldown ? "none" : "var(--hyeni-theme-shadow-soft)",
                            transition: "all 0.2s", transform: kkukCooldown ? "scale(0.95)" : "scale(1)",
                            userSelect: "none",
                            WebkitTouchCallout: "none",
                        }}
                        title="꾹 보내기"
                        aria-label="💗 꾹">
                        💗 꾹
                    </button>
                    {isParent && (
                        <button onClick={() => setShowSettingsSheet(true)}
                            aria-label="설정"
                            title="설정"
                            style={{ fontSize: 16, width: 36, height: 36, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "var(--bg-muted)", color: "var(--fg-secondary)", border: "none", cursor: "pointer", fontFamily: FF, lineHeight: 1 }}>
                            ⚙
                        </button>
                    )}
                </div>
            </div>

            {/* Multi-child quick switch — sits directly under the top
                parent header so the chip rail is always reachable from
                any tab. Only renders for parents with 2+ paired children.
                Active chip is filled with the child's theme color. */}
            {isParent && pairedChildren.length >= 2 && (
              <div
                role="group"
                aria-label="자녀 빠른 전환"
                style={{
                  width: "100%",
                  maxWidth: contentMaxWidth,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0 4px",
                  marginBottom: 10,
                  fontFamily: FF,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    gap: 6,
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {pairedChildren.map((child) => {
                    const isActive = selectedChild?.id === child.id;
                    const tint = child.color_hex || "#A78BFA";
                    return (
                      <button
                        key={child.id || child.user_id}
                        type="button"
                        aria-pressed={isActive}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => setSelectedChildId(child.id)}
                        className="hyeni-child-switch-chip"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "5px 12px 5px 5px",
                          borderRadius: "var(--radius-full)",
                          background: isActive ? tint : "white",
                          border: `1.5px solid ${isActive ? tint : "var(--line-subtle)"}`,
                          color: isActive ? "white" : "var(--fg-secondary)",
                          fontWeight: isActive ? "var(--weight-bold)" : "var(--weight-medium)",
                          fontSize: 13,
                          cursor: "pointer",
                          fontFamily: FF,
                          flexShrink: 0,
                          outline: "2px solid transparent",
                          outlineOffset: 2,
                          transition: "background 0.16s ease, border-color 0.16s ease, color 0.16s ease",
                        }}
                      >
                        <ChildAvatar
                          child={child}
                          size={24}
                          color={isActive ? "white" : tint}
                          radius="var(--radius-full)"
                          fontSize={11}
                          decorative
                          style={{
                            border: `2px solid ${isActive ? "white" : tint}`,
                            color: isActive ? tint : "white",
                          }}
                        />
                        <span style={{ whiteSpace: "nowrap" }}>{child.name || "아이"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Phase 3 — 자녀 모드 hero (Playful-Character) */}
            {activeView === "calendar" && !isParent && (
                <section style={{ width: "100%", maxWidth: contentMaxWidth, padding: isNativeApp ? "calc(env(safe-area-inset-top, 0px) + var(--space-3)) var(--space-screen-pad) var(--space-3)" : "var(--space-3) var(--space-screen-pad)" }}>
                    <ChildHero
                        eventCount={todayEvents.length}
                        showMascot={childShowMascot}
                        onSettings={() => setShowChildSettings(true)}
                        now={today}
                    />
                    {nextTodayEvent && (
                        <button
                            type="button"
                            onClick={() => setRouteEvent(nextTodayEvent)}
                            style={{
                                marginTop: "var(--space-3)",
                                width: "100%",
                                padding: "var(--space-4)",
                                borderRadius: "var(--radius-2xl)",
                                background: "var(--bg-base)",
                                border: "1px solid var(--line-soft)",
                                boxShadow: "var(--child-quick-card-shadow)",
                                textAlign: "left",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-3)",
                            }}
                            aria-label={`다음 일정 · ${nextTodayEvent.time || ""} ${nextTodayEvent.title || ""} 길찾기`}
                        >
                            <span style={{ fontSize: 28 }} aria-hidden="true">{(CATEGORIES.find((c) => c.id === nextTodayEvent.category)?.emoji) || "📌"}</span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: "block", fontSize: 12, color: "var(--fg-secondary)", fontWeight: "var(--weight-semibold)" }}>다음 일정 · {nextTodayEvent.time || ""}</span>
                                <span style={{ display: "block", fontSize: 16, color: "var(--fg-primary)", fontWeight: "var(--weight-bold)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nextTodayEvent.title}</span>
                            </span>
                            <span aria-hidden="true" style={{ fontSize: 18, color: "var(--fg-tertiary)", flexShrink: 0 }}>›</span>
                        </button>
                    )}
                </section>
            )}

            {activeView === "calendar" && isParent && (
                <section
                    aria-label={heroTitle}
                    className={isParent ? "hyeni-v1-parent-hero" : undefined}
                    style={{
                        width: "100%",
                        maxWidth: contentMaxWidth,
                        background: isParent
                            ? "transparent"
                            : DESIGN.gradients.hero,
                        padding: isParent ? "14px 2px 18px" : (isNativeApp ? "68px 22px 24px" : "20px 22px 24px"),
                        borderRadius: isParent ? 0 : DESIGN.radius.hero,
                        color: isParent ? "#1F1A22" : "white",
                        position: "relative",
                        overflow: "hidden",
                        marginBottom: isParent ? 0 : 18,
                        boxShadow: isParent
                            ? "none"
                            : DESIGN.shadow.elevated,
                        minHeight: isParent ? "auto" : (isNativeApp ? 294 : 246),
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
                            boxShadow: "var(--hyeni-theme-shadow), 0 0 0 5px rgba(255,255,255,0.4)",
                            overflow: "hidden",
                            background: "rgba(255,255,255,0.18)",
                        }}
                    >
                        <AppBrandLogo size={100} radius={28} shadow={false} />
                    </div>}
                    {isParent && (
                        <button
                            type="button"
                            onClick={() => setShowParentSettings(true)}
                            aria-label="설정"
                            style={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                zIndex: 2,
                                width: 36, height: 36,
                                borderRadius: "var(--radius-md)",
                                border: "1px solid var(--line-soft)",
                                background: "var(--bg-base)",
                                cursor: "pointer",
                                fontSize: 16,
                                color: "var(--fg-secondary)",
                                fontFamily: "inherit",
                            }}
                        >
                            ⚙
                        </button>
                    )}
                    <div style={{ position: "relative", zIndex: 1, maxWidth: isParent ? "100%" : 270 }}>
                        <div style={{ fontSize: isParent ? 13 : 11, fontWeight: isParent ? 600 : 800, color: isParent ? "#6B5F73" : undefined, opacity: isParent ? 1 : 0.9, marginBottom: isParent ? 4 : 7, display: "flex", alignItems: "center", gap: 6 }}>
                            {todayDateLabel}
                        </div>
                        {isParent ? (
                            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.2, color: "var(--fg-primary)", textShadow: "none" }}>
                                {parentHeroChildrenText},<br />
                                {todayEvents.length > 0
                                    ? <>오늘 일정 <span className="hyeni-v1-hero-count">{todayEvents.length}개</span></>
                                    : <span className="hyeni-v1-hero-count-zero">오늘은 여유로워요</span>}
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
                                        color: "var(--theme-accent-text)",
                                        border: "1px solid var(--theme-accent-line)",
                                        boxShadow: "var(--hyeni-theme-shadow-soft)",
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
                                    background: "var(--status-cautionary-subtle)",
                                    color: "var(--status-cautionary-strong)",
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
                                    color: "var(--status-positive-strong)",
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
                        {!isParent && (
                            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 270 }}>
                                <button
                                    type="button"
                                    onClick={handleHomeRouteClick}
                                    style={{
                                        border: "none",
                                        borderRadius: 18,
                                        padding: "10px 14px",
                                        background: homeRouteEvent ? "#ECFDF5" : "rgba(255,255,255,0.82)",
                                        color: homeRouteEvent ? "var(--status-positive-strong)" : "#9CA3AF",
                                        fontSize: 12,
                                        fontWeight: 900,
                                        cursor: "pointer",
                                        boxShadow: "0 6px 16px rgba(16,185,129,0.18)",
                                        fontFamily: FF,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                        maxWidth: "100%",
                                    }}
                                >
                                    <span aria-hidden="true">🏠</span>
                                    집으로 가기
                                </button>
                                {nextTodayEvent?.location && (
                                    <button
                                        type="button"
                                        onClick={() => setRouteEvent(nextTodayEvent)}
                                        style={{
                                            border: "none",
                                            borderRadius: 18,
                                            padding: "10px 14px",
                                            background: "rgba(255,255,255,0.94)",
                                            color: "var(--theme-accent-text)",
                                            fontSize: 12,
                                            fontWeight: 900,
                                            cursor: "pointer",
                                            boxShadow: "var(--hyeni-theme-shadow-soft)",
                                            fontFamily: FF,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 6,
                                            maxWidth: "100%",
                                        }}
                                    >
                                        <span aria-hidden="true">🏃</span>
                                        다음 일정으로 가기
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Hero 바로 아래: 친구 만남 진행 중 알림 (active 일 때만 렌더) */}
            {familyId && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth }}>
                    <ActivePlaydateBanner familyId={familyId} isParent={isParent} />
                </div>
            )}

            {/* ── Phase 3 자녀 모드 빠른 실행 grid (2x2) + 부모 연락 + 친구만남 ── */}
            {!isParent && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth, padding: "0 var(--space-screen-pad)", marginBottom: "var(--space-3)" }}>
                    <div className="child-quick-grid" style={{ marginBottom: "var(--space-3)" }}>
                        <button
                            type="button"
                            className="child-quick-card"
                            data-tone="memo"
                            onClick={handleChildMemoOpen}
                            aria-label={`부모님 메모 ${memoPreviewCount || 0}개`}
                        >
                            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                                <span aria-hidden="true" style={{ fontSize: 22 }}>💌</span>
                                <span className="t-child-quick-label">메모</span>
                            </span>
                            <span className="t-child-quick-meta">
                                {memoPreviewCount > 0 ? `${memoPreviewCount}개 · 눌러서 보기` : "눌러서 답장하기"}
                            </span>
                            {memoPreviewCount > 0 && <span className="child-quick-card-dot" aria-hidden="true" />}
                        </button>
                        <button
                            type="button"
                            className="child-quick-card"
                            data-tone="sticker"
                            onClick={() => setShowSendStickerSheet(true)}
                            aria-label="스티커 보내기"
                        >
                            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                                <span aria-hidden="true" style={{ fontSize: 22 }}>🎁</span>
                                <span className="t-child-quick-label">스티커 보내기</span>
                            </span>
                            <span className="t-child-quick-meta">부모님께 마음 전하기</span>
                        </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <ChildCallCard phones={parentPhones} />
                        {familyId && (
                            <div
                                style={{
                                    background: "var(--bg-base)",
                                    borderRadius: "var(--radius-card)",
                                    padding: "var(--space-3) var(--space-4)",
                                    border: "1px solid var(--line-soft)",
                                    boxShadow: "var(--child-quick-card-shadow)",
                                }}
                            >
                                <FriendPlaydateChildPanel familyId={familyId} currentUserId={authUser?.id} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── HOME VIEW (multi-child only) ── */}
            {activeView === "home" && isMultiChild && (
              <div className="hyeni-v5-parent-main" aria-label="가족 홈">
                {multiChildHint && (
                  <div
                    role="status"
                    aria-live="polite"
                    onClick={() => setMultiChildHint(null)}
                    style={{
                      margin: "10px 16px 0",
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "linear-gradient(135deg,var(--status-cautionary-subtle),#FFEDD5)",
                      border: "1.5px solid #FDBA74",
                      color: "var(--status-cautionary-strong)",
                      fontSize: 13,
                      fontWeight: 700,
                      lineHeight: 1.45,
                      cursor: "pointer",
                      fontFamily: FF,
                    }}
                  >
                    {multiChildHint}
                  </div>
                )}
                <HomeTab
                  children={pairedChildren}
                  positions={displayChildPositions}
                  events={todayEvents}
                  childLocations={homeChildLocationLabels}
                  childDeviceStatusMap={childDeviceStatusMap}
                  onMapTap={() => setShowChildTracker(true)}
                  onSelectChild={(childId) => setChildDetailId(childId)}
                />
                {renderParentBottomTabbar("home", "hyeni-v5-tabbar-fixed")}
              </div>
            )}

            {/* ── CALENDAR VIEW ── */}
            {/* Multi-child + no selection: show the per-child today aggregate
                instead of the single-child dashboard. Tapping a child card
                drops into the regular per-child view via setSelectedChildId. */}
            {activeView === "calendar" && isParent && isMultiChild && !selectedChildId && (
                <>
                    <TodayMultiChildView
                        children={pairedChildren}
                        todayEvents={todayEvents}
                        onSelectChild={(childId) => setSelectedChildId(childId)}
                        onRefreshDevices={requestChildDeviceStatusRefresh}
                    />
                    {renderParentBottomTabbar("today", "hyeni-v5-tabbar-fixed")}
                </>
            )}
            {activeView === "calendar" && !(isParent && isMultiChild && !selectedChildId) && (isParent ? (
                <div className="hyeni-v5-parent-main" aria-label="부모 메인">
                    <div className="hyeni-v5-section-head">
                        <span>아이 현황</span>
                        <span className="hyeni-v5-section-meta hyeni-v1-live-meta">
                            {displayChildPos ? "실시간" : "연결 준비 중"}
                            {displayChildPos && <span aria-hidden="true">●</span>}
                        </span>
                    </div>
                    <div className="hyeni-v5-kids-grid">
                        {dashboardChildren.map((child, index) => {
                            const childLocationLabel = getDashboardChildLocationLabel(child, index);
                            const childIsLive = !!getDashboardChildPosition(child, index);
                            const nextLabel = nextTodayEvent
                                ? `다음 일정 · ${nextTodayEvent.time || "시간 미정"}`
                                : "오늘 일정 없음";
                            return (
                                <button
                                    key={child.user_id || child.id || index}
                                    type="button"
                                    onClick={() => setShowChildTracker(true)}
                                    className="hyeni-v5-kid-card"
                                    style={{ cursor: "pointer", fontFamily: FF }}
                                    aria-label={`${child.name || "아이"} 현황 · ${childLocationLabel} · ${nextLabel}`}
                                >
                                    <span
                                        className={`hyeni-v5-kid-avatar ${index % 2 === 1 ? "blue" : ""}`}
                                    >
                                        <ChildAvatar child={child} size={36} radius={12} fontSize={20} />
                                        {childIsLive && <span className="live" />}
                                    </span>
                                    <span className="hyeni-v5-kid-info">
                                        <span className="hyeni-v5-kid-name">{child.name || "아이"}</span>
                                        <span className={`hyeni-v5-kid-loc${childIsLive ? " is-live" : ""}`}>
                                            <span aria-hidden="true">{childIsLive ? "📍" : "🕘"}</span>
                                            <span>{childLocationLabel}</span>
                                        </span>
                                        <span className={`hyeni-v5-kid-next${nextTodayEvent ? " has-event" : ""}`}>
                                            {nextLabel}
                                        </span>
                                    </span>
                                    <span className="hyeni-v5-kid-chev" aria-hidden="true">›</span>
                                </button>
                            );
                        })}
                    </div>

                    {isParent && !selectedChild && pairedChildren.filter(c => c.user_id).length > 1 ? (
                        <section
                            aria-label="아이 기기 사용 지표"
                            style={{
                                marginTop: 12,
                                marginBottom: 12,
                                background: "linear-gradient(135deg,var(--theme-accent-soft),var(--hyeni-surface-warm))",
                                border: "1px solid var(--theme-accent-line)",
                                borderRadius: 16,
                                padding: "12px 14px",
                                boxShadow: "var(--hyeni-theme-shadow-soft)",
                                fontFamily: FF
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--theme-accent-text)" }}>📱 아이 기기 안전 지표</div>
                                <button
                                    type="button"
                                    onClick={handleParentDeviceRefreshClick}
                                    style={{ border: "1px solid var(--theme-accent-line)", background: "white", color: "var(--theme-accent-text)", borderRadius: 10, padding: "5px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: FF, flexShrink: 0 }}
                                >
                                    지금 갱신
                                </button>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {pairedChildren.filter(c => c.user_id).map((c) => (
                                    <ChildDeviceCard
                                        key={c.user_id}
                                        child={c}
                                        status={childDeviceStatusMap[c.user_id]}
                                    />
                                ))}
                            </div>
                        </section>
                    ) : (
                        <section
                            aria-label="아이 기기 사용 지표"
                            style={{
                                marginTop: 12,
                                marginBottom: 12,
                                background: "linear-gradient(135deg,var(--theme-accent-soft),var(--hyeni-surface-warm))",
                                border: "1px solid var(--theme-accent-line)",
                                borderRadius: 16,
                                padding: "12px 14px",
                                boxShadow: "var(--hyeni-theme-shadow-soft)",
                                fontFamily: FF
                            }}
                        >
                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--theme-accent-text)", marginBottom: 8 }}>📱 아이 기기 안전 지표 · {primaryDeviceChildName}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                                <div style={{ background: "white", borderRadius: 12, padding: "9px 10px" }}>
                                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", fontWeight: 700 }}>배터리</div>
                                    <div style={{ fontSize: 16, color: "var(--fg-primary)", fontWeight: 900, marginTop: 2 }}>🔋 {primaryDeviceBatteryLabel}</div>
                                </div>
                                <div style={{ background: "white", borderRadius: 12, padding: "9px 10px" }}>
                                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", fontWeight: 700 }}>충전 상태</div>
                                    <div style={{ fontSize: 15, color: "var(--fg-primary)", fontWeight: 900, marginTop: 2 }}>⚡ {primaryDeviceChargingLabel}</div>
                                </div>
                                <div style={{ background: "white", borderRadius: 12, padding: "9px 10px" }}>
                                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", fontWeight: 700 }}>화면 켜짐(앱 기준)</div>
                                    <div style={{ fontSize: 15, color: "var(--fg-primary)", fontWeight: 900, marginTop: 2 }}>⏱️ {primaryDeviceScreenLabel}</div>
                                </div>
                                <div style={{ background: "white", borderRadius: 12, padding: "9px 10px" }}>
                                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", fontWeight: 700 }}>네트워크</div>
                                    <div style={{ fontSize: 14, color: "var(--fg-primary)", fontWeight: 900, marginTop: 2 }}>📶 {primaryDeviceConnectionLabel}</div>
                                </div>
                                <div style={{ background: "white", borderRadius: 12, padding: "9px 10px", gridColumn: "1 / -1" }}>
                                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", fontWeight: 700 }}>최근 실행 앱</div>
                                    <div style={{ fontSize: 13, color: "var(--fg-primary)", fontWeight: 800, marginTop: 2 }}>
                                        {primaryChildDeviceStatus?.recentApp || "사용기록 권한 허용이 필요해요"}
                                    </div>
                                    {primaryChildDeviceStatus?.usagePermission === "requires_permission" && (
                                        <div style={{ fontSize: 10, color: "var(--status-cautionary-strong)", marginTop: 3, fontWeight: 700 }}>
                                            Usage Access 권한을 켜면 실제 최근 앱 목록을 가져와요.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
                                <div style={{ fontSize: 10.5, color: "var(--fg-secondary)", fontWeight: 600 }}>
                                    마지막 업데이트: {primaryDeviceUpdatedLabel} · 상태: <span style={{ color: primaryDeviceSafetyLabel === "양호" ? "#059669" : "var(--status-cautionary-strong)", fontWeight: 800 }}>{primaryDeviceSafetyLabel}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleParentDeviceRefreshClick}
                                    style={{ border: "1px solid var(--theme-accent-line)", background: "white", color: "var(--theme-accent-text)", borderRadius: 10, padding: "5px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: FF, flexShrink: 0 }}
                                >
                                    지금 갱신
                                </button>
                            </div>
                        </section>
                    )}

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
                        <span className="hyeni-v5-memo-count">{memoPreviewCount}</span>
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
                        {renderParentCalendarGrid("parent-main")}
                    </section>

                    {renderSelectedDateMovementSummary()}

                     {parentCapabilities.canWriteSchedule && (
                     <div className="hyeni-v5-add-row">
                         <button type="button" className="hyeni-v5-ai-button" aria-label={AI_SCHEDULE_BUTTON_LABEL} onClick={openAiSchedule} style={{ fontFamily: FF }}>
                             빠른 일정입력
                         </button>
                         <button type="button" className="hyeni-v5-plus-button" onClick={() => {
                            setEventChildSelection(getDefaultEventChildSelection());
                            setShowAddModal(true);
                          }} style={{ fontFamily: FF }} aria-label="+" title="일정 추가">
                            +
                        </button>
                    </div>
                    )}

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
                                <div style={{ fontWeight: 800 }}>선택한 날짜에 등록된 일정이 없어요.</div>
                                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>{parentCapabilities.canWriteSchedule ? "아래 + 버튼으로 일정을 추가해 주세요." : "가족 연동 후 일정을 추가할 수 있어요."}</div>
                            </div>
                        )}
                    </div>

                    {renderParentBottomTabbar("today", "hyeni-v5-tabbar-fixed")}

                </div>
            ) : <>
                <div style={{ ...cardSt, padding: "18px 14px 16px", borderRadius: DESIGN.radius.xl }}>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14, padding: "0 6px" }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--theme-accent-text)" }}>
                                {currentYear}
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: DESIGN.colors.ink, lineHeight: 1 }}>
                                {MONTHS_KO[currentMonth]}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={prevMonth} aria-label="이전 달" style={{ width: 36, height: 36, borderRadius: "50%", background: "white", border: "none", fontSize: 18, cursor: "pointer", color: "var(--theme-accent-text)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--hyeni-theme-shadow-soft)", fontWeight: 800 }}>‹</button>
                            <button onClick={nextMonth} aria-label="다음 달" style={{ width: 36, height: 36, borderRadius: "50%", background: "white", border: "none", fontSize: 18, cursor: "pointer", color: "var(--theme-accent-text)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--hyeni-theme-shadow-soft)", fontWeight: 800 }}>›</button>
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "0 2px 6px", fontSize: 10, fontWeight: 800, textAlign: "center", color: "var(--theme-accent-text)" }}>
                        {DAYS_KO.map((d) => <div key={d} style={{ padding: "4px 0", color: "var(--fg-secondary)" }}>{d}</div>)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, padding: "12px 8px", background: "white", borderRadius: DESIGN.radius.xl, boxShadow: "var(--hyeni-theme-shadow-soft)", border: "2px solid var(--theme-accent-line)" }}>
                        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} style={{ minHeight: 44 }} />)}
                        {Array(getDays).fill(null).map((_, i) => {
                            const day = i + 1;
                            const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                            const isSel = day === selectedDate;
                            // 자녀 프라이버시: visibleEvents 사용
                            const dayEvs = visibleEvents[`${currentYear}-${currentMonth}-${day}`] || [];
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
                                        color: activeCell ? "white" : "var(--fg-primary)",
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
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-tertiary)", marginBottom: 8, paddingLeft: 4 }}>🏫 학원 빠른 추가</div>
                        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                            {academies.map((ac, i) => (
                                <button key={i} onClick={() => {
                                    const cat = CATEGORIES.find(c => c.id === ac.category);
                                    const _ev = { id: Date.now(), title: ac.name, time: "15:00", category: ac.category, emoji: ac.emoji || cat.emoji, color: ac.color || cat.color, bg: ac.bg || cat.bg, memo: "", location: ac.location || null, notifOverride: null };
                                    setNewTitle(ac.name); setNewCategory(ac.category); setNewLocation(ac.location || null);
                                    setShowAddModal(true);
                                }}
                                    style={{ flexShrink: 0, padding: "9px 14px", borderRadius: 16, border: "2px solid var(--theme-accent-line)", background: "var(--theme-accent-soft)", color: "var(--theme-accent-text)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span>{ac.emoji}</span><span>{ac.name}</span>
                                    {ac.location && <span style={{ fontSize: 10, opacity: 0.7 }}>📍</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 배너 — 추후 광고 배치용 */}
                <div style={{ width: "100%", maxWidth: contentMaxWidth, background: "linear-gradient(135deg,var(--theme-accent-soft),var(--hyeni-surface-warm))", borderRadius: 20, padding: "14px 18px", marginBottom: 14, textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--theme-accent-text)", fontFamily: FF, border: "1.5px solid var(--theme-accent-line)", boxShadow: "var(--hyeni-theme-shadow-soft)" }}>
                    혜니캘린더는 아이와 함께 만들어갑니다
                </div>

                {/* 빠른 일정입력 + 수동 추가 */}
                {(!isParent || parentCapabilities.canWriteSchedule) && (
                <div style={{ width: "100%", maxWidth: contentMaxWidth, display: "flex", gap: 8, marginBottom: 14 }}>
                    <button type="button" aria-label={AI_SCHEDULE_BUTTON_LABEL} onClick={openAiSchedule}
                        style={{
                            flex: 1, padding: "10px 16px", height: 44, color: "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: FF,
                            background: DESIGN.gradients.parent, boxShadow: "0 3px 12px rgba(37,99,235,0.22)"
                        }}>
                        빠른 일정입력
                    </button>
                    <button onClick={() => setShowAddModal(true)}
                        style={{ minWidth: isParent ? 44 : 56, height: 44, borderRadius: 14, background: "var(--hyeni-theme-gradient)", color: "white", border: "none", fontSize: isParent ? 22 : 14, fontWeight: 800, cursor: "pointer", boxShadow: "var(--hyeni-theme-shadow-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FF, gap: 2, padding: isParent ? 0 : "0 12px" }}>{isParent ? "+" : "✏️ 추가"}</button>
                </div>
                )}

                {/* Day Timetable */}
                <div style={{ ...cardSt, marginBottom: 0 }}>
                    <DayTimetable
                        events={visibleEvents[dateKey] || []}
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
                        onReplySubmit={handleMemoReplySubmit}
                        memoReadBy={memoReadBy}
                        myUserId={authUser?.id}
                        onReplyRef={registerMemoReplyNode}
                        showInlineMemo={false}
                    />
                </div>
            </>)}

            {/* ── PARENT CALENDAR PAGE ── */}
            {activeView === "parentCalendar" && isParent && (
                <section className="hyeni-v5-calendar-page" aria-label="부모 캘린더">
                    <div className="hyeni-v5-page-head">
                        <div>
                            <h2>일정</h2>
                        </div>
                        {parentCapabilities.canWriteSchedule && (
                        <button
                            type="button"
                            className="hyeni-v5-page-add"
                            onClick={() => setShowAddModal(true)}
                            style={{ fontFamily: FF }}
                            aria-label="+"
                        >
                            +
                        </button>
                        )}
                    </div>

                    {renderParentCalendarGrid("parent-page")}

                    {renderSelectedDateMovementSummary()}

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
                                <div style={{ fontWeight: 800 }}>선택한 날짜에 등록된 일정이 없어요.</div>
                                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>{parentCapabilities.canWriteSchedule ? "오른쪽 위 + 버튼으로 일정을 추가해 주세요." : "가족 연동 후 일정을 추가할 수 있어요."}</div>
                            </div>
                        )}
                    </div>

                    {renderParentBottomTabbar("calendar", "hyeni-v5-tabbar-fixed")}
                </section>
            )}

            {/* ── FRIEND PLAYDATE SETTINGS PAGE ── */}
            {activeView === "friendPlaydateSettings" && isParent && (
                <section className="hyeni-v5-calendar-page" aria-label="친구놀이 관리">
                    <div className="hyeni-v5-page-head">
                        <div>
                            <div className="hyeni-v5-page-kicker">안전장소 매칭 설정</div>
                            <h2>친구놀이</h2>
                        </div>
                        <button
                            type="button"
                            className="hyeni-v5-page-add"
                            onClick={handleParentTodayTabClick}
                            style={{ fontFamily: FF, fontSize: 18 }}
                            aria-label="홈으로"
                        >
                            ×
                        </button>
                    </div>
                    <div style={{ fontFamily: FF }}>
                        {familyId ? (
                            <FriendPlaydatePanel
                                familyId={familyId}
                                currentUserId={authUser?.id}
                                onAddSafePlace={handleOpenPlaydatePlaceMgr}
                            />
                        ) : (
                            <div className="hyeni-tool-empty">
                                가족 연동 후 친구 만남을 설정할 수 있어요.
                            </div>
                        )}
                    </div>
                    {renderParentBottomTabbar("tools", "hyeni-v5-tabbar-fixed")}
                </section>
            )}

            {/* ── FORCE RING PAGE ── */}
            {activeView === "forceRing" && isParent && (
                <section className="hyeni-v5-calendar-page" aria-label="응급 강제 알림">
                    <div className="hyeni-v5-page-head">
                        <div>
                            <div className="hyeni-v5-page-kicker">진짜 응급 상황에서만 사용</div>
                            <h2>응급 강제 알림</h2>
                        </div>
                        <button
                            type="button"
                            className="hyeni-v5-page-add"
                            onClick={handleParentTodayTabClick}
                            style={{ fontFamily: FF, fontSize: 18 }}
                            aria-label="홈으로"
                        >
                            ×
                        </button>
                    </div>
                    <div style={{ fontFamily: FF }}>
                        <ForceRingPanel
                            familyId={familyId}
                            hasChild={(familyInfo?.members ?? []).some(m => m.role === "child")}
                        />
                    </div>
                    {renderParentBottomTabbar("tools", "hyeni-v5-tabbar-fixed")}
                </section>
            )}

            {/* ── MAP LIST VIEW ── */}
            {activeView === "maplist" && (
                <div className={isParent ? "hyeni-v5-maplist-with-tabbar" : undefined}>
                    <LocationMapView
                        events={visibleEvents}
                        childPos={isParent ? displayChildPos : (ownPosition || displayChildPos)}
                        mapReady={mapReady}
                        arrivedSet={arrivedSet}
                        locationHint={locationGateHint}
                        savedPlaces={savedPlaces}
                        isParentMode={isParent}
                        savedPlacesLocked={!entitlement.canUse(FEATURES.SAVED_PLACES)}
                        onAddSavedPlace={handleOpenSavedPlaceMgr}
                        displayChildPositions={isParent ? displayChildPositions : []}
                        pairedChildren={isParent ? pairedChildren : []}
                    />
                    {isParent && renderParentBottomTabbar("maplist", "hyeni-v5-tabbar-fixed")}
                </div>
            )}

            {/* ── EVENT SHEET (Phase 2) ── */}
            <EventSheet
                open={showAddModal}
                title={editingEventId ? "일정 수정" : "새 일정"}
                saveLabel={editingEventId ? "수정" : "저장"}
                onClose={() => { setShowAddModal(false); setEditingEventId(null); setNewTitle(""); setNewEndTime(""); setNewLocation(null); setSelectedPreset(null); setWeeklyRepeat(false); setRepeatWeeks(4); }}
                onSave={addEvent}
            >
                {showAddModal && (
                    <>
                        {isParent && pairedChildren.length > 0 && (() => {
                            // ChildSelector stores family_members.id values in childIds (events_children FK target).
                            const selectedNames = pairedChildren
                                .filter((c) => eventChildSelection.childIds.includes(c.id))
                                .map((c) => c.name);
                            const allChildNames = pairedChildren.map((c) => c.name).join(", ");
                            let msg;
                            if (eventChildSelection.familyAll) {
                                msg = `📡 저장 시 가족 전체 (${allChildNames})에게 전송`;
                            } else if (selectedNames.length > 0) {
                                msg = `📡 저장 시 ${selectedNames.join(", ")}에게만 전송`;
                            } else {
                                msg = "📌 아래에서 받을 아이를 선택해 주세요";
                            }
                            return <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", background: "var(--bg-subtle)", borderRadius: 10, padding: "6px 12px", marginBottom: 14, display: "inline-block" }}>{msg}</div>;
                        })()}

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
                                            style={{ padding: "6px 12px", borderRadius: 16, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, border: active ? "2px solid var(--theme-accent)" : "2px solid var(--bg-muted)", background: active ? "var(--theme-accent-soft)" : "var(--bg-subtle)", color: active ? "var(--theme-accent-text)" : "#6B7280", transition: "all 0.15s" }}>
                                            {p.emoji} {p.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>📌 일정 이름 {selectedPreset && <span style={{ fontSize: 11, color: "var(--fg-tertiary)", fontWeight: 500 }}>(비워두면 "{selectedPreset.label}")</span>}</label>
                            <input style={inputSt} placeholder={selectedPreset ? `${selectedPreset.emoji} ${selectedPreset.label}` : "예) 영어 학원, 태권도..."} value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>⏰ 시간 {selectedPreset && findLastEventByTitle(selectedPreset.label) && <span style={{ fontSize: 11, color: "var(--fg-tertiary)", fontWeight: 500 }}>(지난번 시간)</span>}</label>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                <input type="time" className="hyeni-time-input" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ padding: "12px 14px", border: "2px solid var(--bg-muted)", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", flex: 1, accentColor: "var(--theme-accent)", colorScheme: "light" }} />
                                <div style={{ display: "flex", gap: 4 }}>
                                    <button onClick={() => { const [h, m] = newTime.split(":").map(Number); const nh = m > 0 ? h : Math.max(0, h - 1); const nm = m > 0 ? 0 : 30; setNewTime(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`); }}
                                        style={{ width: 36, height: 36, borderRadius: 10, border: "2px solid var(--bg-muted)", background: "#FAFAFA", cursor: "pointer", fontWeight: 800, fontSize: 16, fontFamily: FF, color: "var(--fg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                                    <button onClick={() => { const [h, m] = newTime.split(":").map(Number); const nm = m >= 30 ? 0 : 30; const nh = m >= 30 ? Math.min(23, h + 1) : h; setNewTime(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`); }}
                                        style={{ width: 36, height: 36, borderRadius: 10, border: "2px solid var(--bg-muted)", background: "#FAFAFA", cursor: "pointer", fontWeight: 800, fontSize: 16, fontFamily: FF, color: "var(--fg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                                </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {["13:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "18:00"].map(t => (
                                    <button key={t} onClick={() => setNewTime(t)}
                                        style={{ padding: "5px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FF, border: newTime === t ? "2px solid var(--theme-accent)" : "1.5px solid var(--bg-muted)", background: newTime === t ? "var(--theme-accent-soft)" : "#FAFAFA", color: newTime === t ? "var(--theme-accent-text)" : "#9CA3AF", transition: "all 0.15s" }}>
                                        {parseInt(t) > 12 ? `오후 ${parseInt(t) - 12}` : `오전 ${parseInt(t)}`}:{t.split(":")[1]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>🏁 종료시간 <span style={{ fontSize: 11, color: "var(--fg-tertiary)", fontWeight: 500 }}>(선택)</span></label>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <input type="time" className="hyeni-time-input" value={newEndTime} onChange={e => setNewEndTime(e.target.value)}
                                    style={{ padding: "12px 14px", border: `2px solid ${newEndTime ? "var(--theme-accent)" : "var(--bg-muted)"}`, borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", flex: 1, accentColor: "var(--theme-accent)", colorScheme: "light" }} />
                                {newEndTime && (
                                    <button onClick={() => setNewEndTime("")}
                                        style={{ padding: "6px 12px", borderRadius: 12, border: "none", background: "var(--bg-muted)", color: "var(--fg-tertiary)", cursor: "pointer", fontSize: 13, fontFamily: FF }}>삭제</button>
                                )}
                            </div>
                            {newEndTime && (
                                <div style={{ fontSize: 11, color: "var(--theme-accent-text)", marginTop: 4, fontWeight: 600 }}>⏱ {newTime} ~ {newEndTime}</div>
                            )}
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>🏷️ 종류 {selectedPreset && <span style={{ fontSize: 11, color: "var(--fg-tertiary)", fontWeight: 500 }}>(자동 매칭됨)</span>}</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {CATEGORIES.map(cat => {
                                    const active = newCategory === cat.id;
                                    return (
                                        <button key={cat.id} onClick={() => setNewCategory(cat.id)} style={{ padding: "8px 14px", borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF, background: active ? "var(--theme-accent-soft)" : "white", color: active ? "var(--theme-accent-text)" : "var(--fg-secondary)", border: active ? "2px solid var(--theme-accent)" : "2px solid var(--theme-accent-line)" }}>{cat.emoji} {cat.label}</button>
                                    );
                                })}
                            </div>
                        </div>
                        {(isParent || schedulePlaceOptions.length > 0 || newLocation) && (
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                                    <label style={{ ...labelSt, marginBottom: 0 }}>
                                        📍 학원/자주가는 장소 {newLocation && <span style={{ fontSize: 11, color: "#059669", fontWeight: 500 }}>(일정 위치로 적용)</span>}
                                    </label>
                                    {isParent && (
                                        <button
                                            type="button"
                                            aria-label="📍 장소관리"
                                            onClick={handleOpenSavedPlaceMgr}
                                            style={{
                                                border: "none",
                                                borderRadius: 12,
                                                padding: "7px 10px",
                                                background: "var(--hyeni-theme-gradient)",
                                                color: "white",
                                                fontSize: 11,
                                                fontWeight: 800,
                                                cursor: "pointer",
                                                fontFamily: FF,
                                                flexShrink: 0,
                                            }}
                                        >
                                            + 장소관리
                                        </button>
                                    )}
                                </div>
                                {isParent && !entitlement.canUse(FEATURES.SAVED_PLACES) && (
                                    <div style={{ fontSize: 11, color: "var(--theme-accent-text)", marginBottom: 10, fontWeight: 700, fontFamily: FF }}>
                                        유료계정은 자주가는 장소를 무제한 등록할 수 있어요
                                    </div>
                                )}
                                {schedulePlaceOptions.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                                        {schedulePlaceOptions.map((place) => {
                                            const active = getPlaceLocationKey(newLocation) === getPlaceLocationKey(place.location);
                                            return (
                                                <button
                                                    key={place.key}
                                                    type="button"
                                                    onClick={() => {
                                                        setNewLocation(place.location);
                                                        if (place.source === "academy") {
                                                            if (!newTitle.trim()) setNewTitle(place.name || "");
                                                            if (place.category) setNewCategory(place.category);
                                                            setSelectedPreset(null);
                                                        }
                                                    }}
                                                    style={{
                                                        padding: "8px 12px",
                                                        borderRadius: 16,
                                                        border: active ? "2px solid var(--theme-accent)" : "1.5px solid var(--theme-accent-line)",
                                                        background: active ? "var(--theme-accent-soft)" : "var(--hyeni-surface-warm)",
                                                        color: "var(--theme-accent-text)",
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        cursor: "pointer",
                                                        fontFamily: FF,
                                                    }}
                                                >
                                                    {place.emoji} {place.name}
                                                    <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 900, opacity: 0.72 }}>{place.badge}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {newLocation ? (
                                    <div style={{ background: "var(--theme-accent-soft)", borderRadius: 14, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                        <div style={{ fontSize: 13, color: "var(--fg-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {newLocation.address}</div>
                                        {isParent ? (
                                            <button onClick={() => { setEditingLocForEvent(null); setShowMapPicker(true); }} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid var(--theme-accent)", color: "var(--theme-accent-text)", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                        ) : (
                                            <button onClick={() => setNewLocation(null)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid #D1D5DB", color: "var(--fg-secondary)", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>지우기</button>
                                        )}
                                    </div>
                                ) : isParent ? (
                                    <button onClick={() => { setEditingLocForEvent(null); setShowMapPicker(true); }} style={{ width: "100%", padding: "12px 14px", border: "2px dashed var(--theme-accent-line)", borderRadius: 14, background: "var(--theme-accent-soft)", color: "var(--theme-accent-text)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>🗺️ 지도에서 장소 선택</button>
                                ) : (
                                    <div style={{ background: "var(--status-cautionary-subtle)", color: "var(--status-cautionary-strong)", borderRadius: 14, padding: "10px 12px", fontSize: 12, fontWeight: 700, fontFamily: FF }}>
                                        부모님이 등록한 장소를 선택하면 일정에 바로 연결돼요
                                    </div>
                                )}
                            </div>
                        )}
                        <div style={{ marginBottom: 14 }}><label style={labelSt}>📝 메모 (선택)</label><input style={inputSt} placeholder="준비물, 장소 등..." value={newMemo} onChange={e => setNewMemo(e.target.value)} /></div>
                        {!editingEventId && <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                <label style={{ ...labelSt, marginBottom: 0, flex: 1 }}>🔁 매주 같은 날에 반복</label>
                                <div onClick={() => setWeeklyRepeat(p => !p)} style={{ width: 52, height: 30, borderRadius: 15, background: weeklyRepeat ? "var(--theme-accent)" : "#E5E7EB", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                                    <div style={{ width: 24, height: 24, borderRadius: 12, background: "white", position: "absolute", top: 3, left: weeklyRepeat ? 25 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                                </div>
                            </div>
                            {weeklyRepeat && (
                                <>
                                    <div style={{ display: "flex", gap: 6, animation: "kkukFadeIn 0.2s ease", marginBottom: 8 }}>
                                        {[{ w: 4, label: "📅 1개월" }, { w: 8, label: "📅 2개월" }, { w: 12, label: "📅 3개월" }].map(({ w, label }) => (
                                            <button key={w} onClick={() => setRepeatWeeks(w)}
                                                style={{ flex: 1, padding: "8px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, border: repeatWeeks === w ? "2px solid var(--theme-accent)" : "2px solid var(--bg-muted)", background: repeatWeeks === w ? "var(--theme-accent-soft)" : "var(--bg-subtle)", color: repeatWeeks === w ? "var(--theme-accent-text)" : "#6B7280", transition: "all 0.15s" }}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--fg-tertiary)", fontWeight: 600, textAlign: "center" }}>
                                        {(() => { const [y, m, d] = dateKey.split("-").map(Number); const end = new Date(y, m, d + (repeatWeeks - 1) * 7); return `${m + 1}/${d} ~ ${end.getMonth() + 1}/${end.getDate()} 매주 ${["일","월","화","수","목","금","토"][new Date(y, m, d).getDay()]}요일`; })()}
                                    </div>
                                </>
                            )}
                        </div>}
                        {isParent && pairedChildren.length >= 2 && (
                          <div style={{ marginBottom: 14 }}>
                            <ChildSelector
                              children={pairedChildren}
                              value={eventChildSelection}
                              onChange={setEventChildSelection}
                            />
                          </div>
                        )}
                        {weeklyRepeat && !editingEventId && (
                            <div style={{ fontSize: 12, color: "var(--fg-tertiary)", textAlign: "center", marginTop: "var(--space-2)", fontWeight: "var(--weight-medium)" }}>
                                저장하면 {repeatWeeks === 4 ? "1개월" : repeatWeeks === 8 ? "2개월" : "3개월"}간 매주 같은 요일에 반복돼요
                            </div>
                        )}
                    </>
                )}
            </EventSheet>

            {/* ── CHILD DETAIL SCREEN (Phase 2) ── */}
            {childDetailId && (() => {
                const detailChild = pairedChildren.find((c) => c.id === childDetailId || c.user_id === childDetailId);
                if (!detailChild) return null;
                return (
                    <ChildDetailScreen
                        child={detailChild}
                        events={todayEvents}
                        deviceStatus={childDeviceStatusMap[detailChild.user_id]}
                        locationLabel={homeChildLocationLabels[detailChild.user_id]?.label}
                        onBack={() => setChildDetailId(null)}
                    />
                );
            })()}

            {/* ── Phase 3 자녀 설정 화면 ── */}
            {!isParent && showChildSettings && (
                <ChildSettingsScreen
                    onBack={() => setShowChildSettings(false)}
                    currentTheme={(typeof document !== "undefined"
                        ? (document.documentElement.style.getPropertyValue("--theme-accent") || "#F779A8").trim().toUpperCase()
                        : "#F779A8")}
                    onChangeTheme={(color) => applyThemeColor(color)}
                    soundEnabled={true}
                    onChangeSound={() => showNotif("알림 소리는 부모님이 잠궜어")}
                    showMascot={childShowMascot}
                    onChangeShowMascot={setChildShowMascot}
                    childName={authUser?.user_metadata?.name || familyInfo?.members?.find((m) => m.user_id === authUser?.id)?.name || ""}
                    parentNames={(familyInfo?.members || []).filter((m) => m.role === "parent").map((m) => m.name).join(", ")}
                    onRequestParentChange={() => showNotif("부모님께 변경 요청을 보냈어요")}
                    onLogout={async () => {
                        if (!window.confirm("정말 로그아웃할까?")) return;
                        try { await supabase.auth.signOut(); } catch (e) { console.error(e); }
                        if (typeof window !== "undefined") window.localStorage.removeItem("hyeni-last-role");
                        setMyRole(null);
                    }}
                />
            )}

            {/* ── Phase 3 자녀 스티커 보내기 sheet ── */}
            {!isParent && (
                <SendStickerSheet
                    open={showSendStickerSheet}
                    isSending={childSendingSticker}
                    onClose={() => setShowSendStickerSheet(false)}
                    onSend={async (emoji) => {
                        if (!authUser?.id || !familyId) {
                            showNotif("가족 연결 후 스티커를 보낼 수 있어요", "error");
                            return;
                        }
                        setChildSendingSticker(true);
                        try {
                            await addSticker(authUser.id, familyId, "", dateKey, "child_to_parent", emoji, "자녀 스티커");
                            showNotif(`${emoji} 스티커 보냈어!`);
                            setShowSendStickerSheet(false);
                        } catch (err) {
                            console.error("[child sticker]", err);
                            showNotif("스티커 보내기 실패. 다시 시도해줘", "error");
                        } finally {
                            setChildSendingSticker(false);
                        }
                    }}
                />
            )}

            {/* ── Phase 4 부모 설정 통합 화면 ── */}
            {isParent && showParentSettings && (
                <ParentSettingsScreen
                    onBack={() => setShowParentSettings(false)}
                    parentName={authUser?.user_metadata?.name || familyInfo?.members?.find((m) => m.user_id === authUser?.id)?.name || ""}
                    parentEmail={authUser?.email || ""}
                    parentPhone={(familyInfo?.members?.find((m) => m.user_id === authUser?.id)?.phone) || ""}
                    childCount={(pairedChildren || []).length}
                    onEditAccount={() => setShowPhoneSettings(true)}
                    onAddChild={() => { setShowParentSettings(false); setShowPairing(true); }}
                    onManageChildren={() => { setShowParentSettings(false); setShowPairing(true); }}
                    onOpenPhoneSettings={() => setShowPhoneSettings(true)}
                    onOpenPlaceManager={() => { setShowParentSettings(false); setShowPlaceManager(true); }}
                    onOpenSubscription={() => { setShowParentSettings(false); setShowSubscriptionSettings(true); }}
                    subscriptionPlanLabel={entitlement?.tier === "premium" ? "프리미엄" : "무료"}
                    appVersion={typeof window !== "undefined" && window.__APP_VERSION__ ? String(window.__APP_VERSION__) : ""}
                    onLogout={async () => {
                        if (!window.confirm("로그아웃 할까요?")) return;
                        try { await supabase.auth.signOut(); } catch (e) { console.error(e); }
                        if (typeof window !== "undefined") window.localStorage.removeItem("hyeni-last-role");
                        setMyRole(null);
                        setShowParentSettings(false);
                    }}
                    onCancelSubscription={() => {
                        // popup blocker 회피: 사용자 클릭 컨텍스트에서 즉시 새 탭 열고, confirm 후 닫기
                        const win = window.open("about:blank", "_blank");
                        if (!window.confirm("구독을 해지할까요?\n해지 후에도 다음 결제일까지는 사용할 수 있어요")) {
                            if (win) win.close();
                            return;
                        }
                        if (win) {
                            win.location.href = "https://play.google.com/store/account/subscriptions";
                        }
                    }}
                    onDeleteAccount={() => {
                        // 실제 deleteUser RPC는 Phase 5에서 추가 — 현재는 안내만
                        showNotif("계정 삭제는 준비 중이에요. 고객센터로 문의해주세요");
                    }}
                />
            )}

            {/* ── Phase 4 장소 관리 통합 화면 ── */}
            {isParent && showPlaceManager && (
                <PlaceManagerScreen
                    onBack={() => setShowPlaceManager(false)}
                    savedPlaces={savedPlaces}
                    academies={academies}
                    dangerZones={dangerZones}
                    onAdd={(category) => {
                        setShowPlaceManager(false);
                        if (category === "academy") setShowAcademyMgr(true);
                        else setShowSavedPlaceMgr(true);
                    }}
                />
            )}

            {/* CreatePlaydateSheet 는 Phase 5에서 backend wire 후 진입점과 함께 활성화 예정 */}

            {/* Friend Playdate panels: hero 바로 아래 banner + parent 카드 섹션 / child sticker 아래로 이동 */}

            {/* Route Overlay */}
            {routeEvent && (
                <RouteOverlay ev={routeEvent} childPos={displayChildPos} childProfile={routeChildProfile} mapReady={mapReady} mapLoadError={mapLoadError} isChildMode={!isParent} onClose={() => setRouteEvent(null)} />
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
                    activeThemeColor={activeThemeColor}
                    childDeviceStatusMap={childDeviceStatusMap}
                    maxChildren={entitlement.canUse(FEATURES.MULTI_CHILD) ? 2 : 1}
                    lockedMessage={!entitlement.canUse(FEATURES.MULTI_CHILD) ? "두 번째 아이를 추가하려면 프리미엄을 시작해 주세요" : ""}
                    pairCodeExpiresAt={familyInfo?.pairCodeExpiresAt || null}
                    canManageFamily={parentCapabilities.canManageFamily}
                    onRegenerate={async () => {
                        if (!parentCapabilities.canManageFamily) {
                            showNotif("보조 보호자는 연동 코드를 변경할 수 없어요.", "error");
                            throw new Error("co-parent regenerate blocked");
                        }
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
                        if (!parentCapabilities.canManageFamily) {
                            showNotif("보조 보호자는 연동을 해제할 수 없어요.", "error");
                            return;
                        }
                        try {
                            await unpairChild(familyId, childUserId);
                            const fam = await getMyFamily(authUser.id);
                            if (fam) setFamilyInfo(fam);
                            showNotif("연동이 해제됐어요");
                        } catch (err) { console.error("[unpair]", err); showNotif("해제 실패", "error"); }
                    }}
                    onRename={async (memberId, newName) => {
                        try {
                            const { error } = await supabase.rpc("rename_family_member_by_id", { p_family_id: familyId, p_member_id: memberId, p_new_name: newName });
                            if (error) throw error;
                            const fam = await getMyFamily(authUser.id);
                            if (fam) setFamilyInfo(fam);
                            showNotif(`이름이 "${newName}"으로 변경됐어요`);
                            return true;
                        } catch (err) { console.error("[rename]", err); showNotif("이름 변경 실패: " + (err.message || err), "error"); return false; }
                    }}
                    onProfileChange={async (memberId, profile) => {
                        try {
                            const { error } = await supabase.rpc("set_family_member_profile_by_id", {
                                p_family_id: familyId,
                                p_member_id: memberId,
                                p_new_name: profile.name,
                                p_color_hex: profile.colorHex,
                            });
                            if (error) throw error;
                            const fam = await getMyFamily(authUser.id);
                            if (fam) setFamilyInfo(fam);
                            const activeMemberId = isParent
                                ? (selectedChild?.id || pairedChildren[0]?.id || null)
                                : (pairedChildren.find(child => child.user_id === authUser?.id)?.id || null);
                            if (activeMemberId === memberId) {
                                applyThemeColor(profile.colorHex);
                            } else {
                                applyThemeColor(activeThemeColor || null);
                            }
                            showNotif(`프로필이 "${profile.name}"으로 저장됐어요`);
                            return true;
                        } catch (err) {
                            console.error("[profile update]", err);
                            if (isMissingProfileThemeRpcError(err)) {
                                showNotif(PROFILE_THEME_RPC_MISSING_MESSAGE, "error");
                            } else {
                                showNotif("프로필 저장 실패: " + (err.message || err), "error");
                            }
                            return false;
                        }
                    }}
                    onPhotoChange={async (memberId, photoUrl) => {
                        try {
                            const { error } = await supabase.rpc("set_family_member_photo_url_by_id", {
                                p_family_id: familyId,
                                p_member_id: memberId,
                                p_url: photoUrl,
                            });
                            if (error) throw error;
                            const fam = await getMyFamily(authUser.id);
                            if (fam) setFamilyInfo(fam);
                            showNotif("사진이 변경됐어요");
                            return true;
                        } catch (err) {
                            console.error("[photo update]", err);
                            showNotif("사진 변경 실패: " + (err.message || err), "error");
                            return false;
                        }
                    }}
                    onConfirm={openConfirmDialog}
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
                            role={isParent ? "parent" : "child"}
                            familyId={familyId}
                            childList={pairedChildren}
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
                                color: "var(--fg-secondary)",
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

            {showRemoteAudio && isParent && entitlement.canUse(FEATURES.REMOTE_AUDIO) && (
                <AmbientAudioRecorder
                    channel={realtimeChannel.current}
                    familyId={familyId}
                    senderUserId={authUser?.id}
                    pairedChildren={pairedChildren}
                    targetChildUserId={selectedChild?.user_id || null}
                    childDeviceStatusMap={childDeviceStatusMap}
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
                            <div style={{ width: 46, height: 46, borderRadius: 16, background: "var(--status-cautionary-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🎤</div>
                            <div>
                                <div id="mic-permission-title" style={{ fontSize: 18, fontWeight: 900, color: "var(--status-cautionary-strong)" }}>마이크 권한이 필요해요</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--status-cautionary-strong)", marginTop: 2 }}>주위 소리 듣기 연결이 중단됐어요</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--fg-secondary)", fontWeight: 600, marginBottom: 14 }}>
                            아이 기기에서 마이크 권한을 허용해야 부모님과 주위 소리 듣기 세션을 안전하게 연결할 수 있어요.
                        </div>
                        <div style={{ background: "var(--status-cautionary-subtle)", border: "1px solid #FDE68A", borderRadius: 16, padding: "12px 14px", color: "var(--status-cautionary-strong)", fontSize: 12, lineHeight: 1.55, fontWeight: 800, marginBottom: 16 }}>
                            Android 설정 &gt; 앱 &gt; 혜니캘린더 &gt; 권한 &gt; 마이크 &gt; 허용
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            {isNativeApp && (
                                <button
                                    type="button"
                                    onClick={openAppPermissionSettings}
                                    style={{ flex: 1, padding: "13px 14px", borderRadius: 14, border: "none", background: "var(--status-cautionary-strong)", color: "white", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: FF }}
                                >
                                    설정 열기
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowMicPermissionHelp(false)}
                                style={{ flex: 1, padding: "13px 14px", borderRadius: 14, border: "none", background: "var(--bg-muted)", color: "var(--fg-secondary)", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: FF }}
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
                 pairedChildren={pairedChildren}
                 events={visibleEvents} academies={academies} childLocationLabels={childLocationLabels}
                 selectedChildUserId={selectedChild?.user_id || null}
                 mapReady={mapReady}
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
                    if (!parentCapabilities.canEditParentPhones) {
                        showNotif("보조 보호자는 연락처를 변경할 수 없어요.", "error");
                        setShowPhoneSettings(false);
                        return;
                    }
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
            {showAiSchedule && parentCapabilities.canWriteSchedule && <AiScheduleModal
                academies={academies}
                currentDate={{ year: currentYear, month: currentMonth, day: selectedDate }}
                familyId={familyId}
                authUser={authUser}
                events={events[dateKey] || []}
                eventSelection={getEffectiveEventChildSelection()}
                startVoiceFn={startVoice}
                onSave={(newEv, dk) => {
                    if (!parentCapabilities.canWriteSchedule) {
                        showNotif("보조 보호자는 일정을 확인만 할 수 있어요.", "error");
                        return;
                    }
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
                    if (!parentCapabilities.canManagePlaces) {
                        showNotif("보조 보호자는 위험지역을 수정할 수 없어요.", "error");
                        throw new Error("co-parent danger zone blocked");
                    }
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
                    if (!parentCapabilities.canManagePlaces) {
                        showNotif("보조 보호자는 위험지역을 수정할 수 없어요.", "error");
                        return;
                    }
                    await deleteDangerZone(id);
                    setDangerZones(prev => prev.filter(z => z.id !== id));
                    setFiredDangerAlerts(prev => { const n = new Set(prev); n.delete(id); return n; });
                    showNotif("위험지역이 삭제됐어요");
                }}
                onClose={() => setShowDangerZones(false)}
            />}

            <AppConfirmDialog
                dialog={confirmDialog}
                onCancel={closeConfirmDialog}
                onConfirm={handleConfirmDialogConfirm}
            />

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
                        background: "linear-gradient(135deg, var(--status-negative-strong), var(--status-negative-strong))",
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
                    background: "linear-gradient(135deg, var(--theme-accent-soft), var(--hyeni-surface-warm), var(--theme-accent-soft))",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    fontFamily: FF, animation: "kkukFadeIn 0.3s ease"
                }}
                    onClick={() => setShowKkukReceived(null)}>
                    <style>{`
                        @keyframes kkukFadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
                        @keyframes kkukPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
                        @keyframes kkukFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
                    `}</style>
                    <div style={{
                        animation: "kkukPulse 1.2s ease-in-out infinite",
                        marginBottom: 18,
                        width: 112,
                        height: 112,
                        borderRadius: 34,
                        background: "rgba(255,255,255,0.86)",
                        border: "2px solid var(--theme-accent-line)",
                        boxShadow: "var(--hyeni-theme-shadow)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                    }}>
                        <span aria-hidden="true" style={{ position: "absolute", inset: 10, borderRadius: 28, background: "var(--theme-accent-soft)" }} />
                        <span aria-hidden="true" style={{ position: "relative", fontSize: 54, lineHeight: 1 }}>{showKkukReceived.emoji || "👧"}</span>
                    </div>
                    <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 16, animation: "kkukFloat 2s ease-in-out infinite", color: "var(--theme-accent-text)" }}>♥</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "var(--theme-accent-text)", marginBottom: 8, textAlign: "center" }}>
                        꾹!
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--theme-accent-text)", marginBottom: 32, textAlign: "center" }}>
                        {showKkukReceived.from}가 꾹을 보냈어요
                    </div>
                    <div style={{
                        fontSize: 14, color: "var(--fg-tertiary)", padding: "12px 24px",
                        background: "rgba(255,255,255,0.6)", borderRadius: 20, fontWeight: 600,
                    }}>
                        화면을 터치하면 닫혀요
                    </div>
                </div>
            )}

        </div>
    );
}
