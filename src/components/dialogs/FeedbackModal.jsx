// src/components/dialogs/FeedbackModal.jsx
// 피드백 보내기 sheet — 텍스트 입력 + 메일 발송.
// Extracted from App.jsx (Phase 5 #4 / B21). recipient는 prop으로 주입.

import { FF, makeSheetStyle, modalBackdropStyle } from "../../lib/styleHelpers.js";

export function FeedbackModal({ open, value, onChange, busy, onSend, onClose, recipient }) {
    if (!open) return null;

    return (
        <div style={{ position: "fixed", inset: 0, ...modalBackdropStyle, zIndex: 655, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16, fontFamily: FF }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div style={makeSheetStyle({ padding: "28px 22px 34px", width: "100%", maxWidth: 420 })}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "var(--fg-primary)" }}>💌 피드백 보내기</div>
                        <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 6, lineHeight: 1.6 }}>필요한 기능이 있으면 제안해 주세요</div>
                    </div>
                    <button onClick={onClose} style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: "var(--bg-muted)", color: "var(--fg-secondary)", fontWeight: 700, cursor: "pointer", fontFamily: FF }}>닫기</button>
                </div>

                <textarea
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="예) 형제자매별 위치 알림 시간을 따로 설정하고 싶어요"
                    style={{ width: "100%", minHeight: 170, resize: "vertical", padding: "16px 18px", borderRadius: 20, border: "2px solid var(--theme-accent-line)", outline: "none", fontSize: 15, lineHeight: 1.6, fontFamily: FF, color: "var(--fg-primary)", background: "var(--hyeni-surface-warm)", boxSizing: "border-box" }}
                />
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--fg-tertiary)", lineHeight: 1.6 }}>
                    제안은 {recipient}으로 전달됩니다.
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button
                        type="button"
                        onClick={onSend}
                        disabled={busy || !value.trim()}
                        style={{ flex: 1, padding: "15px", borderRadius: 16, border: "none", background: busy || !value.trim() ? "var(--theme-accent-soft)" : "var(--hyeni-theme-gradient)", color: busy || !value.trim() ? "var(--theme-accent-text)" : "white", fontWeight: 800, fontSize: 14, cursor: busy || !value.trim() ? "not-allowed" : "pointer", fontFamily: FF, boxShadow: busy || !value.trim() ? "none" : "var(--hyeni-theme-shadow-soft)" }}
                    >
                        {busy ? "보내는 중..." : "제안 보내기"}
                    </button>
                    <button type="button" onClick={onClose} style={{ padding: "15px 16px", borderRadius: 16, border: "1px solid #E5E7EB", background: "var(--bg-subtle)", color: "var(--fg-secondary)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
}
