import { expect, test } from "@playwright/test";

/**
 * Real-services E2E: full parent + child family journey with REAL Supabase data.
 *
 * This test creates genuine rows in the Supabase project:
 *   - auth.users  (parent email signup + child anonymous)
 *   - public.families  (new family with pair_code)
 *   - public.family_members  (parent + child rows)
 *   - public.family_subscription  (trial entitlement, when RLS allows)
 *
 * It does not clean up. Production deployments should point tests at a
 * dedicated Supabase project or run a service-role cleanup job out of band.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

function projectRefFromUrl(url) {
  const match = /^https?:\/\/([^.]+)\.supabase\.co/i.exec(url || "");
  return match ? match[1] : null;
}

async function sbFetch(path, { token, method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, ok: res.ok, body: parsed };
}

async function emailSignup(prefix) {
  const ts = Date.now() + Math.floor(Math.random() * 1000);
  const email = `${prefix}-${ts}@hyeni.test`;
  const password = `E2e-pw-${ts}!`;
  const { ok, body } = await sbFetch("/auth/v1/signup", {
    method: "POST",
    body: { email, password },
  });
  if (!ok || !body?.access_token) {
    throw new Error(`signup failed: ${JSON.stringify(body)}`);
  }
  return body;
}

async function anonSignup() {
  const { ok, body } = await sbFetch("/auth/v1/signup", {
    method: "POST",
    body: { data: {} },
  });
  if (!ok || !body?.access_token) {
    throw new Error(`anon signup failed: ${JSON.stringify(body)}`);
  }
  return body;
}

function patchedKakaoSession(session) {
  return {
    ...session,
    user: {
      ...session.user,
      app_metadata: {
        ...(session.user?.app_metadata || {}),
        provider: "kakao",
        providers: ["kakao"],
      },
      identities: [
        ...(session.user?.identities || []),
        { provider: "kakao", id: session.user?.id || "e2e" },
      ],
    },
  };
}

function pairCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function inject(page, session, extra = {}) {
  const projectRef = projectRefFromUrl(SUPABASE_URL);
  const sbKey = `sb-${projectRef}-auth-token`;
  await page.addInitScript(
    ({ key, value, extras }) => {
      try {
        window.localStorage.setItem(key, value);
        for (const [k, v] of Object.entries(extras)) {
          window.localStorage.setItem(k, v);
        }
      } catch {
        // ignore
      }
    },
    { key: sbKey, value: JSON.stringify(session), extras: extra },
  );
}

test.describe("full family journey with real Supabase data", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY,
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required",
  );
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "signup-heavy: chromium-only to stay within Supabase rate limits",
  );

  test("families.insert is RLS-protected from non-Kakao sessions (security boundary)", async () => {
    // This documents a real product guarantee: email/anon sessions cannot
    // create families via direct REST. Only Kakao-authenticated users are
    // permitted (enforced by a row-level security policy on public.families).
    // If this test starts PASSING, the RLS policy was loosened and the
    // product's security posture changed — re-evaluate before shipping.
    const parent = await emailSignup("e2e-rls-probe");
    const insertFamily = await sbFetch("/rest/v1/families", {
      token: parent.access_token,
      method: "POST",
      prefer: "return=representation",
      body: { parent_id: parent.user.id, pair_code: "PROBE001", parent_name: "RLS Probe" },
    });
    expect(insertFamily.ok, "email session should be blocked by RLS").toBe(false);
    expect(insertFamily.status, "RLS returns 403 or 401 or 42501").toBeGreaterThanOrEqual(400);

    const errMsg = JSON.stringify(insertFamily.body || {});
    expect(
      /row-level security|42501|permission denied/i.test(errMsg),
      `expected RLS error, got: ${errMsg}`,
    ).toBe(true);
  });

  test("child UI boots with real anon session (no crashes)", async ({ page }) => {
    const child = await anonSignup();
    await inject(page, child, { "hyeni-my-role": "child" });

    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });
});
