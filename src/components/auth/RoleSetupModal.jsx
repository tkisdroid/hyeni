// src/components/auth/RoleSetupModal.jsx
// Phase 1 splash · 역할 선택 · 학부모 로그인 통합 진입.
// 2026-05-07 cartoon DS migration: hy-role-modal 클래스 사용. 로직/prop 보존.

import { useState, useEffect } from "react";
import { AppBrandLogo } from "./AppBrandLogo.jsx";
import { HyeniMascot } from "./HyeniMascot.jsx";
import { SplashScreen } from "./SplashScreen.jsx";
import { ParentAuthScreen } from "./ParentAuthScreen.jsx";
import { ParentSignupScreen } from "./ParentSignupScreen.jsx";

export function RoleSetupModal({ onSelect, loading }) {
    const [authView, setAuthView] = useState(null);  // null | "login" | "signup"
    const isReturning = (() => {
        try { return !!localStorage.getItem("hyeni-has-visited"); } catch { return false; }
    })();
    const lastRole = (() => {
        try { return localStorage.getItem("hyeni-last-role"); } catch { return null; }
    })();

    useEffect(() => {
        try { localStorage.setItem("hyeni-has-visited", "1"); } catch { /* intentionally empty */ }
    }, []);

    const handleParent = () => {
        try { localStorage.setItem("hyeni-last-role", "parent"); } catch { /* ignore */ }
        setAuthView("login");
    };

    const handleChild = () => {
        try { localStorage.setItem("hyeni-last-role", "child"); } catch { /* ignore */ }
        onSelect("child");
    };

    const handleLastRole = () => {
        if (lastRole === "parent") handleParent();
        else if (lastRole === "child") handleChild();
    };

    if (authView === "login") {
        return (
            <ParentAuthScreen
                onBack={() => setAuthView(null)}
                onSignupClick={() => setAuthView("signup")}
            />
        );
    }
    if (authView === "signup") {
        return (
            <ParentSignupScreen
                onBack={() => setAuthView("login")}
            />
        );
    }

    if (loading) {
        return <SplashScreen AppBrandLogo={AppBrandLogo} />;
    }

    return (
        <div className="hy-role-modal">
            <div className="hy-role-modal__inner">
                <div className="hy-role-modal__brand">
                    <AppBrandLogo size={88} radius={24} />
                    <h1 className="hy-role-modal__title">혜니캘린더</h1>
                    <p className="hy-role-modal__subtitle">한 가족, 두 시점</p>
                </div>

                {isReturning && lastRole && (
                    <button
                        type="button"
                        onClick={handleLastRole}
                        className="hy-role-modal__last"
                    >
                        지난번엔 <b>{lastRole === "parent" ? "학부모" : "아이"}</b>로 사용하셨어요 · 다시 시작 →
                    </button>
                )}

                <div className="hy-stack">
                    <button
                        type="button"
                        onClick={handleParent}
                        aria-label="학부모로 시작"
                        className="hy-card hy-role-card hy-role-card--parent"
                    >
                        <span className="hy-role-card__icon" aria-hidden="true">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </span>
                        <span className="hy-role-card__body">
                            <span className="hy-role-card__title">학부모</span>
                            <span className="hy-role-card__desc">ID · 카카오 · 구글 · 네이버로 시작</span>
                        </span>
                        <span aria-hidden="true" className="hy-role-card__chevron">›</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleChild}
                        aria-label="아이로 시작"
                        className="hy-card hy-role-card hy-role-card--child"
                    >
                        <span className="hy-role-card__icon" aria-hidden="true">
                            <HyeniMascot size={56} variant="static" />
                        </span>
                        <span className="hy-role-card__body">
                            <span className="hy-role-card__title">아이</span>
                            <span className="hy-role-card__desc">부모님 코드로 시작</span>
                        </span>
                        <span aria-hidden="true" className="hy-role-card__chevron">›</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
