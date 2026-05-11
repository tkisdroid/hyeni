// src/components/multichild/HomeDashboard/HomeGreeting.jsx
// 부모 홈 상단 인사 — Minimal-Pro 톤 (Notion Calendar / Fantastical / Cron 류).
// 큰 monochrome typo + 작은 sub line. 마스코트는 trailing 32px(칩 없이).

import { HyeniMascot } from "../../auth/HyeniMascot.jsx";

const STYLE_WRAP = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-3)",
};
const STYLE_TEXT = { flex: 1, minWidth: 0 };
const STYLE_HEADLINE = {
    margin: 0,
    fontSize: 22,
    fontWeight: "var(--weight-bold)",
    color: "var(--fg-primary)",
    lineHeight: "var(--leading-tight)",
    letterSpacing: 0,
};
const STYLE_SUBLINE = {
    margin: "var(--space-1) 0 0",
    fontSize: 13,
    color: "var(--fg-tertiary)",
    fontWeight: "var(--weight-medium)",
    lineHeight: "var(--leading-normal)",
};
const STYLE_MASCOT = { flexShrink: 0, opacity: 0.9 };

function pickGreeting(now) {
    const h = now.getHours();
    if (h >= 5 && h < 11) return { variant: "wave", title: "좋은 아침이에요" };
    if (h >= 11 && h < 18) return { variant: "static", title: "오늘도 수고 많으세요" };
    if (h >= 18 && h < 23) return { variant: "static", title: "오늘 하루 수고하셨어요" };
    return { variant: "static", title: "푹 쉬세요" };
}

function formatDate(d) {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
}

export function HomeGreeting({ familyName, now = new Date() }) {
    const g = pickGreeting(now);
    const headline = familyName ? `${familyName}, ${g.title}` : g.title;
    return (
        <div role="presentation" style={STYLE_WRAP}>
            <div style={STYLE_TEXT}>
                <h2 style={STYLE_HEADLINE}>{headline}</h2>
                <p style={STYLE_SUBLINE}>{formatDate(now)}</p>
            </div>
            <div style={STYLE_MASCOT} aria-hidden="true">
                <HyeniMascot size={32} variant={g.variant} aria-label="" />
            </div>
        </div>
    );
}
