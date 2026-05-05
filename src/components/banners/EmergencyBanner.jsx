// src/components/banners/EmergencyBanner.jsx
// Full-screen emergency modal — child not arrived for upcoming event.
// Extracted from App.jsx (Phase 5 #4 / B2).
//
// Props:
//   emergencies: { id, emoji, title, time, location }[]
//   onDismiss: (id, reason: "contact" | "ok") => void

import { FF } from "../../lib/styleHelpers.js";

export function EmergencyBanner({ emergencies, onDismiss }) {
    if (!emergencies.length) return null;
    const em = emergencies[0];
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", fontFamily: FF }}>
            <div style={{ background: "white", borderRadius: 28, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(220,38,38,0.4)", animation: "emergencyPulse 0.6s ease" }}>
                <div style={{ height: 8, borderRadius: 8, background: "linear-gradient(90deg,var(--status-negative),var(--status-negative-strong),var(--status-negative))", backgroundSize: "200% 100%", animation: "shimmer 1s linear infinite", marginBottom: 20 }} />
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 56, marginBottom: 8, animation: "shake 0.5s ease infinite" }}>🚨</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--status-negative-strong)" }}>긴급 알림</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-secondary)", marginTop: 4 }}>학부모님, 확인이 필요해요!</div>
                </div>
                <div style={{ background: "var(--status-negative-subtle)", border: "2px solid var(--status-negative-subtle)", borderRadius: 18, padding: "16px 18px", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 28 }}>{em.emoji}</div>
                        <div><div style={{ fontWeight: 800, fontSize: 16, color: "var(--fg-primary)" }}>{em.title}</div><div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>예정: ⏰ {em.time}</div></div>
                    </div>
                    <div style={{ background: "var(--status-negative-strong)", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ color: "white", fontWeight: 800, fontSize: 14 }}>⚠️ 5분 후 시작인데 아직 미도착!</div>
                        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 3 }}>{em.location}</div>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => onDismiss(em.id, "contact")} style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg,var(--status-negative-strong),var(--status-negative-strong))", color: "white", border: "none", borderRadius: 16, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FF }}>📞 아이에게 전화</button>
                    <button onClick={() => onDismiss(em.id, "ok")} style={{ flex: 1, padding: "14px", background: "var(--bg-muted)", color: "var(--fg-secondary)", border: "none", borderRadius: 16, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>확인했어요</button>
                </div>
            </div>
        </div>
    );
}
