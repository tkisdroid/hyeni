// src/components/alerts/UrgentAlertOverlay.jsx
// 긴급 알림 전체화면 — emergency/sos/danger_zone/danger_exit 타입에 자동 트리거.

import { HyeniMascot } from "../auth/HyeniMascot.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

const FF = "var(--font-sans)";

function relativeTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h < 12 ? "오전" : "오후";
    const hh = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    return `${ampm} ${hh}:${m}`;
}

function UrgentCard({ alert }) {
    const palette = alert.palette;
    return (
        <div
            style={{
                display: "flex",
                gap: 12,
                padding: "14px 14px",
                background: palette.bg,
                border: `1px solid ${palette.line}`,
                borderRadius: 22,
                alignItems: "flex-start",
            }}
        >
            <div style={{ flexShrink: 0 }}>
                <span aria-hidden="true" style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: "#FFFFFF",
                    border: `2px solid ${palette.line}`,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22,
                }}>👧</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: 999,
                    background: palette.tagBg,
                    color: palette.tagFg,
                    fontSize: 11,
                    fontWeight: 900,
                    marginBottom: 6,
                }}>{alert.tag}</span>
                <div style={{
                    fontSize: 14.5,
                    fontWeight: 900,
                    color: "var(--fg-primary, #1F2A24)",
                    lineHeight: 1.4,
                    marginBottom: 6,
                    wordBreak: "keep-all",
                    overflowWrap: "break-word",
                }}>{alert.title}</div>
                {alert.subtitle && (
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-secondary, #5F6368)" }}>
                        {alert.subtitle}
                    </div>
                )}
            </div>
        </div>
    );
}

