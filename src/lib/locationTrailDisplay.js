export const LOCATION_TRAIL_GRADIENT_STOPS = ["#2563EB", "#06B6D4"];
export const ACADEMY_STAY_MATCH_RADIUS_M = 120;
const SUMMARY_JITTER_M = 8;
const SUMMARY_DWELL_RADIUS_M = 80;
const SUMMARY_DWELL_MIN_MS = 10 * 60_000;

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

function formatClock(ms) {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0분";
  const totalMinutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분`;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return "0m";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
}

function normalizeHistoryPoint(point) {
  if (!hasCoordinate(point)) return null;
  const recordedAt = point?.recorded_at || point?.recordedAt || point?.updated_at || point?.updatedAt || null;
  const recordedMs = recordedAt ? new Date(recordedAt).getTime() : null;
  return {
    user_id: point?.user_id || point?.userId || null,
    lat: Number(point.lat),
    lng: Number(point.lng),
    recorded_at: recordedAt,
    recordedAt,
    recordedMs: Number.isFinite(recordedMs) ? recordedMs : null,
  };
}

function compactSummaryPoints(points) {
  const compacted = [];
  points.forEach((point) => {
    const prev = compacted[compacted.length - 1];
    if (prev && distanceM(prev, point) < SUMMARY_JITTER_M) {
      compacted[compacted.length - 1] = point.recordedMs && (!prev.recordedMs || point.recordedMs > prev.recordedMs)
        ? { ...prev, ...point }
        : prev;
      return;
    }
    compacted.push(point);
  });
  return compacted;
}

function findNamedPlace(point, { savedPlaces = [], academies = [] } = {}) {
  const candidates = buildRegisteredPlaceCandidates({ savedPlaces, academies });
  const match = findRegisteredPlace(point, candidates);
  return match?.place?.name || "";
}

function getRegisteredPlaceKey(place, source, index) {
  const location = place?.location || place;
  const lat = toNumber(location?.lat);
  const lng = toNumber(location?.lng);
  const address = String(location?.address || "").trim().toLowerCase();
  if (address) return `${source}:addr:${address}`;
  if (lat != null && lng != null) return `${source}:coord:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  return `${source}:${place?.id || place?.name || index}`;
}

function buildRegisteredPlaceCandidates({ savedPlaces = [], academies = [] } = {}) {
  const byKey = new Map();
  const push = (place, source, index) => {
    const location = place?.location || place;
    const name = cleanDisplayLabel(place?.name);
    if (!name || !hasCoordinate(location)) return;
    const key = getRegisteredPlaceKey(place, source, index);
    if (!key || byKey.has(key)) return;
    byKey.set(key, {
      id: key,
      source,
      name,
      location,
    });
  };

  (Array.isArray(savedPlaces) ? savedPlaces : []).forEach((place, index) => push(place, "saved", index));
  (Array.isArray(academies) ? academies : []).forEach((place, index) => push(place, "academy", index));
  return Array.from(byKey.values());
}

function findRegisteredPlace(point, candidates, radiusM = ACADEMY_STAY_MATCH_RADIUS_M) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
    if (!candidate?.name || !hasCoordinate(candidate.location)) return;
    const distance = distanceM(point, candidate.location);
    if (distance <= radiusM && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  });
  return best ? { place: best, distanceM: bestDistance } : null;
}

function getPlaceVisitLabel(placeName, hasRange) {
  const name = cleanDisplayLabel(placeName) || "등록된 장소";
  if (/학교|초등|중등|고등/.test(name)) return "등교";
  return hasRange ? name : `${name} 도착`;
}

function buildRegisteredPlaceVisits(points, placeOptions) {
  const candidates = buildRegisteredPlaceCandidates(placeOptions);
  if (!candidates.length) return [];

  const timed = points.filter((point) => Number.isFinite(point.recordedMs));
  const visits = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const hasRange = Number.isFinite(current.startMs)
      && Number.isFinite(current.endMs)
      && current.endMs > current.startMs;
    visits.push({
      id: `place-visit-${visits.length}-${current.place.id}-${current.startMs || visits.length}`,
      placeId: current.place.id,
      placeName: current.place.name,
      label: getPlaceVisitLabel(current.place.name, hasRange),
      startMs: current.startMs,
      endMs: current.endMs,
      durationMs: hasRange ? current.endMs - current.startMs : 0,
      timeLabel: hasRange
        ? `${formatDuration(current.endMs - current.startMs)} 머무름`
        : `${formatClock(current.startMs)}분`,
    });
    current = null;
  };

  timed.forEach((point) => {
    const match = findRegisteredPlace(point, candidates);
    if (!match) {
      flush();
      return;
    }

    if (current?.place?.id === match.place.id) {
      current.endMs = point.recordedMs;
      return;
    }

    flush();
    current = {
      place: match.place,
      startMs: point.recordedMs,
      endMs: point.recordedMs,
    };
  });
  flush();

  return visits;
}

