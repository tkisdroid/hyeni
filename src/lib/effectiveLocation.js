// src/lib/effectiveLocation.js
// Freemium 위치 gate — premium은 실시간, free는 isDelayed=true 표시.
// Extracted from App.jsx (Phase 5 #4 / B23).

import { FEATURES } from "./features.js";

// Freemium location gate.
//   premium (REALTIME_LOCATION): always show, isDelayed=false.
//   free: show the most recent fix tagged isDelayed=true so the UI can
//         render a "5분 지연" badge / fuzzed marker. The previous logic
//         returned null whenever the fix was less than 5 min old, which
//         meant a free parent whose child's GPS updates every 30s
//         **never** saw a position at all (each fresh fix reset the gate).
//         The honest gate is "free users see a delayed/marked position",
//         not "free users see nothing while fixes are continuous".
export function effectiveChildLocation(location, entitlement) {
    if (!location) return null;
    if (entitlement?.canUse?.(FEATURES.REALTIME_LOCATION)) {
        return { ...location, isDelayed: false };
    }
    const updatedAtMs = new Date(location.updatedAt || location.updated_at || 0).getTime();
    if (!updatedAtMs || Number.isNaN(updatedAtMs)) return null;
    return {
        ...location,
        updatedAt: location.updatedAt || location.updated_at,
        updated_at: location.updated_at || location.updatedAt,
        isDelayed: true,
    };
}

export function effectiveChildPositions(positions, entitlement) {
    if (!Array.isArray(positions)) return [];
    return positions
        .map((position) => effectiveChildLocation(position, entitlement))
        .filter(Boolean);
}
