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

    // \uC624\uB298 \uCD1D \uC774\uB3D9\uAC70\uB9AC (\uC2E4\uC81C \uC774\uB3D9\uACBD\uB85C \uD569\uC0B0)
    const totalDistM = locationTrail.reduce((sum, pt, i) => {
        if (i === 0) return 0;
        return sum + haversineM(locationTrail[i - 1].lat, locationTrail[i - 1].lng, pt.lat, pt.lng);
    }, 0);

    // Effect 1: \uC9C0\uB3C4 \uCD08\uAE30\uD654 (\uCD5C\uCD08 1\uD68C)
    useEffect(() => {
        if (!mapReady || !mapRef.current || mapObj.current) return;
        mapObj.current = new window.kakao.maps.Map(mapRef.current, {
            center: new window.kakao.maps.LatLng(center.lat, center.lng),
            level: 4
        });
    }, [mapReady]);

    // Effect 2: \uC544\uC774 \uD604\uC7AC\uC704\uCE58 \uB9C8\uCEE4 (\uB2E4\uC911 \uC544\uC774 \uC9C0\uC6D0)
    const CHILD_COLORS = ["#3B82F6", "#EC4899", "#F59E0B", "#10B981"];
    useEffect(() => {
        if (!mapObj.current) return;
        // \uAE30\uC874 \uB9C8\uCEE4 \uC81C\uAC70
        childMarkersRef.current.forEach(m => m.setMap(null));
        childMarkersRef.current = [];
        if (myMarkerRef.current) { myMarkerRef.current.setMap(null); myMarkerRef.current = null; }

        const positions = allChildPositions.length > 0 ? allChildPositions : (childPos ? [{ user_id: "default", name: "\uC6B0\uB9AC \uC544\uC774", emoji: "\uD83D\uDC30", lat: childPos.lat, lng: childPos.lng, updatedAt: childPos.updatedAt }] : []);
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
                    <div style="margin-top:4px;background:${color};color:white;padding:4px 12px;border-radius:10px;font-size:11px;font-weight:800;font-family:'Noto Sans KR',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.2);white-space:nowrap">${escHtml(child.name)}${updatedLabel ? ` \u00B7 ${updatedLabel}` : ""}</div>
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

    // Effect 3: \uC774\uB3D9\uACBD\uB85C + \uC608\uC0C1\uACBD\uB85C + \uC77C\uC815 \uB9C8\uCEE4 (locationTrail/events \uBCC0\uACBD \uC2DC \uC7AC\uB4DC\uB85C\uC6B0)
    useEffect(() => {
        if (!mapObj.current) return;

        // \uAE30\uC874 \uD3F4\uB9AC\uB77C\uC778/\uB9C8\uCEE4 \uC81C\uAC70
        if (trailPolyRef.current) { trailPolyRef.current.setMap(null); trailPolyRef.current = null; }
        if (expectedPolyRef.current) { expectedPolyRef.current.setMap(null); expectedPolyRef.current = null; }
        eventMarkersRef.current.forEach(m => m.setMap(null));
        eventMarkersRef.current = [];

        // \uC2E4\uC81C \uC774\uB3D9\uACBD\uB85C (\uD30C\uB780 \uC2E4\uC120)
        if (locationTrail.length >= 2) {
            const path = locationTrail.map(pt => new window.kakao.maps.LatLng(pt.lat, pt.lng));
            trailPolyRef.current = new window.kakao.maps.Polyline({
                map: mapObj.current, path,
                strokeWeight: 5, strokeColor: "#3B82F6",
                strokeOpacity: 0.8, strokeStyle: "solid"
            });
        }

        // \uC608\uC0C1 \uC774\uB3D9\uACBD\uB85C: \uC624\uB298 \uC77C\uC815 \uC7A5\uC18C\uB4E4\uC744 \uC2DC\uAC04\uC21C\uC73C\uB85C \uC5F0\uACB0 (\uD68C\uC0C9 \uC810\uC120)
        if (todayLocEvents.length >= 2) {
            const path = todayLocEvents.map(e => new window.kakao.maps.LatLng(e.location.lat, e.location.lng));
            expectedPolyRef.current = new window.kakao.maps.Polyline({
                map: mapObj.current, path,
                strokeWeight: 3, strokeColor: "#9CA3AF",
                strokeOpacity: 0.7, strokeStyle: "shortdash"
            });
        }

        // \uC77C\uC815 \uB9C8\uCEE4 (\uD074\uB9AD \uAC00\uB2A5)
        todayLocEvents.forEach(ev => {
            const arrived = arrivedSet.has(ev.id);
            const bg = arrived ? "#059669" : ev.color;
            const el = document.createElement("div");
            el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer";
            const timeLabel = ev.endTime ? `${ev.time}~${ev.endTime}` : ev.time;
            el.innerHTML = `<div style="background:${bg};color:white;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.18);white-space:nowrap;font-family:'Noto Sans KR',sans-serif">${escHtml(ev.emoji)} ${escHtml(ev.title)}<span style="font-weight:600;opacity:0.85;margin-left:4px">${escHtml(timeLabel)}</span>${arrived ? " \u2705" : ""}</div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg}"></div>`;
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
                <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: 12, padding: "8px 12px", cursor: "pointer", fontWeight: 800, fontSize: 13, fontFamily: FF, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", flexShrink: 0 }}>\u2190</button>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1D4ED8", whiteSpace: "nowrap" }}>\uD83D\uDCCD \uC6B0\uB9AC \uC544\uC774 \uC704\uCE58</div>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 14, height: 3, background: "#3B82F6", borderRadius: 2 }} />
                        <span style={{ fontSize: 9, color: "#6B7280" }}>\uC774\uB3D9</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 14, height: 3, background: "#9CA3AF", borderRadius: 2, borderTop: "2px dashed #9CA3AF" }} />
                        <span style={{ fontSize: 9, color: "#6B7280" }}>\uC608\uC0C1</span>
                    </div>
                </div>
            </div>

            {/* Map */}
            <div style={{ flex: 1, margin: "0 16px", borderRadius: 24, overflow: "hidden", boxShadow: "0 8px 32px rgba(59,130,246,0.15)", position: "relative", minHeight: 0 }}>
                {!mapReady && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: mapError ? "#EF4444" : "#3B82F6", fontFamily: FF, background: "#EFF6FF", textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.8, padding: 16 }}>{mapError || "\uD83D\uDDFA\uFE0F \uC9C0\uB3C4 \uBD88\uB7EC\uC624\uB294 \uC911..."}</div>}
                <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
                <MapZoomControls mapObj={mapObj} />
                {!childPos && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)", zIndex: 5 }}>
                        <div style={{ textAlign: "center", padding: 24 }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>\uD83D\uDCE1</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#374151", marginBottom: 6 }}>\uC544\uC774 \uC704\uCE58\uB97C \uBD88\uB7EC\uC624\uB294 \uC911...</div>
                            <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>\uC544\uC774 \uAE30\uAE30\uC5D0\uC11C \uC704\uCE58 \uAD8C\uD55C\uC774<br />\uD5C8\uC6A9\uB418\uC5B4 \uC788\uB294\uC9C0 \uD655\uC778\uD574 \uC8FC\uC138\uC694</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom info */}
            <div style={{ padding: "12px 16px 16px", flexShrink: 0 }}>
                {/* \uD074\uB9AD\uD55C \uC7A5\uC18C \uC0C1\uC138 */}
                {selectedEvent && (
                    <div style={{ background: "white", borderRadius: 16, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: selectedEvent.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{selectedEvent.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937" }}>{selectedEvent.title}</div>
                            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>\u23F0 {selectedEvent.time} \u00B7 \uD83D\uDCCD {selectedEvent.location.address?.split(" ").slice(0, 3).join(" ")}</div>
                            {arrivedSet.has(selectedEvent.id) && <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 2 }}>\u2705 \uB3C4\uCC29 \uC644\uB8CC</div>}
                            {childPos && <div style={{ fontSize: 11, color: selectedEvent.color, fontWeight: 700, marginTop: 2 }}>\uD604\uC7AC\uC704\uCE58\uC5D0\uC11C {distLabel(haversineM(childPos.lat, childPos.lng, selectedEvent.location.lat, selectedEvent.location.lng))}</div>}
                        </div>
                        <button onClick={() => setSelectedEvent(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF", padding: "0 4px" }}>\u00D7</button>
                    </div>
                )}

                {(allChildPositions.length > 0 || childPos) ? (
                    <div style={{ background: "white", borderRadius: 20, padding: "14px 18px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                        {/* \uC544\uC774\uBCC4 \uC704\uCE58 \uC0C1\uD0DC */}
                        {(allChildPositions.length > 0 ? allChildPositions : [{ name: "\uC6B0\uB9AC \uC544\uC774", emoji: "\uD83D\uDC30", lat: childPos?.lat, lng: childPos?.lng, updatedAt: childPos?.updatedAt }]).map((child, i) => (
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
                                        {child.updatedAt ? `${new Date(child.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} \uC5C5\uB370\uC774\uD2B8` : "\uC704\uCE58 \uC218\uC2E0 \uC911..."}
                                    </div>
                                </div>
                                <div style={{ fontSize: 10, color: "#3B82F6", fontWeight: 700, flexShrink: 0, marginRight: 4 }}>\uD83D\uDCCD\uD655\uB300</div>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 0 4px rgba(34,197,94,0.2)", flexShrink: 0 }} />
                            </div>
                        ))}
                        {/* \uC624\uB298 \uCD1D \uC774\uB3D9\uAC70\uB9AC */}
                        {totalDistM > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <div style={{ background: "#EFF6FF", borderRadius: 12, padding: "6px 12px", textAlign: "center" }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: "#3B82F6" }}>{distLabel(totalDistM)}</span>
                                    <span style={{ fontSize: 10, color: "#93C5FD", marginLeft: 6 }}>\uC624\uB298 \uC774\uB3D9</span>
                                </div>
                            </div>
                        )}
                        {nextEvent && (
                            <div style={{ background: nextEvent.bg, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ fontSize: 22 }}>{nextEvent.emoji}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937" }}>\uB2E4\uC74C \uC77C\uC815: {nextEvent.title}</div>
                                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>\u23F0 {nextEvent.time} \u00B7 \uD83D\uDCCD {nextEvent.location.address?.split(" ").slice(0, 2).join(" ")}</div>
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF" }}>\uC544\uC774 \uAE30\uAE30\uC5D0\uC11C \uC704\uCE58 \uAD8C\uD55C\uC744 \uD5C8\uC6A9\uD574 \uC8FC\uC138\uC694</div>
                    </div>
                )}
            </div>
        </div>
    );
}
