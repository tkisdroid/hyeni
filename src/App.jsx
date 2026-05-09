import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sun, Sparkles, Home, Calendar, MapPin } from "lucide-react";
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
import { ThreeDIcon } from "./components/icons/ThreeDIcon.jsx";
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
import { fetchEvents, fetchEventById, fetchAcademies, fetchMemos, fetchSavedPlaces, insertEvent, updateEvent, deleteEvent as dbDeleteEvent, insertAcademy, updateAcademy, deleteAcademy as dbDeleteAcademy, insertSavedPlace, updateSavedPlace, deleteSavedPlace, upsertMemo, subscribeFamily, unsubscribe, getCachedEvents, getCachedAcademies, getCachedMemos, getCachedSavedPlaces, cacheEvents, cacheAcademies, cacheMemos, cacheSavedPlaces, saveChildLocation, fetchChildLocations, saveLocationHistory, saveLocationHistoryRows, fetchTodayLocationHistory, fetchLocationHistoryForDate, addSticker, fetchStickersForDate, fetchStickerSummary, fetchDangerZones, saveDangerZone, deleteDangerZone, fetchParentAlerts, markAlertRead, fetchMemoReplies, fetchMemoRepliesForDateKeys, sendMemo, markMemoReplyRead } from "./lib/sync.js";
import { registerSW, requestPermission, getPermissionStatus, scheduleNotifications, scheduleNativeAlarms, showArrivalNotification, showEmergencyNotification, showKkukNotification, clearAllScheduled, subscribeToPush, unsubscribeFromPush, getNativeNotificationHealth, openNativeNotificationSettings, requestNativePermission, DEFAULT_NOTIFICATION_SETTINGS, normalizeNotifSettings } from "./lib/pushNotifications.js";
import { supabase } from "./lib/supabase.js";
import { applyThemeColor, initThemeFromCache } from "./lib/theme.js";
import { FEATURES } from "./lib/features.js";
import { useEntitlement } from "./lib/entitlement.js";
import { readFamilyInfoCache, writeFamilyInfoCache } from "./lib/familyInfoCache.js";
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
    finiteNumber,
    compactRoutePoints,
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
    buildDetailedLocationHistoryRows,
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
// routeParsers used only inside ./lib/walkingRoute.js (extracted with RouteOverlay).
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
import { fetchWalkingRoute, ROUTE_REQUEST_TIMEOUT_MS } from "./lib/walkingRoute.js";
import { CHILD_MARKER_COLORS } from "./lib/markerColors.js";
import { MapZoomControls } from "./components/map/MapZoomControls.jsx";
import { FallbackMapCanvas } from "./components/map/FallbackMapCanvas.jsx";
import { MapPicker } from "./components/map/MapPicker.jsx";
import { CATEGORIES, ACADEMY_PRESETS } from "./lib/scheduleCategories.js";
import { AcademyManager } from "./components/place-management/AcademyManager.jsx";
import { LocationMapView } from "./components/map/LocationMapView.jsx";
import { ChildTrackerOverlay } from "./components/childTracker/ChildTrackerOverlay.jsx";
import { DailyTrailMap } from "./components/childTracker/DailyTrailMap.jsx";
import { MemoSection } from "./components/memo/MemoSection.jsx";
import { PairingModal } from "./components/pairing/PairingModal.jsx";
import { summarizeRemoteListenHealth, resolveChildRemoteListenHealth } from "./lib/remoteListenHealth.js";
import { sendInstantPush } from "./lib/instantPush.js";
import { AiScheduleModal } from "./components/aiSchedule/AiScheduleModal.jsx";
import { AmbientAudioRecorder } from "./components/audio/AmbientAudioRecorder.jsx";
import { DayTimetable } from "./components/timetable/DayTimetable.jsx";
import { DangerZoneManager } from "./components/dangerZone/DangerZoneManager.jsx";
import { RouteOverlay } from "./components/route/RouteOverlay.jsx";
import { StickerBookModal } from "./components/sticker/StickerBookModal.jsx";
import { SavedPlaceManager } from "./components/place-management/SavedPlaceManager.jsx";
import { ChildPairInput } from "./components/childMode/ChildPairInput.jsx";
import { ParentMemoPage } from "./components/memo/ParentMemoPage.jsx";
import { ChildCallCard } from "./components/contact/ChildCallCard.jsx";
import { ChildDeviceCard } from "./components/contact/ChildDeviceCard.jsx";
import { PhoneSettingsModal } from "./components/dialogs/PhoneSettingsModal.jsx";
import { FeedbackModal } from "./components/dialogs/FeedbackModal.jsx";
import { getChildSafetySetupSteps, getNativeSetupAction } from "./lib/nativeSetup.js";
import { effectiveChildLocation, effectiveChildPositions } from "./lib/effectiveLocation.js";
import { blobToBase64 } from "./lib/blobBase64.js";
import { PROFILE_THEME_RPC_MISSING_MESSAGE, isMissingNativePluginError, isMissingProfileThemeRpcError } from "./lib/errorChecks.js";
import { FEEDBACK_RECIPIENT, sendFeedbackSuggestion } from "./lib/feedback.js";
import { closeRemoteListenSessionRow, startRemoteAudioCapture, stopRemoteAudioCapture } from "./lib/remoteAudioCapture.js";
import { requestNativeCurrentLocation, startNativeLocationService, stopNativeLocationService } from "./lib/nativeLocationService.js";
import {
    REMOTE_AUDIO_CHUNK_MS,
    REMOTE_AUDIO_DEFAULT_DURATION_SEC,
    REMOTE_AUDIO_MIME_TYPES,
    getRemoteAudioMimeType,
} from "./lib/remoteAudio.js";
import { escHtml } from "./lib/htmlEscape.js";
import "./App.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
// PARENT_PAIRING_INTENT_KEY moved to ./lib/parentPairingIntent.js
const PUSH_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/push-notify` : "";
const AI_PARSE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-voice-parse` : "";
const AI_MONITOR_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-child-monitor` : "";
// REMOTE_LISTEN_CHANNEL_ID / getNativeSetupAction / CHILD_SAFETY_SETUP_STEPS / getChildSafetySetupSteps moved to ./lib/nativeSetup.js — imported at top.

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


// REMOTE_AUDIO_* constants + getRemoteAudioMimeType moved to ./lib/remoteAudio.js — imported at top.
const TRIAL_INVITE_SHOWN_KEY = "hyeni-trial-invite-shown";
// CHILD_TRACKER_* constants moved to ./components/childTracker/ChildTrackerOverlay.jsx (B7).
// APP_BRAND_LOGO_SRC moved to ./components/auth/AppBrandLogo.jsx
// PROFILE_THEME_RPC_MISSING_MESSAGE / isMissingProfileThemeRpcError moved to ./lib/errorChecks.js — imported at top.
const AI_SCHEDULE_BUTTON_LABEL = `${String.fromCodePoint(0x1F916)} AI` + "로 일정입력";



// closeRemoteListenSessionRow / stopRemoteAudioCapture / startRemoteAudioCapture / waitForRealtimeChannelReady / startNativeRemoteAudioCapture / stopNativeRemoteAudioCapture moved to ./lib/remoteAudioCapture.js — imported at top.

// sendFeedbackSuggestion / FEEDBACK_FUNCTION_URL / FEEDBACK_RECIPIENT moved to ./lib/feedback.js — imported at top.

// effectiveChildLocation / effectiveChildPositions moved to ./lib/effectiveLocation.js — imported at top.

// blobToBase64 moved to ./lib/blobBase64.js — imported at top.

// Moved to ./lib/deviceFormat.js so HomeDashboard's per-child cards can
// share the exact same label format. Imported at top of file.


// isMissingNativePluginError moved to ./lib/errorChecks.js — imported at top.


// startNativeLocationService / requestNativeCurrentLocation / stopNativeLocationService moved to ./lib/nativeLocationService.js — imported at top.

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

function patchChildMemberEmoji(info, userId, emoji) {
    if (!info?.members || !userId) return info;
    let changed = false;
    const members = info.members.map((member) => {
        if (member?.role !== "child" || member?.user_id !== userId) return member;
        if (member.emoji === emoji) return member;
        changed = true;
        return { ...member, emoji };
    });
    return changed ? { ...info, members } : info;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const LOCATION_HISTORY_MIN_DISTANCE_M = 15;
const LOCATION_HISTORY_MAX_AGE_MS = 5 * 60_000;

async function saveDetailedLocationHistory(userId, familyId, previousPoint, currentPoint) {
    if (!userId || !familyId || !currentPoint) return;
    let routePoints = [];
    if (previousPoint) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ROUTE_REQUEST_TIMEOUT_MS);
        try {
            const route = await fetchWalkingRoute(previousPoint, currentPoint, controller.signal);
            routePoints = Array.isArray(route?.points) ? route.points : [];
        } catch (error) {
            console.warn("[GPS] detailed walking history route failed; saving sampled point:", error?.message || error);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    const rows = buildDetailedLocationHistoryRows({
        userId,
        familyId,
        previousPoint,
        currentPoint,
        routePoints,
    });
    await saveLocationHistoryRows(rows);
}

// Trail math helpers moved to ./lib/trailMath.js — imported at top.

// createHttpError / parseKakaoWalkingRoute / parseOsmFootRoute moved to ./lib/routeParsers.js — imported at top.

// Walking route helpers (KAKAO_REST_KEY, ROUTE_REQUEST_TIMEOUT_MS, fetchKakaoWalkingRoute, fetchOsmFootRoute, fetchWalkingRoute) moved to ./lib/walkingRoute.js — imported in RouteOverlay.

// Place / address formatters moved to ./lib/placeFormat.js — imported at top.

const getDIM = (y, m) => new Date(y, m + 1, 0).getDate();
const getFD = (y, m) => new Date(y, m, 1).getDay();
const fmtT = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const SCHEDULE_TIME_FIRST_MINUTES = 7 * 60;
const SCHEDULE_TIME_LAST_MINUTES = 22 * 60 + 30;
const SCHEDULE_TIME_SLOTS = Array.from(
    { length: Math.floor((SCHEDULE_TIME_LAST_MINUTES - SCHEDULE_TIME_FIRST_MINUTES) / 30) + 1 },
    (_, index) => SCHEDULE_TIME_FIRST_MINUTES + index * 30
);
const parseScheduleTimeMinutes = (time, fallback = 9 * 60) => {
    const match = typeof time === "string" ? time.match(/^(\d{1,2}):(\d{2})$/) : null;
    if (!match) return fallback;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
    return Math.min(23 * 60 + 59, Math.max(0, hour * 60 + minute));
};
const formatScheduleTimeValue = (minutes) => {
    const safe = Math.min(23 * 60 + 59, Math.max(0, Math.round(minutes)));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};
const formatKoreanScheduleTime = (time) => {
    const minutes = parseScheduleTimeMinutes(time);
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const period = hour < 12 ? "오전" : "오후";
    const hour12 = hour % 12 || 12;
    return `${period} ${hour12}:${String(minute).padStart(2, "0")}`;
};
const formatScheduleDuration = (minutes) => {
    const safe = Math.max(0, minutes);
    const hours = Math.floor(safe / 60);
    const rest = safe % 60;
    if (hours > 0 && rest > 0) return `${hours}시간 ${rest}분`;
    if (hours > 0) return `${hours}시간`;
    return `${rest}분`;
};

// KakaoStaticMap removed — dead code (no callsites).


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
// QrPairScanner + ChildPairInput moved to ./components/childMode/ChildPairInput.jsx — imported at top.

// ─────────────────────────────────────────────────────────────────────────────
// Academy Manager
// ─────────────────────────────────────────────────────────────────────────────

// RouteOverlay moved to ./components/route/RouteOverlay.jsx — imported at top.

// ─────────────────────────────────────────────────────────────────────────────
// Memo Section — X/Thread-style chat bubble UI (05.5-UI-SPEC.md)
// ─────────────────────────────────────────────────────────────────────────────

/* Memo timestamp — relative within 1h, absolute time after that */
// Memo time/group helpers moved to ./lib/memoTime.js
// Memo replies cache moved to ./lib/memoCache.js
// — both imported at top.

// MemoSection moved to ./components/memo/MemoSection.jsx — imported at top.


// ParentMemoPage moved to ./components/memo/ParentMemoPage.jsx — imported at top.

// ─────────────────────────────────────────────────────────────────────────────
// Day Timetable (kid-friendly)
// ─────────────────────────────────────────────────────────────────────────────
// DayTimetable moved to ./components/timetable/DayTimetable.jsx — imported at top.


// ─────────────────────────────────────────────────────────────────────────────
// Sticker Book Modal
// ─────────────────────────────────────────────────────────────────────────────
// StickerBookModal moved to ./components/sticker/StickerBookModal.jsx — imported at top.

// ─────────────────────────────────────────────────────────────────────────────
// Audio Recorder (ambient sound for safety)
// ─────────────────────────────────────────────────────────────────────────────
// Remote Ambient Audio Listener (Parent sends command → Child records → streams back)
// AmbientAudioRecorder moved to ./components/audio/AmbientAudioRecorder.jsx — imported at top.


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
// AiScheduleModal moved to ./components/aiSchedule/AiScheduleModal.jsx — imported at top.


// ─────────────────────────────────────────────────────────────────────────────
// Danger Zone Manager — 위험지역 설정 및 관리
// ─────────────────────────────────────────────────────────────────────────────
// DangerZoneManager moved to ./components/dangerZone/DangerZoneManager.jsx — imported at top.

// PhoneSettingsModal moved to ./components/dialogs/PhoneSettingsModal.jsx — imported at top.

// SavedPlaceManager moved to ./components/place-management/SavedPlaceManager.jsx — imported at top.

// FeedbackModal moved to ./components/dialogs/FeedbackModal.jsx — imported at top.

// ChildCallCard moved to ./components/contact/ChildCallCard.jsx — imported at top.

// ChildTrackerOverlay moved to ./components/childTracker/ChildTrackerOverlay.jsx — imported at top.


// ChildDeviceCard moved to ./components/contact/ChildDeviceCard.jsx — imported at top.

const getDeviceStatusReportedAt = (status) => (
    status?.updatedAt
    || status?.updated_at
    || status?.lastReportedAt
    || status?.last_reported_at
    || null
);

const getDeviceStatusReportedMs = (status) => {
    const reportedAt = getDeviceStatusReportedAt(status);
    const ms = reportedAt ? Date.parse(reportedAt) : NaN;
    return Number.isFinite(ms) ? ms : null;
};

const normalizeStoredChildDeviceStatus = (child, familyId) => {
    const health = child?.device_health && typeof child.device_health === "object"
        ? child.device_health
        : null;
    if (!health || !child?.user_id) return null;
    const reportedAt = getDeviceStatusReportedAt(health);
    return {
        family_id: familyId || health.family_id || null,
        user_id: child.user_id,
        ...health,
        updatedAt: reportedAt || undefined,
        deviceLabel: health.deviceLabel || health.device_label || child.device_label || undefined,
        device_health: {
            ...health,
            lastReportedAt: health.lastReportedAt || reportedAt || undefined,
        },
        source: health.source || "stored-device-health",
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function KidsScheduler() {
    const today = new Date();
    const roleStorage = typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : (typeof window !== "undefined" ? window.localStorage : null);

    // ── Auth & family state (Supabase) ──────────────────────────────────────────
    const [authUser, setAuthUser] = useState(null);       // supabase auth user
    // Lazy init from localStorage to give the first paint immediate access to
    // children (avatars, color, role gating). getMyFamily still runs in
    // parallel and replaces this with fresh data once it arrives.
    const [familyInfo, setFamilyInfo] = useState(() => readFamilyInfoCache());   // { familyId, pairCode, myRole, myName, members }
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
    const canOpenManualSchedule = !isParent || parentCapabilities.canWriteSchedule;
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
    const [globalNotif, setGlobalNotif] = useState(() => {
        if (typeof window === "undefined") return DEFAULT_NOTIF;
        try {
            const raw = window.localStorage.getItem("hyeni-global-notif");
            if (!raw) return DEFAULT_NOTIF;
            return normalizeNotifSettings(JSON.parse(raw));
        } catch {
            return DEFAULT_NOTIF;
        }
    });
    const updateGlobalNotif = (patch) => {
        setGlobalNotif((prev) => {
            const next = normalizeNotifSettings({ ...prev, ...patch });
            try {
                if (typeof window !== "undefined") {
                    window.localStorage.setItem("hyeni-global-notif", JSON.stringify(next));
                }
            } catch { /* localStorage unavailable */ }
            return next;
        });
    };

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
    const [addEventDateKey, setAddEventDateKey] = useState(null);
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
    const [childCharacterSaving, setChildCharacterSaving] = useState(false);
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
    const currentChildMember = !isParent
      ? (pairedChildren.find((member) => member.user_id === authUser?.id) || pairedChildren[0] || null)
      : null;
    const currentChildCharacter = currentChildMember?.emoji || "🐰";
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
    const [deviceStatusRefreshRequestedAt, setDeviceStatusRefreshRequestedAt] = useState(null);
    const [deviceStatusExpanded, setDeviceStatusExpanded] = useState(false);
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

    useEffect(() => {
        if (!isParent || !familyId || pairedChildren.length === 0) return;
        const storedStatuses = pairedChildren
            .map((child) => normalizeStoredChildDeviceStatus(child, familyId))
            .filter(Boolean);
        if (storedStatuses.length === 0) return;

        setChildDeviceStatusMap((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const storedStatus of storedStatuses) {
                const childUserId = storedStatus.user_id;
                const current = next[childUserId];
                const currentMs = getDeviceStatusReportedMs(current);
                const storedMs = getDeviceStatusReportedMs(storedStatus);
                const shouldUseStored = !current
                    || currentMs == null
                    || (storedMs != null && storedMs > currentMs);
                if (!shouldUseStored) continue;

                next[childUserId] = {
                    ...(current || {}),
                    ...storedStatus,
                    device_health: {
                        ...(current?.device_health || {}),
                        ...(storedStatus.device_health || {}),
                    },
                };
                changed = true;
            }
            return changed ? next : prev;
        });
    }, [familyId, isParent, pairedChildren]);

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
    // entitlement.ready 가 false 인 동안에는 tier 가 unknown 이므로
    // "프리미엄에서 사용할 수 있어요" 류 안내를 노출하지 않는다. 그렇지 않으면
    // 프리미엄 사용자도 첫 paint 에서 잠시 free 로 인식되어 메시지가 깜빡인다.
    const locationGateHint = isParent && entitlement.ready && !entitlement.canUse(FEATURES.REALTIME_LOCATION)
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
    const [timeSelectionTarget, setTimeSelectionTarget] = useState("start");
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

    const selectedStartMinutes = parseScheduleTimeMinutes(newTime);
    const selectedEndMinutes = newEndTime ? parseScheduleTimeMinutes(newEndTime, null) : null;
    const hasSelectedEndTime = selectedEndMinutes != null && selectedEndMinutes > selectedStartMinutes;
    const selectedTimeRangeLabel = hasSelectedEndTime
        ? `${formatKoreanScheduleTime(newTime)} ~ ${formatKoreanScheduleTime(newEndTime)}`
        : `${formatKoreanScheduleTime(newTime)} 시작`;
    const selectedTimeDurationLabel = hasSelectedEndTime
        ? formatScheduleDuration(selectedEndMinutes - selectedStartMinutes)
        : "종료시간은 선택사항";

    const handleScheduleTimeSlotSelect = (minutes) => {
        const nextTime = formatScheduleTimeValue(minutes);
        if (timeSelectionTarget === "end") {
            if (minutes <= selectedStartMinutes) {
                const nextEndMinutes = Math.min(selectedStartMinutes + 60, SCHEDULE_TIME_LAST_MINUTES);
                setNewEndTime(formatScheduleTimeValue(nextEndMinutes));
            } else {
                setNewEndTime(nextTime);
            }
            return;
        }
        setNewTime(nextTime);
        if (newEndTime && parseScheduleTimeMinutes(newEndTime) <= minutes) {
            setNewEndTime("");
        }
        setTimeSelectionTarget("end");
    };

    const handleDurationPresetSelect = (durationMinutes) => {
        setTimeSelectionTarget("end");
        setNewEndTime(formatScheduleTimeValue(Math.min(selectedStartMinutes + durationMinutes, SCHEDULE_TIME_LAST_MINUTES)));
    };

    const handleStartTimeInputChange = (value) => {
        if (!value) return;
        setNewTime(value);
        const minutes = parseScheduleTimeMinutes(value);
        if (newEndTime && parseScheduleTimeMinutes(newEndTime) <= minutes) {
            setNewEndTime("");
            setTimeSelectionTarget("end");
        }
    };

    const handleEndTimeInputChange = (value) => {
        setNewEndTime(value || "");
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
    const scheduleDraftDateKey = addEventDateKey || dateKey;
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
        const provider = params.get("provider");
        const state = params.get("state");

        try {
            // Phase G-2: Naver 커스텀 OAuth 콜백. provider=naver 시 finishNaverLogin
            // 으로 magiclink 토큰 교환 + verifyOtp.
            if (provider === "naver" && code) {
                const { finishNaverLogin } = await import("./lib/auth.js");
                await finishNaverLogin({ code, state });
                return true;
            }

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

    // ── Web Naver OAuth 콜백 처리 (페이지 로드 시 ?provider=naver&code=... 감지) ──
    useEffect(() => {
        if (isNativeApp) return;
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (url.searchParams.get("provider") !== "naver") return;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code) return;

        (async () => {
            try {
                const { finishNaverLogin } = await import("./lib/auth.js");
                await finishNaverLogin({ code, state });
                // URL 정리 — 새로고침 시 재시도 방지
                url.searchParams.delete("provider");
                url.searchParams.delete("code");
                url.searchParams.delete("state");
                url.searchParams.delete("error");
                window.history.replaceState({}, "", url.toString());
            } catch (err) {
                console.error("[Naver] web callback failed:", err);
            }
        })();
    }, [isNativeApp]);

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
    // Mirror familyInfo to localStorage so the next cold start can hydrate
    // the first paint immediately (avatars, role gating, pair code, etc.).
    // null is a valid signal — the writer treats it as "clear cache".
    // 500ms trailing debounce: 옵티미스틱 emoji 패치, realtime member
    // 변경 등 hot path 에서 매번 JSON.stringify(members) + setItem 으로
    // JS thread 가 막히는 것을 방지. logout 은 setFamilyInfo(null) 즉시
    // flush 가 필요해 null 인 경우는 debounce 없이 동기 처리.
    useEffect(() => {
        if (familyInfo === null) {
            writeFamilyInfoCache(null);
            return undefined;
        }
        const timer = setTimeout(() => writeFamilyInfoCache(familyInfo), 500);
        return () => clearTimeout(timer);
    }, [familyInfo]);
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
                        saveLocationHistory(authUser.id, familyId, nextPosition.lat, nextPosition.lng, { recordedAt: updatedAt });
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
                const updatedMs = Date.parse(payload.updatedAt || payload.updated_at || "");
                if (Number.isFinite(updatedMs)) {
                    setDeviceStatusRefreshRequestedAt(prev => (prev && updatedMs >= prev ? null : prev));
                }
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

        const persistDeviceHealthPayload = async (payload) => {
            if (!payload?.family_id || !payload?.user_id) return;
            try {
                await supabase
                    .from("family_members")
                    .update({
                        device_health: {
                            ...payload,
                            source: payload.source || "webview-session",
                        },
                    })
                    .eq("family_id", payload.family_id)
                    .eq("user_id", payload.user_id);
            } catch (error) {
                console.warn("[DeviceStatus] persist failed:", error?.message || error);
            }
        };

        const publish = async () => {
            const payload = await buildPayload();
            await persistDeviceHealthPayload(payload);
            const channel = realtimeChannel.current;
            if (!channel || channel.state !== "joined") return;
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
    const handleChildCharacterChange = useCallback(async (emoji) => {
        const nextEmoji = typeof emoji === "string" ? emoji.trim() : "";
        if (!nextEmoji || nextEmoji === currentChildCharacter || childCharacterSaving) return;
        if (!authUser?.id || !familyId) {
            showNotif("가족 연결 후 캐릭터를 바꿀 수 있어요", "error");
            return;
        }

        const previousEmoji = currentChildCharacter;
        setChildCharacterSaving(true);
        setFamilyInfo((prev) => patchChildMemberEmoji(prev, authUser.id, nextEmoji));
        try {
            const { data, error } = await supabase
                .from("family_members")
                .update({ emoji: nextEmoji })
                .eq("family_id", familyId)
                .eq("user_id", authUser.id)
                .eq("role", "child")
                .select("id, emoji")
                .maybeSingle();
            if (error) throw error;
            if (!data) throw new Error("Child member was not updated");

            const refreshed = await getMyFamily(authUser.id);
            if (refreshed) {
                setFamilyInfo(refreshed);
            }
            showNotif(`${nextEmoji} 캐릭터로 바꿨어!`);
        } catch (err) {
            console.error("[child character] update failed", err);
            setFamilyInfo((prev) => patchChildMemberEmoji(prev, authUser.id, previousEmoji));
            showNotif("캐릭터 저장 실패. 다시 시도해줘", "error");
        } finally {
            setChildCharacterSaving(false);
        }
    }, [authUser?.id, childCharacterSaving, currentChildCharacter, familyId, showNotif]);
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
                    if (s.showAddModal)        { setShowAddModal(false); setAddEventDateKey(null); return; }
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
            showNotif("구독은 부모 기기에서 시작해 주세요!", "error");
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
            showNotif(error?.message || "구독을 시작 못 했어요. 다시 해볼까요?", "error");
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
                const previousHistoryPoint = lastHistoryPoint;
                const currentHistoryPoint = { lat: newPos.lat, lng: newPos.lng, recordedAt: newPos.updatedAt };
                lastHistorySave = now;
                lastHistoryPoint = currentHistoryPoint;
                void saveDetailedLocationHistory(authUser.id, familyId, previousHistoryPoint, currentHistoryPoint);
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
                        addAlert(`${ev.title}에 도착했어요! (${msg})`, "child");
                        showNotif(`${ev.title}에 잘 도착했어! ${isEarly ? "일찍 왔네~ 대단해!" : isOnTime ? "딱 맞춰 왔구나!" : "조금 늦었지만 괜찮아!"}`, "child");
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
                            showNotif(`칭찬스티커를 받았어요! ${isEarly ? "일찍 도착 보너스!" : "시간 잘 지켰어요!"}`, "child");
                        } else if (isLate) {
                            addSticker(authUser.id, familyId, String(ev.id), key, "late", "😢", ev.title);
                            showNotif("아쉽게 칭찬스티커를 못받았어요...", "child");
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

    const openManualAddEventModal = (targetDateKey = null) => {
        setAddEventDateKey(typeof targetDateKey === "string" && targetDateKey ? targetDateKey : null);
        setEventChildSelection(getDefaultEventChildSelection());
        setTimeSelectionTarget("start");
        setShowAddModal(true);
    };

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
        setAddEventDateKey(null);
        setEditingEventId(event.id);
        setNewTitle(event.title || "");
        setNewTime(event.time || "09:00");
        setNewEndTime(event.endTime || "");
        setTimeSelectionTarget("start");
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
        const matchedAcademy = academies.find(a => a.name === title);
        const emoji = selectedPreset
            ? selectedPreset.emoji
            : (matchedAcademy?.emoji || cat.emoji);

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
            setNewTitle(""); setNewTime("09:00"); setNewEndTime(""); setTimeSelectionTarget("start"); setNewCategory("school"); setNewMemo(""); setNewLocation(null); setSelectedPreset(null); setWeeklyRepeat(false); setRepeatWeeks(4);
            setAddEventDateKey(null);
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
                    showNotif("저장이 잠시 멈췄어요. 한 번 더 해볼까요?", "error");
                }
            }
            return;
        }

        const effectiveEventChildSelection = getEffectiveEventChildSelection(eventChildSelection);
        if (isParent && !effectiveEventChildSelection.familyAll && effectiveEventChildSelection.childIds.length === 0) {
            showNotif("일정을 받을 아이를 먼저 선택해 주세요.", "error");
            return;
        }

        const totalWeeks = weeklyRepeat ? repeatWeeks : 1;
        const allEvents = [];
        const baseDateKey = scheduleDraftDateKey;
        const optimisticEventScope = getEventScopeFromSelection(effectiveEventChildSelection);
        for (let w = 0; w < totalWeeks; w++) {
            const dk = w === 0 ? baseDateKey : addDaysToDateKey(baseDateKey, w * 7);
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
        setNewTitle(""); setNewTime("09:00"); setNewEndTime(""); setTimeSelectionTarget("start"); setNewCategory("school"); setNewMemo(""); setNewLocation(null); setSelectedPreset(null); setWeeklyRepeat(false); setRepeatWeeks(4);
        setAddEventDateKey(null);
        setShowAddModal(false);
        showNotif(weeklyRepeat ? `${totalWeeks}주 반복 일정이 추가됐어요!` : "일정이 추가됐어요!");
        setBounce(true); setTimeout(() => setBounce(false), 800);

        // Persist to Supabase (Realtime will sync to other device)
        if (familyId && authUser) {
            try {
                for (const { ev, dateKey: dk } of allEvents) {
                    await saveEventWithChildren({ ...ev, dateKey: dk, familyId, userId: authUser.id }, effectiveEventChildSelection);
                }
                setEventChildSelection({ childIds: [], familyAll: false });
                maybeOpenTrialInvite();
                sendInstantPush({
                    action: "new_event",
                    familyId,
                    senderUserId: authUser.id,
                    title: `📅 새 일정: ${emoji} ${title}`,
                    message: weeklyRepeat
                        ? `${baseDateKey.replace(/-/g, "/")}부터 매주 ${totalWeeks}주간 "${title}" 일정이 추가됐어요`
                        : `${baseDateKey.replace(/-/g, "/")} ${newTime}에 "${title}" 일정이 추가됐어요`,
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
                showNotif("저장이 잠시 멈췄어요. 한 번 더 해볼까요?", "error");
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
    const getCalendarDateKey = (day) => `${currentYear}-${currentMonth}-${day}`;
    const getEvs = (d) => visibleEvents[getCalendarDateKey(d)] || [];
    const handleCalendarDateSelect = (day, { openAddWhenEmpty = false } = {}) => {
        const targetDateKey = getCalendarDateKey(day);
        setSelectedDate(day);
        if (openAddWhenEmpty && canOpenManualSchedule) {
            openManualAddEventModal(targetDateKey);
        }
    };
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
        const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
        setActiveView("calendar");
        setCurrentYear(today.getFullYear());
        setCurrentMonth(today.getMonth());
        setSelectedDate(today.getDate());

        if (!nextTodayEvent) {
            openManualAddEventModal(todayKey);
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
        setShowPlaceManager(false);
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
        setShowPlaceManager(false);
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
                <span aria-hidden="true" style={{ display: "inline-flex", marginRight: 4, verticalAlign: "middle" }}><Home size={16} strokeWidth={1.75} /></span>홈
              </button>
            )}
            <button type="button" className={activeTab === "today" ? "active" : undefined} onClick={handleParentTodayTabClick} style={{ fontFamily: FF }}>
                <span aria-hidden="true" style={{ display: "inline-flex", marginRight: 4, verticalAlign: "middle" }}><Sun size={16} strokeWidth={1.75} /></span>오늘
            </button>
            <button type="button" className={activeTab === "calendar" ? "active" : undefined} onClick={requireSelectedChildOrHint(handleParentCalendarTabClick, "일정 보기")} style={{ fontFamily: FF }}>
                <span aria-hidden="true" style={{ display: "inline-flex", marginRight: 4, verticalAlign: "middle" }}><Calendar size={16} strokeWidth={1.75} /></span>일정
            </button>
            {parentCapabilities.canManagePlaces && (
                <button type="button" className={activeTab === "maplist" ? "active" : undefined} onClick={requireSelectedChildOrHint(handleParentMapTabClick, "장소 관리")} style={{ fontFamily: FF }}>
                    <span aria-hidden="true" style={{ display: "inline-flex", marginRight: 4, verticalAlign: "middle" }}><MapPin size={16} strokeWidth={1.75} /></span>장소관리
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
    const deviceStatusRefreshPending = Boolean(deviceStatusRefreshRequestedAt);
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
        const requestedAt = Date.now();
        setDeviceStatusRefreshRequestedAt(requestedAt);
        window.setTimeout(() => {
            setDeviceStatusRefreshRequestedAt(prev => (prev === requestedAt ? null : prev));
        }, 20_000);
        void requestChildLocationRefresh("device_status_manual_refresh");
        requestChildDeviceStatusRefresh("device_status_manual_refresh")
            .then((sent) => {
                if (!sent) setDeviceStatusRefreshRequestedAt(prev => (prev === requestedAt ? null : prev));
                showNotif(sent ? "아이 기기에 살짝 신호 보냈어요. 잠시 기다려 봐요!" : "아이 기기에 신호를 못 보냈어요. 다시 해볼까요?", sent ? "success" : "error");
            })
            .catch((error) => {
                console.warn("[DeviceStatus] manual refresh failed:", error?.message || error);
                showNotif("아이 기기 정보를 못 가져왔어요. 잠시 후 다시 해볼까요?", "error");
                setDeviceStatusRefreshRequestedAt(prev => (prev === requestedAt ? null : prev));
            });
    }, [requestChildDeviceStatusRefresh, requestChildLocationRefresh, showNotif]);

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
        return (
            <section
                className="hyeni-v5-movement-summary"
                aria-label="선택한 날짜 이동경로 요약"
                style={{
                    marginTop: 18,
                    background: "linear-gradient(135deg, var(--brand-lavender-soft, #EFE8FF) 0%, #FFFDF8 100%)",
                    border: "1px solid var(--brand-lavender-line, #DDD1FF)",
                    borderRadius: 24,
                    padding: "16px 16px 14px",
                    boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31, 24, 28, 0.06))",
                }}
            >
                <div className="hyeni-v5-movement-summary__head" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <ThreeDIcon name="pin-lavender" size={36} aria-label="" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                        <span className="hyeni-v5-movement-summary__kicker" style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-lavender-text, #5F43B2)" }}>{selectedCalendarDateLabel}</span>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#202024", letterSpacing: "-0.01em" }}>{childName} 하루 이동경로</h3>
                    </div>
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
                        <DailyTrailMap trail={selectedDateLocationTrail} child={selectedChild} height={240} />
                        <div className="hyeni-v5-movement-summary__visits" aria-label="등록된 장소 기준 이동내역">
                            {selectedDateMovementSummary.placeVisits.length > 0 ? (
                                selectedDateMovementSummary.placeVisits.slice(0, 8).map((visit) => (
                                    <div key={visit.id} className="hyeni-v5-movement-summary__visit">
                                        <strong>{visit.label} : </strong>
                                        <span>{visit.timeLabel}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="hyeni-v5-movement-summary__empty">
                                    등록된 장소 근처 이동내역이 없어요.
                                </div>
                            )}
                        </div>
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
                    const visibleEventMarkers = dayEvs.slice(0, 3);
                    return (
                        <button
                            key={`${keyPrefix}-${day}`}
                            type="button"
                            onClick={() => handleCalendarDateSelect(day, { openAddWhenEmpty: true })}
                            className={`cal-day${isToday ? " is-today" : ""}${isSel ? " is-selected" : ""}${isSun ? " is-sun" : ""}${isSat ? " is-sat" : ""}`}
                            aria-label={`${currentMonth + 1}월 ${day}일${dayEvs.length ? ` 일정 ${dayEvs.length}개` : ""}`}
                            style={{ fontFamily: FF }}
                        >
                            <span className="cal-day-num">{day}</span>
                            {dayEvs.length > 0 && (
                                <span
                                    className="hyeni-v5-calendar-dots"
                                    aria-hidden="true"
                                    title={dayEvs.map((e) => e.title).filter(Boolean).join(", ")}
                                >
                                    {visibleEventMarkers.map((e) => (
                                        <span
                                            key={e.id}
                                            style={{
                                                background: "var(--theme-accent)",
                                                boxShadow: isSel
                                                    ? "0 0 0 1px rgba(255,255,255,0.92), 0 1px 4px rgba(15,23,42,0.22)"
                                                    : "0 0 0 1px color-mix(in srgb, var(--theme-accent) 28%, white)",
                                            }}
                                        />
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
                        {distanceLabel && <span className="hyeni-v5-chip distance" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={12} strokeWidth={1.75} />{distanceLabel}</span>}
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
        isParent && parentCapabilities.canWriteSchedule ? {
            key: "quick-schedule",
            icon: "🤖",
            iconKey: "calendar-check",
            label: "빠른일정",
            ariaLabel: "빠른 일정입력",
            palette: quickThemePalette,
            onClick: openAiSchedule,
        } : null,
        activeView !== "calendar" ? {
            key: "home",
            icon: "⌂",
            iconKey: "calendar-heart",
            label: "홈",
            ariaLabel: "홈",
            palette: quickThemePalette,
            onClick: () => setActiveView("calendar"),
        } : null,
        isParent && parentCapabilities.canRequestChildLocation ? {
            key: "child-tracker",
            icon: "⌖",
            iconKey: "pin-heart",
            label: "우리아이",
            ariaLabel: "📍 우리아이",
            palette: quickThemePalette,
            onClick: () => setShowChildTracker(true),
        } : null,
        isParent && parentCapabilities.canManagePlaces ? {
            key: "academy",
            icon: "□",
            iconKey: "pin-lavender",
            label: "장소관리",
            ariaLabel: "📍 장소관리",
            palette: quickThemePalette,
            onClick: openAcademyManagement,
        } : null,
        isParent && parentCapabilities.canManageFamily ? {
            key: "friend-playdate",
            icon: "◇",
            iconKey: "friend",
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
            iconKey: "bell",
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
            iconKey: "heart",
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
            iconKey: "shield-heart",
            label: "구독",
            ariaLabel: "💎 구독",
            palette: quickThemePalette,
            onClick: () => setShowSubscriptionSettings(true),
        } : null,
        isParent && parentCapabilities.canEditParentPhones ? {
            key: "contacts",
            icon: "☎",
            iconKey: "chat-heart",
            label: "연락처",
            ariaLabel: "📞 연락처",
            palette: quickThemePalette,
            onClick: () => setShowPhoneSettings(true),
        } : null,
        isParent && parentCapabilities.canUseRemoteListen ? {
            key: "remote-audio",
            icon: "◉",
            iconKey: "shield",
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
            iconKey: "note",
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
                    showNotif("연동은 됐어요! 정보를 다시 불러올게요. 앱을 한 번 닫았다 열어볼까요?", "error");
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
            bottomNavigation={isParent ? renderParentBottomTabbar("maplist", "hyeni-v5-tabbar-manager") : null}
            onSave={async (newList) => {
                if (!parentCapabilities.canManagePlaces) {
                    showNotif("보조 보호자는 학원·장소를 바꿀 수 없어요.", "error");
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
                    showNotif("보조 보호자는 학원·장소를 바꿀 수 없어요.", "error");
                    return;
                }
                openFeatureLock(FEATURES.SAVED_PLACES);
            }}
            onSavedPlacesSave={async (nextList) => {
                if (!parentCapabilities.canManagePlaces) {
                    showNotif("보조 보호자는 학원·장소를 바꿀 수 없어요.", "error");
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
                        && normalizedPlace.location?.kakao_place_id
                    ) {
                        try {
                            normalizedPlace.public_place_id = await upsertPublicPlace({
                                kakaoPlaceId: normalizedPlace.location.kakao_place_id,
                                name: normalizedPlace.name,
                                lat: normalizedPlace.location.lat,
                                lng: normalizedPlace.location.lng,
                            });
                        } catch (error) {
                            console.error("[saved-place] safe place public mapping failed:", error);
                            // public_places 매핑 실패해도 saved_places 자체는 저장.
                            // 친구 놀이터 매칭만 비활성, 본인 안전장소로는 정상 동작.
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
                    showNotif("장소 저장이 잠시 멈췄어요. 한 번 더 해볼까요?", "error");
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
                showNotif(`⚠️ 조심할 곳 '${zone.name}' 추가했어요!`);
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
            isPremium={entitlement.canUse(FEATURES.SAVED_PLACES)}
            freeSafePlaceLimit={1}
            onRequestUpgrade={() => {
                setShowSavedPlaceMgr(false);
                openFeatureLock(FEATURES.SAVED_PLACES);
            }}
            onSave={async (nextList) => {
                const isPremium = entitlement.canUse(FEATURES.SAVED_PLACES);

                // 무료 티어: 모든 새 장소를 안전장소로 저장 (RLS 통과 조건),
                // 단 총 안전장소 1개 한도. 초과 시 구독 유도.
                const normalizedNext = nextList.map((place) => ({
                    ...place,
                    id: place.id || generateUUID(),
                    name: place.name.trim(),
                    is_playdate_safe: isPremium ? !!place.is_playdate_safe : true,
                }));

                if (!isPremium) {
                    const safeCount = normalizedNext.filter((p) => p.is_playdate_safe).length;
                    if (safeCount > 1) {
                        showNotif("무료 사용자는 안전장소를 1개까지 저장할 수 있어요. 더 추가하려면 프리미엄을 켜주세요!", "error");
                        setShowSavedPlaceMgr(false);
                        openFeatureLock(FEATURES.SAVED_PLACES);
                        return;
                    }
                }

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
                            || JSON.stringify(previous.location) !== JSON.stringify(place.location)
                            || !!previous.is_playdate_safe !== !!place.is_playdate_safe;
                        if (changed) {
                            await updateSavedPlace(place.id, {
                                name: place.name,
                                location: place.location || null,
                                is_playdate_safe: !!place.is_playdate_safe,
                            });
                        }
                    }

                    maybeOpenTrialInvite();
                    showNotif("📍 자주 가는 장소를 저장했어요!");
                } catch (error) {
                    console.error("[saved-place] save error:", error);
                    setSavedPlaces(previousList);
                    cacheSavedPlaces(previousList);
                    // RLS / 구독 제약으로 거부된 경우 친근한 안내 + 구독 팝업.
                    const message = String(error?.message || error || "");
                    const isRlsBlock = message.includes("row-level security")
                        || message.includes("violates")
                        || error?.code === "42501"
                        || error?.code === "PGRST301";
                    if (!isPremium || isRlsBlock) {
                        showNotif("프리미엄 구독자만 더 많은 장소를 저장할 수 있어요. 안내 화면을 띄울게요!", "error");
                        openFeatureLock(FEATURES.SAVED_PLACES);
                    } else {
                        showNotif("장소 저장에 실패했어요. 잠시 후 다시 시도해 주세요", "error");
                    }
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
                <div className={`cartoon-toast cartoon-toast--${notification.type === "error" ? "error" : notification.type === "child" ? "child" : notification.type === "parent" ? "parent" : "success"}`}>
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
                <div className={`cartoon-toast cartoon-toast--${notification.type === "error" ? "error" : notification.type === "child" ? "child" : notification.type === "parent" ? "parent" : "success"}`}>
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
        <div className="hyeni-app-shell" style={{ minHeight: "100dvh", background: "var(--hyeni-product-canvas)", fontFamily: FF, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)", position: "relative", overflowX: "hidden", overflowY: "auto", width: "100%", boxSizing: "border-box" }}>
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
                <div className={`cartoon-toast cartoon-toast--${notification.type === "error" ? "error" : notification.type === "child" ? "child" : notification.type === "parent" ? "parent" : "success"}`}>
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
                                    <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><Sparkles size={36} strokeWidth={1.5} /></div>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>활동 분석이 꺼져 있어요</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>위 토글을 켜면 아이 활동을 정리해 알려드려요</div>
                                </div>
                            )}
                            {aiEnabled && parentAlerts.length === 0 && (
                                <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--fg-tertiary)" }}>
                                    <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><Sparkles size={36} strokeWidth={1.5} /></div>
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
                                <button onClick={() => { setVoicePreview(null); setNewTitle(voicePreview.ev.title); setNewTime(voicePreview.ev.time); setNewEndTime(voicePreview.ev.endTime || ""); setTimeSelectionTarget("start"); setNewCategory(voicePreview.ev.category); setNewLocation(voicePreview.ev.location); setEvents(prev => ({ ...prev, [voicePreview.dateKey]: (prev[voicePreview.dateKey] || []).filter(e => e.id !== voicePreview.ev.id) })); setShowAddModal(true); }}
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
                <div className="cartoon-push-banner" style={{ maxWidth: contentMaxWidth }}>
                    <span aria-hidden="true" className="cartoon-push-banner-icon">🔔</span>
                    <div className="cartoon-push-banner-text">
                        <div className="cartoon-push-banner-title">푸시 알림을 켜주세요</div>
                        <div className="cartoon-push-banner-sub">일정 시작 전 알림을 받을 수 있어요</div>
                    </div>
                    <button
                        type="button"
                        className="cartoon-push-banner-cta"
                        onClick={async () => {
                            const result = await requestPermission();
                            setPushPermission(result);
                            if (result === "granted") {
                                showNotif("푸시 알림이 켜졌어요!");
                            } else if (result === "denied") {
                                showNotif("알림이 차단되었어요. 브라우저 설정에서 허용해주세요.", "error");
                            }
                        }}
                    >
                        허용하기
                    </button>
                </div>
            )}
            {!isNativeApp && pushPermission === "denied" && !pushDeniedDismissed && (
                <div className="cartoon-push-banner cartoon-push-banner--denied" style={{ maxWidth: contentMaxWidth }}>
                    <span aria-hidden="true" className="cartoon-push-banner-icon">🔕</span>
                    <div className="cartoon-push-banner-text">
                        알림이 꺼져있어요. 브라우저 설정에서 켤 수 있어요
                    </div>
                    <button
                        type="button"
                        className="cartoon-push-banner-dismiss"
                        aria-label="배너 닫기"
                        onClick={() => { try { sessionStorage.setItem("hyeni-push-denied-dismissed", "1"); } catch (e) { /* sessionStorage 비활성: 무시 */ } setPushDeniedDismissed(true); }}
                    >×</button>
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
                            style={{ position: "relative", fontSize: 18, padding: "6px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: "var(--bg-muted)", lineHeight: 1 }}
                            aria-label="알림">
                            <ThreeDIcon name="bell" size={22} aria-label="알림" />
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
                        aria-label="꾹 보내기">
                        <ThreeDIcon name="heart" size={isParent ? 14 : 16} aria-label="꾹" /> 꾹
                    </button>
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
                        characterEmoji={currentChildCharacter}
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
                        <AppBrandLogo size={88} radius={22} />
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
                  onSelectChild={(childId) => { setSelectedChildId(childId); setActiveView("calendar"); }}
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
                        childDeviceStatusMap={childDeviceStatusMap}
                        onSelectChild={(childId) => setSelectedChildId(childId)}
                        onRefreshDevices={handleParentDeviceRefreshClick}
                        deviceRefreshPending={Boolean(deviceStatusRefreshRequestedAt)}
                    />
                    {renderParentBottomTabbar("today", "hyeni-v5-tabbar-fixed")}
                </>
            )}
            {activeView === "calendar" && !(isParent && isMultiChild && !selectedChildId) && (isParent ? (
                <div className="hyeni-v5-parent-main" aria-label="부모 메인">
                    {selectedChild && (() => {
                      const childName = selectedChild?.name || "아이";
                      const todayEventCount = (todayEvents || []).filter(e => Array.isArray(e.child_ids) ? e.child_ids.includes(selectedChild.id) : true).length;
                      const moodLine = todayEventCount === 0
                        ? "오늘은 여유로워요"
                        : todayEventCount === 1
                          ? "오늘 한 개의 일정이 있어요"
                          : `오늘 ${todayEventCount}개의 일정이 있어요`;
                      const dateLabel = `${currentMonth + 1}월 ${selectedDate}일 ${DAYS_KO[(new Date(currentYear, currentMonth, selectedDate)).getDay()]}요일`;
                      return (
                        <section
                          aria-label={`${childName} 오늘 요약`}
                          style={{
                            position: "relative",
                            background: "linear-gradient(135deg, #DDF7EA 0%, #F0FBF5 60%, #FFF7FA 100%)",
                            borderRadius: 28,
                            border: "1px solid rgba(49, 196, 141, 0.20)",
                            padding: "20px",
                            marginBottom: 18,
                            overflow: "hidden",
                            boxShadow: "0 8px 24px rgba(31, 24, 28, 0.06)",
                            minHeight: 200,
                            display: "flex",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1, maxWidth: "60%" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#5F6368" }}>{dateLabel}</span>
                            <h2 style={{
                              margin: 0,
                              fontSize: 26,
                              fontWeight: 800,
                              color: "#202024",
                              letterSpacing: "-0.03em",
                              lineHeight: 1.25,
                            }}>
                              {childName},<br />
                              <span style={{ color: "#087653" }}>{moodLine}</span>
                            </h2>
                            <button
                              type="button"
                              onClick={() => {
                                const calendarSection = document.getElementById("parent-calendar-section");
                                if (calendarSection?.scrollIntoView) calendarSection.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                              style={{
                                alignSelf: "flex-start",
                                marginTop: 4,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "10px 16px",
                                border: "none",
                                background: "linear-gradient(135deg, #31C48D 0%, #15936B 100%)",
                                color: "#FFFFFF",
                                borderRadius: 999,
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: "pointer",
                                fontFamily: FF,
                                boxShadow: "0 6px 16px rgba(49, 196, 141, 0.28)",
                              }}
                            >
                              <span aria-hidden="true">🗓</span>
                              오늘 일정 확인
                              <span aria-hidden="true" style={{ fontWeight: 700 }}>›</span>
                            </button>
                          </div>
                          <div
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              right: 8,
                              top: "50%",
                              transform: "translateY(-50%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 168,
                              height: 168,
                            }}
                          >
                            <span style={{ position: "absolute", top: -2, left: 18, fontSize: 28, opacity: 0.85 }}>☁️</span>
                            <HyeniMascot variant="static" size={150} aria-label="" />
                          </div>
                          <button
                            type="button"
                            aria-label="설정"
                            onClick={() => setActiveView("parentSettings")}
                            style={{
                              position: "absolute",
                              top: 12,
                              right: 12,
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: "#FFFFFF",
                              border: "1px solid rgba(49, 196, 141, 0.18)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 16,
                              color: "#5F6368",
                              cursor: "pointer",
                              zIndex: 2,
                              fontFamily: FF,
                              boxShadow: "0 2px 8px rgba(31, 24, 28, 0.06)",
                            }}
                          >
                            ⚙
                          </button>
                        </section>
                      );
                    })()}
                    <div className="hyeni-v5-section-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 22, marginBottom: 10, padding: "0 4px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: "#202024", letterSpacing: "-0.01em" }}>
                            <ThreeDIcon name="pin-heart" size={20} aria-label="" />
                            아이 현황
                        </span>
                        <span
                            className="hyeni-v5-section-meta hyeni-v1-live-meta"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 10px",
                                borderRadius: 999,
                                background: displayChildPos ? "var(--brand-mint-soft, #DDF7EA)" : "#FFF3C7",
                                color: displayChildPos ? "var(--brand-mint-text, #087653)" : "#9A6500",
                                fontSize: 11,
                                fontWeight: 800,
                            }}
                        >
                            {displayChildPos && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--brand-mint, #31C48D)" }} />}
                            {displayChildPos ? "실시간 연결" : "연결 준비 중"}
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
                                marginTop: 18,
                                marginBottom: 14,
                                background: "linear-gradient(135deg, var(--brand-mint-soft, #DDF7EA) 0%, #FBFAF6 100%)",
                                border: "1px solid var(--brand-mint-line, #BCEBD8)",
                                borderRadius: 24,
                                padding: "16px 18px",
                                boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31, 24, 28, 0.06))",
                                fontFamily: FF
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, color: "var(--brand-mint-text, #087653)", letterSpacing: "-0.01em" }}>
                                    <ThreeDIcon name="shield-heart" size={22} aria-label="" />
                                    아이 기기 안전 지표
                                </div>
                                <button
                                    type="button"
                                    onClick={handleParentDeviceRefreshClick}
                                    style={{ border: "none", background: "linear-gradient(135deg, var(--brand-mint, #31C48D), var(--brand-mint-deep, #15936B))", color: "#FFFFFF", borderRadius: 999, padding: "6px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: FF, flexShrink: 0, boxShadow: "0 4px 12px rgba(49, 196, 141, 0.18)" }}
                                >
                                    {deviceStatusRefreshPending ? "요청 중" : "지금 갱신"}
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
                                marginTop: 18,
                                marginBottom: 14,
                                background: "linear-gradient(135deg, var(--brand-mint-soft, #DDF7EA) 0%, #FBFAF6 100%)",
                                border: "1px solid var(--brand-mint-line, #BCEBD8)",
                                borderRadius: 24,
                                padding: "16px 18px",
                                boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31, 24, 28, 0.06))",
                                fontFamily: FF
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, color: "var(--brand-mint-text, #087653)", letterSpacing: "-0.01em", minWidth: 0 }}>
                                    <ThreeDIcon name="shield-heart" size={22} aria-label="" />
                                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>안전 지표 · {primaryDeviceChildName}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDeviceStatusExpanded(prev => !prev)}
                                    style={{ border: "1px solid var(--brand-mint-line, #BCEBD8)", background: "#FFFFFF", color: "var(--brand-mint-text, #087653)", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: FF, flexShrink: 0 }}
                                >
                                    {deviceStatusExpanded ? "접기" : "상세"}
                                </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                                <div style={{ background: "white", borderRadius: 12, padding: "9px 10px" }}>
                                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", fontWeight: 700 }}>배터리</div>
                                    <div style={{ fontSize: 16, color: "var(--fg-primary)", fontWeight: 900, marginTop: 2 }}>🔋 {primaryDeviceBatteryLabel}</div>
                                </div>
                                <div style={{ background: "white", borderRadius: 12, padding: "9px 10px" }}>
                                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", fontWeight: 700 }}>화면 시간</div>
                                    <div style={{ fontSize: 15, color: "var(--fg-primary)", fontWeight: 900, marginTop: 2 }}>⏱️ {primaryDeviceScreenLabel}</div>
                                </div>
                                {deviceStatusExpanded && (
                                    <>
                                        <div style={{ background: "white", borderRadius: 12, padding: "9px 10px" }}>
                                            <div style={{ fontSize: 11, color: "var(--fg-secondary)", fontWeight: 700 }}>충전 상태</div>
                                            <div style={{ fontSize: 15, color: "var(--fg-primary)", fontWeight: 900, marginTop: 2 }}>⚡ {primaryDeviceChargingLabel}</div>
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
                                    </>
                                )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
                                <div style={{ fontSize: 11, color: "#5F6368", fontWeight: 600 }}>
                                    마지막 업데이트: {primaryDeviceUpdatedLabel} · 상태: <span style={{ color: primaryDeviceSafetyLabel === "양호" ? "#087653" : "#9A6500", fontWeight: 800 }}>{primaryDeviceSafetyLabel}</span>
                                    {deviceStatusRefreshPending && <span> · 요청 중</span>}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleParentDeviceRefreshClick}
                                    style={{ border: "none", background: "linear-gradient(135deg,#31C48D,#15936B)", color: "white", borderRadius: 999, padding: "6px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: FF, flexShrink: 0, boxShadow: "0 4px 12px rgba(49, 196, 141, 0.18)" }}
                                >
                                    {deviceStatusRefreshPending ? "요청 중" : "지금 갱신"}
                                </button>
                            </div>
                        </section>
                    )}

                    <button
                        type="button"
                        className="hyeni-v5-memo-mini"
                        style={{
                            width: "100%",
                            fontFamily: FF,
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            padding: "16px 18px",
                            background: "linear-gradient(135deg, #FFFDF8 0%, var(--brand-rose-soft, #FFE2EC) 100%)",
                            border: "1px solid var(--brand-rose-line, #FFD0DD)",
                            borderRadius: 24,
                            boxShadow: "var(--shadow-soft, 0 8px 24px rgba(31, 24, 28, 0.06))",
                            cursor: "pointer",
                            textAlign: "left",
                            marginTop: 14,
                        }}
                        onClick={handleParentMemoOpen}
                    >
                        <span className="hyeni-v5-memo-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, flexShrink: 0 }}>
                            <ThreeDIcon name="chat-heart" size={42} aria-label="" />
                        </span>
                        <span className="hyeni-v5-memo-body" style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                            <span className="hyeni-v5-memo-label" style={{ fontSize: 12, fontWeight: 800, color: "var(--brand-rose-text, #B83262)", letterSpacing: "-0.01em" }}>오늘의 메모</span>
                            <span className="hyeni-v5-memo-text" style={{ fontSize: 14, fontWeight: 700, color: "#202024", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{memoPreviewText}</span>
                            {memoPreviewMeta && <span className="hyeni-v5-memo-meta" style={{ fontSize: 11, fontWeight: 600, color: "#9A9AA0" }}>{memoPreviewMeta}</span>}
                        </span>
                        <span
                            className="hyeni-v5-memo-count"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: 28,
                                height: 28,
                                padding: "0 8px",
                                borderRadius: 999,
                                background: "var(--brand-rose, #F779A8)",
                                color: "#FFFFFF",
                                fontSize: 12,
                                fontWeight: 800,
                                flexShrink: 0,
                            }}
                        >
                            {memoPreviewCount}
                        </span>
                    </button>

                    <div className="hyeni-v5-section-head" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22, marginBottom: 10, padding: "0 4px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: "#202024", letterSpacing: "-0.01em" }}>
                            <ThreeDIcon name="check" size={20} aria-label="" />
                            바로가기
                        </span>
                    </div>
                    <div className="hyeni-v5-action-rail" aria-label="관리 바로가기">
                        {quickUtilityActions.map(action => (
                            <button
                                key={action.key}
                                type="button"
                                onClick={action.onClick}
                                className="hyeni-v5-action-chip"
                                data-action-key={action.key}
                                style={{ color: action.palette?.color || DESIGN.colors.ink, fontFamily: FF }}
                                aria-label={action.ariaLabel}
                            >
                                {action.iconKey ? (
                                    <ThreeDIcon name={action.iconKey} size={28} aria-label="" />
                                ) : (
                                    <span aria-hidden="true">{action.icon}</span>
                                )}
                                <span>{action.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="hyeni-v5-section-head" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22, marginBottom: 10, padding: "0 4px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: "#202024", letterSpacing: "-0.01em" }}>
                            <ThreeDIcon name="calendar-heart" size={20} aria-label="" />
                            캘린더
                        </span>
                        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--fg-tertiary, #9A9AA0)" }}>
                            {currentYear}년 {MONTHS_KO[currentMonth]}
                        </span>
                    </div>
                    <section ref={parentCalendarRef} id="parent-calendar-section" aria-label="캘린더">
                        {renderParentCalendarGrid("parent-main")}
                    </section>

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
                            <div className="hyeni-v5-empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 16px 22px" }}>
                                <div aria-hidden="true" style={{ position: "relative", width: 132, height: 132, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ position: "absolute", top: -2, left: 4, fontSize: 26, opacity: 0.8 }}>☁️</span>
                                    <span style={{ position: "absolute", top: 6, right: 0, fontSize: 18, opacity: 0.7 }}>☁️</span>
                                    <HyeniMascot variant="static" size={116} aria-label="" />
                                </div>
                                <div style={{ fontWeight: 800 }}>선택한 날짜에 등록된 일정이 없어요.</div>
                                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>{parentCapabilities.canWriteSchedule ? "날짜를 눌러 일정을 추가해 주세요." : "가족 연동 후 일정을 추가할 수 있어요."}</div>
                            </div>
                        )}
                    </div>

                    {renderSelectedDateMovementSummary()}

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
                                    onClick={() => handleCalendarDateSelect(day, { openAddWhenEmpty: true })}
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
                                    openManualAddEventModal();
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
                    <button onClick={openManualAddEventModal}
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
                            onClick={openManualAddEventModal}
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
                            <div className="hyeni-v5-empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 16px 22px" }}>
                                <div aria-hidden="true" style={{ position: "relative", width: 132, height: 132, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ position: "absolute", top: -2, left: 4, fontSize: 26, opacity: 0.8 }}>☁️</span>
                                    <span style={{ position: "absolute", top: 6, right: 0, fontSize: 18, opacity: 0.7 }}>☁️</span>
                                    <HyeniMascot variant="static" size={116} aria-label="" />
                                </div>
                                <div style={{ fontWeight: 800 }}>선택한 날짜에 등록된 일정이 없어요.</div>
                                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>{parentCapabilities.canWriteSchedule ? "날짜를 누르거나 오른쪽 위 + 버튼으로 일정을 추가해 주세요." : "가족 연동 후 일정을 추가할 수 있어요."}</div>
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
                            childList={(familyInfo?.members ?? []).filter(m => m.role === "child")}
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
                onClose={() => { setShowAddModal(false); setEditingEventId(null); setAddEventDateKey(null); setNewTitle(""); setNewEndTime(""); setTimeSelectionTarget("start"); setNewLocation(null); setSelectedPreset(null); setWeeklyRepeat(false); setRepeatWeeks(4); }}
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
                            <div className="hyeni-schedule-time-card">
                                <div className="hyeni-schedule-time-head">
                                    <div>
                                        <span className="hyeni-schedule-time-kicker">시간대 선택</span>
                                        <strong>{selectedTimeRangeLabel}</strong>
                                    </div>
                                    <div className="hyeni-time-target-toggle" role="group" aria-label="시간 선택 대상">
                                        <button
                                            type="button"
                                            className={timeSelectionTarget === "start" ? "is-active" : ""}
                                            onClick={() => setTimeSelectionTarget("start")}
                                        >
                                            시작
                                        </button>
                                        <button
                                            type="button"
                                            className={timeSelectionTarget === "end" ? "is-active" : ""}
                                            onClick={() => setTimeSelectionTarget("end")}
                                        >
                                            종료
                                        </button>
                                    </div>
                                </div>
                                <div className="hyeni-time-direct-row" role="group" aria-label="시간 직접 입력">
                                    <label className="hyeni-time-direct-field">
                                        <span>시작</span>
                                        <input
                                            type="time"
                                            className="hyeni-time-input hyeni-time-direct-input"
                                            value={newTime || ""}
                                            step={60}
                                            onChange={(e) => handleStartTimeInputChange(e.target.value)}
                                            aria-label="시작 시간 직접 입력"
                                        />
                                    </label>
                                    <span className="hyeni-time-direct-divider" aria-hidden="true">~</span>
                                    <label className="hyeni-time-direct-field">
                                        <span>종료</span>
                                        <input
                                            type="time"
                                            className="hyeni-time-input hyeni-time-direct-input"
                                            value={newEndTime || ""}
                                            step={60}
                                            onChange={(e) => handleEndTimeInputChange(e.target.value)}
                                            aria-label="종료 시간 직접 입력"
                                            placeholder="--:--"
                                        />
                                    </label>
                                </div>
                                <div className="hyeni-time-rail" role="group" aria-label="일정 시간대 선택">
                                    <div className="hyeni-time-ruler" aria-hidden="true">
                                        {[7, 9, 11, 13, 15, 17, 19, 21].map(hour => (
                                            <span key={hour}>{hour < 12 ? `${hour}시` : `${hour - 12 || 12}시`}</span>
                                        ))}
                                    </div>
                                    <div className="hyeni-time-slot-row">
                                        {SCHEDULE_TIME_SLOTS.map(minutes => {
                                            const value = formatScheduleTimeValue(minutes);
                                            const isStart = minutes === selectedStartMinutes;
                                            const isEnd = hasSelectedEndTime && minutes === selectedEndMinutes;
                                            const isSelected = hasSelectedEndTime
                                                ? minutes >= selectedStartMinutes && minutes <= selectedEndMinutes
                                                : isStart;
                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    className={`hyeni-time-slot${isSelected ? " is-selected" : ""}${isStart ? " is-start" : ""}${isEnd ? " is-end" : ""}`}
                                                    aria-label={`${formatKoreanScheduleTime(value)} ${timeSelectionTarget === "start" ? "시작" : "종료"} 시간 선택`}
                                                    aria-pressed={isStart || isEnd}
                                                    onClick={() => handleScheduleTimeSlotSelect(minutes)}
                                                >
                                                    <span>{minutes % 60 === 0 ? `${Math.floor(minutes / 60) % 12 || 12}` : ""}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="hyeni-time-duration-row" aria-label="종료 시간 빠른 선택">
                                    {[30, 60, 90, 120].map(durationMinutes => (
                                        <button
                                            key={durationMinutes}
                                            type="button"
                                            onClick={() => handleDurationPresetSelect(durationMinutes)}
                                        >
                                            {formatScheduleDuration(durationMinutes)}
                                        </button>
                                    ))}
                                </div>
                                <div className="hyeni-time-summary">
                                    <div>
                                        <strong>{selectedTimeRangeLabel}</strong>
                                        <span>{selectedTimeDurationLabel}</span>
                                    </div>
                                    {newEndTime && (
                                        <button type="button" onClick={() => { setNewEndTime(""); setTimeSelectionTarget("end"); }}>
                                            종료 제거
                                        </button>
                                    )}
                                </div>
                            </div>
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
                                        {(() => { const [y, m, d] = scheduleDraftDateKey.split("-").map(Number); const end = new Date(y, m, d + (repeatWeeks - 1) * 7); return `${m + 1}/${d} ~ ${end.getMonth() + 1}/${end.getDate()} 매주 ${["일","월","화","수","목","금","토"][new Date(y, m, d).getDay()]}요일`; })()}
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
                    currentCharacter={currentChildCharacter}
                    onChangeCharacter={handleChildCharacterChange}
                    characterSaving={childCharacterSaving}
                    childName={authUser?.user_metadata?.name || familyInfo?.members?.find((m) => m.user_id === authUser?.id)?.name || ""}
                    parentNames={(familyInfo?.members || []).filter((m) => m.role === "parent").map((m) => m.name).join(", ")}
                    onRequestParentChange={() => showNotif("부모님께 변경 요청을 보냈어요")}
                    onLogout={async () => {
                        if (!window.confirm("정말 로그아웃할까?")) return;
                        try { await logout(); } catch (e) { console.error(e); }
                        if (typeof window !== "undefined") window.localStorage.removeItem("hyeni-last-role");
                        setFamilyInfo(null);
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
                    notifyEvents={!!globalNotif.parentEnabled}
                    onChangeNotifyEvents={(v) => updateGlobalNotif({ parentEnabled: v, childEnabled: v })}
                    notifMinutesBefore={globalNotif.minutesBefore}
                    onChangeNotifMinutes={(mins) => updateGlobalNotif({ minutesBefore: mins })}
                    subscriptionPlanLabel={entitlement?.tier === "premium" ? "프리미엄" : "무료"}
                    appVersion={typeof window !== "undefined" && window.__APP_VERSION__ ? String(window.__APP_VERSION__) : ""}
                    onLogout={async () => {
                        if (!window.confirm("로그아웃 할까요?")) return;
                        try { await logout(); } catch (e) { console.error(e); }
                        if (typeof window !== "undefined") window.localStorage.removeItem("hyeni-last-role");
                        setFamilyInfo(null);
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
                    bottomNavigation={isParent ? renderParentBottomTabbar("maplist", "hyeni-v5-tabbar-manager") : null}
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
                            showNotif("보조 보호자는 연동 코드를 바꿀 수 없어요.", "error");
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
                            showNotif("보조 보호자는 연동을 끊을 수 없어요.", "error");
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
                        showNotif("보조 보호자는 연락처를 바꿀 수 없어요.", "error");
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
                recipient={FEEDBACK_RECIPIENT}
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
                    showNotif(`${newEv.emoji} ${newEv.title} 추가했어요!`);
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
                        showNotif("보조 보호자는 위험지역을 바꿀 수 없어요.", "error");
                        throw new Error("co-parent danger zone blocked");
                    }
                    if (dangerZones.length >= 1 && !entitlement.canUse(FEATURES.MULTI_GEOFENCE)) {
                        openFeatureLock(FEATURES.MULTI_GEOFENCE);
                        throw new Error("프리미엄 구독이 필요합니다");
                    }
                    const saved = await saveDangerZone(familyId, zone);
                    setDangerZones(prev => [...prev, saved]);
                    showNotif(`⚠️ 위험지역 '${zone.name}' 추가했어요!`);
                    return saved;
                }}
                onDelete={async (id) => {
                    if (!parentCapabilities.canManagePlaces) {
                        showNotif("보조 보호자는 위험지역을 바꿀 수 없어요.", "error");
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
