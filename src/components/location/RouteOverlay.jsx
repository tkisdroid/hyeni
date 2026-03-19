import { useState, useRef, useEffect, useCallback } from "react";
import { FF, escHtml, haversineM } from "../../lib/utils.js";
import MapZoomControls from "../common/MapZoomControls.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// Route Overlay (current position → destination with OSRM walking route)
// ─────────────────────────────────────────────────────────────────────────────
function RouteOverlay({ ev, childPos, mapReady, onClose, isChildMode = false }) {
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
    const [heading, setHeading] = useState(null); // device compass heading in degrees
    const watchIdRef = useRef(null);
    const routeInitDoneRef = useRef(false);
    const lastRoutePosRef = useRef(null);

    // Helper: create walking direction arrow overlays along route path
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

    useEffect(() => {
        routeInitDoneRef.current = false;
        routePathRef.current = null;
        lastRoutePosRef.current = null;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRouteInfo(null);
    }, [ev?.id]);

    // Compute live distance/time
    const currentPos = livePos || childPos;
    const liveDist = currentPos && ev.location
        ? haversineM(currentPos.lat, currentPos.lng, ev.location.lat, ev.location.lng)
        : null;
    const displayDist = routeInfo?.distance ?? liveDist;
    // OSRM public 서버는 driving만 지원 → duration 무시, 거리 기반 도보 시간 계산 (4km/h ≈ 67m/min)
    const displayMin = displayDist != null ? Math.max(1, Math.round(displayDist / 67)) : null;
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
    useEffect(() => {
        if (!livePos || !ev.location || !mapInst.current || routeInfo?.loading) return;
        let shouldFetch = true;
        if (lastRoutePosRef.current) {
            const moved = haversineM(livePos.lat, livePos.lng, lastRoutePosRef.current.lat, lastRoutePosRef.current.lng);
            if (moved < 50) shouldFetch = false;
        }
        if (!shouldFetch) return;
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${livePos.lng},${livePos.lat};${ev.location.lng},${ev.location.lat}?overview=full&geometries=geojson`;
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);
        fetch(osrmUrl, { signal: ctrl.signal }).then(r => { clearTimeout(tid); return r.json(); }).then(data => {
            if (data.code !== "Ok" || !data.routes?.length) return;
            lastRoutePosRef.current = { ...livePos };
            const route = data.routes[0];
            const coords = route.geometry.coordinates;
            const path = coords.map(([lng, lat]) => new window.kakao.maps.LatLng(lat, lng));
            routePathRef.current = path;
            // Update polylines
            if (polylineRef.current) polylineRef.current.setPath(path);
            if (shadowPolyRef.current) shadowPolyRef.current.setPath(path);
            // Update direction arrows
            arrowOverlaysRef.current.forEach(o => o.setMap(null));
            arrowOverlaysRef.current = createWalkingArrows(mapInst.current, path, "#4285F4");
            setRouteInfo({ distance: route.distance, duration: route.duration, loading: false, error: false });
        }).catch(() => {});
    }, [livePos, ev.location, routeInfo?.loading, createWalkingArrows]);

    // Initialize map + route
    useEffect(() => {
        if (!mapReady || !mapRef.current || !ev.location) return;
        let cancelled = false;

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
                    <div style="background:${ev.color};color:white;padding:8px 14px;border-radius:16px;font-size:14px;font-weight:900;box-shadow:0 4px 16px rgba(0,0,0,0.25);font-family:'Noto Sans KR',sans-serif;border:2px solid white">${escHtml(ev.title)}</div>
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
            content: `<div style="background:linear-gradient(135deg,#10B981,#059669);color:white;padding:6px 14px;border-radius:12px;font-size:13px;font-weight:900;box-shadow:0 3px 12px rgba(16,185,129,0.4);font-family:'Noto Sans KR',sans-serif;border:2px solid white">출발</div>`
        });
        startOverlayRef.current = startOv;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRouteInfo({ loading: true });

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startPos.lng},${startPos.lat};${ev.location.lng},${ev.location.lat}?overview=full&geometries=geojson&steps=true`;

        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 10000);
        fetch(osrmUrl, { signal: ctrl.signal })
            .then(r => { clearTimeout(tid); return r.json(); })
            .then(data => {
                if (cancelled) return;
                if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route");
                lastRoutePosRef.current = { ...startPos };

                const route = data.routes[0];
                const coords = route.geometry.coordinates;
                const path = coords.map(([lng, lat]) => new window.kakao.maps.LatLng(lat, lng));
                routePathRef.current = path;

                // ── 도보 경로 — 파란색 실선 (잘 보이게) ──
                // Shadow polyline (white border effect)
                const sp = new window.kakao.maps.Polyline({
                    map: mapInst.current, path,
                    strokeWeight: 14, strokeColor: "#FFFFFF",
                    strokeOpacity: 0.9, strokeStyle: "solid"
                });
                shadowPolyRef.current = sp;

                // Main route line — bright blue
                const pl = new window.kakao.maps.Polyline({
                    map: mapInst.current, path,
                    strokeWeight: 8, strokeColor: "#4285F4",
                    strokeOpacity: 0.95, strokeStyle: "solid"
                });
                polylineRef.current = pl;

                // ── 방향 화살표 오버레이 ──
                arrowOverlaysRef.current = createWalkingArrows(mapInst.current, path, "#4285F4");

                // Fit route bounds (출발 + 도착 + 경로 전체)
                const bounds = new window.kakao.maps.LatLngBounds();
                path.forEach(p => bounds.extend(p));
                bounds.extend(myLL);
                bounds.extend(destLL);
                mapInst.current.setBounds(bounds, 80);

                setRouteInfo({
                    distance: route.distance,
                    duration: route.duration,
                    loading: false,
                    error: false
                });
            })
            .catch(() => {
                if (cancelled) return;
                // Fallback: 직선 경로
                const sp = new window.kakao.maps.Polyline({
                    map: mapInst.current,
                    path: [myLL, destLL],
                    strokeWeight: 10, strokeColor: "#FFFFFF",
                    strokeOpacity: 0.9, strokeStyle: "solid"
                });
                shadowPolyRef.current = sp;

                const pl = new window.kakao.maps.Polyline({
                    map: mapInst.current,
                    path: [myLL, destLL],
                    strokeWeight: 6, strokeColor: "#4285F4",
                    strokeOpacity: 0.8, strokeStyle: "shortdash"
                });
                polylineRef.current = pl;

                const bounds = new window.kakao.maps.LatLngBounds();
                bounds.extend(myLL);
                bounds.extend(destLL);
                mapInst.current.setBounds(bounds, 80);

                setRouteInfo({ loading: false, error: true });
            });

        return () => {
            cancelled = true;
        };
    }, [mapReady, ev, currentPos, createWalkingArrows]);

    const recenterMap = () => {
        if (!mapInst.current || !currentPos) return;
        setCentered(true);
        mapInst.current.panTo(new window.kakao.maps.LatLng(currentPos.lat, currentPos.lng));
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
        const bounds = new window.kakao.maps.LatLngBounds();
        bounds.extend(new window.kakao.maps.LatLng(currentPos.lat, currentPos.lng));
        bounds.extend(new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng));
        if (routePathRef.current) routePathRef.current.forEach(p => bounds.extend(p));
        mapInst.current.setBounds(bounds, 60);
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

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#F0F4F8", display: "flex", flexDirection: "column", fontFamily: FF }}>
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
                                    도보 약 {timeLabel}
                                    {routeInfo?.error && " (직선거리)"}
                                </div>
                                {bunnyEncouragement && (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#E879A0", marginTop: 4 }}>
                                        {bunnyEncouragement.emoji} {bunnyEncouragement.msg}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {!arrived && displayMin != null && (
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
            <div style={{ flex: 1, margin: "10px 16px", borderRadius: 24, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", position: "relative", minHeight: 0 }}>
                <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
                <MapZoomControls mapObj={mapInst} />

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
                {heading != null && (
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
                <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", gap: 8, zIndex: 5 }}>
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
                </div>
            </div>

            {/* Bottom route sheet */}
            <div style={{ padding: "0 16px max(16px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
                <div style={sheetCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 0.2 }}>{isChildMode ? "🐰 길찾기" : "ROUTE"}</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginTop: 2 }}>
                                {arrived
                                    ? (isChildMode ? "도착! 잘했어! 💕" : "도착 완료")
                                    : (isChildMode ? "토끼가 길 안내 중~ 🐰" : "앱 안에서 길찾기 안내 중")}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <div style={{ padding: "7px 10px", borderRadius: 999, background: arrived ? "#DCFCE7" : ev.bg, color: arrived ? "#166534" : ev.color, fontSize: 11, fontWeight: 800 }}>
                                {arrived ? "근처 도착" : distLabel || "경로 확인"}
                            </div>
                            {displayMin != null && (
                                <div style={{ padding: "7px 10px", borderRadius: 999, background: "#EEF2FF", color: "#4338CA", fontSize: 11, fontWeight: 800 }}>
                                    도보 {timeLabel}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            onClick={fitFullRoute}
                            style={{ flex: 1, padding: "15px 14px", borderRadius: 18, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 800, fontFamily: FF, color: "white", background: "linear-gradient(135deg, #EC4899, #BE185D)", boxShadow: "0 12px 24px rgba(236,72,153,0.26)" }}
                        >
                            전체 경로 보기
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

export default RouteOverlay;
