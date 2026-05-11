// src/components/auth/AppBrandLogo.jsx
// Hyeni brand logo — mood 에 따라 다른 혜니 캐릭터. 배경 없이 캐릭터만 표시.
//
// Props:
//   size: number (px, default 80) — 캐릭터 bounding box
//   radius: kept for API compat (no longer applied — no background)
//   shadow: bool (default true) — drop-shadow on the character silhouette
//   mood: HyeniMascot variant (default "winkStar")

import { HyeniMascot } from "./HyeniMascot.jsx";

export const AppBrandLogo = ({ size = 80, radius = 24, shadow = true, mood = "winkStar" }) => {
    void radius; // kept for backwards-compatible prop signature
    return (
        <div
            aria-label="혜니캘린더 로고"
            style={{
                width: size,
                height: size,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                filter: shadow ? "drop-shadow(0 4px 10px rgba(247,121,168,0.22))" : "none",
            }}
        >
            <HyeniMascot variant={mood} size={size} aria-label="" />
        </div>
    );
};
