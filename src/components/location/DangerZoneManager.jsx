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
        { id: "construction", label: "\uD83D\uDEA7 \uACF5\uC0AC\uC7A5", color: "#F59E0B" },
        { id: "entertainment", label: "\uD83C\uDFB0 \uC720\uD765\uAC00", color: "#EF4444" },
        { id: "water", label: "\uD83C\uDF0A \uC218\uBCC0\uC9C0\uC5ED", color: "#3B82F6" },
        { id: "custom", label: "\uD83D\uDCCD \uC9C1\uC811 \uC124\uC815", color: "#6B7280" },
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
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#374151" }}>\u26A0\uFE0F \uC704\uD5D8\uC9C0\uC5ED \uAD00\uB9AC</div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>\uB2EB\uAE30</button>
                </div>

                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>\uC544\uC774\uAC00 \uC124\uC815\uD55C \uC9C0\uC5ED\uC5D0 \uC811\uADFC\uD558\uBA74 \uC54C\uB9BC\uC744 \uBC1B\uC2B5\uB2C8\uB2E4.</div>

                {/* Zone list */}
                {zones.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#D1D5DB" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>\uD83D\uDEE1\uFE0F</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>\uC124\uC815\uB41C \uC704\uD5D8\uC9C0\uC5ED\uC774 \uC5C6\uC5B4\uC694</div>
                    </div>
                ) : zones.map(z => (
                    <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#FEF2F2", borderRadius: 16, marginBottom: 8, border: "1.5px solid #FECACA" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: zoneColor(z.zone_type), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "white", fontWeight: 800, flexShrink: 0 }}>
                            {z.zone_type === "construction" ? "\uD83D\uDEA7" : z.zone_type === "entertainment" ? "\uD83C\uDFB0" : z.zone_type === "water" ? "\uD83C\uDF0A" : "\u26A0\uFE0F"}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: "#1F2937" }}>{z.name}</div>
                            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>\uBC18\uACBD {z.radius_m}m</div>
                        </div>
                        <button onClick={() => { if (window.confirm(`"${z.name}" \uC704\uD5D8\uC9C0\uC5ED\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?`)) onDelete(z.id); }}
                            style={{ padding: "6px 10px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>\uC0AD\uC81C</button>
                    </div>
                ))}

                {/* Add new zone */}
                {!showAdd ? (
                    <button onClick={() => setShowAdd(true)}
                        style={{ width: "100%", marginTop: 12, padding: "14px", borderRadius: 16, border: "2px dashed #D1D5DB", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#6B7280", fontFamily: FF }}>
                        + \uC704\uD5D8\uC9C0\uC5ED \uCD94\uAC00
                    </button>
                ) : (
                    <div style={{ marginTop: 12, background: "#F9FAFB", borderRadius: 20, padding: 16, border: "1.5px solid #E5E7EB" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#374151", marginBottom: 12 }}>\uC0C8 \uC704\uD5D8\uC9C0\uC5ED \uCD94\uAC00</div>

                        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="\uC9C0\uC5ED \uC774\uB984 (\uC608: \uACF5\uC0AC\uC7A5 \uC55E)"
                            style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "2px solid #E5E7EB", fontSize: 14, fontWeight: 700, fontFamily: FF, boxSizing: "border-box", marginBottom: 10 }} />

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                            {ZONE_TYPES.map(zt => (
                                <button key={zt.id} onClick={() => setNewType(zt.id)}
                                    style={{ padding: "6px 12px", borderRadius: 10, border: newType === zt.id ? `2px solid ${zt.color}` : "1.5px solid #E5E7EB", background: newType === zt.id ? zt.color + "15" : "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: newType === zt.id ? zt.color : "#6B7280" }}>
                                    {zt.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>\uBC18\uACBD: {newRadius}m</div>
                        <input type="range" min={50} max={500} step={50} value={newRadius} onChange={e => setNewRadius(Number(e.target.value))}
                            style={{ width: "100%", marginBottom: 12 }} />

                        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>\uC9C0\uB3C4\uB97C \uD074\uB9AD\uD574\uC11C \uC704\uCE58\uB97C \uC120\uD0DD\uD558\uC138\uC694</div>
                        <div ref={mapRef} style={{ width: "100%", height: 200, borderRadius: 16, overflow: "hidden", border: "2px solid #E5E7EB", marginBottom: 12 }} />

                        {selectedLoc && <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginBottom: 8 }}>\u2713 \uC704\uCE58 \uC120\uD0DD\uB428 ({selectedLoc.lat.toFixed(4)}, {selectedLoc.lng.toFixed(4)})</div>}

                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={handleAdd} disabled={!newName.trim() || !selectedLoc}
                                style={{ flex: 1, padding: "12px", borderRadius: 14, border: "none", background: !newName.trim() || !selectedLoc ? "#D1D5DB" : "#EF4444", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                                \u26A0\uFE0F \uC704\uD5D8\uC9C0\uC5ED \uB4F1\uB85D
                            </button>
                            <button onClick={() => { setShowAdd(false); mapInst.current = null; }}
                                style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid #E5E7EB", background: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#6B7280" }}>\uCDE8\uC18C</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
