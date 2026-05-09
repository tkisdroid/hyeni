// src/components/icons/ThreeDIcon.jsx
// Generic 3D UI icon (bell / heart / pin / shield / calendar-heart /
// calendar-check). Falls back to an emoji glyph when name is unknown.
// Phase 07 Step 5 — 3D asset migration.

import bellIcon from "../../assets/3d/ui/bell.webp";
import heartIcon from "../../assets/3d/ui/heart.webp";
import pinIcon from "../../assets/3d/ui/pin.webp";
import pinHeartIcon from "../../assets/3d/ui/pin-heart.webp";
import shieldIcon from "../../assets/3d/ui/shield.webp";
import calendarHeartIcon from "../../assets/3d/ui/calendar-heart.webp";
import calendarCheckIcon from "../../assets/3d/ui/calendar-check.webp";

const SOURCES = {
    bell: bellIcon,
    heart: heartIcon,
    pin: pinIcon,
    "pin-heart": pinHeartIcon,
    shield: shieldIcon,
    "calendar-heart": calendarHeartIcon,
    "calendar-check": calendarCheckIcon,
};

const FALLBACK_EMOJI = {
    bell: "🔔",
    heart: "💗",
    pin: "📍",
    "pin-heart": "📍",
    shield: "🛡️",
    "calendar-heart": "📅",
    "calendar-check": "✅",
};

export function ThreeDIcon({
    name,
    size = 24,
    className = "",
    "aria-label": ariaLabel,
}) {
    const src = SOURCES[name];
    const label = ariaLabel ?? name;

    if (!src) {
        const fallbackEmoji = FALLBACK_EMOJI[name] ?? "✨";
        return (
            <span
                role="img"
                aria-label={label}
                className={className}
                style={{
                    fontSize: size,
                    lineHeight: 1,
                    display: "inline-block",
                    width: size,
                    height: size,
                    textAlign: "center",
                }}
            >
                {fallbackEmoji}
            </span>
        );
    }

    return (
        <img
            src={src}
            width={size}
            height={size}
            alt={label}
            className={className}
            draggable={false}
            style={{
                width: size,
                height: size,
                objectFit: "contain",
                userSelect: "none",
                verticalAlign: "middle",
            }}
        />
    );
}
