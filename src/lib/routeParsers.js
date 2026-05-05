// src/lib/routeParsers.js
// Pure parsers for walking-route responses (Kakao Mobility, OSRM foot).
// Extracted from App.jsx (Phase 5 #4 / A3).
//
// 의존: lib/trailMath.js (compactRoutePoints, sumRouteDistance, finiteNumber)
// 모두 pure — fetch 호출은 App.jsx 의 fetchKakaoWalkingRoute / fetchOsmFootRoute
// 가 담당하고, 이 모듈은 응답 데이터 파싱만 함.

import { compactRoutePoints, sumRouteDistance, finiteNumber } from "./trailMath.js";

export function createHttpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

export function parseKakaoWalkingRoute(data) {
    const route = data?.routes?.[0];
    if (!route || route.result_code !== 0) {
        throw new Error(route?.result_message || "Kakao walking route failed");
    }

    const points = [];
    const sections = Array.isArray(route.sections) ? route.sections : [];
    sections.forEach((section) => {
        const roads = Array.isArray(section?.roads) ? section.roads : [];
        roads.forEach((road) => {
            const vertexes = Array.isArray(road?.vertexes) ? road.vertexes : [];
            for (let i = 0; i + 1 < vertexes.length; i += 2) {
                points.push({ lng: vertexes[i], lat: vertexes[i + 1] });
            }
        });
    });

    const compacted = compactRoutePoints(points);
    if (compacted.length < 2) throw new Error("Kakao walking route has no path");

    const distance = finiteNumber(route.summary?.distance)
        ?? sections.reduce((sum, section) => sum + (finiteNumber(section?.distance) ?? 0), 0)
        ?? sumRouteDistance(compacted);
    const duration = finiteNumber(route.summary?.duration)
        ?? sections.reduce((sum, section) => sum + (finiteNumber(section?.duration) ?? 0), 0);

    return {
        provider: "kakao",
        points: compacted,
        distance,
        duration: duration || null,
    };
}

export function parseOsmFootRoute(data) {
    if (data?.code !== "Ok") throw new Error(data?.message || "OSM foot route failed");
    const route = data?.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!Array.isArray(coordinates)) throw new Error("OSM foot route has no geometry");

    const points = compactRoutePoints(coordinates.map(([lng, lat]) => ({ lat, lng })));
    if (points.length < 2) throw new Error("OSM foot route has no path");

    return {
        provider: "osm-foot",
        points,
        distance: finiteNumber(route.distance) ?? sumRouteDistance(points),
        duration: finiteNumber(route.duration),
    };
}
