// src/lib/trailMath.js
// Pure utilities for location-trail rendering, dwell detection, and color
// interpolation. Extracted from App.jsx (Phase 5 #4 / A1).
//
// This module owns:
//   - Geo basics (haversineM, toRoutePosition, finiteNumber, route point compaction)
//   - Trail point normalization & jitter compaction
//   - Trail time/segment/color helpers
//   - Dwell-place clustering
//
// Consumers: App.jsx KidsScheduler trail rendering. No React, no Supabase, no
// browser-specific APIs — fully unit-testable.

import { LOCATION_TRAIL_GRADIENT_STOPS } from "./locationTrailDisplay.js";

export const LOCATION_TRAIL_JITTER_M = 8;
// 사용자 요구: 반경 50m 안에서의 움직임은 머무름으로 간주.
// 학교/학원/집 같은 단일 장소 내 이동(복도/운동장)이 GPS 잡음 + 실제 동선으로
// 50m 이내에 머무르므로 합리적 임계값. 80m 이전 값은 두 인접 건물을 한 dwell로
// 묶는 오류가 있었음.
export const LOCATION_TRAIL_DWELL_RADIUS_M = 50;
export const LOCATION_TRAIL_DWELL_MIN_MS = 10 * 60_000;
// Phase 6 movement summary: trail polyline 그릴 때 200m 미만의 작은 흔들림은
// 합쳐서 한 chunk로 그려 noise 를 줄인다. 사용자 요구 "200m 이상의 큰 이동만
// 정리해서 표시".
export const LOCATION_TRAIL_SIGNIFICANT_MOVE_M = 200;