export function UrgentAlertOverlay({
    open,
    primaryAlert,
    extraAlerts = [],
    childName = "아이",
    batteryWarning = null,
    onShowLocation,
    onCall,
    onPushForce,
    onAcknowledge,
    onClose,
}) {
    if (!open || !primaryAlert) return null;
    const cards = [
        {
            tag: childName,
            title: primaryAlert.title || primaryAlert.message || "긴급 상황이 발생했어요",
            subtitle: `${relativeTime(primaryAlert.created_at)}${primaryAlert.location ? ` · 📍 ${primaryAlert.location}` : ""}`,
            palette: { bg: "var(--brand-rose-soft, #FFE2EC)", line: "var(--brand-rose-line, #FFD0DD)", tagBg: "var(--brand-rose, #F779A8)", tagFg: "#FFFFFF" },
        },
        ...extraAlerts.slice(0, 1).map(a => ({
            tag: a.tag || "알림",
            title: a.title || a.message || "추가 알림",
            subtitle: `${relativeTime(a.created_at)}${a.location ? ` · 📍 ${a.location}` : ""}`,
            palette: { bg: "#FFF3C7", line: "rgba(255,215,106,0.45)", tagBg: "#FFD76A", tagFg: "#9A6500" },
        })),
    ];
    return (
        <div
            role="alertdialog"
            aria-modal="true"
            aria-label="긴급 알림"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 900,
                background: "rgba(31, 24, 28, 0.6)",
                display: "flex",
                alignItems: "stretch",
                justifyContent: "center",
                padding: "calc(env(safe-area-inset-top, 0px) + 14px) 12px calc(env(safe-area-inset-bottom, 0px) + 14px)",
                fontFamily: FF,
                overflow: "auto",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: 380,
                    background: "linear-gradient(180deg, #FFFDF8 0%, #FFFFFF 100%)",
                    borderRadius: 32,
                    boxShadow: "0 30px 60px rgba(31,24,28,0.25)",
                    padding: "20px 18px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
                    <span aria-hidden="true" style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 96, height: 96, borderRadius: "50%",
                        background: "var(--brand-rose-soft, #FFE2EC)",
                        boxShadow: "0 10px 24px rgba(247,121,168,0.28)",
                        fontSize: 64,
                    }}>🛡️</span>
                    <div style={{
                        position: "relative",
                        width: 80, height: 80,
                        borderRadius: "50%",
                        overflow: "hidden",
                        background: "var(--brand-rose-soft, #FFE2EC)",
                        marginLeft: -8,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                        <HyeniMascot variant="thinking" size={88} aria-label="" />
                        <span aria-hidden="true" style={{ position: "absolute", top: 6, right: 4, width: 18, height: 18, borderRadius: "50%", background: "var(--brand-rose, #F779A8)", color: "#FFFFFF", fontSize: 11, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>!</span>
                    </div>
                </div>

                <div style={{ textAlign: "center" }}>
                    <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, color: "var(--status-negative, #DC2626)", letterSpacing: 0 }}>긴급 알림</h1>
                    <p style={{ margin: "6px 0 10px", fontSize: 13, fontWeight: 700, color: "var(--fg-secondary, #5F6368)" }}>바로 확인이 필요한 상황이에요</p>
                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 16px",
                        borderRadius: 999,
                        background: "var(--brand-rose, #F779A8)",
                        color: "#FFFFFF",
                        fontSize: 12.5,
                        fontWeight: 900,
                    }}>● 즉시 확인</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {cards.map((c, i) => <UrgentCard key={i} alert={c} />)}
                </div>

                {batteryWarning && (
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        background: "var(--brand-mint-soft, #DDF7EA)",
                        border: "1px solid var(--brand-mint-line, #BCEBD8)",
                        borderRadius: 16,
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--fg-primary, #1F2A24)",
                    }}>
                        <span aria-hidden="true" style={{ fontSize: 18 }}>🔋</span>
                        <span style={{ flex: 1 }}>{batteryWarning}</span>
                    </div>
                )}

                {typeof onShowLocation === "function" && (
                    <button
                        type="button"
                        onClick={onShowLocation}
                        style={{
                            height: 52,
                            borderRadius: 18,
                            border: "none",
                            background: "linear-gradient(135deg, var(--brand-rose, #F779A8) 0%, #E55A8C 100%)",
                            color: "#FFFFFF",
                            fontSize: 16,
                            fontWeight: 900,
                            cursor: "pointer",
                            fontFamily: FF,
                            boxShadow: "0 10px 22px rgba(247,121,168,0.32)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                        }}
                    >
                        <ThreeDIcon name="pin-heart" size={20} aria-label="" /> 지금 위치 보기 ›
                    </button>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {typeof onCall === "function" && (
                        <button
                            type="button"
                            onClick={onCall}
                            style={{
                                height: 46,
                                borderRadius: 16,
                                border: "1px solid var(--brand-rose-line, #FFD0DD)",
                                background: "var(--brand-rose-soft, #FFE2EC)",
                                color: "var(--brand-rose-text, #B83262)",
                                fontSize: 13.5,
                                fontWeight: 900,
                                cursor: "pointer",
                                fontFamily: FF,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                            }}
                        >
                            <span aria-hidden="true">📞</span> 전화하기
                        </button>
                    )}
                    {typeof onPushForce === "function" && (
                        <button
                            type="button"
                            onClick={onPushForce}
                            style={{
                                height: 46,
                                borderRadius: 16,
                                border: "1px solid var(--brand-mint-line, #BCEBD8)",
                                background: "var(--brand-mint-soft, #DDF7EA)",
                                color: "var(--brand-mint-text, #087653)",
                                fontSize: 13.5,
                                fontWeight: 900,
                                cursor: "pointer",
                                fontFamily: FF,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                            }}
                        >
                            <span aria-hidden="true">📣</span> 강제 알림 보내기
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onAcknowledge || onClose}
                    style={{
                        height: 44,
                        borderRadius: 16,
                        border: "1px solid var(--line-soft, #F1ECEE)",
                        background: "#FFFFFF",
                        color: "var(--fg-secondary, #5F6368)",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: "pointer",
                        fontFamily: FF,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                    }}
                >
                    <span aria-hidden="true">✓</span> 확인했어요
                </button>
                <p style={{ margin: 0, textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "var(--fg-tertiary, #9A9AA0)" }}>
                    🔒 이 화면은 부모님 모드에서만 표시됩니다
                </p>
            </div>
        </div>
    );
}
