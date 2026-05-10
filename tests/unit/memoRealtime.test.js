import { describe, it, expect } from "vitest";
import { buildMemoChannelKey, isMemoForSelectedChild } from "../../src/lib/memoRealtime.js";

describe("memo realtime channel key", () => {
  it("includes familyId and selectedChildId", () => {
    expect(buildMemoChannelKey("fam-1", "child-A"))
      .toBe("family:fam-1:child:child-A");
  });
  it("returns null when familyId missing", () => {
    expect(buildMemoChannelKey(null, "child-A")).toBeNull();
  });
  it("returns null when selectedChildId missing", () => {
    expect(buildMemoChannelKey("fam-1", null)).toBeNull();
  });
});

describe("isMemoForSelectedChild — client-side isolation filter", () => {
  it("returns true when row.user_id matches selectedChild user_id", () => {
    const row = { user_id: "child-user-1", user_role: "child" };
    expect(isMemoForSelectedChild(row, "child-user-1", "parent-user-1")).toBe(true);
  });
  it("returns true when row from parent (so child sees parent reply too)", () => {
    const row = { user_id: "parent-user-1", user_role: "parent" };
    expect(isMemoForSelectedChild(row, "child-user-1", "parent-user-1")).toBe(true);
  });
  it("returns false when row from another child", () => {
    const row = { user_id: "child-user-2", user_role: "child" };
    expect(isMemoForSelectedChild(row, "child-user-1", "parent-user-1")).toBe(false);
  });
  it("returns false when both ids null", () => {
    const row = { user_id: "x", user_role: "child" };
    expect(isMemoForSelectedChild(row, null, null)).toBe(false);
  });
  it("legacy row (user_id null) ignored", () => {
    const row = { user_id: null, user_role: "legacy" };
    expect(isMemoForSelectedChild(row, "child-user-1", "parent-user-1")).toBe(false);
  });
});
