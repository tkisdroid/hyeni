// src/components/dialogs/EditFieldModal.jsx
// 단일 필드 편집 모달 — 이름/전화번호 등 짧은 텍스트 1개 수정용.

import { useEffect, useState } from "react";
import { FF, makeCardStyle, makeInputStyle, modalBackdropStyle } from "../../lib/styleHelpers.js";

export function EditFieldModal({
    open,
    title = "수정",
    label = "값",
    value = "",
    placeholder = "",
    inputType = "text",
    busy = false,
    onSave,
    onClose,
}) {
    const [text, setText] = useState(value);
    useEffect(() => { if (open) setText(value || ""); }, [open, value]);
    if (!open) return null;
    const inputSt = makeInputStyle({ padding: "14px 16px", fontSize: 16, letterSpacing: inputType === "tel" ? 1 : 0 });
    const handleSave = () => {
        if (busy) return;
        const next = (text || "").trim();
        if (typeof onSave === "function") onSave(next);
    };
    return (
        <div
            style={{ position: "fixed", inset: 0, ...modalBackdropStyle, zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={onClose}
        >
            <div style={makeCardStyle({ padding: "28px 24px", width: "100%", maxWidth: 360 })} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--fg-primary)", textAlign: "center", marginBottom: 16 }}>{title}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--theme-accent-text)", marginBottom: 6 }}>{label}</div>
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={placeholder}
                    type={inputType}
                    autoFocus
                    style={inputSt}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
                    onFocus={e => { e.target.style.borderColor = "var(--theme-accent)"; }}
                    onBlur={e => { e.target.style.borderColor = "var(--bg-muted)"; }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "var(--bg-muted)", color: "var(--fg-secondary)", fontWeight: 700, fontSize: 14, cursor: busy ? "default" : "pointer", fontFamily: FF }}
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={busy}
                        style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "var(--hyeni-theme-gradient)", color: "white", fontWeight: 700, fontSize: 14, cursor: busy ? "default" : "pointer", fontFamily: FF, boxShadow: "var(--hyeni-theme-shadow-soft)", opacity: busy ? 0.6 : 1 }}
                    >
                        {busy ? "저장 중…" : "저장"}
                    </button>
                </div>
            </div>
        </div>
    );
}
