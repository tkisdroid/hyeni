// src/components/childMode/ChildRequestConfirmSheet.jsx
// 자녀 설정 변경 요청 확인 시트 — "변경 요청" 탭 시 부모에게 보낼지 한 번 더 확인.
// 자녀 화면이므로 반말 톤. Phase 2 — child settings change-request model.

import { makeCardStyle, modalBackdropStyle } from "../../lib/styleHelpers.js";
import { SETTING_REQUEST_META } from "../../lib/childSettingRequest.js";

export function ChildRequestConfirmSheet({ open, menuKey, busy = false, onConfirm, onClose }) {
    const meta = menuKey ? SETTING_REQUEST_META[menuKey] : null;
    if (!open || !meta) return null;

    const close = () => { if (!busy && typeof onClose === "function") onClose(); };
    const confirm = () => { if (!busy && typeof onConfirm === "function") onConfirm(); };

    return (
        <div
            style={{ position: "fixed", inset: 0, ...modalBackdropStyle, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)" }}
            onClick={close}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`${meta.childLabel} 변경 요청`}
                style={makeCardStyle({ padding: "var(--space-6) var(--space-5)", width: "100%", maxWidth: 340 })}
                onClick={(e) => e.stopPropagation()}
            >
                <div aria-hidden="true" style={{ fontSize: 40, textAlign: "center", marginBottom: "var(--space-2)" }}>✉️</div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)", textAlign: "center", marginBottom: "var(--space-2)" }}>
                    {meta.childLabel} 바꾸고 싶어?
                </h2>
                <p style={{ fontSize: 13, fontWeight: "var(--weight-medium)", color: "var(--fg-secondary)", textAlign: "center", lineHeight: 1.5, margin: "0 0 var(--space-5)" }}>
                    부모님께 요청을 보낼게.<br />부모님이 확인하면 바꿔 주실 거야.
                </p>
                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <button
                        type="button"
                        onClick={close}
                        disabled={busy}
                        className="btn btn-secondary"
                        style={{ flex: 1, height: 46, fontSize: 14 }}
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={confirm}
                        disabled={busy}
                        className="btn btn-primary"
                        style={{ flex: 1, height: 46, fontSize: 14 }}
                    >
                        {busy ? "보내는 중…" : "요청 보내기"}
                    </button>
                </div>
            </div>
        </div>
    );
}
