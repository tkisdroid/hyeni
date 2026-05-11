// src/components/auth/AppBrandLogo.jsx
// Hyeni brand logo — mood 에 따라 다른 혜니 캐릭터를 둥근 squircle 안에 배치.
//
// Props:
//   size: number (px, default 80)
//   radius: number (px, default 24)
//   shadow: bool (default true)
//   mood: HyeniMascot variant (default "winkStar")

import { HyeniMascot } from "./HyeniMascot.jsx";

export const AppBrandLogo = ({ size = 80, radius = 24, shadow = true, mood = "winkStar" }) => (
    <div
        aria-label="혜니캘린더 로고"
        style={{
            width: size,
            height: size,
            borderRadius: radius,
            overflow: "hidden",
            background: "var(--brand-rose-soft, #FFE2EC)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: shadow ? "var(--hyeni-theme-shadow-soft)" : "none",
            flexShrink: 0,
        }}
    >
        <HyeniMascot variant={mood} size={Math.round(size * 1.18)} aria-label="" />
    </div>
);
