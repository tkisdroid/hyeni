import { describe, expect, it } from "vitest";
import { manageSubscriptionLink } from "../src/lib/qonversion.js";

describe("qonversion helpers", () => {
  it("builds a Google Play manage-subscription link with the real app package", () => {
    expect(manageSubscriptionLink("premium_yearly")).toBe(
      "https://play.google.com/store/account/subscriptions?package=com.hyeni.calendar&sku=premium_yearly"
    );
  });

  it("falls back to the subscriptions center when no product is provided", () => {
    expect(manageSubscriptionLink("")).toBe(
      "https://play.google.com/store/account/subscriptions?package=com.hyeni.calendar"
    );
  });
});
