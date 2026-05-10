// src/components/auth/SplashScreen.jsx
// Welcome hero (Phase 07 redesign — see mockup `src/stitch/.../07_30_50 (1).png`).
// Big mascot illustration + 3 feature pills + "시작하기" CTA. Auto fades after
// maxDurationMs OR when the user taps the CTA, calling onTimeout.
// Props are unchanged from the prior splash version so callers (App.jsx,
// RoleSetupModal loading state) need no edits.

import { useEffect, useState } from "react";
import { HyeniMascot } from "./HyeniMascot.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

export function SplashScreen({ AppBrandLogo, onTimeout, maxDurationMs = 6000 }) {
    const [exiting, setExiting] = useState(false);

    const finish = () => {
        if (exiting) return;
        setExiting(true);
        if (typeof onTimeout === "function") {
            window.setTimeout(onTimeout, 280);
        }
    };

    useEffect(() => {
        if (typeof onTimeout !== "function") return undefined;
        const id = window.setTimeout(finish, maxDurationMs);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onTimeout, maxDurationMs]);

    return (
        <div
            className="hyeni-splash-screen"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 500,
                background: "linear-gradient(180deg, #FFE7EE 0%, #FFF6F2 50%, #F4E4FB 100%)",
                display: "flex",
                flexDirection: "column",
                padding: "calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 16px)",
                opacity: exiting ? 0 : 1,
                transition: "opacity 280ms cubic-bezier(0.2, 0, 0, 1)",
                fontFamily: "var(--font-sans)",
                overflow: "hidden",
            }}
            role="status"
            aria-live="polite"
        >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                {AppBrandLogo ? <AppBrandLogo size={64} radius={18} /> : null}
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

            <div style={{ textAlign: "center", marginTop: 20, flex: "0 0 auto" }}>
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
                    가족의 하루를<br />
                    더 <span style={{ color: "var(--theme-accent, #F779A8)" }}>다정하게</span>
                    <span aria-hidden="true" style={{ fontSize: 16, color: "var(--theme-accent, #F779A8)", marginLeft: 4 }}>♥</span>
                </h2>
                <p
                    style={{
                        marginTop: 12,
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#7A6770",
                    }}
                >
                    일정 공유부터 자녀 안전 확인까지 한 번에
                </p>
            </div>

            <div style={{ position: "relative", flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240, marginTop: 8 }}>
                <div aria-hidden="true" style={{ position: "absolute", left: "8%", top: "18%" }}>
                    <ThreeDIcon name="calendar-check" size={48} />
                </div>
                <div aria-hidden="true" style={{ position: "absolute", left: "4%", top: "55%" }}>
                    <ThreeDIcon name="heart" size={36} />
                </div>
                <div aria-hidden="true" style={{ position: "absolute", right: "8%", top: "20%" }}>
                    <ThreeDIcon name="pin" size={48} />
                </div>
                <div aria-hidden="true" style={{ position: "absolute", right: "4%", top: "55%" }}>
                    <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 56,
                        height: 56,
                        background: "#FFFFFF",
                        borderRadius: 18,
                        border: "1px solid #FFD6DD",
                        boxShadow: "0 4px 12px rgba(247, 121, 168, 0.12)",
                    }}>
                        <ThreeDIcon name="heart" size={26} />
                    </span>
                </div>
                <HyeniMascot variant="static" size={260} aria-label="혜니" />
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                    padding: "16px 12px",
                    background: "rgba(255, 255, 255, 0.7)",
                    border: "1px solid #FFE0E6",
                    borderRadius: 24,
                    backdropFilter: "blur(8px)",
                    flex: "0 0 auto",
                }}
            >
                <FeaturePill icon="calendar-check" title="가족 일정" subtitle="공유" />
                <FeaturePill icon="shield" title="자녀 안전" subtitle="확인" />
                <FeaturePill icon="bell" title="중요 일정" subtitle="알림" />
            </div>

            <button
                type="button"
                onClick={finish}
                className="btn btn-primary"
                style={{ marginTop: 16, width: "100%", flex: "0 0 auto" }}
                aria-label="시작하기"
            >
                시작하기
                <span aria-hidden="true" style={{ fontWeight: 600, fontSize: 18 }}>›</span>
            </button>

            <p
                style={{
                    marginTop: 12,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#A892A0",
                    flex: "0 0 auto",
                }}
            >
                <span aria-hidden="true" style={{ color: "#F779A8", marginRight: 6 }}>♥</span>
                소중한 우리 가족을 위한 캘린더
                <span aria-hidden="true" style={{ color: "#F779A8", marginLeft: 6 }}>♥</span>
            </p>
        </div>
    );
}

function FeaturePill({ icon, title, subtitle }) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "8px 4px",
            }}
        >
            <ThreeDIcon name={icon} size={36} />
            <div style={{ textAlign: "center", lineHeight: 1.2 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2A1A20" }}>{title}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2A1A20" }}>{subtitle}</div>
            </div>
        </div>
    );
}
