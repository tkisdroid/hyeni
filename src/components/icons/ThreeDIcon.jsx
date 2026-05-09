// src/components/icons/ThreeDIcon.jsx
// Generic 3D UI icon (bell / heart / pin / shield / calendar-heart /
// calendar-check). Falls back to an emoji glyph when name is unknown.
// Phase 07 Step 5 — 3D asset migration.

import bellIcon from "../../assets/3d/ui/bell.webp";
import heartIcon from "../../assets/3d/ui/heart.webp";
import pinIcon from "../../assets/3d/ui/pin.webp";
import pinHeartIcon from "../../assets/3d/ui/pin-heart.webp";
import pinLavenderIcon from "../../assets/3d/ui/pin-lavender.webp";
import shieldIcon from "../../assets/3d/ui/shield.webp";
import shieldHeartIcon from "../../assets/3d/ui/shield-heart.webp";
import calendarHeartIcon from "../../assets/3d/ui/calendar-heart.webp";
import calendarCheckIcon from "../../assets/3d/ui/calendar-check.webp";
import checkIcon from "../../assets/3d/ui/check.webp";
import noteIcon from "../../assets/3d/ui/note.webp";
import chatHeartIcon from "../../assets/3d/ui/chat-heart.webp";
import friendIcon from "../../assets/3d/category/friend.webp";
import crownIcon from "../../assets/3d/ui/crown.webp";
import crownBadgeIcon from "../../assets/3d/ui/crown-badge.webp";
import starMedalIcon from "../../assets/3d/ui/star-medal.webp";
import starFaceIcon from "../../assets/3d/ui/star-face.webp";
import safetyMascotIcon from "../../assets/3d/ui/safety-mascot.webp";
import sosShieldIcon from "../../assets/3d/ui/sos-shield.webp";

const SOURCES = {
    bell: bellIcon,
    heart: heartIcon,
    pin: pinIcon,
    "pin-heart": pinHeartIcon,
    "pin-lavender": pinLavenderIcon,
    shield: shieldIcon,
    "shield-heart": shieldHeartIcon,
    "calendar-heart": calendarHeartIcon,
    "calendar-check": calendarCheckIcon,
    check: checkIcon,
    note: noteIcon,
    "chat-heart": chatHeartIcon,
    friend: friendIcon,
    crown: crownIcon,
    "crown-badge": crownBadgeIcon,
    "star-medal": starMedalIcon,
    "star-face": starFaceIcon,
    "safety-mascot": safetyMascotIcon,
    "sos-shield": sosShieldIcon,
};

const FALLBACK_EMOJI = {
    bell: "🔔",
    heart: "💗",
    pin: "📍",
    "pin-heart": "📍",
    "pin-lavender": "📍",
    shield: "🛡️",
    "shield-heart": "🛡️",
    "calendar-heart": "📅",
    "calendar-check": "✅",
    check: "✅",
    note: "📝",
    "chat-heart": "💬",
    friend: "👫",
    crown: "👑",
    "crown-badge": "👑",
    "star-medal": "⭐",
    "star-face": "⭐",
    "safety-mascot": "🛡️",
    "sos-shield": "🚨",
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
