import { useState } from "react";
import { FF } from "../../lib/utils.js";
import { joinFamily } from "../../lib/auth.js";
import BunnyMascot from "../common/BunnyMascot.jsx";

function ChildPairInput({ userId, onPaired }) {
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const handleJoin = async () => {
        if (!code.trim() || code.length < 4) { setError("코드를 정확히 입력해 주세요"); return; }
        const fullCode = "KID-" + code.trim();
        setBusy(true); setError("");
        try {
            const result = await joinFamily(fullCode, userId, "아이");
            console.log("[ChildPairInput] joinFamily result:", result);
            await onPaired();
        } catch (err) {
            console.error("[ChildPairInput] error:", err);
            setError(err.message?.includes("Too many") ? "시도 횟수 초과. 1시간 후 다시 시도해 주세요" : "잘못된 코드예요. 부모님께 확인해 주세요");
        } finally { setBusy(false); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "linear-gradient(135deg,#FFF0F7,#E8F4FD)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FF }}>
            <BunnyMascot size={70} />
            <div style={{ fontSize: 24, fontWeight: 900, color: "#E879A0", marginTop: 16, marginBottom: 8 }}>부모님과 연결하기</div>
            <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, textAlign: "center", lineHeight: 1.6 }}>부모님 앱에 있는<br />연동 코드에서 KID- 뒤의 코드를 입력해 주세요</div>
            <div style={{ position: "relative", width: "100%", maxWidth: 320, marginBottom: 8 }}>
                <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 20, fontFamily: "monospace", fontWeight: 700, color: "#E879A0", pointerEvents: "none", zIndex: 1 }}>KID-</div>
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    placeholder="XXXXXXXX" maxLength={8}
                    style={{ width: "100%", padding: "16px 16px 16px 76px", border: "2px solid #F3E8F0", borderRadius: 20, fontSize: 20, fontFamily: "monospace", outline: "none", boxSizing: "border-box", letterSpacing: 3, fontWeight: 700, color: "#374151", background: "white", boxShadow: "0 2px 8px rgba(232,121,160,0.1)" }} />
            </div>
            {error && <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 700, marginBottom: 8 }}>{error}</div>}
            <button onClick={handleJoin} disabled={busy}
                style={{ width: "100%", maxWidth: 320, padding: "16px", background: "linear-gradient(135deg,#A78BFA,#7C3AED)", color: "white", border: "none", borderRadius: 20, fontSize: 16, fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FF, marginTop: 8, opacity: busy ? 0.7 : 1 }}>
                {busy ? "연결 중..." : "🔗 연결하기"}
            </button>
        </div>
    );
}

export default ChildPairInput;
