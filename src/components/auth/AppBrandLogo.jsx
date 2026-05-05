// src/components/auth/AppBrandLogo.jsx
// Hyeni Calendar brand logo image. Extracted from App.jsx (Phase 5 #4 / B3).
//
// Props:
//   size: number (px, default 80)
//   radius: number (px, default 24)
//   shadow: bool (default true) — apply --hyeni-theme-shadow-soft

const APP_BRAND_LOGO_SRC = "/icon-192.png";

export const AppBrandLogo = ({ size = 80, radius = 24, shadow = true }) => (
    <img
        src={APP_BRAND_LOGO_SRC}
        alt="혜니캘린더 로고"
        style={{
            width: size,
            height: size,
            borderRadius: radius,
            objectFit: "cover",
            display: "block",
            boxShadow: shadow ? "var(--hyeni-theme-shadow-soft)" : "none",
        }}
    />
);
