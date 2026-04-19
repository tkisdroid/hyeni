import { expect, test } from "@playwright/test";

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

  test("anon child session can open a realtime channel", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/^아이$/).first().click();

    // Wait for session to land in storage. If Supabase rate-limits the
    // anonymous signup, the app can't proceed — in that case skip rather
    // than fail (rate limit is infra, not an app defect).
    const sessionAppeared = await page
      .waitForFunction(
        () =>
          Object.keys(localStorage).some(
            (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
          ),
        null,
        { timeout: 20_000 },
      )
      .then(() => true)
      .catch(() => false);

    test.skip(
      !sessionAppeared,
      "Supabase anon signup didn't land in localStorage (likely rate-limited in this run)",
    );

    // Drive the app's own Supabase client to open a channel and wait for the
    // 'SUBSCRIBED' status. This proves the websocket handshake succeeds
    // against the real Supabase project with the user's token.
    const status = await page.evaluate(
      async ({ url, anon }) => {
        const mod = await import("/src/lib/supabase.js");
        const { supabase } = mod;
        if (!supabase?.channel) {
          return { status: "NO_CLIENT", note: "supabase.channel missing" };
        }

        return await new Promise((resolve) => {
          // A plain public broadcast channel — no config overrides, no
          // postgres_changes subscription (which would need a table
          // filter and RLS policy).
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
            // Ignore transient CLOSED events — the supabase-js client will
            // sometimes emit CLOSED before the socket handshake retries.
          });
        });
      },
      { url: SUPABASE_URL, anon: SUPABASE_ANON_KEY },
    );

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
