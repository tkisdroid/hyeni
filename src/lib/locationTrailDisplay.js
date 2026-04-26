export const LOCATION_TRAIL_GRADIENT_STOPS = ["#2563EB", "#06B6D4"];
export const ACADEMY_STAY_MATCH_RADIUS_M = 120;

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function hasCoordinate(value) {
  const lat = toNumber(value?.lat);
  const lng = toNumber(value?.lng);
  return lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function distanceM(a, b) {
  const lat1 = toNumber(a?.lat);
  const lng1 = toNumber(a?.lng);
  const lat2 = toNumber(b?.lat);
  const lng2 = toNumber(b?.lng);
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Number.POSITIVE_INFINITY;

  const R = 6371000;
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function findAcademyForStay(place, academies = [], radiusM = ACADEMY_STAY_MATCH_RADIUS_M) {
  if (!hasCoordinate(place) || !Array.isArray(academies)) return null;

  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  academies.forEach((academy) => {
    if (!academy?.name || !hasCoordinate(academy.location)) return;
    const distance = distanceM(place, academy.location);
    if (distance <= radiusM && distance < bestDistance) {
      best = academy;
      bestDistance = distance;
    }
  });

  return best;
}

function isCoordinateLabel(value) {
  return /^좌표\s/.test(String(value || "").trim());
}

function cleanDisplayLabel(value) {
  const label = String(value || "").replace(/\s+/g, " ").trim();
  return label && !isCoordinateLabel(label) ? label : "";
}

function splitAddressAndPlaceName(label) {
  const parts = cleanDisplayLabel(label)
    .split(" · ")
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { addressLabel: "", placeName: "" };

  return {
    addressLabel: parts[0],
    placeName: parts.slice(1).join(" · "),
  };
}

export function getStayDisplayParts(place, { academies = [], locationInfo = null, fallback = "주소 확인 중" } = {}) {
  const academy = findAcademyForStay(place, academies);
  const legacyLabelParts = splitAddressAndPlaceName(locationInfo?.label);
  const academyAddress = cleanDisplayLabel(academy?.location?.address);
  const explicitAddress = cleanDisplayLabel(locationInfo?.addressLabel || locationInfo?.address);
  const labelAddress = cleanDisplayLabel(legacyLabelParts.addressLabel);
  const plainLabel = cleanDisplayLabel(locationInfo?.label);

  if (academy?.name) {
    return {
      title: academy.name,
      addressLabel: academyAddress || explicitAddress || labelAddress || "",
    };
  }

  const title = cleanDisplayLabel(locationInfo?.placeName)
    || cleanDisplayLabel(legacyLabelParts.placeName)
    || cleanDisplayLabel(locationInfo?.shortLabel)
    || cleanDisplayLabel(place?.placeName)
    || cleanDisplayLabel(place?.shortLabel)
    || plainLabel
    || cleanDisplayLabel(place?.addressLabel || place?.address)
    || fallback;

  const addressLabel = explicitAddress
    || labelAddress
    || (plainLabel && plainLabel !== title ? plainLabel : "")
    || cleanDisplayLabel(place?.addressLabel || place?.address);

  return {
    title,
    addressLabel: addressLabel && addressLabel !== title ? addressLabel : "",
  };
}

export function getStayDisplayTitle(place, options = {}) {
  return getStayDisplayParts(place, options).title;
}
