// src/components/auth/ParentAuthScreen.jsx
// 학부모 로그인 — Kakao/Google/Naver/ID-PW 4-button.
// 2026-05-07 cartoon DS migration. 로직/prop 보존.

import { useState } from "react";
import { kakaoLogin, googleLogin, naverLogin } from "../../lib/auth.js";
import { signInWithLoginId } from "../../lib/accountAuth.js";
import { useBackHandler } from "../../lib/backHandler.js";
import { rememberParentPairingIntent, clearParentPairingIntent } from "../../lib/parentPairingIntent.js";
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
        <div className="hy-auth">
            <div className="hy-auth__header">
                <button type="button" onClick={onBack} aria-label="뒤로" className="hy-auth__back">←</button>
                <AppBrandLogo size={56} radius={16} />
                <span className="hy-auth__back-spacer" aria-hidden="true" />
            </div>

            <div className="hy-auth__hero">
                <h1 className="hy-auth__title">학부모 로그인</h1>
                <p className="hy-auth__subtitle">아이 일정 관리를 시작해 주세요</p>
            </div>

            <div className="hy-auth__body">
                <div className="hy-social-stack">
                    <button
                        type="button"
                        onClick={handleKakao}
                        disabled={!!busy}
                        className="hy-social-button hy-social-button--kakao"
                        aria-label="카카오로 시작"
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
                        className="hy-social-button hy-social-button--google"
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

                    <button
                        type="button"
                        onClick={handleNaver}
                        disabled={!!busy}
                        className="hy-social-button hy-social-button--naver"
                        aria-label="네이버로 시작"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                            <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727z"/>
                        </svg>
                        {busy === "naver" ? "네이버 로그인 중..." : "네이버로 시작"}
                    </button>
                </div>

                <div className="hy-or-divider"><span>또는</span></div>

                {!showIdPw ? (
                    <button
                        type="button"
                        onClick={() => setShowIdPw(true)}
                        className="hy-social-button hy-social-button--idpw"
                    >
                        <span>ID/PW로 로그인</span>
                        <span aria-hidden="true">▾</span>
                    </button>
                ) : (
                    <form onSubmit={handleLogin} className="hy-auth__form">
                        <label className="hy-field">
                            <span className="hy-field__label">아이디</span>
                            <input
                                value={login.loginId}
                                onChange={(event) => setLogin((prev) => ({ ...prev, loginId: event.target.value }))}
                                autoComplete="username"
                                placeholder="parent01"
                                className="hy-field__input"
                            />
                        </label>
                        <label className="hy-field">
                            <span className="hy-field__label">비밀번호</span>
                            <input
                                type="password"
                                value={login.password}
                                onChange={(event) => setLogin((prev) => ({ ...prev, password: event.target.value }))}
                                autoComplete="current-password"
                                placeholder="비밀번호"
                                className="hy-field__input"
                            />
                        </label>
                        <button type="submit" disabled={!!busy} className="hy-button hy-button--primary">
                            {busy === "login" ? "로그인 중..." : "로그인"}
                        </button>
                    </form>
                )}

                {message && <div className="hy-message hy-message--positive">{message}</div>}
                {error && <div className="hy-message hy-message--negative">{error}</div>}
            </div>

            <div className="hy-auth__footer">
                <button type="button" onClick={onSignupClick} className="hy-link">처음 오셨나요? 가입하기 →</button>
            </div>
        </div>
    );
}
