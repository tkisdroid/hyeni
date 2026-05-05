// src/components/auth/RoleSetupModal.jsx
// Phase 1 splash · 역할 선택 · 학부모 로그인 통합 진입.
// Extracted from App.jsx (Phase 5 #4 / B4).

import { useState, useEffect } from "react";
import { FF } from "../../lib/styleHelpers.js";
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
        <div
            className="hyeni-app-shell"
            style={{
                position: "fixed", inset: 0, zIndex: 500,
                background: "var(--bg-subtle)",
                display: "flex", flexDirection: "column",
                padding: "calc(env(safe-area-inset-top, 0px) + var(--space-6)) var(--space-screen-pad) calc(env(safe-area-inset-bottom, 0px) + var(--space-6))",
                fontFamily: FF, overflowY: "auto",
            }}
        >
            <p
                className="t-screen-promise"
                style={{ textAlign: "center", marginBottom: "var(--space-8)" }}
            >
                한 가족, 두 시점
            </p>
            <div style={{ width: "100%", maxWidth: 344, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "var(--space-screen-gap)" }}>
                    <AppBrandLogo size={72} radius={20} />
                    <h1 className="t-screen-title" style={{ marginTop: "var(--space-4)", textAlign: "center" }}>혜니캘린더</h1>
                    <p className="t-screen-subtitle" style={{ marginTop: "var(--space-2)", textAlign: "center" }}>함께 보는 우리 가족 일정</p>
                </div>

                {isReturning && lastRole && (
                    <button
                        type="button"
                        onClick={handleLastRole}
                        style={{
                            width: "100%",
                            marginBottom: "var(--space-4)",
                            padding: "var(--space-3) var(--space-4)",
                            background: "transparent",
                            border: "1px dashed var(--line-default)",
                            borderRadius: "var(--radius-control)",
                            fontFamily: FF,
                            color: "var(--fg-secondary)",
                            fontSize: 13,
                            fontWeight: "var(--weight-medium)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "var(--space-2)",
                            transition: "border-color var(--duration-fast) var(--easing-standard)",
                        }}
                    >
                        지난번엔 <b style={{ color: "var(--theme-accent-text)", fontWeight: "var(--weight-semibold)" }}>{lastRole === "parent" ? "학부모" : "아이"}</b>로 사용하셨어요
                        <span style={{ color: "var(--theme-accent-text)" }}>· 다시 시작 →</span>
                    </button>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%" }}>
                    {/* Parent card — Minimal-Pro tone */}
                    <button
                        type="button"
                        onClick={handleParent}
                        aria-label="학부모로 시작"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-4)",
                            width: "100%",
                            height: "var(--mode-parent-card-height)",
                            padding: "0 var(--space-5)",
                            background: "var(--mode-parent-card-bg)",
                            border: "var(--mode-parent-card-border)",
                            borderRadius: "var(--mode-parent-card-radius)",
                            boxShadow: "var(--mode-parent-card-shadow)",
                            cursor: "pointer",
                            fontFamily: FF,
                            textAlign: "left",
                            transition: "transform var(--duration-fast) var(--easing-standard), border-color var(--duration-fast) var(--easing-standard)",
                        }}
                    >
                        <svg
                            width="var(--mode-parent-icon-size)"
                            height="var(--mode-parent-icon-size)"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ color: "var(--fg-secondary)", flexShrink: 0, width: 32, height: 32 }}
                        >
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 17, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>학부모</span>
                            <span style={{ display: "block", fontSize: 13, color: "var(--fg-secondary)", marginTop: 2, fontWeight: "var(--weight-medium)" }}>ID·카카오로 로그인</span>
                        </span>
                        <span aria-hidden="true" style={{ color: "var(--fg-tertiary)", fontSize: 17, fontWeight: "var(--weight-bold)", flexShrink: 0 }}>›</span>
                    </button>

                    {/* Child card — Playful-Character tone with mascot */}
                    <button
                        type="button"
                        onClick={handleChild}
                        aria-label="아이로 시작"
                        className="hyeni-role-card-child"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-4)",
                            width: "100%",
                            height: "var(--mode-child-card-height)",
                            padding: "0 var(--space-5)",
                            background: "var(--mode-child-card-bg)",
                            border: "var(--mode-child-card-border)",
                            borderRadius: "var(--mode-child-card-radius)",
                            boxShadow: "var(--mode-child-card-shadow)",
                            cursor: "pointer",
                            fontFamily: FF,
                            textAlign: "left",
                            transition: "transform var(--duration-fast) var(--easing-standard)",
                        }}
                    >
                        <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                            <HyeniMascot size={56} variant="static" />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 18, fontWeight: "var(--weight-bold)", color: "var(--theme-accent-text)" }}>아이</span>
                            <span style={{ display: "block", fontSize: 13, color: "var(--fg-secondary)", marginTop: 2, fontWeight: "var(--weight-medium)" }}>부모님 코드로 시작</span>
                        </span>
                        <span aria-hidden="true" style={{ color: "var(--theme-accent-text)", fontSize: 17, fontWeight: "var(--weight-bold)", flexShrink: 0 }}>›</span>
                    </button>
                </div>
            </div>
            <style>{`
                .hyeni-role-card-child:hover svg { transform: translateY(-3px); }
                .hyeni-role-card-child svg {
                    transition: transform var(--duration-mascot-bounce) var(--easing-mascot);
                }
                @media (prefers-reduced-motion: reduce) {
                    .hyeni-role-card-child svg { transition: none; }
                }
            `}</style>
        </div>
    );
}
