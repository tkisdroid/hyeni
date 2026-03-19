import { FF } from "../../lib/utils.js";

function EmergencyBanner({ emergencies, onDismiss }) {
    if (!emergencies.length) return null;
    const em = emergencies[0];
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", fontFamily: FF }}>
            <div style={{ background: "white", borderRadius: 28, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(220,38,38,0.4)", animation: "emergencyPulse 0.6s ease" }}>
                <div style={{ height: 8, borderRadius: 8, background: "linear-gradient(90deg,#EF4444,#DC2626,#EF4444)", backgroundSize: "200% 100%", animation: "shimmer 1s linear infinite", marginBottom: 20 }} />
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 56, marginBottom: 8, animation: "shake 0.5s ease infinite" }}>🚨</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#DC2626" }}>긴급 알림</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginTop: 4 }}>학부모님, 확인이 필요해요!</div>
                </div>
                <div style={{ background: "#FEF2F2", border: "2px solid #FECACA", borderRadius: 18, padding: "16px 18px", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 28 }}>{em.emoji}</div>
                        <div><div style={{ fontWeight: 800, fontSize: 16, color: "#1F2937" }}>{em.title}</div><div style={{ fontSize: 13, color: "#6B7280" }}>예정: ⏰ {em.time}</div></div>
                    </div>
                    <div style={{ background: "#DC2626", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ color: "white", fontWeight: 800, fontSize: 14 }}>⚠️ 5분 후 시작인데 아직 미도착!</div>
                        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 3 }}>{em.location}</div>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => onDismiss(em.id, "contact")} style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg,#DC2626,#B91C1C)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FF }}>📞 아이에게 전화</button>
                    <button onClick={() => onDismiss(em.id, "ok")} style={{ flex: 1, padding: "14px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 16, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>확인했어요</button>
                </div>
            </div>
        </div>
    );
}

export default EmergencyBanner;
