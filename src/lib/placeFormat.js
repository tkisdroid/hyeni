// src/lib/placeFormat.js
// Pure utilities for formatting place/address labels and grouping events by
// location. Extracted from App.jsx (Phase 5 #4 / A2).
//
// Domain split:
//   - 좌표 라벨/키: formatLatLngLabel, getPositionLocationKey
//   - 한국 주소 파서: extractNeighborhoodLabel, formatCompactPlaceName,
//                    buildCompactAddressLabel, buildReadablePlaceName,
//                    isDetailedKoreanAddress, extractPreciseAddressFromKakao
//   - 장소 항목 빌더: hasPlaceLocation, getPlaceLocationKey, buildSavedPlaceItems,
//                    buildSchedulePlaceOptions, buildEventPlaceItems, eventDateValue
//
// 모두 pure — React/Supabase/브라우저 의존 없음.

export function formatLatLngLabel(position) {
    if (!Number.isFinite(position?.lat) || !Number.isFinite(position?.lng)) return "";
    return `좌표 ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
}

export function getPositionLocationKey(position) {
    const hasCoord = Number.isFinite(position?.lat) && Number.isFinite(position?.lng);
    if (!hasCoord) return position?.user_id ? `user:${position.user_id}` : "";
    // ~11 m grid so a moved child invalidates its cached geocode label.
    // Without this the dashboard label stayed frozen at the first geocoded
    // address while the map marker (raw lat/lng) followed the child.
    const lat = position.lat.toFixed(4);
    const lng = position.lng.toFixed(4);
    return position?.user_id
        ? `user:${position.user_id}:${lat},${lng}`
        : `coord:${lat},${lng}`;
}

export function extractNeighborhoodLabel(label, source = {}) {
    const directLabel = [
        source?.region_3depth_h_name,
        source?.region_3depth_name,
        source?.region_2depth_name,
    ].find(value => String(value || "").trim());
    if (directLabel) return String(directLabel).trim();

    const text = String(label || "").trim();
    if (!text || text.startsWith("좌표")) return "";

    const tokens = text
        .split(/\s+/)
        .map(part => part.replace(/[(),]/g, "").trim())
        .filter(Boolean);
    const neighborhood = tokens.find(part => /(동|읍|면|리)$/.test(part));
    if (neighborhood) return neighborhood;

    return tokens.find(part => /(구|군|시)$/.test(part)) || "";
}

export function formatCompactPlaceName(value) {
    return String(value || "")
        .replace(/([가-힣])(\d+차)/g, "$1 $2")
        .replace(/\s*\d+\s*동(?=\s|$)/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function buildCompactAddressLabel(resultItem) {
    const road = resultItem?.road_address || null;
    const lot = resultItem?.address || null;
    const neighborhood = extractNeighborhoodLabel("", lot)
        || extractNeighborhoodLabel("", road)
        || extractNeighborhoodLabel(lot?.address_name)
        || extractNeighborhoodLabel(road?.address_name);
    const buildingName = formatCompactPlaceName(road?.building_name);

    if (neighborhood && buildingName) return `${neighborhood} ${buildingName}`;
    if (neighborhood && road?.road_name) return `${neighborhood} ${formatCompactPlaceName(road.road_name)}`;
    if (neighborhood) return neighborhood;
    return formatCompactPlaceName(road?.address_name || lot?.address_name || "");
}

export function buildReadablePlaceName(resultItem) {
    const road = resultItem?.road_address || null;
    const buildingName = formatCompactPlaceName(road?.building_name);
    if (buildingName) return buildingName;
    return buildCompactAddressLabel(resultItem);
}

export function isDetailedKoreanAddress(label, source = {}) {
    const text = String(label || "").trim();
    if (!text) return false;
    return Boolean(
        source?.road_name
        || source?.building_name
        || source?.main_building_no
        || source?.main_address_no
        || /\d/.test(text)
    );
}

export function extractPreciseAddressFromKakao(resultItem, fallbackPosition) {
    const road = resultItem?.road_address || null;
    const lot = resultItem?.address || null;
    const roadLabel = road?.address_name || "";
    const neighborhood = extractNeighborhoodLabel("", lot) || extractNeighborhoodLabel("", road) || extractNeighborhoodLabel(lot?.address_name) || extractNeighborhoodLabel(roadLabel);
    const shortLabel = buildCompactAddressLabel(resultItem);
    const placeName = buildReadablePlaceName(resultItem);
    if (roadLabel && isDetailedKoreanAddress(roadLabel, road)) {
        return {
            label: [roadLabel, road?.building_name].filter(Boolean).join(" · "),
            addressLabel: roadLabel,
            placeName,
            shortLabel,
            precise: true,
            neighborhood,
        };
    }

    const lotLabel = lot?.address_name || "";
    if (lotLabel && isDetailedKoreanAddress(lotLabel, lot)) {
        return { label: lotLabel, addressLabel: lotLabel, placeName, shortLabel, precise: true, neighborhood };
    }

    return {
        label: formatLatLngLabel(fallbackPosition) || "정확한 위치 확인 중",
        addressLabel: "",
        placeName,
        shortLabel,
        precise: false,
        neighborhood,
    };
}

export function hasPlaceLocation(location) {
    return Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng));
}

export function getPlaceLocationKey(location) {
    if (!hasPlaceLocation(location)) return "";
    const addressKey = typeof location.address === "string" ? location.address.trim().toLowerCase() : "";
    const lat = Number(location.lat);
    const lng = Number(location.lng);
    if (addressKey) return `addr:${addressKey}`;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return `coord:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    }
    return "";
}

