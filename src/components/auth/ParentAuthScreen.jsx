// src/components/auth/ParentAuthScreen.jsx
// 학부모 로그인 화면 — Kakao primary CTA + collapsible ID/PW form.
// Extracted from App.jsx (Phase 5 #4 / B4).

import { useState } from "react";
import { kakaoLogin, googleLogin } from "../../lib/auth.js";
import { signInWithLoginId } from "../../lib/accountAuth.js";
import { useBackHandler } from "../../lib/backHandler.js";
import { rememberParentPairingIntent, clearParentPairingIntent } from "../../lib/parentPairingIntent.js";
import { FF } from "../../lib/styleHelpers.js";
import { AppBrandLogo } from "./AppBrandLogo.jsx";

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
            className="hyeni-app-shell"
            style={{
                minHeight: "100dvh",
                background: "var(--bg-subtle)",
                display: "flex",
                flexDirection: "column",
                fontFamily: FF,
                padding: "calc(env(safe-area-inset-top, 0px) + var(--space-3)) var(--space-screen-pad) calc(env(safe-area-inset-bottom, 0px) + var(--space-6))",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-5)" }}>
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="뒤로"
                    style={{
                        width: 36, height: 36,
                        borderRadius: "var(--radius-control)",
                        border: "1px solid var(--line-soft)",
                        background: "var(--bg-base)",
                        cursor: "pointer",
                        fontSize: 18,
                        fontWeight: "var(--weight-bold)",
                        color: "var(--fg-secondary)",
                        fontFamily: FF,
                    }}
                >
                    ←
                </button>
                <div style={{ display: "flex", justifyContent: "center", flex: 1 }}>
                    <AppBrandLogo size={56} radius={16} />
                </div>
                <div style={{ width: 36 }} />
            </div>

            <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
                <h1 className="t-screen-title">학부모 로그인</h1>
                <p className="t-screen-subtitle" style={{ marginTop: "var(--space-2)" }}>아이 일정 관리를 시작해 주세요</p>
            </div>

            <div style={{ maxWidth: 400, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column" }}>
                {/* Kakao primary CTA */}
                <button
                    type="button"
                    onClick={handleKakao}
                    disabled={!!busy}
                    style={{
                        width: "100%",
                        height: "var(--control-height-lg)",
                        background: "#FEE500",
                        color: "#191919",
                        border: "none",
                        borderRadius: "var(--radius-control)",
                        fontFamily: FF,
                        fontWeight: "var(--weight-bold)",
                        fontSize: 16,
                        cursor: busy ? "wait" : "pointer",
                        opacity: busy ? 0.65 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "var(--space-2)",
                        transition: "filter var(--duration-fast) var(--easing-standard)",
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919" aria-hidden="true">
                        <path d="M12 3C6.48 3 2 6.62 2 11.1c0 2.93 1.91 5.5 4.78 6.94l-1.22 4.46c-.11.4.34.72.7.5l5.32-3.5c.13.01.27.01.42.01 5.52 0 10-3.62 10-8.41C22 6.62 17.52 3 12 3z"/>
                    </svg>
                    {busy === "kakao" ? "카카오 로그인 중..." : "카카오로 시작"}
                </button>

                <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={!!busy}
                    style={{
                        marginTop: "var(--space-3)",
                        width: "100%",
                        height: "var(--control-height-lg)",
                        background: "var(--bg-base)",
                        color: "#1F1F1F",
                        border: "1px solid var(--line-soft)",
                        borderRadius: "var(--radius-control)",
                        fontFamily: FF,
                        fontWeight: "var(--weight-bold)",
                        fontSize: 16,
                        cursor: busy ? "wait" : "pointer",
                        opacity: busy ? 0.65 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "var(--space-2)",
                        transition: "filter var(--duration-fast) var(--easing-standard)",
                    }}
                    aria-label="구글로 시작"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {busy === "google" ? "구글 로그인 중..." : "구글로 시작"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", margin: "var(--space-4) 0", color: "var(--fg-tertiary)", fontSize: 12, fontWeight: "var(--weight-medium)" }}>
                    <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                    <span>또는</span>
                    <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                </div>

                {!showIdPw ? (
                    <button
                        type="button"
                        onClick={() => setShowIdPw(true)}
                        style={{
                            width: "100%",
                            padding: "var(--space-3) var(--space-4)",
                            background: "var(--bg-base)",
                            border: "1px solid var(--line-soft)",
                            borderRadius: "var(--radius-control)",
                            fontFamily: FF,
                            color: "var(--fg-secondary)",
                            fontSize: 14,
                            fontWeight: "var(--weight-semibold)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            transition: "border-color var(--duration-fast) var(--easing-standard)",
                        }}
                    >
                        <span>ID/PW로 로그인</span>
                        <span style={{ color: "var(--fg-tertiary)", fontSize: 16 }}>▾</span>
                    </button>
                ) : (
                    <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                            <span style={{ fontSize: 12, fontWeight: "var(--weight-bold)", color: "var(--fg-secondary)" }}>아이디</span>
                            <input
                                value={login.loginId}
                                onChange={(event) => setLogin((prev) => ({ ...prev, loginId: event.target.value }))}
                                autoComplete="username"
                                placeholder="parent01"
                                className="input"
                            />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                            <span style={{ fontSize: 12, fontWeight: "var(--weight-bold)", color: "var(--fg-secondary)" }}>비밀번호</span>
                            <input
                                type="password"
                                value={login.password}
                                onChange={(event) => setLogin((prev) => ({ ...prev, password: event.target.value }))}
                                autoComplete="current-password"
                                placeholder="비밀번호"
                                className="input"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={!!busy}
                            className="btn btn-primary"
                            style={{ marginTop: "var(--space-2)", opacity: busy ? 0.65 : 1, cursor: busy ? "wait" : "pointer" }}
                        >
                            {busy === "login" ? "로그인 중..." : "로그인"}
                        </button>
                    </form>
                )}

                {message && (
                    <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--status-positive-subtle)", color: "var(--status-positive-strong)", fontSize: 13, fontWeight: "var(--weight-bold)", lineHeight: 1.45 }}>
                        {message}
                    </div>
                )}
                {error && (
                    <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--status-cautionary-subtle)", color: "var(--status-cautionary-strong)", fontSize: 13, fontWeight: "var(--weight-bold)", lineHeight: 1.45 }}>
                        {error}
                    </div>
                )}
            </div>

            <div style={{ marginTop: "auto", textAlign: "center", paddingTop: "var(--space-6)" }}>
                <button
                    type="button"
                    onClick={onSignupClick}
                    style={{
                        background: "none",
                        border: "none",
                        color: "var(--theme-accent-text)",
                        fontSize: 14,
                        fontWeight: "var(--weight-medium)",
                        cursor: "pointer",
                        fontFamily: FF,
                        padding: "var(--space-2)",
                    }}
                >
                    처음 오셨나요? 가입하기 →
                </button>
            </div>
        </div>
    );
}
