// tests/e2e/_helpers.js
//
// Shared helpers for multichild E2E specs. Mirrors the email-signup + session-
// injection pattern in parent-real.spec.js to bypass Kakao OAuth while still
// hitting real Supabase. Service-role-key seeding requires SUPABASE_SERVICE_ROLE_KEY
// in env; helpers gracefully skip when missing.
//
// Schema notes (verified against supabase/migrations/ on 2026-04-28):
// - families: parent_id (NOT created_by), pair_code REQUIRED, name (added by M7)
// - family_members: birthdate, color_hex, photo_url, child_order (added by M2)
// - subscriptions (M3 multichild): child_id NOT NULL UNIQUE, status, product_id,
//   price_krw — no `tier` column. Legacy family_subscription table also exists.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function projectRefFromUrl(url) {
  const match = /^https?:\/\/([^.]+)\.supabase\.co/i.exec(url || "");
  return match ? match[1] : null;
}

// Generate a fresh KID-prefixed pair code for family seed inserts.
function generatePairCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `KID-${out}`;
}

// Sign up a fresh email parent + inject session into page localStorage.
// Returns the auth response body ({ access_token, refresh_token, user, ... }).
export async function signupParent(page, prefix = "e2e-parent") {
  const ts = Date.now();
  const email = `${prefix}-${ts}@hyeni.test`;
  const password = `E2e-pw-${ts}!`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  if (!body.access_token) throw new Error(`no access_token: ${JSON.stringify(body)}`);
  await injectSession(page, body);
  return { ...body, email, password };
}

// Inject a Supabase session into page localStorage so the app boots authenticated.
// Also seeds `hyeni-my-role` so the role-chooser screen is bypassed and the app
// lands directly in the parent/child surface (matches family-journey-real.spec.js:149).
export async function injectSession(page, session, role = "parent") {
  const projectRef = projectRefFromUrl(SUPABASE_URL);
  if (!projectRef) throw new Error("could not derive project ref");
  await page.addInitScript(({ key, value, role }) => {
    window.localStorage.setItem(key, value);
    window.localStorage.setItem("hyeni-my-role", role);
    window.sessionStorage.setItem("hyeni-my-role", role);
  }, {
    key: `sb-${projectRef}-auth-token`,
    value: JSON.stringify(session),
    role,
  });
}

