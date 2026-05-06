import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveParentCapabilities } from "../src/lib/parentCapabilities.js";

// ── Plan-mandated contract test ──────────────────────────────────────────────
describe("family role metadata contract", () => {
  it("treats a parent member whose id differs from primaryParentId as co-parent", () => {
    const familyInfo = {
      familyId: "family-1",
      primaryParentId: "mom",
      myRole: "parent",
      members: [
        { user_id: "mom", role: "parent" },
        { user_id: "dad", role: "parent" },
      ],
    };

    const result = deriveParentCapabilities(familyInfo, { id: "dad" }, "parent");

    expect(result.isCoParent).toBe(true);
    expect(result.canWriteSchedule).toBe(false);
  });
});

// ── getMyFamily integration with mocked supabase client ──────────────────────
describe("getMyFamily exposes primary-parent metadata", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function buildFamilySelectChain(family) {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: family, error: null })),
          })),
          single: vi.fn(async () => ({ data: family, error: null })),
        })),
      })),
    };
  }

  function buildMembershipSelectChain(membership) {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: membership, error: null })),
          })),
        })),
      })),
    };
  }

  function buildMembersSelectChain(members) {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: members, error: null })),
      })),
    };
  }

  it("returns primaryParentId/isPrimaryParent/isCoParent for the primary-parent branch", async () => {
    const userId = "mom";
    const family = {
      id: "family-1",
      parent_id: "mom",
      pair_code: "KID-ABCD1234",
      parent_name: "엄마",
      mom_phone: "01012345678",
      dad_phone: "",
      pair_code_expires_at: null,
    };
    const members = [
      { id: "m1", user_id: "mom", role: "parent", name: "엄마" },
    ];

    const fromMock = vi.fn((table) => {
      if (table === "family_members") {
        // First call: membership lookup (none → forces parent-id branch)
        // Second call: members listing
        if (fromMock.mock.calls.length === 1) {
          return buildMembershipSelectChain(null);
        }
        return buildMembersSelectChain(members);
      }
      if (table === "families") {
        return buildFamilySelectChain(family);
      }
      throw new Error(`unexpected table: ${table}`);
    });

    vi.doMock("../src/lib/supabase.js", () => ({
      supabase: { from: fromMock, auth: {} },
    }));

    const { getMyFamily } = await import("../src/lib/auth.js");
    const result = await getMyFamily(userId);

    expect(result.primaryParentId).toBe("mom");
    expect(result.isPrimaryParent).toBe(true);
    expect(result.isCoParent).toBe(false);
    expect(result.members).toEqual(members);
    expect(result.myRole).toBe("parent");
  });

  it("flags a co-parent (membership branch) when family.parent_id != userId", async () => {
    const userId = "dad";
    const membership = { family_id: "family-1", role: "parent", name: "아빠" };
    const family = {
      id: "family-1",
      parent_id: "mom",
      pair_code: "KID-ABCD1234",
      parent_name: "엄마",
      mom_phone: "01011112222",
      dad_phone: "01033334444",
      pair_code_expires_at: null,
    };
    const members = [
      { id: "m1", user_id: "mom", role: "parent", name: "엄마" },
      { id: "m2", user_id: "dad", role: "parent", name: "아빠" },
    ];

    const fromMock = vi.fn((table) => {
      if (table === "family_members") {
        if (fromMock.mock.calls.length === 1) {
          return buildMembershipSelectChain(membership);
        }
        return buildMembersSelectChain(members);
      }
      if (table === "families") {
        return buildFamilySelectChain(family);
      }
      throw new Error(`unexpected table: ${table}`);
    });

    vi.doMock("../src/lib/supabase.js", () => ({
      supabase: { from: fromMock, auth: {} },
    }));

    const { getMyFamily } = await import("../src/lib/auth.js");
    const result = await getMyFamily(userId);

    expect(result.primaryParentId).toBe("mom");
    expect(result.isPrimaryParent).toBe(false);
    expect(result.isCoParent).toBe(true);
    expect(result.myRole).toBe("parent");
    expect(result.members).toEqual(members);
  });

  it("infers primary parent for legacy membership payloads that omit family.parent_id when only one parent member exists", async () => {
    const userId = "mom";
    const membership = { family_id: "family-1", role: "parent", name: "엄마" };
    const family = {
      id: "family-1",
      pair_code: "KID-ABCD1234",
      parent_name: "엄마",
      mom_phone: "01011112222",
      dad_phone: "",
      pair_code_expires_at: null,
    };
    const members = [
      { id: "m1", user_id: "mom", role: "parent", name: "엄마" },
      { id: "m2", user_id: "kid", role: "child", name: "아이" },
    ];

    const fromMock = vi.fn((table) => {
      if (table === "family_members") {
        if (fromMock.mock.calls.length === 1) {
          return buildMembershipSelectChain(membership);
        }
        return buildMembersSelectChain(members);
      }
      if (table === "families") {
        return buildFamilySelectChain(family);
      }
      throw new Error(`unexpected table: ${table}`);
    });

    vi.doMock("../src/lib/supabase.js", () => ({
      supabase: { from: fromMock, auth: {} },
    }));

    const { getMyFamily } = await import("../src/lib/auth.js");
    const result = await getMyFamily(userId);

    expect(result.primaryParentId).toBe("mom");
    expect(result.isPrimaryParent).toBe(true);
    expect(result.isCoParent).toBe(false);
    expect(result.myRole).toBe("parent");
  });

  it("does not flag a child member as co-parent", async () => {
    const userId = "kid";
    const membership = { family_id: "family-1", role: "child", name: "아이" };
    const family = {
      id: "family-1",
      parent_id: "mom",
      pair_code: "KID-ABCD1234",
      parent_name: "엄마",
      mom_phone: "",
      dad_phone: "",
      pair_code_expires_at: null,
    };
    const members = [
      { id: "m1", user_id: "mom", role: "parent", name: "엄마" },
      { id: "m2", user_id: "kid", role: "child", name: "아이" },
    ];

    const fromMock = vi.fn((table) => {
      if (table === "family_members") {
        if (fromMock.mock.calls.length === 1) {
          return buildMembershipSelectChain(membership);
        }
        return buildMembersSelectChain(members);
      }
      if (table === "families") {
        return buildFamilySelectChain(family);
      }
      throw new Error(`unexpected table: ${table}`);
    });

    vi.doMock("../src/lib/supabase.js", () => ({
      supabase: { from: fromMock, auth: {} },
    }));

    const { getMyFamily } = await import("../src/lib/auth.js");
    const result = await getMyFamily(userId);

    expect(result.myRole).toBe("child");
    expect(result.isPrimaryParent).toBe(false);
    expect(result.isCoParent).toBe(false);
    expect(result.primaryParentId).toBe("mom");
  });

  it("reuses child photo signed URLs for the same storage path during repeated family refreshes", async () => {
    const userId = "mom";
    const membership = { family_id: "family-1", role: "parent", name: "엄마" };
    const family = {
      id: "family-1",
      parent_id: "mom",
      pair_code: "KID-ABCD1234",
      parent_name: "엄마",
      mom_phone: "",
      dad_phone: "",
      pair_code_expires_at: null,
    };
    const members = [
      { id: "m1", user_id: "mom", role: "parent", name: "엄마" },
      { id: "m2", user_id: "kid", role: "child", name: "아이", photo_url: "family-1/child-1.jpg" },
    ];
    const createSignedUrl = vi.fn(async (path) => ({
      data: { signedUrl: `https://signed.example/${path}?token=one` },
      error: null,
    }));
    let familyMemberQueryCount = 0;

    const fromMock = vi.fn((table) => {
      if (table === "family_members") {
        familyMemberQueryCount += 1;
        return familyMemberQueryCount % 2 === 1
          ? buildMembershipSelectChain(membership)
          : buildMembersSelectChain(members);
      }
      if (table === "families") {
        return buildFamilySelectChain(family);
      }
      throw new Error(`unexpected table: ${table}`);
    });

    vi.doMock("../src/lib/supabase.js", () => ({
      supabase: {
        from: fromMock,
        auth: {},
        storage: { from: () => ({ createSignedUrl }) },
      },
    }));

    const { getMyFamily } = await import("../src/lib/auth.js");
    const first = await getMyFamily(userId);
    const second = await getMyFamily(userId);

    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(first.members[1].photo_url).toBe("https://signed.example/family-1/child-1.jpg?token=one");
    expect(second.members[1].photo_url).toBe(first.members[1].photo_url);
  });
});
