import { FF } from "../../lib/utils.js";

function AlertBanner({ alerts, onDismiss }) {
    if (!alerts.length) return null;
    const BG = { parent: "linear-gradient(135deg,#1E40AF,#2563EB)", child: "linear-gradient(135deg,#7C3AED,#A78BFA)", friend: "linear-gradient(135deg,#059669,#10B981)", emergency: "linear-gradient(135deg,#DC2626,#EF4444)", sync: "linear-gradient(135deg,#0369A1,#0EA5E9)" };
    const ICON = { parent: "👨‍👩‍👧", child: "🐰", friend: "👫", emergency: "🚨", sync: "📅" };
    const LABEL = { parent: "부모님 알림", child: "아이 알림", friend: "친구 알림", emergency: "⚠️ 긴급 미도착", sync: "📅 일정 동기화" };
    return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 350, display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", pointerEvents: "none" }}>
            {alerts.map(a => (
                <div key={a.id} style={{ background: BG[a.type] || BG.parent, color: "white", borderRadius: 20, padding: "14px 18px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12, animation: "slideDownFull 0.4s ease", pointerEvents: "all", fontFamily: FF }}>
                    <div style={{ fontSize: 26 }}>{ICON[a.type] || "🔔"}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 1 }}>{LABEL[a.type] || "알림"}</div>
                        <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>{a.msg}</div>
                    </div>
                    <button onClick={() => onDismiss(a.id)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, padding: "6px 10px", color: "white", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>확인</button>
                </div>
            ))}
        </div>
    );
}

export default AlertBanner;
