// src/components/icons/AnimalIcon.jsx
// 3D animal character icon for child avatars. Accepts either an emoji glyph
// (the value stored on family_members.emoji) OR a canonical name. Falls back
// to the emoji when no matching asset exists.
// Phase 07 Step 4 — 3D asset migration.

import rabbitIcon from "../../assets/3d/animal/rabbit.webp";
import catIcon from "../../assets/3d/animal/cat.webp";
import foxIcon from "../../assets/3d/animal/fox.webp";
import dogIcon from "../../assets/3d/animal/dog.webp";
import chickIcon from "../../assets/3d/animal/chick.webp";
import bearIcon from "../../assets/3d/animal/bear.webp";
import pandaIcon from "../../assets/3d/animal/panda.webp";
import tigerIcon from "../../assets/3d/animal/tiger.webp";

export const ANIMAL_NAMES = ["rabbit", "cat", "fox", "dog", "chick", "bear", "panda", "tiger"];

const SOURCES = {
    rabbit: rabbitIcon,
    cat: catIcon,
    fox: foxIcon,
    dog: dogIcon,
    chick: chickIcon,
    bear: bearIcon,
    panda: pandaIcon,
    tiger: tigerIcon,
};

export const ANIMAL_EMOJI = {
    rabbit: "🐰",
    cat: "🐱",
    fox: "🦊",
    dog: "🐶",
    chick: "🐥",
    bear: "🐻",
    panda: "🐼",
    tiger: "🐯",
};

const EMOJI_TO_NAME = Object.fromEntries(
    Object.entries(ANIMAL_EMOJI).map(([name, emoji]) => [emoji, name])
);

export function resolveAnimalName({ name, emoji } = {}) {
    if (name && SOURCES[name]) return name;
    if (emoji && EMOJI_TO_NAME[emoji]) return EMOJI_TO_NAME[emoji];
    return null;
}

export function AnimalIcon({
    name,
    emoji,
    size = 48,
    className = "",
    "aria-label": ariaLabel,
}) {
    const resolved = resolveAnimalName({ name, emoji });
    const src = resolved ? SOURCES[resolved] : null;
    const label = ariaLabel ?? (resolved ?? emoji ?? "동물 캐릭터");

    if (!src) {
        const fallbackEmoji = emoji ?? "🐰";
        return (
            <span
                role="img"
                aria-label={label}
                className={className}
                style={{
                    fontSize: Math.round(size * 0.92),
                    lineHeight: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: size,
                    height: size,
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
            }}
        />
    );
}
