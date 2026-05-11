import { describe, expect, it } from "vitest";
import {
  getDangerZoneAlertKey,
  removeDangerZoneAlertKeysForZone,
} from "../src/lib/safetyAlerts.js";

describe("safety alert helpers", () => {
  it("scopes danger-zone fired state by child and zone", () => {
    const zone = { id: "zone-1" };

    expect(
      getDangerZoneAlertKey(zone, {
        selectedChild: { id: "child-a", user_id: "user-a" },
        childPos: { user_id: "user-a" },
      }),
    ).toBe("child-a:zone-1");

    expect(
      getDangerZoneAlertKey(zone, {
        selectedChild: { id: "child-b", user_id: "user-b" },
        childPos: { user_id: "user-b" },
      }),
    ).toBe("child-b:zone-1");
  });

  it("falls back to the position user id when selected child metadata is unavailable", () => {
    expect(
      getDangerZoneAlertKey(
        { id: "zone-2" },
        { childPos: { user_id: "child-user-2" } },
      ),
    ).toBe("child-user-2:zone-2");
  });

  it("removes every child-scoped fired key for a deleted danger zone", () => {
    const prev = new Set(["child-a:zone-1", "child-b:zone-1", "child-a:zone-2", "legacy-zone"]);
    const next = removeDangerZoneAlertKeysForZone(prev, "zone-1");

    expect(Array.from(next).sort()).toEqual(["child-a:zone-2", "legacy-zone"]);
    expect(prev.has("child-a:zone-1")).toBe(true);
  });
});
