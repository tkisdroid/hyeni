// src/components/auth/HyeniMascot.jsx
// 3D mascot rendered from a curated WebP asset (see src/assets/3d/INDEX.md).
// prop interface is preserved from the previous inline-SVG version so callers
// (RoleSetupModal, ChildEntryTransition, PairingWizard, NextEventHero,
// HomeGreeting, App, etc.) need no changes.
// Phase 07 Step 2 — 3D asset migration.

import mascotStatic from "../../assets/3d/mascot/static.webp";
import mascotWave from "../../assets/3d/mascot/wave.webp";
import mascotPhone from "../../assets/3d/mascot/phone.webp";

const SOURCES = {
    static: mascotStatic,
    wave: mascotWave,
    phone: mascotPhone,
    // Cheer asset not yet curated — alias to wave so PairingWizard step-5 and
    // kkuk overlay still receive a valid mascot image.
    cheer: mascotWave,
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