export function buildSavedPlaceItems(savedPlaces) {
    const byKey = new Map();

    (savedPlaces || []).forEach((place) => {
        if (!hasPlaceLocation(place?.location)) return;
        const key = getPlaceLocationKey(place.location) || `saved:${place.id}`;
        if (!key || byKey.has(key)) return;
        byKey.set(key, place);
    });

    return Array.from(byKey.values());
}

export function buildSchedulePlaceOptions(academies = [], savedPlaces = []) {
    const byKey = new Map();
    const pushOption = (option) => {
        if (!hasPlaceLocation(option?.location)) return;
        const key = getPlaceLocationKey(option.location) || `${option.source}:${option.id}`;
        if (!key || byKey.has(key)) return;
        byKey.set(key, { ...option, key });
    };

    (academies || []).forEach((academy) => {
        pushOption({
            id: academy.id || academy.name,
            source: "academy",
            name: academy.name,
            category: academy.category || "school",
            emoji: academy.emoji || "🏫",
            location: academy.location,
            badge: "학원",
        });
    });

    (savedPlaces || []).forEach((place) => {
        pushOption({
            id: place.id || place.name,
            source: "saved_place",
            name: place.name,
            emoji: place.is_playdate_safe ? "🛡️" : "📍",
            location: place.location,
            badge: place.is_playdate_safe ? "안전장소" : "자주가는 장소",
        });
    });

    return Array.from(byKey.values());
}

export function eventDateValue(dateKey, time) {
    if (typeof dateKey !== "string" || typeof time !== "string") return Number.POSITIVE_INFINITY;
    const [year, month, day] = dateKey.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    if ([year, month, day, hours, minutes].some((value) => Number.isNaN(value))) {
        return Number.POSITIVE_INFINITY;
    }
    return new Date(year, month, day, hours, minutes).getTime();
}

export function buildEventPlaceItems(events, excludedKeys = new Set(), arrivedSet = new Set()) {
    const groups = new Map();

    Object.entries(events || {}).forEach(([dateKey, dayEvents]) => {
        (dayEvents || []).forEach((event) => {
            if (!hasPlaceLocation(event?.location)) return;
            const locationKey = getPlaceLocationKey(event.location);
            if (!locationKey || excludedKeys.has(locationKey)) return;

            const eventWithDate = { ...event, dateKey };
            const existing = groups.get(locationKey);
            if (existing) {
                existing.events.push(eventWithDate);
                return;
            }

            groups.set(locationKey, {
                key: locationKey,
                location: event.location,
                events: [eventWithDate],
            });
        });
    });

    return Array.from(groups.values())
        .map((group) => {
            const sortedEvents = [...group.events].sort(
                (left, right) => eventDateValue(left.dateKey, left.time) - eventDateValue(right.dateKey, right.time)
            );
            const arrivedCount = sortedEvents.filter((event) => arrivedSet.has(event.id)).length;
            const titleSet = Array.from(new Set(sortedEvents.map((event) => event.title).filter(Boolean)));
            const nextEvent = sortedEvents[0] || null;

            return {
                key: group.key,
                location: group.location,
                events: sortedEvents,
                nextEvent,
                eventCount: sortedEvents.length,
                arrivedCount,
                title: titleSet.length === 1
                    ? titleSet[0]
                    : group.location?.address?.split(" ").slice(-2).join(" ") || "일정 장소",
            };
        })
        .sort(
            (left, right) =>
                eventDateValue(left.nextEvent?.dateKey, left.nextEvent?.time)
                - eventDateValue(right.nextEvent?.dateKey, right.nextEvent?.time)
        );
}
