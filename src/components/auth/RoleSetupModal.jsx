import { useState, useEffect } from "react";
import { kakaoLogin } from "../../lib/auth.js";
import { FF, rememberParentPairingIntent, clearParentPairingIntent } from "../../lib/utils.js";
import BunnyMascot from "../common/BunnyMascot.jsx";

function RoleSetupModal({ onSelect, loading }) {
    const [busy, setBusy] = useState(false);
    const isReturning = (() => {
        try { return !!localStorage.getItem("hyeni-has-visited"); } catch { return false; }
    })();

    // Mark as visited on first render
    useEffect(() => {
        try { localStorage.setItem("hyeni-has-visited", "1"); } catch { /* intentionally empty */ }
    }, []);

    const handleParent = async () => {
        setBusy(true);
        rememberParentPairingIntent();
        try { await kakaoLogin(); } catch (e) { clearParentPairingIntent(); console.error(e); setBusy(false); }
        // After OAuth redirect, auth listener in main component handles the rest
    };

    const handleChild = () => { onSelect("child"); };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "linear-gradient(135deg,#FFF0F7,#E8F4FD)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FF }}>
            <BunnyMascot size={90} />
            <div style={{ fontSize: 32, fontWeight: 900, color: "#E879A0", marginTop: 20, marginBottom: 4, letterSpacing: -1, textAlign: "center" }}>
                혜니캘린더
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F9A8D4", marginBottom: 24, letterSpacing: 2 }}>HYENI CALENDAR</div>
            <div style={{ fontSize: 15, color: "#6B7280", marginBottom: 36, textAlign: "center", lineHeight: 1.6 }}>
                {loading ? "로딩 중..." : isReturning ? "다시 오셨군요! 반가워요 😊" : "처음 사용하시는군요!"}
                <br />사용자 유형을 선택해 주세요
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 340 }}>
                <button onClick={handleParent} disabled={busy}
                    style={{ padding: "22px", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "white", border: "none", borderRadius: 24, cursor: busy ? "wait" : "pointer", fontFamily: FF, textAlign: "left", boxShadow: "0 8px 24px rgba(37,99,235,0.35)", opacity: busy ? 0.7 : 1 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍👩‍👧</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{busy ? "카카오 로그인 중..." : "학부모"}</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, lineHeight: 1.5 }}>카카오 계정으로 로그인하여<br />아이 일정을 관리해요</div>
                </button>
                <button onClick={handleChild}
                    style={{ padding: "22px", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 24, cursor: "pointer", fontFamily: FF, textAlign: "left", boxShadow: "0 8px 24px rgba(232,121,160,0.35)" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🐰</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>아이</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, lineHeight: 1.5 }}>부모님 코드로 연결하고<br />내 일정을 확인해요</div>
                </button>
            </div>
        </div>
    );
}

export default RoleSetupModal;
