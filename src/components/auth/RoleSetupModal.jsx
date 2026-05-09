// src/components/auth/RoleSetupModal.jsx
// Role selection — Phase 07 redesign (mockup `src/stitch/.../07_30_50 (2).png`).
// Big vertical cards for 부모/자녀, returning-user resume chip, primary CTA.
// Public props (`onSelect`, `loading`) preserved.

import { useState, useEffect } from "react";
import { AppBrandLogo } from "./AppBrandLogo.jsx";
import { SplashScreen } from "./SplashScreen.jsx";
import { ParentAuthScreen } from "./ParentAuthScreen.jsx";
import { ParentSignupScreen } from "./ParentSignupScreen.jsx";
import { HyeniMascot } from "./HyeniMascot.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

export function RoleSetupModal({ onSelect, loading }) {
    const [authView, setAuthView] = useState(null);  // null | "login" | "signup"
    const [selected, setSelected] = useState(null);  // null | "parent" | "child"
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

    const proceed = () => {
        if (selected === "parent") handleParent();
        else if (selected === "child") handleChild();
    };

    return (
        <div
            className="hyeni-role-shell"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 500,
                fontFamily: "var(--font-sans)",
                overflowY: "auto",
                background: "linear-gradient(180deg, #FFE7EE 0%, #FFF6F2 50%, #F4E4FB 100%)",
            }}
        >
            <div
                style={{
                    minHeight: "100%",
                    display: "flex",
                    flexDirection: "column",
                    padding: "calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 16px)",
                }}
            >
                <div style={{ width: "100%", maxWidth: 400, margin: "0 auto", display: "flex", flexDirection: "column", flex: 1 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
                        <AppBrandLogo size={64} radius={18} shadow={false} />
                        <h1
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
                        </h1>
                    </div>

                    <div style={{ textAlign: "center", marginBottom: 28 }}>
                        <h2
                            style={{
                                margin: 0,
                                fontSize: 30,
                                fontWeight: 800,
                                lineHeight: 1.2,
                                color: "#2A1A20",
                                letterSpacing: "-0.03em",
                            }}
                        >
                            누구로 <span style={{ color: "var(--theme-accent, #F779A8)" }}>시작</span>할까요?
                            <span aria-hidden="true" style={{ fontSize: 16, color: "var(--theme-accent, #F779A8)", marginLeft: 4 }}>♥</span>
                        </h2>
                        <p style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: "#7A6770" }}>
                            가족 일정 관리 또는 부모님 코드 연결을 선택해 주세요
                        </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                        <RoleCard
                            role="parent"
                            active={selected === "parent"}
                            onSelect={() => setSelected("parent")}
                            badgeIcon="bell"
                            title="부모로 시작"
                            subtitle="일정 작성 · 가족 관리 · 안전 확인"
                            mascot={<HyeniMascot variant="phone" size={120} aria-label="" />}
                        />
                        <RoleCard
                            role="child"
                            active={selected === "child"}
                            onSelect={() => setSelected("child")}
                            badgeIcon="heart"
                            title="자녀로 시작"
                            subtitle="부모님 코드로 연결 · 내 일정 확인"
                            mascot={<HyeniMascot variant="static" size={120} aria-label="" />}
                        />
                    </div>

                    {isReturning && lastRole && (
                        <button
                            type="button"
                            onClick={handleLastRole}
                            style={{
                                marginTop: 24,
                                alignSelf: "center",
                                background: "rgba(255,255,255,0.85)",
                                border: "1px solid #FFD6DD",
                                borderRadius: 999,
                                padding: "10px 18px",
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#7A6770",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                fontFamily: "var(--font-sans)",
                            }}
                        >
                            <ThreeDIcon name="calendar-check" size={18} />
                            지난번엔 <b style={{ color: "var(--theme-accent-text, #C3325B)" }}>{lastRole === "parent" ? "부모" : "자녀"}</b>로 사용했어요
                        </button>
                    )}

                    <div style={{ flex: 1 }} />

                    <button
                        type="button"
                        onClick={proceed}
                        disabled={!selected}
                        style={{
                            marginTop: 20,
                            height: 56,
                            borderRadius: 999,
                            border: "none",
                            background: selected
                                ? "linear-gradient(90deg, #FFA5C4 0%, #F779A8 100%)"
                                : "linear-gradient(90deg, #F8C8D5 0%, #EFB6C7 100%)",
                            color: "#FFFFFF",
                            fontSize: 16,
                            fontWeight: 700,
                            fontFamily: "var(--font-sans)",
                            letterSpacing: "-0.02em",
                            cursor: selected ? "pointer" : "not-allowed",
                            opacity: selected ? 1 : 0.7,
                            boxShadow: selected ? "0 6px 18px rgba(247, 121, 168, 0.28)" : "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            transition: "all 200ms",
                        }}
                        aria-label="다음"
                    >
                        다음
                        <span aria-hidden="true" style={{ fontWeight: 600, fontSize: 18 }}>›</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function RoleCard({ active, onSelect, badgeIcon, title, subtitle, mascot }) {
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-label={title}
            aria-pressed={active}
            style={{
                position: "relative",
                width: "100%",
                background: "rgba(255,255,255,0.78)",
                border: active ? "2px solid #F779A8" : "1px solid #FFD6DD",
                borderRadius: 24,
                padding: 16,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 12,
                minHeight: 140,
                boxShadow: active
                    ? "0 6px 18px rgba(247, 121, 168, 0.18)"
                    : "0 2px 8px rgba(247, 121, 168, 0.06)",
                transition: "all 200ms",
                overflow: "hidden",
            }}
        >
            <div style={{
                width: 132,
                minWidth: 132,
                height: 132,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
            }}>
                {mascot}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        background: "linear-gradient(135deg, #FFC1CF 0%, #F779A8 100%)",
                    }}>
                        <ThreeDIcon name={badgeIcon} size={20} aria-label="" />
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#2A1A20", letterSpacing: "-0.02em" }}>{title}</div>
                    <span aria-hidden="true" style={{ fontSize: 22, color: "#A892A0" }}>›</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#7A6770", lineHeight: 1.4 }}>{subtitle}</div>
            </div>
        </button>
    );
}
