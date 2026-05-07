// src/components/auth/RoleSetupModal.jsx
// Phase 1 splash · 역할 선택 · 학부모 로그인 통합 진입.
// Extracted from App.jsx (Phase 5 #4 / B4).

import { useState, useEffect } from "react";
import { AppBrandLogo } from "./AppBrandLogo.jsx";
import { HyeniMascot } from "./HyeniMascot.jsx";
import { SplashScreen } from "./SplashScreen.jsx";
import { ParentAuthScreen } from "./ParentAuthScreen.jsx";
import { ParentSignupScreen } from "./ParentSignupScreen.jsx";
import { HeartsBackground } from "../decoration/HeartsBackground.jsx";
import { HyeniWordmark } from "../decoration/HyeniWordmark.jsx";

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
        <HeartsBackground
            className="hyeni-role-shell"
            style={{
                position: "fixed", inset: 0, zIndex: 500,
                fontFamily: "var(--font-sans)",
                overflowY: "auto",
            }}
        >
            <div
                style={{
                    minHeight: "100%",
                    display: "flex",
                    flexDirection: "column",
                    padding: "calc(env(safe-area-inset-top, 0px) + var(--space-8)) var(--space-screen-pad) calc(env(safe-area-inset-bottom, 0px) + var(--space-6))",
                }}
            >
                <div
                    style={{
                        width: "100%",
                        maxWidth: 360,
                        margin: "0 auto",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    }}
                >
                    {/* ── Brand block: logo + cartoon wordmark + subtitle ── */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "var(--space-6)" }}>
                        <div className="hyeni-role-logo-frame">
                            <AppBrandLogo size={68} radius={18} shadow={false} />
                        </div>
                        <h1 style={{ margin: "var(--space-4) 0 0", lineHeight: 1.1 }}>
                            <HyeniWordmark size="lg" />
                        </h1>
                        <p
                            style={{
                                marginTop: "var(--space-2)",
                                textAlign: "center",
                                fontFamily: "var(--font-sans)",
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--fg-secondary)",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            함께 보는 우리 가족 일정
                        </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cartoon-gap-card)", width: "100%" }}>
                        {/* ── Parent card ── */}
                        <button
                            type="button"
                            onClick={handleParent}
                            aria-label="학부모로 시작"
                            className="hyeni-role-card hyeni-role-card-parent"
                        >
                            <span className="hyeni-role-card-icon">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                    style={{ width: 26, height: 26 }}
                                >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span className="hyeni-role-card-title">학부모</span>
                                <span className="hyeni-role-card-sub">ID · 카카오로 로그인</span>
                            </span>
                            {lastRole === "parent" && (
                                <span className="cartoon-chip cartoon-chip--pink" style={{ marginRight: "var(--cartoon-gap-chip)" }}>♡ 추천</span>
                            )}
                            <span aria-hidden="true" className="hyeni-role-card-arrow">›</span>
                        </button>

                        {/* ── Child card ── */}
                        <button
                            type="button"
                            onClick={handleChild}
                            aria-label="아이로 시작"
                            className="hyeni-role-card hyeni-role-card-child"
                        >
                            <span className="hyeni-role-card-mascot">
                                <HyeniMascot size={52} variant="static" />
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span className="hyeni-role-card-title" style={{ color: "var(--cartoon-rose-text)" }}>아이</span>
                                <span className="hyeni-role-card-sub">부모님 코드로 시작</span>
                            </span>
                            {lastRole === "child" && (
                                <span className="cartoon-chip cartoon-chip--pink" style={{ marginRight: "var(--cartoon-gap-chip)" }}>♡ 추천</span>
                            )}
                            <span aria-hidden="true" className="hyeni-role-card-arrow" style={{ color: "var(--cartoon-rose-text)" }}>›</span>
                        </button>
                    </div>

                    {isReturning && lastRole && (
                        <button
                            type="button"
                            onClick={handleLastRole}
                            className="hyeni-role-resume"
                        >
                            <span style={{ marginRight: "var(--cartoon-gap-chip)" }}>📆</span>
                            지난번엔 <b style={{ color: "var(--cartoon-rose-text)" }}>{lastRole === "parent" ? "학부모" : "아이"}</b>로 사용하셨어요
                            <span style={{ color: "var(--cartoon-rose-text)", marginLeft: "var(--cartoon-gap-chip)", fontWeight: 700 }}>다시 시작 →</span>
                        </button>
                    )}
                </div>
            </div>
        </HeartsBackground>
    );
}
