// src/components/childMode/ChildHero.jsx
// Phase 3 spec section 4.2 — 자녀 홈 hero (mascot + 동적 copy).
// 일정 수에 따라 hero copy/mascot 자동 분기 — 0개 = cheer, 1+ = wave.

import { getThemeColors } from "../../lib/theme.js";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";
import { AnimalIcon } from "../icons/AnimalIcon.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

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

export function ChildHero({ eventCount = 0, showMascot = true, onSettings, now = new Date(), colorHex = null, animalEmoji = "🐰" }) {
    const { title, sub } = pickHeroCopy(eventCount);
    const timeLabel = formatNowTime(now);
    const mascotVariant = eventCount === 0 ? "cheer" : "wave";
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
                    <HyeniMascot variant={mascotVariant} size={112} aria-label="혜니" />
                    <span
                        style={{
                            position: "absolute",
                            right: -4,
                            bottom: 4,
                            width: 42,
                            height: 42,
                            borderRadius: "var(--radius-full)",
                            background: "#FFFFFF",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 6px 14px rgba(31, 24, 28, 0.12)",
                            border: "1px solid var(--line-soft)",
                        }}
                    >
                        <AnimalIcon emoji={animalEmoji} size={32} aria-label={`${animalEmoji} 캐릭터`} />
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
                    <ThreeDIcon name="settings" size={22} aria-label="" />
                </button>
            )}
        </header>
    );
}
