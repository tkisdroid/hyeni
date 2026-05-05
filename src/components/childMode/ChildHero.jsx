// src/components/childMode/ChildHero.jsx
// Phase 3 spec section 4.2 — 자녀 홈 hero (mascot + 동적 copy).
// 일정 수에 따라 hero copy 자동 분기 — "오늘 뭐 해?" / "{N}개 일정 있어" / "자유시간!"

import { HyeniMascot } from "../auth/HyeniMascot.jsx";

function pickHeroCopy(eventCount) {
    if (eventCount === 0) return { title: "오늘은 자유시간!", sub: "마음껏 놀아도 돼" };
    if (eventCount === 1) return { title: "오늘 1개 일정 있어", sub: "준비됐어?" };
    return { title: `오늘 뭐 해?`, sub: `${eventCount}개 일정 있어` };
}

function formatNowTime(now = new Date()) {
    const h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    const period = h < 12 ? "오전" : "오후";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${period} ${display}시 ${m}분`;
}

export function ChildHero({ eventCount = 0, showMascot = true, onSettings, now = new Date() }) {
    const { title, sub } = pickHeroCopy(eventCount);
    const timeLabel = formatNowTime(now);

    return (
        <header className="child-hero" style={{ position: "relative" }}>
            {showMascot && (
                <div className="child-hero-mascot">
                    <HyeniMascot size={88} variant="static" />
                </div>
            )}
            <div className="child-hero-body">
                <h1 className="t-child-hero-title">{title}</h1>
                <p className="t-child-hero-sub">{sub} · {timeLabel}</p>
            </div>
            {typeof onSettings === "function" && (
                <button
                    type="button"
                    onClick={onSettings}
                    aria-label="설정"
                    style={{
                        position: "absolute",
                        top: "var(--space-3)",
                        right: "var(--space-3)",
                        width: 36, height: 36,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--theme-accent-line)",
                        background: "var(--bg-base)",
                        cursor: "pointer",
                        fontSize: 16,
                        color: "var(--fg-secondary)",
                        fontFamily: "inherit",
                    }}
                >
                    ⚙
                </button>
            )}
        </header>
    );
}
