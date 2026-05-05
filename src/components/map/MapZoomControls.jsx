// src/components/map/MapZoomControls.jsx
// 큰 + / − 줌 버튼 (아이용). Kakao map 인스턴스를 ref로 받음.
// Extracted from App.jsx (Phase 5 #4 / B5b).

import { FF } from "../../lib/styleHelpers.js";

export function MapZoomControls({ mapObj, style, onManualZoom }) {
    const zoom = (delta) => {
        if (!mapObj?.current) return;
        if (onManualZoom) onManualZoom();
        const lv = mapObj.current.getLevel();
        mapObj.current.setLevel(lv + delta, { animate: true });
    };
    const btnSt = { width: 48, height: 48, borderRadius: 14, border: "none", fontSize: 24, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px rgba(0,0,0,0.15)", fontFamily: FF };
    return (
        <div style={{ position: "absolute", bottom: 16, left: 12, display: "flex", flexDirection: "column", gap: 8, zIndex: 10, ...style }}>
            <button onClick={() => zoom(-1)} style={{ ...btnSt, background: "white", color: "var(--theme-accent-text)" }}>+</button>
            <button onClick={() => zoom(1)} style={{ ...btnSt, background: "white", color: "var(--fg-tertiary)" }}>−</button>
        </div>
    );
}
