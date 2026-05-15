// src/lib/walkingRoute.js
// 도보 경로 fetcher — Supabase Edge Function `kakao-proxy` 경유.
// Extracted from App.jsx (Phase 5 #4 / B15 helpers).

import { createHttpError, parseKakaoWalkingRoute, parseOsmFootRoute } from "./routeParsers.js";
import { toRoutePosition } from "./trailMath.js";
import { supabase } from "./supabase.js";

export const ROUTE_REQUEST_TIMEOUT_MS = 12_000;

const OSM_FOOT_DIRECTIONS_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

// Time-based latch: a single 401/403 from Kakao (surfaced by the Edge
// Function as 503 kakao_auth) does not permanently disable walking routes
// for the rest of the session. After KAKAO_WALKING_COOLDOWN_MS we let the
// next caller probe the API again — recovers automatically from transient
// quota glitches / brief deploys without requiring a reload.
const KAKAO_WALKING_COOLDOWN_MS = 5 * 60 * 1000;
let kakaoWalkingDirectionsDisabledUntil = 0;

async function fetchKakaoWalkingRoute(start, destination, signal) {
    if (Date.now() < kakaoWalkingDirectionsDisabledUntil) {
        throw new Error("Kakao walking route unavailable");
    }

    const { data, error } = await supabase.functions.invoke("kakao-proxy/walking-directions", {
        body: {
            origin: { lat: start.lat, lng: start.lng },
            destination: { lat: destination.lat, lng: destination.lng },
        },
        // supabase-js FunctionsResponse surfaces HTTP non-2xx as error with a
        // .context.response — pass signal so callers can cancel via AbortController.
        ...(signal ? { signal } : {}),
    });

    if (error) {
        // FunctionsHttpError carries the upstream Response on error.context.
        const status = error?.context?.response?.status ?? error?.status ?? 0;
        if (status === 503 || status === 401 || status === 403) {
            kakaoWalkingDirectionsDisabledUntil = Date.now() + KAKAO_WALKING_COOLDOWN_MS;
        }
        throw createHttpError(`Kakao walking route HTTP ${status || "unknown"}`, status || 0);
    }

    // Successful probe — clear the latch so subsequent calls take the
    // happy path immediately.
    kakaoWalkingDirectionsDisabledUntil = 0;
    return parseKakaoWalkingRoute(data);
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
