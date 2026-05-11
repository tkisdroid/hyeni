// src/components/auth/HyeniMascot.jsx
// 3D mascot rendered from a curated WebP asset (see src/assets/3d/INDEX.md).
// prop interface is preserved from the previous inline-SVG version so callers
// (RoleSetupModal, ChildEntryTransition, PairingWizard, NextEventHero,
// HomeGreeting, App, etc.) need no changes.
// Phase 07 Step 2 — 3D asset migration.

import mascotStatic from "../../assets/3d/mascot/static.webp";
import mascotWave from "../../assets/3d/mascot/wave.webp";
import mascotPhone from "../../assets/3d/mascot/phone.webp";
import mascotCheer from "../../assets/3d/mascot/cheer.webp";
import mascotThinking from "../../assets/3d/mascot/thinking.webp";
import mascotSad from "../../assets/3d/mascot/sad.webp";
import mascotDiary from "../../assets/3d/mascot/diary.webp";
import mascotWinkStar from "../../assets/3d/mascot/wink-star.webp";

const SOURCES = {
    static: mascotStatic,
    wave: mascotWave,
    phone: mascotPhone,
    cheer: mascotCheer,
    thinking: mascotThinking,
    sad: mascotSad,
    diary: mascotDiary,
    winkStar: mascotWinkStar,
};

export function HyeniMascot({
    size = 56,
    variant = "static",
    className = "",
    "aria-label": ariaLabel = "혜니 마스코트",
}) {
    const src = SOURCES[variant] ?? SOURCES.static;

    return (
        <img
            src={src}
            width={size}
            height={size}
            alt={ariaLabel}
            className={className}
            draggable={false}
            style={{
                width: size,
                height: size,
                objectFit: "contain",
                userSelect: "none",
                pointerEvents: "none",
            }}
        />
    );
}
