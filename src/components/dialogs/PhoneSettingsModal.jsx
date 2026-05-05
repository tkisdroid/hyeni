// src/components/dialogs/PhoneSettingsModal.jsx
// 부모용 비상 연락처 설정 — 엄마/아빠 전화번호 입력.
// Extracted from App.jsx (Phase 5 #4 / B21).

import { useState } from "react";
import { FF, makeCardStyle, makeInputStyle, modalBackdropStyle } from "../../lib/styleHelpers.js";

export function PhoneSettingsModal({ phones, onSave, onClose }) {
    const [mom, setMom] = useState(phones.mom || "");
    const [dad, setDad] = useState(phones.dad || "");
    const inputSt = makeInputStyle({ padding: "14px 16px", fontSize: 16, letterSpacing: 1 });
    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
            <div style={makeCardStyle({ padding: "28px 24px", width: "100%", maxWidth: 360 })} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--fg-primary)", textAlign: "center", marginBottom: 20 }}>📞 비상 연락처 설정</div>
                <div style={{ fontSize: 13, color: "var(--fg-secondary)", textAlign: "center", marginBottom: 20 }}>아이 화면에서 바로 전화할 수 있어요</div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--theme-accent-text)", marginBottom: 6 }}>👩 엄마 전화번호</div>
                    <input value={mom} onChange={e => setMom(e.target.value)} placeholder="010-0000-0000" type="tel" style={inputSt}
                        onFocus={e => { e.target.style.borderColor = "var(--theme-accent)"; }} onBlur={e => { e.target.style.borderColor = "var(--bg-muted)"; }} />
                </div>

                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6", marginBottom: 6 }}>👨 아빠 전화번호</div>
                    <input value={dad} onChange={e => setDad(e.target.value)} placeholder="010-0000-0000" type="tel" style={inputSt}
                        onFocus={e => { e.target.style.borderColor = "#3B82F6"; }} onBlur={e => { e.target.style.borderColor = "var(--bg-muted)"; }} />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "var(--bg-muted)", color: "var(--fg-secondary)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>취소</button>
                    <button onClick={() => onSave({ mom: mom.trim(), dad: dad.trim() })} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "var(--hyeni-theme-gradient)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF, boxShadow: "var(--hyeni-theme-shadow-soft)" }}>저장</button>
                </div>
            </div>
        </div>
    );
}
