// src/lib/nativeLocationService.js
// 네이티브 백그라운드 위치 서비스 — Capacitor BackgroundLocation 플러그인 wrapper.
// Extracted from App.jsx (Phase 5 #4 / B27).

import { getBackgroundLocationPlugin } from "./nativePlugins.js";

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
// TODO(Agent05 L-001 / fix-db follow-up): VITE_KAKAO_REST_KEY ships in the
// production JS bundle (visible in dist/assets/index-*.js) and that violates
// our key-handling policy. The fix is to proxy Kakao REST calls through a
// Supabase Edge Function (e.g. `kakao-proxy`) so the secret stays
// server-side. Until that Edge Function exists this module continues to
// pass the key to the native BackgroundLocation plugin (which forwards it
// to Kakao reverse-geocoding from background ticks). Logged once at module
// load so it surfaces during cold starts of debug builds.
if (typeof console !== "undefined" && import.meta.env?.VITE_KAKAO_REST_KEY) {
    console.warn(
        "[deprecated] VITE_KAKAO_REST_KEY is exposed in the client bundle. " +
        "Move Kakao REST calls behind a Supabase Edge Function proxy (Agent05 L-001)."
    );
}
const KAKAO_REST_KEY = import.meta.env?.VITE_KAKAO_REST_KEY || "";

// Native background location (Capacitor plugin)
export async function startNativeLocationService(userId, familyId, accessToken, role) {
    try {
        const BackgroundLocation = await getBackgroundLocationPlugin();
        if (BackgroundLocation) {
            await BackgroundLocation.startService({
                userId, familyId,
                supabaseUrl: SUPABASE_URL,
                supabaseKey: SUPABASE_KEY,
                kakaoRestKey: KAKAO_REST_KEY,
                accessToken: accessToken || "",
                role: role || "child"
            });
            console.log("[Native] Background location service started");
            return true;
        }
    } catch (e) {
        console.log("[Native] Not available (web mode):", e.message);
    }
    return false;
}

export async function requestNativeCurrentLocation(userId, familyId, accessToken, role) {
    try {
        const BackgroundLocation = await getBackgroundLocationPlugin();
        if (BackgroundLocation) {
            await BackgroundLocation.requestCurrentLocation({
                userId, familyId,
                supabaseUrl: SUPABASE_URL,
                supabaseKey: SUPABASE_KEY,
                kakaoRestKey: KAKAO_REST_KEY,
                accessToken: accessToken || "",
                role: role || "child"
            });
            console.log("[Native] Immediate child location refresh requested");
            return true;
        }
    } catch (e) {
        console.log("[Native] Immediate location refresh unavailable:", e.message);
    }
    return false;
}

export async function stopNativeLocationService() {
    try {
        const BackgroundLocation = await getBackgroundLocationPlugin();
        if (BackgroundLocation) {
            await BackgroundLocation.stopService();
            console.log("[Native] Background location service stopped");
        }
    } catch { /* web mode */ }
}
