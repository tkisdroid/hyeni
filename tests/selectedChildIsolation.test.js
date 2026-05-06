import { describe, expect, it } from "vitest";
import {
  buildSelectedChildCommandPayload,
  filterEventMapForChild,
  resolveSelectedChildPosition,
} from "../src/lib/selectedChildIsolation.js";

describe("selected child isolation helpers", () => {
  const childA = { id: "member-a", user_id: "child-a", name: "A" };
  const childB = { id: "member-b", user_id: "child-b", name: "B" };

  it("prefers the selected child's live position over the most recent unrelated child position", () => {
    const unrelatedLatest = { user_id: "child-a", lat: 37.1, lng: 127.1, updatedAt: "2026-05-05T01:05:00Z" };
    const selectedPosition = { user_id: "child-b", lat: 37.2, lng: 127.2, updatedAt: "2026-05-05T01:00:00Z" };

    expect(resolveSelectedChildPosition({
      childPos: unrelatedLatest,
      allChildPositions: [unrelatedLatest, selectedPosition],
      selectedChild: childB,
    })).toEqual(selectedPosition);
  });

  it("filters parent event maps to family-wide events and the selected child only", () => {
    const events = {
      "2026-4-5": [
        { id: "family", is_family_event: true, child_ids: [] },
        { id: "a-only", is_family_event: false, child_ids: [childA.id] },
        { id: "b-only", is_family_event: false, child_ids: [childB.id] },
        { id: "no-target", is_family_event: false, child_ids: [] },
      ],
    };

    expect(filterEventMapForChild(events, childB.id)).toEqual({
      "2026-4-5": [
        { id: "family", is_family_event: true, child_ids: [] },
        { id: "b-only", is_family_event: false, child_ids: [childB.id] },
      ],
    });
  });

  it("adds targetUserId only when a selected child has a concrete user id", () => {
    expect(buildSelectedChildCommandPayload({ selectedChild: childB })).toEqual({ targetUserId: "child-b" });
    expect(buildSelectedChildCommandPayload({ selectedChild: { id: "placeholder", user_id: null } })).toEqual({});
  });
});
