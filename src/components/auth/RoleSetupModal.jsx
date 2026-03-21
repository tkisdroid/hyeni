import { useState, useEffect } from "react";
import { kakaoLogin, magicLinkLogin } from "../../lib/auth.js";
import { FF, rememberParentPairingIntent, clearParentPairingIntent } from "../../lib/utils.js";
import BunnyMascot from "../common/BunnyMascot.jsx";

function RoleSetupModal({ onSelect, loading }) {
    const [busy, setBusy] = useState(false);
    const [showEmailLogin, setShowEmailLogin] = useState(false);
    const [email, setEmail] = useState("");
    const [emailSent, setEmailSent] = useState(false);
    const [emailError, setEmailError] = useState("");
    const isReturning = (() => {
        try { return !!localStorage.getItem("hyeni-has-visited"); } catch { return false; }
    })();

    useEffect(() => {
        try { localStorage.setItem("hyeni-has-visited", "1"); } catch { /* intentionally empty */ }
    }, []);

    const handleParent = async () => {
        setBusy(true);
        rememberParentPairingIntent();
        try { await kakaoLogin(); } catch (e) { clearParentPairingIntent(); console.error(e); setBusy(false); }
    };

    const handleEmailLogin = async () => {
        if (!email.trim() || !email.includes("@")) {
            setEmailError("올바른 이메일을 입력해주세요");
            return;
        }
        setBusy(true);
        setEmailError("");
        try {
            rememberParentPairingIntent();
            await magicLinkLogin(email.trim());
            setEmailSent(true);
        } catch (e) {
            clearParentPairingIntent();
            setEmailError("로그인 링크 발송에 실패했어요. 다시 시도해주세요.");
            console.error(e);
        }
        setBusy(false);
    };

    const handleChild = () => { onSelect("child"); };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "linear-gradient(135deg,#FFF0F7,#E8F4FD)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FF, overflowY: "auto" }}>
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
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{busy && !showEmailLogin ? "카카오 로그인 중..." : "학부모 (카카오)"}</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, lineHeight: 1.5 }}>카카오 계정으로 로그인하여<br />아이 일정을 관리해요</div>
                </button>
                <button onClick={handleChild}
                    style={{ padding: "22px", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 24, cursor: "pointer", fontFamily: FF, textAlign: "left", boxShadow: "0 8px 24px rgba(232,121,160,0.35)" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🐰</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>아이</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, lineHeight: 1.5 }}>부모님 코드로 연결하고<br />내 일정을 확인해요</div>
                </button>

                {/* 이메일 로그인 (Magic Link) */}
                {!showEmailLogin ? (
                    <button onClick={() => setShowEmailLogin(true)}
                        style={{ padding: "12px", background: "transparent", border: "1.5px solid #D1D5DB", borderRadius: 16, cursor: "pointer", fontFamily: FF, fontSize: 13, fontWeight: 700, color: "#6B7280" }}>
                        ✉️ 이메일로 로그인
                    </button>
                ) : emailSent ? (
                    <div style={{ background: "white", borderRadius: 20, padding: "20px", border: "1.5px solid #10B981", textAlign: "center" }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📧</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#10B981", marginBottom: 6 }}>로그인 링크를 보냈어요!</div>
                        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
                            <strong>{email}</strong> 메일함을 확인하고<br />링크를 클릭하면 자동 로그인돼요
                        </div>
                        <button onClick={() => { setEmailSent(false); setEmail(""); setShowEmailLogin(false); }}
                            style={{ marginTop: 12, padding: "8px 16px", background: "#F3F4F6", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#6B7280", cursor: "pointer", fontFamily: FF }}>
                            닫기
                        </button>
                    </div>
                ) : (
                    <div style={{ background: "white", borderRadius: 20, padding: "16px", border: "1.5px solid #E5E7EB" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>이메일 주소를 입력하세요</div>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="example@email.com"
                            onKeyDown={e => { if (e.key === "Enter") handleEmailLogin(); }}
                            style={{ width: "100%", padding: "12px", border: "1.5px solid #E5E7EB", borderRadius: 12, fontSize: 15, fontFamily: FF, boxSizing: "border-box", outline: "none" }}
                        />
                        {emailError && <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 700, marginTop: 6 }}>{emailError}</div>}
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button onClick={() => setShowEmailLogin(false)}
                                style={{ flex: 1, padding: "10px", background: "#F3F4F6", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: "#6B7280", cursor: "pointer", fontFamily: FF }}>
                                취소
                            </button>
                            <button onClick={handleEmailLogin} disabled={busy}
                                style={{ flex: 1, padding: "10px", background: "#2563EB", color: "white", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", fontFamily: FF, opacity: busy ? 0.7 : 1 }}>
                                {busy ? "발송 중..." : "로그인 링크 받기"}
                            </button>
                        </div>
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8, textAlign: "center" }}>비밀번호 없이 이메일 링크로 로그인해요</div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default RoleSetupModal;
