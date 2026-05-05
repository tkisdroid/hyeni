// src/components/contact/ChildDeviceCard.jsx
// 다중 자녀 기기 안전 카드 — 배터리 / 마지막 접속 / 화면 켜짐 시간 / 가장 많이 실행한 앱.
// Extracted from App.jsx (Phase 5 #4 / B20).

import { formatDeviceDuration } from "../../lib/deviceFormat.js";

export function ChildDeviceCard({ child, status }) {
    const color = child?.color_hex || "#9CA3AF";
    const battery = Number.isFinite(Number(status?.batteryLevel))
        ? Math.max(0, Math.min(100, Number(status.batteryLevel)))
        : null;
    const updatedAt = status?.updatedAt || status?.updated_at || null;
    const minutesAgo = updatedAt
        ? Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000))
        : null;
    const screenLabel = formatDeviceDuration(Number(status?.screenOnMs || 0));
    const recentApp = status?.recentApp || "사용기록 권한 필요";
    return (
        <div style={{
            padding: 14,
            borderRadius: 14,
            background: "white",
            border: `1.5px solid ${color}30`,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <div style={{ fontSize: 14, fontWeight: 800 }}>{child?.name || "아이"}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 8 }}>
                배터리: {battery == null ? "—" : `${battery}%`} · 마지막 접속: {minutesAgo == null ? "—" : `${minutesAgo}분 전`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                <div style={{ background: "var(--bg-subtle)", borderRadius: 10, padding: "6px 8px" }}>
                    <div style={{ fontSize: 10.5, color: "var(--fg-secondary)", fontWeight: 700 }}>화면 켜짐 시간</div>
                    <div style={{ fontSize: 13, color: "var(--fg-primary)", fontWeight: 900, marginTop: 2 }}>⏱️ {screenLabel}</div>
                </div>
                <div style={{ background: "var(--bg-subtle)", borderRadius: 10, padding: "6px 8px", minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, color: "var(--fg-secondary)", fontWeight: 700 }}>가장 많이 실행한 앱</div>
                    <div style={{ fontSize: 12.5, color: "var(--fg-primary)", fontWeight: 800, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📱 {recentApp}</div>
                </div>
            </div>
        </div>
    );
}
