// src/components/multichild/ChildDetail/ChildDetailScreen.jsx
// Phase 2 spec section 3.4 — 자녀 상세 통합 view (Life360식).
// 안전 dot 1초 약속 → 큰 지도 + trail dots → 일정 timeline → 안전 메트릭.

import { ChildAvatar } from "../HomeDashboard/ChildAvatar.jsx";
import { HomeBigStat } from "../HomeDashboard/HomeBigStat.jsx";
import { useBackHandler } from "../../../lib/backHandler.js";
import { ThreeDIcon } from "../../icons/ThreeDIcon.jsx";
import { HyeniMascot } from "../../auth/HyeniMascot.jsx";

const DOT_COLORS = {
    green: "var(--status-positive)",
    yellow: "var(--status-cautionary)",
    red: "var(--status-negative)",
};

function deriveStatusLabel(safetyDots, deviceStatus) {
    if (!safetyDots || safetyDots.length === 0) return { tone: "neutral", text: "기기 응답 없음" };
    if (safetyDots.includes("red")) {
        const cause = deviceStatus?.app_blocked
            ? "앱 차단"
            : deviceStatus?.last_seen_minutes_ago > 30
                ? "응답 없음"
                : "위험";
        return { tone: "negative", text: `위험 — ${cause}` };
    }
    if (safetyDots.includes("yellow")) {
        const cause = deviceStatus?.battery_low ? "배터리 부족" : "주의";
        return { tone: "cautionary", text: `주의 — ${cause}` };
    }
    return { tone: "positive", text: "오늘 정상" };
}

function formatScreenLabel(deviceStatus) {
    if (!deviceStatus) return null;
    const ms = Number(deviceStatus.screenOnMs);
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes}분`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

function formatLastSeen(minutes) {
    if (!Number.isFinite(minutes)) return "확인 불가";
    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${Math.round(minutes)}분 전`;
    return `${Math.floor(minutes / 60)}시간 전`;
}

