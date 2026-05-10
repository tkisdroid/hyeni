// src/components/auth/ParentAuthScreen.jsx
// 부모 로그인 — Phase 07 redesign (mockup `src/stitch/.../07_30_50 (3).png`).
// Public props (`onBack`, `onSignupClick`) + 핸들러/state/useBackHandler 동작 보존.

import { useState } from "react";
import { kakaoLogin, googleLogin, naverLogin } from "../../lib/auth.js";
import { signInWithLoginId } from "../../lib/accountAuth.js";
import { useBackHandler } from "../../lib/backHandler.js";
import { rememberParentPairingIntent, clearParentPairingIntent } from "../../lib/parentPairingIntent.js";
import { HyeniMascot } from "./HyeniMascot.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

export function ParentAuthScreen({ onBack, onSignupClick }) {
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [login, setLogin] = useState({ loginId: "", password: "" });
    const [showIdPw, setShowIdPw] = useState(false);

    const handleKakao = async () => {
        setBusy("kakao");
        setError("");
        setMessage("");
        rememberParentPairingIntent();
        try {
            await kakaoLogin();
        } catch (err) {
            clearParentPairingIntent();
            console.error("[kakaoLogin]", err);
            setError(err?.message || "카카오 로그인에 실패했어요");
        } finally {
            setBusy("");
        }
    };

    const handleGoogle = async () => {
        setBusy("google");
        setError("");
        setMessage("");
        rememberParentPairingIntent();
        try {
            await googleLogin();
        } catch (err) {
            clearParentPairingIntent();
            console.error("[googleLogin]", err);
            setError(err?.message || "구글 로그인이 잠시 멈췄어요. 다시 해볼까요?");
        } finally {
            setBusy("");
        }
    };

    const handleNaver = async () => {
        setBusy("naver");
        setError("");
        setMessage("");
        rememberParentPairingIntent();
        try {
            await naverLogin();
        } catch (err) {
            clearParentPairingIntent();
            console.error("[naverLogin]", err);
            setError(err?.message || "네이버 로그인이 잠시 멈췄어요. 다시 해볼까요?");
        } finally {
            setBusy("");
        }
    };

    const handleLogin = async (event) => {
        event.preventDefault();
        setBusy("login");
        setError("");
        setMessage("");
        rememberParentPairingIntent();
        try {
            await signInWithLoginId(login);
            setMessage("로그인됐어요. 가족 정보를 불러오는 중이에요.");
        } catch (err) {
            clearParentPairingIntent();
            console.error("[parent login]", err);
            setError("ID 또는 비밀번호를 확인해 주세요");
            setBusy("");
        }
    };

    useBackHandler(() => {
        if (busy) return true;
        if (showIdPw) {
            setShowIdPw(false);
            return true;
        }
        if (onBack) {
            onBack();
            return true;
        }
        return false;
    });

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 500,
                fontFamily: "var(--font-sans)",
                background: "linear-gradient(180deg, #FFE7EE 0%, #FFF6F2 50%, #F4E4FB 100%)",
                overflowY: "auto",
            }}
        >
            <div
                style={{
                    minHeight: "100dvh",
                    display: "flex",
                    flexDirection: "column",
                    padding: "calc(env(safe-area-inset-top, 0px) + 12px) 20px calc(env(safe-area-inset-bottom, 0px) + 16px)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center" }}>
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="뒤로"
                        className="btn btn-secondary btn-sm"
                        style={{ width: 40, height: 40, minHeight: 40, padding: 0, background: "transparent", border: "none", fontSize: 22, color: "var(--fg-primary)" }}
                    >
                        ←
                    </button>
                    <div style={{ flex: 1 }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16 }}>
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 64,
                            height: 64,
                            background: "linear-gradient(135deg, #FFC1CF 0%, #FFA5C4 100%)",
                            borderRadius: 18,
                            overflow: "hidden",
                            boxShadow: "0 4px 12px rgba(247, 121, 168, 0.18)",
                        }}
                    >
                        <HyeniMascot variant="static" size={56} aria-label="" />
                    </span>
                    <h2
                        style={{
                            marginTop: 12,
                            fontSize: 18,
                            fontWeight: 800,
                            color: "var(--theme-accent-text, #C3325B)",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        혜니캘린더
                        <span aria-hidden="true" style={{ marginLeft: 4, fontSize: 12 }}>♥</span>
                    </h2>
                </div>

                <div style={{ textAlign: "center", marginTop: 16 }}>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: 30,
                            fontWeight: 800,
                            lineHeight: 1.2,
                            color: "#2A1A20",
                            letterSpacing: "-0.03em",
                        }}
                    >
                        <span style={{ color: "var(--theme-accent, #F779A8)" }}>부모</span>로 시작
                    </h1>
                    <p style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: "#7A6770" }}>
                        가족을 만들거나 기존 가족에 합류해 보세요
                    </p>
                </div>

                <div style={{ maxWidth: 400, width: "100%", margin: "24px auto 0", display: "flex", flexDirection: "column", gap: 12 }}>
                    <ProviderButton
                        onClick={handleKakao}
                        busy={busy === "kakao"}
                        disabled={!!busy}
                        background="#FEE500"
                        color="#191919"
                        icon={
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 3C6.48 3 2 6.62 2 11.1c0 2.93 1.91 5.5 4.78 6.94l-1.22 4.46c-.11.4.34.72.7.5l5.32-3.5c.13.01.27.01.42.01 5.52 0 10-3.62 10-8.41C22 6.62 17.52 3 12 3z"/>
                            </svg>
                        }
                        label="카카오로 계속하기"
                    />
                    <ProviderButton
                        onClick={handleGoogle}
                        busy={busy === "google"}
                        disabled={!!busy}
                        background="#FFFFFF"
                        color="#2A1A20"
                        icon={
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        }
                        label="구글로 계속하기"
                    />
                    <ProviderButton
                        onClick={handleNaver}
                        busy={busy === "naver"}
                        disabled={!!busy}
                        background="#FFFFFF"
                        color="#2A1A20"
                        icon={
                            <span style={{
                                display: "inline-flex",
                                width: 20,
                                height: 20,
                                background: "#03C75A",
                                color: "#FFFFFF",
                                borderRadius: 4,
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: 13,
                            }}>N</span>
                        }
                        label="네이버로 계속하기"
                    />

                    {!showIdPw ? (
                        <button
                            type="button"
                            onClick={() => setShowIdPw(true)}
                            className="btn btn-secondary"
                            style={{ width: "100%", minHeight: 56, justifyContent: "space-between", padding: "0 20px" }}
                        >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                                <ThreeDIcon name="shield" size={18} aria-label="" />
                                아이디 · 비밀번호로 로그인
                            </span>
                            <span style={{ color: "var(--fg-tertiary)", fontSize: 14 }}>▾</span>
                        </button>
                    ) : (
                        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <input
                                value={login.loginId}
                                onChange={(event) => setLogin((prev) => ({ ...prev, loginId: event.target.value }))}
                                autoComplete="username"
                                placeholder="아이디"
                                style={inputStyle}
                            />
                            <input
                                type="password"
                                value={login.password}
                                onChange={(event) => setLogin((prev) => ({ ...prev, password: event.target.value }))}
                                autoComplete="current-password"
                                placeholder="비밀번호"
                                style={inputStyle}
                            />
                            <button
                                type="submit"
                                disabled={!!busy}
                                style={{
                                    height: 56,
                                    borderRadius: 999,
                                    border: "none",
                                    background: "linear-gradient(90deg, #FFA5C4 0%, #F779A8 100%)",
                                    color: "#FFFFFF",
                                    fontSize: 16,
                                    fontWeight: 700,
                                    fontFamily: "var(--font-sans)",
                                    cursor: busy ? "wait" : "pointer",
                                    opacity: busy ? 0.7 : 1,
                                    boxShadow: "0 6px 18px rgba(247, 121, 168, 0.28)",
                                }}
                            >
                                {busy === "login" ? "로그인 중..." : "로그인"}
                            </button>
                        </form>
                    )}

                    {message && (
                        <div style={{ ...statusBox, color: "#1C8245", borderColor: "#A6E5C0", background: "#F0FBF4" }}>
                            {message}
                        </div>
                    )}
                    {error && (
                        <div style={{ ...statusBox, color: "#B87A00", borderColor: "#F8D58C", background: "#FFF7E6" }}>
                            {error}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, minHeight: 16 }} />

                <div
                    style={{
                        position: "relative",
                        marginTop: 16,
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
                        gap: 12,
                        alignItems: "end",
                    }}
                >
                    <div style={{
                        position: "relative",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-end",
                        minHeight: 180,
                    }}>
                        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 4 }}>
                            <ThreeDIcon name="heart" size={28} />
                        </div>
                        <div aria-hidden="true" style={{ position: "absolute", top: 0, right: 8 }}>
                            <ThreeDIcon name="calendar-check" size={28} />
                        </div>
                        <HyeniMascot variant="phone" size={170} aria-label="" />
                    </div>

                    <div
                        style={{
                            background: "rgba(255,255,255,0.78)",
                            border: "1px solid #FFD6DD",
                            borderRadius: 24,
                            padding: 16,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            boxShadow: "0 4px 14px rgba(247, 121, 168, 0.12)",
                        }}
                    >
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#2A1A20", letterSpacing: "-0.02em" }}>
                            처음 오셨나요?
                        </h3>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "#7A6770", lineHeight: 1.4 }}>
                            혜니캘린더에 오신 것을<br />환영해요!
                        </p>
                        <button
                            type="button"
                            onClick={onSignupClick}
                            style={{
                                marginTop: 4,
                                height: 44,
                                borderRadius: 999,
                                border: "none",
                                background: "linear-gradient(90deg, #FFA5C4 0%, #F779A8 100%)",
                                color: "#FFFFFF",
                                fontSize: 14,
                                fontWeight: 700,
                                fontFamily: "var(--font-sans)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                boxShadow: "0 4px 12px rgba(247, 121, 168, 0.22)",
                            }}
                        >
                            가입하기
                            <span aria-hidden="true" style={{ fontSize: 16 }}>›</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const inputStyle = {
    width: "100%",
    height: 52,
    borderRadius: 16,
    border: "1px solid #FFD6DD",
    background: "rgba(255,255,255,0.85)",
    padding: "0 16px",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    color: "#2A1A20",
    outline: "none",
    boxSizing: "border-box",
};

const statusBox = {
    marginTop: 4,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 500,
};

function ProviderButton({ onClick, busy, disabled, background, color, icon, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                width: "100%",
                height: 56,
                borderRadius: 999,
                border: background === "#FFFFFF" ? "1px solid #EFEEEA" : "none",
                background,
                color,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "var(--font-sans)",
                cursor: disabled ? "wait" : "pointer",
                opacity: disabled ? 0.65 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                boxShadow: background === "#FFFFFF" ? "0 2px 8px rgba(0,0,0,0.05)" : "0 2px 8px rgba(254,229,0,0.25)",
            }}
        >
            {icon}
            <span>{busy ? "로그인 중..." : label}</span>
        </button>
    );
}
