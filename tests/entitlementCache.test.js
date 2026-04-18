import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearEntitlementCache, readEntitlementCache, writeEntitlementCache } from "../src/lib/entitlementCache.js";

describe("entitlement cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearEntitlementCache();
  });

  it("reads back a cached value before ttl expires", () => {
    const payload = { tier: "premium", status: "trial" };
    writeEntitlementCache("family-1", payload);
    expect(readEntitlementCache("family-1")).toEqual(payload);
  });

  it("expires values after the ttl window", () => {
    writeEntitlementCache("family-1", { tier: "premium", status: "trial" });
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);
    expect(readEntitlementCache("family-1")).toBeNull();
  });
});
