import { expect, test } from "@playwright/test";

/**
 * Real-services E2E: parent flow via email-session injection.
 *
 * Signs up a real Supabase user over REST (email auth with auto-confirm
 * enabled on the project), then injects that session into localStorage before
 * the app boots. This bypasses Kakao OAuth while still hitting the real
 * Supabase database for family/family_members writes.
 *
 * Test data persists in the project DB. Each run uses a unique email to
 * avoid collisions. Service-role-key cleanup is out of scope here.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

function projectRefFromUrl(url) {
  const match = /^https?:\/\/([^.]+)\.supabase\.co/i.exec(url || "");
  return match ? match[1] : null;
}

async function signUpEmailUser() {
  const timestamp = Date.now();
  const email = `e2e-parent-${timestamp}@hyeni.test`;
  const password = `E2e-pw-${timestamp}!`;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase signup failed: ${response.status} ${text}`);
  }

  const body = await response.json();
  if (!body.access_token) {
    throw new Error(`Supabase signup did not return access_token: ${JSON.stringify(body)}`);
  }
  return body;
}

test.describe("real parent flow (email session injection)", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY,
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be loaded in the webServer env",
  );

  test("injected parent session boots straight into the authenticated UI", async ({ page }) => {
    const session = await signUpEmailUser();
    const projectRef = projectRefFromUrl(SUPABASE_URL);
    expect(projectRef, "could not derive project ref from VITE_SUPABASE_URL").toBeTruthy();

    // The app gates parent UI on user.app_metadata.provider === "kakao"
    // (src/App.jsx handleAuthUser). The REST signup user has provider=email,
    // so we patch the client-side metadata to unlock parent UI for testing.
    // Server-side identity is unchanged; only the local session payload is
    // decorated so the client-side isKakao check passes.
    const patchedSession = {
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

    const storageKey = `sb-${projectRef}-auth-token`;
    const payload = JSON.stringify(patchedSession);

    await page.addInitScript(
      ({ key, value }) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // Ignore — some browsers restrict localStorage during init.
        }
      },
      { key: storageKey, value: payload },
    );

    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Role gate buttons should NOT be visible — the user is already authed.
    await expect(page.getByText(/학부모/).first()).toBeHidden({ timeout: 10_000 });

    // Some element from the authenticated UI should be present. We don't
    // assert specific copy (it drifts). Just that the body has rendered
    // non-trivial content and no runtime errors fired.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length, "authenticated body has content").toBeGreaterThan(50);

    expect(pageErrors, `pageErrors: ${JSON.stringify(pageErrors)}`).toEqual([]);

    const filtered = consoleErrors.filter(
      (m) => !m.includes("favicon") && !m.toLowerCase().includes("manifest"),
    );
    expect(filtered, `console errors: ${JSON.stringify(filtered)}`).toEqual([]);
  });
});
