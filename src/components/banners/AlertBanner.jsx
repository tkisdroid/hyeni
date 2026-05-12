// src/components/banners/AlertBanner.jsx
// Top-stacked alert banner (parent/child/friend/emergency/sync 알림).
// Extracted from App.jsx (Phase 5 #4 / B2).
//
// Props:
//   alerts: { id, type: "parent"|"child"|"friend"|"emergency"|"sync", msg }[]
//   onDismiss: (id) => void

import { DESIGN, FF } from "../../lib/styleHelpers.js";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

const BG = {
    parent: DESIGN.gradients.parent,
    child: DESIGN.gradients.primary,
    friend: "linear-gradient(135deg,#059669,var(--status-positive))",
    emergency: DESIGN.gradients.danger,
    sync: "linear-gradient(135deg,#0369A1,#0EA5E9)",
};
const ICON = { parent: "friend-pair", child: "heart", friend: "friend-pair", emergency: "sos-shield", sync: "calendar-check" };
const LABEL = { parent: "부모님 알림", child: "아이 알림", friend: "친구 알림", emergency: "긴급 미도착", sync: "일정 동기화" };

export function AlertBanner({ alerts, onDismiss }) {
    if (!alerts.length) return null;
    const hasEmergency = alerts.some(a => a.type === "emergency");
    const title = hasEmergency ? "긴급 알림" : "일반 알림";
    const subtitle = hasEmergency ? "바로 확인이 필요한 알림이에요" : "놓치지 않게 팝업으로 알려드려요";
    const role = hasEmergency ? "alertdialog" : "dialog";
    const ariaLabel = hasEmergency ? "긴급 알림 팝업" : "일반 알림 팝업";
    const accent = hasEmergency
        ? {
            bg: "rgba(127, 29, 29, 0.46)",
            cardBorder: "var(--status-negative-subtle)",
            title: "var(--status-negative-strong)",
            chipBg: "var(--status-negative-subtle)",
            chipFg: "var(--status-negative-strong)",
            heroIcon: "sos-shield",
            mascot: "thinking",
        }
        : {
            bg: "rgba(31, 24, 28, 0.38)",
            cardBorder: "var(--theme-accent-line)",
            title: "var(--theme-accent-text)",
            chipBg: "var(--theme-accent-soft)",
            chipFg: "var(--theme-accent-text)",
            heroIcon: "bell",
            mascot: "winkStar",
        };

    return (
        <div
            role={role}
            aria-modal="true"
            aria-label={ariaLabel}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: hasEmergency ? 860 : 520,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "calc(env(safe-area-inset-top, 0px) + 18px) 16px calc(env(safe-area-inset-bottom, 0px) + 18px)",
                background: accent.bg,
                backdropFilter: "blur(5px)",
                fontFamily: FF,
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: 380,
                    maxHeight: "88svh",
                    overflow: "auto",
                    border: `1px solid ${accent.cardBorder}`,
                    borderRadius: 28,
                    background: "linear-gradient(180deg, #FFFDF8 0%, #FFFFFF 100%)",
                    boxShadow: hasEmergency ? "0 28px 64px rgba(127,29,29,0.34)" : "0 22px 54px rgba(31,24,28,0.18)",
                    padding: "18px 16px 16px",
                    animation: hasEmergency ? "emergencyPulse 0.42s ease" : "slideUpCard 0.28s ease",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                    <span
                        aria-hidden="true"
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 22,
                            background: accent.chipBg,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <ThreeDIcon name={accent.heroIcon} size={46} aria-label="" />
                    </span>
                    <span
                        aria-hidden="true"
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: 24,
                            background: "var(--theme-accent-soft)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "visible",
                            flexShrink: 0,
                        }}
                    >
                        <HyeniMascot variant={accent.mascot} size={82} aria-label="" />
                    </span>
                </div>
                <div style={{ textAlign: "center", marginBottom: 14 }}>
                    <h2 style={{ margin: 0, color: accent.title, fontSize: 26, fontWeight: 900, letterSpacing: 0 }}>
                        {title}
                    </h2>
                    <p style={{ margin: "5px 0 0", color: "var(--fg-secondary)", fontSize: 13, fontWeight: 750, lineHeight: 1.45 }}>
                        {subtitle}
                    </p>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                    {alerts.map(a => (
                        <div
                            key={a.id}
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 11,
                                padding: "13px 12px",
                                borderRadius: 18,
                                border: `1px solid ${a.type === "emergency" ? "var(--status-negative-subtle)" : "var(--theme-accent-line)"}`,
                                background: "#FFFFFF",
                                boxShadow: "0 6px 16px rgba(31,24,28,0.06)",
                            }}
                        >
                            <span
                                aria-hidden="true"
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 14,
                                    background: a.type === "emergency" ? "var(--status-negative-subtle)" : accent.chipBg,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <ThreeDIcon name={ICON[a.type] || "bell"} size={28} aria-label="" />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        minHeight: 22,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        background: a.type === "emergency" ? "var(--status-negative-subtle)" : accent.chipBg,
                                        color: a.type === "emergency" ? "var(--status-negative-strong)" : accent.chipFg,
                                        fontWeight: 900,
                                        fontSize: 11,
                                        marginBottom: 5,
                                    }}
                                >
                                    {LABEL[a.type] || "알림"}
                                </div>
                                <div style={{ color: "var(--fg-primary)", fontSize: 13.5, fontWeight: 800, lineHeight: 1.45 }}>
                                    {a.msg}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onDismiss(a.id)}
                                style={{
                                    alignSelf: "center",
                                    minWidth: 52,
                                    height: 36,
                                    border: "none",
                                    borderRadius: 12,
                                    background: a.type === "emergency" ? "var(--status-negative-strong)" : (BG[a.type] || BG.parent),
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: 850,
                                    fontSize: 12,
                                    fontFamily: FF,
                                    flexShrink: 0,
                                }}
                            >
                                확인
                            </button>
                        </div>
                    ))}
                </div>

                {alerts.length > 1 && (
                    <button
                        type="button"
                        onClick={() => alerts.forEach(a => onDismiss(a.id))}
                        style={{
                            width: "100%",
                            height: 44,
                            marginTop: 12,
                            border: "1px solid var(--theme-accent-line)",
                            borderRadius: 14,
                            background: "var(--theme-accent-soft)",
                            color: "var(--theme-accent-text)",
                            cursor: "pointer",
                            fontWeight: 900,
                            fontSize: 13,
                            fontFamily: FF,
                        }}
                    >
                        모두 확인
                    </button>
                )}
            </div>
        </div>
    );
}
