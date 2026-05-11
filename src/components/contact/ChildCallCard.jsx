// src/components/contact/ChildCallCard.jsx
// 자녀 화면용 빠른 전화연결 카드 — 엄마/아빠 번호 tel: 링크.
// Extracted from App.jsx (Phase 5 #4 / B20).

import { DESIGN, FF } from "../../lib/styleHelpers.js";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

export function ChildCallCard({ phones = {} }) {
    const cleanNumber = (num) => (num || "").replace(/[^0-9+]/g, "");
    const targets = [
        phones.mom && phones.mom.length >= 8 ? { key: "mom", label: "엄마", iconName: "parent-mom", number: cleanNumber(phones.mom), color: "var(--theme-accent-text)", bg: "var(--theme-accent-soft)" } : null,
        phones.dad && phones.dad.length >= 8 ? { key: "dad", label: "아빠", iconName: "parent-dad", number: cleanNumber(phones.dad), color: "var(--theme-accent-text)", bg: "var(--theme-accent-soft)" } : null,
    ].filter(Boolean);
    const hasTargets = targets.length > 0;

    return (
        <div
            aria-label={hasTargets ? "부모님께 전화하기" : "등록된 전화번호 없음"}
            style={{
                minHeight: 132,
                padding: "14px",
                borderRadius: DESIGN.radius.xl,
                border: "1px solid var(--theme-accent-line)",
                background: hasTargets ? "linear-gradient(135deg,var(--theme-accent-soft),var(--hyeni-surface-warm))" : "var(--bg-subtle)",
                color: hasTargets ? "var(--theme-accent-text)" : "#9CA3AF",
                boxShadow: hasTargets ? "var(--hyeni-theme-shadow-soft)" : "none",
                fontFamily: FF,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 14, background: "rgba(255,255,255,0.86)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.7)" }}>
                        <ThreeDIcon name="phone-lavender" size={28} aria-label="전화" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.15, color: hasTargets ? "var(--theme-accent-text)" : "#9CA3AF" }}>부모님께 전화하기</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: hasTargets ? "var(--fg-secondary)" : "#9CA3AF", marginTop: 3 }}>
                            {hasTargets ? "엄마 · 아빠" : "연락처 없음"}
                        </div>
                    </div>
                </div>
                {hasTargets && (
                    <div style={{ padding: "5px 9px", borderRadius: 999, background: "rgba(255,255,255,0.72)", color: "var(--theme-accent-text)", fontSize: 10, fontWeight: 900, whiteSpace: "nowrap" }}>
                        바로 연결
                    </div>
                )}
            </div>
            {hasTargets ? (
                <div style={{ display: "grid", gridTemplateColumns: targets.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 10, width: "100%" }}>
                    {targets.map(target => (
                        <a
                            key={target.key}
                            href={`tel:${target.number}`}
                            aria-label={`${target.label}에게 전화`}
                            style={{
                                minHeight: 58,
                                padding: "10px 12px",
                                borderRadius: 18,
                                background: target.bg,
                                color: target.color,
                                textDecoration: "none",
                                fontSize: 15,
                                fontWeight: 900,
                                boxShadow: "0 8px 18px rgba(15,23,42,0.08), inset 0 0 0 1px rgba(255,255,255,0.9)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 7,
                                minWidth: 0,
                                boxSizing: "border-box",
                            }}
                        >
                            <ThreeDIcon name={target.iconName} size={32} aria-label="" />
                            <span style={{ lineHeight: 1.1, wordBreak: "keep-all" }}>{target.label}</span>
                        </a>
                    ))}
                </div>
            ) : (
                <div style={{ minHeight: 58, borderRadius: 18, background: "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-tertiary)", fontSize: 13, fontWeight: 900 }}>
                    연락처 없음
                </div>
            )}
        </div>
    );
}
