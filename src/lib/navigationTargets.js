const HOME_EXACT_NAMES = new Set(["집", "우리집", "우리집주소", "우리집위치", "집주소", "집위치", "home"]);

function compactName(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function hasValidLocation(place) {
  const rawLat = place?.location?.lat;
  const rawLng = place?.location?.lng;
  if (rawLat == null || rawLng == null || rawLat === "" || rawLng === "") return false;
  const lat = Number(place?.location?.lat);
  const lng = Number(place?.location?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function findHomeSavedPlace(savedPlaces = []) {
  const places = Array.isArray(savedPlaces) ? savedPlaces.filter(hasValidLocation) : [];
  if (places.length === 0) return null;

  const exact = places.find((place) => HOME_EXACT_NAMES.has(compactName(place.name)));
  if (exact) return exact;

  // Word-boundary fallback: only match when "집" is at the start (집주소,
  // 집위치) or end (우리집, 엄마집) of the compacted name. The previous
  // includes("집") matched "집중력 수업", "집회 장소", "집밥집" etc., so a
  // user with no real home place would be routed to a random place whose
  // name happened to contain the syllable.
  return places.find((place) => {
    const name = compactName(place.name);
    if (!name) return false;
    return name.endsWith("집")
        || name.startsWith("집주") || name.startsWith("집위") || name.startsWith("집소");
  }) || null;
}

export function buildHomeRouteEvent(homePlace) {
  if (!homePlace || !hasValidLocation(homePlace)) return null;
  const location = {
    ...homePlace.location,
    lat: Number(homePlace.location.lat),
    lng: Number(homePlace.location.lng),
  };

  return {
    id: `home-route:${homePlace.id || compactName(homePlace.name) || "home"}`,
    title: "집으로 가기",
    emoji: "🏠",
    time: "지금",
    color: "#0F766E",
    bg: "#CCFBF1",
    location,
  };
}
