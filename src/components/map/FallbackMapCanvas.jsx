// src/components/map/FallbackMapCanvas.jsx
// Kakao SDK 미로딩 시 SVG 기반 간이 지도. 마커/경로/타이틀 표시.
// Extracted from App.jsx (Phase 5 #4 / B5b).

import { DESIGN, FF } from "../../lib/styleHelpers.js";
import { KAKAO_APP_KEY } from "../../lib/kakaoMap.js";
import { CHILD_MARKER_COLORS } from "../../lib/markerColors.js";
import {
    HYENI_DEFAULT_CHILD_IMAGE_CROP,
    HYENI_DEFAULT_CHILD_IMAGE_STYLE,
    HYENI_DEFAULT_CHILD_IMAGE_URL,
} from "../../lib/childDefaultImage.js";

function toLatLngPoint(point) {
    if (!point) return null;
    const lat = Number(point.lat ?? point.location?.lat);
    const lng = Number(point.lng ?? point.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

function clampPercent(value, min = 8, max = 92) {
    return Math.max(min, Math.min(max, value));
}

function projectFallbackMapPoint(point, center) {
    const p = toLatLngPoint(point);
    const c = toLatLngPoint(center) || { lat: 37.5665, lng: 126.9780 };
    if (!p) return null;
    const latOffset = (c.lat - p.lat) * 8500;
    const lngOffset = (p.lng - c.lng) * 6500;
    return {
        left: clampPercent(50 + lngOffset),
        top: clampPercent(50 + latOffset),
    };
}

export function FallbackMapCanvas({
    center,
    children = [],
    eventPlaces = [],
    savedPlaces = [],
    routePoints = [],
    selectedKey = "",
    onSelect,
    title = "위치 지도",
    subtitle = "",
    height = "100%",
    showRadius = false,
}) {
    const normalizedCenter = toLatLngPoint(center) || { lat: 37.5665, lng: 126.9780 };
    const hasSdkKey = Boolean(KAKAO_APP_KEY);
    const childMarkers = children
        .map((child, index) => {
            const point = toLatLngPoint(child);
            const pos = projectFallbackMapPoint(point, normalizedCenter);
            if (!point || !pos) return null;
            return {
                key: child.key || child.trackerKey || child.user_id || child.id || `child-${index}`,
                type: "child",
                pos,
                emoji: child.emoji || "🧒",
                label: child.name || "아이",
                color: child.color || CHILD_MARKER_COLORS[index % CHILD_MARKER_COLORS.length],
                photoUrl: typeof child.photo_url === "string" && child.photo_url.trim() ? child.photo_url : null,
            };
        })
        .filter(Boolean);
    const eventMarkers = eventPlaces
        .map((place, index) => {
            const point = toLatLngPoint(place.location || place);
            const pos = projectFallbackMapPoint(point, normalizedCenter);
            if (!point || !pos) return null;
            return {
                key: place.key || place.id || `event-${index}`,
                type: "event",
                pos,
                emoji: place.emoji || place.nextEvent?.emoji || "📍",
                label: place.title || place.nextEvent?.title || "일정 장소",
                color: place.color || place.nextEvent?.color || DESIGN.colors.pink,
            };
        })
        .filter(Boolean);
    const savedMarkers = savedPlaces
        .map((place, index) => {
            const point = toLatLngPoint(place.location || place);
            const pos = projectFallbackMapPoint(point, normalizedCenter);
            if (!point || !pos) return null;
            return {
                key: place.key || place.id || `saved-${index}`,
                type: "saved",
                pos,
                emoji: place.emoji || "⭐",
                label: place.name || place.title || "저장 장소",
                color: DESIGN.colors.brand,
            };
        })
        .filter(Boolean);
    const route = routePoints
        .map(point => projectFallbackMapPoint(point, normalizedCenter))
        .filter(Boolean);
    const allMarkers = [...eventMarkers, ...savedMarkers, ...childMarkers];
    const sdkFailed = /실패|초과|오류|등록/i.test(subtitle || "");
    const sdkBadge = sdkFailed ? "간이 지도" : hasSdkKey ? "SDK 대기" : "지도키 필요";

    return (
        <div
            data-testid="hyeni-fallback-map"
            style={{
                position: "relative",
                width: "100%",
                height,
                minHeight: typeof height === "number" ? height : undefined,
                overflow: "hidden",
                background: "linear-gradient(145deg,var(--bg-subtle) 0%,#FFF9FC 52%,#FFF8F2 100%)",
                fontFamily: FF,
            }}
        >
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                <path d="M-5 74 C20 62 28 44 54 44 C73 44 83 31 105 25" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" opacity="0.92" />
                <path d="M-5 74 C20 62 28 44 54 44 C73 44 83 31 105 25" fill="none" stroke="#FED7AA" strokeWidth="2" strokeLinecap="round" opacity="0.9" strokeDasharray="2 4" />
                <path d="M14 -5 C23 19 40 29 38 52 C36 72 49 84 72 105" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" opacity="0.86" />
                <path d="M14 -5 C23 19 40 29 38 52 C36 72 49 84 72 105" fill="none" stroke="var(--theme-accent-line)" strokeWidth="2" strokeLinecap="round" opacity="0.9" strokeDasharray="2 4" />
                <path d="M-5 20 C21 22 29 12 48 17 C68 22 77 45 105 48" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" opacity="0.76" />
                <path d="M4 92 L96 8" stroke="#FFFFFF" strokeWidth="2" opacity="0.45" strokeDasharray="1 5" />
                {route.length >= 2 && (
                    <polyline
                        points={route.map(point => `${point.left},${point.top}`).join(" ")}
                        fill="none"
                        stroke={DESIGN.colors.parent}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.95"
                    />
                )}
            </svg>

            {showRadius && childMarkers[0] && (
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        left: `${childMarkers[0].pos.left}%`,
                        top: `${childMarkers[0].pos.top}%`,
                        width: 180,
                        height: 180,
                        borderRadius: "50%",
                        transform: "translate(-50%, -50%)",
                        background: "rgba(37,99,235,0.10)",
                        border: "2px dashed rgba(37,99,235,0.34)",
                    }}
                />
            )}

            <div style={{ position: "absolute", left: 14, top: 14, right: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, zIndex: 3 }}>
                <div style={{ minWidth: 0, padding: "9px 12px", borderRadius: 16, background: "rgba(255,255,255,0.90)", border: "1px solid var(--theme-accent-line)", boxShadow: "0 8px 22px rgba(31,41,55,0.08)" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: DESIGN.colors.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: DESIGN.colors.muted, marginTop: 2 }}>{subtitle || (hasSdkKey ? "지도 SDK 연결 중" : "간이 지도 모드")}</div>
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 999, background: sdkFailed ? "var(--status-cautionary-subtle)" : hasSdkKey ? "var(--bg-subtle)" : "var(--status-cautionary-subtle)", color: sdkFailed ? "var(--status-cautionary-strong)" : hasSdkKey ? DESIGN.colors.parentDeep : "var(--status-cautionary-strong)", fontSize: 10, fontWeight: 900, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(31,41,55,0.08)" }}>
                    {sdkBadge}
                </div>
            </div>

            {allMarkers.map(marker => {
                const isSelected = selectedKey === marker.key || selectedKey === `${marker.type}:${marker.key}`;
                const isChild = marker.type === "child";
                return (
                    <button
                        key={`${marker.type}-${marker.key}`}
                        type="button"
                        onClick={() => onSelect?.(marker)}
                        style={{
                            position: "absolute",
                            left: `${marker.pos.left}%`,
                            top: `${marker.pos.top}%`,
                            transform: "translate(-50%, -100%)",
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: onSelect ? "pointer" : "default",
                            zIndex: isChild ? 5 : 4,
                            fontFamily: FF,
                        }}
                    >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", filter: isSelected ? `drop-shadow(0 8px 16px ${marker.color}55)` : "drop-shadow(0 4px 10px rgba(31,41,55,0.18))" }}>
                            <div style={{
                                minWidth: isChild ? 42 : 34,
                                width: isChild ? 42 : undefined,
                                height: isChild ? 42 : 34,
                                padding: isChild ? 0 : "0 7px",
                                borderRadius: isChild ? 16 : 14,
                                background: isChild ? "white" : marker.color,
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "3px solid white",
                                fontSize: isChild ? 18 : 15,
                                fontWeight: 900,
                                overflow: "hidden",
                                position: "relative",
                                boxShadow: isSelected ? `0 0 0 7px ${marker.color}24` : `0 0 0 4px ${marker.color}18`,
                            }}>
                                {isChild ? (
                                    <img
                                        src={marker.photoUrl || HYENI_DEFAULT_CHILD_IMAGE_URL}
                                        alt=""
                                        aria-hidden="true"
                                        data-hyeni-default-child-image={marker.photoUrl ? undefined : true}
                                        data-hyeni-default-child-image-crop={marker.photoUrl ? undefined : HYENI_DEFAULT_CHILD_IMAGE_CROP}
                                        style={marker.photoUrl ? {
                                            position: "absolute",
                                            inset: 0,
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        } : HYENI_DEFAULT_CHILD_IMAGE_STYLE}
                                    />
                                ) : marker.emoji}
                            </div>
                            <div style={{
                                marginTop: 5,
                                maxWidth: 116,
                                padding: "5px 9px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.94)",
                                color: marker.color,
                                border: `1px solid ${marker.color}33`,
                                fontSize: 10,
                                fontWeight: 900,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}>
                                {marker.label}
                            </div>
                        </div>
                    </button>
                );
            })}

            {allMarkers.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: DESIGN.colors.muted, fontSize: 13, fontWeight: 800 }}>
                    표시할 위치가 아직 없습니다.
                </div>
            )}
        </div>
    );
}