// REST helper using service role to seed legacy data. Throws if SR key missing.
async function srFetch(path, init = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set in env — legacy seed helpers unavailable");
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`SR ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

// Seeds: parent + 1 child + active per-child subscription (grandfather scenario).
// Returns { parent_email, parent_password, parent_user_id, child_id, family_id }.
export async function seedLegacyFamilyWithSubscription() {
  const parent = await signupParentDirect();
  const family = await srFetch(`/rest/v1/families`, {
    method: "POST",
    body: JSON.stringify({
      name: "테스트네",
      parent_id: parent.user_id,
      pair_code: generatePairCode(),
    }),
  });
  const family_id = family[0].id;
  await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({ family_id, user_id: parent.user_id, role: "parent" }),
  });
  const child = await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({
      family_id, user_id: null, role: "child", child_order: 1,
      name: "혜니", color_hex: "#F779A8", birthdate: "2015-03-21",
    }),
  });
  // Insert active subscription tied to child (multichild M3 schema).
  await srFetch(`/rest/v1/subscriptions`, {
    method: "POST",
    body: JSON.stringify({
      family_id,
      child_id: child[0].id,
      status: "active",
      product_id: "hyeni_child_slot_1",
      price_krw: 1500,
    }),
  });
  return {
    parent_email: parent.email, parent_password: parent.password,
    parent_user_id: parent.user_id, child_id: child[0].id, family_id,
  };
}

// Seeds: parent + 2 children (child_order 1 & 2) + active subscription on child 1.
// Per multichild migration M3 grandfather rule: first child gets active, second is free.
export async function seedLegacy2ChildFamilyWithSubscription() {
  const parent = await signupParentDirect();
  const family = await srFetch(`/rest/v1/families`, {
    method: "POST",
    body: JSON.stringify({
      name: "테스트네",
      parent_id: parent.user_id,
      pair_code: generatePairCode(),
    }),
  });
  const family_id = family[0].id;
  await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({ family_id, user_id: parent.user_id, role: "parent" }),
  });
  const c1 = await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({
      family_id, user_id: null, role: "child", child_order: 1,
      name: "혜니", color_hex: "#F779A8", birthdate: "2015-03-21",
    }),
  });
  const c2 = await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({
      family_id, user_id: null, role: "child", child_order: 2,
      name: "민준", color_hex: "#7DC9F1", birthdate: "2018-07-04",
    }),
  });
  await srFetch(`/rest/v1/subscriptions`, {
    method: "POST",
    body: JSON.stringify({
      family_id,
      child_id: c1[0].id,
      status: "active",
      product_id: "hyeni_child_slot_1",
      price_krw: 1500,
    }),
  });
  return {
    parent_email: parent.email, parent_password: parent.password,
    parent_user_id: parent.user_id,
    child1_id: c1[0].id, child2_id: c2[0].id, family_id,
  };
}

// Seeds family with 2 children but no subscription. Used to verify add/remove totals.
export async function seedFamilyWith2Children() {
  const parent = await signupParentDirect();
  const family = await srFetch(`/rest/v1/families`, {
    method: "POST",
    body: JSON.stringify({
      name: "테스트네",
      parent_id: parent.user_id,
      pair_code: generatePairCode(),
    }),
  });
  const family_id = family[0].id;
  await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({ family_id, user_id: parent.user_id, role: "parent" }),
  });
  const c1 = await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({
      family_id, user_id: null, role: "child", child_order: 1,
      name: "혜니", color_hex: "#F779A8", birthdate: "2015-03-21",
    }),
  });
  const c2 = await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({
      family_id, user_id: null, role: "child", child_order: 2,
      name: "민준", color_hex: "#7DC9F1", birthdate: "2018-07-04",
    }),
  });
  return {
    parent_email: parent.email, parent_password: parent.password,
    parent_user_id: parent.user_id,
    child1_id: c1[0].id, child2_id: c2[0].id, family_id,
  };
}

// Seeds family with 3 children (no subscription). Used by pairing-3child UI spec
// to verify multi-child mode (≥2 children) home-tab + per-child cards behavior
// without going through the wizard (which can't run under email-auth E2E).
export async function seedFamilyWith3Children() {
  const parent = await signupParentDirect();
  const family = await srFetch(`/rest/v1/families`, {
    method: "POST",
    body: JSON.stringify({
      name: "테스트네",
      parent_id: parent.user_id,
      pair_code: generatePairCode(),
    }),
  });
  const family_id = family[0].id;
  await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({ family_id, user_id: parent.user_id, role: "parent" }),
  });
  const kids = [
    ["혜니", "2015-03-21", "#F779A8"],
    ["민준", "2018-07-04", "#7DC9F1"],
    ["세진", "2020-11-09", "#10B981"],
  ];
  const inserted = [];
  for (let i = 0; i < kids.length; i++) {
    const [name, birthdate, color_hex] = kids[i];
    const row = await srFetch(`/rest/v1/family_members`, {
      method: "POST",
      body: JSON.stringify({
        family_id, user_id: null, role: "child",
        child_order: i + 1, name, color_hex, birthdate,
      }),
    });
    inserted.push(row[0]);
  }
  return {
    parent_email: parent.email, parent_password: parent.password,
    parent_user_id: parent.user_id, family_id,
    child1_id: inserted[0].id, child2_id: inserted[1].id, child3_id: inserted[2].id,
  };
}

// Seeds family with 1 child, no subscription.
export async function seedLegacyFamily() {
  const parent = await signupParentDirect();
  const family = await srFetch(`/rest/v1/families`, {
    method: "POST",
    body: JSON.stringify({
      name: "테스트네",
      parent_id: parent.user_id,
      pair_code: generatePairCode(),
    }),
  });
  const family_id = family[0].id;
  await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({ family_id, user_id: parent.user_id, role: "parent" }),
  });
  const c = await srFetch(`/rest/v1/family_members`, {
    method: "POST",
    body: JSON.stringify({
      family_id, user_id: null, role: "child", child_order: 1,
      name: "혜니", color_hex: "#F779A8", birthdate: "2015-03-21",
    }),
  });
  return {
    parent_email: parent.email, parent_password: parent.password,
    parent_user_id: parent.user_id, child_id: c[0].id, family_id,
  };
}

// Sign in an existing parent (created via seed*) by email/password and inject session.
export async function loginAsExistingParent(page, parent_email, parent_password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: parent_email, password: parent_password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  await injectSession(page, body);
  return body;
}

// Sign in as anonymous child given a child family_member id.
// Uses the existing pair-code → anon signup flow if no direct child user exists,
// or returns null when the test only needs to verify parent-side state.
export async function loginAsChild(page, child_id) {
  // Anon child users are typically created via app pairing flow. For E2E,
  // use Supabase anon signin with a synthetic identifier.
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({}),  // anonymous signup
  });
  if (!res.ok) throw new Error(`anon signup failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  // Bind anon user to the seeded child_id slot via service role.
  if (SUPABASE_SERVICE_ROLE_KEY) {
    await srFetch(`/rest/v1/family_members?id=eq.${child_id}`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: body.user.id }),
    });
  }
  await injectSession(page, body, "child");
  return body;
}

// Counts rows in a table matching a filter clause (PostgREST syntax).
// Example: getDbRowCount("events_children", "event_id=eq.<uuid>")
export async function getDbRowCount(table, filter = "") {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=count${filter ? "&" + filter : ""}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY}`,
      Prefer: "count=exact",
    },
  });
  if (!res.ok) throw new Error(`count ${table}: ${res.status} ${await res.text()}`);
  const cnt = res.headers.get("content-range")?.split("/")?.[1];
  return Number.parseInt(cnt || "0", 10);
}

// Internal: fresh email parent signup (returns auth body + email/password)
async function signupParentDirect() {
  const ts = Date.now() + Math.floor(Math.random() * 10000);
  const email = `e2e-seed-${ts}@hyeni.test`;
  const password = `E2e-pw-${ts}!`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return { ...body, email, password, user_id: body.user.id };
}
