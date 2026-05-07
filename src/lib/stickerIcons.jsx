// src/lib/stickerIcons.jsx
// Phase E (β2): emoji 문자열 → Lucide 컴포넌트 렌더링 매핑.
//
// 목적: 스티커 시스템·토스트·빈 상태 등에서 raw emoji 사용을 SVG 아이콘으로
//       시각 통일하면서 DB schema 와 prop interface 는 그대로 둔다 (호환성).
//       매핑 안 된 emoji 는 raw 그대로 fallback 렌더 → 미래 emoji 추가 시
//       즉시 안 깨지고 점진적으로 매핑 확장 가능.
//
// CLAUDE.md rule 1: 색은 currentColor / 토큰 prop 만 사용. hex 직접 사용 금지.

import {
    Heart, Star, Sparkles, Trophy, Target, Rainbow, Gift, Apple,
    Cookie, Cat, Dog, Rabbit, Flower2, Dumbbell, PartyPopper,
    ThumbsUp, Moon, Sun, Frown,
} from "lucide-react";

const ICON_MAP = {
    // 하트류 (강한 빨강 사용 OK 영역 — design_color_rules)
    "❤️": Heart, "❤": Heart, "♥": Heart, "💕": Heart, "💗": Heart, "💛": Heart,
    // 별/반짝
    "⭐": Star,
    "🌟": Sparkles, "✨": Sparkles,
    // 칭찬/격려
    "🏆": Trophy,
    "🎯": Target,
    "💪": Dumbbell,
    "👍": ThumbsUp,
    "🎉": PartyPopper,
    // 자연/감정
    "🌈": Rainbow,
    "🌸": Flower2,
    "🌙": Moon,
    "☀️": Sun, "☀": Sun,
    "😢": Frown,
    // 선물/음식
    "🎁": Gift,
    "🍎": Apple,
    "🍪": Cookie,
    // 동물 (스티커 후보 — brand 마스코트와 무관, 일반 fallback)
    "🐱": Cat,
    "🐶": Dog,
    "🐰": Rabbit,
};

export function StickerIcon({
    emoji,
    size = 22,
    color,
    fill,
    strokeWidth = 1.75,
    className,
    style,
    "aria-label": ariaLabel,
}) {
    const Icon = ICON_MAP[emoji];

    if (!Icon) {
        // 미매핑 emoji 는 raw 그대로 (호환성 유지 — DB 의 옛 row 표시 보장).
        return (
            <span
                className={className}
                style={{ fontSize: size, lineHeight: 1, display: "inline-block", ...style }}
                aria-label={ariaLabel || emoji}
            >
                {emoji}
            </span>
        );
    }

    return (
        <Icon
            size={size}
            color={color || "currentColor"}
            fill={fill}
            strokeWidth={strokeWidth}
            className={className}
            style={style}
            aria-label={ariaLabel || emoji}
        />
    );
}

export function hasIconFor(emoji) {
    return Object.prototype.hasOwnProperty.call(ICON_MAP, emoji);
}
