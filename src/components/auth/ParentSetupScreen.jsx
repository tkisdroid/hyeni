import { useState } from "react";
import { FF } from "../../lib/utils.js";

function ParentSetupScreen({ onCreateFamily, onJoinAsParent }) {
    const [joinCode, setJoinCode] = useState("");
    const [mode, setMode] = useState(null); // null | "create" | "join"
    const [busy, setBusy] = useState(false);
    return (
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#FFF0F7,#E8F4FD)", fontFamily: FF, padding: 20 }}>
            <div style={{ background: "white", borderRadius: 28, padding: "40px 28px", maxWidth: 380, width: "100%", boxShadow: "0 12px 40px rgba(232,121,160,0.15)", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍👩‍👧</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#E879A0", marginBottom: 6 }}>환영합니다!</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 28 }}>
                    처음이시면 가족을 만들고,<br/>배우자가 이미 만들었다면 코드로 합류하세요
                </div>

                {!mode && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <button onClick={() => setMode("create")}
                            style={{ padding: "16px", background: "linear-gradient(135deg,#E879A0,#FF6B9D)", color: "white", border: "none", borderRadius: 16, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            🏠 새 가족 만들기
                        </button>
                        <button onClick={() => setMode("join")}
                            style={{ padding: "16px", background: "linear-gradient(135deg,#60A5FA,#3B82F6)", color: "white", border: "none", borderRadius: 16, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            🔗 기존 가족에 합류
                        </button>
                    </div>
                )}

                {mode === "create" && (
                    <div>
                        <div style={{ fontSize: 14, color: "#374151", marginBottom: 16, fontWeight: 600 }}>
                            새 가족을 만들면 연동코드가 생성됩니다.<br/>이 코드로 배우자와 아이가 합류할 수 있어요.
                        </div>
                        <button disabled={busy} onClick={async () => { setBusy(true); await onCreateFamily(); setBusy(false); }}
                            style={{ padding: "14px 32px", background: "#E879A0", color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer", fontFamily: FF, opacity: busy ? 0.6 : 1 }}>
                            {busy ? "생성 중..." : "가족 만들기"}
                        </button>
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, cursor: "pointer", fontFamily: FF }}>← 뒤로</button>
                        </div>
                    </div>
                )}

                {mode === "join" && (
                    <div>
                        <div style={{ fontSize: 14, color: "#374151", marginBottom: 12, fontWeight: 600 }}>
                            배우자에게 받은 연동코드를 입력하세요
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: "#9CA3AF", lineHeight: "44px" }}>KID-</span>
                            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                                placeholder="코드 8자리"
                                style={{ flex: 1, padding: "10px 14px", border: "2px solid #E5E7EB", borderRadius: 12, fontSize: 16, fontWeight: 800, fontFamily: "monospace", textAlign: "center", letterSpacing: 2 }} />
                        </div>
                        <button disabled={busy || joinCode.length < 4} onClick={async () => { setBusy(true); await onJoinAsParent("KID-" + joinCode); setBusy(false); }}
                            style={{ padding: "14px 32px", background: "#3B82F6", color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: (busy || joinCode.length < 4) ? "default" : "pointer", fontFamily: FF, opacity: (busy || joinCode.length < 4) ? 0.6 : 1 }}>
                            {busy ? "합류 중..." : "합류하기"}
                        </button>
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, cursor: "pointer", fontFamily: FF }}>← 뒤로</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ParentSetupScreen;
