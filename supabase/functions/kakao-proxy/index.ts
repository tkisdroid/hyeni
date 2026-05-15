// supabase/functions/kakao-proxy/index.ts
//
// Kakao REST API proxy. Removes the need to ship VITE_KAKAO_REST_KEY in the
// JS bundle or native Android SharedPreferences (santa-loop e9afa89
// follow-up #1). All Kakao REST calls go through this function with the
// secret KAKAO_REST_KEY stored as a Supabase Edge Function secret.
//
// Routing (path-based, single function):
//   POST /kakao-proxy/walking-directions
//     Input  (JSON): { origin: {lat, lng}, destination: {lat, lng} }
//     Output (JSON): Kakao raw response on 2xx; { ok: false, error } on errors.
//
// Auth: requires Authorization: Bearer <user_jwt>. Anonymous calls rejected.
//
// Deploy:
//   npx supabase secrets set KAKAO_REST_KEY=<rest-api-key>
//   npx supabase functions deploy kakao-proxy
//   (DO NOT pass --no-verify-jwt — we rely on JWT verification.)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") || "";

const KAKAO_WALKING_URL =
  "https://apis-navi.kakaomobility.com/affiliate/walking/v1/directions";

interface LatLng {
  lat?: unknown;
  lng?: unknown;
}

interface WalkingDirectionsRequest {
  origin?: LatLng;
  destination?: LatLng;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validateLatLng(p: LatLng | undefined): { lat: number; lng: number } | null {
  if (!p || typeof p !== "object") return null;
  const { lat, lng } = p;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

async function handleWalkingDirections(req: Request): Promise<Response> {
  if (!KAKAO_REST_KEY) {
    return jsonResponse({ ok: false, error: "server_misconfigured" }, 500);
  }

  // Parse + validate input
  let parsed: WalkingDirectionsRequest;
  try {
    parsed = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const origin = validateLatLng(parsed?.origin);
  const destination = validateLatLng(parsed?.destination);
  if (!origin || !destination) {
    return jsonResponse({ ok: false, error: "invalid_coordinates" }, 400);
  }

  // Build Kakao request — same shape as the previous client-side calls so
  // existing parsers (routeParsers.parseKakaoWalkingRoute, the Java vertex
  // walker in LocationService.fetchWalkingRoutePoints) keep working.
  const params = new URLSearchParams({
    origin: `${origin.lng},${origin.lat}`,
    destination: `${destination.lng},${destination.lat}`,
    waypoints: "",
    radius: "5000",
    priority: "MAIN_STREET",
    summary: "false",
  });

  let kakaoResponse: Response;
  try {
    kakaoResponse = await fetch(`${KAKAO_WALKING_URL}?${params.toString()}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        service: "hyeni-calendar",
        Authorization: `KakaoAK ${KAKAO_REST_KEY}`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ ok: false, error: "upstream_unreachable", detail: message }, 502);
  }

  // Map Kakao auth failures to 503 so the web client's cooldown latch
  // (kakaoWalkingDirectionsDisabledUntil) keeps triggering on the same
  // status codes it used to receive directly.
  if (kakaoResponse.status === 401 || kakaoResponse.status === 403) {
    return jsonResponse({ ok: false, error: "kakao_auth" }, 503);
  }
  if (!kakaoResponse.ok) {
    return jsonResponse(
      { ok: false, error: `kakao_http_${kakaoResponse.status}` },
      502,
    );
  }

  // Pass Kakao raw JSON through unchanged.
  let payload: unknown;
  try {
    payload = await kakaoResponse.json();
  } catch {
    return jsonResponse({ ok: false, error: "kakao_invalid_json" }, 502);
  }
  return jsonResponse(payload, 200);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  // JWT 검증
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ ok: false, error: "missing_jwt" }, 401);

  const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller, error: callerError } = await callerClient.auth.getUser(jwt);
  if (callerError || !caller?.user?.id) {
    return jsonResponse({ ok: false, error: "invalid_jwt" }, 401);
  }

  // Path-based routing
  const { pathname } = new URL(req.url);
  if (pathname.endsWith("/walking-directions")) {
    return handleWalkingDirections(req);
  }
  return jsonResponse({ ok: false, error: "not_found" }, 404);
});
