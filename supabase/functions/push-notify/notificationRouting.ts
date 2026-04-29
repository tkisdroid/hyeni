// ── Push Notification Routing Helpers ─────────────────────────────────────
// Pure functions used by `index.ts` to:
// 1. Decide which family parents receive a kkuk vs SOS push
//    (kkuk = primary parent only · SOS = both parents).
// 2. Reject co-parent (non-primary parent) callers from issuing
//    sensitive remote-control actions (remote_listen, force_ring, etc.).
// 3. Classify a payload as "emergency" so FCM uses high priority +
//    bypasses Doze mode for time-critical alerts.
//
// Kept separate from index.ts so it is unit-testable from Vitest
// without standing up the Deno Edge runtime, and so Task 4's DB
// helpers (public.is_primary_parent) can be added independently —
// the function caller derives `is_primary_parent` from the existing
// columns (`families.parent_id`) and passes it in.

const CONTROL_ACTIONS = new Set([
  "remote_listen",
  "remote_listen_stop",
  "request_location",
  "request_device_status",
  "force_ring",
  "force_ring_stop",
]);

const EMERGENCY_ALERT_TYPES = new Set([
  "not_arrived",
  "missed_arrival",
  "danger_zone",
  "danger_enter",
  "danger_entry",
  "danger_exit",
  "sos",
  "sos_followup",
]);

type Member = {
  user_id?: string | null;
  role?: string | null;
  is_primary_parent?: boolean;
};

export function isEmergencyNotificationType(
  type: string,
  data: Record<string, unknown> = {},
): boolean {
  // kkuk is intentionally NOT emergency — separated from sos so the
  // primary parent's "꾹" tap does not produce a critical-channel push.
  if (type === "kkuk") return false;
  if (type === "sos" || type === "emergency") return true;
  if (String(data.urgent || "").toLowerCase() === "true") return true;
  if (type !== "parent_alert") return false;

  const severity = String(data.severity || "").trim().toLowerCase();
  const alertType = String(data.alertType || data.alert_type || "").trim().toLowerCase();
  return severity === "emergency"
    || severity === "critical"
    || severity === "urgent"
    || EMERGENCY_ALERT_TYPES.has(alertType);
}

export function selectParentRecipientsForAction(
  action: string,
  members: Member[],
): Set<string> {
  const parents = (members || []).filter((member) => (
    member.role === "parent"
    && typeof member.user_id === "string"
    && member.user_id.length > 0
  ));

  if (action === "sos") {
    return new Set(parents.map((member) => member.user_id as string));
  }

  // Default (incl. kkuk): primary parent only. Fallback to all parents
  // if no primary is flagged so we never silently drop the alert.
  const primary = parents.find((member) => member.is_primary_parent);
  return new Set(
    primary?.user_id
      ? [primary.user_id]
      : parents.map((member) => member.user_id as string),
  );
}

export function canCallerSendAction(
  action: string,
  caller: { role?: string; isPrimaryParent?: boolean },
): boolean {
  if (CONTROL_ACTIONS.has(action)) {
    return caller.role === "parent" && caller.isPrimaryParent === true;
  }
  return true;
}
