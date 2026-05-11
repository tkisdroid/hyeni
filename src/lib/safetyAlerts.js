export function getDangerZoneAlertKey(zone, { selectedChild, childPos } = {}) {
  const zoneId = String(zone?.id || "").trim();
  if (!zoneId) return "";

  const childKey = String(
    selectedChild?.id
      || selectedChild?.user_id
      || childPos?.family_member_id
      || childPos?.member_id
      || childPos?.user_id
      || childPos?.userId
      || "unknown-child",
  ).trim();

  return `${childKey || "unknown-child"}:${zoneId}`;
}

export function removeDangerZoneAlertKeysForZone(keys, zoneId) {
  const targetZoneId = String(zoneId || "").trim();
  if (!targetZoneId) return new Set(keys || []);

  const next = new Set();
  for (const key of keys || []) {
    const value = String(key);
    if (value === targetZoneId || value.endsWith(`:${targetZoneId}`)) continue;
    next.add(key);
  }
  return next;
}
