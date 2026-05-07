// src/components/onboarding/ChildPermissionWizard.jsx
// Phase 3 spec section 4.1 — Playful 톤 권한 마법사.
// 2026-05-07 cartoon DS migration: hy-perm 클래스 사용. 로직/prop 보존.
// HyeniMascot wave + 진행률 그라디언트 + step 카드 + 완료 시 mascot cheer.
// Mounted from src/App.jsx (isNativeApp && !isParent && !allReady && !dismissed).
// Steps come from CHILD_SAFETY_SETUP_STEPS via getChildSafetySetupSteps.

import { useState } from "react";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";

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
            className="hy-perm"
        >
            <header className="hy-perm__hero">
                <div className="hy-perm__hero-row">
                    <div className={allReady ? "hyeni-mascot-cheer" : ""}>
                        <HyeniMascot size={64} variant={allReady ? "static" : "wave"} />
                    </div>
                    <div className="hy-perm__hero-text">
                        <h2 id="child-permission-wizard-title" className="hy-perm__title">
                            {allReady ? "준비 완료! 시작해볼까?" : "혜니가 도와줄게!"}
                        </h2>
                        <p className="hy-perm__desc">
                            {allReady
                                ? "이제 부모님이 너를 안전하게 챙길 수 있어"
                                : "안전 사용을 위해 권한 몇 개만 허용해줘"}
                        </p>
                        {!allReady && (
                            <p className="hy-perm__note">
                                위치는 부모님이 자녀 안전을 확인할 때만 백그라운드에서 사용해요.
                            </p>
                        )}
                    </div>
                </div>

                <div
                    className="hy-perm__progress"
                    aria-label={`설정 진행률 ${readyCount} / ${totalCount}`}
                >
                    <div className="hy-perm__progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <div className={`hy-perm__progress-label ${allReady ? "hy-perm__progress-label--complete" : ""}`}>
                    {readyCount} / {totalCount} 완료
                </div>

                {!allReady && (
                    <button
                        type="button"
                        onClick={handleAllowAll}
                        disabled={running}
                        aria-label="모든 권한을 한 번에 허용하기"
                        className="hy-perm__allow-all"
                    >
                        {running ? "허용 진행 중…" : "한 번에 모두 허용하기"}
                        {!running && <span aria-hidden="true">→</span>}
                    </button>
                )}
            </header>

            <ul className="hy-perm__steps">
                {steps.map((step, idx) => {
                    const ready = !!step.ready;
                    return (
                        <li key={step.id}>
                            <div className="hy-perm-step" data-ready={ready ? "true" : "false"}>
                                <span className="hy-perm-step__icon" aria-hidden="true">
                                    {ready ? "✓" : (step.emoji || idx + 1)}
                                </span>
                                <div className="hy-perm-step__body">
                                    <div className="hy-perm-step__title">{step.title}</div>
                                    <div className="hy-perm-step__desc">{step.description}</div>
                                </div>
                                {!ready && (
                                    <button
                                        type="button"
                                        onClick={() => onAction?.(step)}
                                        aria-label={`${step.title} ${step.actionLabel || "허용하기"}`}
                                        className="hy-perm-step__cta"
                                    >
                                        {step.actionLabel || "허용"}
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            <footer className="hy-perm__footer">
                <button
                    type="button"
                    onClick={onDismiss}
                    className={allReady ? "hy-perm__primary" : "hy-perm__secondary"}
                >
                    {allReady ? "시작하기" : "나중에 할래"}
                </button>
                {!allReady && (
                    <p className="hy-perm__hint">
                        나중에 설정해도 홈 위에서 다시 안내해줄게
                    </p>
                )}
            </footer>
        </div>
    );
}
