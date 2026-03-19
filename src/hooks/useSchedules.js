import { useState, useEffect, useRef, useCallback } from "react";
import { fetchEvents, fetchAcademies, fetchMemos, insertEvent, updateEvent, deleteEvent as dbDeleteEvent, upsertMemo, subscribeFamily, unsubscribe, getCachedEvents, getCachedAcademies, getCachedMemos, cacheEvents, cacheAcademies, cacheMemos, fetchStickersForDate, fetchStickerSummary, fetchMemoReplies, insertMemoReply, markMemoRead } from "../lib/sync.js";
import { supabase } from "../lib/supabase.js";
import { showKkukNotification } from "../lib/pushNotifications.js";
import { REMOTE_AUDIO_DEFAULT_DURATION_SEC, startRemoteAudioCapture, stopRemoteAudioCapture } from "../lib/remoteAudio.js";
import { sendInstantPush } from "../lib/utils.js";

export default function useSchedules({ familyId, authUser, myRole, isParent, setChildPos, setShowKkukReceived }) {
    // ── Events, academies, memos ────────────────────────────────────────────────
    const [events, setEvents] = useState(() => getCachedEvents());
    const [academies, setAcademies] = useState(() => getCachedAcademies());
    const [memos, setMemos] = useState(() => getCachedMemos());
    const [memoReplies, setMemoReplies] = useState([]);
    const [memoReadBy, setMemoReadBy] = useState([]);

    // ── Stickers ────────────────────────────────────────────────────────────────
    const [stickers, setStickers] = useState([]);
    const [stickerSummary, setStickerSummary] = useState(null);

    // ── Refs ────────────────────────────────────────────────────────────────────
    const realtimeChannel = useRef(null);
    const dateKeyRef = useRef("");
    const memoSaveTimer = useRef(null);
    const memoDirty = useRef(false);
    const memoLastValue = useRef("");

    // Expose dateKeyRef updater
    const updateDateKeyRef = useCallback((dk) => {
        dateKeyRef.current = dk;
    }, []);

    // ── Load memo replies & mark as read when viewing a date with memo ────────
    const loadMemoReplies = useCallback((dateKey, hasMemo) => {
        if (!familyId || !dateKey) return;
        fetchMemoReplies(familyId, dateKey).then(setMemoReplies).catch(() => {});
        if (hasMemo && authUser?.id) {
            markMemoRead(familyId, dateKey, authUser.id).catch(() => {});
        }
        supabase.from("memos").select("read_by").eq("family_id", familyId).eq("date_key", dateKey).maybeSingle()
            .then(({ data }) => setMemoReadBy(data?.read_by || []));
    }, [familyId, authUser?.id]);

    // ── Send memo push when app goes to background / closes ─────────────────────
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === "hidden" && memoDirty.current && familyId && authUser && memoLastValue.current.trim()) {
                memoDirty.current = false;
                if (memoSaveTimer.current) { clearTimeout(memoSaveTimer.current); memoSaveTimer.current = null; }
                upsertMemo(familyId, dateKeyRef.current, memoLastValue.current).catch(() => {});
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
    }, [familyId, authUser?.id, myRole]);

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

    // ── Load stickers for selected date ─────────────────────────────────────────
    const loadStickers = useCallback((dateKey) => {
        if (!familyId) return;
        fetchStickersForDate(familyId, dateKey).then(s => setStickers(s));
    }, [familyId]);

    const loadStickerSummary = useCallback(() => {
        if (!familyId) return;
        fetchStickerSummary(familyId).then(s => setStickerSummary(s?.[0] || null));
    }, [familyId]);

    // ── Event CRUD ──────────────────────────────────────────────────────────────
    const handleDeleteEvent = useCallback(async (id, dateKey, showNotif) => {
        setEvents(prev => ({ ...prev, [dateKey]: (prev[dateKey] || []).filter(e => e.id !== id) }));
        showNotif("🗑️ 일정을 지웠어요");
        if (familyId) {
            try { await dbDeleteEvent(id); } catch (err) { console.error("[deleteEvent]", err); }
        }
    }, [familyId]);

    const updateEvField = useCallback(async (id, field, value) => {
        setEvents(prev => { const out = {}; Object.entries(prev).forEach(([k, evs]) => { out[k] = evs.map(e => e.id === id ? { ...e, [field]: value } : e); }); return out; });
        if (familyId) {
            try { await updateEvent(id, { [field]: value }); } catch (err) { console.error("[updateEvField]", err); }
        }
    }, [familyId]);

    return {
        events, setEvents,
        academies, setAcademies,
        memos, setMemos,
        memoReplies, setMemoReplies,
        memoReadBy,
        stickers, setStickers,
        stickerSummary, setStickerSummary,
        realtimeChannel,
        dateKeyRef,
        memoSaveTimer,
        memoDirty,
        memoLastValue,
        updateDateKeyRef,
        loadMemoReplies,
        loadStickers,
        loadStickerSummary,
        handleDeleteEvent,
        updateEvField,
    };
}
