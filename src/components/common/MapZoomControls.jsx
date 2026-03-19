import { FF } from "../../lib/utils.js";

function MapZoomControls({ mapObj, style }) {
    const zoom = (delta) => {
        if (!mapObj?.current) return;
        const lv = mapObj.current.getLevel();
        mapObj.current.setLevel(lv + delta, { animate: true });
    };
    const btnSt = { width: 48, height: 48, borderRadius: 14, border: "none", fontSize: 24, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px rgba(0,0,0,0.15)", fontFamily: FF };
    return (
        <div style={{ position: "absolute", bottom: 16, left: 12, display: "flex", flexDirection: "column", gap: 8, zIndex: 10, ...style }}>
            <button onClick={() => zoom(-1)} style={{ ...btnSt, background: "white", color: "#E879A0" }}>+</button>
            <button onClick={() => zoom(1)} style={{ ...btnSt, background: "white", color: "#9CA3AF" }}>−</button>
        </div>
    );
}

export default MapZoomControls;
