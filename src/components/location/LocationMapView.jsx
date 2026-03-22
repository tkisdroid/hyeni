import { useState, useRef, useEffect } from "react";
import { escHtml, FF, haversineM } from "../../lib/utils.js";
import MapZoomControls from "../common/MapZoomControls.jsx";

export default function LocationMapView({ events, childPos, mapReady, mapError, arrivedSet, onRoute }) {
    const mapRef = useRef();
    const mapObj = useRef();
    const markersRef = useRef([]);
    const myMarkerRef = useRef();
    const [selected, setSelected] = useState(null);

    const locEvents = Object.values(events).flat().filter(e => e.location);
    const center = childPos || (locEvents[0]?.location) || { lat: 37.5665, lng: 126.9780 };

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
        if (childPos) bounds.extend(new window.kakao.maps.LatLng(childPos.lat, childPos.lng));

        locEvents.forEach(ev => {
            const pos = new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng);
            bounds.extend(pos);

            const arrived = arrivedSet.has(ev.id);
            const overlay = new window.kakao.maps.CustomOverlay({
                position: pos,
                content: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" data-evid="${ev.id}">
                    <div style="background:${arrived ? '#059669' : ev.color};color:white;padding:6px 10px;border-radius:14px;font-size:12px;font-weight:800;box-shadow:0 3px 12px rgba(0,0,0,0.2);white-space:nowrap;font-family:'Noto Sans KR',sans-serif">
                        ${escHtml(ev.emoji)} ${escHtml(ev.title)}${arrived ? ' ✅' : ''}
                    </div>
                    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${arrived ? '#059669' : ev.color}"></div>
                </div>`,
                yAnchor: 1.3, xAnchor: 0.5
            });
            overlay.setMap(mapObj.current);
            markersRef.current.push(overlay);

        });

        // Fit bounds if multiple points
        if (locEvents.length > 0) {
            mapObj.current.setBounds(bounds, 60);
        }
    }, [mapReady, childPos, events, arrivedSet]);

    // Handle click on overlay via map container click delegation
    useEffect(() => {
        if (!mapRef.current) return;
        const handler = (e) => {
            const target = e.target.closest('[data-evid]');
            if (target) {
                const id = parseInt(target.dataset.evid);
                setSelected(prev => prev === id ? null : id);
            }
        };
        mapRef.current.addEventListener('click', handler);
        return () => mapRef.current?.removeEventListener('click', handler);
    }, []);

    const selectedEv = selected ? locEvents.find(e => e.id === selected) : null;

    return (
        <div style={{ width: "100%", maxWidth: 420, marginBottom: 0 }}>
            {/* Map */}
            <div style={{ width: "100%", height: 300, borderRadius: 24, overflow: "hidden", boxShadow: "0 8px 32px rgba(232,121,160,0.12)", marginBottom: 14, position: "relative", background: "#F3F4F6" }}>
                {!mapReady && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: mapError ? "#EF4444" : "#9CA3AF", fontFamily: FF, textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.8, padding: 16 }}>{mapError || "🗺️ 지도 로딩 중..."}</div>}
                <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
                <MapZoomControls mapObj={mapObj} />
                {childPos && (
                    <button onClick={() => { if (mapObj.current) { mapObj.current.setCenter(new window.kakao.maps.LatLng(childPos.lat, childPos.lng)); mapObj.current.setLevel(3); } }}
                        style={{ position: "absolute", bottom: 16, right: 12, background: "linear-gradient(135deg,#3B82F6,#1D4ED8)", color: "white", border: "none", borderRadius: 16, padding: "12px 18px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF, boxShadow: "0 4px 16px rgba(59,130,246,0.4)", display: "flex", alignItems: "center", gap: 6, zIndex: 10 }}>
                        📍 현재 내 위치
                    </button>
                )}
                <div style={{ position: "absolute", top: 12, right: 12, background: "white", borderRadius: 12, padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "#6B7280", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", fontFamily: FF }}>
                    📍 {locEvents.length}개 장소
                </div>
            </div>

            {/* Selected card */}
            {selectedEv && (
                <div style={{ background: selectedEv.bg, borderRadius: 20, padding: 16, marginBottom: 12, borderLeft: `4px solid ${selectedEv.color}`, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ fontSize: 28 }}>{selectedEv.emoji}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: "#1F2937", fontFamily: FF }}>{selectedEv.title}</div>
                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, fontFamily: FF }}>⏰ {selectedEv.time}</div>
                            <div style={{ fontSize: 12, color: selectedEv.color, marginTop: 3, fontWeight: 600, fontFamily: FF }}>📍 {selectedEv.location.address}</div>
                        </div>
                        {arrivedSet.has(selectedEv.id)
                            ? <span style={{ fontSize: 12, padding: "6px 12px", borderRadius: 12, background: "#D1FAE5", color: "#065F46", fontWeight: 700, fontFamily: FF }}>✅ 도착</span>
                            : <span style={{ fontSize: 12, padding: "6px 12px", borderRadius: 12, background: "#FEF3C7", color: "#92400E", fontWeight: 700, fontFamily: FF }}>대기</span>}
                    </div>
                </div>
            )}

            {/* Card list */}
            <div style={{ background: "white", borderRadius: 24, boxShadow: "0 8px 32px rgba(232,121,160,0.12)", padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#374151", marginBottom: 12, fontFamily: FF }}>📍 등록된 장소</div>
                {locEvents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#D1D5DB", fontFamily: FF }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🗺️</div>
                        <div style={{ fontSize: 14 }}>장소가 등록된 일정이 없어요</div>
                    </div>
                ) : locEvents.map(ev => {
                    const d = childPos ? haversineM(childPos.lat, childPos.lng, ev.location.lat, ev.location.lng) : null;
                    const dl = d !== null ? (d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`) : null;
                    return (
                    <div key={ev.id}
                        onClick={() => {
                            setSelected(ev.id);
                            if (mapObj.current) {
                                mapObj.current.setCenter(new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng));
                                mapObj.current.setLevel(3);
                            }
                        }}
                        style={{
                            padding: "12px", borderRadius: 16, marginBottom: 8, cursor: "pointer", fontFamily: FF,
                            background: selected === ev.id ? ev.bg : "#F9FAFB", borderLeft: `3px solid ${ev.color}`,
                            transition: "all 0.15s"
                        }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div style={{ fontSize: 22 }}>{ev.emoji}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "#1F2937" }}>{ev.title}</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {ev.location.address}</div>
                            </div>
                            <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, flexShrink: 0 }}>⏰ {ev.time}</div>
                            {arrivedSet.has(ev.id) ? <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>✅</span> : null}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                            {dl && <div style={{ fontSize: 12, fontWeight: 700, color: ev.color, background: ev.bg, padding: "4px 10px", borderRadius: 10 }}>🚶 {dl}</div>}
                            {!dl && childPos === null && <div style={{ fontSize: 11, color: "#9CA3AF", background: "#F3F4F6", padding: "4px 8px", borderRadius: 8 }}>📍 위치 확인 중...</div>}
                            {onRoute && <button onClick={(e) => { e.stopPropagation(); onRoute(ev); }}
                                style={{ fontSize: 12, fontWeight: 800, color: "white", background: `linear-gradient(135deg,${ev.color},${ev.color}cc)`, padding: "5px 12px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: FF, boxShadow: `0 2px 6px ${ev.color}44` }}>
                                🧭 길찾기
                            </button>}
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>
    );
}
