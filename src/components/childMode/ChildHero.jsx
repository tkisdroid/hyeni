// src/components/childMode/ChildHero.jsx
// Phase 3 spec section 4.2 — 자녀 홈 hero (mascot + 동적 copy).
// 일정 수에 따라 hero copy 자동 분기 — "오늘 뭐 해?" / "{N}개 일정 있어" / "자유시간!"

import { getThemeColors } from "../../lib/theme.js";

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

export function ChildHero({ eventCount = 0, showMascot = true, characterEmoji = "🐰", onSettings, now = new Date(), colorHex = null }) {
    const { title, sub } = pickHeroCopy(eventCount);
    const timeLabel = formatNowTime(now);
    const displayCharacter = characterEmoji || "🐰";
    const palette = getThemeColors(colorHex);
    const heroStyle = {
        position: "relative",
        background: `linear-gradient(135deg, ${palette.soft} 0%, color-mix(in srgb, ${palette.accent} 8%, var(--bg-base)) 100%)`,
        borderColor: palette.line,
    };

    return (
        <header className="child-hero" role="region" aria-label="오늘은 뭐해?" style={heroStyle}>
            {showMascot && (
                <div className="child-hero-mascot">
                    <span className="child-hero-character" role="img" aria-label={`${displayCharacter} 캐릭터`}>
                        {displayCharacter}
                    </span>
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
                    className="btn-icon-circle"
                    style={{
                        position: "absolute",
                        top: "var(--space-3)",
                        right: "var(--space-3)",
                    }}
                >
                    ⚙
                </button>
            )}
        </header>
    );
}
