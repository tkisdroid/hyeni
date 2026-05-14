// src/components/childMode/ChildHero.jsx
// Phase 3 spec section 4.2 — 자녀 홈 hero (mascot + 동적 copy).
// 일정 수에 따라 hero copy/mascot 자동 분기 — 0개 = cheer, 1+ = wave.

import { getThemeColors } from "../../lib/theme.js";
import { HyeniMascot } from "../auth/HyeniMascot.jsx";
import { AnimalIcon } from "../icons/AnimalIcon.jsx";
import { ThreeDIcon } from "../icons/ThreeDIcon.jsx";

function pickHeroCopy(eventCount) {
    if (eventCount === 0) return { title: "오늘은 여유 있어요", sub: "오늘 등록된 일정이 없어요. 일정이 생기면 바로 알려줄게!" };
    if (eventCount === 1) return { title: "오늘 일정 1개", sub: "천천히 같이 챙겨볼까요?" };
    return { title: `오늘 일정 ${eventCount}개`, sub: "하나씩 같이 챙겨볼까요?" };
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
    const eventChipLabel = eventCount === 0 ? "일정 없음" : `일정 ${eventCount}개`;
    const palette = getThemeColors(colorHex);
    const heroStyle = {
        position: "relative",
        background: `linear-gradient(135deg, ${palette.soft} 0%, color-mix(in srgb, ${palette.accent} 8%, var(--bg-base)) 100%)`,
        borderColor: palette.line,
    };

    return (
        <header className="child-hero child-hero--friendly" role="region" aria-label="아이 홈 요약" style={heroStyle}>
            {showMascot && (
                <div className="child-hero-mascot hyeni-micro-icon">
                    <HyeniMascot variant={mascotVariant} size={148} aria-label="혜니" />
                    <span
                        className="child-hero-animal-badge"
                    >
                        <AnimalIcon emoji={animalEmoji} size={34} aria-label={`${animalEmoji} 캐릭터`} />
                    </span>
                </div>
            )}
            <div className="child-hero-body">
                <span className="child-hero-kicker">혜니랑 오늘 보기</span>
                <h1 className="t-child-hero-title">{title}</h1>
                <p className="t-child-hero-sub">{sub}</p>
                <div className="child-hero-status-row" aria-label={`현재 시간 ${timeLabel}, ${eventChipLabel}`}>
                    <span>지금 {timeLabel}</span>
                    <span>{eventChipLabel}</span>
                </div>
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
