import { useState, useEffect, useRef, useCallback } from "react";
import { kakaoLogin, getSession, setupFamily, joinFamily, joinFamilyAsParent, getMyFamily, unpairChild, saveParentPhones, generateUUID } from "./lib/auth.js";
import { fetchEvents, fetchAcademies, fetchMemos, insertEvent, updateEvent, deleteEvent as dbDeleteEvent, insertAcademy, updateAcademy, deleteAcademy as dbDeleteAcademy, upsertMemo, subscribeFamily, unsubscribe, getCachedEvents, getCachedAcademies, getCachedMemos, cacheEvents, cacheAcademies, cacheMemos, saveChildLocation, fetchChildLocations, saveLocationHistory, fetchTodayLocationHistory, addSticker, fetchStickersForDate, fetchStickerSummary, fetchDangerZones, saveDangerZone, deleteDangerZone, fetchParentAlerts, markAlertRead, fetchMemoReplies, insertMemoReply, markMemoRead } from "./lib/sync.js";
import { registerSW, requestPermission, getPermissionStatus, scheduleNotifications, scheduleNativeAlarms, showArrivalNotification, showEmergencyNotification, showKkukNotification, clearAllScheduled, subscribeToPush, unsubscribeFromPush, getNativeNotificationHealth, openNativeNotificationSettings } from "./lib/pushNotifications.js";
import { supabase } from "./lib/supabase.js";
import "./App.css";

import { KAKAO_APP_KEY, SUPABASE_URL, SUPABASE_KEY, PARENT_PAIRING_INTENT_KEY, PUSH_FUNCTION_URL, AI_PARSE_URL, AI_MONITOR_URL, FF, DAYS_KO, MONTHS_KO, ARRIVAL_R, DEPARTURE_TIMEOUT_MS, DEFAULT_NOTIF, getNativeSetupAction, sendInstantPush, rememberParentPairingIntent, clearParentPairingIntent, escHtml, haversineM, getDIM, getFD, fmtT } from "./lib/utils.js";
import { DEFAULT_CATEGORIES, LS_CUSTOM_CATS, loadCategories, saveCustomCategories, getCustomCategories, DEFAULT_CAT_IDS, ACADEMY_PRESETS, SCHEDULE_PRESETS, getCategories } from "./lib/categories.js";
import { REMOTE_AUDIO_DEFAULT_DURATION_SEC, startRemoteAudioCapture, stopRemoteAudioCapture } from "./lib/remoteAudio.js";
import { startNativeLocationService, stopNativeLocationService } from "./lib/locationService.js";
import { loadKakaoMap } from "./lib/kakaoMaps.js";
import useAuth from "./hooks/useAuth.js";
import BunnyMascot from "./components/common/BunnyMascot.jsx";
import AlertBanner from "./components/common/AlertBanner.jsx";
import EmergencyBanner from "./components/common/EmergencyBanner.jsx";
import MapZoomControls from "./components/common/MapZoomControls.jsx";
import KakaoStaticMap from "./components/common/KakaoStaticMap.jsx";
import ChildPairInput from "./components/auth/ChildPairInput.jsx";
import PairCodeSection from "./components/auth/PairCodeSection.jsx";
import ParentSetupScreen from "./components/auth/ParentSetupScreen.jsx";
import RoleSetupModal from "./components/auth/RoleSetupModal.jsx";
import PairingModal from "./components/auth/PairingModal.jsx";
import DayTimetable from "./components/calendar/DayTimetable.jsx";
import AcademyManager from "./components/calendar/AcademyManager.jsx";
import CategoryAddForm from "./components/calendar/CategoryAddForm.jsx";
import StickerBookModal from "./components/calendar/StickerBookModal.jsx";
import PhoneSettingsModal from "./components/memo/PhoneSettingsModal.jsx";
import ChildCallButtons from "./components/memo/ChildCallButtons.jsx";
import AiScheduleModal from "./components/ai/AiScheduleModal.jsx";
import AmbientAudioRecorder from "./components/common/AmbientAudioRecorder.jsx";
import RouteOverlay from "./components/location/RouteOverlay.jsx";


// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────







// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function KidsScheduler() {
    const today = new Date();

    // ── Auth & family state (from useAuth hook) ─────────────────────────────────
    const {
        authUser, setAuthUser,
        authLoading,
        myRole, setMyRole,
        familyInfo, setFamilyInfo,
        showParentSetup, setShowParentSetup,
        isParent,
        isNativeApp,
        familyId,
        pairCode,
        pairedChildren,
        handleChildSelect,
        handleLogout,
        handleAuthUser,
    } = useAuth();
    const [showPairing, setShowPairing] = useState(false);
    const _pairedDevice = pairedChildren[0] || null; // 첫 번째 아이 (하위호환)

    // ── Academy, calendar, memo state ───────────────────────────────────────────
    const [academies, setAcademies] = useState(() => getCachedAcademies());
    const [showAcademyMgr, setShowAcademyMgr] = useState(false);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState(today.getDate());
    const [events, setEvents] = useState(() => getCachedEvents());
    const [memos, setMemos] = useState(() => getCachedMemos());
    const [memoReplies, setMemoReplies] = useState([]);
    const [memoReadBy, setMemoReadBy] = useState([]);
    const [globalNotif, _setGlobalNotif] = useState(DEFAULT_NOTIF);
    const [parentPhones, setParentPhones] = useState({ mom: "", dad: "" });
    const [showPhoneSettings, setShowPhoneSettings] = useState(false);

    // ── UI state ───────────────────────────────────────────────────────────────
    const [showAddModal, setShowAddModal] = useState(false);
    const [showCatAdd, setShowCatAdd] = useState(false);
    const [newCatKey, setNewCatKey] = useState(0); // force re-render on category change
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [showChildTracker, setShowChildTracker] = useState(false);
    const [_listening, setListening] = useState(false);
    const [notification, setNotification] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [emergencies, setEmergencies] = useState([]);
    const [bounce, setBounce] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [mapError, setMapError] = useState("");
    const [activeView, setActiveView] = useState("calendar");
    const [editingLocForEvent, setEditingLocForEvent] = useState(null);
    const [showKkukReceived, setShowKkukReceived] = useState(null); // { from: "엄마"|"아이", timestamp }
    const [kkukCooldown, setKkukCooldown] = useState(false);

    // ── Arrival tracking ───────────────────────────────────────────────────────
    const [arrivedSet, setArrivedSet] = useState(new Set());
    const [firedNotifs, setFiredNotifs] = useState(new Set());
    const [firedEmergencies, setFiredEmergencies] = useState(new Set());
    const [childPos, setChildPos] = useState(null);
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
    const memoSaveTimer = useRef(null);
    const memoDirty = useRef(false);       // true when memo has unsent push
    const memoLastValue = useRef("");       // last memo value for push
    const dateKey = `${currentYear}-${currentMonth}-${selectedDate}`;
    dateKeyRef.current = dateKey;

    // ── Load memo replies & mark as read when viewing a date with memo ────────
    const currentMemo = memos[dateKey] || "";
    const hasMemo = currentMemo.length > 0;
    useEffect(() => {
        if (!familyId || !dateKey) return;
        fetchMemoReplies(familyId, dateKey).then(setMemoReplies).catch(() => {});
        // Mark memo as read by this user
        if (hasMemo && authUser?.id) {
            markMemoRead(familyId, dateKey, authUser.id).catch(() => {});
        }
        // Fetch read_by from memos table
        supabase.from("memos").select("read_by").eq("family_id", familyId).eq("date_key", dateKey).maybeSingle()
            .then(({ data }) => setMemoReadBy(data?.read_by || []));
    }, [familyId, dateKey, hasMemo]);

    // ── Load Kakao Maps SDK on mount ────────────────────────────────────────────
    useEffect(() => {
        if (!KAKAO_APP_KEY) return;
        loadKakaoMap(KAKAO_APP_KEY).then(() => setMapReady(true)).catch((e) => {
            console.error("[KakaoMap] load failed:", e.message);
            const origin = window.location.origin;
            setMapError(e.message === "timeout"
                ? `지도 로딩 시간 초과\n\n카카오 개발자 콘솔에서\n플랫폼 → Web → ${origin}\n도메인이 등록되어 있는지 확인하세요`
                : `지도 로딩 실패: ${e.message}\n\n카카오 개발자 콘솔에서\n플랫폼 → Web → ${origin}\n도메인 등록을 확인하세요`);
        });
    }, []);

    // ── Send memo push when app goes to background / closes ─────────────────────
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === "hidden" && memoDirty.current && familyId && authUser && memoLastValue.current.trim()) {
                memoDirty.current = false;
                // Flush DB save
                if (memoSaveTimer.current) { clearTimeout(memoSaveTimer.current); memoSaveTimer.current = null; }
                upsertMemo(familyId, dateKey, memoLastValue.current).catch(() => {});
                sendInstantPush({
                    action: "new_memo",
                    familyId,
                    senderUserId: authUser.id,
                    title: `📒 ${myRole === "parent" ? "부모님" : "아이"}이 메모를 남겼어요`,
                    message: memoLastValue.current.length > 50 ? memoLastValue.current.substring(0, 50) + "..." : memoLastValue.current,
                });
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [familyId, authUser?.id, myRole, dateKey]);

    // ── Sync parent phones from familyInfo ─────────────────────────────────────
    useEffect(() => {
        if (familyInfo?.phones) {
            setParentPhones(familyInfo.phones);
        }
    }, [familyInfo]);

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

    // ── Fetch data + subscribe when familyId is available ───────────────────────
    useEffect(() => {
        if (!familyId) return;

        // Fetch fresh data from Supabase
        fetchEvents(familyId).then(map => setEvents(map));
        fetchAcademies(familyId).then(list => setAcademies(list));
        fetchMemos(familyId).then(map => setMemos(map));

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
                // Never overwrite the currently viewed date's memo (user may be editing)
                if (newRow.date_key === dateKeyRef.current) return;
                setMemos(prev => {
                    const updated = { ...prev };
                    updated[newRow.date_key] = newRow.content || "";
                    cacheMemos(updated);
                    return updated;
                });
            },
            onLocationChange: (payload) => {
                setChildPos(payload);
            },
            onKkuk: (payload) => {
                // Received '꾹' from the other party
                if (payload.senderId !== authUser?.id) {
                    const senderLabel = payload.senderRole === "parent" ? "엄마" : "아이";
                    setShowKkukReceived({ from: senderLabel, timestamp: Date.now() });
                    // Vibrate if supported
                    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
                    // Native notification (wakes screen on Android)
                    showKkukNotification(senderLabel);
                }
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
                try {
                    await startRemoteAudioCapture(realtimeChannel.current, payload.duration || REMOTE_AUDIO_DEFAULT_DURATION_SEC);
                } catch (e) { console.error("[Audio] Remote recording failed:", e); }
            },
            onRemoteListenStop: () => {
                stopRemoteAudioCapture();
            },
            onAudioChunk: (payload) => {
                // Parent receives audio chunk - handled by AmbientAudioRecorder component
                if (!isParent) return;
                // Dispatch custom event for the recorder component to pick up
                window.dispatchEvent(new CustomEvent("remote-audio-chunk", { detail: payload }));
            }
        });

        return () => { unsubscribe(realtimeChannel.current); };
    }, [familyId]);

    // ── Child: check if launched via FCM remote_listen ──
    useEffect(() => {
        if (isParent || !familyId) return;
        const checkFlag = () => {
            if (window.__REMOTE_LISTEN_REQUESTED && realtimeChannel.current) {
                window.__REMOTE_LISTEN_REQUESTED = false;
                console.log("[Audio] Auto-starting remote listen from FCM launch");
                (async () => {
                    try {
                        await startRemoteAudioCapture(realtimeChannel.current, REMOTE_AUDIO_DEFAULT_DURATION_SEC);
                    } catch (e) { console.error("[Audio] Auto remote recording failed:", e); }
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
    }, [isParent, familyId]);

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
        }, 30000);
        return () => clearInterval(poll);
    }, [familyId]);

    // ── 꾹 (emergency ping) ────────────────────────────────────────────────────
    const sendKkuk = useCallback(async () => {
        if (kkukCooldown || !familyId || !authUser) return;
        setKkukCooldown(true);
        setTimeout(() => setKkukCooldown(false), 5000); // 5s cooldown

        const senderRole = isParent ? "parent" : "child";
        const senderLabel = isParent ? "엄마" : "아이";

        // 1. Realtime broadcast (instant, if other party has app open)
        if (realtimeChannel.current && realtimeChannel.current.state === "joined") {
            realtimeChannel.current.send({
                type: "broadcast",
                event: "kkuk",
                payload: { senderId: authUser.id, senderRole, timestamp: Date.now() }
            });
        }

        // 2. Push notification + pending_notifications (works when app is closed)
        try {
            await sendInstantPush({
                action: "kkuk",
                familyId,
                senderUserId: authUser.id,
                title: "💗 꾹!",
                message: `${senderLabel}가 꾹을 보냈어요!`,
            });
        } catch (e) {
            console.error("[kkuk] push failed:", e);
        }

        // Vibrate own device as feedback
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        showNotif("💗 꾹을 보냈어요!");
    }, [familyId, authUser, isParent, kkukCooldown]);

    // ── Android 뒤로가기 버튼 처리 ───────────────────────────────────────────────
    const backStateRef = useRef({});
    useEffect(() => {
        backStateRef.current = {
            routeEvent, showChildTracker, showMapPicker, showAddModal,
            showAcademyMgr, showPhoneSettings, showParentSetup, editingLocForEvent,
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
                    if (s.showAlertPanel)      { setShowAlertPanel(false);      return; }
                    if (s.showPhoneSettings)   { setShowPhoneSettings(false);   return; }
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
    const showNotif = useCallback((msg, type = "success") => {
        setNotification({ msg, type });
        if (notifTimer.current) clearTimeout(notifTimer.current);
        notifTimer.current = setTimeout(() => setNotification(null), 3500);
    }, []);

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
            let lastSave = 0;
            wid = navigator.geolocation.watchPosition(
                p => {
                    const newPos = { lat: p.coords.latitude, lng: p.coords.longitude };
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
                },
                (err) => {
                    if (err.code === 1) showNotif("📍 위치 권한이 꺼져 있어요. 설정에서 켜주세요!", "error");
                    else if (err.code === 2) showNotif("📍 위치를 찾을 수 없어요. GPS를 확인해주세요", "error");
                    else showNotif("📍 위치 추적 오류가 발생했어요", "error");
                },
                { enableHighAccuracy: true, maximumAge: 5000 }
            );
        }

        return () => {
            if (wid !== null) navigator.geolocation.clearWatch(wid);
            if (iv) clearInterval(iv);
        };
    }, [myRole, authUser?.id, familyId]);

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
                    // 도착 체크 범위: 너무 일찍 도착하거나 조금 늦은 경우도 허용
                    if (diff < -90 || diff > 60) return;
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

                    if (isParent && globalNotif.parentEnabled) {
                        addAlert(`✅ 혜니가 ${ev.title}에 ${isLate ? "늦게" : "잘"} 도착했어요 (${msg})`, "parent");
                    }
                    sendInstantPush({
                        action: "new_event",
                        familyId, senderUserId: authUser?.id,
                        title: `${isLate ? "⏰" : "✅"} ${ev.emoji} 도착 알림`,
                        message: `혜니가 ${ev.title}에 ${isLate ? "늦게" : "잘"} 도착했어요! (${msg})`,
                    });
                    showArrivalNotification(ev, msg, myRole);

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
                                    action: "new_event",
                                    familyId, senderUserId: authUser?.id,
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
    }, [childPos, events, arrivedSet, globalNotif, addAlert, familyId, authUser, departedAlerts, isParent]);

    // ── Advance notifications (friendly messages) ─────────────────────────────
    useEffect(() => {
        const friendlyChildMsg = (ev, mins) => {
            if (mins === 15) return `🐰 ${ev.emoji} ${ev.title} 가기 15분 전이야! 준비물 챙겼니? 🎒`;
            if (mins === 5) return `🏃 ${ev.emoji} ${ev.title} 곧 시작이야! 출발~ 화이팅! 💪`;
            if (mins >= 60) return `🐰 ${ev.emoji} ${ev.title} ${mins / 60}시간 후에 시작해요!`;
            return `🐰 ${ev.emoji} ${ev.title} ${mins}분 후에 시작해요!`;
        };
        const check = () => {
            if (!myRole) return; // 역할 확정 전에는 실행하지 않음
            const now = new Date(); const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
            (events[key] || []).forEach(ev => {
                const [h, m] = ev.time.split(":").map(Number);
                const evMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
                const eff = ev.notifOverride || globalNotif;
                eff.minutesBefore.forEach(mins => {
                    const fireKey = `${ev.id}-${mins}`;
                    if (Math.abs(now.getTime() - (evMs - mins * 60000)) <= 35000 && !firedNotifs.has(fireKey)) {
                        setFiredNotifs(prev => new Set([...prev, fireKey]));
                        const label = mins >= 60 ? `${mins / 60}시간` : `${mins}분`;
                        if (!isParent && eff.childEnabled) { showNotif(friendlyChildMsg(ev, mins), "child"); setBounce(true); setTimeout(() => setBounce(false), 800); }
                        if (isParent && eff.parentEnabled) addAlert(`${ev.emoji} ${ev.title} ${label} 전 알림 — ${ev.time} 시작`, "parent");
                    }
                });
            });
        };
        check(); const id = setInterval(check, 30000); return () => clearInterval(id);
    }, [events, globalNotif, firedNotifs, showNotif, addAlert, isParent]);

    // ── Push notification scheduling ────────────────────────────────────────────
    useEffect(() => {
        if (pushPermission === "granted") {
            scheduleNotifications(events, globalNotif, myRole);
        }
        // Always schedule native AlarmManager alarms (persistent, works when app killed)
        scheduleNativeAlarms(events, globalNotif, myRole);
        return () => clearAllScheduled();
    }, [events, globalNotif, pushPermission, myRole]);

    // ── Emergency check ────────────────────────────────────────────────────────
    useEffect(() => {
        const check = () => {
            const now = new Date(); const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
            (events[key] || []).forEach(ev => {
                if (!ev.location || arrivedSet.has(ev.id) || firedEmergencies.has(ev.id)) return;
                const [h, m] = ev.time.split(":").map(Number);
                const minsUntil = (new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime() - now.getTime()) / 60000;
                // 일정 시작 시간에 미도착 시에만 긴급 알림 (시작 시간 ~ 시작 후 3분)
                if (minsUntil <= 0 && minsUntil > -3) {
                    setFiredEmergencies(prev => new Set([...prev, ev.id]));
                    if (isParent) {
                        const shortAddr = (ev.location.address || "").split(" ").slice(0, 4).join(" ");
                        setEmergencies(prev => [...prev, { id: Date.now() + Math.random(), emoji: ev.emoji, title: ev.title, time: ev.time, location: shortAddr, eventId: ev.id }]);
                        addAlert(`🚨 긴급! ${ev.emoji} ${ev.title} 시간인데 아직 미도착!`, "emergency");
                        showEmergencyNotification(ev);
                        sendInstantPush({
                            action: "new_event", familyId, senderUserId: authUser?.id,
                            title: `🚨 미도착 긴급 알림`,
                            message: `${ev.emoji} ${ev.title} 시간인데 아직 도착하지 않았어요!`,
                        });
                    }
                }
            });
        };
        check(); const id = setInterval(check, 30000); return () => clearInterval(id);
    }, [events, arrivedSet, firedEmergencies, addAlert, isParent]);

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
                    await updateEvent(targetId, { memo: newMemoVal });
                    await upsertMemo(familyId, dateKey, newMemoVal);
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
        const cat = getCategories().find(c => c.id === catId) || getCategories().find(c => c.id === "other");
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
        const cat = getCategories().find(c => c.id === newCategory);
        const emoji = selectedPreset ? selectedPreset.emoji : cat.emoji;

        const totalWeeks = weeklyRepeat ? repeatWeeks : 1;
        const allEvents = [];
        const skippedDateKeys = [];
        for (let w = 0; w < totalWeeks; w++) {
            const dk = w === 0 ? dateKey : addDaysToDateKey(dateKey, w * 7);
            const duplicateExists = (events[dk] || []).some(ev => ev.title === title && ev.time === newTime);
            if (duplicateExists) {
                skippedDateKeys.push(dk);
                continue;
            }
            allEvents.push({ ev: { id: generateUUID(), title, time: newTime, endTime: newEndTime || null, category: newCategory, emoji, color: cat.color, bg: cat.bg, memo: newMemo.trim(), location: newLocation, notifOverride: null }, dateKey: dk });
        }

        if (allEvents.length === 0) {
            showNotif("같은 시간의 동일한 일정이 이미 있어요", "error");
            return;
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
        if (skippedDateKeys.length > 0) {
            showNotif(`✨ ${allEvents.length}개 추가, ${skippedDateKeys.length}개 중복 일정은 건너뛰었어요!`);
        } else {
            showNotif(weeklyRepeat ? `✨ ${totalWeeks}주 반복 일정이 추가됐어요!` : "✨ 일정이 추가됐어요!");
        }
        setBounce(true); setTimeout(() => setBounce(false), 800);

        // Persist to Supabase (Realtime will sync to other device)
        if (familyId && authUser) {
            try {
                for (const { ev, dateKey: dk } of allEvents) {
                    await insertEvent(ev, familyId, dk, authUser.id);
                }
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
    const inputSt = { width: "100%", padding: "12px 14px", border: "2px solid #F3F4F6", borderRadius: 14, fontSize: 15, color: "#374151", fontFamily: FF, outline: "none", boxSizing: "border-box" };
    const labelSt = { fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" };
    const cardSt = { width: "100%", maxWidth: 420, background: "white", borderRadius: 28, boxShadow: "0 8px 32px rgba(232,121,160,0.12)", padding: 20, marginBottom: 14 };
    const primBtn = { width: "100%", padding: "15px", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 20, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FF, marginTop: 16 };
    const secBtn = { width: "100%", padding: "12px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8, fontFamily: FF };

    const TABS = [["calendar", "📅 달력"], ["maplist", "📍 장소"]];

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
        if (!authUser || !code.trim()) return;
        try {
            await joinFamilyAsParent(code.trim(), authUser.id, authUser.user_metadata?.name || "부모");
            const fam = await getMyFamily(authUser.id);
            if (fam) {
                setFamilyInfo(fam);
                setMyRole(fam.myRole);
                setShowParentSetup(false);
                showNotif("가족에 합류했어요! 🎉");
            }
        } catch (err) {
            console.error("[joinAsParent]", err);
            showNotif("합류 실패: 코드를 확인해주세요", "error");
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
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#FFF0F7,#E8F4FD)", fontFamily: FF }}>
            <div style={{ textAlign: "center" }}>
                <BunnyMascot size={80} />
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

    if (showAcademyMgr) return (
        <AcademyManager academies={academies} currentPos={childPos}
            onSave={async (newList) => {
                // Diff old vs new to determine DB operations
                const oldMap = new Map(academies.filter(a => a.id).map(a => [a.id, a]));
                const newMap = new Map(newList.filter(a => a.id).map(a => [a.id, a]));
                let hasChanges = false;

                // Deleted: in old but not in new
                for (const [id] of oldMap) {
                    if (!newMap.has(id)) {
                        hasChanges = true;
                        try { await dbDeleteAcademy(id); } catch (e) { console.error("[academy] delete error:", e); }
                    }
                }

                // New items (no id) → generate UUID and insert
                const finalList = [];
                for (const a of newList) {
                    if (!a.id) {
                        hasChanges = true;
                        const ac = { ...a, id: generateUUID() };
                        finalList.push(ac);
                        if (familyId) {
                            try { await insertAcademy(ac, familyId); } catch (e) { console.error("[academy] insert error:", e); }
                        }
                    } else if (!oldMap.has(a.id)) {
                        hasChanges = true;
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
                            hasChanges = true;
                            try { await updateAcademy(a.id, { name: a.name, emoji: a.emoji, category: a.category, location: a.location || null, schedule: a.schedule || null }); } catch (e) { console.error("[academy] update error:", e); }
                            // 기존 일정도 업데이트 (장소, 이름, 시간, 이모지)
                            if (familyId) {
                                const cat = getCategories().find(c => c.id === a.category);
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
                        const cat = getCategories().find(c => c.id === ac.category);
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
                if (hasChanges) {
                    showNotif("🏫 학원 목록이 수정됐어요!");
                }
            }}
            onClose={() => setShowAcademyMgr(false)} />
    );

    return (
        <div style={{ minHeight: "100dvh", background: "linear-gradient(135deg,#FFF0F7 0%,#E8F4FD 50%,#FFF8E7 100%)", fontFamily: FF, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)", position: "relative", overflow: "hidden", width: "100%", boxSizing: "border-box" }}>
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
        @media(hover:hover){button:hover{transform:scale(1.03)!important}}
        button:active{transform:scale(0.97)!important}
        input:focus,textarea:focus{border-color:#F9A8D4!important}
        ::-webkit-scrollbar{display:none}
        *{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
      `}</style>


            {/* Toast */}
            {notification && (
                <div style={{
                    position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 16px)", left: "50%", transform: "translateX(-50%)",
                    background: notification.type === "error" ? "#FEE2E2" : notification.type === "child" ? "#EDE9FE" : notification.type === "parent" ? "#DBEAFE" : "#D1FAE5",
                    color: notification.type === "error" ? "#DC2626" : notification.type === "child" ? "#6D28D9" : notification.type === "parent" ? "#1D4ED8" : "#065F46",
                    borderRadius: 20, padding: "12px 20px", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 250, maxWidth: "calc(100vw - 32px)", textAlign: "center", animation: "slideDown 0.3s ease", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                    {notification.msg}
                </div>
            )}

            {/* AI Alert Panel (parent only) */}
            {showAlertPanel && isParent && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 500, fontFamily: FF, paddingTop: 60 }}
                    onClick={e => { if (e.target === e.currentTarget) setShowAlertPanel(false); }}>
                    <div style={{ background: "white", borderRadius: 24, width: "92%", maxWidth: 420, maxHeight: "75vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
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
                                {voicePreview.academyMatched && <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "4px 10px", borderRadius: 8 }}>🏫 학원 자동 매칭</div>}
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
                                    style={{ flex: 1, padding: "11px", background: "#EDE9FE", color: "#7C3AED", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>✏️ 수정</button>
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
                <div style={{ width: "100%", maxWidth: 420, marginBottom: 8, padding: "14px 14px", borderRadius: 18, background: "linear-gradient(135deg, #FEF2F2, #FEE2E2)", border: "1.5px solid #FECACA", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(239,68,68,0.12)" }}>
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
                            const result = await BgLoc.checkBackgroundLocationPermission();
                            if (result.locationServicesEnabled === false && BgLoc.openSystemLocationSettings) {
                                await BgLoc.openSystemLocationSettings();
                            } else {
                                await BgLoc.openAppLocationSettings();
                            }
                            }
                        } catch (_error) {
                            // settings open may fail in unsupported environments
                        }
                    }} style={{ padding: "9px 13px", borderRadius: 12, background: "#DC2626", color: "white", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: FF, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(220,38,38,0.2)" }}>
                        위치 설정 열기
                    </button>
                </div>
            )}

            {/* ── Push notification permission banner ── */}
            {isNativeApp && nativeSetupAction && (
                <div style={{ width: "100%", maxWidth: 420, marginBottom: 8, padding: "12px 14px", borderRadius: 18, background: "linear-gradient(135deg, #FFF7ED, #FEF3C7)", border: "1px solid #FCD34D", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(245,158,11,0.12)" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🔔</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#9A3412" }}>앱이 꺼져도 알림이 바로 보이도록 설정이 더 필요해요</div>
                        <div style={{ fontSize: 11, color: "#7C2D12", marginTop: 3, lineHeight: 1.45 }}>
                            알림 권한, 전체화면 알림, 배터리 예외, 정확한 알림 중 일부가 아직 꺼져 있어요.
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            if (nativeSetupAction.target === "notifications") {
                                const result = await requestPermission();
                                const health = await getNativeNotificationHealth();
                                if (health) {
                                    setNativeNotifHealth(health);
                                    setPushPermission(
                                        health.postPermissionGranted && health.notificationsEnabled ? "granted" : "denied"
                                    );
                                } else {
                                    setPushPermission(result);
                                }
                                if (result === "granted") {
                                    scheduleNotifications(events, globalNotif, myRole);
                                    scheduleNativeAlarms(events, globalNotif, myRole);
                                    return;
                                }
                            }

                            await openNativeNotificationSettings(nativeSetupAction.target);
                            // 배터리 예외 등은 앱 위 오버레이 다이얼로그라 visibilitychange 안 됨 → 수동 갱신
                            const poll = async (tries = 0) => {
                                if (tries > 5) return;
                                await new Promise(r => setTimeout(r, 1000));
                                const h = await getNativeNotificationHealth();
                                if (h) { setNativeNotifHealth(h); setPushPermission(h.postPermissionGranted && h.notificationsEnabled ? "granted" : "denied"); }
                                else poll(tries + 1);
                            };
                            poll();
                        }}
                        style={{ padding: "9px 13px", borderRadius: 12, background: "#EA580C", color: "white", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: FF, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(234,88,12,0.2)" }}
                    >
                        {nativeSetupAction.label}
                    </button>
                </div>
            )}
            {!isNativeApp && pushPermission !== "granted" && pushPermission !== "unsupported" && pushPermission !== "denied" && (
                <div style={{ width: "100%", maxWidth: 420, marginBottom: 8, padding: "10px 14px", borderRadius: 14, background: "linear-gradient(135deg, #DBEAFE, #EDE9FE)", display: "flex", alignItems: "center", gap: 10 }}>
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
                            scheduleNotifications(events, globalNotif, myRole);
                            scheduleNativeAlarms(events, globalNotif, myRole);
                            if (!isNativeApp && authUser?.id && familyId) {
                                subscribeToPush(authUser.id, familyId);
                            }
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
                <div style={{ width: "100%", maxWidth: 420, marginBottom: 8, padding: "8px 14px", borderRadius: 14, background: "#FEF3C7", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🔕</span>
                    <div style={{ fontSize: 11, color: "#92400E", fontWeight: 600 }}>푸시 알림이 차단됨 — 브라우저 설정에서 이 사이트의 알림을 허용해주세요</div>
                </div>
            )}

            {/* ── Header Row 1: Logo + 꾹 + 로그아웃 ── */}
            <div style={{ width: "100%", maxWidth: 420, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ animation: bounce ? "bounce 0.4s ease" : "float 3s ease-in-out infinite", cursor: "pointer", flexShrink: 0 }} onClick={() => { setBounce(true); setTimeout(() => setBounce(false), 800); showNotif("안녕! 나는 뽀짝이야 🐰"); }}>
                        <BunnyMascot size={isParent ? 36 : 44} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div onClick={() => setActiveView("calendar")} style={{ fontSize: isParent ? 16 : 18, fontWeight: 900, color: "#E879A0", letterSpacing: -0.5, whiteSpace: "nowrap", cursor: "pointer" }}>혜니캘린더</div>
                            {isParent && (
                                <span onClick={() => { if (window.confirm("역할을 다시 선택할까요?")) { setMyRole(null); setFamilyInfo(null); } }}
                                    style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, fontWeight: 700, cursor: "pointer", background: "#DBEAFE", color: "#1D4ED8", whiteSpace: "nowrap", flexShrink: 0 }}>
                                    학부모
                                </span>
                            )}
                        </div>
                        {isParent && (
                            <button onClick={() => setShowPairing(true)}
                                style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 5, border: "none", cursor: "pointer", fontFamily: FF, background: pairedChildren.length > 0 ? "#D1FAE5" : "#FEF3C7", color: pairedChildren.length > 0 ? "#065F46" : "#92400E", marginTop: 1, whiteSpace: "nowrap" }}>
                                {pairedChildren.length > 0 ? `🔗 연동 (${pairedChildren.length}명)` : "🔗 연동하기"}
                            </button>
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
                    <button onClick={sendKkuk} disabled={kkukCooldown}
                        style={{
                            fontSize: isParent ? 13 : 15, padding: isParent ? "8px 14px" : "10px 18px", borderRadius: 16, border: "none", cursor: kkukCooldown ? "default" : "pointer",
                            fontWeight: 900, fontFamily: FF, whiteSpace: "nowrap",
                            background: kkukCooldown ? "#E5E7EB" : "linear-gradient(135deg, #FF6B9D, #FF4081)",
                            color: "white", boxShadow: kkukCooldown ? "none" : "0 3px 12px rgba(255,64,129,0.4)",
                            transition: "all 0.2s", transform: kkukCooldown ? "scale(0.95)" : "scale(1)",
                        }}>
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

            {/* ── Ad Banner + Share ── */}
            <div style={{ width: "100%", maxWidth: 420, marginBottom: 8, padding: "8px 14px", borderRadius: 12, background: "linear-gradient(135deg,#FFF0F7,#FFF8E7)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", fontFamily: FF }}>
                    혜니캘린더는 누구나 무료로 사용할 수 있어요
                </div>
                <button onClick={async () => {
                    const title = "혜니캘린더";
                    const text = "아이와 부모가 함께 쓰는 일정관리 앱이에요! 무료로 사용해보세요 🐰";
                    const url = "https://kids-app-alpha.vercel.app";
                    try {
                        const { Capacitor, registerPlugin } = await import("@capacitor/core");
                        if (Capacitor.isNativePlatform()) {
                            const NativeNotif = registerPlugin("NativeNotification");
                            await NativeNotif.shareText({ title, text, url });
                            return;
                        }
                    } catch {}
                    try {
                        if (navigator.share) { await navigator.share({ title, text, url }); }
                        else { await navigator.clipboard.writeText(url); showNotif("링크가 복사됐어요!"); }
                    } catch (e) { if (e.name !== "AbortError") { try { await navigator.clipboard.writeText(url); showNotif("링크가 복사됐어요!"); } catch {} } }
                }}
                    style={{ padding: "6px 12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                    📤 공유
                </button>
            </div>

            {/* ── Header Row 2: Quick action buttons ── */}
            <div style={{ width: "100%", maxWidth: 420, display: "flex", flexWrap: "wrap", gap: isParent ? 6 : 10, marginBottom: 10 }}>
                {activeView !== "calendar" && (
                    <button onClick={() => setActiveView("calendar")}
                        style={{ fontSize: isParent ? 11 : 13, padding: isParent ? "7px 12px" : "10px 16px", borderRadius: isParent ? 12 : 16, background: "linear-gradient(135deg,#FFF0F7,#FCE7F3)", color: "#E879A0", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        🏠 홈
                    </button>
                )}
                {isParent && (
                    <button onClick={() => setShowChildTracker(true)}
                        style={{ fontSize: 11, padding: "7px 12px", borderRadius: 12, background: "#DBEAFE", color: "#1D4ED8", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        📍 우리아이
                    </button>
                )}
                {isParent && (
                    <button onClick={() => setShowAcademyMgr(true)}
                        style={{ fontSize: 11, padding: "7px 12px", borderRadius: 12, background: "#FEF3C7", color: "#92400E", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        🏫 학원관리
                    </button>
                )}
                <button onClick={() => {
                        setShowStickerBook(true);
                        if (familyId) {
                            fetchStickersForDate(familyId, dateKey).then(s => setStickers(s));
                            fetchStickerSummary(familyId).then(s => setStickerSummary(s?.[0] || null));
                        }
                    }}
                    style={{ fontSize: isParent ? 11 : 13, padding: isParent ? "7px 12px" : "10px 16px", borderRadius: isParent ? 12 : 16, background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", color: "#92400E", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                    🏆 스티커
                </button>
                {isParent && (
                    <button onClick={() => setShowPhoneSettings(true)}
                        style={{ fontSize: 11, padding: "7px 12px", borderRadius: 12, background: "#FCE7F3", color: "#BE185D", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        📞 연락처
                    </button>
                )}
                {isParent && (
                    <button onClick={() => showNotif("🎙️ 주변소리 듣기는 유료기능으로 오픈 예정이에요", "success")}
                        style={{ fontSize: 11, padding: "7px 12px", borderRadius: 12, background: "#FEE2E2", color: "#DC2626", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        🎙️ 주변소리
                    </button>
                )}
                {isParent && (
                    <button onClick={() => setShowDangerZones(true)}
                        style={{ fontSize: 11, padding: "7px 12px", borderRadius: 12, background: "#FEF2F2", color: "#DC2626", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        ⚠️ 위험지역
                    </button>
                )}
                {TABS.map(([v, l]) => (
                    <button key={v} onClick={() => setActiveView(v)}
                        style={{
                            padding: isParent ? "7px 14px" : "10px 16px", borderRadius: isParent ? 12 : 16, border: "none", cursor: "pointer", fontWeight: 700, fontSize: isParent ? 11 : 13, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0,
                            background: activeView === v ? "linear-gradient(135deg,#E879A0,#BE185D)" : "#F9FAFB", color: activeView === v ? "white" : "#6B7280",
                            boxShadow: activeView === v ? "0 3px 12px rgba(232,121,160,0.3)" : "0 1px 4px rgba(0,0,0,0.06)"
                        }}>
                        {l}
                    </button>
                ))}
            </div>

            {/* ── CALENDAR VIEW ── */}
            {activeView === "calendar" && <>
                <div style={cardSt}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: "50%", background: "#FFF0F7", border: "none", fontSize: 18, cursor: "pointer", color: "#E879A0", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#374151" }}>{currentYear}년 {MONTHS_KO[currentMonth]}</div>
                        <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: "50%", background: "#FFF0F7", border: "none", fontSize: 18, cursor: "pointer", color: "#E879A0", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                        {DAYS_KO.map((d, i) => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, padding: "4px 0", color: i === 0 ? "#F87171" : i === 6 ? "#60A5FA" : "#9CA3AF" }}>{d}</div>)}
                        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                        {Array(getDays).fill(null).map((_, i) => {
                            const day = i + 1, isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                            const isSel = day === selectedDate, isSun = (firstDay + i) % 7 === 0, isSat = (firstDay + i) % 7 === 6;
                            const dayEvs = getEvs(day);
                            return (
                                <div key={day} onClick={() => setSelectedDate(day)}
                                    style={{
                                        aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 14, cursor: "pointer", transition: "all 0.15s",
                                        background: isSel ? "#E879A0" : isToday ? "#FFF0F7" : "transparent", border: isToday && !isSel ? "2px solid #F9A8D4" : "2px solid transparent"
                                    }}>
                                    <span style={{ fontSize: 16, fontWeight: isSel ? 800 : 600, color: isSel ? "white" : isSun ? "#F87171" : isSat ? "#60A5FA" : "#374151" }}>{day}</span>
                                    {dayEvs.length > 0 && <div style={{ display: "flex", gap: 3, marginTop: 2 }}>{dayEvs.slice(0, 3).map(e => <div key={e.id} style={{ width: 6, height: 6, borderRadius: "50%", background: isSel ? "rgba(255,255,255,0.8)" : e.color }} />)}</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Academy quick pick */}
                {academies.length > 0 && (
                    <div style={{ width: "100%", maxWidth: 420, marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, paddingLeft: 4 }}>🏫 학원 빠른 추가</div>
                        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                            {academies.map((ac, i) => (
                                <button key={i} onClick={() => {
                                    const cat = getCategories().find(c => c.id === ac.category);
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
                <div style={{ width: "100%", maxWidth: 420, background: "linear-gradient(135deg, #FFF0F7, #FCE7F3)", borderRadius: 20, padding: "14px 18px", marginBottom: 14, textAlign: "center", fontSize: 13, fontWeight: 600, color: "#BE185D", fontFamily: FF, border: "1.5px solid #FBCFE8" }}>
                    혜니캘린더는 아이와 함께 만들어갑니다
                </div>

                {/* AI 일정입력 + 수동 추가 */}
                <div style={{ width: "100%", maxWidth: 420, display: "flex", gap: 8, marginBottom: 14 }}>
                    <button onClick={() => setShowAiSchedule(true)}
                        style={{
                            flex: 1, padding: "10px 16px", height: 44, color: "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: FF,
                            background: "linear-gradient(135deg,#8B5CF6,#6D28D9)", boxShadow: "0 3px 12px rgba(109,40,217,0.25)"
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
                        childPos={childPos}
                        mapReady={mapReady}
                        stickers={stickers}
                        arrivedSet={arrivedSet}
                        firedEmergencies={firedEmergencies}
                        onRoute={ev => setRouteEvent(ev)}
                        onDelete={handleDeleteEvent}
                        onEditLoc={id => { setEditingLocForEvent(id); setShowMapPicker(true); }}
                        isParentMode={isParent}
                        memoValue={memos[dateKey] || ""}
                        onMemoChange={val => {
                            setMemos(prev => ({ ...prev, [dateKey]: val }));
                            memoDirty.current = true;
                            memoLastValue.current = val;
                            // Save to DB quickly (500ms debounce)
                            if (memoSaveTimer.current) clearTimeout(memoSaveTimer.current);
                            memoSaveTimer.current = setTimeout(() => {
                                if (familyId) {
                                    upsertMemo(familyId, dateKey, val).catch(err => console.error("[memo save]", err));
                                    cacheMemos({ ...memos, [dateKey]: val });
                                }
                            }, 500);
                        }}
                        onMemoBlur={() => {
                            if (memoDirty.current && familyId && memoLastValue.current.trim()) {
                                memoDirty.current = false;
                                if (memoSaveTimer.current) { clearTimeout(memoSaveTimer.current); memoSaveTimer.current = null; }
                                upsertMemo(familyId, dateKey, memoLastValue.current).catch(err => console.error("[memo save]", err));
                                if (authUser) {
                                    sendInstantPush({
                                        action: "new_memo",
                                        familyId,
                                        senderUserId: authUser.id,
                                        title: `📒 ${myRole === "parent" ? "부모님" : "아이"}이 메모를 남겼어요`,
                                        message: memoLastValue.current.length > 50 ? memoLastValue.current.substring(0, 50) + "..." : memoLastValue.current,
                                    });
                                }
                            }
                        }}
                        onMemoSend={() => {
                            if (familyId && authUser && memoLastValue.current.trim()) {
                                memoDirty.current = false;
                                if (memoSaveTimer.current) { clearTimeout(memoSaveTimer.current); memoSaveTimer.current = null; }
                                upsertMemo(familyId, dateKey, memoLastValue.current).catch(err => console.error("[memo save]", err));
                                sendInstantPush({
                                    action: "new_memo",
                                    familyId,
                                    senderUserId: authUser.id,
                                    title: `📒 ${myRole === "parent" ? "부모님" : "아이"}이 메모를 남겼어요`,
                                    message: memoLastValue.current.length > 50 ? memoLastValue.current.substring(0, 50) + "..." : memoLastValue.current,
                                });
                                if (myRole === "child" && aiEnabled) {
                                    const evForMemo = selectedEvs[0];
                                    analyzeMemoSentiment(memoLastValue.current, evForMemo?.title);
                                }
                            }
                        }}
                        memoReplies={memoReplies}
                        onReplySubmit={content => {
                            if (!familyId || !authUser) return;
                            // Optimistic update - show immediately
                            const optimisticReply = { id: "temp-" + Date.now(), user_id: authUser.id, user_role: myRole, content, created_at: new Date().toISOString() };
                            setMemoReplies(prev => [...(prev || []), optimisticReply]);
                            // Ensure memo exists first, then insert reply
                            const ensureMemo = memos[dateKey]?.trim() ? Promise.resolve() : upsertMemo(familyId, dateKey, "💬");
                            ensureMemo.then(() => insertMemoReply(familyId, dateKey, authUser.id, myRole, content))
                                .then(() => fetchMemoReplies(familyId, dateKey).then(setMemoReplies))
                                .catch(err => console.error("[reply]", err));
                            if (!memos[dateKey]?.trim()) setMemos(prev => ({ ...prev, [dateKey]: "💬" }));
                            sendInstantPush({
                                action: "new_memo",
                                familyId,
                                senderUserId: authUser.id,
                                title: `💬 ${myRole === "parent" ? "부모님" : "아이"}이 메모를 남겼어요`,
                                message: content.length > 50 ? content.substring(0, 50) + "..." : content,
                            });
                        }}
                        memoReadBy={memoReadBy}
                        myUserId={authUser?.id}
                    />
                </div>
            </>}

            {/* ── MAP LIST VIEW ── */}
            {activeView === "maplist" && <LocationMapView
                events={events} childPos={childPos} mapReady={mapReady}
                mapError={mapError} arrivedSet={arrivedSet}
                onRoute={ev => setRouteEvent(ev)} />}

            {/* ── ADD MODAL ── */}
            {showAddModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }} onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
                    <div style={{ background: "white", borderRadius: "28px 28px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 460, boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
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
                                {getCategories().map(cat => (
                                    <div key={cat.id} style={{ position: "relative", display: "inline-flex" }}>
                                        <button onClick={() => setNewCategory(cat.id)} style={{ padding: "8px 14px", borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF, background: newCategory === cat.id ? cat.color : cat.bg, color: newCategory === cat.id ? "white" : cat.color, border: `2px solid ${cat.color}` }}>{cat.emoji} {cat.label}</button>
                                        {!DEFAULT_CAT_IDS.has(cat.id) && (
                                            <button onClick={(e) => { e.stopPropagation(); const customs = getCustomCategories().filter(c => c.id !== cat.id); saveCustomCategories(customs); if (newCategory === cat.id) setNewCategory("other"); setNewCatKey(k => k + 1); }}
                                                style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#EF4444", color: "white", border: "none", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, lineHeight: 1 }}>✕</button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => setShowCatAdd(prev => !prev)} style={{ padding: "8px 14px", borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF, background: "#F9FAFB", color: "#6B7280", border: "2px dashed #D1D5DB" }}>+ 추가</button>
                            </div>
                            {showCatAdd && <CategoryAddForm onAdd={(cat) => {
                                const customs = [...getCustomCategories(), cat];
                                saveCustomCategories(customs);
                                setNewCategory(cat.id);
                                setShowCatAdd(false);
                                setNewCatKey(k => k + 1);
                            }} onClose={() => setShowCatAdd(false)} />}
                        </div>
                        {isParent && (
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelSt}>📍 학원/장소 위치 {newLocation && <span style={{ fontSize: 11, color: "#059669", fontWeight: 500 }}>(다음에도 자동 적용)</span>}</label>
                                {newLocation ? (
                                    <div style={{ background: "#FFF0F7", borderRadius: 14, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                        <div style={{ fontSize: 13, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {newLocation.address}</div>
                                        <button onClick={() => { setEditingLocForEvent(null); setShowMapPicker(true); }} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid #E879A0", color: "#E879A0", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                    </div>
                                ) : (
                                    <button onClick={() => { setEditingLocForEvent(null); setShowMapPicker(true); }} style={{ width: "100%", padding: "12px 14px", border: "2px dashed #F9A8D4", borderRadius: 14, background: "#FFF0F7", color: "#E879A0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>🗺️ 지도에서 장소 선택</button>
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
                <RouteOverlay ev={routeEvent} childPos={childPos} mapReady={mapReady} isChildMode={!isParent} onClose={() => setRouteEvent(null)} />
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

            {/* Child pairing input (shown when child first logs in anonymously, no family yet) */}
            {myRole === "child" && authUser && !familyId && (
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
                        // Force reload to get clean state
                        setTimeout(() => window.location.reload(), 1500);
                    }
                }} />
            )}

            {/* ── Child Tracker (학부모 전용) ── */}
            {showChildTracker && <ChildTrackerOverlay
                childPos={childPos} allChildPositions={allChildPositions}
                events={events} mapReady={mapReady} mapError={mapError}
                arrivedSet={arrivedSet} onClose={() => setShowChildTracker(false)}
                locationTrail={locationTrail}
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

            {/* ── Child Call Buttons (아이 전용, 화면 우하단 플로팅) ── */}
            {!isParent && !routeEvent && <ChildCallButtons phones={parentPhones} />}

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
                eventMap={events}
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
