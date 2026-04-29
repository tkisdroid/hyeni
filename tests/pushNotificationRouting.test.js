import { describe, expect, it } from "vitest";
import {
  canCallerSendAction,
  isEmergencyNotificationType,
  selectParentRecipientsForAction,
} from "../supabase/functions/push-notify/notificationRouting.ts";

describe("push notification routing", () => {
  const members = [
    { user_id: "mom", role: "parent", is_primary_parent: true },
    { user_id: "dad", role: "parent", is_primary_parent: false },
    { user_id: "child", role: "child", is_primary_parent: false },
  ];

  it("keeps kkuk separate from sos", () => {
    expect(isEmergencyNotificationType("kkuk", {})).toBe(false);
    expect(isEmergencyNotificationType("sos", {})).toBe(true);
  });

  it("routes sos to both parents", () => {
    expect(selectParentRecipientsForAction("sos", members)).toEqual(new Set(["mom", "dad"]));
  });

  it("routes kkuk only to the primary parent", () => {
    expect(selectParentRecipientsForAction("kkuk", members)).toEqual(new Set(["mom"]));
  });

  it("blocks co-parent control actions", () => {
    expect(canCallerSendAction("remote_listen", { role: "parent", isPrimaryParent: false })).toBe(false);
    expect(canCallerSendAction("request_location", { role: "parent", isPrimaryParent: false })).toBe(false);
    expect(canCallerSendAction("force_ring", { role: "parent", isPrimaryParent: false })).toBe(false);
    expect(canCallerSendAction("sos", { role: "child", isPrimaryParent: false })).toBe(true);
  });
});
