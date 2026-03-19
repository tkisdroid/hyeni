import { useState } from "react";

function ChildCallButtons({ phones }) {
    const [expanded, setExpanded] = useState(false);
    const cleanNumber = (num) => (num || "").replace(/[^0-9+]/g, "");
    const hasMom = phones.mom && phones.mom.length >= 8;
    const hasDad = phones.dad && phones.dad.length >= 8;
    if (!hasMom && !hasDad) return null;
    const btnSt = { width: 56, height: 56, borderRadius: "50%", border: "none", fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(0,0,0,0.25)", transition: "all 0.2s" };
    return (
        <div style={{ position: "fixed", bottom: 100, right: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 200 }}>
            {expanded && hasMom && (
                <a href={`tel:${cleanNumber(phones.mom)}`} style={{ textDecoration: "none", animation: "kkukFadeIn 0.2s ease" }}>
                    <div style={{ ...btnSt, background: "linear-gradient(135deg,#F9A8D4,#E879A0)" }}>👩</div>
                    <div style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: "#E879A0", marginTop: 2 }}>엄마</div>
                </a>
            )}
            {expanded && hasDad && (
                <a href={`tel:${cleanNumber(phones.dad)}`} style={{ textDecoration: "none", animation: "kkukFadeIn 0.2s ease" }}>
                    <div style={{ ...btnSt, background: "linear-gradient(135deg,#93C5FD,#3B82F6)" }}>👨</div>
                    <div style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: "#3B82F6", marginTop: 2 }}>아빠</div>
                </a>
            )}
            <button onClick={() => setExpanded(p => !p)}
                style={{ ...btnSt, width: 52, height: 52, background: expanded ? "#F3F4F6" : "linear-gradient(135deg,#34D399,#059669)", color: expanded ? "#6B7280" : "white", fontSize: 22 }}>
                {expanded ? "✕" : "📞"}
            </button>
        </div>
    );
}

export default ChildCallButtons;
