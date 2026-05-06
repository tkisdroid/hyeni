// src/lib/walkingRoute.js
// 도보 경로 fetcher — Kakao Mobility 우선, OSM/OSRM은 비활성화 (주석 참조).
// Extracted from App.jsx (Phase 5 #4 / B15 helpers).

import { createHttpError, parseKakaoWalkingRoute, parseOsmFootRoute } from "./routeParsers.js";
import { toRoutePosition } from "./trailMath.js";
import { normalizeKakaoAppKey } from "./kakaoMap.js";

export const ROUTE_REQUEST_TIMEOUT_MS = 12_000;

const KAKAO_REST_KEY = normalizeKakaoAppKey(import.meta.env?.VITE_KAKAO_REST_KEY);
const KAKAO_WALKING_DIRECTIONS_URL = "https://apis-navi.kakaomobility.com/affiliate/walking/v1/directions";
const OSM_FOOT_DIRECTIONS_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

// Time-based latch: a single 401/403 from Kakao does not permanently
// disable walking routes for the rest of the session. After KAKAO_WALKING_
// COOLDOWN_MS we let the next caller probe the API again — recovers
// automatically from transient quota glitches / brief deploys without
// requiring a reload.
const KAKAO_WALKING_COOLDOWN_MS = 5 * 60 * 1000;
let kakaoWalkingDirectionsDisabledUntil = 0;

async function fetchKakaoWalkingRoute(start, destination, signal) {
    if (!KAKAO_REST_KEY || Date.now() < kakaoWalkingDirectionsDisabledUntil) {
        throw new Error("Kakao walking route unavailable");
    }

    const params = new URLSearchParams({
        origin: `${start.lng},${start.lat}`,
        destination: `${destination.lng},${destination.lat}`,
        waypoints: "",
        radius: "5000",
        priority: "MAIN_STREET",
        summary: "false",
    });

    const response = await fetch(`${KAKAO_WALKING_DIRECTIONS_URL}?${params.toString()}`, {
        method: "GET",
        headers: {
            accept: "application/json",
            service: "hyeni-calendar",
            Authorization: `KakaoAK ${KAKAO_REST_KEY}`,
        },
        signal,
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            kakaoWalkingDirectionsDisabledUntil = Date.now() + KAKAO_WALKING_COOLDOWN_MS;
        }
        throw createHttpError(`Kakao walking route HTTP ${response.status}`, response.status);
    }

    // Successful probe — clear the latch so subsequent calls take the
    // happy path immediately.
    kakaoWalkingDirectionsDisabledUntil = 0;
    return parseKakaoWalkingRoute(await response.json());
}

// eslint-disable-next-line no-unused-vars
async function fetchOsmFootRoute(start, destination, signal) {
    const coords = `${start.lng},${start.lat};${destination.lng},${destination.lat}`;
    const params = new URLSearchParams({
        overview: "full",
        geometries: "geojson",
        steps: "false",
    });
    const response = await fetch(`${OSM_FOOT_DIRECTIONS_URL}/${coords}?${params.toString()}`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal,
    });
    if (!response.ok) throw createHttpError(`OSM foot route HTTP ${response.status}`, response.status);
    return parseOsmFootRoute(await response.json());
}

export async function fetchWalkingRoute(start, destination, signal) {
    const startCoord = toRoutePosition(start);
    const destinationCoord = toRoutePosition(destination);
    if (!startCoord || !destinationCoord) throw new Error("invalid route coordinates");

    // Kakao-only. The OSM (OSRM) fallback used to fire on Kakao failure but
    // routed children through an open-data road graph that did not match the
    // app's walking guidance. Callers must surface failure without drawing a
    // straight-line child route.
    return await fetchKakaoWalkingRoute(startCoord, destinationCoord, signal);
}
