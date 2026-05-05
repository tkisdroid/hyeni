// src/components/auth/ChildEntryTransition.jsx
// Phase 1 spec section 3.4 — 자녀 모드 첫 인사 transition (1초 micro).
// 마스코트 wave + "안녕!" + 보조 카피. 800ms 후 자동 종료 또는 fetch 완료 시 즉시.

import { useEffect, useState } from "react";
import { HyeniMascot } from "./HyeniMascot.jsx";

export function ChildEntryTransition({ onComplete, durationMs = 800 }) {
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const id = window.setTimeout(() => {
            setExiting(true);
            window.setTimeout(() => {
                if (typeof onComplete === "function") onComplete();
            }, 280);
        }, durationMs);
        return () => window.clearTimeout(id);
    }, [onComplete, durationMs]);

    return (
        <div
            className="hyeni-child-entry-transition"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 500,
                background: "var(--mode-child-card-bg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-screen-pad)",
                fontFamily: "var(--font-sans)",
                opacity: exiting ? 0 : 1,
                transition: "opacity var(--duration-screen-fade) var(--easing-standard)",
            }}
            role="status"
            aria-live="polite"
        >
            <HyeniMascot size={96} variant="wave" aria-label="혜니가 손을 흔들어요" />
            <h1
                style={{
                    fontSize: 28,
                    fontWeight: "var(--weight-bold)",
                    color: "var(--theme-accent-text)",
                    margin: "var(--space-5) 0 var(--space-2)",
                }}
            >
                안녕!
            </h1>
            <p
                className="t-screen-subtitle"
                style={{ textAlign: "center", margin: 0 }}
            >
                잠깐만, 부모님 코드 확인할게
            </p>
            <style>{`
                .hyeni-mascot-wave-arm {
                    transform-origin: 60px 50px;
                }
                @media (prefers-reduced-motion: no-preference) {
                    .hyeni-mascot-wave-arm {
                        animation: hyeni-mascot-wave 700ms ease-in-out infinite alternate;
                    }
                }
                @keyframes hyeni-mascot-wave {
                    0%   { transform: rotate(-12deg); }
                    100% { transform: rotate(12deg); }
                }
            `}</style>
        </div>
    );
}