export function haversineM(la1, lo1, la2, lo2) {
    const R = 6371000, p1 = la1 * Math.PI / 180, p2 = la2 * Math.PI / 180;
    const dp = (la2 - la1) * Math.PI / 180, dl = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function toRoutePosition(position) {
    if (!position) return null;
    const lat = Number(position.lat);
    const lng = Number(position.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
}

export function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function compactRoutePoints(points) {
    const compacted = [];
    points.forEach((point) => {
        const normalized = toRoutePosition(point);
        if (!normalized) return;
        const prev = compacted[compacted.length - 1];
        if (prev && Math.abs(prev.lat - normalized.lat) < 0.0000001 && Math.abs(prev.lng - normalized.lng) < 0.0000001) return;
        compacted.push(normalized);
    });
    return compacted;
}

export function sumRouteDistance(points) {
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
        total += haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    }
    return total;
}

export function normalizeLocationTrailPoint(point) {
    const routePosition = toRoutePosition(point);
    if (!routePosition) return null;
    const recordedAt = point?.recorded_at || point?.recordedAt || point?.updated_at || point?.updatedAt || null;
    const recordedMs = recordedAt ? new Date(recordedAt).getTime() : null;
    const isEstimated = !!(point?.is_estimated || point?.isEstimated);
    return {
        ...routePosition,
        user_id: point?.user_id || point?.userId || null,
        recorded_at: recordedAt,
        recordedAt,
        recordedMs: Number.isFinite(recordedMs) ? recordedMs : null,
        isEstimated,
    };
}

export function compactLocationTrailPoints(points) {
    const compacted = [];
    points.forEach((point) => {
        const normalized = normalizeLocationTrailPoint(point);
        if (!normalized) return;
        const prev = compacted[compacted.length - 1];
        if (prev && haversineM(prev.lat, prev.lng, normalized.lat, normalized.lng) < LOCATION_TRAIL_JITTER_M) {
            compacted[compacted.length - 1] = {
                ...prev,
                recorded_at: normalized.recorded_at || prev.recorded_at,
                recordedAt: normalized.recordedAt || prev.recordedAt,
                recordedMs: normalized.recordedMs ?? prev.recordedMs,
                // jitter 합쳐진 cluster 안에 estimated row 가 하나라도 섞여 있으면
                // cluster 전체를 estimated 로 본다 (직선 보간 segment 보존).
                isEstimated: prev.isEstimated || normalized.isEstimated,
            };
            return;
        }
        compacted.push(normalized);
    });
    return compacted;
}

export function buildSelectedLocationTrail(locationTrail, selectedChild) {
    const selectedUserId = selectedChild?.user_id || selectedChild?.userId || null;
    const rawTrail = Array.isArray(locationTrail) ? locationTrail : [];
    const filteredTrail = selectedUserId
        ? rawTrail.filter(point => (point?.user_id || point?.userId) === selectedUserId)
        : rawTrail;
    const points = compactLocationTrailPoints(filteredTrail);
    const currentPoint = selectedChild
        ? normalizeLocationTrailPoint({
            ...selectedChild,
            user_id: selectedUserId,
            recorded_at: selectedChild.updatedAt || selectedChild.updated_at || null,
        })
        : null;

    if (currentPoint) {
        const last = points[points.length - 1];
        const currentIsNotOlder = !last?.recordedMs || !currentPoint.recordedMs || currentPoint.recordedMs >= last.recordedMs;
        if (currentIsNotOlder && (!last || haversineM(last.lat, last.lng, currentPoint.lat, currentPoint.lng) >= LOCATION_TRAIL_JITTER_M)) {
            points.push(currentPoint);
        } else if (currentIsNotOlder && currentPoint.recordedMs && (!last.recordedMs || currentPoint.recordedMs > last.recordedMs)) {
            points[points.length - 1] = { ...last, ...currentPoint };
        }
    }

    return compactLocationTrailPoints(points);
}

export function formatTrailClock(ms) {
    if (!Number.isFinite(ms)) return "";
    return new Date(ms).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function formatTrailDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "0분";
    const totalMinutes = Math.max(1, Math.round(ms / 60_000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}분`;
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

export function clampTrailProgress(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

export function hexToRgb(hex) {
    const clean = String(hex || "").replace("#", "");
    if (clean.length !== 6) return { r: 37, g: 99, b: 235 };
    const value = Number.parseInt(clean, 16);
    if (!Number.isFinite(value)) return { r: 37, g: 99, b: 235 };
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
}

export function rgbToHex({ r, g, b }) {
    const toHex = (value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function interpolateTrailColor(progress) {
    const stops = LOCATION_TRAIL_GRADIENT_STOPS;
    if (stops.length <= 1) return stops[0] || "#2563EB";
    const scaled = clampTrailProgress(progress) * (stops.length - 1);
    const index = Math.floor(scaled);
    const nextIndex = Math.min(stops.length - 1, index + 1);
    const ratio = scaled - index;
    const start = hexToRgb(stops[index]);
    const end = hexToRgb(stops[nextIndex]);
    return rgbToHex({
        r: start.r + (end.r - start.r) * ratio,
        g: start.g + (end.g - start.g) * ratio,
        b: start.b + (end.b - start.b) * ratio,
    });
}

export function getTrailTimeBounds(points) {
    const times = points
        .map(point => point?.recordedMs)
        .filter(ms => Number.isFinite(ms));
    if (!times.length) return { firstMs: null, lastMs: null };
    return {
        firstMs: Math.min(...times),
        lastMs: Math.max(...times),
    };
}

export function getTrailProgress(point, index, totalCount, firstMs, lastMs) {
    if (Number.isFinite(point?.recordedMs) && Number.isFinite(firstMs) && Number.isFinite(lastMs) && lastMs > firstMs) {
        return clampTrailProgress((point.recordedMs - firstMs) / (lastMs - firstMs));
    }
    if (totalCount <= 1) return 0;
    return clampTrailProgress(index / (totalCount - 1));
}

export function getTrailHourKey(point) {
    if (!Number.isFinite(point?.recordedMs)) return "unknown";
    const d = new Date(point.recordedMs);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

export function getTrailHourLabel(point) {
    if (!Number.isFinite(point?.recordedMs)) return "시간 미상";
    return `${String(new Date(point.recordedMs).getHours()).padStart(2, "0")}시`;
}

export function buildTrailHourSegments(points) {
    const segments = [];
    let current = null;
    let previous = null;
    const { firstMs, lastMs } = getTrailTimeBounds(points);

    points.forEach((point, index) => {
        const key = getTrailHourKey(point);
        if (!current || current.key !== key) {
            if (current) segments.push(current);
            current = {
                key,
                label: getTrailHourLabel(point),
                color: interpolateTrailColor(getTrailProgress(point, index, points.length, firstMs, lastMs)),
                points: previous ? [previous, point] : [point],
            };
        } else {
            current.points.push(point);
        }
        previous = point;
    });

    if (current) segments.push(current);
    return segments;
}

// Phase C: gap > 150m AND time > 90s 인 segment 는 추정 (Kakao 실패/anon 폴백 등) 가능성
// 이 높으므로 dashed 플래그를 달아 frontend 가 점선 표시하도록.
export const LOCATION_TRAIL_DASHED_GAP_M = 150;
export const LOCATION_TRAIL_DASHED_TIME_MS = 90_000;

export function buildTrailGradientSegments(points) {
    if (!Array.isArray(points) || points.length < 2) return [];
    const { firstMs, lastMs } = getTrailTimeBounds(points);
    const segments = [];
    for (let index = 1; index < points.length; index += 1) {
        const prev = points[index - 1];
        const point = points[index];
        const gapM = haversineM(prev.lat, prev.lng, point.lat, point.lng);
        const gapMs = (Number.isFinite(prev?.recordedMs) && Number.isFinite(point?.recordedMs))
            ? (point.recordedMs - prev.recordedMs)
            : 0;
        const gapDashed = gapM > LOCATION_TRAIL_DASHED_GAP_M && gapMs > LOCATION_TRAIL_DASHED_TIME_MS;
        // Phase D: native 가 Kakao 도보 매칭 실패로 직선 보간한 row 는 12m 간격이라
        // gap 임계값 (150m) 을 절대 못 넘는다. is_estimated 플래그가 있으면 거리/시간
        // 임계값과 무관하게 dashed 로 표시해 사용자가 추정 vs 실측 구간 구분 가능.
        const estimatedDashed = !!point?.isEstimated || !!prev?.isEstimated;
        segments.push({
            key: `trail-gradient-${index}-${point?.recordedMs || index}`,
            color: interpolateTrailColor(getTrailProgress(point, index, points.length, firstMs, lastMs)),
            points: [prev, point],
            dashed: estimatedDashed || gapDashed,
        });
    }
    return segments;
}

// 200m 이상 누적 이동한 단위로 trail 을 chunk 화. chunk 내부의 작은 흔들림은
// 시작 → 끝 한 직선으로 단순화해 polyline noise 를 제거한다. 마지막 tail 이
// minMoveM 의 절반 이상이면 별도 segment 로 추가한다.
export function buildSignificantMovementSegments(points, minMoveM = LOCATION_TRAIL_SIGNIFICANT_MOVE_M) {
    if (!Array.isArray(points) || points.length < 2) return [];
    const { firstMs, lastMs } = getTrailTimeBounds(points);
    const segments = [];
    let chunkStart = points[0];
    let lastInChunk = points[0];
    let cumDist = 0;
    for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const curr = points[i];
        const step = haversineM(prev.lat, prev.lng, curr.lat, curr.lng);
        cumDist += step;
        lastInChunk = curr;
        if (cumDist >= minMoveM) {
            segments.push({
                key: `trail-move-${segments.length}-${chunkStart?.recordedMs ?? i}`,
                color: interpolateTrailColor(getTrailProgress(curr, i, points.length, firstMs, lastMs)),
                points: [chunkStart, curr],
                distanceM: cumDist,
                startMs: chunkStart?.recordedMs ?? null,
                endMs: curr?.recordedMs ?? null,
            });
            chunkStart = curr;
            cumDist = 0;
        }
    }
    if (cumDist >= minMoveM / 2 && chunkStart !== lastInChunk) {
        segments.push({
            key: `trail-move-${segments.length}-tail`,
            color: interpolateTrailColor(1),
            points: [chunkStart, lastInChunk],
            distanceM: cumDist,
            startMs: chunkStart?.recordedMs ?? null,
            endMs: lastInChunk?.recordedMs ?? null,
        });
    }
    return segments;
}

export function buildDetailedLocationHistoryRows({
    userId,
    familyId,
    previousPoint = null,
    currentPoint,
    routePoints = [],
} = {}) {
    const current = normalizeLocationTrailPoint({
        ...(currentPoint || {}),
        recorded_at: currentPoint?.recorded_at || currentPoint?.recordedAt || currentPoint?.updated_at || currentPoint?.updatedAt || new Date().toISOString(),
    });
    if (!userId || !familyId || !current) return [];

    const previous = previousPoint
        ? normalizeLocationTrailPoint(previousPoint)
        : null;
    const compactedRoute = compactRoutePoints(routePoints);
    let points = compactedRoute.length >= 2 ? compactedRoute : [current];

    if (compactedRoute.length >= 2) {
        if (previous) {
            points = points.filter((point) => haversineM(previous.lat, previous.lng, point.lat, point.lng) >= LOCATION_TRAIL_JITTER_M);
        }
        const last = points[points.length - 1];
        if (!last || haversineM(last.lat, last.lng, current.lat, current.lng) >= LOCATION_TRAIL_JITTER_M) {
            points.push(current);
        }
    }

    if (points.length === 0) points = [current];

    const startMs = previous?.recordedMs ?? null;
    const endMs = current.recordedMs ?? Date.now();
    const hasInterval = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;

    return points.map((point, index) => {
        const ratio = points.length <= 1 ? 1 : (index + 1) / points.length;
        const recordedAt = hasInterval
            ? new Date(startMs + Math.round((endMs - startMs) * ratio)).toISOString()
            : current.recordedAt;
        return {
            user_id: userId,
            family_id: familyId,
            lat: point.lat,
            lng: point.lng,
            recorded_at: recordedAt || new Date().toISOString(),
        };
    });
}

export function averageTrailPoint(points) {
    if (!points.length) return null;
    const totals = points.reduce((acc, point) => ({
        lat: acc.lat + point.lat,
        lng: acc.lng + point.lng,
    }), { lat: 0, lng: 0 });
    return { lat: totals.lat / points.length, lng: totals.lng / points.length };
}

export function buildTrailDwellPlaces(points) {
    const timedPoints = points.filter(point => Number.isFinite(point?.recordedMs));
    const places = [];
    let cluster = [];

    const flush = () => {
        if (cluster.length < 2) {
            cluster = [];
            return;
        }
        const startMs = cluster[0].recordedMs;
        const endMs = cluster[cluster.length - 1].recordedMs;
        const durationMs = endMs - startMs;
        if (durationMs >= LOCATION_TRAIL_DWELL_MIN_MS) {
            const center = averageTrailPoint(cluster);
            if (center) {
                places.push({
                    id: `dwell-${places.length}-${startMs}`,
                    ...center,
                    startMs,
                    endMs,
                    durationMs,
                    pointCount: cluster.length,
                    label: `${formatTrailDuration(durationMs)} 머무름`,
                    timeLabel: `${formatTrailDuration(durationMs)} 머무름`,
                    timeRangeLabel: `${formatTrailClock(startMs)}-${formatTrailClock(endMs)}`,
                });
            }
        }
        cluster = [];
    };

    timedPoints.forEach((point) => {
        if (!cluster.length) {
            cluster = [point];
            return;
        }
        const center = averageTrailPoint(cluster);
        const distanceFromCluster = center ? haversineM(center.lat, center.lng, point.lat, point.lng) : Infinity;
        if (distanceFromCluster <= LOCATION_TRAIL_DWELL_RADIUS_M) {
            cluster.push(point);
            return;
        }
        flush();
        cluster = [point];
    });
    flush();

    return places;
}
