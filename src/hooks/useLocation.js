import { useState, useEffect, useRef } from "react";
import { getSession } from "../lib/auth.js";
import { saveChildLocation, fetchChildLocations, saveLocationHistory, fetchTodayLocationHistory, fetchDangerZones } from "../lib/sync.js";
import { startNativeLocationService } from "../lib/locationService.js";
import { haversineM, sendInstantPush } from "../lib/utils.js";

export default function useLocation({ myRole, authUser, familyId, familyInfo, isParent, childPos, setChildPos, realtimeChannel, showChildTracker, addAlert }) {
    const [allChildPositions, setAllChildPositions] = useState([]);
    const [locationTrail, setLocationTrail] = useState([]);
    const [dangerZones, setDangerZones] = useState([]);
    const [firedDangerAlerts, setFiredDangerAlerts] = useState(new Set());

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
                (_err) => {
                    // GPS errors handled silently in hook; showNotif not available here
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

    return {
        allChildPositions,
        locationTrail,
        dangerZones, setDangerZones,
        firedDangerAlerts, setFiredDangerAlerts,
    };
}
