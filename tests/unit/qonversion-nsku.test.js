// tests/unit/qonversion-nsku.test.js
import { describe, it, expect } from "vitest";
import { childSlotProductId, childSlotEntitlementId } from "../../src/lib/qonversion.js";

describe("Qonversion N-SKU helpers", () => {
  it("slot 1~5 → product id mapping", () => {
    expect(childSlotProductId(1)).toBe("hyeni_child_slot_1");
    expect(childSlotProductId(2)).toBe("hyeni_child_slot_2");
    expect(childSlotProductId(5)).toBe("hyeni_child_slot_5");
  });

  it("slot 1~5 → entitlement id mapping", () => {
    expect(childSlotEntitlementId(1)).toBe("child_active_1");
    expect(childSlotEntitlementId(3)).toBe("child_active_3");
  });

  it("slot 0 또는 6+ → 에러 throw", () => {
    expect(() => childSlotProductId(0)).toThrow();
    expect(() => childSlotProductId(6)).toThrow();
    expect(() => childSlotEntitlementId(0)).toThrow();
  });
});
