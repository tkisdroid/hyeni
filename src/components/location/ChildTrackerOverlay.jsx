import { useState, useRef, useEffect } from "react";
import { escHtml, FF, haversineM } from "../../lib/utils.js";
import MapZoomControls from "../common/MapZoomControls.jsx";

export default function ChildTrackerOverlay({ childPos, allChildPositions = [], events, mapReady, mapError, arrivedSet, onClose, locationTrail = [] }) {
    const mapRef = useRef();
    const mapObj = useRef();
    const myMarkerRef = useRef();
    const childMarkersRef = useRef([]);
    const trailPolyRef = useRef(null);
    const expectedPolyRef = useRef(null);
    const eventMarkersRef = useRef([]);
    const [selectedEvent, setSelectedEvent] = useState(null);

    const center = allChildPositions[0] || childPos || { lat: 37.5665, lng: 126.9780 };

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const todayLocEvents = (events[todayKey] || []).filter(e => e.location).sort((a, b) => a.time.localeCompare(b.time));
    const nextEvent = todayLocEvents.find(e => {
        const [h, m] = e.time.split(":").map(Number);
        return h * 60 + m > nowMin;
    });
    const distToNext = childPos && nextEvent?.location
        ? haversineM(childPos.lat, childPos.lng, nextEvent.location.lat, nextEvent.location.lng)
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
            level: 4
        });
    }, [mapReady]);

    // Effect 2: 아이 현재위치 마커 (다중 아이 지원)
    const CHILD_COLORS = ["#3B82F6", "#EC4899", "#F59E0B", "#10B981"];
    useEffect(() => {
        if (!mapObj.current) return;
        // 기존 마커 제거
        childMarkersRef.current.forEach(m => m.setMap(null));
        childMarkersRef.current = [];
        if (myMarkerRef.current) { myMarkerRef.current.setMap(null); myMarkerRef.current = null; }

        const positions = allChildPositions.length > 0 ? allChildPositions : (childPos ? [{ user_id: "default", name: "우리 아이", emoji: "🐰", lat: childPos.lat, lng: childPos.lng, updatedAt: childPos.updatedAt }] : []);
        if (!positions.length) return;

        const bounds = new window.kakao.maps.LatLngBounds();
        positions.forEach((child, i) => {
            const color = CHILD_COLORS[i % CHILD_COLORS.length];
            const ll = new window.kakao.maps.LatLng(child.lat, child.lng);
            bounds.extend(ll);
            const updatedLabel = child.updatedAt ? (() => { const d = new Date(child.updatedAt); return `${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`; })() : "";
            const overlay = new window.kakao.maps.CustomOverlay({
                position: ll,
                content: `<div style="display:flex;flex-direction:column;align-items:center">
                    <div style="width:28px;height:28px;background:${color};border:4px solid white;border-radius:50%;box-shadow:0 0 0 8px ${color}33,0 3px 12px ${color}66;display:flex;align-items:center;justify-content:center;font-size:14px">${escHtml(child.emoji)}</div>
                    <div style="margin-top:4px;background:${color};color:white;padding:4px 12px;border-radius:10px;font-size:11px;font-weight:800;font-family:'Noto Sans KR',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.2);white-space:nowrap">${escHtml(child.name)}${updatedLabel ? ` · ${updatedLabel}` : ""}</div>
                </div>`,
                yAnchor: 1.8, xAnchor: 0.5, zIndex: 10
            });
            overlay.setMap(mapObj.current);
            childMarkersRef.current.push(overlay);
        });

        if (positions.length === 1) {
            mapObj.current.setCenter(new window.kakao.maps.LatLng(positions[0].lat, positions[0].lng));
        } else {
            mapObj.current.setBounds(bounds, 80);
        }
    }, [allChildPositions, childPos]);

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
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", display: "flex", flexDirection: "column", fontFamily: FF }}>
            {/* Header */}
            <div style={{ padding: "12px 16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: 12, padding: "8px 12px", cursor: "pointer", fontWeight: 800, fontSize: 13, fontFamily: FF, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", flexShrink: 0 }}>←</button>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1D4ED8", whiteSpace: "nowrap" }}>📍 우리 아이 위치</div>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 14, height: 3, background: "#3B82F6", borderRadius: 2 }} />
                        <span style={{ fontSize: 9, color: "#6B7280" }}>이동</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 14, height: 3, background: "#9CA3AF", borderRadius: 2, borderTop: "2px dashed #9CA3AF" }} />
                        <span style={{ fontSize: 9, color: "#6B7280" }}>예상</span>
                    </div>
                </div>
            </div>

            {/* Map */}
            <div style={{ flex: 1, margin: "0 16px", borderRadius: 24, overflow: "hidden", boxShadow: "0 8px 32px rgba(59,130,246,0.15)", position: "relative", minHeight: 0 }}>
                {!mapReady && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: mapError ? "#EF4444" : "#3B82F6", fontFamily: FF, background: "#EFF6FF", textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.8, padding: 16 }}>{mapError || "🗺️ 지도 불러오는 중..."}</div>}
                <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
                <MapZoomControls mapObj={mapObj} />
                {!childPos && (
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
                            {childPos && <div style={{ fontSize: 11, color: selectedEvent.color, fontWeight: 700, marginTop: 2 }}>현재위치에서 {distLabel(haversineM(childPos.lat, childPos.lng, selectedEvent.location.lat, selectedEvent.location.lng))}</div>}
                        </div>
                        <button onClick={() => setSelectedEvent(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF", padding: "0 4px" }}>×</button>
                    </div>
                )}

                {(allChildPositions.length > 0 || childPos) ? (
                    <div style={{ background: "white", borderRadius: 20, padding: "14px 18px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                        {/* 아이별 위치 상태 */}
                        {(allChildPositions.length > 0 ? allChildPositions : [{ name: "우리 아이", emoji: "🐰", lat: childPos?.lat, lng: childPos?.lng, updatedAt: childPos?.updatedAt }]).map((child, i) => (
                            <div key={child.user_id || i} onClick={() => {
                                if (mapObj.current && child.lat && child.lng) {
                                    mapObj.current.setCenter(new window.kakao.maps.LatLng(child.lat, child.lng));
                                    mapObj.current.setLevel(2);
                                }
                            }} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 10px", background: `${CHILD_COLORS[i % CHILD_COLORS.length]}10`, borderRadius: 14, cursor: "pointer" }}>
                                <div style={{ width: 36, height: 36, borderRadius: 12, background: CHILD_COLORS[i % CHILD_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "white", flexShrink: 0 }}>{child.emoji}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937" }}>{child.name}</div>
                                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>
                                        {child.updatedAt ? `${new Date(child.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 업데이트` : "위치 수신 중..."}
                                    </div>
                                </div>
                                <div style={{ fontSize: 10, color: "#3B82F6", fontWeight: 700, flexShrink: 0, marginRight: 4 }}>📍확대</div>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 0 4px rgba(34,197,94,0.2)", flexShrink: 0 }} />
                            </div>
                        ))}
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF" }}>아이 기기에서 위치 권한을 허용해 주세요</div>
                    </div>
                )}
            </div>
        </div>
    );
}