export function ChildDetailScreen({ child, events = [], deviceStatus, locationLabel, onBack, onSettings }) {
    useBackHandler(() => {
        if (!child) return false;
        if (typeof onBack === "function") { onBack(); return true; }
        return false;
    });
    if (!child) return null;
    const safetyDots = deviceStatus
        ? [
              deviceStatus.battery_low ? "yellow" : "green",
              deviceStatus.last_seen_minutes_ago > 30 ? "red" : "green",
              deviceStatus.app_blocked ? "red" : "green",
          ]
        : [];
    const status = deriveStatusLabel(safetyDots, deviceStatus);
    const childEvents = events.filter((e) => {
        if (e?.is_family_event) return true;
        const ids = Array.isArray(e?.child_ids) ? e.child_ids : [];
        return ids.includes(child.id) || ids.includes(child.user_id);
    });
    const screenLabel = formatScreenLabel(deviceStatus) || "0분";
    const childColor = child.color_hex || "var(--theme-accent)";

    return (
        <div
            className="hyeni-child-detail-screen"
            style={{
                position: "fixed", inset: 0, zIndex: 400,
                background: "var(--cartoon-bg-cream)",
                display: "flex", flexDirection: "column",
                fontFamily: "var(--font-sans)",
            }}
        >
            {/* Sticky header */}
            <header
                style={{
                    background: "var(--cartoon-bg-card)",
                    padding: "calc(env(safe-area-inset-top, 0px) + var(--space-3)) var(--space-4) 0",
                    borderBottom: "1px solid var(--cartoon-line)",
                    flexShrink: 0,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", height: 56 }}>
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="뒤로"
                        className="btn-icon-circle"
                    >
                        ←
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flex: 1, justifyContent: "flex-start", marginLeft: "var(--space-2)" }}>
                        <ChildAvatar child={child} size={32} fontSize={14} />
                        <span style={{ fontSize: 17, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>{child.name}</span>
                    </div>
                    {typeof onSettings === "function" && (
                        <button
                            type="button"
                            onClick={() => onSettings(child)}
                            aria-label="자녀 설정"
                            className="btn-icon-circle"
                        >
                            <ThreeDIcon name="settings" size={20} aria-label="" />
                        </button>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) 0 var(--space-3)" }}>
                    <div style={{ display: "flex", gap: 4 }} aria-label="안전 상태">
                        {safetyDots.map((color, i) => (
                            <div
                                key={i}
                                style={{
                                    width: 8, height: 8,
                                    borderRadius: "var(--radius-full)",
                                    background: DOT_COLORS[color] || "var(--line-default)",
                                }}
                            />
                        ))}
                    </div>
                    <span
                        style={{
                            fontSize: 13,
                            fontWeight: "var(--weight-semibold)",
                            color:
                                status.tone === "positive"
                                    ? "var(--status-positive-strong)"
                                    : status.tone === "cautionary"
                                        ? "var(--status-cautionary-strong)"
                                        : status.tone === "negative"
                                            ? "var(--status-negative-strong)"
                                            : "var(--fg-secondary)",
                        }}
                    >
                        {status.text}
                    </span>
                </div>
            </header>

            {/* Body — scrollable */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 var(--space-4) var(--space-6)" }}>
                <div style={{ paddingTop: "var(--space-4)", paddingBottom: "var(--space-2)" }}>
                    <HomeBigStat events={childEvents} />
                </div>

                {/* Map placeholder — caller can wrap with real Kakao map. We show a styled placeholder if not provided. */}
                <section
                    style={{
                        height: "min(50vh, 320px)",
                        background: "linear-gradient(135deg, var(--cartoon-rose-soft) 0%, var(--cartoon-bg-card) 100%)",
                        borderRadius: "var(--cartoon-radius-card)",
                        marginBottom: "var(--space-2)",
                        position: "relative",
                        border: "1px solid var(--cartoon-line)",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--fg-tertiary)",
                        fontSize: 13,
                    }}
                    aria-label="자녀 위치 지도"
                >
                    {locationLabel ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <ThreeDIcon name="pin" size={16} aria-label="" /> {locationLabel}
                        </span>
                    ) : "위치 정보 없음 · 권한 확인"}
                </section>

                {/* 오늘 일정 */}
                <section style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-5)", borderTop: "1px solid var(--cartoon-line)" }}>
                    <h2 className="t-section-label">오늘 일정</h2>
                    {childEvents.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "var(--space-5) 0", color: "var(--fg-tertiary)", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <HyeniMascot variant="sad" size={64} aria-label="" />
                            오늘 일정이 없어요
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                            {childEvents.map((event) => (
                                <div
                                    key={event.id}
                                    style={{
                                        padding: "var(--space-3) var(--space-4)",
                                        borderLeft: `4px ${event.is_family_event ? "dashed" : "solid"} ${event.color || childColor}`,
                                        background: "var(--cartoon-bg-card)",
                                        borderRadius: "var(--cartoon-radius-card)",
                                        border: "1px solid var(--cartoon-line)",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", alignItems: "baseline" }}>
                                        <div style={{ fontSize: 14, fontWeight: "var(--weight-bold)", color: "var(--fg-primary)" }}>{event.title}</div>
                                        <div style={{ fontSize: 13, color: "var(--fg-secondary)" }}>{event.time}</div>
                                    </div>
                                    {event.is_family_event && (
                                        <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 2 }}>가족 전체</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* 안전 메트릭 */}
                <section style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-5)", borderTop: "1px solid var(--cartoon-line)" }}>
                    <h2 className="t-section-label">안전 메트릭</h2>
                    <div className="card">
                        <MetricRow label="배터리" value={deviceStatus?.battery_pct != null ? `${deviceStatus.battery_pct}%` : "—"} meta={deviceStatus?.battery_updated_minutes_ago != null ? formatLastSeen(deviceStatus.battery_updated_minutes_ago) : null} />
                        <MetricRow label="위치" value={locationLabel || "확인 불가"} meta={deviceStatus?.last_seen_minutes_ago != null ? `${formatLastSeen(deviceStatus.last_seen_minutes_ago)} 갱신` : null} />
                        <MetricRow label="화면" value={screenLabel} meta="오늘" />
                    </div>
                </section>
            </div>
        </div>
    );
}

function MetricRow({ label, value, meta }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "baseline",
                gap: "var(--space-3)",
                padding: "var(--space-3) var(--space-4)",
                borderBottom: "1px solid var(--cartoon-line)",
            }}
        >
            <span style={{ fontSize: 12, color: "var(--fg-secondary)", width: 60, flexShrink: 0, fontWeight: "var(--weight-semibold)" }}>{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-primary)", fontWeight: "var(--weight-medium)", flex: 1 }}>{value}</span>
            {meta && <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>{meta}</span>}
        </div>
    );
}
