// src/components/auth/SplashScreen.jsx
// Phase 1 spec section 3.1 — Splash + 세션 복원 로딩.
// Logo + status copy + 2 skeleton cards (parent 80px / child 104px).
// Cross-fades to RoleSetupModal when session fetch completes.

import { useEffect, useState } from "react";

export function SplashScreen({ AppBrandLogo, onTimeout, maxDurationMs = 1500 }) {
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        if (typeof onTimeout !== "function") return;
        const id = window.setTimeout(() => {
            setExiting(true);
            window.setTimeout(onTimeout, 280);
        }, maxDurationMs);
        return () => window.clearTimeout(id);
    }, [onTimeout, maxDurationMs]);

    return (
        <div
            className="hyeni-splash-screen"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 500,
                background: "var(--bg-subtle)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "calc(env(safe-area-inset-top, 0px) + var(--space-8)) var(--space-screen-pad) calc(env(safe-area-inset-bottom, 0px) + var(--space-6))",
                opacity: exiting ? 0 : 1,
                transition: "opacity var(--duration-screen-fade) var(--easing-standard)",
            }}
            role="status"
            aria-live="polite"
        >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "var(--space-screen-gap)", flex: "0 0 auto" }}>
                {AppBrandLogo ? <AppBrandLogo size={88} radius={22} /> : null}
                <h1 className="t-screen-title" style={{ marginTop: "var(--space-4)", textAlign: "center" }}>혜니캘린더</h1>
                <p className="t-screen-subtitle" style={{ marginTop: "var(--space-2)", textAlign: "center" }}>가족 일정 동기화 중</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", maxWidth: 344, width: "100%", margin: "0 auto" }}>
                <div className="hyeni-skeleton hyeni-skeleton--parent" />
                <div className="hyeni-skeleton hyeni-skeleton--child" />
            </div>
            <style>{`
                .hyeni-skeleton {
                    background: linear-gradient(90deg,
                        var(--bg-muted) 0%,
                        color-mix(in srgb, var(--bg-base) 60%, var(--bg-muted)) 50%,
                        var(--bg-muted) 100%);
                    background-size: 200% 100%;
                    animation: hyeni-shimmer 1400ms infinite linear;
                }
                .hyeni-skeleton--parent {
                    height: var(--mode-parent-card-height);
                    border-radius: var(--mode-parent-card-radius);
                }
                .hyeni-skeleton--child {
                    height: var(--mode-child-card-height);
                    border-radius: var(--mode-child-card-radius);
                }
                @keyframes hyeni-shimmer {
                    0%   { background-position-x: 100%; }
                    100% { background-position-x: -100%; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .hyeni-skeleton { animation: none; background: var(--bg-muted); }
                }
            `}</style>
        </div>
    );
}
