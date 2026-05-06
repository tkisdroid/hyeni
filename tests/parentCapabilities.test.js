import { describe, expect, it } from "vitest";
import { deriveParentCapabilities } from "../src/lib/parentCapabilities.js";

describe("deriveParentCapabilities", () => {
  const baseFamily = {
    familyId: "family-1",
    primaryParentId: "mom",
    myRole: "parent",
    members: [
      { user_id: "mom", role: "parent", name: "엄마" },
      { user_id: "dad", role: "parent", name: "아빠" },
      { user_id: "child", role: "child", name: "혜니" },
    ],
  };

  it("grants full control only to the primary parent", () => {
    const result = deriveParentCapabilities(baseFamily, { id: "mom" }, "parent");

    expect(result.isPrimaryParent).toBe(true);
    expect(result.isCoParent).toBe(false);
    expect(result.canWriteSchedule).toBe(true);
    expect(result.canManageFamily).toBe(true);
    expect(result.canSendMemo).toBe(true);
    expect(result.canGivePraiseSticker).toBe(true);
    expect(result.canReceiveSos).toBe(true);
    expect(result.canReceiveKkuk).toBe(true);
  });

  it("limits the co-parent to read, memo, praise sticker, and SOS receipt", () => {
    const result = deriveParentCapabilities(baseFamily, { id: "dad" }, "parent");

    expect(result.isPrimaryParent).toBe(false);
    expect(result.isCoParent).toBe(true);
    expect(result.canWriteSchedule).toBe(false);
    expect(result.canManageFamily).toBe(false);
    expect(result.canSendMemo).toBe(true);
    expect(result.canGivePraiseSticker).toBe(true);
    expect(result.canReceiveSos).toBe(true);
    expect(result.canReceiveKkuk).toBe(false);
  });

  it("keeps primary-parent controls when older family payloads omit parent id but only one parent member exists", () => {
    const result = deriveParentCapabilities(
      {
        familyId: "family-legacy",
        myRole: "parent",
        members: [
          { user_id: "mom", role: "parent", name: "엄마" },
          { user_id: "child", role: "child", name: "혜니" },
        ],
      },
      { id: "mom" },
      "parent",
    );

    expect(result.isPrimaryParent).toBe(true);
    expect(result.isCoParent).toBe(false);
    expect(result.canRequestChildLocation).toBe(true);
    expect(result.canUseRemoteListen).toBe(true);
    expect(result.canUseForceRing).toBe(true);
  });

  it("does not infer primary-parent controls for an explicit co-parent payload", () => {
    const result = deriveParentCapabilities(
      {
        familyId: "family-coparent",
        myRole: "parent",
        isCoParent: true,
        members: [
          { user_id: "dad", role: "parent", name: "아빠" },
          { user_id: "child", role: "child", name: "혜니" },
        ],
      },
      { id: "dad" },
      "parent",
    );

    expect(result.isPrimaryParent).toBe(false);
    expect(result.isCoParent).toBe(true);
    expect(result.canRequestChildLocation).toBe(false);
    expect(result.canUseRemoteListen).toBe(false);
    expect(result.canUseForceRing).toBe(false);
  });

  it("keeps child capabilities separate from parent controls", () => {
    const result = deriveParentCapabilities(
      { ...baseFamily, myRole: "child" },
      { id: "child" },
      "child",
    );

    expect(result.isPrimaryParent).toBe(false);
    expect(result.isCoParent).toBe(false);
    expect(result.canWriteSchedule).toBe(false);
    expect(result.canManageFamily).toBe(false);
    expect(result.canSendMemo).toBe(true);
    expect(result.canGivePraiseSticker).toBe(false);
    expect(result.canReceiveSos).toBe(false);
  });
});
