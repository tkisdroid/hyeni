function getUserId(value) {
  const id = value?.user_id || value?.userId || "";
  return typeof id === "string" && id.trim() ? id.trim() : "";
}

function getMemberId(value) {
  const id = value?.id || value?.member_id || value?.memberId || "";
  return typeof id === "string" && id.trim() ? id.trim() : "";
}

export function resolveSelectedChildPosition({ childPos = null, allChildPositions = [], selectedChild = null } = {}) {
  const selectedUserId = getUserId(selectedChild);
  const positions = Array.isArray(allChildPositions) ? allChildPositions : [];

  if (selectedUserId) {
    const fromList = positions.find((pos) => getUserId(pos) === selectedUserId);
    if (fromList) return fromList;
    return getUserId(childPos) === selectedUserId ? childPos : null;
  }

  return childPos || positions[0] || null;
}

export function filterEventsForChild(eventList, childMemberId) {
  if (!Array.isArray(eventList)) return [];
  const targetMemberId = typeof childMemberId === "string" ? childMemberId.trim() : "";
  if (!targetMemberId) return [];

  return eventList.filter((event) => {
    if (event?.is_family_event) return true;
    const childIds = Array.isArray(event?.child_ids) ? event.child_ids : [];
    return childIds.includes(targetMemberId);
  });
}

export function filterEventMapForChild(events, childMemberId) {
  const targetMemberId = typeof childMemberId === "string" ? childMemberId.trim() : "";
  if (!targetMemberId) return {};
  if (Array.isArray(events)) return filterEventsForChild(events, targetMemberId);
  if (!events || typeof events !== "object") return {};

  const filtered = {};
  for (const dateKey of Object.keys(events)) {
    filtered[dateKey] = filterEventsForChild(events[dateKey], targetMemberId);
  }
  return filtered;
}

export function buildSelectedChildCommandPayload({ selectedChild = null } = {}) {
  const targetUserId = getUserId(selectedChild);
  return targetUserId ? { targetUserId } : {};
}

export function getSelectedChildMemberId(selectedChild) {
  return getMemberId(selectedChild);
}
