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

describe("isMemoForSelectedChild — child_id based isolation filter", () => {
  it("matches when row.child_id === selectedChildId", () => {
    expect(isMemoForSelectedChild({ child_id: "c1" }, "c1")).toBe(true);
  });
  it("rejects when row.child_id !== selectedChildId", () => {
    expect(isMemoForSelectedChild({ child_id: "c1" }, "c2")).toBe(false);
  });
  it("rejects legacy null child_id (정책 B — 정확 분리)", () => {
    expect(isMemoForSelectedChild({ child_id: null }, "c1")).toBe(false);
  });
  it("returns false when selectedChildId missing", () => {
    expect(isMemoForSelectedChild({ child_id: "c1" }, null)).toBe(false);
  });
  it("returns false when row is null", () => {
    expect(isMemoForSelectedChild(null, "c1")).toBe(false);
  });
  it("returns false when both null", () => {
    expect(isMemoForSelectedChild({ child_id: null }, null)).toBe(false);
  });
});
