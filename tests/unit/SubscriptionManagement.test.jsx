// tests/unit/SubscriptionManagement.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubscriptionManagement } from "../../src/components/settings/SubscriptionManagement.jsx";

vi.mock("../../src/lib/childSubscriptions.js", () => ({
  useChildSubscriptions: () => ({
    subs: [{ child_id: "c1", status: "active", price_krw: 1500, product_id: "hyeni_child_slot_1" }],
    refresh: vi.fn(),
  }),
  deriveChildEntitlements: () => ({
    c1: { tier: "premium", priceKrw: 1500 },
    c2: { tier: "free", priceKrw: 0 },
  }),
  totalMonthlyPrice: () => 1500,
}));

vi.mock("../../src/lib/qonversion.js", () => ({
  purchaseChildSlot: vi.fn(),
}));

// id (family_members.id) is the lookup key into ents (= subscriptions.child_id).
// user_id remains as auth identity but is NOT used for entitlement keying.
const children = [
  { id: "c1", user_id: "u1", name: "혜니", birthdate: "2015-03-21", color_hex: "#F779A8", child_order: 1 },
  { id: "c2", user_id: "u2", name: "민준", birthdate: "2018-07-04", color_hex: "#3B82F6", child_order: 2 },
];

describe("SubscriptionManagement (parent)", () => {
  it("자녀 N명 toggle 표시 + 합계", () => {
    render(<SubscriptionManagement role="parent" familyId="f1" childList={children} />);
    expect(screen.getByText("혜니")).toBeInTheDocument();
    expect(screen.getByText("민준")).toBeInTheDocument();
    expect(screen.getAllByText("₩1,500/월").length).toBeGreaterThan(0);
  });
});
