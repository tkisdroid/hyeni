// src/components/multichild/HomeDashboard/HomeGreeting.jsx
// 부모 홈 상단 시간대별 인사 카드.
// PairingWizard의 mascot intro 패턴 재활용 — 부모 톤(존댓말).

import { HyeniMascot } from "../../auth/HyeniMascot.jsx";

const STYLE_WRAP = {
    display: "flex",
    gap: "var(--space-3)",
    alignItems: "flex-start",
};
const STYLE_AVATAR = {
    width: 56,
    height: 56,
    background: "var(--cartoon-bg-chip)",
    border: "1px solid var(--cartoon-line)",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "flex-end",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
};
const STYLE_BUBBLE = {
    flex: 1,
    minWidth: 0,
    position: "relative",
    background: "var(--cartoon-rose-soft)",
    border: "1px solid var(--cartoon-rose)",
    borderRadius: "var(--cartoon-radius-card)",
    padding: "var(--space-3) var(--space-4)",
};
const STYLE_BUBBLE_TAIL = {
    position: "absolute",
    left: -6,
    top: 18,
    width: 11,
    height: 11,
    background: "var(--cartoon-rose-soft)",
    borderLeft: "1px solid var(--cartoon-rose)",
    borderBottom: "1px solid var(--cartoon-rose)",
    transform: "rotate(45deg)",
};
const STYLE_TITLE = {
    margin: 0,
    fontSize: 16,
    fontWeight: "var(--weight-bold)",
    color: "var(--cartoon-rose-text)",
    lineHeight: "var(--leading-tight)",
    letterSpacing: 0,
};
const STYLE_SUBTITLE = {
    margin: "var(--space-1) 0 0",
    fontSize: 12,
    color: "var(--fg-secondary)",
    lineHeight: "var(--leading-normal)",
    fontWeight: "var(--weight-medium)",
};

function pickGreeting(now) {
    const h = now.getHours();
    if (h >= 5 && h < 11) return { variant: "wave", title: "좋은 아침이에요", subtitle: "오늘 하루도 화이팅이에요" };
    if (h >= 11 && h < 18) return { variant: "static", title: "오늘도 수고 많으세요", subtitle: "오늘 일정 빠진 거 없는지 살펴봐요" };
    if (h >= 18 && h < 23) return { variant: "static", title: "오늘 하루 수고하셨어요", subtitle: "내일 일정도 한번 확인해봐요" };
    return { variant: "static", title: "푹 쉬세요", subtitle: "내일 일정은 잠시 후에 챙겨도 돼요" };
}

export function HomeGreeting({ familyName, now = new Date() }) {
    const g = pickGreeting(now);
    const headline = familyName ? `${familyName}, ${g.title}` : g.title;
    return (
        <div role="presentation" style={STYLE_WRAP}>
            <div style={STYLE_AVATAR}>
                <HyeniMascot size={48} variant={g.variant} aria-label="혜니" />
            </div>
            <div style={STYLE_BUBBLE}>
                <span aria-hidden="true" style={STYLE_BUBBLE_TAIL} />
                <h2 style={STYLE_TITLE}>{headline}</h2>
                <p style={STYLE_SUBTITLE}>{g.subtitle}</p>
            </div>
        </div>
    );
}
