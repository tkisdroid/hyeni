// src/components/onboarding/ChildPermissionWizard.jsx
// Phase 3 spec section 4.1 — Cartoon-warm 톤으로 재구성 (2026-05-08).
// HeartsBackground + HyeniMascot + cartoon-pill 버튼 + perm-step cartoon 톤.
// Mounted from src/App.jsx (isNativeApp && !isParent && !allReady && !dismissed).
// Steps come from CHILD_SAFETY_SETUP_STEPS via getChildSafetySetupSteps.

import { useState } from "react";
import { HeartsBackground } from "../decoration/HeartsBackground.jsx";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";

const FF = "var(--font-sans)";

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
        <HeartsBackground
            className="hyeni-app-shell child-permission-wizard"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 900,
                fontFamily: FF,
                overflowY: "auto",
            }}
        >
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="child-permission-wizard-title"
            style={{
                minHeight: "100dvh",
                display: "flex",
                flexDirection: "column",
                color: "var(--fg-primary)",
            }}
        >
            {/* Hero — mascot + 진행률 */}
            <header
                style={{
                    padding: "calc(env(safe-area-inset-top, 0px) + var(--space-6)) var(--space-screen-pad) var(--space-5)",
                    background: "var(--cartoon-bg-card)",
                    borderBottom: "1px solid var(--theme-accent-line)",
                }}
            >
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "112px minmax(0, 1fr)",
                    alignItems: "center",
                    gap: "var(--space-4)",
                    marginBottom: "var(--space-3)",
                }}>
                    <div
                        className={`${allReady ? "hyeni-mascot-cheer " : ""}hyeni-micro-icon`}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 112,
                            height: 112,
                            background: "linear-gradient(180deg, rgba(255,255,255,0.9), var(--theme-accent-soft))",
                            borderRadius: 30,
                            border: "1px solid var(--theme-accent-line)",
                            overflow: "hidden",
                            flexShrink: 0,
                            boxShadow: "var(--hyeni-theme-shadow-soft)",
                        }}
                    >
                        <HyeniMascot
                            variant={allReady ? "cheer" : "wave"}
                            size={104}
                            aria-label="처음 설정을 도와주는 혜니"
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2
                            id="child-permission-wizard-title"
                            style={{
                                margin: 0,
                                fontSize: 20,
                                fontWeight: "var(--weight-bold)",
                                color: "var(--theme-accent-text)",
                                lineHeight: "var(--leading-tight)",
                                letterSpacing: 0,
                            }}
                        >
                            {allReady ? "준비 완료! 시작해볼까?" : "처음 설정을 같이 끝내볼게"}
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
                                : "안전 사용을 위해 필요한 권한을 하나씩 확인할게"}
                        </p>
                        {/* Play Store Background Location Disclosure: 권한 부여 전 사용 이유 명시. */}
                        {!allReady && (
                            <p
                                style={{
                                    margin: "var(--space-2) 0 0",
                                    fontSize: 11,
                                    color: "var(--fg-tertiary)",
                                    lineHeight: "var(--leading-normal)",
                                    fontWeight: "var(--weight-medium)",
                                }}
                            >
                                위치는 부모님이 자녀 안전을 확인할 때만 백그라운드에서 사용해요.
                            </p>
                        )}
                    </div>
                </div>

                {!allReady && (
                    <div
                        className="hyeni-micro-enter"
                        style={{
                            marginTop: "var(--space-3)",
                            padding: "var(--space-3)",
                            borderRadius: "var(--radius-card)",
                            border: "1px solid var(--theme-accent-line)",
                            background: "rgba(255,255,255,0.68)",
                            color: "var(--fg-secondary)",
                            fontSize: 12,
                            fontWeight: "var(--weight-semibold)",
                            lineHeight: "var(--leading-normal)",
                        }}
                    >
                        권한은 위치 확인, 일정 알림, 위급 연결처럼 안전 기능에만 사용해요. 언제든 기기 설정에서 바꿀 수 있어요.
                    </div>
                )}

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
                        className="btn btn-primary hyeni-micro-tap"
                        style={{
                            marginTop: "var(--space-4)",
                            width: "100%",
                            minHeight: 56,
                            fontSize: 15,
                            background: "var(--hyeni-theme-gradient)",
                        }}
                    >
                        {running ? "허용 진행 중…" : "한 번에 모두 허용하기"}
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
                            <div className="perm-step hyeni-micro-tap" data-ready={ready ? "true" : "false"}>
                                <span className="perm-step-icon hyeni-micro-icon" aria-hidden="true">
                                    {ready ? "✓" : (step.emoji || idx + 1)}
                                </span>
                                <div className="perm-step-body">
                                    <div className="perm-step-title">{step.title}</div>
                                    <div className="perm-step-desc">{step.description}</div>
                                    {!ready && (
                                        <div
                                            style={{
                                                marginTop: 4,
                                                fontSize: 10,
                                                color: "var(--fg-tertiary)",
                                                fontWeight: "var(--weight-semibold)",
                                                lineHeight: "var(--leading-normal)",
                                            }}
                                        >
                                            막히면 버튼을 눌러 설정 화면에서 허용해 주세요.
                                        </div>
                                    )}
                                </div>
                                {!ready && (
                                    <button
                                        type="button"
                                        onClick={() => onAction?.(step)}
                                        aria-label={`${step.title} ${step.actionLabel || "허용하기"}`}
                                        className="btn btn-primary hyeni-micro-tap"
                                        style={{
                                            flexShrink: 0,
                                            height: 36,
                                            fontSize: 12,
                                            padding: "0 var(--space-3)",
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
                    background: "var(--cartoon-bg-card)",
                    borderTop: "1px solid var(--theme-accent-line)",
                }}
            >
                <button
                    type="button"
                    onClick={onDismiss}
                    className={`btn ${allReady ? "btn-primary" : "btn-secondary"} hyeni-micro-tap`}
                    style={{
                        width: "100%",
                        minHeight: 56,
                        fontSize: 15,
                        background: allReady ? "var(--hyeni-theme-gradient)" : undefined,
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
                        나중에 설정해도 홈 위에서 다시 안내해줄게. 권한을 켜기 전에는 일부 안전 기능이 잠시 멈출 수 있어.
                    </p>
                )}
            </footer>
        </div>
        </HeartsBackground>
    );
}
