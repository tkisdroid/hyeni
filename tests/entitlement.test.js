import { describe, expect, it } from "vitest";
import { canUseFeature, computeTrialDaysLeft, deriveEntitlement } from "../src/lib/entitlement.js";
import { FEATURES } from "../src/lib/features.js";

describe("entitlement helpers", () => {
  it("defaults to free when no subscription row exists", () => {
    expect(deriveEntitlement(null)).toMatchObject({
      tier: "free",
      status: "expired",
      isTrial: false,
      trialDaysLeft: null,
    });
  });

  it("treats active and trial rows as premium", () => {
    expect(deriveEntitlement({ status: "active" }).tier).toBe("premium");
    expect(deriveEntitlement({ status: "trial", trial_ends_at: new Date(Date.now() + 3 * 86400_000).toISOString() })).toMatchObject({
      tier: "premium",
      isTrial: true,
    });
  });

  it("computes remaining trial days", () => {
    const trialEndsAt = new Date(Date.now() + 2.1 * 86400_000).toISOString();
    expect(computeTrialDaysLeft(trialEndsAt)).toBe(3);
  });

  it("only unlocks premium features for premium entitlement", () => {
    const freeEntitlement = deriveEntitlement(null);
    const premiumEntitlement = deriveEntitlement({ status: "active" });
    expect(canUseFeature(freeEntitlement, FEATURES.REMOTE_AUDIO)).toBe(false);
    expect(canUseFeature(premiumEntitlement, FEATURES.REMOTE_AUDIO)).toBe(true);
  });
});