function averagePoint(points) {
  if (!points.length) return null;
  const total = points.reduce((acc, point) => ({
    lat: acc.lat + point.lat,
    lng: acc.lng + point.lng,
  }), { lat: 0, lng: 0 });
  return { lat: total.lat / points.length, lng: total.lng / points.length };
}

function buildSummaryDwellPlaces(points, placeOptions) {
  const timed = points.filter((point) => Number.isFinite(point.recordedMs));
  const places = [];
  let cluster = [];

  const flush = () => {
    if (cluster.length < 2) {
      cluster = [];
      return;
    }
    const startMs = cluster[0].recordedMs;
    const endMs = cluster[cluster.length - 1].recordedMs;
    const durationMs = endMs - startMs;
    if (durationMs >= SUMMARY_DWELL_MIN_MS) {
      const center = averagePoint(cluster);
      if (center) {
        places.push({
          id: `dwell-${places.length}-${startMs}`,
          ...center,
          startMs,
          endMs,
          durationMs,
          timeLabel: `${formatClock(startMs)}-${formatClock(endMs)}`,
          durationLabel: formatDuration(durationMs),
          placeLabel: findNamedPlace(center, placeOptions),
        });
      }
    }
    cluster = [];
  };

  timed.forEach((point) => {
    if (!cluster.length) {
      cluster = [point];
      return;
    }
    const center = averagePoint(cluster);
    if (center && distanceM(center, point) <= SUMMARY_DWELL_RADIUS_M) {
      cluster.push(point);
      return;
    }
    flush();
    cluster = [point];
  });
  flush();

  return places;
}

export function getLocationHistoryDayBounds(dateLike) {
  const source = dateLike instanceof Date
    ? dateLike
    : new Date(Number(dateLike?.year), Number(dateLike?.month), Number(dateLike?.day || dateLike?.date));
  const start = new Date(source.getFullYear(), source.getMonth(), source.getDate(), 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

export function buildLocationDaySummary(points, options = {}) {
  const childUserId = options.childUserId || options.child?.user_id || options.child?.userId || null;
  const normalized = (Array.isArray(points) ? points : [])
    .map(normalizeHistoryPoint)
    .filter(Boolean)
    .filter((point) => !childUserId || point.user_id === childUserId)
    .sort((left, right) => (left.recordedMs || 0) - (right.recordedMs || 0));
  const compacted = compactSummaryPoints(normalized);
  const distanceMeters = compacted.reduce((sum, point, index) => {
    if (index === 0) return 0;
    return sum + distanceM(compacted[index - 1], point);
  }, 0);
  const first = compacted[0] || null;
  const last = compacted[compacted.length - 1] || null;
  const durationMs = first?.recordedMs && last?.recordedMs && last.recordedMs > first.recordedMs
    ? last.recordedMs - first.recordedMs
    : 0;
  const placeOptions = { savedPlaces: options.savedPlaces, academies: options.academies };
  const timeline = compacted.map((point, index) => ({
    id: `${point.user_id || "child"}-${point.recordedMs || index}-${index}`,
    ...point,
    timeLabel: formatClock(point.recordedMs),
    placeLabel: findNamedPlace(point, placeOptions),
  }));

  return {
    hasData: compacted.length > 0,
    pointCount: compacted.length,
    first,
    last,
    firstTimeLabel: first ? formatClock(first.recordedMs) : "",
    lastTimeLabel: last ? formatClock(last.recordedMs) : "",
    distanceMeters,
    distanceLabel: formatDistance(distanceMeters),
    durationMs,
    durationLabel: formatDuration(durationMs),
    timeline,
    dwellPlaces: buildSummaryDwellPlaces(compacted, placeOptions),
    placeVisits: buildRegisteredPlaceVisits(compacted, placeOptions),
  };
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
