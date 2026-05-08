// src/components/multichild/HomeDashboard/NextEventHero.jsx
// 부모 홈 다음 일정 HERO 카드 — 빈 공간을 prominent visual anchor 로 채움.
// 큰 시간 + N분 후 카운트다운 + 자녀 컬러 라인 + 자녀명/위치 inline.

import { pickNextEvent, formatTimeLabel } from "./HomeBigStat.jsx";

function formatCountdown(minutesRemaining) {
    if (!Number.isFinite(minutesRemaining) || minutesRemaining < 0) return null;
    if (minutesRemaining < 1) return "곧 시작";
    if (minutesRemaining < 60) return `${minutesRemaining}분 후`;
    const hours = Math.floor(minutesRemaining / 60);
    const mins = minutesRemaining % 60;
    if (mins === 0) return `${hours}시간 후`;
    return `${hours}시간 ${mins}분 후`;
}

function eventChildIds(event) {
    if (!event) return [];
    if (Array.isArray(event.child_ids) && event.child_ids.length > 0) return event.child_ids;
    return [];
}

function pickEventChildren(event, children) {
    if (!Array.isArray(children) || children.length === 0) return [];
    if (event?.is_family_event) return children;
    const ids = eventChildIds(event);
    if (ids.length === 0) return [];
    return ids.map((id) => children.find((c) => c.id === id)).filter(Boolean);
}

function shortenLocation(label) {
    const raw = String(label || "").trim().replace(/\s+/g, " ");
    if (!raw) return "";
    const parts = raw.split(" ");
    if (parts.length <= 2) return raw;
    return parts.slice(0, 2).join(" ");
}

export function NextEventHero({ events, children = [], childLocations = {}, now = new Date() }) {
    const next = pickNextEvent(events, now);

    if (!next) {
        return (
            <div className="hyeni-hero-empty">
                <span className="hyeni-hero-eyebrow">오늘의 다음 일정</span>
                <p className="hyeni-hero-empty-msg">오늘 일정 모두 마무리됐어요 ✨</p>
            </div>
        );
    }

    const [h, m] = next.time.split(":").map(Number);
    const eventMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const countdown = formatCountdown(eventMinutes - nowMinutes);

    const eventChildren = pickEventChildren(next, children);
    const isFamily = !!next.is_family_event;
    const primaryChild = eventChildren[0] || null;
    const accent = isFamily
        ? "var(--theme-accent)"
        : (primaryChild?.color_hex || "var(--theme-accent)");
    const childLabel = isFamily
        ? "가족 전체"
        : eventChildren.map((c) => c.name).join(", ") || "—";
    const locationLabel = primaryChild
        ? shortenLocation(childLocations[primaryChild.user_id]?.label)
        : "";

    return (
        <div
            className="hyeni-hero-next"
            style={{ borderInlineStartColor: accent }}
            role="group"
            aria-label="다음 일정"
        >
            <div className="hyeni-hero-head">
                <span className="hyeni-hero-eyebrow">다음 일정</span>
                {countdown && <span className="hyeni-hero-countdown">{countdown}</span>}
            </div>
            <div className="hyeni-hero-time">
                <span className="hyeni-hero-time-clock">{formatTimeLabel(next.time)}</span>
            </div>
            <div className="hyeni-hero-title">
                {next.emoji ? <span className="hyeni-hero-emoji" aria-hidden="true">{next.emoji}</span> : null}
                <span>{next.title}</span>
            </div>
            <div className="hyeni-hero-meta">
                <span
                    className="hyeni-hero-child-dot"
                    style={{ background: accent }}
                    aria-hidden="true"
                />
                <span className="hyeni-hero-child-name">{childLabel}</span>
                {locationLabel ? (
                    <>
                        <span className="hyeni-hero-meta-sep" aria-hidden="true">·</span>
                        <span className="hyeni-hero-meta-location">📍 {locationLabel}</span>
                    </>
                ) : null}
            </div>
        </div>
    );
}
