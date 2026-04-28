import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function clearLegacyMockStorage() {
  if (typeof window === "undefined" || !window.localStorage) return;
  [
    "hyeni-mock-db-v1",
    "hyeni-mock-session-v1",
    "hyeni-mock-enabled",
    "hyeni-mock-realtime-v1",
  ].forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage cleanup failures
    }
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local and restart the dev server.");
}

clearLegacyMockStorage();

// PKCE is the post-2.x default for supabase-js and is required for the ES256
// JWT path documented in CLAUDE.md (auth.getClaims). Implicit flow (returns
// the access token in the URL fragment) loses refresh tokens through
// Capacitor's deep-link redirect on Android and is deprecated upstream.
// The native callback handler at App.jsx:7074 already supports both flows
// (#access_token=… for legacy sessions still in-flight, ?code=… for PKCE).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
