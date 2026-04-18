import { afterEach, describe, expect, it, vi } from "vitest";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createLegacySupabase(initialFamilies = []) {
  const state = {
    families: initialFamilies.map((row) => clone(row)),
  };

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every((filter) => String(row?.[filter.column]) === String(filter.value))
    );
  }

  function createBuilder(table, mode, patch = null) {
    const filters = [];

    return {
      eq(column, value) {
        filters.push({ column, value });
        return this;
      },
      limit() {
        return this;
      },
      select() {
        return this;
      },
      async maybeSingle() {
        if (table !== "families") {
          return { data: null, error: new Error(`Unsupported table: ${table}`) };
        }

        if (mode === "select") {
          const matched = applyFilters(state.families, filters);
          return { data: matched[0] ? clone(matched[0]) : null, error: null };
        }

        if (mode === "update") {
          const matched = applyFilters(state.families, filters);
          if (!matched[0]) {
            return { data: null, error: null };
          }

          const index = state.families.findIndex((row) => row.id === matched[0].id);
          state.families[index] = {
            ...state.families[index],
            ...clone(patch),
          };
          return { data: clone(state.families[index]), error: null };
        }

        return { data: null, error: new Error(`Unsupported mode: ${mode}`) };
      },
    };
  }

  return {
    __state: state,
    from(table) {
      return {
        select() {
          return createBuilder(table, "select");
        },
        update(patch) {
          return createBuilder(table, "update", patch);
        },
      };
    },
  };
}

async function importQonversionWithSupabase(fakeSupabase) {
  vi.resetModules();
  vi.doMock("../src/lib/supabase.js", () => ({
    supabase: fakeSupabase,
  }));
  return import("../src/lib/qonversion.js");
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("../src/lib/supabase.js");
});

describe("qonversion helpers", () => {
  it("builds a Google Play manage-subscription link with the real app package", async () => {
    const { manageSubscriptionLink } = await import("../src/lib/qonversion.js");

    expect(manageSubscriptionLink("premium_yearly")).toBe(
      "https://play.google.com/store/account/subscriptions?package=com.hyeni.calendar&sku=premium_yearly"
    );
  });

  it("falls back to the subscriptions center when no product is provided", async () => {
    const { manageSubscriptionLink } = await import("../src/lib/qonversion.js");

    expect(manageSubscriptionLink("")).toBe(
      "https://play.google.com/store/account/subscriptions?package=com.hyeni.calendar"
    );
  });

  it("maps a legacy premium family row to an active entitlement", async () => {
    const { normalizeLegacyFamilyEntitlement } = await import("../src/lib/qonversion.js");

    expect(normalizeLegacyFamilyEntitlement({ user_tier: "premium" })).toMatchObject({
      isActive: true,
      isTrial: false,
      status: "active",
      tier: "premium",
      source: "legacy_family_tier",
    });
    expect(normalizeLegacyFamilyEntitlement({ user_tier: "free" })).toBeNull();
  });

  it("reads a premium legacy family tier when the new subscription table is unavailable", async () => {
    const fakeSupabase = createLegacySupabase([
      {
        id: "family-legacy-read",
        user_tier: "premium",
      },
    ]);
    const { checkEntitlements } = await importQonversionWithSupabase(fakeSupabase);

    const entitlement = await checkEntitlements("family-legacy-read");

    expect(entitlement).toMatchObject({
      isActive: true,
      isTrial: false,
      status: "active",
      tier: "premium",
      source: "legacy_family_tier",
    });
  });

  it("activates premium by updating families.user_tier in the legacy backend path", async () => {
    const fakeSupabase = createLegacySupabase([
      {
        id: "family-legacy-purchase",
        user_tier: "free",
      },
    ]);
    const { purchase, restore } = await importQonversionWithSupabase(fakeSupabase);

    const result = await purchase("premium_monthly", { familyId: "family-legacy-purchase" });
    const restored = await restore("family-legacy-purchase");

    expect(result).toMatchObject({
      success: true,
      status: "active",
      isTrial: false,
      source: "legacy_family_tier",
    });
    expect(fakeSupabase.__state.families[0]).toMatchObject({
      id: "family-legacy-purchase",
      user_tier: "premium",
    });
    expect(restored).toMatchObject({
      isActive: true,
      status: "active",
      tier: "premium",
      source: "legacy_family_tier",
    });
  });
});
