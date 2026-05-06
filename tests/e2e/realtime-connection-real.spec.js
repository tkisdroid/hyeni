import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Real-services E2E: Supabase realtime connection.
 *
 * Verifies the app can establish a realtime WebSocket channel against the
 * live Supabase project, as a smoke test for the infrastructure the app
 * uses for parent↔child cross-device messaging.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

test.describe("supabase realtime connectivity", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY,
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required",
  );
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "signup-heavy: chromium-only to stay within Supabase rate limits",
  );

  test("anon child session can open a realtime channel", async () => {
    const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });
    if (signup.status === 429) {
      test.skip(true, "Supabase anon signup rate-limited in this run");
    }
    const signupText = await signup.text();
    expect(signup.ok, `anon signup: ${signupText}`).toBe(true);
    const session = JSON.parse(signupText);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    });

    const status = await new Promise((resolve) => {
      const channel = supabase.channel(`e2e-probe-${Date.now()}`);
      const timeout = setTimeout(() => {
        try { supabase.removeChannel(channel); } catch {}
        resolve({ status: "TIMED_OUT" });
      }, 20_000);

      channel.subscribe((s, err) => {
        if (s === "SUBSCRIBED") {
          clearTimeout(timeout);
          try { supabase.removeChannel(channel); } catch {}
          resolve({ status: "SUBSCRIBED" });
        } else if (s === "CHANNEL_ERROR") {
          clearTimeout(timeout);
          try { supabase.removeChannel(channel); } catch {}
          resolve({ status: s, error: err?.message || String(err || "") });
        }
      });
    });

    expect(
      status.status,
      `realtime channel never reached SUBSCRIBED: ${JSON.stringify(status)}`,
    ).toBe("SUBSCRIBED");
  });

  test("events.insert is RLS-blocked for unauth'd anonymous sessions (security boundary)", async () => {
    // Anonymous child sessions without family membership should not be able
    // to insert into events. If this starts passing, RLS was loosened.
    const sb = async (path, { method = "GET", body } = {}) => {
      const res = await fetch(`${SUPABASE_URL}${path}`, {
        method,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { status: res.status, ok: res.ok, body: parsed };
    };

    const anon = await sb("/auth/v1/signup", { method: "POST", body: { data: {} } });
    if (anon.status === 429) {
      test.skip(true, "Supabase signup rate-limited; retry later to exercise this RLS probe");
    }
    expect(anon.ok, `anon signup: ${JSON.stringify(anon.body)}`).toBe(true);
    const token = anon.body.access_token;

    const ins = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        family_id: "00000000-0000-4000-8000-00000000eeee",
        sender_user_id: anon.body.user.id,
        date_key: new Date().toISOString().slice(0, 10),
        title: "probe",
      }),
    });
    expect(ins.ok, `unprivileged events insert should fail`).toBe(false);
    expect(ins.status).toBeGreaterThanOrEqual(400);
  });
});
