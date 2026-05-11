// src/components/alerts/AlertCenterPopup.jsx
// 알림 센터 팝업 — 일반(non-emergency) 알림 modal.
// 디자인: 종 + 혜니 캐릭터 hero, 알림 카드 리스트, 모두 확인 + 자세히 보기 + 닫기.

import { HyeniMascot } from "../auth/HyeniMascot.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

const FF = "var(--font-sans)";

const TYPE_META = {
    arrived:        { label: "도착",   color: "mint",     icon: "pin-heart" },
    not_arrived:    { label: "일정",   color: "lavender", icon: "clock" },
    event_reminder: { label: "일정",   color: "lavender", icon: "calendar-heart" },
    academy_focus:  { label: "주의",   color: "yellow",   icon: "warning" },
    danger_zone:    { label: "위치",   color: "rose",     icon: "pin-heart" },
    danger_exit:    { label: "이탈",   color: "rose",     icon: "pin-heart" },
    memo_emotional: { label: "리포트", color: "lavender", icon: "chat-heart" },
    safe:           { label: "안전",   color: "mint",     icon: "safety-mascot" },
};

const TAG_PALETTES = {
    mint:     { bg: "var(--brand-mint-soft, #DDF7EA)",     fg: "var(--brand-mint-text, #087653)" },
    lavender: { bg: "var(--brand-lavender-soft, #EFE8FF)", fg: "var(--brand-lavender-text, #5F43B2)" },
    rose:     { bg: "var(--brand-rose-soft, #FFE2EC)",     fg: "var(--brand-rose-text, #B83262)" },
    yellow:   { bg: "#FFF3C7",                              fg: "#9A6500" },
};

function relativeTimeShort(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h < 12 ? "오전" : "오후";
    const hh = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    return `${ampm} ${hh}:${m}`;
}

function AlertItem({ alert }) {
    const meta = TYPE_META[alert.alert_type] || { label: alert.alert_type || "알림", color: "lavender", icon: "chat-heart" };
    const palette = TAG_PALETTES[meta.color] || TAG_PALETTES.lavender;
    return (
        <article
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 14px 14px 12px",
                background: alert.read ? "#FAFAFB" : "#FFFFFF",
                border: "1px solid var(--line-soft, #F1ECEE)",
                borderRadius: 18,
                boxShadow: alert.read ? "none" : "0 4px 12px rgba(31,24,28,0.04)",
            }}
        >
            <span
                aria-hidden="true"
                style={{
                    flexShrink: 0,
                    width: 44, height: 44,
                    borderRadius: 14,
                    background: palette.bg,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <ThreeDIcon name={meta.icon} size={28} aria-label="" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <span
                    style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: palette.bg,
                        color: palette.fg,
                        fontSize: 10.5,
                        fontWeight: 800,
                        marginBottom: 4,
                    }}
                >
                    {meta.label}
                </span>
                <div
                    style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: "var(--fg-primary, #1F2A24)",
                        lineHeight: 1.4,
                        wordBreak: "keep-all",
                        overflowWrap: "break-word",
                    }}
                >
                    {alert.title || alert.message || "알림"}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--fg-tertiary, #9A9AA0)", marginTop: 4 }}>
                    <span aria-hidden="true">🕐</span>
                    {relativeTimeShort(alert.created_at)}
                </div>
            </div>
        </article>
    );
}

export function AlertCenterPopup({
    open,
    alerts = [],
    onClose,
    onMarkAllRead,
    onOpenDetails,
}) {
    if (!open) return null;
    const list = Array.isArray(alerts) ? alerts.slice(0, 6) : [];
    const unreadCount = list.filter(a => !a.read).length;
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="알림 센터"
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 700,
                background: "rgba(31, 24, 28, 0.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                fontFamily: FF,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: 360,
                    maxHeight: "92vh",
                    overflow: "auto",
                    background: "linear-gradient(180deg, #FFFDF8 0%, #FFFFFF 100%)",
                    borderRadius: 32,
                    boxShadow: "0 20px 50px rgba(31, 24, 28, 0.2)",
                    padding: "8px 16px 18px",
                    position: "relative",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 4 }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                        <span aria-hidden="true" style={{ fontSize: 56, lineHeight: 1, filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.08))" }}>🔔</span>
                        {unreadCount > 0 && (
                            <span style={{ position: "absolute", top: -2, right: -4, minWidth: 22, height: 22, padding: "0 6px", borderRadius: 999, background: "var(--brand-rose, #F779A8)", color: "#FFFFFF", fontSize: 11, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid #FFFFFF" }}>
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        overflow: "hidden",
                        background: "var(--brand-rose-soft, #FFE2EC)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 10px rgba(247,121,168,0.18)",
                    }}>
                        <HyeniMascot variant="winkStar" size={72} aria-label="" />
                    </div>
                </div>
                <h2 style={{ margin: "6px 0 0", textAlign: "center", fontSize: 28, fontWeight: 900, color: "var(--brand-rose-text, #B83262)", letterSpacing: 0 }}>알림 센터</h2>
                <p style={{ margin: "4px 0 14px", textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "var(--fg-tertiary, #9A9AA0)" }}>
                    오늘 도착 및 일정 알림을 확인해 보세요
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                    {list.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px 8px", color: "var(--fg-tertiary, #9A9AA0)", fontSize: 13, fontWeight: 700 }}>
                            새 알림이 없어요 ✨
                        </div>
                    ) : list.map(a => <AlertItem key={a.id} alert={a} />)}
                </div>

                <button
                    type="button"
                    onClick={onMarkAllRead}
                    disabled={unreadCount === 0}
                    style={{
                        width: "100%",
                        height: 48,
                        borderRadius: 16,
                        border: "none",
                        background: unreadCount === 0 ? "var(--bg-muted)" : "linear-gradient(135deg, var(--brand-mint, #31C48D) 0%, var(--brand-mint-deep, #15936B) 100%)",
                        color: unreadCount === 0 ? "var(--fg-tertiary, #9A9AA0)" : "#FFFFFF",
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: unreadCount === 0 ? "default" : "pointer",
                        fontFamily: FF,
                        boxShadow: unreadCount === 0 ? "none" : "0 8px 18px rgba(49,196,141,0.28)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        marginBottom: 8,
                    }}
                >
                    <span aria-hidden="true">✓</span> 모두 확인
                </button>
                {typeof onOpenDetails === "function" && (
                    <button
                        type="button"
                        onClick={onOpenDetails}
                        style={{
                            width: "100%",
                            height: 44,
                            borderRadius: 16,
                            border: "1px solid var(--brand-rose-line, #FFD0DD)",
                            background: "var(--brand-rose-soft, #FFE2EC)",
                            color: "var(--brand-rose-text, #B83262)",
                            fontSize: 14,
                            fontWeight: 900,
                            cursor: "pointer",
                            fontFamily: FF,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            marginBottom: 6,
                        }}
                    >
                        <span aria-hidden="true">≡</span> 자세히 보기
                    </button>
                )}
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        width: "100%",
                        height: 36,
                        background: "transparent",
                        border: "none",
                        color: "var(--fg-tertiary, #9A9AA0)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: FF,
                    }}
                >
                    닫기
                </button>
            </div>
        </div>
    );
}
