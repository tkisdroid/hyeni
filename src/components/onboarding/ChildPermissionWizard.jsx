// src/components/onboarding/ChildPermissionWizard.jsx
// Phase 3 spec section 4.1 — Playful-Character 톤으로 재구성.
// HyeniMascot wave + 진행률 그라디언트 + .perm-step 카드 + 완료 시 mascot cheer.
// Mounted from src/App.jsx (isNativeApp && !isParent && !allReady && !dismissed).
// Steps come from CHILD_SAFETY_SETUP_STEPS via getChildSafetySetupSteps.

import { useState } from "react";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";

const FF = '"Pretendard Variable", "Pretendard", system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';

export function ChildPermissionWizard({ steps = [], onAction, onAllowAll, onDismiss }) {
    const totalCount = steps.length;
    const readyCount = steps.filter((s) => s.ready).length;
    const allReady = totalCount > 0 && readyCount === totalCount;
    const progressPct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
    const [running, setRunning] = useState(false);

    const handleAllowAll = async () => {
        if (!onAllowAll || running) return;
        setRunning(true);
        try { await onAllowAll(); } finally { setRunning(false); }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="child-permission-wizard-title"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 900,
                background: "var(--bg-subtle)",
                display: "flex",
                flexDirection: "column",
                fontFamily: FF,
                overflowY: "auto",
                color: "var(--fg-primary)",
            }}
        >
            {/* Hero — mascot + 진행률 그라디언트 */}
            <header
                style={{
                    padding: "calc(env(safe-area-inset-top, 0px) + var(--space-6)) var(--space-screen-pad) var(--space-5)",
                    background: "var(--bg-base)",
                    borderBottom: "1px solid var(--line-soft)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div className={allReady ? "hyeni-mascot-cheer" : ""}>
                        <HyeniMascot size={64} variant={allReady ? "static" : "wave"} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2
                            id="child-permission-wizard-title"
                            style={{
                                margin: 0,
                                fontSize: 20,
                                fontWeight: "var(--weight-bold)",
                                color: "var(--fg-primary)",
                                lineHeight: "var(--leading-tight)",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {allReady ? "준비 완료! 시작해볼까?" : "혜니가 도와줄게!"}
                        </h2>
                        <p
                            style={{
                                margin: "var(--space-1) 0 0",
                                fontSize: 13,
                                color: "var(--fg-secondary)",
                                lineHeight: "var(--leading-normal)",
                                fontWeight: "var(--weight-medium)",
                            }}
                        >
                            {allReady
                                ? "이제 부모님이 너를 안전하게 챙길 수 있어"
                                : "안전을 위해 권한 몇 개만 허용해줘"}
                        </p>
                    </div>
                </div>

                <div
                    className="perm-progress"
                    aria-label={`설정 진행률 ${readyCount} / ${totalCount}`}
                    style={{ marginTop: "var(--space-3)" }}
                >
                    <div className="perm-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <div
                    style={{
                        marginTop: "var(--space-2)",
                        fontSize: 12,
                        color: allReady ? "var(--status-positive-strong)" : "var(--fg-tertiary)",
                        fontWeight: "var(--weight-semibold)",
                    }}
                >
                    {readyCount} / {totalCount} 완료
                </div>

                {!allReady && (
                    <button
                        type="button"
                        onClick={handleAllowAll}
                        disabled={running}
                        aria-label="모든 권한을 한 번에 허용하기"
                        style={{
                            marginTop: "var(--space-4)",
                            width: "100%",
                            minHeight: 56,
                            padding: "0 var(--space-4)",
                            borderRadius: "var(--radius-control)",
                            background: running ? "var(--bg-muted)" : "var(--theme-accent)",
                            color: running ? "var(--fg-disabled)" : "#FFFFFF",
                            border: "none",
                            cursor: running ? "wait" : "pointer",
                            fontWeight: "var(--weight-bold)",
                            fontSize: 15,
                            fontFamily: FF,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "var(--space-2)",
                            userSelect: "none",
                            touchAction: "manipulation",
                            transition: "background var(--duration-fast) var(--easing-standard)",
                        }}
                    >
                        {running ? "허용 진행 중…" : "한번에 모두 허용하기"}
                        {!running && <span aria-hidden="true" style={{ fontSize: 13, opacity: 0.85 }}>→</span>}
                    </button>
                )}
            </header>

            {/* Step list */}
            <ul
                style={{
                    listStyle: "none",
                    padding: "var(--space-4) var(--space-screen-pad) var(--space-6)",
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                }}
            >
                {steps.map((step, idx) => {
                    const ready = !!step.ready;
                    return (
                        <li key={step.id}>
                            <div className="perm-step" data-ready={ready ? "true" : "false"}>
                                <span className="perm-step-icon" aria-hidden="true">
                                    {ready ? "✓" : (step.emoji || idx + 1)}
                                </span>
                                <div className="perm-step-body">
                                    <div className="perm-step-title">{step.title}</div>
                                    <div className="perm-step-desc">{step.description}</div>
                                </div>
                                {!ready && (
                                    <button
                                        type="button"
                                        onClick={() => onAction?.(step)}
                                        aria-label={`${step.title} ${step.actionLabel || "허용하기"}`}
                                        style={{
                                            flexShrink: 0,
                                            height: 36,
                                            padding: "0 var(--space-3)",
                                            borderRadius: "var(--radius-md)",
                                            background: "var(--theme-accent-soft)",
                                            color: "var(--theme-accent-text)",
                                            border: "1px solid var(--theme-accent-line)",
                                            cursor: "pointer",
                                            fontWeight: "var(--weight-bold)",
                                            fontSize: 12,
                                            fontFamily: FF,
                                            touchAction: "manipulation",
                                        }}
                                    >
                                        {step.actionLabel || "허용"}
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* Footer CTA */}
            <footer
                style={{
                    marginTop: "auto",
                    padding: "var(--space-3) var(--space-screen-pad) calc(env(safe-area-inset-bottom, 0px) + var(--space-5))",
                    background: "var(--bg-base)",
                    borderTop: "1px solid var(--line-soft)",
                }}
            >
                <button
                    type="button"
                    onClick={onDismiss}
                    style={{
                        width: "100%",
                        minHeight: 56,
                        padding: "0 var(--space-4)",
                        borderRadius: "var(--radius-control)",
                        background: allReady ? "var(--status-positive)" : "var(--bg-base)",
                        color: allReady ? "#FFFFFF" : "var(--fg-secondary)",
                        border: allReady ? "none" : "1px solid var(--line-default)",
                        fontSize: 15,
                        fontWeight: "var(--weight-bold)",
                        cursor: "pointer",
                        fontFamily: FF,
                        touchAction: "manipulation",
                    }}
                >
                    {allReady ? "시작하기" : "나중에 할래"}
                </button>
                {!allReady && (
                    <p
                        style={{
                            marginTop: "var(--space-2)",
                            fontSize: 11,
                            color: "var(--fg-tertiary)",
                            textAlign: "center",
                            lineHeight: "var(--leading-normal)",
                            fontWeight: "var(--weight-medium)",
                        }}
                    >
                        나중에 설정해도 홈 위에서 다시 안내해줄게
                    </p>
                )}
            </footer>
        </div>
    );
}
