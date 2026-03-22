import { useState, useRef, useEffect } from "react";
import { FF } from "../../lib/utils.js";

export default function DangerZoneManager({ zones, familyId: _familyId, mapReady, onAdd, onDelete, onClose }) {
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState("");
    const [newRadius, setNewRadius] = useState(200);
    const [newType, setNewType] = useState("custom");
    const [selectedLoc, setSelectedLoc] = useState(null);
    const mapRef = useRef();
    const mapInst = useRef();
    const circleRef = useRef(null);

    const ZONE_TYPES = [
        { id: "construction", label: "🚧 공사장", color: "#F59E0B" },
        { id: "entertainment", label: "🎰 유흥가", color: "#EF4444" },
        { id: "water", label: "🌊 수변지역", color: "#3B82F6" },
        { id: "custom", label: "📍 직접 설정", color: "#6B7280" },
    ];

    const zoneColor = (type) => ZONE_TYPES.find(z => z.id === type)?.color || "#6B7280";

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
                map, center: e.latLng, radius: newRadius,
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "white", borderRadius: "28px 28px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}>
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
