// src/components/dialogs/AppConfirmDialog.jsx
// Wanted-DS confirm dialog — modal overlay with 취소/확인 grid.
// Extracted from App.jsx (Phase 5 #4 / B1).
//
// Props:
//   dialog: null | { title, message, icon, tone: "danger" | undefined,
//                    cancelLabel, confirmLabel }
//   onCancel: () => void
//   onConfirm: () => void
//
// dialog === null 이면 미렌더. tone="danger" 일 때 amber gradient + 경고 아이콘
// (saturated red 는 SOS/긴급 전용이라 confirm 에는 사용 안 함).

import {
    DESIGN,
    FF,
    makePrimaryButtonStyle,
    makeSecondaryButtonStyle,
} from "../../lib/styleHelpers.js";

export function AppConfirmDialog({ dialog, onCancel, onConfirm }) {
    if (!dialog) return null;
    const isDanger = dialog.tone === "danger";
    const titleId = "hyeni-confirm-dialog-title";
    const descId = "hyeni-confirm-dialog-description";
    return (
        <div
            role="presentation"
            style={{ position: "fixed", inset: 0, zIndex: 10020, background: "rgba(31,41,55,0.36)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, fontFamily: FF }}
            onClick={onCancel}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
                onClick={(event) => event.stopPropagation()}
                style={{ width: "100%", maxWidth: 360, borderRadius: 24, background: "rgba(255,255,255,0.98)", border: "1.5px solid var(--theme-accent-line)", boxShadow: "var(--hyeni-theme-shadow)", padding: 20, boxSizing: "border-box" }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div
                        aria-hidden="true"
                        style={{ width: 42, height: 42, borderRadius: 16, background: isDanger ? "var(--status-cautionary-subtle)" : "var(--theme-accent-soft)", color: isDanger ? "var(--status-cautionary-strong)" : "var(--theme-accent-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 950, flexShrink: 0 }}
                    >
                        {dialog.icon || (isDanger ? "!" : "?")}
                    </div>
                    <h2 id={titleId} style={{ margin: 0, color: DESIGN.colors.ink, fontSize: 18, fontWeight: 950, lineHeight: 1.25 }}>
                        {dialog.title || "확인"}
                    </h2>
                </div>
                <p id={descId} style={{ margin: "0 0 18px", color: "var(--fg-secondary)", fontSize: 14, lineHeight: 1.55, fontWeight: 700 }}>
                    {dialog.message || "계속 진행할까요?"}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                        type="button"
                        onClick={onCancel}
                        style={{ ...makeSecondaryButtonStyle({ padding: "12px 14px", background: "var(--bg-subtle)", color: "var(--fg-secondary)" }), minHeight: 46 }}
                    >
                        {dialog.cancelLabel || "취소"}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        style={{ ...makePrimaryButtonStyle({ padding: "12px 14px", background: isDanger ? DESIGN.gradients.danger : DESIGN.gradients.primary }), minHeight: 46 }}
                    >
                        {dialog.confirmLabel || "확인"}
                    </button>
                </div>
            </section>
        </div>
    );
}
